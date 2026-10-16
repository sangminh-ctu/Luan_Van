<template>
  <div class="container-fluid bg-light py-3">
    <div class="container">

      <!-- Thông báo Toast khi thêm giỏ hàng thành công -->
      <div 
        v-if="toastMsg" 
        class="position-fixed bottom-0 end-0 p-3" 
        style="z-index: 1090;"
      >
        <div class="toast show align-items-center text-white bg-success border-0 shadow-lg rounded-3" role="alert">
          <div class="d-flex">
            <div class="toast-body fw-bold">
              <i class="bi bi-check-circle-fill me-2"></i> {{ toastMsg }}
            </div>
            <button type="button" class="btn-close btn-close-white me-2 m-auto" @click="toastMsg = ''"></button>
          </div>
        </div>
      </div>

      <!-- 1. HERO BANNER CAROUSEL -->
      <div class="row mb-4">
        <div class="col-12">
          <div id="mainBanner" class="carousel slide rounded-3 overflow-hidden shadow-sm" data-bs-ride="carousel" data-bs-interval="3000">
            <div class="carousel-indicators">
              <button type="button" data-bs-target="#mainBanner" data-bs-slide-to="0" class="active"></button>
              <button type="button" data-bs-target="#mainBanner" data-bs-slide-to="1"></button>
              <button type="button" data-bs-target="#mainBanner" data-bs-slide-to="2"></button>
              <button type="button" data-bs-target="#mainBanner" data-bs-slide-to="3"></button>
            </div>
            <div class="carousel-inner">
              <div class="carousel-item active"><img src="../../assets/images/banners/banner1.jpg" class="d-block w-100" style="height: 350px; object-fit: cover;" alt="Banner 1"></div>
              <div class="carousel-item"><img src="../../assets/images/banners/banner2.png" class="d-block w-100" style="height: 350px; object-fit: cover;" alt="Banner 2"></div>
              <div class="carousel-item"><img src="../../assets/images/banners/banner3.jpg" class="d-block w-100" style="height: 350px; object-fit: cover;" alt="Banner 3"></div>
              <div class="carousel-item"><img src="../../assets/images/banners/banner4.png" class="d-block w-100" style="height: 350px; object-fit: cover;" alt="Banner 4"></div>
            </div>
            <button class="carousel-control-prev" type="button" data-bs-target="#mainBanner" data-bs-slide="prev">
              <span class="carousel-control-prev-icon" aria-hidden="true"></span>
              <span class="visually-hidden">Previous</span>
            </button>
            <button class="carousel-control-next" type="button" data-bs-target="#mainBanner" data-bs-slide="next">
              <span class="carousel-control-next-icon" aria-hidden="true"></span>
              <span class="visually-hidden">Next</span>
            </button>
          </div>
        </div>
      </div>

      <!-- 2. KHỐI FLASH SALE (Hình 1 - Chuẩn tông màu đỏ Fahasa) -->
      <div class="rounded-4 p-3 mb-4 shadow-sm" style="background: linear-gradient(135deg, #F35A4D 0%, #D32F2F 100%);">
        <!-- Header Flash Sale nền trắng -->
        <div class="bg-white rounded-3 p-2 px-3 mb-3 d-flex align-items-center justify-content-between shadow-sm">
          <div class="d-flex align-items-center">
            <span class="fw-bolder fs-5 text-danger fst-italic me-3">
              <i class="bi bi-lightning-fill"></i> FLASH SALE
            </span>
            <span class="small text-muted d-none d-sm-inline me-2">Kết thúc trong</span>
            <div class="d-flex align-items-center fw-bold small">
              <span class="badge bg-dark text-white px-2 py-1">{{ countdown.hours }}</span>
              <span class="mx-1 text-dark">:</span>
              <span class="badge bg-dark text-white px-2 py-1">{{ countdown.minutes }}</span>
              <span class="mx-1 text-dark">:</span>
              <span class="badge bg-dark text-white px-2 py-1">{{ countdown.seconds }}</span>
            </div>
          </div>
          <router-link to="/books?on_sale=true" class="text-primary text-decoration-none small fw-bold">
            Xem tất cả <i class="bi bi-chevron-right"></i>
          </router-link>
        </div>

        <!-- Lưới sản phẩm Flash Sale -->
        <div class="row row-cols-2 row-cols-sm-3 row-cols-md-4 row-cols-lg-6 g-2 g-md-3">
          <div class="col" v-for="book in flashSaleBooks" :key="book.book_id">
            <div class="card h-100 border-0 rounded-3 shadow-sm book-card cursor-pointer bg-white" @click="goToDetail(book.book_id)">
              <div class="position-relative p-2 text-center">
                <img 
                  :src="getBookCoverUrl(book.images, book.title)" 
                  class="rounded img-fluid" 
                  :alt="book.title"
                  style="aspect-ratio: 3/4; object-fit: cover; width: 100%;"
                >
                <span v-if="book.discount_percent > 0" class="badge bg-danger position-absolute top-0 end-0 m-2 shadow-sm">
                  -{{ Math.round(book.discount_percent) }}%
                </span>
              </div>
              <div class="card-body p-2 d-flex flex-column">
                <div class="fw-bold text-dark text-truncate mb-1" style="font-size: 13px;" :title="book.title">
                  {{ book.title }}
                </div>
                <div class="mt-auto">
                  <div class="text-danger fw-bold fs-6">{{ formatCurrency(book.final_price) }}</div>
                  <div v-if="book.discount_percent > 0" class="text-muted text-decoration-line-through" style="font-size: 11px;">
                    {{ formatCurrency(book.price) }}
                  </div>
                  <!-- Thanh tiến độ -->
                  <div class="progress rounded-pill mt-2" style="height: 14px; background-color: #ffebee;">
                    <div 
                      class="progress-bar bg-danger rounded-pill fw-bold" 
                      role="progressbar" 
                      :style="{ width: getProgressPercent(book) + '%' }"
                    >
                      <span style="font-size: 9px;">Đã bán {{ getSoldNumber(book) }}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 3. DANH MỤC SẢN PHẨM (Dữ liệu thật từ DB) -->
      <div class="bg-white rounded-4 shadow-sm p-3 mb-4">
        <h5 class="fw-bold mb-3 text-dark text-uppercase">
          <i class="bi bi-grid-fill text-danger me-2"></i>Danh mục sản phẩm
        </h5>
        <div class="row row-cols-4 row-cols-md-6 row-cols-lg-8 g-3 text-center">
          <div 
            class="col cursor-pointer category-item" 
            v-for="cat in categoriesList" 
            :key="cat.category_id"
            @click="filterByCategory(cat.category_id)"
          >
            <div 
              class="rounded-circle mx-auto mb-2 d-flex align-items-center justify-content-center shadow-sm category-circle"
              :class="selectedCategory === cat.category_id ? 'bg-danger text-white' : 'bg-light text-danger'"
              style="width: 72px; height: 72px; font-size: 26px;"
            >
              <i class="bi bi-book"></i>
            </div>
            <div class="small fw-semibold text-truncate" :title="cat.category_name">
              {{ cat.category_name }}
            </div>
          </div>
        </div>
      </div>

      <!-- 4. KHỐI BEST SELLERS / BẢNG XẾP HẠNG (Hình 3 - Tinh chỉnh bằng Bootstrap) -->
      <div class="bg-white rounded-4 shadow-sm p-4 mb-4">
        <div class="d-flex align-items-center justify-content-between mb-3 border-bottom pb-2">
          <h4 class="fw-bold text-dark mb-0 d-flex align-items-center">
            <i class="bi bi-fire text-danger me-2"></i> Best Sellers
          </h4>
          <span class="small text-muted">Bảng xếp hạng sách bán chạy nhất</span>
        </div>

        <!-- Tabs thể loại nằm ngang -->
        <div class="d-flex overflow-auto pb-2 mb-3 gap-2 border-bottom scrollbar-none">
          <button 
            class="btn btn-sm px-3 rounded-pill fw-semibold text-nowrap"
            :class="bestSellerCategory === null ? 'btn-danger' : 'btn-light text-secondary'"
            @click="selectBestsellerCategory(null)"
          >
            Tất cả
          </button>
          <button 
            v-for="cat in categoriesList" 
            :key="cat.category_id"
            class="btn btn-sm px-3 rounded-pill fw-semibold text-nowrap"
            :class="bestSellerCategory === cat.category_id ? 'btn-danger' : 'btn-light text-secondary'"
            @click="selectBestsellerCategory(cat.category_id)"
          >
            {{ cat.category_name }}
          </button>
        </div>

        <!-- Bố cục 2 Cột chia đôi (Split Layout) -->
        <div class="row g-4">
          <!-- Cột Trái (Top 1 - 5) -->
          <div class="col-lg-5">
            <div class="d-flex flex-column gap-2">
              <div 
                v-for="(book, index) in topBooksList" 
                :key="book.book_id"
                class="p-2 rounded-3 border d-flex align-items-center cursor-pointer transition-all rank-item"
                :class="{ 'border-danger bg-danger-subtle': selectedTopBook?.book_id === book.book_id }"
                @click="selectedTopBook = book"
                @mouseenter="selectedTopBook = book"
              >
                <!-- Số thứ tự Rank -->
                <div class="text-center me-3" style="width: 36px;">
                  <span 
                    class="fw-bolder" 
                    :class="index < 3 ? 'text-danger fs-3' : 'text-secondary fs-5'"
                  >
                    {{ index + 1 }}
                  </span>
                </div>

                <!-- Ảnh nhỏ -->
                <img 
                  :src="getBookCoverUrl(book.images, book.title)" 
                  class="rounded me-3 shadow-sm border"
                  style="width: 50px; height: 68px; object-fit: cover;"
                  :alt="book.title"
                >

                <!-- Tên & Thông tin -->
                <div class="flex-grow-1 overflow-hidden">
                  <span 
                    class="badge px-2 py-1 mb-1"
                    :class="index < 3 ? 'bg-danger' : 'bg-secondary'"
                    style="font-size: 10px;"
                  >
                    <i class="bi bi-fire" v-if="index < 3"></i> Top {{ index + 1 }}
                  </span>
                  <div class="fw-bold text-dark text-truncate small" :title="book.title">{{ book.title }}</div>
                  <div class="text-muted" style="font-size: 11px;">
                    Đã bán trong tuần {{ getSoldNumber(book) }}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Cột Phải (Khung Xem Nhanh Sách được chọn) -->
          <div class="col-lg-7" v-if="selectedTopBook">
            <div class="card border rounded-3 p-3 bg-white h-100 shadow-sm">
              <div class="row g-3">
                <!-- Ảnh bìa lớn -->
                <div class="col-sm-5 text-center cursor-pointer" @click="goToDetail(selectedTopBook.book_id)">
                  <img 
                    :src="getBookCoverUrl(selectedTopBook.images, selectedTopBook.title)" 
                    class="rounded img-fluid shadow-sm border"
                    style="max-height: 280px; object-fit: cover;"
                    :alt="selectedTopBook.title"
                  >
                </div>

                <!-- Thông tin chi tiết & nút Mua -->
                <div class="col-sm-7 d-flex flex-column">
                  <div class="small text-muted mb-1">
                    Đã bán trong tuần {{ getSoldNumber(selectedTopBook) }}
                  </div>
                  <h5 
                    class="fw-bold text-dark cursor-pointer text-truncate-2 mb-2" 
                    :title="selectedTopBook.title"
                    @click="goToDetail(selectedTopBook.book_id)"
                  >
                    {{ selectedTopBook.title }}
                  </h5>

                  <div class="small text-secondary mb-2">
                    <span class="me-3">
                      <i class="bi bi-person text-danger"></i> Tác giả: 
                      <strong class="text-dark">{{ getAuthorNames(selectedTopBook.authors) }}</strong>
                    </span>
                    <br>
                    <span>
                      <i class="bi bi-journal-bookmark text-danger"></i> Thể loại: 
                      <strong class="text-dark">{{ selectedTopBook.category?.category_name || 'Đang cập nhật' }}</strong>
                    </span>
                  </div>

                  <!-- Giá bán -->
                  <div class="d-flex align-items-baseline gap-2 mb-3">
                    <span class="text-danger fw-bold fs-4">{{ formatCurrency(selectedTopBook.final_price) }}</span>
                    <span v-if="selectedTopBook.discount_percent > 0" class="text-muted text-decoration-line-through small">
                      {{ formatCurrency(selectedTopBook.price) }}
                    </span>
                    <span v-if="selectedTopBook.discount_percent > 0" class="badge bg-danger">
                      -{{ Math.round(selectedTopBook.discount_percent) }}%
                    </span>
                  </div>

                  <!-- Nút thêm vào giỏ hàng -->
                  <button 
                    class="btn btn-danger py-2 fw-bold shadow-sm mb-3"
                    @click="handleAddToCart(selectedTopBook)"
                    :disabled="isAddingCart"
                  >
                    <i class="bi bi-cart-plus me-2"></i> Thêm vào giỏ hàng
                  </button>

                  <!-- Đoạn trích mô tả -->
                  <div class="mt-auto">
                    <div class="small fw-bold text-secondary mb-1">Mô tả sản phẩm:</div>
                    <p class="small text-muted text-truncate-3 mb-2" style="line-height: 1.5;">
                      {{ selectedTopBook.description || 'Chưa có mô tả chi tiết cho cuốn sách này.' }}
                    </p>

                    <!-- Đánh giá -->
                    <div class="d-flex align-items-center pt-2 border-top small">
                      <span class="text-secondary">Đánh giá sản phẩm:</span>
                      <span class="fw-bold text-dark ms-2">0/5</span>
                      <div class="text-warning ms-2">☆☆☆☆☆</div>
                      <span class="text-muted ms-2">(0 đánh giá)</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 5. XU HƯỚNG MUA SẮM (Hình 2 - Dữ liệu thật từ Backend) -->
      <div class="bg-white rounded-4 shadow-sm overflow-hidden mb-5">
        <!-- Header màu hồng nhạt Fahasa -->
        <div class="d-flex align-items-center p-3" style="background-color: #FCE4EC;">
          <div class="bg-danger text-white p-2 rounded-3 me-2 d-flex align-items-center justify-content-center" style="width: 38px; height: 38px;">
            <i class="bi bi-graph-up-arrow fs-5"></i>
          </div>
          <h5 class="mb-0 fw-bold text-dark">Xu Hướng Mua Sắm</h5>
        </div>

        <!-- Tabs chuyển đổi xu hướng -->
        <div class="d-flex px-3 pt-3 border-bottom gap-4">
          <div 
            class="cursor-pointer pb-2 trend-tab" 
            :class="{ 'active': activeTrendTab === 'all' }" 
            @click="switchTrendTab('all')"
          >
            Xu Hướng Theo Ngày
          </div>
          <div 
            class="cursor-pointer pb-2 trend-tab" 
            :class="{ 'active': activeTrendTab === 'discount' }" 
            @click="switchTrendTab('discount')"
          >
            Sách HOT - Giảm Sốc
          </div>
          <div 
            class="cursor-pointer pb-2 trend-tab" 
            :class="{ 'active': activeTrendTab === 'newest' }" 
            @click="switchTrendTab('newest')"
          >
            Sách Mới Nhất
          </div>
        </div>

        <!-- Lưới sản phẩm Xu hướng (5 cột / hàng) -->
        <div class="p-3 bg-light">
          <div class="row row-cols-2 row-cols-md-3 row-cols-lg-5 g-3">
            <div class="col" v-for="book in trendingBooks" :key="book.book_id">
              <div class="card h-100 border-0 shadow-sm trend-card cursor-pointer position-relative bg-white" @click="goToDetail(book.book_id)">
                
                <!-- Huy hiệu nhãn góc trên ảnh -->
                <div class="position-absolute top-0 start-0 m-2" style="z-index: 2;">
                  <span v-if="book.discount_percent >= 30" class="badge bg-danger shadow-sm">
                    Bán chạy 🔥
                  </span>
                  <span v-else-if="book.discount_percent > 0" class="badge bg-warning text-dark shadow-sm">
                    Xu hướng ↗
                  </span>
                  <span v-else class="badge bg-primary shadow-sm">
                    Mới
                  </span>
                </div>

                <div class="p-3 text-center">
                  <img 
                    :src="getBookCoverUrl(book.images, book.title)" 
                    class="rounded img-fluid" 
                    :alt="book.title"
                    style="aspect-ratio: 3/4; object-fit: cover; width: 100%; max-height: 220px;"
                  >
                </div>
                
                <div class="card-body p-3 d-flex flex-column">
                  <h6 class="card-title text-truncate mb-2 fw-bold text-dark" style="font-size: 14px;" :title="book.title">
                    {{ book.title }}
                  </h6>
                  
                  <div class="mt-auto">
                    <div class="d-flex align-items-center mb-1">
                      <span class="text-danger fw-bold fs-5 me-2">{{ formatCurrency(book.final_price) }}</span>
                      <span v-if="book.discount_percent > 0" class="badge bg-danger">
                        -{{ Math.round(book.discount_percent) }}%
                      </span>
                    </div>
                    <div v-if="book.discount_percent > 0" class="text-muted text-decoration-line-through small" style="font-size: 12px;">
                      {{ formatCurrency(book.price) }}
                    </div>
                    
                    <!-- Thanh tiến độ đã bán -->
                    <div class="progress rounded-pill mt-2" style="height: 14px; background-color: #ffebee;">
                      <div 
                        class="progress-bar bg-danger rounded-pill fw-bold" 
                        role="progressbar" 
                        :style="{ width: getProgressPercent(book) + '%' }"
                      >
                        <span style="font-size: 9px;">Đã bán {{ getSoldNumber(book) }}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          <div class="text-center mt-4 mb-2">
            <button class="btn btn-outline-danger px-5 py-2 fw-bold shadow-sm" @click="loadMoreTrending">
              Xem Thêm
            </button>
          </div>
        </div>
      </div>

    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue';
import { useRouter } from 'vue-router';
import { publicBookService } from '@/services/bookService';
import { publicCategoryService } from '@/services/categoryService';
import { getBookCoverUrl } from '@/utils/imageHelper';
import { useCartStore } from '@/stores/cartStore';

const router = useRouter();
const cartStore = useCartStore();

// Trạng thái dữ liệu
const categoriesList = ref([]);
const flashSaleBooks = ref([]);
const allBooks = ref([]);
const trendingBooks = ref([]);
const topBooksList = ref([]);
const selectedTopBook = ref(null);

const activeTrendTab = ref('all');
const bestSellerCategory = ref(null);
const selectedCategory = ref(null);
const isAddingCart = ref(false);
const toastMsg = ref('');

// Đồng hồ đếm ngược Flash Sale
const countdown = ref({ hours: '01', minutes: '20', seconds: '01' });
let timer = null;
let totalSeconds = 4801; // 1 giờ 20 phút 1 giây

const startTimer = () => {
  timer = setInterval(() => {
    if (totalSeconds > 0) {
      totalSeconds--;
      const h = Math.floor(totalSeconds / 3600);
      const m = Math.floor((totalSeconds % 3600) / 60);
      const s = totalSeconds % 60;
      countdown.value = {
        hours: String(h).padStart(2, '0'),
        minutes: String(m).padStart(2, '0'),
        seconds: String(s).padStart(2, '0')
      };
    }
  }, 1000);
};

// Tải dữ liệu từ Backend
const fetchHomeData = async () => {
  try {
    // 1. Thể loại
    categoriesList.value = await publicCategoryService.getCategories();

    // 2. Sách Flash Sale (lọc sách có giảm giá)
    const flashRes = await publicBookService.getBooks({ on_sale: true, limit: 12, sort: 'discount_desc' });
    flashSaleBooks.value = flashRes.books || [];

    // 3. Toàn bộ sách mới nhất
    const allRes = await publicBookService.getBooks({ limit: 20, sort: 'newest' });
    allBooks.value = allRes.books || [];

    // 4. Sách xu hướng
    trendingBooks.value = [...allBooks.value];

    // 5. Best Sellers Top list
    updateBestSellers();
  } catch (error) {
    console.error('Lỗi tải dữ liệu trang chủ:', error);
  }
};

// Cập nhật danh sách Best Sellers theo thể loại
const updateBestSellers = () => {
  let filtered = allBooks.value;
  if (bestSellerCategory.value) {
    filtered = allBooks.value.filter(b => b.category_id === bestSellerCategory.value);
  }
  topBooksList.value = filtered.slice(0, 5);
  selectedTopBook.value = topBooksList.value.length > 0 ? topBooksList.value[0] : null;
};

const selectBestsellerCategory = (catId) => {
  bestSellerCategory.value = catId;
  updateBestSellers();
};

const switchTrendTab = async (tab) => {
  activeTrendTab.value = tab;
  try {
    if (tab === 'discount') {
      const res = await publicBookService.getBooks({ on_sale: true, limit: 10, sort: 'discount_desc' });
      trendingBooks.value = res.books;
    } else if (tab === 'newest') {
      const res = await publicBookService.getBooks({ limit: 10, sort: 'newest' });
      trendingBooks.value = res.books;
    } else {
      trendingBooks.value = allBooks.value.slice(0, 10);
    }
  } catch (e) {
    console.error(e);
  }
};

const filterByCategory = (catId) => {
  selectedCategory.value = catId;
  router.push({ path: '/books', query: { category_id: catId } });
};

const goToDetail = (bookId) => {
  router.push(`/books/${bookId}`);
};

// Thêm vào giỏ hàng nhanh từ khối Bestseller
const handleAddToCart = async (book) => {
  if (!book) return;
  isAddingCart.value = true;
  const res = await cartStore.addToCart(book.book_id, 1);
  isAddingCart.value = false;
  if (res.success) {
    toastMsg.value = `Đã thêm "${book.title}" vào giỏ hàng!`;
    setTimeout(() => {
      toastMsg.value = '';
    }, 3000);
  }
};

const loadMoreTrending = () => {
  router.push('/books');
};

// Helpers định dạng
const formatCurrency = (val) => {
  if (!val && val !== 0) return '0 đ';
  return Number(val).toLocaleString('vi-VN') + ' đ';
};

const getAuthorNames = (authors) => {
  if (!authors || authors.length === 0) return 'Đang cập nhật';
  return authors.map(a => a.author_name).join(', ');
};

const getSoldNumber = (book) => {
  // Giả lập số bán tự nhiên dựa trên ID sách để hiển thị tiến độ đẹp mắt
  const id = Number(book.book_id) || 1;
  return (id * 7 + 12) % 180 + 3;
};

const getProgressPercent = (book) => {
  const sold = getSoldNumber(book);
  return Math.min(100, Math.max(15, (sold / 200) * 100));
};

onMounted(() => {
  startTimer();
  fetchHomeData();
});

onUnmounted(() => {
  if (timer) clearInterval(timer);
});
</script>

<style scoped>
.book-card:hover, .trend-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 0.5rem 1rem rgba(0, 0, 0, 0.15) !important;
  transition: all 0.2s ease-in-out;
}
.cursor-pointer {
  cursor: pointer;
}
.category-circle:hover {
  background-color: #f8d7da !important;
  color: #c92127 !important;
  transition: all 0.2s;
}
.trend-tab {
  font-size: 15px;
  font-weight: 500;
  color: #555;
}
.trend-tab.active {
  color: #c92127;
  font-weight: bold;
  border-bottom: 2px solid #c92127;
}
.trend-tab:hover:not(.active) {
  color: #c92127;
}
.rank-item:hover {
  background-color: #fff5f5;
}
.transition-all {
  transition: all 0.2s ease-in-out;
}
.text-truncate-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.text-truncate-3 {
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.scrollbar-none::-webkit-scrollbar {
  display: none;
}
.scrollbar-none {
  -ms-overflow-style: none;
  scrollbar-width: none;
}
</style>
