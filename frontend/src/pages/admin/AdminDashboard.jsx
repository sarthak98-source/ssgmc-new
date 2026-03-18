import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Users, Package, ShoppingBag, TrendingUp, Store, ArrowRight, Activity } from 'lucide-react'
import api from '../../api'

const parseItems = items => { try { return typeof items === 'string' ? JSON.parse(items) : (items || []) } catch { return [] } }

const STATUS_COLORS = { pending:'badge-gray', confirmed:'badge-blue', shipped:'badge-orange', delivered:'badge-green', cancelled:'badge-red' }

export default function AdminDashboard() {
  const [stats, setStats] = useState(null)
  const [recentOrders, setRecentOrders] = useState([])
  const [recentUsers, setRecentUsers] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      api.get('/users/stats/admin').then(r => setStats(r.data.stats)),
      api.get('/orders').then(r => setRecentOrders((r.data.orders || []).slice(0,5))),
      api.get('/users?limit=5').then(r => setRecentUsers((r.data.users || []).slice(0,5))),
    ]).finally(() => setLoading(false))
  }, [])

  const statCards = stats ? [
    { label:'Buyers',    value:stats.buyers,   icon:Users,     color:'bg-blue-50 text-blue-600',   link:'/admin/users' },
    { label:'Sellers',   value:stats.sellers,  icon:Store,     color:'bg-purple-50 text-purple-600',link:'/admin/sellers' },
    { label:'Products',  value:stats.products, icon:Package,   color:'bg-orange-50 text-orange-600',link:'/admin/products' },
    { label:'Orders',    value:stats.orders,   icon:ShoppingBag,color:'bg-green-50 text-green-600', link:'/admin/orders' },
    { label:'Revenue',   value:`₹${(parseFloat(stats.revenue||0)/1000).toFixed(1)}K`, icon:TrendingUp, color:'bg-red-50 text-red-600', link:'/admin/orders' },
  ] : []

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">Admin Dashboard</h1>
        <p className="text-sm text-gray-500 mt-0.5">Platform overview and management</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {loading ? [...Array(5)].map((_,i) => <div key={i} className="card h-24 animate-pulse"/>) :
         statCards.map(s => (
          <Link key={s.label} to={s.link} className="card p-4 hover:shadow-md transition-all">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-2 ${s.color}`}>
              <s.icon size={18}/>
            </div>
            <p className="font-display text-2xl font-bold text-gray-900">{s.value}</p>
            <p className="text-xs text-gray-500">{s.label}</p>
          </Link>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Recent orders */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-800 flex items-center gap-2"><Activity size={16} className="text-brand-500"/> Recent Orders</h2>
            <Link to="/admin/orders" className="text-sm text-brand-600 hover:underline flex items-center gap-1">View all <ArrowRight size={12}/></Link>
          </div>
          {loading ? <div className="space-y-3">{[...Array(3)].map((_,i) => <div key={i} className="h-12 bg-gray-100 rounded-xl animate-pulse"/>)}</div> : (
            <div className="space-y-2">
              {recentOrders.map(o => {
                const items = parseItems(o.items)
                return (
                  <div key={o.id} className="flex items-center gap-3 p-2 rounded-xl hover:bg-gray-50">
                    <div className="w-8 h-8 bg-brand-100 rounded-lg flex items-center justify-center flex-shrink-0">
                      <ShoppingBag size={12} className="text-brand-600"/>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-800">Order #{o.id}</p>
                      <p className="text-xs text-gray-400">{o.buyer_name || `Buyer #${o.buyer_id}`} · {items.length} items</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-sm font-bold">₹{parseFloat(o.total||0).toLocaleString('en-IN')}</p>
                      <span className={`badge text-xs ${STATUS_COLORS[o.status]||'badge-gray'}`}>{o.status}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Recent users */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-800 flex items-center gap-2"><Users size={16} className="text-brand-500"/> Recent Users</h2>
            <Link to="/admin/users" className="text-sm text-brand-600 hover:underline flex items-center gap-1">View all <ArrowRight size={12}/></Link>
          </div>
          {loading ? <div className="space-y-3">{[...Array(3)].map((_,i) => <div key={i} className="h-12 bg-gray-100 rounded-xl animate-pulse"/>)}</div> : (
            <div className="space-y-2">
              {recentUsers.map(u => (
                <div key={u.id} className="flex items-center gap-3 p-2 rounded-xl hover:bg-gray-50">
                  <div className="w-8 h-8 rounded-full bg-brand-100 flex items-center justify-center text-brand-700 font-bold text-xs flex-shrink-0">
                    {u.name?.charAt(0)?.toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-800 truncate">{u.name}</p>
                    <p className="text-xs text-gray-400 truncate">{u.email}</p>
                  </div>
                  <div className="flex gap-1 flex-shrink-0">
                    <span className={`badge text-xs ${u.role==='seller'?'badge-blue':u.role==='admin'?'badge-red':'badge-gray'}`}>{u.role}</span>
                    <span className={`badge text-xs ${u.status==='active'?'badge-green':'badge-gray'}`}>{u.status}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Quick links */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label:'Manage Users',    to:'/admin/users',    icon:'👥', bg:'bg-blue-50',    text:'text-blue-700' },
          { label:'Manage Products', to:'/admin/products', icon:'📦', bg:'bg-orange-50',  text:'text-orange-700' },
          { label:'Manage Orders',   to:'/admin/orders',   icon:'🛍️', bg:'bg-green-50',   text:'text-green-700' },
          { label:'Manage Sellers',  to:'/admin/sellers',  icon:'🏪', bg:'bg-purple-50',  text:'text-purple-700' },
        ].map(q => (
          <Link key={q.label} to={q.to} className={`${q.bg} rounded-2xl p-4 text-center hover:opacity-80 transition-all`}>
            <p className="text-2xl mb-1">{q.icon}</p>
            <p className={`text-sm font-semibold ${q.text}`}>{q.label}</p>
          </Link>
        ))}
      </div>
    </div>
  )
}
