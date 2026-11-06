# Kế hoạch và cách dùng Cấu hình trang chủ

## Phạm vi đã triển khai

Một khối chuyên đề trên trang chủ, nằm dưới Xu hướng mua sắm và trên Best Sellers.

1. Migration 009 tạo một cấu hình cố định và hai bảng liên kết sách/danh mục có khóa ngoại.
2. Backend đọc/lưu cấu hình nguyên tử, upload banner và xem trước dữ liệu chưa lưu.
3. Admin có trang `/admin/site-config`: sửa tiêu đề, bật/tắt, banner, tên tab tuyển chọn; tìm sách bằng tên/ISBN, chọn tối đa 10 sách; chọn tối đa 6 danh mục; sắp xếp sách và tab bằng nút lên/xuống.
4. Trang khách và xem trước dùng chung `HomeSpotlightSection.vue`, hiển thị giá từ cơ chế tính giá hiện hành, bao gồm Flash Sale, nhãn, tồn kho và số lượng đã bán.
5. Kiểm tra build frontend và kiểm thử tích hợp trên database tạm chỉ sao chép schema.

## Khởi tạo

Tại thư mục gốc:

```powershell
node backend/scripts/run_migration_009.js
```

Script dùng kết nối trong `backend/.env`, chạy transaction, có thể chạy lại. Khối mặc định tắt. Khởi động lại backend nếu tiến trình hiện tại không tự tải lại mã nguồn.

Truy cập admin → **Quản lý cấu hình** → **Cấu hình trang chủ** → nhập tiêu đề → chọn sách/danh mục → **Xem trước** → bật hiển thị → **Lưu thay đổi**.

## Quy tắc hiển thị

- Tab tuyển chọn chỉ gồm sách admin chọn, giữ thứ tự; sách đang ẩn không xuất hiện cho khách.
- Tab danh mục lấy tối đa 10 sách mới nhất của danh mục và toàn bộ nhánh con; không giới hạn theo chủ đề thủ công. Thứ tự phụ là book_id giảm dần.
- Tab danh mục rỗng bị ẩn. Không có sách thủ công thì không tạo tab tuyển chọn. Tab có sách đầu tiên là tab mặc định.
- Chỉ có một tab thì không hiển thị hàng nút chuyển tab. Không có sách ở tất cả các tab thì ẩn khối.
- Sách hết hàng vẫn hiển thị trạng thái; giá, nhãn, tồn kho và số lượng bán lấy từ dữ liệu hiện hành.
- Banner không bắt buộc, giữ tỉ lệ gốc để không cắt chữ. Nếu ảnh lỗi vẫn hiển thị tiêu đề và sách.
- Xem trước không ghi database, dùng dữ liệu đang sửa. Thay đổi tiếp sau xem trước sẽ hiện cảnh báo bản xem trước chưa được cập nhật.
- Trang khách tải dữ liệu mới khi mở trang; trang đang mở cần tải lại để nhận cấu hình hoặc giá mới.

## API

| Phương thức | Đường dẫn | Quyền |
|---|---|---|
| GET / PUT | `/api/admin/site-config` | Admin |
| POST | `/api/admin/site-config/preview` | Admin |
| POST | `/api/admin/site-config/upload-banner` | Admin |
| GET | `/api/site-config/spotlight` | Công khai |

PUT/preview nhận `title`, `banner_url` (null hoặc đường dẫn do upload trả về), `banner_alt`, `manual_tab_label`, `is_active`, `book_ids`, `category_ids`. Thứ tự trong hai mảng là thứ tự hiển thị.

API công khai trả `null` khi khối tắt hoặc không còn sách hợp lệ. Khi hiện, trả thông tin khối, `manual_books`, `categories` (mỗi danh mục kèm `books`, `total`). Các tab được tải trong một lần, tránh gọi lại khi chuyển tab.

`GET /api/books?book_ids=4,2,7&limit=10` hỗ trợ tối đa 10 ID không trùng; thứ tự ID ưu tiên hơn sort; phân trang và các bộ lọc khác vẫn áp dụng.

## Ảnh banner

Chấp nhận JPG, PNG, WebP tối đa 5 MB, kiểm tra MIME và chữ ký định dạng ở đầu file. Không nhận SVG. Không resize/nén lại; nên chuẩn bị ảnh ngang khoảng 1920×600 trước khi tải.

Ảnh được lưu tại `backend/uploads/banners` với tên ngẫu nhiên do server tạo. Upload không tự áp dụng cấu hình. Các ảnh cũ/ảnh chưa lưu được giữ lại để tránh xóa ảnh đang được xem trước hoặc dùng trong một phiên admin khác. Việc dọn ảnh không được tham chiếu có thể bổ sung thành tác vụ riêng sau này.

## Kiểm tra

```powershell
node backend/test/test_site_config.js
cd frontend
npm.cmd run build
```

Kiểm thử tích hợp cần PostgreSQL role có CREATEDB và `pg_dump` phù hợp. Có thể chỉ định `PG_DUMP_PATH`. Test tạo database tạm từ schema, tạo fixture riêng và xóa database sau khi chạy; không sửa dữ liệu cửa hàng.

Chưa bao gồm hẹn giờ, nhiều khối, liên kết khi bấm banner hoặc tuyển sách thủ công riêng cho từng tab danh mục.
