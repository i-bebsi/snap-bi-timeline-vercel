// services/task.js — task business logic (port dari TaskService.gs).

import { TaskRepository, BankRepository, ProjectRepository, UserRepository } from '../repositories.js';
import { AuthService } from '../auth.js';
import { CONFIG } from '../config.js';
import { str, toNum, toDateString, dayDiff, nowIso, assert } from '../lib/utils.js';
import { AuditService } from './audit.js';
import { DashboardStatsService } from './dashboardStats.js';
import { deleteAll } from '../lib/db.js';

const ENTITY = 'task';
let batchDepth = 0;

async function touchDashboard() {
  if (batchDepth > 0) return;
  try { await DashboardStatsService.recompute(); } catch (e) { /* abaikan */ }
}

async function batch(fn) {
  batchDepth++;
  try { return await fn(); } finally { batchDepth--; await touchDashboard(); }
}

function toPublic(row) {
  if (!row) return null;
  return {
    id: str(row.id),
    project_id: str(row.project_id),
    bank_id: str(row.bank_id),
    parent_id: str(row.parent_id),
    task_no: str(row.task_no),
    task_name: str(row.task_name),
    description: str(row.description),
    pic_id: str(row.pic_id),
    start_date: toDateString(row.start_date),
    end_date: toDateString(row.end_date),
    status: str(row.status),
    progress: toNum(row.progress, 0),
    weight: row.weight === '' || row.weight === null || row.weight === undefined
      ? null : toNum(row.weight),
    priority: str(row.priority),
    notes: str(row.notes),
    created_at: str(row.created_at),
    created_by: str(row.created_by),
    updated_at: str(row.updated_at),
    updated_by: str(row.updated_by),
    is_active: row.is_active === true,
  };
}

/* ---------------- validation ---------------- */

function validateDates(start, end) {
  const s = toDateString(start);
  const e = toDateString(end);
  assert(s, 'start_date wajib diisi');
  assert(e, 'end_date wajib diisi');
  assert(dayDiff(s, e) >= 0, 'end_date harus >= start_date (' + e + ' < ' + s + ')');
  return { start_date: s, end_date: e };
}

function validateStatus(status) {
  const s = str(status).toUpperCase();
  assert(CONFIG.ENUMS.TASK_STATUS.indexOf(s) !== -1,
    'Status task tidak valid: ' + status + ' (pilih ' + CONFIG.ENUMS.TASK_STATUS.join('/') + ')');
  return s;
}

function validateProgress(progress) {
  const n = toNum(progress, NaN);
  assert(!Number.isNaN(n), 'progress wajib berupa angka');
  assert(n >= CONFIG.PROGRESS.MIN && n <= CONFIG.PROGRESS.MAX,
    'progress harus antara ' + CONFIG.PROGRESS.MIN + ' dan ' + CONFIG.PROGRESS.MAX);
  return n;
}

function validatePriority(priority) {
  const p = str(priority).toUpperCase();
  if (!p) return '';
  assert(CONFIG.ENUMS.PRIORITY.indexOf(p) !== -1,
    'Priority tidak valid: ' + priority + ' (pilih ' + CONFIG.ENUMS.PRIORITY.join('/') + ')');
  return p;
}

async function validateProject(projectId) {
  const id = str(projectId);
  assert(id, 'project_id wajib diisi');
  const p = await ProjectRepository.findById(id);
  assert(p, 'Project tidak ditemukan: ' + id);
  assert(p.is_active === true, 'Project tidak aktif: ' + id);
  return id;
}

async function validatePic(picId) {
  const id = str(picId);
  assert(id, 'pic_id wajib diisi');
  const u = await UserRepository.findById(id);
  assert(u, 'PIC tidak ditemukan: ' + id);
  assert(u.active === true && u.is_pic === true, 'PIC tidak aktif atau bukan PIC: ' + id);
  return id;
}

async function validateBank(bankId) {
  const id = str(bankId);
  if (!id) return '';
  const b = await BankRepository.findById(id);
  assert(b, 'Bank tidak ditemukan: ' + id);
  assert(b.active === true, 'Bank tidak aktif: ' + id);
  return id;
}

async function validateParent(parentId, selfId) {
  const id = str(parentId);
  if (!id) return '';
  assert(id !== str(selfId), 'Task tidak boleh menjadi parent dari dirinya sendiri');
  const p = await TaskRepository.findById(id);
  assert(p, 'Parent task tidak ditemukan: ' + id);
  assert(p.is_active === true, 'Parent task tidak aktif: ' + id);
  if (selfId && await isDescendantOf(str(selfId), id)) {
    throw new Error('Circular hierarchy: task ini tidak bisa menjadi child dari descendant-nya sendiri');
  }
  return id;
}

async function isDescendantOf(ancestorId, nodeId) {
  let cur = str(nodeId);
  const seen = {};
  while (cur) {
    if (seen[cur]) return false;
    seen[cur] = true;
    if (cur === str(ancestorId)) return true;
    const node = await TaskRepository.findById(cur);
    if (!node) return false;
    cur = str(node.parent_id);
  }
  return false;
}

/* ---------------- read ---------------- */

async function getTasks(filter) {
  const f = filter || {};
  let rows = f.includeInactive ? await TaskRepository.all() : await TaskRepository.active();
  if (f.projectId) rows = rows.filter((t) => str(t.project_id) === str(f.projectId));
  if (f.bankId) rows = rows.filter((t) => str(t.bank_id) === str(f.bankId));
  if (f.status) rows = rows.filter((t) => str(t.status) === str(f.status).toUpperCase());
  if (f.parentId) rows = rows.filter((t) => str(t.parent_id) === str(f.parentId));
  if (f.search) {
    const q = str(f.search).toLowerCase();
    rows = rows.filter((t) =>
      str(t.task_name).toLowerCase().indexOf(q) !== -1 ||
      str(t.task_no).toLowerCase().indexOf(q) !== -1 ||
      str(t.description).toLowerCase().indexOf(q) !== -1);
  }
  rows.sort((a, b) => {
    const ds = str(a.start_date).localeCompare(str(b.start_date));
    if (ds !== 0) return ds;
    return str(a.task_no).localeCompare(str(b.task_no));
  });
  return rows.map(toPublic);
}

async function getTask(id) {
  const row = await TaskRepository.findById(id);
  assert(row, 'Task tidak ditemukan: ' + id);
  return toPublic(row);
}

/* ---------------- create ---------------- */

async function createTask(payload) {
  AuthService.require('CREATE');
  const p = payload || {};
  const email = AuthService.getActiveEmail();

  const taskName = str(p.task_name);
  assert(taskName, 'task_name wajib diisi');

  const projectId = await validateProject(p.project_id);
  const picId = await validatePic(p.pic_id);
  if (str(p.bank_id) === CONFIG.ALL_BANKS) {
    return createTaskAllBanks(p);
  }
  const bankId = await validateBank(p.bank_id);
  const parentId = await validateParent(p.parent_id, null);
  const status = validateStatus(p.status);
  const progress = validateProgress(p.progress === undefined ? 0 : p.progress);
  const priority = validatePriority(p.priority);
  const dates = validateDates(p.start_date, p.end_date);

  const id = await TaskRepository.nextId();
  const taskNo = str(p.task_no) || id;

  const row = {
    id,
    project_id: projectId,
    bank_id: bankId,
    parent_id: parentId,
    task_no: taskNo,
    task_name: taskName,
    description: str(p.description),
    pic_id: picId,
    start_date: dates.start_date,
    end_date: dates.end_date,
    status,
    progress,
    weight: p.weight === undefined || p.weight === null || p.weight === '' ? '' : toNum(p.weight),
    priority,
    notes: str(p.notes),
    created_at: nowIso(),
    created_by: email,
    updated_at: nowIso(),
    updated_by: email,
    is_active: true,
  };
  await TaskRepository.insert(row);
  await AuditService.log('CREATE', ENTITY, id, {
    task_name: row.task_name, bank_id: row.bank_id || 'GLOBAL', status: row.status,
  });
  await touchDashboard();
  return toPublic(row);
}

async function createTaskAllBanks(p) {
  AuthService.require('CREATE');
  const email = AuthService.getActiveEmail();
  assert(str(p.task_name), 'task_name wajib diisi');

  const projectId = await validateProject(p.project_id);
  const picId = await validatePic(p.pic_id);
  const parentId = await validateParent(p.parent_id, null);
  const status = validateStatus(p.status);
  const progress = validateProgress(p.progress === undefined ? 0 : p.progress);
  const priority = validatePriority(p.priority);
  const dates = validateDates(p.start_date, p.end_date);

  const banks = await BankRepository.active();
  assert(banks.length, 'Tidak ada bank aktif untuk task "Semua Bank"');

  const batchId = await TaskRepository.nextId();
  const base = str(p.task_no) || batchId;
  const created = [], taskNos = [];

  for (const b of banks) {
    const id = await TaskRepository.nextId();
    const row = {
      id,
      project_id: projectId,
      bank_id: b.id,
      parent_id: parentId,
      task_no: base + '-' + b.code,
      task_name: str(p.task_name),
      description: str(p.description),
      pic_id: picId,
      start_date: dates.start_date,
      end_date: dates.end_date,
      status,
      progress,
      weight: p.weight === undefined || p.weight === null || p.weight === '' ? '' : toNum(p.weight),
      priority,
      notes: str(p.notes),
      created_at: nowIso(),
      created_by: email,
      updated_at: nowIso(),
      updated_by: email,
      is_active: true,
    };
    await TaskRepository.insert(row);
    await AuditService.log('CREATE', ENTITY, id, { task_name: row.task_name, bank_id: b.id, status });
    created.push(row);
    taskNos.push(row.task_no);
  }

  await AuditService.log('BULK_CREATE', ENTITY, batchId, { mode: 'all_banks', count: created.length });
  await touchDashboard();
  return { allBanks: true, count: created.length, taskNos, tasks: created.map(toPublic) };
}

/* ---------------- update ---------------- */

async function updateTask(id, payload) {
  AuthService.require('UPDATE');
  const before = await TaskRepository.findById(id);
  assert(before, 'Task tidak ditemukan: ' + id);
  const p = payload || {};
  const patchObj = {};

  if (p.task_name !== undefined) {
    assert(str(p.task_name), 'task_name wajib diisi');
    patchObj.task_name = str(p.task_name);
  }
  if (p.task_no !== undefined) patchObj.task_no = str(p.task_no);
  if (p.description !== undefined) patchObj.description = str(p.description);
  if (p.notes !== undefined) patchObj.notes = str(p.notes);

  if (p.project_id !== undefined) patchObj.project_id = await validateProject(p.project_id);
  if (p.pic_id !== undefined) patchObj.pic_id = await validatePic(p.pic_id);
  if (p.bank_id !== undefined) patchObj.bank_id = await validateBank(p.bank_id);
  if (p.parent_id !== undefined) patchObj.parent_id = await validateParent(p.parent_id, id);

  if (p.status !== undefined) patchObj.status = validateStatus(p.status);
  if (p.progress !== undefined) patchObj.progress = validateProgress(p.progress);
  if (p.priority !== undefined) patchObj.priority = validatePriority(p.priority);
  if (p.weight !== undefined) {
    patchObj.weight = p.weight === null || p.weight === '' ? '' : toNum(p.weight);
  }

  if (p.start_date !== undefined || p.end_date !== undefined) {
    const s = p.start_date !== undefined ? p.start_date : before.start_date;
    const e = p.end_date !== undefined ? p.end_date : before.end_date;
    const dates = validateDates(s, e);
    patchObj.start_date = dates.start_date;
    patchObj.end_date = dates.end_date;
  }

  assert(Object.keys(patchObj).length, 'Tidak ada perubahan');
  patchObj.updated_at = nowIso();
  patchObj.updated_by = AuthService.getActiveEmail();

  const after = await TaskRepository.update(id, patchObj);
  await AuditService.logUpdate(ENTITY, id, before, after);
  await touchDashboard();
  return toPublic(after);
}

async function bulkUpdateTasks(ids, payload) {
  AuthService.require('UPDATE');
  assert(Array.isArray(ids) && ids.length, 'Pilih minimal 1 task');
  assert(ids.length <= 100, 'Maksimal 100 task per bulk edit');
  const p = payload || {};
  const hasStatus = p.status !== undefined && p.status !== '';
  const hasProgress = p.progress !== undefined && p.progress !== '';
  assert(hasStatus || hasProgress, 'Tentukan status atau progress yang ingin diubah');
  const newStatus = hasStatus ? validateStatus(p.status) : null;
  const newProgress = hasProgress ? validateProgress(p.progress) : null;

  return batch(async () => {
    let updated = 0;
    const skipped = [];
    for (const id of ids) {
      const t = await TaskRepository.findById(id);
      if (!t || t.is_active !== true) { skipped.push(str(id)); continue; }
      const patchObj = {};
      if (newStatus !== null && t.status !== newStatus) patchObj.status = newStatus;
      if (newProgress !== null && t.progress !== newProgress) patchObj.progress = newProgress;
      if (!Object.keys(patchObj).length) continue;
      patchObj.updated_at = nowIso();
      patchObj.updated_by = AuthService.getActiveEmail();
      const after = await TaskRepository.update(id, patchObj);
      await AuditService.logUpdate(ENTITY, id, t, after);
      updated++;
    }
    return { updated, skipped };
  });
}

/* ---------------- soft delete & clear ---------------- */

async function deactivateTask(id) {
  AuthService.require('DELETE');
  const before = await TaskRepository.findById(id);
  assert(before, 'Task tidak ditemukan: ' + id);
  const after = await TaskRepository.update(id, {
    is_active: false,
    updated_at: nowIso(),
    updated_by: AuthService.getActiveEmail(),
  });
  await AuditService.log('DELETE', ENTITY, id, { soft: true, task_name: before.task_name });
  await touchDashboard();
  return toPublic(after);
}

async function clearAllTasks() {
  AuthService.require('DELETE');
  const all = await TaskRepository.all();
  const activeBefore = all.filter((t) => t.is_active === true).length;
  const deleted = await deleteAll(CONFIG.SHEETS.TASKS);
  await AuditService.log('DELETE', ENTITY, '-', { clearAll: true, deleted, activeBefore });
  await touchDashboard();
  return { deleted, activeBefore };
}

export const TaskService = {
  getTasks,
  getTask,
  createTask,
  createTaskAllBanks,
  updateTask,
  bulkUpdateTasks,
  deactivateTask,
  clearAllTasks,
  batch,
  toPublic,
};
