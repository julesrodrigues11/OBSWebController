import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Relative asset paths, so the built `dist` folder works from any folder or URL
  // (e.g. later, served from the OBS PC).
  base: './',
  server: {
    port: 5173,
  },
})
