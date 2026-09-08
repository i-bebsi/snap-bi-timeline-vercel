// services/user.js — user & PIC master (port dari UserService.gs).

import { UserRepository } from '../repositories.js';
import { AuthService } from '../auth.js';
import { CONFIG } from '../config.js';
import { str, toBool, nowIso, assert } from '../lib/utils.js';
import { AuditService } from './audit.js';

const ENTITY = 'user';

function toPublic(row) {
  if (!row) return null;
  return {
    id: str(row.id),
    email: str(row.email),
    name: str(row.name),
    role: str(row.role),
    is_pic: row.is_pic === true,
    active: row.active === true,
    created_at: str(row.created_at),
    updated_at: str(row.updated_at),
  };
}

async function getUsers(opts) {
  const includeInactive = !!(opts && opts.includeInactive);
  const rows = includeInactive ? await UserRepository.all() : await UserRepository.active();
  return rows.map(toPublic);
}

async function getPics() {
  const rows = await UserRepository.pics();
  return rows.map(toPublic);
}

async function getUser(id) {
  const row = await UserRepository.findById(id);
  assert(row, 'User tidak ditemukan: ' + id);
  return toPublic(row);
}

async function createUser(payload) {
  AuthService.require('CREATE');
  const p = payload || {};
  const name = str(p.name);
  assert(name, 'Nama user/PIC wajib diisi');

  const email = str(p.email).toLowerCase();
  if (email) {
    assert(email.indexOf('@') > 0, 'Format email tidak valid: ' + email);
    assert(!(await UserRepository.findByEmail(email)), 'Email sudah terdaftar: ' + email);
  }

  const role = str(p.role).toUpperCase() || CONFIG.DEFAULT_ROLE;
  assert(CONFIG.ENUMS.ROLE.indexOf(role) !== -1, 'Role tidak valid: ' + role);

  const id = await UserRepository.nextId();
  const row = {
    id,
    email,
    name,
    role,
    is_pic: p.is_pic === undefined ? true : toBool(p.is_pic),
    active: p.active === undefined ? true : toBool(p.active),
    created_at: nowIso(),
    updated_at: nowIso(),
  };
  await UserRepository.insert(row);
  await AuditService.log('CREATE', ENTITY, id, { name, email, role });
  return toPublic(row);
}

async function updateUser(id, payload) {
  AuthService.require('UPDATE');
  const before = await UserRepository.findById(id);
  assert(before, 'User tidak ditemukan: ' + id);
  const p = payload || {};
  const patchObj = {};

  if (p.name !== undefined) {
    assert(str(p.name), 'Nama user wajib diisi');
    patchObj.name = str(p.name);
  }
  if (p.email !== undefined) {
    const email = str(p.email).toLowerCase();
    if (email) {
      assert(email.indexOf('@') > 0, 'Format email tidak valid: ' + email);
      const dup = await UserRepository.findByEmail(email);
      assert(!dup || str(dup.id) === str(id), 'Email sudah terdaftar: ' + email);
    }
    patchObj.email = email;
  }
  if (p.role !== undefined) {
    const role = str(p.role).toUpperCase();
    assert(CONFIG.ENUMS.ROLE.indexOf(role) !== -1, 'Role tidak valid: ' + role);
    patchObj.role = role;
  }
  if (p.is_pic !== undefined) patchObj.is_pic = toBool(p.is_pic);
  if (p.active !== undefined) patchObj.active = toBool(p.active);

  assert(Object.keys(patchObj).length, 'Tidak ada perubahan');
  patchObj.updated_at = nowIso();

  const after = await UserRepository.update(id, patchObj);
  await AuditService.logUpdate(ENTITY, id, before, after);
  return toPublic(after);
}

async function deactivateUser(id) {
  AuthService.require('DELETE');
  const before = await UserRepository.findById(id);
  assert(before, 'User tidak ditemukan: ' + id);
  const after = await UserRepository.update(id, { active: false, updated_at: nowIso() });
  await AuditService.log('DELETE', ENTITY, id, { soft: true, name: before.name });
  return toPublic(after);
}

export const UserService = {
  getUsers,
  getPics,
  getUser,
  createUser,
  updateUser,
  deactivateUser,
  toPublic,
};
