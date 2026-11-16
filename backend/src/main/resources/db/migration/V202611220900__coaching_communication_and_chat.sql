-- V202611220900__coaching_communication_and_chat.sql
-- Implements Phase 1 of the Coaching Communication System:
-- Explicit parent relations, conversation uniqueness, participant lifecycle,
-- composite reply integrity guard, attachments, and read state.

-- 1. Coaching Conversations
CREATE TABLE IF NOT EXISTS coaching.conversations (
    id                                  BIGSERIAL PRIMARY KEY,
    conversation_type                   VARCHAR(20) NOT NULL 
                                        CHECK (conversation_type IN ('DIRECT', 'GROUP')),
    context_type                        VARCHAR(30) NOT NULL 
                                        CHECK (context_type IN ('MANDATORY_ASSIGNMENT', 'SKILL_COHORT_GROUP', 'SKILL_PEER_DIRECT')),
    assignment_id                       BIGINT REFERENCES coaching.coaching_assignments(id) ON DELETE CASCADE,
    skill_request_id                    BIGINT REFERENCES coaching.skill_coaching_requests(id) ON DELETE CASCADE,
    peer_employee_a_id                  BIGINT REFERENCES core.employees(id) ON DELETE CASCADE,
    peer_employee_b_id                  BIGINT REFERENCES core.employees(id) ON DELETE CASCADE,
    title                               VARCHAR(200) NOT NULL,
    status                              VARCHAR(20) NOT NULL DEFAULT 'ACTIVE' 
                                        CHECK (status IN ('ACTIVE', 'ARCHIVED')),
    created_by_user_id                  BIGINT REFERENCES core.users(id),
    created_at                          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at                          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Enforce explicit parent relationship and valid conversation types per context
    CONSTRAINT chk_conversation_context CHECK (
        (context_type = 'MANDATORY_ASSIGNMENT' 
            AND conversation_type = 'DIRECT' 
            AND assignment_id IS NOT NULL 
            AND skill_request_id IS NULL 
            AND peer_employee_a_id IS NULL 
            AND peer_employee_b_id IS NULL)
        OR
        (context_type = 'SKILL_COHORT_GROUP' 
            AND conversation_type = 'GROUP' 
            AND skill_request_id IS NOT NULL 
            AND assignment_id IS NULL 
            AND peer_employee_a_id IS NULL 
            AND peer_employee_b_id IS NULL)
        OR
        (context_type = 'SKILL_PEER_DIRECT' 
            AND conversation_type = 'DIRECT' 
            AND skill_request_id IS NOT NULL 
            AND assignment_id IS NULL 
            AND peer_employee_a_id IS NOT NULL 
            AND peer_employee_b_id IS NOT NULL 
            AND peer_employee_a_id < peer_employee_b_id)
    )
);

-- Partial unique indexes to prevent duplicate conversations
CREATE UNIQUE INDEX IF NOT EXISTS uq_conv_mandatory_assignment 
    ON coaching.conversations (assignment_id) 
    WHERE context_type = 'MANDATORY_ASSIGNMENT';

CREATE UNIQUE INDEX IF NOT EXISTS uq_conv_skill_cohort_group 
    ON coaching.conversations (skill_request_id) 
    WHERE context_type = 'SKILL_COHORT_GROUP';

CREATE UNIQUE INDEX IF NOT EXISTS uq_conv_skill_peer_pair 
    ON coaching.conversations (skill_request_id, peer_employee_a_id, peer_employee_b_id) 
    WHERE context_type = 'SKILL_PEER_DIRECT';

-- 2. Conversation Participants
CREATE TABLE IF NOT EXISTS coaching.conversation_participants (
    id                                  BIGSERIAL PRIMARY KEY,
    conversation_id                     BIGINT NOT NULL REFERENCES coaching.conversations(id) ON DELETE CASCADE,
    employee_id                         BIGINT NOT NULL REFERENCES core.employees(id) ON DELETE CASCADE,
    user_id                             BIGINT REFERENCES core.users(id) ON DELETE SET NULL,
    role                                VARCHAR(20) NOT NULL 
                                        CHECK (role IN ('COACH', 'COACHEE', 'PEER')),
    status                              VARCHAR(20) NOT NULL DEFAULT 'ACTIVE' 
                                        CHECK (status IN ('ACTIVE', 'REMOVED')),
    joined_at                           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    left_at                             TIMESTAMPTZ,
    removed_by_user_id                  BIGINT REFERENCES core.users(id),
    removal_reason                      TEXT,

    CONSTRAINT uq_conv_participant UNIQUE (conversation_id, employee_id)
);

CREATE INDEX IF NOT EXISTS idx_conv_participants_user 
    ON coaching.conversation_participants (user_id, status);

CREATE INDEX IF NOT EXISTS idx_conv_participants_emp 
    ON coaching.conversation_participants (employee_id, status);

-- 3. Coaching Messages
CREATE TABLE IF NOT EXISTS coaching.messages (
    id                                  BIGSERIAL PRIMARY KEY,
    conversation_id                     BIGINT NOT NULL REFERENCES coaching.conversations(id) ON DELETE CASCADE,
    sender_employee_id                  BIGINT NOT NULL REFERENCES core.employees(id),
    sender_user_id                      BIGINT NOT NULL REFERENCES core.users(id),
    message_type                        VARCHAR(20) NOT NULL DEFAULT 'TEXT' 
                                        CHECK (message_type IN ('TEXT', 'FILE', 'RESOURCE_LINK')),
    content                             TEXT,
    client_message_id                   VARCHAR(64),
    reply_to_message_id                 BIGINT,
    is_pinned                           BOOLEAN NOT NULL DEFAULT FALSE,
    pinned_by_user_id                   BIGINT REFERENCES core.users(id),
    pinned_at                           TIMESTAMPTZ,
    is_deleted                          BOOLEAN NOT NULL DEFAULT FALSE,
    deleted_at                          TIMESTAMPTZ,
    deleted_by_user_id                  BIGINT REFERENCES core.users(id),
    edited_at                           TIMESTAMPTZ,
    edited_by_user_id                   BIGINT REFERENCES core.users(id),
    created_at                          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Composite unique key to support composite reply FK
    CONSTRAINT uq_messages_conv_id UNIQUE (conversation_id, id),

    -- Reply foreign key: physically guarantees replied-to message belongs to the same conversation
    CONSTRAINT fk_messages_reply FOREIGN KEY (conversation_id, reply_to_message_id) 
        REFERENCES coaching.messages (conversation_id, id) ON DELETE SET NULL
);

-- Deduplication index for retries
CREATE UNIQUE INDEX IF NOT EXISTS uq_messages_client_id 
    ON coaching.messages (conversation_id, client_message_id) 
    WHERE client_message_id IS NOT NULL;

-- Ordering indexes
CREATE INDEX IF NOT EXISTS idx_messages_conv_id_desc 
    ON coaching.messages (conversation_id, id DESC);

CREATE INDEX IF NOT EXISTS idx_messages_conv_created 
    ON coaching.messages (conversation_id, created_at DESC);

-- 4. Message Attachments
CREATE TABLE IF NOT EXISTS coaching.message_attachments (
    id                                  BIGSERIAL PRIMARY KEY,
    message_id                          BIGINT NOT NULL REFERENCES coaching.messages(id) ON DELETE CASCADE,
    file_name                           VARCHAR(255) NOT NULL,
    storage_key                         VARCHAR(500) NOT NULL,
    mime_type                           VARCHAR(120) NOT NULL,
    file_size_bytes                     BIGINT NOT NULL CHECK (file_size_bytes > 0),
    scan_status                         VARCHAR(20) NOT NULL DEFAULT 'CLEAN' 
                                        CHECK (scan_status IN ('PENDING', 'CLEAN', 'REJECTED')),
    uploaded_by_user_id                 BIGINT NOT NULL REFERENCES core.users(id),
    created_at                          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_msg_attachments_msg 
    ON coaching.message_attachments (message_id);

-- 5. Conversation Read State
CREATE TABLE IF NOT EXISTS coaching.conversation_read_state (
    conversation_id                     BIGINT NOT NULL REFERENCES coaching.conversations(id) ON DELETE CASCADE,
    user_id                             BIGINT NOT NULL REFERENCES core.users(id) ON DELETE CASCADE,
    last_read_message_id                BIGINT REFERENCES coaching.messages(id) ON DELETE SET NULL,
    last_read_at                        TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    PRIMARY KEY (conversation_id, user_id)
);

-- Auto-seed direct conversations for existing mandatory assignments
INSERT INTO coaching.conversations (
    conversation_type, context_type, assignment_id, title, status, created_at, updated_at
)
SELECT 
    'DIRECT',
    'MANDATORY_ASSIGNMENT',
    ca.id,
    COALESCE('Coaching Discussion — ' || e.full_name, 'Mandatory Coaching Discussion'),
    'ACTIVE',
    NOW(),
    NOW()
FROM coaching.coaching_assignments ca
JOIN core.employees e ON e.id = ca.coachee_employee_id
WHERE ca.pathway = 'MANDATORY_PMS'
ON CONFLICT DO NOTHING;

-- Populate participants for the seeded conversations
INSERT INTO coaching.conversation_participants (
    conversation_id, employee_id, user_id, role, status, joined_at
)
SELECT 
    c.id,
    ca.coach_employee_id,
    coach_emp.user_id,
    'COACH',
    'ACTIVE',
    NOW()
FROM coaching.conversations c
JOIN coaching.coaching_assignments ca ON ca.id = c.assignment_id
JOIN core.employees coach_emp ON coach_emp.id = ca.coach_employee_id
WHERE c.context_type = 'MANDATORY_ASSIGNMENT' AND ca.coach_employee_id IS NOT NULL
ON CONFLICT (conversation_id, employee_id) DO NOTHING;

INSERT INTO coaching.conversation_participants (
    conversation_id, employee_id, user_id, role, status, joined_at
)
SELECT 
    c.id,
    ca.coachee_employee_id,
    coachee_emp.user_id,
    'COACHEE',
    'ACTIVE',
    NOW()
FROM coaching.conversations c
JOIN coaching.coaching_assignments ca ON ca.id = c.assignment_id
JOIN core.employees coachee_emp ON coachee_emp.id = ca.coachee_employee_id
WHERE c.context_type = 'MANDATORY_ASSIGNMENT'
ON CONFLICT (conversation_id, employee_id) DO NOTHING;
