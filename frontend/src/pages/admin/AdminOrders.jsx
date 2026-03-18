import React, { useEffect, useState } from 'react'
import { Search, ChevronDown, ChevronUp } from 'lucide-react'
import api from '../../api'

const STATUSES = ['pending','confirmed','shipped','delivered','cancelled']
const STATUS_COLORS = { pending:'badge-gray', confirmed:'badge-blue', shipped:'badge-orange', delivered:'badge-green', cancelled:'badge-red' }

const parseItems = i => { try { return typeof i === 'string' ? JSON.parse(i) : (i||[]) } catch { return [] } }
const parseAddress = a => { try { return typeof a === 'string' ? JSON.parse(a) : (a||{}) } catch { return {} } }

export default function AdminOrders() {
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

  const updateStatus = async (id, status) => {
    setUpdating(id)
    try { await api.put(`/orders/${id}/status`, { status }); fetchOrders() }
    catch (err) { alert(err?.response?.data?.message || 'Failed') }
    finally { setUpdating(null) }
  }

  const filtered = orders.filter(o => {
    const m = !search || `#${o.id}`.includes(search) || (o.buyer_name||'').toLowerCase().includes(search.toLowerCase())
    return m && (!filterStatus || o.status === filterStatus)
  })

  const revenue = orders.filter(o=>o.status!=='cancelled').reduce((s,o)=>s+parseFloat(o.total||0),0)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">All Orders</h1>
        <p className="text-sm text-gray-500 mt-0.5">{orders.length} orders · ₹{revenue.toLocaleString('en-IN')} total revenue</p>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/>
          <input className="input pl-8 text-sm" placeholder="Search order ID or buyer..." value={search} onChange={e=>setSearch(e.target.value)}/>
        </div>
        <select className="input w-auto text-sm" value={filterStatus} onChange={e=>setFilterStatus(e.target.value)}>
          <option value="">All Status</option>
          {STATUSES.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase()+s.slice(1)}</option>)}
        </select>
      </div>

      <div className="flex gap-2 flex-wrap">
        {['', ...STATUSES].map(s => {
          const count = s ? orders.filter(o=>o.status===s).length : orders.length
          return <button key={s} onClick={()=>setFilterStatus(s)} className={`px-3 py-1 rounded-full text-xs font-semibold transition-all ${filterStatus===s?'bg-brand-500 text-white':'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>{s||'All'} ({count})</button>
        })}
      </div>

      {loading ? (
        <div className="space-y-3">{[...Array(5)].map((_,i) => <div key={i} className="card h-20 animate-pulse"/>)}</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 text-gray-400">No orders found</div>
      ) : (
        <div className="space-y-3">
          {filtered.map(order => {
            const items = parseItems(order.items)
            const address = parseAddress(order.address)
            const isOpen = expanded === order.id
            return (
              <div key={order.id} className="card overflow-hidden">
                <div className="p-4 flex items-center gap-4 cursor-pointer hover:bg-gray-50" onClick={()=>setExpanded(isOpen?null:order.id)}>
                  <div className="flex-1 grid grid-cols-4 gap-4 items-center">
                    <div>
                      <p className="font-semibold text-gray-800">#{order.id}</p>
                      <p className="text-xs text-gray-400">{new Date(order.created_at).toLocaleDateString('en-IN',{day:'numeric',month:'short'})}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-700">{order.buyer_name || `Buyer #${order.buyer_id}`}</p>
                      <p className="text-xs text-gray-400">{items.length} items</p>
                    </div>
                    <div className="text-center">
                      <span className={`badge text-xs ${STATUS_COLORS[order.status]||'badge-gray'}`}>{order.status}</span>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-gray-900">₹{parseFloat(order.total||0).toLocaleString('en-IN')}</p>
                    </div>
                  </div>
                  {isOpen ? <ChevronUp size={16} className="text-gray-400"/> : <ChevronDown size={16} className="text-gray-400"/>}
                </div>

                {isOpen && (
                  <div className="border-t border-gray-100 p-4 space-y-4">
                    <div className="grid md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <p className="text-xs font-semibold text-gray-500 uppercase">Items</p>
                        {items.map((item,i) => (
                          <div key={i} className="flex items-center gap-2">
                            <div className="w-8 h-8 bg-gray-100 rounded-lg overflow-hidden flex-shrink-0">
                              {item.image && <img src={item.image} alt={item.name} className="w-full h-full object-cover"/>}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-semibold truncate">{item.name}</p>
                              <p className="text-xs text-gray-400">x{item.qty}</p>
                            </div>
                            <p className="text-xs font-bold">₹{(item.price*item.qty).toLocaleString('en-IN')}</p>
                          </div>
                        ))}
                      </div>
                      <div className="bg-gray-50 rounded-xl p-3 text-sm">
                        <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Delivery</p>
                        <p className="text-gray-700">{address.name} · {address.phone}</p>
                        <p className="text-gray-600 text-xs">{address.street}, {address.city}</p>
                        <p className="text-gray-400 text-xs">{order.payment_method?.toUpperCase()}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-xs font-semibold text-gray-600">Update status →</p>
                      {STATUSES.filter(s=>s!==order.status).map(s => (
                        <button key={s} disabled={updating===order.id} onClick={()=>updateStatus(order.id,s)}
                          className="px-3 py-1 text-xs font-semibold rounded-xl border border-gray-200 hover:border-brand-400 hover:bg-brand-50 hover:text-brand-600 transition-all disabled:opacity-50">
                          {s}
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
