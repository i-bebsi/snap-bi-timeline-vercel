
/* ============================================================
 * views-tasks.html — Task Management (TASK M-001 .. M-005).
 *
 * M-001 Task List: kolom No/Task/Bank/PIC/Start/End/Status/Progress/Aksi,
 *        search + filter bank/status + sort per kolom.
 * M-002 Add Task: form lengkap + bank selector GLOBAL/bank aktif.
 * M-003 Edit Task: edit field termasuk pindah bank.
 * M-004 Delete Task: soft delete (is_active=false), data + audit tetap.
 * M-005 Parent/Child: parent selector; backend mencegah circular hierarchy.
 * ============================================================ */
views.register('tasks', function () {

  var state = {
    tasks: [],          // semua task (sesuai includeInactive)
    filter: { bank: '', status: '', q: '' },
    sort: { key: 'task_no', dir: 1 },
    showInactive: false,
    selection: {}       // taskId -> true (bulk edit, M-006)
  };

  ui.loading('view-root', 'Memuat task…');

  load();

  function load() {
    Promise.all([api.getTasks({ includeInactive: state.showInactive }), store.refreshMasters()])
      .then(function (res) {
        state.tasks = res[0] || [];
        render();
      })
      .catch(function (err) { ui.error('view-root', err.message); });
  }

  /* ---------------- M-001: filter & sort ---------------- */

  function visibleTasks() {
    var q = state.filter.q.toLowerCase();
    var out = state.tasks.filter(function (t) {
      if (state.filter.bank && String(t.bank_id) !== state.filter.bank) return false;
      if (state.filter.status && String(t.status) !== state.filter.status) return false;
      if (q) {
        var hay = (t.task_name + ' ' + (t.task_no || '') + ' ' + (t.description || '')).toLowerCase();
        if (hay.indexOf(q) === -1) return false;
      }
      return true;
    });

    var key = state.sort.key, dir = state.sort.dir;
    out.sort(function (a, b) {
      var av = a[key], bv = b[key];
      if (key === 'start_date' || key === 'end_date') {
        av = String(av || ''); bv = String(bv || '');
      } else if (key === 'progress') {
        av = Number(av) || 0; bv = Number(bv) || 0;
      } else if (key === 'task_name') {
        av = String(av || '').toLowerCase(); bv = String(bv || '').toLowerCase();
      } else {
        av = String(av || ''); bv = String(bv || '');
      }
      if (av < bv) return -1 * dir;
      if (av > bv) return 1 * dir;
      return 0;
    });
    return out;
  }

  function parentChainMap() {
    // taskId -> parent chain depth, untuk indentasi hierarki (M-005)
    var depth = {};
    function depthOf(t, seen) {
      if (depth[t.id] !== undefined) return depth[t.id];
      if (!t.parent_id || seen[t.id]) { depth[t.id] = 0; return 0; }
      seen[t.id] = true;
      var p = findById(t.parent_id);
      depth[t.id] = p ? depthOf(p, seen) + 1 : 0;
      return depth[t.id];
    }
    var seenMap = {};
    state.tasks.forEach(function (t) { depthOf(t, seenMap); });
    return depth;
  }

  /* ---------------- render ---------------- */

  function render() {
    var tasks = visibleTasks();
    var depth = parentChainMap();

    var bankOpts = [{ value: '', label: 'Semua bank' }].concat(
      store.state.banks.map(function (b) { return { value: b.id, label: b.name }; }));
    var statusOpts = [{ value: '', label: 'Semua status' }].concat(
      store.enums('TASK_STATUS').map(function (s) { return { value: s, label: s }; }));

    var rows = tasks.map(function (t) {
      var ind = '&nbsp;&nbsp;'.repeat(Math.min(depth[t.id] || 0, 4));
      return '<tr>' +
        '<td class="chk-col"><input type="checkbox" class="chk-task" data-id="' + ui.esc(t.id) + '"' +
          (state.selection[t.id] ? ' checked' : '') + '></td>' +
        '<td class="mono">' + ind + ui.esc(t.task_no || t.id) + '</td>' +
        '<td>' + ind + ui.esc(t.task_name) +
          (t.parent_id ? ' <span class="muted-sm">(child)</span>' : '') + '</td>' +
        '<td>' + ui.esc(store.bankName(t.bank_id)) + '</td>' +
        '<td>' + ui.esc(store.picName(t.pic_id)) + '</td>' +
        '<td class="mono nowrap">' + ui.esc(ui.fmtDate(t.start_date)) + '</td>' +
        '<td class="mono nowrap">' + ui.esc(ui.fmtDate(t.end_date)) + '</td>' +
        '<td>' + statusPill(t.status) + '</td>' +
        '<td class="nowrap">' + ui.progressBar(t.progress) + '</td>' +
        '<td class="nowrap">' +
        (store.can('CREATE') ? '<button class="btn btn--sm" data-copy="' + ui.esc(t.id) + '">Copy</button> ' : '') +
        (store.can('UPDATE') ? '<button class="btn btn--sm" data-edit="' + ui.esc(t.id) + '">Edit</button> ' : '') +
        (store.can('DELETE') ? '<button class="btn btn--sm btn--danger" data-del="' + ui.esc(t.id) + '">Hapus</button>' : '') +
        '</td></tr>';
    }).join('');

    // Bulk edit (M-006): hanya untuk yang punya izin UPDATE.
    var selIds = tasks.filter(function (t) { return state.selection[t.id]; }).map(function (t) { return t.id; });
    var bulkBar = store.can('UPDATE')
      ? '<div class="row-actions" style="margin-top:12px;padding-top:10px;border-top:1px solid var(--c-border)">' +
          '<span class="card__hint" id="bulk-count">' + selIds.length + ' task dipilih</span>' +
          ui.select('bulk-status', [{ value: '', label: 'Status — tidak diubah' }].concat(
            store.enums('TASK_STATUS').map(function (s) { return { value: s, label: s }; })), '') +
          '<input class="input" type="number" min="0" max="100" id="bulk-progress" placeholder="Progress % (opsional)" style="max-width:170px">' +
          '<button class="btn btn--sm btn--primary" id="bulk-apply"' + (selIds.length ? '' : ' disabled') + '>Terapkan</button>' +
          '<button class="btn btn--sm" id="bulk-clear"' + (selIds.length ? '' : ' disabled') + '>Batal pilihan</button>' +
        '</div>'
      : '';

    ui.setHtml('view-root',
      '<h1 class="page-title">Tasks</h1>' +
      '<p class="page-sub">Kelola task timeline SNAP BI. Global task = tanpa bank, berlaku untuk semua.</p>' +
      '<div class="card">' +
        '<div class="row-actions">' +
        (store.can('CREATE') ? '<button class="btn btn--primary" id="btn-add-task">+ Tambah Task</button>' : '') +
        '<input class="input" style="max-width:220px" id="task-q" placeholder="Cari task…" value="' + ui.esc(state.filter.q) + '">' +
        ui.select('task-bank', bankOpts, state.filter.bank) +
        ui.select('task-status', statusOpts, state.filter.status) +
        '<label class="chk"><input type="checkbox" id="chk-inactive"' + (state.showInactive ? ' checked' : '') +
        '> Tampilkan non-aktif</label>' +
        '<span class="card__hint" style="margin-left:auto">' + tasks.length + ' / ' + state.tasks.length + ' task</span>' +
        '</div>' +
        (tasks.length
          ? '<table class="tbl"><thead><tr>' +
            '<th class="chk-col"><input type="checkbox" id="chk-all" title="Pilih semua" ' +
            (tasks.length && selIds.length === tasks.length ? 'checked' : '') + '></th>' +
            th('task_no', 'No') + th('task_name', 'Task') + th('bank_id', 'Bank') +
            th('pic_id', 'PIC') + th('start_date', 'Start') + th('end_date', 'End') +
            th('status', 'Status') + th('progress', 'Progress') + '<th>Aksi</th>' +
            '</tr></thead><tbody>' + rows + '</tbody></table>'
          : '<div class="state"><p>Belum ada task yang cocok.</p></div>') +
        bulkBar +
      '</div>');

    bind(tasks);
  }

  function th(key, label) {
    var arrow = state.sort.key === key ? (state.sort.dir === 1 ? ' ▲' : ' ▼') : '';
    return '<th style="cursor:pointer" data-sort="' + key + '">' + label + arrow + '</th>';
  }

  function statusPill(s) {
    var map = {
      TODO: ['TODO', 'warn'], IN_PROGRESS: ['IN PROGRESS', 'ok'],
      BLOCKED: ['BLOCKED', 'fail'], DONE: ['DONE', 'ok'], CANCELLED: ['CANCELLED', 'warn']
    };
    var m = map[s] || [s || '-', 'warn'];
    return ui.pill(m[0], m[1]);
  }

  function bind(tasks) {
    var addBtn = ui.el('btn-add-task');
    if (addBtn) addBtn.addEventListener('click', function () { openForm(null); });

    var q = ui.el('task-q');
    if (q) q.addEventListener('input', function () {
      state.filter.q = q.value; render();
    });
    var bank = ui.el('task-bank');
    if (bank) bank.addEventListener('change', function () {
      state.filter.bank = bank.value; render();
    });
    var st = ui.el('task-status');
    if (st) st.addEventListener('change', function () {
      state.filter.status = st.value; render();
    });
    var chk = ui.el('chk-inactive');
    if (chk) chk.addEventListener('change', function () {
      state.showInactive = chk.checked; load();
    });

    // --- bulk edit (M-006) ---
    Array.prototype.forEach.call(document.querySelectorAll('.chk-task'), function (c) {
      c.addEventListener('change', function () {
        var id = c.getAttribute('data-id');
        if (c.checked) state.selection[id] = true; else delete state.selection[id];
        render();
      });
    });
    var chkAll = ui.el('chk-all');
    if (chkAll) chkAll.addEventListener('change', function () {
      var vis = visibleTasks();
      if (chkAll.checked) vis.forEach(function (t) { state.selection[t.id] = true; });
      else vis.forEach(function (t) { delete state.selection[t.id]; });
      render();
    });
    var bulkApply = ui.el('bulk-apply');
    if (bulkApply) bulkApply.addEventListener('click', function () {
      var ids = visibleTasks().filter(function (t) { return state.selection[t.id]; })
        .map(function (t) { return t.id; });
      if (!ids.length) { ui.toast('Pilih minimal 1 task', true); return; }
      var stSel = ui.el('bulk-status'), prg = ui.el('bulk-progress');
      var payload = {};
      if (stSel && stSel.value) payload.status = stSel.value;
      var pv = prg ? prg.value : '';
      if (pv !== '') {
        var n = Number(pv);
        if (isNaN(n) || n < 0 || n > 100) { ui.toast('Progress harus 0–100', true); return; }
        payload.progress = n;
      }
      if (!payload.status && !payload.progress) { ui.toast('Tentukan status atau progress', true); return; }
      bulkApply.disabled = true;
      api.bulkUpdateTasks(ids, payload).then(function (res) {
        var r = res || {};
        ui.toast((r.updated || 0) + ' task diperbarui' +
          ((r.skipped && r.skipped.length) ? ' · ' + r.skipped.length + ' dilewati (non-aktif/tidak berubah)' : ''));
        state.selection = {};
        return load();
      }).catch(function (e) {
        ui.toast(e.message, true);
        bulkApply.disabled = false;
      });
    });
    var bulkClear = ui.el('bulk-clear');
    if (bulkClear) bulkClear.addEventListener('click', function () {
      state.selection = {};
      render();
    });

    Array.prototype.forEach.call(document.querySelectorAll('[data-sort]'), function (h) {
      h.addEventListener('click', function () {
        var key = h.getAttribute('data-sort');
        if (state.sort.key === key) state.sort.dir *= -1;
        else { state.sort.key = key; state.sort.dir = 1; }
        render();
      });
    });

    Array.prototype.forEach.call(document.querySelectorAll('[data-edit]'), function (btn) {
      btn.addEventListener('click', function () {
        openForm(findById(btn.getAttribute('data-edit')));
      });
    });
    Array.prototype.forEach.call(document.querySelectorAll('[data-copy]'), function (btn) {
      btn.addEventListener('click', function () {
        var t = findById(btn.getAttribute('data-copy'));
        // Copy = buka form create yang terisi data task sumber; task baru baru
        // benar-benar dibuat saat tombol Simpan diklik (bukan saat klik Copy).
        openForm(copyOf(t), true);
      });
    });
    Array.prototype.forEach.call(document.querySelectorAll('[data-del]'), function (btn) {
      btn.addEventListener('click', function () {
        var t = findById(btn.getAttribute('data-del'));
        ui.confirm('Hapus task', '"' + t.task_name + '" akan dihapus (soft delete). Data tetap tersimpan & audit tercatat.',
          function () {
            api.deactivateTask(t.id).then(function () {
              ui.toast('Task dihapus'); return load();
            }).catch(function (e) { ui.toast(e.message, true); });
          }, 'Ya, hapus');
      });
    });
  }

  /* ---------------- M-002 / M-003 / M-005: form ---------------- */

  // Salinan data task untuk mode copy (tanpa id → mode create). Status/progress
  // direset TODO/0; user bebas mengubah di form sebelum Simpan.
  function copyOf(t) {
    return {
      task_name: t.task_name,
      project_id: t.project_id,
      bank_id: t.bank_id,
      parent_id: t.parent_id,
      pic_id: t.pic_id,
      start_date: t.start_date,
      end_date: t.end_date,
      status: 'TODO',
      progress: 0,
      priority: t.priority || '',
      description: t.description || '',
      notes: t.notes || ''
    };
  }

  function openForm(task, isCopy) {
    var isEdit = !!task && !!task.id;
    var t = task || {
      task_name: '', project_id: '', bank_id: '', parent_id: '', pic_id: '',
      start_date: '', end_date: '', status: 'TODO', progress: 0,
      priority: '', description: '', notes: ''
    };

    var projectOpts = store.state.projects.map(function (p) { return { value: p.id, label: p.name }; });
    var bankOpts = [{ value: '', label: 'Global / Semua Bank' }];
    if (!isEdit) {
      bankOpts.push({ value: '__ALL__', label: 'Semua Bank (buat 1 task per bank)' });
    }
    bankOpts = bankOpts.concat(
      store.state.banks.map(function (b) { return { value: b.id, label: b.name }; }));
    var picOpts = store.state.pics.map(function (u) { return { value: u.id, label: u.name }; });
    var statusOpts = store.enums('TASK_STATUS').map(function (s) { return { value: s, label: s }; });
    var prioOpts = [{ value: '', label: '—' }].concat(
      store.enums('PRIORITY').map(function (p) { return { value: p, label: p }; }));

    // M-005: parent candidate = task aktif selain dirinya sendiri & descendant-nya.
    var exclude = new Set();
    if (isEdit) {
      exclude.add(t.id);
      state.tasks.forEach(function (x) {
        if (isDescendant(x.id, t.id)) exclude.add(x.id);
      });
    }
    var parentOpts = [{ value: '', label: 'No Parent' }].concat(
      state.tasks.filter(function (x) { return x.is_active && !exclude.has(x.id); })
        .map(function (x) { return { value: x.id, label: (x.task_no || x.id) + ' — ' + x.task_name }; }));

    ui.modal({
      title: isCopy ? 'Copy Task — ' + t.task_name
        : (isEdit ? 'Edit Task — ' + t.task_name : 'Tambah Task'),
      okLabel: isCopy ? 'Simpan salinan' : (isEdit ? 'Simpan perubahan' : 'Simpan task'),
      body:
        ui.field('Nama Task *', ui.input('task_name', t.task_name, 'placeholder="Register Whitelist IP"')) +
        ui.field('Project *', ui.select('project_id', projectOpts, t.project_id)) +
        ui.field('Bank', ui.select('bank_id', bankOpts, t.bank_id),
          'Kosongkan untuk global task (berlaku semua bank).') +
        ui.field('Parent Task', ui.select('parent_id', parentOpts, t.parent_id),
          'Untuk membuat child task (parent/child).') +
        ui.field('PIC *', ui.select('pic_id', picOpts, t.pic_id)) +
        '<div style="display:flex;gap:12px">' +
          '<div style="flex:1">' + ui.field('Start Date *', ui.input('start_date', t.start_date, 'type="date"')) + '</div>' +
          '<div style="flex:1">' + ui.field('End Date *', ui.input('end_date', t.end_date, 'type="date"')) + '</div>' +
        '</div>' +
        '<div style="display:flex;gap:12px">' +
          '<div style="flex:1">' + ui.field('Status *', ui.select('status', statusOpts, t.status)) + '</div>' +
          '<div style="flex:1">' + ui.field('Progress * (0–100)', ui.input('progress', t.progress, 'type="number" min="0" max="100"')) + '</div>' +
          '<div style="flex:1">' + ui.field('Priority', ui.select('priority', prioOpts, t.priority)) + '</div>' +
        '</div>' +
        ui.field('Description', ui.textarea('description', t.description, 2)) +
        ui.field('Notes', ui.textarea('notes', t.notes, 2)),
      onOk: function (body) {
        var p = ui.readForm(body);
        p.progress = Number(p.progress);
        var req = isEdit ? api.updateTask(t.id, p) : api.createTask(p);
        req.then(function (saved) {
          if (saved && saved.allBanks) {
            ui.toast('Dibuat ' + saved.count + ' task untuk ' + saved.count + ' bank');
          } else if (isCopy) {
            ui.toast('Task disalin: "' + saved.task_name + '"');
          } else {
            ui.toast('Task "' + saved.task_name + '" ' + (isEdit ? 'diperbarui' : 'ditambahkan'));
          }
          return load();
        }).catch(function (e) { ui.toast(e.message, true); });
      }
    });
  }

  /* ---------------- helpers ---------------- */

  function findById(id) {
    for (var i = 0; i < state.tasks.length; i++) {
      if (String(state.tasks[i].id) === String(id)) return state.tasks[i];
    }
    return null;
  }

  // apakah `nodeId` adalah descendant (anak/cucu) dari `ancestorId`
  function isDescendant(ancestorId, nodeId) {
    var cur = findById(nodeId);
    var seen = {};
    while (cur && cur.parent_id) {
      if (seen[cur.id]) return false;
      seen[cur.id] = true;
      if (String(cur.parent_id) === String(ancestorId)) return true;
      cur = findById(cur.parent_id);
    }
    return false;
  }
});
