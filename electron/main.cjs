// Desktop shell: serves dist/ over a private app:// scheme (ES modules and
// localStorage need a real origin, which file:// does not give), provides UDP
// sockets for LAN play and keeps the app up to date from GitHub Releases.
const { app, BrowserWindow, Menu, ipcMain, net, protocol, shell } = require('electron');
const dgram = require('node:dgram');
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
// electron-updater works for the Windows installer and the Linux AppImage; the
// portable .exe and the unsigned macOS build only get a "new version" banner.
const canAutoUpdate = app.isPackaged && ((process.platform === 'win32' && !process.env.PORTABLE_EXECUTABLE_DIR) || (process.platform === 'linux' && !!process.env.APPIMAGE));

ipcMain.handle('app:info', () => ({ version: app.getVersion(), platform: process.platform, autoUpdate: canAutoUpdate }));
ipcMain.handle('update:install', () => {
  if (canAutoUpdate) require('electron-updater').autoUpdater.quitAndInstall();
});
ipcMain.handle('open-external', (_e, url) => {
  if (typeof url === 'string' && url.startsWith(RELEASES)) shell.openExternal(url);
});

function startAutoUpdate() {
  if (!canAutoUpdate) return;
  const { autoUpdater } = require('electron-updater');
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.on('update-downloaded', () => win && win.webContents.send('update:status', 'downloaded'));
  autoUpdater.on('error', () => {});
  autoUpdater.checkForUpdates().catch(() => {});
}

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
  startAutoUpdate();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  closeSocket();
  if (process.platform !== 'darwin') app.quit();
});
