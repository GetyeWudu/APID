-- V202611270900__unify_core_communication_for_coaching_and_mentoring.sql
-- Elevates conversation and messaging tables from coaching schema to core schema
-- to serve both Coaching and Mentoring modules as a unified communication engine.
-- Preserves backward-compatible views in coaching schema.

-- 1. Idempotently move base tables from coaching to core
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'coaching' AND table_name = 'conversations' AND table_type = 'BASE TABLE'
    ) THEN
        ALTER TABLE coaching.conversations SET SCHEMA core;
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'coaching' AND table_name = 'conversation_participants' AND table_type = 'BASE TABLE'
    ) THEN
        ALTER TABLE coaching.conversation_participants SET SCHEMA core;
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'coaching' AND table_name = 'messages' AND table_type = 'BASE TABLE'
    ) THEN
        ALTER TABLE coaching.messages SET SCHEMA core;
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'coaching' AND table_name = 'message_attachments' AND table_type = 'BASE TABLE'
    ) THEN
        ALTER TABLE coaching.message_attachments SET SCHEMA core;
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'coaching' AND table_name = 'conversation_read_state' AND table_type = 'BASE TABLE'
    ) THEN
        ALTER TABLE coaching.conversation_read_state SET SCHEMA core;
    END IF;
END $$;

-- 2. Create backward-compatible views in coaching schema so existing coaching queries/tools resolve cleanly
CREATE OR REPLACE VIEW coaching.conversations AS SELECT * FROM core.conversations;
CREATE OR REPLACE VIEW coaching.conversation_participants AS SELECT * FROM core.conversation_participants;
CREATE OR REPLACE VIEW coaching.messages AS SELECT * FROM core.messages;
CREATE OR REPLACE VIEW coaching.message_attachments AS SELECT * FROM core.message_attachments;
CREATE OR REPLACE VIEW coaching.conversation_read_state AS SELECT * FROM core.conversation_read_state;

-- 3. Add Mentoring parent references to core.conversations
ALTER TABLE core.conversations
    ADD COLUMN IF NOT EXISTS mentoring_relationship_id BIGINT REFERENCES mentoring.mentoring_relationships(id) ON DELETE CASCADE,
    ADD COLUMN IF NOT EXISTS skill_id BIGINT REFERENCES core.skills(id) ON DELETE SET NULL;

-- 4. Expand context_type check constraint
ALTER TABLE core.conversations DROP CONSTRAINT IF EXISTS conversations_context_type_check;
ALTER TABLE core.conversations DROP CONSTRAINT IF EXISTS chk_conversations_context_type;
ALTER TABLE core.conversations ADD CONSTRAINT chk_conversations_context_type CHECK (
    context_type IN (
        'MANDATORY_ASSIGNMENT',
        'SKILL_COHORT_GROUP',
        'SKILL_PEER_DIRECT',
        'MENTORING_RELATIONSHIP_DIRECT',
        'MENTORING_COHORT_GROUP',
        'MENTORING_PEER_DIRECT'
    )
);

-- 5. Expand participant role check constraint
ALTER TABLE core.conversation_participants DROP CONSTRAINT IF EXISTS conversation_participants_role_check;
ALTER TABLE core.conversation_participants DROP CONSTRAINT IF EXISTS chk_conversation_participants_role;
ALTER TABLE core.conversation_participants ADD CONSTRAINT chk_conversation_participants_role CHECK (
    role IN ('COACH', 'COACHEE', 'PEER', 'TRAINER', 'TRAINEE')
);

-- 6. Update context integrity check constraint to govern both Coaching and Mentoring scenarios
ALTER TABLE core.conversations DROP CONSTRAINT IF EXISTS chk_conversation_context;
ALTER TABLE core.conversations ADD CONSTRAINT chk_conversation_context CHECK (
    -- 1. Coaching: Mandatory Coach <-> Coachee
    (context_type = 'MANDATORY_ASSIGNMENT' 
        AND conversation_type = 'DIRECT' 
        AND assignment_id IS NOT NULL 
        AND skill_request_id IS NULL 
        AND mentoring_relationship_id IS NULL
        AND peer_employee_a_id IS NULL 
        AND peer_employee_b_id IS NULL)
    OR
    -- 2. Coaching: Skill Cohort Group
    (context_type = 'SKILL_COHORT_GROUP' 
        AND conversation_type = 'GROUP' 
        AND skill_request_id IS NOT NULL 
        AND assignment_id IS NULL 
        AND mentoring_relationship_id IS NULL
        AND peer_employee_a_id IS NULL 
        AND peer_employee_b_id IS NULL)
    OR
    -- 3. Coaching: Peer Coachee <-> Coachee
    (context_type = 'SKILL_PEER_DIRECT' 
        AND conversation_type = 'DIRECT' 
        AND skill_request_id IS NOT NULL 
        AND assignment_id IS NULL 
        AND mentoring_relationship_id IS NULL
        AND peer_employee_a_id IS NOT NULL 
        AND peer_employee_b_id IS NOT NULL 
        AND peer_employee_a_id < peer_employee_b_id)
    OR
    -- 4. Mentoring: Trainer <-> Trainee (1:1 Direct)
    (context_type = 'MENTORING_RELATIONSHIP_DIRECT' 
        AND conversation_type = 'DIRECT' 
        AND mentoring_relationship_id IS NOT NULL 
        AND assignment_id IS NULL 
        AND skill_request_id IS NULL
        AND peer_employee_a_id IS NULL 
        AND peer_employee_b_id IS NULL)
    OR
    -- 5. Mentoring: Trainer <-> Trainees Cohort Group
    (context_type = 'MENTORING_COHORT_GROUP' 
        AND conversation_type = 'GROUP' 
        AND mentoring_relationship_id IS NOT NULL 
        AND assignment_id IS NULL 
        AND skill_request_id IS NULL
        AND peer_employee_a_id IS NULL 
        AND peer_employee_b_id IS NULL)
    OR
    -- 6. Mentoring: Trainee <-> Trainee (Peer Direct within same relationship/cohort)
    (context_type = 'MENTORING_PEER_DIRECT' 
        AND conversation_type = 'DIRECT' 
        AND mentoring_relationship_id IS NOT NULL 
        AND assignment_id IS NULL 
        AND skill_request_id IS NULL
        AND peer_employee_a_id IS NOT NULL 
        AND peer_employee_b_id IS NOT NULL 
        AND peer_employee_a_id < peer_employee_b_id)
);

-- 7. Add partial unique indexes for Mentoring scenarios to guarantee conversation uniqueness
CREATE UNIQUE INDEX IF NOT EXISTS uq_conv_mentoring_relationship_direct 
    ON core.conversations (mentoring_relationship_id) 
    WHERE context_type = 'MENTORING_RELATIONSHIP_DIRECT';

CREATE UNIQUE INDEX IF NOT EXISTS uq_conv_mentoring_cohort_group 
    ON core.conversations (mentoring_relationship_id, COALESCE(skill_id, 0)) 
    WHERE context_type = 'MENTORING_COHORT_GROUP';

CREATE UNIQUE INDEX IF NOT EXISTS uq_conv_mentoring_peer_pair 
    ON core.conversations (mentoring_relationship_id, peer_employee_a_id, peer_employee_b_id) 
    WHERE context_type = 'MENTORING_PEER_DIRECT';

CREATE INDEX IF NOT EXISTS idx_conversations_mentoring_rel 
    ON core.conversations (mentoring_relationship_id);

-- 8. Backfill 1:1 Direct Mentoring Conversations for any existing active relationships
INSERT INTO core.conversations (
    conversation_type,
    context_type,
    mentoring_relationship_id,
    skill_id,
    title,
    status,
    created_at,
    updated_at
)
SELECT 
    'DIRECT',
    'MENTORING_RELATIONSHIP_DIRECT',
    mr.id,
    mrm.skill_id,
    COALESCE('Mentoring · ' || mentor_emp.full_name || ' & ' || trainee_emp.full_name, 'Mentoring Discussion'),
    'ACTIVE',
    NOW(),
    NOW()
FROM mentoring.mentoring_relationships mr
JOIN mentoring.mentoring_relationship_members mrm ON mrm.relationship_id = mr.id
LEFT JOIN core.employees mentor_emp ON mentor_emp.user_id = mr.mentor_user_id
LEFT JOIN core.employees trainee_emp ON trainee_emp.user_id = mrm.trainee_user_id
WHERE mr.status = 'ACTIVE' AND mrm.status = 'ACTIVE'
ON CONFLICT (mentoring_relationship_id) WHERE context_type = 'MENTORING_RELATIONSHIP_DIRECT' DO NOTHING;

-- Populate participants for backfilled mentoring conversations
-- Trainer participant
INSERT INTO core.conversation_participants (
    conversation_id,
    employee_id,
    user_id,
    role,
    status,
    joined_at
)
SELECT 
    c.id,
    mentor_emp.id,
    mr.mentor_user_id,
    'TRAINER',
    'ACTIVE',
    NOW()
FROM core.conversations c
JOIN mentoring.mentoring_relationships mr ON mr.id = c.mentoring_relationship_id
JOIN core.employees mentor_emp ON mentor_emp.user_id = mr.mentor_user_id
WHERE c.context_type = 'MENTORING_RELATIONSHIP_DIRECT'
ON CONFLICT (conversation_id, employee_id) DO NOTHING;

-- Trainee participant
INSERT INTO core.conversation_participants (
    conversation_id,
    employee_id,
    user_id,
    role,
    status,
    joined_at
)
SELECT 
    c.id,
    trainee_emp.id,
    mrm.trainee_user_id,
    'TRAINEE',
    'ACTIVE',
    NOW()
FROM core.conversations c
JOIN mentoring.mentoring_relationships mr ON mr.id = c.mentoring_relationship_id
JOIN mentoring.mentoring_relationship_members mrm ON mrm.relationship_id = mr.id
JOIN core.employees trainee_emp ON trainee_emp.user_id = mrm.trainee_user_id
WHERE c.context_type = 'MENTORING_RELATIONSHIP_DIRECT' AND mrm.status = 'ACTIVE'
ON CONFLICT (conversation_id, employee_id) DO NOTHING;
