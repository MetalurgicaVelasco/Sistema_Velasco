import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        // Las librerías (React, Supabase, dnd-kit…) van en un archivo aparte del
        // código del sistema. Como casi no cambian, el navegador las reusa de la
        // caché entre despliegues: al publicar una versión nueva solo se vuelve
        // a bajar lo nuestro.
        manualChunks(id) {
          if (id.includes('node_modules')) return 'vendor'
        },
      },
    },
  },
})
