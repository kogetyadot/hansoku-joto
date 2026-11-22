/**
 * 『反則上等！』 (Hansoku Joto!) — Web Audio API Procedural Synthesizer & Dynamic BGM Sequencer
 * Zero external audio file dependencies. Pure Web Audio synthesis with automatic polyphony/cooldown limiting
 * and combo pitch escalation for maximum arcade juice.
 */

const STORAGE_KEY_BGM = 'hansoku_joto_bgm_enabled';
const STORAGE_KEY_SFX = 'hansoku_joto_sfx_enabled';

export class AudioManager {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.bgmGain = null;
    this.sfxGain = null;
    this.compressor = null;
    this.noiseBuffer = null;

    // Load persisted toggles (default true)
    this.bgmEnabled = this._loadPref(STORAGE_KEY_BGM, true);
    this.sfxEnabled = this._loadPref(STORAGE_KEY_SFX, true);

    // BGM sequencer state
    this.bgmMode = 'planning'; // 'planning' | 'combat_chain' | 'boss'
    this.bgmPlaying = false;
    this.bgmStep = 0;
    this.bgmTimer = null;
    this.nextNoteTime = 0;

    // Polyphony / cooldown limiter timestamps (ms)
    this._lastSoundTimes = {};
    this._activeVoices = 0;
    this._maxVoices = 24;

    // Auto-unlock audio context on first user gesture
    this._unlockBound = this._unlockAudio.bind(this);
    if (typeof window !== 'undefined') {
      window.addEventListener('pointerdown', this._unlockBound, { once: false, passive: true });
      window.addEventListener('keydown', this._unlockBound, { once: false, passive: true });
    }
  }

  _loadPref(key, fallback) {
    try {
      if (typeof localStorage !== 'undefined') {
        const val = localStorage.getItem(key);
        if (val !== null) return val === 'true';
      }
    } catch (_) {
      // Ignore storage errors
    }
    return fallback;
  }

  _savePref(key, val) {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(key, String(Boolean(val)));
      }
    } catch (_) {
      // Ignore storage errors
    }
  }

  init() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }
      return this.ctx;
    }
    if (typeof window === 'undefined') return null;

    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return null;

    try {
      this.ctx = new AudioCtx();

      // Master Dynamics Compressor so 60-hit combos punch hard without digital clipping
      this.compressor = this.ctx.createDynamicsCompressor();
      this.compressor.threshold.setValueAtTime(-14, this.ctx.currentTime);
      this.compressor.knee.setValueAtTime(18, this.ctx.currentTime);
      this.compressor.ratio.setValueAtTime(8, this.ctx.currentTime);
      this.compressor.attack.setValueAtTime(0.002, this.ctx.currentTime);
      this.compressor.release.setValueAtTime(0.12, this.ctx.currentTime);

      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(0.85, this.ctx.currentTime);

      this.bgmGain = this.ctx.createGain();
      this.bgmGain.gain.setValueAtTime(this.bgmEnabled ? 0.24 : 0, this.ctx.currentTime);

      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.setValueAtTime(this.sfxEnabled ? 0.78 : 0, this.ctx.currentTime);

      this.bgmGain.connect(this.compressor);
      this.sfxGain.connect(this.compressor);
      this.compressor.connect(this.masterGain);
      this.masterGain.connect(this.ctx.destination);

      this._createNoiseBuffer();
    } catch (_) {
      this.ctx = null;
    }
    return this.ctx;
  }

  _unlockAudio() {
    this.init();
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    if (this.bgmEnabled && !this.bgmPlaying) {
      this.startBGM(this.bgmMode);
    }
  }

  _createNoiseBuffer() {
    if (!this.ctx) return;
    const sampleRate = this.ctx.sampleRate;
    const length = sampleRate * 1.5;
    const buffer = this.ctx.createBuffer(1, length, sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    this.noiseBuffer = buffer;
  }

  _canTrigger(tag, minIntervalMs = 28) {
    if (!this.sfxEnabled) return false;
    const ctx = this.init();
    if (!ctx) return false;
    const now = performance.now();
    const last = this._lastSoundTimes[tag] || 0;
    if (now - last < minIntervalMs) return false;
    if (this._activeVoices >= this._maxVoices && tag !== 'kill' && tag !== 'victory') {
      return false;
    }
    this._lastSoundTimes[tag] = now;
    return true;
  }

  _trackVoice(durationSec) {
    this._activeVoices++;
    setTimeout(() => {
      this._activeVoices = Math.max(0, this._activeVoices - 1);
    }, Math.ceil(durationSec * 1000) + 20);
  }

  // ============================================================================
  // Toggles & BGM Control
  // ============================================================================

  toggleBGM(forceState) {
    this.bgmEnabled = typeof forceState === 'boolean' ? forceState : !this.bgmEnabled;
    this._savePref(STORAGE_KEY_BGM, this.bgmEnabled);
    this.init();
    if (this.bgmGain && this.ctx) {
      this.bgmGain.gain.setTargetAtTime(
        this.bgmEnabled ? 0.24 : 0,
        this.ctx.currentTime,
        0.05
      );
    }
    if (this.bgmEnabled && !this.bgmPlaying) {
      this.startBGM(this.bgmMode);
    } else if (!this.bgmEnabled && this.bgmPlaying) {
      this.stopBGM();
    }
    return this.bgmEnabled;
  }

  toggleSFX(forceState) {
    this.sfxEnabled = typeof forceState === 'boolean' ? forceState : !this.sfxEnabled;
    this._savePref(STORAGE_KEY_SFX, this.sfxEnabled);
    this.init();
    if (this.sfxGain && this.ctx) {
      this.sfxGain.gain.setTargetAtTime(
        this.sfxEnabled ? 0.78 : 0,
        this.ctx.currentTime,
        0.03
      );
    }
    if (this.sfxEnabled) {
      this.playCardSelect();
    }
    return this.sfxEnabled;
  }

  setBGMMode(mode = 'planning') {
    const normalized = mode === 'combat' ? 'combat_chain' : mode;
    this.bgmMode = normalized;
    if (this.bgmEnabled && !this.bgmPlaying) {
      this.startBGM(normalized);
    }
  }

  startBGM(mode) {
    if (mode) {
      this.bgmMode = mode === 'combat' ? 'combat_chain' : mode;
    }
    if (!this.bgmEnabled) return;
    const ctx = this.init();
    if (!ctx) return;

    if (this.bgmTimer) {
      clearInterval(this.bgmTimer);
      this.bgmTimer = null;
    }

    this.bgmPlaying = true;
    this.nextNoteTime = ctx.currentTime + 0.05;

    const lookaheadMs = 45;
    const scheduleAheadSec = 0.14;

    this.bgmTimer = setInterval(() => {
      if (!this.bgmEnabled || !this.ctx || !this.bgmPlaying) return;
      if (this.ctx.state === 'suspended') return;

      while (this.nextNoteTime < this.ctx.currentTime + scheduleAheadSec) {
        this._scheduleBGMStep(this.bgmStep, this.nextNoteTime);
        const bpm = this._getCurrentBPM();
        const sixteenthSec = 60 / bpm / 4;
        this.nextNoteTime += sixteenthSec;
        this.bgmStep = (this.bgmStep + 1) % 32;
      }
    }, lookaheadMs);
  }

  stopBGM() {
    this.bgmPlaying = false;
    if (this.bgmTimer) {
      clearInterval(this.bgmTimer);
      this.bgmTimer = null;
    }
  }

  _getCurrentBPM() {
    if (this.bgmMode === 'boss') return 154;
    if (this.bgmMode === 'combat_chain') return 142;
    return 114; // 'planning'
  }

  _midiToFreq(midi) {
    return 440 * Math.pow(2, (midi - 69) / 12);
  }

  _scheduleBGMStep(step, time) {
    if (!this.ctx || !this.bgmEnabled) return;

    if (this.bgmMode === 'planning') {
      // Groovy, bouncy underground ring planning beat (A minor pentatonic)
      const bassPattern = [
        45, null, 45, 48, 52, null, 45, null,
        43, null, 43, 45, 48, null, 50, 48,
        45, null, 45, 48, 52, null, 45, null,
        41, null, 41, 43, 48, null, 52, 55
      ];
      const leadPattern = [
        69, null, null, 72, null, 76, null, null,
        74, null, 72, null, 69, null, null, null,
        69, null, 72, null, 76, null, 79, null,
        81, null, 79, null, 76, null, 72, null
      ];

      const bassNote = bassPattern[step];
      if (bassNote) {
        this._playBGMVoice(this._midiToFreq(bassNote), time, 0.11, 'triangle', 0.28, 650);
      }

      const leadNote = leadPattern[step];
      if (leadNote) {
        this._playBGMVoice(this._midiToFreq(leadNote), time, 0.09, 'square', 0.11, 1800);
      }

      // Soft hi-hat tick on off-beats
      if (step % 4 === 2) {
        this._playBGMHat(time, 0.03, 0.07);
      }
      if (step % 8 === 0) {
        this._playBGMKick(time, 0.16);
      }
    } else {
      // 'combat_chain' or 'boss' — Intense driving arcade chiptune beat
      const isBoss = this.bgmMode === 'boss';
      const rootOffset = isBoss ? 2 : 0; // Shift up to B minor for Boss!

      const bassPattern = [
        45, 45, 57, 45, 48, 45, 52, 45,
        43, 43, 55, 43, 48, 43, 50, 52,
        45, 45, 57, 45, 53, 45, 52, 48,
        41, 41, 53, 41, 43, 43, 55, 56
      ];
      const arpPattern = [
        69, 72, 76, 81, 79, 76, 72, 76,
        67, 71, 74, 79, 76, 74, 71, 67,
        69, 72, 76, 81, 84, 81, 76, 72,
        65, 69, 72, 77, 67, 71, 74, 79
      ];

      const bassNote = bassPattern[step];
      if (bassNote) {
        this._playBGMVoice(
          this._midiToFreq(bassNote + rootOffset),
          time,
          0.09,
          'sawtooth',
          0.26,
          1200
        );
      }

      const arpNote = arpPattern[step];
      if (arpNote && (isBoss || step % 2 === 0 || step > 24)) {
        this._playBGMVoice(
          this._midiToFreq(arpNote + rootOffset),
          time,
          0.075,
          'square',
          0.14,
          2900
        );
      }

      // Driving four-on-the-floor kick + snappy snare
      if (step % 4 === 0) {
        this._playBGMKick(time, 0.25);
      }
      if (step % 8 === 4) {
        this._playBGMHat(time, 0.08, 0.16);
      } else if (step % 2 === 1) {
        this._playBGMHat(time, 0.025, 0.08);
      }
    }
  }

  _playBGMVoice(freq, time, duration, type, gainVal, filterCutoff = 2000) {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, time);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(filterCutoff, time);
    filter.frequency.exponentialRampToValueAtTime(Math.max(180, filterCutoff * 0.35), time + duration);

    gain.gain.setValueAtTime(0.001, time);
    gain.gain.linearRampToValueAtTime(gainVal, time + 0.006);
    gain.gain.exponentialRampToValueAtTime(0.001, time + duration);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.bgmGain);

    osc.start(time);
    osc.stop(time + duration + 0.01);
  }

  _playBGMKick(time, gainVal = 0.2) {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(125, time);
    osc.frequency.exponentialRampToValueAtTime(36, time + 0.09);

    gain.gain.setValueAtTime(gainVal, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.1);

    osc.connect(gain);
    gain.connect(this.bgmGain);

    osc.start(time);
    osc.stop(time + 0.11);
  }

  _playBGMHat(time, duration = 0.04, gainVal = 0.08) {
    if (!this.ctx || !this.noiseBuffer) return;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.setValueAtTime(5200, time);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(gainVal, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + duration);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.bgmGain);

    src.start(time, 0, duration + 0.01);
  }

  // ============================================================================
  // Procedural Sound Effects (SFX)
  // ============================================================================

  /**
   * Crisp card snap + subtle high-frequency flick
   */
  playCardSelect() {
    if (!this._canTrigger('cardSelect', 25)) return;
    const now = this.ctx.currentTime;
    this._trackVoice(0.08);

    // Quick resonant pop
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(520, now);
    osc.frequency.exponentialRampToValueAtTime(1240, now + 0.045);

    gain.gain.setValueAtTime(0.28, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.055);

    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.06);

    // Paper snap noise
    this._playFilteredNoise(now, 0.035, 'bandpass', 3200, 2.2, 0.22);
  }

  /**
   * Juicy power-up chime when attaching a foul modifier seal; pitches higher on 2nd mod
   */
  playModAttach(modIndex = 0) {
    if (!this._canTrigger('modAttach', 35)) return;
    const now = this.ctx.currentTime;
    this._trackVoice(0.26);

    const semitoneShift = Math.min(12, modIndex * 5);
    const mult = Math.pow(2, semitoneShift / 12);
    const notes = [523.25 * mult, 659.25 * mult, 783.99 * mult, 1046.5 * mult];

    notes.forEach((freq, idx) => {
      const t = now + idx * 0.032;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = idx === notes.length - 1 ? 'sawtooth' : 'triangle';
      osc.frequency.setValueAtTime(freq, t);

      gain.gain.setValueAtTime(0.001, t);
      gain.gain.linearRampToValueAtTime(0.26, t + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.14);

      osc.connect(gain);
      gain.connect(this.sfxGain);
      osc.start(t);
      osc.stop(t + 0.15);
    });
  }

  /**
   * Felt-tip red marker scratch + heavy magical stamp impact!
   */
  playRedPenWrite() {
    if (!this._canTrigger('redPen', 80)) return;
    const now = this.ctx.currentTime;
    this._trackVoice(0.45);

    // 1. Marker fast scratch squeak (2 strokes)
    for (let i = 0; i < 2; i++) {
      const st = now + i * 0.075;
      this._playFilteredNoise(st, 0.06, 'bandpass', 2400 + i * 700, 4.0, 0.32);

      const squeak = this.ctx.createOscillator();
      const sqGain = this.ctx.createGain();
      squeak.type = 'sawtooth';
      squeak.frequency.setValueAtTime(1100 + i * 300, st);
      squeak.frequency.exponentialRampToValueAtTime(2200 + i * 400, st + 0.055);
      sqGain.gain.setValueAtTime(0.14, st);
      sqGain.gain.exponentialRampToValueAtTime(0.001, st + 0.06);
      squeak.connect(sqGain);
      sqGain.connect(this.sfxGain);
      squeak.start(st);
      squeak.stop(st + 0.065);
    }

    // 2. Heavy Rule-Override Stamp Impact at +160ms
    const stampTime = now + 0.16;
    const sub = this.ctx.createOscillator();
    const subGain = this.ctx.createGain();
    sub.type = 'sine';
    sub.frequency.setValueAtTime(190, stampTime);
    sub.frequency.exponentialRampToValueAtTime(42, stampTime + 0.22);

    subGain.gain.setValueAtTime(0.55, stampTime);
    subGain.gain.exponentialRampToValueAtTime(0.001, stampTime + 0.24);
    sub.connect(subGain);
    subGain.connect(this.sfxGain);
    sub.start(stampTime);
    sub.stop(stampTime + 0.25);

    // Magical rule-rewrite chord flash
    [440, 554.37, 659.25, 880].forEach((freq) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(freq, stampTime);
      gain.gain.setValueAtTime(0.12, stampTime);
      gain.gain.exponentialRampToValueAtTime(0.001, stampTime + 0.24);
      osc.connect(gain);
      gain.connect(this.sfxGain);
      osc.start(stampTime);
      osc.stop(stampTime + 0.25);
    });
  }

  /**
   * Dramatic siren/charge riser + explosive launch boom when pressing LAUNCH!
   */
  playLaunch() {
    if (!this._canTrigger('launch', 120)) return;
    const now = this.ctx.currentTime;
    this._trackVoice(0.55);

    // Riser siren
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(220, now);
    osc.frequency.exponentialRampToValueAtTime(980, now + 0.22);

    gain.gain.setValueAtTime(0.05, now);
    gain.gain.linearRampToValueAtTime(0.32, now + 0.2);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);

    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.29);

    // Launch Gong / Boom at +180ms
    const boomTime = now + 0.18;
    const boom = this.ctx.createOscillator();
    const boomGain = this.ctx.createGain();
    boom.type = 'sine';
    boom.frequency.setValueAtTime(160, boomTime);
    boom.frequency.exponentialRampToValueAtTime(34, boomTime + 0.32);

    boomGain.gain.setValueAtTime(0.6, boomTime);
    boomGain.gain.exponentialRampToValueAtTime(0.001, boomTime + 0.34);

    boom.connect(boomGain);
    boomGain.connect(this.sfxGain);
    boom.start(boomTime);
    boom.stop(boomTime + 0.35);

    this._playFilteredNoise(boomTime, 0.24, 'lowpass', 1900, 1.5, 0.38);
  }

  /**
   * Meaty punch/impact thud + crunch; smoothly scales pitch upward with comboCount!
   * Cooldown limiter keeps 60-hit combos clean, crisp, and euphoric.
   */
  playHit(comboCount = 1, isHeavy = false) {
    if (!this._canTrigger('hit', 34)) return;
    const now = this.ctx.currentTime;
    this._trackVoice(0.22);

    // Smooth pitch escalation up to +18 semitones across high combos
    const clampedCombo = Math.max(1, Math.min(60, comboCount));
    const semitones = Math.min(18, (clampedCombo - 1) * 0.45);
    const pitchMult = Math.pow(2, semitones / 12);

    // 1. Sub-punch body
    const punch = this.ctx.createOscillator();
    const punchGain = this.ctx.createGain();
    punch.type = isHeavy ? 'sawtooth' : 'triangle';

    const startFreq = (isHeavy ? 175 : 210) * Math.min(1.65, Math.sqrt(pitchMult));
    const endFreq = (isHeavy ? 42 : 55) * Math.min(1.35, Math.pow(pitchMult, 0.3));
    const dur = isHeavy ? 0.17 : 0.11;

    punch.frequency.setValueAtTime(startFreq, now);
    punch.frequency.exponentialRampToValueAtTime(endFreq, now + dur);

    punchGain.gain.setValueAtTime(isHeavy ? 0.52 : 0.38, now);
    punchGain.gain.exponentialRampToValueAtTime(0.001, now + dur);

    punch.connect(punchGain);
    punchGain.connect(this.sfxGain);
    punch.start(now);
    punch.stop(now + dur + 0.01);

    // 2. Crisp arcade combo chime transient (makes rising combos musical!)
    const chime = this.ctx.createOscillator();
    const chimeGain = this.ctx.createGain();
    chime.type = 'square';
    const chimeFreq = 330 * pitchMult;
    chime.frequency.setValueAtTime(chimeFreq, now);
    chime.frequency.exponentialRampToValueAtTime(chimeFreq * 1.25, now + 0.055);

    chimeGain.gain.setValueAtTime(0.16, now);
    chimeGain.gain.exponentialRampToValueAtTime(0.001, now + 0.065);

    chime.connect(chimeGain);
    chimeGain.connect(this.sfxGain);
    chime.start(now);
    chime.stop(now + 0.07);

    // 3. Impact crunch noise
    this._playFilteredNoise(
      now,
      isHeavy ? 0.12 : 0.065,
      'bandpass',
      1400 * Math.min(2.2, pitchMult),
      1.8,
      isHeavy ? 0.38 : 0.25
    );
  }

  /**
   * Deep sub-bass boom + crackling blast noise burst; pitches slightly with comboCount
   */
  playExplosion(comboCount = 1) {
    if (!this._canTrigger('explosion', 55)) return;
    const now = this.ctx.currentTime;
    this._trackVoice(0.45);

    const pitchShift = Math.pow(2, Math.min(10, (comboCount - 1) * 0.25) / 12);

    // Sub-bass shockwave
    const sub = this.ctx.createOscillator();
    const subGain = this.ctx.createGain();
    sub.type = 'sine';
    sub.frequency.setValueAtTime(140 * Math.min(1.4, pitchShift), now);
    sub.frequency.exponentialRampToValueAtTime(28, now + 0.38);

    subGain.gain.setValueAtTime(0.65, now);
    subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);

    sub.connect(subGain);
    subGain.connect(this.sfxGain);
    sub.start(now);
    sub.stop(now + 0.42);

    // Mid growl sawtooth
    const mid = this.ctx.createOscillator();
    const midGain = this.ctx.createGain();
    mid.type = 'sawtooth';
    mid.frequency.setValueAtTime(95 * pitchShift, now);
    mid.frequency.exponentialRampToValueAtTime(32, now + 0.26);

    midGain.gain.setValueAtTime(0.32, now);
    midGain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);

    mid.connect(midGain);
    midGain.connect(this.sfxGain);
    mid.start(now);
    mid.stop(now + 0.3);

    // Blast noise burst
    this._playFilteredNoise(now, 0.35, 'lowpass', 2200 * Math.min(1.6, pitchShift), 1.2, 0.48);
  }

  /**
   * Arcade KO bell ding-ding-ding + glass/armor shatter + synthesized crowd roar
   */
  playKill(comboCount = 1) {
    if (!this._canTrigger('kill', 65)) return;
    const now = this.ctx.currentTime;
    this._trackVoice(0.6);

    const pitchMult = Math.pow(2, Math.min(8, (comboCount - 1) * 0.2) / 12);

    // Ring KO Bell (metallic FM-like pair)
    [0, 0.085].forEach((offset, i) => {
      const t = now + offset;
      const bellFreq = (1180 + i * 190) * pitchMult;

      const carrier = this.ctx.createOscillator();
      const mod = this.ctx.createOscillator();
      const modGain = this.ctx.createGain();
      const bellGain = this.ctx.createGain();

      carrier.type = 'sine';
      carrier.frequency.setValueAtTime(bellFreq, t);

      mod.type = 'square';
      mod.frequency.setValueAtTime(bellFreq * 2.41, t);
      modGain.gain.setValueAtTime(380, t);
      modGain.gain.exponentialRampToValueAtTime(10, t + 0.25);

      bellGain.gain.setValueAtTime(0.32, t);
      bellGain.gain.exponentialRampToValueAtTime(0.001, t + 0.36);

      mod.connect(modGain);
      modGain.connect(carrier.frequency);
      carrier.connect(bellGain);
      bellGain.connect(this.sfxGain);

      mod.start(t);
      carrier.start(t);
      mod.stop(t + 0.37);
      carrier.stop(t + 0.37);
    });

    // Shatter / Crowd Cheer swell
    this._playFilteredNoise(now + 0.04, 0.42, 'bandpass', 1650, 1.1, 0.34);
  }

  /**
   * Electric rule-violation buzzer + rebellious power chord!
   */
  playRuleTrigger() {
    if (!this._canTrigger('ruleTrigger', 45)) return;
    const now = this.ctx.currentTime;
    this._trackVoice(0.32);

    // Foul buzzer
    const buzz = this.ctx.createOscillator();
    const buzzGain = this.ctx.createGain();
    buzz.type = 'sawtooth';
    buzz.frequency.setValueAtTime(155, now);
    buzz.frequency.setValueAtTime(185, now + 0.04);

    buzzGain.gain.setValueAtTime(0.28, now);
    buzzGain.gain.exponentialRampToValueAtTime(0.001, now + 0.11);
    buzz.connect(buzzGain);
    buzzGain.connect(this.sfxGain);
    buzz.start(now);
    buzz.stop(now + 0.12);

    // Rebellious Power Chord (A5 + E6 + A6)
    const chordTime = now + 0.05;
    [440, 659.25, 880].forEach((freq) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, chordTime);
      osc.frequency.exponentialRampToValueAtTime(freq * 1.03, chordTime + 0.22);

      gain.gain.setValueAtTime(0.16, chordTime);
      gain.gain.exponentialRampToValueAtTime(0.001, chordTime + 0.24);

      osc.connect(gain);
      gain.connect(this.sfxGain);
      osc.start(chordTime);
      osc.stop(chordTime + 0.25);
    });
  }

  /**
   * Metallic shield clank + energy barrier hum
   */
  playGuard() {
    if (!this._canTrigger('guard', 45)) return;
    const now = this.ctx.currentTime;
    this._trackVoice(0.25);

    const freqs = [420, 680, 1120];
    freqs.forEach((f, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = idx === 0 ? 'triangle' : 'square';
      osc.frequency.setValueAtTime(f, now);
      osc.frequency.exponentialRampToValueAtTime(f * 0.85, now + 0.16);

      gain.gain.setValueAtTime(0.22 / (idx + 1), now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

      osc.connect(gain);
      gain.connect(this.sfxGain);
      osc.start(now);
      osc.stop(now + 0.19);
    });

    this._playFilteredNoise(now, 0.07, 'highpass', 2800, 2.0, 0.25);
  }

  /**
   * Heavy damage thud + low grunt crunch when enemy hits player
   */
  playEnemyHitPlayer() {
    if (!this._canTrigger('enemyHitPlayer', 60)) return;
    const now = this.ctx.currentTime;
    this._trackVoice(0.3);

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(145, now);
    osc.frequency.exponentialRampToValueAtTime(36, now + 0.24);

    gain.gain.setValueAtTime(0.58, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.26);

    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.27);

    this._playFilteredNoise(now, 0.16, 'lowpass', 1100, 1.5, 0.42);
  }

  /**
   * Triumphant arcade victory fanfare arpeggio!
   */
  playVictory() {
    if (!this._canTrigger('victory', 200)) return;
    const now = this.ctx.currentTime;
    this._trackVoice(1.1);

    // C5 -> E5 -> G5 -> C6 -> E6 -> G6
    const notes = [
      { f: 523.25, t: 0.0, d: 0.12 },
      { f: 659.25, t: 0.1, d: 0.12 },
      { f: 783.99, t: 0.2, d: 0.12 },
      { f: 1046.5, t: 0.3, d: 0.22 },
      { f: 880.0, t: 0.48, d: 0.12 },
      { f: 1046.5, t: 0.6, d: 0.48 }
    ];

    notes.forEach(({ f, t, d }) => {
      const startTime = now + t;
      const osc = this.ctx.createOscillator();
      const osc2 = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'square';
      osc2.type = 'sawtooth';
      osc.frequency.setValueAtTime(f, startTime);
      osc2.frequency.setValueAtTime(f * 1.004, startTime);

      gain.gain.setValueAtTime(0.001, startTime);
      gain.gain.linearRampToValueAtTime(0.24, startTime + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + d);

      osc.connect(gain);
      osc2.connect(gain);
      gain.connect(this.sfxGain);

      osc.start(startTime);
      osc2.start(startTime);
      osc.stop(startTime + d + 0.02);
      osc2.stop(startTime + d + 0.02);
    });
  }

  /**
   * Referee whistle blow + downward sad synth trombone
   */
  playDefeat() {
    if (!this._canTrigger('defeat', 200)) return;
    const now = this.ctx.currentTime;
    this._trackVoice(1.2);

    // 1. Referee Whistle Trill
    const whistle = this.ctx.createOscillator();
    const lfo = this.ctx.createOscillator();
    const lfoGain = this.ctx.createGain();
    const wGain = this.ctx.createGain();

    whistle.type = 'sine';
    whistle.frequency.setValueAtTime(2850, now);

    lfo.type = 'square';
    lfo.frequency.setValueAtTime(42, now);
    lfoGain.gain.setValueAtTime(160, now);

    wGain.gain.setValueAtTime(0.28, now);
    wGain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

    lfo.connect(lfoGain);
    lfoGain.connect(whistle.frequency);
    whistle.connect(wGain);
    wGain.connect(this.sfxGain);

    lfo.start(now);
    whistle.start(now);
    lfo.stop(now + 0.36);
    whistle.stop(now + 0.36);

    // 2. Downward Sad Trombone / Synth
    const steps = [
      { f: 311.13, t: 0.38, d: 0.2 },
      { f: 293.66, t: 0.58, d: 0.2 },
      { f: 277.18, t: 0.78, d: 0.2 },
      { f: 261.63, t: 0.98, d: 0.45 }
    ];

    steps.forEach(({ f, t, d }, idx) => {
      const st = now + t;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(f, st);
      if (idx === steps.length - 1) {
        osc.frequency.exponentialRampToValueAtTime(f * 0.84, st + d);
      }

      gain.gain.setValueAtTime(0.22, st);
      gain.gain.exponentialRampToValueAtTime(0.001, st + d);

      osc.connect(gain);
      gain.connect(this.sfxGain);
      osc.start(st);
      osc.stop(st + d + 0.02);
    });
  }

  _playFilteredNoise(startTime, duration, filterType, cutoff, Q, gainVal) {
    if (!this.ctx || !this.noiseBuffer) return;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = filterType;
    filter.frequency.setValueAtTime(cutoff, startTime);
    filter.Q.setValueAtTime(Q, startTime);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(gainVal, startTime);
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain);

    const offset = Math.random() * 0.5;
    src.start(startTime, offset, duration + 0.02);
  }
}

export const sound = new AudioManager();
export default sound;
