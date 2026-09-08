// app.js — boot + auth UI (pengganti app.html).
// Auth: viewer anonim melihat Dashboard/Timeline; tombol "Login admin" membuka
// modal email/password; admin dapat tombol Logout.
(function boot() {
  ui.loading('view-root', 'Menyiapkan aplikasi…');

  api.getAppInfo().then(function (info) {
    store.setAppInfo(info);
    router.renderNav();
    renderTopbar(info);
    if (info.databaseReady) {
      return store.refreshMasters().catch(function (err) {
        ui.toast('Master data gagal dimuat: ' + err.message, true);
      });
    }
    return null;
  }).then(function () {
    router.go('dashboard');
  }).catch(function (err) {
    ui.el('topbar-user').textContent = '—';
    ui.error('view-root', err.message, function () { location.reload(); });
  });

  function renderTopbar(info) {
    var u = info.user || {};
    var isAdmin = u.role === 'ADMIN';
    ui.el('topbar-user').innerHTML =
      ui.esc(u.email || 'viewer') +
      ' <span class="badge-role">' + ui.esc(u.role) + '</span>' +
      (isAdmin
        ? ' <button class="btn btn--sm" id="btn-logout">Logout</button>'
        : ' <button class="btn btn--sm" id="btn-login">Login admin</button>');

    var loginBtn = ui.el('btn-login');
    var logoutBtn = ui.el('btn-logout');
    if (loginBtn) loginBtn.addEventListener('click', showLogin);
    if (logoutBtn) logoutBtn.addEventListener('click', doLogout);
  }

  function showLogin() {
    ui.modal({
      title: 'Login Admin',
      okLabel: 'Masuk',
      body:
        '<div style="display:grid;gap:8px">' +
        '<label>Email<input class="input" id="login-email" type="email" placeholder="admin@…"></label>' +
        '<label>Password<input class="input" id="login-password" type="password" placeholder="••••••"></label>' +
        '<p class="card__hint" id="login-err" style="color:var(--c-danger);display:none;margin:0"></p>' +
        '</div>',
      onOk: function () {
        var email = ui.el('login-email').value;
        var pw = ui.el('login-password').value;
        var errEl = ui.el('login-err');
        errEl.style.display = 'none';
        fetch('/api', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'same-origin',
          body: JSON.stringify({ fn: 'login', args: [email, pw] })
        }).then(function (res) { return res.json(); }).then(function (body) {
          if (body && body.ok) { location.reload(); return; }
          errEl.textContent = (body && body.error) || 'Login gagal';
          errEl.style.display = 'block';
        }).catch(function (e) {
          errEl.textContent = e.message || 'Login gagal';
          errEl.style.display = 'block';
        });
        return false; // biarkan modal tetap terbuka sampai login berhasil
      }
    });
  }

  function doLogout() {
    fetch('/api', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ fn: 'logout', args: [] })
    }).then(function () {
      location.reload();
    });
  }
})();
