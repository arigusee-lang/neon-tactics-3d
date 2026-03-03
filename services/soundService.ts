type SoundTone = {
  at: number;
  duration: number;
  frequency: number;
  volume?: number;
  type?: OscillatorType;
};

const SOUND_STORAGE_KEY = 'neon-tactics-sfx-enabled';

class SoundService {
  private context: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private enabled = this.readEnabledPreference();

  isEnabled(): boolean {
    return this.enabled;
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(SOUND_STORAGE_KEY, enabled ? '1' : '0');
    }

    if (this.masterGain && this.context) {
      this.masterGain.gain.cancelScheduledValues(this.context.currentTime);
      this.masterGain.gain.setValueAtTime(enabled ? 0.8 : 0, this.context.currentTime);
    }
  }

  playUiClick(): void {
    this.playSequence([
      { at: 0, duration: 0.045, frequency: 420, volume: 0.02, type: 'square' },
      { at: 0.05, duration: 0.06, frequency: 620, volume: 0.015, type: 'triangle' }
    ]);
  }

  playError(): void {
    this.playSequence([
      { at: 0, duration: 0.05, frequency: 210, volume: 0.02, type: 'square' },
      { at: 0.055, duration: 0.08, frequency: 160, volume: 0.018, type: 'sawtooth' }
    ]);
  }

  playPanelToggle(expanded: boolean): void {
    this.playSequence(expanded
      ? [
          { at: 0, duration: 0.06, frequency: 320, volume: 0.02, type: 'triangle' },
          { at: 0.06, duration: 0.08, frequency: 520, volume: 0.022, type: 'triangle' }
        ]
      : [
          { at: 0, duration: 0.06, frequency: 520, volume: 0.02, type: 'triangle' },
          { at: 0.06, duration: 0.08, frequency: 320, volume: 0.018, type: 'triangle' }
        ]);
  }

  playUnitSelect(): void {
    this.playSequence([
      { at: 0, duration: 0.05, frequency: 330, volume: 0.018, type: 'triangle' },
      { at: 0.055, duration: 0.07, frequency: 495, volume: 0.02, type: 'sine' }
    ]);
  }

  playProjectileLaunch(kind: 'beam' | 'tower' | 'support' = 'beam'): void {
    if (kind === 'tower') {
      this.playSequence([
        { at: 0, duration: 0.03, frequency: 880, volume: 0.018, type: 'square' },
        { at: 0.03, duration: 0.08, frequency: 240, volume: 0.024, type: 'sawtooth' }
      ]);
      return;
    }

    if (kind === 'support') {
      this.playSequence([
        { at: 0, duration: 0.05, frequency: 540, volume: 0.016, type: 'sine' },
        { at: 0.05, duration: 0.06, frequency: 760, volume: 0.014, type: 'triangle' }
      ]);
      return;
    }

    this.playSequence([
      { at: 0, duration: 0.025, frequency: 720, volume: 0.014, type: 'square' },
      { at: 0.022, duration: 0.05, frequency: 410, volume: 0.018, type: 'sawtooth' }
    ]);
  }

  playProjectileImpact(kind: 'beam' | 'tower' | 'support' = 'beam'): void {
    if (kind === 'tower') {
      this.playSequence([
        { at: 0, duration: 0.04, frequency: 180, volume: 0.028, type: 'sawtooth' },
        { at: 0.03, duration: 0.12, frequency: 90, volume: 0.02, type: 'triangle' }
      ]);
      return;
    }

    if (kind === 'support') {
      this.playSequence([
        { at: 0, duration: 0.06, frequency: 660, volume: 0.014, type: 'sine' },
        { at: 0.06, duration: 0.09, frequency: 520, volume: 0.012, type: 'triangle' }
      ]);
      return;
    }

    this.playSequence([
      { at: 0, duration: 0.03, frequency: 280, volume: 0.018, type: 'square' },
      { at: 0.025, duration: 0.08, frequency: 180, volume: 0.016, type: 'triangle' }
    ]);
  }

  playTeleport(): void {
    this.playSequence([
      { at: 0, duration: 0.08, frequency: 300, volume: 0.014, type: 'sine' },
      { at: 0.05, duration: 0.12, frequency: 820, volume: 0.02, type: 'triangle' },
      { at: 0.16, duration: 0.08, frequency: 460, volume: 0.015, type: 'sine' }
    ]);
  }

  playExplosion(): void {
    this.playSequence([
      { at: 0, duration: 0.04, frequency: 140, volume: 0.03, type: 'sawtooth' },
      { at: 0.025, duration: 0.12, frequency: 70, volume: 0.022, type: 'triangle' },
      { at: 0.07, duration: 0.08, frequency: 220, volume: 0.012, type: 'square' }
    ]);
  }

  playPortalCollapse(): void {
    this.playSequence([
      { at: 0, duration: 0.1, frequency: 520, volume: 0.02, type: 'triangle' },
      { at: 0.09, duration: 0.12, frequency: 390, volume: 0.022, type: 'sawtooth' },
      { at: 0.2, duration: 0.18, frequency: 210, volume: 0.024, type: 'triangle' },
      { at: 0.34, duration: 0.24, frequency: 110, volume: 0.02, type: 'sine' }
    ]);
  }

  playShieldDeflect(): void {
    this.playSequence([
      { at: 0, duration: 0.03, frequency: 1100, volume: 0.014, type: 'square' },
      { at: 0.02, duration: 0.08, frequency: 780, volume: 0.014, type: 'triangle' }
    ]);
  }

  playTurnChange(isLocalTurn: boolean): void {
    this.playSequence(isLocalTurn
      ? [
          { at: 0, duration: 0.08, frequency: 392, volume: 0.028, type: 'triangle' },
          { at: 0.085, duration: 0.09, frequency: 523.25, volume: 0.03, type: 'triangle' },
          { at: 0.18, duration: 0.12, frequency: 659.25, volume: 0.028, type: 'sine' }
        ]
      : [
          { at: 0, duration: 0.08, frequency: 349.23, volume: 0.02, type: 'triangle' },
          { at: 0.09, duration: 0.1, frequency: 293.66, volume: 0.018, type: 'sine' }
        ]);
  }

  playReward(): void {
    this.playSequence([
      { at: 0, duration: 0.08, frequency: 523.25, volume: 0.022, type: 'triangle' },
      { at: 0.09, duration: 0.09, frequency: 659.25, volume: 0.024, type: 'triangle' },
      { at: 0.19, duration: 0.16, frequency: 783.99, volume: 0.022, type: 'sine' }
    ]);
  }

  playVictory(): void {
    this.playSequence([
      { at: 0, duration: 0.12, frequency: 392, volume: 0.03, type: 'triangle' },
      { at: 0.13, duration: 0.12, frequency: 523.25, volume: 0.032, type: 'triangle' },
      { at: 0.27, duration: 0.16, frequency: 659.25, volume: 0.032, type: 'triangle' },
      { at: 0.45, duration: 0.26, frequency: 783.99, volume: 0.028, type: 'sine' }
    ]);
  }

  playDefeat(): void {
    this.playSequence([
      { at: 0, duration: 0.12, frequency: 392, volume: 0.022, type: 'sawtooth' },
      { at: 0.12, duration: 0.14, frequency: 311.13, volume: 0.02, type: 'triangle' },
      { at: 0.28, duration: 0.2, frequency: 233.08, volume: 0.018, type: 'sine' }
    ]);
  }

  private readEnabledPreference(): boolean {
    if (typeof window === 'undefined') {
      return true;
    }

    return window.localStorage.getItem(SOUND_STORAGE_KEY) !== '0';
  }

  private ensureAudioGraph(): boolean {
    if (!this.enabled || typeof window === 'undefined') {
      return false;
    }

    const audioWindow = window as Window & {
      webkitAudioContext?: typeof AudioContext;
    };
    const AudioContextCtor = window.AudioContext || audioWindow.webkitAudioContext;

    if (!AudioContextCtor) {
      return false;
    }

    if (!this.context) {
      this.context = new AudioContextCtor();
      this.masterGain = this.context.createGain();
      this.masterGain.gain.value = 0.8;
      this.masterGain.connect(this.context.destination);
    }

    if (this.context.state === 'suspended') {
      void this.context.resume();
    }

    return true;
  }

  private playSequence(tones: SoundTone[]): void {
    if (!this.ensureAudioGraph() || !this.context || !this.masterGain) {
      return;
    }

    const now = this.context.currentTime;

    tones.forEach((tone) => {
      const oscillator = this.context!.createOscillator();
      const gain = this.context!.createGain();
      const start = now + tone.at;
      const end = start + tone.duration;
      const peakVolume = tone.volume ?? 0.02;

      oscillator.type = tone.type ?? 'triangle';
      oscillator.frequency.setValueAtTime(tone.frequency, start);

      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(peakVolume, start + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, end);

      oscillator.connect(gain);
      gain.connect(this.masterGain!);

      oscillator.start(start);
      oscillator.stop(end + 0.02);
    });
  }
}

export const soundService = new SoundService();
