import React, { useState } from 'react'
import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { LayoutDashboard, Package, Users, ClipboardList, Store, LogOut, Menu, ShoppingBag, Shield } from 'lucide-react'
import NotificationBell from '../ui/NotificationBell'
import { useAuth } from '../../context/AuthContext'

const navItems = [
  { to:'/admin',           icon:LayoutDashboard, label:'Dashboard',  end:true },
  { to:'/admin/products',  icon:Package,         label:'Products' },
  { to:'/admin/orders',    icon:ClipboardList,   label:'Orders' },
  { to:'/admin/sellers',   icon:Store,           label:'Sellers' },
  { to:'/admin/users',     icon:Users,           label:'Users' },
]

export default function AdminLayout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [mobileOpen, setMobileOpen] = useState(false)

  const Sidebar = () => (
    <div className="flex flex-col h-full bg-gray-900 text-gray-300">
      <div className="px-4 py-5 border-b border-gray-800">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-brand-500 rounded-lg flex items-center justify-center">
            <ShoppingBag size={15} className="text-white"/>
          </div>
          <div>
            <span className="font-display text-lg font-bold text-white">VivMart</span>
            <span className="ml-2 text-xs bg-red-900 text-red-300 font-semibold px-1.5 py-0.5 rounded-full">Admin</span>
          </div>
        </div>
      </div>
      <div className="px-4 py-4 border-b border-gray-800">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-brand-500 flex items-center justify-center text-white font-bold text-sm">
            {user?.name?.charAt(0)?.toUpperCase()}
          </div>
          <div>
            <p className="text-sm font-semibold text-white truncate">{user?.name}</p>
            <div className="flex items-center gap-1 text-xs text-gray-400"><Shield size={11}/> Admin</div>
          </div>
        </div>
      </div>
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {navItems.map(item => (
          <NavLink key={item.to} to={item.to} end={item.end}
            className={({ isActive }) => `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 cursor-pointer ${isActive ? 'bg-brand-500 text-white' : 'text-gray-400 hover:bg-gray-800 hover:text-white'}`}
            onClick={() => setMobileOpen(false)}
          >
            <item.icon size={18}/><span>{item.label}</span>
          </NavLink>
        ))}
      </nav>
      <div className="px-3 py-4 border-t border-gray-800">
        <button onClick={() => { logout(); navigate('/') }} className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-gray-400 hover:bg-red-900/40 hover:text-red-400 w-full transition-all">
          <LogOut size={18}/><span>Sign Out</span>
        </button>
      </div>
    </div>
  )

  return (
    <div className="flex h-screen bg-gray-50">
      <aside className="hidden lg:flex flex-col w-60 flex-shrink-0"><Sidebar/></aside>
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMobileOpen(false)}/>
          <aside className="absolute left-0 top-0 bottom-0 w-64 shadow-xl"><Sidebar/></aside>
        </div>
      )}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="h-14 bg-white border-b border-gray-100 flex items-center justify-between px-4 flex-shrink-0">
          <button onClick={() => setMobileOpen(true)} className="lg:hidden p-2 -ml-2 text-gray-500"><Menu size={20}/></button>
          <div className="ml-auto flex items-center gap-2">
            <NotificationBell/>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto">
          <div className="p-6 page-enter"><Outlet/></div>
        </main>
      </div>
    </div>
  )
}