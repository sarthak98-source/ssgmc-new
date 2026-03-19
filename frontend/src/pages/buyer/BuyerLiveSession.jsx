import React, { useEffect, useState, useRef, useCallback } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import { Video, Send, Users, Eye, ShoppingCart, Sparkles, Phone, Mic, MicOff, VideoOff, WifiOff } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { useCart } from '../../context/CartContext'
import { io } from 'socket.io-client'
import AgoraRTC from 'agora-rtc-sdk-ng'
import api from '../../api'

const SOCKET_URL  = import.meta.env.VITE_SOCKET_URL  || 'http://localhost:5000'
const AGORA_APP_ID = import.meta.env.VITE_AGORA_APP_ID || ''

// ── Sessions list card ──────────────────────────────────────────────
function SessionCard({ session, onJoin }) {
  return (
    <div className="card overflow-hidden cursor-pointer hover:shadow-md transition-all" onClick={() => onJoin(session)}>
      {/* Thumbnail placeholder — dark gradient */}
      <div className="aspect-video bg-gradient-to-br from-gray-900 to-gray-800 flex items-center justify-center relative">
        <div className="w-14 h-14 rounded-full bg-white/10 flex items-center justify-center">
          <Video size={28} className="text-white/50"/>
        </div>
        {/* Live badge */}
        <div className="absolute top-3 left-3 flex items-center gap-1.5 bg-red-500 text-white text-xs font-bold px-2.5 py-1 rounded-full">
          <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse"/>LIVE
        </div>
        {/* Viewer count */}
        <div className="absolute top-3 right-3 flex items-center gap-1 bg-black/60 text-white text-xs px-2.5 py-1 rounded-full backdrop-blur">
          <Eye size={11}/> {session.viewers || 0}
        </div>
      </div>
      <div className="p-4">
        <p className="font-semibold text-gray-800 truncate">{session.title}</p>
        <p className="text-sm text-gray-500 mt-0.5">by {session.seller_name}</p>
        <button
          onClick={e => { e.stopPropagation(); onJoin(session) }}
          className="btn-primary w-full justify-center mt-3 text-sm py-2.5">
          <Video size={14}/> Join Session
        </button>
      </div>
    </div>
  )
}

// ── Main component ──────────────────────────────────────────────────
export default function BuyerLiveSession() {
  const { user } = useAuth()
  const { addItem } = useCart()
  const [searchParams] = useSearchParams()

  const [sessions, setSessions]               = useState([])
  const [activeSession, setActiveSession]     = useState(null)
  const [messages, setMessages]               = useState([])
  const [msgInput, setMsgInput]               = useState('')
  const [viewerCount, setViewerCount]         = useState(0)
  const [showcasedProduct, setShowcasedProduct] = useState(null)
  const [loading, setLoading]                 = useState(true)
  const [streamActive, setStreamActive]       = useState(false)  // true only when Agora stream is playing

  const socketRef      = useRef(null)
  const agoraClientRef = useRef(null)
  const remoteVideoRef = useRef(null)
  const chatEndRef     = useRef(null)

  // Poll sessions every 10s so newly-started sessions appear
  const loadSessions = useCallback(() => {
    api.get('/live/sessions').then(r => setSessions(r.data.sessions || []))
  }, [])

  useEffect(() => {
    loadSessions()
    setLoading(false)
    const interval = setInterval(loadSessions, 10000)
    return () => clearInterval(interval)
  }, [loadSessions])

  // Auto-scroll chat
  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  // Auto-join if ?session= param present
  useEffect(() => {
    const paramId = searchParams.get('session')
    if (paramId && sessions.length) {
      const found = sessions.find(s => s.id === parseInt(paramId))
      if (found && !activeSession) joinSession(found)
    }
  }, [sessions, searchParams])

  const joinSession = async (session) => {
    setActiveSession(session)
    setMessages([])
    setStreamActive(false)

    api.put(`/live/${session.id}/viewers`, { action: 'join' }).catch(() => {})

    // Socket.io
    const socket = io(SOCKET_URL, { transports: ['websocket', 'polling'] })
    socketRef.current = socket

    socket.emit('join_session', {
      sessionId: String(session.id),
      userId:    user?.id,
      userName:  user?.name || 'Guest',
      role:      'buyer',
    })

    socket.on('message_history', msgs => setMessages(msgs))
    socket.on('new_message',     msg  => setMessages(prev => [...prev, msg]))
    socket.on('viewer_count',    n    => setViewerCount(n))
    socket.on('live_session_ended', () => {
      alert('The seller has ended this live session.')
      leaveSession()
    })

    socket.on('user_joined', ({ userName }) =>
      setMessages(prev => [...prev, { id: Date.now(), system: true, text: `${userName} joined`, time: new Date().toISOString() }])
    )
    socket.on('product_showcased', product => {
      setShowcasedProduct(product)
      setTimeout(() => setShowcasedProduct(null), 8000)
    })

    // Agora — join as audience, only show video when stream actually starts
    if (AGORA_APP_ID && session.channel) {
      try {
        const client = AgoraRTC.createClient({ mode: 'live', codec: 'vp8' })
        agoraClientRef.current = client
        await client.setClientRole('audience')
        await client.join(AGORA_APP_ID, session.channel, null, user?.id || null)

        client.on('user-published', async (remoteUser, mediaType) => {
          await client.subscribe(remoteUser, mediaType)
          if (mediaType === 'video' && remoteVideoRef.current) {
            remoteUser.videoTrack.play(remoteVideoRef.current)
            setStreamActive(true)
          }
        })
        client.on('user-unpublished', () => setStreamActive(false))
        client.on('user-left',        () => setStreamActive(false))
      } catch (e) {
        console.warn('Agora join (audience) failed:', e.message)
      }
    }
  }

  const leaveSession = async () => {
    if (activeSession) {
      socketRef.current?.emit('leave_session', { sessionId: String(activeSession.id), userName: user?.name })
      api.put(`/live/${activeSession.id}/viewers`, { action: 'leave' }).catch(() => {})
    }
    socketRef.current?.disconnect()
    try { await agoraClientRef.current?.leave() } catch {}
    setActiveSession(null)
    setMessages([])
    setStreamActive(false)
    setViewerCount(0)
    loadSessions() // refresh list
  }

  const sendMsg = () => {
    if (!msgInput.trim() || !activeSession) return
    socketRef.current?.emit('send_message', {
      sessionId: String(activeSession.id),
      userId:    user?.id,
      userName:  user?.name || 'Guest',
      role:      'buyer',
      text:      msgInput.trim(),
    })
    setMsgInput('')
  }

  // ── Sessions list ───────────────────────────────────────────────
  if (!activeSession) return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Live Shopping</h1>
          <p className="text-sm text-gray-500 mt-0.5">Watch sellers demo products in real-time</p>
        </div>
        <button onClick={loadSessions} className="btn-secondary text-sm py-2">Refresh</button>
      </div>

      {loading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(3)].map((_,i) => <div key={i} className="card h-64 animate-pulse"/>)}
        </div>
      ) : sessions.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <Video size={32} className="text-red-400"/>
          </div>
          <p className="font-semibold text-gray-700 text-lg">No live sessions right now</p>
          <p className="text-sm text-gray-400 mt-1 max-w-xs">Sellers go live to showcase products. Check back soon or refresh.</p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {sessions.map(s => <SessionCard key={s.id} session={s} onJoin={joinSession}/>)}
        </div>
      )}
    </div>
  )

  // ── Active session ──────────────────────────────────────────────
  return (
    <div className="space-y-4 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 bg-red-500 text-white text-xs font-bold px-3 py-1.5 rounded-full">
            <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse"/>LIVE
          </div>
          <div>
            <p className="font-display font-bold text-gray-900">{activeSession.title}</p>
            <p className="text-sm text-gray-500 flex items-center gap-1">
              <Users size={12}/> {viewerCount} watching · {activeSession.seller_name}
            </p>
          </div>
        </div>
        <button onClick={leaveSession} className="btn-danger text-sm py-2 px-4 gap-1.5">
          <Phone size={14}/> Leave
        </button>
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        {/* Video area */}
        <div className="lg:col-span-2 space-y-3">
          <div className="video-tile">
            {/* Agora remote video container */}
            <div ref={remoteVideoRef} className="w-full h-full bg-gray-900 absolute inset-0"/>

            {/* Overlay when stream not yet active */}
            {!streamActive && (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-white bg-gray-900">
                <div className="w-16 h-16 rounded-full bg-white/10 flex items-center justify-center mb-4">
                  <Video size={32} className="opacity-40"/>
                </div>
                <p className="text-sm opacity-70 font-semibold">
                  {AGORA_APP_ID ? 'Connecting to stream...' : 'Live video not configured'}
                </p>
                <p className="text-xs opacity-40 mt-1 text-center max-w-xs">
                  {AGORA_APP_ID
                    ? 'Stream will appear when the seller starts broadcasting'
                    : 'Add VITE_AGORA_APP_ID to enable live video'}
                </p>
              </div>
            )}

            <div className="absolute bottom-3 right-3 flex items-center gap-1.5 bg-black/60 text-white text-xs px-3 py-1.5 rounded-full backdrop-blur pointer-events-none">
              <Eye size={11}/> {viewerCount}
            </div>
          </div>

          {/* Showcased product popup */}
          {showcasedProduct && (
            <div className="card p-4 border-2 border-brand-300 bg-brand-50">
              <div className="flex items-center gap-4">
                <img src={showcasedProduct.image} alt={showcasedProduct.name}
                  className="w-16 h-16 rounded-xl object-cover flex-shrink-0 bg-gray-100"/>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-brand-500 uppercase tracking-wide mb-0.5">🛍️ Featured Now</p>
                  <p className="font-semibold text-gray-800 truncate">{showcasedProduct.name}</p>
                  <p className="text-brand-600 font-bold">₹{Number(showcasedProduct.price).toLocaleString('en-IN')}</p>
                </div>
                <div className="flex flex-col gap-2 flex-shrink-0">
                  <button onClick={() => addItem(showcasedProduct)} className="btn-primary text-xs py-1.5 px-3 gap-1">
                    <ShoppingCart size={12}/> Add
                  </button>
                  <Link to={`/buyer/ar/${showcasedProduct.id}`} className="btn-secondary text-xs py-1.5 px-3 gap-1">
                    <Sparkles size={12}/> AR
                  </Link>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Live chat */}
        <div className="card flex flex-col" style={{ height: '480px' }}>
          <div className="px-4 py-3 border-b border-gray-100 flex-shrink-0">
            <p className="text-sm font-semibold text-gray-700">Live Chat</p>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-2 min-h-0">
            {messages.length === 0 && (
              <p className="text-center text-xs text-gray-400 pt-4">Be the first to say hi! 👋</p>
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
                      <div className={`px-3 py-1.5 rounded-2xl text-sm break-words ${msg.userId === user?.id ? 'bg-brand-500 text-white rounded-tr-sm' : 'bg-gray-100 text-gray-800 rounded-tl-sm'}`}>
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
              placeholder="Say something..."
              value={msgInput}
              onChange={e => setMsgInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && sendMsg()}
            />
            <button onClick={sendMsg} className="btn-primary p-2.5" disabled={!msgInput.trim()}>
              <Send size={15}/>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}