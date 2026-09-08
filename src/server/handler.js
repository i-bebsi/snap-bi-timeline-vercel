// handler.js — HTTP handler. Semua request frontend masuk ke POST /api dengan body
// {fn, args:[...]} (RPC-style, memetakan 1:1 ke `api_*` versi GAS). fn khusus:
// 'login', 'logout', 'session'. Tanpa path-based routing → tidak perlu rewrite Vercel.

import { resolveUser, withUser, verifyAdmin, signSessionToken, COOKIE } from './auth.js';
import { controllers } from './controllers.js';

async function readBody(req) {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const raw = Buffer.concat(chunks).toString('utf8');
  if (!raw) return {};
  try { return JSON.parse(raw); } catch (e) { return {}; }
}

function sendJson(res, status, payload) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(payload));
}

async function handleLogin(body, res) {
  const args = Array.isArray(body.args) ? body.args : [];
  const email = await verifyAdmin(args[0], args[1]);
  if (!email) return sendJson(res, 401, { ok: false, error: 'Email/password salah' });
  const token = signSessionToken(email);
  res.setHeader('Set-Cookie', `${COOKIE}=${token}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${7 * 24 * 3600}`);
  return sendJson(res, 200, { ok: true, data: { email, role: 'ADMIN' } });
}

function handleLogout(res) {
  res.setHeader('Set-Cookie', `${COOKIE}=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0`);
  return sendJson(res, 200, { ok: true, data: null });
}

function handleSession(req, res) {
  const user = resolveUser(req);
  return sendJson(res, 200, { ok: true, data: { email: user.email, role: user.role } });
}

export async function handleRequest(req, res) {
  try {
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname !== '/api') {
      return sendJson(res, 404, { ok: false, error: 'Not found: ' + url.pathname });
    }

    const body = await readBody(req);
    const fn = body.fn;

    if (fn === 'login') return handleLogin(body, res);
    if (fn === 'logout') return handleLogout(res);
    if (fn === 'session') return handleSession(req, res);

    const controller = controllers[fn];
    if (!controller) return sendJson(res, 404, { ok: false, error: 'Unknown action: ' + fn });

    const args = Array.isArray(body.args) ? body.args : [];
    const user = resolveUser(req);
    const result = await withUser(user, () => controller(...args));
    return sendJson(res, 200, result);
  } catch (e) {
    const msg = e && e.message ? e.message : String(e);
    return sendJson(res, 500, { ok: false, error: msg });
  }
}
