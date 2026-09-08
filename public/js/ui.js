
/* ============================================================
 * ui.html — helper UI: escaping, state (loading/error/empty),
 * toast, modal, form builder kecil. Tanpa business rule.
 * ============================================================ */
var ui = (function () {

  function el(id) { return document.getElementById(id); }

  function esc(v) {
    return String(v === null || v === undefined ? '' : v)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function setHtml(targetId, html) { el(targetId).innerHTML = html; }

  function loading(targetId, message) {
    setHtml(targetId,
      '<div class="state state--loading"><span class="spinner"></span><p>' +
      esc(message || 'Memuat…') + '</p></div>');
  }

  function error(targetId, message, onRetry) {
    setHtml(targetId,
      '<div class="state state--error"><p><strong>Terjadi kesalahan</strong></p>' +
      '<p class="mono">' + esc(message) + '</p>' +
      '<div class="state__actions"><button class="btn" id="btn-retry">Coba lagi</button></div></div>');
    var b = el('btn-retry');
    if (b) b.addEventListener('click', onRetry || function () { router.reload(); });
  }

  function empty(targetId, message) {
    setHtml(targetId, '<div class="state"><p>' + esc(message || 'Belum ada data.') + '</p></div>');
  }

  var toastTimer = null;
  function toast(message, isError) {
    var t = el('toast');
    t.textContent = message;
    t.className = 'toast' + (isError ? ' toast--error' : '');
    t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.hidden = true; }, 4500);
  }

  /* ---------- modal ---------- */

  /**
   * @param {{title: string, body: string, okLabel: (string|undefined),
   *          wide: (boolean|undefined),   // true → modal lebar (.modal--wide)
   *          hideCancel: (boolean|undefined), // true → tanpa tombol Batal
   *          onOk: function(!HTMLElement):(boolean|undefined)}} opts
   */
  function modal(opts) {
    var host = el('modal-host');
    host.innerHTML =
      '<div class="modal-backdrop" id="modal-backdrop">' +
      '  <div class="modal' + (opts.wide ? ' modal--wide' : '') + '" role="dialog" aria-modal="true">' +
      '    <div class="modal__head">' +
      '      <h3 class="modal__title">' + esc(opts.title) + '</h3>' +
      '      <button class="modal__close" id="modal-x" aria-label="Tutup">&times;</button>' +
      '    </div>' +
      '    <div class="modal__body" id="modal-body">' + opts.body + '</div>' +
      '    <div class="modal__foot">' +
      (opts.hideCancel ? '' : '<button class="btn" id="modal-cancel">Batal</button>') +
      '      <button class="btn btn--primary" id="modal-ok">' + esc(opts.okLabel || 'Simpan') + '</button>' +
      '    </div>' +
      '  </div>' +
      '</div>';

    function close() { host.innerHTML = ''; }
    el('modal-x').addEventListener('click', close);
    var cancel = el('modal-cancel');
    if (cancel) cancel.addEventListener('click', close);
    el('modal-backdrop').addEventListener('click', function (ev) {
      if (ev.target && ev.target.id === 'modal-backdrop') close();
    });
    el('modal-ok').addEventListener('click', function () {
      var keepOpen = opts.onOk && opts.onOk(el('modal-body')) === false;
      if (!keepOpen) close();
    });
    return { close: close };
  }

  function confirmDialog(title, message, onYes, yesLabel) {
    return modal({
      title: title,
      body: '<p>' + esc(message) + '</p>',
      okLabel: yesLabel || 'Ya, lanjutkan',
      onOk: function () { onYes(); }
    });
  }

  /* ---------- form helpers ---------- */

  function field(label, inputHtml, hint) {
    return '<label class="field"><span class="field__label">' + esc(label) + '</span>' +
      inputHtml + (hint ? '<span class="field__hint">' + esc(hint) + '</span>' : '') + '</label>';
  }

  function input(name, value, attrs) {
    return '<input class="input" name="' + esc(name) + '" value="' + esc(value === null || value === undefined ? '' : value) +
      '" ' + (attrs || '') + '>';
  }

  function textarea(name, value, rows) {
    return '<textarea class="input" name="' + esc(name) + '" rows="' + (rows || 3) + '">' +
      esc(value === null || value === undefined ? '' : value) + '</textarea>';
  }

  /**
   * @param {string} name (dipakai sebagai name DAN id supaya ui.el() bisa
   *        menemukan elemen ini — sebelumnya hanya name, ui.el() → null)
   * @param {!Array<{value: string, label: string}>} options
   * @param {string} selected
   * @return {string}
   */
  function select(name, options, selected) {
    return '<select class="input" name="' + esc(name) + '" id="' + esc(name) + '">' +
      options.map(function (o) {
        return '<option value="' + esc(o.value) + '"' +
          (String(o.value) === String(selected === null || selected === undefined ? '' : selected) ? ' selected' : '') +
          '>' + esc(o.label) + '</option>';
      }).join('') + '</select>';
  }

  /** Reads a form-ish container into a plain object. */
  function readForm(container) {
    var out = {};
    Array.prototype.forEach.call(container.querySelectorAll('[name]'), function (node) {
      if (node.type === 'checkbox') out[node.name] = node.checked;
      else out[node.name] = node.value;
    });
    return out;
  }

  function pill(text, kind) {
    return '<span class="pill pill--' + kind + '">' + esc(text) + '</span>';
  }

  function progressBar(percent) {
    var p = Math.max(0, Math.min(100, Number(percent) || 0));
    return '<div class="bar"><div class="bar__fill" style="width:' + p + '%"></div></div>' +
      '<span class="bar__label">' + p.toFixed(0) + '%</span>';
  }

  /* ---------- date formatting ---------- */

  var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  /**
   * Format tanggal ISO (YYYY-MM-DD atau datetime) → '17-Aug-2026'.
   * @param {string} iso
   * @param {boolean=} withTime true → '17-Aug-2026 10:51'
   * @return {string}
   */
  function fmtDate(iso, withTime) {
    if (!iso) return '—';
    var m = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}))?/.exec(iso);
    if (!m) return String(iso);
    var d = ('0' + parseInt(m[3], 10)).slice(-2);
    var mo = parseInt(m[2], 10) - 1;
    var out = d + '-' + (MONTHS[mo] || m[2]) + '-' + m[1];
    if (withTime && m[4]) out += ' ' + m[4] + ':' + m[5];
    return out;
  }

  return {
    el: el, esc: esc, setHtml: setHtml,
    loading: loading, error: error, empty: empty, toast: toast,
    modal: modal, confirm: confirmDialog,
    field: field, input: input, textarea: textarea, select: select,
    readForm: readForm, pill: pill, progressBar: progressBar,
    fmtDate: fmtDate
  };
})();
