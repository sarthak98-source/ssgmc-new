import React, { useEffect, useState } from 'react'
import { Search, UserX, UserCheck, Store } from 'lucide-react'
import api from '../../api'

export default function AdminSellers() {
  const [sellers, setSellers] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [updating, setUpdating] = useState(null)
  const [sellerProducts, setSellerProducts] = useState({})

  const fetchSellers = () => {
    api.get('/users?role=seller').then(r => {
      const s = r.data.users || []
      setSellers(s)
      // Fetch product count per seller
      s.forEach(seller => {
        api.get(`/products?sellerId=${seller.id}&limit=1`).then(res => {
          setSellerProducts(prev => ({ ...prev, [seller.id]: res.data.total || 0 }))
        }).catch(()=>{})
      })
    }).finally(() => setLoading(false))
  }
  useEffect(fetchSellers, [])

  const updateStatus = async (id, status) => {
    setUpdating(id)
    try { await api.put(`/users/${id}/status`, { status }); fetchSellers() }
    catch { alert('Failed to update seller status') }
    finally { setUpdating(null) }
  }

  const filtered = sellers.filter(s => !search || s.name.toLowerCase().includes(search.toLowerCase()) || s.email.toLowerCase().includes(search.toLowerCase()))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">Sellers</h1>
        <p className="text-sm text-gray-500 mt-0.5">{sellers.length} registered sellers</p>
      </div>

      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/>
        <input className="input pl-8 text-sm" placeholder="Search sellers..." value={search} onChange={e=>setSearch(e.target.value)}/>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[...Array(4)].map((_,i) => <div key={i} className="card h-32 animate-pulse"/>)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20">
          <Store size={40} className="mx-auto text-gray-300 mb-3"/>
          <p className="text-gray-500">No sellers found</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map(seller => (
            <div key={seller.id} className="card p-5">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center text-blue-700 font-bold">
                    {seller.name?.charAt(0)?.toUpperCase()}
                  </div>
                  <div>
                    <p className="font-semibold text-gray-800">{seller.name}</p>
                    <p className="text-xs text-gray-400">{seller.email}</p>
                  </div>
                </div>
                <span className={`badge text-xs ${seller.status==='active'?'badge-green':seller.status==='suspended'?'badge-red':'badge-orange'}`}>{seller.status}</span>
              </div>

              <div className="grid grid-cols-3 gap-2 mb-4 text-center">
                <div className="bg-gray-50 rounded-xl p-2">
                  <p className="font-bold text-gray-800">{sellerProducts[seller.id] ?? '—'}</p>
                  <p className="text-xs text-gray-400">Products</p>
                </div>
                <div className="bg-gray-50 rounded-xl p-2">
                  <p className="font-bold text-gray-800">{seller.phone || '—'}</p>
                  <p className="text-xs text-gray-400">Phone</p>
                </div>
                <div className="bg-gray-50 rounded-xl p-2">
                  <p className="font-bold text-gray-800 text-xs">{new Date(seller.created_at).toLocaleDateString('en-IN',{month:'short',year:'numeric'})}</p>
                  <p className="text-xs text-gray-400">Joined</p>
                </div>
              </div>

              <div className="flex gap-2">
                {seller.status === 'active' ? (
                  <button onClick={() => updateStatus(seller.id, 'suspended')} disabled={updating===seller.id}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-red-50 text-red-600 text-sm font-semibold hover:bg-red-100 transition-colors">
                    <UserX size={14}/> Suspend
                  </button>
                ) : (
                  <button onClick={() => updateStatus(seller.id, 'active')} disabled={updating===seller.id}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-green-50 text-green-600 text-sm font-semibold hover:bg-green-100 transition-colors">
                    <UserCheck size={14}/> Activate
                  </button>
                )}
                <button onClick={() => window.open(`/admin/products?seller=${seller.id}`, '_self')}
                  className="flex-1 py-2 rounded-xl bg-blue-50 text-blue-600 text-sm font-semibold hover:bg-blue-100 transition-colors">
                  View Products
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
