// UDP transports for LAN play. All of them expose the same small API:
//   start(port, onMessage({data, address, port})), send(host, port, data),
//   broadcast(port, data), addresses() -> [ip], stop()
import { Capacitor, registerPlugin } from '@capacitor/core';

function capacitorTransport() {
  const Lan = registerPlugin('Lan');
  let handle = null;
  return {
    kind: 'android',
    async start(port, onMessage) {
      if (handle) await handle.remove();
      handle = await Lan.addListener('message', onMessage);
      await Lan.start({ port });
    },
    send: (host, port, data) => Lan.send({ host, port, data }).catch(() => {}),
    broadcast: (port, data) => Lan.broadcast({ port, data }).catch(() => {}),
    addresses: () => Lan.addresses().then((r) => r.addresses || []),
    async stop() {
      if (handle) await handle.remove();
      handle = null;
      await Lan.stop().catch(() => {});
    },
  };
}

function desktopTransport() {
  const lan = window.desktop.lan;
  return {
    kind: 'desktop',
    async start(port, onMessage) {
      lan.onMessage(onMessage);
      await lan.start(port);
    },
    send: (host, port, data) => lan.send(host, port, data),
    broadcast: (port, data) => lan.broadcast(port, data),
    addresses: () => lan.addresses(),
    stop: () => lan.stop(),
  };
}

// Same-browser test transport (two tabs talk through a BroadcastChannel).
function channelTransport() {
  const me = 'tab-' + Math.random().toString(36).slice(2, 7);
  let ch = null;
  return {
    kind: 'test',
    async start(port, onMessage) {
      ch = new BroadcastChannel('another-dino-lan-' + port);
      ch.onmessage = (e) => {
        const m = e.data;
        if (m.from !== me && (m.to === '*' || m.to === me)) onMessage({ data: m.data, address: m.from, port });
      };
    },
    send: (host, port, data) => ch && ch.postMessage({ from: me, to: host, data }),
    broadcast: (port, data) => ch && ch.postMessage({ from: me, to: '*', data }),
    addresses: async () => [me],
    stop: async () => {
      if (ch) ch.close();
      ch = null;
    },
  };
}

export function createTransport() {
  if (window.desktop && window.desktop.lan) return desktopTransport();
  if (Capacitor.isNativePlatform()) return capacitorTransport();
  if (new URLSearchParams(location.search).has('lantest')) return channelTransport();
  return null;
}
