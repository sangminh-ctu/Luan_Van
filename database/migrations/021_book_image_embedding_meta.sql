ALTER TABLE book_image
    ADD COLUMN IF NOT EXISTS image_hash VARCHAR(64),
    ADD COLUMN IF NOT EXISTS embedding_status VARCHAR(20) NOT NULL DEFAULT 'pending',
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'book_image_embedding_status_check'
    ) THEN
        ALTER TABLE book_image
            ADD CONSTRAINT book_image_embedding_status_check
            CHECK (embedding_status IN ('pending', 'ready', 'failed', 'skipped', 'stale'));
    END IF;
END $$;

-- Đánh dấu các ảnh phụ (is_primary = false) chưa có vector là 'skipped' để chỉ nhận diện trên ảnh bìa chính
UPDATE book_image
SET embedding_status = 'skipped'
WHERE is_primary = FALSE AND embedding_vector IS NULL AND embedding_status = 'pending';
