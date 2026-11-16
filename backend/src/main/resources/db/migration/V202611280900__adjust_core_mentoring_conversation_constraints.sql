-- Migration to adjust core.conversations check constraint for cohort groups and trainee peer chats
ALTER TABLE core.conversations DROP CONSTRAINT IF EXISTS chk_conversation_context;

ALTER TABLE core.conversations
    ADD CONSTRAINT chk_conversation_context CHECK (
        (
            context_type = 'MANDATORY_ASSIGNMENT'
            AND conversation_type = 'DIRECT'
            AND assignment_id IS NOT NULL
            AND skill_request_id IS NULL
            AND mentoring_relationship_id IS NULL
            AND peer_employee_a_id IS NULL
            AND peer_employee_b_id IS NULL
        )
        OR
        (
            context_type = 'SKILL_COHORT_GROUP'
            AND conversation_type = 'GROUP'
            AND skill_request_id IS NOT NULL
            AND assignment_id IS NULL
            AND mentoring_relationship_id IS NULL
            AND peer_employee_a_id IS NULL
            AND peer_employee_b_id IS NULL
        )
        OR
        (
            context_type = 'SKILL_PEER_DIRECT'
            AND conversation_type = 'DIRECT'
            AND skill_request_id IS NOT NULL
            AND assignment_id IS NULL
            AND mentoring_relationship_id IS NULL
            AND peer_employee_a_id IS NOT NULL
            AND peer_employee_b_id IS NOT NULL
            AND peer_employee_a_id < peer_employee_b_id
        )
        OR
        (
            context_type = 'MENTORING_RELATIONSHIP_DIRECT'
            AND conversation_type = 'DIRECT'
            AND mentoring_relationship_id IS NOT NULL
            AND assignment_id IS NULL
            AND skill_request_id IS NULL
            AND peer_employee_a_id IS NULL
            AND peer_employee_b_id IS NULL
        )
        OR
        (
            context_type = 'MENTORING_COHORT_GROUP'
            AND conversation_type = 'GROUP'
            AND assignment_id IS NULL
            AND skill_request_id IS NULL
            AND peer_employee_a_id IS NULL
            AND peer_employee_b_id IS NULL
            AND (mentoring_relationship_id IS NOT NULL OR skill_id IS NOT NULL)
        )
        OR
        (
            context_type = 'MENTORING_PEER_DIRECT'
            AND conversation_type = 'DIRECT'
            AND assignment_id IS NULL
            AND skill_request_id IS NULL
            AND peer_employee_a_id IS NOT NULL
            AND peer_employee_b_id IS NOT NULL
            AND peer_employee_a_id < peer_employee_b_id
        )
    );
