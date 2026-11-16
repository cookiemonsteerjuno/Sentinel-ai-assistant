import {
  AndroidDeviceProfile,
  AndroidEcosystem,
  AndroidSystemPatch,
  PatchScanEvent,
} from '../types';
import { audioAnnouncer } from './audioAnnouncer';

export interface AndroidPatchScannerSnapshot {
  profile: AndroidDeviceProfile;
  patches: AndroidSystemPatch[];
  autoPollEnabled: boolean;
  pollIntervalSec: 15 | 30 | 60;
  voiceAlertsEnabled: boolean;
  nextScanCountdownSec: number;
  isScanning: boolean;
  lastScanTimestamp: string;
  scanHistory: PatchScanEvent[];
  lastCriticalAlertId: string | null;
}

const STORAGE_KEY = 'sentinel_android_patch_scanner_v1';

const ECOSYSTEM_PRESETS: Record<
  AndroidEcosystem,
  { modelName: string; osVersion: string; defaultSpl: string }
> = {
  pixel: {
    modelName: 'Google Pixel 9 Pro',
    osVersion: 'Android 16 (AP4A)',
    defaultSpl: '2026-09-05',
  },
  samsung: {
    modelName: 'Samsung Galaxy S25 Ultra',
    osVersion: 'Android 16 · One UI 8.0',
    defaultSpl: '2026-09-01',
  },
  aosp: {
    modelName: 'AOSP / GrapheneOS Generic ARM64',
    osVersion: 'Android 16 (AOSP Mainline)',
    defaultSpl: '2026-08-05',
  },
};

export function detectDeviceHints(): {
  detectedEcosystem: AndroidEcosystem;
  detectedBrowserOs: string;
  detectedWebViewVersion: string;
  isLiveAndroidClient: boolean;
} {
  if (typeof navigator === 'undefined') {
    return {
      detectedEcosystem: 'pixel',
      detectedBrowserOs: 'Android 16',
      detectedWebViewVersion: 'Chromium 138',
      isLiveAndroidClient: false,
    };
  }

  const ua = navigator.userAgent || '';
  const lower = ua.toLowerCase();
  const isAndroid = /android/.test(lower);

  let detectedEcosystem: AndroidEcosystem = 'pixel';
  if (/samsung|sm-[a-z0-9]+/.test(lower)) {
    detectedEcosystem = 'samsung';
  } else if (/lineage|graphene|calyx|aosp/.test(lower)) {
    detectedEcosystem = 'aosp';
  } else if (/pixel/.test(lower)) {
    detectedEcosystem = 'pixel';
  }

  const androidMatch = ua.match(/Android\s+([\d.]+)/i);
  const chromeMatch = ua.match(/Chrome\/([\d.]+)/i);

  const detectedBrowserOs = isAndroid
    ? `Android ${androidMatch ? androidMatch[1] : 'Runtime'}`
    : `${navigator.platform || 'Desktop'} (Android Profile Sim)`;

  const detectedWebViewVersion = chromeMatch
    ? `WebView / Chrome ${chromeMatch[1]}`
    : 'System WebView Current';

  return {
    detectedEcosystem,
    detectedBrowserOs,
    detectedWebViewVersion,
    isLiveAndroidClient: isAndroid,
  };
}

const INITIAL_PATCH_CATALOG: AndroidSystemPatch[] = [
  // Pixel patches
  {
    id: 'patch-px-2026-11-crit',
    title: 'Pixel November 2026 Critical Security Bulletin',
    ecosystem: 'pixel',
    channel: 'AOSP_BULLETIN',
    severity: 'CRITICAL',
    cveIds: ['CVE-2026-43018', 'CVE-2026-43022'],
    cvssScore: 9.8,
    patchLevelDate: '2026-11-05',
    versionTag: 'AP4A.261105.012',
    sizeMb: 68.4,
    sha256: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    status: 'AVAILABLE',
    discoveredAt: new Date(Date.now() - 1000 * 60 * 12).toLocaleTimeString(),
    summary:
      'Patches a zero-click remote code execution vulnerability in Android Media Framework and an elevation-of-privilege flaw in Pixel Tensor DSP driver.',
    affectedComponents: ['Media Framework', 'SystemUI', 'Tensor DSP Driver'],
    voiceAlerted: false,
  },
  {
    id: 'patch-px-2026-11-mod',
    title: 'Google Play System Update (Project Mainline)',
    ecosystem: 'pixel',
    channel: 'PLAY_SYSTEM',
    severity: 'HIGH',
    cveIds: ['CVE-2026-41904'],
    cvssScore: 7.8,
    patchLevelDate: '2026-11-01',
    versionTag: 'MAINLINE-2026.11.01',
    sizeMb: 24.1,
    sha256: '8f434346648f6b96df89dda901c5176b10a6d83961dd3c1ac88b59b2dc327aa4',
    status: 'AVAILABLE',
    discoveredAt: new Date(Date.now() - 1000 * 60 * 28).toLocaleTimeString(),
    summary:
      'Hardens DNS Resolver, Conscrypt TLS certificate pinning, and Android Runtime (ART) bounds verification.',
    affectedComponents: ['DNS Resolver', 'Conscrypt TLS', 'PermissionController'],
  },
  {
    id: 'patch-px-2026-10-oem',
    title: 'Exynos / Shannon 5G Baseband Modem Firmware Fix',
    ecosystem: 'pixel',
    channel: 'KERNEL_BASEBAND',
    severity: 'CRITICAL',
    cveIds: ['CVE-2026-42119'],
    cvssScore: 9.1,
    patchLevelDate: '2026-10-05',
    versionTag: 'g5400c-261005-B',
    sizeMb: 41.2,
    sha256: '4b227777d4dd1fc61c6f884f48641d02b4d121d3fd328cb08b5531fcacdabf8a',
    status: 'AVAILABLE',
    discoveredAt: new Date(Date.now() - 1000 * 60 * 44).toLocaleTimeString(),
    summary:
      'Mitigates malformed VoLTE SIP packet parsing in baseband modem firmware prior to kernel handoff.',
    affectedComponents: ['5G Baseband Radio', 'RIL Daemon'],
    voiceAlerted: false,
  },
  // Samsung patches
  {
    id: 'patch-sam-2026-11-crit',
    title: 'Samsung SMR November 2026 & Knox Kernel Update',
    ecosystem: 'samsung',
    channel: 'OEM_FIRMWARE',
    severity: 'CRITICAL',
    cveIds: ['CVE-2026-43018', 'SVE-2026-18442'],
    cvssScore: 9.6,
    patchLevelDate: '2026-11-01',
    versionTag: 'S938U1UES4AYK2',
    sizeMb: 342.6,
    sha256: '2c26b46b68ffc68ff99b453c1d30413413422d706483bfa0f98a5e886266e7ae',
    status: 'AVAILABLE',
    discoveredAt: new Date(Date.now() - 1000 * 60 * 14).toLocaleTimeString(),
    summary:
      'Bundles AOSP November critical fixes with Samsung Knox Vault keystore hardening and Exynos/Snapdragon GPU memory isolation.',
    affectedComponents: ['Knox Vault', 'One UI Framework', 'Adreno GPU Driver'],
    voiceAlerted: false,
  },
  {
    id: 'patch-sam-2026-11-play',
    title: 'Samsung WebView & Mainline DNS Security Patch',
    ecosystem: 'samsung',
    channel: 'PLAY_SYSTEM',
    severity: 'HIGH',
    cveIds: ['CVE-2026-41904', 'SVE-2026-18201'],
    cvssScore: 7.5,
    patchLevelDate: '2026-11-01',
    versionTag: 'ONEUI-MAINLINE-2611',
    sizeMb: 29.8,
    sha256: '9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08',
    status: 'AVAILABLE',
    discoveredAt: new Date(Date.now() - 1000 * 60 * 35).toLocaleTimeString(),
    summary:
      'Fixes cross-origin intent validation in Android System WebView and strengthens private DNS fallback rules.',
    affectedComponents: ['Android WebView', 'NetworkStack'],
  },
  // AOSP patches
  {
    id: 'patch-aosp-2026-11-crit',
    title: 'AOSP Monthly Security Patch Level 2026-11-05',
    ecosystem: 'aosp',
    channel: 'AOSP_BULLETIN',
    severity: 'CRITICAL',
    cveIds: ['CVE-2026-43018', 'CVE-2026-43045'],
    cvssScore: 9.8,
    patchLevelDate: '2026-11-05',
    versionTag: 'android-16.0.0_r19',
    sizeMb: 118.0,
    sha256: 'd4735e3a265e16eee03f59718b9b5d03019c07d8b6c51f90da3a666eec13ab35',
    status: 'AVAILABLE',
    discoveredAt: new Date(Date.now() - 1000 * 60 * 10).toLocaleTimeString(),
    summary:
      'Upstream AOSP platform patches resolving Binder IPC use-after-free and MediaCodec remote buffer overflow.',
    affectedComponents: ['Binder IPC', 'MediaCodec', 'Framework Base'],
    voiceAlerted: false,
  },
  {
    id: 'patch-aosp-2026-10-kern',
    title: 'Linux LTS 6.6 Android Common Kernel Hardening',
    ecosystem: 'aosp',
    channel: 'KERNEL_BASEBAND',
    severity: 'MODERATE',
    cveIds: ['CVE-2026-39812'],
    cvssScore: 6.4,
    patchLevelDate: '2026-10-05',
    versionTag: 'ack-6.6.58-lts',
    sizeMb: 52.5,
    sha256: '4e07408562bedb8b60ce05c1decfe3ad16b72230967de01f640b7e4729b49fce',
    status: 'AVAILABLE',
    discoveredAt: new Date(Date.now() - 1000 * 60 * 50).toLocaleTimeString(),
    summary:
      'Backports netfilter nftables validation and SELinux policy confinement patches for Android Common Kernel.',
    affectedComponents: ['Kernel Netfilter', 'SELinux Policy'],
  },
];

const DYNAMIC_DISCOVERY_POOL: Omit<AndroidSystemPatch, 'id' | 'discoveredAt' | 'status'>[] = [
  {
    title: 'Zero-Day WebView & V8 JIT Sandbox Escape Patch',
    ecosystem: 'pixel',
    channel: 'PLAY_SYSTEM',
    severity: 'CRITICAL',
    cveIds: ['CVE-2026-44102'],
    cvssScore: 9.4,
    patchLevelDate: '2026-11-12',
    versionTag: 'WEBVIEW-138.0.7204.98',
    sizeMb: 34.7,
    sha256: 'f5ca38f748a1d6eaf726b8a42fb575c3c71f1864a8143301782de13da2d9202b',
    summary:
      'Emergency out-of-band patch addressing active type-confusion exploitation in Android System WebView V8 engine.',
    affectedComponents: ['System WebView', 'V8 Engine'],
  },
  {
    title: 'Samsung Wi-Fi Direct & Nearby Share RCE Mitigation',
    ecosystem: 'samsung',
    channel: 'OEM_FIRMWARE',
    severity: 'CRITICAL',
    cveIds: ['CVE-2026-44188', 'SVE-2026-19011'],
    cvssScore: 9.2,
    patchLevelDate: '2026-11-12',
    versionTag: 'S938U1HOTFIX-AYK5',
    sizeMb: 74.3,
    sha256: '6b86b273ff34fce19d6b804eff5a3f5747ada4eaa22f1d49c01e52ddb7875b4b',
    summary:
      'Closes an unauthenticated Wi-Fi P2P discovery frame overflow before pairing handshake.',
    affectedComponents: ['Wi-Fi P2P Stack', 'Broadcom WLAN Firmware'],
  },
  {
    title: 'AOSP Bluetooth GATT L2CAP Bounds Fix',
    ecosystem: 'aosp',
    channel: 'AOSP_BULLETIN',
    severity: 'HIGH',
    cveIds: ['CVE-2026-43990'],
    cvssScore: 8.1,
    patchLevelDate: '2026-11-10',
    versionTag: 'android-16.0.0_r21',
    sizeMb: 19.6,
    sha256: '7902699be42c8a8e46fbbb4501726517e86b22c56a189f7625a6da49081b2451',
    summary:
      'Prevents out-of-bounds read during malformed BLE GATT MTU negotiation packets.',
    affectedComponents: ['Fluoride Bluetooth Stack', 'L2CAP'],
  },
];

class AndroidPatchScannerService {
  private state: AndroidPatchScannerSnapshot;
  private listeners = new Set<(snapshot: AndroidPatchScannerSnapshot) => void>();
  private tickHandle: ReturnType<typeof setInterval> | null = null;
  private dynamicCursor = 0;

  constructor() {
    this.state = this.loadInitialState();
    if (typeof window !== 'undefined') {
      this.startBackgroundLoop();
    }
  }

  private loadInitialState(): AndroidPatchScannerSnapshot {
    const hints = detectDeviceHints();
    const preset = ECOSYSTEM_PRESETS[hints.detectedEcosystem];

    const defaultState: AndroidPatchScannerSnapshot = {
      profile: {
        ecosystem: hints.detectedEcosystem,
        modelName: preset.modelName,
        osVersion: hints.isLiveAndroidClient ? hints.detectedBrowserOs : preset.osVersion,
        currentSecurityPatchLevel: preset.defaultSpl,
        detectedBrowserOs: hints.detectedBrowserOs,
        detectedWebViewVersion: hints.detectedWebViewVersion,
        isLiveAndroidClient: hints.isLiveAndroidClient,
      },
      patches: INITIAL_PATCH_CATALOG,
      autoPollEnabled: true,
      pollIntervalSec: 30,
      voiceAlertsEnabled: true,
      nextScanCountdownSec: 30,
      isScanning: false,
      lastScanTimestamp: new Date().toLocaleTimeString(),
      scanHistory: [
        {
          id: 'scan-init-1',
          timestamp: new Date().toLocaleTimeString(),
          ecosystem: hints.detectedEcosystem,
          channelsChecked: 4,
          newFindings: INITIAL_PATCH_CATALOG.filter(p => p.ecosystem === hints.detectedEcosystem)
            .length,
          criticalFindings: INITIAL_PATCH_CATALOG.filter(
            p => p.ecosystem === hints.detectedEcosystem && p.severity === 'CRITICAL'
          ).length,
          message:
            'Initial Android Security Bulletin & Mainline baseline check completed.',
        },
      ],
      lastCriticalAlertId: null,
    };

    if (typeof window === 'undefined') return defaultState;

    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return defaultState;
      const parsed = JSON.parse(raw) as Partial<AndroidPatchScannerSnapshot>;
      return {
        ...defaultState,
        ...parsed,
        profile: {
          ...defaultState.profile,
          ...(parsed.profile || {}),
          detectedBrowserOs: hints.detectedBrowserOs,
          detectedWebViewVersion: hints.detectedWebViewVersion,
          isLiveAndroidClient: hints.isLiveAndroidClient,
        },
        isScanning: false,
      };
    } catch {
      return defaultState;
    }
  }

  private persist() {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
    } catch {
      // Ignore storage quota errors
    }
  }

  private notify() {
    const snapshot = this.getSnapshot();
    this.listeners.forEach(cb => cb(snapshot));
  }

  public getSnapshot(): AndroidPatchScannerSnapshot {
    return {
      ...this.state,
      profile: { ...this.state.profile },
      patches: [...this.state.patches],
      scanHistory: [...this.state.scanHistory],
    };
  }

  public subscribe(listener: (snapshot: AndroidPatchScannerSnapshot) => void) {
    this.listeners.add(listener);
    listener(this.getSnapshot());
    return () => {
      this.listeners.delete(listener);
    };
  }

  private startBackgroundLoop() {
    if (this.tickHandle) clearInterval(this.tickHandle);

    this.tickHandle = setInterval(() => {
      if (!this.state.autoPollEnabled || this.state.isScanning) return;

      if (this.state.nextScanCountdownSec <= 1) {
        this.runPollCycle(false);
      } else {
        this.state = {
          ...this.state,
          nextScanCountdownSec: this.state.nextScanCountdownSec - 1,
        };
        this.notify();
      }
    }, 1000);
  }

  public scanNow() {
    if (this.state.isScanning) return;
    this.runPollCycle(true);
  }

  private runPollCycle(isManual: boolean) {
    this.state = {
      ...this.state,
      isScanning: true,
    };
    this.notify();

    setTimeout(() => {
      const currentEco = this.state.profile.ecosystem;
      let addedPatch: AndroidSystemPatch | null = null;

      // Surface a new bulletin item on manual scan or periodic background cycles
      const matchingDynamic = DYNAMIC_DISCOVERY_POOL.filter(
        d =>
          d.ecosystem === currentEco &&
          !this.state.patches.some(existing => existing.title === d.title)
      );

      if (matchingDynamic.length > 0 && (isManual || this.dynamicCursor % 2 === 0)) {
        const template = matchingDynamic[0];
        addedPatch = {
          ...template,
          id: `patch-dyn-${Date.now()}`,
          status: 'AVAILABLE',
          discoveredAt: new Date().toLocaleTimeString(),
          voiceAlerted: false,
        };
      }
      this.dynamicCursor += 1;

      const updatedPatches = addedPatch
        ? [addedPatch, ...this.state.patches]
        : this.state.patches;

      // Check for unannounced CRITICAL patch in active ecosystem
      let triggeredCriticalId = this.state.lastCriticalAlertId;
      const unalertedCritical = updatedPatches.find(
        p =>
          p.ecosystem === currentEco &&
          p.severity === 'CRITICAL' &&
          p.status === 'AVAILABLE' &&
          !p.voiceAlerted
      );

      const finalizedPatches = updatedPatches.map(p => {
        if (unalertedCritical && p.id === unalertedCritical.id) {
          return { ...p, voiceAlerted: true };
        }
        return p;
      });

      if (unalertedCritical && this.state.voiceAlertsEnabled) {
        triggeredCriticalId = unalertedCritical.id;
        audioAnnouncer.announceCriticalPatch(
          unalertedCritical.title,
          `${unalertedCritical.cveIds[0]} with CVSS ${unalertedCritical.cvssScore}`,
          this.state.profile.modelName
        );
      }

      const ecoPending = finalizedPatches.filter(
        p => p.ecosystem === currentEco && p.status !== 'INSTALLED'
      );
      const ecoCritical = ecoPending.filter(p => p.severity === 'CRITICAL');

      const event: PatchScanEvent = {
        id: `scan-${Date.now()}`,
        timestamp: new Date().toLocaleTimeString(),
        ecosystem: currentEco,
        channelsChecked: 4,
        newFindings: addedPatch ? 1 : 0,
        criticalFindings: ecoCritical.length,
        message: addedPatch
          ? `${isManual ? 'Manual' : 'Auto'} poll detected new ${addedPatch.severity} advisory: ${addedPatch.cveIds[0]}`
          : `${isManual ? 'Manual' : 'Background'} check verified 4 channels (${ecoPending.length} pending, ${ecoCritical.length} critical).`,
      };

      this.state = {
        ...this.state,
        patches: finalizedPatches,
        isScanning: false,
        nextScanCountdownSec: this.state.pollIntervalSec,
        lastScanTimestamp: event.timestamp,
        lastCriticalAlertId: triggeredCriticalId,
        scanHistory: [event, ...this.state.scanHistory].slice(0, 12),
      };

      this.persist();
      this.notify();
    }, 850);
  }

  public toggleAutoPoll() {
    const next = !this.state.autoPollEnabled;
    this.state = {
      ...this.state,
      autoPollEnabled: next,
      nextScanCountdownSec: next ? this.state.pollIntervalSec : this.state.nextScanCountdownSec,
    };
    this.persist();
    this.notify();
  }

  public setPollInterval(sec: 15 | 30 | 60) {
    this.state = {
      ...this.state,
      pollIntervalSec: sec,
      nextScanCountdownSec: sec,
    };
    this.persist();
    this.notify();
  }

  public toggleVoiceAlerts() {
    const next = !this.state.voiceAlertsEnabled;
    if (next) {
      audioAnnouncer.unlockAudio();
    }
    this.state = {
      ...this.state,
      voiceAlertsEnabled: next,
    };
    this.persist();
    this.notify();
  }

  public setEcosystem(ecosystem: AndroidEcosystem) {
    const preset = ECOSYSTEM_PRESETS[ecosystem];
    this.state = {
      ...this.state,
      profile: {
        ...this.state.profile,
        ecosystem,
        modelName: preset.modelName,
        osVersion: preset.osVersion,
        currentSecurityPatchLevel: preset.defaultSpl,
      },
      nextScanCountdownSec: 2, // Trigger quick follow-up check on ecosystem switch
    };
    this.persist();
    this.notify();
  }

  public updateProfile(partial: Partial<AndroidDeviceProfile>) {
    this.state = {
      ...this.state,
      profile: {
        ...this.state.profile,
        ...partial,
      },
    };
    this.persist();
    this.notify();
  }

  public redetectDeviceHints() {
    const hints = detectDeviceHints();
    this.state = {
      ...this.state,
      profile: {
        ...this.state.profile,
        detectedBrowserOs: hints.detectedBrowserOs,
        detectedWebViewVersion: hints.detectedWebViewVersion,
        isLiveAndroidClient: hints.isLiveAndroidClient,
      },
    };
    this.persist();
    this.notify();
  }

  public stageAndVerifyPatch(patchId: string) {
    this.state = {
      ...this.state,
      patches: this.state.patches.map(p =>
        p.id === patchId ? { ...p, status: 'DOWNLOADING', downloadProgress: 18 } : p
      ),
    };
    this.notify();

    setTimeout(() => {
      this.state = {
        ...this.state,
        patches: this.state.patches.map(p =>
          p.id === patchId ? { ...p, status: 'DOWNLOADING', downloadProgress: 68 } : p
        ),
      };
      this.notify();
    }, 400);

    setTimeout(() => {
      this.state = {
        ...this.state,
        patches: this.state.patches.map(p =>
          p.id === patchId ? { ...p, status: 'VERIFIED', downloadProgress: 100 } : p
        ),
      };
      this.persist();
      this.notify();
    }, 900);
  }

  public applyPatch(patchId: string) {
    const target = this.state.patches.find(p => p.id === patchId);
    if (!target) return;

    const currentSpl = this.state.profile.currentSecurityPatchLevel;
    const nextSpl =
      target.patchLevelDate > currentSpl ? target.patchLevelDate : currentSpl;

    this.state = {
      ...this.state,
      profile: {
        ...this.state.profile,
        currentSecurityPatchLevel: nextSpl,
      },
      patches: this.state.patches.map(p =>
        p.id === patchId ? { ...p, status: 'INSTALLED', downloadProgress: 100 } : p
      ),
      scanHistory: [
        {
          id: `apply-${Date.now()}`,
          timestamp: new Date().toLocaleTimeString(),
          ecosystem: this.state.profile.ecosystem,
          channelsChecked: 1,
          newFindings: 0,
          criticalFindings: this.state.patches.filter(
            p =>
              p.id !== patchId &&
              p.ecosystem === this.state.profile.ecosystem &&
              p.severity === 'CRITICAL' &&
              p.status !== 'INSTALLED'
          ).length,
          message: `Verified & applied ${target.versionTag} (${target.cveIds.join(', ')})`,
        },
        ...this.state.scanHistory,
      ].slice(0, 12),
    };

    this.persist();
    this.notify();
  }

  public testCriticalVoiceAlert() {
    audioAnnouncer.unlockAudio();
    const activePatch =
      this.state.patches.find(
        p => p.ecosystem === this.state.profile.ecosystem && p.severity === 'CRITICAL'
      ) || this.state.patches[0];

    audioAnnouncer.announceCriticalPatch(
      activePatch.title,
      `${activePatch.cveIds[0]} with CVSS ${activePatch.cvssScore}`,
      this.state.profile.modelName
    );
  }

  public resetCatalog() {
    const preset = ECOSYSTEM_PRESETS[this.state.profile.ecosystem];
    this.state = {
      ...this.state,
      profile: {
        ...this.state.profile,
        currentSecurityPatchLevel: preset.defaultSpl,
      },
      patches: INITIAL_PATCH_CATALOG,
      nextScanCountdownSec: this.state.pollIntervalSec,
    };
    this.persist();
    this.notify();
  }
}

export const androidPatchScanner = new AndroidPatchScannerService();
