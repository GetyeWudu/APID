import { describe, expect, it } from 'vitest';
import { filterByOrganizationLocation } from '../features/mentoring/components/OrganizationLocationFilter';

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
