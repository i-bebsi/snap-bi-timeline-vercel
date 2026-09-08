import { describe, it, expect, beforeAll } from 'vitest';
import { newDb } from 'pg-mem';
import { readFileSync } from 'node:fs';
import { setPool, seedConfigRows } from '../src/server/lib/db.js';
import { makeUser, withUser } from '../src/server/auth.js';
import { ProjectService } from '../src/server/services/project.js';
import { UserService } from '../src/server/services/user.js';
import { BankService } from '../src/server/services/bank.js';
import { TaskService } from '../src/server/services/task.js';
import { ProgressService } from '../src/server/services/progress.js';
import { DashboardStatsService } from '../src/server/services/dashboardStats.js';

let pool;

beforeAll(async () => {
  const mem = newDb();
  const { Pool } = mem.adapters.createPg();
  pool = new Pool();
  setPool(pool);
  const sql = readFileSync(new URL('../db/migrations/001_schema.sql', import.meta.url), 'utf8');
  await pool.query(sql);
  await seedConfigRows();
});

const ADMIN = makeUser('ADMIN', 'admin@uii.ac.id');

describe('services (port GAS)', () => {
  it('progress v60/v61: DONE=100, future task=0, taskCount/doneCount semua aktif', async () => {
    await withUser(ADMIN, async () => {
      const project = await ProjectService.createProject({ code: 'SNAPBI', name: 'SNAP BI', status: 'ACTIVE' });
      const pic = await UserService.createUser({ name: 'Tim UII', is_pic: true });
      const bank = await BankService.createBank({ code: 'BANKX', name: 'Bank X' });

      await TaskService.createTask({
        task_name: 'A', project_id: project.id, pic_id: pic.id, bank_id: bank.id,
        start_date: '2026-10-01', end_date: '2026-10-02', status: 'DONE', progress: 0,
      });
      await TaskService.createTask({
        task_name: 'B', project_id: project.id, pic_id: pic.id, bank_id: bank.id,
        start_date: '2026-10-03', end_date: '2026-10-04', status: 'TODO', progress: 0,
      });

      const dash = await ProgressService.dashboard();
      const b = dash.banks.find((x) => x.id === bank.id);
      expect(b.progress).toBe(50);   // (100 + 0) / 2
      expect(b.taskCount).toBe(2);
      expect(b.doneCount).toBe(1);
      expect(b.currentCount).toBe(0); // future-dated → belum "berjalan"
    });
  });

  it('validation: duplicate bank code ditolak', async () => {
    await withUser(ADMIN, async () => {
      await BankService.createBank({ code: 'DUP1', name: 'Dup' });
      await expect(BankService.createBank({ code: 'DUP1', name: 'Dup 2' })).rejects.toThrow(/sudah dipakai/);
    });
  });

  it('authorization: viewer tidak bisa CREATE', async () => {
    await withUser(makeUser('VIEWER'), async () => {
      await expect(BankService.createBank({ code: 'X1', name: 'X' })).rejects.toThrow(/ACCESS DENIED/);
    });
  });

  it('health mapping dari config (ON_TRACK/AT_RISK/DELAYED)', async () => {
    await withUser(ADMIN, async () => {
      expect(await ProgressService.health(80)).toBe('ON_TRACK');
      expect(await ProgressService.health(60)).toBe('AT_RISK');
      expect(await ProgressService.health(30)).toBe('DELAYED');
    });
  });

  it('dashboard snapshot get()', async () => {
    await withUser(ADMIN, async () => {
      await DashboardStatsService.recompute();
      const snap = await DashboardStatsService.get();
      expect(typeof snap.overall).toBe('number');
    });
  });
});
