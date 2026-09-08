// views-settings.js — Settings (adaptasi Supabase/Postgres; GAS-specific dihapus:
// selfTest, setupDatabase/provisioning spreadsheet, runDataLayerTests, spreadsheet URL).
views.register('settings', function () {
  ui.loading('view-root', 'Memuat settings…');

  Promise.all([api.getUsers(true), api.getAuditLogs(25), api.getDbStatus()])
    .then(function (res) {
      var users = res[0];
      var logs = res[1];
      var db = res[2];
      var info = store.state.appInfo || {};

      ui.setHtml('view-root',
        '<h1 class="page-title">Settings</h1>' +
        '<p class="page-sub">Konfigurasi, user &amp; audit, plus status aplikasi/database.</p>' +
        renderAppStatus(info, db) +
        renderDbStatus(db) +
        configCard(info) +
        usersCard(users) +
        auditCard(logs));

      bind(users);
      bindActions();
    }).catch(function (err) { ui.error('view-root', err.message); });

  function renderAppStatus(info, db) {
    var u = info.user || {};
    return '<div class="card">' +
      '<h2 class="card__title">Status Aplikasi</h2>' +
      '<p class="card__hint">Semua nilai berasal dari backend, bukan hardcode di HTML.</p>' +
      '<table class="tbl">' +
      row('Aplikasi', ui.esc(info.appName || '-') + ' v' + ui.esc(info.appVersion || '-')) +
      row('Environment', ui.esc(info.environment || '-')) +
      row('Timezone', ui.esc(info.timezone || '-')) +
      row('Server time', '<span class="mono">' + ui.esc(info.serverTime || '-') + '</span>') +
      row('User', ui.esc(u.email || '-') +
        ' <span class="badge-role">' + ui.esc(u.role || '-') + '</span>') +
      row('Database', db.ready ? ui.pill('SIAP', 'ok') + ' <span class="mono">Supabase/Postgres</span>'
        : ui.pill('BELUM DIKONFIGURASI', 'warn')) +
      '</table></div>';
  }

  function renderDbStatus(db) {
    var actions =
      '<div class="row-actions">' +
      (store.can('CONFIGURE')
        ? '<button class="btn" id="btn-seed">Seed master data (5 bank + project SNAP BI)</button>'
        : '<span class="card__hint">Role Anda tidak berhak melakukan konfigurasi.</span>') +
      '</div>';

    var tableRows = (db.tables || []).map(function (t) {
      return '<tr><td class="mono">' + ui.esc(t.name) + '</td>' +
        '<td>' + (t.exists ? ui.pill('ADA', 'ok') : ui.pill('HILANG', 'fail')) + '</td>' +
        '<td>' + t.rows + '</td></tr>';
    }).join('');

    return '<div class="card">' +
      '<h2 class="card__title">Database (Supabase/Postgres)</h2>' +
      '<p class="card__hint">Tabel dibuat lewat migrasi SQL (db/migrations/001_schema.sql).</p>' +
      actions +
      (db.ready
        ? '<table class="tbl"><thead><tr><th>Tabel</th><th>Status</th><th>Baris</th></tr></thead>' +
          '<tbody>' + tableRows + '</tbody></table>'
        : '') +
      '</div>';
  }

  function row(label, valueHtml) {
    return '<tr><th>' + ui.esc(label) + '</th><td>' + valueHtml + '</td></tr>';
  }

  function bindActions() {
    var seedBtn = ui.el('btn-seed');
    if (seedBtn) seedBtn.addEventListener('click', function () {
      ui.confirm('Seed master data',
        'Menambahkan project SNAP BI, 5 bank (Bank A–E) dan PIC default. Data yang sudah ada tidak diduplikasi.',
        function () {
          ui.toast('Menyiapkan master data…');
          api.seedMasterData().then(function (res) {
            ui.toast('Seed selesai. Dibuat: ' +
              (res.created.projects.length + ' project, ' +
               res.created.banks.length + ' bank, ' +
               res.created.pics.length + ' PIC'));
            return refreshAll();
          }).catch(function (err) { ui.toast(err.message, true); });
        }, 'Ya, seed');
    });
  }

  function refreshAll() {
    return api.getAppInfo().then(function (info) {
      store.setAppInfo(info);
      ui.el('topbar-user').innerHTML =
        ui.esc(info.user.email || 'unknown') +
        ' <span class="badge-role">' + ui.esc(info.user.role) + '</span>';
      return store.refreshMasters();
    }).then(function () {
      router.reload();
    });
  }

  function configCard(info) {
    var h = info.healthThreshold || {};
    return '<div class="card"><h2 class="card__title">Konfigurasi Aktif</h2>' +
      '<table class="tbl">' +
      '<tr><th>Status task</th><td class="mono">' + ui.esc(store.enums('TASK_STATUS').join(' · ')) + '</td></tr>' +
      '<tr><th>Status project</th><td class="mono">' + ui.esc(store.enums('PROJECT_STATUS').join(' · ')) + '</td></tr>' +
      '<tr><th>Priority</th><td class="mono">' + ui.esc(store.enums('PRIORITY').join(' · ')) + '</td></tr>' +
      '<tr><th>Role</th><td class="mono">' + ui.esc(store.enums('ROLE').join(' · ')) + '</td></tr>' +
      '<tr><th>Timeline view</th><td class="mono">' + ui.esc((info.timelineViews || []).join(' · ')) + '</td></tr>' +
      '<tr><th>Bank health</th><td class="mono">ON_TRACK ≥ ' + ui.esc(h.ON_TRACK_MIN) +
      '% · AT_RISK ≥ ' + ui.esc(h.AT_RISK_MIN) + '% · sisanya DELAYED</td></tr>' +
      '</table></div>';
  }

  function usersCard(users) {
    var rows = users.map(function (u) {
      return '<tr>' +
        '<td class="mono">' + ui.esc(u.id) + '</td>' +
        '<td>' + ui.esc(u.name) + '</td>' +
        '<td class="mono">' + ui.esc(u.email || '-') + '</td>' +
        '<td><span class="badge-role">' + ui.esc(u.role) + '</span></td>' +
        '<td>' + (u.is_pic ? 'Ya' : '-') + '</td>' +
        '<td>' + (u.active ? ui.pill('AKTIF', 'ok') : ui.pill('NON-AKTIF', 'warn')) + '</td>' +
        '<td class="nowrap">' +
        (store.can('UPDATE') ? '<button class="btn btn--sm" data-edit-user="' + ui.esc(u.id) + '">Edit</button> ' : '') +
        (store.can('DELETE') && u.active
          ? '<button class="btn btn--sm btn--danger" data-off-user="' + ui.esc(u.id) + '">Non-aktifkan</button>' : '') +
        '</td></tr>';
    }).join('');

    return '<div class="card"><h2 class="card__title">User &amp; PIC</h2>' +
      '<p class="card__hint">Hanya PIC yang perlu ditambahkan (penanggung jawab task). Login admin via env ADMIN_EMAIL.</p>' +
      '<div class="row-actions">' +
      (store.can('CREATE') ? '<button class="btn btn--primary" id="btn-add-user">+ Tambah PIC</button>' : '') +
      '<span class="card__hint">' + users.length + ' baris</span></div>' +
      (users.length
        ? '<table class="tbl"><thead><tr><th>ID</th><th>Nama</th><th>Email</th><th>Role</th><th>PIC</th><th>Status</th><th>Aksi</th></tr></thead><tbody>' +
          rows + '</tbody></table>'
        : '<div class="state"><p>Belum ada user.</p></div>') +
      '</div>';
  }

  function auditCard(logs) {
    if (!logs.length) {
      return '<div class="card"><h2 class="card__title">Audit Log</h2>' +
        '<div class="state"><p>Belum ada perubahan tercatat.</p></div></div>';
    }
    var rows = logs.map(function (l) {
      return '<tr>' +
        '<td class="mono">' + ui.esc(ui.fmtDate(l.timestamp, true)) + '</td>' +
        '<td class="mono">' + ui.esc(l.user) + '</td>' +
        '<td>' + ui.esc(l.action) + '</td>' +
        '<td>' + ui.esc(l.entity) + '</td>' +
        '<td class="mono">' + ui.esc(l.entity_id) + '</td>' +
        '<td class="mono detail-cell">' + ui.esc(l.detail) + '</td>' +
        '</tr>';
    }).join('');
    return '<div class="card"><h2 class="card__title">Audit Log (25 terakhir)</h2>' +
      '<table class="tbl"><thead><tr><th>Waktu</th><th>User</th><th>Aksi</th><th>Entity</th><th>ID</th><th>Detail</th></tr></thead>' +
      '<tbody>' + rows + '</tbody></table></div>';
  }

  function bind(users) {
    var add = ui.el('btn-add-user');
    if (add) add.addEventListener('click', function () { openForm(null); });

    Array.prototype.forEach.call(document.querySelectorAll('[data-edit-user]'), function (btn) {
      btn.addEventListener('click', function () {
        openForm(find(users, btn.getAttribute('data-edit-user')));
      });
    });

    Array.prototype.forEach.call(document.querySelectorAll('[data-off-user]'), function (btn) {
      btn.addEventListener('click', function () {
        var u = find(users, btn.getAttribute('data-off-user'));
        ui.confirm('Non-aktifkan user',
          '"' + u.name + '" tidak lagi bisa dipilih sebagai PIC.',
          function () {
            api.deactivateUser(u.id).then(function () {
              ui.toast('User dinonaktifkan');
              return store.refreshMasters();
            }).then(router.reload).catch(function (e) { ui.toast(e.message, true); });
          }, 'Ya, non-aktifkan');
      });
    });
  }

  function openForm(user) {
    var isEdit = !!user;
    var u = user || { name: '', email: '', role: 'VIEWER', is_pic: true };
    var roleOptions = store.enums('ROLE').map(function (r) { return { value: r, label: r }; });

    ui.modal({
      title: isEdit ? 'Edit User — ' + u.name : 'Tambah PIC',
      okLabel: 'Simpan',
      body:
        ui.field('Nama *', ui.input('name', u.name, 'placeholder="Nama orang / unit"')) +
        ui.field('Email', ui.input('email', u.email, 'type="email" placeholder="nama@uii.ac.id"'),
          'Kosongkan bila hanya dipakai sebagai PIC (tanpa login).') +
        ui.field('Role *', ui.select('role', roleOptions, u.role)) +
        '<label class="chk"><input type="checkbox" name="is_pic"' + (u.is_pic ? ' checked' : '') +
        '> Bisa dipilih sebagai PIC task</label>',
      onOk: function (body) {
        var payload = ui.readForm(body);
        var req = isEdit ? api.updateUser(u.id, payload) : api.createUser(payload);
        req.then(function (saved) {
          ui.toast('User ' + saved.name + ' tersimpan');
          return store.refreshMasters();
        }).then(router.reload).catch(function (e) { ui.toast(e.message, true); });
      }
    });
  }

  function find(list, id) {
    for (var i = 0; i < list.length; i++) if (String(list[i].id) === String(id)) return list[i];
    return null;
  }
});
