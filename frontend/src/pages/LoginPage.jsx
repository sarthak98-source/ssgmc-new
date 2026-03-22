import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ShoppingBag, Mail, Lock, Eye, EyeOff, ShoppingCart, Store } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

export default function LoginPage() {
  const { login, logout } = useAuth()
  const navigate = useNavigate()
  const [activeRole, setActiveRole] = useState('buyer')
  const [form, setForm] = useState({ email: '', password: '' })
  const [showPw, setShowPw] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handle = async e => {
    e.preventDefault()
    if (!form.email || !form.password) { setError('Please fill all fields'); return }
    setError(''); setLoading(true)
    try {
      const user = await login(form.email, form.password)
      // Validate role matches selected tab
      if (user.role !== activeRole && user.role !== 'admin') {
        // Don't keep a token/user saved if role-tab doesn't match.
        logout()
        setError(`This account is a ${user.role} account. Please use the ${user.role} login tab.`)
        setLoading(false); return
      }
      navigate(`/${user.role}`, { replace: true })
    } catch (err) {
      setError(err?.response?.data?.message || err.message || 'Invalid email or password')
    } finally { setLoading(false) }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-amber-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center gap-2 mb-4">
            <div className="w-12 h-12 bg-brand-500 rounded-2xl flex items-center justify-center shadow-lg">
              <ShoppingBag size={22} className="text-white"/>
            </div>
            <span className="font-display text-2xl font-bold text-gray-900">VivMart</span>
          </Link>
          <p className="text-gray-500 text-sm">India's live virtual shopping platform</p>
        </div>

        <div className="card p-8 shadow-xl">
          <h1 className="font-display text-2xl font-bold text-gray-900 text-center mb-6">Sign In</h1>

          {/* Role selector */}
          <div className="flex gap-3 mb-6">
            <button
              onClick={() => { setActiveRole('buyer'); setError('') }}
              className={`flex-1 flex flex-col items-center gap-2 p-4 rounded-2xl border-2 transition-all ${
                activeRole === 'buyer'
                  ? 'border-brand-500 bg-brand-50 shadow-sm'
                  : 'border-gray-200 hover:border-gray-300 bg-white'
              }`}
            >
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${activeRole==='buyer' ? 'bg-brand-500' : 'bg-gray-100'}`}>
                <ShoppingCart size={18} className={activeRole==='buyer' ? 'text-white' : 'text-gray-500'}/>
              </div>
              <span className={`text-sm font-bold ${activeRole==='buyer' ? 'text-brand-600' : 'text-gray-500'}`}>Buyer</span>
              <span className="text-xs text-gray-400">Shop & buy products</span>
            </button>
            <button
              onClick={() => { setActiveRole('seller'); setError('') }}
              className={`flex-1 flex flex-col items-center gap-2 p-4 rounded-2xl border-2 transition-all ${
                activeRole === 'seller'
                  ? 'border-blue-500 bg-blue-50 shadow-sm'
                  : 'border-gray-200 hover:border-gray-300 bg-white'
              }`}
            >
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${activeRole==='seller' ? 'bg-blue-500' : 'bg-gray-100'}`}>
                <Store size={18} className={activeRole==='seller' ? 'text-white' : 'text-gray-500'}/>
              </div>
              <span className={`text-sm font-bold ${activeRole==='seller' ? 'text-blue-600' : 'text-gray-500'}`}>Seller</span>
              <span className="text-xs text-gray-400">Sell your products</span>
            </button>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm flex items-center gap-2">
              <span className="text-red-500">⚠</span> {error}
            </div>
          )}

          <form onSubmit={handle} className="space-y-4">
            <div>
              <label className="label">Email Address</label>
              <div className="relative">
                <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/>
                <input
                  className="input pl-9"
                  type="email"
                  placeholder={activeRole === 'buyer' ? 'your@email.com' : 'seller@email.com'}
                  value={form.email}
                  onChange={e => setForm(f => ({...f, email: e.target.value}))}
                  required
                  autoComplete="email"
                />
              </div>
            </div>

            <div>
              <label className="label">Password</label>
              <div className="relative">
                <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/>
                <input
                  className="input pl-9 pr-10"
                  type={showPw ? 'text' : 'password'}
                  placeholder="Enter your password"
                  value={form.password}
                  onChange={e => setForm(f => ({...f, password: e.target.value}))}
                  required
                  autoComplete="current-password"
                />
                <button type="button" onClick={() => setShowPw(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  {showPw ? <EyeOff size={16}/> : <Eye size={16}/>}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className={`w-full justify-center py-3 text-base font-bold rounded-xl text-white transition-all flex items-center gap-2 ${
                activeRole === 'buyer'
                  ? 'bg-brand-500 hover:bg-brand-600'
                  : 'bg-blue-500 hover:bg-blue-600'
              } disabled:opacity-60`}
            >
              {loading
                ? <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"/>
                : `Sign In as ${activeRole.charAt(0).toUpperCase() + activeRole.slice(1)}`
              }
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-sm text-gray-500">
              Don't have an account?{' '}
              <Link to={`/register?role=${activeRole}`} className="font-bold text-brand-600 hover:underline">
                Register as {activeRole}
              </Link>
            </p>
          </div>

          {/* Admin hint */}
          <div className="mt-4 p-3 bg-gray-50 rounded-xl text-center">
            <p className="text-xs text-gray-400">Admin? Use your admin email directly.</p>
          </div>
        </div>
      </div>
    </div>
  )
}