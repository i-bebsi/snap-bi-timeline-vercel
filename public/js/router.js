
/* ============================================================
 * router.html — navigasi sidebar + registry view (TASK UI-001)
 *
 * Setiap file views-*.html mendaftarkan dirinya:
 *   views.register('banks', function(){ ... });
 * ============================================================ */
var views = (function () {
  var registry = {};
  return {
    register: function (id, renderFn) { registry[id] = renderFn; },
    get: function (id) { return registry[id]; },
    has: function (id) { return !!registry[id]; }
  };
})();

var router = (function () {

  var MENU = [
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'timeline', label: 'Timeline' },
    { id: 'tasks', label: 'Tasks' },
    { id: 'templates', label: 'Templates' },
    { id: 'banks', label: 'Banks' },
    { id: 'projects', label: 'Projects' },
    { id: 'settings', label: 'Settings' }
  ];

  var current = 'dashboard';

  /** @return {!Array<string>} id menu yang boleh dilihat role saat ini. */
  function allowedMenu() {
    var menu = store.state.appInfo && store.state.appInfo.menu;
    if (Array.isArray(menu) && menu.length) return menu;
    return MENU.map(function (m) { return m.id; });   // fallback: semua (appInfo belum dimuat)
  }

  function renderNav() {
    var allowed = allowedMenu();
    var items = MENU.filter(function (m) { return allowed.indexOf(m.id) !== -1; });
    ui.el('nav').innerHTML = items.map(function (m) {
      return '<button class="nav__item' + (m.id === current ? ' is-active' : '') +
        '" data-route="' + m.id + '">' + ui.esc(m.label) + '</button>';
    }).join('');
    Array.prototype.forEach.call(document.querySelectorAll('.nav__item'), function (btn) {
      btn.addEventListener('click', function () { go(btn.getAttribute('data-route')); });
    });
  }

  function go(route) {
    // Blokir navigasi langsung ke menu di luar hak role (mis. via hash/debug).
    if (allowedMenu().indexOf(route) === -1) route = 'dashboard';
    current = route;
    renderNav();
    if (!views.has(route)) {
      ui.setHtml('view-root',
        '<h1 class="page-title">' + ui.esc(labelOf(route)) + '</h1>' +
        '<div class="state"><p>Halaman ini belum diimplementasikan pada fase saat ini.</p>' +
        '<p class="mono">route: ' + ui.esc(route) + '</p></div>');
      return;
    }
    try {
      views.get(route)();
    } catch (e) {
      ui.error('view-root', e && e.message ? e.message : String(e));
    }
  }

  function labelOf(route) {
    for (var i = 0; i < MENU.length; i++) if (MENU[i].id === route) return MENU[i].label;
    return route;
  }

  function reload() { go(current); }

  return {
    MENU: MENU,
    renderNav: renderNav,
    go: go,
    reload: reload,
    labelOf: labelOf,
    current: function () { return current; }
  };
})();
