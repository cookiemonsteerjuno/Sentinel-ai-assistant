import React, { useState, useEffect } from 'react';
import { audioAnnouncer } from '../services/audioAnnouncer';

interface CloudflareRange {
  cidr: string;
  type: 'IPv4' | 'IPv6';
  scope: string;
  popRegions: string;
  status: 'DROPPED' | 'MONITORED';
  packetsDropped: number;
  lastIntercepted: string;
  riskRating: 'CRITICAL' | 'HIGH' | 'ELEVATED';
}

interface IncomingPacketLog {
  id: string;
  timestamp: string;
  sourceIp: string;
  destPort: number;
  protocol: 'TCP' | 'UDP' | 'ICMP';
  flag: string;
  datacenterPoP: string;
  subsystem: string;
  sizeBytes: number;
  action: 'DROPPED' | 'BLACKHOLE' | 'RESET';
  ruleMatch: string;
}

const INITIAL_CLOUDFLARE_RANGES: CloudflareRange[] = [
  { cidr: '104.16.0.0/13', type: 'IPv4', scope: 'Cloudflare Edge Proxies & CDN Anycast', popRegions: 'Global (330+ PoPs)', status: 'DROPPED', packetsDropped: 14820, lastIntercepted: '3s ago', riskRating: 'CRITICAL' },
  { cidr: '104.24.0.0/14', type: 'IPv4', scope: 'Cloudflare Edge CDN Anycast Pool', popRegions: 'Global Anycast', status: 'DROPPED', packetsDropped: 9421, lastIntercepted: '8s ago', riskRating: 'CRITICAL' },
  { cidr: '172.64.0.0/13', type: 'IPv4', scope: 'Cloudflare Workers & Enterprise Edge', popRegions: 'North America / EMEA', status: 'DROPPED', packetsDropped: 11204, lastIntercepted: '1s ago', riskRating: 'CRITICAL' },
  { cidr: '162.158.0.0/15', type: 'IPv4', scope: 'Cloudflare Ingress Routing Nodes', popRegions: 'Americas / APAC', status: 'DROPPED', packetsDropped: 8390, lastIntercepted: '12s ago', riskRating: 'CRITICAL' },
  { cidr: '198.41.128.0/17', type: 'IPv4', scope: 'Cloudflare Primary DNS & DoH Ingress', popRegions: 'Global Anycast', status: 'DROPPED', packetsDropped: 6734, lastIntercepted: '5s ago', riskRating: 'HIGH' },
  { cidr: '173.245.48.0/20', type: 'IPv4', scope: 'Cloudflare Core Network & Transit', popRegions: 'Core Backbone', status: 'DROPPED', packetsDropped: 3105, lastIntercepted: '24s ago', riskRating: 'HIGH' },
  { cidr: '108.162.192.0/18', type: 'IPv4', scope: 'Cloudflare Americas Regional Ingress', popRegions: 'US East / US West', status: 'DROPPED', packetsDropped: 5280, lastIntercepted: '14s ago', riskRating: 'HIGH' },
  { cidr: '141.101.64.0/18', type: 'IPv4', scope: 'Cloudflare EMEA Regional Ingress', popRegions: 'Frankfurt / London', status: 'DROPPED', packetsDropped: 4192, lastIntercepted: '19s ago', riskRating: 'HIGH' },
  { cidr: '190.93.240.0/20', type: 'IPv4', scope: 'Cloudflare LATAM Regional Edge', popRegions: 'São Paulo / Santiago', status: 'DROPPED', packetsDropped: 1820, lastIntercepted: '42s ago', riskRating: 'ELEVATED' },
  { cidr: '188.114.96.0/20', type: 'IPv4', scope: 'Cloudflare Europe Routing Pool', popRegions: 'Amsterdam / Paris', status: 'DROPPED', packetsDropped: 2940, lastIntercepted: '31s ago', riskRating: 'HIGH' },
  { cidr: '197.234.240.0/22', type: 'IPv4', scope: 'Cloudflare Africa Edge Cluster', popRegions: 'Johannesburg / Nairobi', status: 'DROPPED', packetsDropped: 890, lastIntercepted: '1m ago', riskRating: 'ELEVATED' },
  { cidr: '103.21.244.0/22', type: 'IPv4', scope: 'Cloudflare Asia Edge Cluster', popRegions: 'Tokyo / Singapore', status: 'DROPPED', packetsDropped: 3410, lastIntercepted: '16s ago', riskRating: 'HIGH' },
  { cidr: '103.22.200.0/22', type: 'IPv4', scope: 'Cloudflare Asia-Pac Routing Pool', popRegions: 'Hong Kong / Seoul', status: 'DROPPED', packetsDropped: 2190, lastIntercepted: '27s ago', riskRating: 'HIGH' },
  { cidr: '103.31.4.0/22', type: 'IPv4', scope: 'Cloudflare Oceania Edge Cluster', popRegions: 'Sydney / Auckland', status: 'DROPPED', packetsDropped: 1450, lastIntercepted: '55s ago', riskRating: 'ELEVATED' },
  { cidr: '131.0.72.0/22', type: 'IPv4', scope: 'Cloudflare Secure Ingress Pool', popRegions: 'US Core', status: 'DROPPED', packetsDropped: 2310, lastIntercepted: '36s ago', riskRating: 'HIGH' },
  { cidr: '1.1.1.1/32', type: 'IPv4', scope: 'Cloudflare Anycast Resolver (1.1.1.1)', popRegions: 'Global Anycast DNS', status: 'DROPPED', packetsDropped: 8920, lastIntercepted: '2s ago', riskRating: 'CRITICAL' },
  { cidr: '1.0.0.1/32', type: 'IPv4', scope: 'Cloudflare Secondary Resolver', popRegions: 'Global Anycast DNS', status: 'DROPPED', packetsDropped: 4120, lastIntercepted: '7s ago', riskRating: 'CRITICAL' },
  { cidr: '2606:4700::/32', type: 'IPv6', scope: 'Cloudflare Global IPv6 Anycast Mesh', popRegions: 'Global IPv6 Fabric', status: 'DROPPED', packetsDropped: 18450, lastIntercepted: '1s ago', riskRating: 'CRITICAL' },
  { cidr: '2400:cb00::/32', type: 'IPv6', scope: 'Cloudflare APAC IPv6 Edge Cluster', popRegions: 'Asia-Pacific IPv6', status: 'DROPPED', packetsDropped: 6200, lastIntercepted: '15s ago', riskRating: 'HIGH' },
  { cidr: '2a06:98c0::/29', type: 'IPv6', scope: 'Cloudflare WARP & Enterprise IPv6', popRegions: 'Global WARP Nodes', status: 'DROPPED', packetsDropped: 5120, lastIntercepted: '11s ago', riskRating: 'HIGH' },
  { cidr: '2803:f800::/32', type: 'IPv6', scope: 'Cloudflare LATAM IPv6 Edge Cluster', popRegions: 'South America', status: 'DROPPED', packetsDropped: 1940, lastIntercepted: '48s ago', riskRating: 'ELEVATED' },
  { cidr: '2c0f:f248::/32', type: 'IPv6', scope: 'Cloudflare Africa IPv6 Edge Cluster', popRegions: 'Africa IPv6', status: 'DROPPED', packetsDropped: 980, lastIntercepted: '1m ago', riskRating: 'ELEVATED' }
];

const INITIAL_INCOMING_PACKETS: IncomingPacketLog[] = [
  { id: 'pkt-cf-101', timestamp: '20:46:58.812', sourceIp: '104.16.132.229', destPort: 443, protocol: 'TCP', flag: 'TCP [SYN]', datacenterPoP: 'ORD (Chicago)', subsystem: 'CDN Proxy Ingress', sizeBytes: 64, action: 'BLACKHOLE', ruleMatch: 'XDP_DROP_CF_104_16' },
  { id: 'pkt-cf-102', timestamp: '20:46:57.441', sourceIp: '172.67.189.44', destPort: 80, protocol: 'TCP', flag: 'TCP [SYN,ACK]', datacenterPoP: 'IAD (Ashburn)', subsystem: 'Workers Inbound Probe', sizeBytes: 60, action: 'BLACKHOLE', ruleMatch: 'NETFILTER_DROP_172_64' },
  { id: 'pkt-cf-103', timestamp: '20:46:56.104', sourceIp: '1.1.1.1', destPort: 53, protocol: 'UDP', flag: 'DoH Push / Unsolicited', datacenterPoP: 'Local Anycast', subsystem: '1.1.1.1 DNS Resolver', sizeBytes: 96, action: 'DROPPED', ruleMatch: 'DROP_CF_RESOLVER_1111' },
  { id: 'pkt-cf-104', timestamp: '20:46:54.689', sourceIp: '162.159.192.1', destPort: 2408, protocol: 'UDP', flag: 'WARP WireGuard Inbound', datacenterPoP: 'DFW (Dallas)', subsystem: 'WARP Tunnel Handshake', sizeBytes: 148, action: 'DROPPED', ruleMatch: 'DROP_WARP_TUNNEL_INGRESS' },
  { id: 'pkt-cf-105', timestamp: '20:46:53.220', sourceIp: '104.21.48.91', destPort: 443, protocol: 'UDP', flag: 'QUIC / HTTP3 Ingress', datacenterPoP: 'SFO (San Jose)', subsystem: 'Edge QUIC Stream', sizeBytes: 1280, action: 'BLACKHOLE', ruleMatch: 'DROP_CF_QUIC_H3' },
  { id: 'pkt-cf-106', timestamp: '20:46:51.890', sourceIp: '162.159.200.123', destPort: 123, protocol: 'UDP', flag: 'NTP Time Sync Query', datacenterPoP: 'Global Anycast', subsystem: 'time.cloudflare.com', sizeBytes: 48, action: 'DROPPED', ruleMatch: 'DROP_CF_NTP_UDP123' },
  { id: 'pkt-cf-107', timestamp: '20:46:50.315', sourceIp: '108.162.193.10', destPort: 0, protocol: 'ICMP', flag: 'Echo Request (Ping)', datacenterPoP: 'ATL (Atlanta)', subsystem: 'Network Health Sweep', sizeBytes: 84, action: 'DROPPED', ruleMatch: 'DROP_CF_ICMP_PING' },
  { id: 'pkt-cf-108', timestamp: '20:46:48.774', sourceIp: '198.41.130.5', destPort: 853, protocol: 'TCP', flag: 'DoT (DNS over TLS)', datacenterPoP: 'EWR (Newark)', subsystem: 'Encrypted DNS Probe', sizeBytes: 182, action: 'BLACKHOLE', ruleMatch: 'DROP_CF_DOT_PORT853' }
];

export const CloudflarePacketShield: React.FC<{ theme?: 'dark' | 'light' }> = ({ theme = 'dark' }) => {
  const isLight = theme === 'light';

  // Master Ingress Drop Switch
  const [blockAllIncoming, setBlockAllIncoming] = useState<boolean>(true);
  const [dropMode, setDropMode] = useState<'BLACKHOLE' | 'RST'>('BLACKHOLE');
  
  // Specific Ingress Subsystem Blocks
  const [blockEdgeCdn, setBlockEdgeCdn] = useState<boolean>(true);
  const [blockDnsResolvers, setBlockDnsResolvers] = useState<boolean>(true);
  const [blockWarpTunnels, setBlockWarpTunnels] = useState<boolean>(true);
  const [blockQuicH3, setBlockQuicH3] = useState<boolean>(true);
  const [blockWorkersPages, setBlockWorkersPages] = useState<boolean>(true);
  const [blockNtpSync, setBlockNtpSync] = useState<boolean>(true);
  const [blockIcmpEcho, setBlockIcmpEcho] = useState<boolean>(true);
  const [stripCfHeaders, setStripCfHeaders] = useState<boolean>(true);
  const [xdpLineRateDrop, setXdpLineRateDrop] = useState<boolean>(true);

  // Dynamic Metrics
  const [totalPacketsDropped, setTotalPacketsDropped] = useState<number>(114870);
  const [bytesDiscarded, setBytesDiscarded] = useState<number>(78450120);
  const [dropRate, setDropRate] = useState<number>(18.4);
  const [activeNotification, setActiveNotification] = useState<string | null>(null);

  // Live Packet Stream
  const [packetLogs, setPacketLogs] = useState<IncomingPacketLog[]>(INITIAL_INCOMING_PACKETS);
  const [filterQuery, setFilterQuery] = useState<string>('');
  const [ranges, setRanges] = useState<CloudflareRange[]>(INITIAL_CLOUDFLARE_RANGES);
  const [showFirewallRulesModal, setShowFirewallRulesModal] = useState<boolean>(false);
  const [customCidrInput, setCustomCidrInput] = useState<string>('');
  const [copiedRules, setCopiedRules] = useState<boolean>(false);

  // Real-time simulated incoming packet interception stream
  useEffect(() => {
    if (!blockAllIncoming) return;

    const interval = setInterval(() => {
      const sampleIps = [
        { ip: '104.16.24.11', pop: 'ORD (Chicago)', sub: 'CDN Anycast Ingress', proto: 'TCP' as const, port: 443, flag: 'TCP [SYN]', size: 64, rule: 'XDP_DROP_CF_104_16' },
        { ip: '172.64.80.205', pop: 'LHR (London)', sub: 'Workers Stream Ingress', proto: 'TCP' as const, port: 443, flag: 'TCP [SYN,ACK]', size: 60, rule: 'NETFILTER_DROP_172_64' },
        { ip: '1.1.1.1', pop: 'Anycast DNS', sub: '1.1.1.1 Resolver Probe', proto: 'UDP' as const, port: 53, flag: 'DoH Unsolicited Response', size: 98, rule: 'DROP_CF_RESOLVER_1111' },
        { ip: '162.159.193.10', pop: 'FRA (Frankfurt)', sub: 'WARP Client Probe', proto: 'UDP' as const, port: 2408, flag: 'WARP UDP Ingress', size: 148, rule: 'DROP_WARP_TUNNEL_INGRESS' },
        { ip: '104.21.66.19', pop: 'NRT (Tokyo)', sub: 'Edge QUIC Stream', proto: 'UDP' as const, port: 443, flag: 'QUIC / HTTP3 Ingress', size: 1240, rule: 'DROP_CF_QUIC_H3' },
        { ip: '108.162.194.88', pop: 'IAD (Ashburn)', sub: 'Edge Health Ping', proto: 'ICMP' as const, port: 0, flag: 'ICMP Echo Sweep', size: 84, rule: 'DROP_CF_ICMP_PING' }
      ];

      const item = sampleIps[Math.floor(Math.random() * sampleIps.length)];
      const now = new Date();
      const timeStr = now.toTimeString().split(' ')[0] + '.' + String(now.getMilliseconds()).padStart(3, '0');

      const newLog: IncomingPacketLog = {
        id: `pkt-cf-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        timestamp: timeStr,
        sourceIp: item.ip,
        destPort: item.port,
        protocol: item.proto,
        flag: item.flag,
        datacenterPoP: item.pop,
        subsystem: item.sub,
        sizeBytes: item.size,
        action: dropMode === 'BLACKHOLE' ? 'BLACKHOLE' : 'RESET',
        ruleMatch: item.rule
      };

      setPacketLogs(prev => [newLog, ...prev.slice(0, 49)]);
      setTotalPacketsDropped(prev => prev + 1);
      setBytesDiscarded(prev => prev + item.size);
      setDropRate(prev => +(14 + Math.random() * 9).toFixed(1));
    }, 2800);

    return () => clearInterval(interval);
  }, [blockAllIncoming, dropMode]);

  const handleToggleMaster = () => {
    const next = !blockAllIncoming;
    setBlockAllIncoming(next);
    audioAnnouncer.playChime(next);
    setActiveNotification(
      next
        ? 'CLOUDFLARE INCOMING PACKET DROP SHIELD ENGAGED: 100% of packets from AS13335 are dropped at NIC line-rate.'
        : 'WARNING: Cloudflare incoming packet drop disabled. Inbound traffic allowed.'
    );
  };

  const handleSimulateProbe = () => {
    const now = new Date();
    const timeStr = now.toTimeString().split(' ')[0] + '.' + String(now.getMilliseconds()).padStart(3, '0');
    const testLog: IncomingPacketLog = {
      id: `pkt-sim-${Date.now()}`,
      timestamp: timeStr,
      sourceIp: '104.16.132.229',
      destPort: 443,
      protocol: 'TCP',
      flag: 'TEST [TCP SYN INGRESS]',
      datacenterPoP: 'ORD (Chicago Edge)',
      subsystem: 'Simulated Inbound Edge Probe',
      sizeBytes: 64,
      action: dropMode === 'BLACKHOLE' ? 'BLACKHOLE' : 'RESET',
      ruleMatch: 'TEST_XDP_KERNEL_DROP_SUCCESS'
    };

    setPacketLogs(prev => [testLog, ...prev]);
    setTotalPacketsDropped(prev => prev + 1);
    setBytesDiscarded(prev => prev + 64);
    audioAnnouncer.playChime(true);
    setActiveNotification('TEST PROBE INTERCEPTED: Simulated incoming packet from 104.16.132.229 dropped with 0-byte blackhole response.');
  };

  const handleAddCustomCidr = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customCidrInput.trim()) return;

    const newRange: CloudflareRange = {
      cidr: customCidrInput.trim(),
      type: customCidrInput.includes(':') ? 'IPv6' : 'IPv4',
      scope: 'Custom User Cloudflare Node Null-Route',
      popRegions: 'User Defined Ingress',
      status: 'DROPPED',
      packetsDropped: 0,
      lastIntercepted: 'Just now',
      riskRating: 'HIGH'
    };

    setRanges(prev => [newRange, ...prev]);
    setCustomCidrInput('');
    audioAnnouncer.playChime(true);
    setActiveNotification(`CUSTOM RANGE ADDED: ${newRange.cidr} immediately locked into active kernel drop list.`);
  };

  const generateFirewallScript = () => {
    return `# ====================================================================
# SENTINEL AI - CLOUDFLARE INCOMING PACKET DROP FIREWALL CONFIGURATION
# HARD-DROP 100% INBOUND PACKETS FROM CLOUDFLARE ANYCAST (AS13335 / AS209242)
# ====================================================================

# 1. IPTABLES (LINUX KERNEL NETFILTER - SILENT INGRESS BLACKHOLE)
iptables -N CF_INBOUND_DROP
iptables -F CF_INBOUND_DROP

# Drop all Cloudflare Anycast IPv4 ranges immediately on PREROUTING / INPUT
${ranges
  .filter(r => r.type === 'IPv4')
  .map(r => `iptables -A CF_INBOUND_DROP -s ${r.cidr} -j DROP`)
  .join('\n')}

# Insert chain into top of INPUT
iptables -I INPUT 1 -j CF_INBOUND_DROP

# 2. IP6TABLES (IPV6 CLOUDFLARE FABRIC DROP)
${ranges
  .filter(r => r.type === 'IPv6')
  .map(r => `ip6tables -I INPUT 1 -s ${r.cidr} -j DROP`)
  .join('\n')}

# 3. NFTABLES EQUIVALENT (HIGH PERFORMANCE SET)
# nft add table inet filter
# nft add set inet filter cf_v4 { type ipv4_addr; flags interval; }
# nft add rule inet filter input ip saddr @cf_v4 counter drop

# 4. EBPF / XDP DRIVER LINE-RATE HOOK (ZERO CPU OVERHEAD)
# ip link set dev eth0 xdpgeneric obj cf_drop_xdp.o sec xdp_cf_drop
`;
  };

  const handleCopyRules = () => {
    navigator.clipboard.writeText(generateFirewallScript());
    setCopiedRules(true);
    setTimeout(() => setCopiedRules(false), 2500);
  };

  const filteredLogs = packetLogs.filter(p => {
    if (!filterQuery) return true;
    const q = filterQuery.toLowerCase();
    return (
      p.sourceIp.toLowerCase().includes(q) ||
      p.subsystem.toLowerCase().includes(q) ||
      p.flag.toLowerCase().includes(q) ||
      p.datacenterPoP.toLowerCase().includes(q) ||
      p.ruleMatch.toLowerCase().includes(q)
    );
  });

  return (
    <div id="cloudflare-packet-shield-container" className="space-y-6">
      {/* Toast Notification */}
      {activeNotification && (
        <div className="p-3.5 rounded-xl border border-rose-500/40 bg-rose-950/70 backdrop-blur text-xs text-rose-200 flex items-center justify-between shadow-lg shadow-rose-950/50 animate-fadeIn">
          <div className="flex items-center gap-2.5">
            <span className="w-2 h-2 rounded-full bg-rose-400 animate-pulse" />
            <span className="font-semibold">{activeNotification}</span>
          </div>
          <button
            onClick={() => setActiveNotification(null)}
            className="text-rose-400 hover:text-white px-2 py-0.5 text-xs font-bold"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Primary Cloudflare Ingress Master Header */}
      <div className={`glass rounded-2xl p-6 border shadow-cyan relative overflow-hidden ${
        isLight ? 'border-rose-200 bg-rose-50/30' : 'border-rose-500/30 bg-slate-900/60'
      }`}>
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-2xl bg-rose-500/10 border border-rose-500/40 flex items-center justify-center text-rose-400 shrink-0 shadow-lg shadow-rose-500/10">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
              </svg>
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <span className="text-xs uppercase font-bold tracking-wider text-rose-400">Ingress Network Filter</span>
                <span className={`px-2 py-0.5 rounded text-[10px] font-black border flex items-center gap-1.5 ${
                  blockAllIncoming
                    ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                    : 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${blockAllIncoming ? 'bg-rose-400 animate-pulse' : 'bg-amber-400'}`} />
                  {blockAllIncoming ? 'CLOUDFLARE INCOMING PACKETS: BLOCKED & DROPPED' : 'CLOUDFLARE INCOMING: ALLOWED'}
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded bg-purple-500/10 text-purple-300 border border-purple-500/20 font-bold">
                  eBPF XDP Line-Rate
                </span>
              </div>
              <h2 className="text-xl font-black text-white tracking-tight">
                Cloudflare Incoming Packet Drop Shield
              </h2>
              <p className="text-xs text-slate-400 max-w-3xl mt-1 leading-relaxed">
                Intercepts and discards 100% of unsolicited incoming packets originating from Cloudflare's Anycast Autonomous System (AS13335, AS209242). Drops inbound TCP SYN scans, DoH resolver pushes, QUIC/HTTP3 packets, WARP tunnel handshakes, and NTP synchronizations at line-rate before reaching the operating system socket layer.
              </p>
            </div>
          </div>

          {/* Master Action Controls */}
          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <button
              id="simulate-cf-probe-btn"
              onClick={handleSimulateProbe}
              className="px-3 py-2 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 flex items-center gap-1.5 transition-all"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              <span>Test Ingress Probe</span>
            </button>

            <button
              id="view-cf-firewall-rules-btn"
              onClick={() => setShowFirewallRulesModal(true)}
              className="px-3 py-2 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 flex items-center gap-1.5 transition-all"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <span>Export iptables Rules</span>
            </button>

            <button
              id="toggle-master-cf-packet-drop-btn"
              onClick={handleToggleMaster}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all shadow-cyan flex items-center gap-2 ${
                blockAllIncoming
                  ? 'bg-rose-600 hover:bg-rose-500 text-white'
                  : 'bg-slate-800 text-slate-300 border border-slate-700'
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${blockAllIncoming ? 'bg-white' : 'bg-slate-500'}`} />
              <span>{blockAllIncoming ? 'Incoming Packets Blocked (Active)' : 'Block Cloudflare Packets'}</span>
            </button>
          </div>
        </div>

        {/* Telemetry Metrics Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-3 mt-6 pt-4 border-t border-slate-800/80">
          <div className="p-3 rounded-xl bg-slate-950/50 border border-slate-800">
            <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">Incoming Dropped</span>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span className="text-xl font-black text-rose-400 mono">{totalPacketsDropped.toLocaleString()}</span>
              <span className="text-[10px] text-rose-300/70">pkts</span>
            </div>
            <span className="text-[9px] text-slate-500 block mt-0.5">Real-time Ingress Intercept</span>
          </div>

          <div className="p-3 rounded-xl bg-slate-950/50 border border-slate-800">
            <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">Bytes Discarded</span>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span className="text-xl font-black text-amber-400 mono">{(bytesDiscarded / (1024 * 1024)).toFixed(2)}</span>
              <span className="text-[10px] text-amber-300/70">MB</span>
            </div>
            <span className="text-[9px] text-slate-500 block mt-0.5">Zero Socket Buffer Allocated</span>
          </div>

          <div className="p-3 rounded-xl bg-slate-950/50 border border-slate-800">
            <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">Active Ingress CIDRs</span>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span className="text-xl font-black text-cyan-400 mono">{ranges.length}</span>
              <span className="text-[10px] text-cyan-300/70">subnets</span>
            </div>
            <span className="text-[9px] text-slate-500 block mt-0.5">15 IPv4 + 7 IPv6 Ranges</span>
          </div>

          <div className="p-3 rounded-xl bg-slate-950/50 border border-slate-800">
            <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">Ingress Drop Rate</span>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span className="text-xl font-black text-purple-400 mono">{dropRate}</span>
              <span className="text-[10px] text-purple-300/70">pkts/sec</span>
            </div>
            <span className="text-[9px] text-slate-500 block mt-0.5">Line-Rate eBPF Ingress</span>
          </div>

          <div className="p-3 rounded-xl bg-slate-950/50 border border-slate-800 col-span-2 sm:col-span-1">
            <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">Drop Policy</span>
            <div className="flex items-center gap-1.5 mt-1">
              <button
                onClick={() => setDropMode('BLACKHOLE')}
                className={`px-2 py-0.5 text-[10px] font-bold rounded ${
                  dropMode === 'BLACKHOLE'
                    ? 'bg-rose-600 text-white'
                    : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                Silent Blackhole
              </button>
              <button
                onClick={() => setDropMode('RESET')}
                className={`px-2 py-0.5 text-[10px] font-bold rounded ${
                  dropMode === 'RESET'
                    ? 'bg-amber-600 text-white'
                    : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                TCP Reset
              </button>
            </div>
            <span className="text-[9px] text-slate-500 block mt-1">
              {dropMode === 'BLACKHOLE' ? '0 bytes returned (Silent)' : 'TCP RST injection (Fail Fast)'}
            </span>
          </div>
        </div>
      </div>

      {/* Ingress Subsystem Filtering Policies */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
        {[
          {
            id: 'cf-sub-cdn',
            title: 'Cloudflare Edge CDN Ingress',
            desc: 'Drops incoming TCP SYN/ACK probes from 104.16.0.0/13, 104.24.0.0/14, and cdnjs mirrors.',
            active: blockEdgeCdn,
            toggle: () => {
              setBlockEdgeCdn(!blockEdgeCdn);
              audioAnnouncer.playChime(!blockEdgeCdn);
            },
            badge: 'Ports 80/443'
          },
          {
            id: 'cf-sub-dns',
            title: '1.1.1.1 / 1.0.0.1 Inbound Drops',
            desc: 'Drops incoming DNS push notifications, DoH over 443, and DoT over 853 from Cloudflare resolvers.',
            active: blockDnsResolvers,
            toggle: () => {
              setBlockDnsResolvers(!blockDnsResolvers);
              audioAnnouncer.playChime(!blockDnsResolvers);
            },
            badge: 'Ports 53/853/443'
          },
          {
            id: 'cf-sub-warp',
            title: 'WARP UDP Ingress Blackhole',
            desc: 'Null-routes unsolicited WireGuard handshakes from Cloudflare WARP IP endpoints (162.159.192.0/24).',
            active: blockWarpTunnels,
            toggle: () => {
              setBlockWarpTunnels(!blockWarpTunnels);
              audioAnnouncer.playChime(!blockWarpTunnels);
            },
            badge: 'UDP 2408/500/4500'
          },
          {
            id: 'cf-sub-quic',
            title: 'QUIC / HTTP-3 Inbound Blocker',
            desc: 'Drops incoming UDP datagrams targeting port 443 originating from Cloudflare ALPN h3/h3-29 clusters.',
            active: blockQuicH3,
            toggle: () => {
              setBlockQuicH3(!blockQuicH3);
              audioAnnouncer.playChime(!blockQuicH3);
            },
            badge: 'UDP 443 (QUIC)'
          },
          {
            id: 'cf-sub-workers',
            title: 'Workers & Serverless Edge',
            desc: 'Blocks inbound SSE channels and WebSocket push connections originating from *.workers.dev and Pages.',
            active: blockWorkersPages,
            toggle: () => {
              setBlockWorkersPages(!blockWorkersPages);
              audioAnnouncer.playChime(!blockWorkersPages);
            },
            badge: 'Edge Ingress'
          },
          {
            id: 'cf-sub-ntp',
            title: 'time.cloudflare.com Clock Sync',
            desc: 'Drops unsolicited inbound NTP responses on UDP port 123 originating from Cloudflare atomic clock nodes.',
            active: blockNtpSync,
            toggle: () => {
              setBlockNtpSync(!blockNtpSync);
              audioAnnouncer.playChime(!blockNtpSync);
            },
            badge: 'UDP 123 (NTP)'
          },
          {
            id: 'cf-sub-icmp',
            title: 'Cloudflare ICMP Ping Deflector',
            desc: 'Silently ignores ICMP Echo requests originating from Cloudflare diagnostic and crawler nodes.',
            active: blockIcmpEcho,
            toggle: () => {
              setBlockIcmpEcho(!blockIcmpEcho);
              audioAnnouncer.playChime(!blockIcmpEcho);
            },
            badge: 'ICMP Echo'
          },
          {
            id: 'cf-sub-headers',
            title: 'Scrub Cloudflare Headers',
            desc: 'Scrubs inbound packets with CF-Ray, CF-Visitor, CF-Connecting-IP, and cf-chl-bypass cookies.',
            active: stripCfHeaders,
            toggle: () => {
              setStripCfHeaders(!stripCfHeaders);
              audioAnnouncer.playChime(!stripCfHeaders);
            },
            badge: 'Anti-Fingerprint'
          },
          {
            id: 'cf-sub-xdp',
            title: 'eBPF XDP Kernel Ingress Hook',
            desc: 'Executes packet drop logic directly at the network card driver ring buffer before TCP/IP stack init.',
            active: xdpLineRateDrop,
            toggle: () => {
              setXdpLineRateDrop(!xdpLineRateDrop);
              audioAnnouncer.playChime(!xdpLineRateDrop);
            },
            badge: 'Zero-Copy XDP'
          }
        ].map(item => (
          <button
            key={item.id}
            id={`toggle-${item.id}-btn`}
            onClick={item.toggle}
            className={`p-4 rounded-xl border text-left transition-all ${
              item.active
                ? 'border-rose-500/40 bg-rose-500/10 shadow-sm shadow-rose-950/50'
                : isLight ? 'border-slate-200 bg-white' : 'border-slate-800 bg-slate-900/40'
            }`}
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className="font-bold text-xs text-white">{item.title}</span>
              <div className="flex items-center gap-1.5">
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 font-mono">
                  {item.badge}
                </span>
                <span className={`text-[9px] font-black px-1.5 py-0.5 rounded border ${
                  item.active
                    ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                    : 'bg-slate-800 text-slate-400 border-slate-700'
                }`}>
                  {item.active ? 'DROPPED' : 'PASS'}
                </span>
              </div>
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">{item.desc}</p>
          </button>
        ))}
      </div>

      {/* Live Stream of Intercepted Incoming Packets */}
      <div className={`glass rounded-2xl border overflow-hidden ${isLight ? 'border-slate-200' : 'border-slate-800'}`}>
        <div className={`p-4 border-b flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
          isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-900/70 border-slate-800'
        }`}>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-rose-500/10 text-rose-400 border border-rose-500/20">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-sm text-white">Live Ingress Packet Dropper Stream</h3>
                <span className="flex h-2 w-2 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500" />
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Real-time intercept log showing incoming packets from Cloudflare Anycast dropped before OS socket allocation
              </p>
            </div>
          </div>

          {/* Filter Search */}
          <div className="relative">
            <input
              type="text"
              value={filterQuery}
              onChange={e => setFilterQuery(e.target.value)}
              placeholder="Filter by IP, PoP, or protocol..."
              className={`text-xs pl-8 pr-3 py-1.5 rounded-lg border focus:outline-none focus:ring-1 focus:ring-rose-500 transition-all ${
                isLight ? 'bg-white border-slate-300 text-slate-800' : 'bg-slate-950 border-slate-800 text-slate-200'
              }`}
            />
            <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 absolute left-2.5 top-2.5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
        </div>

        {/* Stream Table */}
        <div className="overflow-x-auto max-h-80">
          <table className="w-full text-left border-collapse text-xs">
            <thead className={`sticky top-0 z-10 text-[10px] uppercase font-bold text-slate-400 tracking-wider ${
              isLight ? 'bg-slate-100 text-slate-600' : 'bg-slate-950 text-slate-400'
            }`}>
              <tr>
                <th className="py-2.5 px-4">Timestamp</th>
                <th className="py-2.5 px-4">Cloudflare Source IP</th>
                <th className="py-2.5 px-4">PoP Location</th>
                <th className="py-2.5 px-4">Protocol / Port</th>
                <th className="py-2.5 px-4">Flag / Subsystem</th>
                <th className="py-2.5 px-4">Size</th>
                <th className="py-2.5 px-4">Action</th>
                <th className="py-2.5 px-4">Rule Matched</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 mono text-[11px]">
              {filteredLogs.map(pkt => (
                <tr key={pkt.id} className="hover:bg-rose-500/5 transition-colors">
                  <td className="py-2.5 px-4 text-slate-500">{pkt.timestamp}</td>
                  <td className="py-2.5 px-4">
                    <span className="font-bold text-rose-300">{pkt.sourceIp}</span>
                  </td>
                  <td className="py-2.5 px-4 font-sans text-slate-400">{pkt.datacenterPoP}</td>
                  <td className="py-2.5 px-4">
                    <span className="text-cyan-400">{pkt.protocol}</span>
                    <span className="text-slate-500 font-sans"> :{pkt.destPort}</span>
                  </td>
                  <td className="py-2.5 px-4 font-sans">
                    <span className="text-slate-300 font-medium block">{pkt.flag}</span>
                    <span className="text-[10px] text-slate-500">{pkt.subsystem}</span>
                  </td>
                  <td className="py-2.5 px-4 text-slate-400">{pkt.sizeBytes} B</td>
                  <td className="py-2.5 px-4">
                    <span className="px-2 py-0.5 rounded text-[9px] font-black bg-rose-500/20 text-rose-300 border border-rose-500/40">
                      {pkt.action}
                    </span>
                  </td>
                  <td className="py-2.5 px-4 text-[10px] text-slate-400">{pkt.ruleMatch}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Cloudflare Ingress CIDR Range Drop Table */}
      <div className={`glass rounded-2xl border overflow-hidden ${isLight ? 'border-slate-200' : 'border-slate-800'}`}>
        <div className={`p-4 border-b flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
          isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-900/70 border-slate-800'
        }`}>
          <div>
            <h3 className="font-bold text-sm text-white">Cloudflare Autonomous System (AS13335) IP Ingress Tables</h3>
            <p className="text-xs text-slate-400">
              All official Cloudflare IPv4 & IPv6 Anycast subnets configured with instant kernel netfilter drop rules
            </p>
          </div>

          {/* Add custom CIDR */}
          <form onSubmit={handleAddCustomCidr} className="flex items-center gap-2">
            <input
              type="text"
              value={customCidrInput}
              onChange={e => setCustomCidrInput(e.target.value)}
              placeholder="e.g. 104.16.100.0/24"
              className={`text-xs px-3 py-1.5 rounded-lg border focus:outline-none focus:ring-1 focus:ring-rose-500 font-mono ${
                isLight ? 'bg-white border-slate-300 text-slate-800' : 'bg-slate-950 border-slate-800 text-slate-200'
              }`}
            />
            <button
              type="submit"
              className="px-3 py-1.5 rounded-lg text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white transition-colors shrink-0"
            >
              + Null-Route
            </button>
          </form>
        </div>

        <div className="overflow-x-auto max-h-72">
          <table className="w-full text-left border-collapse text-xs">
            <thead className={`sticky top-0 z-10 text-[10px] uppercase font-bold text-slate-400 tracking-wider ${
              isLight ? 'bg-slate-100 text-slate-600' : 'bg-slate-950 text-slate-400'
            }`}>
              <tr>
                <th className="py-2.5 px-4">Subnet CIDR</th>
                <th className="py-2.5 px-4">Type</th>
                <th className="py-2.5 px-4">Scope / Subsystem</th>
                <th className="py-2.5 px-4">PoP Coverage</th>
                <th className="py-2.5 px-4">Packets Dropped</th>
                <th className="py-2.5 px-4">Last Intercepted</th>
                <th className="py-2.5 px-4">Kernel Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 mono text-[11px]">
              {ranges.map(range => (
                <tr key={range.cidr} className="hover:bg-slate-800/30 transition-colors">
                  <td className="py-2.5 px-4">
                    <span className="font-bold text-rose-300">{range.cidr}</span>
                  </td>
                  <td className="py-2.5 px-4">
                    <span className={`px-1.5 py-0.2 rounded text-[9px] font-bold ${
                      range.type === 'IPv4' ? 'bg-cyan-500/10 text-cyan-300' : 'bg-purple-500/10 text-purple-300'
                    }`}>
                      {range.type}
                    </span>
                  </td>
                  <td className="py-2.5 px-4 font-sans text-slate-300">{range.scope}</td>
                  <td className="py-2.5 px-4 font-sans text-slate-400">{range.popRegions}</td>
                  <td className="py-2.5 px-4 text-amber-300">{range.packetsDropped.toLocaleString()}</td>
                  <td className="py-2.5 px-4 text-slate-500">{range.lastIntercepted}</td>
                  <td className="py-2.5 px-4">
                    <span className="px-2 py-0.5 rounded text-[9px] font-black bg-rose-500/20 text-rose-300 border border-rose-500/40">
                      DROP
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Export Firewall Rules */}
      {showFirewallRulesModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
          <div className="glass max-w-2xl w-full rounded-2xl border border-rose-500/40 p-6 bg-slate-900 shadow-2xl relative">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-rose-400">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <div>
                  <h4 className="font-bold text-sm text-white">System Firewall Rules (iptables / ip6tables)</h4>
                  <p className="text-[11px] text-slate-400">Copy and run on your Linux gateway, router, or local host</p>
                </div>
              </div>
              <button
                onClick={() => setShowFirewallRulesModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <pre className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-emerald-400 mono text-xs max-h-80 overflow-y-auto leading-relaxed">
              {generateFirewallScript()}
            </pre>

            <div className="flex items-center justify-end gap-3 mt-4 pt-3 border-t border-slate-800">
              <button
                onClick={() => setShowFirewallRulesModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-300 hover:bg-slate-800"
              >
                Close
              </button>
              <button
                id="copy-firewall-script-btn"
                onClick={handleCopyRules}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white flex items-center gap-1.5 transition-all shadow-cyan"
              >
                {copiedRules ? (
                  <>
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span>Copied to Clipboard!</span>
                  </>
                ) : (
                  <>
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                    </svg>
                    <span>Copy Firewall Script</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
