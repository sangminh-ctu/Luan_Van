CREATE TABLE IF NOT EXISTS membership_tier (
    tier_id SERIAL PRIMARY KEY,
    tier_code VARCHAR(20) NOT NULL UNIQUE,
    tier_name VARCHAR(50) NOT NULL,
    level INTEGER NOT NULL UNIQUE CHECK (level BETWEEN 1 AND 3),
    min_spend NUMERIC(14,2) NOT NULL UNIQUE CHECK (min_spend >= 0)
);
INSERT INTO membership_tier (tier_code, tier_name, level, min_spend) VALUES
    ('silver', 'Bạc', 1, 0), ('gold', 'Vàng', 2, 1000000), ('diamond', 'Kim Cương', 3, 3000000)
ON CONFLICT (tier_code) DO NOTHING;
ALTER TABLE voucher ADD COLUMN IF NOT EXISTS min_tier_id INTEGER REFERENCES membership_tier(tier_id) ON DELETE RESTRICT;
CREATE INDEX IF NOT EXISTS idx_orders_membership_completed ON orders(user_id)
    WHERE order_status = 'delivered' AND payment_status = 'paid';
