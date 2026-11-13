# Hạng thành viên và gợi ý ưu đãi

## Quy tắc

- Ba hạng cố định: Bạc từ 0đ, Vàng từ 1.000.000đ, Kim Cương từ 3.000.000đ (ngưỡng khởi tạo).
- Chi tiêu xét hạng là tổng `GREATEST(0, subtotal - voucher_discount_amount - points_discount)` của đơn `delivered` và `paid` trong toàn bộ lịch sử. Không cộng phí vận chuyển, không đặt lại theo năm.
- Backend tính hạng khi cần, không lấy hạng hoặc số tiền do frontend gửi. Đơn hiện tại không giúp tự đủ hạng trước khi hoàn tất.
- Admin có thể sửa ngưỡng Vàng/Kim Cương; hạng được tính lại theo cấu hình mới và có thể tăng/giảm. Đơn đã đặt giữ giá/ưu đãi đã chốt.
- `voucher.min_tier_id = NULL`: mọi hạng. Nếu đặt Vàng, cả Vàng và Kim Cương dùng được. Mã đã có lịch sử không được đổi điều kiện hạng.
- Giữ nguyên một mã mỗi đơn, giới hạn tổng/cá nhân và hoàn lượt khi hủy. Không thêm điểm thưởng, freeship riêng hoặc phát quà tự động.

## Migration và giao diện

Trong backend: `npm.cmd run migrate:membership` chạy migration 011 trong transaction. Không sửa dữ liệu đơn hoặc hạn chế voucher cũ; chạy lại không đặt lại ngưỡng admin đã sửa.
Khởi động lại backend sau migration.

- Admin: `/admin/membership-tiers` trong nhóm Khuyến mãi; form voucher có Hạng tối thiểu.
- Tài khoản: hạng, chi tiêu toàn lịch sử, tiến độ, quyền lợi thật và số mã còn dùng được. Các mã đang hoạt động dành cho hạng cao hơn có nhãn khóa; mã hết lượt cá nhân không được tính là khả dụng.
- Checkout: nút “Tìm mã tiết kiệm nhất”, tối đa ba kết quả, khách tự chọn áp dụng.

## API

- `GET /api/membership`: đăng nhập; trả `membership` và `tiers` của tài khoản hiện tại.
- `GET/PUT /api/admin/membership-tiers`: admin; PUT nhận `{tiers:[{tier_id,min_spend}, ...]}` đủ ba hạng, Bạc = 0 và ngưỡng tăng dần, số nguyên VND.
- `GET /api/auth/me`: bổ sung `membership`, `tiers`, `available_voucher_count`; mỗi voucher có `eligible`, `access_status`, `min_tier_name`, `user_remaining_uses`.
- `POST /api/orders/voucher-suggestions`: khách đăng nhập, nhận `{book_ids:[...]}`. Backend tính giá/đọc số lượng từ giỏ, lọc theo hạng, thời gian, lượt tổng/cá nhân và đơn tối thiểu; so sánh tiền giảm sau mức trần. Kết quả giảm tiền nhiều nhất trước, bằng nhau ưu tiên hạn dùng sớm rồi mã.
- Gợi ý dùng snapshot REPEATABLE READ, không giữ/trừ lượt. Nút Áp dụng vẫn gọi preview; tạo đơn kiểm tra lại, kể cả điều kiện hạng. Lỗi chưa đủ hạng có mã `VOUCHER_TIER_REQUIRED` và `fieldErrors.voucher_code`.
- Checkout giữ khóa SHARE trên cấu hình hạng trong transaction xác thực voucher; thao tác sửa ngưỡng đợi checkout kết thúc. Hạng và bảng quyền lợi không được tính ở frontend.

## Kiểm thử

Backend: `npm.cmd run test:membership`, `npm.cmd run test:vouchers`, `npm.cmd run test:voucher-checkout`, `node test/test_flash_sale.js`.
Integration tests dùng database/schema tạm và không sao chép dữ liệu khách hàng. Các bộ test database tạm yêu cầu CREATEDB và pg_dump PostgreSQL 18 hoặc cấu hình `PG_DUMP_PATH`.

Frontend: `node --test test/checkoutVoucher.test.mjs test/accountMembership.test.mjs test/voucherValidation.test.mjs`, `npm.cmd run build`.
