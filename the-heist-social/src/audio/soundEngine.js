// Procedural Web Audio API Sound Designer for "THE HEIST SOCIAL"
class SoundEngine {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.stepTimer = 0;
  }

  _ensureCtx() {
    if (this.muted) return null;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) this.ctx = new AudioCtx();
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  toggleMute() {
    this.muted = !this.muted;
    return this.muted;
  }

  playTone(freq, duration = 0.14, type = 'sine', gainVal = 0.08, endFreq = null) {
    const ctx = this._ensureCtx();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    if (endFreq) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), now + duration);
    }
    gain.gain.setValueAtTime(gainVal, now);
    gain.gain.exponentialRampToValueAtTime(0.0008, now + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + duration);
  }

  playFootstep(indoor = true) {
    const ctx = this._ensureCtx();
    if (!ctx) return;
    if (indoor) {
      // Crisp dress shoe heel click on marble/parquet
      this.playTone(indoor ? 210 + Math.random() * 45 : 120, 0.045, 'triangle', 0.032, 90);
    } else {
      // Soft gravel/grass step
      this.playTone(95 + Math.random() * 25, 0.055, 'sine', 0.025, 55);
    }
  }

  playJewelStolen() {
    this.playTone(587.33, 0.14, 'sine', 0.09);
    setTimeout(() => this.playTone(880, 0.18, 'sine', 0.09), 90);
    setTimeout(() => this.playTone(1174.66, 0.28, 'triangle', 0.08), 180);
  }

  playTaskComplete() {
    this.playTone(523.25, 0.12, 'triangle', 0.07);
    setTimeout(() => this.playTone(659.25, 0.14, 'triangle', 0.07), 90);
    setTimeout(() => this.playTone(783.99, 0.22, 'sine', 0.08), 180);
  }

  playShutterClick() {
    this.playTone(1200, 0.035, 'square', 0.05, 300);
    setTimeout(() => this.playTone(900, 0.04, 'triangle', 0.045, 220), 45);
  }

  playSecretPassage() {
    this.playTone(135, 0.38, 'sawtooth', 0.055, 65);
  }

  playSabotage() {
    this.playTone(240, 0.35, 'sawtooth', 0.08, 62);
    setTimeout(() => this.playTone(150, 0.3, 'square', 0.06, 55), 140);
  }

  playEmergencyAlarm() {
    for (let i = 0; i < 3; i++) {
      setTimeout(() => {
        this.playTone(740, 0.18, 'sawtooth', 0.085, 520);
      }, i * 230);
    }
  }

  playVoteClick() {
    this.playTone(440, 0.07, 'triangle', 0.06, 620);
  }

  playVictory(isGood) {
    const notes = isGood ? [523.25, 659.25, 783.99, 1046.5] : [392.0, 369.99, 329.63, 261.63];
    notes.forEach((n, idx) => {
      setTimeout(() => this.playTone(n, 0.32, 'triangle', 0.09), idx * 150);
    });
  }
}

export const soundEngine = new SoundEngine();
