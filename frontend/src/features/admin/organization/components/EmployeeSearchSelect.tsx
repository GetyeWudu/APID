import { useEffect, useState } from 'react';
import { organizationApi } from '../api/organizationApi';
import type { EmployeeItem } from '../types/organization.types';

interface EmployeeSearchSelectProps {
  id?: string;
  value: number | null;
  selectedLabel?: string | null;
  excludeId?: number | null;
  noneLabel: string;
  placeholder?: string;
  onChange: (employeeId: number | null, selected?: EmployeeItem | null) => void;
}

export function EmployeeSearchSelect({
  id,
  value,
  selectedLabel,
  excludeId,
  noneLabel,
  placeholder = 'Search by name or employee #...',
  onChange,
}: EmployeeSearchSelectProps) {
  const [query, setQuery] = useState('');
  const [options, setOptions] = useState<EmployeeItem[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let active = true;
    const timer = window.setTimeout(async () => {
      setLoading(true);
      try {
        const res = await organizationApi.searchEmployees({
          search: query.trim() || undefined,
          page: 0,
          size: 25,
        });
        if (active) {
          setOptions(res.content);
        }
      } catch {
        if (active) {
          setOptions([]);
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }, 220);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [query]);

  const filtered = options.filter((opt) => excludeId == null || opt.id !== excludeId);
  const selectedInOptions = value != null && filtered.some((o) => o.id === value);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
      <input
        type="text"
        className="apid-input"
        placeholder={placeholder}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <select
        id={id}
        className="apid-input"
        value={value ?? ''}
        onChange={(e) => {
          const nextId = e.target.value ? Number(e.target.value) : null;
          const found = nextId != null ? filtered.find((o) => o.id === nextId) ?? null : null;
          onChange(nextId, found);
        }}
      >
        <option value="">{noneLabel}</option>
        {value != null && !selectedInOptions && selectedLabel && (
          <option value={value}>{selectedLabel} (current)</option>
        )}
        {filtered.map((opt) => (
          <option key={opt.id} value={opt.id}>
            {opt.fullName} ({opt.employeeNumber})
            {opt.position ? ` — ${opt.position}` : ''}
          </option>
        ))}
      </select>
      {loading && (
        <span style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>Searching employees...</span>
      )}
    </div>
  );
}

