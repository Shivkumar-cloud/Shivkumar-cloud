import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Served from https://shivkumar-cloud.github.io/Shivkumar-cloud/city-viewer/
export default defineConfig({
  base: '/Shivkumar-cloud/city-viewer/',
  plugins: [react()],
})
