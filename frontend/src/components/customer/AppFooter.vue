<template>
  <footer>
    <!-- Nửa trên: Đăng ký nhận bản tin -->
    <div style="background-color: #a0a3a7;" class="py-3 mt-5">
      <div class="container">
        <div class="row align-items-center">
          <div class="col-md-4 text-white d-flex align-items-center mb-3 mb-md-0">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" class="me-2" viewBox="0 0 16 16">
              <path d="M0 4a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2V4Zm2-1a1 1 0 0 0-1 1v.217l7 4.2 7-4.2V4a1 1 0 0 0-1-1H2Zm13 2.383-4.708 2.825L15 11.105V5.383Zm-.034 6.876-5.64-3.471L8 9.583l-1.326-.795-5.64 3.47A1 1 0 0 0 2 13h12a1 1 0 0 0 .966-.741ZM1 11.105l4.708-2.897L1 5.383v5.722Z"/>
            </svg>
            <span class="fs-5" style="letter-spacing: 1px;">ĐĂNG KÝ NHẬN BẢN TIN</span>
          </div>
          <div class="col-md-8">
            <div class="input-group">
              <input type="text" class="form-control py-2 border-0" placeholder="Nhập địa chỉ email của bạn" style="border-radius: 4px 0 0 4px;">
              <button class="btn px-5 text-white fw-bold" style="background-color: #f7941e; border-radius: 0 4px 4px 0;">Đăng ký</button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Nửa dưới: Thông tin chi tiết -->
    <div class="bg-white pt-5 pb-4 border-top">
      <div class="container">
        <div class="row">
          
          <!-- Cột 1: Thông tin công ty & Logo -->
          <div class="col-lg-4 border-end pe-4 mb-4 mb-lg-0">
            <img src="../../assets/images/logo/logo1.png" alt="FAHASA" height="45" class="mb-3">
            <p class="text-muted small lh-base mb-2">
              Lầu 5, 387-389 Hai Bà Trưng, Phường Võ Thị Sáu, Quận 3, TP HCM<br>
              Công Ty Cổ Phần Phát Hành Sách TP HCM - FAHASA<br>
              60 - 62 Lê Lợi, Phường Bến Nghé, Quận 1, TP. HCM, Việt Nam
            </p>
            <p class="text-muted small lh-base mb-3">
              Fahasa.com nhận đặt hàng trực tuyến và giao hàng tận nơi. KHÔNG hỗ trợ đặt mua và nhận hàng trực tiếp tại văn phòng cũng như tất cả Hệ Thống Fahasa trên toàn quốc.
            </p>
            
            <!-- Mạng xã hội -->
            <div class="d-flex gap-2 mb-3">
              <a href="#" class="social-icon"><img src="https://via.placeholder.com/32x32/3b5998/fff?text=f" class="rounded-circle"></a>
              <a href="#" class="social-icon"><img src="https://via.placeholder.com/32x32/c32aa3/fff?text=ig" class="rounded-circle"></a>
              <a href="#" class="social-icon"><img src="https://via.placeholder.com/32x32/ff0000/fff?text=yt" class="rounded-circle"></a>
              <a href="#" class="social-icon"><img src="https://via.placeholder.com/32x32/3b5998/fff?text=t" class="rounded-circle"></a>
              <a href="#" class="social-icon"><img src="https://via.placeholder.com/32x32/1da1f2/fff?text=tw" class="rounded-circle"></a>
              <a href="#" class="social-icon"><img src="https://via.placeholder.com/32x32/bd081c/fff?text=p" class="rounded-circle"></a>
            </div>

            <!-- Tải App -->
            <div class="d-flex gap-2">
              <img src="https://via.placeholder.com/110x35/000/fff?text=Google+Play" class="rounded" style="cursor: pointer;">
              <img src="https://via.placeholder.com/110x35/000/fff?text=App+Store" class="rounded" style="cursor: pointer;">
            </div>
          </div>

          <!-- Cột phải: Chứa 3 cột Dịch vụ, Hỗ trợ, Tài khoản và Liên hệ -->
          <div class="col-lg-8 ps-lg-4">
            <!-- 3 Cột menu -->
            <div class="row mb-4">
              <!-- Dịch vụ -->
              <div class="col-md-4">
                <h6 class="fw-bold mb-3 text-dark" style="font-size: 14px;">DỊCH VỤ</h6>
                <ul class="list-unstyled footer-links">
                  <li><a href="#">Điều khoản sử dụng</a></li>
                  <li><a href="#">Chính sách bảo mật thông tin cá nhân</a></li>
                  <li><a href="#">Chính sách bảo mật thanh toán</a></li>
                  <li><a href="#">Giới thiệu Fahasa</a></li>
                  <li><a href="#">Hệ thống nhà sách</a></li>
                </ul>
              </div>
              <!-- Hỗ trợ -->
              <div class="col-md-4">
                <h6 class="fw-bold mb-3 text-dark" style="font-size: 14px;">HỖ TRỢ</h6>
                <ul class="list-unstyled footer-links">
                  <li><a href="#">Chính sách đổi - trả - hoàn tiền</a></li>
                  <li><a href="#">Chính sách bảo hành - bồi hoàn</a></li>
                  <li><a href="#">Chính sách vận chuyển</a></li>
                  <li><a href="#">Chính sách khách sỉ</a></li>
                </ul>
              </div>
              <!-- Tài khoản -->
              <div class="col-md-4">
                <h6 class="fw-bold mb-3 text-dark" style="font-size: 14px;">TÀI KHOẢN CỦA TÔI</h6>
                <ul class="list-unstyled footer-links">
                  <li><a href="#">Đăng nhập/Tạo mới tài khoản</a></li>
                  <li><a href="#">Thay đổi địa chỉ khách hàng</a></li>
                  <li><a href="#">Chi tiết tài khoản</a></li>
                  <li><a href="#">Lịch sử mua hàng</a></li>
                </ul>
              </div>
            </div>

            <!-- Liên hệ -->
            <h6 class="fw-bold mb-3 text-dark" style="font-size: 14px;">LIÊN HỆ</h6>
            <div class="row text-muted small mb-4">
              <div class="col-md-4 d-flex align-items-center mb-2 mb-md-0">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="me-2" viewBox="0 0 16 16">
                  <path d="M8 16s6-5.686 6-10A6 6 0 0 0 2 6c0 4.314 6 10 6 10zm0-7a3 3 0 1 1 0-6 3 3 0 0 1 0 6z"/>
                </svg>
                60-62 Lê Lợi, Q.1, TP. HCM
              </div>
              <div class="col-md-4 d-flex align-items-center mb-2 mb-md-0">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="me-2" viewBox="0 0 16 16">
                  <path d="M.05 3.555A2 2 0 0 1 2 2h12a2 2 0 0 1 1.95 1.555L8 8.414.05 3.555ZM0 4.697v7.104l5.803-3.558L0 4.697ZM6.761 8.83l-6.57 4.027A2 2 0 0 0 2 14h12a2 2 0 0 0 1.808-1.144l-6.57-4.027L8 9.586l-1.239-.757Zm3.436-.586L16 11.801V4.697l-5.803 3.546Z"/>
                </svg>
                cskh@fahasa.com.vn
              </div>
              <div class="col-md-4 d-flex align-items-center">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="me-2" viewBox="0 0 16 16">
                  <path fill-rule="evenodd" d="M1.885.511a1.745 1.745 0 0 1 2.61.163L6.29 2.98c.329.423.445.974.315 1.494l-.547 2.19a.678.678 0 0 0 .178.643l2.457 2.457a.678.678 0 0 0 .644.178l2.189-.547a1.745 1.745 0 0 1 1.494.315l2.306 1.794c.829.645.905 1.87.163 2.611l-1.034 1.034c-.74.74-1.846 1.065-2.877.702a18.634 18.634 0 0 1-7.01-4.42 18.634 18.634 0 0 1-4.42-7.009c-.362-1.03-.037-2.137.703-2.877L1.885.511z"/>
                </svg>
                1900636467
              </div>
            </div>

            <!-- Các Đối Tác Vận Chuyển và Thanh Toán -->
            <div class="row align-items-center mt-3 g-4">
              <!-- Hàng 1: Vận chuyển -->
              <div class="col-3 text-center"><img src="../../assets/images/logo/giao_hang_nhanh.webp" alt="GHN" style="max-height: 35px; width: auto; max-width: 100%;"></div>
              <div class="col-3 text-center"><img src="../../assets/images/logo/Logo_viettel_post.webp" alt="Viettel Post" style="max-height: 35px; width: auto; max-width: 100%;"></div>
              <div class="col-3 text-center"><img src="../../assets/images/logo/Shopee_express.webp" alt="SPX" style="max-height: 35px; width: auto; max-width: 100%;"></div>
              <div class="col-3 text-center"><img src="../../assets/images/logo/vnpost1.webp" alt="VNPost" style="max-height: 35px; width: auto; max-width: 100%;"></div>
              
              <!-- Hàng 2: Thanh toán -->
              <div class="col-3 text-center"><img src="../../assets/images/logo/vnpay_logo.png" alt="VNPay" style="max-height: 35px; width: auto; max-width: 100%;"></div>
              <div class="col-3 text-center"><img src="../../assets/images/logo/momopay.webp" alt="MoMo" style="max-height: 35px; width: auto; max-width: 100%;"></div>
              <div class="col-3 text-center"><img src="../../assets/images/logo/shopeepay_logo.webp" alt="ShopeePay" style="max-height: 35px; width: auto; max-width: 100%;"></div>
              <div class="col-3 text-center"><img src="../../assets/images/logo/logo_zalopay_2.webp" alt="ZaloPay" style="max-height: 35px; width: auto; max-width: 100%;"></div>
            </div>

          </div>
        </div>
      </div>
    </div>
  </footer>
</template>

<style scoped>
.footer-links li {
  margin-bottom: 10px;
}
.footer-links a {
  color: #666;
  text-decoration: none;
  font-size: 13px;
  transition: color 0.2s;
}
.footer-links a:hover {
  color: #c92127;
}
.social-icon img {
  transition: transform 0.2s;
}
.social-icon:hover img {
  transform: translateY(-3px);
  box-shadow: 0 4px 8px rgba(0,0,0,0.1);
}
</style>

