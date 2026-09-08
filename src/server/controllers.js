// controllers.js — lapisan controller (port dari Code.gs `api_*`), tanpa test runner.
// Setiap controller mengembalikan envelope {ok, data, error} persis seperti versi GAS.

import { CONFIG, env } from './config.js';
import { envelope, nowIso, todayIso, toNum, assert } from './lib/utils.js';
import { AuthService } from './auth.js';
import { BankService } from './services/bank.js';
import { ProjectService } from './services/project.js';
import { TemplateService } from './services/template.js';
import { TaskService } from './services/task.js';
import { UserService } from './services/user.js';
import { ProgressService } from './services/progress.js';
import { DashboardStatsService } from './services/dashboardStats.js';
import { BackupService } from './services/backup.js';
import { Setup } from './services/setup.js';
import { AuditRepository } from './repositories.js';

function menuForRole(role) {
  const r = String(role).toUpperCase();
  return CONFIG.MENU_ACCESS[r] || CONFIG.MENU_ACCESS[CONFIG.DEFAULT_ROLE] || CONFIG.MENU_ACCESS.VIEWER;
}

export const controllers = {
  getAppInfo: () => envelope('getAppInfo', async () => {
    const user = AuthService.getCurrentUser();
    return {
      appName: CONFIG.APP_NAME,
      appVersion: CONFIG.APP_VERSION,
      environment: env.environment(),
      timezone: CONFIG.TIMEZONE,
      serverTime: nowIso(),
      today: todayIso(),
      databaseReady: !!env.databaseUrl(),
      user,
      menu: menuForRole(user.role),
      enums: CONFIG.ENUMS,
      healthThreshold: CONFIG.HEALTH_THRESHOLD,
      timelineViews: CONFIG.TIMELINE_VIEWS,
    };
  }),

  getBootstrapData: () => envelope('getBootstrapData', async () => {
    if (!env.databaseUrl()) return { databaseReady: false, banks: [], projects: [], pics: [] };
    return {
      databaseReady: true,
      banks: await BankService.getBanks(),
      projects: await ProjectService.getProjects(),
      pics: await UserService.getPics(),
    };
  }),

  getDashboard: () => envelope('getDashboard', async () => {
    if (!env.databaseUrl()) {
      return { overall: 0, totalBanks: 0, totalTasks: 0, statusCounts: {}, overdueCount: 0, mostAdvanced: null, mostDelayed: null, banks: [] };
    }
    return DashboardStatsService.get();
  }),

  getProgress: () => envelope('getProgress', async () => {
    if (!env.databaseUrl()) return { overall: 0, overallTaskCount: 0, banks: [] };
    return ProgressService.summary();
  }),

  /* banks */
  getBanks: (includeInactive) => envelope('getBanks', () => BankService.getBanks({ includeInactive: !!includeInactive })),
  createBank: (payload) => envelope('createBank', () => BankService.createBank(payload)),
  updateBank: (id, payload) => envelope('updateBank', () => BankService.updateBank(id, payload)),
  deactivateBank: (id) => envelope('deactivateBank', () => BankService.deactivateBank(id)),
  activateBank: (id) => envelope('activateBank', () => BankService.activateBank(id)),

  /* projects */
  getProjects: (includeInactive) => envelope('getProjects', () => ProjectService.getProjects({ includeInactive: !!includeInactive })),
  createProject: (payload) => envelope('createProject', () => ProjectService.createProject(payload)),
  updateProject: (id, payload) => envelope('updateProject', () => ProjectService.updateProject(id, payload)),
  deactivateProject: (id) => envelope('deactivateProject', () => ProjectService.deactivateProject(id)),

  /* templates */
  getTemplates: (includeInactive) => envelope('getTemplates', () => TemplateService.getTemplates({ includeInactive: !!includeInactive })),
  getTemplate: (id) => envelope('getTemplate', () => TemplateService.getTemplate(id)),
  createTemplate: (payload) => envelope('createTemplate', () => TemplateService.createTemplate(payload)),
  updateTemplate: (id, payload) => envelope('updateTemplate', () => TemplateService.updateTemplate(id, payload)),
  deactivateTemplate: (id) => envelope('deactivateTemplate', () => TemplateService.deactivateTemplate(id)),
  applyTemplate: (templateId, bankIds, picId) => envelope('applyTemplate', () => TemplateService.applyTemplate(templateId, bankIds, picId)),

  /* tasks */
  getTasks: (filter) => envelope('getTasks', () => TaskService.getTasks(filter)),
  getTask: (id) => envelope('getTask', () => TaskService.getTask(id)),
  createTask: (payload) => envelope('createTask', () => TaskService.createTask(payload)),
  updateTask: (id, payload) => envelope('updateTask', () => TaskService.updateTask(id, payload)),
  bulkUpdateTasks: (ids, payload) => envelope('bulkUpdateTasks', () => TaskService.bulkUpdateTasks(ids, payload)),
  deactivateTask: (id) => envelope('deactivateTask', () => TaskService.deactivateTask(id)),
  clearAllTasks: () => envelope('clearAllTasks', () => TaskService.clearAllTasks()),

  /* users / PIC */
  getUsers: (includeInactive) => envelope('getUsers', () => UserService.getUsers({ includeInactive: !!includeInactive })),
  getPics: () => envelope('getPics', () => UserService.getPics()),
  createUser: (payload) => envelope('createUser', () => UserService.createUser(payload)),
  updateUser: (id, payload) => envelope('updateUser', () => UserService.updateUser(id, payload)),
  deactivateUser: (id) => envelope('deactivateUser', () => UserService.deactivateUser(id)),

  /* audit */
  getAuditLogs: (limit) => envelope('getAuditLogs', async () => {
    AuthService.require('READ');
    return AuditRepository.recent(toNum(limit, 50));
  }),

  /* admin / setup / diagnostic */
  getDbStatus: () => envelope('getDbStatus', () => Setup.getDatabaseStatus()),
  seedMasterData: () => envelope('seedMasterData', () => Setup.seedMasterData()),
  dashboardRebuild: () => envelope('dashboardRebuild', async () => {
    AuthService.require('CONFIGURE');
    return DashboardStatsService.recompute();
  }),

  /* backup */
  backupNow: () => envelope('backupNow', async () => {
    AuthService.require('CONFIGURE');
    return BackupService.runBackup('manual');
  }),
  backupList: () => envelope('backupList', async () => {
    AuthService.require('READ');
    return BackupService.listBackups();
  }),
  backupGetLatest: () => envelope('backupGetLatest', async () => {
    AuthService.require('READ');
    const list = await BackupService.listBackups();
    assert(list.length, 'Belum ada backup. Jalankan backup dulu.');
    return BackupService.getBackup(list[0].id);
  }),
  backupStatus: () => envelope('backupStatus', async () => {
    AuthService.require('READ');
    return BackupService.status();
  }),
};
