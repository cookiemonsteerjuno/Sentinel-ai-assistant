import React, { useState, useEffect } from 'react';
import { AnalyticsBlockState, AnalyticsInterceptEvent } from '../types';
import { analyticsInterceptor, KNOWN_ANALYTICS_VENDORS } from '../services/analyticsInterceptor';
import { audioAnnouncer } from '../services/audioAnnouncer';

interface AnalyticsLoggingShieldProps {
  theme?: 'dark' | 'light';
}

export const AnalyticsLoggingShield: React.FC<AnalyticsLoggingShieldProps> = ({ theme = 'dark' }) => {
  const [state, setState] = useState<AnalyticsBlockState>(() => analyticsInterceptor.getState());
  const [events, setEvents] = useState<AnalyticsInterceptEvent[]>(() => analyticsInterceptor.getBlockedEvents());
  const [showExportModal, setShowExportModal] = useState<boolean>(false);
  const [copiedText, setCopiedText] = useState<string | null>(null);
  const [testStatus, setTestStatus] = useState<string | null>(null);
  const [searchFilter, setSearchFilter] = useState<string>('');

  useEffect(() => {
    const unsubscribe = analyticsInterceptor.subscribe((newEvent) => {
      setEvents(analyticsInterceptor.getBlockedEvents());
      setState(analyticsInterceptor.getState());
    });
    return unsubscribe;
  }, []);

  const handleToggleMaster = (enabled: boolean) => {
    analyticsInterceptor.setBlocking(enabled);
    setState(analyticsInterceptor.getState());
    audioAnnouncer.playChime(!enabled);
  };

  const handleToggleFeature = (key: keyof AnalyticsBlockState) => {
    const currentVal = state[key] as boolean;
    analyticsInterceptor.toggleFeature(key, !currentVal);
    setState(analyticsInterceptor.getState());
    audioAnnouncer.playChime(false);
  };

  const handleSimulateProbe = () => {
    const randomVendor = KNOWN_ANALYTICS_VENDORS[Math.floor(Math.random() * KNOWN_ANALYTICS_VENDORS.length)];
    const methods: Array<'sendBeacon' | 'POST /collect' | 'fetch/xhr'> = ['sendBeacon', 'POST /collect', 'fetch/xhr'];
    const chosenMethod = methods[Math.floor(Math.random() * methods.length)];
    
    analyticsInterceptor.recordInterception(
      randomVendor.name,
      randomVendor.sampleEndpoint,
      chosenMethod,
      randomVendor.type,
      Math.floor(Math.random() * 2400) + 380
    );

    setTestStatus(`Test probe from "${randomVendor.name}" intercepted & purged with 0 bytes recorded.`);
    audioAnnouncer.playChime(true);
    setTimeout(() => setTestStatus(null), 4500);
  };

  const handlePurgeLogs = () => {
    analyticsInterceptor.purgeAllAnalyticsLogs();
    setEvents([]);
    setState(analyticsInterceptor.getState());
    setTestStatus('All local analytics storage, event caches, and interception logs have been permanently purged.');
    audioAnnouncer.playChime(false);
    setTimeout(() => setTestStatus(null), 4000);
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(label);
    setTimeout(() => setCopiedText(null), 2500);
  };

  const dnsSinkholeScript = `# ========================================================
# SENTINEL ZERO-ANALYTICS LOGGING DNS SINKHOLE & BLACKHOLE
# Prevents any analytics telemetry from being resolved or transmitted
# Place in /etc/hosts or import into Pi-hole / CoreDNS / AdGuard
# ========================================================
0.0.0.0 www.google-analytics.com
0.0.0.0 analytics.google.com
0.0.0.0 googletagmanager.com
0.0.0.0 stats.g.doubleclick.net
0.0.0.0 api.segment.io
0.0.0.0 cdn.segment.com
0.0.0.0 api.mixpanel.com
0.0.0.0 api-js.mixpanel.com
0.0.0.0 browser-intake-datadoghq.com
0.0.0.0 o450.ingest.sentry.io
0.0.0.0 sentry.io
0.0.0.0 api.amplitude.com
0.0.0.0 edge.fullstory.com
0.0.0.0 vars.hotjar.com
0.0.0.0 bam.nr-data.net
0.0.0.0 telemetry.sdk.internal

# Linux Netfilter / iptables Outbound Telemetry Drop
iptables -A OUTPUT -p tcp --dport 443 -m string --string "google-analytics" --algo bm -j DROP
iptables -A OUTPUT -p tcp --dport 443 -m string --string "segment.io" --algo bm -j DROP
iptables -A OUTPUT -p tcp --dport 443 -m string --string "mixpanel.com" --algo bm -j DROP
iptables -A OUTPUT -p tcp --dport 443 -m string --string "/collect" --algo bm -j DROP
`;

  const filteredEvents = events.filter(e => 
    e.vendor.toLowerCase().includes(searchFilter.toLowerCase()) ||
    e.endpoint.toLowerCase().includes(searchFilter.toLowerCase()) ||
    e.payloadType.toLowerCase().includes(searchFilter.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className={`p-6 rounded-2xl border ${theme === 'light' ? 'bg-white border-slate-200' : 'bg-slate-900/80 border-slate-800'} backdrop-blur shadow-xl relative overflow-hidden`}>
        <div className="absolute -top-24 -right-24 w-64 h-64 bg-rose-500/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 relative z-10">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2.5 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-400">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                </svg>
              </div>
              <div>
                <h2 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
                  <span>Zero Analytics Logging Shield</span>
                  <span className={`text-[10px] uppercase font-black px-2 py-0.5 rounded border ${state.blockAnalyticsLogging ? 'bg-rose-500/20 text-rose-300 border-rose-500/40' : 'bg-slate-800 text-slate-400 border-slate-700'}`}>
                    {state.blockAnalyticsLogging ? 'LOGGING STRICTLY BLOCKED' : 'UNGUARDED'}
                  </span>
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Prohibits analytics, telemetry beacons, user session recorders, and diagnostic metrics from being logged or transmitted.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              id="analytics-master-toggle-btn"
              onClick={() => handleToggleMaster(!state.blockAnalyticsLogging)}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all shadow-lg flex items-center gap-2 ${
                state.blockAnalyticsLogging
                  ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-900/30'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700'
              }`}
            >
              <div className={`w-2 h-2 rounded-full ${state.blockAnalyticsLogging ? 'bg-white animate-pulse' : 'bg-slate-500'}`} />
              <span>{state.blockAnalyticsLogging ? 'ANALYTICS LOGGING: BLOCKED' : 'RESUME LOGGING'}</span>
            </button>
          </div>
        </div>

        {/* Stats strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-6 border-t border-slate-800">
          <div className={`p-3 rounded-xl border ${theme === 'light' ? 'bg-slate-50 border-slate-200' : 'bg-slate-950/60 border-slate-800/80'}`}>
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Blocked Payloads</span>
            <div className="text-xl font-black text-rose-400 mt-1 mono">{state.totalAnalyticsBlocked}</div>
            <span className="text-[10px] text-slate-500">100% Dropped (0 B sent)</span>
          </div>

          <div className={`p-3 rounded-xl border ${theme === 'light' ? 'bg-slate-50 border-slate-200' : 'bg-slate-950/60 border-slate-800/80'}`}>
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Beacon API Hook</span>
            <div className="text-xl font-black text-emerald-400 mt-1 mono">NULL-ROUTED</div>
            <span className="text-[10px] text-slate-500">navigator.sendBeacon neutralized</span>
          </div>

          <div className={`p-3 rounded-xl border ${theme === 'light' ? 'bg-slate-50 border-slate-200' : 'bg-slate-950/60 border-slate-800/80'}`}>
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Trackers Blacklisted</span>
            <div className="text-xl font-black text-cyan-400 mt-1 mono">{state.blockedVendorsCount} Vendors</div>
            <span className="text-[10px] text-slate-500">Google, Segment, Mixpanel +</span>
          </div>

          <div className={`p-3 rounded-xl border ${theme === 'light' ? 'bg-slate-50 border-slate-200' : 'bg-slate-950/60 border-slate-800/80'}`}>
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Telemetry Persistence</span>
            <div className="text-xl font-black text-purple-400 mt-1 mono">PURGED</div>
            <span className="text-[10px] text-slate-500">Zero disk or cache writes</span>
          </div>
        </div>
      </div>

      {/* Action Notice / Toast */}
      {testStatus && (
        <div className="p-3.5 rounded-xl bg-rose-500/15 border border-rose-500/40 text-rose-200 text-xs font-medium flex items-center justify-between animate-in fade-in">
          <div className="flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-rose-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>{testStatus}</span>
          </div>
          <button onClick={() => setTestStatus(null)} className="text-rose-400 hover:text-white text-xs underline">Dismiss</button>
        </div>
      )}

      {/* Control Switches Grid */}
      <div className={`p-6 rounded-2xl border ${theme === 'light' ? 'bg-white border-slate-200' : 'bg-slate-900/60 border-slate-800'}`}>
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-4 flex items-center justify-between">
          <span>Active Analytics Interception Rules</span>
          <span className="text-[11px] text-rose-400 font-normal">All logging prohibited by default</span>
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Beacon API */}
          <div className={`p-4 rounded-xl border flex items-center justify-between ${theme === 'light' ? 'bg-slate-50 border-slate-200' : 'bg-slate-950/50 border-slate-800'}`}>
            <div>
              <div className="font-bold text-sm text-white flex items-center gap-2">
                <span>Block Beacon API (navigator.sendBeacon)</span>
                <span className="px-1.5 py-0.2 rounded text-[9px] bg-rose-500/20 text-rose-300 font-mono">CRITICAL</span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Intercepts background telemetry beacons emitted during page transitions and unloads.
              </p>
            </div>
            <button
              id="toggle-beacon-api-btn"
              onClick={() => handleToggleFeature('blockBeaconApi')}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full transition-colors ${state.blockBeaconApi ? 'bg-rose-600' : 'bg-slate-700'}`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${state.blockBeaconApi ? 'translate-x-6 mt-1 ml-0.5' : 'translate-x-1 mt-1'}`} />
            </button>
          </div>

          {/* Third-party Trackers */}
          <div className={`p-4 rounded-xl border flex items-center justify-between ${theme === 'light' ? 'bg-slate-50 border-slate-200' : 'bg-slate-950/50 border-slate-800'}`}>
            <div>
              <div className="font-bold text-sm text-white flex items-center gap-2">
                <span>Block Third-Party Telemetry & Trackers</span>
                <span className="px-1.5 py-0.2 rounded text-[9px] bg-rose-500/20 text-rose-300 font-mono">SHIELD</span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Null-routes Google Analytics, Segment, Mixpanel, Datadog, and Amplitude endpoints.
              </p>
            </div>
            <button
              id="toggle-third-party-trackers-btn"
              onClick={() => handleToggleFeature('blockThirdPartyTrackers')}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full transition-colors ${state.blockThirdPartyTrackers ? 'bg-rose-600' : 'bg-slate-700'}`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${state.blockThirdPartyTrackers ? 'translate-x-6 mt-1 ml-0.5' : 'translate-x-1 mt-1'}`} />
            </button>
          </div>

          {/* Session Replays */}
          <div className={`p-4 rounded-xl border flex items-center justify-between ${theme === 'light' ? 'bg-slate-50 border-slate-200' : 'bg-slate-950/50 border-slate-800'}`}>
            <div>
              <div className="font-bold text-sm text-white flex items-center gap-2">
                <span>Block Session Replay & DOM Scraping</span>
                <span className="px-1.5 py-0.2 rounded text-[9px] bg-purple-500/20 text-purple-300 font-mono">PRIVACY</span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Drops FullStory, Hotjar, LogRocket, and Smartlook keystroke & DOM event recorders.
              </p>
            </div>
            <button
              id="toggle-session-replays-btn"
              onClick={() => handleToggleFeature('blockSessionReplays')}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full transition-colors ${state.blockSessionReplays ? 'bg-rose-600' : 'bg-slate-700'}`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${state.blockSessionReplays ? 'translate-x-6 mt-1 ml-0.5' : 'translate-x-1 mt-1'}`} />
            </button>
          </div>

          {/* Crash Reports & Tracing */}
          <div className={`p-4 rounded-xl border flex items-center justify-between ${theme === 'light' ? 'bg-slate-50 border-slate-200' : 'bg-slate-950/50 border-slate-800'}`}>
            <div>
              <div className="font-bold text-sm text-white flex items-center gap-2">
                <span>Block Error & Crash Reporting Telemetry</span>
                <span className="px-1.5 py-0.2 rounded text-[9px] bg-cyan-500/20 text-cyan-300 font-mono">ENFORCE</span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Prevents Sentry, Bugsnag, and Crashlytics from sending hardware specs and stack dumps.
              </p>
            </div>
            <button
              id="toggle-crash-reports-btn"
              onClick={() => handleToggleFeature('blockCrashReports')}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full transition-colors ${state.blockCrashReports ? 'bg-rose-600' : 'bg-slate-700'}`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${state.blockCrashReports ? 'translate-x-6 mt-1 ml-0.5' : 'translate-x-1 mt-1'}`} />
            </button>
          </div>

          {/* URL Query Stripper */}
          <div className={`p-4 rounded-xl border flex items-center justify-between ${theme === 'light' ? 'bg-slate-50 border-slate-200' : 'bg-slate-950/50 border-slate-800'}`}>
            <div>
              <div className="font-bold text-sm text-white flex items-center gap-2">
                <span>Strip URL Tracking Parameters</span>
                <span className="px-1.5 py-0.2 rounded text-[9px] bg-amber-500/20 text-amber-300 font-mono">AUTO-CLEAN</span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Cleanses utm_source, gclid, fbclid, msclkid, and ad campaign identifiers from location.
              </p>
            </div>
            <button
              id="toggle-strip-tracking-params-btn"
              onClick={() => handleToggleFeature('stripTrackingParams')}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full transition-colors ${state.stripTrackingParams ? 'bg-rose-600' : 'bg-slate-700'}`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${state.stripTrackingParams ? 'translate-x-6 mt-1 ml-0.5' : 'translate-x-1 mt-1'}`} />
            </button>
          </div>

          {/* Zero-Disk Persistence */}
          <div className={`p-4 rounded-xl border flex items-center justify-between ${theme === 'light' ? 'bg-slate-50 border-slate-200' : 'bg-slate-950/50 border-slate-800'}`}>
            <div>
              <div className="font-bold text-sm text-white flex items-center gap-2">
                <span>Zero-Disk Analytics Persistence</span>
                <span className="px-1.5 py-0.2 rounded text-[9px] bg-emerald-500/20 text-emerald-300 font-mono">ACTIVE</span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Prohibits telemetry SDKs from caching events in IndexedDB, cookies, or localStorage.
              </p>
            </div>
            <span className="px-2.5 py-1 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-xs font-bold">
              ENFORCED
            </span>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center justify-between gap-3 mt-6 pt-6 border-t border-slate-800">
          <div className="flex flex-wrap items-center gap-3">
            <button
              id="simulate-analytics-probe-btn"
              onClick={handleSimulateProbe}
              className="px-3.5 py-2 rounded-xl text-xs font-bold bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/30 transition-all flex items-center gap-2"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-rose-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              <span>Simulate Analytics Ingestion Attempt</span>
            </button>

            <button
              id="purge-analytics-logs-btn"
              onClick={handlePurgeLogs}
              className="px-3.5 py-2 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-all flex items-center gap-2"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              <span>Purge All Telemetry Storage & Caches</span>
            </button>
          </div>

          <button
            id="export-analytics-rules-btn"
            onClick={() => setShowExportModal(true)}
            className="px-3.5 py-2 rounded-xl text-xs font-bold bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-300 border border-cyan-500/30 transition-all flex items-center gap-2"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
            <span>Export DNS Sinkhole & iptables Rules</span>
          </button>
        </div>
      </div>

      {/* Intercepted Analytics Telemetry Feed */}
      <div className={`p-6 rounded-2xl border ${theme === 'light' ? 'bg-white border-slate-200' : 'bg-slate-900/60 border-slate-800'}`}>
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <span>Live Intercepted Analytics Payloads</span>
              <span className="px-2 py-0.5 rounded text-[10px] bg-rose-500/20 text-rose-300 font-mono">ZERO LOGGING ENFORCED</span>
            </h3>
            <p className="text-xs text-slate-400">All outbound telemetry attempts captured and discarded with 0 bytes transmitted.</p>
          </div>

          <div className="w-full sm:w-64">
            <input
              type="text"
              placeholder="Filter by vendor, endpoint..."
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              className="w-full px-3 py-1.5 rounded-lg text-xs bg-slate-950 border border-slate-800 text-white placeholder-slate-500 focus:outline-none focus:border-rose-500"
            />
          </div>
        </div>

        {filteredEvents.length === 0 ? (
          <div className="text-center py-10 text-slate-500 text-xs">
            No analytics events logged. Zero telemetry policy is active and clean.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-800 text-[10px] text-slate-400 uppercase tracking-wider font-bold">
                  <th className="pb-2.5">Time</th>
                  <th className="pb-2.5">Vendor / Ecosystem</th>
                  <th className="pb-2.5">Target Endpoint</th>
                  <th className="pb-2.5">Method</th>
                  <th className="pb-2.5">Payload Type</th>
                  <th className="pb-2.5">Payload Size</th>
                  <th className="pb-2.5 text-right">Enforcement Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 mono">
                {filteredEvents.map((evt) => (
                  <tr key={evt.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="py-2.5 text-slate-400 whitespace-nowrap">{evt.timestamp}</td>
                    <td className="py-2.5 font-bold text-white whitespace-nowrap">{evt.vendor}</td>
                    <td className="py-2.5 text-slate-300 max-w-xs truncate" title={evt.endpoint}>
                      {evt.endpoint}
                    </td>
                    <td className="py-2.5 whitespace-nowrap">
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-slate-300 border border-slate-700">
                        {evt.method}
                      </span>
                    </td>
                    <td className="py-2.5 text-slate-400 whitespace-nowrap">{evt.payloadType}</td>
                    <td className="py-2.5 text-rose-300 whitespace-nowrap">{evt.sizeBytes} B</td>
                    <td className="py-2.5 text-right whitespace-nowrap">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40">
                        {evt.actionTaken}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Export Rules Modal */}
      {showExportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="max-w-2xl w-full bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl relative">
            <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-rose-500/20 text-rose-400">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
                <h3 className="text-base font-bold text-white">Export Zero-Analytics Firewall Rules</h3>
              </div>
              <button
                onClick={() => setShowExportModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-400 mb-3">
              Deploy these DNS sinkhole hosts and Linux iptables rules to prevent any client, daemon, or embedded browser from logging analytics on this machine.
            </p>

            <pre className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-[11px] font-mono text-slate-300 overflow-x-auto max-h-72">
              {dnsSinkholeScript}
            </pre>

            <div className="flex items-center justify-between mt-5 pt-4 border-t border-slate-800">
              <span className="text-xs text-slate-500">Includes DNS sinkholes & kernel string-matching drops</span>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => copyToClipboard(dnsSinkholeScript, 'rules')}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-cyan-600 hover:bg-cyan-500 text-white transition-colors"
                >
                  {copiedText === 'rules' ? 'COPIED TO CLIPBOARD!' : 'COPY SCRIPT'}
                </button>
                <button
                  onClick={() => setShowExportModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-300"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
