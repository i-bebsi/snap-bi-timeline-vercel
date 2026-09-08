// services/dashboardStats.js — snapshot agregat dashboard (port dari DashboardStatsService.gs).

import { DashboardStatsRepository } from '../repositories.js';
import { ProgressService } from './progress.js';
import { AuthService } from '../auth.js';
import { str, nowIso } from '../lib/utils.js';

let _last = null;

async function recompute() {
  let email = '';
  try { email = AuthService.getActiveEmail(); } catch (e) { email = ''; }
  const snap = await ProgressService.dashboard();
  snap.computedAt = nowIso();
  snap.computedBy = email;
  snap.source = 'snapshot';
  await DashboardStatsRepository.save(snap, email);
  _last = snap;
  return snap;
}

async function get() {
  if (_last) return _last;
  const row = await DashboardStatsRepository.getCurrent();
  if (!row) return recompute();
  let payload = null;
  try { payload = JSON.parse(str(row.payload)); } catch (e) { payload = null; }
  if (!payload || typeof payload.overall !== 'number') return recompute();
  return payload;
}

export const DashboardStatsService = { recompute, get };
