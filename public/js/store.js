
/* ============================================================
 * store.html — shared client state + master data cache.
 * Semua data berasal dari backend (tidak ada konstanta bisnis di sini).
 * ============================================================ */
var store = (function () {

  var state = {
    appInfo: null,      // dari api.getAppInfo()
    banks: [],          // bank aktif
    projects: [],       // project aktif
    pics: [],           // PIC aktif
    dbReady: false
  };

  function setAppInfo(info) {
    state.appInfo = info;
    state.dbReady = !!(info && info.databaseReady);
    return info;
  }

  /** @return {!Promise<!Object>} */
  function refreshMasters() {
    return api.getBootstrapData().then(function (data) {
      state.dbReady = !!data.databaseReady;
      state.banks = data.banks || [];
      state.projects = data.projects || [];
      state.pics = data.pics || [];
      return data;
    });
  }

  function bankName(bankId) {
    var id = bankId === null || bankId === undefined ? '' : String(bankId);
    if (!id) return 'GLOBAL';
    for (var i = 0; i < state.banks.length; i++) {
      if (String(state.banks[i].id) === id) return state.banks[i].name;
    }
    return id;
  }

  function picName(picId) {
    var id = picId === null || picId === undefined ? '' : String(picId);
    if (!id) return '-';
    for (var i = 0; i < state.pics.length; i++) {
      if (String(state.pics[i].id) === id) return state.pics[i].name;
    }
    return id;
  }

  function can(permission) {
    var u = state.appInfo && state.appInfo.user;
    return !!(u && u.permissions && u.permissions.indexOf(permission) !== -1);
  }

  function enums(key) {
    var e = state.appInfo && state.appInfo.enums;
    return (e && e[key]) || [];
  }

  return {
    state: state,
    setAppInfo: setAppInfo,
    refreshMasters: refreshMasters,
    bankName: bankName,
    picName: picName,
    can: can,
    enums: enums
  };
})();
