// config.js — centralized configuration (port dari Config.gs).
// Spreadsheet ID / Script Properties sudah tidak relevan; koneksi DB lewat env.

import 'dotenv/config';

export const CONFIG = {
  APP_NAME: 'SNAP BI Timeline',
  APP_VERSION: '1.0.1',
  TIMEZONE: 'Asia/Jakarta',

  /** Nama tabel (port dari CONFIG.SHEETS). */
  SHEETS: {
    PROJECTS: 'projects',
    BANKS: 'banks',
    TASKS: 'tasks',
    USERS: 'users',
    AUDIT_LOGS: 'audit_logs',
    TEMPLATES: 'task_templates',
    TEMPLATE_ITEMS: 'task_template_items',
    CONFIG: 'config',
    BACKUPS: 'backups',
    DASHBOARD_STATS: 'dashboard_stats',
  },

  /** Domain enums — disimpan raw, diterjemahkan hanya di UI. */
  ENUMS: {
    TASK_STATUS: ['TODO', 'IN_PROGRESS', 'BLOCKED', 'DONE', 'CANCELLED'],
    PROJECT_STATUS: ['PLANNING', 'ACTIVE', 'ON_HOLD', 'DONE', 'CANCELLED'],
    PRIORITY: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'],
    ROLE: ['ADMIN', 'EDITOR', 'VIEWER'],
    HEALTH: ['ON_TRACK', 'AT_RISK', 'DELAYED'],
    AUDIT_ACTION: [
      'CREATE', 'UPDATE', 'DELETE',
      'STATUS_CHANGE', 'PROGRESS_CHANGE', 'BANK_CHANGE',
      'BULK_CREATE',
    ],
  },

  /** Progress rules. */
  PROGRESS: { MIN: 0, MAX: 100, DECIMALS: 2 },

  /** Bank health thresholds (BANK-005) — configuration, bukan hardcode. */
  HEALTH_THRESHOLD: { ON_TRACK_MIN: 70, AT_RISK_MIN: 40 },

  /** Role default untuk pengunjung yang belum terdaftar. */
  DEFAULT_ROLE: 'VIEWER',

  /** Sentinel bank_id: buat 1 task per bank aktif. */
  ALL_BANKS: '__ALL__',

  /** Role → permission matrix (SEC-002). */
  PERMISSIONS: {
    ADMIN: ['READ', 'CREATE', 'UPDATE', 'DELETE', 'CONFIGURE'],
    EDITOR: ['READ', 'CREATE', 'UPDATE', 'DELETE'],
    VIEWER: ['READ'],
  },

  /** Role → menu sidebar. */
  MENU_ACCESS: {
    ADMIN: ['dashboard', 'timeline', 'tasks', 'templates', 'banks', 'projects', 'settings'],
    EDITOR: ['dashboard', 'timeline', 'tasks', 'templates', 'banks', 'projects', 'settings'],
    VIEWER: ['dashboard', 'timeline'],
  },

  /** Timeline view modes (T-001). */
  TIMELINE_VIEWS: ['DAY', 'WEEK', 'MONTH', 'QUARTER'],

  /** ID prefixes. */
  ID_PREFIX: {
    PROJECT: 'PRJ',
    BANK: 'BANK',
    TASK: 'T',
    USER: 'USR',
    TEMPLATE: 'TPL',
    TEMPLATE_ITEM: 'TPI',
    AUDIT: 'LOG',
  },
};

/** Baca env var, fallback bila kosong. */
export function getEnv(name, fallback = '') {
  const v = process.env[name];
  return v === undefined || v === '' ? fallback : v;
}

export const env = {
  databaseUrl: () => getEnv('DATABASE_URL'),
  jwtSecret: () => getEnv('JWT_SECRET'),
  adminEmail: () => getEnv('ADMIN_EMAIL').toLowerCase(),
  adminPasswordHash: () => getEnv('ADMIN_PASSWORD_HASH'),
  environment: () => getEnv('ENVIRONMENT') || getEnv('VERCEL_ENV') || 'DEV',
};
