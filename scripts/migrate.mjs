// migrate.mjs — impor data dari backup GAS (JSON) ke Supabase/Postgres.
//
// Cara ekspor dari Apps Script (di repo GAS app-script-implement-snap):
//   python3 tools/call.py backup          # buat backup snapshot
//   python3 tools/call.py backup-latest > backup.json
//
// Lalu:
//   DATABASE_URL=postgres://... node scripts/migrate.mjs backup.json
//
// Skrip ini MENULIS ke database target — jalankan hanya setelah user setuju.

import 'dotenv/config';
import { readFileSync } from 'node:fs';
import pg from 'pg';
import { parse as parseConnectionString } from 'pg-connection-string';
import { NUMERIC_COLUMNS } from '../src/server/schema.js';

const file = process.argv[2];
if (!file) {
  console.error('Usage: node scripts/migrate.mjs <backup.json>');
  process.exit(1);
}

let text = readFileSync(file, 'utf8');
// Hapus baris komentar (tools/call.py --raw mencetak baris '# deployment …' di atas JSON).
text = text.split('\n').filter((l) => !l.trim().startsWith('#')).join('\n');
const raw = JSON.parse(text);

// Ekstrak tabel dari berbagai bentuk payload backup.
function findTables(obj) {
  if (!obj) return null;
  if (obj.tables && typeof obj.tables === 'object') return obj.tables;
  if (obj.data) {
    if (obj.data.tables && typeof obj.data.tables === 'object') return obj.data.tables;
    if (obj.data.payload && obj.data.payload.tables) return obj.data.payload.tables;
  }
  if (obj.payload && obj.payload.tables) return obj.payload.tables;
  return null;
}

const tables = findTables(raw);
if (!tables) {
  console.error('Struktur JSON tidak dikenali — pastikan berisi objek `tables` (backup-latest).');
  process.exit(1);
}

const order = [
  'projects', 'banks', 'users',
  'task_templates', 'task_template_items',
  'tasks', 'audit_logs', 'config', 'dashboard_stats',
];

function norm(table, key, v) {
  if (v === undefined || v === null || v === '') {
    return (NUMERIC_COLUMNS[table] || []).includes(key) ? null : (v === undefined ? null : v);
  }
  if ((NUMERIC_COLUMNS[table] || []).includes(key)) return Number(v);
  if (typeof v === 'boolean') return v;
  return v;
}

async function run() {
  const url = process.env.DATABASE_URL || process.env.POSTGRES_URL || '';
  const p = parseConnectionString(url);
  const pool = new pg.Pool({
    host: p.host || 'localhost',
    port: p.port ? parseInt(p.port, 10) : 5432,
    user: p.user,
    password: p.password,
    database: p.database || 'postgres',
    max: 5,
    ssl: { rejectUnauthorized: false },
  });
  try {
    for (const name of order) {
      const rows = tables[name] || [];
      if (!rows.length) { console.log('skip ' + name + ' (0 baris)'); continue; }
      const clean = rows.map((r) => { const o = { ...r }; delete o.__row; return o; });
      const keys = [...new Set(clean.flatMap((o) => Object.keys(o)))];
      const cols = keys.map((k) => '"' + k + '"').join(', ');
      const values = [];
      const placeholders = clean.map((_, r) =>
        '(' + keys.map((_, c) => '$' + (r * keys.length + c + 1)).join(', ') + ')'
      ).join(', ');
      clean.forEach((o) => keys.forEach((k) => values.push(norm(name, k, o[k]))));
      await pool.query(
        'INSERT INTO "' + name + '" (' + cols + ') VALUES ' + placeholders + ' ON CONFLICT DO NOTHING',
        values
      );
      console.log('migrated ' + name + ': ' + clean.length + ' baris');
    }
    console.log('selesai');
  } finally {
    await pool.end();
  }
}

run().catch((e) => { console.error(e); process.exit(1); });
