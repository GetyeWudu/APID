import type { DepartmentItem } from './types/organization.types';

export function isDistrictDepartment(
  department: Pick<DepartmentItem, 'code' | 'name'>
) {
  const code = department.code?.trim().toUpperCase();
  return code?.startsWith('DST-')
    || code?.endsWith('-DISTRICT')
    || department.name.toLowerCase().includes('district');
}
