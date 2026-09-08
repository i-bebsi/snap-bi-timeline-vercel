
/* ============================================================
 * views-dashboard.html — Dashboard (PHASE 0/1 version).
 * Fokus saat ini: status aplikasi, status database, tombol
 * provisioning/seed, dan hasil checkpoint test dari backend.
 * Summary cards & progress bank menyusul di PHASE 7.
 * ============================================================ */
views.register('dashboard', function () {
  // Dashboard untuk viewer: Ringkasan + Status Task + Progress Bank.
  // Diagnostik (status aplikasi/database, self test) dipindah ke Settings.

  function load() {
    ui.loading('view-root', 'Memuat dashboard…');

    Promise.all([api.getDashboard()]).then(function (res) {
      var dash = res[0] || { overall: 0, totalBanks: 0, totalTasks: 0,
        statusCounts: {}, overdueCount: 0, mostAdvanced: null, mostDelayed: null, banks: [] };

      ui.setHtml('view-root',
        '<div class="row-actions" style="align-items:center;justify-content:space-between">' +
          '<h1 class="page-title" style="margin:0">Dashboard</h1>' +
          '<button class="btn btn--sm" id="btn-refresh-dash">⟳ Segarkan</button>' +
        '</div>' +
        renderSummaryCards(dash) +
        renderProgress({ overall: dash.overall, overallTaskCount: dash.totalTasks, banks: dash.banks }));

      bindProgress({ banks: dash.banks });

      var btn = ui.el('btn-refresh-dash');
      if (btn) btn.addEventListener('click', load);
    }).catch(function (err) {
      ui.error('view-root', err.message);
    });
  }

  load();

  /* ---------- sections ---------- */

  function renderSummaryCards(dash) {
    var sc = dash.statusCounts || {};
    function card(label, value, kind) {
      return '<div class="stat-card' + (kind ? ' stat-card--' + kind : '') + '">' +
        '<div class="stat-card__value">' + ui.esc(value) +
        '</div><div class="stat-card__label">' + ui.esc(label) + '</div></div>';
    }
    var insight = '';
    if (dash.mostAdvanced) {
      insight += '<div class="stat-card stat-card--insight"><div class="stat-card__value">' +
        ui.esc(dash.mostAdvanced.name) + '</div><div class="stat-card__label">Paling maju · ' +
        dash.mostAdvanced.progress + '%</div></div>';
    }
    if (dash.mostDelayed) {
      insight += '<div class="stat-card stat-card--insight"><div class="stat-card__value">' +
        ui.esc(dash.mostDelayed.name) + '</div><div class="stat-card__label">Paling tertinggal · ' +
        dash.mostDelayed.progress + '%</div></div>';
    }

    // Satu panel: Ringkasan + Status Task (sub-bagian dipisah divider).
    return '<div class="card"><h2 class="card__title">Ringkasan</h2>' +
      '<div class="stat-grid">' +
      card('Overall Progress', dash.overall + '%') +
      card('Total Banks', dash.totalBanks) +
      card('Total Tasks', dash.totalTasks) +
      card('Overdue', dash.overdueCount) +
      insight +
      '</div>' +
      '<div style="margin-top:14px;padding-top:12px;border-top:1px solid var(--c-border)">' +
      '<h3 style="margin:0 0 10px;font-size:12px;color:var(--c-muted);text-transform:uppercase;' +
      'letter-spacing:.5px">Status Task</h3>' +
      renderStatusGrid(sc) +
      '</div>' +
      '<div class="row-actions" style="margin-top:10px">' +
        '<span class="card__hint">Diperbarui: ' +
        ui.esc(dash.computedAt ? ui.fmtDate(dash.computedAt, true) : '—') +
        '</span>' +
      '</div></div>';
  }

  // Grid 5 kartu status (bagian dari panel Ringkasan — tanpa wrapper card).
  function renderStatusGrid(sc) {
    var colors = { TODO: '#f5a623', IN_PROGRESS: '#2f80ed', BLOCKED: '#eb5757',
      DONE: '#27ae60', CANCELLED: '#828282' };
    var order = ['TODO', 'IN_PROGRESS', 'BLOCKED', 'DONE', 'CANCELLED'];
    var cards = order.map(function (s) {
      return '<div class="stat-card" style="border-top:3px solid ' + colors[s] + '">' +
        '<div class="stat-card__value">' + (sc[s] || 0) + '</div>' +
        '<div class="stat-card__label">' + s + '</div></div>';
    }).join('');
    return '<div class="stat-grid">' + cards + '</div>';
  }

  function renderProgress(progress) {
    var banks = progress.banks || [];
    if (!banks.length) {
      return '<div class="card"><h2 class="card__title">Progress Bank</h2>' +
        '<div class="state"><p>Belum ada data. Seed master data dulu di menu Settings.</p></div></div>';
    }
    var rows = banks.map(function (b) {
      return '<tr class="bank-row" data-bank="' + ui.esc(b.id) + '" style="cursor:pointer">' +
        '<td>' + ui.esc(b.name) + '</td>' +
        '<td>' + ui.progressBar(b.progress) + '</td>' +
        '<td>' + healthPill(b.health) + '</td>' +
        '<td class="mono nowrap">' + b.doneCount + ' / ' + b.taskCount + ' selesai</td>' +
        '</tr>';
    }).join('');

    return '<div class="card">' +
      '<h2 class="card__title">Progress Bank</h2>' +
      '<p class="card__hint">Klik baris bank untuk detail.</p>' +
      '<table class="tbl"><thead><tr><th>Bank</th><th>Progress</th><th>Health</th><th>Selesai</th></tr></thead>' +
      '<tbody>' + (rows || '<tr><td colspan="4">Belum ada bank aktif.</td></tr>') + '</tbody></table>' +
      '<div class="row-actions" style="margin-top:12px">' +
        '<span class="card__hint">Overall Progress:</span>' + ui.progressBar(progress.overall) +
        '<span class="card__hint">(' + (progress.overallTaskCount || 0) + ' task aktif)</span>' +
      '</div>' +
      '</div>';
  }

  function healthPill(h) {
    var map = { ON_TRACK: ['ON TRACK', 'ok'], AT_RISK: ['ON PROGRESS', 'info'], DELAYED: ['DELAYED', 'fail'] };
    var m = map[h] || [h || '-', 'warn'];
    return ui.pill(m[0], m[1]);
  }

  function taskStatusPill(s) {
    var map = { TODO: ['TODO', 'warn'], IN_PROGRESS: ['IN PROGRESS', 'ok'],
      BLOCKED: ['BLOCKED', 'fail'], DONE: ['DONE', 'ok'], CANCELLED: ['CANCELLED', 'warn'] };
    var m = map[s] || [s || '-', 'warn'];
    return ui.pill(m[0], m[1]);
  }

  function bindProgress(progress) {
    Array.prototype.forEach.call(document.querySelectorAll('.bank-row'), function (tr) {
      tr.addEventListener('click', function () {
        openBankDetail(tr.getAttribute('data-bank'), progress.banks || []);
      });
    });
  }

  function openBankDetail(bankId, banks) {
    var bank = null;
    for (var i = 0; i < banks.length; i++) {
      if (String(banks[i].id) === String(bankId)) { bank = banks[i]; break; }
    }
    if (!bank) return;

    ui.modal({
      title: bank.name + ' — ' + bank.health,
      okLabel: 'Tutup',
      wide: true,
      hideCancel: true,
      body: '<div class="state state--loading"><span class="spinner"></span><p>Memuat task ' +
        ui.esc(bank.name) + '…</p></div>'
    });

    api.getTasks({ bankId: bank.id }).then(function (tasks) {
      var rows = tasks.map(function (t) {
        return '<tr><td>' + ui.esc(t.task_name) + '</td>' +
          '<td>' + taskStatusPill(t.status) + '</td>' +
          '<td>' + ui.progressBar(t.progress) + '</td>' +
          '<td class="mono nowrap">' + ui.esc(ui.fmtDate(t.start_date)) + ' → ' + ui.esc(ui.fmtDate(t.end_date)) + '</td></tr>';
      }).join('');
      ui.el('modal-body').innerHTML =
        '<p class="card__hint">Progress: ' + bank.progress + '% · ' + bank.doneCount + '/' +
        bank.taskCount + ' task selesai</p>' +
        (tasks.length
          ? '<table class="tbl"><thead><tr><th>Task</th><th>Status</th><th>Progress</th><th>Tanggal</th></tr></thead>' +
            '<tbody>' + rows + '</tbody></table>'
          : '<div class="state"><p>Belum ada task untuk bank ini.</p></div>');
    }).catch(function (e) {
      ui.el('modal-body').innerHTML = '<div class="state state--error"><p>' + ui.esc(e.message) + '</p></div>';
    });
  }
});
