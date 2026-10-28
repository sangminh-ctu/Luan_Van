<template>
  <div class="container-fluid bg-light py-3 min-vh-100">
    <div class="container">

      <!-- 1. BREADCRUMB -->
      <nav aria-label="breadcrumb" class="mb-3">
        <ol class="breadcrumb small mb-0 bg-white p-2 px-3 rounded-3 shadow-sm align-items-center">
          <li class="breadcrumb-item">
            <router-link to="/" class="text-decoration-none text-secondary hover-danger">
              <i class="bi bi-house-door-fill me-1"></i>Trang chủ
            </router-link>
          </li>
          <li class="breadcrumb-item">
            <router-link to="/books" class="text-decoration-none text-secondary hover-danger">
              Sách
            </router-link>
          </li>
          <template v-if="breadcrumbItems.length > 0">
            <li 
              v-for="(item, idx) in breadcrumbItems" 
              :key="item.category_id"
              class="breadcrumb-item"
              :class="{ 'active fw-bold text-danger': idx === breadcrumbItems.length - 1 }"
            >
              <router-link 
                v-if="idx < breadcrumbItems.length - 1" 
                :to="`/books?category_id=${item.category_id}`" 
                class="text-decoration-none text-secondary hover-danger"
              >
                {{ item.category_name }}
              </router-link>
              <span v-else>{{ item.category_name }}</span>
            </li>
          </template>
          <li v-else-if="searchKeyword" class="breadcrumb-item active fw-bold text-danger">
            Tìm kiếm: "{{ searchKeyword }}"
          </li>
          <li v-else-if="route.query.on_sale === 'true'" class="breadcrumb-item active fw-bold text-danger">
            Sách đang giảm giá
          </li>
          <li v-else-if="route.query.is_new === 'true'" class="breadcrumb-item active fw-bold text-danger">
            Sách mới
          </li>
          <li v-else-if="route.query.only_sold === 'true'" class="breadcrumb-item active fw-bold text-danger">
            Sách bán chạy
          </li>
          <li v-else class="breadcrumb-item active fw-bold text-danger">
            Tất cả sách
          </li>
        </ol>
      </nav>

      <!-- 2. NÚT MỞ BỘ LỌC TRÊN MOBILE & THANH CHIP ĐANG ÁP DỤNG -->
      <div class="d-md-none mb-3 d-flex align-items-center justify-content-between">
        <button 
          type="button" 
          class="btn btn-outline-danger btn-sm fw-bold d-flex align-items-center"
          @click="isMobileDrawerOpen = true"
        >
          <i class="bi bi-funnel me-1"></i>Bộ lọc
          <span v-if="activeFilterCount > 0" class="badge bg-danger text-white rounded-pill ms-2">
            {{ activeFilterCount }}
          </span>
        </button>

        <span class="small text-secondary fw-semibold">
          {{ pagination.total }} cuốn sách
        </span>
      </div>

      <!-- Backdrop che mờ khi mở bộ lọc trên mobile -->
      <div 
        v-if="isMobileDrawerOpen" 
        class="drawer-backdrop d-md-none" 
        @click="isMobileDrawerOpen = false"
      ></div>

      <!-- 3. BỐ CỤC 2 CỘT: SIDEBAR BỘ LỌC + LƯỚI SẢN PHẨM -->
      <div class="row g-3">
        
        <!-- CỘT TRÁI: SIDEBAR BỘ LỌC (Desktop cố định, Mobile là Drawer) -->
        <div 
          class="col-lg-3 col-md-4 filter-sidebar"
          :class="{ 'mobile-drawer-open': isMobileDrawerOpen }"
        >
          <div class="bg-white rounded-3 shadow-sm p-3 mb-3">
            
            <!-- Header Mobile Drawer -->
            <div class="d-md-none d-flex align-items-center justify-content-between pb-2 mb-3 border-bottom">
              <h6 class="fw-bold mb-0 text-dark">
                <i class="bi bi-funnel-fill text-danger me-1"></i>Bộ lọc tìm kiếm
              </h6>
              <button 
                type="button" 
                class="btn btn-sm btn-close" 
                aria-label="Đóng" 
                @click="isMobileDrawerOpen = false"
              ></button>
            </div>

            <!-- 3.1. DANH MỤC SẢN PHẨM (2 Cấp Cha - Con từ DB) -->
            <h6 class="fw-bold text-dark border-bottom pb-2 mb-2 d-flex align-items-center">
              <i class="bi bi-grid-fill text-danger me-2"></i>DANH MỤC SẢN PHẨM
            </h6>

            <!-- Nút Tất cả sách -->
            <div class="mb-2">
              <button 
                type="button"
                class="btn btn-sm w-100 text-start fw-semibold py-2 px-2 rounded-2 transition-all"
                :class="!currentCategoryId && !searchKeyword ? 'btn-danger text-white' : 'btn-light text-dark'"
                @click="selectCategory(null)"
              >
                <i class="bi bi-book-half me-2"></i>Tất cả sách
              </button>
            </div>

            <!-- Cây Thể loại Cha - Con -->
            <div class="d-flex flex-column gap-1 mb-3">
              <div 
                v-for="parent in categoryStore.categoryTree" 
                :key="parent.category_id"
                class="border-bottom pb-1 mb-1"
              >
                <!-- Danh mục Cha -->
                <div 
                  class="d-flex align-items-center justify-content-between py-1 px-2 rounded cursor-pointer transition-all"
                  :class="categoryStore.isParentOrSelfActive(parent.category_id, currentCategoryId) ? 'bg-danger-subtle text-danger fw-bold' : 'hover-bg text-dark'"
                  @click="selectCategory(parent.category_id)"
                >
                  <span class="small">{{ parent.category_name }}</span>
                </div>

                <!-- Danh mục Con -->
                <div v-if="parent.children?.length > 0" class="ps-3 pt-1 d-flex flex-column gap-1">
                  <div 
                    v-for="child in parent.children"
                    :key="child.category_id"
                    class="py-1 px-2 rounded small cursor-pointer transition-all"
                    :class="currentCategoryId === child.category_id ? 'text-danger fw-bold bg-danger-subtle' : 'text-secondary hover-danger'"
                    @click.stop="selectCategory(child.category_id)"
                  >
                    <i class="bi bi-dash me-1 text-muted"></i>{{ child.category_name }}
                  </div>
                </div>
              </div>
            </div>

            <!-- 3.2. BỘ LỌC KHOẢNG GIÁ (Radio + Nhập tự do) -->
            <h6 class="fw-bold text-dark border-bottom pb-2 mb-2 small text-uppercase">
              <i class="bi bi-cash-stack text-danger me-1"></i>Khoảng giá (Giá bán)
            </h6>
            <div class="d-flex flex-column gap-2 mb-3 small">
              <div class="form-check mb-0">
                <input 
                  class="form-check-input" 
                  type="radio" 
                  name="priceRangeRadio" 
                  id="priceAll" 
                  value="all"
                  :checked="selectedPricePreset === 'all'"
                  @change="selectPricePreset('all')"
                >
                <label class="form-check-label cursor-pointer text-secondary" for="priceAll">
                  Tất cả mức giá
                </label>
              </div>

              <div class="form-check mb-0">
                <input 
                  class="form-check-input" 
                  type="radio" 
                  name="priceRangeRadio" 
                  id="priceUnder100" 
                  value="under100"
                  :checked="selectedPricePreset === 'under100'"
                  @change="selectPricePreset('under100')"
                >
                <label class="form-check-label cursor-pointer text-secondary" for="priceUnder100">
                  Dưới 100.000 đ
                </label>
              </div>

              <div class="form-check mb-0">
                <input 
                  class="form-check-input" 
                  type="radio" 
                  name="priceRangeRadio" 
                  id="price100to200" 
                  value="100to200"
                  :checked="selectedPricePreset === '100to200'"
                  @change="selectPricePreset('100to200')"
                >
                <label class="form-check-label cursor-pointer text-secondary" for="price100to200">
                  100.000 đ - 200.000 đ
                </label>
              </div>

              <div class="form-check mb-0">
                <input 
                  class="form-check-input" 
                  type="radio" 
                  name="priceRangeRadio" 
                  id="price200to500" 
                  value="200to500"
                  :checked="selectedPricePreset === '200to500'"
                  @change="selectPricePreset('200to500')"
                >
                <label class="form-check-label cursor-pointer text-secondary" for="price200to500">
                  200.000 đ - 500.000 đ
                </label>
              </div>

              <div class="form-check mb-0">
                <input 
                  class="form-check-input" 
                  type="radio" 
                  name="priceRangeRadio" 
                  id="priceOver500" 
                  value="over500"
                  :checked="selectedPricePreset === 'over500'"
                  @change="selectPricePreset('over500')"
                >
                <label class="form-check-label cursor-pointer text-secondary" for="priceOver500">
                  Trên 500.000 đ
                </label>
              </div>

              <!-- Nhập khoảng giá tự do -->
              <div class="mt-2 pt-2 border-top">
                <span class="text-muted d-block mb-1" style="font-size: 11px;">Hoặc tự nhập khoảng giá (đ):</span>
                <div class="d-flex align-items-center gap-1 mb-2">
                  <input 
                    type="number" 
                    min="0"
                    step="10000"
                    class="form-control form-control-sm" 
                    placeholder="Từ" 
                    v-model.number="customMinPrice"
                  >
                  <span class="text-muted">-</span>
                  <input 
                    type="number" 
                    min="0"
                    step="10000"
                    class="form-control form-control-sm" 
                    placeholder="Đến" 
                    v-model.number="customMaxPrice"
                  >
                </div>
                <button 
                  type="button" 
                  class="btn btn-outline-danger btn-sm w-100 fw-bold"
                  @click="applyCustomPrice"
                >
                  Áp dụng giá
                </button>
              </div>
            </div>

            <!-- 3.3. BỘ LỌC NHÀ XUẤT BẢN (Dữ liệu thật từ DB) -->
            <div v-if="filterOptions.publishers?.length > 0" class="mb-3">
              <h6 class="fw-bold text-dark border-bottom pb-2 mb-2 small text-uppercase">
                <i class="bi bi-building text-danger me-1"></i>Nhà xuất bản
              </h6>
              <div class="d-flex flex-column gap-1 small max-h-200 overflow-auto scrollbar-thin">
                <div 
                  class="py-1 px-2 rounded cursor-pointer transition-all"
                  :class="!currentPublisherId ? 'bg-danger text-white fw-bold' : 'text-secondary hover-danger'"
                  @click="selectPublisher(null)"
                >
                  Tất cả NXB
                </div>
                <div 
                  v-for="pub in filterOptions.publishers" 
                  :key="pub.publisher_id"
                  class="py-1 px-2 rounded cursor-pointer transition-all text-truncate"
                  :class="currentPublisherId === pub.publisher_id ? 'bg-danger text-white fw-bold' : 'text-secondary hover-danger'"
                  :title="pub.publisher_name"
                  @click="selectPublisher(pub.publisher_id)"
                >
                  {{ pub.publisher_name }}
                </div>
              </div>
            </div>

            <!-- 3.4. BỘ LỌC TÁC GIẢ (Dữ liệu thật từ DB) -->
            <div v-if="filterOptions.authors?.length > 0" class="mb-3">
              <h6 class="fw-bold text-dark border-bottom pb-2 mb-2 small text-uppercase">
                <i class="bi bi-person-lines-fill text-danger me-1"></i>Tác giả
              </h6>
              <div class="d-flex flex-column gap-1 small max-h-200 overflow-auto scrollbar-thin">
                <div 
                  class="py-1 px-2 rounded cursor-pointer transition-all"
                  :class="!currentAuthorId ? 'bg-danger text-white fw-bold' : 'text-secondary hover-danger'"
                  @click="selectAuthor(null)"
                >
                  Tất cả tác giả
                </div>
                <div 
                  v-for="author in filterOptions.authors" 
                  :key="author.author_id"
                  class="py-1 px-2 rounded cursor-pointer transition-all text-truncate"
                  :class="currentAuthorId === author.author_id ? 'bg-danger text-white fw-bold' : 'text-secondary hover-danger'"
                  :title="author.author_name"
                  @click="selectAuthor(author.author_id)"
                >
                  {{ author.author_name }}
                </div>
              </div>
            </div>

            <!-- 3.5. BỘ LỌC HÌNH THỨC BÌA -->
            <div v-if="filterOptions.coverTypes?.length > 0" class="mb-3">
              <h6 class="fw-bold text-dark border-bottom pb-2 mb-2 small text-uppercase">
                <i class="bi bi-book text-danger me-1"></i>Hình thức bìa
              </h6>
              <div class="d-flex flex-wrap gap-1">
                <button 
                  type="button"
                  class="btn btn-sm"
                  :class="!currentCoverType ? 'btn-danger' : 'btn-outline-secondary'"
                  style="font-size: 12px;"
                  @click="selectCoverType(null)"
                >
                  Tất cả
                </button>
                <button 
                  v-for="ctype in filterOptions.coverTypes" 
                  :key="ctype"
                  type="button"
                  class="btn btn-sm"
                  :class="currentCoverType === ctype ? 'btn-danger' : 'btn-outline-secondary'"
                  style="font-size: 12px;"
                  @click="selectCoverType(ctype)"
                >
                  {{ ctype }}
                </button>
              </div>
            </div>

            <!-- 3.6. BỘ LỌC TRẠNG THÁI & TÍNH NĂNG -->
            <h6 class="fw-bold text-dark border-bottom pb-2 mt-3 mb-2 small text-uppercase">
              <i class="bi bi-check2-square text-danger me-1"></i>Trạng thái
            </h6>
            <div class="d-flex flex-column gap-2 small">
              <div class="form-check mb-0">
                <input 
                  class="form-check-input" 
                  type="checkbox" 
                  id="filterInStock" 
                  :checked="route.query.in_stock === 'true'"
                  @change="toggleFilter('in_stock')"
                >
                <label class="form-check-label cursor-pointer text-secondary" for="filterInStock">
                  Chỉ hiện sách còn hàng
                </label>
              </div>
              <div class="form-check mb-0">
                <input 
                  class="form-check-input" 
                  type="checkbox" 
                  id="filterOnSale" 
                  :checked="route.query.on_sale === 'true'"
                  @change="toggleFilter('on_sale')"
                >
                <label class="form-check-label cursor-pointer text-secondary" for="filterOnSale">
                  Đang giảm giá
                </label>
              </div>
              <div class="form-check mb-0">
                <input 
                  class="form-check-input" 
                  type="checkbox" 
                  id="filterIsNew" 
                  :checked="route.query.is_new === 'true'"
                  @change="toggleFilter('is_new')"
                >
                <label class="form-check-label cursor-pointer text-secondary" for="filterIsNew">
                  Sách mới (7 ngày)
                </label>
              </div>
              <div class="form-check mb-0">
                <input 
                  class="form-check-input" 
                  type="checkbox" 
                  id="filterOnlySold" 
                  :checked="route.query.only_sold === 'true'"
                  @change="toggleFilter('only_sold')"
                >
                <label class="form-check-label cursor-pointer text-secondary" for="filterOnlySold">
                  Sách đã bán chạy
                </label>
              </div>
            </div>

            <!-- Nút đóng trên mobile khi đã lọc -->
            <div class="d-md-none mt-4 pt-3 border-top">
              <button 
                type="button" 
                class="btn btn-danger w-100 fw-bold py-2"
                @click="isMobileDrawerOpen = false"
              >
                Xem {{ pagination.total }} kết quả
              </button>
            </div>

          </div>
        </div>

        <!-- CỘT PHẢI: LƯỚI SẢN PHẨM & CÔNG CỤ SẮP XẾP -->
        <div class="col-lg-9 col-md-8">
          
          <!-- Thanh Tiêu đề, Sắp xếp & Chọn Limit -->
          <div class="bg-white rounded-3 shadow-sm p-3 mb-3">
            <div class="d-flex flex-wrap align-items-center justify-content-between gap-3">
              <div>
                <h5 class="fw-bold text-dark mb-0 d-flex align-items-center">
                  <span>{{ currentTitle }}</span>
                  <span class="badge bg-light text-secondary border ms-2 small fw-normal" style="font-size: 12px;">
                    {{ pagination.total }} cuốn
                  </span>
                </h5>
              </div>

              <!-- Thanh công cụ: Sắp xếp + Số lượng mỗi trang -->
              <div class="d-flex flex-wrap align-items-center gap-2">
                <!-- Chọn số lượng hiển thị -->
                <div class="d-flex align-items-center gap-1">
                  <span class="small text-secondary fw-semibold text-nowrap d-none d-lg-inline">Hiện:</span>
                  <select 
                    class="form-select form-select-sm" 
                    style="width: 80px;"
                    :value="currentLimit"
                    @change="changeLimit($event.target.value)"
                  >
                    <option :value="12">12</option>
                    <option :value="24">24</option>
                    <option :value="48">48</option>
                  </select>
                </div>

                <!-- Nút sắp xếp -->
                <div class="d-flex align-items-center gap-1 overflow-auto scrollbar-none">
                  <div class="btn-group btn-group-sm">
                    <button 
                      type="button" 
                      class="btn fw-semibold text-nowrap"
                      :class="currentSort === 'newest' ? 'btn-danger' : 'btn-outline-secondary'"
                      @click="changeSort('newest')"
                    >
                      Mới nhất
                    </button>
                    <button 
                      type="button" 
                      class="btn fw-semibold text-nowrap"
                      :class="currentSort === 'featured' ? 'btn-danger' : 'btn-outline-secondary'"
                      @click="changeSort('featured')"
                    >
                      Bán chạy
                    </button>
                    <button 
                      type="button" 
                      class="btn fw-semibold text-nowrap"
                      :class="currentSort === 'discount_desc' ? 'btn-danger' : 'btn-outline-secondary'"
                      @click="changeSort('discount_desc')"
                    >
                      Giảm giá
                    </button>
                    <button 
                      type="button" 
                      class="btn fw-semibold text-nowrap"
                      :class="currentSort === 'price_asc' ? 'btn-danger' : 'btn-outline-secondary'"
                      @click="changeSort('price_asc')"
                    >
                      Giá: Thấp - Cao
                    </button>
                    <button 
                      type="button" 
                      class="btn fw-semibold text-nowrap"
                      :class="currentSort === 'price_desc' ? 'btn-danger' : 'btn-outline-secondary'"
                      @click="changeSort('price_desc')"
                    >
                      Giá: Cao - Thấp
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <!-- THANH CHIP BỘ LỌC ĐANG ÁP DỤNG -->
            <div v-if="activeChips.length > 0" class="d-flex flex-wrap align-items-center gap-2 pt-3 mt-3 border-top">
              <span class="small text-secondary fw-semibold">Đang lọc theo:</span>
              <span 
                v-for="chip in activeChips" 
                :key="chip.key"
                class="badge bg-light text-dark border d-flex align-items-center gap-1 py-1 px-2"
                style="font-size: 12px; font-weight: normal;"
              >
                <span>{{ chip.label }}</span>
                <i 
                  class="bi bi-x-circle-fill text-muted cursor-pointer hover-danger" 
                  title="Bỏ lọc"
                  @click="removeChip(chip)"
                ></i>
              </span>
              <button 
                type="button" 
                class="btn btn-link btn-sm text-danger text-decoration-none fw-bold p-0 ms-1"
                @click="resetAllFilters"
              >
                Xóa tất cả
              </button>
            </div>
          </div>

          <!-- Loading Skeleton -->
          <div v-if="isLoading" class="row row-cols-2 row-cols-sm-3 row-cols-md-3 row-cols-lg-4 g-3 mb-4">
            <div class="col" v-for="n in 8" :key="'skel-' + n">
              <div class="card h-100 border-0 shadow-sm p-3 bg-white placeholder-glow">
                <div class="placeholder rounded w-100 mb-3" style="aspect-ratio: 3/4; height: 180px;"></div>
                <div class="placeholder col-10 mb-2"></div>
                <div class="placeholder col-6 mb-3"></div>
                <div class="placeholder col-4 mt-auto"></div>
              </div>
            </div>
          </div>

          <!-- Trạng thái lỗi (Error State) -->
          <div v-else-if="errorMessage" class="bg-white rounded-3 shadow-sm p-5 text-center my-3">
            <i class="bi bi-exclamation-triangle display-4 text-warning d-block mb-3"></i>
            <h6 class="fw-bold text-dark mb-2">Đã có lỗi xảy ra</h6>
            <p class="text-secondary small mb-4">{{ errorMessage }}</p>
            <button class="btn btn-danger px-4 fw-bold" @click="fetchBooks">
              Thử lại
            </button>
          </div>

          <!-- Trạng thái trống (Empty State) -->
          <div v-else-if="books.length === 0" class="bg-white rounded-3 shadow-sm p-5 text-center my-3">
            <i class="bi bi-journal-x display-4 text-muted d-block mb-3"></i>
            <h6 class="fw-bold text-dark mb-2">Không tìm thấy cuốn sách nào phù hợp</h6>
            <p class="text-secondary small mb-4">
              Hãy thử bỏ bớt điều kiện lọc hoặc đặt lại bộ lọc để xem các sách khác trong cửa hàng.
            </p>
            <button class="btn btn-danger px-4 fw-bold" @click="resetAllFilters">
              Xóa tất cả bộ lọc
            </button>
          </div>

          <!-- Lưới sách (ProductCard) -->
          <div v-else class="row row-cols-2 row-cols-sm-3 row-cols-md-3 row-cols-lg-4 g-3 mb-4">
            <div class="col" v-for="book in books" :key="book.book_id">
              <ProductCard :book="book" />
            </div>
          </div>

          <!-- Phân trang -->
          <div 
            v-if="pagination.totalPages > 1" 
            class="bg-white rounded-3 shadow-sm py-3 px-4 d-flex flex-wrap align-items-center justify-content-between gap-2"
          >
            <span class="small text-secondary">
              Trang <strong>{{ pagination.page }}</strong> / <strong>{{ pagination.totalPages }}</strong> ({{ pagination.total }} cuốn sách)
            </span>
            <div class="d-flex align-items-center gap-1">
              <button 
                type="button" 
                class="btn btn-sm btn-outline-secondary px-3"
                :disabled="pagination.page <= 1"
                @click="changePage(pagination.page - 1)"
              >
                <i class="bi bi-chevron-left me-1"></i>Trước
              </button>
              
              <template v-for="p in visiblePages" :key="p">
                <span v-if="p === '...'" class="px-2 text-muted">...</span>
                <button 
                  v-else
                  type="button" 
                  class="btn btn-sm px-3 fw-semibold"
                  :class="pagination.page === p ? 'btn-danger text-white' : 'btn-light border text-secondary'"
                  @click="changePage(p)"
                >
                  {{ p }}
                </button>
              </template>

              <button 
                type="button" 
                class="btn btn-sm btn-outline-secondary px-3"
                :disabled="pagination.page >= pagination.totalPages"
                @click="changePage(pagination.page + 1)"
              >
                Sau<i class="bi bi-chevron-right ms-1"></i>
              </button>
            </div>
          </div>

        </div>

      </div>

    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, watch, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { publicBookService } from '@/services/bookService';
import { useCategoryStore } from '@/stores/categoryStore';
import ProductCard from '@/components/customer/ProductCard.vue';

const route = useRoute();
const router = useRouter();
const categoryStore = useCategoryStore();

const books = ref([]);
const isLoading = ref(false);
const errorMessage = ref('');
const isMobileDrawerOpen = ref(false);

const filterOptions = reactive({
  publishers: [],
  authors: [],
  coverTypes: []
});

const customMinPrice = ref(null);
const customMaxPrice = ref(null);

const pagination = reactive({
  page: 1,
  limit: 12,
  total: 0,
  totalPages: 1
});

// Biến đếm chống race condition
let latestRequestId = 0;

// Các computed lấy từ query
const currentCategoryId = computed(() => {
  return route.query.category_id ? Number(route.query.category_id) : null;
});

const currentPublisherId = computed(() => {
  return route.query.publisher_id ? Number(route.query.publisher_id) : null;
});

const currentAuthorId = computed(() => {
  return route.query.author_id ? Number(route.query.author_id) : null;
});

const currentCoverType = computed(() => {
  return route.query.cover_type || '';
});

const currentSort = computed(() => {
  return route.query.sort || 'newest';
});

const currentLimit = computed(() => {
  const l = Number(route.query.limit);
  return [12, 24, 48].includes(l) ? l : 12;
});

const searchKeyword = computed(() => {
  return route.query.search || '';
});

const breadcrumbItems = computed(() => {
  return categoryStore.getBreadcrumb(currentCategoryId.value);
});

// Tiêu đề trang
const currentTitle = computed(() => {
  if (currentCategoryId.value) {
    const cat = categoryStore.getCategoryById(currentCategoryId.value);
    if (cat) return cat.category_name;
  }
  if (searchKeyword.value) {
    return `Kết quả tìm kiếm: "${searchKeyword.value}"`;
  }
  if (route.query.on_sale === 'true') return 'Sách Đang Giảm Giá';
  if (route.query.is_new === 'true') return 'Sách Mới (7 ngày)';
  if (route.query.only_sold === 'true') return 'Sách Bán Chạy Nhất';
  return 'Tất Cả Sách';
});

// Khoảng giá radio đang chọn
const selectedPricePreset = computed(() => {
  const min = route.query.min_price ? Number(route.query.min_price) : null;
  const max = route.query.max_price ? Number(route.query.max_price) : null;

  if (min === null && max === 100000) return 'under100';
  if (min === 100000 && max === 200000) return '100to200';
  if (min === 200000 && max === 500000) return '200to500';
  if (min === 500000 && max === null) return 'over500';
  if (min === null && max === null) return 'all';
  return 'custom';
});

// Danh sách chip bộ lọc đang áp dụng
const activeChips = computed(() => {
  const chips = [];

  if (currentCategoryId.value) {
    const cat = categoryStore.getCategoryById(currentCategoryId.value);
    chips.push({
      key: 'category_id',
      label: `Danh mục: ${cat ? cat.category_name : currentCategoryId.value}`
    });
  }

  const min = route.query.min_price ? Number(route.query.min_price) : null;
  const max = route.query.max_price ? Number(route.query.max_price) : null;
  if (min !== null && max !== null) {
    chips.push({
      key: 'price',
      label: `Giá: ${formatCurrency(min)} - ${formatCurrency(max)}`
    });
  } else if (min !== null) {
    chips.push({
      key: 'price',
      label: `Giá: Trên ${formatCurrency(min)}`
    });
  } else if (max !== null) {
    chips.push({
      key: 'price',
      label: `Giá: Dưới ${formatCurrency(max)}`
    });
  }

  if (currentPublisherId.value) {
    const pub = filterOptions.publishers?.find(p => p.publisher_id === currentPublisherId.value);
    chips.push({
      key: 'publisher_id',
      label: `NXB: ${pub ? pub.publisher_name : currentPublisherId.value}`
    });
  }

  if (currentAuthorId.value) {
    const author = filterOptions.authors?.find(a => a.author_id === currentAuthorId.value);
    chips.push({
      key: 'author_id',
      label: `Tác giả: ${author ? author.author_name : currentAuthorId.value}`
    });
  }

  if (currentCoverType.value) {
    chips.push({
      key: 'cover_type',
      label: `Bìa: ${currentCoverType.value}`
    });
  }

  if (route.query.in_stock === 'true') {
    chips.push({ key: 'in_stock', label: 'Chỉ còn hàng' });
  }

  if (route.query.on_sale === 'true') {
    chips.push({ key: 'on_sale', label: 'Đang giảm giá' });
  }

  if (route.query.is_new === 'true') {
    chips.push({ key: 'is_new', label: 'Sách mới (7 ngày)' });
  }

  if (route.query.only_sold === 'true') {
    chips.push({ key: 'only_sold', label: 'Bán chạy' });
  }

  if (searchKeyword.value) {
    chips.push({ key: 'search', label: `Từ khóa: "${searchKeyword.value}"` });
  }

  return chips;
});

const activeFilterCount = computed(() => activeChips.value.length);

// Hiển thị dải số trang rút gọn nếu số trang lớn
const visiblePages = computed(() => {
  const total = pagination.totalPages;
  const current = pagination.page;
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }
  const pages = [];
  pages.push(1);
  if (current > 3) pages.push('...');
  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);
  for (let i = start; i <= end; i++) {
    pages.push(i);
  }
  if (current < total - 2) pages.push('...');
  pages.push(total);
  return pages;
});

// Gọi API lấy sách (coi URL làm Single Source of Truth + Chống stale request)
async function fetchBooks() {
  const reqId = ++latestRequestId;
  try {
    isLoading.value = true;
    errorMessage.value = '';

    const params = {
      page: route.query.page ? Math.max(1, parseInt(route.query.page, 10)) : 1,
      limit: currentLimit.value,
      sort: currentSort.value
    };

    if (currentCategoryId.value) params.category_id = currentCategoryId.value;
    if (currentPublisherId.value) params.publisher_id = currentPublisherId.value;
    if (currentAuthorId.value) params.author_id = currentAuthorId.value;
    if (currentCoverType.value) params.cover_type = currentCoverType.value;
    if (route.query.min_price) params.min_price = route.query.min_price;
    if (route.query.max_price) params.max_price = route.query.max_price;
    if (route.query.in_stock === 'true') params.in_stock = true;
    if (route.query.on_sale === 'true') params.on_sale = true;
    if (route.query.is_new === 'true') params.is_new = true;
    if (route.query.only_sold === 'true') params.only_sold = true;
    if (searchKeyword.value) params.search = searchKeyword.value;

    const res = await publicBookService.getBooks(params);

    if (reqId !== latestRequestId) return; // Bỏ qua nếu có request mới hơn

    books.value = res.books || [];
    if (res.pagination) {
      Object.assign(pagination, res.pagination);
    }
  } catch (err) {
    if (reqId !== latestRequestId) return;
    console.error('Lỗi tải danh sách sách:', err);
    errorMessage.value = err.response?.data?.message || err.message || 'Không thể tải danh sách sách';
    books.value = [];
    pagination.total = 0;
    pagination.totalPages = 1;
  } finally {
    if (reqId === latestRequestId) {
      isLoading.value = false;
    }
  }
}

// Lấy danh sách lựa chọn bộ lọc (NXB, Tác giả, Bìa)
async function fetchFilterOptions() {
  try {
    const res = await publicBookService.getFilterOptions();
    if (res) {
      filterOptions.publishers = res.publishers || [];
      filterOptions.authors = res.authors || [];
      filterOptions.coverTypes = res.coverTypes || [];
    }
  } catch (err) {
    console.warn('Không thể tải lựa chọn bộ lọc:', err);
  }
}

// Cập nhật URL (luôn reset về page 1 khi đổi bộ lọc)
function updateQuery(mutator) {
  const query = { ...route.query };
  delete query.page; // Luôn về trang 1
  mutator(query);
  router.push({ path: '/books', query });
}

function selectCategory(catId) {
  updateQuery(query => {
    if (catId) query.category_id = catId;
    else delete query.category_id;
  });
}

function selectPublisher(pubId) {
  updateQuery(query => {
    if (pubId) query.publisher_id = pubId;
    else delete query.publisher_id;
  });
}

function selectAuthor(authorId) {
  updateQuery(query => {
    if (authorId) query.author_id = authorId;
    else delete query.author_id;
  });
}

function selectCoverType(cType) {
  updateQuery(query => {
    if (cType) query.cover_type = cType;
    else delete query.cover_type;
  });
}

function selectPricePreset(preset) {
  updateQuery(query => {
    delete query.min_price;
    delete query.max_price;
    if (preset === 'under100') {
      query.max_price = 100000;
    } else if (preset === '100to200') {
      query.min_price = 100000;
      query.max_price = 200000;
    } else if (preset === '200to500') {
      query.min_price = 200000;
      query.max_price = 500000;
    } else if (preset === 'over500') {
      query.min_price = 500000;
    }
  });
}

function applyCustomPrice() {
  const min = customMinPrice.value;
  const max = customMaxPrice.value;
  if (min !== null && max !== null && min > max) {
    alert('Giá tối thiểu không được lớn hơn giá tối đa');
    return;
  }
  updateQuery(query => {
    delete query.min_price;
    delete query.max_price;
    if (min !== null && min !== '') query.min_price = min;
    if (max !== null && max !== '') query.max_price = max;
  });
}

function toggleFilter(filterKey) {
  updateQuery(query => {
    if (query[filterKey] === 'true') {
      delete query[filterKey];
    } else {
      query[filterKey] = 'true';
    }
  });
}

function changeSort(sortKey) {
  updateQuery(query => {
    query.sort = sortKey;
  });
}

function changeLimit(limitVal) {
  updateQuery(query => {
    query.limit = limitVal;
  });
}

function changePage(newPage) {
  if (newPage < 1 || newPage > pagination.totalPages || newPage === pagination.page) return;
  const query = { ...route.query, page: newPage };
  router.push({ path: '/books', query });
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function removeChip(chip) {
  updateQuery(query => {
    if (chip.key === 'price') {
      delete query.min_price;
      delete query.max_price;
      customMinPrice.value = null;
      customMaxPrice.value = null;
    } else {
      delete query[chip.key];
    }
  });
}

function resetAllFilters() {
  customMinPrice.value = null;
  customMaxPrice.value = null;
  router.push({ path: '/books' });
}

function formatCurrency(val) {
  if (!val && val !== 0) return '0 đ';
  return Number(val).toLocaleString('vi-VN') + ' đ';
}

// Đồng bộ ô nhập tự do với query khi tải hoặc đổi URL
function syncCustomInputsWithQuery() {
  customMinPrice.value = route.query.min_price ? Number(route.query.min_price) : null;
  customMaxPrice.value = route.query.max_price ? Number(route.query.max_price) : null;
}

watch(() => route.query, () => {
  syncCustomInputsWithQuery();
  fetchBooks();
});

onMounted(async () => {
  syncCustomInputsWithQuery();
  await Promise.all([
    categoryStore.fetchCategories(),
    fetchFilterOptions()
  ]);
  fetchBooks();
});
</script>

<style scoped>
.cursor-pointer {
  cursor: pointer;
}
.hover-danger:hover {
  color: #c92127 !important;
}
.hover-bg:hover {
  background-color: #f8f9fa;
  color: #c92127;
}
.transition-all {
  transition: all 0.2s ease-in-out;
}
.max-h-200 {
  max-height: 200px;
}
.scrollbar-thin::-webkit-scrollbar {
  width: 4px;
}
.scrollbar-thin::-webkit-scrollbar-thumb {
  background: #dee2e6;
  border-radius: 4px;
}
.scrollbar-none::-webkit-scrollbar {
  display: none;
}
.scrollbar-none {
  -ms-overflow-style: none;
  scrollbar-width: none;
}

/* Responsive Mobile Drawer */
@media (max-width: 767.98px) {
  .filter-sidebar {
    position: fixed;
    top: 0;
    left: 0;
    bottom: 0;
    width: 320px;
    max-width: 88vw;
    background: #fff;
    z-index: 1050;
    overflow-y: auto;
    padding: 1rem;
    box-shadow: 0 0 24px rgba(0, 0, 0, 0.25);
    transform: translateX(-100%);
    transition: transform 0.3s ease-in-out;
  }
  .filter-sidebar.mobile-drawer-open {
    transform: translateX(0);
  }
  .drawer-backdrop {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    z-index: 1040;
  }
}
</style>
