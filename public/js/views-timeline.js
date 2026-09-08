
/* ============================================================
 * views-timeline.html — Timeline/Gantt (TASK T-001, T-002, T-003).
 *
 * T-001 Dynamic Timeline: rentang dihitung dari min(start_date) .. max(end_date)
 *        task, bisa di-override user; view DAY / WEEK / MONTH / QUARTER.
 * T-002 Gantt Rendering: bar diposisikan presisi oleh tanggal (kontinu),
 *        panjang sesuai durasi; task 1 hari tetap terlihat; lintas bulan/tahun benar.
 * T-003 Task Grouping: grouping per bank (GLOBAL terpisah), collapse/expand.
 *
 * TANPA hardcode bulan; tanpa hardcode jumlah bank. Semua dari backend.
 * ============================================================ */
views.register('timeline', function () {

  var TRACK_W = 1200;          // px; posisi bar dalam % dari lebar ini
  var VIEW_MODES = ['DAY', 'WEEK', 'MONTH', 'QUARTER'];
  var viewMode = 'DAY';        // default diminta user (sebelumnya 'MONTH')
  var rangeFrom = '2026-08-01';   // default rentang diminta user (sebelumnya '' = auto)
  var rangeTo = '2027-01-31';
  var bankFilter = '';         // BANK-001: '' = semua bank; selain itu tampilkan GLOBAL + bank tsb
  var filterCollapsed = true;  // auto-hide toolbar filter (Bank + Rentang) → timeline lebih luas
  var collapsed = {};          // groupId -> true

  ui.loading('view-root', 'Memuat timeline…');

  load();

  function load() {
    Promise.all([api.getTasks(), store.refreshMasters()]).then(function (res) {
      var all = res[0] || [];
      // BANK-001: filter bank (selalu tampilkan global task + bank terpilih)
      var tasks = bankFilter
        ? all.filter(function (t) { return !t.bank_id || String(t.bank_id) === bankFilter; })
        : all;
      render(tasks);
    }).catch(function (err) {
      ui.error('view-root', err.message);
    });
  }

  /* ---------------- date helpers (UTC, bebas timezone) ---------------- */

  function parseISO(s) {
    var p = String(s).split('-');
    return new Date(Date.UTC(Number(p[0]), Number(p[1]) - 1, Number(p[2])));
  }
  function iso(d) {
    return d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1) + '-' + pad(d.getUTCDate());
  }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function dayDiff(a, b) { return Math.round((b.getTime() - a.getTime()) / 86400000); }
  function addDays(d, n) { var x = new Date(d.getTime()); x.setUTCDate(x.getUTCDate() + n); return x; }

  var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

  /* ---------------- T-001: compute range ---------------- */

  function computeRange(tasks) {
    if (rangeFrom && rangeTo && dayDiff(parseISO(rangeFrom), parseISO(rangeTo)) >= 0) {
      return { start: parseISO(rangeFrom), end: parseISO(rangeTo) };
    }
    if (!tasks.length) {
      var t = new Date();
      var today = parseISO(iso(t));
      return { start: addDays(today, -7), end: addDays(today, 60) };
    }
    var min = null, max = null;
    tasks.forEach(function (t) {
      if (!t.start_date || !t.end_date) return;
      var s = parseISO(t.start_date), e = parseISO(t.end_date);
      if (!min || s < min) min = s;
      if (!max || e > max) max = e;
    });
    // beri sedikit ruang di kiri/kanan agar bar tepi tidak menempel
    var start = addDays(min, -1);
    var end = addDays(max, 1);
    // pastikan minimal ada rentang tampilan
    if (dayDiff(start, end) < 14) end = addDays(start, 14);
    return { start: start, end: end };
  }

  /* ---------------- T-001: header ticks per view mode ---------------- */

  function buildTicks(range) {
    var start = range.start, end = range.end;
    var ticks = [];

    function push(d, label) {
      var off = dayDiff(start, d);
      if (off > dayDiff(start, end)) return;              // hanya buang tick setelah akhir
      var leftPct = Math.max(0, off) / dayDiff(start, end) * 100;  // clamp tick awal ke posisi 0
      ticks.push({ label: label, left: leftPct });
    }

    if (viewMode === 'DAY') {
      var step = dayDiff(start, end) > 120 ? 7 : 1;
      var d = start;
      while (d <= end) {
        push(d, String(d.getUTCDate()));
        d = addDays(d, step);
      }
    } else if (viewMode === 'WEEK') {
      var monday = addDays(start, -((start.getUTCDay() + 6) % 7));
      while (monday <= end) {
        push(monday, String(monday.getUTCDate()) + ' ' + MONTHS[monday.getUTCMonth()]);
        monday = addDays(monday, 7);
      }
    } else if (viewMode === 'MONTH') {
      var cur = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1));
      while (cur <= end) {
        push(cur, MONTHS[cur.getUTCMonth()] + ' ' + cur.getUTCFullYear());
        cur = new Date(Date.UTC(cur.getUTCFullYear(), cur.getUTCMonth() + 1, 1));
      }
    } else { // QUARTER
      var q0 = new Date(Date.UTC(start.getUTCFullYear(), Math.floor(start.getUTCMonth() / 3) * 3, 1));
      while (q0 <= end) {
        var qn = Math.floor(q0.getUTCMonth() / 3) + 1;
        push(q0, 'Q' + qn + ' ' + q0.getUTCFullYear());
        q0 = new Date(Date.UTC(q0.getUTCFullYear(), q0.getUTCMonth() + 3, 1));
      }
    }
    return ticks;
  }

  /* ---------------- T-002: bar geometry ---------------- */

  function barGeometry(range, task) {
    var total = dayDiff(range.start, range.end);
    var s = parseISO(task.start_date), e = parseISO(task.end_date);
    var off = dayDiff(range.start, s);
    var dur = dayDiff(s, e) + 1;             // inclusive
    var left = Math.max(0, off / total * 100);
    var width = Math.max(0.4, dur / total * 100);   // min-width supaya 1 hari terlihat
    if (left + width > 100) width = Math.max(0.4, 100 - left);
    return { left: left, width: width };
  }

  function statusClass(status) {
    var s = String(status || '').toUpperCase();
    if (s === 'DONE') return 'tl-bar--done';
    if (s === 'IN_PROGRESS') return 'tl-bar--progress';
    if (s === 'BLOCKED') return 'tl-bar--blocked';
    if (s === 'CANCELLED') return 'tl-bar--cancelled';
    return 'tl-bar--todo';
  }

  /* ---------------- T-003: grouping ---------------- */

  function groupTasks(tasks) {
    var groups = [];
    // GLOBAL dulu
    var globals = tasks.filter(function (t) { return !t.bank_id; });
    if (globals.length) groups.push({ id: 'GLOBAL', label: 'GLOBAL', tasks: globals });

    // bank berurutan sesuai sort_order (store.banks sudah terurut dari backend)
    store.state.banks.forEach(function (b) {
      var mine = tasks.filter(function (t) { return String(t.bank_id) === String(b.id); });
      if (mine.length) groups.push({ id: b.id, label: b.name, tasks: mine });
    });
    return groups;
  }

  /* ---------------- render ---------------- */

  function render(tasks) {
    var range = computeRange(tasks);
    var total = dayDiff(range.start, range.end);

    if (!tasks.length) {
      ui.setHtml('view-root',
        toolbar(0) +
        '<div class="card"><div class="state"><p>Belum ada task aktif.</p>' +
        '<p class="muted-sm">Tambahkan task dulu di menu Tasks (fase berikutnya), atau seed template.</p></div></div>');
      bindToolbar();
      return;
    }

    var ticks = buildTicks(range);
    var groups = groupTasks(tasks);

    var headerHtml =
      '<div class="tl-track" style="width:' + TRACK_W + 'px">' +
      ticks.map(function (tk) {
        return '<div class="tl-tick" style="left:' + tk.left + '%">' + ui.esc(tk.label) + '</div>' +
               '<div class="tl-grid" style="left:' + tk.left + '%"></div>';
      }).join('') +
      todayLine(range) +
      '</div>';

    var bodyHtml = groups.map(function (g) {
      var isCollapsed = !!collapsed[g.id];
      var rows = g.tasks.map(function (t) {
        var g2 = barGeometry(range, t);
        return '<div class="tl-row">' +
          '<div class="tl-label">' +
            '<div class="tl-label__name" title="' + ui.esc(t.task_name) + '">' + ui.esc(t.task_name) + '</div>' +
            '<div class="tl-label__meta">' + ui.esc(t.task_no || t.id) + ' · ' +
              ui.esc(store.picName(t.pic_id)) + ' · ' +
              ui.esc(ui.fmtDate(t.start_date)) + ' → ' + ui.esc(ui.fmtDate(t.end_date)) + '</div>' +
          '</div>' +
          '<div class="tl-track" style="width:' + TRACK_W + 'px">' +
            todayLine(range) +
            '<div class="tl-bar ' + statusClass(t.status) + '" ' +
              'style="left:' + g2.left + '%;width:' + g2.width + '%" ' +
              'title="' + ui.esc(t.task_name) + ' — ' + ui.esc(t.status) + ' ' + t.progress + '% · ' +
              ui.esc(ui.fmtDate(t.start_date)) + ' → ' + ui.esc(ui.fmtDate(t.end_date)) + '"></div>' +
          '</div>' +
        '</div>';
      }).join('');

      return '<div class="tl-group" data-group="' + ui.esc(g.id) + '">' +
        '<div class="tl-group__head">' +
          '<button class="tl-group__toggle" data-toggle="' + ui.esc(g.id) + '">' +
            (isCollapsed ? '▶' : '▼') + '</button>' +
          '<span class="tl-group__title">' + ui.esc(g.label) + '</span>' +
          '<span class="tl-group__count">' + g.tasks.length + ' task</span>' +
        '</div>' +
        (isCollapsed ? '' : rows) +
      '</div>';
    }).join('');

    ui.setHtml('view-root',
      '<h1 class="page-title">Timeline</h1>' +
      '<p class="page-sub">Rentang ' + ui.esc(iso(range.start)) + ' → ' + ui.esc(iso(range.end)) +
      ' · ' + tasks.length + ' task aktif</p>' +
      toolbar(tasks.length) +
      '<div class="card tl-card">' +
        '<div class="tl-scroll">' +
          '<div class="tl-header-row">' +
            '<div class="tl-label tl-label--head">Task / PIC</div>' +
            headerHtml +
          '</div>' +
          bodyHtml +
        '</div>' +
        legend() +
      '</div>');

    bindToolbar();
    bindGroups();
  }

  function toolbar(count) {
    var modeBtns = VIEW_MODES.map(function (m) {
      return '<button class="btn btn--sm' + (m === viewMode ? ' btn--primary' : '') +
        '" data-mode="' + m + '">' + m + '</button>';
    }).join('');

    var bankOpts = [{ value: '', label: 'Semua bank' }].concat(
      store.state.banks.map(function (b) { return { value: b.id, label: b.name }; }));

    // Accordion filter: default hide; expand HANYA menampilkan form (tanpa load).
    var filterForm = '<div id="tl-filter-body"' + (filterCollapsed ? ' style="display:none"' : '') + '>' +
      '<div class="row-actions" style="margin-top:10px;padding-bottom:10px">' +
      '<span class="card__hint">Bank:</span>' + ui.select('tl-bank', bankOpts, bankFilter) +
      '<span class="card__hint" style="margin-left:8px">Rentang:</span>' +
      '<input class="input" type="date" id="tl-from" value="' + ui.esc(rangeFrom) + '">' +
      '<span class="card__hint">–</span>' +
      '<input class="input" type="date" id="tl-to" value="' + ui.esc(rangeTo) + '">' +
      '<button class="btn btn--sm" id="tl-auto">Auto</button>' +
      '</div></div>';

    var chev = filterCollapsed ? '⌄' : '⌃';
    return '<div class="card">' +
      '<button class="btn tl-acc-head" id="tl-filter-toggle" aria-expanded="' + !filterCollapsed + '">' +
        '<span>' + chev + ' Filter Bank &amp; Rentang</span>' +
        '<span class="tl-acc-chev">' + (filterCollapsed ? 'klik untuk tampilkan' : 'klik untuk sembunyikan') + '</span>' +
      '</button>' +
      filterForm +
      '<div class="row-actions" style="margin-top:10px">' +
      '<span class="card__hint">Tampilan:</span>' + modeBtns +
      '<span class="card__hint" style="margin-left:auto">' + count + ' task</span>' +
      '</div></div>';
  }

  function todayLine(range) {
    var today = parseISO(iso(new Date()));
    var total = dayDiff(range.start, range.end);
    var off = dayDiff(range.start, today);
    if (off < 0 || off > total) return '';
    return '<div class="tl-today" style="left:' + (off / total * 100) + '%"></div>';
  }

  function legend() {
    return '<div class="tl-legend">' +
      '<span><i class="tl-bar tl-bar--todo" style="position:static;display:inline-block;width:14px;height:10px;margin-right:4px"></i>TODO</span>' +
      '<span><i class="tl-bar tl-bar--progress" style="position:static;display:inline-block;width:14px;height:10px;margin-right:4px"></i>IN PROGRESS</span>' +
      '<span><i class="tl-bar tl-bar--blocked" style="position:static;display:inline-block;width:14px;height:10px;margin-right:4px"></i>BLOCKED</span>' +
      '<span><i class="tl-bar tl-bar--done" style="position:static;display:inline-block;width:14px;height:10px;margin-right:4px"></i>DONE</span>' +
      '<span><i class="tl-bar tl-bar--cancelled" style="position:static;display:inline-block;width:14px;height:10px;margin-right:4px"></i>CANCELLED</span>' +
      '<span class="tl-today-mark">│ Hari ini</span>' +
      '</div>';
  }

  function bindToolbar() {
    Array.prototype.forEach.call(document.querySelectorAll('[data-mode]'), function (btn) {
      btn.addEventListener('click', function () {
        viewMode = btn.getAttribute('data-mode');
        reload();
      });
    });
    var toggle = ui.el('tl-filter-toggle');
    if (toggle) toggle.addEventListener('click', function () {
      // Accordion: toggle DOM saja — TANPA reload (halaman tidak di-load ulang).
      filterCollapsed = !filterCollapsed;
      var body = ui.el('tl-filter-body');
      if (body) body.style.display = filterCollapsed ? 'none' : '';
      toggle.setAttribute('aria-expanded', String(!filterCollapsed));
      toggle.innerHTML =
        '<span>' + (filterCollapsed ? '⌄' : '⌃') + ' Filter Bank &amp; Rentang</span>' +
        '<span class="tl-acc-chev">' + (filterCollapsed ? 'klik untuk tampilkan' : 'klik untuk sembunyikan') + '</span>';
    });
    var bank = ui.el('tl-bank');
    if (bank) bank.addEventListener('change', function () {
      bankFilter = bank.value;
      reload();
    });
    var from = ui.el('tl-from'), to = ui.el('tl-to'), auto = ui.el('tl-auto');
    if (from) from.addEventListener('change', function () {
      rangeFrom = from.value; rangeTo = to ? to.value : '';
      if (rangeFrom && rangeTo) reload();
    });
    if (to) to.addEventListener('change', function () {
      rangeFrom = from ? from.value : ''; rangeTo = to.value;
      if (rangeFrom && rangeTo) reload();
    });
    if (auto) auto.addEventListener('click', function () {
      rangeFrom = ''; rangeTo = '';
      reload();
    });
  }

  function bindGroups() {
    Array.prototype.forEach.call(document.querySelectorAll('[data-toggle]'), function (btn) {
      btn.addEventListener('click', function () {
        var gid = btn.getAttribute('data-toggle');
        collapsed[gid] = !collapsed[gid];
        reload();
      });
    });
  }

  function reload() {
    ui.loading('view-root', 'Memuat timeline…');
    load();
  }
});
