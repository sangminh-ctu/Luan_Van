BEGIN;
CREATE TABLE flash_sale (
 flash_sale_id SERIAL PRIMARY KEY,
 name VARCHAR(150) NOT NULL CHECK (length(btrim(name)) > 0),
 start_at TIMESTAMPTZ NOT NULL,
 end_at TIMESTAMPTZ NOT NULL,
 status VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','cancelled')),
 created_by INTEGER REFERENCES users(user_id) ON DELETE SET NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 CONSTRAINT flash_sale_valid_period CHECK (end_at > start_at),
 CONSTRAINT flash_sale_no_overlap EXCLUDE USING gist
 (tstzrange(start_at, end_at, '[)') WITH &&) WHERE (status = 'published')
);
CREATE TABLE flash_sale_item (
 flash_sale_item_id SERIAL PRIMARY KEY,
 flash_sale_id INTEGER NOT NULL REFERENCES flash_sale(flash_sale_id) ON DELETE CASCADE,
 book_id INTEGER NOT NULL REFERENCES book(book_id) ON DELETE RESTRICT,
 sale_price NUMERIC(12,2) NOT NULL CHECK (sale_price > 0),
 display_order INTEGER NOT NULL DEFAULT 0 CHECK (display_order >= 0),
 UNIQUE (flash_sale_id, book_id)
);
CREATE INDEX idx_flash_sale_item_book ON flash_sale_item(book_id);
ALTER TABLE order_item ADD COLUMN flash_sale_item_id INTEGER
 REFERENCES flash_sale_item(flash_sale_item_id) ON DELETE RESTRICT;
CREATE INDEX idx_order_item_flash_sale ON order_item(flash_sale_item_id)
 WHERE flash_sale_item_id IS NOT NULL;
COMMIT;
