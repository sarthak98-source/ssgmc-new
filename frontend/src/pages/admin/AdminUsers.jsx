import React, { useEffect, useState } from 'react'
import { Search, UserX, UserCheck, Trash2 } from 'lucide-react'
import api from '../../api'

const ROLE_COLORS = { buyer:'badge-gray', seller:'badge-blue', admin:'badge-red' }
const STATUS_COLORS = { active:'badge-green', suspended:'badge-red', pending:'badge-orange' }

export default function AdminUsers() {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('')
  const [updating, setUpdating] = useState(null)

  const fetchUsers = () => {
    const q = new URLSearchParams()
    if (roleFilter) q.set('role', roleFilter)
    if (search) q.set('search', search)
    api.get(`/users?${q}`).then(r => setUsers(r.data.users || [])).finally(() => setLoading(false))
  }

  useEffect(fetchUsers, [roleFilter])
  useEffect(() => { const t = setTimeout(fetchUsers, 400); return () => clearTimeout(t) }, [search])

  const updateStatus = async (id, status) => {
    setUpdating(id)
    try { await api.put(`/users/${id}/status`, { status }); fetchUsers() }
    catch (err) { alert(err?.response?.data?.message || 'Failed') }
    finally { setUpdating(null) }
  }

  const deleteUser = async (id, name) => {
    if (!confirm(`Suspend ${name}? This will prevent them from logging in.`)) return
    setUpdating(id)
    try { await api.delete(`/users/${id}`); fetchUsers() }
    catch { alert('Failed to suspend user') }
    finally { setUpdating(null) }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">Users</h1>
        <p className="text-sm text-gray-500 mt-0.5">{users.length} users</p>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/>
          <input className="input pl-8 text-sm" placeholder="Search by name or email..." value={search} onChange={e=>setSearch(e.target.value)}/>
        </div>
        <select className="input w-auto text-sm" value={roleFilter} onChange={e=>setRoleFilter(e.target.value)}>
          <option value="">All Roles</option>
          <option value="buyer">Buyers</option>
          <option value="seller">Sellers</option>
          <option value="admin">Admins</option>
        </select>
      </div>

      {loading ? (
        <div className="space-y-2">{[...Array(5)].map((_,i) => <div key={i} className="card h-16 animate-pulse"/>)}</div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">User</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase hidden md:table-cell">Role</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase hidden md:table-cell">Status</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase hidden lg:table-cell">Joined</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {users.map(u => (
                <tr key={u.id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-brand-100 flex items-center justify-center text-brand-700 font-bold text-xs flex-shrink-0">
                        {u.name?.charAt(0)?.toUpperCase()}
                      </div>
                      <div>
                        <p className="font-semibold text-gray-800">{u.name}</p>
                        <p className="text-xs text-gray-400">{u.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <span className={`badge text-xs ${ROLE_COLORS[u.role]||'badge-gray'}`}>{u.role}</span>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <span className={`badge text-xs ${STATUS_COLORS[u.status]||'badge-gray'}`}>{u.status}</span>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-400 hidden lg:table-cell">
                    {new Date(u.created_at).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'})}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      {u.status === 'active' ? (
                        <button onClick={() => updateStatus(u.id,'suspended')} disabled={updating===u.id}
                          className="p-1.5 rounded-lg hover:bg-red-50 text-red-500 transition-colors" title="Suspend">
                          <UserX size={14}/>
                        </button>
                      ) : (
                        <button onClick={() => updateStatus(u.id,'active')} disabled={updating===u.id}
                          className="p-1.5 rounded-lg hover:bg-green-50 text-green-500 transition-colors" title="Activate">
                          <UserCheck size={14}/>
                        </button>
                      )}
                      {u.role !== 'admin' && (
                        <button onClick={() => deleteUser(u.id, u.name)} disabled={updating===u.id}
                          className="p-1.5 rounded-lg hover:bg-red-50 text-red-400 transition-colors" title="Delete">
                          <Trash2 size={14}/>
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr><td colSpan={5} className="text-center py-12 text-gray-400">No users found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
