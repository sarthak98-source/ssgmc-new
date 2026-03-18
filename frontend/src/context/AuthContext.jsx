import React, { createContext, useContext, useState } from 'react'
import api from '../api'

const AuthContext = createContext(null)

const DEMO_USERS = {
  buyer:  { id: 3, name: 'Demo Buyer',  email: 'buyer@vivmart.com',  role: 'buyer'  },
  seller: { id: 2, name: 'Demo Seller', email: 'seller@vivmart.com', role: 'seller' },
  admin:  { id: 1, name: 'Admin User',  email: 'admin@vivmart.com',  role: 'admin'  },
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem('vivmart_user')) } catch { return null }
  })
  const [loading, setLoading] = useState(false)

  const saveUser = (u, token) => {
    localStorage.setItem('vivmart_token', token)
    localStorage.setItem('vivmart_user', JSON.stringify(u))
    setUser(u)
  }

  // ── Login ───────────────────────────────────────────────────────
  const login = async (email, password) => {
    setLoading(true)
    try {
      const { data } = await api.post('/auth/login', { email, password })
      if (data.success) {
        saveUser(data.user, data.token)
        return data.user
      }
      throw new Error(data.message || 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  // ── Register ────────────────────────────────────────────────────
  const register = async (name, email, password, role = 'buyer') => {
    setLoading(true)
    try {
      const { data } = await api.post('/auth/register', { name, email, password, role })
      if (data.success) {
        saveUser(data.user, data.token)
        return data.user
      }
      throw new Error(data.message || 'Registration failed')
    } finally {
      setLoading(false)
    }
  }

  // ── Demo Login (SYNC — keeps LoginPage working unchanged) ───────
  const demoLogin = (role) => {
    const u = DEMO_USERS[role]
    // Set immediately so navigation is instant
    localStorage.setItem('vivmart_user', JSON.stringify(u))
    setUser(u)
    // Get real token in background
    api.post('/auth/login', {
      email:    u.email,
      password: 'demo1234',
    }).then(({ data }) => {
      if (data.success) saveUser(data.user, data.token)
    }).catch(() => {})
    return u
  }

  // ── Logout ──────────────────────────────────────────────────────
  const logout = () => {
    localStorage.removeItem('vivmart_token')
    localStorage.removeItem('vivmart_user')
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{
      user,
      loading,
      login,
      register,
      logout,
      demoLogin,
      isAuthenticated: !!user,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}