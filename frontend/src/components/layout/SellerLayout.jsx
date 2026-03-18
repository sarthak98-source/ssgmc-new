import React, { useState } from 'react'
import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { LayoutDashboard, Package, Video, ClipboardList, LogOut, Menu, ShoppingBag, Bell } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'

const navItems = [
  { to:'/seller',          icon:LayoutDashboard, label:'Dashboard', end:true },
  { to:'/seller/products', icon:Package,         label:'My Products' },
  { to:'/seller/live',     icon:Video,           label:'Go Live' },
  { to:'/seller/orders',   icon:ClipboardList,   label:'Orders' },
]

export default function SellerLayout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [mobileOpen, setMobileOpen] = useState(false)

  const Sidebar = () => (
    <div className="flex flex-col h-full">
      <div className="px-4 py-5 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-brand-500 rounded-lg flex items-center justify-center">
            <ShoppingBag size={15} className="text-white"/>
          </div>
          <div>
            <span className="font-display text-lg font-bold text-gray-900">VivMart</span>
            <span className="ml-2 text-xs bg-blue-100 text-blue-700 font-semibold px-1.5 py-0.5 rounded-full">Seller</span>
          </div>
        </div>
      </div>
      <div className="px-4 py-4 border-b border-gray-100">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-sm">
            {user?.name?.charAt(0)?.toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-gray-800 truncate">{user?.name}</p>
            <p className="text-xs text-gray-500">Seller Account</p>
          </div>
        </div>
      </div>
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {navItems.map(item => (
          <NavLink key={item.to} to={item.to} end={item.end}
            className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
            onClick={() => setMobileOpen(false)}
          >
            <item.icon size={18}/><span>{item.label}</span>
            {item.label === 'Go Live' && (
              <span className="ml-auto flex items-center gap-1 text-xs text-red-500 font-semibold">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse"/>LIVE
              </span>
            )}
          </NavLink>
        ))}
      </nav>
      <div className="px-3 py-4 border-t border-gray-100">
        <button onClick={() => { logout(); navigate('/') }} className="nav-item w-full text-red-500 hover:bg-red-50 hover:text-red-600">
          <LogOut size={18}/><span>Sign Out</span>
        </button>
      </div>
    </div>
  )

  return (
    <div className="flex h-screen bg-gray-50">
      <aside className="hidden lg:flex flex-col w-60 bg-white border-r border-gray-100 flex-shrink-0"><Sidebar/></aside>
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMobileOpen(false)}/>
          <aside className="absolute left-0 top-0 bottom-0 w-64 bg-white shadow-xl"><Sidebar/></aside>
        </div>
      )}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="h-14 bg-white border-b border-gray-100 flex items-center justify-between px-4 flex-shrink-0">
          <button onClick={() => setMobileOpen(true)} className="lg:hidden p-2 -ml-2 text-gray-500"><Menu size={20}/></button>
          <div className="ml-auto flex items-center gap-2">
            <button className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-xl"><Bell size={18}/></button>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto">
          <div className="p-6 page-enter"><Outlet/></div>
        </main>
      </div>
    </div>
  )
}
