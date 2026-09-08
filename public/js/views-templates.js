
/* ============================================================
 * views-templates.html — Task Template & Bulk Creation
 * (TASK TMP-001, TMP-002, TMP-003).
 *
 * TMP-001: daftar template + editor (code/name/desc + items).
 * TMP-002: apply template ke bank terpilih (bulk create).
 * TMP-003: duplicate protection ditangani backend (task_no deterministik).
 * ============================================================ */
views.register('templates', function () {

  ui.loading('view-root', 'Memuat template…');

  load();

  function load() {
    Promise.all([api.getTemplates(true), store.refreshMasters()]).then(function (res) {
      render(res[0] || []);
    }).catch(function (err) { ui.error('view-root', err.message); });
  }

  function render(templates) {
    var rows = templates.map(function (t) {
      return '<tr>' +
        '<td class="mono">' + ui.esc(t.code) + '</td>' +
        '<td>' + ui.esc(t.name) + '</td>' +
        '<td>' + t.itemCount + '</td>' +
        '<td>' + (t.active ? ui.pill('AKTIF', 'ok') : ui.pill('NON-AKTIF', 'warn')) + '</td>' +
        '<td class="nowrap">' +
        (store.can('CREATE') ? '<button class="btn btn--sm btn--primary" data-apply="' + ui.esc(t.id) + '">Apply</button> ' : '') +
        (store.can('UPDATE') ? '<button class="btn btn--sm" data-edit="' + ui.esc(t.id) + '">Edit</button> ' : '') +
        (store.can('DELETE') && t.active ? '<button class="btn btn--sm btn--danger" data-off="' + ui.esc(t.id) + '">Non-aktifkan</button>' : '') +
        '</td></tr>';
    }).join('');

    ui.setHtml('view-root',
      '<h1 class="page-title">Templates</h1>' +
      '<p class="page-sub">Template task untuk bulk creation. Apply template ke beberapa bank sekaligus.</p>' +
      '<div class="card">' +
        '<div class="row-actions">' +
        (store.can('CREATE') ? '<button class="btn btn--primary" id="btn-add-tpl">+ Tambah Template</button>' : '') +
        '<span class="card__hint" style="margin-left:auto">' + templates.length + ' template</span>' +
        '</div>' +
        (templates.length
          ? '<table class="tbl"><thead><tr><th>Code</th><th>Nama</th><th>Item</th><th>Status</th><th>Aksi</th></tr></thead>' +
            '<tbody>' + rows + '</tbody></table>'
          : '<div class="state"><p>Belum ada template.</p></div>') +
      '</div>');

    bind(templates);
  }

  function bind(templates) {
    var addBtn = ui.el('btn-add-tpl');
    if (addBtn) addBtn.addEventListener('click', function () { openForm(null); });

    Array.prototype.forEach.call(document.querySelectorAll('[data-edit]'), function (btn) {
      btn.addEventListener('click', function () {
        var t = find(templates, btn.getAttribute('data-edit'));
        api.getTemplate(t.id).then(function (full) { openForm(full); })
          .catch(function (e) { ui.toast(e.message, true); });
      });
    });

    Array.prototype.forEach.call(document.querySelectorAll('[data-apply]'), function (btn) {
      btn.addEventListener('click', function () {
        var t = find(templates, btn.getAttribute('data-apply'));
        openApply(t);
      });
    });

    Array.prototype.forEach.call(document.querySelectorAll('[data-off]'), function (btn) {
      btn.addEventListener('click', function () {
        var t = find(templates, btn.getAttribute('data-off'));
        ui.confirm('Non-aktifkan template', 'Template "' + t.name + '" akan dinonaktifkan.',
          function () {
            api.deactivateTemplate(t.id).then(function () {
              ui.toast('Template dinonaktifkan'); return load();
            }).catch(function (e) { ui.toast(e.message, true); });
          }, 'Ya, non-aktifkan');
      });
    });
  }

  /* ---------------- TMP-001: editor ---------------- */

  function openForm(tpl) {
    var isEdit = !!tpl;
    var t = tpl || { code: '', name: '', description: '', items: [] };
    var items = t.items || [];

    var itemRows = items.map(function (it, i) {
      return '<div class="tpl-item" data-idx="' + i + '">' +
        '<input class="input" style="max-width:80px" name="it_seq_' + i + '" value="' + ui.esc(it.seq) + '" placeholder="Seq" type="number" min="1">' +
        '<input class="input" name="it_name_' + i + '" value="' + ui.esc(it.task_name) + '" placeholder="Nama task">' +
        '<input class="input" style="max-width:110px" name="it_days_' + i + '" value="' + ui.esc(it.duration_days) + '" placeholder="Hari" type="number" min="1">' +
        '<button class="btn btn--sm btn--danger" data-rm-item="' + i + '">×</button>' +
        '</div>';
    }).join('');

    ui.modal({
      title: isEdit ? 'Edit Template — ' + t.name : 'Tambah Template',
      okLabel: isEdit ? 'Simpan perubahan' : 'Simpan template',
      body:
        ui.field('Code *', ui.input('code', t.code, 'placeholder="SNAPBANK"'),
          'Huruf/angka tanpa spasi, unik.') +
        ui.field('Nama Template *', ui.input('name', t.name, 'placeholder="SNAP BI Standard Bank"')) +
        ui.field('Deskripsi', ui.textarea('description', t.description, 2)) +
        '<div class="field"><span class="field__label">Item Task</span>' +
        '<div id="tpl-items">' + (itemRows || '') + '</div>' +
        '<button class="btn btn--sm" id="btn-add-item" type="button">+ Tambah item</button></div>',
      onOk: function (body) {
        var base = ui.readForm(body);
        var payload = { code: base.code, name: base.name, description: base.description, items: [] };
        var i = 0;
        while (body.querySelector('[name="it_name_' + i + '"]')) {
          var name = body.querySelector('[name="it_name_' + i + '"]').value;
          if (String(name).trim()) {
            payload.items.push({
              seq: toNumEl(body.querySelector('[name="it_seq_' + i + '"]'), i + 1),
              task_name: name,
              duration_days: toNumEl(body.querySelector('[name="it_days_' + i + '"]'), 1)
            });
          }
          i++;
        }
        if (!payload.items.length) {
          ui.toast('Template butuh minimal satu item.', true);
          return false;   // keep modal open
        }
        var req = isEdit ? api.updateTemplate(t.id, payload) : api.createTemplate(payload);
        req.then(function () {
          ui.toast('Template tersimpan'); return load();
        }).catch(function (e) { ui.toast(e.message, true); });
        return false;   // close handled by load(); keep open until success
      }
    });

    // bind add/remove item inside modal
    var addItemBtn = ui.el('btn-add-item');
    if (addItemBtn) addItemBtn.addEventListener('click', function () { appendItemRow(); });
    Array.prototype.forEach.call(document.querySelectorAll('[data-rm-item]'), function (btn) {
      btn.addEventListener('click', function () {
        btn.closest('.tpl-item').remove();
      });
    });
  }

  function appendItemRow() {
    var host = ui.el('tpl-items');
    var i = host.children.length;
    // ensure unique index by scanning existing name fields
    while (host.querySelector('[name="it_name_' + i + '"]')) i++;
    var div = document.createElement('div');
    div.className = 'tpl-item';
    div.innerHTML =
      '<input class="input" style="max-width:80px" name="it_seq_' + i + '" value="' + (i + 1) + '" placeholder="Seq" type="number" min="1">' +
      '<input class="input" name="it_name_' + i + '" value="" placeholder="Nama task">' +
      '<input class="input" style="max-width:110px" name="it_days_' + i + '" value="1" placeholder="Hari" type="number" min="1">' +
      '<button class="btn btn--sm btn--danger" type="button">×</button>';
    div.querySelector('button').addEventListener('click', function () { div.remove(); });
    host.appendChild(div);
  }

  /* ---------------- TMP-002: apply ---------------- */

  function openApply(tpl) {
    var bankChecks = store.state.banks.map(function (b) {
      return '<label class="chk"><input type="checkbox" name="bank" value="' + ui.esc(b.id) + '"> ' + ui.esc(b.name) + '</label>';
    }).join('');

    ui.modal({
      title: 'Apply Template — ' + tpl.name,
      okLabel: 'Create Tasks',
      body:
        '<p class="card__hint">Membuat ' + tpl.itemCount + ' task per bank yang dipilih. ' +
        'Apply ulang tidak menduplikasi (protected).</p>' +
        '<div class="field"><span class="field__label">Apply To:</span>' +
        '<div class="tpl-banks">' + (bankChecks || '<p>Belum ada bank aktif.</p>') + '</div></div>',
      onOk: function (body) {
        var bankIds = [];
        Array.prototype.forEach.call(body.querySelectorAll('[name="bank"]:checked'), function (cb) {
          bankIds.push(cb.value);
        });
        if (!bankIds.length) {
          ui.toast('Pilih minimal satu bank.', true);
          return false;
        }
        ui.toast('Membuat task…');
        api.applyTemplate(tpl.id, bankIds).then(function (r) {
          ui.toast('Selesai: ' + r.created + ' task dibuat, ' + r.skipped + ' dilewati (sudah ada).');
        }).catch(function (e) { ui.toast(e.message, true); });
      }
    });
  }

  /* ---------------- helpers ---------------- */

  function toNumEl(node, fallback) {
    var v = node ? Number(node.value) : NaN;
    return isNaN(v) ? fallback : v;
  }

  function find(list, id) {
    for (var i = 0; i < list.length; i++) if (String(list[i].id) === String(id)) return list[i];
    return null;
  }
});
