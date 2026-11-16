import { DeviceCommand } from '../types';

class AudioAnnouncerService {
  private audioCtx: AudioContext | null = null;
  private isMuted: boolean = false;
  private isUnlocked: boolean = false;
  private currentAnnouncement: string | null = null;
  private speechRate: number = 1.05;
  private speechVolume: number = 1.0;
  private selectedVoice: SpeechSynthesisVoice | null = null;
  private listeners: Set<(state: { isSpeaking: boolean; currentText: string | null; isMuted: boolean }) => void> = new Set();

  constructor() {
    if (typeof window !== 'undefined') {
      const savedMute = localStorage.getItem('sentinel_commands_muted');
      if (savedMute !== null) {
        this.isMuted = savedMute === 'true';
      }

      if ('speechSynthesis' in window) {
        window.speechSynthesis.onvoiceschanged = () => {
          this.pickBestVoice();
        };
        this.pickBestVoice();
      }
    }
  }

  private pickBestVoice() {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    const voices = window.speechSynthesis.getVoices();
    if (!voices || voices.length === 0) return;

    // Prefer clear modern English voices
    const preferred = voices.find(v => 
      (v.lang.startsWith('en') && (v.name.includes('Google') || v.name.includes('Natural') || v.name.includes('Samantha') || v.name.includes('Daniel') || v.name.includes('Karen') || v.name.includes('Zira')))
    ) || voices.find(v => v.lang.startsWith('en')) || voices[0];

    this.selectedVoice = preferred || null;
  }

  public getAvailableVoices(): SpeechSynthesisVoice[] {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return [];
    return window.speechSynthesis.getVoices().filter(v => v.lang.startsWith('en'));
  }

  public setVoice(voiceName: string) {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    const voice = window.speechSynthesis.getVoices().find(v => v.name === voiceName);
    if (voice) {
      this.selectedVoice = voice;
    }
  }

  public getVoiceName(): string {
    return this.selectedVoice?.name || 'System Default';
  }

  private initAudioContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.audioCtx) {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContextClass) {
        this.audioCtx = new AudioContextClass();
      }
    }
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume().catch(() => {});
    }
    return this.audioCtx;
  }

  public unlockAudio(): boolean {
    this.isUnlocked = true;
    const ctx = this.initAudioContext();
    if (ctx && ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }
    // Warm up speech synthesis
    if ('speechSynthesis' in window) {
      window.speechSynthesis.resume();
    }
    this.notify();
    return true;
  }

  public getIsUnlocked(): boolean {
    return this.isUnlocked;
  }

  public getIsMuted(): boolean {
    return this.isMuted;
  }

  public toggleMute(): boolean {
    this.isMuted = !this.isMuted;
    if (typeof window !== 'undefined') {
      localStorage.setItem('sentinel_commands_muted', String(this.isMuted));
      if (this.isMuted && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        this.currentAnnouncement = null;
      }
    }
    this.notify();
    return this.isMuted;
  }

  public setMuted(muted: boolean) {
    this.isMuted = muted;
    if (typeof window !== 'undefined') {
      localStorage.setItem('sentinel_commands_muted', String(this.isMuted));
      if (this.isMuted && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        this.currentAnnouncement = null;
      }
    }
    this.notify();
  }

  public setSpeechRate(rate: number) {
    this.speechRate = Math.max(0.7, Math.min(1.6, rate));
  }

  public getSpeechRate(): number {
    return this.speechRate;
  }

  public setSpeechVolume(vol: number) {
    this.speechVolume = Math.max(0.1, Math.min(1.0, vol));
  }

  public getSpeechVolume(): number {
    return this.speechVolume;
  }

  public subscribe(callback: (state: { isSpeaking: boolean; currentText: string | null; isMuted: boolean }) => void) {
    this.listeners.add(callback);
    callback({
      isSpeaking: !!this.currentAnnouncement,
      currentText: this.currentAnnouncement,
      isMuted: this.isMuted
    });
    return () => {
      this.listeners.delete(callback);
    };
  }

  private notify() {
    const state = {
      isSpeaking: !!this.currentAnnouncement,
      currentText: this.currentAnnouncement,
      isMuted: this.isMuted
    };
    this.listeners.forEach(cb => cb(state));
  }

  /**
   * Generates a futuristic cyber audio chime using Web Audio API
   */
  public playChime(isCritical: boolean = false) {
    if (this.isMuted) return;
    try {
      const ctx = this.initAudioContext();
      if (!ctx) return;

      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = isCritical ? 'sawtooth' : 'sine';

      if (isCritical) {
        // High alert rapid dual chirp
        osc.frequency.setValueAtTime(980, now);
        osc.frequency.exponentialRampToValueAtTime(1480, now + 0.08);
        osc.frequency.setValueAtTime(1200, now + 0.1);
        osc.frequency.exponentialRampToValueAtTime(1600, now + 0.2);

        gain.gain.setValueAtTime(0.001, now);
        gain.gain.exponentialRampToValueAtTime(0.18 * this.speechVolume, now + 0.03);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.26);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.27);
      } else {
        // Smooth futuristic command arrival blip
        osc.frequency.setValueAtTime(660, now);
        osc.frequency.exponentialRampToValueAtTime(1100, now + 0.12);

        gain.gain.setValueAtTime(0.001, now);
        gain.gain.exponentialRampToValueAtTime(0.15 * this.speechVolume, now + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.19);
      }
    } catch {
      // Audio context might fail before gesture, ignore safely
    }
  }

  /**
   * Announces an inbound command verbally and displays in visual HUD
   */
  public announceCommand(command: DeviceCommand) {
    const isCritical = command.severity === 'CRITICAL';
    const spokenText = command.spokenAnnouncement || (
      isCritical 
        ? `Warning! Critical command dispatched to device: ${command.actionSummary}`
        : `Command sent to device: ${command.actionSummary}`
    );

    this.currentAnnouncement = command.actionSummary;
    this.notify();

    // Play cyber acoustic telemetry blip
    this.playChime(isCritical);

    // Speak aloud using SpeechSynthesis if not muted
    if (!this.isMuted && typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        // Cancel prior speech so rapid commands don't buffer excessively
        window.speechSynthesis.cancel();

        const utterance = new SpeechSynthesisUtterance(spokenText);
        if (this.selectedVoice) {
          utterance.voice = this.selectedVoice;
        }
        utterance.rate = this.speechRate;
        utterance.volume = this.speechVolume;
        utterance.pitch = isCritical ? 1.15 : 1.0;

        utterance.onend = () => {
          if (this.currentAnnouncement === command.actionSummary) {
            this.currentAnnouncement = null;
            this.notify();
          }
        };

        utterance.onerror = () => {
          this.currentAnnouncement = null;
          this.notify();
        };

        window.speechSynthesis.speak(utterance);
      } catch (err) {
        console.warn("Speech announcement error:", err);
      }
    }

    // Clear visual pulse after 4 seconds if onend did not fire
    setTimeout(() => {
      if (this.currentAnnouncement === command.actionSummary) {
        this.currentAnnouncement = null;
        this.notify();
      }
    }, 4200);
  }

  /**
   * Announces a critical Android system patch or CVE vulnerability verbally
   */
  public announceCriticalPatch(patchTitle: string, cveSummary: string, deviceModel: string) {
    const summaryLabel = `Critical Android Patch: ${patchTitle}`;
    const spokenText = `Critical phone security patch detected for ${deviceModel}. ${patchTitle}. ${cveSummary}. Review and apply immediately.`;

    this.currentAnnouncement = summaryLabel;
    this.notify();

    this.playChime(true);

    if (!this.isMuted && typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(spokenText);
        if (this.selectedVoice) {
          utterance.voice = this.selectedVoice;
        }
        utterance.rate = this.speechRate;
        utterance.volume = this.speechVolume;
        utterance.pitch = 1.15;

        utterance.onend = () => {
          if (this.currentAnnouncement === summaryLabel) {
            this.currentAnnouncement = null;
            this.notify();
          }
        };

        utterance.onerror = () => {
          this.currentAnnouncement = null;
          this.notify();
        };

        window.speechSynthesis.speak(utterance);
      } catch (err) {
        console.warn("Critical patch speech announcement error:", err);
      }
    }

    setTimeout(() => {
      if (this.currentAnnouncement === summaryLabel) {
        this.currentAnnouncement = null;
        this.notify();
      }
    }, 5200);
  }

  public testAnnouncement() {
    this.unlockAudio();
    this.announceCommand({
      id: 'test-cmd',
      timestamp: new Date().toLocaleTimeString(),
      isoTimestamp: new Date().toISOString(),
      targetDevice: 'Local Workstation (SEC-01)',
      sourceDispatcher: 'Sentinel SecOps Voice Daemon',
      commandText: 'test_telemetry_beacon --audible',
      actionSummary: 'Voice Announcer Test Beacon',
      category: 'TELEMETRY',
      severity: 'STANDARD',
      status: 'SUCCESS',
      authorizedBy: 'Console Operator',
      spokenAnnouncement: 'Sentinel Voice Announcer test. Audio channel nominal.'
    });
  }
}

export const audioAnnouncer = new AudioAnnouncerService();
