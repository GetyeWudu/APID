import { useMemo } from 'react';
import type { OrganizationLocation, OrganizationLocated } from '../api/organizationLocation';

export function filterByOrganizationLocation<T extends OrganizationLocated>(
  rows: T[],
  selectedLocationId: string
) {
  if (!selectedLocationId) return rows;
  if (selectedLocationId === '__unassigned__') {
    return rows.filter((row) => !row.organizationPath?.length);
  }
  return rows.filter((row) =>
    row.organizationPath?.some((location) => location.id === selectedLocationId)
  );
}

export function OrganizationLocationFilter({
  paths,
  value,
  onChange,
  label = 'Filter by district, branch, or department',
}: {
  paths: OrganizationLocation[][];
  value: string;
  onChange: (value: string) => void;
  label?: string;
}) {
  const options = useMemo(() => {
    const labelsById = new Map<string, string>();
    let hasUnassigned = false;
    paths.forEach((path) => {
      if (path.length === 0) hasUnassigned = true;
      path.forEach((location, index) => {
        labelsById.set(
          location.id,
          path.slice(0, index + 1).map((part) => part.name).join(' / ')
        );
      });
    });
    return {
      locations: [...labelsById.entries()].sort((a, b) => a[1].localeCompare(b[1])),
      hasUnassigned,
    };
  }, [paths]);

  return (
    <label className="apid-field" style={{ minWidth: 'min(100%, 16rem)' }}>
      {label}
      <select
        className="apid-input"
        aria-label={label}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="">All locations</option>
        {options.locations.map(([id, name]) => (
          <option key={id} value={id}>{name}</option>
        ))}
        {options.hasUnassigned && <option value="__unassigned__">Unassigned location</option>}
      </select>
    </label>
  );
}
