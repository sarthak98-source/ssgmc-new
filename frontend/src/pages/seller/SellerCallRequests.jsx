import React, { useEffect, useState, useRef } from 'react'
import { Phone, PhoneOff, PhoneIncoming, X, Video, Package } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { io } from 'socket.io-client'
import api from '../../api'
import VideoCallModal from '../../components/videocall/VideoCallModal'

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000'

export default function SellerCallRequests() {
  const { user } = useAuth()
  const [requests, setRequests]     = useState([])
  const [loading, setLoading]       = useState(true)
  const [activeCall, setActiveCall] = useState(null) // { roomId, requestId, buyerName }
  const [incoming, setIncoming]     = useState(null) // incoming call notification
  const socketRef = useRef(null)

  const fetchRequests = () => {
    api.get('/videocalls/requests').then(r => setRequests(r.data.requests || [])).finally(() => setLoading(false))
  }

  useEffect(() => {
    fetchRequests()
    // Poll every 10s
    const t = setInterval(fetchRequests, 10000)

    // Socket for real-time incoming call notification
    const socket = io(SOCKET_URL, { transports:['websocket','polling'] })
    socketRef.current = socket
    socket.emit('join_seller_room', { sellerId: user?.id })

    socket.on('incoming_call', ({ requestId, buyerName, productName }) => {
      setIncoming({ requestId, buyerName, productName })
      fetchRequests()
    })
    socket.on('call_ended', () => {
      setActiveCall(null)
      fetchRequests()
    })
    socket.on('call_chat_message', msg => {
      // handled by VideoCallModal
    })

    return () => { socket.disconnect(); clearInterval(t) }
  }, [user?.id])

  const acceptCall = async (req) => {
    try {
      const { data } = await api.put(`/videocalls/${req.id}/accept`)
      if (data.success) {
        // Notify buyer via socket
        socketRef.current?.emit('call_accepted', {
          roomId:    data.roomId,
          buyerId:   req.buyer_id,
          requestId: req.id,
        })
        setActiveCall({ roomId: data.roomId, requestId: req.id, buyerName: req.buyer_name })
        setIncoming(null)
        fetchRequests()
      }
    } catch (err) { alert('Failed to accept call') }
  }

  const rejectCall = async (req) => {
    try {
      await api.put(`/videocalls/${req.id}/reject`)
      socketRef.current?.emit('call_rejected', { buyerId: req.buyer_id, requestId: req.id })
      setIncoming(null)
      fetchRequests()
    } catch {}
  }

  const endCall = async () => {
    if (activeCall) {
      await api.put(`/videocalls/${activeCall.requestId}/end`).catch(()=>{})
      socketRef.current?.emit('end_call', {
        roomId:   activeCall.roomId,
        buyerId:  requests.find(r => r.id === activeCall.requestId)?.buyer_id,
        sellerId: user?.id,
      })
    }
    setActiveCall(null)
    fetchRequests()
  }

  return (
    <>
      {/* Active 1-to-1 call */}
      {activeCall && (
        <VideoCallModal
          roomId={activeCall.roomId}
          localUser={user}
          remoteUserName={activeCall.buyerName}
          onEnd={endCall}
          socketRef={socketRef}
        />
      )}

      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="page-title">Video Call Requests</h1>
            <p className="text-sm text-gray-500 mt-0.5">Buyers requesting 1-to-1 calls about your products</p>
          </div>
          <button onClick={fetchRequests} className="btn-secondary text-sm py-2">Refresh</button>
        </div>

        {/* Incoming call popup */}
        {incoming && (
          <div className="card p-5 border-2 border-blue-400 bg-blue-50 animate-pulse-once">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-blue-500 rounded-2xl flex items-center justify-center flex-shrink-0">
                <PhoneIncoming size={24} className="text-white"/>
              </div>
              <div className="flex-1">
                <p className="text-xs font-bold text-blue-500 uppercase tracking-wide mb-0.5">📞 Incoming Call</p>
                <p className="font-display text-lg font-bold text-gray-900">{incoming.buyerName}</p>
                <p className="text-sm text-gray-600">About: {incoming.productName}</p>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => { const req = requests.find(r => r.id === incoming.requestId); if(req) acceptCall(req) }}
                  className="flex items-center gap-2 px-5 py-3 bg-green-500 hover:bg-green-600 text-white font-bold rounded-xl text-sm transition-all shadow-md">
                  <Phone size={16}/> Accept
                </button>
                <button
                  onClick={() => { const req = requests.find(r => r.id === incoming.requestId); if(req) rejectCall(req); else setIncoming(null) }}
                  className="flex items-center gap-2 px-5 py-3 bg-red-500 hover:bg-red-600 text-white font-bold rounded-xl text-sm transition-all">
                  <PhoneOff size={16}/> Decline
                </button>
              </div>
            </div>
          </div>
        )}

        {loading ? (
          <div className="space-y-3">{[...Array(2)].map((_,i) => <div key={i} className="card h-24 animate-pulse"/>)}</div>
        ) : requests.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <Video size={32} className="text-blue-400"/>
            </div>
            <p className="font-semibold text-gray-700">No pending call requests</p>
            <p className="text-sm text-gray-400 mt-1">Buyers can request a video call from your product pages</p>
          </div>
        ) : (
          <div className="space-y-3">
            {requests.map(req => (
              <div key={req.id} className="card p-5">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-blue-100 flex items-center justify-center flex-shrink-0 text-blue-700 font-bold text-lg">
                    {req.buyer_name?.charAt(0)?.toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-800">{req.buyer_name}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      {req.product_image && (
                        <img src={req.product_image} alt={req.product_name} className="w-5 h-5 rounded object-cover"/>
                      )}
                      <p className="text-sm text-gray-500 truncate">
                        <Package size={11} className="inline mr-1"/>
                        {req.product_name || 'General inquiry'}
                      </p>
                    </div>
                    {req.message && <p className="text-xs text-gray-400 mt-1 italic">"{req.message}"</p>}
                    <p className="text-xs text-gray-400 mt-1">
                      {new Date(req.created_at).toLocaleString('en-IN',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}
                    </p>
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    <button onClick={() => acceptCall(req)}
                      className="flex items-center gap-1.5 px-4 py-2.5 bg-green-500 hover:bg-green-600 text-white font-semibold rounded-xl text-sm transition-all">
                      <Phone size={14}/> Accept
                    </button>
                    <button onClick={() => rejectCall(req)}
                      className="flex items-center gap-1.5 px-4 py-2.5 bg-red-50 hover:bg-red-100 text-red-600 font-semibold rounded-xl text-sm transition-all border border-red-200">
                      <X size={14}/> Decline
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  )
}