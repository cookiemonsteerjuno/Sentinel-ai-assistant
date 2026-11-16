import React, { useEffect, useState } from 'react';
import { SimLockEvent, SimSlotType, SimSwitchLockState } from '../types';
import { simSwitchLockService } from '../services/simSwitchLockService';
import { triggerBlobDownload } from '../services/apkPackager';

interface SimSwitchLockPanelProps {
  theme?: 'dark' | 'light';
  stealthMode?: boolean;
}

export const SimSwitchLockPanel: React.FC<SimSwitchLockPanelProps> = ({
  theme = 'dark',
  stealthMode = false,
}) => {
  const isLight = theme === 'light';
  const [state, setState] = useState<SimSwitchLockState>(() =>
    simSwitchLockService.getSnapshot()
  );
  const [pinInput, setPinInput] = useState('');
  const [pendingSlotSwitch, setPendingSlotSwitch] = useState<SimSlotType | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'error' | 'success'; text: string } | null>(null);
  const [showPinConfig, setShowPinConfig] = useState(false);
  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [isProbing, setIsProbing] = useState(false);

  useEffect(() => {
    const unsub = simSwitchLockService.subscribe(setState);
    return () => unsub();
  }, []);

  const showMessage = (type: 'error' | 'success', text: string) => {
    setFeedback({ type, text });
    setTimeout(() => setFeedback(null), 4000);
  };

  const handleToggleMasterLock = () => {
    if (!state.simSwitchLocked) {
      simSwitchLockService.verifyAndToggleSimLock('');
      setPinInput('');
      showMessage('success', 'SIM Switch Lock re-armed and enforced.');
      return;
    }

    const res = simSwitchLockService.verifyAndToggleSimLock(pinInput);
    if (!res.ok) {
      showMessage('error', res.error || 'Invalid Guard PIN.');
      return;
    }
    setPinInput('');
    showMessage('success', 'SIM Switch Lock temporarily unlocked with Guard PIN.');
  };

  const handleSlotClick = (slot: SimSlotType) => {
    if (slot === state.activeSlot) return;
    if (!state.simSwitchLocked) {
      simSwitchLockService.verifyAndSwitchActiveSlot(slot, '');
      showMessage('success', `Switched active cellular profile to ${slot === 'ESIM_PROFILE_2' ? 'Slot 2 (eSIM)' : 'Slot 1 (Physical SIM)'}.`);
      return;
    }
    setPendingSlotSwitch(slot);
  };

  const handleConfirmSlotSwitch = () => {
    if (!pendingSlotSwitch) return;
    const res = simSwitchLockService.verifyAndSwitchActiveSlot(pendingSlotSwitch, pinInput);
    if (!res.ok) {
      showMessage('error', res.error || 'SIM switch denied.');
      return;
    }
    setPinInput('');
    setPendingSlotSwitch(null);
    showMessage('success', 'PIN verified — active SIM slot switched.');
  };

  const handleUpdatePin = (e: React.FormEvent) => {
    e.preventDefault();
    const res = simSwitchLockService.updateGuardPin(currentPin, newPin);
    if (!res.ok) {
      showMessage('error', res.error || 'Could not update Guard PIN.');
      return;
    }
    setCurrentPin('');
    setNewPin('');
    setShowPinConfig(false);
    showMessage('success', 'SIM Guard PIN updated.');
  };

  const handleProbeRadio = () => {
    setIsProbing(true);
    simSwitchLockService.probeRadioInterface();
    setTimeout(() => setIsProbing(false), 350);
  };

  const handleExportAudit = () => {
    const payload = {
      exportedAt: new Date().toISOString(),
      simSwitchLocked: state.simSwitchLocked,
      esimProvisioningLocked: state.esimProvisioningLocked,
      portOutFreezeEnabled: state.portOutFreezeEnabled,
      activeSlot: state.activeSlot,
      boundCarrier: state.boundCarrier,
      events: state.events,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    triggerBlobDownload(blob, `sentinel-sim-switch-lock-${Date.now()}.json`);
  };

  const maskIccid = (iccid: string) => {
    if (!stealthMode) return iccid;
    return `${iccid.slice(0, 9)}-****-****`;
  };

  const cardBase = isLight
    ? 'bg-white border-slate-200 text-slate-900'
    : 'bg-slate-900/60 border-slate-800 text-slate-100';

  return (
    <div className="space-y-6">
      {/* Top Lock Status Banner */}
      <div
        className={`rounded-2xl border p-6 transition-colors ${
          state.lockdownTripped
            ? 'border-rose-500 bg-rose-950/35 text-rose-100'
            : cardBase
        }`}
      >
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span
                className={`font-semibold ${
                  state.lockdownTripped
                    ? 'text-rose-400'
                    : state.simSwitchLocked
                    ? 'text-emerald-400'
                    : 'text-amber-400'
                }`}
              >
                {state.lockdownTripped
                  ? 'SIM Swap Lockdown Tripped'
                  : state.simSwitchLocked
                  ? 'SIM & eSIM Switch Locked'
                  : 'SIM Switch Unlocked'}
              </span>
              <span aria-hidden="true" className="text-slate-600">
                ·
              </span>
              <span className="font-mono tabular-nums text-slate-400">
                {state.totalSwapAttemptsBlocked} swap attempts blocked
              </span>
              <span aria-hidden="true" className="text-slate-600">
                ·
              </span>
              <span className="font-mono text-slate-400">{state.boundCarrier}</span>
            </div>

            <h3 className="text-xl font-bold tracking-tight">
              SIM Switch Lock &amp; Port-Out Freeze
            </h3>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-300 leading-relaxed max-w-2xl">
              {state.lockdownTripped && state.lockdownReason
                ? state.lockdownReason
                : 'Locks your cellular identity to bound hardware SIM / eSIM profiles, blocks unauthorized SM-DP+ profile downloads, and freezes carrier port-outs behind your Guard PIN.'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {state.lockdownTripped && (
              <button
                type="button"
                onClick={() => simSwitchLockService.resetLockdown()}
                className="min-h-[42px] px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-colors whitespace-nowrap"
              >
                Clear Lockdown Alert
              </button>
            )}
            <button
              type="button"
              onClick={handleExportAudit}
              className={`min-h-[42px] px-3.5 py-2 rounded-xl border text-xs font-semibold transition-colors whitespace-nowrap ${
                isLight
                  ? 'border-slate-300 text-slate-700 hover:bg-slate-100'
                  : 'border-slate-700 text-slate-200 hover:bg-slate-800'
              }`}
            >
              Export SIM Audit
            </button>
          </div>
        </div>

        {/* PIN Gate & Master Lock Bar */}
        <div className="mt-5 pt-4 border-t border-slate-200 dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            {state.simSwitchLocked && (
              <input
                type="password"
                inputMode="numeric"
                maxLength={6}
                value={pinInput}
                onChange={e => setPinInput(e.target.value)}
                placeholder={`Enter Guard PIN (default ${state.guardPin})`}
                className={`min-h-[40px] w-56 rounded-xl border px-3 py-1.5 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-cyan-500 ${
                  isLight
                    ? 'bg-slate-50 border-slate-300 text-slate-900 placeholder:text-slate-400'
                    : 'bg-slate-950/70 border-slate-700 text-slate-100 placeholder:text-slate-500'
                }`}
              />
            )}

            <button
              type="button"
              id="toggle-sim-switch-lock-btn"
              onClick={handleToggleMasterLock}
              className={`min-h-[40px] px-4 py-2 rounded-xl text-xs font-bold transition-colors whitespace-nowrap ${
                state.simSwitchLocked
                  ? 'bg-amber-600 hover:bg-amber-500 text-white'
                  : 'bg-emerald-600 hover:bg-emerald-500 text-white'
              }`}
            >
              {state.simSwitchLocked ? 'Unlock with PIN' : 'Engage SIM Switch Lock'}
            </button>

            <button
              type="button"
              onClick={() => setShowPinConfig(!showPinConfig)}
              className={`min-h-[40px] px-3 py-2 rounded-xl border text-xs font-semibold transition-colors whitespace-nowrap ${
                isLight
                  ? 'border-slate-300 text-slate-700 hover:bg-slate-100'
                  : 'border-slate-700 text-slate-300 hover:bg-slate-800'
              }`}
            >
              {showPinConfig ? 'Cancel PIN Edit' : 'Change Guard PIN'}
            </button>
          </div>

          <span className="text-xs text-slate-500 font-mono">
            Active Lock: {state.simSwitchLocked ? 'PIN REQUIRED FOR CHANGES' : 'UNLOCKED'}
          </span>
        </div>

        {feedback && (
          <div
            className={`mt-3 rounded-xl border px-3.5 py-2.5 text-xs font-medium ${
              feedback.type === 'error'
                ? 'border-rose-500/40 bg-rose-500/10 text-rose-400'
                : 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400'
            }`}
          >
            {feedback.text}
          </div>
        )}

        {showPinConfig && (
          <form
            onSubmit={handleUpdatePin}
            className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center gap-2"
          >
            <input
              type="password"
              inputMode="numeric"
              maxLength={6}
              value={currentPin}
              onChange={e => setCurrentPin(e.target.value)}
              placeholder="Current PIN"
              className={`min-h-[38px] w-36 rounded-lg border px-3 py-1.5 text-xs font-mono ${
                isLight
                  ? 'bg-slate-50 border-slate-300 text-slate-900'
                  : 'bg-slate-950/70 border-slate-700 text-slate-100'
              }`}
            />
            <input
              type="password"
              inputMode="numeric"
              maxLength={6}
              value={newPin}
              onChange={e => setNewPin(e.target.value)}
              placeholder="New 4-6 digit PIN"
              className={`min-h-[38px] w-44 rounded-lg border px-3 py-1.5 text-xs font-mono ${
                isLight
                  ? 'bg-slate-50 border-slate-300 text-slate-900'
                  : 'bg-slate-950/70 border-slate-700 text-slate-100'
              }`}
            />
            <button
              type="submit"
              className="min-h-[38px] px-4 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold"
            >
              Save PIN
            </button>
          </form>
        )}
      </div>

      {/* Bound SIM Slots + Protection Policies */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Bound SIM & eSIM Hardware Slots */}
        <div className={`rounded-2xl border p-5 space-y-4 ${cardBase}`}>
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-bold">Bound SIM &amp; eSIM Profiles</h4>
            <span className="text-xs font-mono text-slate-400">Dual-SIM Guard</span>
          </div>

          <div className="space-y-3" data-sensitive-data="true">
            {(
              [
                {
                  slot: 'PHYSICAL_SIM_1' as SimSlotType,
                  title: 'Slot 1 · Physical Hardware SIM',
                  iccid: state.boundPrimaryIccid,
                  carrier: state.boundCarrier,
                },
                {
                  slot: 'ESIM_PROFILE_2' as SimSlotType,
                  title: 'Slot 2 · Embedded eSIM Profile',
                  iccid: state.boundSecondaryEsimId,
                  carrier: 'Backup Encrypted Roaming eSIM',
                },
              ]
            ).map(item => {
              const isActive = state.activeSlot === item.slot;
              return (
                <div
                  key={item.slot}
                  className={`p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                    isActive
                      ? 'border-cyan-500/40 bg-cyan-500/10'
                      : 'border-slate-200 dark:border-slate-800'
                  }`}
                >
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2 text-xs font-bold">
                      <span>{item.title}</span>
                      {isActive && (
                        <span className="text-emerald-400 font-mono">· Active</span>
                      )}
                    </div>
                    <div className="text-xs font-mono tabular-nums text-slate-400">
                      ICCID: {maskIccid(item.iccid)}
                    </div>
                    <div className="text-[11px] text-slate-500">{item.carrier}</div>
                  </div>

                  {!isActive && (
                    <button
                      type="button"
                      onClick={() => handleSlotClick(item.slot)}
                      className="min-h-[38px] px-3.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-semibold hover:bg-slate-500/10 whitespace-nowrap shrink-0"
                    >
                      Switch to Slot
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          {pendingSlotSwitch && (
            <div className="p-3.5 rounded-xl border border-amber-500/40 bg-amber-500/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <span>
                Verify Guard PIN above and confirm slot switch to{' '}
                <strong>
                  {pendingSlotSwitch === 'ESIM_PROFILE_2' ? 'Slot 2 (eSIM)' : 'Slot 1 (Physical SIM)'}
                </strong>
                .
              </span>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setPendingSlotSwitch(null)}
                  className="px-3 py-1.5 rounded-lg border border-slate-500/30 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmSlotSwitch}
                  className="px-3.5 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold"
                >
                  Authorize Switch
                </button>
              </div>
            </div>
          )}
        </div>

        {/* SIM Switch Lock Policies & Simulations */}
        <div className={`rounded-2xl border p-5 space-y-4 ${cardBase}`}>
          <h4 className="text-sm font-bold">Carrier &amp; Swap Prevention Policies</h4>

          <div className="space-y-2.5">
            {(
              [
                {
                  key: 'esimProvisioningLocked',
                  label: 'Lock eSIM Profile Provisioning',
                  hint: 'Deny unsolicited SM-DP+ QR & carrier OTA eSIM installs',
                },
                {
                  key: 'portOutFreezeEnabled',
                  label: 'Carrier Number Port-Out Freeze',
                  hint: 'Block MSISDN transfer-out PIN generation requests',
                },
                {
                  key: 'autoQuarantine2FAOnSwap',
                  label: 'Quarantine 2FA SMS/Calls on Swap',
                  hint: 'Immediately freeze OTP traffic & alert if ICCID mutates',
                },
              ] as const
            ).map(item => {
              const active = state[item.key];
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => simSwitchLockService.togglePolicy(item.key)}
                  className={`w-full p-3.5 rounded-xl border text-left flex items-center justify-between gap-3 transition-colors ${
                    active
                      ? isLight
                        ? 'border-cyan-300 bg-cyan-50/70'
                        : 'border-cyan-500/30 bg-cyan-950/20'
                      : isLight
                      ? 'border-slate-200 bg-slate-50'
                      : 'border-slate-800 bg-slate-950/40'
                  }`}
                >
                  <div className="min-w-0">
                    <span className="text-xs font-bold block">{item.label}</span>
                    <span className="text-[11px] text-slate-500 block mt-0.5">{item.hint}</span>
                  </div>
                  <span
                    className={`text-xs font-mono font-bold shrink-0 ${
                      active ? 'text-cyan-400' : 'text-slate-500'
                    }`}
                  >
                    {active ? 'LOCKED' : 'OFF'}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="pt-3 border-t border-slate-200 dark:border-slate-800 space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
              <span>{state.radioProbeSummary}</span>
              <button
                type="button"
                onClick={handleProbeRadio}
                disabled={isProbing}
                className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-semibold hover:bg-slate-500/10 shrink-0"
              >
                {isProbing ? 'Checking...' : 'Check Link Telemetry'}
              </button>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => simSwitchLockService.simulateSwapThreat('physical_swap')}
                className="min-h-[38px] px-3 py-1.5 rounded-lg bg-rose-600/15 hover:bg-rose-600/25 border border-rose-500/30 text-rose-400 text-xs font-bold whitespace-nowrap"
              >
                Simulate SIM Tray Swap
              </button>
              <button
                type="button"
                onClick={() => simSwitchLockService.simulateSwapThreat('rogue_esim')}
                className="min-h-[38px] px-3 py-1.5 rounded-lg bg-rose-600/15 hover:bg-rose-600/25 border border-rose-500/30 text-rose-400 text-xs font-bold whitespace-nowrap"
              >
                Simulate Rogue eSIM Push
              </button>
              <button
                type="button"
                onClick={() => simSwitchLockService.simulateSwapThreat('port_out')}
                className="min-h-[38px] px-3 py-1.5 rounded-lg bg-amber-600/15 hover:bg-amber-600/25 border border-amber-500/30 text-amber-400 text-xs font-bold whitespace-nowrap"
              >
                Simulate Port-Out Request
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* SIM Lock Event Audit Log */}
      <div className={`rounded-2xl border overflow-hidden ${cardBase}`}>
        <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3">
          <div>
            <h4 className="text-sm font-bold">SIM Switch &amp; Carrier Event Log</h4>
            <p className="text-xs text-slate-500">
              Hardware ICCID mismatches, eSIM push rejections, and PIN-verified slot switches
            </p>
          </div>
          {state.events.length > 0 && (
            <button
              type="button"
              onClick={() => simSwitchLockService.clearEvents()}
              className="min-h-[36px] px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-medium text-slate-500 hover:text-rose-400"
            >
              Clear Log
            </button>
          )}
        </div>

        {state.events.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-500">
            No SIM switch or carrier port-out events recorded.
          </div>
        ) : (
          <div className="divide-y divide-slate-200 dark:divide-slate-800">
            {state.events.map((ev: SimLockEvent) => (
              <div
                key={ev.id}
                className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div className="space-y-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span
                      className={`font-mono font-bold ${
                        ev.severity === 'CRITICAL'
                          ? 'text-rose-400'
                          : ev.severity === 'HIGH'
                          ? 'text-amber-400'
                          : 'text-emerald-400'
                      }`}
                    >
                      {ev.actionTaken.replace(/_/g, ' ')}
                    </span>
                    <span aria-hidden="true" className="text-slate-600">
                      ·
                    </span>
                    <span className="font-semibold">
                      {ev.eventType.replace(/_/g, ' ')}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                    {ev.detail}
                  </p>
                  <div
                    className="flex flex-wrap items-center gap-x-2 text-[11px] font-mono tabular-nums text-slate-500"
                    data-sensitive-data="true"
                  >
                    <span>{maskIccid(ev.detectedIccid)}</span>
                    <span aria-hidden="true">·</span>
                    <span>{ev.carrierLabel}</span>
                    <span aria-hidden="true">·</span>
                    <span>{ev.timestamp}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default SimSwitchLockPanel;
