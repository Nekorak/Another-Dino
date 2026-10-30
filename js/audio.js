// Retro beeps synthesised with WebAudio, no audio files needed.
export class Sfx {
  constructor() {
    this.ctx = null;
    this.muted = false;
  }

  // Must be called from a user gesture (mobile browsers block audio otherwise).
  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
  }

  tone(freq, dur, { type = 'square', to = freq, vol = 0.08, delay = 0 } = {}) {
    if (this.muted || !this.ctx) return;
    const t = this.ctx.currentTime + delay;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    o.frequency.exponentialRampToValueAtTime(to, t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.ctx.destination);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  jump() {
    this.tone(420, 0.09, { to: 820 });
  }

  point() {
    this.tone(880, 0.07);
    this.tone(1320, 0.12, { delay: 0.08 });
  }

  hit() {
    this.tone(200, 0.25, { to: 60, type: 'sawtooth', vol: 0.1 });
    this.tone(90, 0.3, { to: 40, type: 'square', vol: 0.06, delay: 0.05 });
  }
}
