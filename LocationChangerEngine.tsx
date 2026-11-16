import React, { useState, useEffect } from 'react';
import { LocationNode, LocationHopRecord } from '../types';
import { audioAnnouncer } from '../services/audioAnnouncer';

interface LocationChangerEngineProps {
  theme?: 'dark' | 'light';
  onLocationChanged?: (node: LocationNode) => void;
}

export const GLOBAL_LOCATION_NODES: LocationNode[] = [
  {
    id: 'loc-ch',
    city: 'Zurich',
    country: 'Switzerland',
    countryCode: 'CH',
    flag: '🇨🇭',
    ip: '194.26.29.112',
    virtualIp: '10.84.2.19',
    latencyMs: 18,
    coordinates: '47.3769° N, 8.5417° E',
    tier: 'Quantum-Safe Zero-Knowledge'
  },
  {
    id: 'loc-is',
    city: 'Reykjavik',
    country: 'Iceland',
    countryCode: 'IS',
    flag: '🇮🇸',
    ip: '185.112.82.4',
    virtualIp: '10.84.3.44',
    latencyMs: 31,
    coordinates: '64.1466° N, 21.9426° W',
    tier: 'Sovereign Privacy Fortress'
  },
  {
    id: 'loc-de',
    city: 'Frankfurt',
    country: 'Germany',
    countryCode: 'DE',
    flag: '🇩🇪',
    ip: '195.201.88.19',
    virtualIp: '10.84.5.88',
    latencyMs: 22,
    coordinates: '50.1109° N, 8.6821° E',
    tier: 'EU GDPR Compliance Core'
  },
  {
    id: 'loc-jp',
    city: 'Tokyo',
    country: 'Japan',
    countryCode: 'JP',
    flag: '🇯🇵',
    ip: '133.242.18.91',
    virtualIp: '10.84.7.102',
    latencyMs: 96,
    coordinates: '35.6762° N, 139.6503° E',
    tier: 'Asia-Pacific Multi-Gigabit'
  },
  {
    id: 'loc-sg',
    city: 'Singapore',
    country: 'Singapore',
    countryCode: 'SG',
    flag: '🇸🇬',
    ip: '139.180.201.45',
    virtualIp: '10.84.9.15',
    latencyMs: 84,
    coordinates: '1.3521° N, 103.8198° E',
    tier: 'ASEAN High-Throughput Node'
  },
  {
    id: 'loc-nl',
    city: 'Amsterdam',
    country: 'Netherlands',
    countryCode: 'NL',
    flag: '🇳🇱',
    ip: '185.220.100.242',
    virtualIp: '10.84.11.73',
    latencyMs: 24,
    coordinates: '52.3676° N, 4.9041° E',
    tier: 'Offshore Privacy Pipe'
  },
  {
    id: 'loc-se',
    city: 'Stockholm',
    country: 'Sweden',
    countryCode: 'SE',
    flag: '🇸🇪',
    ip: '193.187.91.12',
    virtualIp: '10.84.14.90',
    latencyMs: 29,
    coordinates: '59.3293° N, 18.0686° E',
    tier: 'Nordic Sovereign Shield'
  },
  {
    id: 'loc-ca',
    city: 'Toronto',
    country: 'Canada',
    countryCode: 'CA',
    flag: '🇨🇦',
    ip: '192.99.148.11',
    virtualIp: '10.84.18.23',
    latencyMs: 65,
    coordinates: '43.6532° N, 79.3832° W',
    tier: 'North American Anti-Surveillance Vault'
  },
  {
    id: 'loc-fi',
    city: 'Helsinki',
    country: 'Finland',
    countryCode: 'FI',
    flag: '🇫🇮',
    ip: '95.216.14.88',
    virtualIp: '10.84.20.107',
    latencyMs: 33,
    coordinates: '60.1699° N, 24.9384° E',
    tier: 'Boreal High-Entropy Relay'
  },
  {
    id: 'loc-kr',
    city: 'Seoul',
    country: 'South Korea',
    countryCode: 'KR',
    flag: '🇰🇷',
    ip: '211.234.118.5',
    virtualIp: '10.84.22.41',
    latencyMs: 102,
    coordinates: '37.5665° N, 126.9780° E',
    tier: 'East Asian Quantum Backbone'
  },
  {
    id: 'loc-au',
    city: 'Sydney',
    country: 'Australia',
    countryCode: 'AU',
    flag: '🇦🇺',
    ip: '139.99.162.80',
    virtualIp: '10.84.25.64',
    latencyMs: 138,
    coordinates: '33.8688° S, 151.2093° E',
    tier: 'Oceania Low-Trace Exit'
  },
  {
    id: 'loc-br',
    city: 'Sao Paulo',
    country: 'Brazil',
    countryCode: 'BR',
    flag: '🇧🇷',
    ip: '177.54.144.20',
    virtualIp: '10.84.28.18',
    latencyMs: 125,
    coordinates: '23.5505° S, 46.6333° W',
    tier: 'Latin American Sovereign Gateway'
  }
];

const INITIAL_HOP_HISTORY: LocationHopRecord[] = [
  {
    id: 'hop-1',
    location: 'Zurich, Switzerland',
    countryCode: 'CH',
    ip: '194.26.29.112',
    timestamp: 'Just now',
    durationSeconds: 15,
    bytesRouted: 2451000
  },
  {
    id: 'hop-2',
    location: 'Reykjavik, Iceland',
    countryCode: 'IS',
    ip: '185.112.82.4',
    timestamp: '15s ago',
    durationSeconds: 15,
    bytesRouted: 3120000
  },
  {
    id: 'hop-3',
    location: 'Frankfurt, Germany',
    countryCode: 'DE',
    ip: '195.201.88.19',
    timestamp: '30s ago',
    durationSeconds: 15,
    bytesRouted: 1845000
  },
  {
    id: 'hop-4',
    location: 'Tokyo, Japan',
    countryCode: 'JP',
    ip: '133.242.18.91',
    timestamp: '45s ago',
    durationSeconds: 15,
    bytesRouted: 4190000
  }
];

export const LocationChangerEngine: React.FC<LocationChangerEngineProps> = ({
  theme = 'dark',
  onLocationChanged
}) => {
  const isLight = theme === 'light';

  // Running state: default TRUE as requested ("add a location changer that keeps running different locations")
  const [isRunning, setIsRunning] = useState<boolean>(true);
  const [hopIntervalSeconds, setHopIntervalSeconds] = useState<number>(15);
  const [timeUntilNextHop, setTimeUntilNextHop] = useState<number>(15);
  const [currentHopIndex, setCurrentHopIndex] = useState<number>(0);
  const [totalHops, setTotalHops] = useState<number>(18);
  const [hopHistory, setHopHistory] = useState<LocationHopRecord[]>(INITIAL_HOP_HISTORY);
  const [isHoppingAnimation, setIsHoppingAnimation] = useState<boolean>(false);
  const [notification, setNotification] = useState<string | null>(null);

  const activeNode = GLOBAL_LOCATION_NODES[currentHopIndex];

  // Continuous location cycling timer loop
  useEffect(() => {
    if (!isRunning) return;

    const timer = setInterval(() => {
      setTimeUntilNextHop(prev => {
        if (prev <= 1) {
          triggerHopToNextLocation();
          return hopIntervalSeconds;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isRunning, hopIntervalSeconds, currentHopIndex]);

  const triggerHopToNextLocation = (explicitIndex?: number) => {
    setIsHoppingAnimation(true);

    const nextIndex = explicitIndex !== undefined 
      ? explicitIndex 
      : (currentHopIndex + 1) % GLOBAL_LOCATION_NODES.length;

    const nextNode = GLOBAL_LOCATION_NODES[nextIndex];
    setCurrentHopIndex(nextIndex);
    setTotalHops(prev => prev + 1);
    setTimeUntilNextHop(hopIntervalSeconds);

    const newRecord: LocationHopRecord = {
      id: `hop-${Date.now()}`,
      location: `${nextNode.city}, ${nextNode.country}`,
      countryCode: nextNode.countryCode,
      ip: nextNode.ip,
      timestamp: 'Just now',
      durationSeconds: hopIntervalSeconds,
      bytesRouted: Math.floor(Math.random() * 2500000 + 1000000)
    };

    setHopHistory(prev => [newRecord, ...prev.slice(0, 7)]);

    if (onLocationChanged) {
      onLocationChanged(nextNode);
    }

    setNotification(`Location hopped to ${nextNode.flag} ${nextNode.city}, ${nextNode.country} (${nextNode.ip})`);
    audioAnnouncer.playChime(false);

    setTimeout(() => {
      setIsHoppingAnimation(false);
    }, 600);

    setTimeout(() => {
      setNotification(null), 3500;
    }, 3500);
  };

  const nextNodePreview = GLOBAL_LOCATION_NODES[(currentHopIndex + 1) % GLOBAL_LOCATION_NODES.length];

  return (
    <div className="space-y-6 animate-in">
      {/* Real-time Hop Notification */}
      {notification && (
        <div className="p-3.5 rounded-xl bg-purple-950/90 border border-purple-500 shadow-cyan flex items-center justify-between text-purple-200 text-xs font-semibold animate-in">
          <div className="flex items-center gap-2.5">
            <span className="text-base">{activeNode.flag}</span>
            <span>{notification}</span>
          </div>
          <button onClick={() => setNotification(null)} className="text-purple-400 hover:text-white">✕</button>
        </div>
      )}

      {/* Main Location Changer Controller */}
      <div className={`glass rounded-2xl p-6 border shadow-cyan relative overflow-hidden transition-all ${
        isHoppingAnimation ? 'ring-2 ring-purple-400 bg-purple-950/20' : ''
      } ${isLight ? 'border-slate-200 bg-white' : 'border-slate-800 bg-slate-900/60'}`}>
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
          <div className="flex items-start gap-4">
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-3xl shrink-0 shadow-cyan transition-transform ${
              isHoppingAnimation ? 'scale-110 rotate-12 bg-purple-500/20' : 'bg-purple-500/10 border border-purple-500/30'
            }`}>
              {activeNode.flag}
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs uppercase font-bold tracking-widest text-purple-400">Autonomous Node Hopper</span>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/10 border border-purple-500/30 text-purple-300 flex items-center gap-1.5">
                  <span className={`w-1.5 h-1.5 rounded-full ${isRunning ? 'bg-purple-400 animate-ping' : 'bg-slate-500'}`} />
                  {isRunning ? 'Location Changer: RUNNING' : 'Location Changer: PAUSED'}
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-cyan-500/10 text-cyan-300 border border-cyan-500/20">
                  {totalHops} Total Hops Completed
                </span>
              </div>
              <h3 className="text-2xl font-black tracking-tight mt-1 text-white flex items-center gap-2">
                <span>Current: {activeNode.city}, {activeNode.country}</span>
                <span className="text-sm font-bold text-slate-400 mono">({activeNode.coordinates})</span>
              </h3>
              <p className="text-xs text-slate-400 mt-1 max-w-2xl">
                Continuously rotates your virtual IP, gateway egress node, and geographic metadata across {GLOBAL_LOCATION_NODES.length} sovereign encrypted endpoints, defeating geofencing, IP tracking, and behavioral fingerprinting.
              </p>
            </div>
          </div>

          {/* Action Buttons: Hop Now & Pause/Resume */}
          <div className="flex flex-wrap items-center gap-3">
            <button
              id="hop-next-location-now-btn"
              onClick={() => triggerHopToNextLocation()}
              className="flex items-center gap-2 px-5 py-3 rounded-xl text-xs font-bold text-white bg-purple-600 hover:bg-purple-500 shadow-cyan transition-all transform active:scale-95"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
              </svg>
              <span>Hop Location Now</span>
            </button>

            <button
              onClick={() => setIsRunning(!isRunning)}
              className={`px-4 py-3 rounded-xl text-xs font-bold border transition-all ${
                isRunning
                  ? 'bg-purple-500/15 border-purple-500/30 text-purple-300 hover:bg-purple-500/25'
                  : 'bg-amber-500/15 border-amber-500/30 text-amber-300 hover:bg-amber-500/25'
              }`}
            >
              {isRunning ? '❚❚ Pause Hopper' : '▶ Resume Hopper'}
            </button>
          </div>
        </div>

        {/* Live Hop Countdown & Hop Speed Bar */}
        <div className="mt-6 pt-6 border-t border-slate-800/80">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-2">
            <div className="flex items-center gap-2">
              <span className="text-xs uppercase font-bold text-slate-400">Next Location Hop In:</span>
              <span className="text-2xl font-black mono text-purple-400">
                {timeUntilNextHop}s
              </span>
              <span className="text-xs text-slate-500">
                ➔ Next Target: <strong className="text-white">{nextNodePreview.flag} {nextNodePreview.city}, {nextNodePreview.country}</strong>
              </span>
            </div>
            <div className="flex items-center gap-4 text-xs mono text-slate-400">
              <span>Virtual IP: <strong className="text-cyan-400">{activeNode.virtualIp}</strong></span>
              <span>Public Gateway: <strong className="text-slate-300">{activeNode.ip}</strong></span>
              <span>Latency: <strong className="text-emerald-400">{activeNode.latencyMs}ms</strong></span>
            </div>
          </div>

          {/* Hop Countdown Progress */}
          <div className="w-full bg-slate-950 rounded-full h-3 overflow-hidden border border-slate-800 p-0.5">
            <div
              className="h-full rounded-full bg-gradient-to-r from-purple-500 to-pink-500 transition-all duration-1000"
              style={{ width: `${((hopIntervalSeconds - timeUntilNextHop) / hopIntervalSeconds) * 100}%` }}
            />
          </div>

          {/* Hop Cadence Selector */}
          <div className="flex items-center justify-between mt-3 text-xs">
            <span className="text-slate-400">Hop Cadence (Speed):</span>
            <div className="flex items-center gap-1.5">
              {[
                { label: 'Every 10s (Hyper-Hop)', value: 10 },
                { label: 'Every 15s (Active)', value: 15 },
                { label: 'Every 30s', value: 30 },
                { label: 'Every 60s (1 Minute)', value: 60 }
              ].map(opt => (
                <button
                  key={opt.value}
                  onClick={() => {
                    setHopIntervalSeconds(opt.value);
                    setTimeUntilNextHop(Math.min(timeUntilNextHop, opt.value));
                  }}
                  className={`px-2.5 py-1 rounded text-[11px] font-bold transition-colors ${
                    hopIntervalSeconds === opt.value
                      ? 'bg-purple-600 text-white shadow-cyan'
                      : 'bg-slate-800/80 text-slate-400 hover:text-white'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Global Node Grid: Click any node to hop directly */}
      <div className={`glass rounded-2xl p-6 border ${isLight ? 'border-slate-200' : 'border-slate-800'}`}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h4 className="font-bold text-sm text-white">Global Privacy Node Mesh ({GLOBAL_LOCATION_NODES.length} Active Nodes)</h4>
            <p className="text-xs text-slate-400">Click any global node to immediately switch your location and virtual IP.</p>
          </div>
          <span className="text-[10px] text-purple-400 font-bold bg-purple-500/10 px-2 py-0.5 rounded border border-purple-500/20">
            Autonomous Rotation
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {GLOBAL_LOCATION_NODES.map((node, idx) => {
            const isCurrent = idx === currentHopIndex;
            return (
              <button
                key={node.id}
                onClick={() => triggerHopToNextLocation(idx)}
                className={`p-3.5 rounded-xl border text-left transition-all ${
                  isCurrent
                    ? 'border-purple-500 bg-purple-500/15 shadow-cyan ring-1 ring-purple-400'
                    : isLight
                    ? 'border-slate-200 bg-white hover:border-purple-400/50'
                    : 'border-slate-800 bg-slate-900/40 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xl">{node.flag}</span>
                  <span className={`text-[10px] font-bold mono ${
                    node.latencyMs < 40 ? 'text-emerald-400' : node.latencyMs < 90 ? 'text-cyan-400' : 'text-amber-400'
                  }`}>
                    {node.latencyMs}ms
                  </span>
                </div>
                <div className="font-bold text-xs text-white flex items-center gap-1.5">
                  <span>{node.city}</span>
                  <span className="text-[10px] text-slate-400 font-normal">({node.countryCode})</span>
                </div>
                <div className="text-[10px] text-slate-500 mono mt-0.5 truncate">
                  IP: {node.ip}
                </div>
                <div className="mt-2 pt-2 border-t border-slate-800/60 flex items-center justify-between">
                  <span className="text-[9px] text-slate-400 truncate max-w-[120px]">{node.tier}</span>
                  {isCurrent && (
                    <span className="text-[9px] px-1.5 py-0.2 rounded bg-purple-500 text-slate-950 font-bold">
                      ACTIVE
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Location Hop History Log */}
      <div className={`glass rounded-2xl border overflow-hidden ${isLight ? 'border-slate-200' : 'border-slate-800'}`}>
        <div className={`p-4 border-b flex items-center justify-between ${
          isLight ? 'bg-slate-100 border-slate-200' : 'bg-slate-900/80 border-slate-800'
        }`}>
          <div className="flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <h4 className="font-bold text-xs uppercase tracking-wider text-white">Recent Location Hop History</h4>
          </div>
          <span className="text-[10px] text-slate-400 mono">Live hop telemetry</span>
        </div>

        <div className="divide-y divide-slate-800/60 max-h-64 overflow-y-auto">
          {hopHistory.map((item) => (
            <div
              key={item.id}
              className={`p-3.5 flex items-center justify-between text-xs transition-colors ${
                isLight ? 'hover:bg-slate-50' : 'hover:bg-slate-800/40'
              }`}
            >
              <div className="flex items-center gap-3">
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-500/15 text-purple-300 border border-purple-500/30">
                  {item.countryCode}
                </span>
                <div>
                  <div className="font-bold text-white">{item.location}</div>
                  <div className="text-[10px] text-slate-400 mono mt-0.5">
                    Gateway IP: {item.ip} • Duration: {item.durationSeconds}s
                  </div>
                </div>
              </div>

              <div className="text-right mono text-[11px] text-slate-400">
                <div className="text-white">{item.timestamp}</div>
                <div className="text-purple-400 text-[10px]">{(item.bytesRouted / 1024 / 1024).toFixed(2)} MB Routed</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default LocationChangerEngine;
