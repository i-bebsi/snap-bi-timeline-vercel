// auth.js — authentication & authorization (port dari AuthService.gs).
// Model baru (terkunci): 1 akun admin (email+password, sesi JWT) + pengunjung anonim = VIEWER.
// Konteks user disebar per-request via AsyncLocalStorage agar service bisa memanggil
// AuthService.require()/getActiveEmail() persis seperti versi GAS.

import { AsyncLocalStorage } from 'node:async_hooks';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { CONFIG, env } from './config.js';

const als = new AsyncLocalStorage();
const COOKIE_NAME = 'snapbi_session';

/** Jalankan fn dengan konteks user tertentu (dipakai route handler). */
export function withUser(user, fn) {
  return als.run({ user }, fn);
}

export function permissionsForRole(role) {
  const r = String(role).toUpperCase();
  if (CONFIG.ENUMS.ROLE.indexOf(r) === -1) r = CONFIG.DEFAULT_ROLE;
  return CONFIG.PERMISSIONS[r] || CONFIG.PERMISSIONS[CONFIG.DEFAULT_ROLE];
}

export function makeUser(role, email = '') {
  const r = String(role).toUpperCase();
  if (CONFIG.ENUMS.ROLE.indexOf(r) === -1) r = CONFIG.DEFAULT_ROLE;
  return {
    email: email,
    name: email ? email.split('@')[0] : 'unknown',
    role: r,
    permissions: permissionsForRole(r),
    known: r === 'ADMIN' && !!email,
    bootstrap: false,
    databaseReady: !!env.databaseUrl(),
  };
}

export function getCurrentUser() {
  const ctx = als.getStore();
  return ctx && ctx.user ? ctx.user : makeUser(CONFIG.DEFAULT_ROLE);
}

export function getActiveEmail() {
  return getCurrentUser().email;
}

export function can(permission) {
  return (getCurrentUser().permissions || []).indexOf(permission) !== -1;
}

export function requirePermission(permission) {
  const u = getCurrentUser();
  if ((u.permissions || []).indexOf(permission) === -1) {
    throw new Error('ACCESS DENIED: role ' + u.role + ' tidak diizinkan ' + permission);
  }
  return u;
}

/* ---------------- request resolution (JWT cookie) ---------------- */

function readCookie(req, name) {
  const header = (req.headers && (req.headers.cookie || req.headers.Cookie)) || '';
  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    const k = part.slice(0, idx).trim();
    if (k === name) return decodeURIComponent(part.slice(idx + 1).trim());
  }
  return '';
}

/** Resolve user dari request: JWT admin valid → ADMIN; selain itu → VIEWER anonim. */
export function resolveUser(req) {
  const token = readCookie(req, COOKIE_NAME);
  if (token && env.jwtSecret()) {
    try {
      const payload = jwt.verify(token, env.jwtSecret());
      if (payload && payload.role === 'ADMIN') return makeUser('ADMIN', payload.email || '');
    } catch (e) {
      /* token invalid/expired → fallthrough ke viewer */
    }
  }
  return makeUser(CONFIG.DEFAULT_ROLE);
}

/** Verifikasi kredensial admin (email + password) terhadap env. */
export async function verifyAdmin(email, password) {
  if (!email || !password) return null;
  const adminEmail = env.adminEmail();
  if (!adminEmail || !env.adminPasswordHash()) return null;
  if (String(email).toLowerCase() !== adminEmail) return null;
  const ok = await bcrypt.compare(password, env.adminPasswordHash());
  return ok ? adminEmail : null;
}

export function signSessionToken(email) {
  return jwt.sign({ role: 'ADMIN', email }, env.jwtSecret(), { expiresIn: '7d' });
}

export const COOKIE = COOKIE_NAME;

export const AuthService = {
  getCurrentUser,
  getActiveEmail,
  can,
  require: requirePermission,
  permissionsForRole,
};
