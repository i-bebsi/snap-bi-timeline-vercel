// repositories.js — entity repositories (port dari Repositories.gs).
// Data layer only, tanpa business rules.

import { readAll, findById, findWhere, generateId, insert, insertMany, update } from './lib/db.js';
import { str, toNum, nowIso } from './lib/utils.js';
import { CONFIG } from './config.js';

const T = CONFIG.SHEETS;

export const BankRepository = {
  async all() {
    const rows = await readAll(T.BANKS);
    return rows.sort((a, b) => toNum(a.sort_order, 0) - toNum(b.sort_order, 0));
  },
  async active() {
    const rows = await this.all();
    return rows.filter((b) => b.active === true);
  },
  findById: (id) => findById(T.BANKS, id),
  async findByCode(code) {
    const target = str(code).toUpperCase();
    const found = await findWhere(T.BANKS, (b) => str(b.code).toUpperCase() === target);
    return found.length ? found[0] : null;
  },
  nextId: () => generateId(T.BANKS, 3),
  insert: (obj) => insert(T.BANKS, obj),
  update: (id, patchObj) => update(T.BANKS, id, patchObj),
  async maxSortOrder() {
    const rows = await this.all();
    return rows.reduce((m, b) => Math.max(m, toNum(b.sort_order, 0)), 0);
  },
};

export const ProjectRepository = {
  all: () => readAll(T.PROJECTS),
  async active() {
    const rows = await readAll(T.PROJECTS);
    return rows.filter((p) => p.is_active === true);
  },
  findById: (id) => findById(T.PROJECTS, id),
  async findByCode(code) {
    const target = str(code).toUpperCase();
    const found = await findWhere(T.PROJECTS, (p) => str(p.code).toUpperCase() === target);
    return found.length ? found[0] : null;
  },
  nextId: () => generateId(T.PROJECTS, 3),
  insert: (obj) => insert(T.PROJECTS, obj),
  update: (id, patchObj) => update(T.PROJECTS, id, patchObj),
};

export const DashboardStatsRepository = {
  getCurrent: () => findById(T.DASHBOARD_STATS, 'CURRENT'),
  async save(payload, computedBy) {
    const row = {
      id: 'CURRENT',
      payload: JSON.stringify(payload),
      computed_at: nowIso(),
      computed_by: str(computedBy),
    };
    const existing = await findById(T.DASHBOARD_STATS, 'CURRENT');
    if (existing) {
      return update(T.DASHBOARD_STATS, 'CURRENT', {
        payload: row.payload,
        computed_at: row.computed_at,
        computed_by: row.computed_by,
      });
    }
    return insert(T.DASHBOARD_STATS, row);
  },
};

export const UserRepository = {
  all: () => readAll(T.USERS),
  async active() {
    const rows = await readAll(T.USERS);
    return rows.filter((u) => u.active === true);
  },
  async pics() {
    const rows = await readAll(T.USERS);
    return rows.filter((u) => u.active === true && u.is_pic === true);
  },
  findById: (id) => findById(T.USERS, id),
  async findByEmail(email) {
    const target = str(email).toLowerCase();
    if (!target) return null;
    const found = await findWhere(T.USERS, (u) => str(u.email).toLowerCase() === target);
    return found.length ? found[0] : null;
  },
  nextId: () => generateId(T.USERS, 3),
  insert: (obj) => insert(T.USERS, obj),
  update: (id, patchObj) => update(T.USERS, id, patchObj),
};

export const TaskRepository = {
  all: () => readAll(T.TASKS),
  async active() {
    const rows = await readAll(T.TASKS);
    return rows.filter((t) => t.is_active === true);
  },
  findById: (id) => findById(T.TASKS, id),
  async findByTaskNo(taskNo) {
    const target = str(taskNo);
    if (!target) return null;
    const found = await findWhere(T.TASKS, (t) => str(t.task_no) === target);
    return found.length ? found[0] : null;
  },
  async childrenOf(parentId) {
    const target = str(parentId);
    return findWhere(T.TASKS, (t) => str(t.parent_id) === target);
  },
  nextId: () => generateId(T.TASKS, 4),
  insert: (obj) => insert(T.TASKS, obj),
  insertMany: (objs) => insertMany(T.TASKS, objs),
  update: (id, patchObj) => update(T.TASKS, id, patchObj),
};

export const TemplateRepository = {
  all: () => readAll(T.TEMPLATES),
  async active() {
    const rows = await readAll(T.TEMPLATES);
    return rows.filter((t) => t.active === true);
  },
  findById: (id) => findById(T.TEMPLATES, id),
  async findByCode(code) {
    const target = str(code).toUpperCase();
    const found = await findWhere(T.TEMPLATES, (t) => str(t.code).toUpperCase() === target);
    return found.length ? found[0] : null;
  },
  nextId: () => generateId(T.TEMPLATES, 3),
  insert: (obj) => insert(T.TEMPLATES, obj),
  update: (id, patchObj) => update(T.TEMPLATES, id, patchObj),
  async itemsOf(templateId) {
    const target = str(templateId);
    const rows = await findWhere(
      T.TEMPLATE_ITEMS,
      (it) => str(it.template_id) === target && it.active === true
    );
    return rows.sort((a, b) => toNum(a.seq) - toNum(b.seq));
  },
  nextItemId: () => generateId(T.TEMPLATE_ITEMS, 4),
  insertItems: (objs) => insertMany(T.TEMPLATE_ITEMS, objs),
};

export const AuditRepository = {
  all: () => readAll(T.AUDIT_LOGS),
  async recent(limit = 50) {
    const rows = await readAll(T.AUDIT_LOGS);
    rows.sort((a, b) => str(b.timestamp).localeCompare(str(a.timestamp)));
    return rows.slice(0, limit);
  },
  insert: (obj) => insert(T.AUDIT_LOGS, obj),
};
