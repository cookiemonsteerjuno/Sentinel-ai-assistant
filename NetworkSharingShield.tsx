import React, { useState } from 'react';
import { NetworkShareProbe } from '../types';
import { audioAnnouncer } from '../services/audioAnnouncer';

interface NetworkSharingShieldProps {
  theme?: 'dark' | 'light';
}

const INITIAL_SHARE_PROBES: NetworkShareProbe[] = [
  {
    id: 'nsp-1',
    clientIp: '192.168.1.145',
    clientHostname: 'DESKTOP-ROGUE-9X',
    requestedShare: '\\\\SENTINEL\\\\C$ (Administrative Share)',
    protocol: 'SMBv2/v3 (Port 445)',
    timestamp: '14 seconds ago',
    action: 'REJECTED_TCP_RST',
    attempts: 9
  },
  {
    id: 'nsp-2',
    clientIp: '192.168.1.202',
    clientHostname: 'Unknown-MacBook-Pro',
    requestedShare: 'afp://sentinel-device/Users/Shared',
    protocol: 'AFP (Port 548)',
    timestamp: '48 seconds ago',
    action: 'ICMP_PROHIBITED',
    attempts: 4
  },
  {
    id: 'nsp-3',
    clientIp: '192.168.1.88',
    clientHostname: 'Smart-Display-DLNA',
    requestedShare: 'urn:schemas-upnp-org:service:ContentDirectory',
    protocol: 'UPnP/SSDP (Port 1900)',
    timestamp: '2 minutes ago',
    action: 'REJECTED_TCP_RST',
    attempts: 16
  },
  {
    id: 'nsp-4',
    clientIp: '10.0.0.94',
    clientHostname: 'Debian-NFS-Scanner',
    requestedShare: 'mount -t nfs /exports/home',
    protocol: 'NFS (Port 2049)',
    timestamp: '5 minutes ago',
    action: 'REJECTED_TCP_RST',
    attempts: 6
  },
  {
    id: 'nsp-5',
    clientIp: '192.168.1.118',
    clientHostname: 'HP-Network-Spooler',
    requestedShare: 'ipp://sentinel:631/printers/all',
    protocol: 'Printer Sharing (IPP 631)',
    timestamp: '11 minutes ago',
    action: 'ICMP_PROHIBITED',
    attempts: 3
  }
];

export const NetworkSharingShield: React.FC<NetworkSharingShieldProps> = ({
  theme = 'dark'
}) => {
  const isLight = theme === 'light';

  // Network sharing block states
  const [blockAllSharing, setBlockAllSharing] = useState<boolean>(true);
  const [smbBlocked, setSmbBlocked] = useState<boolean>(true);
  const [nfsBlocked, setNfsBlocked] = useState<boolean>(true);
  const [afpBlocked, setAfpBlocked] = useState<boolean>(true);
  const [upnpBlocked, setUpnpBlocked] = useState<boolean>(true);
  const [mdnsBlocked, setMdnsBlocked] = useState<boolean>(true);
  const [printerBlocked, setPrinterBlocked] = useState<boolean>(true);

  const [shareProbes, setShareProbes] = useState<NetworkShareProbe[]>(INITIAL_SHARE_PROBES);
  const [totalBlocked, setTotalBlocked] = useState<number>(382);
  const [notification, setNotification] = useState<string | null>(null);

  const toggleMasterSharingBlock = () => {
    const next = !blockAllSharing;
    setBlockAllSharing(next);
    setSmbBlocked(next);
    setNfsBlocked(next);
    setAfpBlocked(next);
    setUpnpBlocked(next);
    setMdnsBlocked(next);
    setPrinterBlocked(next);

    if (next) {
      setNotification('NETWORK SHARING STRICTLY PROHIBITED: SMB, NFS, AFP, UPnP, and NetBIOS listeners deactivated and firewalled.');
    } else {
      setNotification('Network sharing block relaxed. Inbound sharing protocols allowed.');
    }
    audioAnnouncer.playChime(next);
  };

  const handleDismissProbe = (id: string) => {
    setShareProbes(prev => prev.filter(p => p.id !== id));
    setTotalBlocked(prev => prev + 1);
  };

  return (
    <div className="space-y-6">
      {/* Alert Notification */}
      {notification && (
        <div className="p-3.5 rounded-xl border border-amber-500/40 bg-amber-500/10 text-amber-300 text-xs flex items-center justify-between animate-fadeIn">
          <div className="flex items-center gap-2.5">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-amber-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <span className="font-semibold">{notification}</span>
          </div>
          <button onClick={() => setNotification(null)} className="text-slate-400 hover:text-white text-xs">Dismiss</button>
        </div>
      )}

      {/* Main Master Network Sharing Block Card */}
      <div className={`glass rounded-2xl p-6 border shadow-cyan relative overflow-hidden ${
        isLight ? 'border-amber-200 bg-amber-50/20' : 'border-amber-500/30 bg-slate-900/60'
      }`}>
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5 pb-5 border-b border-slate-800">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0 shadow-cyan">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" />
              </svg>
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <span className="text-xs uppercase font-bold tracking-wider text-amber-400">File & Resource Sharing Isolation</span>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold border flex items-center gap-1.5 ${
                  blockAllSharing
                    ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                    : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                }`}>
                  <span className={`w-2 h-2 rounded-full ${blockAllSharing ? 'bg-rose-400' : 'bg-emerald-400'}`} />
                  {blockAllSharing ? 'ALL NETWORK SHARING REQUESTS STRICTLY BLOCKED' : 'SHARING ENABLED'}
                </span>
              </div>
              <h3 className="text-xl font-black text-white">Network Sharing & Remote Resource Shield</h3>
              <p className="text-xs text-slate-400 max-w-3xl mt-1 leading-relaxed">
                Prevents any local or remote device from discovering, browsing, or accessing shared folders, administrative shares, network drives, media servers, or printers on this system. All inbound SMB (445/139), NFS (2049), AFP (548), and UPnP requests are immediately dropped with TCP Reset packets.
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-3 shrink-0">
            <button
              id="toggle-network-sharing-master-btn"
              onClick={toggleMasterSharingBlock}
              className={`px-5 py-3 rounded-xl text-xs font-black transition-all shadow-cyan flex items-center gap-2 ${
                blockAllSharing
                  ? 'bg-rose-600 hover:bg-rose-500 text-white'
                  : 'bg-slate-800 text-slate-300 hover:text-white border border-slate-700'
              }`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
              </svg>
              <span>{blockAllSharing ? '✓ Network Sharing Blocked (Active)' : 'Block All Network Sharing'}</span>
            </button>
          </div>
        </div>

        {/* Telemetry Metrics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-5">
          <div className={`p-4 rounded-xl border ${isLight ? 'border-slate-200 bg-white' : 'border-slate-800 bg-slate-950/60'}`}>
            <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">Sharing Requests Blocked</span>
            <span className="text-xl font-black text-rose-400 mono mt-0.5 block">{totalBlocked.toLocaleString()}</span>
            <span className="text-[10px] text-slate-500 mt-1 block">Inbound TCP RST packets sent</span>
          </div>

          <div className={`p-4 rounded-xl border ${isLight ? 'border-slate-200 bg-white' : 'border-slate-800 bg-slate-950/60'}`}>
            <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">Exposed Shared Folders</span>
            <span className="text-xl font-black text-emerald-400 mono mt-0.5 block">0 (ZERO SHARES)</span>
            <span className="text-[10px] text-emerald-400 mt-1 block">Complete folder invisibility</span>
          </div>

          <div className={`p-4 rounded-xl border ${isLight ? 'border-slate-200 bg-white' : 'border-slate-800 bg-slate-950/60'}`}>
            <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">Network Neighborhood Status</span>
            <span className="text-xl font-black text-purple-400 mono mt-0.5 block">STEALTH (CLOAKED)</span>
            <span className="text-[10px] text-slate-500 mt-1 block">NetBIOS/mDNS broadcasts muted</span>
          </div>

          <div className={`p-4 rounded-xl border ${isLight ? 'border-slate-200 bg-white' : 'border-slate-800 bg-slate-950/60'}`}>
            <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">Admin Share Access (C$, IPC$)</span>
            <span className="text-xl font-black text-rose-400 mono mt-0.5 block">DISABLED</span>
            <span className="text-[10px] text-slate-500 mt-1 block">Remote registry & pipes closed</span>
          </div>
        </div>

        {/* Granular Protocol Switches */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mt-5">
          {[
            {
              id: 'smb',
              name: 'SMB / Samba File Sharing',
              ports: 'Ports 445, 139',
              desc: 'Blocks Windows folder shares and IPC$ pipes',
              active: smbBlocked,
              toggle: () => setSmbBlocked(!smbBlocked)
            },
            {
              id: 'nfs',
              name: 'NFS Network File System',
              ports: 'Port 2049 (TCP/UDP)',
              desc: 'Blocks Unix directory export mounts',
              active: nfsBlocked,
              toggle: () => setNfsBlocked(!nfsBlocked)
            },
            {
              id: 'afp',
              name: 'Apple Filing Protocol (AFP)',
              ports: 'Port 548 (TCP)',
              desc: 'Blocks macOS file sharing and Time Machine targets',
              active: afpBlocked,
              toggle: () => setAfpBlocked(!afpBlocked)
            },
            {
              id: 'upnp',
              name: 'UPnP / DLNA Media Server',
              ports: 'Port 1900 (SSDP)',
              desc: 'Blocks smart TV media browsing and auto-discovery',
              active: upnpBlocked,
              toggle: () => setUpnpBlocked(!upnpBlocked)
            },
            {
              id: 'mdns',
              name: 'Network Discovery (mDNS/LLMNR)',
              ports: 'Ports 5353, 5355',
              desc: 'Prevents device name broadcast on local subnet',
              active: mdnsBlocked,
              toggle: () => setMdnsBlocked(!mdnsBlocked)
            },
            {
              id: 'printer',
              name: 'Printer Sharing (IPP Spooler)',
              ports: 'Port 631 (IPP)',
              desc: 'Blocks remote print jobs and queue inspection',
              active: printerBlocked,
              toggle: () => setPrinterBlocked(!printerBlocked)
            }
          ].map(proto => (
            <button
              key={proto.id}
              onClick={proto.toggle}
              className={`p-3 rounded-xl border text-left transition-all ${
                proto.active
                  ? 'border-amber-500/40 bg-amber-500/10 shadow-cyan'
                  : isLight ? 'border-slate-200 bg-white' : 'border-slate-800 bg-slate-950/60'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <div>
                  <span className="font-bold text-xs text-white block">{proto.name}</span>
                  <span className="text-[10px] text-amber-400 mono">{proto.ports}</span>
                </div>
                <span className={`text-[9px] font-black px-1.5 py-0.2 rounded border ${
                  proto.active
                    ? 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                    : 'bg-slate-800 text-slate-400 border-slate-700'
                }`}>
                  {proto.active ? 'BLOCKED' : 'PASS'}
                </span>
              </div>
              <p className="text-[10px] text-slate-400 mt-1">{proto.desc}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Intercepted Share Handshakes Feed */}
      <div className={`glass rounded-2xl border overflow-hidden ${isLight ? 'border-slate-200' : 'border-slate-800'}`}>
        <div className={`p-4 border-b flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
          isLight ? 'border-slate-200 bg-slate-50' : 'border-slate-800 bg-slate-900/60'
        }`}>
          <div>
            <h4 className="font-bold text-sm text-white">Blocked Network Sharing Access Attempts</h4>
            <p className="text-xs text-slate-400 mt-0.5">Inbound file share requests actively terminated with TCP Reset</p>
          </div>
          <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-rose-500/10 text-rose-300 border border-rose-500/30">
            {shareProbes.length} Inbound Share Requests Terminated
          </span>
        </div>

        <div className="divide-y divide-slate-800">
          {shareProbes.map(probe => (
            <div
              key={probe.id}
              className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-950/40 hover:bg-slate-900/40 transition-colors"
            >
              <div className="flex items-start gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 shrink-0">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-bold text-sm text-white">{probe.clientHostname || probe.clientIp}</span>
                    <span className="px-1.5 py-0.2 rounded text-[10px] font-black bg-slate-800 text-slate-300 mono">
                      {probe.clientIp}
                    </span>
                    <span className="px-2 py-0.2 rounded text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">
                      {probe.action}
                    </span>
                  </div>

                  <p className="text-xs text-amber-300 font-mono mt-1">
                    Requested Target: <strong className="text-white">{probe.requestedShare}</strong>
                  </p>

                  <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-xs text-slate-400">
                    <span>Protocol: <strong className="text-slate-300">{probe.protocol}</strong></span>
                    <span>Attempts: <strong className="text-rose-400">{probe.attempts} dropped</strong></span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-4 shrink-0 justify-between md:justify-end">
                <span className="text-[10px] text-slate-500 mono">{probe.timestamp}</span>
                <button
                  onClick={() => handleDismissProbe(probe.id)}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold text-slate-400 hover:text-white border border-slate-700 hover:bg-slate-800 transition-colors"
                >
                  Clear Entry
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
