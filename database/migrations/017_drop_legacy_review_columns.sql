ALTER TABLE review
    DROP COLUMN IF EXISTS updated_at,
    DROP COLUMN IF EXISTS recheck_requested_at;
