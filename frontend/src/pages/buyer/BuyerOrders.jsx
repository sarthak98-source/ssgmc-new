import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Package, Clock, Truck, CheckCircle, XCircle, ChevronDown, ChevronUp, ShoppingBag, MapPin } from 'lucide-react'
import api from '../../api'

const STATUS_STEPS = [
  { key:'pending',   label:'Order Placed',   icon:Clock,        color:'text-gray-500',  bg:'bg-gray-100'  },
  { key:'confirmed', label:'Confirmed',       icon:CheckCircle,  color:'text-blue-500',  bg:'bg-blue-100'  },
  { key:'shipped',   label:'Shipped',         icon:Truck,        color:'text-orange-500',bg:'bg-orange-100'},
  { key:'delivered', label:'Delivered',       icon:Package,      color:'text-green-500', bg:'bg-green-100' },
]

const STATUS_BADGE = {
  pending:   'badge-gray',
  confirmed: 'badge-blue',
  shipped:   'badge-orange',
  delivered: 'badge-green',
  cancelled: 'badge-red',
}

const parseItems   = i => { try { return typeof i==='string' ? JSON.parse(i):(i||[]) } catch { return [] } }
const parseAddress = a => { try { return typeof a==='string' ? JSON.parse(a):(a||{}) } catch { return {} } }

function StatusTracker({ status }) {
  if (status === 'cancelled') return (
    <div className="flex items-center gap-2 p-3 bg-red-50 rounded-xl">
      <XCircle size={16} className="text-red-500 flex-shrink-0"/>
      <p className="text-sm font-semibold text-red-600">This order was cancelled</p>
    </div>
  )

  const currentIdx = STATUS_STEPS.findIndex(s => s.key === status)

  return (
    <div className="py-2">
      <div className="flex items-start">
        {STATUS_STEPS.map((step, idx) => {
          const done    = idx <= currentIdx
          const current = idx === currentIdx
          const Icon    = step.icon
          return (
            <React.Fragment key={step.key}>
              <div className="flex flex-col items-center flex-shrink-0">
                <div className={`w-9 h-9 rounded-full flex items-center justify-center border-2 transition-all ${
                  done
                    ? current
                      ? 'bg-brand-500 border-brand-500 scale-110 shadow-md shadow-brand-200'
                      : 'bg-brand-500 border-brand-500'
                    : 'bg-white border-gray-200'
                }`}>
                  <Icon size={15} className={done ? 'text-white' : 'text-gray-300'}/>
                </div>
                <p className={`text-xs mt-1.5 font-medium text-center max-w-[60px] ${
                  done ? (current ? 'text-brand-600 font-bold' : 'text-brand-500') : 'text-gray-400'
                }`}>
                  {step.label}
                </p>
              </div>
              {idx < STATUS_STEPS.length - 1 && (
                <div className={`flex-1 h-0.5 mt-4 mx-1 ${idx < currentIdx ? 'bg-brand-400' : 'bg-gray-200'}`}/>
              )}
            </React.Fragment>
          )
        })}
      </div>
    </div>
  )
}

export default function BuyerOrders() {
  const [orders, setOrders]   = useState([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState(null)

  useEffect(() => {
    api.get('/orders').then(r => setOrders(r.data.orders || [])).finally(() => setLoading(false))
  }, [])

  if (loading) return (
    <div className="space-y-4">
      <div className="h-8 bg-gray-200 rounded w-32 animate-pulse"/>
      {[...Array(3)].map((_,i) => <div key={i} className="card h-28 animate-pulse"/>)}
    </div>
  )

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">My Orders</h1>
        <p className="text-sm text-gray-500 mt-0.5">{orders.length} order{orders.length!==1?'s':''}</p>
      </div>

      {orders.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mb-4">
            <ShoppingBag size={32} className="text-gray-400"/>
          </div>
          <h2 className="font-display text-xl font-bold text-gray-800 mb-2">No orders yet</h2>
          <p className="text-gray-500 text-sm mb-6">Your orders will appear here after purchase</p>
          <Link to="/buyer/products" className="btn-primary">Start Shopping</Link>
        </div>
      ) : (
        <div className="space-y-4">
          {orders.map(order => {
            const items   = parseItems(order.items)
            const address = parseAddress(order.address)
            const isOpen  = expanded === order.id

            return (
              <div key={order.id} className="card overflow-hidden">
                {/* Summary row */}
                <div className="p-4 flex items-center gap-4">
                  <div className="flex-1 grid grid-cols-3 gap-2 items-center">
                    <div>
                      <p className="font-semibold text-gray-800">Order #{order.id}</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {new Date(order.created_at).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'})}
                      </p>
                    </div>
                    <div className="text-center">
                      <span className={`badge text-xs ${STATUS_BADGE[order.status]||'badge-gray'}`}>
                        {order.status?.charAt(0).toUpperCase()+order.status?.slice(1)}
                      </span>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-gray-900">₹{parseFloat(order.total||0).toLocaleString('en-IN')}</p>
                      <p className="text-xs text-gray-400">{items.length} item{items.length!==1?'s':''}</p>
                    </div>
                  </div>
                  <button onClick={() => setExpanded(isOpen ? null : order.id)}
                    className="p-1.5 hover:bg-gray-100 rounded-lg flex-shrink-0">
                    {isOpen ? <ChevronUp size={16}/> : <ChevronDown size={16}/>}
                  </button>
                </div>

                {/* Item thumbnails always visible */}
                <div className="px-4 pb-3 flex items-center gap-2 border-b border-gray-50">
                  {items.slice(0,4).map((item,i) => (
                    <div key={i} className="w-10 h-10 bg-gray-100 rounded-lg overflow-hidden flex-shrink-0">
                      {item.image
                        ? <img src={item.image} alt={item.name} className="w-full h-full object-cover"/>
                        : <div className="w-full h-full flex items-center justify-center text-gray-300 text-xs">📦</div>
                      }
                    </div>
                  ))}
                  {items.length > 4 && (
                    <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center text-xs font-bold text-gray-500">
                      +{items.length-4}
                    </div>
                  )}
                  <p className="text-xs text-gray-400 ml-1">
                    {items.map(i=>i.name).slice(0,2).join(', ')}{items.length>2?'...':''}
                  </p>
                </div>

                {/* Expanded details */}
                {isOpen && (
                  <div className="p-4 space-y-5 bg-gray-50/40">
                    {/* Status tracker */}
                    <div>
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Order Status</p>
                      <StatusTracker status={order.status}/>
                    </div>

                    {/* Items detail */}
                    <div>
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Items</p>
                      <div className="space-y-2">
                        {items.map((item,i) => (
                          <div key={i} className="flex items-center gap-3 bg-white rounded-xl p-2.5 border border-gray-100">
                            <div className="w-10 h-10 bg-gray-100 rounded-lg overflow-hidden flex-shrink-0">
                              {item.image
                                ? <img src={item.image} alt={item.name} className="w-full h-full object-cover"/>
                                : <div className="w-full h-full flex items-center justify-center text-gray-200 text-lg">📦</div>
                              }
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-gray-800 truncate">{item.name}</p>
                              <p className="text-xs text-gray-400">
                                Qty: {item.qty}
                                {item.size  && ` · ${item.size}`}
                                {item.color && ` · ${item.color}`}
                              </p>
                            </div>
                            <p className="text-sm font-bold text-gray-800 flex-shrink-0">
                              ₹{(Number(item.price)*Number(item.qty)).toLocaleString('en-IN')}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Delivery address */}
                    <div className="bg-white rounded-xl p-3 border border-gray-100">
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 flex items-center gap-1">
                        <MapPin size={11}/> Delivery Address
                      </p>
                      <p className="text-sm font-semibold text-gray-800">{address.name} · {address.phone}</p>
                      <p className="text-sm text-gray-600">{address.street}</p>
                      <p className="text-sm text-gray-600">{address.city}, {address.state} — {address.pincode}</p>
                    </div>

                    {/* Price breakdown */}
                    <div className="bg-white rounded-xl p-3 border border-gray-100 text-sm space-y-1.5">
                      <div className="flex justify-between text-gray-500"><span>Subtotal</span><span>₹{parseFloat(order.subtotal||0).toLocaleString('en-IN')}</span></div>
                      <div className="flex justify-between text-gray-500"><span>Shipping</span><span>{parseFloat(order.shipping||0)===0?'FREE':`₹${parseFloat(order.shipping).toLocaleString('en-IN')}`}</span></div>
                      <div className="flex justify-between text-gray-500"><span>GST</span><span>₹{parseFloat(order.tax||0).toLocaleString('en-IN')}</span></div>
                      <div className="flex justify-between font-bold text-gray-900 text-base border-t border-gray-100 pt-1.5">
                        <span>Total</span><span>₹{parseFloat(order.total||0).toLocaleString('en-IN')}</span>
                      </div>
                      <p className="text-xs text-gray-400 capitalize">Payment: {order.payment_method}</p>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}