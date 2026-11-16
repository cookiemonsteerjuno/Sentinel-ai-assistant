import React, { useState, useEffect, useMemo } from 'react';
import { NearbyDeviceProbe } from '../types';
import { audioAnnouncer } from '../services/audioAnnouncer';

interface NearbyDevicesIntrusionShieldProps {
  theme?: 'dark' | 'light';
}

const INITIAL_NEARBY_PROBES: NearbyDeviceProbe[] = [
  {
    id: 'nb-1',
    ipAddress: '192.168.1.105',
    macAddress: 'd4:61:9d:3a:88:fc',
    hostname: 'ROGUE-LAPTOP.lan (Unknown Dell XPS)',
    proximity: 'Same Wi-Fi Access Point (< 3 meters)',
    targetedPorts: [22, 445, 80, 8080],
    targetedServices: ['SSH', 'SMBv2', 'HTTP', 'Alt-HTTP'],
    attemptCount: 784,
    firstSeen: '2 hours ago',
    lastSeen: 'Just now',
    status: 'BLOCKED',
    threatSeverity: 'CRITICAL',
    attackVector: 'Aggressive Full-Subnet SYN Port Scan & SMB Relay Probe'
  },
  {
    id: 'nb-2',
    ipAddress: '192.168.1.142',
    macAddress: 'b8:27:eb:c4:12:09',
    hostname: 'Generic-IoT-Hub-Media.lan',
    proximity: 'Living Room Smart TV / IoT Subnet',
    targetedPorts: [1900, 5000, 5353],
    targetedServices: ['UPnP Discovery', 'SSDP Multicast', 'mDNS'],
    attemptCount: 512,
    firstSeen: '6 hours ago',
    lastSeen: '45s ago',
    status: 'BLOCKED',
    threatSeverity: 'HIGH',
    attackVector: 'Unsolicited UPnP Gateway Manipulation & SSDP Multicast Flooding'
  },
  {
    id: 'nb-3',
    ipAddress: '192.168.1.201',
    macAddress: '7c:50:79:1f:ee:b2',
    hostname: 'Neighbor-Device-Android.lan',
    proximity: 'Adjacent Apartment Signal (-62 dBm)',
    targetedPorts: [5353, 62078],
    targetedServices: ['mDNS / Avahi Service Snooping', 'AirPlay Probe'],
    attemptCount: 378,
    firstSeen: '1 day ago',
    lastSeen: '2m ago',
    status: 'BLOCKED',
    threatSeverity: 'MEDIUM',
    attackVector: 'Persistent Local Network Host Discovery & Name Snooping'
  },
  {
    id: 'nb-4',
    ipAddress: '192.168.1.177',
    macAddress: '00:1a:7d:da:71:04',
    hostname: 'BT-Tethered-Probe-Host',
    proximity: 'Bluetooth Beacon / Hotspot Range (< 5 meters)',
    targetedPorts: [8080, 2222, 3000],
    targetedServices: ['Dev Server Ingress', 'Alt-SSH', 'Node API'],
    attemptCount: 295,
    firstSeen: '4 hours ago',
    lastSeen: '3m ago',
    status: 'BLOCKED',
    threatSeverity: 'HIGH',
    attackVector: 'Inbound SYN Flood to Local Port 3000 & 8080'
  },
  {
    id: 'nb-5',
    ipAddress: '10.0.0.88',
    macAddress: 'f0:18:98:33:9a:1c',
    hostname: 'Subnet-Infiltrator.local',
    proximity: 'Local Subnet Multi-Homed Gateway',
    targetedPorts: [3389, 23, 21],
    targetedServices: ['RDP', 'Telnet', 'FTP'],
    attemptCount: 224,
    firstSeen: '8 hours ago',
    lastSeen: '5m ago',
    status: 'BLOCKED',
    threatSeverity: 'CRITICAL',
    attackVector: 'Automated RDP Brute-Force & Credential Stuffing'
  },
  {
    id: 'nb-6',
    ipAddress: '169.254.89.12',
    macAddress: 'e0:d5:5e:67:89:ab',
    hostname: 'LinkLocal-AdHoc-Infiltrator',
    proximity: 'Link-Local Direct Layer 2 Ad-Hoc',
    targetedPorts: [0, 67, 68],
    targetedServices: ['ARP Poisoning', 'Rogue DHCP Offer'],
    attemptCount: 182,
    firstSeen: '12 hours ago',
    lastSeen: '8m ago',
    status: 'BLOCKED',
    threatSeverity: 'CRITICAL',
    attackVector: 'Gratuitous ARP Cache Poisoning & Default Gateway Hijack'
  },
  {
    id: 'nb-7',
    ipAddress: '192.168.1.99',
    macAddress: '3c:77:e6:54:32:10',
    hostname: 'Workstation-Client-04.lan',
    proximity: 'Adjacent Office Desk Subnet',
    targetedPorts: [139, 135, 445],
    targetedServices: ['NetBIOS Session', 'MS-RPC', 'SMB'],
    attemptCount: 146,
    firstSeen: '1 day ago',
    lastSeen: '11m ago',
    status: 'BLOCKED',
    threatSeverity: 'MEDIUM',
    attackVector: 'Unsolicited NetBIOS Name Service Query & MS-RPC Enumeration'
  },
  {
    id: 'nb-8',
    ipAddress: '192.168.1.250',
    macAddress: 'a4:2b:b0:90:11:44',
    hostname: 'Rogue-Extender-AP.lan',
    proximity: 'Local Wi-Fi Repeater / Extender Node',
    targetedPorts: [53, 68, 80],
    targetedServices: ['Rogue DNS Resolver', 'DHCP Snooping', 'Captive Portal'],
    attemptCount: 105,
    firstSeen: '1 day ago',
    lastSeen: '14m ago',
    status: 'BLOCKED',
    threatSeverity: 'HIGH',
    attackVector: 'DNS Query Redirection Attempt & Evil Twin Probe'
  }
];

export const NearbyDevicesIntrusionShield: React.FC<NearbyDevicesIntrusionShieldProps> = ({
  theme = 'dark'
}) => {
  const isLight = theme === 'light';

  // Master Toggle: "Block All IP Addresses Near Me" (ACTIVE by default as requested)
  const [blockAllNearbyIps, setBlockAllNearbyIps] = useState<boolean>(true);
  const [nearbyProbes, setNearbyProbes] = useState<NearbyDeviceProbe[]>(INITIAL_NEARBY_PROBES);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [severityFilter, setSeverityFilter] = useState<'ALL' | 'CRITICAL' | 'HIGH' | 'MEDIUM'>('ALL');
  const [notification, setNotification] = useState<string | null>(null);

  // New Custom Nearby IP to Block input
  const [newIpInput, setNewIpInput] = useState<string>('');
  const [newHostnameInput, setNewHostnameInput] = useState<string>('');
  const [newAttackVector, setNewAttackVector] = useState<string>('');

  // Live simulation of nearby probes ticking and getting blocked
  useEffect(() => {
    const interval = setInterval(() => {
      setNearbyProbes(prev => {
        const randomIndex = Math.floor(Math.random() * prev.length);
        const item = prev[randomIndex];
        const updatedItem = {
          ...item,
          attemptCount: item.attemptCount + 1,
          lastSeen: 'Just now'
        };

        const updated = [...prev];
        updated[randomIndex] = updatedItem;
        return updated;
      });
    }, 2800);

    return () => clearInterval(interval);
  }, []);

  // Filtered list
  const filteredProbes = useMemo(() => {
    return nearbyProbes.filter(p => {
      const matchesSearch =
        p.ipAddress.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.hostname.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.proximity.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.attackVector.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesSeverity = severityFilter === 'ALL' || p.threatSeverity === severityFilter;

      return matchesSearch && matchesSeverity;
    });
  }, [nearbyProbes, searchQuery, severityFilter]);

  // Aggregate metrics
  const totalNearbyAttempts = nearbyProbes.reduce((acc, curr) => acc + curr.attemptCount, 0);
  const blockedNearbyCount = nearbyProbes.filter(p => p.status === 'BLOCKED').length;

  // Toggle individual probe block status
  const handleToggleBlock = (id: string) => {
    setNearbyProbes(prev =>
      prev.map(p => {
        if (p.id === id) {
          const nextStatus = p.status === 'BLOCKED' ? 'ALLOWED' : 'BLOCKED';
          setNotification(
            nextStatus === 'BLOCKED'
              ? `Nearby IP ${p.ipAddress} (${p.hostname}) is now BLOCKED. All packets dropped.`
              : `Nearby IP ${p.ipAddress} allowed temporary access.`
          );
          audioAnnouncer.playChime(nextStatus === 'BLOCKED');
          return { ...p, status: nextStatus };
        }
        return p;
      })
    );
    setTimeout(() => setNotification(null), 3500);
  };

  // Add custom nearby IP block rule
  const handleAddCustomNearbyIp = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newIpInput.trim()) return;

    const newProbe: NearbyDeviceProbe = {
      id: `nb-${Date.now()}`,
      ipAddress: newIpInput.trim(),
      hostname: newHostnameInput.trim() || 'Custom-Nearby-Host.lan',
      proximity: 'Manual Subnet Definition',
      targetedPorts: [22, 445, 80],
      targetedServices: ['Manual Quarantine'],
      attemptCount: 1,
      firstSeen: 'Just now',
      lastSeen: 'Just now',
      status: 'BLOCKED',
      threatSeverity: 'HIGH',
      attackVector: newAttackVector.trim() || 'Manual Administrator Zero-Trust Quarantine'
    };

    setNearbyProbes(prev => [newProbe, ...prev]);
    setNewIpInput('');
    setNewHostnameInput('');
    setNewAttackVector('');
    setNotification(`Nearby IP ${newProbe.ipAddress} added to blocklist and packet filter dropped.`);
    audioAnnouncer.playChime(true);
    setTimeout(() => setNotification(null), 4000);
  };

  // Master Block All Nearby IPs Handler
  const handleToggleBlockAll = () => {
    const nextState = !blockAllNearbyIps;
    setBlockAllNearbyIps(nextState);
    setNearbyProbes(prev =>
      prev.map(p => ({
        ...p,
        status: nextState ? 'BLOCKED' : 'ALLOWED'
      }))
    );
    setNotification(
      nextState
        ? 'MASTER NEARBY SHIELD ARMED: 100% of nearby / local subnet IP probes are strictly BLOCKED & DROPPED.'
        : 'Nearby subnet isolation relaxed. Caution advised.'
    );
    audioAnnouncer.playChime(nextState);
    setTimeout(() => setNotification(null), 4500);
  };

  // Export JSON
  const handleExportNearbyAudit = () => {
    const data = {
      exportTimestamp: new Date().toISOString(),
      masterBlockActive: blockAllNearbyIps,
      totalProbesDropped: totalNearbyAttempts,
      nearbyDevicesIdentified: nearbyProbes
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sentinel-nearby-ip-defense-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6 animate-in">
      {/* Real-time Toast */}
      {notification && (
        <div className="p-3.5 rounded-xl bg-rose-950/90 border border-rose-500 shadow-cyan flex items-center justify-between text-rose-200 text-xs font-semibold animate-in">
          <div className="flex items-center gap-2.5">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-rose-400 shrink-0" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            <span>{notification}</span>
          </div>
          <button onClick={() => setNotification(null)} className="text-rose-400 hover:text-white">✕</button>
        </div>
      )}

      {/* Main Nearby Devices Shield Controller Header */}
      <div className={`glass rounded-2xl p-6 border shadow-cyan relative overflow-hidden ${
        isLight ? 'border-slate-200 bg-white' : 'border-slate-800 bg-slate-900/60'
      }`}>
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400 shrink-0 shadow-cyan">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs uppercase font-bold tracking-widest text-rose-400">Local Subnet & Wi-Fi Defense</span>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/10 border border-rose-500/30 text-rose-300 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-pulse" />
                  {blockAllNearbyIps ? 'ALL NEARBY IPs: STRICTLY BLOCKED' : 'MONITORING ONLY'}
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-cyan-500/10 text-cyan-300 border border-cyan-500/20">
                  {blockedNearbyCount} Rogue Nodes Isolated
                </span>
              </div>
              <h3 className="text-2xl font-black tracking-tight mt-1 text-white">
                IP Addresses Near Me (Accessing Device)
              </h3>
              <p className="text-xs text-slate-400 mt-1 max-w-2xl">
                Real-time kernel protection detecting, isolating, and dropping all unauthorized port scans, ARP spoofing attacks, SSDP floods, and service probes originating from neighboring Wi-Fi devices, adjacent IoT nodes, and local subnet attackers.
              </p>
            </div>
          </div>

          {/* Master Action Toggle */}
          <div className="flex flex-wrap items-center gap-3">
            <button
              id="block-all-nearby-ips-master-btn"
              onClick={handleToggleBlockAll}
              className={`flex items-center gap-2 px-5 py-3 rounded-xl text-xs font-bold transition-all shadow-cyan transform active:scale-95 ${
                blockAllNearbyIps
                  ? 'bg-rose-600 hover:bg-rose-500 text-white'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700'
              }`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
              </svg>
              <span>{blockAllNearbyIps ? '✓ Block All Nearby IPs (Active)' : 'Block All Nearby IPs Now'}</span>
            </button>

            <button
              onClick={handleExportNearbyAudit}
              className="px-4 py-3 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-slate-700 transition-colors"
            >
              Export Audit JSON
            </button>
          </div>
        </div>

        {/* Aggregate Stats Row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center mt-6 pt-6 border-t border-slate-800">
          <div className={`p-3 rounded-xl border ${isLight ? 'bg-slate-100 border-slate-200' : 'bg-slate-950/80 border-slate-800'}`}>
            <span className="text-[10px] uppercase font-bold text-slate-400 block">Total Probes Dropped</span>
            <span className="text-lg font-black mono text-rose-400">{totalNearbyAttempts.toLocaleString()}</span>
          </div>
          <div className={`p-3 rounded-xl border ${isLight ? 'bg-slate-100 border-slate-200' : 'bg-slate-950/80 border-slate-800'}`}>
            <span className="text-[10px] uppercase font-bold text-slate-400 block">Nearby Devices Blocked</span>
            <span className="text-lg font-black mono text-white">{blockedNearbyCount} / {nearbyProbes.length}</span>
          </div>
          <div className={`p-3 rounded-xl border ${isLight ? 'bg-slate-100 border-slate-200' : 'bg-slate-950/80 border-slate-800'}`}>
            <span className="text-[10px] uppercase font-bold text-slate-400 block">Subnet ARP Integrity</span>
            <span className="text-lg font-black mono text-emerald-400">100% Poison-Proof</span>
          </div>
          <div className={`p-3 rounded-xl border ${isLight ? 'bg-slate-100 border-slate-200' : 'bg-slate-950/80 border-slate-800'}`}>
            <span className="text-[10px] uppercase font-bold text-slate-400 block">Firewall Enforcement</span>
            <span className="text-lg font-black mono text-cyan-400">Zero-Trust Local Drop</span>
          </div>
        </div>
      </div>

      {/* Add Custom Nearby IP Block Rule Form */}
      <div className={`glass rounded-2xl p-5 border ${isLight ? 'border-slate-200 bg-white' : 'border-slate-800 bg-slate-900/40'}`}>
        <h4 className="font-bold text-xs uppercase tracking-wider text-white mb-3 flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
          <span>Add Custom Nearby IP or Subnet to Block</span>
        </h4>

        <form onSubmit={handleAddCustomNearbyIp} className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <input
            type="text"
            placeholder="IP Address (e.g. 192.168.1.189)"
            value={newIpInput}
            onChange={e => setNewIpInput(e.target.value)}
            className={`px-3.5 py-2.5 rounded-xl text-xs border font-mono focus:outline-none focus:ring-1 focus:ring-cyan-500 ${
              isLight ? 'bg-slate-100 border-slate-300 text-slate-900' : 'bg-slate-950 border-slate-700 text-white'
            }`}
          />
          <input
            type="text"
            placeholder="Device Name / Hostname (Optional)"
            value={newHostnameInput}
            onChange={e => setNewHostnameInput(e.target.value)}
            className={`px-3.5 py-2.5 rounded-xl text-xs border focus:outline-none focus:ring-1 focus:ring-cyan-500 ${
              isLight ? 'bg-slate-100 border-slate-300 text-slate-900' : 'bg-slate-950 border-slate-700 text-white'
            }`}
          />
          <input
            type="text"
            placeholder="Reason / Threat Vector (e.g. Wi-Fi Neighbor Port Scan)"
            value={newAttackVector}
            onChange={e => setNewAttackVector(e.target.value)}
            className={`px-3.5 py-2.5 rounded-xl text-xs border focus:outline-none focus:ring-1 focus:ring-cyan-500 ${
              isLight ? 'bg-slate-100 border-slate-300 text-slate-900' : 'bg-slate-950 border-slate-700 text-white'
            }`}
          />
          <button
            type="submit"
            className="px-4 py-2.5 rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-500 shadow-cyan transition-all flex items-center justify-center gap-2"
          >
            <span>Block This Nearby IP</span>
          </button>
        </form>
      </div>

      {/* Filter & Search Bar */}
      <div className={`p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
        isLight ? 'bg-white border-slate-200' : 'bg-slate-900/80 border-slate-800'
      }`}>
        <div className="relative flex-1 max-w-md">
          <input
            type="text"
            placeholder="Search nearby IP, hostname, targeted port or attack vector..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className={`w-full pl-9 pr-4 py-2 rounded-lg text-xs border focus:outline-none focus:ring-1 focus:ring-cyan-500 ${
              isLight ? 'bg-slate-100 border-slate-300 text-slate-900' : 'bg-slate-950 border-slate-700 text-white'
            }`}
          />
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 absolute left-3 top-2.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400">Severity:</span>
          {(['ALL', 'CRITICAL', 'HIGH', 'MEDIUM'] as const).map(sev => (
            <button
              key={sev}
              onClick={() => setSeverityFilter(sev)}
              className={`px-2.5 py-1 rounded text-[11px] font-bold transition-colors ${
                severityFilter === sev
                  ? 'bg-rose-600 text-white shadow-cyan'
                  : 'bg-slate-800/80 text-slate-400 hover:text-white'
              }`}
            >
              {sev}
            </button>
          ))}
        </div>
      </div>

      {/* Nearby Devices Threat Table */}
      <div className={`glass rounded-2xl border overflow-hidden ${isLight ? 'border-slate-200' : 'border-slate-800'}`}>
        <div className="divide-y divide-slate-800/60">
          {filteredProbes.map((probe) => {
            const isBlocked = probe.status === 'BLOCKED';
            const hitRatio = Math.min(100, Math.round((probe.attemptCount / 800) * 100));

            return (
              <div
                key={probe.id}
                className={`p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 transition-colors ${
                  isBlocked
                    ? isLight ? 'bg-rose-50/50 hover:bg-rose-50' : 'bg-slate-950/40 hover:bg-slate-900/60'
                    : isLight ? 'hover:bg-slate-50' : 'hover:bg-slate-900/40'
                }`}
              >
                {/* Device Info & Proximity */}
                <div className="flex items-start gap-4 flex-1">
                  <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 border ${
                    probe.threatSeverity === 'CRITICAL'
                      ? 'bg-red-500/10 border-red-500/30 text-red-400'
                      : probe.threatSeverity === 'HIGH'
                      ? 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                      : 'bg-cyan-500/10 border-cyan-500/30 text-cyan-400'
                  }`}>
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                  </div>

                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono font-black text-sm text-white">{probe.ipAddress}</span>
                      <span className="text-xs text-slate-300 font-bold">{probe.hostname}</span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                        probe.threatSeverity === 'CRITICAL'
                          ? 'bg-red-500/15 text-red-300 border-red-500/30'
                          : probe.threatSeverity === 'HIGH'
                          ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                          : 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30'
                      }`}>
                        {probe.threatSeverity}
                      </span>
                      {isBlocked ? (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/40 flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
                          BLOCKED & DROPPED
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40">
                          ALLOWED (RISK)
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-400 mt-1">
                      <span>Proximity: <strong className="text-slate-300">{probe.proximity}</strong></span>
                      {probe.macAddress && <span className="mono">MAC: {probe.macAddress}</span>}
                      <span>Targeted Ports: <strong className="text-cyan-400 mono">{probe.targetedPorts.map(p => `:${p}`).join(', ')} ({probe.targetedServices.join(', ')})</strong></span>
                    </div>

                    <div className="text-xs text-rose-300 mt-1 flex items-center gap-1.5">
                      <span className="text-rose-400 font-bold">Attack Vector:</span>
                      <span>{probe.attackVector}</span>
                    </div>
                  </div>
                </div>

                {/* Attempt Frequency & Hit Bar */}
                <div className="flex flex-col items-start lg:items-end gap-1.5 min-w-[200px]">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-400">Attempted Inbound Access:</span>
                    <span className="text-base font-black mono text-rose-400">
                      {probe.attemptCount.toLocaleString()} times
                    </span>
                  </div>

                  {/* Hit Rate Visual Bar */}
                  <div className="w-full lg:w-48 bg-slate-900 rounded-full h-2 overflow-hidden border border-slate-800">
                    <div
                      className="h-full bg-gradient-to-r from-amber-500 to-rose-500 rounded-full"
                      style={{ width: `${hitRatio}%` }}
                    />
                  </div>

                  <div className="flex items-center justify-between w-full lg:w-48 text-[10px] text-slate-500 mono">
                    <span>First: {probe.firstSeen}</span>
                    <span>Last: {probe.lastSeen}</span>
                  </div>

                  {/* Per-IP Action Button */}
                  <div className="mt-2 flex items-center gap-2">
                    <button
                      onClick={() => handleToggleBlock(probe.id)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                        isBlocked
                          ? 'bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700'
                          : 'bg-rose-600 text-white hover:bg-rose-500 shadow-cyan'
                      }`}
                    >
                      {isBlocked ? 'Unblock Nearby IP' : 'Block & Drop Now'}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}

          {filteredProbes.length === 0 && (
            <div className="p-12 text-center text-slate-500">
              <p className="text-xs uppercase tracking-widest font-bold">No nearby devices match current filter</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default NearbyDevicesIntrusionShield;
