import React, { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { PhoneOff, Mic, MicOff, Video, VideoOff, MessageSquare, Send, X } from 'lucide-react'
import AgoraRTC from 'agora-rtc-sdk-ng'

const AGORA_APP_ID = import.meta.env.VITE_AGORA_APP_ID || ''

function CallUI({ roomId, localUser, remoteUserName, onEnd, socketRef }) {
  const localVideoRef  = useRef(null)
  const remoteVideoRef = useRef(null)
  const agoraClient    = useRef(null)
  const audioTrack     = useRef(null)
  const videoTrack     = useRef(null)
  const chatEndRef     = useRef(null)

  const [audioMuted, setAudioMuted] = useState(false)
  const [videoMuted, setVideoMuted] = useState(false)
  const [remoteJoined, setRemoteJoined] = useState(false)
  const [messages, setMessages]         = useState([])
  const [msgInput, setMsgInput]         = useState('')
  const [showChat, setShowChat]         = useState(true)
  const [callDuration, setCallDuration] = useState(0)

  // Call timer
  useEffect(() => {
    const t = setInterval(() => setCallDuration(d => d + 1), 1000)
    return () => clearInterval(t)
  }, [])

  const formatDuration = s => {
    const m = Math.floor(s / 60)
    const sec = s % 60
    return `${m.toString().padStart(2,'0')}:${sec.toString().padStart(2,'0')}`
  }

  // Agora join
  useEffect(() => {
    if (!roomId) return

    const join = async () => {
      if (!AGORA_APP_ID) {
        console.warn('VITE_AGORA_APP_ID not set — video disabled')
        return
      }
      try {
        const client = AgoraRTC.createClient({ mode: 'rtc', codec: 'vp8' })
        agoraClient.current = client

        await client.join(AGORA_APP_ID, roomId, null, localUser?.id || null)

        const [at, vt] = await AgoraRTC.createMicrophoneAndCameraTracks()
        audioTrack.current = at
        videoTrack.current = vt

        // Play local video
        if (localVideoRef.current) vt.play(localVideoRef.current)

        await client.publish([at, vt])

        // Remote user published
        client.on('user-published', async (remoteUser, mediaType) => {
          await client.subscribe(remoteUser, mediaType)
          if (mediaType === 'video' && remoteVideoRef.current) {
            remoteUser.videoTrack.play(remoteVideoRef.current)
            setRemoteJoined(true)
          }
          if (mediaType === 'audio') {
            remoteUser.audioTrack?.play()
          }
        })

        client.on('user-unpublished', (_, mediaType) => {
          if (mediaType === 'video') setRemoteJoined(false)
        })

        client.on('user-left', () => setRemoteJoined(false))

      } catch (e) {
        console.warn('Agora join error:', e.message)
      }
    }

    join()

    return () => {
      audioTrack.current?.close()
      videoTrack.current?.close()
      agoraClient.current?.leave().catch(() => {})
    }
  }, [roomId, localUser?.id])

  // Socket: room-specific chat (only this room)
  useEffect(() => {
    const sock = socketRef?.current
    if (!sock || !roomId) return

    // Join the call room for isolated chat
    sock.emit('join_call_room', { roomId })

    const onMsg = msg => setMessages(prev => [...prev, msg])
    sock.on('call_chat_message', onMsg)

    return () => {
      sock.off('call_chat_message', onMsg)
      sock.emit('leave_call_room', { roomId })
    }
  }, [roomId, socketRef])

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const toggleAudio = async () => {
    if (!audioTrack.current) return
    const next = !audioMuted
    await audioTrack.current.setEnabled(!next)
    setAudioMuted(next)
  }

  const toggleVideo = async () => {
    if (!videoTrack.current) return
    const next = !videoMuted
    await videoTrack.current.setEnabled(!next)
    setVideoMuted(next)
  }

  const sendMsg = () => {
    if (!msgInput.trim() || !socketRef?.current) return
    const msg = {
      id:     Date.now(),
      sender: localUser?.name || 'You',
      text:   msgInput.trim(),
      time:   new Date().toISOString(),
    }
    // Send only to this room
    socketRef.current.emit('call_chat_send', { roomId, msg })
    setMessages(prev => [...prev, msg])
    setMsgInput('')
  }

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', flexDirection: 'column', background: '#111827' }}
    >
      {/* Top bar */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'12px 16px', background:'#1f2937', borderBottom:'1px solid #374151' }}>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <div style={{ width:10, height:10, borderRadius:'50%', background: remoteJoined ? '#22c55e' : '#facc15', animation: remoteJoined ? 'pulse 2s infinite' : 'none' }}/>
          <span style={{ color:'#fff', fontWeight:600, fontSize:15 }}>{remoteUserName}</span>
          <span style={{ color:'#9ca3af', fontSize:13 }}>{remoteJoined ? `Connected · ${formatDuration(callDuration)}` : 'Waiting to connect...'}</span>
        </div>
        <button
          onClick={() => setShowChat(v => !v)}
          style={{ padding:'6px 10px', background: showChat ? '#f97316' : '#374151', color:'#fff', borderRadius:8, border:'none', cursor:'pointer', display:'flex', alignItems:'center', gap:6, fontSize:13 }}
        >
          <MessageSquare size={15}/> Chat
        </button>
      </div>

      {/* Main area */}
      <div style={{ flex:1, display:'flex', minHeight:0 }}>

        {/* Video area */}
        <div style={{ flex:1, position:'relative', background:'#0f172a' }}>

          {/* Remote video */}
          <div ref={remoteVideoRef} style={{ width:'100%', height:'100%', position:'absolute', inset:0 }}/>

          {/* Waiting overlay */}
          {!remoteJoined && (
            <div style={{ position:'absolute', inset:0, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', zIndex:10 }}>
              <div style={{ width:80, height:80, borderRadius:'50%', background:'#1f2937', display:'flex', alignItems:'center', justifyContent:'center', fontSize:32, fontWeight:700, color:'#fff', marginBottom:16 }}>
                {remoteUserName?.charAt(0)?.toUpperCase()}
              </div>
              <p style={{ color:'#fff', fontWeight:600, fontSize:18 }}>{remoteUserName}</p>
              <p style={{ color:'#9ca3af', fontSize:14, marginTop:6 }}>
                {AGORA_APP_ID ? 'Waiting for them to join...' : '⚠️ Add VITE_AGORA_APP_ID for video'}
              </p>
              <div style={{ marginTop:16, display:'flex', gap:8 }}>
                {[...Array(3)].map((_,i) => (
                  <div key={i} style={{ width:8, height:8, borderRadius:'50%', background:'#f97316', opacity: 0.4 + i*0.3 }}/>
                ))}
              </div>
            </div>
          )}

          {/* Local video PiP */}
          <div style={{ position:'absolute', bottom:16, right:16, width:140, height:105, background:'#374151', borderRadius:12, overflow:'hidden', border:'2px solid #4b5563', zIndex:20 }}>
            <div ref={localVideoRef} style={{ width:'100%', height:'100%' }}/>
            {videoMuted && (
              <div style={{ position:'absolute', inset:0, background:'#1f2937', display:'flex', alignItems:'center', justifyContent:'center' }}>
                <VideoOff size={20} color="#9ca3af"/>
              </div>
            )}
            <div style={{ position:'absolute', bottom:4, left:6, fontSize:11, color:'#d1d5db', background:'rgba(0,0,0,0.5)', padding:'1px 6px', borderRadius:4 }}>You</div>
          </div>

          {/* Duration badge */}
          {remoteJoined && (
            <div style={{ position:'absolute', top:12, left:12, background:'rgba(0,0,0,0.6)', color:'#fff', fontSize:13, padding:'4px 10px', borderRadius:20, fontWeight:600 }}>
              {formatDuration(callDuration)}
            </div>
          )}
        </div>

        {/* Chat panel */}
        {showChat && (
          <div style={{ width:300, background:'#1f2937', display:'flex', flexDirection:'column', borderLeft:'1px solid #374151' }}>
            <div style={{ padding:'12px 16px', borderBottom:'1px solid #374151' }}>
              <p style={{ color:'#fff', fontWeight:600, fontSize:14 }}>💬 Chat</p>
              <p style={{ color:'#6b7280', fontSize:12, marginTop:2 }}>Private — only you two can see this</p>
            </div>
            <div style={{ flex:1, overflowY:'auto', padding:12, display:'flex', flexDirection:'column', gap:8 }}>
              {messages.length === 0 && (
                <p style={{ color:'#6b7280', fontSize:13, textAlign:'center', marginTop:20 }}>No messages yet. Say hi! 👋</p>
              )}
              {messages.map(msg => {
                const isMe = msg.sender === (localUser?.name || 'You')
                return (
                  <div key={msg.id} style={{ display:'flex', flexDirection:'column', alignItems: isMe ? 'flex-end' : 'flex-start' }}>
                    <p style={{ fontSize:11, color:'#9ca3af', marginBottom:2 }}>{msg.sender}</p>
                    <div style={{
                      padding:'8px 12px', borderRadius: isMe ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                      background: isMe ? '#f97316' : '#374151', color:'#fff', fontSize:14,
                      maxWidth:'85%', wordBreak:'break-word'
                    }}>
                      {msg.text}
                    </div>
                  </div>
                )
              })}
              <div ref={chatEndRef}/>
            </div>
            <div style={{ padding:10, borderTop:'1px solid #374151', display:'flex', gap:8 }}>
              <input
                style={{ flex:1, background:'#374151', color:'#fff', border:'1px solid #4b5563', borderRadius:10, padding:'8px 12px', fontSize:14, outline:'none' }}
                placeholder="Type a message..."
                value={msgInput}
                onChange={e => setMsgInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && sendMsg()}
              />
              <button
                onClick={sendMsg}
                style={{ padding:'8px 12px', background:'#f97316', color:'#fff', border:'none', borderRadius:10, cursor:'pointer' }}
              >
                <Send size={15}/>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Bottom controls */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:16, padding:'16px 0', background:'#1f2937', borderTop:'1px solid #374151' }}>
        <button
          onClick={toggleAudio}
          title={audioMuted ? 'Unmute' : 'Mute'}
          style={{ width:48, height:48, borderRadius:'50%', border:'none', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', background: audioMuted ? '#ef4444' : '#374151', color:'#fff' }}
        >
          {audioMuted ? <MicOff size={20}/> : <Mic size={20}/>}
        </button>
        <button
          onClick={toggleVideo}
          title={videoMuted ? 'Show video' : 'Hide video'}
          style={{ width:48, height:48, borderRadius:'50%', border:'none', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', background: videoMuted ? '#ef4444' : '#374151', color:'#fff' }}
        >
          {videoMuted ? <VideoOff size={20}/> : <Video size={20}/>}
        </button>
        <button
          onClick={onEnd}
          title="End call"
          style={{ width:56, height:56, borderRadius:'50%', border:'none', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', background:'#ef4444', color:'#fff', boxShadow:'0 4px 12px rgba(239,68,68,0.4)' }}
        >
          <PhoneOff size={24}/>
        </button>
        <button
          onClick={() => setShowChat(v => !v)}
          title="Toggle chat"
          style={{ width:48, height:48, borderRadius:'50%', border:'none', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', background: showChat ? '#f97316' : '#374151', color:'#fff' }}
        >
          <MessageSquare size={20}/>
        </button>
      </div>
    </div>
  )
}

// Render via Portal so it always covers the full viewport regardless of parent layout
export default function VideoCallModal(props) {
  return createPortal(<CallUI {...props}/>, document.body)
}