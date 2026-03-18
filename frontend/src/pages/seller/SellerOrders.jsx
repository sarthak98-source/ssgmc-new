import React, { useEffect, useState } from 'react'
import { Package, Search, ChevronDown, ChevronUp, Truck } from 'lucide-react'
import api from '../../api'

const STATUSES = ['pending','confirmed','shipped','delivered','cancelled']
const STATUS_COLORS = { pending:'badge-gray', confirmed:'badge-blue', shipped:'badge-orange', delivered:'badge-green', cancelled:'badge-red' }

const parseItems = items => { try { return typeof items === 'string' ? JSON.parse(items) : (items || []) } catch { return [] } }
const parseAddress = addr => { try { return typeof addr === 'string' ? JSON.parse(addr) : (addr || {}) } catch { return {} } }

export default function SellerOrders() {
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [expanded, setExpanded] = useState(null)
  const [updating, setUpdating] = useState(null)

  const fetchOrders = () => {
    api.get('/orders').then(r => setOrders(r.data.orders || [])).finally(() => setLoading(false))
  }
  useEffect(fetchOrders, [])

  const updateStatus = async (orderId, status) => {
    setUpdating(orderId)
    try { await api.put(`/orders/${orderId}/status`, { status }); fetchOrders() }
    catch (err) { alert(err?.response?.data?.message || 'Failed to update status') }
    finally { setUpdating(null) }
  }

  const filtered = orders.filter(o => {
    const items = parseItems(o.items)
    const matchSearch = !search || `#${o.id}`.includes(search) || items.some(i => i.name?.toLowerCase().includes(search.toLowerCase()))
    const matchStatus = !filterStatus || o.status === filterStatus
    return matchSearch && matchStatus
  })

  const revenue = orders.filter(o => o.status !== 'cancelled').reduce((s, o) => s + parseFloat(o.total||0), 0)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">Orders</h1>
        <p className="text-sm text-gray-500 mt-0.5">{orders.length} total · ₹{revenue.toLocaleString('en-IN')} revenue</p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/>
          <input className="input pl-8 text-sm" placeholder="Search orders..." value={search} onChange={e=>setSearch(e.target.value)}/>
        </div>
        <select className="input w-auto text-sm" value={filterStatus} onChange={e=>setFilterStatus(e.target.value)}>
          <option value="">All Status</option>
          {STATUSES.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase()+s.slice(1)}</option>)}
        </select>
      </div>

      {/* Status pills */}
      <div className="flex gap-2 flex-wrap">
        {['', ...STATUSES].map(s => {
          const count = s ? orders.filter(o=>o.status===s).length : orders.length
          return (
            <button key={s} onClick={()=>setFilterStatus(s)}
              className={`px-3 py-1 rounded-full text-xs font-semibold transition-all ${filterStatus===s ? 'bg-brand-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
              {s || 'All'} ({count})
            </button>
          )
        })}
      </div>

      {loading ? (
        <div className="space-y-3">{[...Array(4)].map((_,i) => <div key={i} className="card h-20 animate-pulse"/>)}</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20">
          <Package size={40} className="mx-auto text-gray-300 mb-3"/>
          <p className="font-semibold text-gray-600">No orders found</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(order => {
            const items = parseItems(order.items)
            const address = parseAddress(order.address)
            const isOpen = expanded === order.id

            return (
              <div key={order.id} className="card overflow-hidden">
                <div className="p-4 flex items-center gap-4 cursor-pointer hover:bg-gray-50" onClick={()=>setExpanded(isOpen?null:order.id)}>
                  <div className="flex-1 grid grid-cols-3 gap-4 items-center">
                    <div>
                      <p className="font-semibold text-gray-800">Order #{order.id}</p>
                      <p className="text-xs text-gray-400">{new Date(order.created_at).toLocaleDateString('en-IN',{day:'numeric',month:'short'})}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">{items.length} item{items.length!==1?'s':''}</p>
                      <p className="text-xs text-gray-400">{order.payment_method?.toUpperCase()}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-gray-900">₹{parseFloat(order.total||0).toLocaleString('en-IN')}</p>
                      <span className={`badge text-xs ${STATUS_COLORS[order.status]||'badge-gray'}`}>{order.status}</span>
                    </div>
                  </div>
                  {isOpen ? <ChevronUp size={16} className="text-gray-400 flex-shrink-0"/> : <ChevronDown size={16} className="text-gray-400 flex-shrink-0"/>}
                </div>

                {isOpen && (
                  <div className="border-t border-gray-100 p-4 space-y-4">
                    {/* Items */}
                    <div className="space-y-2">
                      {items.map((item,i) => (
                        <div key={i} className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-gray-100 rounded-lg overflow-hidden flex-shrink-0">
                            {item.image && <img src={item.image} alt={item.name} className="w-full h-full object-cover"/>}
                          </div>
                          <div className="flex-1">
                            <p className="text-sm font-semibold text-gray-800">{item.name}</p>
                            <p className="text-xs text-gray-400">Qty: {item.qty} {item.size&&`· ${item.size}`} {item.color&&`· ${item.color}`}</p>
                          </div>
                          <p className="text-sm font-bold">₹{(item.price*item.qty).toLocaleString('en-IN')}</p>
                        </div>
                      ))}
                    </div>

                    {/* Address */}
                    <div className="bg-gray-50 rounded-xl p-3 text-sm">
                      <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Ship to</p>
                      <p className="text-gray-700">{address.name} · {address.phone}</p>
                      <p className="text-gray-600">{address.street}, {address.city} - {address.pincode}</p>
                    </div>

                    {/* Update status */}
                    <div className="flex items-center gap-3 flex-wrap">
                      <p className="text-sm font-semibold text-gray-600 flex items-center gap-1"><Truck size={14}/> Update Status:</p>
                      {STATUSES.filter(s => s !== order.status).map(s => (
                        <button key={s} disabled={updating===order.id} onClick={()=>updateStatus(order.id,s)}
                          className="px-3 py-1.5 text-xs font-semibold rounded-xl border border-gray-200 hover:border-brand-400 hover:bg-brand-50 hover:text-brand-600 transition-all disabled:opacity-50">
                          → {s}
                        </button>
                      ))}
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
