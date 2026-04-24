import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: '0.0.0.0',   // listen on all network interfaces (not only localhost)
    port: 3000,        // change to any port you want
    strictPort: true,  // fail if 3000 is taken (optional)
  },
})
