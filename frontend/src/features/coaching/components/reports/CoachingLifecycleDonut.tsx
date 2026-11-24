import React, { useState } from 'react';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
} from 'recharts';

interface CoachingLifecycleDonutProps {
  criticalCount: number;
  moderateCount: number;
  completedSessions: number;
  totalTargetSessions: number;
  attentionCount?: number;
  onFilterBand?: (band: string) => void;
}

export const CoachingLifecycleDonut: React.FC<CoachingLifecycleDonutProps> = ({
  criticalCount,
  moderateCount,
  completedSessions,
  totalTargetSessions,
  onFilterBand,
}) => {
  const [viewMode, setViewMode] = useState<'RISK' | 'EXECUTION'>('RISK');

  const totalCoachees = criticalCount + moderateCount;
  const pendingSessions = Math.max(0, totalTargetSessions - completedSessions);

  const riskData = [
    { name: 'Critical Tier (<2.0)', value: criticalCount, color: '#ef4444', key: 'CRITICAL' },
    { name: 'Moderate Tier (2.0-2.9)', value: moderateCount, color: '#f59e0b', key: 'MODERATE' },
  ].filter((d) => d.value > 0);

  const executionData = [
    { name: 'Completed Sessions', value: completedSessions, color: '#10b981', key: 'COMPLETED' },
    { name: 'Pending Sessions', value: pendingSessions, color: '#64748b', key: 'PENDING' },
  ].filter((d) => d.value > 0);

  const activeData = viewMode === 'RISK' ? riskData : executionData;

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const item = payload[0];
      const percent =
        viewMode === 'RISK'
          ? totalCoachees > 0
            ? Math.round((item.value / totalCoachees) * 100)
            : 0
          : totalTargetSessions > 0
          ? Math.round((item.value / totalTargetSessions) * 100)
          : 0;

      return (
        <div
          style={{
            backgroundColor: '#0f172a',
            border: '1px solid #334155',
            borderRadius: '6px',
            padding: '8px 12px',
            color: '#f8fafc',
            boxShadow: '0 8px 20px rgba(0, 0, 0, 0.4)',
            fontSize: '12px',
          }}
        >
          <div style={{ fontWeight: 600, color: item.payload.color }}>{item.name}</div>
          <div style={{ fontSize: '13px', fontWeight: 700, marginTop: '2px' }}>
            {item.value} ({percent}%)
          </div>
          {onFilterBand && viewMode === 'RISK' && (
            <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '4px' }}>
              Click slice to filter roster
            </div>
          )}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="w-full flex flex-col items-center">
      <div className="w-full flex items-center justify-between mb-1">
        <div>
          <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
            {viewMode === 'RISK' ? 'Appraisal Risk Composition' : 'Session Target Delivery'}
          </h4>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {viewMode === 'RISK' ? 'Severity distribution across coachees' : 'Execution velocity against planned goal'}
          </p>
        </div>

        {/* View Switcher */}
        <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg text-xs">
          <button
            type="button"
            onClick={() => setViewMode('RISK')}
            className={`px-2 py-1 rounded font-medium transition cursor-pointer ${
              viewMode === 'RISK'
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            Risk
          </button>
          <button
            type="button"
            onClick={() => setViewMode('EXECUTION')}
            className={`px-2 py-1 rounded font-medium transition cursor-pointer ${
              viewMode === 'EXECUTION'
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            Sessions
          </button>
        </div>
      </div>

      <div style={{ position: 'relative', width: '100%', height: 210 }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={activeData}
              innerRadius={55}
              outerRadius={80}
              paddingAngle={3}
              dataKey="value"
              onClick={(entry: any) => {
                if (viewMode === 'RISK' && onFilterBand && entry && entry.key) {
                  onFilterBand(String(entry.key));
                }
              }}
              cursor="pointer"
            >
              {activeData.map((entry, index) => (
                <Cell key={`donut-cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
          </PieChart>
        </ResponsiveContainer>

        {/* Center Metric */}
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            textAlign: 'center',
            pointerEvents: 'none',
          }}
        >
          <div style={{ fontSize: '22px', fontWeight: 800, color: '#0f172a', lineHeight: 1 }} className="dark:text-white">
            {viewMode === 'RISK' ? totalCoachees : completedSessions}
          </div>
          <div style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748b', marginTop: '3px' }}>
            {viewMode === 'RISK' ? 'Coachees' : 'Sessions Done'}
          </div>
        </div>
      </div>

      {/* Legend & Summary Pills */}
      <div className="w-full grid grid-cols-2 gap-2 text-xs pt-1 border-t border-slate-100 dark:border-slate-800">
        {viewMode === 'RISK' ? (
          <>
            <div
              onClick={() => onFilterBand && onFilterBand('CRITICAL')}
              className="flex items-center gap-2 p-1.5 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200/50 dark:border-red-900/50 cursor-pointer hover:bg-red-100/50 transition"
            >
              <span className="w-2.5 h-2.5 rounded-full bg-red-500 shrink-0" />
              <div>
                <div className="text-red-900 dark:text-red-200 font-semibold">{criticalCount} Critical</div>
                <div className="text-[10px] text-red-600 dark:text-red-400">Rating &lt; 2.0 (10 sess)</div>
              </div>
            </div>

            <div
              onClick={() => onFilterBand && onFilterBand('MODERATE')}
              className="flex items-center gap-2 p-1.5 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200/50 dark:border-amber-900/50 cursor-pointer hover:bg-amber-100/50 transition"
            >
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500 shrink-0" />
              <div>
                <div className="text-amber-900 dark:text-amber-200 font-semibold">{moderateCount} Moderate</div>
                <div className="text-[10px] text-amber-600 dark:text-amber-400">Rating 2.0-2.9 (6 sess)</div>
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="flex items-center gap-2 p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200/50 dark:border-emerald-900/50">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0" />
              <div>
                <div className="text-emerald-900 dark:text-emerald-200 font-semibold">{completedSessions} Conducted</div>
                <div className="text-[10px] text-emerald-600 dark:text-emerald-400">
                  {totalTargetSessions > 0 ? Math.round((completedSessions / totalTargetSessions) * 100) : 0}% Target Met
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 p-1.5 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
              <span className="w-2.5 h-2.5 rounded-full bg-slate-400 shrink-0" />
              <div>
                <div className="text-slate-900 dark:text-slate-200 font-semibold">{pendingSessions} Remaining</div>
                <div className="text-[10px] text-slate-500 dark:text-slate-400">Of {totalTargetSessions} Target</div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
