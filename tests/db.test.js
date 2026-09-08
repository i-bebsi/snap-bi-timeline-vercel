import { describe, it, expect, beforeAll } from 'vitest';
import { newDb } from 'pg-mem';
import { readFileSync } from 'node:fs';
import { setPool } from '../src/server/lib/db.js';
import * as repo from '../src/server/repositories.js';

let pool;

beforeAll(async () => {
  const mem = newDb();
  const { Pool } = mem.adapters.createPg();
  pool = new Pool();
  setPool(pool);
  const sql = readFileSync(new URL('../db/migrations/001_schema.sql', import.meta.url), 'utf8');
  await pool.query(sql);
});

describe('data layer (port Repository.gs + Repositories.gs)', () => {
  it('insert + readAll + findById + generateId (banks)', async () => {
    await repo.BankRepository.insert({ id: 'BANK001', code: 'BSI', name: 'Bank Syariah Indonesia', short_name: 'BSI', active: true, sort_order: 1, created_at: '2026-09-07T00:00:00', updated_at: '' });
    await repo.BankRepository.insert({ id: 'BANK002', code: 'MDR', name: 'Mandiri', short_name: 'MDR', active: true, sort_order: 2, created_at: '2026-09-07T00:00:00', updated_at: '' });

    const all = await repo.BankRepository.all();
    expect(all).toHaveLength(2);
    expect(all[0].id).toBe('BANK001');

    const found = await repo.BankRepository.findById('BANK002');
    expect(found.name).toBe('Mandiri');

    const next = await repo.BankRepository.nextId();
    expect(next).toBe('BANK003');
  });

  it('update + roundtrip boolean/number', async () => {
    await repo.BankRepository.update('BANK001', { active: false, sort_order: 5 });
    const b = await repo.BankRepository.findById('BANK001');
    expect(b.active).toBe(false);
    expect(b.sort_order).toBe(5);
  });

  it('findByCode + active filter', async () => {
    const bsi = await repo.BankRepository.findByCode('bsi');
    expect(bsi.id).toBe('BANK001');
    const active = await repo.BankRepository.active();
    expect(active).toHaveLength(1); // BANK001 di-nonaktifkan di test sebelumnya
  });

  it('dashboard_stats upsert (CURRENT)', async () => {
    await repo.DashboardStatsRepository.save({ overall: 42.5 }, 'admin@uii.ac.id');
    const cur = await repo.DashboardStatsRepository.getCurrent();
    expect(cur.id).toBe('CURRENT');
    expect(JSON.parse(cur.payload).overall).toBe(42.5);

    await repo.DashboardStatsRepository.save({ overall: 99 }, 'admin@uii.ac.id');
    const cur2 = await repo.DashboardStatsRepository.getCurrent();
    expect(JSON.parse(cur2.payload).overall).toBe(99);
  });

  it('task insertMany + childrenOf + findByTaskNo', async () => {
    await repo.TaskRepository.insertMany([
      { id: 'T0001', task_no: 'SNAP-BANK001-1', task_name: 'A', status: 'DONE', progress: 100, is_active: true },
      { id: 'T0002', task_no: 'SNAP-BANK001-2', task_name: 'B', status: 'TODO', progress: 0, is_active: true, parent_id: 'T0001' },
    ]);
    const byNo = await repo.TaskRepository.findByTaskNo('SNAP-BANK001-2');
    expect(byNo.id).toBe('T0002');
    const children = await repo.TaskRepository.childrenOf('T0001');
    expect(children).toHaveLength(1);
    expect(children[0].id).toBe('T0002');
  });
});
