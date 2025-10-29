# Keuangan App (Vite + React)

## Jalankan Lokal
```bash
npm install
npm run dev
```

## Build Produksi
```bash
npm run build
```

Hasil build ada di folder `dist/`.

## Deploy Cepat

### Netlify (via Repo)
1. Push folder ini ke GitHub.
2. Buka Netlify → Import from Git → pilih repo ini.
3. Build command: `npm run build` — Publish directory: `dist`.

### Vercel
1. Push ke GitHub.
2. Buka Vercel → New Project → import repo.
3. Framework: Vite (auto terdeteksi). Build: `npm run build`, Output: `dist`.

### Netlify Drop (tanpa repo)
1. Jalankan build lokal: `npm install && npm run build`.
2. Drag & drop folder `dist` ke https://app.netlify.com/drop
