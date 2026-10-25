// Menyalin file web dari root repo ke folder www/ (dipakai Capacitor),
// lalu mengunduh library CDN (script) supaya APK bisa jalan tanpa internet.
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'www');
const SKIP = new Set([
  'node_modules', 'android', 'www', '.git', '.github', 'scripts',
  'assets', 'sw.js', 'manifest.json', 'package.json', 'package-lock.json', 'capacitor.config.json',
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

(async () => {
  fs.rmSync(OUT, { recursive: true, force: true });
  copyDir(ROOT, OUT);
  if (!fs.existsSync(path.join(OUT, 'index.html'))) {
    console.error('index.html tidak ditemukan di root repo');
    process.exit(1);
  }
  await vendorize(path.join(OUT, 'index.html'));
  console.log('www siap:', fs.readdirSync(OUT).length, 'item');
})();
