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

  coin() {
    this.tone(1046, 0.05, { vol: 0.05 });
    this.tone(1568, 0.08, { vol: 0.05, delay: 0.05 });
  }

  powerup() {
    [523, 659, 784, 1046].forEach((f, i) => this.tone(f, 0.07, { vol: 0.06, delay: i * 0.06 }));
  }

  shieldBreak() {
    this.tone(900, 0.2, { to: 200, type: 'triangle', vol: 0.12 });
  }

  boom() {
    this.tone(120, 0.35, { to: 30, type: 'sawtooth', vol: 0.12 });
  }

  doubleJump() {
    this.tone(620, 0.08, { to: 1240, vol: 0.06 });
  }

  beep(high = false) {
    this.tone(high ? 1320 : 660, 0.12, { vol: 0.07 });
  }

  reward() {
    [784, 988, 1175, 1568].forEach((f, i) => this.tone(f, 0.1, { vol: 0.06, delay: i * 0.08, type: 'triangle' }));
  }
}
