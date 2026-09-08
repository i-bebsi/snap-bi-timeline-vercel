// services/progress.js — progress & bank health (port dari ProgressService.gs).

import { TaskRepository, BankRepository } from '../repositories.js';
import { CONFIG } from '../config.js';
import { str, toNum, toDateString, todayIso, roundProgress } from '../lib/utils.js';
import { configValue } from '../lib/db.js';

function activeTasks() {
  return TaskRepository.active();
}

function progressValue(t) {
  return str(t.status).toUpperCase() === 'DONE'
    ? CONFIG.PROGRESS.MAX
    : toNum(t.progress, 0);
}

function avg(list) {
  if (!list.length) return 0;
  const sum = list.reduce((s, t) => s + progressValue(t), 0);
  return roundProgress(sum / list.length);
}

async function overall() {
  return avg(await activeTasks());
}

async function forBank(bankId) {
  const id = str(bankId);
  return avg((await activeTasks()).filter((t) => str(t.bank_id) === id));
}

async function taskCountFor(bankId) {
  const id = str(bankId);
  return (await activeTasks()).filter((t) => str(t.bank_id) === id).length;
}

async function doneCountFor(bankId) {
  const id = str(bankId);
  return (await activeTasks()).filter((t) => str(t.bank_id) === id && str(t.status) === 'DONE').length;
}

async function health(progress) {
  const p = toNum(progress, 0);
  const onTrack = await configValue('HEALTH_ON_TRACK_MIN', CONFIG.HEALTH_THRESHOLD.ON_TRACK_MIN);
  const atRisk = await configValue('HEALTH_AT_RISK_MIN', CONFIG.HEALTH_THRESHOLD.AT_RISK_MIN);
  if (p >= onTrack) return 'ON_TRACK';
  if (p >= atRisk) return 'AT_RISK';
  return 'DELAYED';
}

function isCurrent(task, today) {
  const s = str(task.start_date);
  const e = str(task.end_date);
  if (!s && !e) return true;
  if (s && e) return s <= today && today <= e;
  if (s) return s <= today;
  return today <= e;
}

function isOverdue(task) {
  const s = str(task.status).toUpperCase();
  if (s === 'DONE' || s === 'CANCELLED') return false;
  const end = toDateString(task.end_date);
  if (!end) return false;
  return end < todayIso();
}

async function computeAll() {
  const all = await activeTasks();
  const banks = await BankRepository.active();
  const today = todayIso();

  const counts = {};
  CONFIG.ENUMS.TASK_STATUS.forEach((s) => { counts[s] = 0; });
  let overdue = 0, overallSum = 0, overallCount = 0;

  const stats = {};
  banks.forEach((b) => { stats[str(b.id)] = { sum: 0, count: 0, done: 0, curCount: 0 }; });

  all.forEach((t) => {
    const s = str(t.status).toUpperCase();
    if (counts[s] !== undefined) counts[s]++;
    if (isOverdue(t)) overdue++;
    const val = progressValue(t);
    overallSum += val;
    overallCount++;
    const st = stats[str(t.bank_id)];
    if (st) {
      st.sum += val;
      st.count++;
      if (s === 'DONE') st.done++;
      if (isCurrent(t, today)) st.curCount++;
    }
  });

  const bankRows = [];
  for (const b of banks) {
    const st = stats[str(b.id)];
    const p = st && st.count ? roundProgress(st.sum / st.count) : 0;
    bankRows.push({
      id: str(b.id),
      code: str(b.code),
      name: str(b.name),
      short_name: str(b.short_name),
      progress: p,
      health: await health(p),
      taskCount: st ? st.count : 0,
      doneCount: st ? st.done : 0,
      currentCount: st ? st.curCount : 0,
    });
  }

  return {
    overall: roundProgress(overallCount ? overallSum / overallCount : 0),
    overallTaskCount: all.length,
    statusCounts: counts,
    overdueCount: overdue,
    banks: bankRows,
  };
}

async function summary() {
  const a = await computeAll();
  return { overall: a.overall, overallTaskCount: a.overallTaskCount, banks: a.banks };
}

async function statusCounts() {
  const counts = {};
  CONFIG.ENUMS.TASK_STATUS.forEach((s) => { counts[s] = 0; });
  (await activeTasks()).forEach((t) => {
    const s = str(t.status).toUpperCase();
    if (counts[s] !== undefined) counts[s]++;
  });
  return counts;
}

async function overdueCount() {
  return (await activeTasks()).filter(isOverdue).length;
}

async function dashboard() {
  const a = await computeAll();
  const banksWithTasks = a.banks.filter((b) => b.taskCount > 0);

  let mostAdvanced = null, mostDelayed = null;
  banksWithTasks.forEach((b) => {
    if (!mostAdvanced || b.progress > mostAdvanced.progress) mostAdvanced = b;
    if (!mostDelayed || b.progress < mostDelayed.progress) mostDelayed = b;
  });

  return {
    overall: a.overall,
    totalBanks: a.banks.length,
    totalTasks: a.overallTaskCount,
    statusCounts: a.statusCounts,
    overdueCount: a.overdueCount,
    mostAdvanced: mostAdvanced
      ? { name: mostAdvanced.name, progress: mostAdvanced.progress, health: mostAdvanced.health }
      : null,
    mostDelayed: mostDelayed
      ? { name: mostDelayed.name, progress: mostDelayed.progress, health: mostDelayed.health }
      : null,
    banks: a.banks,
  };
}

export const ProgressService = {
  overall,
  forBank,
  health,
  summary,
  isOverdue,
  statusCounts,
  overdueCount,
  dashboard,
};
