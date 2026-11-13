ALTER TABLE payment_event DROP CONSTRAINT IF EXISTS payment_event_source_check;
ALTER TABLE payment_event ADD CONSTRAINT payment_event_source_check
    CHECK (source IN ('ipn','query','return'));
