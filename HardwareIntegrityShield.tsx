import React, { useEffect, useMemo, useState } from 'react';
import {
  HardwareIntegrityState,
  HardwarePeripheralEvent,
  HardwarePortType,
} from '../types';
import { hardwareIntegrityService } from '../services/hardwareIntegrityService';
import { triggerBlobDownload } from '../services/apkPackager';

interface HardwareIntegrityShieldProps {
  theme?: 'dark' | 'light';
  stealthMode?: boolean;
}

type HardwareFilterTab = 'ALL' | 'KILL_SWITCH' | 'USB_OTG' | 'AUDIO_JACK' | 'TRUSTED';

export const HardwareIntegrityShield: React.FC<HardwareIntegrityShieldProps> = ({
  theme = 'dark',
  stealthMode = false,
}) => {
  const isLight = theme === 'light';
  const [state, setState] = useState<HardwareIntegrityState>(() =>
    hardwareIntegrityService.getSnapshot()
  );
  const [filterTab, setFilterTab] = useState<HardwareFilterTab>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [isProbing, setIsProbing] = useState(false);

  useEffect(() => {
    const unsub = hardwareIntegrityService.subscribe(setState);
    return () => unsub();
  }, []);

  const filteredEvents = useMemo(() => {
    return state.events.filter(ev => {
      if (
        filterTab === 'KILL_SWITCH' &&
        ev.actionTaken !== 'KILL_SWITCH_TRIPPED' &&
        ev.actionTaken !== 'DATA_LINES_SEVERED'
      ) {
        return false;
      }
      if (
        filterTab === 'USB_OTG' &&
        ev.portType !== 'USB_OTG' &&
        ev.portType !== 'USB_C_HID'
      ) {
        return false;
      }
      if (filterTab === 'AUDIO_JACK' && ev.portType !== 'AUDIO_JACK_TRRS') {
        return false;
      }
      if (filterTab === 'TRUSTED' && ev.riskLevel !== 'TRUSTED') {
        return false;
      }

      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        ev.deviceName.toLowerCase().includes(q) ||
        ev.vendorProductId.toLowerCase().includes(q) ||
        ev.anomalySignature.toLowerCase().includes(q) ||
        ev.busPath.toLowerCase().includes(q)
      );
    });
  }, [state.events, filterTab, searchQuery]);

  const handleProbeHardware = async () => {
    setIsProbing(true);
    await hardwareIntegrityService.probeBrowserHardwareBuses();
    setTimeout(() => setIsProbing(false), 450);
  };

  const handleExportForensics = () => {
    const payload = {
      exportedAt: new Date().toISOString(),
      killSwitchTripped: state.killSwitchTripped,
      guards: {
        usbOtgDataLock: state.usbOtgDataLock,
        audioJackSniffGuard: state.audioJackSniffGuard,
        hidInjectionGuard: state.hidInjectionGuard,
        thunderboltDmaLock: state.thunderboltDmaLock,
        autoKillSwitchOnThreat: state.autoKillSwitchOnThreat,
      },
      events: state.events,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json',
    });
    triggerBlobDownload(blob, `sentinel-hardware-integrity-${Date.now()}.json`);
  };

  const formatPortLabel = (port: HardwarePortType) => {
    switch (port) {
      case 'USB_OTG':
        return 'USB OTG';
      case 'AUDIO_JACK_TRRS':
        return '3.5mm Audio / TRRS';
      case 'USB_C_HID':
        return 'USB-C HID';
      case 'THUNDERBOLT_DMA':
        return 'Thunderbolt DMA';
      case 'SD_CARD_BUS':
        return 'SD Bus';
    }
  };

  const cardBase = isLight
    ? 'bg-white border-slate-200 text-slate-900'
    : 'bg-slate-900/60 border-slate-800 text-slate-100';

  return (
    <div className="space-y-6">
      {/* Master Kill-Switch Status Banner */}
      <div
        className={`rounded-2xl border p-6 transition-colors ${
          state.killSwitchTripped
            ? 'border-rose-500 bg-rose-950/40 text-rose-100'
            : isLight
            ? 'border-slate-200 bg-white text-slate-900'
            : 'border-slate-800 bg-slate-900/60 text-slate-100'
        }`}
      >
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2.5">
              <span
                className={`px-2.5 py-1 rounded-lg text-[11px] font-mono font-bold uppercase border ${
                  state.killSwitchTripped
                    ? 'bg-rose-500 text-white border-rose-400'
                    : 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                }`}
              >
                {state.killSwitchTripped
                  ? 'KILL-SWITCH ENGAGED — DATA BUSES SEVERED'
                  : 'HARDWARE BUS MONITOR ARMED'}
              </span>
              <span className="text-xs font-mono tabular-nums text-slate-400">
                Trips: {state.totalKillSwitchTrips} · Blocked Probes:{' '}
                {state.totalUnauthorizedProbesBlocked}
              </span>
            </div>

            <h3 className="text-xl font-bold tracking-tight">
              Hardware Integrity & Peripheral Kill-Switch
            </h3>
            <p className="text-xs sm:text-sm text-slate-400 max-w-2xl leading-relaxed">
              {state.killSwitchTripped
                ? `Emergency isolation active (${state.lastTripTimestamp}): ${state.lastTripReason}. USB OTG data pins, TRRS headphone microphone capture, and HID enumeration are locked in power-only mode.`
                : 'Monitors USB OTG host role-swaps, 3.5mm/USB-C headphone jack ultrasonic data-sniffing, and BadUSB HID injection—tripping an immediate hardware data-bus kill-switch on unauthorized attachment.'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            {state.killSwitchTripped ? (
              <button
                type="button"
                onClick={() => hardwareIntegrityService.resetKillSwitch()}
                className="min-h-[44px] px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-colors whitespace-nowrap"
              >
                Reset & Re-Arm Bus
              </button>
            ) : (
              <button
                type="button"
                onClick={() =>
                  hardwareIntegrityService.triggerManualKillSwitch(
                    'Operator triggered immediate hardware peripheral kill-switch'
                  )
                }
                className="min-h-[44px] px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition-colors whitespace-nowrap"
              >
                Trigger Immediate Kill-Switch
              </button>
            )}

            <button
              type="button"
              onClick={handleProbeHardware}
              disabled={isProbing}
              className={`min-h-[44px] px-4 py-2.5 rounded-xl border text-xs font-semibold transition-colors whitespace-nowrap ${
                isLight
                  ? 'border-slate-300 bg-slate-50 hover:bg-slate-100 text-slate-800'
                  : 'border-slate-700 bg-slate-800/80 hover:bg-slate-800 text-slate-200'
              }`}
            >
              {isProbing ? 'Probing Buses...' : 'Probe Live Hardware'}
            </button>
          </div>
        </div>

        <div className="mt-4 pt-3 border-t border-slate-700/40 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-slate-400">
          <span className="font-mono">{state.lastBusProbeSummary}</span>
          <button
            type="button"
            onClick={handleExportForensics}
            className="text-cyan-400 hover:text-cyan-300 font-semibold self-start sm:self-auto whitespace-nowrap"
          >
            Export Bus Forensics (JSON)
          </button>
        </div>
      </div>

      {/* Bus Protection Switches */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            key: 'usbOtgDataLock' as const,
            title: 'USB OTG Data Lock',
            desc: 'Force charge-only pins; drop OTG host, ADB, and MTP mounts.',
            active: state.usbOtgDataLock,
          },
          {
            key: 'audioJackSniffGuard' as const,
            title: 'Audio Jack Sniff Guard',
            desc: 'Block 3.5mm TRRS mic-bias tampering & ultrasonic data capture.',
            active: state.audioJackSniffGuard,
          },
          {
            key: 'hidInjectionGuard' as const,
            title: 'BadUSB HID Blocker',
            desc: 'Reject high-rate spoofed keyboard/mouse HID descriptors.',
            active: state.hidInjectionGuard,
          },
          {
            key: 'autoKillSwitchOnThreat' as const,
            title: 'Auto-Trip Kill-Switch',
            desc: 'Immediately sever all data buses on unauthorized peripheral probe.',
            active: state.autoKillSwitchOnThreat,
          },
        ].map(item => (
          <button
            key={item.key}
            type="button"
            onClick={() => hardwareIntegrityService.toggleGuard(item.key)}
            className={`rounded-2xl border p-4 text-left transition-colors flex flex-col justify-between gap-3 ${
              item.active
                ? isLight
                  ? 'bg-cyan-50/70 border-cyan-500/40 text-slate-900'
                  : 'bg-cyan-950/20 border-cyan-500/40 text-slate-100'
                : cardBase
            }`}
          >
            <div className="flex items-center justify-between gap-2 w-full">
              <span className="text-sm font-bold">{item.title}</span>
              <span
                className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border ${
                  item.active
                    ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400'
                    : 'bg-slate-500/15 border-slate-500/30 text-slate-400'
                }`}
              >
                {item.active ? 'ENFORCED' : 'BYPASSED'}
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              {item.desc}
            </p>
          </button>
        ))}
      </div>

      {/* Simulation & Verification Controls */}
      <div className={`rounded-2xl border p-5 space-y-3 ${cardBase}`}>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <h4 className="text-sm font-bold">Test Peripheral Intrusion & Kill-Switch Response</h4>
            <p className="text-xs text-slate-500">
              Simulate unexpected physical bus attachments to verify automatic kill-switch isolation and voice alerting.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => hardwareIntegrityService.simulatePeripheralEvent('usb_otg')}
              className="min-h-[40px] px-3.5 py-2 rounded-xl bg-rose-600/15 hover:bg-rose-600/25 border border-rose-500/30 text-rose-400 text-xs font-bold transition-colors whitespace-nowrap"
            >
              Simulate USB OTG Attack
            </button>
            <button
              type="button"
              onClick={() => hardwareIntegrityService.simulatePeripheralEvent('audio_jack_sniff')}
              className="min-h-[40px] px-3.5 py-2 rounded-xl bg-rose-600/15 hover:bg-rose-600/25 border border-rose-500/30 text-rose-400 text-xs font-bold transition-colors whitespace-nowrap"
            >
              Simulate Audio-Jack Sniffing
            </button>
            <button
              type="button"
              onClick={() => hardwareIntegrityService.simulatePeripheralEvent('bad_usb_hid')}
              className="min-h-[40px] px-3.5 py-2 rounded-xl bg-amber-600/15 hover:bg-amber-600/25 border border-amber-500/30 text-amber-400 text-xs font-bold transition-colors whitespace-nowrap"
            >
              Simulate BadUSB HID
            </button>
            <button
              type="button"
              onClick={() => hardwareIntegrityService.simulatePeripheralEvent('authorized_charger')}
              className="min-h-[40px] px-3.5 py-2 rounded-xl bg-emerald-600/15 hover:bg-emerald-600/25 border border-emerald-500/30 text-emerald-400 text-xs font-bold transition-colors whitespace-nowrap"
            >
              Test Power-Only Charger
            </button>
          </div>
        </div>
      </div>

      {/* Peripheral Event Log */}
      <div className={`rounded-2xl border overflow-hidden ${cardBase}`}>
        <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1.5">
            {(
              [
                { id: 'ALL', label: `All Events (${state.events.length})` },
                { id: 'KILL_SWITCH', label: 'Kill-Switch Trips' },
                { id: 'USB_OTG', label: 'USB / OTG / HID' },
                { id: 'AUDIO_JACK', label: 'Audio Jack' },
                { id: 'TRUSTED', label: 'Power-Only / Trusted' },
              ] as const
            ).map(tab => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setFilterTab(tab.id)}
                className={`min-h-[38px] px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
                  filterTab === tab.id
                    ? 'bg-cyan-600 text-white'
                    : isLight
                    ? 'bg-slate-100 text-slate-700'
                    : 'bg-slate-800 text-slate-300'
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
              placeholder="Search device, VID:PID, bus..."
              className={`min-h-[38px] w-full sm:w-60 rounded-xl border px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-cyan-500 ${
                isLight
                  ? 'bg-slate-50 border-slate-300 text-slate-900 placeholder:text-slate-400'
                  : 'bg-slate-950/70 border-slate-700 text-slate-100 placeholder:text-slate-500'
              }`}
            />
            {state.events.length > 0 && (
              <button
                type="button"
                onClick={() => hardwareIntegrityService.clearEvents()}
                className="min-h-[38px] px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-medium text-slate-500 hover:text-rose-400 whitespace-nowrap"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {filteredEvents.length === 0 ? (
          <div className="p-10 text-center space-y-3">
            <p className="text-sm font-semibold">No peripheral events match the active filter</p>
            <button
              type="button"
              onClick={() => {
                setFilterTab('ALL');
                setSearchQuery('');
                hardwareIntegrityService.restoreBaselineEvents();
              }}
              className="min-h-[42px] px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold"
            >
              Restore Peripheral Event Log
            </button>
          </div>
        ) : (
          <div className="divide-y divide-slate-200 dark:divide-slate-800">
            {filteredEvents.map((ev: HardwarePeripheralEvent) => (
              <div
                key={ev.id}
                className="p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4"
              >
                <div className="space-y-1.5 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-bold">
                      {stealthMode ? 'REDACTED PERIPHERAL' : ev.deviceName}
                    </span>
                    <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded border border-cyan-500/30 bg-cyan-500/10 text-cyan-400">
                      {formatPortLabel(ev.portType)}
                    </span>
                    <span
                      className={`text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded border ${
                        ev.riskLevel === 'CRITICAL'
                          ? 'bg-rose-500/15 text-rose-400 border-rose-500/30'
                          : ev.riskLevel === 'HIGH'
                          ? 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                          : 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                      }`}
                    >
                      {ev.actionTaken.replace(/_/g, ' ')}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-x-2 text-xs font-mono tabular-nums text-slate-500" data-sensitive-data="true">
                    <span>{ev.vendorProductId}</span>
                    <span aria-hidden="true">·</span>
                    <span>{ev.busPath}</span>
                    <span aria-hidden="true">·</span>
                    <span>{ev.timestamp}</span>
                  </div>

                  <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed" data-sensitive-data="true">
                    {ev.anomalySignature}
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0 self-start lg:self-center">
                  {ev.riskLevel !== 'TRUSTED' ? (
                    <button
                      type="button"
                      onClick={() => hardwareIntegrityService.authorizePeripheral(ev.id)}
                      className="min-h-[38px] px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-semibold hover:bg-slate-500/10 whitespace-nowrap"
                    >
                      Trust Device
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => hardwareIntegrityService.quarantinePeripheral(ev.id)}
                      className="min-h-[38px] px-3 py-1.5 rounded-lg bg-rose-600/15 border border-rose-500/30 text-rose-400 text-xs font-bold hover:bg-rose-600/25 whitespace-nowrap"
                    >
                      Quarantine Bus
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default HardwareIntegrityShield;
