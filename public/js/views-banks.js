
/* ============================================================
 * views-banks.html — Banks master (TASK D-002 UI).
 * Jumlah bank sepenuhnya dinamis dari database.
 * ============================================================ */
views.register('banks', function () {
  ui.loading('view-root', 'Memuat data bank…');

  var showInactive = false;

  render();

  function render() {
    api.getBanks(showInactive).then(function (banks) {
      ui.setHtml('view-root',
        '<h1 class="page-title">Banks</h1>' +
        '<p class="page-sub">Master bank mitra SNAP BI. Bank non-aktif tidak muncul sebagai pilihan task baru.</p>' +
        '<div class="card">' +
        '<div class="row-actions">' +
        (store.can('CREATE') ? '<button class="btn btn--primary" id="btn-add-bank">+ Tambah Bank</button>' : '') +
        '<label class="chk"><input type="checkbox" id="chk-inactive"' + (showInactive ? ' checked' : '') +
        '> Tampilkan bank non-aktif</label>' +
        '<span class="card__hint">Total ditampilkan: ' + banks.length + ' bank</span>' +
        '</div>' +
        (banks.length ? table(banks) : '<div class="state"><p>Belum ada bank. Tambahkan bank pertama.</p></div>') +
        '</div>');

      bind(banks);
    }).catch(function (err) { ui.error('view-root', err.message); });
  }

  function table(banks) {
    var rows = banks.map(function (b) {
      return '<tr>' +
        '<td class="mono">' + ui.esc(b.id) + '</td>' +
        '<td class="mono">' + ui.esc(b.code) + '</td>' +
        '<td>' + ui.esc(b.name) + '</td>' +
        '<td>' + ui.esc(b.short_name) + '</td>' +
        '<td>' + b.sort_order + '</td>' +
        '<td>' + (b.active ? ui.pill('AKTIF', 'ok') : ui.pill('NON-AKTIF', 'warn')) + '</td>' +
        '<td class="nowrap">' +
        (store.can('UPDATE') ? '<button class="btn btn--sm" data-edit="' + ui.esc(b.id) + '">Edit</button> ' : '') +
        (store.can('DELETE') && b.active
          ? '<button class="btn btn--sm btn--danger" data-off="' + ui.esc(b.id) + '">Non-aktifkan</button>'
          : '') +
        (store.can('UPDATE') && !b.active
          ? '<button class="btn btn--sm" data-on="' + ui.esc(b.id) + '">Aktifkan</button>'
          : '') +
        '</td></tr>';
    }).join('');

    return '<table class="tbl"><thead><tr>' +
      '<th>ID</th><th>Code</th><th>Nama</th><th>Short</th><th>Urut</th><th>Status</th><th>Aksi</th>' +
      '</tr></thead><tbody>' + rows + '</tbody></table>';
  }

  function bind(banks) {
    var chk = ui.el('chk-inactive');
    if (chk) chk.addEventListener('change', function () {
      showInactive = chk.checked;
      render();
    });

    var addBtn = ui.el('btn-add-bank');
    if (addBtn) addBtn.addEventListener('click', function () { openForm(null); });

    Array.prototype.forEach.call(document.querySelectorAll('[data-edit]'), function (btn) {
      btn.addEventListener('click', function () {
        var id = btn.getAttribute('data-edit');
        openForm(find(banks, id));
      });
    });

    Array.prototype.forEach.call(document.querySelectorAll('[data-off]'), function (btn) {
      btn.addEventListener('click', function () {
        var bank = find(banks, btn.getAttribute('data-off'));
        ui.confirm('Non-aktifkan bank',
          'Bank "' + bank.name + '" akan dinonaktifkan (soft delete). Data tetap tersimpan dan task lama tidak hilang.',
          function () {
            api.deactivateBank(bank.id).then(function () {
              ui.toast('Bank ' + bank.name + ' dinonaktifkan');
              return store.refreshMasters();
            }).then(render).catch(function (e) { ui.toast(e.message, true); });
          }, 'Ya, non-aktifkan');
      });
    });

    Array.prototype.forEach.call(document.querySelectorAll('[data-on]'), function (btn) {
      btn.addEventListener('click', function () {
        var bank = find(banks, btn.getAttribute('data-on'));
        api.activateBank(bank.id).then(function () {
          ui.toast('Bank ' + bank.name + ' diaktifkan');
          return store.refreshMasters();
        }).then(render).catch(function (e) { ui.toast(e.message, true); });
      });
    });
  }

  function openForm(bank) {
    var isEdit = !!bank;
    var b = bank || { code: '', name: '', short_name: '', sort_order: '' };

    ui.modal({
      title: isEdit ? 'Edit Bank — ' + b.name : 'Tambah Bank',
      okLabel: isEdit ? 'Simpan perubahan' : 'Simpan bank',
      body:
        ui.field('Code *', ui.input('code', b.code, 'placeholder="BANKF" maxlength="20"'),
          'Huruf/angka tanpa spasi, harus unik.') +
        ui.field('Nama Bank *', ui.input('name', b.name, 'placeholder="Bank F"')) +
        ui.field('Nama Pendek', ui.input('short_name', b.short_name, 'placeholder="Bank F"')) +
        ui.field('Urutan Tampil', ui.input('sort_order', b.sort_order, 'type="number" min="0"'),
          'Kosongkan untuk otomatis di urutan terakhir.'),
      onOk: function (body) {
        var payload = ui.readForm(body);
        var p = isEdit ? api.updateBank(b.id, payload) : api.createBank(payload);
        p.then(function (saved) {
          ui.toast('Bank ' + saved.name + (isEdit ? ' diperbarui' : ' ditambahkan'));
          return store.refreshMasters();
        }).then(render).catch(function (e) { ui.toast(e.message, true); });
      }
    });
  }

  function find(list, id) {
    for (var i = 0; i < list.length; i++) if (String(list[i].id) === String(id)) return list[i];
    return null;
  }
});
