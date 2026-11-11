# Voucher checkout

## Quy tắc

- Mỗi đơn một mã; tiền hàng tính theo giá sau giảm sách/Flash Sale.
- Điều kiện đơn tối thiểu và ngưỡng miễn phí vận chuyển xét trên tiền hàng trước voucher.
- Voucher không giảm phí vận chuyển. Tiền giảm không vượt tiền hàng, làm tròn đến đồng sau khi áp dụng mức trần.
- `usage_limit = NULL`: không giới hạn lượt tổng.
- `per_user_limit >= 1`: giới hạn mỗi tài khoản, mặc định 1, không có lựa chọn không giới hạn cá nhân.
- Đếm lượt cá nhân bằng các đơn có cùng voucher và tài khoản, trừ trạng thái `cancelled`.
- Xem trước không giữ lượt. Chỉ tạo đơn thành công mới tính lượt; hủy hợp lệ hoàn lượt đúng một lần.
- Mã đã có lịch sử chỉ được tăng giới hạn mỗi tài khoản; hoàn lượt không làm mất lịch sử hoặc tự bật lại mã.

## Migration

Trong `backend`, chạy `npm.cmd run migrate:voucher-checkout` (Windows) hoặc `npm run migrate:voucher-checkout`.
Migration 010 thêm `voucher.per_user_limit` mặc định 1 và index `(voucher_id, user_id)`.
Runner đối chiếu lượt tổng với số đơn chưa hủy và dừng nếu dữ liệu lệch; không tự viết lại bộ đếm hoặc lịch sử.
Các mã cũ cũng nhận giới hạn 1. Nếu tài khoản đã có nhiều đơn dùng mã, giữ các đơn cũ và chặn dùng thêm tới khi giới hạn được tăng hoặc đơn được hủy hợp lệ.
Khởi động lại backend sau migration. Không dùng `sequelize.sync({ alter: true })`.

## API

`POST /api/orders/preview` yêu cầu đăng nhập khách hàng:

```json
{"book_ids": [1, 2], "voucher_code": "SACHMOI10"}
```

Server lấy số lượng từ giỏ hàng của tài khoản đăng nhập, trả `items`, `expected_prices`, `subtotal`, `shipping_fee`, `voucher_discount_amount`, `total_amount`, `voucher` và lượt cá nhân còn lại trước đơn này.

`POST /api/orders` nhận thêm `voucher_code`, `expected_quantities` theo book_id và `expected_quote` gồm bốn trường tiền trong kết quả preview. Các giá trị mong đợi chỉ dùng phát hiện thay đổi, không dùng tính tiền hay quyết định số lượng mua.
Request không có mã vẫn tương thích với `expected_prices` hiện tại; checkout mới luôn gửi `expected_quote`.

- Lỗi voucher có `code` dạng `VOUCHER_*` và `fieldErrors.voucher_code` bằng tiếng Việt.
- `PRICE_CHANGED` hoặc `CHECKOUT_CHANGED`: tải lại preview và yêu cầu khách bấm xác nhận lại; không tự đặt lại.
- Preview không bảo đảm giữ giá hoặc giữ lượt đến lúc tạo đơn.

## Transaction và khóa

Tạo đơn: giỏ hàng theo book_id → tồn kho theo book_id → voucher → kiểm tra lượt → lưu đơn và tăng bộ đếm → commit.
Hủy đơn: đơn hàng → tồn kho theo book_id → voucher → hoàn lượt và chuyển cancelled → commit.
Đếm lượt cá nhân chỉ thực hiện sau khi lấy khóa voucher trong luồng tạo đơn. Các transaction dùng READ COMMITTED để thấy đơn vừa commit trước khi được cấp khóa.
Preview dùng snapshot REPEATABLE READ, không khóa/ghi bộ đếm.

## Kiểm thử

Trong backend:

```text
npm.cmd run test:vouchers
npm.cmd run test:voucher-checkout
node test/test_flash_sale.js
```

Checkout integration dùng database tạm chỉ sao chép schema, tự xóa khi kết thúc; cần quyền CREATEDB và `pg_dump` PostgreSQL 18 (hoặc đặt `PG_DUMP_PATH`). Không sao chép dữ liệu khách hàng.

Trong frontend:

```text
node --test test/voucherValidation.test.mjs test/checkoutVoucher.test.mjs
npm.cmd run build
```
