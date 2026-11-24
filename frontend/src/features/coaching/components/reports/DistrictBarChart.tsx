import React from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  Cell,
} from 'recharts';
import type { DistrictAnalytics } from '../../api/pmsReportApi';

interface DistrictBarChartProps {
  districts: DistrictAnalytics[];
  selectedDistrict?: string;
  onSelectDistrict?: (district: string) => void;
}

export const DistrictBarChart: React.FC<DistrictBarChartProps> = ({
  districts,
  selectedDistrict,
  onSelectDistrict,
}) => {
  if (!districts || districts.length === 0) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '240px',
          color: '#94a3b8',
          fontSize: '0.85rem',
        }}
      >
        No district data available for the selected reporting period.
      </div>
    );
  }

  // Format data for chart
  const data = districts.map((d) => ({
    name: d.districtName.replace(' District', ''),
    fullName: d.districtName,
    coachees: d.coacheesCount,
    critical: d.criticalCount,
    moderate: d.moderateCount,
    targetSessions: d.targetSessions,
    completedSessions: d.completedSessions,
    completionRate: d.completionRate,
    branchesCount: d.branches.length,
    avgScore: d.averageStartingScore,
  }));

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const item = payload[0].payload;
      return (
        <div
          style={{
            backgroundColor: '#0f172a',
            border: '1px solid #334155',
            borderRadius: '8px',
            padding: '10px 14px',
            color: '#f8fafc',
            boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5)',
            fontSize: '12px',
          }}
        >
          <div style={{ fontWeight: 700, fontSize: '13px', color: '#f59e0b', marginBottom: '6px' }}>
            {item.fullName}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'auto auto', gap: '4px 12px' }}>
            <span style={{ color: '#94a3b8' }}>Coachees Enrolled:</span>
            <span style={{ fontWeight: 600 }}>{item.coachees}</span>

            <span style={{ color: '#f87171' }}>Critical Tier (&lt; 2.0):</span>
            <span style={{ fontWeight: 600, color: '#f87171' }}>{item.critical}</span>

            <span style={{ color: '#fbbf24' }}>Moderate Tier (2.0-2.9):</span>
            <span style={{ fontWeight: 600, color: '#fbbf24' }}>{item.moderate}</span>

            <span style={{ color: '#94a3b8' }}>Target Sessions:</span>
            <span style={{ fontWeight: 600 }}>{item.targetSessions}</span>

            <span style={{ color: '#34d399' }}>Completed Sessions:</span>
            <span style={{ fontWeight: 600, color: '#34d399' }}>{item.completedSessions} ({item.completionRate}%)</span>

            <span style={{ color: '#94a3b8' }}>Active Branches:</span>
            <span style={{ fontWeight: 600 }}>{item.branchesCount}</span>
          </div>
          <div
            style={{
              marginTop: '8px',
              fontSize: '11px',
              color: '#fde047',
              fontStyle: 'italic',
              borderTop: '1px solid #1e293b',
              paddingTop: '4px',
            }}
          >
            Click bar to filter roster by this district
          </div>
        </div>
      );
    }
    return null;
  };

  const handleBarClick = (entry: any) => {
    if (!onSelectDistrict) return;
    if (entry && entry.fullName) {
      if (selectedDistrict === entry.fullName) {
        onSelectDistrict('ALL');
      } else {
        onSelectDistrict(entry.fullName);
      }
    }
  };

  return (
    <div style={{ width: '100%' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '0.5rem',
          flexWrap: 'wrap',
          gap: '0.5rem',
        }}
      >
        <div>
          <h4
            style={{
              margin: 0,
              fontSize: '0.9rem',
              fontWeight: 700,
              color: 'var(--text)',
            }}
          >
            Regional Remediation Demand &amp; Priority Distribution
          </h4>
          <p
            style={{
              margin: '0.15rem 0 0',
              fontSize: '0.75rem',
              color: 'var(--muted)',
            }}
          >
            Comparative coachee load vs critical tiers across regional banking districts. Click a bar to filter.
          </p>
        </div>

        {selectedDistrict && selectedDistrict !== 'ALL' && (
          <span
            style={{
              fontSize: '0.72rem',
              fontWeight: 600,
              padding: '0.2rem 0.6rem',
              borderRadius: '999px',
              backgroundColor: 'rgba(202, 138, 4, 0.15)',
              color: '#b45309',
              border: '1px solid rgba(202, 138, 4, 0.3)',
            }}
          >
            Filtered: {selectedDistrict}
          </span>
        )}
      </div>

      <div style={{ height: '240px', width: '100%' }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            margin={{ top: 15, right: 10, left: -15, bottom: 5 }}
            onClick={(state: any) => {
              if (state && state.activePayload && state.activePayload.length > 0) {
                handleBarClick(state.activePayload[0].payload);
              }
            }}
          >
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" opacity={0.6} />
            <XAxis
              dataKey="name"
              tick={{ fontSize: 11, fill: '#64748b' }}
              axisLine={{ stroke: '#cbd5e1' }}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 11, fill: '#64748b' }}
              axisLine={{ stroke: '#cbd5e1' }}
              tickLine={false}
              allowDecimals={false}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend
              wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }}
              iconType="circle"
            />
            <Bar
              dataKey="coachees"
              name="Total Coachees"
              fill="#ca8a04"
              radius={[4, 4, 0, 0]}
              cursor="pointer"
              onClick={handleBarClick}
            >
              {data.map((entry, index) => {
                const isSelected = selectedDistrict === entry.fullName;
                const isAnySelected = selectedDistrict && selectedDistrict !== 'ALL';
                return (
                  <Cell
                    key={`cell-coachees-${index}`}
                    fill={isSelected ? '#d97706' : '#ca8a04'}
                    opacity={isAnySelected && !isSelected ? 0.35 : 1}
                  />
                );
              })}
            </Bar>
            <Bar
              dataKey="critical"
              name="Critical (<2.0)"
              fill="#ef4444"
              radius={[4, 4, 0, 0]}
              cursor="pointer"
              onClick={handleBarClick}
            >
              {data.map((entry, index) => {
                const isSelected = selectedDistrict === entry.fullName;
                const isAnySelected = selectedDistrict && selectedDistrict !== 'ALL';
                return (
                  <Cell
                    key={`cell-critical-${index}`}
                    fill={isSelected ? '#dc2626' : '#ef4444'}
                    opacity={isAnySelected && !isSelected ? 0.35 : 1}
                  />
                );
              })}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
