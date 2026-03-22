/**
 * cameraUtils.js
 *
 * Prefer front/user-facing camera (especially on phones), but fall back safely.
 */

export async function openFrontCamera({ width = 1280, height = 720 } = {}) {
  // Step 1: open a stream ASAP (this triggers the permission prompt).
  // After permission is granted, device labels become available and we can pick
  // the best laptop/integrated webcam instead of a virtual/external cam.
  let stream

  try {
    stream = await navigator.mediaDevices.getUserMedia(buildBaseConstraints(width, height))
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('[camera] base constraints failed; trying any camera', err)
    stream = await navigator.mediaDevices.getUserMedia({
      video: { width: { ideal: width }, height: { ideal: height } },
      audio: false,
    })
  }

  // Step 2: enumerate devices (labels usually available now) and switch if we
  // can find a better match for laptop/integrated camera.
  try {
    const currentTrack = stream.getVideoTracks?.()?.[0] || null
    const currentSettings = currentTrack?.getSettings?.() || {}
    const currentDeviceId = currentSettings.deviceId || null
    const currentLabel = currentTrack?.label || ''

    const devices = await navigator.mediaDevices.enumerateDevices()
    const videoDevices = devices.filter((d) => d.kind === 'videoinput')

    const scored = scoreAndSortVideoDevices(videoDevices)
    const preferred = scored[0] || null

    // eslint-disable-next-line no-console
    console.info(
      '[camera] Devices:',
      scored.map((d) => ({ label: d.label, score: d.__score }))
    )

    const currentLooksBad = isLikelyPhoneOrVirtualCamera(currentLabel)
    const preferredIsDifferent = preferred?.deviceId && preferred.deviceId !== currentDeviceId
    const shouldSwitch = currentLooksBad || preferredIsDifferent

    if (shouldSwitch) {
      // Try candidates in order until one works.
      let switched = false
      for (const candidate of scored) {
        if (!candidate?.deviceId) continue
        if (candidate.deviceId === currentDeviceId) continue

        try {
          // eslint-disable-next-line no-console
          console.info('[camera] Trying camera:', candidate.label || candidate.deviceId)
          const nextStream = await navigator.mediaDevices.getUserMedia({
            video: {
              ...buildBaseVideoConstraints(width, height),
              deviceId: { exact: candidate.deviceId },
            },
            audio: false,
          })

          stopStream(stream)
          stream = nextStream
          switched = true
          // eslint-disable-next-line no-console
          console.info('[camera] Using camera:', candidate.label || candidate.deviceId)
          break
        } catch (switchErr) {
          // eslint-disable-next-line no-console
          console.warn('[camera] Failed to use camera:', candidate.label || candidate.deviceId, switchErr)
        }
      }

      if (!switched) {
        // eslint-disable-next-line no-console
        console.info('[camera] Keeping initial camera:', currentLabel || currentDeviceId || 'default')
      }
    } else {
      // eslint-disable-next-line no-console
      console.info('[camera] Using camera:', currentLabel || currentDeviceId || 'default')
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('[camera] device enumeration/switch skipped', err)
  }

  return stream
}

function buildBaseVideoConstraints(width, height) {
  return {
    width: { ideal: width },
    height: { ideal: height },
    // On mobile, this helps pick the selfie camera.
    facingMode: { ideal: 'user' },
  }
}

function buildBaseConstraints(width, height) {
  return {
    video: buildBaseVideoConstraints(width, height),
    audio: false,
  }
}

function pickPreferredVideoDevice(videoDevices) {
  if (!Array.isArray(videoDevices) || videoDevices.length === 0) return null
  if (videoDevices.length === 1) return videoDevices[0]

  return scoreAndSortVideoDevices(videoDevices)[0] || videoDevices[0]
}

function scoreAndSortVideoDevices(videoDevices) {
  if (!Array.isArray(videoDevices)) return []

  const scored = videoDevices.map((d) => {
    const label = String(d?.label || '')
    const labelLc = label.toLowerCase()
    let score = 0

    // Strong positives for laptop/integrated webcams
    if (/(integrated|built[- ]?in|internal|laptop|wide vision|easycamera)/.test(labelLc)) score += 60
    if (/(front|user|facetime|truevision|webcam|uvc)/.test(labelLc)) score += 25

    // Penalize virtual webcams and phone-based cameras (e.g. Windows Phone Link)
    if (isLikelyPhoneOrVirtualCamera(label)) score -= 200

    // Mild penalty for external USB webcams when an integrated exists
    if (/(usb)/.test(labelLc)) score -= 5

    // Small bonus if it's explicitly a camera
    if (/(camera)/.test(labelLc)) score += 3

    return { ...d, __score: score }
  })

  // If we have at least one non-bad labeled device, push bad ones to the bottom
  // even if labels are weird.
  const hasAnyGood = scored.some((d) => !isLikelyPhoneOrVirtualCamera(d.label) && d.__score > -150)
  const normalized = hasAnyGood
    ? scored.map((d) => ({ ...d, __score: isLikelyPhoneOrVirtualCamera(d.label) ? d.__score - 1000 : d.__score }))
    : scored

  normalized.sort((a, b) => (b.__score || 0) - (a.__score || 0))
  return normalized
}

function isLikelyPhoneOrVirtualCamera(labelRaw) {
  const label = String(labelRaw || '').toLowerCase()

  // Virtual webcam apps
  if (/(virtual|obs|snap(\s+camera)?|manycam|droidcam|ivcam|epoccam|ndi|screen|capture)/.test(label)) return true

  // Windows "Phone Link" / phone-as-webcam sources
  if (/(phone\s*link|your\s*phone|continuity)/.test(label)) return true

  // Common phone/platform terms and brands that show up in webcam labels
  if (
    /(android|iphone|ipad|motorola|samsung|galaxy|xiaomi|redmi|oneplus|realme|oppo|vivo|huawei|honor|pixel)/.test(label)
  )
    return true

  return false
}

export function stopStream(stream) {
  if (!stream) return
  stream.getTracks().forEach((t) => t.stop())
}

export function attachStreamToVideo(stream, videoEl) {
  return new Promise((resolve, reject) => {
    videoEl.srcObject = stream
    videoEl.playsInline = true
    videoEl.muted = true
    videoEl.setAttribute('playsinline', '')
    videoEl.setAttribute('muted', '')

    videoEl.onloadedmetadata = () => {
      videoEl.play().then(resolve).catch(reject)
    }
    videoEl.onerror = reject
  })
}
