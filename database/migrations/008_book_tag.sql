-- Tag sách do admin tự định nghĩa (VD: Sách mới, Độc quyền, Giới hạn...)
CREATE TABLE IF NOT EXISTS tag (
    tag_id        SERIAL PRIMARY KEY,
    tag_name      VARCHAR(50)  NOT NULL,
    color         VARCHAR(7)   NOT NULL DEFAULT '#0d6efd' CHECK (color ~ '^#[0-9A-Fa-f]{6}$'),
    display_order INTEGER      NOT NULL DEFAULT 0,
    is_active     BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_tag_name ON tag (lower(tag_name));

-- Bảng nối Sách - Tag (N - N)
CREATE TABLE IF NOT EXISTS book_tag (
    book_id INTEGER NOT NULL REFERENCES book(book_id) ON DELETE CASCADE,
    tag_id  INTEGER NOT NULL REFERENCES tag(tag_id)   ON DELETE CASCADE,
    PRIMARY KEY (book_id, tag_id)
);
CREATE INDEX IF NOT EXISTS idx_book_tag_tag ON book_tag (tag_id);

-- Tag mẫu
INSERT INTO tag (tag_name, color, display_order) VALUES
    ('Sách mới',   '#0d6efd', 1),
    ('Độc quyền',  '#6f42c1', 2),
    ('Giới hạn',   '#fd7e14', 3)
ON CONFLICT DO NOTHING;
