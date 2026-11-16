import { NodeAccessShieldState, NodeAccessProbeRecord } from '../types';

export interface NodePortDefinition {
  port: number;
  protocol: 'TCP' | 'UDP';
  name: string;
  category: 'INSPECTOR' | 'P2P' | 'CLUSTER' | 'BLOCKCHAIN' | 'TRANSIT';
  riskDescription: string;
}

export const MONITORED_NODE_PORTS: NodePortDefinition[] = [
  { port: 9229, protocol: 'TCP', name: 'Node.js V8 Inspector', category: 'INSPECTOR', riskDescription: 'Remote debugging & arbitrary code execution via V8 debugger protocol' },
  { port: 9222, protocol: 'TCP', name: 'Chrome CDP Debugger Node', category: 'INSPECTOR', riskDescription: 'Headless browser automation & DOM/memory exfiltration' },
  { port: 5858, protocol: 'TCP', name: 'Legacy Node.js Debugger', category: 'INSPECTOR', riskDescription: 'Unauthenticated remote evaluation & thread suspension' },
  { port: 6881, protocol: 'UDP', name: 'Kademlia DHT P2P Node', category: 'P2P', riskDescription: 'Decentralized hash table peer lookup & indexing probes' },
  { port: 4001, protocol: 'TCP', name: 'IPFS Swarm Peering Node', category: 'P2P', riskDescription: 'InterPlanetary File System peer discovery & relay routing' },
  { port: 8545, protocol: 'TCP', name: 'Ethereum JSON-RPC Node', category: 'BLOCKCHAIN', riskDescription: 'Remote wallet & node RPC interaction probes' },
  { port: 30303, protocol: 'TCP', name: 'Ethereum DevP2P Node', category: 'BLOCKCHAIN', riskDescription: 'EVM blockchain node peer sync & block broadcast' },
  { port: 8333, protocol: 'TCP', name: 'Bitcoin Core Node Peer', category: 'BLOCKCHAIN', riskDescription: 'Bitcoin gossip network transaction propagation' },
  { port: 10250, protocol: 'TCP', name: 'Kubelet Node API', category: 'CLUSTER', riskDescription: 'Kubernetes worker node container exec & pod logs access' },
  { port: 2375, protocol: 'TCP', name: 'Docker Unencrypted Node API', category: 'CLUSTER', riskDescription: 'Root container creation & host filesystem escape' },
  { port: 2376, protocol: 'TCP', name: 'Docker TLS Remote Node', category: 'CLUSTER', riskDescription: 'Remote daemon control socket ingress' },
  { port: 9001, protocol: 'TCP', name: 'Tor Relay / Transit Node', category: 'TRANSIT', riskDescription: 'Onion routing intermediary circuit relaying' },
  { port: 8300, protocol: 'TCP', name: 'Consul Cluster RPC Node', category: 'CLUSTER', riskDescription: 'Distributed service discovery & cluster state replication' },
];

class NodeAccessBlockerService {
  private state: NodeAccessShieldState = {
    blockAllNodeAccess: true,
    blockP2PPeering: true,
    blockNodeInspector: true,
    blockClusterDaemons: true,
    blockCryptoRpcNodes: true,
    blockRelayTransit: true,
    totalNodeProbesBlocked: 182,
    activeBlockedNodesCount: MONITORED_NODE_PORTS.length,
    lastInterceptAt: 'Just now',
  };

  private probeRecords: NodeAccessProbeRecord[] = [];
  private listeners: Set<(probe: NodeAccessProbeRecord) => void> = new Set();

  constructor() {
    this.initInitialProbes();
  }

  private initInitialProbes() {
    const now = Date.now();
    this.probeRecords = [
      {
        id: 'node-prb-1',
        timestamp: new Date(now - 12000).toLocaleTimeString(),
        nodeIp: '185.220.101.44',
        nodeHostname: 'exit-relay-04.nodes.de',
        nodeType: 'Node.js Inspector / V8 Debugger',
        port: 9229,
        protocol: 'TCP',
        actionTaken: 'TCP_RST',
        threatSeverity: 'CRITICAL',
        signature: 'GET /json/version (V8 Inspector handshake probe)',
      },
      {
        id: 'node-prb-2',
        timestamp: new Date(now - 45000).toLocaleTimeString(),
        nodeIp: '198.51.100.82',
        nodeHostname: 'p2p-crawler.kademlia.org',
        nodeType: 'P2P Relay Node',
        port: 6881,
        protocol: 'UDP',
        actionTaken: 'HARD_DROP',
        threatSeverity: 'HIGH',
        signature: 'Kademlia ping {q: "find_node", id: 0x4f82...}',
      },
      {
        id: 'node-prb-3',
        timestamp: new Date(now - 89000).toLocaleTimeString(),
        nodeIp: '45.142.214.19',
        nodeHostname: 'miner-cluster-node.ru',
        nodeType: 'Blockchain / RPC Node',
        port: 8545,
        protocol: 'TCP',
        actionTaken: 'ACCESS_DENIED_BLACKHOLE',
        threatSeverity: 'HIGH',
        signature: 'POST eth_accounts / eth_sendTransaction RPC call',
      },
      {
        id: 'node-prb-4',
        timestamp: new Date(now - 140000).toLocaleTimeString(),
        nodeIp: '192.168.1.188',
        nodeHostname: 'adjacent-lan-node.local',
        nodeType: 'Cluster Daemon Node',
        port: 10250,
        protocol: 'TCP',
        actionTaken: 'TCP_RST',
        threatSeverity: 'CRITICAL',
        signature: 'GET /pods /run command injection scanner',
      },
      {
        id: 'node-prb-5',
        timestamp: new Date(now - 210000).toLocaleTimeString(),
        nodeIp: '91.240.118.66',
        nodeHostname: 'transit-hop.onion-relay.net',
        nodeType: 'Tor Directory Node',
        port: 9001,
        protocol: 'TCP',
        actionTaken: 'HARD_DROP',
        threatSeverity: 'MEDIUM',
        signature: 'CREATE2 cell - unauthorized transit circuit request',
      },
    ];
  }

  public getState(): NodeAccessShieldState {
    return { ...this.state };
  }

  public getProbeRecords(): NodeAccessProbeRecord[] {
    return this.probeRecords;
  }

  public setMasterBlock(enabled: boolean) {
    this.state.blockAllNodeAccess = enabled;
  }

  public toggleFeature(key: keyof NodeAccessShieldState, value: boolean) {
    (this.state as any)[key] = value;
  }

  public recordProbe(
    nodeIp: string,
    port: number,
    nodeType: NodeAccessProbeRecord['nodeType'],
    protocol: 'TCP' | 'UDP' | 'WSS' | 'gRPC',
    actionTaken: NodeAccessProbeRecord['actionTaken'],
    threatSeverity: NodeAccessProbeRecord['threatSeverity'],
    signature: string,
    hostname?: string
  ): NodeAccessProbeRecord {
    const probe: NodeAccessProbeRecord = {
      id: `node-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      timestamp: new Date().toLocaleTimeString(),
      nodeIp,
      nodeHostname: hostname || `unvetted-node-${nodeIp.replace(/\./g, '-')}`,
      nodeType,
      port,
      protocol,
      actionTaken,
      threatSeverity,
      signature,
    };

    this.state.totalNodeProbesBlocked += 1;
    this.state.lastInterceptAt = probe.timestamp;
    this.probeRecords = [probe, ...this.probeRecords.slice(0, 49)];
    this.listeners.forEach(fn => fn(probe));
    return probe;
  }

  public subscribe(listener: (probe: NodeAccessProbeRecord) => void) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  public clearLog() {
    this.probeRecords = [];
  }
}

export const nodeAccessBlocker = new NodeAccessBlockerService();
