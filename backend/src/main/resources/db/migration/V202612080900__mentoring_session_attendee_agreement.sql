ALTER TABLE mentoring.mentoring_session_attendees
    ADD COLUMN id BIGINT;

CREATE SEQUENCE mentoring.mentoring_session_attendees_id_seq;

UPDATE mentoring.mentoring_session_attendees
SET id = nextval('mentoring.mentoring_session_attendees_id_seq');

ALTER TABLE mentoring.mentoring_session_attendees
    ALTER COLUMN id SET DEFAULT nextval('mentoring.mentoring_session_attendees_id_seq'),
    ALTER COLUMN id SET NOT NULL,
    ADD COLUMN accepted_scheduled_start TIMESTAMPTZ;

ALTER SEQUENCE mentoring.mentoring_session_attendees_id_seq
    OWNED BY mentoring.mentoring_session_attendees.id;

ALTER TABLE mentoring.mentoring_session_attendees
    DROP CONSTRAINT mentoring_session_attendees_pkey;

ALTER TABLE mentoring.mentoring_session_attendees
    RENAME COLUMN member_id TO relationship_member_id;

ALTER TABLE mentoring.mentoring_session_attendees
    ADD CONSTRAINT pk_mentoring_session_attendees PRIMARY KEY (id),
    ADD CONSTRAINT uq_mentoring_session_attendee UNIQUE (session_id, relationship_member_id);

ALTER TABLE mentoring.mentoring_session_attendees
    DROP CONSTRAINT mentoring_session_attendees_member_id_fkey,
    ADD CONSTRAINT fk_mentoring_session_attendee_member
        FOREIGN KEY (relationship_member_id)
        REFERENCES mentoring.mentoring_relationship_members(id) ON DELETE RESTRICT;

CREATE INDEX idx_mentoring_session_attendees_session
    ON mentoring.mentoring_session_attendees (session_id);

ALTER TABLE mentoring.mentoring_sessions
    ADD COLUMN proposed_by_user_id BIGINT REFERENCES core.users(id) ON DELETE SET NULL;

ALTER TABLE mentoring.mentoring_sessions
    DROP CONSTRAINT chk_mentoring_sessions_status;

ALTER TABLE mentoring.mentoring_sessions
    ADD CONSTRAINT chk_mentoring_sessions_status
    CHECK (status IN ('PENDING', 'SCHEDULED', 'CONFIRMED', 'DECLINED', 'RESCHEDULE_PROPOSED',
                      'COMPLETED', 'MISSED', 'CANCELLED', 'RESCHEDULED'));

ALTER TABLE mentoring.mentoring_sessions
    ALTER COLUMN status SET DEFAULT 'PENDING';

INSERT INTO mentoring.mentoring_session_attendees (
    session_id,
    relationship_member_id,
    accepted_scheduled_start
)
SELECT session.id,
       target.relationship_member_id,
       CASE
           WHEN session.status = 'COMPLETED'
             OR (session.status = 'CONFIRMED'
                 AND session.is_group_session = FALSE
                 AND (session.target_trainee_member_id IS NOT NULL
                      OR request.request_type = 'INDIVIDUAL'))
           THEN session.scheduled_start
           ELSE NULL
       END
FROM mentoring.mentoring_sessions session
JOIN mentoring.mentoring_session_targets target ON target.session_id = session.id
JOIN mentoring.mentoring_relationships relationship ON relationship.id = session.relationship_id
JOIN mentoring.mentoring_requests request ON request.id = relationship.request_id
ON CONFLICT (session_id, relationship_member_id) DO NOTHING;

INSERT INTO mentoring.mentoring_session_attendees (
    session_id,
    relationship_member_id,
    accepted_scheduled_start
)
SELECT session.id,
       session.target_trainee_member_id,
       CASE
           WHEN session.status IN ('CONFIRMED', 'COMPLETED') THEN session.scheduled_start
           ELSE NULL
       END
FROM mentoring.mentoring_sessions session
WHERE session.target_trainee_member_id IS NOT NULL
ON CONFLICT (session_id, relationship_member_id) DO NOTHING;

INSERT INTO mentoring.mentoring_session_attendees (
    session_id,
    relationship_member_id,
    accepted_scheduled_start
)
SELECT session.id,
       member.id,
       CASE
           WHEN session.status = 'COMPLETED'
             OR (session.status = 'CONFIRMED'
                 AND session.is_group_session = FALSE
                 AND request.request_type = 'INDIVIDUAL')
           THEN session.scheduled_start
           ELSE NULL
       END
FROM mentoring.mentoring_sessions session
JOIN mentoring.mentoring_relationships relationship ON relationship.id = session.relationship_id
JOIN mentoring.mentoring_requests request ON request.id = relationship.request_id
JOIN mentoring.mentoring_relationship_members member
  ON member.relationship_id = session.relationship_id
WHERE session.target_trainee_member_id IS NULL
  AND NOT EXISTS (
      SELECT 1
      FROM mentoring.mentoring_session_targets target
      WHERE target.session_id = session.id
  )
ON CONFLICT (session_id, relationship_member_id) DO NOTHING;

UPDATE mentoring.mentoring_sessions session
SET status = CASE
    WHEN session.status = 'SCHEDULED' THEN 'PENDING'
    WHEN session.status = 'CONFIRMED'
      AND session.is_group_session = FALSE
      AND (session.target_trainee_member_id IS NOT NULL
           OR request.request_type = 'INDIVIDUAL') THEN 'SCHEDULED'
    WHEN session.status = 'CONFIRMED' THEN 'PENDING'
    ELSE session.status
END
FROM mentoring.mentoring_relationships relationship
JOIN mentoring.mentoring_requests request ON request.id = relationship.request_id
WHERE relationship.id = session.relationship_id
  AND session.status IN ('SCHEDULED', 'CONFIRMED');
