import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Video, Sparkles, TrendingUp, ArrowRight, Eye } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import ProductCard from '../../components/ui/ProductCard'
import api from '../../api'

const CATEGORIES = [
  { id:'clothing',    label:'Clothing',     icon:'👗' },
  { id:'jewelry',     label:'Jewelry',      icon:'💍' },
  { id:'glasses',     label:'Glasses',      icon:'🕶️' },
  { id:'hats',        label:'Hats',         icon:'🎩' },
  { id:'shoes',       label:'Shoes',        icon:'👟' },
  { id:'furniture',   label:'Furniture',    icon:'🛋️' },
  { id:'electronics', label:'Electronics',  icon:'📱' },
  { id:'home-decor',  label:'Home Decor',   icon:'🏠' },
]

export default function BuyerHome() {
  const { user } = useAuth()
  const [featured, setFeatured] = useState([])
  const [sessions, setSessions] = useState([])
  const [loading, setLoading]   = useState(true)

  useEffect(() => {
    Promise.all([
      api.get('/products?featured=true&limit=6').then(r => setFeatured(r.data.products || [])),
      api.get('/live/sessions').then(r => setSessions(r.data.sessions || [])),
    ]).finally(() => setLoading(false))
  }, [])

  return (
    <div className="space-y-8">
      {/* Welcome banner */}
      <div className="bg-gradient-to-r from-brand-500 to-orange-400 rounded-2xl p-6 text-white">
        <p className="text-sm opacity-80 mb-1">Welcome back,</p>
        <h1 className="font-display text-2xl font-bold mb-2">{user?.name} 👋</h1>
        <p className="text-sm opacity-90 mb-4">Discover products with AR try-on &amp; live shopping</p>
        <div className="flex gap-3 flex-wrap">
          <Link to="/buyer/products" className="bg-white text-brand-600 text-sm font-bold px-4 py-2 rounded-xl hover:bg-orange-50 transition-colors">
            Browse Products
          </Link>
          <Link to="/buyer/live" className="bg-white/20 text-white text-sm font-bold px-4 py-2 rounded-xl hover:bg-white/30 transition-colors flex items-center gap-2">
            <Video size={14}/> Watch Live
          </Link>
        </div>
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label:'AR Try-On',      icon:'✨', to:'/buyer/ar/1',    bg:'bg-orange-50', text:'text-orange-600' },
          { label:'Live Sessions',  icon:'🔴', to:'/buyer/live',    bg:'bg-red-50',    text:'text-red-600'    },
          { label:'My Cart',        icon:'🛒', to:'/buyer/cart',    bg:'bg-blue-50',   text:'text-blue-600'   },
          { label:'My Orders',      icon:'📦', to:'/buyer/orders',  bg:'bg-green-50',  text:'text-green-600'  },
        ].map(a => (
          <Link key={a.label} to={a.to} className={`${a.bg} rounded-2xl p-4 text-center hover:opacity-80 transition-all`}>
            <p className="text-2xl mb-1">{a.icon}</p>
            <p className={`text-sm font-semibold ${a.text}`}>{a.label}</p>
          </Link>
        ))}
      </div>

      {/* Categories */}
      <div>
        <h2 className="font-display text-lg font-bold text-gray-900 mb-4">Shop by Category</h2>
        <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-none">
          {CATEGORIES.map(c => (
            <Link key={c.id} to={`/buyer/products?category=${c.id}`}
              className="flex-shrink-0 flex flex-col items-center gap-2 bg-white border border-gray-100 rounded-2xl px-4 py-3 hover:border-brand-300 hover:bg-brand-50 transition-all">
              <span className="text-xl">{c.icon}</span>
              <span className="text-xs font-semibold text-gray-700 whitespace-nowrap">{c.label}</span>
            </Link>
          ))}
        </div>
      </div>

      {/* Live sessions — only show if any are active */}
      {sessions.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <span className="live-dot"/>
              <h2 className="font-display text-lg font-bold text-gray-900">Live Now</h2>
              <span className="badge-red text-xs">{sessions.length}</span>
            </div>
            <Link to="/buyer/live" className="text-sm text-brand-600 font-semibold hover:underline flex items-center gap-1">
              View all <ArrowRight size={14}/>
            </Link>
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            {sessions.slice(0, 2).map(s => (
              <Link key={s.id} to={`/buyer/live?session=${s.id}`}
                className="card p-4 flex items-center gap-4 hover:shadow-md transition-all">
                <div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center flex-shrink-0">
                  <Video size={20} className="text-red-500"/>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-800 text-sm truncate">{s.title}</p>
                  <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                    <Eye size={10}/> {s.viewers || 0} watching · {s.seller_name}
                  </p>
                </div>
                <div className="flex items-center gap-1.5 bg-red-500 text-white text-xs font-bold px-2.5 py-1 rounded-full flex-shrink-0">
                  <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse"/>LIVE
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Featured products */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <TrendingUp size={18} className="text-brand-500"/>
            <h2 className="font-display text-lg font-bold text-gray-900">Featured Products</h2>
          </div>
          <Link to="/buyer/products" className="text-sm text-brand-600 font-semibold hover:underline flex items-center gap-1">
            View all <ArrowRight size={14}/>
          </Link>
        </div>

        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {[...Array(6)].map((_,i) => (
              <div key={i} className="card animate-pulse">
                <div className="aspect-square bg-gray-200 rounded-t-2xl"/>
                <div className="p-3 space-y-2">
                  <div className="h-3 bg-gray-200 rounded w-3/4"/>
                  <div className="h-3 bg-gray-200 rounded w-1/2"/>
                </div>
              </div>
            ))}
          </div>
        ) : featured.length === 0 ? (
          <div className="text-center py-12 text-gray-400">No featured products yet</div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {featured.map(p => <ProductCard key={p.id} product={p}/>)}
          </div>
        )}
      </div>
    </div>
  )
}