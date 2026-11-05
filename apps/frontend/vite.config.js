import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'react-dom/client',
      'react-router-dom',
      'lucide-react',
      'react-icons',
      'axios'
    ]
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
    proxy: {
      '/pacs': 'http://127.0.0.1:3000',
      '/mwl': 'http://127.0.0.1:3000',
      '/ai': 'http://127.0.0.1:3000',
      '/simulate': 'http://127.0.0.1:3000',
      '/api': 'http://127.0.0.1:4000',
      '/dicom-mcp': 'http://127.0.0.1:4000'
    }
  }
})
