import React, { useEffect, useState, useRef } from 'react'
import { Video, Users, Send, Package, Sparkles, Phone, Mic, MicOff, VideoOff, Camera, AlertTriangle } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { io } from 'socket.io-client'
import AgoraRTC from 'agora-rtc-sdk-ng'
import api from '../../api'

const SOCKET_URL   = import.meta.env.VITE_SOCKET_URL   || 'http://localhost:5000'
const AGORA_APP_ID = import.meta.env.VITE_AGORA_APP_ID || ''

export default function SellerLive() {
  const { user } = useAuth()
  const [products, setProducts]               = useState([])
  const [title, setTitle]                     = useState('')
  const [sessionId, setSessionId]             = useState(null)
  const [channel, setChannel]                 = useState(null)
  const [isLive, setIsLive]                   = useState(false)
  const [starting, setStarting]               = useState(false)
  const [messages, setMessages]               = useState([])
  const [msgInput, setMsgInput]               = useState('')
  const [viewerCount, setViewerCount]         = useState(0)
  const [selectedProducts, setSelectedProducts] = useState([])
  const [audioMuted, setAudioMuted]           = useState(false)
  const [videoMuted, setVideoMuted]           = useState(false)
  const [cameraReady, setCameraReady]         = useState(false)

  const socketRef      = useRef(null)
  const agoraClientRef = useRef(null)
  const localVideoRef  = useRef(null)
  const audioTrackRef  = useRef(null)
  const videoTrackRef  = useRef(null)
  const chatEndRef     = useRef(null)

  useEffect(() => {
    api.get(`/products?sellerId=${user?.id}&limit=50`)
      .then(r => setProducts((r.data.products || [])))
  }, [user?.id])

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  const startLive = async () => {
    if (!title.trim()) { alert('Please enter a session title'); return }
    setStarting(true)
    try {
      const { data } = await api.post('/live/start', { title: title.trim(), productIds: selectedProducts })
      if (!data.success) throw new Error(data.message)

      setSessionId(data.sessionId)
      setChannel(data.channel)
      setIsLive(true)

      // Socket.io — join as seller
      const socket = io(SOCKET_URL, { transports: ['websocket', 'polling'] })
      socketRef.current = socket
      socket.emit('join_session', {
        sessionId: String(data.sessionId),
        userId:    user?.id,
        userName:  user?.name,
        role:      'seller',
      })
      socket.on('new_message', msg => setMessages(prev => [...prev, msg]))
      socket.on('viewer_count', n  => setViewerCount(n))
      socket.on('user_joined', ({ userName }) =>
        setMessages(prev => [...prev, { id: Date.now(), system: true, text: `${userName} joined`, time: new Date().toISOString() }])
      )

      // Agora — host publishes camera + mic
      if (AGORA_APP_ID && data.channel) {
        try {
          const client = AgoraRTC.createClient({ mode: 'live', codec: 'vp8' })
          agoraClientRef.current = client
          await client.setClientRole('host')
          await client.join(AGORA_APP_ID, data.channel, data.token, user?.id || null)

          const [audioTrack, videoTrack] = await AgoraRTC.createMicrophoneAndCameraTracks()
          audioTrackRef.current = audioTrack
          videoTrackRef.current = videoTrack
          videoTrack.play(localVideoRef.current)
          await client.publish([audioTrack, videoTrack])
          setCameraReady(true)
        } catch (e) {
          console.warn('Agora host failed:', e.message)
          // Fallback: just show local camera preview without Agora
          try {
            const vt = await AgoraRTC.createCameraVideoTrack()
            videoTrackRef.current = vt
            vt.play(localVideoRef.current)
            setCameraReady(true)
          } catch {}
        }
      }
    } catch (err) {
      alert(err?.response?.data?.message || err.message || 'Failed to start session')
      setIsLive(false)
    } finally {
      setStarting(false)
    }
  }

  const endLive = async () => {
    if (!confirm('End your live session? Viewers will be disconnected.')) return
    // End in DB
    if (sessionId) await api.post(`/live/end/${sessionId}`).catch(() => {})
    // Socket
    socketRef.current?.emit('leave_session', { sessionId: String(sessionId), userName: user?.name })
    socketRef.current?.disconnect()
    // Agora cleanup
    audioTrackRef.current?.close()
    videoTrackRef.current?.close()
    try { await agoraClientRef.current?.leave() } catch {}
    // Reset state
    setIsLive(false); setSessionId(null); setChannel(null)
    setMessages([]); setViewerCount(0); setCameraReady(false)
    setAudioMuted(false); setVideoMuted(false)
  }

  const sendMsg = () => {
    if (!msgInput.trim() || !sessionId) return
    socketRef.current?.emit('send_message', {
      sessionId: String(sessionId),
      userId:    user?.id,
      userName:  user?.name,
      role:      'seller',
      text:      msgInput.trim(),
    })
    setMsgInput('')
  }

  const showcaseProduct = (product) => {
    socketRef.current?.emit('showcase_product', { sessionId: String(sessionId), product })
    setMessages(prev => [...prev, { id: Date.now(), system: true, text: `📦 Featured: ${product.name}`, time: new Date().toISOString() }])
  }

  const triggerAR = (productId) => {
    socketRef.current?.emit('trigger_ar', { sessionId: String(sessionId), productId })
    setMessages(prev => [...prev, { id: Date.now(), system: true, text: `✨ AR triggered for viewers`, time: new Date().toISOString() }])
  }

  const toggleAudio = async () => {
    if (audioTrackRef.current) {
      const next = !audioMuted
      await audioTrackRef.current.setEnabled(!next)
      setAudioMuted(next)
    }
  }
  const toggleVideo = async () => {
    if (videoTrackRef.current) {
      const next = !videoMuted
      await videoTrackRef.current.setEnabled(!next)
      setVideoMuted(next)
    }
  }

  // ── Setup screen ───────────────────────────────────────────────
  if (!isLive) return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="page-title">Go Live</h1>
        <p className="text-sm text-gray-500 mt-0.5">Start a live shopping session for your buyers</p>
      </div>

      <div className="card p-6 space-y-5">
        <div>
          <label className="label">Session Title *</label>
          <input
            className="input"
            placeholder="e.g. Summer Collection Flash Sale!"
            value={title}
            onChange={e => setTitle(e.target.value)}
          />
        </div>

        {/* Product selection */}
        <div>
          <label className="label">Feature Products (optional)</label>
          {products.length === 0 ? (
            <p className="text-sm text-gray-500 bg-gray-50 rounded-xl p-3">
              No products yet. <a href="/seller/products" className="text-brand-600 underline">Add products</a> first.
            </p>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-52 overflow-y-auto pr-1">
              {products.map(p => (
                <button
                  key={p.id}
                  onClick={() => setSelectedProducts(prev =>
                    prev.includes(p.id) ? prev.filter(id => id !== p.id) : [...prev, p.id]
                  )}
                  className={`p-2 rounded-xl border text-left transition-all ${selectedProducts.includes(p.id) ? 'border-brand-500 bg-brand-50 ring-1 ring-brand-400' : 'border-gray-200 hover:border-gray-300 bg-white'}`}
                >
                  <div className="w-full aspect-square bg-gray-100 rounded-lg overflow-hidden mb-1.5">
                    <img src={p.image_url || p.image} alt={p.name} className="w-full h-full object-cover" onError={e => e.target.style.display='none'}/>
                  </div>
                  <p className="text-xs font-semibold text-gray-700 truncate">{p.name}</p>
                  <p className="text-xs text-brand-600 font-bold">₹{Number(p.price).toLocaleString('en-IN')}</p>
                </button>
              ))}
            </div>
          )}
          {selectedProducts.length > 0 && (
            <p className="text-xs text-brand-600 mt-2 font-semibold">
              ✓ {selectedProducts.length} product{selectedProducts.length !== 1 ? 's' : ''} selected
            </p>
          )}
        </div>

        {!AGORA_APP_ID && (
          <div className="flex items-start gap-3 p-3 bg-yellow-50 border border-yellow-200 rounded-xl">
            <AlertTriangle size={16} className="text-yellow-600 flex-shrink-0 mt-0.5"/>
            <p className="text-sm text-yellow-700">
              Live video requires <code className="font-mono bg-yellow-100 px-1 rounded">VITE_AGORA_APP_ID</code>.
              Socket.io chat + product showcasing works without it.
            </p>
          </div>
        )}

        <button
          onClick={startLive}
          disabled={starting || !title.trim()}
          className="btn-danger w-full justify-center py-3 text-base gap-2"
        >
          {starting
            ? <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"/>
            : <><span className="w-2.5 h-2.5 rounded-full bg-white animate-pulse"/> Go Live</>
          }
        </button>
      </div>
    </div>
  )

  // ── Live broadcast screen ──────────────────────────────────────
  return (
    <div className="space-y-4 max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 bg-red-500 text-white text-xs font-bold px-3 py-1.5 rounded-full">
            <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse"/>LIVE
          </div>
          <div>
            <p className="font-display font-bold text-gray-900">{title}</p>
            <p className="text-sm text-gray-500 flex items-center gap-1"><Users size={12}/> {viewerCount} watching</p>
          </div>
        </div>
        <button onClick={endLive} className="btn-danger text-sm py-2 px-4 gap-1.5">
          <Phone size={14}/> End Live
        </button>
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-3">
          {/* Camera preview */}
          <div className="video-tile">
            <div ref={localVideoRef} className="w-full h-full bg-gray-900 absolute inset-0"/>
            {!cameraReady && (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-white bg-gray-900">
                <Camera size={40} className="opacity-30 mb-3"/>
                <p className="text-sm opacity-60">
                  {AGORA_APP_ID ? 'Starting camera...' : 'Camera preview requires Agora'}
                </p>
              </div>
            )}
            {/* Mic / camera toggles */}
            {cameraReady && (
              <div className="absolute bottom-3 left-3 flex gap-2">
                <button
                  onClick={toggleAudio}
                  className={`p-2 rounded-full text-white transition-colors ${audioMuted ? 'bg-red-500' : 'bg-black/60 hover:bg-black/80'}`}
                  title={audioMuted ? 'Unmute' : 'Mute'}
                >
                  {audioMuted ? <MicOff size={14}/> : <Mic size={14}/>}
                </button>
                <button
                  onClick={toggleVideo}
                  className={`p-2 rounded-full text-white transition-colors ${videoMuted ? 'bg-red-500' : 'bg-black/60 hover:bg-black/80'}`}
                  title={videoMuted ? 'Show video' : 'Hide video'}
                >
                  {videoMuted ? <VideoOff size={14}/> : <Camera size={14}/>}
                </button>
              </div>
            )}
            <div className="absolute top-3 right-3 flex items-center gap-1 bg-black/60 text-white text-xs px-2.5 py-1 rounded-full">
              <Users size={10}/> {viewerCount}
            </div>
          </div>

          {/* Product showcase panel */}
          <div className="card p-4">
            <p className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
              <Package size={14} className="text-brand-500"/> Showcase to Viewers
            </p>
            {products.length === 0 ? (
              <p className="text-sm text-gray-400">No products to showcase.</p>
            ) : (
              <div className="flex gap-2 overflow-x-auto pb-1">
                {(selectedProducts.length > 0
                  ? products.filter(p => selectedProducts.includes(p.id))
                  : products.slice(0, 8)
                ).map(p => (
                  <div key={p.id} className="flex-shrink-0 w-28 card overflow-hidden">
                    <div className="aspect-square bg-gray-100 overflow-hidden">
                      <img src={p.image_url || p.image} alt={p.name} className="w-full h-full object-cover" onError={e => e.target.style.display='none'}/>
                    </div>
                    <div className="p-1.5 space-y-1">
                      <p className="text-xs font-semibold truncate text-gray-700">{p.name}</p>
                      <p className="text-xs text-brand-600 font-bold">₹{Number(p.price).toLocaleString('en-IN')}</p>
                      <button
                        onClick={() => showcaseProduct(p)}
                        className="w-full text-xs bg-brand-50 text-brand-600 font-semibold py-1 rounded-lg hover:bg-brand-100 transition-colors"
                      >
                        Feature
                      </button>
                      <button
                        onClick={() => triggerAR(p.id)}
                        className="w-full text-xs bg-orange-50 text-orange-600 font-semibold py-1 rounded-lg hover:bg-orange-100 transition-colors flex items-center justify-center gap-1"
                      >
                        <Sparkles size={9}/> AR
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Live chat */}
        <div className="card flex flex-col" style={{ height: '480px' }}>
          <div className="px-4 py-3 border-b border-gray-100 flex-shrink-0">
            <p className="text-sm font-semibold text-gray-700">Live Chat</p>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-2 min-h-0">
            {messages.length === 0 && (
              <p className="text-center text-xs text-gray-400 pt-4">Viewer messages will appear here</p>
            )}
            {messages.map(msg => (
              <div key={msg.id}>
                {msg.system ? (
                  <p className="text-center text-xs text-gray-400 italic py-0.5">{msg.text}</p>
                ) : (
                  <div className={`flex gap-2 ${msg.userId === user?.id ? 'flex-row-reverse' : ''}`}>
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0 ${msg.role === 'seller' ? 'bg-blue-500' : 'bg-brand-500'}`}>
                      {msg.userName?.charAt(0)?.toUpperCase()}
                    </div>
                    <div className={`max-w-[75%] flex flex-col ${msg.userId === user?.id ? 'items-end' : 'items-start'}`}>
                      <p className="text-xs text-gray-400 mb-0.5">{msg.userName}</p>
                      <div className={`px-3 py-1.5 rounded-2xl text-sm break-words ${msg.userId === user?.id ? 'bg-blue-500 text-white rounded-tr-sm' : 'bg-gray-100 text-gray-800 rounded-tl-sm'}`}>
                        {msg.text}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
            <div ref={chatEndRef}/>
          </div>
          <div className="p-3 border-t border-gray-100 flex gap-2 flex-shrink-0">
            <input
              className="input text-sm py-2 flex-1"
              placeholder="Reply to viewers..."
              value={msgInput}
              onChange={e => setMsgInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && sendMsg()}
            />
            <button onClick={sendMsg} className="btn-primary p-2.5"><Send size={15}/></button>
          </div>
        </div>
      </div>
    </div>
  )
}