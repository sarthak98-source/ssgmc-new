import React, { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { ShoppingBag, User, Mail, Lock, Eye, EyeOff, Sparkles } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

export default function RegisterPage() {
  const { register } = useAuth()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [form, setForm] = useState({ name: '', email: '', password: '', role: params.get('role') || 'buyer' })
  const [showPw, setShowPw] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handle = async e => {
    e.preventDefault()
    setError(''); setLoading(true)
    try {
      const user = await register(form.name, form.email, form.password, form.role)
      navigate(`/${user.role}`, { replace: true })
    } catch (err) {
      setError(err?.response?.data?.message || err.message || 'Registration failed')
    } finally { setLoading(false) }
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
          <h1 className="font-display text-2xl font-bold text-gray-900">Create your account</h1>
          <p className="text-gray-500 text-sm mt-1">Join thousands of shoppers and sellers</p>
        </div>

        <div className="card p-8">
          {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">{error}</div>}

          {/* Role tabs */}
          <div className="flex gap-2 mb-6 p-1 bg-gray-100 rounded-xl">
            {['buyer','seller'].map(r => (
              <button key={r} onClick={() => setForm(f=>({...f, role:r}))}
                className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${form.role===r ? 'bg-white text-brand-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                {r === 'buyer' ? '🛍️ Shopper' : '🏪 Seller'}
              </button>
            ))}
          </div>

          <form onSubmit={handle} className="space-y-4">
            <div>
              <label className="label">Full Name</label>
              <div className="relative">
                <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/>
                <input className="input pl-9" placeholder="Your full name" value={form.name}
                  onChange={e => setForm(f=>({...f, name:e.target.value}))} required/>
              </div>
            </div>
            <div>
              <label className="label">Email</label>
              <div className="relative">
                <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/>
                <input className="input pl-9" type="email" placeholder="you@example.com" value={form.email}
                  onChange={e => setForm(f=>({...f, email:e.target.value}))} required/>
              </div>
            </div>
            <div>
              <label className="label">Password</label>
              <div className="relative">
                <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/>
                <input className="input pl-9 pr-10" type={showPw ? 'text' : 'password'} placeholder="Min 6 characters"
                  value={form.password} onChange={e => setForm(f=>({...f, password:e.target.value}))} required minLength={6}/>
                <button type="button" onClick={() => setShowPw(v=>!v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  {showPw ? <EyeOff size={16}/> : <Eye size={16}/>}
                </button>
              </div>
            </div>

            <button type="submit" disabled={loading}
              className="btn-primary w-full justify-center py-3 mt-2">
              {loading ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"/> : <><Sparkles size={16}/> Create Account</>}
            </button>
          </form>

          <p className="text-center text-sm text-gray-500 mt-6">
            Already have an account?{' '}
            <Link to="/login" className="text-brand-600 font-semibold hover:underline">Sign In</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
