import React, { useRef, useEffect, useState, useCallback } from 'react'
import { X, ZoomIn, ZoomOut, RotateCcw, Download, Info, Camera } from 'lucide-react'
import * as THREE from 'three'

/* ─────────────────────────────────────────────
   1. BODY TRY-ON  (MediaPipe Pose via CDN)
───────────────────────────────────────────── */
export function BodyTryOn({ product, onClose }) {
  const videoRef   = useRef(null)
  const canvasRef  = useRef(null)
  const streamRef  = useRef(null)
  const rafRef     = useRef(null)
  const poseRef    = useRef(null)
  const [status, setStatus]   = useState('loading')
  const [detected, setDetected] = useState(false)
  const [scale, setScale]     = useState(1)
  const [offsetY, setOffsetY] = useState(0)

  const startCam = async (fallback = false) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video:{ width:640, height:480, facingMode:'user' } })
      streamRef.current = stream
      videoRef.current.srcObject = stream
      videoRef.current.onloadedmetadata = () => {
        videoRef.current.play()
        setStatus('active')
        fallback ? drawFallback() : processFrame()
      }
    } catch { setStatus('error') }
  }

  const processFrame = async () => {
    if (!videoRef.current || !poseRef.current) return
    try { await poseRef.current.send({ image: videoRef.current }) } catch {}
    rafRef.current = requestAnimationFrame(processFrame)
  }

  const drawFallback = () => {
    const draw = () => {
      const v = videoRef.current; const c = canvasRef.current
      if (!v || !c) return
      c.width = v.videoWidth||640; c.height = v.videoHeight||480
      const ctx = c.getContext('2d')
      ctx.save(); ctx.scale(-1,1); ctx.drawImage(v,-c.width,0,c.width,c.height); ctx.restore()
      rafRef.current = requestAnimationFrame(draw)
    }
    draw()
  }

  const onPoseResults = (results) => {
    const c = canvasRef.current; const v = videoRef.current
    if (!c || !v) return
    const w = v.videoWidth||640; const h = v.videoHeight||480
    c.width = w; c.height = h
    const ctx = c.getContext('2d')
    ctx.save(); ctx.scale(-1,1); ctx.drawImage(results.image,-w,0,w,h); ctx.restore()

    if (results.poseLandmarks) {
      setDetected(true)
      const lm = results.poseLandmarks
      const ls = { x:(1-lm[11].x)*w, y:lm[11].y*h }
      const rs = { x:(1-lm[12].x)*w, y:lm[12].y*h }
      const lh = { x:(1-lm[23].x)*w, y:lm[23].y*h }
      const sw = Math.abs(ls.x - rs.x)
      const cx = (ls.x+rs.x)/2
      const topY = Math.min(ls.y,rs.y)
      const torsoH = Math.abs(lh.y - topY)
      const cw = sw*1.4*scale; const ch = torsoH*1.5*scale
      const cx2 = cx - cw/2; const cy2 = topY - sw*0.1 + offsetY
      ctx.save()
      ctx.globalAlpha = 0.65
      ctx.fillStyle = product?.colors?.[0] || '#1a1a2e'
      ctx.beginPath(); ctx.roundRect(cx2,cy2,cw,ch,[10]); ctx.fill()
      ctx.globalAlpha = 0.3; ctx.fillStyle = '#ffffff'
      ctx.beginPath(); ctx.ellipse(cx, topY+8, sw*0.15, sw*0.08, 0, 0, Math.PI*2); ctx.fill()
      ctx.restore()
    } else { setDetected(false) }
  }

  useEffect(() => {
    const load = async () => {
      setStatus('loading')
      try {
        if (!window.Pose) {
          await new Promise((res,rej) => {
            const s = document.createElement('script')
            s.src = 'https://cdn.jsdelivr.net/npm/@mediapipe/pose/pose.js'
            s.onload = res; s.onerror = rej; document.head.appendChild(s)
          })
        }
        const pose = new window.Pose({ locateFile: f => `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${f}` })
        pose.setOptions({ modelComplexity:1, smoothLandmarks:true, minDetectionConfidence:0.5, minTrackingConfidence:0.5 })
        pose.onResults(onPoseResults)
        poseRef.current = pose
        await startCam()
      } catch { await startCam(true) }
    }
    load()
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      streamRef.current?.getTracks().forEach(t => t.stop())
      poseRef.current?.close?.()
    }
  }, [])

  const screenshot = () => {
    const a = document.createElement('a'); a.href = canvasRef.current?.toDataURL(); a.download = 'ar-tryon.png'; a.click()
  }

  return (
    <div className="w-full max-w-xl mx-auto">
      <div className="flex items-center justify-between mb-3">
        <div><p className="font-semibold text-gray-800">Body Try-On</p><p className="text-xs text-gray-500">{product?.name} · Stand back so full torso is visible</p></div>
        <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500"><X size={18}/></button>
      </div>
      <div className="relative rounded-2xl overflow-hidden bg-gray-900 aspect-[4/3]">
        <video ref={videoRef} className="hidden" playsInline muted/>
        <canvas ref={canvasRef} className="w-full h-full object-cover"/>
        {status==='loading' && <div className="ar-overlay"><div className="text-center text-white"><div className="w-8 h-8 border-2 border-brand-400 border-t-transparent rounded-full animate-spin mx-auto mb-2"/><p className="text-sm">Loading AR...</p></div></div>}
        {status==='error' && <div className="ar-overlay"><div className="text-center text-white"><Camera size={32} className="mx-auto mb-2 text-red-400"/><p className="text-sm">Camera access denied</p></div></div>}
        {status==='active' && (
          <div className={`absolute top-2 left-2 flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${detected?'bg-green-500/20 text-green-300 border border-green-500/30':'bg-yellow-500/20 text-yellow-300 border border-yellow-500/30'}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${detected?'bg-green-400 animate-pulse':'bg-yellow-400'}`}/>{detected?'Body detected':'Step back & face camera'}
          </div>
        )}
        <div className="absolute bottom-2 left-2 right-2 flex items-start gap-2 bg-black/50 backdrop-blur-sm rounded-xl p-2 text-xs text-gray-300">
          <Info size={12} className="text-brand-400 mt-0.5 flex-shrink-0"/> Stand 1.5–2m from camera. Ensure good lighting.
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between">
        <div className="flex gap-2 items-center">
          <button onClick={() => setScale(s=>Math.max(0.5,s-0.1))} className="p-1.5 border border-gray-200 rounded-lg hover:bg-gray-100"><ZoomOut size={14}/></button>
          <span className="text-xs text-gray-500 w-8 text-center">{Math.round(scale*100)}%</span>
          <button onClick={() => setScale(s=>Math.min(2,s+0.1))} className="p-1.5 border border-gray-200 rounded-lg hover:bg-gray-100"><ZoomIn size={14}/></button>
          <button onClick={()=>setOffsetY(0)} className="p-1.5 border border-gray-200 rounded-lg hover:bg-gray-100 ml-1"><RotateCcw size={14}/></button>
        </div>
        <div className="flex gap-2">
          <button onClick={()=>setOffsetY(y=>y-8)} className="px-3 py-1 text-xs border border-gray-200 rounded-lg hover:bg-gray-100">↑</button>
          <button onClick={()=>setOffsetY(y=>y+8)} className="px-3 py-1 text-xs border border-gray-200 rounded-lg hover:bg-gray-100">↓</button>
          <button onClick={screenshot} className="btn-primary text-xs py-1.5 px-3 gap-1"><Download size={12}/> Save</button>
        </div>
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────────
   2. FACE TRY-ON  (MediaPipe FaceMesh via CDN)
───────────────────────────────────────────── */
export function FaceTryOn({ product, onClose }) {
  const videoRef  = useRef(null)
  const canvasRef = useRef(null)
  const streamRef = useRef(null)
  const rafRef    = useRef(null)
  const fmRef     = useRef(null)
  const [status, setStatus]   = useState('loading')
  const [detected, setDetected] = useState(false)
  const [scale, setScale]     = useState(1)
  const [offsetY, setOffsetY] = useState(0)
  const cat = product?.category || 'glasses'

  const drawFrame = async () => {
    if (!videoRef.current || !fmRef.current) return
    try { await fmRef.current.send({ image:videoRef.current }) } catch {}
    rafRef.current = requestAnimationFrame(drawFrame)
  }

  const onResults = (results) => {
    const c = canvasRef.current; const v = videoRef.current; if (!c||!v) return
    const w = v.videoWidth||640; const h = v.videoHeight||480
    c.width=w; c.height=h
    const ctx = c.getContext('2d')
    ctx.save(); ctx.scale(-1,1); ctx.drawImage(results.image,-w,0,w,h); ctx.restore()
    if (results.multiFaceLandmarks?.length > 0) {
      setDetected(true)
      const lm = results.multiFaceLandmarks[0]
      const pt = i => ({ x:(1-lm[i].x)*w, y:lm[i].y*h })
      if (cat==='glasses')  drawGlasses(ctx,pt,scale,offsetY)
      else if (cat==='hats') drawHat(ctx,pt,w,h,scale,offsetY,product)
      else drawEarringsNecklace(ctx,pt,scale,offsetY,cat,product)
    } else { setDetected(false) }
  }

  const drawGlasses = (ctx,pt,sc,oy) => {
    const ro=pt(33),ri=pt(133),li=pt(362),lo=pt(263)
    const ew = Math.abs(ro.x-lo.x); const ey=(ro.y+lo.y)/2+oy
    const rcx=(ro.x+ri.x)/2; const lcx=(lo.x+li.x)/2
    const lw=ew*0.42*sc; const lh=lw*0.6
    ctx.save(); ctx.globalAlpha=0.8
    ctx.strokeStyle=product?.colors?.[0]||'#1a1a1a'; ctx.lineWidth=3
    ctx.fillStyle='rgba(120,180,255,0.25)'
    ;[[rcx,ey],[lcx,ey]].forEach(([cx,cy])=>{ctx.beginPath();ctx.ellipse(cx,cy,lw/2,lh/2,0,0,Math.PI*2);ctx.fill();ctx.stroke()})
    ctx.beginPath();ctx.moveTo(rcx+lw/2,ey);ctx.lineTo(lcx-lw/2,ey);ctx.stroke()
    ctx.beginPath();ctx.moveTo(rcx-lw/2,ey);ctx.lineTo(rcx-lw/2-lw*0.6,ey-4);ctx.stroke()
    ctx.beginPath();ctx.moveTo(lcx+lw/2,ey);ctx.lineTo(lcx+lw/2+lw*0.6,ey-4);ctx.stroke()
    ctx.restore()
  }

  const drawHat = (ctx,pt,w,h,sc,oy,prod) => {
    const top=pt(10); const lt=pt(234); const rt=pt(454)
    const hw=Math.abs(lt.x-rt.x)*1.2*sc; const hh=hw*0.7
    const cx=(lt.x+rt.x)/2; const hy=top.y-hh*0.8+oy
    ctx.save(); ctx.globalAlpha=0.8
    ctx.fillStyle=prod?.colors?.[0]||'#1a1a1a'
    ctx.beginPath();ctx.ellipse(cx,hy+hh,hw*0.65,hh*0.15,0,0,Math.PI*2);ctx.fill()
    ctx.beginPath();ctx.roundRect(cx-hw*0.4,hy,hw*0.8,hh*0.9,[6,6,0,0]);ctx.fill()
    ctx.fillStyle='rgba(245,200,0,0.6)';ctx.fillRect(cx-hw*0.4,hy+hh*0.65,hw*0.8,hh*0.1)
    ctx.restore()
  }

  const drawEarringsNecklace = (ctx,pt,sc,oy,cat,prod) => {
    if (cat==='jewelry' && prod?.name?.toLowerCase().includes('earring')) {
      const re=pt(234); const le=pt(454)
      const es = Math.abs(re.x-le.x)*0.05*sc
      ;[re,le].forEach(ear=>{
        ctx.save(); ctx.globalAlpha=0.9
        ctx.strokeStyle='#FFD700'; ctx.lineWidth=2
        ctx.beginPath();ctx.moveTo(ear.x,ear.y+oy);ctx.lineTo(ear.x,ear.y+es*2+oy);ctx.stroke()
        ctx.fillStyle=prod?.colors?.[0]||'#fff'; ctx.shadowColor='rgba(255,255,255,0.6)'; ctx.shadowBlur=8
        ctx.beginPath();ctx.arc(ear.x,ear.y+es*2.5+oy,es*1.5,0,Math.PI*2);ctx.fill()
        ctx.restore()
      })
    } else {
      const chin=pt(152); const lj=pt(234); const rj=pt(454)
      const nw=Math.abs(lj.x-rj.x)*0.6*sc; const ny=chin.y+Math.abs(chin.y-lj.y)*0.3+oy
      const cx2=(lj.x+rj.x)/2
      ctx.save(); ctx.globalAlpha=0.85; ctx.strokeStyle='#FFD700'; ctx.lineWidth=2.5; ctx.shadowColor='#FFD700'; ctx.shadowBlur=6
      ctx.beginPath();ctx.arc(cx2,ny-nw*0.3,nw,0.1*Math.PI,0.9*Math.PI,false);ctx.stroke()
      ctx.fillStyle=prod?.colors?.[0]||'#FFD700'; ctx.shadowBlur=12
      ctx.beginPath();ctx.arc(cx2,ny+4,7*sc,0,Math.PI*2);ctx.fill()
      ctx.restore()
    }
  }

  useEffect(()=>{
    const load = async () => {
      try {
        if (!window.FaceMesh){
          await new Promise((res,rej)=>{ const s=document.createElement('script'); s.src='https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/face_mesh.js'; s.onload=res; s.onerror=rej; document.head.appendChild(s) })
        }
        const fm = new window.FaceMesh({ locateFile: f=>`https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${f}` })
        fm.setOptions({ maxNumFaces:1, refineLandmarks:true, minDetectionConfidence:0.5, minTrackingConfidence:0.5 })
        fm.onResults(onResults); fmRef.current = fm
        const stream = await navigator.mediaDevices.getUserMedia({ video:{width:640,height:480,facingMode:'user'} })
        streamRef.current = stream; videoRef.current.srcObject = stream
        videoRef.current.onloadedmetadata = () => { videoRef.current.play(); setStatus('active'); drawFrame() }
      } catch { setStatus('error') }
    }
    load()
    return () => { if(rafRef.current) cancelAnimationFrame(rafRef.current); streamRef.current?.getTracks().forEach(t=>t.stop()); fmRef.current?.close?.() }
  },[])

  const screenshot = () => { const a=document.createElement('a'); a.href=canvasRef.current?.toDataURL(); a.download='ar-face.png'; a.click() }

  return (
    <div className="w-full max-w-xl mx-auto">
      <div className="flex items-center justify-between mb-3">
        <div><p className="font-semibold text-gray-800">Face Try-On</p><p className="text-xs text-gray-500">{product?.name} · Face the camera directly</p></div>
        <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500"><X size={18}/></button>
      </div>
      <div className="relative rounded-2xl overflow-hidden bg-gray-900 aspect-[4/3]">
        <video ref={videoRef} className="hidden" playsInline muted/>
        <canvas ref={canvasRef} className="w-full h-full object-cover"/>
        {status==='loading' && <div className="ar-overlay"><div className="w-8 h-8 border-2 border-brand-400 border-t-transparent rounded-full animate-spin"/></div>}
        {status==='active' && (
          <div className={`absolute top-2 left-2 flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${detected?'bg-green-500/20 text-green-300 border border-green-500/30':'bg-yellow-500/20 text-yellow-300 border border-yellow-500/30'}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${detected?'bg-green-400 animate-pulse':'bg-yellow-400'}`}/>{detected?'Face detected':'Look at camera'}
          </div>
        )}
      </div>
      <div className="mt-3 flex items-center justify-between">
        <div className="flex gap-2 items-center">
          <button onClick={()=>setScale(s=>Math.max(0.5,s-0.1))} className="p-1.5 border border-gray-200 rounded-lg hover:bg-gray-100"><ZoomOut size={14}/></button>
          <span className="text-xs text-gray-500 w-8 text-center">{Math.round(scale*100)}%</span>
          <button onClick={()=>setScale(s=>Math.min(2,s+0.1))} className="p-1.5 border border-gray-200 rounded-lg hover:bg-gray-100"><ZoomIn size={14}/></button>
          <button onClick={()=>setOffsetY(0)} className="p-1.5 border border-gray-200 rounded-lg hover:bg-gray-100 ml-1"><RotateCcw size={14}/></button>
        </div>
        <div className="flex gap-2">
          <button onClick={()=>setOffsetY(y=>y-5)} className="px-3 py-1 text-xs border border-gray-200 rounded-lg">↑</button>
          <button onClick={()=>setOffsetY(y=>y+5)} className="px-3 py-1 text-xs border border-gray-200 rounded-lg">↓</button>
          <button onClick={screenshot} className="btn-primary text-xs py-1.5 px-3 gap-1"><Download size={12}/> Save</button>
        </div>
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────────
   3. ROOM PLACEMENT  (Three.js + WebXR)
───────────────────────────────────────────── */
export function RoomPlacement({ product, onClose }) {
  const containerRef = useRef(null)
  const rendererRef  = useRef(null)
  const sceneRef     = useRef(null)
  const cameraRef    = useRef(null)
  const objRef       = useRef(null)
  const rafRef       = useRef(null)
  const isDragging   = useRef(false)
  const lastPos      = useRef({x:0,y:0})
  const spherical    = useRef({theta:0.5,phi:1.0,radius:4})
  const [loaded, setLoaded] = useState(false)
  const [scaleV, setScaleV] = useState(1)
  const [rot, setRot]       = useState(0)

  useEffect(()=>{
    const el = containerRef.current; if(!el) return
    const w=el.clientWidth||640; const h=el.clientHeight||400
    const scene = new THREE.Scene(); scene.background = new THREE.Color(0xf0f0f0); sceneRef.current = scene
    const camera = new THREE.PerspectiveCamera(55,w/h,0.1,50); camera.position.set(0,1.6,4); cameraRef.current = camera
    const renderer = new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true})
    renderer.setSize(w,h); renderer.shadowMap.enabled=true; renderer.setPixelRatio(Math.min(devicePixelRatio,2))
    el.appendChild(renderer.domElement); rendererRef.current = renderer
    scene.add(new THREE.AmbientLight(0xffffff,0.7))
    const dl = new THREE.DirectionalLight(0xffffff,1.2); dl.position.set(3,5,2); dl.castShadow=true; scene.add(dl)
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(10,10), new THREE.MeshStandardMaterial({color:0xe8e8e8,roughness:0.9}))
    floor.rotation.x=-Math.PI/2; floor.receiveShadow=true; scene.add(floor)
    scene.add(new THREE.GridHelper(10,20,0xd0d0d0,0xe0e0e0))
    // Product mesh
    const color = new THREE.Color(product?.colors?.[0]||'#8B7355')
    const cat = product?.category
    let obj
    if (cat==='furniture') {
      obj = new THREE.Group()
      const seat = new THREE.Mesh(new THREE.BoxGeometry(2,0.3,0.9),new THREE.MeshStandardMaterial({color,roughness:0.8}))
      seat.position.y=0.3; obj.add(seat)
      const back = new THREE.Mesh(new THREE.BoxGeometry(2,0.8,0.15),new THREE.MeshStandardMaterial({color,roughness:0.8}))
      back.position.set(0,0.8,-0.38); obj.add(back)
      for(const [x,z] of [[-0.85,-0.35],[0.85,-0.35],[-0.85,0.35],[0.85,0.35]]) {
        const leg=new THREE.Mesh(new THREE.CylinderGeometry(0.04,0.04,0.3,8),new THREE.MeshStandardMaterial({color:0x3a2a1a}))
        leg.position.set(x,0.15,z); obj.add(leg)
      }
    } else {
      obj = new THREE.Mesh(new THREE.BoxGeometry(1,0.8,0.6),new THREE.MeshStandardMaterial({color,roughness:0.5,metalness:0.3}))
      obj.position.y=0.4
    }
    obj.castShadow=true; scene.add(obj); objRef.current=obj
    const dom = renderer.domElement
    dom.addEventListener('mousedown',e=>{isDragging.current=true;lastPos.current={x:e.clientX,y:e.clientY}})
    dom.addEventListener('mousemove',e=>{if(!isDragging.current)return;spherical.current.theta-=(e.clientX-lastPos.current.x)*0.01;spherical.current.phi=Math.max(0.2,Math.min(2.5,spherical.current.phi+(e.clientY-lastPos.current.y)*0.01));lastPos.current={x:e.clientX,y:e.clientY}})
    dom.addEventListener('mouseup',()=>{isDragging.current=false})
    dom.addEventListener('wheel',e=>{spherical.current.radius=Math.max(1.5,Math.min(10,spherical.current.radius+e.deltaY*0.005))},{passive:true})
    const animate=()=>{ rafRef.current=requestAnimationFrame(animate); const {theta,phi,radius}=spherical.current; camera.position.set(radius*Math.sin(phi)*Math.sin(theta),radius*Math.cos(phi),radius*Math.sin(phi)*Math.cos(theta)); camera.lookAt(0,0.4,0); renderer.render(scene,camera) }
    animate(); setLoaded(true)
    return ()=>{ if(rafRef.current) cancelAnimationFrame(rafRef.current); renderer.dispose(); el.removeChild(renderer.domElement) }
  },[])

  const handleScale = d => { const v=Math.max(0.3,Math.min(3,scaleV+(d==='up'?0.15:-0.15))); setScaleV(v); objRef.current?.scale.set(v,v,v) }
  const handleRot   = d => { const r=rot+(d==='l'?-0.3:0.3); setRot(r); if(objRef.current) objRef.current.rotation.y=r }
  const screenshot  = () => { rendererRef.current?.render(sceneRef.current,cameraRef.current); const a=document.createElement('a'); a.href=rendererRef.current?.domElement.toDataURL(); a.download='ar-room.png'; a.click() }

  return (
    <div className="w-full max-w-xl mx-auto">
      <div className="flex items-center justify-between mb-3">
        <div><p className="font-semibold text-gray-800">Room Placement</p><p className="text-xs text-gray-500">{product?.name} · Drag to orbit, scroll to zoom</p></div>
        <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500"><X size={18}/></button>
      </div>
      <div className="relative rounded-2xl overflow-hidden bg-gray-200 aspect-[4/3]">
        <div ref={containerRef} className="w-full h-full cursor-grab active:cursor-grabbing"/>
        {!loaded && <div className="ar-overlay"><div className="w-8 h-8 border-2 border-brand-400 border-t-transparent rounded-full animate-spin"/></div>}
        <div className="absolute top-2 left-2 badge-gray">3D Preview</div>
      </div>
      <div className="mt-3 flex items-center justify-between">
        <div className="flex gap-2">
          <button onClick={()=>handleRot('l')} className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg hover:bg-gray-100">↺ Rotate</button>
          <button onClick={()=>handleRot('r')} className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg hover:bg-gray-100">Rotate ↻</button>
          <button onClick={()=>handleScale('down')} className="p-1.5 border border-gray-200 rounded-lg hover:bg-gray-100"><ZoomOut size={14}/></button>
          <button onClick={()=>handleScale('up')} className="p-1.5 border border-gray-200 rounded-lg hover:bg-gray-100"><ZoomIn size={14}/></button>
        </div>
        <button onClick={screenshot} className="btn-primary text-xs py-1.5 px-3 gap-1"><Download size={12}/> Save</button>
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────────
   4. 3D PRODUCT VIEWER  (Three.js orbit)
───────────────────────────────────────────── */
export function ProductViewer3D({ product, onClose }) {
  const containerRef = useRef(null)
  const rendererRef  = useRef(null)
  const sceneRef     = useRef(null)
  const cameraRef    = useRef(null)
  const rafRef       = useRef(null)
  const isDragging   = useRef(false)
  const lastMouse    = useRef({x:0,y:0})
  const spherical    = useRef({theta:0.5,phi:1.0,radius:4})
  const [loaded, setLoaded] = useState(false)

  useEffect(()=>{
    const el = containerRef.current; if(!el) return
    const w=el.clientWidth||600; const h=el.clientHeight||400
    const scene = new THREE.Scene(); scene.background=new THREE.Color(0x111827); sceneRef.current=scene
    const camera = new THREE.PerspectiveCamera(45,w/h,0.01,50); cameraRef.current=camera
    const renderer = new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true})
    renderer.setSize(w,h); renderer.toneMapping=THREE.ACESFilmicToneMapping; renderer.toneMappingExposure=1.2; renderer.setPixelRatio(Math.min(devicePixelRatio,2))
    el.appendChild(renderer.domElement); rendererRef.current=renderer
    scene.add(new THREE.AmbientLight(0xffffff,0.5))
    const kl=new THREE.DirectionalLight(0xffffff,2); kl.position.set(3,4,2); scene.add(kl)
    const fl=new THREE.DirectionalLight(0x4060ff,0.4); fl.position.set(-3,2,-2); scene.add(fl)
    const rl=new THREE.DirectionalLight(0xf97316,0.6); rl.position.set(0,-2,-4); scene.add(rl)
    // Platform
    const plt=new THREE.Mesh(new THREE.CylinderGeometry(1.2,1.2,0.05,48),new THREE.MeshStandardMaterial({color:0x1f2937,roughness:0.2,metalness:0.8}))
    plt.position.y=-0.4; scene.add(plt)
    const ring=new THREE.Mesh(new THREE.TorusGeometry(1.2,0.03,8,64),new THREE.MeshStandardMaterial({color:0xf97316,emissive:0xf97316,emissiveIntensity:0.8}))
    ring.rotation.x=Math.PI/2; ring.position.y=-0.37; scene.add(ring)
    // Product
    const cat=product?.category; const col=new THREE.Color(product?.colors?.[0]||'#1a1a2e')
    const mat=new THREE.MeshStandardMaterial({color:col,roughness:0.15,metalness:0.7})
    let obj
    if(cat==='electronics'){
      obj=new THREE.Group()
      obj.add(Object.assign(new THREE.Mesh(new THREE.BoxGeometry(0.75,1.5,0.08),mat),{position:new THREE.Vector3(0,0.2,0)}))
      const scr=new THREE.Mesh(new THREE.BoxGeometry(0.68,1.38,0.005),new THREE.MeshStandardMaterial({color:0x0a0a1a,emissive:0x1a2a4a,emissiveIntensity:0.3}))
      scr.position.set(0,0.2,0.043); obj.add(scr)
    } else {
      obj=new THREE.Mesh(new THREE.BoxGeometry(1,0.7,0.5),mat); obj.position.y=0.1
    }
    scene.add(obj)
    const dom=renderer.domElement
    dom.addEventListener('mousedown',e=>{isDragging.current=true;lastMouse.current={x:e.clientX,y:e.clientY}})
    dom.addEventListener('mousemove',e=>{if(!isDragging.current)return;spherical.current.theta-=(e.clientX-lastMouse.current.x)*0.01;spherical.current.phi=Math.max(0.2,Math.min(2.5,spherical.current.phi+(e.clientY-lastMouse.current.y)*0.01));lastMouse.current={x:e.clientX,y:e.clientY}})
    dom.addEventListener('mouseup',()=>{isDragging.current=false})
    dom.addEventListener('wheel',e=>{spherical.current.radius=Math.max(1.5,Math.min(10,spherical.current.radius+e.deltaY*0.005))},{passive:true})
    dom.addEventListener('touchstart',e=>{isDragging.current=true;lastMouse.current={x:e.touches[0].clientX,y:e.touches[0].clientY}},{passive:true})
    dom.addEventListener('touchmove',e=>{spherical.current.theta-=(e.touches[0].clientX-lastMouse.current.x)*0.01;spherical.current.phi=Math.max(0.2,Math.min(2.5,spherical.current.phi+(e.touches[0].clientY-lastMouse.current.y)*0.01));lastMouse.current={x:e.touches[0].clientX,y:e.touches[0].clientY}},{passive:true})
    dom.addEventListener('touchend',()=>{isDragging.current=false})
    const animate=()=>{ rafRef.current=requestAnimationFrame(animate); if(!isDragging.current) obj.rotation.y+=0.005; const {theta,phi,radius}=spherical.current; camera.position.set(radius*Math.sin(phi)*Math.sin(theta),radius*Math.cos(phi),radius*Math.sin(phi)*Math.cos(theta)); camera.lookAt(0,0.2,0); renderer.render(scene,camera) }
    animate(); setLoaded(true)
    return ()=>{ if(rafRef.current) cancelAnimationFrame(rafRef.current); renderer.dispose(); el.removeChild(renderer.domElement) }
  },[])

  const screenshot = () => { rendererRef.current?.render(sceneRef.current,cameraRef.current); const a=document.createElement('a'); a.href=rendererRef.current?.domElement.toDataURL(); a.download='3d-view.png'; a.click() }

  return (
    <div className="w-full max-w-xl mx-auto">
      <div className="flex items-center justify-between mb-3">
        <div><p className="font-semibold text-gray-800">3D Viewer</p><p className="text-xs text-gray-500">{product?.name} · Drag to rotate · Scroll to zoom</p></div>
        <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500"><X size={18}/></button>
      </div>
      <div className="relative rounded-2xl overflow-hidden bg-gray-900 aspect-[4/3]">
        <div ref={containerRef} className="w-full h-full cursor-grab active:cursor-grabbing"/>
        {!loaded && <div className="ar-overlay"><div className="w-8 h-8 border-2 border-brand-400 border-t-transparent rounded-full animate-spin"/></div>}
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 text-xs text-gray-400 bg-black/50 rounded-full px-3 py-1">Drag to rotate · Scroll to zoom</div>
      </div>
      <div className="mt-3 flex justify-end">
        <button onClick={screenshot} className="btn-primary text-xs py-1.5 px-3 gap-1"><Download size={12}/> Save</button>
      </div>
    </div>
  )
}
