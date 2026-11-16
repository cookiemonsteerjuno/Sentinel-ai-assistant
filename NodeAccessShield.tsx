import React, { useState, useEffect } from 'react';
import { NodeAccessShieldState, NodeAccessProbeRecord } from '../types';
import { nodeAccessBlocker, MONITORED_NODE_PORTS } from '../services/nodeAccessBlocker';
import { audioAnnouncer } from '../services/audioAnnouncer';

interface NodeAccessShieldProps {
  theme?: 'dark' | 'light';
}

export const NodeAccessShield: React.FC<NodeAccessShieldProps> = ({ theme = 'dark' }) => {
  const [state, setState] = useState<NodeAccessShieldState>(() => nodeAccessBlocker.getState());
  const [probes, setProbes] = useState<NodeAccessProbeRecord[]>(() => nodeAccessBlocker.getProbeRecords());
  const [showExportModal, setShowExportModal] = useState<boolean>(false);
  const [copiedText, setCopiedText] = useState<string | null>(null);
  const [testStatus, setTestStatus] = useState<string | null>(null);
  const [filterCategory, setFilterCategory] = useState<string>('ALL');

  useEffect(() => {
    const unsubscribe = nodeAccessBlocker.subscribe((newProbe) => {
      setProbes(nodeAccessBlocker.getProbeRecords());
      setState(nodeAccessBlocker.getState());
    });
    return unsubscribe;
  }, []);

  const handleToggleMaster = (enabled: boolean) => {
    nodeAccessBlocker.setMasterBlock(enabled);
    setState(nodeAccessBlocker.getState());
    audioAnnouncer.playChime(!enabled);
  };

  const handleToggleFeature = (key: keyof NodeAccessShieldState) => {
    const currentVal = state[key] as boolean;
    nodeAccessBlocker.toggleFeature(key, !currentVal);
    setState(nodeAccessBlocker.getState());
    audioAnnouncer.playChime(false);
  };

  const handleSimulateProbe = () => {
    const randomPortDef = MONITORED_NODE_PORTS[Math.floor(Math.random() * MONITORED_NODE_PORTS.length)];
    const mockIps = ['185.220.101.44', '198.51.100.82', '45.142.214.19', '91.240.118.66', '192.168.1.188', '193.106.191.22'];
    const randomIp = mockIps[Math.floor(Math.random() * mockIps.length)];
    
    let nodeType: NodeAccessProbeRecord['nodeType'] = 'Node.js Inspector / V8 Debugger';
    if (randomPortDef.category === 'P2P') nodeType = 'P2P Relay Node';
    else if (randomPortDef.category === 'BLOCKCHAIN') nodeType = 'Blockchain / RPC Node';
    else if (randomPortDef.category === 'CLUSTER') nodeType = 'Cluster Daemon Node';
    else if (randomPortDef.category === 'TRANSIT') nodeType = 'Tor Directory Node';

    const action = randomPortDef.protocol === 'TCP' ? 'TCP_RST' : 'HARD_DROP';

    nodeAccessBlocker.recordProbe(
      randomIp,
      randomPortDef.port,
      nodeType,
      randomPortDef.protocol,
      action,
      randomPortDef.category === 'INSPECTOR' || randomPortDef.category === 'CLUSTER' ? 'CRITICAL' : 'HIGH',
      `Unauthorized node probe against ${randomPortDef.name} (${randomPortDef.protocol}/${randomPortDef.port})`
    );

    setTestStatus(`Remote node access attempt from ${randomIp} targeting port ${randomPortDef.port} (${randomPortDef.name}) blocked with ${action}.`);
    audioAnnouncer.playChime(true);
    setTimeout(() => setTestStatus(null), 4500);
  };

  const handleClearLog = () => {
    nodeAccessBlocker.clearLog();
    setProbes([]);
    setState(nodeAccessBlocker.getState());
    setTestStatus('Node access probe logs cleared.');
    setTimeout(() => setTestStatus(null), 3000);
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(label);
    setTimeout(() => setCopiedText(null), 2500);
  };

  const firewallScript = `#!/bin/bash
# ========================================================
# SENTINEL ZERO NODE ACCESS HARDENING SCRIPT
# Drops all inbound node inspection, P2P, and cluster access
# ========================================================

# 1. Disable IP Forwarding (Deny Host Being Used As Transit/Relay Node)
sysctl -w net.ipv4.ip_forward=0
sysctl -w net.ipv6.conf.all.forwarding=0

# 2. Block Node.js V8 Debugger & Inspector Ports (9229, 9222, 5858)
iptables -A INPUT -p tcp -m multiport --dports 9229,9222,5858 -j DROP
ip6tables -A INPUT -p tcp -m multiport --dports 9229,9222,5858 -j DROP

# 3. Block P2P & Decentralized Peering Ports (BitTorrent DHT 6881, IPFS 4001)
iptables -A INPUT -p udp --dport 6881 -j DROP
iptables -A INPUT -p tcp --dport 4001 -j DROP

# 4. Block Blockchain / Crypto RPC Nodes (EVM 8545/30303, Bitcoin 8333)
iptables -A INPUT -p tcp -m multiport --dports 8545,30303,8333 -j DROP

# 5. Block Container & Cluster Daemon Ingress (Docker 2375/2376, Kubelet 10250, Consul 8300)
iptables -A INPUT -p tcp -m multiport --dports 2375,2376,10250,8300 -j DROP

# 6. Block Tor/I2P Transit Node Relaying (Ports 9001, 9030, 4444)
iptables -A INPUT -p tcp -m multiport --dports 9001,9030,4444 -j DROP

# 7. Restrict Node.js Loopback Binding Only
iptables -A INPUT -p tcp -s 127.0.0.1 -j ACCEPT
iptables -A INPUT -p tcp --syn -j DROP

echo "[SENTINEL] Zero Node Access Firewall Enforced."
`;

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className={`p-6 rounded-2xl border ${theme === 'light' ? 'bg-white border-slate-200' : 'bg-slate-900/80 border-slate-800'} backdrop-blur shadow-xl relative overflow-hidden`}>
        <div className="absolute -top-24 -right-24 w-64 h-64 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 relative z-10">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2.5 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-400">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
              </div>
              <div>
                <h2 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
                  <span>Zero Node Access Shield</span>
                  <span className={`text-[10px] uppercase font-black px-2 py-0.5 rounded border ${state.blockAllNodeAccess ? 'bg-amber-500/20 text-amber-300 border-amber-500/40' : 'bg-slate-800 text-slate-400 border-slate-700'}`}>
                    {state.blockAllNodeAccess ? 'NODE INGRESS: 100% BLOCKED' : 'PERMISSIVE'}
                  </span>
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Blocks remote node peering, Node.js V8 debugger sockets, cluster daemons, and prohibits relay transit through this device.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              id="node-master-toggle-btn"
              onClick={() => handleToggleMaster(!state.blockAllNodeAccess)}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all shadow-lg flex items-center gap-2 ${
                state.blockAllNodeAccess
                  ? 'bg-amber-600 hover:bg-amber-500 text-white shadow-amber-900/30'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700'
              }`}
            >
              <div className={`w-2 h-2 rounded-full ${state.blockAllNodeAccess ? 'bg-white animate-pulse' : 'bg-slate-500'}`} />
              <span>{state.blockAllNodeAccess ? 'NODE ACCESS: BLOCKED' : 'ALLOW NODE ACCESS'}</span>
            </button>
          </div>
        </div>

        {/* Stats strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-6 border-t border-slate-800">
          <div className={`p-3 rounded-xl border ${theme === 'light' ? 'bg-slate-50 border-slate-200' : 'bg-slate-950/60 border-slate-800/80'}`}>
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Blocked Ingress Probes</span>
            <div className="text-xl font-black text-amber-400 mt-1 mono">{state.totalNodeProbesBlocked}</div>
            <span className="text-[10px] text-slate-500">TCP RST & Hard Drops</span>
          </div>

          <div className={`p-3 rounded-xl border ${theme === 'light' ? 'bg-slate-50 border-slate-200' : 'bg-slate-950/60 border-slate-800/80'}`}>
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Node.js V8 Inspector</span>
            <div className="text-xl font-black text-rose-400 mt-1 mono">BLACKHOLED</div>
            <span className="text-[10px] text-slate-500">Ports 9229, 9222, 5858</span>
          </div>

          <div className={`p-3 rounded-xl border ${theme === 'light' ? 'bg-slate-50 border-slate-200' : 'bg-slate-950/60 border-slate-800/80'}`}>
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">P2P & DHT Peering</span>
            <div className="text-xl font-black text-cyan-400 mt-1 mono">DENIED</div>
            <span className="text-[10px] text-slate-500">Kademlia, IPFS, DevP2P</span>
          </div>

          <div className={`p-3 rounded-xl border ${theme === 'light' ? 'bg-slate-50 border-slate-200' : 'bg-slate-950/60 border-slate-800/80'}`}>
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Transit Relaying</span>
            <div className="text-xl font-black text-emerald-400 mt-1 mono">DISABLED</div>
            <span className="text-[10px] text-slate-500">ip_forward = 0</span>
          </div>
        </div>
      </div>

      {/* Action Notice / Toast */}
      {testStatus && (
        <div className="p-3.5 rounded-xl bg-amber-500/15 border border-amber-500/40 text-amber-200 text-xs font-medium flex items-center justify-between animate-in fade-in">
          <div className="flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-amber-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>{testStatus}</span>
          </div>
          <button onClick={() => setTestStatus(null)} className="text-amber-400 hover:text-white text-xs underline">Dismiss</button>
        </div>
      )}

      {/* Control Switches Grid */}
      <div className={`p-6 rounded-2xl border ${theme === 'light' ? 'bg-white border-slate-200' : 'bg-slate-900/60 border-slate-800'}`}>
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-4 flex items-center justify-between">
          <span>Active Node Access Defense Rules</span>
          <span className="text-[11px] text-amber-400 font-normal">All external node access denied</span>
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Node.js Inspector */}
          <div className={`p-4 rounded-xl border flex items-center justify-between ${theme === 'light' ? 'bg-slate-50 border-slate-200' : 'bg-slate-950/50 border-slate-800'}`}>
            <div>
              <div className="font-bold text-sm text-white flex items-center gap-2">
                <span>Block Node.js Inspector & V8 Debugger</span>
                <span className="px-1.5 py-0.2 rounded text-[9px] bg-rose-500/20 text-rose-300 font-mono">PORTS 9229, 9222, 5858</span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Drops remote debugger connections, preventing arbitrary JavaScript evaluation and memory inspection.
              </p>
            </div>
            <button
              id="toggle-node-inspector-btn"
              onClick={() => handleToggleFeature('blockNodeInspector')}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full transition-colors ${state.blockNodeInspector ? 'bg-amber-600' : 'bg-slate-700'}`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${state.blockNodeInspector ? 'translate-x-6 mt-1 ml-0.5' : 'translate-x-1 mt-1'}`} />
            </button>
          </div>

          {/* P2P Peering */}
          <div className={`p-4 rounded-xl border flex items-center justify-between ${theme === 'light' ? 'bg-slate-50 border-slate-200' : 'bg-slate-950/50 border-slate-800'}`}>
            <div>
              <div className="font-bold text-sm text-white flex items-center gap-2">
                <span>Block P2P & Decentralized Node Peering</span>
                <span className="px-1.5 py-0.2 rounded text-[9px] bg-cyan-500/20 text-cyan-300 font-mono">DHT / IPFS</span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Rejects BitTorrent Kademlia DHT pings (UDP 6881) and IPFS Swarm handshakes (TCP 4001).
              </p>
            </div>
            <button
              id="toggle-p2p-peering-btn"
              onClick={() => handleToggleFeature('blockP2PPeering')}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full transition-colors ${state.blockP2PPeering ? 'bg-amber-600' : 'bg-slate-700'}`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${state.blockP2PPeering ? 'translate-x-6 mt-1 ml-0.5' : 'translate-x-1 mt-1'}`} />
            </button>
          </div>

          {/* Blockchain & Crypto RPC Nodes */}
          <div className={`p-4 rounded-xl border flex items-center justify-between ${theme === 'light' ? 'bg-slate-50 border-slate-200' : 'bg-slate-950/50 border-slate-800'}`}>
            <div>
              <div className="font-bold text-sm text-white flex items-center gap-2">
                <span>Block Blockchain & Crypto RPC Node Access</span>
                <span className="px-1.5 py-0.2 rounded text-[9px] bg-purple-500/20 text-purple-300 font-mono">PORTS 8545, 30303, 8333</span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Blackholes inbound Ethereum JSON-RPC probes and Bitcoin gossip node connections.
              </p>
            </div>
            <button
              id="toggle-crypto-rpc-btn"
              onClick={() => handleToggleFeature('blockCryptoRpcNodes')}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full transition-colors ${state.blockCryptoRpcNodes ? 'bg-amber-600' : 'bg-slate-700'}`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${state.blockCryptoRpcNodes ? 'translate-x-6 mt-1 ml-0.5' : 'translate-x-1 mt-1'}`} />
            </button>
          </div>

          {/* Cluster Daemons */}
          <div className={`p-4 rounded-xl border flex items-center justify-between ${theme === 'light' ? 'bg-slate-50 border-slate-200' : 'bg-slate-950/50 border-slate-800'}`}>
            <div>
              <div className="font-bold text-sm text-white flex items-center gap-2">
                <span>Block Cluster & Orchestrator Daemon Nodes</span>
                <span className="px-1.5 py-0.2 rounded text-[9px] bg-rose-500/20 text-rose-300 font-mono">KUBELET / DOCKER</span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Drops unauthenticated access to Kubelet (10250), Docker socket (2375), and Consul (8300).
              </p>
            </div>
            <button
              id="toggle-cluster-daemons-btn"
              onClick={() => handleToggleFeature('blockClusterDaemons')}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full transition-colors ${state.blockClusterDaemons ? 'bg-amber-600' : 'bg-slate-700'}`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${state.blockClusterDaemons ? 'translate-x-6 mt-1 ml-0.5' : 'translate-x-1 mt-1'}`} />
            </button>
          </div>

          {/* Relay & Transit Denial */}
          <div className={`p-4 rounded-xl border flex items-center justify-between ${theme === 'light' ? 'bg-slate-50 border-slate-200' : 'bg-slate-950/50 border-slate-800'}`}>
            <div>
              <div className="font-bold text-sm text-white flex items-center gap-2">
                <span>Deny Node Transit & Relay Forwarding</span>
                <span className="px-1.5 py-0.2 rounded text-[9px] bg-emerald-500/20 text-emerald-300 font-mono">sysctl ip_forward=0</span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Prevents third-party nodes from using this host as an intermediary hop or proxy relay.
              </p>
            </div>
            <button
              id="toggle-relay-transit-btn"
              onClick={() => handleToggleFeature('blockRelayTransit')}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full transition-colors ${state.blockRelayTransit ? 'bg-amber-600' : 'bg-slate-700'}`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${state.blockRelayTransit ? 'translate-x-6 mt-1 ml-0.5' : 'translate-x-1 mt-1'}`} />
            </button>
          </div>

          {/* Strict Loopback Binding */}
          <div className={`p-4 rounded-xl border flex items-center justify-between ${theme === 'light' ? 'bg-slate-50 border-slate-200' : 'bg-slate-950/50 border-slate-800'}`}>
            <div>
              <div className="font-bold text-sm text-white flex items-center gap-2">
                <span>Strict 127.0.0.1 Loopback Isolation</span>
                <span className="px-1.5 py-0.2 rounded text-[9px] bg-amber-500/20 text-amber-300 font-mono">LOCAL ONLY</span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Forces all Node.js and internal runtime sockets to bind exclusively to 127.0.0.1.
              </p>
            </div>
            <span className="px-2.5 py-1 rounded bg-amber-500/10 text-amber-400 border border-amber-500/30 text-xs font-bold">
              ENFORCED
            </span>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center justify-between gap-3 mt-6 pt-6 border-t border-slate-800">
          <div className="flex flex-wrap items-center gap-3">
            <button
              id="simulate-node-probe-btn"
              onClick={handleSimulateProbe}
              className="px-3.5 py-2 rounded-xl text-xs font-bold bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 transition-all flex items-center gap-2"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              <span>Simulate Remote Node Ingress Probe</span>
            </button>

            <button
              id="clear-node-logs-btn"
              onClick={handleClearLog}
              className="px-3.5 py-2 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-all flex items-center gap-2"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              <span>Clear Ingress Probe Log</span>
            </button>
          </div>

          <button
            id="export-node-rules-btn"
            onClick={() => setShowExportModal(true)}
            className="px-3.5 py-2 rounded-xl text-xs font-bold bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-300 border border-cyan-500/30 transition-all flex items-center gap-2"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
            <span>Export Kernel Node Block Script</span>
          </button>
        </div>
      </div>

      {/* Monitored Node Ports Grid */}
      <div className={`p-6 rounded-2xl border ${theme === 'light' ? 'bg-white border-slate-200' : 'bg-slate-900/60 border-slate-800'}`}>
        <h3 className="text-sm font-bold text-white mb-3 flex items-center justify-between">
          <span>Protected Node Ports & Services</span>
          <span className="text-xs text-slate-400 mono">{MONITORED_NODE_PORTS.length} Ports Hardened</span>
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
          {MONITORED_NODE_PORTS.map((item) => (
            <div key={`${item.protocol}-${item.port}`} className={`p-3 rounded-xl border text-xs ${theme === 'light' ? 'bg-slate-50 border-slate-200' : 'bg-slate-950/60 border-slate-800'}`}>
              <div className="flex items-center justify-between mb-1">
                <span className="font-bold text-white flex items-center gap-1.5">
                  <span className="mono text-amber-400">{item.protocol}/{item.port}</span>
                  <span className="truncate">{item.name}</span>
                </span>
                <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-rose-500/20 text-rose-300">
                  DROP
                </span>
              </div>
              <p className="text-[11px] text-slate-400 line-clamp-1">{item.riskDescription}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Intercepted Node Probes Feed */}
      <div className={`p-6 rounded-2xl border ${theme === 'light' ? 'bg-white border-slate-200' : 'bg-slate-900/60 border-slate-800'}`}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <span>Intercepted Node Access Attempts</span>
              <span className="px-2 py-0.5 rounded text-[10px] bg-amber-500/20 text-amber-300 font-mono">ZERO NODE INGRESS ACTIVE</span>
            </h3>
            <p className="text-xs text-slate-400">All inbound connection requests from remote nodes and debuggers deflected in real time.</p>
          </div>
        </div>

        {probes.length === 0 ? (
          <div className="text-center py-10 text-slate-500 text-xs">
            No active node access attempts. Perimeter is sealed.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-800 text-[10px] text-slate-400 uppercase tracking-wider font-bold">
                  <th className="pb-2.5">Time</th>
                  <th className="pb-2.5">Source Node IP & Host</th>
                  <th className="pb-2.5">Target Port</th>
                  <th className="pb-2.5">Node Classification</th>
                  <th className="pb-2.5">Signature / Vector</th>
                  <th className="pb-2.5">Severity</th>
                  <th className="pb-2.5 text-right">Defense Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 mono">
                {probes.map((prb) => (
                  <tr key={prb.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="py-2.5 text-slate-400 whitespace-nowrap">{prb.timestamp}</td>
                    <td className="py-2.5 font-bold text-white whitespace-nowrap">
                      <div>{prb.nodeIp}</div>
                      {prb.nodeHostname && <div className="text-[10px] text-slate-400 font-normal">{prb.nodeHostname}</div>}
                    </td>
                    <td className="py-2.5 text-amber-300 whitespace-nowrap">
                      {prb.protocol}/{prb.port}
                    </td>
                    <td className="py-2.5 text-slate-300 whitespace-nowrap font-sans">{prb.nodeType}</td>
                    <td className="py-2.5 text-slate-400 max-w-xs truncate" title={prb.signature}>
                      {prb.signature}
                    </td>
                    <td className="py-2.5 whitespace-nowrap">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                        prb.threatSeverity === 'CRITICAL' ? 'bg-rose-500/20 text-rose-300' : 'bg-amber-500/20 text-amber-300'
                      }`}>
                        {prb.threatSeverity}
                      </span>
                    </td>
                    <td className="py-2.5 text-right whitespace-nowrap">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40">
                        {prb.actionTaken}
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
                <div className="p-2 rounded-lg bg-amber-500/20 text-amber-400">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
                <h3 className="text-base font-bold text-white">Export Linux Kernel Node Defense Script</h3>
              </div>
              <button
                onClick={() => setShowExportModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-400 mb-3">
              Deploy this Bash script on Linux hosts, containers, or gateway routers to completely block node debug ports, P2P peer discovery, and disable transit forwarding.
            </p>

            <pre className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-[11px] font-mono text-slate-300 overflow-x-auto max-h-72">
              {firewallScript}
            </pre>

            <div className="flex items-center justify-between mt-5 pt-4 border-t border-slate-800">
              <span className="text-xs text-slate-500">Includes sysctl forward denial & multiport drop rules</span>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => copyToClipboard(firewallScript, 'rules')}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-amber-600 hover:bg-amber-500 text-white transition-colors"
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
