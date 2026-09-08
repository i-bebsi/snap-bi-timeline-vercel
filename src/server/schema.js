// schema.js — daftar tabel (port dari Schema.gs) untuk db.js (idField/idPrefix).

export const TABLES = [
  { name: 'projects', idField: 'id', idPrefix: 'PRJ' },
  { name: 'banks', idField: 'id', idPrefix: 'BANK' },
  { name: 'tasks', idField: 'id', idPrefix: 'T' },
  { name: 'users', idField: 'id', idPrefix: 'USR' },
  { name: 'audit_logs', idField: 'id', idPrefix: 'LOG' },
  { name: 'task_templates', idField: 'id', idPrefix: 'TPL' },
  { name: 'task_template_items', idField: 'id', idPrefix: 'TPI' },
  { name: 'config', idField: 'key', idPrefix: null },
  { name: 'backups', idField: 'id', idPrefix: null },
  { name: 'dashboard_stats', idField: 'id', idPrefix: null },
];

export function table(name) {
  return TABLES.find((t) => t.name === name);
}

/** Kolom bertipe numerik per tabel (double precision) — untuk normalisasi '' -> NULL. */
export const NUMERIC_COLUMNS = {
  projects: [],
  banks: ['sort_order'],
  tasks: ['progress', 'weight'],
  users: [],
  audit_logs: [],
  task_templates: [],
  task_template_items: ['seq', 'duration_days', 'parent_seq'],
  config: [],
  backups: ['total_rows'],
  dashboard_stats: [],
};

/** Baris config yang di-seed saat provisioning (port SCHEMA.DEFAULT_CONFIG_ROWS). */
export const DEFAULT_CONFIG_ROWS = [
  { key: 'HEALTH_ON_TRACK_MIN', value: '70', type: 'number', description: 'Bank progress >= nilai ini dianggap ON_TRACK (%)' },
  { key: 'HEALTH_AT_RISK_MIN', value: '40', type: 'number', description: 'Bank progress >= nilai ini (dan < ON_TRACK) dianggap AT_RISK (%)' },
  { key: 'PROGRESS_DECIMALS', value: '2', type: 'number', description: 'Jumlah desimal pembulatan progress' },
  { key: 'DEFAULT_ROLE', value: 'VIEWER', type: 'string', description: 'Role default untuk user yang belum terdaftar' },
  { key: 'BANK_FILTER_INCLUDE_GLOBAL', value: 'TRUE', type: 'boolean', description: 'Filter bank juga menampilkan global task' },
];
