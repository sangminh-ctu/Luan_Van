-- Mã nhà cung cấp do admin tự nhập (cho phép NULL với dữ liệu cũ, bắt buộc khi tạo mới ở tầng API)
ALTER TABLE supplier ADD COLUMN IF NOT EXISTS supplier_code VARCHAR(20);
CREATE UNIQUE INDEX IF NOT EXISTS uq_supplier_code ON supplier (upper(supplier_code));
