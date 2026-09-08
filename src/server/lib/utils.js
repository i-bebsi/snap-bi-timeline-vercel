// utils.js — shared helpers (port dari Utils.gs, tanpa dependensi GAS).

import { CONFIG } from '../config.js';

const TZ = CONFIG.TIMEZONE;

/** Ambil komponen tanggal dalam timezone app (Asia/Jakarta, tanpa DST). */
function partsInTz(date, tz) {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false,
  });
  const p = fmt.formatToParts(date);
  const get = (t) => (p.find((x) => x.type === t) || {}).value || '';
  return { y: get('year'), mo: get('month'), d: get('day'), h: get('hour'), mi: get('minute'), s: get('second') };
}

/** @return {string} timestamp ISO-ish di timezone app. */
export function nowIso() {
  const p = partsInTz(new Date(), TZ);
  return `${p.y}-${p.mo}-${p.d}T${p.h}:${p.mi}:${p.s}`;
}

/** @return {string} hari ini sebagai yyyy-MM-dd di timezone app. */
export function todayIso() {
  const p = partsInTz(new Date(), TZ);
  return `${p.y}-${p.mo}-${p.d}`;
}

/** Normalisasi input tanggal apa pun → yyyy-MM-dd ('' bila kosong/invalid). */
export function toDateString(value) {
  if (value === null || value === undefined || value === '') return '';
  if (Object.prototype.toString.call(value) === '[object Date]') {
    if (Number.isNaN(value.getTime())) return '';
    const p = partsInTz(value, TZ);
    return `${p.y}-${p.mo}-${p.d}`;
  }
  const s = String(value).trim();
  if (!s) return '';
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = s.match(/^(\d{1,2})[/\-](\d{1,2})[/\-](\d{4})$/);
  if (m) return `${m[3]}-${padLeft(m[2], 2)}-${padLeft(m[1], 2)}`;
  const d = new Date(s);
  if (!Number.isNaN(d.getTime())) {
    const p = partsInTz(d, TZ);
    return `${p.y}-${p.mo}-${p.d}`;
  }
  return '';
}

/** Parse yyyy-MM-dd → Date UTC-midnight (aman untuk selisih hari). */
export function parseDate(value) {
  const s = toDateString(value);
  if (!s) return null;
  const p = s.split('-');
  return new Date(Date.UTC(Number(p[0]), Number(p[1]) - 1, Number(p[2])));
}

/** Selisih hari inklusif antara dua string yyyy-MM-dd. */
export function dayDiff(from, to) {
  const a = parseDate(from);
  const b = parseDate(to);
  if (!a || !b) return 0;
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}

export function padLeft(v, len) {
  let s = String(v);
  while (s.length < len) s = '0' + s;
  return s;
}

/** Trimmed string ('' untuk null/undefined). */
export function str(v) {
  return v === null || v === undefined ? '' : String(v).trim();
}

/** Coerce boolean ('TRUE'/'FALSE'/1/0/true/false). */
export function toBool(v) {
  if (typeof v === 'boolean') return v;
  const s = str(v).toUpperCase();
  return s === 'TRUE' || s === '1' || s === 'YES' || s === 'Y';
}

/** Coerce ke number, fallback bila bukan angka. */
export function toNum(v, fallback = 0) {
  const n = Number(v);
  if (Number.isNaN(n)) return fallback;
  return n;
}

/** Bulatkan ke CONFIG.PROGRESS.DECIMALS. */
export function roundProgress(n) {
  const f = Math.pow(10, CONFIG.PROGRESS.DECIMALS);
  return Math.round(toNum(n) * f) / f;
}

/** Generate id sekuensial: PREFIX + counter zero-padded. */
export function nextId(prefix, existingIds, width = 3) {
  const w = width;
  let max = 0;
  const re = new RegExp('^' + prefix + '(\\d+)$');
  (existingIds || []).forEach((id) => {
    const m = re.exec(str(id));
    if (m) max = Math.max(max, Number(m[1]));
  });
  return prefix + padLeft(max + 1, w);
}

/** Random uid untuk id audit. */
export function uid() {
  return crypto.randomUUID().replace(/-/g, '').substring(0, 12).toUpperCase();
}

/** Throw bila kondisi falsy. */
export function assert(condition, message) {
  if (!condition) throw new Error(message);
}

/** Bungkus service call agar frontend selalu terima bentuk konsisten (async). */
export async function envelope(action, fn) {
  try {
    return { ok: true, action, data: await fn(), error: null };
  } catch (e) {
    const msg = e && e.message ? e.message : String(e);
    console.error(action + ' failed: ' + msg);
    return { ok: false, action, data: null, error: msg };
  }
}

/** Deep-ish clone untuk objek/array polos. */
export function clone(o) {
  return o === null || o === undefined ? o : JSON.parse(JSON.stringify(o));
}
