import axios from 'axios'

const rawBase = import.meta.env.VITE_API_URL
const normalizedBase = rawBase ? String(rawBase).replace(/\/+$/, '') : ''
// Accept either:
// - VITE_API_URL=http://localhost:5000      (we'll append /api)
// - VITE_API_URL=http://localhost:5000/api (kept as-is)
const baseURL = normalizedBase
  ? (normalizedBase.endsWith('/api') ? normalizedBase : `${normalizedBase}/api`)
  : 'http://localhost:5000/api'

const api = axios.create({
  baseURL,
  headers: { 'Content-Type': 'application/json' },
  withCredentials: false,
})

// Attach JWT token to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('vivmart_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// Handle 401 globally
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('vivmart_token')
      localStorage.removeItem('vivmart_user')
    }
    return Promise.reject(err)
  }
)

export default api