import { describe, it, expect, beforeAll } from 'vitest';
import { newDb } from 'pg-mem';
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import { setPool, seedConfigRows } from '../src/server/lib/db.js';
import { handleRequest } from '../src/server/handler.js';

let server;

beforeAll(async () => {
  const mem = newDb();
  const { Pool } = mem.adapters.createPg();
  const pool = new Pool();
  setPool(pool);
  const sql = readFileSync(new URL('../db/migrations/001_schema.sql', import.meta.url), 'utf8');
  await pool.query(sql);
  await seedConfigRows();

  process.env.ADMIN_EMAIL = 'admin@uii.ac.id';
  process.env.ADMIN_PASSWORD_HASH = bcrypt.hashSync('secret123', 10);
  process.env.JWT_SECRET = 'test-secret';
  process.env.DATABASE_URL = 'postgres://test:test@localhost/test';

  server = createServer(handleRequest);
});

function rpc(fn, args = []) {
  return request(server).post('/api').send({ fn, args });
}

describe('handler (RPC /api + auth)', () => {
  it('getAppInfo anonim → VIEWER + menu dashboard/timeline', async () => {
    const res = await rpc('getAppInfo');
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.data.user.role).toBe('VIEWER');
    expect(res.body.data.menu).toEqual(['dashboard', 'timeline']);
    expect(res.body.data.databaseReady).toBe(true);
  });

  it('login salah → 401', async () => {
    const res = await rpc('login', ['admin@uii.ac.id', 'salah']);
    expect(res.status).toBe(401);
  });

  it('login benar → cookie; getAppInfo jadi ADMIN', async () => {
    const login = await rpc('login', ['admin@uii.ac.id', 'secret123']);
    expect(login.status).toBe(200);
    const cookie = login.headers['set-cookie'];
    expect(cookie).toBeTruthy();

    const res = await request(server).post('/api').set('Cookie', cookie).send({ fn: 'getAppInfo', args: [] });
    expect(res.body.data.user.role).toBe('ADMIN');
    expect(res.body.data.menu).toContain('settings');
  });

  it('viewer anonim diblokir mutasi (createBank → ACCESS DENIED)', async () => {
    const res = await rpc('createBank', [{ code: 'X', name: 'X' }]);
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(false);
    expect(res.body.error).toMatch(/ACCESS DENIED/);
  });

  it('unknown fn → 404', async () => {
    const res = await rpc('tidakAda');
    expect(res.status).toBe(404);
  });
});
