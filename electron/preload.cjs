// The only bridge between the game page and Node: LAN sockets, update status
// and opening the releases page. Everything goes through ipcMain handlers.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('desktop', {
  lan: {
    start: (port) => ipcRenderer.invoke('lan:start', port),
    send: (host, port, data) => ipcRenderer.invoke('lan:send', host, port, data),
    broadcast: (port, data) => ipcRenderer.invoke('lan:broadcast', port, data),
    addresses: () => ipcRenderer.invoke('lan:addresses'),
    stop: () => ipcRenderer.invoke('lan:stop'),
    onMessage: (cb) => {
      ipcRenderer.removeAllListeners('lan:message');
      ipcRenderer.on('lan:message', (_e, m) => cb(m));
    },
  },
  update: {
    info: () => ipcRenderer.invoke('app:info'),
    onStatus: (cb) => ipcRenderer.on('update:status', (_e, s) => cb(s)),
    install: () => ipcRenderer.invoke('update:install'),
  },
  openExternal: (url) => ipcRenderer.invoke('open-external', url),
});
