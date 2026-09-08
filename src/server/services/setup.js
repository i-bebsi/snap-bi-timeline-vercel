// services/setup.js — seeding & status (port dari Setup.gs).
// setupDatabase() GAS (buat spreadsheet + tabel) TIDAK relevan di Vercel:
// tabel dibuat lewat migrasi SQL (db/migrations). Yang dipertahankan: seed master data + status.

import { TABLES } from '../schema.js';
import { CONFIG, env } from '../config.js';
import { str } from '../lib/utils.js';
import { readAll } from '../lib/db.js';
import { ProjectRepository, BankRepository, UserRepository } from '../repositories.js';
import { AuthService } from '../auth.js';
import { ProjectService } from './project.js';
import { BankService } from './bank.js';
import { UserService } from './user.js';

const DEFAULT_PICS = [
  { name: 'Tim UII', email: '', role: 'VIEWER' },
  { name: 'Bank', email: '', role: 'VIEWER' },
  { name: 'Vendor', email: '', role: 'VIEWER' },
];

const DEFAULT_BANKS = [
  { code: 'BANKA', name: 'Bank A', short_name: 'Bank A', sort_order: 1 },
  { code: 'BANKB', name: 'Bank B', short_name: 'Bank B', sort_order: 2 },
  { code: 'BANKC', name: 'Bank C', short_name: 'Bank C', sort_order: 3 },
  { code: 'BANKD', name: 'Bank D', short_name: 'Bank D', sort_order: 4 },
  { code: 'BANKE', name: 'Bank E', short_name: 'Bank E', sort_order: 5 },
];

const DEFAULT_PROJECT = {
  code: 'SNAPBI',
  name: 'SNAP BI',
  description: 'Implementasi SNAP BI (Standar Nasional Open API Pembayaran) untuk integrasi H2H dengan bank mitra.',
  status: 'ACTIVE',
};

async function seedMasterData() {
  AuthService.require('CREATE');
  const created = { banks: [], projects: [], pics: [] };
  const skipped = { banks: [], projects: [], pics: [] };

  for (const p of [DEFAULT_PROJECT]) {
    if (await ProjectRepository.findByCode(p.code)) skipped.projects.push(p.code);
    else created.projects.push((await ProjectService.createProject(p)).code);
  }
  for (const b of DEFAULT_BANKS) {
    if (await BankRepository.findByCode(b.code)) skipped.banks.push(b.code);
    else created.banks.push((await BankService.createBank(b)).code);
  }
  const existingNames = (await UserRepository.all()).map((u) => str(u.name).toLowerCase());
  for (const p of DEFAULT_PICS) {
    if (existingNames.indexOf(p.name.toLowerCase()) !== -1) skipped.pics.push(p.name);
    else created.pics.push((await UserService.createUser(p)).name);
  }

  return { created, skipped };
}

async function getDatabaseStatus() {
  const tables = [];
  for (const t of TABLES) {
    let rows = 0;
    let exists = true;
    try { rows = (await readAll(t.name)).length; } catch (e) { exists = false; rows = 0; }
    tables.push({ name: t.name, exists, rows });
  }
  return { ready: !!env.databaseUrl(), environment: env.environment(), tables };
}

export const Setup = { seedMasterData, getDatabaseStatus };
