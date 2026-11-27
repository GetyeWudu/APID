DO $$
BEGIN
    IF (
        SELECT COUNT(*)
        FROM information_schema.columns
        WHERE table_schema = 'core'
          AND table_name = 'employees'
          AND column_name IN ('district_id', 'branch_id', 'office_location')
    ) = 3 THEN
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
    END IF;
END $$;

ALTER TABLE core.employees
    DROP COLUMN IF EXISTS district_id,
    DROP COLUMN IF EXISTS branch_id,
    DROP COLUMN IF EXISTS office_location;
