# SNAP BI Timeline — Vercel (port dari Google Apps Script)

Port dari `~/Project/AI/app-script-implement-snap` (Apps Script + Google Sheets) ke
Node.js + Supabase (Postgres) di Vercel free tier, tanpa ketergantungan GCP/Google.

## Stack
- Runtime: Node.js 20 (Vercel serverless functions)
- Database: Supabase (Postgres), akses via `pg`
- Auth: 1 akun admin (email + password, sesi JWT cookie) + pengunjung anonim = VIEWER
- Frontend: vanilla HTML/JS (di-`reuse` dari versi GAS, `api.js` diubah ke `fetch`)
- Test: vitest + pg-mem (in-memory Postgres)

## Struktur
```
api/index.js            # entry serverless Vercel (POST /api)
public/                 # frontend statis (index.html + js/ + css/)
src/server/             # backend: config, auth, db, repositories, services, controllers, handler
db/migrations/001_schema.sql   # 10 tabel
scripts/build-frontend.mjs     # konversi partial GAS -> public/
scripts/migrate.mjs            # impor data dari backup GAS
tests/                  # vitest
```

## Auth model (terkunci)
- Hanya **1 akun admin** yang login (email + password), dikonfigurasi lewat env:
  `ADMIN_EMAIL`, `ADMIN_PASSWORD_HASH` (bcrypt), `JWT_SECRET`.
- Pengunjung anonim = **VIEWER** — hanya melihat Dashboard + Timeline.
- Tidak ada registrasi. Tabel `users` = daftar PIC (penanggung jawab task), bukan akun login.

## Setup lokal
```bash
npm install
cp .env.example .env   # isi DATABASE_URL, JWT_SECRET, ADMIN_EMAIL, ADMIN_PASSWORD_HASH

# buat tabel (jalankan migrasi SQL ke Supabase, mis. via dashboard SQL Editor,
# atau: psql "$DATABASE_URL" -f db/migrations/001_schema.sql)

npm run dev            # server API di :3000
npm test               # vitest (in-memory, tidak menyentuh DB nyata)
```

Generate hash password admin:
```bash
node -e "console.log(require('bcryptjs').hashSync('PASSWORD_ANDA', 10))"
```

## Rebuild frontend (setelah edit partial di repo GAS)
```bash
node scripts/build-frontend.mjs
```

## Migrasi data (Sheets -> Supabase)
1. Di repo GAS, buat backup + ambil snapshot:
   ```bash
   python3 tools/call.py backup
   python3 tools/call.py backup-latest > backup.json
   ```
2. Impor ke Supabase (MENULIS ke DB — minta izin dulu):
   ```bash
   DATABASE_URL=postgres://... node scripts/migrate.mjs backup.json
   ```

## Deploy ke Vercel
1. `npm i -g vercel` lalu `vercel link` (pilih project baru).
2. Set env di Vercel: `DATABASE_URL`, `JWT_SECRET`, `ADMIN_EMAIL`, `ADMIN_PASSWORD_HASH`.
3. Jalankan migrasi SQL ke Supabase (sekali).
4. `vercel --prod`.
5. Setelah deploy, admin login lewat tombol "Login admin" → seed master data di Settings.

## Catatan perbedaan dari versi GAS
- `setupDatabase`/provisioning spreadsheet, `selfTest`, `runDataLayerTests`, dan
  spreadsheet URL di menu Settings **dihapus** (tidak relevan di Supabase).
- Backup harian: trigger Apps Script diganti **Vercel Cron** yang memanggil
  `POST /api` dengan `{fn:'backupNow', args:[]}` + header auth (belum di-set — lihat Fase 7).
- `Session.getActiveUser()` (login otomatis Google) diganti JWT cookie + `ADMIN_*` env.

## Troubleshooting
- Error `self-signed certificate in certificate chain` saat koneksi ke Supabase:
  pool `pg` sudah di-set `ssl: { rejectUnauthorized: false }` (lihat
  `src/server/lib/db.js`). Pastikan `DATABASE_URL` memakai string "Transaction
  pooler" (port 6543) atau string direct — keduanya butuh SSL tanpa verifikasi CA.
- Error `relation "xxx" does not exist`: tabel belum dibuat — jalankan
  `db/migrations/001_schema.sql` di Supabase SQL Editor.

