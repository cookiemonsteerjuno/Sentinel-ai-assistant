import React, { useState } from 'react';
import { ForeignStateEntity } from '../types';
import { audioAnnouncer } from '../services/audioAnnouncer';

interface ForeignStatesGeoShieldProps {
  theme?: 'dark' | 'light';
}

const INITIAL_FOREIGN_STATES: ForeignStateEntity[] = [
  {
    id: 'fs-1',
    countryName: 'Russian Federation',
    countryCode: 'RU',
    flag: '🇷🇺',
    asnList: ['AS12389 (Rostelecom)', 'AS31133 (MegaFon)', 'AS8342 (RTComm)'],
    ipRanges: ['95.173.136.0/21', '185.220.101.0/24', '178.62.0.0/16'],
    blockedPacketsCount: 14820,
    lastAttempt: '12 seconds ago',
    riskRating: 'CRITICAL',
    status: 'BLOCKED',
    threatVector: 'State-Sponsored Recon / Automated Port Probing & CobaltStrike C2 Beacons'
  },
  {
    id: 'fs-2',
    countryName: 'People\'s Republic of China',
    countryCode: 'CN',
    flag: '🇨🇳',
    asnList: ['AS4134 (Chinanet)', 'AS4837 (China Unicom)', 'AS9808 (CMNET)'],
    ipRanges: ['218.1.0.0/16', '123.120.0.0/14', '117.136.0.0/13'],
    blockedPacketsCount: 28410,
    lastAttempt: '4 seconds ago',
    riskRating: 'CRITICAL',
    status: 'BLOCKED',
    threatVector: 'Mass Vulnerability Scanning / Inbound SSH Brute-Force & UPnP Probing'
  },
  {
    id: 'fs-3',
    countryName: 'Islamic Republic of Iran',
    countryCode: 'IR',
    flag: '🇮🇷',
    asnList: ['AS58224 (TIC)', 'AS197207 (MCCI)', 'AS44244 (Irancell)'],
    ipRanges: ['5.160.0.0/13', '185.120.0.0/16', '37.156.0.0/15'],
    blockedPacketsCount: 6310,
    lastAttempt: '1 minute ago',
    riskRating: 'CRITICAL',
    status: 'BLOCKED',
    threatVector: 'Credential Stuffing Clusters / Exchange ProxyLogon Infiltration Probes'
  },
  {
    id: 'fs-4',
    countryName: 'Democratic People\'s Republic of Korea',
    countryCode: 'KP',
    flag: '🇰🇵',
    asnList: ['AS131279 (Star Joint Venture)'],
    ipRanges: ['175.45.176.0/22', '210.52.109.0/24'],
    blockedPacketsCount: 1980,
    lastAttempt: '8 minutes ago',
    riskRating: 'CRITICAL',
    status: 'BLOCKED',
    threatVector: 'Lazarus Group Recon / Phishing Payload Ingress & Crypto Wallet Scrapes'
  },
  {
    id: 'fs-5',
    countryName: 'Republic of Belarus',
    countryCode: 'BY',
    flag: '🇧🇾',
    asnList: ['AS6697 (Beltelecom)', 'AS25106 (A1)'],
    ipRanges: ['86.57.128.0/17', '178.120.0.0/14'],
    blockedPacketsCount: 4120,
    lastAttempt: '3 minutes ago',
    riskRating: 'HIGH',
    status: 'BLOCKED',
    threatVector: 'Ghostwriter Campaign Proxy Nodes / Inbound Relay Scanners'
  },
  {
    id: 'fs-6',
    countryName: 'Syrian Arab Republic',
    countryCode: 'SY',
    flag: '🇸🇾',
    asnList: ['AS29386 (Syrian Telecom)'],
    ipRanges: ['185.7.120.0/22', '82.137.200.0/21'],
    blockedPacketsCount: 890,
    lastAttempt: '14 minutes ago',
    riskRating: 'HIGH',
    status: 'BLOCKED',
    threatVector: 'Syrian Electronic Army Mirrored Command & Control Botnet Probes'
  },
  {
    id: 'fs-7',
    countryName: 'International Bulletproof Hosting Clusters',
    countryCode: 'GLOBAL',
    flag: '🌐',
    asnList: ['AS200000 (Offshore Relays)', 'AS50000 (Dark Subnets)'],
    ipRanges: ['194.26.29.0/24', '193.106.191.0/24', '45.154.255.0/24'],
    blockedPacketsCount: 39510,
    lastAttempt: '1 second ago',
    riskRating: 'CRITICAL',
    status: 'BLOCKED',
    threatVector: 'Distributed Port Scanners / Shodan & Censys Mass Automated Scrapers'
  }
];

export const ForeignStatesGeoShield: React.FC<ForeignStatesGeoShieldProps> = ({
  theme = 'dark'
}) => {
  const isLight = theme === 'light';

  // Master Geoblocking toggle
  const [blockAllForeignStates, setBlockAllForeignStates] = useState<boolean>(true);
  const [strictDomesticOnly, setStrictDomesticOnly] = useState<boolean>(true);
  const [foreignStates, setForeignStates] = useState<ForeignStateEntity[]>(INITIAL_FOREIGN_STATES);
  const [totalDropped, setTotalDropped] = useState<number>(96040);
  const [selectedFilter, setSelectedFilter] = useState<'ALL' | 'CRITICAL' | 'BLOCKED'>('ALL');
  const [notification, setNotification] = useState<string | null>(null);

  const toggleMasterForeignBlock = () => {
    const nextState = !blockAllForeignStates;
    setBlockAllForeignStates(nextState);
    if (nextState) {
      setStrictDomesticOnly(true);
      setForeignStates(prev => prev.map(item => ({ ...item, status: 'BLOCKED' })));
      setNotification('FOREIGN STATE ISOLATION ARMED: All foreign ingress & egress traffic strictly blocked at kernel boundary.');
    } else {
      setNotification('Warning: Global foreign state geoblocking relaxed.');
    }
    audioAnnouncer.playChime(nextState);
  };

  const toggleSingleCountry = (id: string) => {
    setForeignStates(prev =>
      prev.map(item => {
        if (item.id === id) {
          const next = item.status === 'BLOCKED' ? 'ALLOWED' : 'BLOCKED';
          if (next === 'BLOCKED') {
            setNotification(`Foreign jurisdiction ${item.countryName} blocked from contacting device.`);
          } else {
            setNotification(`Jurisdiction ${item.countryName} set to allow.`);
          }
          return { ...item, status: next };
        }
        return item;
      })
    );
  };

  const filteredStates = foreignStates.filter(s => {
    if (selectedFilter === 'CRITICAL') return s.riskRating === 'CRITICAL';
    if (selectedFilter === 'BLOCKED') return s.status === 'BLOCKED';
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Notification Banner */}
      {notification && (
        <div className="p-3.5 rounded-xl border border-rose-500/40 bg-rose-500/10 text-rose-300 text-xs flex items-center justify-between animate-fadeIn">
          <div className="flex items-center gap-2.5">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-rose-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <span className="font-semibold">{notification}</span>
          </div>
          <button onClick={() => setNotification(null)} className="text-slate-400 hover:text-white text-xs">Dismiss</button>
        </div>
      )}

      {/* Main Master Geo-Block Control Card */}
      <div className={`glass rounded-2xl p-6 border shadow-cyan relative overflow-hidden ${
        isLight ? 'border-rose-200 bg-rose-50/20' : 'border-rose-500/30 bg-slate-900/60'
      }`}>
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5 pb-5 border-b border-slate-800">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400 shrink-0 shadow-cyan">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <span className="text-xs uppercase font-bold tracking-wider text-rose-400">Sovereign Boundary Geoblocking</span>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold border flex items-center gap-1.5 ${
                  blockAllForeignStates
                    ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                    : 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                }`}>
                  <span className={`w-2 h-2 rounded-full ${blockAllForeignStates ? 'bg-rose-400 animate-pulse' : 'bg-amber-400'}`} />
                  {blockAllForeignStates ? 'ALL FOREIGN STATES BLOCKED (ZERO INGRESS/EGRESS)' : 'SELECTIVE GEOBLOCKING'}
                </span>
              </div>
              <h3 className="text-xl font-black text-white">Foreign States Geo-IP Perimeter Shield</h3>
              <p className="text-xs text-slate-400 max-w-3xl mt-1 leading-relaxed">
                Prevents all foreign nation-state servers, foreign ASNs, bulletproof international hosting providers, and foreign scanning clusters from contacting your device. All non-domestic ingress SYN probes, ICMP echos, and egress telemetry packets are sinkholed with iptables GeoIP null-routes.
              </p>
            </div>
          </div>

          {/* Master Kill Switch */}
          <div className="flex flex-col sm:flex-row items-center gap-3 shrink-0">
            <button
              id="toggle-block-all-foreign-states-btn"
              onClick={toggleMasterForeignBlock}
              className={`px-5 py-3 rounded-xl text-xs font-black transition-all shadow-cyan flex items-center gap-2 ${
                blockAllForeignStates
                  ? 'bg-rose-600 hover:bg-rose-500 text-white'
                  : 'bg-slate-800 text-slate-300 hover:text-white border border-slate-700'
              }`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
              </svg>
              <span>{blockAllForeignStates ? '✓ Block All Foreign States (Active)' : 'Enforce Foreign State Block'}</span>
            </button>
          </div>
        </div>

        {/* Telemetry Metrics Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-5">
          <div className={`p-4 rounded-xl border ${isLight ? 'border-slate-200 bg-white' : 'border-slate-800 bg-slate-950/60'}`}>
            <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">Foreign Packets Dropped</span>
            <span className="text-xl font-black text-rose-400 mono mt-0.5 block">{totalDropped.toLocaleString()}</span>
            <span className="text-[10px] text-slate-500 mt-1 block">Geo-IP kernel sinkhole active</span>
          </div>

          <div className={`p-4 rounded-xl border ${isLight ? 'border-slate-200 bg-white' : 'border-slate-800 bg-slate-950/60'}`}>
            <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">Foreign Jurisdictions</span>
            <span className="text-xl font-black text-white mono mt-0.5 block">{foreignStates.filter(s => s.status === 'BLOCKED').length} of {foreignStates.length} Blocked</span>
            <span className="text-[10px] text-emerald-400 mt-1 block">100% Boundary Isolation</span>
          </div>

          <div className={`p-4 rounded-xl border ${isLight ? 'border-slate-200 bg-white' : 'border-slate-800 bg-slate-950/60'}`}>
            <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">Sovereign Domestic Boundary</span>
            <span className="text-xl font-black text-emerald-400 mono mt-0.5 block">{strictDomesticOnly ? 'STRICT DOMESTIC' : 'CUSTOM FILTER'}</span>
            <span className="text-[10px] text-slate-500 mt-1 block">Zero unauthorized foreign transit</span>
          </div>

          <div className={`p-4 rounded-xl border ${isLight ? 'border-slate-200 bg-white' : 'border-slate-800 bg-slate-950/60'}`}>
            <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">Foreign Recon Defense</span>
            <span className="text-xl font-black text-purple-400 mono mt-0.5 block">NULL-ROUTED</span>
            <span className="text-[10px] text-slate-500 mt-1 block">TCP RST / DROP policy enforced</span>
          </div>
        </div>
      </div>

      {/* Foreign Nation-State Entities & Scanning Clusters List */}
      <div className={`glass rounded-2xl border overflow-hidden ${isLight ? 'border-slate-200' : 'border-slate-800'}`}>
        <div className={`p-4 border-b flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
          isLight ? 'border-slate-200 bg-slate-50' : 'border-slate-800 bg-slate-900/60'
        }`}>
          <div>
            <h4 className="font-bold text-sm text-white">Blocked Foreign States & Off-Shore Scanning Clusters</h4>
            <p className="text-xs text-slate-400 mt-0.5">Real-time status of foreign sovereign jurisdictions contacting this device</p>
          </div>

          <div className="flex items-center gap-2">
            {(['ALL', 'CRITICAL', 'BLOCKED'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setSelectedFilter(tab)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  selectedFilter === tab
                    ? 'bg-rose-600 text-white'
                    : 'text-slate-400 hover:text-white bg-slate-800/60'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        <div className="divide-y divide-slate-800">
          {filteredStates.map(state => (
            <div
              key={state.id}
              className={`p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 transition-colors ${
                state.status === 'BLOCKED'
                  ? isLight ? 'bg-rose-50/10' : 'bg-slate-950/40 hover:bg-slate-900/50'
                  : 'bg-transparent'
              }`}
            >
              <div className="flex items-start gap-3.5">
                <span className="text-3xl shrink-0 leading-none pt-1">{state.flag}</span>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-bold text-sm text-white">{state.countryName}</span>
                    <span className="px-1.5 py-0.2 rounded text-[10px] font-black bg-slate-800 text-slate-300 mono">
                      {state.countryCode}
                    </span>
                    <span className={`px-2 py-0.2 rounded text-[10px] font-black border ${
                      state.riskRating === 'CRITICAL'
                        ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                        : 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                    }`}>
                      {state.riskRating} THREAT
                    </span>
                    <span className={`px-2 py-0.2 rounded text-[10px] font-black ${
                      state.status === 'BLOCKED'
                        ? 'bg-rose-600 text-white'
                        : 'bg-emerald-600 text-white'
                    }`}>
                      {state.status === 'BLOCKED' ? 'BLOCKED' : 'ALLOWED'}
                    </span>
                  </div>

                  <p className="text-xs text-rose-300/90 font-medium mt-1">
                    Vector: {state.threatVector}
                  </p>

                  <div className="flex flex-wrap gap-2 mt-2 text-[11px] mono text-slate-400">
                    <span>ASNs: <strong className="text-slate-300">{state.asnList.join(', ')}</strong></span>
                    <span>•</span>
                    <span>Blocked Subnets: <strong className="text-slate-300">{state.ipRanges.join(', ')}</strong></span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-4 shrink-0 justify-between md:justify-end">
                <div className="text-right">
                  <span className="text-xs font-bold text-rose-400 mono block">
                    {state.blockedPacketsCount.toLocaleString()} pkts dropped
                  </span>
                  <span className="text-[10px] text-slate-500 block">Last attempt: {state.lastAttempt}</span>
                </div>

                <button
                  onClick={() => toggleSingleCountry(state.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${
                    state.status === 'BLOCKED'
                      ? 'border-rose-500/40 text-rose-300 hover:bg-rose-500/10'
                      : 'border-slate-700 text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  {state.status === 'BLOCKED' ? 'Unblock State' : 'Block State'}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
