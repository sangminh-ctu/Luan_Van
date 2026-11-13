ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_expires_at TIMESTAMPTZ;
CREATE TABLE IF NOT EXISTS payment_transaction (
    payment_id SERIAL PRIMARY KEY,
    order_id INTEGER NOT NULL REFERENCES orders(order_id) ON DELETE RESTRICT,
    reference VARCHAR(64) NOT NULL UNIQUE,
    provider VARCHAR(20) NOT NULL DEFAULT 'vnpay' CHECK (provider = 'vnpay'),
    amount NUMERIC(14,2) NOT NULL CHECK (amount >= 5000),
    currency VARCHAR(3) NOT NULL DEFAULT 'VND' CHECK (currency = 'VND'),
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','succeeded','failed','expired','cancelled','review')),
    merchant_code VARCHAR(32) NOT NULL,
    provider_transaction_no VARCHAR(32) UNIQUE,
    create_date VARCHAR(14) NOT NULL,
    payment_url TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    paid_at TIMESTAMPTZ,
    last_checked_at TIMESTAMPTZ,
    response_code VARCHAR(10),
    transaction_status VARCHAR(10),
    review_reason VARCHAR(255)
);
CREATE INDEX IF NOT EXISTS idx_payment_order ON payment_transaction(order_id, payment_id DESC);
CREATE UNIQUE INDEX IF NOT EXISTS uq_payment_pending_order ON payment_transaction(order_id) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_orders_payment_expiry ON orders(payment_expires_at)
    WHERE payment_method = 'vnpay' AND order_status = 'processing' AND payment_status <> 'paid';
CREATE TABLE IF NOT EXISTS payment_event (
    event_id BIGSERIAL PRIMARY KEY,
    payment_id INTEGER NOT NULL REFERENCES payment_transaction(payment_id) ON DELETE RESTRICT,
    fingerprint VARCHAR(64) NOT NULL UNIQUE,
    source VARCHAR(10) NOT NULL CHECK (source IN ('ipn','query','return')),
    response_code VARCHAR(10),
    transaction_status VARCHAR(10),
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);
