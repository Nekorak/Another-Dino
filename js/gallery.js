// The photo album: pictures taken in photo mode stay on the device, in IndexedDB
// (localStorage is far too small for images). Nothing leaves the device unless shared.
const DB = 'another-dino-photos';
const STORE = 'photos';
export const MAX_PHOTOS = 40;

let dbp = null;
function db() {
  if (!dbp) {
    dbp = new Promise((res, rej) => {
      if (!window.indexedDB) return rej(new Error('noDb'));
      const r = indexedDB.open(DB, 1);
      r.onupgradeneeded = () => r.result.createObjectStore(STORE, { keyPath: 'id', autoIncrement: true });
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
    dbp.catch(() => (dbp = null));
  }
  return dbp;
}

function tx(mode, fn) {
  return db().then(
    (d) =>
      new Promise((res, rej) => {
        const t = d.transaction(STORE, mode);
        const out = fn(t.objectStore(STORE));
        t.oncomplete = () => res(out && 'result' in out ? out.result : out);
        t.onerror = () => rej(t.error);
        t.onabort = () => rej(t.error);
      }),
  );
}

async function scaled(dataUrl, maxSide, type, q) {
  const img = new Image();
  await new Promise((res, rej) => {
    img.onload = res;
    img.onerror = rej;
    img.src = dataUrl;
  });
  const k = Math.min(1, maxSide / Math.max(img.width, img.height));
  const c = document.createElement('canvas');
  c.width = Math.round(img.width * k);
  c.height = Math.round(img.height * k);
  const g = c.getContext('2d');
  g.imageSmoothingEnabled = k < 1;
  g.drawImage(img, 0, 0, c.width, c.height);
  return c.toDataURL(type, q);
}

// stores the photo (a PNG data URL) with a small thumbnail; returns the new id.
// When the album is full the oldest photo makes room.
export async function addPhoto(dataUrl, meta = {}) {
  const full = await scaled(dataUrl, 1600, 'image/jpeg', 0.9);
  const thumb = await scaled(dataUrl, 240, 'image/jpeg', 0.8);
  const id = await tx('readwrite', (s) => s.add({ full, thumb, d: Date.now(), ...meta }));
  const all = await listPhotos();
  for (const p of all.slice(MAX_PHOTOS)) await deletePhoto(p.id);
  return id;
}

// newest first, thumbnails only ({ id, thumb, d, ... })
export async function listPhotos() {
  const rows = await tx('readonly', (s) => s.getAll());
  return (rows || []).map(({ full, ...rest }) => rest).sort((a, b) => b.d - a.d);
}

// the desktop app and Android share PNG pictures
export const toPng = (dataUrl) => scaled(dataUrl, 1e5, 'image/png');

export const getPhoto = (id) => tx('readonly', (s) => s.get(id));
export const deletePhoto = (id) => tx('readwrite', (s) => s.delete(id));
