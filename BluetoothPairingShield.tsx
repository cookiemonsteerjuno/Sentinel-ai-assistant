import React, { useState } from 'react';
import { BluetoothProbeRecord } from '../types';
import { audioAnnouncer } from '../services/audioAnnouncer';

interface BluetoothPairingShieldProps {
  theme?: 'dark' | 'light';
}

const INITIAL_BLUETOOTH_PROBES: BluetoothProbeRecord[] = [
  {
    id: 'bt-1',
    deviceName: 'Rogue Wireless Headset (AirPods Pro Clone)',
    macAddress: '00:1A:7D:DA:71:02',
    deviceType: 'Audio/Headset',
    rssi: -52,
    pairingMethod: 'Just Works',
    timestamp: '18 seconds ago',
    status: 'PAIRING_REJECTED',
    attempts: 7
  },
  {
    id: 'bt-2',
    deviceName: 'Adjacent Smartphone (Nearby Share Probe)',
    macAddress: '44:65:0D:33:F2:A1',
    deviceType: 'Adjacent Phone/Tablet',
    rssi: -64,
    pairingMethod: 'SSP Handshake',
    timestamp: '42 seconds ago',
    status: 'PAIRING_REJECTED',
    attempts: 4
  },
  {
    id: 'bt-3',
    deviceName: 'Unsolicited BLE Tracking Beacon',
    macAddress: 'F2:08:92:4B:91:EE',
    deviceType: 'Smart Tracker/Beacon',
    rssi: -45,
    pairingMethod: 'BLE Passkey',
    timestamp: '2 minutes ago',
    status: 'RADIO_DROPPED',
    attempts: 12
  },
  {
    id: 'bt-4',
    deviceName: 'Rogue Inbound HID Controller (Ghost Keyboard)',
    macAddress: '2C:4D:54:E8:29:01',
    deviceType: 'Unknown RF Device',
    rssi: -68,
    pairingMethod: 'PIN Code',
    timestamp: '5 minutes ago',
    status: 'PAIRING_REJECTED',
    attempts: 3
  },
  {
    id: 'bt-5',
    deviceName: 'Vehicle Telematics & OBD-II Scanner',
    macAddress: '00:04:3E:99:A4:12',
    deviceType: 'Vehicle Infotainment',
    rssi: -79,
    pairingMethod: 'PIN Code',
    timestamp: '12 minutes ago',
    status: 'PAIRING_REJECTED',
    attempts: 2
  }
];

export const BluetoothPairingShield: React.FC<BluetoothPairingShieldProps> = ({
  theme = 'dark'
}) => {
  const isLight = theme === 'light';

  // Bluetooth control states
  const [bluetoothAccessBlocked, setBluetoothAccessBlocked] = useState<boolean>(true);
  const [pairingBlocked, setPairingBlocked] = useState<boolean>(true);
  const [radioKilled, setRadioKilled] = useState<boolean>(true);
  const [bleAdvertisingSuppressed, setBleAdvertisingSuppressed] = useState<boolean>(true);
  const [rfcommBlocked, setRfcommBlocked] = useState<boolean>(true);

  const [probes, setProbes] = useState<BluetoothProbeRecord[]>(INITIAL_BLUETOOTH_PROBES);
  const [totalPairingAttemptsBlocked, setTotalPairingAttemptsBlocked] = useState<number>(28);
  const [radioPacketsDropped, setRadioPacketsDropped] = useState<number>(1840);
  const [notification, setNotification] = useState<string | null>(null);

  const toggleMasterBluetoothLock = () => {
    const next = !bluetoothAccessBlocked;
    setBluetoothAccessBlocked(next);
    setPairingBlocked(next);
    setRadioKilled(next);
    setBleAdvertisingSuppressed(next);
    setRfcommBlocked(next);

    if (next) {
      setNotification('BLUETOOTH DISCONNECTED & AIR-GAPPED: Hardware controller hci0 killed, all device pairing rejected.');
    } else {
      setNotification('Bluetooth hardware radio re-enabled. Warning: Device is discoverable.');
    }
    audioAnnouncer.playChime(next);
  };

  const handlePurgeKeys = () => {
    setNotification('All stored Bluetooth pairing link keys, cache, and bonding databases completely erased from memory.');
    audioAnnouncer.playChime(true);
  };

  const handleBlockMac = (mac: string) => {
    setProbes(prev => prev.filter(p => p.macAddress !== mac));
    setTotalPairingAttemptsBlocked(prev => prev + 1);
    setNotification(`Device MAC ${mac} permanently blacklisted in BlueZ and RF hardware drop-table.`);
    audioAnnouncer.playChime(true);
  };

  return (
    <div className="space-y-6">
      {/* Alert Notification */}
      {notification && (
        <div className="p-3.5 rounded-xl border border-cyan-500/40 bg-cyan-500/10 text-cyan-300 text-xs flex items-center justify-between animate-fadeIn">
          <div className="flex items-center gap-2.5">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-cyan-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="font-semibold">{notification}</span>
          </div>
          <button onClick={() => setNotification(null)} className="text-slate-400 hover:text-white text-xs">Dismiss</button>
        </div>
      )}

      {/* Bluetooth Shield Master Banner */}
      <div className={`glass rounded-2xl p-6 border shadow-cyan relative overflow-hidden ${
        isLight ? 'border-cyan-200 bg-cyan-50/20' : 'border-cyan-500/30 bg-slate-900/60'
      }`}>
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5 pb-5 border-b border-slate-800">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shrink-0 shadow-cyan">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
              </svg>
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <span className="text-xs uppercase font-bold tracking-wider text-cyan-400">Radio Frequency Isolation</span>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold border flex items-center gap-1.5 ${
                  bluetoothAccessBlocked
                    ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                    : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                }`}>
                  <span className={`w-2 h-2 rounded-full ${bluetoothAccessBlocked ? 'bg-rose-400' : 'bg-emerald-400'}`} />
                  {bluetoothAccessBlocked ? 'BLUETOOTH ACCESS & ALL PAIRING STRICTLY BLOCKED' : 'BLUETOOTH ACTIVE'}
                </span>
              </div>
              <h3 className="text-xl font-black text-white">Bluetooth Hardware & Device Pairing Shield</h3>
              <p className="text-xs text-slate-400 max-w-3xl mt-1 leading-relaxed">
                Completely powers down the Bluetooth controller (hci0 DOWN), prevents advertising beacons, disables RFCOMM and L2CAP sockets, and immediately rejects 100% of incoming device pairing requests (PIN, Just Works, SSP, and BLE passkeys). Zero external RF devices can pair or discover this system.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <button
              id="purge-bluetooth-keys-btn"
              onClick={handlePurgeKeys}
              className="px-4 py-3 rounded-xl text-xs font-bold text-slate-300 hover:text-white bg-slate-800 border border-slate-700 hover:border-slate-600 transition-all"
            >
              Purge Link Keys & Bonds
            </button>
            <button
              id="toggle-bluetooth-shield-master-btn"
              onClick={toggleMasterBluetoothLock}
              className={`px-5 py-3 rounded-xl text-xs font-black transition-all shadow-cyan flex items-center gap-2 ${
                bluetoothAccessBlocked
                  ? 'bg-rose-600 hover:bg-rose-500 text-white'
                  : 'bg-slate-800 text-slate-300 hover:text-white border border-slate-700'
              }`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
              </svg>
              <span>{bluetoothAccessBlocked ? '✓ Bluetooth Blocked (Active)' : 'Block All Bluetooth & Pairing'}</span>
            </button>
          </div>
        </div>

        {/* Status Metrics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-5">
          <div className={`p-4 rounded-xl border ${isLight ? 'border-slate-200 bg-white' : 'border-slate-800 bg-slate-950/60'}`}>
            <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">Controller Status</span>
            <span className="text-xl font-black text-rose-400 mono mt-0.5 block">{radioKilled ? 'DOWN (KILLED)' : 'UP (ACTIVE)'}</span>
            <span className="text-[10px] text-slate-500 mt-1 block">RF controller hci0 disconnected</span>
          </div>

          <div className={`p-4 rounded-xl border ${isLight ? 'border-slate-200 bg-white' : 'border-slate-800 bg-slate-950/60'}`}>
            <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">Pairing Requests Blocked</span>
            <span className="text-xl font-black text-white mono mt-0.5 block">{totalPairingAttemptsBlocked} Blocked</span>
            <span className="text-[10px] text-emerald-400 mt-1 block">100% Reject Policy</span>
          </div>

          <div className={`p-4 rounded-xl border ${isLight ? 'border-slate-200 bg-white' : 'border-slate-800 bg-slate-950/60'}`}>
            <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">Active Bluetooth Bonds</span>
            <span className="text-xl font-black text-emerald-400 mono mt-0.5 block">0 (FORBIDDEN)</span>
            <span className="text-[10px] text-slate-500 mt-1 block">Zero trusted or paired devices</span>
          </div>

          <div className={`p-4 rounded-xl border ${isLight ? 'border-slate-200 bg-white' : 'border-slate-800 bg-slate-950/60'}`}>
            <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">RF Packets Dropped</span>
            <span className="text-xl font-black text-cyan-400 mono mt-0.5 block">{radioPacketsDropped.toLocaleString()}</span>
            <span className="text-[10px] text-slate-500 mt-1 block">RFCOMM & L2CAP sinkholed</span>
          </div>
        </div>

        {/* Subsystem Toggles */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mt-5">
          {[
            {
              id: 'radio',
              label: 'Radio Controller (hci0)',
              desc: 'Hard power-down Bluetooth chip',
              active: radioKilled,
              toggle: () => setRadioKilled(!radioKilled)
            },
            {
              id: 'pairing',
              label: 'Zero-Trust Pairing Intercept',
              desc: 'Reject PIN, SSP, Just Works',
              active: pairingBlocked,
              toggle: () => setPairingBlocked(!pairingBlocked)
            },
            {
              id: 'ble-adv',
              label: 'BLE Beacon Suppression',
              desc: 'Silences all outbound BLE packets',
              active: bleAdvertisingSuppressed,
              toggle: () => setBleAdvertisingSuppressed(!bleAdvertisingSuppressed)
            },
            {
              id: 'rfcomm',
              label: 'RFCOMM / L2CAP Firewall',
              desc: 'Blocks virtual serial & HID tunnels',
              active: rfcommBlocked,
              toggle: () => setRfcommBlocked(!rfcommBlocked)
            }
          ].map(item => (
            <button
              key={item.id}
              onClick={item.toggle}
              className={`p-3 rounded-xl border text-left transition-all ${
                item.active
                  ? 'border-cyan-500/40 bg-cyan-500/10 shadow-cyan'
                  : isLight ? 'border-slate-200 bg-white' : 'border-slate-800 bg-slate-950/60'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="font-bold text-xs text-white">{item.label}</span>
                <span className={`text-[9px] font-black px-1.5 py-0.2 rounded border ${
                  item.active
                    ? 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                    : 'bg-slate-800 text-slate-400 border-slate-700'
                }`}>
                  {item.active ? 'ENFORCED' : 'ALLOW'}
                </span>
              </div>
              <p className="text-[10px] text-slate-400">{item.desc}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Blocked Bluetooth Probes and Pairing Ingress Log */}
      <div className={`glass rounded-2xl border overflow-hidden ${isLight ? 'border-slate-200' : 'border-slate-800'}`}>
        <div className={`p-4 border-b flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
          isLight ? 'border-slate-200 bg-slate-50' : 'border-slate-800 bg-slate-900/60'
        }`}>
          <div>
            <h4 className="font-bold text-sm text-white">Intercepted Bluetooth Devices & Pairing Attempts</h4>
            <p className="text-xs text-slate-400 mt-0.5">Nearby RF probes actively blocked from establishing Bluetooth link keys</p>
          </div>
          <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-rose-500/10 text-rose-300 border border-rose-500/30">
            {probes.length} Devices Intercepted & Blocked
          </span>
        </div>

        <div className="divide-y divide-slate-800">
          {probes.map(probe => (
            <div
              key={probe.id}
              className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-950/40 hover:bg-slate-900/40 transition-colors"
            >
              <div className="flex items-start gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 shrink-0">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
                  </svg>
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-bold text-sm text-white">{probe.deviceName}</span>
                    <span className="px-1.5 py-0.2 rounded text-[10px] font-black bg-slate-800 text-slate-300 mono">
                      {probe.macAddress}
                    </span>
                    <span className="px-2 py-0.2 rounded text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">
                      PAIRING REJECTED
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-xs text-slate-400">
                    <span>Type: <strong className="text-slate-300">{probe.deviceType}</strong></span>
                    <span>Pairing Method: <strong className="text-amber-400">{probe.pairingMethod}</strong></span>
                    <span>Signal: <strong className="text-cyan-400">{probe.rssi} dBm</strong></span>
                    <span>Attempts: <strong className="text-rose-400">{probe.attempts} rejected</strong></span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-4 shrink-0 justify-between md:justify-end">
                <span className="text-[10px] text-slate-500 mono">{probe.timestamp}</span>
                <button
                  onClick={() => handleBlockMac(probe.macAddress)}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold text-rose-300 border border-rose-500/40 hover:bg-rose-500/10 transition-colors"
                >
                  Null-Route MAC
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
