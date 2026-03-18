import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { ShoppingBag, Video, Sparkles, ArrowRight, Star, Users, Package, Zap, Shield, ChevronRight, Play } from 'lucide-react'
import api from '../api'

export default function LandingPage() {
  const [activeTab, setActiveTab] = useState('buyer')
  const [featuredProducts, setFeaturedProducts] = useState([])
  const [liveSessions, setLiveSessions] = useState([])

  useEffect(() => {
    api.get('/products?featured=true&limit=6').then(r => {
      setFeaturedProducts(r.data.products || [])
    }).catch(() => {})
    api.get('/live/sessions').then(r => setLiveSessions(r.data.sessions || [])).catch(() => {})
  }, [])

  const stats = [
    { label:'Products',  value:'1,200+', icon: Package },
    { label:'Sellers',   value:'340+',   icon: Users   },
    { label:'Orders',    value:'50K+',   icon: ShoppingBag },
    { label:'Live Shows',value:'Daily',  icon: Video   },
  ]

  const features = [
    { icon: Video,     title:'Live Shopping',      desc:'Watch sellers demo products live, ask questions, buy instantly.', color:'bg-red-50 text-red-500' },
    { icon: Sparkles,  title:'AR Try-On',           desc:'Try clothes, glasses & jewelry on yourself. Place furniture in your room.', color:'bg-orange-50 text-orange-500' },
    { icon: Zap,       title:'Real-Time Chat',      desc:'Talk directly with sellers during live sessions via Agora video.', color:'bg-blue-50 text-blue-500' },
    { icon: Shield,    title:'Secure Checkout',     desc:'Multiple payment methods, GST invoices, 30-day returns.', color:'bg-green-50 text-green-500' },
  ]

  const roles = {
    buyer:  { title:'For Shoppers', points:['Browse 1,200+ products','Try before buy with AR','Join live shopping sessions','Chat with sellers directly','Easy checkout & tracking'], link:'/register', cta:'Shop Now' },
    seller: { title:'For Sellers',  points:['List unlimited products','Go live anytime','Receive & manage orders','Real-time buyer chat','Sales analytics dashboard'], link:'/register?role=seller', cta:'Start Selling' },
    admin:  { title:'For Admins',   points:['Full platform control','User & seller management','Order oversight','Product moderation','Revenue analytics'], link:'/login', cta:'Admin Login' },
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Navbar */}
      <nav className="sticky top-0 z-50 bg-white/90 backdrop-blur border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-brand-500 rounded-lg flex items-center justify-center">
              <ShoppingBag size={16} className="text-white"/>
            </div>
            <span className="font-display text-xl font-bold text-gray-900">VivMart</span>
          </Link>
          <div className="hidden md:flex items-center gap-6 text-sm font-medium text-gray-600">
            <a href="#features" className="hover:text-brand-600 transition-colors">Features</a>
            <a href="#how-it-works" className="hover:text-brand-600 transition-colors">How It Works</a>
            <a href="#ar" className="hover:text-brand-600 transition-colors">AR Try-On</a>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/login"    className="btn-ghost text-sm">Log In</Link>
            <Link to="/register" className="btn-primary text-sm">Get Started</Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-br from-orange-50 via-white to-amber-50 pt-20 pb-24">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-20 right-20 w-72 h-72 bg-orange-200/30 rounded-full blur-3xl"/>
          <div className="absolute bottom-0 left-10 w-56 h-56 bg-amber-200/30 rounded-full blur-3xl"/>
        </div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div className="animate-fade-up">
              <div className="inline-flex items-center gap-2 bg-orange-100 text-orange-700 text-xs font-semibold px-3 py-1.5 rounded-full mb-6">
                <span className="live-dot"/>  Live Shopping is Now Open
              </div>
              <h1 className="font-display text-5xl lg:text-6xl font-bold text-gray-900 leading-tight mb-6">
                Shop Live.<br/>
                <span className="text-brand-500">Try Virtually.</span><br/>
                Buy Confidently.
              </h1>
              <p className="text-gray-500 text-lg leading-relaxed mb-8 max-w-lg">
                India's first live virtual shopping platform with real-time AR try-on. See exactly how it looks before you buy.
              </p>
              <div className="flex flex-wrap gap-3">
                <Link to="/register" className="btn-primary px-6 py-3 text-base">
                  Start Shopping <ArrowRight size={18}/>
                </Link>
                <Link to="/login?role=seller" className="btn-secondary px-6 py-3 text-base">
                  <Video size={18}/> Go Live as Seller
                </Link>
              </div>
              {/* Trust */}
              <div className="flex flex-wrap gap-6 mt-10">
                {stats.map(s => (
                  <div key={s.label} className="text-center">
                    <p className="font-display text-2xl font-bold text-gray-900">{s.value}</p>
                    <p className="text-gray-500 text-xs mt-0.5">{s.label}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Hero product grid */}
            <div className="grid grid-cols-2 gap-3 animate-fade-in">
              {featuredProducts.slice(0,4).map((p, i) => (
                <div key={p.id} className={`card-hover overflow-hidden ${i === 0 ? 'col-span-2' : ''}`}>
                  <div className={`relative overflow-hidden ${i === 0 ? 'aspect-[3/1]' : 'aspect-square'}`}>
                    <img src={p.image_url || p.image} alt={p.name} className="w-full h-full object-cover hover:scale-105 transition-transform duration-500"/>
                    <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent"/>
                    <div className="absolute bottom-2 left-3">
                      <p className="text-white text-sm font-semibold">{p.name}</p>
                      <p className="text-orange-300 text-xs">₹{p.price.toLocaleString('en-IN')}</p>
                    </div>
                    {p.badge && (
                      <span className="absolute top-2 right-2 bg-brand-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">{p.badge}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <p className="text-brand-500 text-sm font-semibold uppercase tracking-widest mb-3">Why VivMart</p>
            <h2 className="font-display text-4xl font-bold text-gray-900">The Future of Shopping</h2>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map(f => (
              <div key={f.title} className="card p-6 hover:shadow-md transition-shadow">
                <div className={`w-12 h-12 rounded-2xl ${f.color} flex items-center justify-center mb-4`}>
                  <f.icon size={22}/>
                </div>
                <h3 className="font-display font-bold text-gray-900 mb-2">{f.title}</h3>
                <p className="text-gray-500 text-sm leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* AR Section */}
      <section id="ar" className="py-20 bg-gradient-to-br from-orange-50 to-amber-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div>
              <p className="text-brand-500 text-sm font-semibold uppercase tracking-widest mb-3">Augmented Reality</p>
              <h2 className="font-display text-4xl font-bold text-gray-900 mb-5">Try It Before You Buy It</h2>
              <p className="text-gray-500 leading-relaxed mb-8">Our AR system uses advanced pose & face detection to place products on your body or in your room — live, in real time.</p>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { mode:'Body Try-On',   desc:'Clothing & shoes',   color:'bg-purple-50 text-purple-600 border-purple-200' },
                  { mode:'Face Try-On',   desc:'Glasses & jewelry',  color:'bg-blue-50 text-blue-600 border-blue-200' },
                  { mode:'Room Placement',desc:'Furniture & decor',  color:'bg-green-50 text-green-600 border-green-200' },
                  { mode:'3D Viewer',     desc:'Electronics',        color:'bg-orange-50 text-orange-600 border-orange-200' },
                ].map(m => (
                  <div key={m.mode} className={`rounded-xl border p-3 ${m.color}`}>
                    <p className="font-semibold text-sm">{m.mode}</p>
                    <p className="text-xs opacity-70 mt-0.5">{m.desc}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {featuredProducts.filter(p => p.badge?.includes('AR') || p.badge?.includes('Try')).slice(0,4).map(p => (
                <div key={p.id} className="card overflow-hidden">
                  <img src={p.image_url || p.image} alt={p.name} className="w-full aspect-square object-cover"/>
                  <div className="p-2">
                    <p className="text-xs font-semibold text-gray-700 truncate">{p.name}</p>
                    <p className="text-xs text-brand-500 font-bold mt-0.5">₹{p.price.toLocaleString('en-IN')}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Role tabs */}
      <section id="how-it-works" className="py-20 bg-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <p className="text-brand-500 text-sm font-semibold uppercase tracking-widest mb-3">Roles</p>
            <h2 className="font-display text-4xl font-bold text-gray-900">Built for Everyone</h2>
          </div>
          <div className="flex justify-center gap-2 mb-8">
            {['buyer','seller','admin'].map(r => (
              <button key={r} onClick={() => setActiveTab(r)}
                className={`px-5 py-2.5 rounded-xl font-semibold text-sm capitalize transition-all ${activeTab === r ? 'bg-brand-500 text-white shadow' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
              >{r}</button>
            ))}
          </div>
          <div className="card p-8 animate-scale-in">
            <h3 className="font-display text-2xl font-bold text-gray-900 mb-6">{roles[activeTab].title}</h3>
            <ul className="space-y-3 mb-8">
              {roles[activeTab].points.map(pt => (
                <li key={pt} className="flex items-center gap-3 text-gray-600">
                  <div className="w-5 h-5 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                    <svg className="w-3 h-3 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7"/></svg>
                  </div>
                  {pt}
                </li>
              ))}
            </ul>
            <Link to={roles[activeTab].link} className="btn-primary">
              {roles[activeTab].cta} <ArrowRight size={16}/>
            </Link>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 bg-brand-500">
        <div className="max-w-3xl mx-auto px-4 text-center">
          <h2 className="font-display text-4xl font-bold text-white mb-4">Ready to experience the future of shopping?</h2>
          <p className="text-orange-100 mb-8">Join thousands of buyers and sellers on VivMart today.</p>
          <div className="flex flex-wrap gap-3 justify-center">
            <Link to="/register" className="bg-white text-brand-600 font-bold px-8 py-3.5 rounded-xl hover:bg-orange-50 transition-colors inline-flex items-center gap-2">
              Create Free Account <ArrowRight size={18}/>
            </Link>
            <Link to="/login" className="border border-white/40 text-white font-semibold px-8 py-3.5 rounded-xl hover:bg-white/10 transition-colors inline-flex items-center gap-2">
              Sign In
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-400 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row justify-between gap-8">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-7 h-7 bg-brand-500 rounded-lg flex items-center justify-center">
                <ShoppingBag size={14} className="text-white"/>
              </div>
              <span className="font-display text-white font-bold">VivMart</span>
            </div>
            <p className="text-sm max-w-xs">India's first live virtual shopping platform with AR try-on.</p>
          </div>
          <div className="grid grid-cols-3 gap-8 text-sm">
            {[
              { title:'Platform', links:['Features','How it Works','AR Try-On','Live Shopping'] },
              { title:'Company',  links:['About','Blog','Careers','Press'] },
              { title:'Support',  links:['Help Center','Contact','Privacy','Terms'] },
            ].map(col => (
              <div key={col.title}>
                <p className="text-white font-semibold mb-3">{col.title}</p>
                {col.links.map(l => <p key={l} className="mb-2 hover:text-white cursor-pointer transition-colors">{l}</p>)}
              </div>
            ))}
          </div>
        </div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8 pt-8 border-t border-gray-800 text-xs text-center">
          © 2025 VivMart. All rights reserved.
        </div>
      </footer>
    </div>
  )
}