// services/backup.js — daily backup strategy (port dari BackupService.gs).
// Trigger harian Apps Script tidak ada di Vercel; auto-backup diganti cron (Vercel Cron)
// yang memanggil endpoint /api/backup-now dengan token — lihat Fase 5/7.

import { TABLES } from '../schema.js';
import { CONFIG, env } from '../config.js';
import { str, toNum, nowIso, clone } from '../lib/utils.js';
import { readAll, findById, insert } from '../lib/db.js';

const TRIGGER_HANDLER = 'backupDaily_';

function snapshotTables() {
  return TABLES.map((t) => t.name).filter((n) => n !== CONFIG.SHEETS.BACKUPS);
}

async function snapshot() {
  const tables = {};
  let totalRows = 0;
  const tableNames = [];
  for (const name of snapshotTables()) {
    const rows = await readAll(name);
    const clean = rows.map((r) => { const o = clone(r); delete o.__row; return o; });
    tables[name] = clean;
    totalRows += clean.length;
    tableNames.push(name);
  }
  return { tables, totalRows, tableNames };
}

async function nextBackupId() {
  const iso = nowIso(); // yyyy-MM-ddTHH:mm:ss
  const base = 'BK' + iso.slice(0, 10).replace(/-/g, '') + '_' + iso.slice(11, 19).replace(/:/g, '');
  let id = base, n = 2;
  while (await findById(CONFIG.SHEETS.BACKUPS, id)) {
    id = base + '_' + n++;
  }
  return id;
}

async function runBackup(triggeredBy) {
  const snap = await snapshot();
  const ts = nowIso();
  const id = await nextBackupId();

  const row = {
    id,
    timestamp: ts,
    triggered_by: str(triggeredBy) || 'manual',
    environment: env.environment(),
    tables: snap.tableNames.join(','),
    total_rows: snap.totalRows,
    payload: JSON.stringify({
      meta: {
        backup_id: id,
        timestamp: ts,
        triggered_by: str(triggeredBy) || 'manual',
        environment: env.environment(),
      },
      tables: snap.tables,
    }),
  };
  await insert(CONFIG.SHEETS.BACKUPS, row);

  return {
    id,
    timestamp: ts,
    triggeredBy: row.triggered_by,
    environment: row.environment,
    tables: snap.tableNames,
    totalRows: snap.totalRows,
  };
}

async function listBackups() {
  const rows = await readAll(CONFIG.SHEETS.BACKUPS);
  return rows
    .map((r) => ({
      id: str(r.id),
      timestamp: str(r.timestamp),
      triggeredBy: str(r.triggered_by),
      environment: str(r.environment),
      tables: str(r.tables).split(',').filter((s) => s),
      totalRows: toNum(r.total_rows, 0),
    }))
    .sort((a, b) => (a.timestamp < b.timestamp ? 1 : -1));
}

async function getBackup(id) {
  const row = await findById(CONFIG.SHEETS.BACKUPS, id);
  if (!row) return null;
  let payload;
  try { payload = JSON.parse(str(row.payload)); } catch (e) { payload = null; }
  return {
    id: str(row.id),
    timestamp: str(row.timestamp),
    triggeredBy: str(row.triggered_by),
    environment: str(row.environment),
    totalRows: toNum(row.total_rows, 0),
    payload,
  };
}

async function status() {
  const backups = await listBackups();
  return {
    triggerHandler: TRIGGER_HANDLER,
    autoBackup: 'VERCEL_CRON',
    backupCount: backups.length,
    latest: backups.length ? backups[0] : null,
  };
}

export const BackupService = {
  runBackup,
  listBackups,
  getBackup,
  status,
  TRIGGER_HANDLER,
};
