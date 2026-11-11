ALTER TABLE voucher
    ADD COLUMN IF NOT EXISTS per_user_limit integer NOT NULL DEFAULT 1
    CONSTRAINT voucher_per_user_limit_check CHECK (per_user_limit >= 1);

CREATE INDEX IF NOT EXISTS idx_orders_voucher_user
    ON orders(voucher_id, user_id) WHERE voucher_id IS NOT NULL;
