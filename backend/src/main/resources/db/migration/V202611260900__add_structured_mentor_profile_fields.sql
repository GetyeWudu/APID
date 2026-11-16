ALTER TABLE mentoring.mentor_applications
    ADD COLUMN experience_years INTEGER
        CHECK (experience_years IS NULL OR experience_years >= 0),
    ADD COLUMN mentoring_approach VARCHAR(2000),
    ADD COLUMN sessions_per_week INTEGER
        CHECK (sessions_per_week IS NULL OR sessions_per_week >= 0);

ALTER TABLE mentoring.trainer_authorizations
    ADD COLUMN experience_years INTEGER
        CHECK (experience_years IS NULL OR experience_years >= 0),
    ADD COLUMN mentoring_approach VARCHAR(2000),
    ADD COLUMN sessions_per_week INTEGER
        CHECK (sessions_per_week IS NULL OR sessions_per_week >= 0);

UPDATE mentoring.mentor_applications
SET mentoring_approach = NULLIF(BTRIM(expertise_summary), '')
WHERE mentoring_approach IS NULL
  AND expertise_summary IS NOT NULL;

UPDATE mentoring.mentor_applications
SET experience_years =
        (regexp_match(
                LOWER(expertise_summary),
                '(^|[^0-9])([0-9]+)[[:space:]]+years?([^[:alpha:]]|$)'
        ))[2]::INTEGER
WHERE experience_years IS NULL
  AND expertise_summary IS NOT NULL
  AND regexp_match(
          LOWER(expertise_summary),
          '(^|[^0-9])([0-9]+)[[:space:]]+years?([^[:alpha:]]|$)'
      ) IS NOT NULL;

UPDATE mentoring.mentor_applications
SET sessions_per_week =
        (regexp_match(
                LOWER(BTRIM(availability_notes)),
                '^(weekly availability:[[:space:]]*)?([0-9]+)$'
        ))[2]::INTEGER
WHERE sessions_per_week IS NULL
  AND availability_notes IS NOT NULL
  AND regexp_match(
          LOWER(BTRIM(availability_notes)),
          '^(weekly availability:[[:space:]]*)?([0-9]+)$'
      ) IS NOT NULL;

UPDATE mentoring.trainer_authorizations AS ta
SET experience_years = COALESCE(ta.experience_years, application.experience_years),
    mentoring_approach = COALESCE(ta.mentoring_approach, application.mentoring_approach),
    sessions_per_week = COALESCE(ta.sessions_per_week, application.sessions_per_week)
FROM mentoring.mentor_applications AS application
WHERE ta.source_application_id = application.id;

UPDATE mentoring.trainer_authorizations
SET mentoring_approach = NULLIF(BTRIM(bio), '')
WHERE mentoring_approach IS NULL
  AND bio IS NOT NULL;

UPDATE mentoring.trainer_authorizations
SET experience_years =
        (regexp_match(
                LOWER(bio),
                '(^|[^0-9])([0-9]+)[[:space:]]+years?([^[:alpha:]]|$)'
        ))[2]::INTEGER
WHERE experience_years IS NULL
  AND bio IS NOT NULL
  AND regexp_match(
          LOWER(bio),
          '(^|[^0-9])([0-9]+)[[:space:]]+years?([^[:alpha:]]|$)'
      ) IS NOT NULL;

UPDATE mentoring.trainer_authorizations
SET sessions_per_week =
        (regexp_match(
                LOWER(BTRIM(availability_notes)),
                '^(weekly availability:[[:space:]]*)?([0-9]+)$'
        ))[2]::INTEGER
WHERE sessions_per_week IS NULL
  AND availability_notes IS NOT NULL
  AND regexp_match(
          LOWER(BTRIM(availability_notes)),
          '^(weekly availability:[[:space:]]*)?([0-9]+)$'
      ) IS NOT NULL;
