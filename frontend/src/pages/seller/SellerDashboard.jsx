import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Package, ShoppingBag, TrendingUp, Video, Plus, ArrowRight, Eye, AlertCircle } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import api from '../../api'

const parseItems = items => {
  try { return typeof items === 'string' ? JSON.parse(items) : (items || []) } catch { return [] }
}

export default function SellerDashboard() {
  const { user } = useAuth()
  const [products, setProducts] = useState([])
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      api.get(`/products?sellerId=${user?.id}&limit=5`).then(r => setProducts((r.data.products || []))),
      api.get('/orders').then(r => setOrders(r.data.orders || [])),
    ]).finally(() => setLoading(false))
  }, [user?.id])

  const revenue = orders.filter(o => o.status !== 'cancelled').reduce((s, o) => s + parseFloat(o.total || 0), 0)
  const pendingOrders = orders.filter(o => o.status === 'pending').length

  const stats = [
    { label:'My Products', value: products.length, icon: Package,    color:'bg-blue-50 text-blue-600',   link:'/seller/products' },
    { label:'Total Orders', value: orders.length,   icon: ShoppingBag, color:'bg-green-50 text-green-600', link:'/seller/orders' },
    { label:'Revenue',      value:`₹${(revenue/1000).toFixed(1)}K`, icon:TrendingUp, color:'bg-orange-50 text-orange-600', link:'/seller/orders' },
    { label:'Pending',      value: pendingOrders,   icon: AlertCircle, color:'bg-red-50 text-red-600',    link:'/seller/orders' },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="text-sm text-gray-500 mt-0.5">Welcome back, {user?.name}</p>
        </div>
        <div className="flex gap-2">
          <Link to="/seller/live" className="btn-danger text-sm py-2 gap-1.5">
            <span className="w-2 h-2 rounded-full bg-white animate-pulse"/> Go Live
          </Link>
          <Link to="/seller/products" className="btn-primary text-sm py-2">
            <Plus size={14}/> Add Product
          </Link>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map(s => (
          <Link key={s.label} to={s.link} className="card p-4 hover:shadow-md transition-all">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${s.color}`}>
              <s.icon size={20}/>
            </div>
            {loading ? <div className="h-6 bg-gray-200 rounded animate-pulse w-16 mb-1"/> : <p className="font-display text-2xl font-bold text-gray-900">{s.value}</p>}
            <p className="text-sm text-gray-500">{s.label}</p>
          </Link>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Recent products */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-800">My Products</h2>
            <Link to="/seller/products" className="text-sm text-brand-600 hover:underline flex items-center gap-1">
              View all <ArrowRight size={12}/>
            </Link>
          </div>
          {loading ? (
            <div className="space-y-3">{[...Array(3)].map((_,i) => <div key={i} className="h-14 bg-gray-100 rounded-xl animate-pulse"/>)}</div>
          ) : products.length === 0 ? (
            <div className="text-center py-8">
              <Package size={32} className="mx-auto text-gray-300 mb-2"/>
              <p className="text-sm text-gray-500">No products yet</p>
              <Link to="/seller/products" className="btn-primary text-sm mt-3">Add Product</Link>
            </div>
          ) : (
            <div className="space-y-2">
              {products.map(p => (
                <div key={p.id} className="flex items-center gap-3 p-2 rounded-xl hover:bg-gray-50">
                  <div className="w-10 h-10 bg-gray-100 rounded-lg overflow-hidden flex-shrink-0">
                    <img src={p.image_url || p.image} alt={p.name} className="w-full h-full object-cover"/>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-800 truncate">{p.name}</p>
                    <p className="text-xs text-gray-400 capitalize">{p.category}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-bold text-gray-800">₹{parseFloat(p.price).toLocaleString('en-IN')}</p>
                    <span className={`badge text-xs ${p.active ? 'badge-green' : 'badge-gray'}`}>{p.active ? 'Active' : 'Inactive'}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent orders */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-800">Recent Orders</h2>
            <Link to="/seller/orders" className="text-sm text-brand-600 hover:underline flex items-center gap-1">
              View all <ArrowRight size={12}/>
            </Link>
          </div>
          {loading ? (
            <div className="space-y-3">{[...Array(3)].map((_,i) => <div key={i} className="h-14 bg-gray-100 rounded-xl animate-pulse"/>)}</div>
          ) : orders.length === 0 ? (
            <div className="text-center py-8">
              <ShoppingBag size={32} className="mx-auto text-gray-300 mb-2"/>
              <p className="text-sm text-gray-500">No orders yet</p>
            </div>
          ) : (
            <div className="space-y-2">
              {orders.slice(0,5).map(o => {
                const items = parseItems(o.items)
                const statusColors = { pending:'badge-gray', confirmed:'badge-blue', shipped:'badge-orange', delivered:'badge-green', cancelled:'badge-red' }
                return (
                  <div key={o.id} className="flex items-center gap-3 p-2 rounded-xl hover:bg-gray-50">
                    <div className="w-8 h-8 bg-brand-100 rounded-lg flex items-center justify-center flex-shrink-0">
                      <ShoppingBag size={14} className="text-brand-600"/>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-800">Order #{o.id}</p>
                      <p className="text-xs text-gray-400">{items.length} item{items.length!==1?'s':''}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-sm font-bold text-gray-800">₹{parseFloat(o.total||0).toLocaleString('en-IN')}</p>
                      <span className={`badge text-xs ${statusColors[o.status]||'badge-gray'}`}>{o.status}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}