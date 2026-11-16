-- Allow pre-uploaded draft message attachments before message record insertion
ALTER TABLE coaching.message_attachments ALTER COLUMN message_id DROP NOT NULL;

