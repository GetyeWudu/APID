-- Phase 5.2 patch: add left_at tracking to coaching_participants
ALTER TABLE coaching.coaching_participants
    ADD COLUMN IF NOT EXISTS left_at TIMESTAMPTZ;

