import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { organizationApi } from '../../admin/organization/api/organizationApi';
import type { DepartmentDto } from '../../admin/organization/types/organization.types';
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
  districtLabel = 'District',
  branchLabel = 'Branch',
}: {
  paths: OrganizationLocation[][];
  value: string;
  onChange: (value: string) => void;
  label?: string;
  districtLabel?: string;
  branchLabel?: string;
}) {
  const departmentsQuery = useQuery({
    queryKey: ['core', 'organization', 'departments', 'active'],
    queryFn: () => organizationApi.listDepartments(true),
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  const { districts, branches, hasUnassigned } = useMemo(() => {
    const districtMap = new Map<string, string>();
    const branchMap = new Map<string, { name: string; districtId: string | null }>();
    let unassigned = false;

    const departments = departmentsQuery.data ?? [];
    if (departments.length > 0) {
      const deptById = new Map<number, DepartmentDto>(departments.map((d) => [d.id, d]));
      const parentIds = new Set<number>(
        departments
          .map((d) => d.parentDepartmentId)
          .filter((id): id is number => id !== null && id !== undefined)
      );

      const findRoot = (dept: DepartmentDto): DepartmentDto => {
        let current = dept;
        const visited = new Set<number>([current.id]);
        while (current.parentDepartmentId != null) {
          const parent = deptById.get(current.parentDepartmentId);
          if (!parent || !visited.add(parent.id)) break;
          current = parent;
        }
        return current;
      };

      departments.forEach((dept) => {
        if (dept.parentDepartmentId == null) {
          if (parentIds.has(dept.id)) {
            districtMap.set(`department:${dept.id}`, dept.name);
          } else {
            branchMap.set(`department:${dept.id}`, { name: dept.name, districtId: null });
          }
        } else {
          const root = findRoot(dept);
          const rootId = `department:${root.id}`;
          districtMap.set(rootId, root.name);
          branchMap.set(`department:${dept.id}`, {
            name: dept.name,
            districtId: rootId,
          });
        }
      });
    }

    paths.forEach((path) => {
      if (path.length === 0) {
        unassigned = true;
        return;
      }
      if (path.length >= 2) {
        const district = path[0];
        if (!districtMap.has(district.id)) {
          districtMap.set(district.id, district.name);
        }
        for (let i = 1; i < path.length; i += 1) {
          const branch = path[i];
          if (!branchMap.has(branch.id)) {
            branchMap.set(branch.id, { name: branch.name, districtId: district.id });
          }
        }
      } else {
        const single = path[0];
        if (!districtMap.has(single.id) && !branchMap.has(single.id)) {
          branchMap.set(single.id, { name: single.name, districtId: null });
        }
      }
    });

    return {
      districts: [...districtMap.entries()].sort((a, b) => a[1].localeCompare(b[1])),
      branches: [...branchMap.entries()].sort((a, b) => a[1].name.localeCompare(b[1].name)),
      hasUnassigned: unassigned,
    };
  }, [departmentsQuery.data, paths]);

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
    </div>
  );
}
