UPDATE mentoring.mentor_applications
SET note = NULLIF(BTRIM(regexp_replace(
        regexp_replace(note, '(^|\n)Availability:[^\n]*(\n|$)', E'\\1', 'g'),
        '(^|\n)Mentorship formats:[^\n]*(\n|$)',
        E'\\1',
        'g'
)), '')
WHERE note LIKE 'MENTOR APPLICATION DETAILS%';

ALTER TABLE mentoring.mentor_applications
    DROP COLUMN availability_notes;

ALTER TABLE mentoring.trainer_authorizations
    DROP COLUMN availability_notes;
