// services/audit.js — mutation audit trail (port dari AuditService.gs).

import { AuditRepository } from '../repositories.js';
import { AuthService } from '../auth.js';
import { CONFIG } from '../config.js';
import { str, nowIso, uid } from '../lib/utils.js';

function log(action, entity, entityId, detail) {
  if (CONFIG.ENUMS.AUDIT_ACTION.indexOf(action) === -1) {
    throw new Error('Invalid audit action: ' + action);
  }
  const user = AuthService.getActiveEmail() || 'system';
  let text = detail === null || detail === undefined
    ? ''
    : (typeof detail === 'string' ? detail : JSON.stringify(detail));
  if (text.length > 45000) text = text.substring(0, 45000) + '…';

  return AuditRepository.insert({
    id: CONFIG.ID_PREFIX.AUDIT + uid(),
    timestamp: nowIso(),
    user,
    action,
    entity,
    entity_id: str(entityId),
    detail: text,
  });
}

function logUpdate(entity, entityId, before, after) {
  const changes = {};
  Object.keys(after || {}).forEach((k) => {
    if (k.indexOf('__') === 0) return;
    const b = before ? before[k] : undefined;
    if (String(b) !== String(after[k])) changes[k] = { from: b, to: after[k] };
  });

  const logged = [];
  if (Object.keys(changes).length) {
    log('UPDATE', entity, entityId, changes);
    logged.push('UPDATE');
  }
  if (changes.status) { log('STATUS_CHANGE', entity, entityId, changes.status); logged.push('STATUS_CHANGE'); }
  if (changes.progress) { log('PROGRESS_CHANGE', entity, entityId, changes.progress); logged.push('PROGRESS_CHANGE'); }
  if (changes.bank_id) { log('BANK_CHANGE', entity, entityId, changes.bank_id); logged.push('BANK_CHANGE'); }
  return logged;
}

export const AuditService = { log, logUpdate };
