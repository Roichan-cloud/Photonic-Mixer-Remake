// Menyiapkan folder www/ untuk APK (Capacitor) dan EXE (Electron).
//  - www/app.html  : salinan lengkap aplikasi (dipakai saat OFFLINE)
//  - www/index.html: peluncur kecil. Kalau website online (alamat di app-url.txt) -> buka website
//                    supaya selalu versi terbaru. Kalau offline -> buka app.html.
//  - Library CDN diunduh ke www/vendor supaya app.html bisa jalan tanpa internet.
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'www');
const SKIP = new Set([
  'node_modules', 'android', 'www', 'desktop', '.git', '.github', 'scripts', 'assets',
  'sw.js', 'manifest.json', 'package.json', 'package-lock.json', 'capacitor.config.json',
  'firestore.rules', 'README.md', 'chat-rules.txt', 'edgeone.json', '.gitignore'
]);

function copyDir(src, dst) {
  fs.mkdirSync(dst, { recursive: true });
  for (const name of fs.readdirSync(src)) {
    if (src === ROOT && SKIP.has(name)) continue;
    if (name.startsWith('.')) continue;
    const s = path.join(src, name), d = path.join(dst, name);
    if (fs.statSync(s).isDirectory()) copyDir(s, d);
    else fs.copyFileSync(s, d);
  }
}

function readAppUrl() {
  try {
    let u = fs.readFileSync(path.join(ROOT, 'app-url.txt'), 'utf8').trim().split(/\s+/)[0];
    if (!u) return '';
    if (!/^https?:\/\//i.test(u)) u = 'https://' + u;
    return new URL(u).href;
  } catch (e) { return ''; }
}

async function vendorize(htmlFile) {
  let html = fs.readFileSync(htmlFile, 'utf8');
  const re = /<script([^>]*?)src="(https:\/\/[^"]+\.js)"([^>]*)>/g;
  const urls = new Set();
  let m;
  while ((m = re.exec(html))) urls.add(m[2]);
  const vend = path.join(OUT, 'vendor');
  fs.mkdirSync(vend, { recursive: true });
  let i = 0;
  for (const url of urls) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const name = (++i) + '-' + url.split('/').pop().replace(/[^\w.\-]/g, '_');
      fs.writeFileSync(path.join(vend, name), Buffer.from(await res.arrayBuffer()));
      html = html.split('src="' + url + '"').join('src="vendor/' + name + '"');
      console.log('vendor ok  :', url);
    } catch (e) {
      console.warn('vendor SKIP:', url, '-', e.message, '(tetap pakai CDN)');
    }
  }
  fs.writeFileSync(htmlFile, html);
}

function launcherHtml(remote) {
  return `<!DOCTYPE html>
<html lang="id"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>Ian Lighting</title>
<style>
html,body{margin:0;height:100%;background:#000;color:#0f0;font-family:sans-serif}
body{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px}
img{width:96px;height:96px;border-radius:22px}
.s{width:26px;height:26px;border:3px solid #0a3;border-top-color:#0f0;border-radius:50%;animation:r 0.9s linear infinite}
@keyframes r{to{transform:rotate(360deg)}}
</style></head><body>
<img src="app.png" alt=""><div class="s"></div>
<script>
(function () {
  var REMOTE = ${JSON.stringify(remote)};
  function offline() { location.replace('app.html'); }
  if (!REMOTE) return offline();
  var ctl = ('AbortController' in window) ? new AbortController() : null;
  var t = setTimeout(function () { if (ctl) ctl.abort(); offline(); }, 4000);
  fetch(REMOTE, { method: 'HEAD', mode: 'no-cors', cache: 'no-store', signal: ctl ? ctl.signal : undefined })
    .then(function () { clearTimeout(t); location.replace(REMOTE); })
    .catch(function () { clearTimeout(t); offline(); });
})();
</script></body></html>`;
}

(async () => {
  fs.rmSync(OUT, { recursive: true, force: true });
  copyDir(ROOT, OUT);
  const idx = path.join(OUT, 'index.html');
  if (!fs.existsSync(idx)) { console.error('index.html tidak ditemukan di root repo'); process.exit(1); }

  const app = path.join(OUT, 'app.html');
  fs.renameSync(idx, app);
  await vendorize(app);

  const remote = readAppUrl();
  console.log('Alamat website:', remote || '(kosong: hanya mode bundel)');
  fs.writeFileSync(idx, launcherHtml(remote));

  // Izinkan WebView Capacitor membuka website (tanpa ini dibuka di browser luar)
  if (remote) {
    const cfgPath = path.join(ROOT, 'capacitor.config.json');
    const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
    const host = new URL(remote).host;
    cfg.server = Object.assign({}, cfg.server, { allowNavigation: [host] });
    fs.writeFileSync(cfgPath, JSON.stringify(cfg, null, 2));
    console.log('allowNavigation:', host);
  }
  console.log('www siap:', fs.readdirSync(OUT).length, 'item');
})();
