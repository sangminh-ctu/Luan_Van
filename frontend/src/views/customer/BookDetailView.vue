<template>
  <div class="book-detail-page bg-light py-4 min-vh-100">
    <div class="container">
      
      <!-- Loading Skeleton -->
      <div v-if="isLoading" class="py-5 text-center">
        <div class="spinner-border text-danger" role="status">
          <span class="visually-hidden">Đang tải dữ liệu...</span>
        </div>
        <p class="text-muted mt-2">Đang tải thông tin chi tiết sách...</p>
      </div>

      <!-- Lỗi không tìm thấy sách -->
      <div v-else-if="errorMessage" class="bg-white rounded-4 shadow-sm p-5 text-center my-4">
        <i class="bi bi-exclamation-triangle text-warning fs-1 mb-3 d-block"></i>
        <h4 class="fw-bold text-dark mb-2">{{ errorMessage }}</h4>
        <p class="text-muted mb-4">Cuốn sách bạn đang tìm kiếm có thể đã ngừng kinh doanh hoặc đường dẫn không chính xác.</p>
        <router-link to="/" class="btn btn-danger px-4 py-2 rounded-pill fw-semibold">
          <i class="bi bi-arrow-left me-2"></i> Quay lại trang chủ
        </router-link>
      </div>

      <!-- Nội dung chi tiết sách -->
      <div v-else-if="book">
        
        <!-- 1. BREADCRUMB -->
        <nav aria-label="breadcrumb" class="mb-3">
          <ol class="breadcrumb small mb-0 py-2">
            <li class="breadcrumb-item">
              <router-link to="/" class="text-decoration-none text-muted">Trang chủ</router-link>
            </li>
            <li class="breadcrumb-item" v-if="book.category">
              <router-link 
                :to="{ path: '/', query: { category: book.category.category_id } }" 
                class="text-decoration-none text-muted"
              >
                {{ book.category.category_name }}
              </router-link>
            </li>
            <li class="breadcrumb-item active text-truncate fw-semibold" style="max-width: 500px;" aria-current="page">
              {{ book.title }}
            </li>
          </ol>
        </nav>

        <!-- 2. BỐ CỤC CHÍNH 2 CỘT -->
        <div class="row g-4 mb-4">
          
          <!-- CỘT TRÁI (COL-LG-5): BỘ SƯU TẬP ẢNH, NÚT MUA, CHÍNH SÁCH -->
          <div class="col-lg-5">
            <div class="bg-white rounded-4 shadow-sm p-4 sticky-top" style="top: 85px; z-index: 10;">
              
              <!-- Khung Ảnh Lớn Chính -->
              <div class="position-relative text-center p-3 mb-3 bg-light rounded-3 d-flex align-items-center justify-content-center" style="min-height: 380px;">
                <span 
                  v-if="book.discount_percent > 0" 
                  class="position-absolute top-0 start-0 m-3 badge bg-danger fs-6 shadow-sm"
                >
                  -{{ Math.round(book.discount_percent) }}%
                </span>

                <img 
                  :src="currentImageUrl" 
                  :alt="book.title"
                  class="img-fluid rounded shadow-sm main-book-image"
                  style="max-height: 360px; object-fit: contain;"
                >
              </div>

              <!-- Dải ảnh Thumbnails -->
              <div class="d-flex gap-2 overflow-auto pb-2 mb-4 scrollbar-none align-items-center" v-if="galleryImages.length > 1">
                <div 
                  v-for="(img, idx) in galleryImages" 
                  :key="img.image_id || idx"
                  class="rounded border p-1 cursor-pointer transition-all bg-white flex-shrink-0"
                  :class="selectedImageIndex === idx ? 'border-danger border-2 shadow-sm' : 'border-light-subtle opacity-75'"
                  style="width: 64px; height: 84px;"
                  @click="selectedImageIndex = idx"
                  @mouseenter="selectedImageIndex = idx"
                >
                  <img 
                    :src="img.full_url" 
                    :alt="book.title"
                    class="w-100 h-100 rounded"
                    style="object-fit: cover;"
                  >
                </div>
              </div>

              <!-- Hàng Nút Hành Động (Thêm giỏ hàng + Mua ngay) -->
              <div class="row g-2 mb-4">
                <div class="col-6">
                  <button 
                    class="btn btn-outline-danger w-100 py-2 fw-bold d-flex align-items-center justify-content-center h-100"
                    :disabled="isOutOfStock || isAddingCart"
                    @click="handleAddToCart"
                  >
                    <i class="bi bi-cart-plus fs-5 me-2"></i>
                    <span>Thêm vào giỏ</span>
                  </button>
                </div>
                <div class="col-6">
                  <button 
                    class="btn btn-danger w-100 py-2 fw-bold d-flex align-items-center justify-content-center h-100 shadow-sm"
                    :disabled="isOutOfStock || isAddingCart"
                    @click="handleBuyNow"
                  >
                    <i class="bi bi-lightning-charge-fill me-1" v-if="!isOutOfStock"></i>
                    <span>{{ isOutOfStock ? 'Hết hàng' : 'Mua ngay' }}</span>
                  </button>
                </div>
              </div>

              <!-- Chính Sách Ưu Đãi Của BookStore (Hình 1 & 2) -->
              <div class="border-top pt-3">
                <h6 class="fw-bold text-dark mb-3">Chính sách ưu đãi của BookStore</h6>
                <div class="d-flex flex-column gap-2 small">
                  <div class="d-flex align-items-center justify-content-between text-secondary py-1 cursor-pointer">
                    <div class="d-flex align-items-center">
                      <i class="bi bi-truck text-danger fs-5 me-3"></i>
                      <span><strong>Thời gian giao hàng:</strong> Giao nhanh và uy tín</span>
                    </div>
                    <i class="bi bi-chevron-right text-muted small"></i>
                  </div>

                  <div class="d-flex align-items-center justify-content-between text-secondary py-1 cursor-pointer">
                    <div class="d-flex align-items-center">
                      <i class="bi bi-arrow-repeat text-danger fs-5 me-3"></i>
                      <span><strong>Chính sách đổi trả:</strong> Đổi trả miễn phí toàn quốc</span>
                    </div>
                    <i class="bi bi-chevron-right text-muted small"></i>
                  </div>

                  <div class="d-flex align-items-center justify-content-between text-secondary py-1 cursor-pointer">
                    <div class="d-flex align-items-center">
                      <i class="bi bi-building text-danger fs-5 me-3"></i>
                      <span><strong>Chính sách khách sỉ:</strong> Ưu đãi khi mua số lượng lớn</span>
                    </div>
                    <i class="bi bi-chevron-right text-muted small"></i>
                  </div>
                </div>
              </div>

            </div>
          </div>

          <!-- CỘT PHẢI (COL-LG-7): TIÊU ĐỀ, GIÁ, TỒN KHO, SỐ LƯỢNG, THÔNG SỐ, MÔ TẢ -->
          <div class="col-lg-7">
            
            <!-- 1. THẺ THÔNG TIN CƠ BẢN & GIÁ BÁN & SỐ LƯỢNG -->
            <div class="bg-white rounded-4 shadow-sm p-4 mb-4">
              
              <!-- Huy hiệu thể loại -->
              <div class="mb-2" v-if="book.category">
                <span class="badge bg-light text-secondary border px-2 py-1">
                  {{ book.category.category_name }}
                </span>
              </div>

              <!-- Tiêu đề Sách -->
              <h3 class="fw-bold text-dark mb-3" style="line-height: 1.4;">
                {{ book.title }}
              </h3>

              <!-- Thông tin nhanh 2 cột (Hình 1) -->
              <div class="row g-2 small text-secondary mb-3">
                <div class="col-sm-6">
                  <div class="mb-1">
                    Nhà cung cấp: 
                    <strong class="text-primary">{{ book.publisher?.publisher_name || 'Đang cập nhật' }}</strong>
                  </div>
                  <div>
                    Nhà xuất bản: 
                    <strong class="text-dark">{{ book.publisher?.publisher_name || 'Đang cập nhật' }}</strong>
                  </div>
                </div>
                <div class="col-sm-6">
                  <div class="mb-1">
                    Tác giả: 
                    <strong class="text-primary">{{ authorNames }}</strong>
                  </div>
                  <div>
                    Hình thức bìa: 
                    <strong class="text-dark">{{ book.cover_type || 'Bìa Mềm' }}</strong>
                  </div>
                </div>
              </div>

              <!-- Đánh giá sao & Lượt bán -->
              <div class="d-flex align-items-center small gap-2 pb-3 border-bottom mb-3">
                <div class="text-warning">
                  <i class="bi bi-star"></i>
                  <i class="bi bi-star"></i>
                  <i class="bi bi-star"></i>
                  <i class="bi bi-star"></i>
                  <i class="bi bi-star"></i>
                </div>
                <span class="text-muted">(0 đánh giá)</span>
                <span class="text-muted">|</span>
                <span class="text-muted">Đã bán {{ soldCount }}</span>
              </div>

              <!-- Khối Giá Bán (Fahasa Red Theme) -->
              <div class="bg-light p-3 rounded-3 mb-3">
                <div class="d-flex align-items-baseline gap-3">
                  <span class="text-danger fw-bold fs-2">{{ formatCurrency(book.final_price) }}</span>
                  <span v-if="book.discount_percent > 0" class="text-muted text-decoration-line-through fs-5">
                    {{ formatCurrency(book.price) }}
                  </span>
                  <span v-if="book.discount_percent > 0" class="badge bg-danger fs-6">
                    -{{ Math.round(book.discount_percent) }}%
                  </span>
                </div>
                <div class="small text-danger mt-1 d-flex align-items-center">
                  <i class="bi bi-tag-fill me-1"></i>
                  <span>Chính sách khuyến mãi trên chỉ áp dụng tại BookStore</span>
                </div>
              </div>

              <!-- Tình trạng tồn kho thực tế -->
              <div class="mb-3">
                <span v-if="!isOutOfStock" class="badge bg-success-subtle text-success border border-success px-3 py-2 rounded-pill">
                  <i class="bi bi-check-circle-fill me-1"></i> Còn hàng ({{ stockQuantity }} cuốn trong kho)
                </span>
                <span v-else class="badge bg-danger-subtle text-danger border border-danger px-3 py-2 rounded-pill">
                  <i class="bi bi-x-circle-fill me-1"></i> Tạm hết hàng
                </span>
              </div>

              <!-- Bộ chọn số lượng (Quantity Selector) -->
              <div class="d-flex align-items-center pt-3 border-top">
                <label class="fw-bold text-dark me-4 mb-0">Số lượng:</label>
                <div class="input-group" style="width: 130px;">
                  <button 
                    class="btn btn-outline-secondary px-2 d-flex align-items-center justify-content-center" 
                    style="width: 38px; height: 38px;"
                    type="button"
                    :disabled="quantity <= 1 || isOutOfStock"
                    @click="decreaseQuantity"
                  >
                    <i class="bi bi-dash fs-6"></i>
                  </button>
                  <input 
                    type="number" 
                    class="form-control text-center fw-bold px-1 no-spinners" 
                    style="height: 38px;"
                    v-model.number="quantity"
                    :min="1"
                    :max="stockQuantity"
                    :disabled="isOutOfStock"
                    @change="validateQuantity"
                  >
                  <button 
                    class="btn btn-outline-secondary px-2 d-flex align-items-center justify-content-center" 
                    style="width: 38px; height: 38px;"
                    type="button"
                    :disabled="quantity >= stockQuantity || isOutOfStock"
                    @click="increaseQuantity"
                  >
                    <i class="bi bi-plus fs-6"></i>
                  </button>
                </div>
                <span class="text-muted small ms-3" v-if="!isOutOfStock">
                  Tối đa {{ stockQuantity }} cuốn
                </span>
              </div>

            </div>

            <!-- 2. THẺ THÔNG TIN CHI TIẾT (Specs Table - Hình 1 & 2) -->
            <div class="bg-white rounded-4 shadow-sm p-4 mb-4">
              <h5 class="fw-bold text-dark border-bottom pb-2 mb-3">Thông tin chi tiết</h5>
              <div class="table-responsive">
                <table class="table table-borderless table-sm mb-0">
                  <tbody>
                    <tr class="border-bottom">
                      <td class="text-secondary py-2" style="width: 35%;">Mã hàng</td>
                      <td class="text-dark fw-semibold py-2">{{ book.isbn || ('BK' + book.book_id.toString().padStart(6, '0')) }}</td>
                    </tr>
                    <tr class="border-bottom">
                      <td class="text-secondary py-2">Tên Nhà Cung Cấp</td>
                      <td class="text-primary fw-semibold py-2">{{ book.publisher?.publisher_name || 'Đang cập nhật' }}</td>
                    </tr>
                    <tr class="border-bottom">
                      <td class="text-secondary py-2">Tác giả</td>
                      <td class="text-dark fw-semibold py-2">{{ authorNames }}</td>
                    </tr>
                    <tr class="border-bottom">
                      <td class="text-secondary py-2">Người Dịch</td>
                      <td class="text-dark py-2">Đang cập nhật</td>
                    </tr>
                    <tr class="border-bottom">
                      <td class="text-secondary py-2">NXB</td>
                      <td class="text-dark fw-semibold py-2">{{ book.publisher?.publisher_name || 'Đang cập nhật' }}</td>
                    </tr>
                    <tr class="border-bottom">
                      <td class="text-secondary py-2">Năm XB</td>
                      <td class="text-dark py-2">{{ book.publication_year || 'Đang cập nhật' }}</td>
                    </tr>
                    <tr class="border-bottom">
                      <td class="text-secondary py-2">Ngôn Ngữ</td>
                      <td class="text-dark py-2">Tiếng Việt</td>
                    </tr>
                    <tr class="border-bottom">
                      <td class="text-secondary py-2">Trọng lượng (gr)</td>
                      <td class="text-dark py-2">{{ book.weight ? `${book.weight} gr` : 'Đang cập nhật' }}</td>
                    </tr>
                    <tr class="border-bottom">
                      <td class="text-secondary py-2">Kích Thước Bao Bì</td>
                      <td class="text-dark py-2">{{ dimensionsText }}</td>
                    </tr>
                    <tr class="border-bottom">
                      <td class="text-secondary py-2">Số trang</td>
                      <td class="text-dark py-2">{{ book.page_count ? `${book.page_count} trang` : 'Đang cập nhật' }}</td>
                    </tr>
                    <tr>
                      <td class="text-secondary py-2">Hình thức</td>
                      <td class="text-dark py-2">{{ book.cover_type || 'Bìa Mềm' }}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <!-- 3. THẺ MÔ TẢ SẢN PHẨM (Description - Hình 2) -->
            <div class="bg-white rounded-4 shadow-sm p-4 mb-4">
              <h5 class="fw-bold text-dark border-bottom pb-2 mb-3">Mô tả sản phẩm</h5>
              <h6 class="fw-bold text-dark text-uppercase mb-3">{{ book.title }}</h6>
              
              <div 
                class="book-description-content text-secondary position-relative overflow-hidden transition-all"
                :style="{ maxHeight: isExpandedDesc ? 'none' : '260px' }"
                style="line-height: 1.8; white-space: pre-line;"
              >
                {{ book.description || defaultDescription }}

                <!-- Lớp mờ bóng nếu chưa mở rộng -->
                <div 
                  v-if="!isExpandedDesc" 
                  class="position-absolute bottom-0 start-0 w-100" 
                  style="height: 80px; background: linear-gradient(to bottom, rgba(255,255,255,0), rgba(255,255,255,1));"
                ></div>
              </div>

              <!-- Nút Xem thêm / Thu gọn -->
              <div class="text-center mt-3">
                <button 
                  class="btn btn-outline-danger btn-sm px-4 rounded-pill fw-semibold" 
                  @click="isExpandedDesc = !isExpandedDesc"
                >
                  {{ isExpandedDesc ? 'Thu gọn' : 'Xem thêm' }}
                  <i class="bi ms-1" :class="isExpandedDesc ? 'bi-chevron-up' : 'bi-chevron-down'"></i>
                </button>
              </div>
            </div>

          </div>
        </div>

        <!-- 3. KHỐI ĐÁNH GIÁ SẢN PHẨM (Hình 3 & 4 - Giao diện sẵn sàng để sau này làm) -->
        <div class="bg-white rounded-4 shadow-sm p-4 mb-4">
          <h5 class="fw-bold text-dark mb-4">Đánh giá sản phẩm</h5>
          
          <div class="row align-items-center g-4 pb-4 border-bottom">
            <!-- Điểm tổng kết -->
            <div class="col-md-3 text-center border-end-md">
              <div class="display-3 fw-bold text-dark mb-1">0<span class="fs-4 text-muted">/5</span></div>
              <div class="text-warning fs-5 mb-1">
                <i class="bi bi-star"></i>
                <i class="bi bi-star"></i>
                <i class="bi bi-star"></i>
                <i class="bi bi-star"></i>
                <i class="bi bi-star"></i>
              </div>
              <div class="text-muted small">(0 đánh giá)</div>
            </div>

            <!-- Các mức sao -->
            <div class="col-md-6 px-lg-4">
              <div class="d-flex align-items-center mb-2 small" v-for="star in [5, 4, 3, 2, 1]" :key="star">
                <span class="text-secondary" style="width: 50px;">{{ star }} sao</span>
                <div class="progress flex-grow-1 mx-2" style="height: 8px;">
                  <div class="progress-bar bg-danger" role="progressbar" style="width: 0%"></div>
                </div>
                <span class="text-muted" style="width: 35px; text-align: right;">0%</span>
              </div>
            </div>

            <!-- Nút Viết đánh giá -->
            <div class="col-md-3 text-center">
              <button 
                class="btn btn-outline-danger px-4 py-2 fw-semibold rounded-3 shadow-sm"
                @click="openReviewModal"
              >
                <i class="bi bi-pencil-square me-2"></i> Viết đánh giá
              </button>
            </div>
          </div>

          <!-- Trạng thái trống (Empty State) -->
          <div class="text-center py-5">
            <i class="bi bi-chat-heart text-secondary opacity-50 display-4 mb-3 d-block"></i>
            <h6 class="fw-bold text-dark mb-1">Chưa có đánh giá nào cho sản phẩm này</h6>
            <p class="text-muted small mb-0">Hãy mua hàng và trở thành người đầu tiên chia sẻ cảm nhận về cuốn sách này nhé!</p>
          </div>
        </div>

        <!-- 4. KHỐI FAHASA GIỚI THIỆU (Carousel chuẩn theo ảnh) -->
        <div class="bg-white rounded-4 shadow-sm p-4 mb-5 position-relative" v-if="relatedBooks.length > 0">
          <h5 class="fw-bold text-dark text-uppercase mb-4">FAHASA GIỚI THIỆU</h5>

          <!-- Nút cuộn trái -->
          <button 
            v-if="canScrollLeft"
            class="btn btn-light rounded-circle shadow border position-absolute top-50 start-0 translate-middle-y z-3 ms-2 d-flex align-items-center justify-content-center"
            style="width: 42px; height: 42px;"
            type="button"
            @click="scrollCarousel('left')"
          >
            <i class="bi bi-chevron-left fs-5"></i>
          </button>

          <!-- Nút cuộn phải -->
          <button 
            v-if="canScrollRight"
            class="btn btn-light rounded-circle shadow border position-absolute top-50 end-0 translate-middle-y z-3 me-2 d-flex align-items-center justify-content-center"
            style="width: 42px; height: 42px;"
            type="button"
            @click="scrollCarousel('right')"
          >
            <i class="bi bi-chevron-right fs-5"></i>
          </button>

          <!-- Danh sách sản phẩm trượt ngang (Horizontal Carousel) -->
          <div 
            ref="carouselRef" 
            class="d-flex gap-3 overflow-auto pb-3 scrollbar-none px-1"
            style="scroll-behavior: smooth;"
            @scroll="checkScroll"
          >
            <div 
              v-for="relBook in relatedBooks" 
              :key="relBook.book_id"
              class="card border-0 flex-shrink-0 cursor-pointer bg-white fahasa-item"
              style="width: 200px;"
              @click="navigateToBook(relBook.book_id)"
            >
              <div class="text-center p-2 mb-2">
                <img 
                  :src="getBookCoverUrl(relBook.images, relBook.title)" 
                  class="rounded img-fluid" 
                  :alt="relBook.title"
                  style="aspect-ratio: 3/4; object-fit: cover; max-height: 220px; width: 100%;"
                >
              </div>

              <div class="card-body p-1 d-flex flex-column">
                <div 
                  class="fw-semibold text-dark text-truncate-2 mb-2 small" 
                  style="min-height: 38px; line-height: 1.4;" 
                  :title="relBook.title"
                >
                  {{ relBook.title }}
                </div>

                <div class="mt-auto">
                  <div class="d-flex align-items-baseline gap-2 mb-1">
                    <span class="text-danger fw-bold fs-6">{{ formatCurrency(relBook.final_price) }}</span>
                    <span v-if="relBook.discount_percent > 0" class="badge bg-danger" style="font-size: 11px;">
                      -{{ Math.round(relBook.discount_percent) }}%
                    </span>
                  </div>

                  <div 
                    v-if="relBook.discount_percent > 0" 
                    class="text-muted text-decoration-line-through small" 
                    style="font-size: 12px; min-height: 18px;"
                  >
                    {{ formatCurrency(relBook.price) }}
                  </div>
                  <div v-else style="min-height: 18px;"></div>

                  <div class="text-secondary small mt-1" style="font-size: 11px;">
                    ☆☆☆☆☆ <span class="text-muted">(0)</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Nút Xem thêm ở giữa dưới cùng -->
          <div class="text-center mt-3 pt-2">
            <button 
              class="btn btn-outline-danger px-5 py-2 fw-semibold rounded-2"
              @click="handleSeeMore"
            >
              Xem thêm
            </button>
          </div>
        </div>

      </div>

    </div>

    <!-- TOAST THÔNG BÁO THÊM GIỎ HÀNG THÀNH CÔNG -->
    <div 
      class="toast-container position-fixed bottom-0 end-0 p-3" 
      style="z-index: 1100;"
    >
      <div 
        class="toast align-items-center text-bg-dark border-0 shadow-lg" 
        :class="{ 'show': showToast }" 
        role="alert" 
        aria-live="assertive" 
        aria-atomic="true"
      >
        <div class="d-flex">
          <div class="toast-body d-flex align-items-center">
            <i class="bi bi-check-circle-fill text-success fs-4 me-2"></i>
            <div>
              <div class="fw-bold">Thành công!</div>
              <div class="small">{{ toastMessage }}</div>
            </div>
          </div>
          <button 
            type="button" 
            class="btn-close btn-close-white me-2 m-auto" 
            @click="showToast = false"
          ></button>
        </div>
      </div>
    </div>

    <!-- MODAL VIẾT ĐÁNH GIÁ (GIAO DIỆN SẴN SÀNG) -->
    <div 
      class="modal fade show" 
      tabindex="-1" 
      style="display: block; background-color: rgba(0,0,0,0.5);" 
      v-if="showReviewModal"
    >
      <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content rounded-4 shadow">
          <div class="modal-header border-0 pb-0">
            <h5 class="modal-title fw-bold text-dark">Viết đánh giá sản phẩm</h5>
            <button type="button" class="btn-close" @click="showReviewModal = false"></button>
          </div>
          <div class="modal-body py-3">
            <div class="d-flex align-items-center gap-3 mb-3 p-2 bg-light rounded-3">
              <img 
                :src="currentImageUrl" 
                class="rounded" 
                style="width: 50px; height: 68px; object-fit: cover;"
                :alt="book?.title"
              >
              <div class="text-truncate fw-semibold small text-dark">{{ book?.title }}</div>
            </div>

            <div class="mb-3 text-center">
              <label class="form-label small fw-bold text-secondary mb-1">Đánh giá chung của bạn</label>
              <div class="fs-2 text-warning cursor-pointer">
                <i 
                  v-for="star in 5" 
                  :key="star"
                  class="bi"
                  :class="star <= reviewRating ? 'bi-star-fill text-warning' : 'bi-star text-secondary'"
                  @click="reviewRating = star"
                ></i>
              </div>
            </div>

            <div class="mb-3">
              <label class="form-label small fw-bold text-secondary">Tiêu đề đánh giá</label>
              <input 
                type="text" 
                class="form-control" 
                placeholder="Ví dụ: Sách rất hay, đóng gói cẩn thận..."
                v-model="reviewTitle"
              >
            </div>

            <div class="mb-3">
              <label class="form-label small fw-bold text-secondary">Nội dung nhận xét</label>
              <textarea 
                class="form-control" 
                rows="4" 
                placeholder="Chia sẻ cảm nhận chi tiết của bạn về nội dung, hình thức cuốn sách..."
                v-model="reviewComment"
              ></textarea>
            </div>
          </div>
          <div class="modal-footer border-0 pt-0">
            <button type="button" class="btn btn-light rounded-pill px-4" @click="showReviewModal = false">
              Hủy
            </button>
            <button type="button" class="btn btn-danger rounded-pill px-4 fw-semibold" @click="submitReviewPlaceholder">
              Gửi đánh giá
            </button>
          </div>
        </div>
      </div>
    </div>

  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { publicBookService } from '@/services/bookService';
import { formatImageUrl, getBookCoverUrl } from '@/utils/imageHelper';
import { useCartStore } from '@/stores/cartStore';

const route = useRoute();
const router = useRouter();
const cartStore = useCartStore();

// Trạng thái dữ liệu
const book = ref(null);
const relatedBooks = ref([]);
const isLoading = ref(true);
const errorMessage = ref('');

// Trạng thái hiển thị giao diện
const selectedImageIndex = ref(0);
const quantity = ref(1);
const isAddingCart = ref(false);
const isExpandedDesc = ref(false);

// Carousel điều hướng sách liên quan
const carouselRef = ref(null);
const canScrollLeft = ref(false);
const canScrollRight = ref(true);

// Toast & Modal
const showToast = ref(false);
const toastMessage = ref('');
const showReviewModal = ref(false);
const reviewRating = ref(5);
const reviewTitle = ref('');
const reviewComment = ref('');

const defaultDescription = `Tác phẩm mang đến cho độc giả những trải nghiệm sâu sắc và góc nhìn đa chiều về cuộc sống và con người. Cuốn sách không chỉ là một ấn phẩm giải trí đơn thuần mà còn chứa đựng nhiều thông điệp nhân văn đầy ý nghĩa.`;

// Danh sách ảnh phụ + ảnh chính
const galleryImages = computed(() => {
  if (!book.value || !book.value.images || book.value.images.length === 0) {
    return [{
      image_id: 0,
      image_url: null,
      full_url: formatImageUrl(null, book.value?.title || 'Book Cover')
    }];
  }

  return book.value.images.map((img, idx) => ({
    ...img,
    full_url: formatImageUrl(img.image_url, `${book.value.title} - ${idx + 1}`)
  }));
});

// URL ảnh lớn hiển thị hiện tại
const currentImageUrl = computed(() => {
  if (galleryImages.value.length === 0) {
    return formatImageUrl(null, book.value?.title || 'No Cover');
  }
  const selected = galleryImages.value[selectedImageIndex.value];
  return selected ? selected.full_url : galleryImages.value[0].full_url;
});

// Tồn kho
const stockQuantity = computed(() => {
  return book.value?.inventory?.stock_quantity ?? 0;
});

const isOutOfStock = computed(() => {
  return stockQuantity.value <= 0;
});

// Danh sách tác giả
const authorNames = computed(() => {
  if (!book.value?.authors || book.value.authors.length === 0) {
    return 'Đang cập nhật';
  }
  return book.value.authors.map(a => a.author_name).join(', ');
});

// Kích thước bao bì
const dimensionsText = computed(() => {
  if (!book.value) return 'Đang cập nhật';
  const l = book.value.length;
  const w = book.value.width;
  const h = book.value.height;
  if (!l && !w && !h) return '20 x 13 cm';
  return `${l || 20} x ${w || 13} ${h ? 'x ' + h : ''} cm`;
});

// Số lượng đã bán giả lập theo ID
const soldCount = computed(() => {
  if (!book.value) return '1.2k';
  const val = ((book.value.book_id * 137) % 850) + 50;
  return `${val}`;
});

// Tăng/giảm số lượng
function increaseQuantity() {
  if (quantity.value < stockQuantity.value) {
    quantity.value++;
  }
}

function decreaseQuantity() {
  if (quantity.value > 1) {
    quantity.value--;
  }
}

function validateQuantity() {
  if (!quantity.value || quantity.value < 1) {
    quantity.value = 1;
  } else if (quantity.value > stockQuantity.value) {
    quantity.value = stockQuantity.value;
  }
}

// Format tiền tệ VND
function formatCurrency(val) {
  if (val === undefined || val === null) return '0 ₫';
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(val);
}

// Tải dữ liệu chi tiết sách
async function loadBookDetail(id) {
  try {
    isLoading.value = true;
    errorMessage.value = '';
    selectedImageIndex.value = 0;
    quantity.value = 1;

    const res = await publicBookService.getBookById(id);
    book.value = res;

    // Tải sách cùng thể loại
    if (res.category_id) {
      loadRelatedBooks(res.book_id, res.category_id);
    }
  } catch (error) {
    console.error('Lỗi tải chi tiết sách:', error);
    errorMessage.value = error.response?.data?.message || 'Không thể tải thông tin cuốn sách';
  } finally {
    isLoading.value = false;
  }
}

// Tải sách cùng thể loại (12 cuốn để cuộn carousel)
async function loadRelatedBooks(bookId, categoryId) {
  try {
    const res = await publicBookService.getRelatedBooks(bookId, categoryId, 12);
    relatedBooks.value = res || [];
    setTimeout(checkScroll, 150);
  } catch (error) {
    console.error('Lỗi tải sách liên quan:', error);
  }
}

// Điều hướng cuộn carousel
function scrollCarousel(direction) {
  if (!carouselRef.value) return;
  const amount = direction === 'left' ? -420 : 420;
  carouselRef.value.scrollBy({ left: amount, behavior: 'smooth' });
  setTimeout(checkScroll, 300);
}

function checkScroll() {
  if (!carouselRef.value) return;
  const el = carouselRef.value;
  canScrollLeft.value = el.scrollLeft > 10;
  canScrollRight.value = el.scrollLeft + el.clientWidth < el.scrollWidth - 10;
}

// Nút Xem thêm: xem thêm sách cùng thể loại trên trang chủ
function handleSeeMore() {
  if (book.value?.category_id) {
    router.push({ path: '/', query: { category: book.value.category_id } });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}

// Thêm vào giỏ hàng
async function handleAddToCart() {
  if (isOutOfStock.value || isAddingCart.value) return;

  try {
    isAddingCart.value = true;
    const result = await cartStore.addToCart(book.value.book_id, quantity.value);
    
    if (result.success) {
      triggerToast(`Đã thêm ${quantity.value} cuốn "${book.value.title}" vào giỏ hàng.`);
    }
  } finally {
    isAddingCart.value = false;
  }
}

// Mua ngay
async function handleBuyNow() {
  if (isOutOfStock.value || isAddingCart.value) return;

  try {
    isAddingCart.value = true;
    const result = await cartStore.addToCart(book.value.book_id, quantity.value);
    
    if (result.success) {
      router.push('/cart');
    }
  } finally {
    isAddingCart.value = false;
  }
}

// Kích hoạt Toast thông báo
function triggerToast(msg) {
  toastMessage.value = msg;
  showToast.value = true;
  setTimeout(() => {
    showToast.value = false;
  }, 3500);
}

// Modal viết đánh giá (Placeholder giao diện)
function openReviewModal() {
  reviewRating.value = 5;
  reviewTitle.value = '';
  reviewComment.value = '';
  showReviewModal.value = true;
}

function submitReviewPlaceholder() {
  showReviewModal.value = false;
  triggerToast('Cảm ơn bạn! Đánh giá của bạn sẽ được hiển thị sau khi hoàn tất mua và nhận hàng.');
}

// Điều hướng tới sách khác
function navigateToBook(id) {
  router.push(`/books/${id}`);
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Theo dõi thay đổi ID trên URL
watch(() => route.params.id, (newId) => {
  if (newId) {
    loadBookDetail(newId);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
});

onMounted(() => {
  const id = route.params.id;
  if (id) {
    loadBookDetail(id);
  }
});
</script>

<style scoped>
.cursor-pointer {
  cursor: pointer;
}

.transition-all {
  transition: all 0.2s ease-in-out;
}

.scrollbar-none::-webkit-scrollbar {
  display: none;
}
.scrollbar-none {
  -ms-overflow-style: none;
  scrollbar-width: none;
}

.fahasa-item {
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.fahasa-item:hover {
  transform: translateY(-4px);
}

.main-book-image {
  transition: transform 0.3s ease;
}

.main-book-image:hover {
  transform: scale(1.02);
}

.no-spinners::-webkit-inner-spin-button,
.no-spinners::-webkit-outer-spin-button {
  -webkit-appearance: none;
  margin: 0;
}
.no-spinners {
  -moz-appearance: textfield;
  appearance: textfield;
}

@media (min-width: 768px) {
  .border-end-md {
    border-right: 1px solid #dee2e6;
  }
}
</style>
