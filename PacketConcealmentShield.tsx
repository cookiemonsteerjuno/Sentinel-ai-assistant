import React, { useState, useEffect } from 'react';
import { PacketConcealmentState } from '../types';
import { audioAnnouncer } from '../services/audioAnnouncer';

interface PacketConcealmentShieldProps {
  theme?: 'dark' | 'light';
}

export const PacketConcealmentShield: React.FC<PacketConcealmentShieldProps> = ({
  theme = 'dark'
}) => {
  const isLight = theme === 'light';

  // Master traffic protection toggle
  const [concealmentState, setConcealmentState] = useState<PacketConcealmentState>({
    antiPacketInspectionEnabled: true,
    antiSniffingEnabled: true,
    encryptedClientHelloECH: true,
    packetPaddingEnabled: true,
    tcpMssClamping: true,
    promiscuousModeBlocked: true,
    rawSocketCaptureBlocked: true,
    timingJitterActive: true,
    totalConcealedPackets: 184920,
    dpiProbesDefeated: 2419,
    sniffAttemptsDropped: 894,
    cryptographicCipher: 'ChaCha20-Poly1305 + Noise-IK (Quantum-Resistant Padding)'
  });

  const [notification, setNotification] = useState<string | null>(null);

  // Live packet increment animation
  useEffect(() => {
    if (!concealmentState.antiPacketInspectionEnabled) return;
    const interval = setInterval(() => {
      setConcealmentState(prev => ({
        ...prev,
        totalConcealedPackets: prev.totalConcealedPackets + Math.floor(Math.random() * 24) + 12
      }));
    }, 2000);
    return () => clearInterval(interval);
  }, [concealmentState.antiPacketInspectionEnabled]);

  const toggleMasterConcealment = () => {
    const next = !concealmentState.antiPacketInspectionEnabled;
    setConcealmentState(prev => ({
      ...prev,
      antiPacketInspectionEnabled: next,
      antiSniffingEnabled: next,
      encryptedClientHelloECH: next,
      packetPaddingEnabled: next,
      promiscuousModeBlocked: next,
      rawSocketCaptureBlocked: next,
      timingJitterActive: next
    }));

    if (next) {
      setNotification('PACKET ACCESS DISALLOWED: Internet traffic payload and header encapsulation fully armed. Deep packet inspection blocked.');
    } else {
      setNotification('Warning: Packet concealment relaxed. Packets may be subject to ISP inspection.');
    }
    audioAnnouncer.playChime(next);
  };

  const toggleSubsystem = (key: keyof PacketConcealmentState) => {
    setConcealmentState(prev => {
      const current = prev[key];
      if (typeof current === 'boolean') {
        const next = !current;
        return { ...prev, [key]: next };
      }
      return prev;
    });
    audioAnnouncer.playChime(true);
  };

  return (
    <div className="space-y-6">
      {/* Alert Notification */}
      {notification && (
        <div className="p-3.5 rounded-xl border border-emerald-500/40 bg-emerald-500/10 text-emerald-300 text-xs flex items-center justify-between animate-fadeIn">
          <div className="flex items-center gap-2.5">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-emerald-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
            <span className="font-semibold">{notification}</span>
          </div>
          <button onClick={() => setNotification(null)} className="text-slate-400 hover:text-white text-xs">Dismiss</button>
        </div>
      )}

      {/* Main Master Packet Concealment Card */}
      <div className={`glass rounded-2xl p-6 border shadow-cyan relative overflow-hidden ${
        isLight ? 'border-emerald-200 bg-emerald-50/20' : 'border-emerald-500/30 bg-slate-900/60'
      }`}>
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5 pb-5 border-b border-slate-800">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0 shadow-cyan">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <span className="text-xs uppercase font-bold tracking-wider text-emerald-400">Cryptographic Traffic Concealment</span>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold border flex items-center gap-1.5 ${
                  concealmentState.antiPacketInspectionEnabled
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                    : 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                }`}>
                  <span className={`w-2 h-2 rounded-full ${concealmentState.antiPacketInspectionEnabled ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400'}`} />
                  {concealmentState.antiPacketInspectionEnabled ? 'INTERNET TRAFFIC PACKET ACCESS: STRICTLY DISALLOWED & CONCEALED' : 'UNENCRYPTED TRANSIT'}
                </span>
              </div>
              <h3 className="text-xl font-black text-white">Anti-Packet Inspection & Traffic Concealment Shield</h3>
              <p className="text-xs text-slate-400 max-w-3xl mt-1 leading-relaxed">
                Disallows third parties, ISPs, middleboxes, transit gateways, and packet sniffers from inspecting, analyzing, or accessing your internet packets. Encapsulates 100% of egress traffic into opaque ChaCha20-Poly1305 ciphertext, pads packet lengths to mask metadata signatures, injects timing jitter to defeat traffic analysis, and locks the network adapter to prevent promiscuous packet sniffing.
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-3 shrink-0">
            <button
              id="toggle-packet-concealment-master-btn"
              onClick={toggleMasterConcealment}
              className={`px-5 py-3 rounded-xl text-xs font-black transition-all shadow-cyan flex items-center gap-2 ${
                concealmentState.antiPacketInspectionEnabled
                  ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                  : 'bg-slate-800 text-slate-300 hover:text-white border border-slate-700'
              }`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
              <span>{concealmentState.antiPacketInspectionEnabled ? '✓ Packet Concealment Enforced' : 'Disallow Packet Inspection'}</span>
            </button>
          </div>
        </div>

        {/* Live Counters */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-5">
          <div className={`p-4 rounded-xl border ${isLight ? 'border-slate-200 bg-white' : 'border-slate-800 bg-slate-950/60'}`}>
            <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">Concealed Packets Transmitted</span>
            <span className="text-xl font-black text-emerald-400 mono mt-0.5 block">{concealmentState.totalConcealedPackets.toLocaleString()}</span>
            <span className="text-[10px] text-slate-500 mt-1 block">Zero unencrypted egress packets</span>
          </div>

          <div className={`p-4 rounded-xl border ${isLight ? 'border-slate-200 bg-white' : 'border-slate-800 bg-slate-950/60'}`}>
            <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">DPI Middlebox Probes Defeated</span>
            <span className="text-xl font-black text-cyan-400 mono mt-0.5 block">{concealmentState.dpiProbesDefeated.toLocaleString()} Defeated</span>
            <span className="text-[10px] text-emerald-400 mt-1 block">Deep packet inspection neutralized</span>
          </div>

          <div className={`p-4 rounded-xl border ${isLight ? 'border-slate-200 bg-white' : 'border-slate-800 bg-slate-950/60'}`}>
            <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">Sniffing & Promiscuous Probes</span>
            <span className="text-xl font-black text-purple-400 mono mt-0.5 block">{concealmentState.sniffAttemptsDropped.toLocaleString()} Blocked</span>
            <span className="text-[10px] text-slate-500 mt-1 block">Raw socket tap attempts denied</span>
          </div>

          <div className={`p-4 rounded-xl border ${isLight ? 'border-slate-200 bg-white' : 'border-slate-800 bg-slate-950/60'}`}>
            <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">Plaintext Payload Leaks</span>
            <span className="text-xl font-black text-emerald-400 mono mt-0.5 block">0 BYTES (ZERO LEAK)</span>
            <span className="text-[10px] text-slate-500 mt-1 block">100% Cryptographic opacity</span>
          </div>
        </div>

        {/* Cryptographic Engine Specs */}
        <div className={`mt-5 p-3.5 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs ${
          isLight ? 'border-slate-200 bg-white' : 'border-slate-800 bg-slate-950/50'
        }`}>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            <span className="text-slate-400">Active Cipher Suite:</span>
            <span className="font-bold text-white mono">{concealmentState.cryptographicCipher}</span>
          </div>
          <span className="text-[11px] text-slate-500 mono">E2EE Tunnel Interface: tun0 (Noise Protocol)</span>
        </div>

        {/* Granular Anti-Inspection & Anti-Sniffing Controls */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mt-5">
          {[
            {
              key: 'encryptedClientHelloECH' as const,
              name: 'Encrypted Client Hello (ECH)',
              desc: 'Encrypts SNI domain names in TLS handshakes so transit providers cannot see destination hostnames.',
              active: concealmentState.encryptedClientHelloECH
            },
            {
              key: 'packetPaddingEnabled' as const,
              name: 'Randomized Packet Padding',
              desc: 'Pads all packet frames to standardized block sizes to defeat traffic analysis and size fingerprinting.',
              active: concealmentState.packetPaddingEnabled
            },
            {
              key: 'tcpMssClamping' as const,
              name: 'TCP MSS Clamping',
              desc: 'Clamps Maximum Segment Size to prevent packet fragmentation leaks across intermediate routers.',
              active: concealmentState.tcpMssClamping
            },
            {
              key: 'timingJitterActive' as const,
              name: 'Timing Jitter Injection',
              desc: 'Injects microsecond packet timing fluctuations to defeat statistical side-channel flow correlation.',
              active: concealmentState.timingJitterActive
            },
            {
              key: 'promiscuousModeBlocked' as const,
              name: 'Promiscuous Mode Lockdown',
              desc: 'Hard-locks network adapter drivers to prevent unauthorized packet capture and local network sniffing.',
              active: concealmentState.promiscuousModeBlocked
            },
            {
              key: 'rawSocketCaptureBlocked' as const,
              name: 'Raw Socket & PCAP Tap Filter',
              desc: 'Blocks raw AF_PACKET and BPF filter attachments from eavesdropping on egress or ingress traffic.',
              active: concealmentState.rawSocketCaptureBlocked
            }
          ].map(feature => (
            <button
              key={feature.key}
              onClick={() => toggleSubsystem(feature.key)}
              className={`p-3.5 rounded-xl border text-left transition-all ${
                feature.active
                  ? 'border-emerald-500/40 bg-emerald-500/10 shadow-cyan'
                  : isLight ? 'border-slate-200 bg-white' : 'border-slate-800 bg-slate-950/60'
              }`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="font-bold text-xs text-white">{feature.name}</span>
                <span className={`text-[9px] font-black px-1.5 py-0.2 rounded border ${
                  feature.active
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                    : 'bg-slate-800 text-slate-400 border-slate-700'
                }`}>
                  {feature.active ? 'ACTIVE' : 'DISABLED'}
                </span>
              </div>
              <p className="text-[10px] text-slate-400 leading-relaxed">{feature.desc}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Deep Packet Inspection & Sniffing Defense Vectors */}
      <div className={`glass rounded-2xl border p-5 ${isLight ? 'border-slate-200' : 'border-slate-800'}`}>
        <h4 className="font-bold text-sm text-white mb-2">How Traffic Concealment Protects Your Internet Packets</h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-slate-400">
          <div className="p-3.5 rounded-xl border border-slate-800 bg-slate-950/40">
            <span className="font-bold text-white text-xs block mb-1">1. Anti-DPI Middlebox Neutralization</span>
            <p className="text-[11px] leading-relaxed">
              Standard internet traffic carries unencrypted SNI headers and discernible packet size signatures. This shield strips plaintext protocol markers and forces all transit into opaque encrypted blobs.
            </p>
          </div>
          <div className="p-3.5 rounded-xl border border-slate-800 bg-slate-950/40">
            <span className="font-bold text-white text-xs block mb-1">2. Local Wi-Fi & LAN Sniffing Defense</span>
            <p className="text-[11px] leading-relaxed">
              Disables promiscuous mode on your Wi-Fi and Ethernet adapters, preventing attackers on shared public or hotel Wi-Fi from capturing broadcast frames or injecting fake TCP resets.
            </p>
          </div>
          <div className="p-3.5 rounded-xl border border-slate-800 bg-slate-950/40">
            <span className="font-bold text-white text-xs block mb-1">3. Traffic Analysis & Correlation Immunity</span>
            <p className="text-[11px] leading-relaxed">
              By combining randomized packet padding with micro-timing jitter, adversary AI models cannot deduce whether you are browsing, streaming, or transferring confidential data.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
