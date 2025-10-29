import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: '/keuangan-app-vite/',   // <— HARUS sama dengan nama repo kamu
  plugins: [react()],
})
