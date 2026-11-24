import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, RotateCcw, MapPin, Building, AlertCircle } from 'lucide-react';
import { pmsReportApi } from '../../api/pmsReportApi';

export interface SharedFilterValues {
  district: string;
  branch: string;
  performanceBand: string;
  status: string;
  search: string;
}

interface SharedCascadingFilterBarProps {
  quarterId?: number;
  filters: SharedFilterValues;
  onChange: (newFilters: Partial<SharedFilterValues>) => void;
  onReset: () => void;
}

export const SharedCascadingFilterBar: React.FC<SharedCascadingFilterBarProps> = ({
  quarterId,
  filters,
  onChange,
  onReset,
}) => {
  const filterOptionsQuery = useQuery({
    queryKey: ['reporting-filter-options', quarterId],
    queryFn: () => pmsReportApi.getFilterOptions(quarterId),
    staleTime: 60_000,
  });

  const options = filterOptionsQuery.data;

  // Available branches: if a district is chosen, take only its branches!
  const availableBranches = React.useMemo(() => {
    if (!options) return [];
    if (filters.district && filters.district !== 'ALL') {
      // Find matching key case-insensitively
      const distKey = Object.keys(options.branchesByDistrict).find(
        (k) =>
          k.toLowerCase() === filters.district.toLowerCase() ||
          k.toLowerCase().includes(filters.district.toLowerCase()) ||
          filters.district.toLowerCase().includes(k.toLowerCase())
      );
      if (distKey && options.branchesByDistrict[distKey]) {
        return options.branchesByDistrict[distKey];
      }
      return options.branchesByDistrict[filters.district] || [];
    }
    // If all districts, combine all distinct branches
    const all = new Set<string>();
    Object.values(options.branchesByDistrict).forEach((brList) => {
      brList.forEach((b) => all.add(b));
    });
    return Array.from(all).sort();
  }, [options, filters.district]);

  const handleDistrictChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newDistrict = e.target.value;
    onChange({
      district: newDistrict,
      branch: 'ALL', // Strictly reset branch when district changes to prevent cross-district filtering!
    });
  };

  const hasActiveFilters =
    filters.district !== 'ALL' ||
    filters.branch !== 'ALL' ||
    filters.performanceBand !== 'ALL' ||
    filters.status !== 'ALL' ||
    Boolean(filters.search.trim());

  return (
    <div
      style={{
        backgroundColor: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: '12px',
        padding: '0.85rem 1.15rem',
        boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
      }}
      className="dark:bg-slate-900 dark:border-slate-800"
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '0.75rem',
        }}
      >
        {/* Controls Container */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '0.65rem',
            flex: '1 1 320px',
          }}
        >
          {/* Search Input */}
          <div
            style={{
              position: 'relative',
              flex: '1 1 200px',
              maxWidth: '260px',
            }}
          >
            <Search
              size={14}
              style={{
                position: 'absolute',
                left: '10px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: '#94a3b8',
                pointerEvents: 'none',
              }}
            />
            <input
              type="text"
              value={filters.search}
              onChange={(e) => onChange({ search: e.target.value })}
              placeholder="Search talent, staff ID, coach..."
              style={{
                width: '100%',
                padding: '0.45rem 0.65rem 0.45rem 2rem',
                fontSize: '0.8rem',
                backgroundColor: '#f8fafc',
                border: '1px solid #cbd5e1',
                borderRadius: '8px',
                color: '#0f172a',
                outline: 'none',
              }}
              className="dark:bg-slate-800 dark:border-slate-700 dark:text-white"
            />
          </div>

          {/* District Select */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <span
              style={{
                fontSize: '0.72rem',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                color: '#64748b',
                display: 'flex',
                alignItems: 'center',
                gap: '0.2rem',
              }}
            >
              <MapPin size={11} /> District:
            </span>
            <select
              value={filters.district}
              onChange={handleDistrictChange}
              style={{
                fontSize: '0.8rem',
                padding: '0.42rem 0.65rem',
                backgroundColor: '#f8fafc',
                border: '1px solid #cbd5e1',
                borderRadius: '8px',
                color: '#0f172a',
                cursor: 'pointer',
              }}
              className="dark:bg-slate-800 dark:border-slate-700 dark:text-white"
            >
              <option value="ALL">All Regional Districts</option>
              {options?.districts.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>

          {/* Cascading Branch Select */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <span
              style={{
                fontSize: '0.72rem',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                color: '#64748b',
                display: 'flex',
                alignItems: 'center',
                gap: '0.2rem',
              }}
            >
              <Building size={11} /> Branch:
            </span>
            <select
              value={filters.branch}
              onChange={(e) => onChange({ branch: e.target.value })}
              style={{
                fontSize: '0.8rem',
                padding: '0.42rem 0.65rem',
                backgroundColor: '#f8fafc',
                border: '1px solid #cbd5e1',
                borderRadius: '8px',
                color: '#0f172a',
                cursor: 'pointer',
                maxWidth: '220px',
              }}
              className="dark:bg-slate-800 dark:border-slate-700 dark:text-white"
            >
              <option value="ALL">All Branches</option>
              {availableBranches.map((b) => (
                <option key={b} value={b}>
                  {b.replace(' Branch Operations', '')}
                </option>
              ))}
            </select>
          </div>

          {/* Performance Band / Severity */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <span
              style={{
                fontSize: '0.72rem',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                color: '#64748b',
                display: 'flex',
                alignItems: 'center',
                gap: '0.2rem',
              }}
            >
              <AlertCircle size={11} /> Tier:
            </span>
            <select
              value={filters.performanceBand}
              onChange={(e) => onChange({ performanceBand: e.target.value })}
              style={{
                fontSize: '0.8rem',
                padding: '0.42rem 0.65rem',
                backgroundColor: '#f8fafc',
                border: '1px solid #cbd5e1',
                borderRadius: '8px',
                color: '#0f172a',
                cursor: 'pointer',
              }}
              className="dark:bg-slate-800 dark:border-slate-700 dark:text-white"
            >
              <option value="ALL">All Rating Tiers</option>
              <option value="CRITICAL">Critical Tier (&lt; 2.0)</option>
              <option value="MODERATE">Moderate Tier (2.0 - 2.9)</option>
            </select>
          </div>
        </div>

        {/* Right side: Active indicator & Reset */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          {hasActiveFilters && (
            <button
              type="button"
              onClick={onReset}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
                fontSize: '0.78rem',
                fontWeight: 600,
                color: '#b45309',
                backgroundColor: 'rgba(202, 138, 4, 0.12)',
                border: '1px solid rgba(202, 138, 4, 0.25)',
                padding: '0.35rem 0.75rem',
                borderRadius: '6px',
                cursor: 'pointer',
              }}
              title="Reset all filters"
            >
              <RotateCcw size={12} />
              <span>Reset Filters</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
