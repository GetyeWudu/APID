ALTER TABLE mentoring.mentoring_request_recipients
    DROP CONSTRAINT IF EXISTS mentoring_request_recipients_status_check;

ALTER TABLE mentoring.mentoring_request_recipients
    ADD CONSTRAINT chk_mentoring_request_recipient_status
    CHECK (status IN ('PENDING', 'ACCEPTED', 'DECLINED', 'CANCELLED'));
