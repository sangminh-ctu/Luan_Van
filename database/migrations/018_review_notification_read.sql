ALTER TABLE review_notification ADD COLUMN IF NOT EXISTS read_at timestamptz;

CREATE INDEX IF NOT EXISTS review_notification_unread_idx
    ON review_notification (recipient_user_id, notification_id DESC) WHERE read_at IS NULL;
