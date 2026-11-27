import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { organizationApi } from '../../admin/organization/api/organizationApi';
import { isDistrictDepartment } from '../../admin/organization/organizationUnits';
import type { DepartmentItem } from '../../admin/organization/types/organization.types';
import type { OrganizationLocation, OrganizationLocated } from '../api/organizationLocation';

type LocationFilterDepartment = Pick<
  DepartmentItem,
  'id' | 'code' | 'name' | 'parentDepartmentId'
>;

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

export function buildOrganizationLocationOptions(
  departments: LocationFilterDepartment[],
  paths: OrganizationLocation[][]
) {
  const districtMap = new Map<string, string>();
  const branchMap = new Map<string, { name: string; districtId: string | null }>();
  const departmentById = new Map<number, LocationFilterDepartment>(
    departments.map((department) => [department.id, department])
  );
  const districtIds = new Set(
    departments.filter(isDistrictDepartment).map((department) => department.id)
  );

  departments.forEach((department) => {
    if (districtIds.has(department.id)) {
      districtMap.set(`department:${department.id}`, department.name);
      return;
    }

    let parentId = department.parentDepartmentId;
    let districtId: string | null = null;
    const visited = new Set([department.id]);
    while (parentId != null && !visited.has(parentId)) {
      visited.add(parentId);
      const parent = departmentById.get(parentId);
      if (!parent) break;
      if (districtIds.has(parent.id)) {
        districtId = `department:${parent.id}`;
        break;
      }
      parentId = parent.parentDepartmentId;
    }

    branchMap.set(`department:${department.id}`, {
      name: department.name,
      districtId,
    });
  });

  let hasUnassigned = false;
  paths.forEach((path) => {
    if (path.length === 0) {
      hasUnassigned = true;
      return;
    }
    if (path.length >= 2) {
      const district = path[0];
      districtMap.set(district.id, district.name);
      for (let index = 1; index < path.length; index += 1) {
        const branch = path[index];
        if (!branchMap.has(branch.id)) {
          branchMap.set(branch.id, { name: branch.name, districtId: district.id });
        }
      }
    } else {
      const location = path[0];
      if (!districtMap.has(location.id) && !branchMap.has(location.id)) {
        branchMap.set(location.id, { name: location.name, districtId: null });
      }
    }
  });

  return {
    districts: [...districtMap.entries()].sort((first, second) =>
      first[1].localeCompare(second[1])
    ),
    branches: [...branchMap.entries()].sort((first, second) =>
      first[1].name.localeCompare(second[1].name)
    ),
    hasUnassigned,
  };
}

export function OrganizationLocationFilter({
  paths,
  value,
  onChange,
  districtLabel = 'District',
  branchLabel = 'Branch',
}: {
  paths: OrganizationLocation[][];
  value: string;
  onChange: (value: string) => void;
  districtLabel?: string;
  branchLabel?: string;
}) {
  const departmentsQuery = useQuery({
    queryKey: ['core', 'organization', 'departments', 'all'],
    queryFn: () => organizationApi.listDepartments(false),
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  const { districts, branches, hasUnassigned } = useMemo(
    () => buildOrganizationLocationOptions(departmentsQuery.data ?? [], paths),
    [departmentsQuery.data, paths]
  );

  const branchById = useMemo(() => new Map(branches), [branches]);
  const districtIds = useMemo(() => new Set(districts.map(([id]) => id)), [districts]);

  const selectedDistrictId = districtIds.has(value)
    ? value
    : branchById.get(value)?.districtId ?? '';

  const selectedBranchId =
    value === '__unassigned__' || branchById.has(value) ? value : '';

  const visibleBranches = useMemo(() => {
    if (!selectedDistrictId) return branches;
    return branches.filter(([, meta]) => meta.districtId === selectedDistrictId);
  }, [branches, selectedDistrictId]);

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.65rem', alignItems: 'flex-end' }}>
      <label className="apid-field" style={{ minWidth: '12rem', margin: 0 }}>
        {districtLabel}
        <select
          className="apid-input"
          style={{ width: '100%' }}
          aria-label={`Filter by ${districtLabel.toLowerCase()}`}
          value={selectedDistrictId}
          onChange={(event) => onChange(event.target.value)}
        >
          <option value="">All districts</option>
          {districts.map(([id, name]) => (
            <option key={id} value={id}>
              {name}
            </option>
          ))}
        </select>
      </label>

      <label className="apid-field" style={{ minWidth: '12rem', margin: 0 }}>
        {branchLabel}
        <select
          className="apid-input"
          style={{ width: '100%' }}
          aria-label={`Filter by ${branchLabel.toLowerCase()}`}
          value={selectedBranchId}
          onChange={(event) => {
            const nextBranchId = event.target.value;
            onChange(nextBranchId || selectedDistrictId);
          }}
        >
          <option value="">All branches</option>
          {visibleBranches.map(([id, meta]) => (
            <option key={id} value={id}>
              {meta.name}
            </option>
          ))}
          {hasUnassigned && <option value="__unassigned__">Unassigned location</option>}
        </select>
      </label>
      {departmentsQuery.isError && (
        <p className="apid-alert apid-alert-danger" role="alert" style={{ margin: 0 }}>
          Organization locations could not be loaded.
        </p>
      )}
    </div>
  );
}
