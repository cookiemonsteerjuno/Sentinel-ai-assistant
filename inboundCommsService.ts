import {
  InboundCommunicationEvent,
  InboundCommChannel,
  CommTrustStatus,
} from '../types';
import { audioAnnouncer } from './audioAnnouncer';

export interface InboundCommsSnapshot {
  events: InboundCommunicationEvent[];
  blockedNumbers: string[];
  liveStreamEnabled: boolean;
  autoBlockSpamCalls: boolean;
  autoQuarantinePhishingSms: boolean;
  voiceAlertOnSuspicious: boolean;
  totalCallsReceived: number;
  totalMessagesReceived: number;
  totalBlockedComms: number;
}

const STORAGE_KEY = 'sentinel_inbound_comms_v1';

const INITIAL_COMMS_EVENTS: InboundCommunicationEvent[] = [
  {
    id: 'comm-101',
    channel: 'CALL',
    senderName: 'Unknown Caller (Spoofed Bank)',
    phoneNumber: '+1 (800) 555-0194',
    carrierOrOrigin: 'SIP Trunk · Unverified Gateway',
    timestamp: new Date(Date.now() - 1000 * 60 * 3).toLocaleTimeString(),
    isoTimestamp: new Date(Date.now() - 1000 * 60 * 3).toISOString(),
    previewText: 'Incoming voice call flagged by STIR/SHAKEN attestation mismatch and spoofed caller ID.',
    callState: 'REJECTED_BY_SHIELD',
    durationSec: 0,
    stirShakenAttestation: 'C (Gateway)',
    phishingScore: 94,
    status: 'BLOCKED',
    threatReason: 'Caller ID failed carrier cryptographic signature verification.',
  },
  {
    id: 'comm-102',
    channel: 'SMS',
    senderName: 'Parcel Delivery Alert',
    phoneNumber: '+1 (347) 555-0148',
    carrierOrOrigin: 'T-Mobile US · Shortcode Relay',
    timestamp: new Date(Date.now() - 1000 * 60 * 9).toLocaleTimeString(),
    isoTimestamp: new Date(Date.now() - 1000 * 60 * 9).toISOString(),
    previewText: 'URGENT: Your package is held at customs. Confirm address immediately at http://trk-verify-882.example/pay',
    phishingScore: 91,
    status: 'SUSPICIOUS',
    threatReason: 'Contains unverified lookalike tracking URL and urgency social engineering.',
  },
  {
    id: 'comm-103',
    channel: 'CALL',
    senderName: 'Alex Mercer (SecOps Lead)',
    phoneNumber: '+1 (415) 555-0122',
    carrierOrOrigin: 'Verizon Wireless · VoLTE',
    timestamp: new Date(Date.now() - 1000 * 60 * 18).toLocaleTimeString(),
    isoTimestamp: new Date(Date.now() - 1000 * 60 * 18).toISOString(),
    previewText: 'Encrypted HD voice call — Firewall rotation schedule confirmation.',
    callState: 'ANSWERED',
    durationSec: 184,
    stirShakenAttestation: 'A (Verified)',
    phishingScore: 2,
    status: 'VERIFIED',
  },
  {
    id: 'comm-104',
    channel: 'RCS',
    senderName: 'Elena Vance',
    phoneNumber: '+1 (206) 555-0183',
    carrierOrOrigin: 'Google Jibe RCS · E2EE',
    timestamp: new Date(Date.now() - 1000 * 60 * 32).toLocaleTimeString(),
    isoTimestamp: new Date(Date.now() - 1000 * 60 * 32).toISOString(),
    previewText: 'Uploaded the signed certificate fingerprint to the vault. Ready when you are.',
    phishingScore: 0,
    status: 'VERIFIED',
  },
  {
    id: 'comm-105',
    channel: 'VOIP',
    senderName: 'IT Helpdesk Extension',
    phoneNumber: '+1 (650) 555-0167',
    carrierOrOrigin: 'Enterprise WebRTC / SIP TLS',
    timestamp: new Date(Date.now() - 1000 * 60 * 49).toLocaleTimeString(),
    isoTimestamp: new Date(Date.now() - 1000 * 60 * 49).toISOString(),
    previewText: 'Missed VoIP call — Security key enrollment follow-up.',
    callState: 'MISSED',
    durationSec: 0,
    stirShakenAttestation: 'A (Verified)',
    phishingScore: 5,
    status: 'SCREENED',
  },
  {
    id: 'comm-106',
    channel: 'SMS',
    senderName: 'AuthGuard 2FA',
    phoneNumber: '39482',
    carrierOrOrigin: 'Verified Carrier Shortcode',
    timestamp: new Date(Date.now() - 1000 * 60 * 64).toLocaleTimeString(),
    isoTimestamp: new Date(Date.now() - 1000 * 60 * 64).toISOString(),
    previewText: 'Your Sentinel hardware token verification code is 491820. Do not share this code.',
    phishingScore: 4,
    status: 'VERIFIED',
  },
];

const SIMULATED_CALL_TEMPLATES = [
  {
    senderName: 'Dr. Maya Lin',
    phoneNumber: '+1 (415) 555-0174',
    carrierOrOrigin: 'AT&T Mobility · VoLTE',
    previewText: 'Incoming HD voice call from verified contact.',
    callState: 'RINGING' as const,
    stirShakenAttestation: 'A (Verified)' as const,
    phishingScore: 3,
    status: 'VERIFIED' as CommTrustStatus,
  },
  {
    senderName: 'Suspicious Robocall Origin',
    phoneNumber: '+1 (888) 555-0139',
    carrierOrOrigin: 'Foreign VoIP Transit',
    previewText: 'Automated IRS / warrant scam signature detected on SIP INVITE header.',
    callState: 'REJECTED_BY_SHIELD' as const,
    stirShakenAttestation: 'None' as const,
    phishingScore: 97,
    status: 'BLOCKED' as CommTrustStatus,
    threatReason: 'Matches known Robocall audio & SIP trunk abuse fingerprint.',
  },
  {
    senderName: 'Private Number',
    phoneNumber: 'Restricted / Anonymous',
    carrierOrOrigin: 'Carrier Relay · Unattested',
    previewText: 'Incoming anonymous voice call routed through Sentinel screening.',
    callState: 'MISSED' as const,
    stirShakenAttestation: 'C (Gateway)' as const,
    phishingScore: 68,
    status: 'SUSPICIOUS' as CommTrustStatus,
    threatReason: 'Caller ID suppressed with low attestation level.',
  },
];

const SIMULATED_MSG_TEMPLATES = [
  {
    channel: 'RCS' as InboundCommChannel,
    senderName: 'Marcus Reid',
    phoneNumber: '+1 (312) 555-0155',
    carrierOrOrigin: 'Google Jibe RCS · E2EE',
    previewText: 'Checked the Pixel November security bulletin—patched cleanly on reboot.',
    phishingScore: 0,
    status: 'VERIFIED' as CommTrustStatus,
  },
  {
    channel: 'SMS' as InboundCommChannel,
    senderName: 'Toll-Road Billing Bot',
    phoneNumber: '+44 7700 900412',
    carrierOrOrigin: 'International SMS Gateway',
    previewText: 'Final notice: unpaid toll balance of $4.85. Pay now at http://ez-toll-check.invalid/u',
    phishingScore: 95,
    status: 'SUSPICIOUS' as CommTrustStatus,
    threatReason: 'Smishing domain detected inside SMS body.',
  },
  {
    channel: 'SMS' as InboundCommChannel,
    senderName: 'Carrier Security',
    phoneNumber: '61173',
    carrierOrOrigin: 'Verified Carrier Shortcode',
    previewText: 'SIM lock PIN verification confirmed on primary line.',
    phishingScore: 2,
    status: 'VERIFIED' as CommTrustStatus,
  },
];

class InboundCommsService {
  private state: InboundCommsSnapshot;
  private listeners = new Set<(snapshot: InboundCommsSnapshot) => void>();
  private streamTimer: ReturnType<typeof setInterval> | null = null;

  constructor() {
    this.state = this.loadState();
    if (typeof window !== 'undefined') {
      this.startStreamLoop();
    }
  }

  private loadState(): InboundCommsSnapshot {
    const defaults: InboundCommsSnapshot = {
      events: INITIAL_COMMS_EVENTS,
      blockedNumbers: ['+1 (800) 555-0194'],
      liveStreamEnabled: true,
      autoBlockSpamCalls: true,
      autoQuarantinePhishingSms: true,
      voiceAlertOnSuspicious: false,
      totalCallsReceived: INITIAL_COMMS_EVENTS.filter(
        e => e.channel === 'CALL' || e.channel === 'VOIP'
      ).length,
      totalMessagesReceived: INITIAL_COMMS_EVENTS.filter(
        e => e.channel === 'SMS' || e.channel === 'RCS'
      ).length,
      totalBlockedComms: INITIAL_COMMS_EVENTS.filter(e => e.status === 'BLOCKED').length,
    };

    if (typeof window === 'undefined') return defaults;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return defaults;
      const parsed = JSON.parse(raw) as Partial<InboundCommsSnapshot>;
      return {
        ...defaults,
        ...parsed,
        events: Array.isArray(parsed.events) && parsed.events.length > 0
          ? parsed.events
          : defaults.events,
        blockedNumbers: Array.isArray(parsed.blockedNumbers)
          ? parsed.blockedNumbers
          : defaults.blockedNumbers,
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
      // Ignore storage limits
    }
  }

  private notify() {
    const snap = this.getSnapshot();
    this.listeners.forEach(cb => cb(snap));
  }

  public getSnapshot(): InboundCommsSnapshot {
    return {
      ...this.state,
      events: [...this.state.events],
      blockedNumbers: [...this.state.blockedNumbers],
    };
  }

  public subscribe(cb: (snapshot: InboundCommsSnapshot) => void) {
    this.listeners.add(cb);
    cb(this.getSnapshot());
    return () => {
      this.listeners.delete(cb);
    };
  }

  private startStreamLoop() {
    if (this.streamTimer) clearInterval(this.streamTimer);
    this.streamTimer = setInterval(() => {
      if (!this.state.liveStreamEnabled) return;
      if (Math.random() > 0.55) {
        this.simulateIncoming(Math.random() > 0.48 ? 'MESSAGE' : 'CALL');
      }
    }, 14000);
  }

  public simulateIncoming(kind: 'CALL' | 'MESSAGE') {
    const now = new Date();
    let newEvent: InboundCommunicationEvent;

    if (kind === 'CALL') {
      const tpl =
        SIMULATED_CALL_TEMPLATES[
          Math.floor(Math.random() * SIMULATED_CALL_TEMPLATES.length)
        ];
      const isBlockedByList = this.state.blockedNumbers.includes(tpl.phoneNumber);
      const shouldAutoBlock =
        isBlockedByList || (this.state.autoBlockSpamCalls && tpl.phishingScore >= 80);

      newEvent = {
        id: `comm-call-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        channel: Math.random() > 0.75 ? 'VOIP' : 'CALL',
        senderName: tpl.senderName,
        phoneNumber: tpl.phoneNumber,
        carrierOrOrigin: tpl.carrierOrOrigin,
        timestamp: now.toLocaleTimeString(),
        isoTimestamp: now.toISOString(),
        previewText: tpl.previewText,
        callState: shouldAutoBlock ? 'REJECTED_BY_SHIELD' : tpl.callState,
        durationSec: tpl.callState === 'RINGING' && !shouldAutoBlock ? 42 : 0,
        stirShakenAttestation: tpl.stirShakenAttestation,
        phishingScore: tpl.phishingScore,
        status: shouldAutoBlock ? 'BLOCKED' : tpl.status,
        threatReason: tpl.threatReason,
      };
    } else {
      const tpl =
        SIMULATED_MSG_TEMPLATES[
          Math.floor(Math.random() * SIMULATED_MSG_TEMPLATES.length)
        ];
      const isBlockedByList = this.state.blockedNumbers.includes(tpl.phoneNumber);
      const shouldAutoQuarantine =
        isBlockedByList || (this.state.autoQuarantinePhishingSms && tpl.phishingScore >= 85);

      newEvent = {
        id: `comm-msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        channel: tpl.channel,
        senderName: tpl.senderName,
        phoneNumber: tpl.phoneNumber,
        carrierOrOrigin: tpl.carrierOrOrigin,
        timestamp: now.toLocaleTimeString(),
        isoTimestamp: now.toISOString(),
        previewText: tpl.previewText,
        phishingScore: tpl.phishingScore,
        status: isBlockedByList
          ? 'BLOCKED'
          : shouldAutoQuarantine
          ? 'SUSPICIOUS'
          : tpl.status,
        threatReason: tpl.threatReason,
      };
    }

    if (
      this.state.voiceAlertOnSuspicious &&
      (newEvent.status === 'BLOCKED' || newEvent.status === 'SUSPICIOUS')
    ) {
      audioAnnouncer.playChime(true);
    }

    this.state = {
      ...this.state,
      events: [newEvent, ...this.state.events].slice(0, 80),
      totalCallsReceived:
        this.state.totalCallsReceived +
        (newEvent.channel === 'CALL' || newEvent.channel === 'VOIP' ? 1 : 0),
      totalMessagesReceived:
        this.state.totalMessagesReceived +
        (newEvent.channel === 'SMS' || newEvent.channel === 'RCS' ? 1 : 0),
      totalBlockedComms:
        this.state.totalBlockedComms + (newEvent.status === 'BLOCKED' ? 1 : 0),
    };

    this.persist();
    this.notify();
  }

  public blockSender(eventId: string) {
    const target = this.state.events.find(e => e.id === eventId);
    if (!target) return;

    const blockedSet = new Set(this.state.blockedNumbers);
    blockedSet.add(target.phoneNumber);

    this.state = {
      ...this.state,
      blockedNumbers: Array.from(blockedSet),
      events: this.state.events.map(e =>
        e.phoneNumber === target.phoneNumber
          ? {
              ...e,
              status: 'BLOCKED',
              callState:
                e.channel === 'CALL' || e.channel === 'VOIP'
                  ? 'REJECTED_BY_SHIELD'
                  : e.callState,
            }
          : e
      ),
      totalBlockedComms: this.state.totalBlockedComms + 1,
    };

    this.persist();
    this.notify();
  }

  public markVerified(eventId: string) {
    const target = this.state.events.find(e => e.id === eventId);
    if (!target) return;

    this.state = {
      ...this.state,
      blockedNumbers: this.state.blockedNumbers.filter(n => n !== target.phoneNumber),
      events: this.state.events.map(e =>
        e.id === eventId
          ? {
              ...e,
              status: 'VERIFIED',
              threatReason: undefined,
            }
          : e
      ),
    };

    this.persist();
    this.notify();
  }

  public toggleSetting(
    key:
      | 'liveStreamEnabled'
      | 'autoBlockSpamCalls'
      | 'autoQuarantinePhishingSms'
      | 'voiceAlertOnSuspicious'
  ) {
    if (key === 'voiceAlertOnSuspicious' && !this.state.voiceAlertOnSuspicious) {
      audioAnnouncer.unlockAudio();
    }
    this.state = {
      ...this.state,
      [key]: !this.state[key],
    };
    this.persist();
    this.notify();
  }

  public clearHistory() {
    this.state = {
      ...this.state,
      events: [],
    };
    this.persist();
    this.notify();
  }

  public restoreBaseline() {
    this.state = {
      ...this.state,
      events: INITIAL_COMMS_EVENTS,
      totalCallsReceived: INITIAL_COMMS_EVENTS.filter(
        e => e.channel === 'CALL' || e.channel === 'VOIP'
      ).length,
      totalMessagesReceived: INITIAL_COMMS_EVENTS.filter(
        e => e.channel === 'SMS' || e.channel === 'RCS'
      ).length,
      totalBlockedComms: INITIAL_COMMS_EVENTS.filter(e => e.status === 'BLOCKED').length,
    };
    this.persist();
    this.notify();
  }
}

export const inboundCommsService = new InboundCommsService();
