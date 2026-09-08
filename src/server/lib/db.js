// db.js — data access layer (port dari Repository.gs) di atas PostgreSQL (pg).
// Testable: injeksi pool in-memory lewat setPool() (dipakai vitest + pg-mem).

import pg from 'pg';
import { table, NUMERIC_COLUMNS } from '../schema.js';
import { str, toNum, toBool, nextId, nowIso } from './utils.js';
import { DEFAULT_CONFIG_ROWS } from '../schema.js';

let _pool = null;

/** Inject pool (untuk test). */
export function setPool(pool) {
  _pool = pool;
}

export function getPool() {
  if (_pool) return _pool;
  _pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL || '',
    max: 5,
  });
  return _pool;
}

/** Low-level query — return hasil pg penuh (punya .rows & .rowCount). */
export async function raw(text, params = []) {
  return getPool().query(text, params);
}

const IDENT = /^[a-zA-Z_][a-zA-Z0-9_]*$/;
function col(name) {
  if (!IDENT.test(name)) throw new Error('Invalid identifier: ' + name);
  return '"' + name + '"';
}

function norm(tableName, key, v) {
  if (v === undefined) return null;
  // Kolom numerik: '' dan null dianggap NULL (faithful ke fromCell yang mengubah '' -> null).
  if ((NUMERIC_COLUMNS[tableName] || []).includes(key)) {
    return (v === '' || v === null) ? null : toNum(v);
  }
  return v;
}

function idFieldOf(tableName) {
  const t = table(tableName);
  return t && t.idField ? t.idField : 'id';
}

export async function readAll(tableName) {
  const res = await raw('SELECT * FROM ' + col(tableName));
  return res.rows;
}

export async function findById(tableName, id) {
  const idf = idFieldOf(tableName);
  const res = await raw(
    'SELECT * FROM ' + col(tableName) + ' WHERE ' + col(idf) + ' = $1 LIMIT 1',
    [str(id)]
  );
  return res.rows[0] || null;
}

/** Filter dalam JS (faithful ke Repository.gs yang load-all lalu filter). */
export async function findWhere(tableName, predicate) {
  const rows = await readAll(tableName);
  return rows.filter(predicate);
}

/** Generate id berikutnya untuk sebuah tabel. */
export async function generateId(tableName, width = 3) {
  const t = table(tableName);
  if (!t || !t.idPrefix) throw new Error('Table has no id prefix: ' + tableName);
  const rows = await readAll(tableName);
  const ids = rows.map((r) => str(r[t.idField]));
  return nextId(t.idPrefix, ids, width);
}

export async function insert(tableName, obj) {
  const keys = Object.keys(obj).filter((k) => obj[k] !== undefined);
  const cols = keys.map(col).join(', ');
  const placeholders = keys.map((_, i) => '$' + (i + 1)).join(', ');
  const values = keys.map((k) => norm(tableName, k, obj[k]));
  const res = await raw(
    'INSERT INTO ' + col(tableName) + ' (' + cols + ') VALUES (' + placeholders + ') RETURNING *',
    values
  );
  return res.rows[0];
}

export async function insertMany(tableName, objs) {
  if (!objs || !objs.length) return 0;
  // Union semua key (bukan cuma objek pertama) — beberapa baris bisa punya field berbeda.
  const keys = [...new Set(objs.flatMap((o) => Object.keys(o)))];
  const cols = keys.map(col).join(', ');
  const values = [];
  const rows = objs.map((_, r) =>
    '(' + keys.map((_, c) => '$' + (r * keys.length + c + 1)).join(', ') + ')'
  ).join(', ');
  objs.forEach((o) => keys.forEach((k) => values.push(norm(tableName, k, o[k]))));
  await raw('INSERT INTO ' + col(tableName) + ' (' + cols + ') VALUES ' + rows, values);
  return objs.length;
}

export async function update(tableName, id, patchObj) {
  const idf = idFieldOf(tableName);
  const keys = Object.keys(patchObj).filter((k) => patchObj[k] !== undefined);
  if (!keys.length) return findById(tableName, id);
  const sets = keys.map((k, i) => col(k) + ' = $' + (i + 1)).join(', ');
  const values = keys.map((k) => norm(tableName, k, patchObj[k]));
  values.push(str(id));
  const res = await raw(
    'UPDATE ' + col(tableName) + ' SET ' + sets + ' WHERE ' + col(idf) + ' = $' + values.length + ' RETURNING *',
    values
  );
  return res.rows[0] || null;
}

/** Hapus SEMUA baris sebuah tabel (baris header tidak ada di SQL). */
export async function deleteAll(tableName) {
  const res = await raw('DELETE FROM ' + col(tableName));
  return res.rowCount;
}

/* ---------------- runtime config sheet ---------------- */

/** Seed baris config yang belum ada. */
export async function seedConfigRows() {
  const existing = (await readAll('config')).map((r) => str(r.key));
  const toAdd = DEFAULT_CONFIG_ROWS
    .filter((r) => !existing.includes(r.key))
    .map((r) => ({ key: r.key, value: r.value, type: r.type, description: r.description, updated_at: nowIso() }));
  if (toAdd.length) await insertMany('config', toAdd);
  return toAdd.length;
}

/** Baca nilai config runtime dengan fallback. */
export async function configValue(key, fallback) {
  const rows = await readAll('config');
  for (const r of rows) {
    if (str(r.key) === key) {
      const v = str(r.value);
      const t = str(r.type);
      if (t === 'number') return toNum(v, fallback);
      if (t === 'boolean') return toBool(v);
      return v === '' ? fallback : v;
    }
  }
  return fallback;
}
