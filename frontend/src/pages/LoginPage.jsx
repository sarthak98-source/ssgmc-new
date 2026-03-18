import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ShoppingBag, Mail, Lock, Eye, EyeOff } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

const DEMO = [
  { role:'buyer',  label:'Demo Buyer',  emoji:'🛍️' },
  { role:'seller', label:'Demo Seller', emoji:'🏪' },
  { role:'admin',  label:'Admin',       emoji:'⚙️' },
]

export default function LoginPage() {
  const { login, demoLogin } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({ email: '', password: '' })
  const [showPw, setShowPw] = useState(false)
  const [loading, setLoading] = useState(false)
  const [demoLoading, setDemoLoading] = useState(null)
  const [error, setError] = useState('')

  const handle = async e => {
    e.preventDefault()
    setError(''); setLoading(true)
    try {
      const user = await login(form.email, form.password)
      navigate(`/${user.role}`, { replace: true })
    } catch (err) {
      setError(err?.response?.data?.message || err.message || 'Login failed')
    } finally { setLoading(false) }
  }

  const handleDemo = async role => {
    setDemoLoading(role)
    try {
      const user = demoLogin(role)
      navigate(`/${user.role}`, { replace: true })
    } finally { setDemoLoading(null) }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-amber-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center gap-2 mb-6">
            <div className="w-10 h-10 bg-brand-500 rounded-xl flex items-center justify-center">
              <ShoppingBag size={20} className="text-white"/>
            </div>
            <span className="font-display text-2xl font-bold text-gray-900">VivMart</span>
          </Link>
          <h1 className="font-display text-2xl font-bold text-gray-900">Welcome back</h1>
          <p className="text-gray-500 text-sm mt-1">Sign in to your account</p>
        </div>

        <div className="card p-8">
          {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">{error}</div>}

          <form onSubmit={handle} className="space-y-4 mb-6">
            <div>
              <label className="label">Email</label>
              <div className="relative">
                <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/>
                <input className="input pl-9" type="email" placeholder="you@example.com"
                  value={form.email} onChange={e => setForm(f=>({...f, email:e.target.value}))} required/>
              </div>
            </div>
            <div>
              <label className="label">Password</label>
              <div className="relative">
                <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/>
                <input className="input pl-9 pr-10" type={showPw ? 'text' : 'password'} placeholder="••••••••"
                  value={form.password} onChange={e => setForm(f=>({...f, password:e.target.value}))} required/>
                <button type="button" onClick={() => setShowPw(v=>!v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  {showPw ? <EyeOff size={16}/> : <Eye size={16}/>}
                </button>
              </div>
            </div>
            <button type="submit" disabled={loading} className="btn-primary w-full justify-center py-3">
              {loading ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"/> : 'Sign In'}
            </button>
          </form>

          <div className="relative mb-6">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-200"/></div>
            <div className="relative flex justify-center"><span className="bg-white px-3 text-xs text-gray-400">Quick Demo Access</span></div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {DEMO.map(d => (
              <button key={d.role} onClick={() => handleDemo(d.role)} disabled={!!demoLoading}
                className="flex flex-col items-center gap-1.5 p-3 rounded-xl border border-gray-200 hover:border-brand-300 hover:bg-brand-50 transition-all">
                <span className="text-xl">{d.emoji}</span>
                <span className="text-xs font-semibold text-gray-700">{d.label}</span>
                {demoLoading === d.role && <span className="w-3 h-3 border border-brand-500 border-t-transparent rounded-full animate-spin"/>}
              </button>
            ))}
          </div>

          <p className="text-center text-sm text-gray-500 mt-6">
            No account? <Link to="/register" className="text-brand-600 font-semibold hover:underline">Register here</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
