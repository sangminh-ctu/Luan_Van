# Thanh toán VNPAY Sandbox

Đã tích hợp COD và VNPAY vào cùng luồng đặt hàng. Đây là môi trường thử nghiệm, chưa dùng thanh toán thật. Không cần cài thêm thư viện.

## Chạy trên máy hiện tại

Các biến `VNP_TMN_CODE`, `VNP_HASH_SECRET`, `VNP_URL`, `VNP_RETURN_URL` trong `backend/.env` được hỗ trợ trực tiếp. Các tên tương đương `VNPAY_TMN_CODE`, `VNPAY_HASH_SECRET`, `VNPAY_PAYMENT_URL`, `VNPAY_RETURN_URL` cũng được hỗ trợ và được ưu tiên nếu có cả hai. Khóa chỉ nằm ở backend.

```dotenv
VNP_TMN_CODE=<merchant code trong email>
VNP_HASH_SECRET=<hash secret trong email>
VNP_URL=https://sandbox.vnpayment.vn/paymentv2/vpcpay.html
VNP_RETURN_URL=http://localhost:5000/api/vnpay/return
FRONTEND_URL=http://localhost:5173
VNPAY_PAYMENT_MINUTES=15
# Chỉ bật khi demo Sandbox trên localhost, mặc định false ở .env.example
VNPAY_SANDBOX_RETURN_CONFIRMATION=true
```

Migration 012 và 013 đã chạy trên database của workspace này. Khi chạy ở máy/database khác:

```powershell
cd backend
npm.cmd run migrate:vnpay
npm.cmd run migrate:vnpay-return
npm.cmd run dev
```

Khởi động frontend trong terminal khác bằng `npm.cmd run dev`, vào checkout và chọn **Thanh toán online qua VNPAY**. Chỉ dùng thông tin thẻ/tài khoản thử nghiệm trong email hoặc tài liệu Sandbox của VNPAY. API `GET /api/payments/vnpay/config` trả `vnpay_enabled` để kiểm tra cấu hình cục bộ; giá trị `true` chưa xác nhận merchant đã được VNPAY kích hoạt hoặc IPN đã đăng ký.

## Return URL và IPN URL

| Địa chỉ | Mục đích |
| --- | --- |
| `http://localhost:5000/api/vnpay/return` | Trình duyệt khách quay về backend; backend chuyển sang trang kết quả frontend. Chế độ Sandbox localhost tùy chọn bên dưới có thể ghi nhận callback sau khi xác minh đầy đủ. |
| `https://<backend-cong-khai>/api/vnpay/ipn` | VNPAY gọi trực tiếp đến backend để xác nhận giao dịch. Đăng ký/cập nhật địa chỉ này với VNPAY theo hướng dẫn trong email/merchant portal. |
| `http://localhost:5173/payment/vnpay-return` | Trang frontend đọc kết quả từ backend sau khi đăng nhập. |

`localhost` không phải địa chỉ IPN mà máy chủ VNPAY truy cập được. Để nghiệm thu luồng IPN thực tế cần backend HTTPS công khai hoặc tunnel được cấu hình riêng, trỏ về cổng 5000. Workspace chưa tự mở tunnel hay đăng ký IPN với VNPAY. Nếu trình duyệt thanh toán trên máy khác, Return URL và FRONTEND_URL cũng phải dùng địa chỉ mà máy đó truy cập được. Backend cũng hỗ trợ tiền tố `/api/payments/vnpay` thay cho `/api/vnpay`.

Mặc định khi Return về trước IPN, trang kết quả hiển thị **Đang chờ xác nhận thanh toán**, đọc lại trạng thái tối đa khoảng một phút. Nút **Kiểm tra lại thanh toán** gọi API truy vấn VNPAY có xác minh chữ ký. Mỗi giao dịch được giới hạn truy vấn tối đa một lần/phút giữa các tiến trình. IPN vẫn cập nhật được sau khi khách đóng trang. Nếu máy local không truy cập được API truy vấn và chưa có IPN công khai, đơn sẽ tiếp tục chờ xác nhận. Lỗi đối soát không bị lần tải trạng thái kế tiếp xóa mất; phản hồi chưa tìm thấy giao dịch hoặc giới hạn truy vấn cũng có thông báo cụ thể.

### Demo Sandbox trên localhost khi chưa có IPN công khai

Workspace hiện bật `VNPAY_SANDBOX_RETURN_CONFIRMATION=true` trong `backend/.env`. Backend xác minh chữ ký HMAC, merchant, reference, số tiền và trạng thái trên **toàn bộ callback Return**, rồi dùng chung transaction/khóa/idempotency với IPN để ghi nhận kết quả. Vì danh sách tham số Return giống IPN theo tài liệu VNPAY, callback có chữ ký có thể dùng cho bản demo cục bộ. Đây là lựa chọn riêng của ứng dụng cho Sandbox, không thay cho hướng dẫn tích hợp IPN khi triển khai.

Chế độ này chỉ hoạt động khi cả Return URL và FRONTEND_URL đều là `localhost`, `127.0.0.1` hoặc `[::1]`, payment URL là Sandbox và `NODE_ENV` khác `production`. Địa chỉ công khai hoặc production tự vô hiệu chế độ này dù biến được đặt `true`. Sau khi đổi `.env`, khởi động lại backend. Callback giả, sai chữ ký hoặc sai số tiền không cập nhật đơn; Return/IPN lặp không xử lý tiền lần nữa. Nếu khách đóng trang trước Return thì vẫn cần IPN/truy vấn để xác nhận.

Đơn đã quay về theo bản code cũ chỉ còn reference trên URL frontend; không thể tái tạo callback có chữ ký từ reference này. Không sửa đơn cũ thành `paid` thủ công dựa vào ảnh/nhập OTP. Dùng **Kiểm tra lại thanh toán** để truy vấn hoặc nhận lại callback gốc có chữ ký. Nếu đã bị trừ tiền, không thanh toán thêm chỉ để kiểm tra. Bật chế độ mới không tự xác nhận các đơn đang chờ từ trước.

## Quy tắc xử lý

- Backend tự tính giá sách/Flash Sale, voucher, phí giao hàng; VNPAY nhận đúng tổng phải trả của đơn. Số tiền tối thiểu 5.000đ; đơn dưới mức này chọn COD.
- Tạo đơn, trừ tồn, giữ lượt voucher và tạo bản ghi giao dịch cùng transaction. Tạo URL ký bằng HMAC SHA512 tại backend; không có HTTP đến VNPAY khi đang giữ khóa database.
- Mỗi lần thanh toán có reference ngẫu nhiên riêng. Bấm hai lần mở thanh toán đang chờ sẽ nhận cùng URL. Chỉ giao dịch được VNPAY xác nhận thất bại mới được tạo lần thử mới trong hạn giữ đơn ban đầu; không kéo dài hạn khi thử lại.
- Chỉ xác nhận trả tiền khi chữ ký, merchant, reference, số tiền, mã phản hồi và trạng thái giao dịch đều hợp lệ. IPN lặp không cộng tiền, trừ kho hay dùng voucher lần nữa. Lịch sử tối thiểu được lưu trong `payment_transaction` và `payment_event`; không lưu khóa bí mật hoặc toàn bộ nội dung callback vào log.
- Khóa dòng đơn trước dòng giao dịch ở các luồng thanh toán/hủy. Đơn online chưa trả tiền hoặc cần đối soát không được xác nhận/giao hàng, kể cả khi cập nhật trạng thái vận chuyển qua API riêng.
- Khách/admin hủy đơn online chưa thanh toán sẽ hoàn kho và lượt voucher đúng một lần. URL cũ có thể vẫn đang mở tại VNPAY; nếu tiền về sau khi hủy, giao dịch chuyển **cần đối soát**, ghi nhận đã nhận tiền, giữ đơn **đã hủy** và không trừ kho/lượt lần nữa.
- Server kiểm tra đơn quá hạn mỗi phút, có thêm 2 phút chờ callback. Giao dịch thất bại đã xác minh hoặc kết quả truy vấn có chữ ký xác nhận không tồn tại/chưa hoàn tất mới cho phép hủy và hoàn tài nguyên. Lỗi mạng, chữ ký sai hoặc trạng thái chưa rõ sẽ giữ đơn và kiểm tra lại, tránh nhầm đơn đã trả tiền thành đơn hết hạn. Tác vụ chạy trong `server.js`, không chạy ngầm khi import app cho test.
- Thanh toán thành công không nâng hạng ngay. Chỉ đơn **đã giao và đã thanh toán** đóng góp chi tiêu phân hạng như trước.

## Đối soát và hoàn tiền

Admin xem mã giao dịch, mã VNPAY và lý do cần kiểm tra tại chi tiết đơn; danh sách đơn đánh dấu **Cần đối soát VNPAY**. Đơn đã nhận tiền không được hủy theo luồng hoàn kho hiện tại.

**Chưa triển khai API hoàn tiền tự động hoặc nút tự đánh dấu đã hoàn tiền.** Tiền về muộn, giao dịch nghi vấn/đảo giao dịch, hoặc nhận tiền từ nhiều lần thử phải đối chiếu tại VNPAY và xử lý hoàn tiền trước; chưa có luồng hoàn tiền trong ứng dụng để đóng các hồ sơ này. Không chuyển `payment_status` sang `refunded` chỉ vì khách yêu cầu hủy. Khi bổ sung hoàn tiền, cần lưu yêu cầu/kết quả từ VNPAY và xử lý hoàn kho, voucher, phân hạng trong transaction riêng đúng một lần.

## API

- Public: `GET /api/vnpay/config`, `GET /api/vnpay/return`, `GET /api/vnpay/ipn`.
- Đăng nhập: `POST /api/vnpay/orders/:id/link` — chỉ chủ đơn, admin không trả tiền thay.
- Đăng nhập: `GET /api/vnpay/:reference/status`, `POST /api/vnpay/:reference/reconcile` — chủ đơn hoặc admin.
- `POST /api/orders` nhận `payment_method: "cod" | "vnpay"`; trả thông tin giao dịch an toàn, không trả khóa hoặc URL cho toàn bộ danh sách đơn.

## Kiểm thử

```powershell
cd backend
npm.cmd run test:vnpay
npm.cmd run test:voucher-checkout
npm.cmd run test:membership
cd ../frontend
node --test test/*.test.mjs
npm.cmd run build
```

Test VNPAY dùng database tạm sao chép **schema**, khóa giả và callback/truy vấn giả lập có chữ ký; không gửi yêu cầu thanh toán đến VNPAY, không sửa đơn thật. Bao gồm giá/giờ VN/chữ ký, phân quyền, callback giả/lặp, khóa khi hủy/thanh toán đồng thời, retry, rollback, hết hạn, lỗi truy vấn và tiền về muộn. Vẫn cần thử thủ công bằng tài khoản Sandbox với IPN công khai để xác nhận merchant/network của môi trường triển khai.

Tài liệu tham chiếu chính thức: [Thanh toán VNPAY](https://sandbox.vnpayment.vn/apis/docs/thanh-toan-pay/pay.html), [Truy vấn và hoàn tiền](https://sandbox.vnpayment.vn/apis/docs/truy-van-hoan-tien/querydr%26refund.html).
