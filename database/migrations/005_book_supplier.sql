-- Thêm nhà cung cấp chính cho sách (cho phép NULL)
ALTER TABLE book ADD COLUMN IF NOT EXISTS supplier_id INT
    REFERENCES supplier(supplier_id) ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX IF NOT EXISTS idx_book_supplier ON book(supplier_id);
