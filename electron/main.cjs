// Desktop shell: serves dist/ over a private app:// scheme (ES modules and
// localStorage need a real origin, which file:// does not give), provides UDP
// sockets for LAN play and installs updates from GitHub Releases on request.
const { app, BrowserWindow, Menu, clipboard, ipcMain, nativeImage, net, protocol, shell } = require('electron');
const { spawn } = require('node:child_process');
const dgram = require('node:dgram');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const ROOT = path.join(__dirname, '..', 'dist');
const RELEASES = 'https://github.com/Nekorak/Another-Dino/releases';

protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true } },
]);

let win = null;

function createWindow() {
  win = new BrowserWindow({
    width: 1280,
    height: 720,
    minWidth: 480,
    minHeight: 320,
    title: 'Another Dino',
    backgroundColor: '#9fdcff',
    icon: path.join(__dirname, '..', 'build', 'icon.png'),
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      sandbox: true,
      preload: path.join(__dirname, 'preload.cjs'),
    },
  });
  win.webContents.on('before-input-event', (event, input) => {
    if (input.type !== 'keyDown') return;
    if (input.key === 'F11' || (input.key === 'Enter' && input.alt)) {
      win.setFullScreen(!win.isFullScreen());
      event.preventDefault();
    }
  });
  // links never open inside the game window
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith(RELEASES)) shell.openExternal(url);
    return { action: 'deny' };
  });
  win.on('closed', () => (win = null));
  win.loadURL('app://game/index.html');
}

// ------------------------------------------------------------------ LAN (UDP)
let sock = null;

function broadcastAddresses() {
  const out = new Set(['255.255.255.255']);
  for (const list of Object.values(os.networkInterfaces())) {
    for (const a of list || []) {
      if (a.family !== 'IPv4' || a.internal) continue;
      const ip = a.address.split('.').map(Number);
      const mask = a.netmask.split('.').map(Number);
      out.add(ip.map((b, i) => (b | (~mask[i] & 255)) & 255).join('.'));
    }
  }
  return [...out];
}

function localAddresses() {
  const out = [];
  for (const list of Object.values(os.networkInterfaces())) for (const a of list || []) if (a.family === 'IPv4' && !a.internal) out.push(a.address);
  return out;
}

function closeSocket() {
  if (sock) {
    try {
      sock.close();
    } catch {
      /* already closed */
    }
    sock = null;
  }
}

ipcMain.handle('lan:start', (_e, port) => {
  closeSocket();
  return new Promise((resolve, reject) => {
    const s = dgram.createSocket({ type: 'udp4', reuseAddr: true });
    s.on('message', (msg, rinfo) => {
      if (win) win.webContents.send('lan:message', { data: msg.toString('utf8'), address: rinfo.address, port: rinfo.port });
    });
    s.once('error', (err) => {
      closeSocket();
      reject(err);
    });
    s.bind(Number(port), () => {
      s.setBroadcast(true);
      sock = s;
      resolve();
    });
  });
});
ipcMain.handle('lan:send', (_e, host, port, data) => {
  if (sock) sock.send(String(data), Number(port), String(host));
});
ipcMain.handle('lan:broadcast', (_e, port, data) => {
  if (!sock) return;
  for (const addr of broadcastAddresses()) sock.send(String(data), Number(port), addr, () => {});
});
ipcMain.handle('lan:addresses', () => localAddresses());
ipcMain.handle('lan:stop', () => closeSocket());

// ------------------------------------------------------------------ updates
// The in-game update button calls update:start. How the new version is put in
// place depends on how the game was installed:
//   nsis / appimage  electron-updater downloads it and restarts into it
//   portable         download the new .exe, swap it in after we quit, relaunch
//   dmg              unsigned Mac apps cannot replace themselves: download the
//                    .dmg and open it so the player drags it to Applications
const PORTABLE = process.env.PORTABLE_EXECUTABLE_FILE;
const updateMode = !app.isPackaged
  ? 'none'
  : process.platform === 'win32'
    ? PORTABLE
      ? 'portable'
      : 'nsis'
    : process.platform === 'linux'
      ? process.env.APPIMAGE
        ? 'appimage'
        : 'none'
      : process.platform === 'darwin'
        ? 'dmg'
        : 'none';

const sendToPage = (channel, value) => win && win.webContents.send(channel, value);

async function downloadTo(url, file) {
  const res = await net.fetch(url);
  if (!res.ok) throw new Error('HTTP ' + res.status);
  const total = Number(res.headers.get('content-length')) || 0;
  const out = fs.createWriteStream(file);
  const reader = res.body.getReader();
  let done = 0;
  let last = -1;
  for (;;) {
    const chunk = await reader.read();
    if (chunk.done) break;
    if (!out.write(Buffer.from(chunk.value))) await new Promise((r) => out.once('drain', r));
    done += chunk.value.length;
    const pct = total ? Math.floor((done * 100) / total) : -1;
    if (pct !== last) sendToPage('update:progress', (last = pct));
  }
  await new Promise((resolve, reject) => out.end((err) => (err ? reject(err) : resolve())));
}

async function startUpdate(version) {
  if (!/^\d+\.\d+\.\d+$/.test(String(version))) throw new Error('bad version');
  const base = `${RELEASES}/download/v${version}`;
  if (updateMode === 'nsis' || updateMode === 'appimage') {
    const { autoUpdater } = require('electron-updater');
    autoUpdater.autoDownload = false;
    autoUpdater.removeAllListeners('download-progress');
    autoUpdater.on('download-progress', (p) => sendToPage('update:progress', Math.floor(p.percent)));
    await autoUpdater.checkForUpdates();
    await autoUpdater.downloadUpdate();
    setTimeout(() => autoUpdater.quitAndInstall(true, true), 300);
    return 'restarting';
  }
  if (updateMode === 'portable') {
    const target = PORTABLE;
    let fresh = path.join(path.dirname(target), 'Another-Dino-update.exe');
    try {
      fs.accessSync(path.dirname(target), fs.constants.W_OK);
    } catch {
      fresh = path.join(os.tmpdir(), 'Another-Dino-update.exe');
    }
    await downloadTo(`${base}/Another-Dino-windows-portable.exe`, fresh);
    const script = path.join(os.tmpdir(), 'another-dino-update.cmd');
    fs.writeFileSync(
      script,
      ['@echo off', 'ping 127.0.0.1 -n 3 > nul', `move /y "${fresh}" "${target}" > nul`, `start "" "${target}"`, 'del "%~f0"'].join('\r\n'),
    );
    spawn('cmd.exe', ['/c', script], { detached: true, stdio: 'ignore', windowsHide: true }).unref();
    setTimeout(() => app.quit(), 300);
    return 'restarting';
  }
  if (updateMode === 'dmg') {
    const arch = process.arch === 'arm64' ? 'arm64' : 'x64';
    const file = path.join(app.getPath('downloads'), `Another-Dino-mac-${arch}.dmg`);
    await downloadTo(`${base}/Another-Dino-mac-${arch}.dmg`, file);
    await shell.openPath(file);
    return 'opened';
  }
  throw new Error('updates are not available for this build');
}

// "Share record": save the picture to Pictures/Another Dino, copy it to the
// clipboard (ready to paste into a chat) and show it in the file manager.
ipcMain.handle('share:image', (_e, dataUrl) => {
  if (typeof dataUrl !== 'string' || !dataUrl.startsWith('data:image/png;base64,')) throw new Error('bad image');
  const img = nativeImage.createFromDataURL(dataUrl);
  const dir = path.join(app.getPath('pictures'), 'Another Dino');
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `another-dino-${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}.png`);
  fs.writeFileSync(file, img.toPNG());
  // both are conveniences: the picture is already saved if they fail
  try {
    clipboard.writeImage(img);
  } catch {
    /* no clipboard */
  }
  try {
    shell.showItemInFolder(file);
  } catch {
    /* no file manager */
  }
  return file;
});

ipcMain.handle('app:info', () => ({ version: app.getVersion(), platform: process.platform, mode: updateMode }));
ipcMain.handle('update:start', (_e, version) => startUpdate(version));
ipcMain.handle('open-external', (_e, url) => {
  if (typeof url === 'string' && url.startsWith(RELEASES)) shell.openExternal(url);
});

// ------------------------------------------------------------------ boot
app.whenReady().then(() => {
  protocol.handle('app', (req) => {
    const { pathname } = new URL(req.url);
    const file = path.normalize(path.join(ROOT, decodeURIComponent(pathname)));
    if (file !== ROOT && !file.startsWith(ROOT + path.sep)) return new Response('Not found', { status: 404 });
    return net.fetch(pathToFileURL(file).toString());
  });
  Menu.setApplicationMenu(null);
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  closeSocket();
  if (process.platform !== 'darwin') app.quit();
});
