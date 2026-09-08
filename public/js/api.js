// api.js — FRONTEND API LAYER (port dari api.html).
// google.script.run diganti fetch('/api', POST {fn, args}).
// Bentuk respons identik ({ok,data}|{ok,error}) agar view HTML tidak berubah.
var api = (function () {

  function call(fnName) {
    var args = Array.prototype.slice.call(arguments, 1);
    return fetch('/api', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ fn: fnName, args: args })
    }).then(function (res) {
      return res.json().then(function (body) {
        if (!res.ok) {
          var msg = (body && body.error) ? body.error : ('HTTP ' + res.status);
          throw new Error(msg);
        }
        return body;
      });
    }).then(function (res) {
      if (res && typeof res === 'object' && 'ok' in res) {
        if (res.ok) return res.data;
        throw new Error(res.error || 'Unknown server error');
      }
      return res;
    });
  }

  return {
    _call: call,

    /* auth */
    login: function (email, password) { return call('login', email, password); },
    logout: function () { return call('logout'); },

    /* app & diagnostics */
    getAppInfo: function () { return call('getAppInfo'); },
    getBootstrapData: function () { return call('getBootstrapData'); },

    /* database setup */
    getDbStatus: function () { return call('getDbStatus'); },
    seedMasterData: function () { return call('seedMasterData'); },
    getProgress: function () { return call('getProgress'); },
    getDashboard: function () { return call('getDashboard'); },

    /* banks */
    getBanks: function (includeInactive) { return call('getBanks', !!includeInactive); },
    createBank: function (payload) { return call('createBank', payload); },
    updateBank: function (id, payload) { return call('updateBank', id, payload); },
    deactivateBank: function (id) { return call('deactivateBank', id); },
    activateBank: function (id) { return call('activateBank', id); },

    /* projects */
    getProjects: function (includeInactive) { return call('getProjects', !!includeInactive); },
    createProject: function (payload) { return call('createProject', payload); },
    updateProject: function (id, payload) { return call('updateProject', id, payload); },
    deactivateProject: function (id) { return call('deactivateProject', id); },

    /* templates */
    getTemplates: function (includeInactive) { return call('getTemplates', !!includeInactive); },
    getTemplate: function (id) { return call('getTemplate', id); },
    createTemplate: function (payload) { return call('createTemplate', payload); },
    updateTemplate: function (id, payload) { return call('updateTemplate', id, payload); },
    deactivateTemplate: function (id) { return call('deactivateTemplate', id); },
    applyTemplate: function (templateId, bankIds, picId) { return call('applyTemplate', templateId, bankIds, picId); },

    /* tasks */
    getTasks: function (filter) { return call('getTasks', filter); },
    getTask: function (id) { return call('getTask', id); },
    createTask: function (payload) { return call('createTask', payload); },
    updateTask: function (id, payload) { return call('updateTask', id, payload); },
    bulkUpdateTasks: function (ids, payload) { return call('bulkUpdateTasks', ids, payload); },
    deactivateTask: function (id) { return call('deactivateTask', id); },

    /* users & PIC */
    getUsers: function (includeInactive) { return call('getUsers', !!includeInactive); },
    getPics: function () { return call('getPics'); },
    createUser: function (payload) { return call('createUser', payload); },
    updateUser: function (id, payload) { return call('updateUser', id, payload); },
    deactivateUser: function (id) { return call('deactivateUser', id); },

    /* audit */
    getAuditLogs: function (limit) { return call('getAuditLogs', limit || 50); }
  };
})();
