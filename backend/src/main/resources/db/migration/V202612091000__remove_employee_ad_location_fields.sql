UPDATE core.employees AS employee
SET department_id = branch.id
FROM core.departments AS branch
JOIN core.departments AS district ON district.id = branch.parent_department_id
WHERE employee.department_id IS NULL
  AND NULLIF(BTRIM(employee.branch_id), '') IS NOT NULL
  AND LOWER(BTRIM(branch.code)) = LOWER(BTRIM(employee.branch_id))
  AND (
      NULLIF(BTRIM(employee.district_id), '') IS NULL
      OR LOWER(BTRIM(district.code)) = LOWER(BTRIM(employee.district_id))
  );

UPDATE core.employees AS employee
SET department_id = department.id
FROM core.departments AS district
JOIN core.departments AS department ON department.parent_department_id = district.id
WHERE employee.department_id IS NULL
  AND NULLIF(BTRIM(employee.district_id), '') IS NOT NULL
  AND NULLIF(BTRIM(employee.branch_id), '') IS NULL
  AND LOWER(BTRIM(district.code)) = LOWER(BTRIM(employee.district_id))
  AND LOWER(BTRIM(department.name)) = LOWER(BTRIM(
      COALESCE(NULLIF(employee.department_name, ''), NULLIF(employee.office_location, ''))
  ));

UPDATE core.employees AS employee
SET department_id = district.id
FROM core.departments AS district
WHERE employee.department_id IS NULL
  AND NULLIF(BTRIM(employee.district_id), '') IS NOT NULL
  AND LOWER(BTRIM(district.code)) = LOWER(BTRIM(employee.district_id))
  AND district.parent_department_id IS NULL;

ALTER TABLE core.employees
    DROP COLUMN district_id,
    DROP COLUMN branch_id,
    DROP COLUMN office_location;
