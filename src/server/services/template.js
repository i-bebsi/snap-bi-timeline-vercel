// services/template.js — task template & bulk creation (port dari TemplateService.gs).

import { TemplateRepository, TaskRepository, BankRepository } from '../repositories.js';
import { AuthService } from '../auth.js';
import { CONFIG } from '../config.js';
import { str, toNum, toBool, todayIso, nowIso, assert } from '../lib/utils.js';
import { AuditService } from './audit.js';
import { TaskService } from './task.js';
import { ProjectService } from './project.js';
import { UserService } from './user.js';
import { update as dbUpdate } from '../lib/db.js';

const ENTITY = 'template';

function toPublic(row) {
  if (!row) return null;
  return {
    id: str(row.id),
    code: str(row.code),
    name: str(row.name),
    description: str(row.description),
    active: row.active === true,
    created_at: str(row.created_at),
    updated_at: str(row.updated_at),
  };
}

function itemToPublic(row) {
  if (!row) return null;
  return {
    id: str(row.id),
    template_id: str(row.template_id),
    seq: toNum(row.seq, 0),
    task_name: str(row.task_name),
    description: str(row.description),
    duration_days: toNum(row.duration_days, 1),
    priority: str(row.priority),
    parent_seq: row.parent_seq === '' || row.parent_seq === null || row.parent_seq === undefined
      ? null : toNum(row.parent_seq),
    active: row.active === true,
  };
}

function addDaysIso(isoStr, days) {
  const p = String(isoStr).split('-');
  const d = new Date(Date.UTC(Number(p[0]), Number(p[1]) - 1, Number(p[2])));
  d.setUTCDate(d.getUTCDate() + days);
  const m = d.getUTCMonth() + 1, dd = d.getUTCDate();
  return d.getUTCFullYear() + '-' + (m < 10 ? '0' : '') + m + '-' + (dd < 10 ? '0' : '') + dd;
}

function normalizeCode(code) {
  return str(code).toUpperCase().replace(/[^A-Z0-9]/g, '');
}

/* ---------------- read ---------------- */

async function getTemplates(opts) {
  const includeInactive = !!(opts && opts.includeInactive);
  const rows = includeInactive ? await TemplateRepository.all() : await TemplateRepository.active();
  const out = [];
  for (const r of rows) {
    const pub = toPublic(r);
    pub.itemCount = (await TemplateRepository.itemsOf(r.id)).length;
    out.push(pub);
  }
  return out;
}

async function getTemplate(id) {
  const row = await TemplateRepository.findById(id);
  assert(row, 'Template tidak ditemukan: ' + id);
  const pub = toPublic(row);
  pub.items = (await TemplateRepository.itemsOf(id)).map(itemToPublic);
  return pub;
}

/* ---------------- write ---------------- */

async function createTemplate(payload) {
  AuthService.require('CREATE');
  const p = payload || {};
  const code = normalizeCode(p.code);
  const name = str(p.name);
  assert(code, 'Code template wajib diisi');
  assert(name, 'Nama template wajib diisi');
  assert(!(await TemplateRepository.findByCode(code)), 'Code template sudah dipakai: ' + code);

  const id = await TemplateRepository.nextId();
  const row = {
    id,
    code,
    name,
    description: str(p.description),
    active: p.active === undefined ? true : toBool(p.active),
    created_at: nowIso(),
    updated_at: nowIso(),
  };
  await TemplateRepository.insert(row);
  await AuditService.log('CREATE', ENTITY, id, { code, name });

  const items = await saveItems(id, p.items);
  const pub = toPublic(row);
  pub.itemCount = items.length;
  return pub;
}

async function saveItems(templateId, items) {
  const existing = await TemplateRepository.itemsOf(templateId);
  for (const it of existing) {
    await dbUpdate(CONFIG.SHEETS.TEMPLATE_ITEMS, it.id, { active: false, updated_at: nowIso() });
  }
  const list = (items || []).map((it, i) => ({
    id: undefined, // diisi nextItemId per item
    template_id: templateId,
    seq: toNum(it.seq, i + 1),
    task_name: str(it.task_name),
    description: str(it.description),
    duration_days: toNum(it.duration_days, 1),
    priority: str(it.priority),
    parent_seq: it.parent_seq === undefined || it.parent_seq === null || it.parent_seq === ''
      ? '' : toNum(it.parent_seq),
    active: true,
  }));
  // nextItemId dipanggil per item agar id unik & deterministik
  for (const item of list) {
    item.id = await TemplateRepository.nextItemId();
  }
  if (list.length) await TemplateRepository.insertItems(list);
  return list.length;
}

async function updateTemplate(id, payload) {
  AuthService.require('UPDATE');
  const before = await TemplateRepository.findById(id);
  assert(before, 'Template tidak ditemukan: ' + id);
  const p = payload || {};
  const patchObj = {};

  if (p.code !== undefined) {
    const code = normalizeCode(p.code);
    assert(code, 'Code template wajib diisi');
    const dup = await TemplateRepository.findByCode(code);
    assert(!dup || str(dup.id) === str(id), 'Code template sudah dipakai: ' + code);
    patchObj.code = code;
  }
  if (p.name !== undefined) { assert(str(p.name), 'Nama template wajib diisi'); patchObj.name = str(p.name); }
  if (p.description !== undefined) patchObj.description = str(p.description);
  if (p.active !== undefined) patchObj.active = toBool(p.active);

  const items = p.items !== undefined ? p.items : undefined;

  if (Object.keys(patchObj).length) {
    patchObj.updated_at = nowIso();
    await TemplateRepository.update(id, patchObj);
  }

  let itemCount = null;
  if (items !== undefined) itemCount = await saveItems(id, items);

  const after = await TemplateRepository.findById(id);
  await AuditService.logUpdate(ENTITY, id, before, after);

  const pub = toPublic(after);
  pub.itemCount = itemCount !== null ? itemCount : (await TemplateRepository.itemsOf(id)).length;
  return pub;
}

async function deactivateTemplate(id) {
  AuthService.require('DELETE');
  const before = await TemplateRepository.findById(id);
  assert(before, 'Template tidak ditemukan: ' + id);
  const after = await TemplateRepository.update(id, { active: false, updated_at: nowIso() });
  await AuditService.log('DELETE', ENTITY, id, { soft: true, code: before.code });
  return toPublic(after);
}

/* ---------------- apply ---------------- */

async function applyTemplate(templateId, bankIds, picId) {
  AuthService.require('CREATE');
  const tpl = await TemplateRepository.findById(templateId);
  assert(tpl, 'Template tidak ditemukan: ' + templateId);
  assert(tpl.active === true, 'Template tidak aktif: ' + templateId);
  const items = await TemplateRepository.itemsOf(templateId);
  assert(items.length, 'Template tidak punya item. Isi item dulu.');

  const projects = await ProjectService.getProjects();
  const project = projects[0];
  assert(project, 'Tidak ada project aktif');

  const pics = await UserService.getPics();
  const usePicId = str(picId) || (pics.length ? pics[0].id : '');
  assert(usePicId, 'Tidak ada PIC tersedia');

  const banks = [];
  for (const bid of bankIds || []) {
    const b = await BankRepository.findById(bid);
    assert(b, 'Bank tidak ditemukan: ' + bid);
    assert(b.active === true, 'Bank tidak aktif: ' + bid);
    banks.push(b);
  }
  assert(banks.length, 'Pilih minimal satu bank');

  const base = todayIso();

  return TaskService.batch(async () => {
    const created = [], skipped = [];

    for (const bank of banks) {
      const seqToTaskId = {};
      let offsetDays = 0;
      for (const item of items) {
        const seq = toNum(item.seq, 0);
        const taskNo = str(tpl.code) + '-' + str(bank.code) + '-' + seq;

        if (await TaskRepository.findByTaskNo(taskNo)) { skipped.push(taskNo); continue; }

        let dur = toNum(item.duration_days, 1);
        if (dur < 1) dur = 1;
        const start = addDaysIso(base, offsetDays);
        const end = addDaysIso(base, offsetDays + dur - 1);
        offsetDays += dur;

        const parentId = item.parent_seq ? (seqToTaskId[toNum(item.parent_seq)] || '') : '';

        const task = await TaskService.createTask({
          task_no: taskNo,
          task_name: str(item.task_name),
          description: str(item.description),
          project_id: project.id,
          bank_id: bank.id,
          pic_id: usePicId,
          parent_id: parentId,
          start_date: start,
          end_date: end,
          status: 'TODO',
          progress: 0,
          priority: str(item.priority),
        });
        seqToTaskId[seq] = task.id;
        created.push(taskNo);
      }
    }

    await AuditService.log('BULK_CREATE', ENTITY, templateId, {
      template: tpl.code, banks: banks.length,
      created: created.length, skipped: skipped.length,
    });

    return {
      created: created.length,
      skipped: skipped.length,
      totalTasks: created.length + skipped.length,
      createdNos: created,
      skippedNos: skipped,
    };
  });
}

export const TemplateService = {
  getTemplates,
  getTemplate,
  createTemplate,
  updateTemplate,
  deactivateTemplate,
  applyTemplate,
  toPublic,
  itemToPublic,
};
