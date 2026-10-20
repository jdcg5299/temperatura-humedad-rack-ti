import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// El build cae en servidor/static/ para que Flask sirva el dashboard desde /.
// base: '/static/' porque Flask sirve los assets en la ruta /static/...
export default defineConfig({
  plugins: [react()],
  base: '/static/',
  build: {
    outDir: '../servidor/static',
    emptyOutDir: true,
  },
  server: {
    // En desarrollo, el API de Flask se alcanza por el proxy: así el
    // navegador solo ve un origen y no hay problemas de CORS.
    proxy: { '/api': 'http://localhost:5000' },
  },
})
