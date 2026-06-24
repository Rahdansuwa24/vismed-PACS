import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: '127.0.0.1',
    proxy: {
      '/pacs': 'http://localhost:4000',
      '/mwl': 'http://localhost:4000',
      '/ai': 'http://localhost:3000',
      '/simulate': 'http://localhost:3000'
    }
  }
})
