CREATE TABLE IF NOT EXISTS home_spotlight (
    spotlight_id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (spotlight_id = 1),
    title VARCHAR(150) NOT NULL DEFAULT 'Sách tuyển chọn',
    banner_url VARCHAR(500),
    banner_alt VARCHAR(200) NOT NULL DEFAULT '',
    manual_tab_label VARCHAR(80) NOT NULL DEFAULT 'Tuyển chọn',
    is_active BOOLEAN NOT NULL DEFAULT FALSE,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
INSERT INTO home_spotlight (spotlight_id) VALUES (1) ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS home_spotlight_book (
    spotlight_id SMALLINT NOT NULL REFERENCES home_spotlight(spotlight_id) ON DELETE CASCADE,
    book_id INTEGER NOT NULL REFERENCES book(book_id) ON DELETE CASCADE,
    sort_order INTEGER NOT NULL CHECK (sort_order >= 0),
    PRIMARY KEY (spotlight_id, book_id),
    UNIQUE (spotlight_id, sort_order)
);
CREATE TABLE IF NOT EXISTS home_spotlight_category (
    spotlight_id SMALLINT NOT NULL REFERENCES home_spotlight(spotlight_id) ON DELETE CASCADE,
    category_id INTEGER NOT NULL REFERENCES category(category_id) ON DELETE CASCADE,
    sort_order INTEGER NOT NULL CHECK (sort_order >= 0),
    PRIMARY KEY (spotlight_id, category_id),
    UNIQUE (spotlight_id, sort_order)
);
