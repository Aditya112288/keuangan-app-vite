import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: '/keuangan-app-vite/',   // <— penting untuk GitHub Pages
  plugins: [react()],
})
