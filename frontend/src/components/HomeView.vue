<script setup>
import { ref, onMounted } from 'vue';
import axios from 'axios';

const books = ref([]);
const isLoading = ref(true);

const fetchBooks = async () => {
  try {
    const response = await axios.get('http://localhost:5000/api/books');
    if (response.data.success) {
      books.value = response.data.data;
    }
  } catch (error) {
    console.error("Lỗi kết nối API:", error);
  } finally {
    isLoading.value = false;
  }
};

onMounted(() => fetchBooks());
</script>

<template>
  <main class="bg-light pb-5" style="background-color: #f0f2f5 !important;">
    
    <!-- 1. KHU VỰC HERO BANNER (Dùng ảnh thật của bạn) -->
    <section class="container pt-4 mb-4">
      <div id="heroCarousel" class="carousel slide rounded-3 overflow-hidden shadow-sm" data-bs-ride="carousel">
        <div class="carousel-indicators">
          <button type="button" data-bs-target="#heroCarousel" data-bs-slide-to="0" class="active"></button>
          <button type="button" data-bs-target="#heroCarousel" data-bs-slide-to="1"></button>
          <button type="button" data-bs-target="#heroCarousel" data-bs-slide-to="2"></button>
          <button type="button" data-bs-target="#heroCarousel" data-bs-slide-to="3"></button>
        </div>
        <div class="carousel-inner">
          <div class="carousel-item active">
            <img src="../assets/images/banners/banner1.webp" class="d-block w-100 banner-img" alt="Banner 1">
          </div>
          <div class="carousel-item">
            <img src="../assets/images/banners/banner2.webp" class="d-block w-100 banner-img" alt="Banner 2">
          </div>
          <div class="carousel-item">
            <img src="../assets/images/banners/banner3.webp" class="d-block w-100 banner-img" alt="Banner 3">
          </div>
          <div class="carousel-item">
            <img src="../assets/images/banners/banner4.webp" class="d-block w-100 banner-img" alt="Banner 4">
          </div>
        </div>
        <button class="carousel-control-prev" type="button" data-bs-target="#heroCarousel" data-bs-slide="prev">
          <span class="carousel-control-prev-icon" aria-hidden="true"></span>
        </button>
        <button class="carousel-control-next" type="button" data-bs-target="#heroCarousel" data-bs-slide="next">
          <span class="carousel-control-next-icon" aria-hidden="true"></span>
        </button>
      </div>
    </section>

    <!-- 2. DANH MỤC SẢN PHẨM NHANH -->
    <section class="container mb-4">
      <div class="card border-0 shadow-sm rounded-3 p-3">
        <h5 class="fw-bold mb-3 d-flex align-items-center text-dark">
          <span class="material-symbols-outlined text-danger me-2">grid_view</span> DANH MỤC SẢN PHẨM
        </h5>
        <div class="row row-cols-2 row-cols-md-5 g-3 text-center">
          <div class="col category-item">
            <div class="icon-circle bg-light rounded-circle d-inline-flex p-3 mb-2 shadow-sm fs-3">📚</div>
            <p class="mb-0 small fw-semibold text-secondary">Sách Trong Nước</p>
          </div>
          <div class="col category-item">
            <div class="icon-circle bg-light rounded-circle d-inline-flex p-3 mb-2 shadow-sm fs-3">🌍</div>
            <p class="mb-0 small fw-semibold text-secondary">Sách Ngoại Văn</p>
          </div>
          <div class="col category-item">
            <div class="icon-circle bg-light rounded-circle d-inline-flex p-3 mb-2 shadow-sm fs-3">✏️</div>
            <p class="mb-0 small fw-semibold text-secondary">Văn Phòng Phẩm</p>
          </div>
          <div class="col category-item">
            <div class="icon-circle bg-light rounded-circle d-inline-flex p-3 mb-2 shadow-sm fs-3">🧸</div>
            <p class="mb-0 small fw-semibold text-secondary">Đồ Chơi</p>
          </div>
          <div class="col category-item">
            <div class="icon-circle bg-light rounded-circle d-inline-flex p-3 mb-2 shadow-sm fs-3">📈</div>
            <p class="mb-0 small fw-semibold text-secondary">Kinh Tế</p>
          </div>
        </div>
      </div>
    </section>

    <!-- 3. KHU VỰC FLASH SALE TỪ DATABASE THẬT -->
    <section class="container">
      <div class="card border-0 shadow-sm rounded-3 p-3 bg-white">
        <!-- Tiêu đề Flash Sale -->
        <div class="d-flex justify-content-between align-items-center mb-3 pb-2 border-bottom">
          <div class="d-flex align-items-center gap-2">
            <span class="badge rounded-pill px-3 py-2 text-white" style="background: linear-gradient(90deg, #c92127, #ff4d4f);">
              <h5 class="mb-0 fw-bold fst-italic">⚡ FLASH SALE</h5>
            </span>
          </div>
          <a href="#" class="text-decoration-none fw-semibold" style="color: #c92127;">Xem tất cả &rsaquo;</a>
        </div>

        <!-- Trạng thái Loading -->
        <div v-if="isLoading" class="text-center py-5">
          <div class="spinner-border text-danger" role="status"></div>
          <p class="mt-2 text-muted">Đang tải kệ sách...</p>
        </div>

        <!-- Lưới dữ liệu thật -->
        <div v-else class="row row-cols-2 row-cols-md-4 row-cols-lg-5 g-3">
          <div v-for="book in books" :key="book.book_id" class="col">
            <div class="card h-100 border-0 shadow-sm product-card">
              
              <!-- Ảnh Sách (Tạm dùng ảnh nền giữ chỗ vì DB chưa có URL) -->
              <div class="position-relative p-2 bg-light d-flex justify-content-center">
                <span class="badge bg-danger position-absolute top-0 start-0 m-2 fw-bold shadow">
                  -{{ parseInt(book.discount_percent) }}%
                </span>
                <img src="https://via.placeholder.com/150x200?text=S%C3%A1ch" class="img-fluid rounded" alt="Book Cover" style="height: 180px; object-fit: cover;">
              </div>
              
              <!-- Thông tin Sách -->
              <div class="card-body d-flex flex-column p-2 pt-3">
                <h6 class="card-title text-truncate-2 mb-1 text-dark" :title="book.title" style="font-size: 14px; line-height: 1.4;">
                  {{ book.title }}
                </h6>
                <p class="text-muted small mb-2">{{ book.authors && book.authors.length ? book.authors[0].author_name : 'N/A' }}</p>
                
                <div class="mt-auto">
                  <div class="d-flex align-items-baseline gap-2 flex-wrap">
                    <span class="fw-bold fs-6" style="color: #c92127;">{{ Number(book.price).toLocaleString('vi-VN') }} đ</span>
                    <!-- Tính nháp giá gốc -->
                    <span class="text-muted text-decoration-line-through" style="font-size: 11px;">
                      {{ Number(book.price / (1 - book.discount_percent/100)).toLocaleString('vi-VN') }} đ
                    </span>
                  </div>
                  
                  <!-- Thanh tiến trình (Giả lập giống bản thiết kế) -->
                  <div class="progress mt-2 rounded-pill position-relative" style="height: 16px; background-color: #ffcccc;">
                    <div class="progress-bar rounded-pill" role="progressbar" style="width: 75%; background-color: #ff424e;"></div>
                    <span class="position-absolute w-100 text-center text-white fw-bold" style="font-size: 10px; line-height: 16px;">Đã bán 75</span>
                  </div>
                </div>
              </div>

            </div>
          </div>
        </div>

      </div>
    </section>
  </main>
</template>

<style scoped>
/* CSS Tinh chỉnh nhỏ để mượt mà hơn */
.banner-img {
  height: 380px;
  object-fit: cover;
  object-position: center;
}
.text-truncate-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.product-card {
  transition: transform 0.2s, box-shadow 0.2s;
  cursor: pointer;
}
.product-card:hover {
  box-shadow: 0 8px 15px rgba(0,0,0,0.1) !important;
  transform: translateY(-5px);
}
.category-item {
  transition: transform 0.2s;
  cursor: pointer;
}
.category-item:hover {
  transform: scale(1.05);
}
.category-item:hover .icon-circle {
  background-color: #ffe0e0 !important;
}
</style>