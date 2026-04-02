import { STORAGE_SETTINGS_KEY } from '../utils/constants';
import type { BirdSkin } from '../utils/types';

const DEFAULT_BIRD_SKIN: BirdSkin = 'default';

function isBirdSkin(value: unknown): value is BirdSkin {
  return value === 'default' || value === 'bee';
}

/** Persisted audio settings shape. */
interface AudioSettings {
  muted: boolean;
  musicEnabled: boolean;
  birdSkin: BirdSkin;
}

/**
 * Procedural audio engine for the Flappy Bird game.
 *
 * All sounds are generated via Web Audio API — no external audio files.
 * The singleton is obtained via `AudioManager.getInstance()`.
 * Call `init()` from a user-gesture event handler to satisfy browser
 * autoplay policy before playing any sound.
 */
export class AudioManager {
  /* ------------------------------------------------------------------ */
  /*  Singleton                                                          */
  /* ------------------------------------------------------------------ */

  private static instance: AudioManager | null = null;

  /** Return the singleton instance, creating it on first access. */
  static getInstance(): AudioManager {
    if (!AudioManager.instance) {
      AudioManager.instance = new AudioManager();
    }
    return AudioManager.instance;
  }

  /* ------------------------------------------------------------------ */
  /*  Internal state                                                     */
  /* ------------------------------------------------------------------ */

  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private musicOscillators: OscillatorNode[] = [];
  private musicInterval: ReturnType<typeof setInterval> | null = null;
  private _muted: boolean;
  private _musicEnabled: boolean;
  private _birdSkin: BirdSkin;
  private initialized = false;
  /** Guard against concurrent calls to init() racing each other. */
  private initPromise: Promise<void> | null = null;

  /** Gain applied to the music bus — loud enough to hear, soft enough for background. */
  private static readonly MUSIC_GAIN = 0.65;

  /* ------------------------------------------------------------------ */
  /*  Construction & initialisation                                      */
  /* ------------------------------------------------------------------ */

  private constructor() {
    const settings = this.loadSettings();
    this._muted = settings.muted;
    this._musicEnabled = settings.musicEnabled;
    this._birdSkin = settings.birdSkin;
  }

  /**
   * Resume (or create) the AudioContext.
   * **Must** be called inside a user-gesture event handler (click / keydown)
   * to satisfy browser autoplay policy.
   * Concurrent calls are coalesced — only one initialization runs at a time.
   */
  async init(): Promise<void> {
    if (this.initialized) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = this._doInit();
    try {
      await this.initPromise;
    } finally {
      this.initPromise = null;
    }
  }

  private async _doInit(): Promise<void> {
    if (this.initialized) return;

    if (typeof AudioContext === 'undefined') return;

    try {
      this.ctx = new AudioContext();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = this._muted ? 0 : 1;
      this.masterGain.connect(this.ctx.destination);

      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = this._musicEnabled ? AudioManager.MUSIC_GAIN : 0;
      this.musicGain.connect(this.masterGain);

      if (this.ctx.state === 'suspended') {
        await this.ctx.resume();
      }

      this.initialized = true;
    } catch {
      // AudioContext not supported — all play* methods become no-ops.
      this.ctx = null;
      this.masterGain = null;
      this.musicGain = null;
    }
  }

  /* ------------------------------------------------------------------ */
  /*  Getters / setters                                                  */
  /* ------------------------------------------------------------------ */

  /** Whether all audio output is muted. */
  get muted(): boolean {
    return this._muted;
  }

  set muted(value: boolean) {
    this._muted = value;
    if (this.masterGain) {
      this.masterGain.gain.value = value ? 0 : 1;
    }
    this.saveSettings();
  }

  /** Whether background music is enabled. */
  get musicEnabled(): boolean {
    return this._musicEnabled;
  }

  set musicEnabled(value: boolean) {
    this._musicEnabled = value;
    if (this.musicGain) {
      this.musicGain.gain.value = value ? AudioManager.MUSIC_GAIN : 0;
    }
    if (!value) {
      this.stopMusic();
    }
    this.saveSettings();
  }

  /** Currently selected cosmetic bird skin. */
  get birdSkin(): BirdSkin {
    return this._birdSkin;
  }

  set birdSkin(value: BirdSkin) {
    this._birdSkin = value;
    this.saveSettings();
  }

  /** Set master volume (0 – 1). */
  setVolume(volume: number): void {
    const clamped = Math.max(0, Math.min(1, volume));
    if (this.masterGain) {
      this.masterGain.gain.value = this._muted ? 0 : clamped;
    }
  }

  /* ------------------------------------------------------------------ */
  /*  Sound effects                                                      */
  /* ------------------------------------------------------------------ */

  /** Short sine-wave chirp sweeping 400 → 700 Hz over 80 ms. */
  playFlap(): void {
    if (!this.canPlay()) return;
    const ctx = this.ctx!;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(400, now);
    osc.frequency.linearRampToValueAtTime(700, now + 0.08);

    gain.gain.setValueAtTime(0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

    osc.connect(gain).connect(this.masterGain!);
    osc.start(now);
    osc.stop(now + 0.1);
  }

  /** Pleasant ding — 800 Hz sine, 150 ms, smooth decay. */
  playScore(): void {
    if (!this.canPlay()) return;
    const ctx = this.ctx!;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = 800;

    gain.gain.setValueAtTime(0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

    osc.connect(gain).connect(this.masterGain!);
    osc.start(now);
    osc.stop(now + 0.2);
  }

  /** Low thud — filtered noise burst at 150 Hz, 200 ms. */
  playCollision(): void {
    if (!this.canPlay()) return;
    const ctx = this.ctx!;
    const now = ctx.currentTime;

    // White-noise buffer
    const bufferSize = ctx.sampleRate * 0.2;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const source = ctx.createBufferSource();
    source.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 150;
    filter.Q.value = 1;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.5, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);

    source.connect(filter).connect(gain).connect(this.masterGain!);
    source.start(now);
    source.stop(now + 0.25);
  }

  /** Rising arpeggio — C5, E5, G5 (523, 659, 784 Hz), each 60 ms. */
  playReward(): void {
    if (!this.canPlay()) return;
    const ctx = this.ctx!;
    const now = ctx.currentTime;
    const notes = [523, 659, 784];

    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;

      const start = now + i * 0.05;
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(0.25, start + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.06);

      osc.connect(gain).connect(this.masterGain!);
      osc.start(start);
      osc.stop(start + 0.08);
    });
  }

  /** Ascending scale fanfare — 5 notes (C5 → G5), each 100 ms. */
  playLevelComplete(): void {
    if (!this.canPlay()) return;
    const ctx = this.ctx!;
    const now = ctx.currentTime;
    const notes = [523, 587, 659, 698, 784]; // C5 D5 E5 F5 G5

    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;

      const start = now + i * 0.1;
      gain.gain.setValueAtTime(0.25, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.1);

      osc.connect(gain).connect(this.masterGain!);
      osc.start(start);
      osc.stop(start + 0.15);
    });
  }

  /** Descending sad tones — 3 notes going down, 150 ms each. */
  playGameOver(): void {
    if (!this.canPlay()) return;
    const ctx = this.ctx!;
    const now = ctx.currentTime;
    const notes = [523, 440, 349]; // C5 → A4 → F4

    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;

      const start = now + i * 0.15;
      gain.gain.setValueAtTime(0.25, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.15);

      osc.connect(gain).connect(this.masterGain!);
      osc.start(start);
      osc.stop(start + 0.2);
    });
  }

  /** UI click — very short 1 000 Hz sine, 30 ms. */
  playClick(): void {
    if (!this.canPlay()) return;
    const ctx = this.ctx!;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = 1000;

    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.03);

    osc.connect(gain).connect(this.masterGain!);
    osc.start(now);
    osc.stop(now + 0.05);
  }

  /* ------------------------------------------------------------------ */
  /*  Background music                                                   */
  /* ------------------------------------------------------------------ */

  /**
   * Start a relaxing but catchy looping groove using airy pads,
   * a gentle bass pulse, and a light arpeggio motif.
   */
  startMusic(): void {
    if (!this.canPlay() || !this._musicEnabled) return;
    if (this.musicInterval) return; // already playing

    this.playChordProgression();
    this.musicInterval = setInterval(() => {
      this.playChordProgression();
    }, 8000);
  }

  /** Fade out and stop background music. */
  stopMusic(): void {
    if (this.musicInterval) {
      clearInterval(this.musicInterval);
      this.musicInterval = null;
    }
    this.cleanupMusicOscillators();
  }

  /* ------------------------------------------------------------------ */
  /*  Private helpers                                                     */
  /* ------------------------------------------------------------------ */

  /** Whether the audio system is ready and unmuted. */
  private canPlay(): boolean {
    return this.initialized && this.ctx !== null && !this._muted;
  }

  /**
   * Play one 8-second music cycle.
   * Each 2-second bar has:
   * - a soft sustained pad chord
   * - a warm bass pulse on the root
   * - a light off-beat arpeggio so the loop feels beaty and memorable
   */
  private playChordProgression(): void {
    if (!this.ctx || !this.musicGain) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;

    this.cleanupMusicOscillators();

    const chords: number[][] = [
      [261.63, 329.63, 392.0], // Cmaj
      [220.0, 261.63, 329.63], // Am7/C feel
      [196.0, 246.94, 293.66], // G
      [174.61, 220.0, 261.63], // F
    ];
    const roots = [130.81, 110.0, 98.0, 87.31];
    const chordDuration = 2;

    chords.forEach((chord, ci) => {
      const chordStart = now + ci * chordDuration;

      chord.forEach((freq, noteIndex) => {
        this.scheduleMusicNote(freq, chordStart, chordDuration, 0.055, 'sine');
        this.scheduleMusicNote(freq * 1.002, chordStart, chordDuration, 0.030, 'triangle');

        const arpeggioTimes = [0.32, 0.82, 1.32, 1.72];
        arpeggioTimes.forEach((offset, arpIndex) => {
          const arpFreq = chord[(noteIndex + arpIndex) % chord.length] * 2;
          this.scheduleMusicNote(arpFreq, chordStart + offset, 0.16, 0.025, 'triangle');
        });
      });

      const root = roots[ci];
      [0, 0.95].forEach((offset) => {
        this.scheduleMusicNote(root, chordStart + offset, 0.34, 0.050, 'sine');
        this.scheduleMusicNote(root * 2, chordStart + offset + 0.05, 0.18, 0.022, 'triangle');
      });
    });
  }

  /** Schedule one softly shaped note for the music bed. */
  private scheduleMusicNote(
    frequency: number,
    start: number,
    duration: number,
    peakGain: number,
    type: OscillatorType,
  ): void {
    if (!this.ctx || !this.musicGain) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(frequency, start);

    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.linearRampToValueAtTime(peakGain, start + Math.min(0.08, duration * 0.35));
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);

    osc.connect(gain).connect(this.musicGain);
    osc.start(start);
    osc.stop(start + duration + 0.02);
    this.musicOscillators.push(osc);
  }

  /** Disconnect and clear all music oscillator references. */
  private cleanupMusicOscillators(): void {
    for (const osc of this.musicOscillators) {
      try {
        osc.disconnect();
      } catch {
        // Already stopped / disconnected — safe to ignore.
      }
    }
    this.musicOscillators = [];
  }

  /* ------------------------------------------------------------------ */
  /*  Persistence                                                        */
  /* ------------------------------------------------------------------ */

  /** Load audio settings from localStorage. */
  private loadSettings(): AudioSettings {
    try {
      const raw = localStorage.getItem(STORAGE_SETTINGS_KEY);
      if (raw) {
        const parsed: unknown = JSON.parse(raw);
        if (
          typeof parsed === 'object' &&
          parsed !== null &&
          'muted' in parsed &&
          'musicEnabled' in parsed
        ) {
          const obj = parsed as Record<string, unknown>;
          return {
            muted: typeof obj['muted'] === 'boolean' ? obj['muted'] : false,
            musicEnabled:
              typeof obj['musicEnabled'] === 'boolean'
                ? obj['musicEnabled']
                : true,
            birdSkin: isBirdSkin(obj['birdSkin']) ? obj['birdSkin'] : DEFAULT_BIRD_SKIN,
          };
        }
      }
    } catch {
      // Corrupted data — fall through to defaults.
    }
    return { muted: false, musicEnabled: true, birdSkin: DEFAULT_BIRD_SKIN };
  }

  /** Persist current audio settings to localStorage. */
  private saveSettings(): void {
    try {
      const settings: AudioSettings = {
        muted: this._muted,
        musicEnabled: this._musicEnabled,
        birdSkin: this._birdSkin,
      };
      localStorage.setItem(STORAGE_SETTINGS_KEY, JSON.stringify(settings));
    } catch {
      // localStorage may be unavailable (private browsing) — ignore.
    }
  }
}
