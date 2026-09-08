// services/project.js — project master business logic (port dari ProjectService.gs).

import { ProjectRepository } from '../repositories.js';
import { AuthService } from '../auth.js';
import { CONFIG } from '../config.js';
import { str, toBool, toDateString, dayDiff, nowIso, assert } from '../lib/utils.js';
import { AuditService } from './audit.js';

const ENTITY = 'project';

function toPublic(row) {
  if (!row) return null;
  return {
    id: str(row.id),
    code: str(row.code),
    name: str(row.name),
    description: str(row.description),
    start_date: toDateString(row.start_date),
    end_date: toDateString(row.end_date),
    status: str(row.status),
    is_active: row.is_active === true,
    created_at: str(row.created_at),
    updated_at: str(row.updated_at),
  };
}

function validateDates(start, end) {
  const s = toDateString(start);
  const e = toDateString(end);
  if (s && e) assert(dayDiff(s, e) >= 0, 'end_date harus >= start_date');
  return { start_date: s, end_date: e };
}

async function getProjects(opts) {
  const includeInactive = !!(opts && opts.includeInactive);
  const rows = includeInactive ? await ProjectRepository.all() : await ProjectRepository.active();
  return rows.map(toPublic);
}

async function getProject(id) {
  const row = await ProjectRepository.findById(id);
  assert(row, 'Project tidak ditemukan: ' + id);
  return toPublic(row);
}

async function createProject(payload) {
  AuthService.require('CREATE');
  const p = payload || {};
  const code = str(p.code).toUpperCase().replace(/\s+/g, '');
  const name = str(p.name);
  assert(code, 'Code project wajib diisi');
  assert(name, 'Nama project wajib diisi');
  assert(!(await ProjectRepository.findByCode(code)), 'Code project sudah dipakai: ' + code);

  const status = str(p.status).toUpperCase() || 'ACTIVE';
  assert(CONFIG.ENUMS.PROJECT_STATUS.indexOf(status) !== -1,
    'Status project tidak valid: ' + status + ' (pilih ' + CONFIG.ENUMS.PROJECT_STATUS.join('/') + ')');

  const dates = validateDates(p.start_date, p.end_date);
  const id = await ProjectRepository.nextId();

  const row = {
    id,
    code,
    name,
    description: str(p.description),
    start_date: dates.start_date,
    end_date: dates.end_date,
    status,
    created_at: nowIso(),
    updated_at: nowIso(),
    is_active: p.is_active === undefined ? true : toBool(p.is_active),
  };
  await ProjectRepository.insert(row);
  await AuditService.log('CREATE', ENTITY, id, { code, name });
  return toPublic(row);
}

async function updateProject(id, payload) {
  AuthService.require('UPDATE');
  const before = await ProjectRepository.findById(id);
  assert(before, 'Project tidak ditemukan: ' + id);
  const p = payload || {};
  const patchObj = {};

  if (p.code !== undefined) {
    const code = str(p.code).toUpperCase().replace(/\s+/g, '');
    assert(code, 'Code project wajib diisi');
    const dup = await ProjectRepository.findByCode(code);
    assert(!dup || str(dup.id) === str(id), 'Code project sudah dipakai: ' + code);
    patchObj.code = code;
  }
  if (p.name !== undefined) {
    assert(str(p.name), 'Nama project wajib diisi');
    patchObj.name = str(p.name);
  }
  if (p.description !== undefined) patchObj.description = str(p.description);
  if (p.status !== undefined) {
    const status = str(p.status).toUpperCase();
    assert(CONFIG.ENUMS.PROJECT_STATUS.indexOf(status) !== -1, 'Status project tidak valid: ' + status);
    patchObj.status = status;
  }
  if (p.start_date !== undefined || p.end_date !== undefined) {
    const s = p.start_date !== undefined ? p.start_date : before.start_date;
    const e = p.end_date !== undefined ? p.end_date : before.end_date;
    const dates = validateDates(s, e);
    patchObj.start_date = dates.start_date;
    patchObj.end_date = dates.end_date;
  }
  if (p.is_active !== undefined) patchObj.is_active = toBool(p.is_active);

  assert(Object.keys(patchObj).length, 'Tidak ada perubahan');
  patchObj.updated_at = nowIso();

  const after = await ProjectRepository.update(id, patchObj);
  await AuditService.logUpdate(ENTITY, id, before, after);
  return toPublic(after);
}

async function deactivateProject(id) {
  AuthService.require('DELETE');
  const before = await ProjectRepository.findById(id);
  assert(before, 'Project tidak ditemukan: ' + id);
  const after = await ProjectRepository.update(id, { is_active: false, updated_at: nowIso() });
  await AuditService.log('DELETE', ENTITY, id, { soft: true, code: before.code });
  return toPublic(after);
}

export const ProjectService = {
  getProjects,
  getProject,
  createProject,
  updateProject,
  deactivateProject,
  toPublic,
};
