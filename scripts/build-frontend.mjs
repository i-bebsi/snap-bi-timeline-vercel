// build-frontend.mjs — konversi partial Apps Script (*.html berisi <script>/<style>)
// menjadi aset statis public/ (js + css). api.html & app.html TIDAK dikonversi
// (ditulis ulang manual: api.js pakai fetch, app.js boot + auth UI).

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const GAS = '/Users/bsi-2500011/Project/AI/app-script-implement-snap/src';
const PUBLIC = '/Users/bsi-2500011/Project/AI/snap-bi-timeline-vercel/public';

mkdirSync(join(PUBLIC, 'js'), { recursive: true });
mkdirSync(join(PUBLIC, 'css'), { recursive: true });

function strip(src, tag) {
  const open = `<${tag}>`;
  const close = `</${tag}>`;
  const i = src.indexOf(open);
  const j = src.lastIndexOf(close);
  if (i === -1 || j === -1) throw new Error('missing tag ' + tag);
  return src.slice(i + open.length, j);
}

// styles.html -> css
const styles = readFileSync(join(GAS, 'styles.html'), 'utf8');
writeFileSync(join(PUBLIC, 'css', 'styles.css'), strip(styles, 'style'));

// script partials -> js
// (views-settings ditulis manual di public/js/views-settings.js — adaptasi Supabase)
const scriptPartials = [
  'ui', 'store', 'router',
  'views-dashboard', 'views-timeline', 'views-tasks', 'views-templates',
  'views-banks', 'views-projects',
];
for (const name of scriptPartials) {
  const src = readFileSync(join(GAS, name + '.html'), 'utf8');
  writeFileSync(join(PUBLIC, 'js', name + '.js'), strip(src, 'script'));
}

console.log('frontend assets built → public/js + public/css');
