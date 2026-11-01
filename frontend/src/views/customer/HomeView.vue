<template>
  <div class="container-fluid bg-light py-3">
    <div class="container">

      <!-- Thông báo Toast khi thêm giỏ hàng thành công -->
      <div 
        v-if="toastMsg" 
        class="position-fixed bottom-0 end-0 p-3" 
        style="z-index: 1090;"
      >
        <div class="toast show align-items-center text-white border-0 shadow-lg rounded-3" :class="toastSuccess ? 'bg-success' : 'bg-danger'" role="status" aria-live="polite">
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
              <div class="carousel-item active"><img src="../../assets/images/banners/banner1.jpg" class="d-block w-100 home-banner-image" alt="Banner 1"></div>
              <div class="carousel-item"><img src="../../assets/images/banners/banner2.png" class="d-block w-100 home-banner-image" alt="Banner 2"></div>
              <div class="carousel-item"><img src="../../assets/images/banners/banner3.jpg" class="d-block w-100 home-banner-image" alt="Banner 3"></div>
              <div class="carousel-item"><img src="../../assets/images/banners/banner4.png" class="d-block w-100 home-banner-image" alt="Banner 4"></div>
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

      <FlashSaleSection />

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

      <HomeBookShelf title="Xu Hướng Mua Sắm" icon="bi-graph-up-arrow"
        description="Khám phá những cuốn sách đang có giá ưu đãi."
        :query="discountQuery" empty-message="Hiện chưa có sách đang giảm giá." />

      <!-- 5. KHỐI BEST SELLERS / BẢNG XẾP HẠNG (Hình 3 - Tinh chỉnh bằng Bootstrap) -->
      <div class="bg-white rounded-4 shadow-sm p-4 mb-5">
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
        <div v-if="bestSellerLoading" class="text-center text-secondary py-5" role="status">
          <span class="spinner-border spinner-border-sm text-danger me-2" aria-hidden="true"></span>Đang tải bảng xếp hạng...
        </div>
        <div v-else-if="bestSellerError" class="text-center py-4" role="alert">
          <p class="text-secondary">{{ bestSellerError }}</p>
          <button type="button" class="btn btn-outline-danger btn-sm" @click="updateBestSellers">Thử lại</button>
        </div>
        <div v-else-if="!topBooksList.length" class="text-center text-secondary py-4">
          <i class="bi bi-journal-bookmark fs-2 d-block mb-2" aria-hidden="true"></i>
          Chưa có sách được bán từ đơn hàng đã giao trong mục này.
        </div>
        <div v-else class="row g-4">
          <!-- Cột Trái (Top 1 - 10) -->
          <div class="col-lg-5">
            <div class="d-flex flex-column gap-2">
              <div 
                v-for="(book, index) in topBooksList" 
                :key="book.book_id"
                class="p-2 rounded-3 border d-flex align-items-center cursor-pointer transition-all rank-item"
                :class="{ 'border-danger bg-danger-subtle': selectedTopBook?.book_id === book.book_id }"
                @click="selectedTopBook = book"
                @mouseenter="selectedTopBook = book"
                role="button" tabindex="0" :aria-pressed="selectedTopBook?.book_id === book.book_id"
                @keydown.enter="selectedTopBook = book" @keydown.space.prevent="selectedTopBook = book"
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
                    <span v-if="(book.total_sold || 0) > 0">Đã bán {{ book.total_sold }} cuốn</span>
                    <span v-else>Sách mới</span>
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
                    style="max-height: 280px; object-fit: contain;"
                    :alt="selectedTopBook.title"
                  >
                </div>

                <!-- Thông tin chi tiết & nút Mua -->
                <div class="col-sm-7 d-flex flex-column">
                  <div class="small text-muted mb-1">
                    <span v-if="(selectedTopBook.total_sold || 0) > 0">
                      <i class="bi bi-bag-check text-danger me-1"></i>Đã bán {{ selectedTopBook.total_sold }} cuốn
                    </span>
                    <span v-else class="text-secondary">
                      <i class="bi bi-stars text-warning me-1"></i>Sách mới phát hành
                    </span>
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
                    <span v-if="(selectedTopBook.effective_discount_percent ?? selectedTopBook.discount_percent) > 0" class="text-muted text-decoration-line-through small">
                      {{ formatCurrency(selectedTopBook.price) }}
                    </span>
                    <span v-if="(selectedTopBook.effective_discount_percent ?? selectedTopBook.discount_percent) > 0" class="badge bg-danger">
                      -{{ Math.round((selectedTopBook.effective_discount_percent ?? selectedTopBook.discount_percent)) }}%
                    </span>
                  </div>

                  <!-- Nút thêm vào giỏ hàng -->
                  <button 
                    class="btn btn-danger py-2 fw-bold shadow-sm mb-3"
                    @click="handleAddToCart(selectedTopBook)"
                    :disabled="isAddingCart || !Number(selectedTopBook.inventory?.stock_quantity)"
                  >
                    <i class="bi bi-cart-plus me-2"></i>{{ !Number(selectedTopBook.inventory?.stock_quantity) ? 'Tạm hết hàng' : isAddingCart ? 'Đang thêm...' : 'Thêm vào giỏ hàng' }}
                  </button>

                  <!-- Đoạn trích mô tả -->
                  <div class="mt-auto">
                    <div class="small fw-bold text-secondary mb-1">Mô tả sản phẩm:</div>
                    <p class="small text-muted text-truncate-3 mb-2" style="line-height: 1.5;">
                      {{ selectedTopBook.description || 'Chưa có mô tả chi tiết cho cuốn sách này.' }}
                    </p>

                    <router-link :to="'/books/' + selectedTopBook.book_id" class="small text-danger text-decoration-none fw-semibold">Xem chi tiết sách <i class="bi bi-chevron-right" aria-hidden="true"></i></router-link>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <HomeBookShelf title="Sách Mới Về" icon="bi-stars"
        description="Những cuốn sách được thêm vào cửa hàng trong 7 ngày gần đây."
        :query="newestQuery" empty-message="Chưa có sách mới được thêm trong 7 ngày qua. Bạn có thể khám phá toàn bộ sách trong cửa hàng." />
      <HomeBookShelf v-if="collectionCategory" title="Văn Học Cho Cuối Tuần" icon="bi-bookmark-heart"
        description="Dành một khoảng lặng cho những câu chuyện và trang sách."
        :query="collectionQuery" empty-message="Bộ sưu tập văn học đang được cập nhật." />
      <section class="bg-white rounded-4 shadow-sm p-4 mb-4" aria-label="Tiện ích mua sách">
        <div class="row g-4">
          <div class="col-md-4 d-flex gap-3"><i class="bi bi-search text-danger fs-3" aria-hidden="true"></i><div><h6 class="fw-bold">Dễ dàng tìm sách</h6><p class="small text-secondary mb-0">Khám phá sách theo danh mục, tác giả và mức giá phù hợp.</p></div></div>
          <div class="col-md-4 d-flex gap-3"><i class="bi bi-bag-check text-danger fs-3" aria-hidden="true"></i><div><h6 class="fw-bold">Đặt sách trực tuyến</h6><p class="small text-secondary mb-0">Chọn sách yêu thích và thêm vào giỏ hàng ngay tại cửa hàng.</p></div></div>
          <div class="col-md-4 d-flex gap-3"><i class="bi bi-box-seam text-danger fs-3" aria-hidden="true"></i><div><h6 class="fw-bold">Theo dõi đơn hàng</h6><p class="small text-secondary mb-0">Xem thông tin và trạng thái đơn hàng trong tài khoản của bạn.</p></div></div>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useRouter } from 'vue-router';
import { publicBookService } from '@/services/bookService';
import { getBookCoverUrl } from '@/utils/imageHelper';
import { useCartStore } from '@/stores/cartStore';
import { useCategoryStore } from '@/stores/categoryStore';

import FlashSaleSection from '@/components/customer/FlashSaleSection.vue';
import HomeBookShelf from '@/components/customer/HomeBookShelf.vue';

const router = useRouter();
const cartStore = useCartStore();
const categoryStore = useCategoryStore();

// Trạng thái dữ liệu
const categoriesList = ref([]);
const discountQuery = { on_sale: 'true', sort: 'discount_desc' };
const newestQuery = { is_new: 'true', sort: 'newest' };
const collectionCategory = computed(() => categoriesList.value.find(cat => /văn học/i.test(cat.category_name)));
const collectionQuery = computed(() => ({ category_id: collectionCategory.value?.category_id, sort: 'newest' }));
const bestSellerLoading = ref(true);
const bestSellerError = ref('');
let bestSellerRequest = 0;
const topBooksList = ref([]);
const selectedTopBook = ref(null);

const bestSellerCategory = ref(null);
const selectedCategory = ref(null);
const isAddingCart = ref(false);
const toastMsg = ref('');
const toastSuccess = ref(true);
let toastTimer;

// Tải độc lập để lỗi ở một khu vực không chặn phần còn lại.
const fetchHomeData = async () => {
  await Promise.allSettled([
    categoryStore.fetchCategories().then(() => {
      categoriesList.value = categoryStore.categoryTree;
    }),
updateBestSellers(),
  ]);
};
async function updateBestSellers() {
  const id = ++bestSellerRequest;
  bestSellerLoading.value = true;
  bestSellerError.value = '';
  selectedTopBook.value = null;
  topBooksList.value = [];
  try {
    const query = { only_sold: true, sort: 'featured', limit: 10 };
    if (bestSellerCategory.value) query.category_id = bestSellerCategory.value;
    const result = await publicBookService.getBooks(query);
    if (id !== bestSellerRequest) return;
    topBooksList.value = (result.books || []).slice(0, 10);
    selectedTopBook.value = topBooksList.value[0] || null;
  } catch {
    if (id === bestSellerRequest) bestSellerError.value = 'Không thể tải bảng xếp hạng. Vui lòng thử lại.';
  } finally {
    if (id === bestSellerRequest) bestSellerLoading.value = false;
  }
}
const selectBestsellerCategory = (catId) => {
  bestSellerCategory.value = catId;
  updateBestSellers();
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
  if (isAddingCart.value || !Number(book.inventory?.stock_quantity)) return;
  isAddingCart.value = true;
  try {
    const res = await cartStore.addToCart(book.book_id, 1);
    toastSuccess.value = res.success;
    toastMsg.value = res.success ? 'Đã thêm "' + book.title + '" vào giỏ hàng!' : (res.message || 'Không thể thêm sách vào giỏ hàng.');
  } catch {
    toastSuccess.value = false;
    toastMsg.value = 'Không thể thêm sách vào giỏ hàng. Vui lòng thử lại.';
  } finally {
    isAddingCart.value = false;
  }
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toastMsg.value = ''; }, 4000);
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

onMounted(() => {
  fetchHomeData();
});

onUnmounted(() => {
  clearTimeout(toastTimer);
  bestSellerRequest++;
});
</script>

<style scoped>
.home-banner-image { height: 350px; object-fit: cover; }
.rank-item:focus-visible { outline: 2px solid #c92127; outline-offset: 2px; }
@media (max-width: 767.98px) { .home-banner-image { height: auto; aspect-ratio: 3 / 1; object-fit: contain; } .rank-item { min-height: 88px; } }

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
