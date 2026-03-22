import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import basicSsl from '@vitejs/plugin-basic-ssl'

export default defineConfig(() => {
  const useHttps = process.env.VITE_HTTPS === '1' || process.env.VITE_HTTPS === 'true'

  return {
    plugins: [react(), ...(useHttps ? [basicSsl()] : [])],
    server: {
      port: 5173,
      // HTTPS is required for camera access on non-localhost origins (e.g. LAN IP on phone)
      https: useHttps,
      // Only expose on LAN when HTTPS is enabled intentionally
      host: useHttps ? true : undefined,
      proxy: {
        '/api': {
          target: 'http://localhost:5000',
          changeOrigin: true,
        },
      },
    },
  }
})
