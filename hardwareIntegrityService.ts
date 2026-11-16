import {
  HardwareIntegrityState,
  HardwarePeripheralEvent,
  HardwarePortType,
} from '../types';
import { audioAnnouncer } from './audioAnnouncer';

const STORAGE_KEY = 'sentinel_hardware_integrity_v1';

const INITIAL_HARDWARE_EVENTS: HardwarePeripheralEvent[] = [
  {
    id: 'hw-evt-301',
    timestamp: new Date(Date.now() - 1000 * 60 * 4).toLocaleTimeString(),
    isoTimestamp: new Date(Date.now() - 1000 * 60 * 4).toISOString(),
    deviceName: 'Unregistered USB OTG Mass Storage + ADB Bridge',
    portType: 'USB_OTG',
    vendorProductId: 'VID:18D1 PID:4EE7 (Spoofed)',
    busPath: '/sys/bus/usb/devices/1-1.4',
    anomalySignature:
      'Unexpected OTG host-role negotiation requesting ADB shell & raw NAND partition access',
    riskLevel: 'CRITICAL',
    actionTaken: 'KILL_SWITCH_TRIPPED',
    powerOnlyIsolated: true,
  },
  {
    id: 'hw-evt-302',
    timestamp: new Date(Date.now() - 1000 * 60 * 11).toLocaleTimeString(),
    isoTimestamp: new Date(Date.now() - 1000 * 60 * 11).toISOString(),
    deviceName: '3.5mm TRRS Jack Ultrasonic / Mic Data-Sniffer',
    portType: 'AUDIO_JACK_TRRS',
    vendorProductId: 'CODEC-ADC-0x2A',
    busPath: '/dev/snd/pcmC0D1c (TRRS Ring-2)',
    anomalySignature:
      'High-frequency 22kHz carrier modulation + unauthorized line-in DMA capture attempt on audio jack',
    riskLevel: 'CRITICAL',
    actionTaken: 'DATA_LINES_SEVERED',
    powerOnlyIsolated: true,
  },
  {
    id: 'hw-evt-303',
    timestamp: new Date(Date.now() - 1000 * 60 * 24).toLocaleTimeString(),
    isoTimestamp: new Date(Date.now() - 1000 * 60 * 24).toISOString(),
    deviceName: 'Composite USB-C Keyboard HID Injector (BadUSB)',
    portType: 'USB_C_HID',
    vendorProductId: 'VID:DEAD PID:BEEF',
    busPath: '/sys/bus/hid/devices/0003:DEAD:BEEF',
    anomalySignature:
      'Burst keystroke injection (940 WPM) attempting terminal spawn immediately after plug-in',
    riskLevel: 'CRITICAL',
    actionTaken: 'BUS_QUARANTINED',
    powerOnlyIsolated: true,
  },
  {
    id: 'hw-evt-304',
    timestamp: new Date(Date.now() - 1000 * 60 * 48).toLocaleTimeString(),
    isoTimestamp: new Date(Date.now() - 1000 * 60 * 48).toISOString(),
    deviceName: 'Certified USB-PD Wall Charger (Power-Only)',
    portType: 'USB_OTG',
    vendorProductId: 'USB-PD 3.1 (No Data Lines)',
    busPath: '/sys/class/power_supply/usb',
    anomalySignature: 'D+/D- data pins electrically open; clean 27W PD negotiation only',
    riskLevel: 'TRUSTED',
    actionTaken: 'AUTHORIZED_PASS',
    powerOnlyIsolated: true,
  },
];

class HardwareIntegrityService {
  private state: HardwareIntegrityState;
  private listeners = new Set<(state: HardwareIntegrityState) => void>();
  private busWatchBound = false;

  constructor() {
    this.state = this.loadState();
    if (typeof window !== 'undefined') {
      this.bindBrowserHardwareListeners();
    }
  }

  private loadState(): HardwareIntegrityState {
    const defaults: HardwareIntegrityState = {
      killSwitchTripped: false,
      lastTripReason: null,
      lastTripTimestamp: null,
      usbOtgDataLock: true,
      audioJackSniffGuard: true,
      hidInjectionGuard: true,
      thunderboltDmaLock: true,
      autoKillSwitchOnThreat: true,
      liveBusMonitoringActive: true,
      totalKillSwitchTrips: 2,
      totalUnauthorizedProbesBlocked: 14,
      detectedBrowserDevicesCount: 0,
      lastBusProbeSummary: 'Hardware bus monitor armed (USB OTG, TRRS Audio, HID).',
      events: INITIAL_HARDWARE_EVENTS,
    };

    if (typeof window === 'undefined') return defaults;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return defaults;
      const parsed = JSON.parse(raw) as Partial<HardwareIntegrityState>;
      return {
        ...defaults,
        ...parsed,
        events:
          Array.isArray(parsed.events) && parsed.events.length > 0
            ? parsed.events
            : defaults.events,
      };
    } catch {
      return defaults;
    }
  }

  private persist() {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
    } catch {
      // Ignore storage quota issues
    }
  }

  private notify() {
    const snapshot = this.getSnapshot();
    this.listeners.forEach(cb => cb(snapshot));
  }

  public getSnapshot(): HardwareIntegrityState {
    return {
      ...this.state,
      events: [...this.state.events],
    };
  }

  public subscribe(cb: (state: HardwareIntegrityState) => void) {
    this.listeners.add(cb);
    cb(this.getSnapshot());
    return () => {
      this.listeners.delete(cb);
    };
  }

  private bindBrowserHardwareListeners() {
    if (this.busWatchBound) return;
    this.busWatchBound = true;

    try {
      const nav = navigator as Navigator & {
        usb?: {
          addEventListener?: (type: string, fn: (e: Event) => void) => void;
          getDevices?: () => Promise<Array<{ productName?: string; vendorId?: number; productId?: number }>>;
        };
        hid?: {
          addEventListener?: (type: string, fn: (e: Event) => void) => void;
          getDevices?: () => Promise<Array<{ productName?: string; vendorId?: number; productId?: number }>>;
        };
      };

      if (nav.mediaDevices && typeof nav.mediaDevices.addEventListener === 'function') {
        nav.mediaDevices.addEventListener('devicechange', () => {
          if (!this.state.liveBusMonitoringActive) return;
          this.handleLiveDeviceChange('AUDIO_JACK_TRRS', 'Browser MediaDevices audio peripheral topology changed');
        });
      }

      if (nav.usb && typeof nav.usb.addEventListener === 'function') {
        nav.usb.addEventListener('connect', () => {
          if (!this.state.liveBusMonitoringActive) return;
          this.handleLiveDeviceChange('USB_OTG', 'WebUSB host detected new USB peripheral attachment');
        });
      }

      if (nav.hid && typeof nav.hid.addEventListener === 'function') {
        nav.hid.addEventListener('connect', () => {
          if (!this.state.liveBusMonitoringActive) return;
          this.handleLiveDeviceChange('USB_C_HID', 'WebHID interface detected unexpected HID attachment');
        });
      }
    } catch {
      // Browser hardware APIs unavailable or sandboxed
    }
  }

  private handleLiveDeviceChange(portType: HardwarePortType, signature: string) {
    const now = new Date();
    const shouldTrip = this.state.autoKillSwitchOnThreat;

    const newEvent: HardwarePeripheralEvent = {
      id: `hw-live-${Date.now()}`,
      timestamp: now.toLocaleTimeString(),
      isoTimestamp: now.toISOString(),
      deviceName:
        portType === 'AUDIO_JACK_TRRS'
          ? 'Unexpected Audio Jack / Line-In Peripheral'
          : portType === 'USB_C_HID'
          ? 'Unexpected External HID Device'
          : 'Unexpected USB OTG Peripheral',
      portType,
      vendorProductId: 'LIVE-BUS-EVENT',
      busPath: 'Browser Hardware Enumeration Hook',
      anomalySignature: signature,
      riskLevel: 'HIGH',
      actionTaken: shouldTrip ? 'KILL_SWITCH_TRIPPED' : 'BUS_QUARANTINED',
      powerOnlyIsolated: true,
    };

    if (shouldTrip) {
      this.tripKillSwitchInternal(
        `Unexpected ${portType.replace(/_/g, ' ')} attachment detected`,
        newEvent
      );
    } else {
      this.state = {
        ...this.state,
        totalUnauthorizedProbesBlocked: this.state.totalUnauthorizedProbesBlocked + 1,
        events: [newEvent, ...this.state.events].slice(0, 60),
      };
      this.persist();
      this.notify();
    }
  }

  public async probeBrowserHardwareBuses(): Promise<string> {
    let mediaCount = 0;
    let usbCount = 0;
    let hidCount = 0;

    try {
      if (navigator.mediaDevices?.enumerateDevices) {
        const media = await navigator.mediaDevices.enumerateDevices();
        mediaCount = media.length;
      }
    } catch {
      mediaCount = 0;
    }

    try {
      const nav = navigator as Navigator & {
        usb?: { getDevices?: () => Promise<unknown[]> };
        hid?: { getDevices?: () => Promise<unknown[]> };
      };
      if (nav.usb?.getDevices) {
        const usb = await nav.usb.getDevices();
        usbCount = usb.length;
      }
      if (nav.hid?.getDevices) {
        const hid = await nav.hid.getDevices();
        hidCount = hid.length;
      }
    } catch {
      // Ignore sandboxed permissions
    }

    const total = mediaCount + usbCount + hidCount;
    const summary = `Probed live browser hardware buses: ${mediaCount} audio/media endpoints, ${usbCount} paired WebUSB devices, ${hidCount} WebHID devices.`;

    this.state = {
      ...this.state,
      detectedBrowserDevicesCount: total,
      lastBusProbeSummary: summary,
    };
    this.persist();
    this.notify();
    return summary;
  }

  private tripKillSwitchInternal(reason: string, event?: HardwarePeripheralEvent) {
    const nowStr = new Date().toLocaleTimeString();
    audioAnnouncer.unlockAudio();
    audioAnnouncer.announceCriticalPatch(
      'Hardware Integrity Kill-Switch Engaged',
      reason,
      'Host Peripheral Bus'
    );

    this.state = {
      ...this.state,
      killSwitchTripped: true,
      lastTripReason: reason,
      lastTripTimestamp: nowStr,
      usbOtgDataLock: true,
      audioJackSniffGuard: true,
      hidInjectionGuard: true,
      thunderboltDmaLock: true,
      totalKillSwitchTrips: this.state.totalKillSwitchTrips + 1,
      totalUnauthorizedProbesBlocked: this.state.totalUnauthorizedProbesBlocked + (event ? 1 : 0),
      events: event ? [event, ...this.state.events].slice(0, 60) : this.state.events,
    };

    this.persist();
    this.notify();
  }

  public triggerManualKillSwitch(reason = 'Manual operator emergency hardware bus kill-switch') {
    const now = new Date();
    const manualEvent: HardwarePeripheralEvent = {
      id: `hw-kill-${Date.now()}`,
      timestamp: now.toLocaleTimeString(),
      isoTimestamp: now.toISOString(),
      deviceName: 'All External Data Buses (USB OTG, TRRS Audio, HID, DMA)',
      portType: 'USB_OTG',
      vendorProductId: 'ALL-BUSES-ISOLATED',
      busPath: '/sys/bus/sentinel-killswitch',
      anomalySignature: reason,
      riskLevel: 'CRITICAL',
      actionTaken: 'KILL_SWITCH_TRIPPED',
      powerOnlyIsolated: true,
    };
    this.tripKillSwitchInternal(reason, manualEvent);
  }

  public resetKillSwitch() {
    this.state = {
      ...this.state,
      killSwitchTripped: false,
      lastBusProbeSummary: `Kill-switch reset at ${new Date().toLocaleTimeString()}; peripheral bus guards remain armed.`,
    };
    this.persist();
    this.notify();
  }

  public simulatePeripheralEvent(
    kind: 'usb_otg' | 'audio_jack_sniff' | 'bad_usb_hid' | 'authorized_charger'
  ) {
    const now = new Date();

    if (kind === 'authorized_charger') {
      const safeEvent: HardwarePeripheralEvent = {
        id: `hw-sim-${Date.now()}`,
        timestamp: now.toLocaleTimeString(),
        isoTimestamp: now.toISOString(),
        deviceName: 'Verified USB-PD Power Adapter (Data Lines Open)',
        portType: 'USB_OTG',
        vendorProductId: 'USB-PD-SAFE',
        busPath: '/sys/class/power_supply/usb',
        anomalySignature: 'Zero data-pin voltage; power delivery handshake verified clean',
        riskLevel: 'TRUSTED',
        actionTaken: 'AUTHORIZED_PASS',
        powerOnlyIsolated: true,
      };
      this.state = {
        ...this.state,
        events: [safeEvent, ...this.state.events].slice(0, 60),
      };
      this.persist();
      this.notify();
      return;
    }

    const templates: Record<
      'usb_otg' | 'audio_jack_sniff' | 'bad_usb_hid',
      Omit<HardwarePeripheralEvent, 'id' | 'timestamp' | 'isoTimestamp' | 'actionTaken'>
    > = {
      usb_otg: {
        deviceName: 'Unauthorized USB OTG Flash & Debug Dongle',
        portType: 'USB_OTG',
        vendorProductId: 'VID:0951 PID:1666 (OTG Host)',
        busPath: '/sys/bus/usb/devices/usb1-port2',
        anomalySignature:
          'Unauthorized USB OTG role-swap attempting MTP + ADB raw memory exfiltration',
        riskLevel: 'CRITICAL',
        powerOnlyIsolated: true,
      },
      audio_jack_sniff: {
        deviceName: '3.5mm Headphone Jack Ultrasonic Data-Sniffer',
        portType: 'AUDIO_JACK_TRRS',
        vendorProductId: 'TRRS-ANALOG-TAP',
        busPath: '/dev/snd/pcmC0D1c (Mic Bias)',
        anomalySignature:
          'Unexpected TRRS microphone impedance drop + covert 21.4kHz acoustic data-sniffing probe',
        riskLevel: 'CRITICAL',
        powerOnlyIsolated: true,
      },
      bad_usb_hid: {
        deviceName: 'Spoofed USB-C Charging Cable (HID Payload)',
        portType: 'USB_C_HID',
        vendorProductId: 'VID:1D6B PID:0104 (O.MG)',
        busPath: '/sys/bus/hid/devices/0003:1D6B:0104',
        anomalySignature:
          'Cable attempted covert HID keyboard enumeration and injected shell keystrokes',
        riskLevel: 'CRITICAL',
        powerOnlyIsolated: true,
      },
    };

    const tpl = templates[kind];
    const shouldTrip = this.state.autoKillSwitchOnThreat;

    const event: HardwarePeripheralEvent = {
      id: `hw-sim-${Date.now()}`,
      timestamp: now.toLocaleTimeString(),
      isoTimestamp: now.toISOString(),
      ...tpl,
      actionTaken: shouldTrip ? 'KILL_SWITCH_TRIPPED' : 'BUS_QUARANTINED',
    };

    if (shouldTrip) {
      this.tripKillSwitchInternal(tpl.anomalySignature, event);
    } else {
      this.state = {
        ...this.state,
        totalUnauthorizedProbesBlocked: this.state.totalUnauthorizedProbesBlocked + 1,
        events: [event, ...this.state.events].slice(0, 60),
      };
      this.persist();
      this.notify();
    }
  }

  public toggleGuard(
    key:
      | 'usbOtgDataLock'
      | 'audioJackSniffGuard'
      | 'hidInjectionGuard'
      | 'thunderboltDmaLock'
      | 'autoKillSwitchOnThreat'
      | 'liveBusMonitoringActive'
  ) {
    this.state = {
      ...this.state,
      [key]: !this.state[key],
    };
    this.persist();
    this.notify();
  }

  public authorizePeripheral(eventId: string) {
    this.state = {
      ...this.state,
      events: this.state.events.map(ev =>
        ev.id === eventId
          ? { ...ev, riskLevel: 'TRUSTED', actionTaken: 'AUTHORIZED_PASS' }
          : ev
      ),
    };
    this.persist();
    this.notify();
  }

  public quarantinePeripheral(eventId: string) {
    this.state = {
      ...this.state,
      totalUnauthorizedProbesBlocked: this.state.totalUnauthorizedProbesBlocked + 1,
      events: this.state.events.map(ev =>
        ev.id === eventId
          ? {
              ...ev,
              riskLevel: 'CRITICAL',
              actionTaken: 'BUS_QUARANTINED',
              powerOnlyIsolated: true,
            }
          : ev
      ),
    };
    this.persist();
    this.notify();
  }

  public clearEvents() {
    this.state = {
      ...this.state,
      events: [],
    };
    this.persist();
    this.notify();
  }

  public restoreBaselineEvents() {
    this.state = {
      ...this.state,
      events: INITIAL_HARDWARE_EVENTS,
    };
    this.persist();
    this.notify();
  }
}

export const hardwareIntegrityService = new HardwareIntegrityService();
