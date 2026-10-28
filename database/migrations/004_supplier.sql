-- database/migrations/004_supplier.sql
BEGIN;

-- 1. Tạo bảng supplier
CREATE TABLE IF NOT EXISTS supplier (
    supplier_id     SERIAL PRIMARY KEY,
    supplier_name   VARCHAR(150) NOT NULL,
    contact_person  VARCHAR(100),
    phone           VARCHAR(20),
    email           VARCHAR(100),
    address         VARCHAR(255),
    note            VARCHAR(255),
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Chỉ mục duy nhất trên tên đã chuẩn hóa (chặn trùng không phân biệt hoa/thường, khoảng trắng thừa)
CREATE UNIQUE INDEX IF NOT EXISTS uq_supplier_name_norm
    ON supplier (lower(btrim(regexp_replace(supplier_name, '\s+', ' ', 'g'))));

-- 2. Thêm cột supplier_id vào stock_receipt
ALTER TABLE stock_receipt
    ADD COLUMN IF NOT EXISTS supplier_id INT
    REFERENCES supplier(supplier_id) ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS idx_stock_receipt_supplier ON stock_receipt(supplier_id);

-- 3. Dọn tên thử nghiệm & xử lý phiếu nhập trống tên (nếu có) trước khi backfill
UPDATE stock_receipt
SET supplier_name = 'Chưa rõ'
WHERE type = 'import' AND btrim(coalesce(supplier_name, '')) = '';

UPDATE stock_receipt
SET supplier_name = 'NXB Trẻ'
WHERE type = 'import' AND lower(btrim(supplier_name)) = 'nxb trẻ';

UPDATE stock_receipt
SET supplier_name = 'Fahasa'
WHERE type = 'import' AND lower(btrim(supplier_name)) = 'fahasa';

-- 4. Tạo nhà cung cấp từ các tên đã dùng trong phiếu nhập
INSERT INTO supplier (supplier_name)
SELECT DISTINCT ON (lower(btrim(regexp_replace(supplier_name, '\s+', ' ', 'g'))))
       btrim(regexp_replace(supplier_name, '\s+', ' ', 'g'))
FROM stock_receipt
WHERE type = 'import' AND btrim(coalesce(supplier_name, '')) <> ''
ORDER BY lower(btrim(regexp_replace(supplier_name, '\s+', ' ', 'g'))), receipt_id
ON CONFLICT DO NOTHING;

-- 5. Gắn các phiếu nhập cũ vào supplier_id tương ứng
UPDATE stock_receipt r
SET supplier_id = s.supplier_id
FROM supplier s
WHERE r.type = 'import'
  AND lower(btrim(regexp_replace(r.supplier_name, '\s+', ' ', 'g')))
    = lower(btrim(regexp_replace(s.supplier_name, '\s+', ' ', 'g')));

-- Đảm bảo phiếu xuất không giữ supplier_id / supplier_name
UPDATE stock_receipt
SET supplier_id = NULL, supplier_name = NULL
WHERE type = 'export';

-- 6. Thêm ràng buộc CHECK chặt chẽ cho cả import và export
ALTER TABLE stock_receipt DROP CONSTRAINT IF EXISTS chk_import_has_supplier;
ALTER TABLE stock_receipt ADD CONSTRAINT chk_import_has_supplier
    CHECK (
        (type = 'import' AND supplier_id IS NOT NULL)
        OR (type = 'export' AND supplier_id IS NULL)
    );

COMMIT;
