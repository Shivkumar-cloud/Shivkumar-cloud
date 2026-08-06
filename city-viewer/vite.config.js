import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Served from https://shivkumar-cloud.github.io/Shivkumar-cloud/city-viewer/
export default defineConfig({
  base: '/Shivkumar-cloud/city-viewer/',
  plugins: [react()],
  // MapLibre loads its worker as an ES module; Vite defaults worker builds to
  // IIFE, which that path can't consume.
  worker: { format: 'es' },
})
