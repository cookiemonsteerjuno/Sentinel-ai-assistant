import React from 'react';
import { APP_NAME } from '../constants';

interface SecurityDashboardProps {
  stealthMode?: boolean;
  theme?: 'dark' | 'light';
  onNavigateToCommands?: () => void;
  onNavigateToMobile?: (section?: any) => void;
  onNavigateToNetwork?: (section?: any) => void;
}

export const SecurityDashboard: React.FC<SecurityDashboardProps> = ({
  stealthMode = false,
  theme = 'dark',
  onNavigateToCommands,
  onNavigateToMobile,
  onNavigateToNetwork,
}) => {
  const isLight = theme === 'light';

  return (
    <div className="space-y-6 animate-in">
      {/* Main Status Banner */}
      <div className={`p-6 rounded-2xl border shadow-xl relative overflow-hidden ${
        isLight ? 'bg-white border-slate-200 text-slate-900' : 'bg-slate-900/80 border-slate-800 text-slate-50'
      }`}>
        <div className="absolute -top-24 -right-24 w-64 h-64 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative z-10">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2.5 rounded-xl bg-cyan-500/15 border border-cyan-500/30 text-cyan-400">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <div>
                <h2 className="text-xl font-bold tracking-tight flex items-center gap-2">
                  <span>{stealthMode ? 'REDACTED SEC-OPS' : APP_NAME}</span>
                  <span className="text-[10px] uppercase font-black px-2 py-0.5 rounded border bg-emerald-500/20 text-emerald-300 border-emerald-500/40">
                    SYSTEM SECURE
                  </span>
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Real-time threat intelligence, network telemetry defense, and system patch monitoring.
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={onNavigateToCommands}
              className="px-4 py-2.5 rounded-xl text-xs font-bold bg-cyan-600 hover:bg-cyan-500 text-white transition-all shadow-lg shadow-cyan-900/30 flex items-center gap-2"
            >
              <span>View Commands</span>
            </button>
          </div>
        </div>

        {/* Quick Access Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-6 pt-6 border-t border-slate-800">
          <div 
            onClick={() => onNavigateToNetwork?.('contacted_domains')}
            className={`p-4 rounded-xl border cursor-pointer transition-all hover:border-cyan-500/50 ${
              isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-950/60 border-slate-800'
            }`}
          >
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Network Shield</span>
            <div className="text-base font-bold text-cyan-400 mt-1">Routing & DNS Guard</div>
            <span className="text-[10px] text-slate-500 mt-1 block">Click to inspect active tunnels</span>
          </div>

          <div 
            onClick={() => onNavigateToMobile?.('patches')}
            className={`p-4 rounded-xl border cursor-pointer transition-all hover:border-cyan-500/50 ${
              isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-950/60 border-slate-800'
            }`}
          >
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Mobile Center</span>
            <div className="text-base font-bold text-emerald-400 mt-1">System Patches & APKs</div>
            <span className="text-[10px] text-slate-500 mt-1 block">Check CVE status & export APK</span>
          </div>

          <div 
            onClick={onNavigateToCommands}
            className={`p-4 rounded-xl border cursor-pointer transition-all hover:border-cyan-500/50 ${
              isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-950/60 border-slate-800'
            }`}
          >
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Inbound Commands</span>
            <div className="text-base font-bold text-purple-400 mt-1">Voice Announcer HUD</div>
            <span className="text-[10px] text-slate-500 mt-1 block">Live device directive feed</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SecurityDashboard;
