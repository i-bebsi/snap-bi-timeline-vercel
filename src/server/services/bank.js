// services/bank.js — bank master business logic (port dari BankService.gs).

import { BankRepository } from '../repositories.js';
import { AuthService } from '../auth.js';
import { str, toNum, toBool, nowIso, assert } from '../lib/utils.js';
import { AuditService } from './audit.js';

const ENTITY = 'bank';

function normalizeCode(code) {
  return str(code).toUpperCase().replace(/\s+/g, '');
}

function toPublic(row) {
  if (!row) return null;
  return {
    id: str(row.id),
    code: str(row.code),
    name: str(row.name),
    short_name: str(row.short_name),
    active: row.active === true,
    sort_order: toNum(row.sort_order, 0),
    created_at: str(row.created_at),
    updated_at: str(row.updated_at),
  };
}

async function getBanks(opts) {
  const includeInactive = !!(opts && opts.includeInactive);
  const rows = includeInactive ? await BankRepository.all() : await BankRepository.active();
  return rows.map(toPublic);
}

async function getBank(id) {
  const row = await BankRepository.findById(id);
  assert(row, 'Bank tidak ditemukan: ' + id);
  return toPublic(row);
}

async function createBank(payload) {
  AuthService.require('CREATE');
  const p = payload || {};
  const code = normalizeCode(p.code);
  const name = str(p.name);

  assert(code, 'Code bank wajib diisi');
  assert(name, 'Nama bank wajib diisi');
  assert(!(await BankRepository.findByCode(code)), 'Code bank sudah dipakai: ' + code);

  const id = await BankRepository.nextId();
  assert(!(await BankRepository.findById(id)), 'ID bank sudah dipakai: ' + id);

  const row = {
    id,
    code,
    name,
    short_name: str(p.short_name) || name,
    active: p.active === undefined ? true : toBool(p.active),
    sort_order: (p.sort_order === undefined || p.sort_order === null || p.sort_order === '')
      ? (await BankRepository.maxSortOrder()) + 1
      : toNum(p.sort_order),
    created_at: nowIso(),
    updated_at: nowIso(),
  };
  await BankRepository.insert(row);
  await AuditService.log('CREATE', ENTITY, id, { code: row.code, name: row.name });
  return toPublic(row);
}

async function updateBank(id, payload) {
  AuthService.require('UPDATE');
  const before = await BankRepository.findById(id);
  assert(before, 'Bank tidak ditemukan: ' + id);
  const p = payload || {};
  const patchObj = {};

  if (p.code !== undefined) {
    const code = normalizeCode(p.code);
    assert(code, 'Code bank wajib diisi');
    const dup = await BankRepository.findByCode(code);
    assert(!dup || str(dup.id) === str(id), 'Code bank sudah dipakai: ' + code);
    patchObj.code = code;
  }
  if (p.name !== undefined) {
    assert(str(p.name), 'Nama bank wajib diisi');
    patchObj.name = str(p.name);
  }
  if (p.short_name !== undefined) patchObj.short_name = str(p.short_name);
  if (p.sort_order !== undefined && p.sort_order !== '') patchObj.sort_order = toNum(p.sort_order);
  if (p.active !== undefined) patchObj.active = toBool(p.active);

  assert(Object.keys(patchObj).length, 'Tidak ada perubahan');
  patchObj.updated_at = nowIso();

  const after = await BankRepository.update(id, patchObj);
  await AuditService.logUpdate(ENTITY, id, before, after);
  return toPublic(after);
}

async function deactivateBank(id) {
  AuthService.require('DELETE');
  const before = await BankRepository.findById(id);
  assert(before, 'Bank tidak ditemukan: ' + id);
  const after = await BankRepository.update(id, { active: false, updated_at: nowIso() });
  await AuditService.log('DELETE', ENTITY, id, { soft: true, code: before.code });
  return toPublic(after);
}

async function activateBank(id) {
  AuthService.require('UPDATE');
  const before = await BankRepository.findById(id);
  assert(before, 'Bank tidak ditemukan: ' + id);
  const after = await BankRepository.update(id, { active: true, updated_at: nowIso() });
  await AuditService.logUpdate(ENTITY, id, before, after);
  return toPublic(after);
}

export const BankService = {
  getBanks,
  getBank,
  createBank,
  updateBank,
  deactivateBank,
  activateBank,
  toPublic,
};
