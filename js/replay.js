// Replay: the last 10 seconds of a run, kept as small frames, shown after the
// game over and saved as an animated GIF (encoder below, no library needed).

const FPS = 10;
const SECONDS = 10;
const MAX_SIDE = 320;

export class Recorder {
  constructor() {
    this.pool = [];
    this.frames = []; // oldest first: { c: canvas, score }
    this.acc = 0;
  }
  clear() {
    this.pool.push(...this.frames);
    this.frames = [];
    this.acc = 0;
  }
  // call right after rendering, while the WebGL picture is still there
  capture(src, dt, score) {
    this.acc += dt;
    if (this.acc < 1 / FPS) return;
    this.acc %= 1 / FPS;
    const k = Math.min(1, MAX_SIDE / Math.max(src.width, src.height));
    const w = Math.max(2, Math.round(src.width * k));
    const h = Math.max(2, Math.round(src.height * k));
    let f = this.frames.length >= FPS * SECONDS ? this.frames.shift() : this.pool.pop();
    if (!f) f = { c: document.createElement('canvas') };
    if (f.c.width !== w || f.c.height !== h) {
      f.c.width = w;
      f.c.height = h;
    }
    const g = f.c.getContext('2d');
    g.imageSmoothingEnabled = false;
    g.drawImage(src, 0, 0, w, h);
    f.score = Math.floor(score);
    this.frames.push(f);
  }
  get length() {
    return this.frames.length;
  }
  // draws frame i (with the score) into a canvas of any size
  draw(target, i) {
    const f = this.frames[i];
    if (!f) return;
    const g = target.getContext('2d');
    g.imageSmoothingEnabled = false;
    g.drawImage(f.c, 0, 0, target.width, target.height);
    stamp(g, target.width, target.height, f.score);
  }
  // an animated GIF of the whole replay, as a Blob
  toGif() {
    if (!this.frames.length) return null;
    const { width: w, height: h } = this.frames[0].c;
    const frames = this.frames.filter((f) => f.c.width === w && f.c.height === h);
    const tmp = document.createElement('canvas');
    tmp.width = w;
    tmp.height = h;
    const g = tmp.getContext('2d', { willReadFrequently: true });
    const pixels = frames.map((f) => {
      g.drawImage(f.c, 0, 0);
      stamp(g, w, h, f.score);
      return g.getImageData(0, 0, w, h).data;
    });
    return new Blob([encodeGif(w, h, pixels, 100 / FPS)], { type: 'image/gif' });
  }
}

function stamp(g, w, h, score) {
  const size = Math.max(6, Math.round(h / 22));
  g.font = `${size}px "Press Start 2P", monospace`;
  g.textBaseline = 'top';
  const s = String(score).padStart(5, '0');
  g.fillStyle = 'rgba(0,0,0,0.45)';
  g.fillRect(0, 0, w, size * 1.8);
  g.fillStyle = '#ffffff';
  g.textAlign = 'left';
  g.fillText('ANOTHER DINO', size * 0.5, size * 0.4);
  g.fillStyle = '#ffd23f';
  g.textAlign = 'right';
  g.fillText(s, w - size * 0.5, size * 0.4);
  g.textAlign = 'left';
}

// ------------------------------------------------------------------ GIF encoder
// One global palette of the 255 most common colours (5 bits per channel), then
// LZW-compressed frames. Pixel art has few colours, so this looks right.
function buildPalette(frames) {
  const counts = new Uint32Array(32768);
  for (const d of frames) for (let i = 0; i < d.length; i += 4 * 3) counts[((d[i] >> 3) << 10) | ((d[i + 1] >> 3) << 5) | (d[i + 2] >> 3)]++;
  const used = [];
  for (let k = 0; k < 32768; k++) if (counts[k]) used.push(k);
  used.sort((a, b) => counts[b] - counts[a]);
  const pal = used.slice(0, 256);
  const rgb = pal.map((k) => [((k >> 10) & 31) * 8 + 4, ((k >> 5) & 31) * 8 + 4, (k & 31) * 8 + 4]);
  // every 5-bit colour -> nearest palette entry
  const lut = new Uint8Array(32768);
  const cache = new Int16Array(32768).fill(-1);
  pal.forEach((k, i) => (cache[k] = i));
  for (let k = 0; k < 32768; k++) {
    if (cache[k] >= 0) {
      lut[k] = cache[k];
      continue;
    }
    if (!counts[k]) continue;
    const r = ((k >> 10) & 31) * 8;
    const gg = ((k >> 5) & 31) * 8;
    const b = (k & 31) * 8;
    let best = 0;
    let bd = Infinity;
    for (let i = 0; i < rgb.length; i++) {
      const d = (rgb[i][0] - r) ** 2 + (rgb[i][1] - gg) ** 2 + (rgb[i][2] - b) ** 2;
      if (d < bd) {
        bd = d;
        best = i;
      }
    }
    lut[k] = best;
  }
  return { rgb, lut, counts };
}

function nearest(rgb, k) {
  const r = ((k >> 10) & 31) * 8;
  const g = ((k >> 5) & 31) * 8;
  const b = (k & 31) * 8;
  let best = 0;
  let bd = Infinity;
  for (let i = 0; i < rgb.length; i++) {
    const d = (rgb[i][0] - r) ** 2 + (rgb[i][1] - g) ** 2 + (rgb[i][2] - b) ** 2;
    if (d < bd) {
      bd = d;
      best = i;
    }
  }
  return best;
}

class ByteOut {
  constructor() {
    this.buf = new Uint8Array(1 << 16);
    this.n = 0;
  }
  byte(b) {
    if (this.n >= this.buf.length) {
      const nb = new Uint8Array(this.buf.length * 2);
      nb.set(this.buf);
      this.buf = nb;
    }
    this.buf[this.n++] = b;
  }
  word(w) {
    this.byte(w & 255);
    this.byte((w >> 8) & 255);
  }
  str(s) {
    for (let i = 0; i < s.length; i++) this.byte(s.charCodeAt(i));
  }
  bytes() {
    return this.buf.subarray(0, this.n);
  }
}

function lzw(out, indices, minCode) {
  out.byte(minCode);
  const clear = 1 << minCode;
  const eoi = clear + 1;
  let size = minCode + 1;
  let next = eoi + 1;
  let dict = new Map();
  let bits = 0;
  let acc = 0;
  const block = [];
  const emit = (code) => {
    acc |= code << bits;
    bits += size;
    while (bits >= 8) {
      block.push(acc & 255);
      acc >>>= 8;
      bits -= 8;
      if (block.length === 255) {
        out.byte(255);
        for (const b of block) out.byte(b);
        block.length = 0;
      }
    }
  };
  emit(clear);
  let prefix = indices[0];
  for (let i = 1; i < indices.length; i++) {
    const c = indices[i];
    const key = (prefix << 8) | c;
    const hit = dict.get(key);
    if (hit !== undefined) {
      prefix = hit;
      continue;
    }
    emit(prefix);
    if (next < 4096) {
      dict.set(key, next++);
      if (next > 1 << size && size < 12) size++;
    } else {
      emit(clear);
      dict = new Map();
      size = minCode + 1;
      next = eoi + 1;
    }
    prefix = c;
  }
  emit(prefix);
  emit(eoi);
  if (bits > 0) block.push(acc & 255);
  if (block.length) {
    out.byte(block.length);
    for (const b of block) out.byte(b);
  }
  out.byte(0);
}

// frames: RGBA arrays of w*h pixels; delay in 1/100 s
export function encodeGif(w, h, frames, delay) {
  const { rgb, lut, counts } = buildPalette(frames);
  const out = new ByteOut();
  out.str('GIF89a');
  out.word(w);
  out.word(h);
  out.byte(0xf7); // global colour table, 8 bits
  out.byte(0);
  out.byte(0);
  for (let i = 0; i < 256; i++) {
    const c = rgb[i] || [0, 0, 0];
    out.byte(c[0]);
    out.byte(c[1]);
    out.byte(c[2]);
  }
  // loop forever
  out.byte(0x21);
  out.byte(0xff);
  out.byte(11);
  out.str('NETSCAPE2.0');
  out.byte(3);
  out.byte(1);
  out.word(0);
  out.byte(0);
  const idx = new Uint8Array(w * h);
  for (const d of frames) {
    out.byte(0x21);
    out.byte(0xf9);
    out.byte(4);
    out.byte(0);
    out.word(Math.round(delay));
    out.byte(0);
    out.byte(0);
    out.byte(0x2c);
    out.word(0);
    out.word(0);
    out.word(w);
    out.word(h);
    out.byte(0);
    for (let p = 0, i = 0; p < idx.length; p++, i += 4) {
      const k = ((d[i] >> 3) << 10) | ((d[i + 1] >> 3) << 5) | (d[i + 2] >> 3);
      // colours that were skipped while sampling the palette get looked up now
      if (!counts[k]) {
        counts[k] = 1;
        lut[k] = nearest(rgb, k);
      }
      idx[p] = lut[k];
    }
    lzw(out, idx, 8);
  }
  out.byte(0x3b);
  return out.bytes();
}
