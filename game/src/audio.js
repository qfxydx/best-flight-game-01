// Sound, all synthesised with WebAudio: no audio files, no network. A low
// engine drone whose pitch follows the throttle, a chime when a ring is passed,
// a thud on landing and a noise burst on a crash. Silent until the player
// first interacts, and safe to construct in a headless screenshot run.
export class SoundEngine {
  constructor() {
    this.ctx = null;
    this.engineOsc = null;
    this.engineGain = null;
    this.muted = false;
    this.started = false;
  }

  ensure() {
    if (this.started) return;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.engineOsc = this.ctx.createOscillator();
      this.engineOsc.type = 'sawtooth';
      this.engineOsc.frequency.value = 55;
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 420;
      this.engineGain = this.ctx.createGain();
      this.engineGain.gain.value = 0;
      this.engineOsc.connect(filter);
      filter.connect(this.engineGain);
      this.engineGain.connect(this.ctx.destination);
      this.engineOsc.start();
      this.started = true;
    } catch {
      this.ctx = null;
    }
  }

  setEngine(throttle, speed) {
    if (!this.ctx || !this.engineGain) return;
    // The drone follows the throttle first and the airspeed second, so
    // opening up sounds like opening up and diving sounds like diving.
    const vol = this.muted ? 0 : 0.015 + throttle * 0.06 + (speed / 105) * 0.02;
    this.engineGain.gain.setTargetAtTime(vol, this.ctx.currentTime, 0.1);
    this.engineOsc.frequency.setTargetAtTime(50 + throttle * 75 + speed * 0.5, this.ctx.currentTime, 0.1);
  }

  blip(freq, dur, type, vol) {
    if (!this.ctx || this.muted) return;
    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = type || 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(vol || 0.12, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + dur);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + dur);
    } catch {
      // Audio is decoration; a failure must never break the game.
    }
  }

  ring() {
    // A bright rising chime: the pass should sound like a reward, not a beep.
    this.blip(880, 0.22, 'sine', 0.14);
    setTimeout(() => this.blip(1318, 0.26, 'sine', 0.11), 80);
    setTimeout(() => this.blip(1760, 0.3, 'sine', 0.08), 160);
  }

  land() {
    this.blip(220, 0.3, 'triangle', 0.16);
    setTimeout(() => this.blip(110, 0.35, 'triangle', 0.12), 90);
  }

  crash() {
    if (!this.ctx || this.muted) return;
    try {
      const len = this.ctx.sampleRate * 0.4;
      const buffer = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = this.ctx.createBufferSource();
      src.buffer = buffer;
      const gain = this.ctx.createGain();
      gain.gain.value = 0.25;
      src.connect(gain);
      gain.connect(this.ctx.destination);
      src.start();
    } catch {
      // Ignore audio failures.
    }
  }
}
