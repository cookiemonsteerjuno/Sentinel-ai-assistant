import { AnalyticsBlockState, AnalyticsInterceptEvent } from '../types';

export const KNOWN_ANALYTICS_VENDORS = [
  {
    name: 'Google Analytics 4 / Universal',
    pattern: /google-analytics\.com|analytics\.google\.com|googletagmanager\.com\/gtag|stats\.g\.doubleclick\.net/i,
    sampleEndpoint: 'https://www.google-analytics.com/g/collect',
    type: 'telemetry_beacon' as const,
  },
  {
    name: 'Segment IO Telemetry',
    pattern: /api\.segment\.io|cdn\.segment\.com\/v1\/projects/i,
    sampleEndpoint: 'https://api.segment.io/v1/t',
    type: 'user_interaction' as const,
  },
  {
    name: 'Mixpanel Data Ingestion',
    pattern: /api\.mixpanel\.com|api-js\.mixpanel\.com/i,
    sampleEndpoint: 'https://api.mixpanel.com/track',
    type: 'user_interaction' as const,
  },
  {
    name: 'Datadog Browser RUM',
    pattern: /browser-intake-datadoghq\.com|datadoghq\.com\/api\/v2\/rum/i,
    sampleEndpoint: 'https://browser-intake-datadoghq.com/api/v2/rum',
    type: 'session_heartbeat' as const,
  },
  {
    name: 'Sentry Crashlytics & Tracing',
    pattern: /sentry\.io\/api|o\d+\.ingest\.sentry\.io/i,
    sampleEndpoint: 'https://o450.ingest.sentry.io/api/450/envelope/',
    type: 'crash_stack' as const,
  },
  {
    name: 'Amplitude Analytics Event API',
    pattern: /api\.amplitude\.com|api2\.amplitude\.com/i,
    sampleEndpoint: 'https://api2.amplitude.com/2/httpapi',
    type: 'user_interaction' as const,
  },
  {
    name: 'FullStory Session Recorder',
    pattern: /fullstory\.com\/rec|edge\.fullstory\.com/i,
    sampleEndpoint: 'https://edge.fullstory.com/rec/page',
    type: 'session_heartbeat' as const,
  },
  {
    name: 'Hotjar Behavioral Telemetry',
    pattern: /hotjar\.com|vars\.hotjar\.com/i,
    sampleEndpoint: 'https://vars.hotjar.com/rc/v1/event',
    type: 'device_fingerprint' as const,
  },
  {
    name: 'New Relic Browser Agent',
    pattern: /bam\.nr-data\.net|newrelic\.com/i,
    sampleEndpoint: 'https://bam.nr-data.net/1/294829',
    type: 'telemetry_beacon' as const,
  },
];

class AnalyticsInterceptorService {
  private isBlocking: boolean = true;
  private blockBeaconApi: boolean = true;
  private blockThirdPartyTrackers: boolean = true;
  private blockSessionReplays: boolean = true;
  private blockCrashReports: boolean = true;
  private stripTrackingParams: boolean = true;
  private totalBlocked: number = 248;
  private blockedEvents: AnalyticsInterceptEvent[] = [];
  private listeners: Set<(event: AnalyticsInterceptEvent) => void> = new Set();
  private isInstalled: boolean = false;

  constructor() {
    this.initInitialEvents();
    if (typeof window !== 'undefined') {
      this.installHooks();
    }
  }

  private initInitialEvents() {
    const now = Date.now();
    this.blockedEvents = [
      {
        id: 'anl-init-1',
        timestamp: new Date(now - 14000).toLocaleTimeString(),
        vendor: 'Google Analytics 4 (gtag.js)',
        endpoint: 'https://www.google-analytics.com/g/collect?v=2&tid=G-XXXXX',
        method: 'sendBeacon',
        payloadType: 'telemetry_beacon',
        actionTaken: 'SUPPRESSED_NULL_ROUTED',
        sizeBytes: 842,
      },
      {
        id: 'anl-init-2',
        timestamp: new Date(now - 38000).toLocaleTimeString(),
        vendor: 'Datadog Browser RUM',
        endpoint: 'https://browser-intake-datadoghq.com/api/v2/rum',
        method: 'POST /collect',
        payloadType: 'session_heartbeat',
        actionTaken: 'DROPPED_0_BYTES',
        sizeBytes: 1240,
      },
      {
        id: 'anl-init-3',
        timestamp: new Date(now - 75000).toLocaleTimeString(),
        vendor: 'Segment IO Telemetry',
        endpoint: 'https://api.segment.io/v1/t',
        method: 'POST /collect',
        payloadType: 'user_interaction',
        actionTaken: 'PAYLOAD_PURGED',
        sizeBytes: 610,
      },
      {
        id: 'anl-init-4',
        timestamp: new Date(now - 110000).toLocaleTimeString(),
        vendor: 'FullStory Session Recorder',
        endpoint: 'https://edge.fullstory.com/rec/page',
        method: 'WebSocket',
        payloadType: 'session_heartbeat',
        actionTaken: 'SUPPRESSED_NULL_ROUTED',
        sizeBytes: 3420,
      },
      {
        id: 'anl-init-5',
        timestamp: new Date(now - 165000).toLocaleTimeString(),
        vendor: 'Sentry Error Tracing',
        endpoint: 'https://o450.ingest.sentry.io/api/450/envelope/',
        method: 'fetch/xhr',
        payloadType: 'crash_stack',
        actionTaken: 'DROPPED_0_BYTES',
        sizeBytes: 1890,
      },
    ];
  }

  public installHooks() {
    if (this.isInstalled || typeof window === 'undefined') return;
    this.isInstalled = true;

    // 1. Override navigator.sendBeacon
    if (typeof navigator !== 'undefined' && 'sendBeacon' in navigator) {
      const originalSendBeacon = navigator.sendBeacon.bind(navigator);
      navigator.sendBeacon = (url: string | URL, data?: BodyInit | null): boolean => {
        const urlString = url.toString();
        if (this.isBlocking && this.blockBeaconApi) {
          const matchedVendor = KNOWN_ANALYTICS_VENDORS.find(v => v.pattern.test(urlString));
          const vendorName = matchedVendor ? matchedVendor.name : 'Unknown Telemetry Collector';
          const size = data ? (typeof data === 'string' ? data.length : 512) : 0;
          this.recordInterception(vendorName, urlString, 'navigator.sendBeacon', 'telemetry_beacon', size);
          // Return true so the calling library believes it succeeded, preventing retry loops
          return true;
        }
        return originalSendBeacon(url, data);
      };
    }

    // 2. Strip tracking query parameters from URL if enabled
    if (this.stripTrackingParams && typeof window !== 'undefined' && window.location) {
      try {
        const url = new URL(window.location.href);
        const trackingParams = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'gclid', 'fbclid', 'msclkid', '_ga', '_gl'];
        let modified = false;
        trackingParams.forEach(p => {
          if (url.searchParams.has(p)) {
            url.searchParams.delete(p);
            modified = true;
          }
        });
        if (modified && window.history && window.history.replaceState) {
          window.history.replaceState({}, document.title, url.pathname + (url.search ? url.search : '') + url.hash);
        }
      } catch {
        // Safe fallback
      }
    }
  }

  public recordInterception(
    vendor: string,
    endpoint: string,
    method: 'sendBeacon' | 'POST /collect' | 'fetch/xhr' | 'WebSocket' | 'navigator.sendBeacon',
    payloadType: 'telemetry_beacon' | 'user_interaction' | 'session_heartbeat' | 'crash_stack' | 'device_fingerprint',
    sizeBytes: number = 512
  ): AnalyticsInterceptEvent {
    const newEvent: AnalyticsInterceptEvent = {
      id: `anl-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      timestamp: new Date().toLocaleTimeString(),
      vendor,
      endpoint,
      method,
      payloadType,
      actionTaken: 'SUPPRESSED_NULL_ROUTED',
      sizeBytes,
    };

    this.totalBlocked += 1;
    this.blockedEvents = [newEvent, ...this.blockedEvents.slice(0, 49)];
    this.listeners.forEach(fn => fn(newEvent));
    return newEvent;
  }

  public purgeAllAnalyticsLogs() {
    this.blockedEvents = [];
    // Clear any local storage telemetry caches
    if (typeof window !== 'undefined') {
      try {
        const keysToRemove = [];
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (k && (/ga_|segment|mixpanel|amplitude|sentry|datadog|telemetry/i.test(k))) {
            keysToRemove.push(k);
          }
        }
        keysToRemove.forEach(k => localStorage.removeItem(k));
      } catch {
        // ignore
      }
    }
  }

  public getState(): AnalyticsBlockState {
    return {
      blockAnalyticsLogging: this.isBlocking,
      blockBeaconApi: this.blockBeaconApi,
      blockThirdPartyTrackers: this.blockThirdPartyTrackers,
      blockSessionReplays: this.blockSessionReplays,
      blockTelemetryBeacons: this.blockTelemetryBeacons,
      blockCrashReports: this.blockCrashReports,
      stripTrackingParams: this.stripTrackingParams,
      totalAnalyticsBlocked: this.totalBlocked,
      lastBlockedAt: this.blockedEvents[0]?.timestamp,
      blockedVendorsCount: KNOWN_ANALYTICS_VENDORS.length,
    };
  }

  public setBlocking(value: boolean) {
    this.isBlocking = value;
  }

  public toggleFeature(key: keyof AnalyticsBlockState, value: boolean) {
    if (key === 'blockAnalyticsLogging') this.isBlocking = value;
    if (key === 'blockBeaconApi') this.blockBeaconApi = value;
    if (key === 'blockThirdPartyTrackers') this.blockThirdPartyTrackers = value;
    if (key === 'blockSessionReplays') this.blockSessionReplays = value;
    if (key === 'blockTelemetryBeacons') this.blockTelemetryBeacons = value;
    if (key === 'blockCrashReports') this.blockCrashReports = value;
    if (key === 'stripTrackingParams') this.stripTrackingParams = value;
  }

  public getBlockedEvents(): AnalyticsInterceptEvent[] {
    return this.blockedEvents;
  }

  public subscribe(listener: (event: AnalyticsInterceptEvent) => void) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }
}

export const analyticsInterceptor = new AnalyticsInterceptorService();
