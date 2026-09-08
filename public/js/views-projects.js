
/* ============================================================
 * views-projects.html — Projects master (TASK D-003 UI).
 * ============================================================ */
views.register('projects', function () {
  ui.loading('view-root', 'Memuat data project…');

  var showInactive = false;
  render();

  function render() {
    api.getProjects(showInactive).then(function (projects) {
      ui.setHtml('view-root',
        '<h1 class="page-title">Projects</h1>' +
        '<p class="page-sub">Project adalah wadah task. SNAP BI merupakan project utama saat ini.</p>' +
        '<div class="card">' +
        '<div class="row-actions">' +
        (store.can('CREATE') ? '<button class="btn btn--primary" id="btn-add-project">+ Tambah Project</button>' : '') +
        '<label class="chk"><input type="checkbox" id="chk-inactive-prj"' + (showInactive ? ' checked' : '') +
        '> Tampilkan project non-aktif</label>' +
        '<span class="card__hint">Total ditampilkan: ' + projects.length + ' project</span>' +
        '</div>' +
        (projects.length ? table(projects) : '<div class="state"><p>Belum ada project.</p></div>') +
        '</div>');
      bind(projects);
    }).catch(function (err) { ui.error('view-root', err.message); });
  }

  function table(projects) {
    var rows = projects.map(function (p) {
      return '<tr>' +
        '<td class="mono">' + ui.esc(p.id) + '</td>' +
        '<td class="mono">' + ui.esc(p.code) + '</td>' +
        '<td>' + ui.esc(p.name) + '<div class="muted-sm">' + ui.esc(p.description) + '</div></td>' +
        '<td class="mono">' + ui.esc(ui.fmtDate(p.start_date)) + '</td>' +
        '<td class="mono">' + ui.esc(ui.fmtDate(p.end_date)) + '</td>' +
        '<td>' + ui.esc(p.status) + '</td>' +
        '<td>' + (p.is_active ? ui.pill('AKTIF', 'ok') : ui.pill('NON-AKTIF', 'warn')) + '</td>' +
        '<td class="nowrap">' +
        (store.can('UPDATE') ? '<button class="btn btn--sm" data-edit-prj="' + ui.esc(p.id) + '">Edit</button> ' : '') +
        (store.can('DELETE') && p.is_active
          ? '<button class="btn btn--sm btn--danger" data-off-prj="' + ui.esc(p.id) + '">Non-aktifkan</button>' : '') +
        (store.can('UPDATE') && !p.is_active
          ? '<button class="btn btn--sm" data-on-prj="' + ui.esc(p.id) + '">Aktifkan</button>' : '') +
        '</td></tr>';
    }).join('');

    return '<table class="tbl"><thead><tr>' +
      '<th>ID</th><th>Code</th><th>Nama</th><th>Mulai</th><th>Selesai</th><th>Status</th><th>Aktif</th><th>Aksi</th>' +
      '</tr></thead><tbody>' + rows + '</tbody></table>';
  }

  function bind(projects) {
    var chk = ui.el('chk-inactive-prj');
    if (chk) chk.addEventListener('change', function () { showInactive = chk.checked; render(); });

    var add = ui.el('btn-add-project');
    if (add) add.addEventListener('click', function () { openForm(null); });

    each('[data-edit-prj]', function (btn) {
      openForm(find(projects, btn.getAttribute('data-edit-prj')));
    });

    each('[data-off-prj]', function (btn) {
      var p = find(projects, btn.getAttribute('data-off-prj'));
      ui.confirm('Non-aktifkan project',
        'Project "' + p.name + '" akan dinonaktifkan (soft delete).',
        function () {
          api.deactivateProject(p.id).then(function () {
            ui.toast('Project dinonaktifkan');
            return store.refreshMasters();
          }).then(render).catch(function (e) { ui.toast(e.message, true); });
        }, 'Ya, non-aktifkan');
    });

    each('[data-on-prj]', function (btn) {
      var p = find(projects, btn.getAttribute('data-on-prj'));
      api.updateProject(p.id, { is_active: true }).then(function () {
        ui.toast('Project diaktifkan');
        return store.refreshMasters();
      }).then(render).catch(function (e) { ui.toast(e.message, true); });
    });
  }

  function openForm(project) {
    var isEdit = !!project;
    var p = project || { code: '', name: '', description: '', start_date: '', end_date: '', status: 'ACTIVE' };
    var statusOptions = store.enums('PROJECT_STATUS').map(function (s) { return { value: s, label: s }; });

    ui.modal({
      title: isEdit ? 'Edit Project — ' + p.name : 'Tambah Project',
      okLabel: isEdit ? 'Simpan perubahan' : 'Simpan project',
      body:
        ui.field('Code *', ui.input('code', p.code, 'placeholder="SNAPBI" maxlength="20"'), 'Unik, tanpa spasi.') +
        ui.field('Nama Project *', ui.input('name', p.name, 'placeholder="SNAP BI"')) +
        ui.field('Deskripsi', ui.textarea('description', p.description, 3)) +
        ui.field('Tanggal Mulai', ui.input('start_date', p.start_date, 'type="date"')) +
        ui.field('Tanggal Selesai', ui.input('end_date', p.end_date, 'type="date"'), 'Harus >= tanggal mulai.') +
        ui.field('Status *', ui.select('status', statusOptions, p.status)),
      onOk: function (body) {
        var payload = ui.readForm(body);
        var req = isEdit ? api.updateProject(p.id, payload) : api.createProject(payload);
        req.then(function (saved) {
          ui.toast('Project ' + saved.name + (isEdit ? ' diperbarui' : ' ditambahkan'));
          return store.refreshMasters();
        }).then(render).catch(function (e) { ui.toast(e.message, true); });
      }
    });
  }

  function each(selector, fn) {
    Array.prototype.forEach.call(document.querySelectorAll(selector), function (node) {
      node.addEventListener('click', function () { fn(node); });
    });
  }

  function find(list, id) {
    for (var i = 0; i < list.length; i++) if (String(list[i].id) === String(id)) return list[i];
    return null;
  }
});
