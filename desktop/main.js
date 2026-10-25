const { app, BrowserWindow, net, Menu } = require('electron');
const fs = require('fs');
const path = require('path');

function readRemote() {
  try {
    let u = fs.readFileSync(path.join(__dirname, 'www', 'app-url.txt'), 'utf8').trim().split(/\s+/)[0];
    if (!u) return '';
    if (!/^https?:\/\//i.test(u)) u = 'https://' + u;
    return new URL(u).href;
  } catch (e) { return ''; }
}

async function isOnline(url) {
  if (!url) return false;
  try {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), 4000);
    const r = await net.fetch(url, { method: 'HEAD', signal: ctl.signal });
    clearTimeout(t);
    return r.status < 500;
  } catch (e) { return false; }
}

async function createWindow() {
  Menu.setApplicationMenu(null);
  const win = new BrowserWindow({
    width: 1366, height: 800, backgroundColor: '#000000', show: false,
    webPreferences: { contextIsolation: true, autoplayPolicy: 'no-user-gesture-required' }
  });
  win.once('ready-to-show', () => { win.maximize(); win.show(); });
  // Popup (layar kedua) boleh dibuka
  win.webContents.setWindowOpenHandler(() => ({ action: 'allow' }));

  const remote = readRemote();
  if (await isOnline(remote)) win.loadURL(remote);
  else win.loadFile(path.join(__dirname, 'www', 'app.html'));
}

app.whenReady().then(createWindow);
app.on('window-all-closed', () => app.quit());
      
