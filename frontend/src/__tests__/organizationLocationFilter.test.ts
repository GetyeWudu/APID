import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { organizationApi } from '../features/admin/organization/api/organizationApi';
import {
  buildOrganizationLocationOptions,
  filterByOrganizationLocation,
  OrganizationLocationFilter,
} from '../features/mentoring/components/OrganizationLocationFilter';

afterEach(() => vi.restoreAllMocks());

describe('OrganizationLocationFilter', () => {
  it('loads all organization departments so synced districts appear', async () => {
    const district = {
      id: 1,
      code: 'DST-01',
      name: 'North Zone',
      parentDepartmentId: null,
      parentDepartmentName: null,
      headEmployeeId: null,
      headEmployeeName: null,
      active: false,
      createdAt: '',
      updatedAt: '',
    };
    const listDepartments = vi.spyOn(organizationApi, 'listDepartments').mockImplementation(
      async (activeOnly = false) => activeOnly ? [] : [district]
    );
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <OrganizationLocationFilter paths={[]} value="" onChange={vi.fn()} />
      </QueryClientProvider>
    );

    expect(await screen.findByRole('option', { name: 'North Zone' })).toBeInTheDocument();
    expect(listDepartments).toHaveBeenCalledWith(false);
  });
});

describe('buildOrganizationLocationOptions', () => {
  it('uses the organization district codes and includes districts with no branches', () => {
    const options = buildOrganizationLocationOptions([
      { id: 1, code: 'DST-01', name: 'North Zone', parentDepartmentId: null },
      { id: 2, code: 'SOUTH-DISTRICT', name: 'South Zone', parentDepartmentId: null },
      { id: 3, code: null, name: 'Central District', parentDepartmentId: null },
      { id: 4, code: 'BR-01', name: 'Central Branch', parentDepartmentId: 1 },
      { id: 5, code: 'TEAM-01', name: 'Branch Team', parentDepartmentId: 4 },
    ], []);

    expect(options.districts).toEqual([
      ['department:3', 'Central District'],
      ['department:1', 'North Zone'],
      ['department:2', 'South Zone'],
    ]);
    expect(options.branches).toEqual([
      ['department:5', { name: 'Branch Team', districtId: 'department:1' }],
      ['department:4', { name: 'Central Branch', districtId: 'department:1' }],
    ]);
  });
});

describe('filterByOrganizationLocation', () => {
  it('includes descendants when an ancestor location is selected', () => {
    const rows = [
      {
        id: 1,
        organizationPath: [
          { id: 'department:1', name: 'North District' },
          { id: 'department:2', name: 'Central Branch' },
        ],
      },
      {
        id: 2,
        organizationPath: [
          { id: 'department:3', name: 'South District' },
          { id: 'department:4', name: 'Market Branch' },
        ],
      },
    ];

    expect(filterByOrganizationLocation(rows, 'department:1').map((row) => row.id)).toEqual([1]);
    expect(filterByOrganizationLocation(rows, '').map((row) => row.id)).toEqual([1, 2]);
  });
});
