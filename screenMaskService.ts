import {
  ScreenCaptureEvent,
  ScreenCaptureTriggerType,
  ScreenMaskMode,
  ScreenMaskState,
} from '../types';
import { audioAnnouncer } from './audioAnnouncer';

const STORAGE_KEY = 'sentinel_screen_mask_v1';

const BASELINE_EVENTS: ScreenCaptureEvent[] = [
  {
    id: 'scr-evt-1',
    timestamp: new Date(Date.now() - 1000 * 60 * 14).toLocaleTimeString(),
    isoTimestamp: new Date(Date.now() - 1000 * 60 * 14).toISOString(),
    triggerType: 'SCREENSHOT_HOTKEY',
    detail: 'Intercepted OS screenshot chord (Meta+Shift+4) — IPs & interception logs blurred.',
    maskApplied: 'SELECTIVE_BLUR',
    autoCleared: true,
  },
  {
    id: 'scr-evt-2',
    timestamp: new Date(Date.now() - 1000 * 60 * 38).toLocaleTimeString(),
    isoTimestamp: new Date(Date.now() - 1000 * 60 * 38).toISOString(),
    triggerType: 'SCREEN_RECORDING_STREAM',
    detail: 'Display capture stream probe detected — privacy screen mask armed for stream duration.',
    maskApplied: 'FULL_CURTAIN',
    autoCleared: true,
  },
];

const DEFAULT_STATE: ScreenMaskState = {
  autoMaskEnabled: true,
  isMaskEngaged: false,
  activeCaptureSession: false,
  maskMode: 'SELECTIVE_BLUR',
  detectScreenshotHotkeys: true,
  detectScreenRecording: true,
  blurOnVisibilityHidden: true,
  strictWindowBlurMask: false,
  autoUnmaskSeconds: 8,
  remainingUnmaskSeconds: 0,
  maskReason: null,
  lastTriggerType: null,
  lastTriggeredAt: null,
  totalScreenshotsBlocked: 14,
  totalRecordingSessionsMasked: 3,
  browserCaptureHookActive: false,
  detectedCaptureDevicesCount: 0,
  events: BASELINE_EVENTS,
};

class ScreenMaskService {
  private state: ScreenMaskState;
  private listeners: Set<(s: ScreenMaskState) => void> = new Set();
  private countdownTimer: ReturnType<typeof setInterval> | null = null;
  private listenersAttached = false;
  private displayMediaWrapped = false;
  private activeTracks: Set<MediaStreamTrack> = new Set();

  constructor() {
    this.state = this.loadState();
    this.syncDomAttributes();
    if (typeof window !== 'undefined') {
      this.attachGlobalDetectors();
    }
  }

  private loadState(): ScreenMaskState {
    if (typeof window === 'undefined') return DEFAULT_STATE;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return DEFAULT_STATE;
      const parsed = JSON.parse(raw) as Partial<ScreenMaskState>;
      return {
        ...DEFAULT_STATE,
        ...parsed,
        // Never boot stuck in an active transient capture session
        isMaskEngaged: false,
        activeCaptureSession: false,
        remainingUnmaskSeconds: 0,
        maskReason: null,
        events: Array.isArray(parsed.events) && parsed.events.length > 0 ? parsed.events : BASELINE_EVENTS,
      };
    } catch {
      return DEFAULT_STATE;
    }
  }

  private saveState() {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
    } catch {
      // Ignore storage quota issues
    }
  }

  private syncDomAttributes() {
    if (typeof document === 'undefined') return;
    document.documentElement.setAttribute(
      'data-screen-masked',
      this.state.isMaskEngaged ? 'true' : 'false'
    );
    document.documentElement.setAttribute('data-screen-mask-mode', this.state.maskMode);
  }

  private notify() {
    this.syncDomAttributes();
    this.saveState();
    const snap: ScreenMaskState = {
      ...this.state,
      events: [...this.state.events],
    };
    this.listeners.forEach(fn => fn(snap));
  }

  public getSnapshot(): ScreenMaskState {
    return {
      ...this.state,
      events: [...this.state.events],
    };
  }

  public subscribe(fn: (s: ScreenMaskState) => void): () => void {
    this.listeners.add(fn);
    fn(this.getSnapshot());
    return () => {
      this.listeners.delete(fn);
    };
  }

  private attachGlobalDetectors() {
    if (this.listenersAttached) return;
    this.listenersAttached = true;

    const handleKey = (e: KeyboardEvent) => {
      if (!this.state.autoMaskEnabled || !this.state.detectScreenshotHotkeys) return;

      const keyLower = (e.key || '').toLowerCase();
      const isPrintScreen = e.key === 'PrintScreen' || e.code === 'PrintScreen';
      const isMacScreenshot = e.metaKey && e.shiftKey && ['3', '4', '5', '6'].includes(e.key);
      const isWinSnip = e.metaKey && e.shiftKey && keyLower === 's';
      const isPrintCombo = (e.ctrlKey || e.metaKey) && keyLower === 'p';

      if (isPrintScreen) {
        this.triggerCaptureMask(
          'SCREENSHOT_HOTKEY',
          'PrintScreen key detected — blurring sensitive IPs & logs.',
          false
        );
      } else if (isMacScreenshot) {
        this.triggerCaptureMask(
          'SCREENSHOT_HOTKEY',
          `macOS screenshot shortcut (Cmd+Shift+${e.key}) detected — data masked.`,
          false
        );
      } else if (isWinSnip) {
        this.triggerCaptureMask(
          'SCREENSHOT_HOTKEY',
          'Windows Snipping shortcut (Win+Shift+S) detected — data masked.',
          false
        );
      } else if (isPrintCombo) {
        this.triggerCaptureMask(
          'PRINT_CAPTURE',
          'Browser print / PDF snapshot shortcut intercepted — sensitive data masked.',
          false
        );
      }
    };

    window.addEventListener('keydown', handleKey, { capture: true });
    window.addEventListener('keyup', handleKey, { capture: true });

    window.addEventListener('beforeprint', () => {
      if (!this.state.autoMaskEnabled || !this.state.detectScreenshotHotkeys) return;
      this.triggerCaptureMask(
        'PRINT_CAPTURE',
        'Browser print / Save-as-PDF capture triggered — telemetry blurred.',
        false
      );
    });

    document.addEventListener('visibilitychange', () => {
      if (!this.state.autoMaskEnabled || !this.state.blurOnVisibilityHidden) return;
      if (document.visibilityState === 'hidden') {
        this.triggerCaptureMask(
          'VISIBILITY_SWITCH',
          'Tab hidden / App-Switcher snapshot guard engaged.',
          false
        );
      }
    });

    window.addEventListener('blur', () => {
      if (!this.state.autoMaskEnabled || !this.state.strictWindowBlurMask) return;
      this.triggerCaptureMask(
        'WINDOW_FOCUS_LOSS',
        'Window focus lost (external snipping/overlay guard) — telemetry masked.',
        false
      );
    });

    // Hook navigator.mediaDevices.getDisplayMedia to detect real screen recording sessions
    if (
      typeof navigator !== 'undefined' &&
      navigator.mediaDevices &&
      typeof navigator.mediaDevices.getDisplayMedia === 'function' &&
      !this.displayMediaWrapped
    ) {
      this.displayMediaWrapped = true;
      const originalGetDisplayMedia = navigator.mediaDevices.getDisplayMedia.bind(
        navigator.mediaDevices
      );

      try {
        navigator.mediaDevices.getDisplayMedia = async (
          constraints?: DisplayMediaStreamOptions
        ): Promise<MediaStream> => {
          if (this.state.autoMaskEnabled && this.state.detectScreenRecording) {
            this.triggerCaptureMask(
              'SCREEN_RECORDING_STREAM',
              'Screen recording prompt initiated (getDisplayMedia) — masking dashboard.',
              true
            );
          }

          try {
            const stream = await originalGetDisplayMedia(constraints);
            const tracks = stream.getTracks();
            tracks.forEach(track => {
              this.activeTracks.add(track);
              track.addEventListener('ended', () => {
                this.activeTracks.delete(track);
                if (this.activeTracks.size === 0 && this.state.activeCaptureSession) {
                  this.stopCaptureSessionLock();
                }
              });
            });
            return stream;
          } catch (err) {
            // User cancelled display share prompt — switch from persistent lock to brief countdown
            if (this.state.activeCaptureSession) {
              this.state.activeCaptureSession = false;
              this.startAutoUnmaskCountdown();
              this.notify();
            }
            throw err;
          }
        };

        this.state.browserCaptureHookActive = true;
      } catch {
        this.state.browserCaptureHookActive = false;
      }
    }
  }

  private stopCountdown() {
    if (this.countdownTimer) {
      clearInterval(this.countdownTimer);
      this.countdownTimer = null;
    }
  }

  private startAutoUnmaskCountdown() {
    this.stopCountdown();
    if (this.state.autoUnmaskSeconds <= 0) {
      this.state.remainingUnmaskSeconds = 0;
      return;
    }

    this.state.remainingUnmaskSeconds = this.state.autoUnmaskSeconds;
    this.countdownTimer = setInterval(() => {
      if (!this.state.isMaskEngaged || this.state.activeCaptureSession) {
        this.stopCountdown();
        return;
      }
      if (this.state.remainingUnmaskSeconds <= 1) {
        this.stopCountdown();
        this.state = {
          ...this.state,
          isMaskEngaged: false,
          remainingUnmaskSeconds: 0,
          maskReason: null,
        };
        this.notify();
      } else {
        this.state = {
          ...this.state,
          remainingUnmaskSeconds: this.state.remainingUnmaskSeconds - 1,
        };
        this.notify();
      }
    }, 1000);
  }

  private triggerCaptureMask(
    triggerType: ScreenCaptureTriggerType,
    detail: string,
    persistentSession: boolean
  ) {
    const now = new Date();
    const isScreenshot =
      triggerType === 'SCREENSHOT_HOTKEY' ||
      triggerType === 'PRINT_CAPTURE' ||
      triggerType === 'VISIBILITY_SWITCH' ||
      triggerType === 'WINDOW_FOCUS_LOSS';
    const isRecording =
      triggerType === 'SCREEN_RECORDING_STREAM' || triggerType === 'VIRTUAL_CAPTURE_DEVICE';

    const newEvent: ScreenCaptureEvent = {
      id: `scr-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      timestamp: now.toLocaleTimeString(),
      isoTimestamp: now.toISOString(),
      triggerType,
      detail,
      maskApplied: this.state.maskMode,
      autoCleared: !persistentSession && this.state.autoUnmaskSeconds > 0,
    };

    this.state = {
      ...this.state,
      isMaskEngaged: true,
      activeCaptureSession: persistentSession || this.state.activeCaptureSession,
      maskReason: detail,
      lastTriggerType: triggerType,
      lastTriggeredAt: now.toLocaleTimeString(),
      totalScreenshotsBlocked: this.state.totalScreenshotsBlocked + (isScreenshot ? 1 : 0),
      totalRecordingSessionsMasked:
        this.state.totalRecordingSessionsMasked + (isRecording ? 1 : 0),
      events: [newEvent, ...this.state.events].slice(0, 40),
    };

    if (persistentSession || triggerType === 'MANUAL_PRIVACY_LOCK') {
      this.stopCountdown();
      this.state.remainingUnmaskSeconds = 0;
    } else {
      this.startAutoUnmaskCountdown();
    }

    audioAnnouncer.playChime(true);
    this.notify();
  }

  public stopCaptureSessionLock() {
    this.stopCountdown();
    this.state = {
      ...this.state,
      activeCaptureSession: false,
      isMaskEngaged: false,
      remainingUnmaskSeconds: 0,
      maskReason: null,
    };
    this.notify();
  }

  public engageManualMask() {
    this.triggerCaptureMask(
      'MANUAL_PRIVACY_LOCK',
      'Manual privacy screen mask engaged — sensitive IPs and logs obscured.',
      false
    );
    // Keep manual lock until explicitly unmasked
    this.stopCountdown();
    this.state.remainingUnmaskSeconds = 0;
    this.notify();
  }

  public disengageMask() {
    this.stopCountdown();
    this.activeTracks.forEach(t => {
      try {
        t.stop();
      } catch {
        // ignore
      }
    });
    this.activeTracks.clear();
    this.state = {
      ...this.state,
      isMaskEngaged: false,
      activeCaptureSession: false,
      remainingUnmaskSeconds: 0,
      maskReason: null,
    };
    this.notify();
  }

  public simulateScreenshotAttempt() {
    this.triggerCaptureMask(
      'SCREENSHOT_HOTKEY',
      'Screenshot capture attempt detected (PrintScreen / OS Snip) — IPs & logs blurred.',
      false
    );
  }

  public toggleSimulatedRecording() {
    if (this.state.activeCaptureSession) {
      this.stopCaptureSessionLock();
      return;
    }
    this.triggerCaptureMask(
      'SCREEN_RECORDING_STREAM',
      'Active screen recording session detected — privacy blur locked until capture stops.',
      true
    );
  }

  public async probeCaptureEnvironment(): Promise<string> {
    let virtualCaptureCount = 0;
    let note = 'Display capture hook armed.';
    if (typeof navigator !== 'undefined' && navigator.mediaDevices?.enumerateDevices) {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const captureMatches = devices.filter(d => {
          const label = (d.label || '').toLowerCase();
          return (
            label.includes('obs') ||
            label.includes('screen') ||
            label.includes('virtual') ||
            label.includes('loopback') ||
            label.includes('blackhole') ||
            label.includes('capture')
          );
        });
        virtualCaptureCount = captureMatches.length;
        note =
          virtualCaptureCount > 0
            ? `Detected ${virtualCaptureCount} virtual/capture device endpoint(s).`
            : `Scanned ${devices.length} media endpoints; no virtual screen-capture drivers exposed.`;

        if (virtualCaptureCount > 0 && this.state.autoMaskEnabled && this.state.detectScreenRecording) {
          this.triggerCaptureMask(
            'VIRTUAL_CAPTURE_DEVICE',
            `Virtual capture interface detected (${captureMatches.map(d => d.label || d.kind).join(', ')}).`,
            true
          );
        }
      } catch {
        note = 'Media device enumeration restricted by browser privacy policy.';
      }
    }

    this.state = {
      ...this.state,
      detectedCaptureDevicesCount: virtualCaptureCount,
    };
    this.notify();
    return note;
  }

  public toggleSetting(
    key:
      | 'autoMaskEnabled'
      | 'detectScreenshotHotkeys'
      | 'detectScreenRecording'
      | 'blurOnVisibilityHidden'
      | 'strictWindowBlurMask'
  ) {
    const nextVal = !this.state[key];
    this.state = {
      ...this.state,
      [key]: nextVal,
    };
    if (key === 'autoMaskEnabled' && !nextVal && this.state.isMaskEngaged) {
      this.disengageMask();
      return;
    }
    this.notify();
  }

  public setMaskMode(mode: ScreenMaskMode) {
    this.state = {
      ...this.state,
      maskMode: mode,
    };
    this.notify();
  }

  public setAutoUnmaskSeconds(seconds: number) {
    this.state = {
      ...this.state,
      autoUnmaskSeconds: seconds,
    };
    this.notify();
  }

  public clearEvents() {
    this.state = {
      ...this.state,
      events: [],
    };
    this.notify();
  }
}

export const screenMaskService = new ScreenMaskService();
