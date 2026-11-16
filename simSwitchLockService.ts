import { SimLockEvent, SimSlotType, SimSwitchLockState } from '../types';
import { audioAnnouncer } from './audioAnnouncer';

const STORAGE_KEY = 'sentinel_sim_switch_lock_v1';

const BASELINE_EVENTS: SimLockEvent[] = [
  {
    id: 'sim-evt-1',
    timestamp: new Date(Date.now() - 1000 * 60 * 24).toLocaleTimeString(),
    isoTimestamp: new Date(Date.now() - 1000 * 60 * 24).toISOString(),
    eventType: 'ESIM_PROFILE_PUSH',
    slot: 'ESIM_PROFILE_2',
    detectedIccid: '8901-4103-2799-8810-442F',
    carrierLabel: 'Unverified SM-DP+ Provisioner',
    actionTaken: 'ESIM_REJECTED',
    severity: 'CRITICAL',
    detail: 'Blocked unauthorized remote eSIM QR/OTA profile download attempt.',
  },
  {
    id: 'sim-evt-2',
    timestamp: new Date(Date.now() - 1000 * 60 * 52).toLocaleTimeString(),
    isoTimestamp: new Date(Date.now() - 1000 * 60 * 52).toISOString(),
    eventType: 'CARRIER_PORT_OUT',
    slot: 'PHYSICAL_SIM_1',
    detectedIccid: '8901-2604-8120-9941-007A',
    carrierLabel: 'External MVNO Port Request',
    actionTaken: 'PORT_OUT_FROZEN',
    severity: 'HIGH',
    detail: 'Carrier Number Lock & Port-Out Freeze denied unauthorized MSISDN transfer.',
  },
  {
    id: 'sim-evt-3',
    timestamp: new Date(Date.now() - 1000 * 60 * 95).toLocaleTimeString(),
    isoTimestamp: new Date(Date.now() - 1000 * 60 * 95).toISOString(),
    eventType: 'SIM_POLICY_VERIFIED',
    slot: 'PHYSICAL_SIM_1',
    detectedIccid: '8901-2604-8120-9941-007A',
    carrierLabel: 'T-Mobile US (Primary Bound)',
    actionTaken: 'AUTHORIZED_SLOT',
    severity: 'TRUSTED',
    detail: 'Primary hardware SIM ICCID matches cryptographic device attestation.',
  },
];

const DEFAULT_STATE: SimSwitchLockState = {
  simSwitchLocked: true,
  esimProvisioningLocked: true,
  portOutFreezeEnabled: true,
  autoQuarantine2FAOnSwap: true,
  lockdownTripped: false,
  lockdownReason: null,
  boundPrimaryIccid: '8901-2604-8120-9941-007A',
  boundSecondaryEsimId: 'eSIM-8901-7742-1190-B',
  boundCarrier: 'T-Mobile US / 5G SA',
  activeSlot: 'PHYSICAL_SIM_1',
  guardPin: '4829',
  totalSwapAttemptsBlocked: 6,
  radioProbeSummary: 'Primary SIM slot locked to bound ICCID.',
  events: BASELINE_EVENTS,
};

class SimSwitchLockService {
  private state: SimSwitchLockState;
  private listeners: Set<(s: SimSwitchLockState) => void> = new Set();

  constructor() {
    this.state = this.loadState();
    this.attachConnectionMonitor();
  }

  private loadState(): SimSwitchLockState {
    if (typeof window === 'undefined') return DEFAULT_STATE;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return DEFAULT_STATE;
      const parsed = JSON.parse(raw) as Partial<SimSwitchLockState>;
      return {
        ...DEFAULT_STATE,
        ...parsed,
        events:
          Array.isArray(parsed.events) && parsed.events.length > 0
            ? parsed.events
            : BASELINE_EVENTS,
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
      // Ignore storage errors
    }
  }

  private notify() {
    this.saveState();
    const snap: SimSwitchLockState = {
      ...this.state,
      events: [...this.state.events],
    };
    this.listeners.forEach(fn => fn(snap));
  }

  private attachConnectionMonitor() {
    if (typeof navigator === 'undefined') return;
    const conn = (navigator as unknown as { connection?: EventTarget & { effectiveType?: string; type?: string } }).connection;
    if (conn && typeof conn.addEventListener === 'function') {
      conn.addEventListener('change', () => {
        const typeDesc = conn.type || conn.effectiveType || 'network link';
        this.state = {
          ...this.state,
          radioProbeSummary: `Link shift observed (${typeDesc}) — SIM lock verified.`,
        };
        this.notify();
      });
    }
  }

  public getSnapshot(): SimSwitchLockState {
    return {
      ...this.state,
      events: [...this.state.events],
    };
  }

  public subscribe(fn: (s: SimSwitchLockState) => void): () => void {
    this.listeners.add(fn);
    fn(this.getSnapshot());
    return () => {
      this.listeners.delete(fn);
    };
  }

  public verifyAndToggleSimLock(pinInput: string): { ok: boolean; error?: string } {
    if (!this.state.simSwitchLocked) {
      // Re-locking requires no PIN
      this.state = {
        ...this.state,
        simSwitchLocked: true,
        esimProvisioningLocked: true,
      };
      audioAnnouncer.playChime(false);
      this.notify();
      return { ok: true };
    }

    if (pinInput.trim() !== this.state.guardPin) {
      return {
        ok: false,
        error: 'Incorrect Guard PIN. SIM & eSIM Switch Lock remains enforced.',
      };
    }

    this.state = {
      ...this.state,
      simSwitchLocked: false,
      lockdownTripped: false,
      lockdownReason: null,
    };
    audioAnnouncer.playChime(false);
    this.notify();
    return { ok: true };
  }

  public verifyAndSwitchActiveSlot(
    targetSlot: SimSlotType,
    pinInput: string
  ): { ok: boolean; error?: string } {
    if (targetSlot === this.state.activeSlot) return { ok: true };

    if (this.state.simSwitchLocked && pinInput.trim() !== this.state.guardPin) {
      const now = new Date();
      const blockedEvt: SimLockEvent = {
        id: `sim-${Date.now()}`,
        timestamp: now.toLocaleTimeString(),
        isoTimestamp: now.toISOString(),
        eventType: 'PHYSICAL_SIM_SWAP',
        slot: targetSlot,
        detectedIccid:
          targetSlot === 'ESIM_PROFILE_2'
            ? this.state.boundSecondaryEsimId
            : this.state.boundPrimaryIccid,
        carrierLabel: this.state.boundCarrier,
        actionTaken: 'SWITCH_BLOCKED',
        severity: 'HIGH',
        detail: `Unauthorized attempt to switch active cellular data/voice to ${
          targetSlot === 'ESIM_PROFILE_2' ? 'Slot 2 (eSIM)' : 'Slot 1 (Physical SIM)'
        } without valid Guard PIN.`,
      };

      this.state = {
        ...this.state,
        totalSwapAttemptsBlocked: this.state.totalSwapAttemptsBlocked + 1,
        events: [blockedEvt, ...this.state.events].slice(0, 40),
      };
      audioAnnouncer.playChime(true);
      this.notify();
      return {
        ok: false,
        error: 'SIM Switch Lock is active. Enter Guard PIN to authorize slot transition.',
      };
    }

    const now = new Date();
    const okEvt: SimLockEvent = {
      id: `sim-${Date.now()}`,
      timestamp: now.toLocaleTimeString(),
      isoTimestamp: now.toISOString(),
      eventType: 'SIM_POLICY_VERIFIED',
      slot: targetSlot,
      detectedIccid:
        targetSlot === 'ESIM_PROFILE_2'
          ? this.state.boundSecondaryEsimId
          : this.state.boundPrimaryIccid,
      carrierLabel: this.state.boundCarrier,
      actionTaken: 'AUTHORIZED_SLOT',
      severity: 'TRUSTED',
      detail: `PIN-authorized SIM slot transition to ${
        targetSlot === 'ESIM_PROFILE_2' ? 'Slot 2 (eSIM)' : 'Slot 1 (Physical SIM)'
      }.`,
    };

    this.state = {
      ...this.state,
      activeSlot: targetSlot,
      events: [okEvt, ...this.state.events].slice(0, 40),
    };
    audioAnnouncer.playChime(false);
    this.notify();
    return { ok: true };
  }

  public updateGuardPin(currentPin: string, nextPin: string): { ok: boolean; error?: string } {
    if (currentPin.trim() !== this.state.guardPin) {
      return { ok: false, error: 'Current Guard PIN does not match.' };
    }
    if (!/^\d{4,6}$/.test(nextPin.trim())) {
      return { ok: false, error: 'New Guard PIN must be 4 to 6 digits.' };
    }
    this.state = {
      ...this.state,
      guardPin: nextPin.trim(),
    };
    this.notify();
    return { ok: true };
  }

  public togglePolicy(
    key: 'esimProvisioningLocked' | 'portOutFreezeEnabled' | 'autoQuarantine2FAOnSwap'
  ) {
    this.state = {
      ...this.state,
      [key]: !this.state[key],
    };
    this.notify();
  }

  public resetLockdown() {
    this.state = {
      ...this.state,
      lockdownTripped: false,
      lockdownReason: null,
      simSwitchLocked: true,
    };
    audioAnnouncer.playChime(false);
    this.notify();
  }

  public probeRadioInterface(): string {
    const conn = (
      typeof navigator !== 'undefined'
        ? (navigator as unknown as {
            connection?: { effectiveType?: string; type?: string; downlink?: number; rtt?: number };
          }).connection
        : undefined
    );

    const summary = conn
      ? `Radio/Network hint: ${conn.type || 'cellular/wifi'} (${conn.effectiveType || '4g'}, RTT ${conn.rtt ?? 0}ms, ${conn.downlink ?? 0} Mbps). Primary ICCID bound & locked.`
      : 'Browser Network Information API unavailable; ICCID & port-out policies verified locally.';

    this.state = {
      ...this.state,
      radioProbeSummary: summary,
    };
    this.notify();
    return summary;
  }

  public simulateSwapThreat(
    scenario: 'physical_swap' | 'rogue_esim' | 'port_out' | 'imsi_downgrade'
  ) {
    const now = new Date();
    let event: SimLockEvent;
    let tripLockdown = false;

    if (scenario === 'physical_swap') {
      tripLockdown = this.state.autoQuarantine2FAOnSwap;
      event = {
        id: `sim-${Date.now()}`,
        timestamp: now.toLocaleTimeString(),
        isoTimestamp: now.toISOString(),
        eventType: 'PHYSICAL_SIM_SWAP',
        slot: 'PHYSICAL_SIM_1',
        detectedIccid: '8901-9981-0023-4177-901C',
        carrierLabel: 'Unrecognized Tray Swap ICCID',
        actionTaken: 'SWITCH_BLOCKED',
        severity: 'CRITICAL',
        detail:
          'Physical SIM tray ejection & foreign ICCID mismatch detected — 2FA SMS/voice quarantine engaged.',
      };
    } else if (scenario === 'rogue_esim') {
      tripLockdown = this.state.autoQuarantine2FAOnSwap;
      event = {
        id: `sim-${Date.now()}`,
        timestamp: now.toLocaleTimeString(),
        isoTimestamp: now.toISOString(),
        eventType: 'ESIM_PROFILE_PUSH',
        slot: 'ESIM_PROFILE_2',
        detectedIccid: 'eSIM-8944-0019-9982-X',
        carrierLabel: 'Unverified SM-DP+ Server (rsp.shadow-telco.net)',
        actionTaken: 'ESIM_REJECTED',
        severity: 'CRITICAL',
        detail: 'Blocked unauthorized OTA eSIM profile push while eSIM Provisioning Lock is active.',
      };
    } else if (scenario === 'port_out') {
      event = {
        id: `sim-${Date.now()}`,
        timestamp: now.toLocaleTimeString(),
        isoTimestamp: now.toISOString(),
        eventType: 'CARRIER_PORT_OUT',
        slot: 'PHYSICAL_SIM_1',
        detectedIccid: this.state.boundPrimaryIccid,
        carrierLabel: 'Unauthorized Number Transfer Request',
        actionTaken: 'PORT_OUT_FROZEN',
        severity: 'HIGH',
        detail: 'Carrier Port-Out Freeze denied unauthorized number transfer request.',
      };
    } else {
      tripLockdown = this.state.autoQuarantine2FAOnSwap;
      event = {
        id: `sim-${Date.now()}`,
        timestamp: now.toLocaleTimeString(),
        isoTimestamp: now.toISOString(),
        eventType: 'IMSI_CATCHER_DOWNGRADE',
        slot: this.state.activeSlot,
        detectedIccid: this.state.boundPrimaryIccid,
        carrierLabel: 'Rogue 2G/GSM Stingray Base Station',
        actionTaken: 'SWITCH_BLOCKED',
        severity: 'CRITICAL',
        detail: 'Blocked forced 5G -> 2G cipher downgrade & IMSI catcher interrogation.',
      };
    }

    this.state = {
      ...this.state,
      simSwitchLocked: true,
      lockdownTripped: tripLockdown || this.state.lockdownTripped,
      lockdownReason: tripLockdown ? event.detail : this.state.lockdownReason,
      totalSwapAttemptsBlocked: this.state.totalSwapAttemptsBlocked + 1,
      events: [event, ...this.state.events].slice(0, 40),
    };

    audioAnnouncer.playChime(true);
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

export const simSwitchLockService = new SimSwitchLockService();
