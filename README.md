# Dashboard Essential English Course

Dashboard internal untuk **mencatat uang les** dan **mengelola data murid**.
Project ini terpisah dari website company profile, tapi memakai font dan warna yang sama.

```
eec-dashboard/
  app/, components/, lib/   frontend: Next.js 16 (port 3001)
  server/                   backend: Express API (port 4000) → Supabase
  supabase/migrations/      skema database (SQL)
```

| Peran | Bisa apa |
|---|---|
| **Admin** | Ringkasan bulanan, catat pembayaran (lunas / sebagian / belum, tandai lunas massal), rekap per bulan + target + unduh CSV, daftar tunggakan, kelola murid (tambah, impor dari spreadsheet, arsip), kelas & biaya, guru (akun, pindah murid), semua pengguna |
| **Guru** | Hanya melihat daftar muridnya, per kelas; ganti password sendiri |

**Cara kerja tagihan:**
- Tiap murid aktif ditagih biaya kelasnya setiap bulan, mulai bulan ia ditambahkan sampai bulan ia diarsipkan.
- Begitu pembayaran dicatat, nominal tagihan bulan itu dibekukan. Kalau biaya kelas naik nanti, catatan lama tidak ikut berubah.

## Setup pertama kali

1. **Buat project Supabase baru** khusus untuk kursus ini. Lalu di *Authentication → Sign In / Providers*, matikan **Allow new users to sign up**. Semua akun dibuat oleh admin dari dashboard.
2. **Jalankan SQL migrasi.** Buka *SQL Editor*, tempel isi `supabase/migrations/20261117000000_dashboard.sql`, lalu klik Run. Migrasi ini:
   - membuat semua tabel;
   - mengunci tabel dari akses publik (RLS tanpa policy, jadi hanya server yang bisa membaca dan menulis);
   - mengisi 16 kelas sesuai harga di website: KG 200 rb, naik 20 rb per tingkat.
3. **Isi file env.**
   - `cp .env.example .env.local` (isi `API_URL`; default sudah cocok untuk lokal).
   - `cp server/.env.example server/.env`, lalu isi:
     - `SUPABASE_URL`;
     - `SUPABASE_SECRET_KEY` (*Project Settings → API Keys → Secret*; hanya untuk server, jangan pernah ditaruh di frontend);
     - `SUPABASE_PUBLISHABLE_KEY`.
4. **Install dependensi dan buat admin pertama:**

   ```bash
   npm install
   ```
   ```bash
   npm run setup:api
   ```
   ```bash
   npm --prefix server run create-admin -- admin@contoh.id "PasswordKuat123" "Nama Admin"
   ```

5. **Jalankan** di dua terminal, lalu buka http://localhost:3001:

   ```bash
   npm run dev:api
   ```
   ```bash
   npm run dev
   ```

**Kenapa ada dua server:** browser hanya bicara dengan Next.js (3001). Next.js meneruskan `/api/*` ke Express (4000) di belakang layar, jadi cookie login tetap satu domain dan tidak perlu pengaturan CORS.

## Deploy

Dashboard dan API di-deploy sebagai **dua service**, terpisah dari website company profile.

| Service | Folder | Contoh host | Perintah | Env |
|---|---|---|---|---|
| Dashboard | root (`.`) | Vercel | `npm run build` / `npm start` | `API_URL=https://api.domain-kamu.id`, `NEXT_PUBLIC_SITE_URL=https://dashboard.domain-kamu.id` |
| API | `server/` | Railway, Render, VPS | `npm ci && npm run build` / `npm start` | `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `SUPABASE_PUBLISHABLE_KEY`, `NODE_ENV=production`, `ALLOWED_ORIGINS=https://dashboard.domain-kamu.id` |

- Di Vercel, *Root Directory* = root repo. Folder `server/` tidak ikut di-build oleh Next.js.
- Di Railway/Render, set *Root Directory* = `server`. Port diambil dari env `PORT` yang diberikan host.
- `ALLOWED_ORIGINS` harus berisi alamat dashboard yang dipakai di browser. Request yang mengubah data dari alamat lain akan ditolak.
- `NEXT_PUBLIC_SITE_URL` dipakai untuk pratinjau link (Open Graph). Isi sebelum build, karena nilainya dibaca saat build. Di Vercel, kalau dikosongkan, otomatis memakai domain production.
- Pratinjau link (WhatsApp, Telegram, LinkedIn, X): judul, deskripsi dan gambar 1200×630 dibuat dari `lib/site.ts` dan `lib/share-card.tsx`. Setelah deploy, cek dengan [opengraph.xyz](https://www.opengraph.xyz) atau LinkedIn Post Inspector. WhatsApp dan Telegram menyimpan pratinjau lama di cache, jadi untuk tes bisa tambahkan `?v=2` di ujung link.
- Di website company profile, cukup tambahkan link ke `https://dashboard.domain-kamu.id` kalau perlu, misalnya di footer.

## Keamanan singkat

- Login lewat Supabase Auth. Token disimpan di cookie `httpOnly`, jadi tidak bisa dibaca JavaScript.
- Setiap request dicek ulang ke Supabase, termasuk peran dan status aktif akun.
- Request yang mengubah data dari origin lain ditolak.
- Login dibatasi 10 percobaan per 15 menit.
- Dashboard tidak bisa ditampilkan di dalam iframe dan tidak diindeks mesin pencari.
- Setiap perubahan penting tercatat di `audit_log` (tampil sebagai "Aktivitas terbaru").

## Cek kode

```bash
npm run lint
```
```bash
npm run typecheck
```
```bash
npm --prefix server run typecheck
```
```bash
npm --prefix server test
```
# eec-dashboard
