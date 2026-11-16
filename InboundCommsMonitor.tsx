import React, { useEffect, useMemo, useState } from 'react';
import { CommTrustStatus, InboundCommunicationEvent } from '../types';
import { inboundCommsService, InboundCommsSnapshot } from '../services/inboundCommsService';
import { triggerBlobDownload } from '../services/apkPackager';

interface InboundCommsMonitorProps {
  theme?: 'dark' | 'light';
  stealthMode?: boolean;
}

type CommsFilterTab = 'ALL' | 'CALLS' | 'MESSAGES' | 'FLAGGED';

export const InboundCommsMonitor: React.FC<InboundCommsMonitorProps> = ({
  theme = 'dark',
  stealthMode = false,
}) => {
  const isLight = theme === 'light';
  const [snapshot, setSnapshot] = useState<InboundCommsSnapshot>(() =>
    inboundCommsService.getSnapshot()
  );
  const [activeFilter, setActiveFilter] = useState<CommsFilterTab>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [exportNote, setExportNote] = useState<string | null>(null);

  useEffect(() => {
    const unsub = inboundCommsService.subscribe(setSnapshot);
    return () => unsub();
  }, []);

  const filteredEvents = useMemo(() => {
    return snapshot.events.filter(ev => {
      if (activeFilter === 'CALLS' && ev.channel !== 'CALL' && ev.channel !== 'VOIP') {
        return false;
      }
      if (activeFilter === 'MESSAGES' && ev.channel !== 'SMS' && ev.channel !== 'RCS') {
        return false;
      }
      if (
        activeFilter === 'FLAGGED' &&
        ev.status !== 'BLOCKED' &&
        ev.status !== 'SUSPICIOUS'
      ) {
        return false;
      }

      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        ev.senderName.toLowerCase().includes(q) ||
        ev.phoneNumber.toLowerCase().includes(q) ||
        ev.previewText.toLowerCase().includes(q) ||
        ev.carrierOrOrigin.toLowerCase().includes(q)
      );
    });
  }, [snapshot.events, activeFilter, searchQuery]);

  const counts = useMemo(() => {
    const calls = snapshot.events.filter(
      e => e.channel === 'CALL' || e.channel === 'VOIP'
    ).length;
    const messages = snapshot.events.filter(
      e => e.channel === 'SMS' || e.channel === 'RCS'
    ).length;
    const flagged = snapshot.events.filter(
      e => e.status === 'BLOCKED' || e.status === 'SUSPICIOUS'
    ).length;
    return { total: snapshot.events.length, calls, messages, flagged };
  }, [snapshot.events]);

  const handleExportLog = () => {
    const payload = {
      exportedAt: new Date().toISOString(),
      policy: {
        autoBlockSpamCalls: snapshot.autoBlockSpamCalls,
        autoQuarantinePhishingSms: snapshot.autoQuarantinePhishingSms,
      },
      blockedNumbers: snapshot.blockedNumbers,
      events: filteredEvents,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json',
    });
    triggerBlobDownload(blob, `sentinel-calls-messages-${Date.now()}.json`);
    setExportNote(`Exported ${filteredEvents.length} call & message records.`);
    setTimeout(() => setExportNote(null), 3500);
  };

  const getStatusBadgeClasses = (status: CommTrustStatus) => {
    switch (status) {
      case 'BLOCKED':
        return 'bg-rose-500/15 text-rose-400 border-rose-500/30';
      case 'SUSPICIOUS':
        return 'bg-amber-500/15 text-amber-400 border-amber-500/30';
      case 'SCREENED':
        return 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30';
      default:
        return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';
    }
  };

  const formatDuration = (sec?: number) => {
    if (!sec || sec <= 0) return '00:00';
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const maskPhone = (num: string) => {
    if (!stealthMode) return num;
    return num.replace(/\d(?=\d{2})/g, '*');
  };

  const cardBase = isLight
    ? 'bg-white border-slate-200 text-slate-900'
    : 'bg-slate-900/60 border-slate-800 text-slate-100';

  return (
    <div className="space-y-6">
      {/* Summary Metrics Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className={`rounded-2xl border p-4 ${cardBase}`}>
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Incoming Calls
          </span>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono tabular-nums text-cyan-400">
              {snapshot.totalCallsReceived}
            </span>
            <span className="text-xs text-slate-500">VoLTE / VoIP</span>
          </div>
        </div>

        <div className={`rounded-2xl border p-4 ${cardBase}`}>
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Incoming Messages
          </span>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono tabular-nums text-emerald-400">
              {snapshot.totalMessagesReceived}
            </span>
            <span className="text-xs text-slate-500">SMS / RCS</span>
          </div>
        </div>

        <div className={`rounded-2xl border p-4 ${cardBase}`}>
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Flagged & Blocked
          </span>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono tabular-nums text-rose-400">
              {counts.flagged}
            </span>
            <span className="text-xs text-slate-500">Spam / Phishing</span>
          </div>
        </div>

        <div className={`rounded-2xl border p-4 ${cardBase}`}>
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Blocked Numbers
          </span>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono tabular-nums">
              {snapshot.blockedNumbers.length}
            </span>
            <span className="text-xs text-slate-500">Active Rules</span>
          </div>
        </div>
      </div>

      {/* Screening Controls & Actions Bar */}
      <div className={`rounded-2xl border p-5 space-y-4 ${cardBase}`}>
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h3 className="text-base font-bold tracking-tight">
              Incoming Messages & Phone Calls
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Unified call screening (STIR/SHAKEN) and SMS/RCS phishing inspection log for your paired phone.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => inboundCommsService.simulateIncoming('CALL')}
              className="min-h-[44px] px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold transition-colors whitespace-nowrap shrink-0"
            >
              Simulate Call
            </button>
            <button
              type="button"
              onClick={() => inboundCommsService.simulateIncoming('MESSAGE')}
              className={`min-h-[44px] px-4 py-2 rounded-xl border text-xs font-bold transition-colors whitespace-nowrap shrink-0 ${
                isLight
                  ? 'border-slate-300 bg-slate-50 hover:bg-slate-100 text-slate-800'
                  : 'border-slate-700 bg-slate-800/80 hover:bg-slate-800 text-slate-100'
              }`}
            >
              Simulate Message
            </button>
            <button
              type="button"
              onClick={handleExportLog}
              className={`min-h-[44px] px-4 py-2 rounded-xl border text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                isLight
                  ? 'border-slate-300 text-slate-700 hover:bg-slate-100'
                  : 'border-slate-700 text-slate-300 hover:bg-slate-800'
              }`}
            >
              Export JSON
            </button>
          </div>
        </div>

        {/* Protection Switches */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2 border-t border-slate-200 dark:border-slate-800">
          <button
            type="button"
            onClick={() => inboundCommsService.toggleSetting('liveStreamEnabled')}
            className={`min-h-[44px] px-3.5 py-2 rounded-xl border text-left flex items-center justify-between text-xs font-semibold transition-colors ${
              snapshot.liveStreamEnabled
                ? 'border-cyan-500/40 bg-cyan-500/10 text-cyan-400'
                : 'border-slate-300 dark:border-slate-700 text-slate-500'
            }`}
          >
            <span>Live Comms Stream</span>
            <span>{snapshot.liveStreamEnabled ? 'ON' : 'PAUSED'}</span>
          </button>

          <button
            type="button"
            onClick={() => inboundCommsService.toggleSetting('autoBlockSpamCalls')}
            className={`min-h-[44px] px-3.5 py-2 rounded-xl border text-left flex items-center justify-between text-xs font-semibold transition-colors ${
              snapshot.autoBlockSpamCalls
                ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400'
                : 'border-slate-300 dark:border-slate-700 text-slate-500'
            }`}
          >
            <span>Auto-Block Spam Calls</span>
            <span>{snapshot.autoBlockSpamCalls ? 'ACTIVE' : 'OFF'}</span>
          </button>

          <button
            type="button"
            onClick={() => inboundCommsService.toggleSetting('autoQuarantinePhishingSms')}
            className={`min-h-[44px] px-3.5 py-2 rounded-xl border text-left flex items-center justify-between text-xs font-semibold transition-colors ${
              snapshot.autoQuarantinePhishingSms
                ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400'
                : 'border-slate-300 dark:border-slate-700 text-slate-500'
            }`}
          >
            <span>SMS Phishing Filter</span>
            <span>{snapshot.autoQuarantinePhishingSms ? 'ACTIVE' : 'OFF'}</span>
          </button>

          <button
            type="button"
            onClick={() => inboundCommsService.toggleSetting('voiceAlertOnSuspicious')}
            className={`min-h-[44px] px-3.5 py-2 rounded-xl border text-left flex items-center justify-between text-xs font-semibold transition-colors ${
              snapshot.voiceAlertOnSuspicious
                ? 'border-amber-500/40 bg-amber-500/10 text-amber-400'
                : 'border-slate-300 dark:border-slate-700 text-slate-500'
            }`}
          >
            <span>Chime on Spam Alert</span>
            <span>{snapshot.voiceAlertOnSuspicious ? 'ON' : 'MUTED'}</span>
          </button>
        </div>

        {exportNote && (
          <div className="text-xs font-medium text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 rounded-lg px-3 py-2">
            {exportNote}
          </div>
        )}

        {/* Filter Tabs + Search */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pt-2">
          <div className="flex flex-wrap items-center gap-1.5">
            {(
              [
                { id: 'ALL', label: `All (${counts.total})` },
                { id: 'CALLS', label: `Phone Calls (${counts.calls})` },
                { id: 'MESSAGES', label: `Messages (${counts.messages})` },
                { id: 'FLAGGED', label: `Flagged (${counts.flagged})` },
              ] as const
            ).map(tab => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveFilter(tab.id)}
                className={`min-h-[40px] px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                  activeFilter === tab.id
                    ? 'bg-cyan-600 text-white'
                    : isLight
                    ? 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search caller, number, message..."
              className={`min-h-[40px] w-full md:w-64 rounded-xl border px-3.5 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-cyan-500 ${
                isLight
                  ? 'bg-slate-50 border-slate-300 text-slate-900 placeholder:text-slate-400'
                  : 'bg-slate-950/70 border-slate-700 text-slate-100 placeholder:text-slate-500'
              }`}
            />
            {snapshot.events.length > 0 && (
              <button
                type="button"
                onClick={() => inboundCommsService.clearHistory()}
                className="min-h-[40px] px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-medium text-slate-500 hover:text-rose-400 whitespace-nowrap shrink-0"
              >
                Clear
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Inbound Call & Message Feed */}
      <div className={`rounded-2xl border overflow-hidden ${cardBase}`}>
        {filteredEvents.length === 0 ? (
          <div className="p-10 text-center space-y-3">
            <p className="text-sm font-semibold">No matching incoming calls or messages</p>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              Adjust your filter or search query, simulate a new incoming call or SMS, or restore the sample call and message stream.
            </p>
            <div className="flex items-center justify-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  setActiveFilter('ALL');
                  setSearchQuery('');
                  inboundCommsService.restoreBaseline();
                }}
                className="min-h-[44px] px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold"
              >
                Load Recent Call & Message Feed
              </button>
            </div>
          </div>
        ) : (
          <div className="divide-y divide-slate-200 dark:divide-slate-800">
            {filteredEvents.map((ev: InboundCommunicationEvent) => {
              const isCall = ev.channel === 'CALL' || ev.channel === 'VOIP';
              const isExpanded = expandedId === ev.id;

              return (
                <div key={ev.id} className="p-4 sm:p-5 transition-colors hover:bg-slate-500/5">
                  <div className="flex flex-col md:flex-row md:items-start justify-between gap-3">
                    <div className="flex items-start gap-3.5 min-w-0">
                      {/* Channel Icon */}
                      <div
                        className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${
                          ev.status === 'BLOCKED'
                            ? 'bg-rose-500/10 border-rose-500/30 text-rose-400'
                            : ev.status === 'SUSPICIOUS'
                            ? 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                            : isCall
                            ? 'bg-cyan-500/10 border-cyan-500/30 text-cyan-400'
                            : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                        }`}
                      >
                        {isCall ? (
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                          </svg>
                        ) : (
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                          </svg>
                        )}
                      </div>

                      {/* Sender & Content */}
                      <div className="min-w-0 space-y-1" data-sensitive-data="true">
                        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                          <span className="text-sm font-bold truncate">
                            {stealthMode ? 'REDACTED CONTACT' : ev.senderName}
                          </span>
                          <span className="text-xs font-mono tabular-nums text-slate-400">
                            {maskPhone(ev.phoneNumber)}
                          </span>
                          <span
                            className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded border ${getStatusBadgeClasses(
                              ev.status
                            )}`}
                          >
                            {ev.status}
                          </span>
                        </div>

                        <div className="flex flex-wrap items-center gap-x-2 text-xs text-slate-500">
                          <span className="font-mono font-semibold text-cyan-400">
                            {ev.channel}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span>{ev.carrierOrOrigin}</span>
                          <span aria-hidden="true">·</span>
                          <span className="font-mono tabular-nums">{ev.timestamp}</span>
                          {isCall && ev.callState && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span className="font-mono">
                                {ev.callState.replace(/_/g, ' ')}
                                {ev.durationSec ? ` (${formatDuration(ev.durationSec)})` : ''}
                              </span>
                            </>
                          )}
                        </div>

                        <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed pt-0.5">
                          {ev.previewText}
                        </p>

                        {ev.threatReason && (
                          <p className="text-xs text-rose-400 font-medium">
                            Alert Reason: {ev.threatReason}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Row Actions */}
                    <div className="flex flex-wrap items-center gap-2 shrink-0 self-start">
                      <button
                        type="button"
                        onClick={() => setExpandedId(isExpanded ? null : ev.id)}
                        className={`min-h-[40px] px-3 py-1.5 rounded-lg border text-xs font-semibold transition-colors whitespace-nowrap ${
                          isLight
                            ? 'border-slate-300 text-slate-700 hover:bg-slate-100'
                            : 'border-slate-700 text-slate-300 hover:bg-slate-800'
                        }`}
                      >
                        {isExpanded ? 'Hide Details' : 'Inspect'}
                      </button>

                      {ev.status !== 'BLOCKED' ? (
                        <button
                          type="button"
                          onClick={() => inboundCommsService.blockSender(ev.id)}
                          className="min-h-[40px] px-3 py-1.5 rounded-lg bg-rose-600/15 hover:bg-rose-600/25 border border-rose-500/30 text-rose-400 text-xs font-bold transition-colors whitespace-nowrap"
                        >
                          Block Number
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => inboundCommsService.markVerified(ev.id)}
                          className="min-h-[40px] px-3 py-1.5 rounded-lg bg-emerald-600/15 hover:bg-emerald-600/25 border border-emerald-500/30 text-emerald-400 text-xs font-bold transition-colors whitespace-nowrap"
                        >
                          Allow Sender
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Expanded Telemetry Panel */}
                  {isExpanded && (
                    <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-800 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                      <div>
                        <span className="text-slate-500 block">Phishing / Spam Score</span>
                        <span
                          className={`font-mono font-bold tabular-nums ${
                            ev.phishingScore >= 75
                              ? 'text-rose-400'
                              : ev.phishingScore >= 40
                              ? 'text-amber-400'
                              : 'text-emerald-400'
                          }`}
                        >
                          {ev.phishingScore} / 100
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-500 block">
                          {isCall ? 'STIR/SHAKEN Attestation' : 'Link & Payload Scan'}
                        </span>
                        <span className="font-mono font-semibold">
                          {isCall
                            ? ev.stirShakenAttestation || 'Unverified'
                            : ev.phishingScore >= 50
                            ? 'Suspicious URL Flagged'
                            : 'Clean Text / Verified Header'}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-500 block">Event ID</span>
                        <span className="font-mono text-slate-400">{ev.id}</span>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Browser Sandboxing Note */}
      <p className="text-xs text-slate-500 leading-relaxed">
        Note: Web browsers isolate carrier telephony and SMS databases for privacy. Install Sentinel on your Android device via the APK & Offline Install tab to connect live Android CallScreeningService and NotificationListener bridges.
      </p>
    </div>
  );
};

export default InboundCommsMonitor;
