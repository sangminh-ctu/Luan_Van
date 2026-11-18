ALTER TABLE review
    ADD COLUMN IF NOT EXISTS updated_at timestamp without time zone;

DO $$
BEGIN
    IF to_regclass('review_order_item_unique') IS NULL
       AND to_regclass('review_active_user_book_unique') IS NULL AND NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = 'review'::regclass
          AND conname = 'review_user_book_unique'
    ) THEN
        ALTER TABLE review
            ADD CONSTRAINT review_user_book_unique UNIQUE (user_id, book_id);
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS review_book_recent_idx
    ON review (book_id, created_at DESC NULLS LAST, review_id DESC);
