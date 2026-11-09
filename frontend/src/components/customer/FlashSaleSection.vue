<template>
  <section
    v-if="sale || loading || error || fullPage"
    class="flash-section rounded-4 mb-4 shadow-sm overflow-hidden"
    aria-label="Flash Sale"
    :aria-busy="loading"
  >
    <!-- Thanh Header Đỏ Tươi -->
    <div
      class="flash-header px-3 px-md-4 py-3 d-flex align-items-center justify-content-between flex-wrap gap-3"
    >
      <div class="d-flex align-items-center flex-wrap gap-2 gap-md-3">
        <h4 class="fw-bolder fst-italic text-white mb-0 d-flex align-items-center gap-1 flash-heading-text">
          <i class="bi bi-lightning-fill"></i>FLASH SALE
        </h4>
        <template v-if="sale">
          <span class="flash-divider d-none d-sm-inline-block"></span>
          <span class="text-white small fw-medium">{{
            sale.display_status === 'upcoming' ? 'Bắt đầu sau' : 'Kết thúc trong'
          }}</span>
          <span class="d-flex align-items-center gap-1 fw-bold" aria-label="Thời gian còn lại">
            <span class="flash-timer-box">{{ countdown.hours }}</span>
            <span class="text-white fw-bold">:</span>
            <span class="flash-timer-box">{{ countdown.minutes }}</span>
            <span class="text-white fw-bold">:</span>
            <span class="flash-timer-box">{{ countdown.seconds }}</span>
          </span>
        </template>
      </div>
      <RouterLink
        v-if="!fullPage && sale"
        to="/flash-sale"
        class="flash-see-all rounded-pill px-3 py-1 small text-white text-decoration-none fw-semibold d-inline-flex align-items-center gap-1"
      >
        Xem tất cả <i class="bi bi-arrow-right"></i>
      </RouterLink>
    </div>

    <!-- Phần Thân Nền Hồng Phấn + Sóng Đỏ -->
    <div class="flash-body p-3 px-md-4 pb-md-4 position-relative">
      <!-- Tia sét mờ trang trí nền -->
      <svg
        class="flash-bg-bolt"
        viewBox="0 0 120 200"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <path d="M72 0L0 112H52L36 200L120 80H66L72 0Z" fill="#f8c8d0" fill-opacity="0.45" />
      </svg>

      <!-- Dải sóng đáy khung -->
      <svg
        class="flash-bottom-wave"
        viewBox="0 0 1440 120"
        preserveAspectRatio="none"
         aria-hidden="true"
      >
        <path
          d="M0,96 C320,120 620,20 960,64 C1180,92 1320,40 1440,24 L1440,120 L0,120 Z"
          fill="#f4a3b0"
          fill-opacity="0.45"
        />
        <path
          d="M0,108 C380,120 720,48 1080,82 C1260,98 1360,64 1440,48 L1440,120 L0,120 Z"
          fill="#e63946"
          fill-opacity="0.88"
        />
      </svg>

      <div v-if="loading" class="text-center text-danger py-5 position-relative z-1" role="status">
        <span class="spinner-border spinner-border-sm me-2"></span>Đang tải Flash Sale...
      </div>
      <div
        v-else-if="error"
        class="alert alert-light my-2 text-center position-relative z-1"
        role="alert"
      >
        {{ error }}<button class="btn btn-outline-danger btn-sm ms-3" @click="load">Thử lại</button>
      </div>
      <template v-else-if="sale">
        <div
          v-if="sale.display_status === 'upcoming' || fullPage"
          class="mb-3 d-flex justify-content-between align-items-center gap-2 flex-wrap position-relative z-1"
        >
          <h6 class="mb-0 fw-bold text-danger">{{ sale.name }}</h6>
          <span v-if="sale.display_status === 'upcoming'" class="badge text-bg-danger">
            Sắp diễn ra · Giá ưu đãi áp dụng khi bắt đầu
          </span>
        </div>

        <div
          v-if="!books.length"
          class="bg-white rounded-3 text-secondary text-center p-4 position-relative z-1"
        >
          Sách trong chương trình đang được cập nhật.
        </div>

        <!-- Bố cục Trang chủ: Dải trượt ngang 5 sách toàn chiều rộng -->
        <div v-else-if="!fullPage" class="position-relative d-flex align-items-center z-1">
          <!-- Nút mũi tên Trái -->
          <button
            v-if="canSlideLeft"
            type="button"
            class="flash-nav-btn flash-nav-prev shadow"
            aria-label="Xem sách trước"
            @click="slideBy(-1)"
          >
            <i class="bi bi-chevron-left"></i>
          </button>

          <!-- Dải sách trượt ngang (mỗi lần hiển thị 5 cuốn trên desktop, lướt xem hết toàn bộ sách) -->
          <div ref="sliderTrack" class="flash-slider-track w-100" @scroll="updateArrows">
            <div
              v-for="book in books"
              :key="book.book_id"
              class="flash-slider-item"
            >
              <RouterLink
                :to="'/books/' + book.book_id"
                class="card flash-card h-100 border-0 rounded-3 text-decoration-none text-dark overflow-hidden"
              >
                <div class="p-3 pb-2 position-relative text-center">
                  <img
                    v-if="book.images?.length && !failedImages[book.book_id]"
                    :src="getBookCoverUrl(book.images, book.title)"
                    :alt="book.title"
                    class="flash-cover w-100"
                    loading="lazy"
                    @error="failedImages[book.book_id] = true"
                  />
                  <div
                    v-else
                    class="flash-cover bg-light d-flex align-items-center justify-content-center rounded"
                  >
                    <i class="bi bi-book fs-1 text-secondary"></i>
                  </div>
                  <span
                    v-if="book.flash_sale_item_id"
                    class="flash-pill-badge position-absolute top-0 start-0 m-2"
                  >
                    <i class="bi bi-lightning-fill me-1"></i>Flash Sale
                  </span>
                </div>
                <div class="card-body pt-1 d-flex flex-column">
                  <h6 class="flash-title fw-bold mb-2" :title="book.title">{{ book.title }}</h6>
                  <div class="d-flex align-items-center flex-wrap gap-2 mt-auto">
                    <strong class="flash-sale-price">{{ money(book.effective_price) }}</strong>
                    <span v-if="book.effective_discount_percent > 0" class="flash-discount-badge">
                      -{{ book.effective_discount_percent }}%
                    </span>
                  </div>
                  <div class="small text-secondary mb-2 flash-old-price">
                    <del v-if="book.effective_price < Number(book.price)">{{ money(book.price) }}</del>
                  </div>
                  <div class="flash-card-footer pt-2 border-top d-flex align-items-center justify-content-between gap-2">
                    <div v-if="!Number(book.inventory?.stock_quantity)" class="small text-danger fw-semibold">
                      Tạm hết hàng
                    </div>
                    <div v-else class="small text-secondary d-flex align-items-center gap-1">
                      <i class="bi bi-cart2"></i>
                      <span>Đã đặt <strong class="text-dark">{{ book.placed_count || 0 }}</strong></span>
                    </div>
                    <button
                      type="button"
                      class="flash-cart-btn"
                      :disabled="!Number(book.inventory?.stock_quantity)"
                      title="Thêm vào giỏ hàng"
                      @click.prevent.stop="onAddToCart(book)"
                    >
                      <i class="bi bi-cart3"></i>
                    </button>
                  </div>
                </div>
              </RouterLink>
            </div>
          </div>

          <!-- Nút mũi tên Phải -->
          <button
            v-if="canSlideRight"
            type="button"
            class="flash-nav-btn flash-nav-next shadow"
            aria-label="Xem sách tiếp theo"
            @click="slideBy(1)"
          >
            <i class="bi bi-chevron-right"></i>
          </button>
        </div>

        <!-- Bố cục Trang /flash-sale riêng (fullPage): Hiển thị lưới toàn bộ sách -->
        <div v-else class="row row-cols-2 row-cols-md-3 row-cols-lg-5 g-3 align-items-stretch position-relative z-1">
          <div
            v-for="book in books"
            :key="book.book_id"
            class="col"
          >
            <RouterLink
              :to="'/books/' + book.book_id"
              class="card flash-card h-100 border-0 rounded-3 text-decoration-none text-dark overflow-hidden"
            >
              <div class="p-3 pb-2 position-relative text-center">
                <img
                  v-if="book.images?.length && !failedImages[book.book_id]"
                  :src="getBookCoverUrl(book.images, book.title)"
                  :alt="book.title"
                  class="flash-cover w-100"
                  loading="lazy"
                  @error="failedImages[book.book_id] = true"
                />
                <div
                  v-else
                  class="flash-cover bg-light d-flex align-items-center justify-content-center rounded"
                >
                  <i class="bi bi-book fs-1 text-secondary"></i>
                </div>
                <span
                  v-if="book.flash_sale_item_id"
                  class="flash-pill-badge position-absolute top-0 start-0 m-2"
                >
                  <i class="bi bi-lightning-fill me-1"></i>Flash Sale
                </span>
              </div>
              <div class="card-body pt-1 d-flex flex-column">
                <h6 class="flash-title fw-bold mb-2" :title="book.title">{{ book.title }}</h6>
                <div class="d-flex align-items-center flex-wrap gap-2 mt-auto">
                  <strong class="flash-sale-price">{{ money(book.effective_price) }}</strong>
                  <span v-if="book.effective_discount_percent > 0" class="flash-discount-badge">
                    -{{ book.effective_discount_percent }}%
                  </span>
                </div>
                <div class="small text-secondary mb-2 flash-old-price">
                  <del v-if="book.effective_price < Number(book.price)">{{ money(book.price) }}</del>
                </div>
                <div class="flash-card-footer pt-2 border-top d-flex align-items-center justify-content-between gap-2">
                  <div v-if="!Number(book.inventory?.stock_quantity)" class="small text-danger fw-semibold">
                    Tạm hết hàng
                  </div>
                  <div v-else class="small text-secondary d-flex align-items-center gap-1">
                    <i class="bi bi-cart2"></i>
                    <span>Đã đặt <strong class="text-dark">{{ book.placed_count || 0 }}</strong></span>
                  </div>
                  <button
                    type="button"
                    class="flash-cart-btn"
                    :disabled="!Number(book.inventory?.stock_quantity)"
                    title="Thêm vào giỏ hàng"
                    @click.prevent.stop="onAddToCart(book)"
                  >
                    <i class="bi bi-cart3"></i>
                  </button>
                </div>
              </div>
            </RouterLink>
          </div>
        </div>

        <nav
          v-if="fullPage && pages > 1"
          class="d-flex justify-content-center align-items-center gap-3 mt-4 position-relative z-1"
          aria-label="Phân trang Flash Sale"
        >
          <button class="btn btn-light btn-sm shadow-sm" :disabled="page <= 1" @click="changePage(page - 1)">
            Trước
          </button>
          <span class="fw-bold text-danger">{{ page }}/{{ pages }}</span>
          <button
            class="btn btn-light btn-sm shadow-sm"
            :disabled="page >= pages"
            @click="changePage(page + 1)"
          >
            Sau
          </button>
        </nav>
      </template>
      <div
        v-else
        class="bg-white text-secondary text-center rounded-3 p-4 position-relative z-1"
      >
        Hiện chưa có chương trình Flash Sale.
        <RouterLink to="/books" class="text-danger fw-semibold">Khám phá sách</RouterLink>
      </div>
    </div>
  </section>
</template>
<script setup>
import { ref, computed, nextTick, onMounted, onBeforeUnmount } from 'vue'
import { flashSaleService } from '@/services/flashSaleService'
import { getBookCoverUrl } from '@/utils/imageHelper'
import { useCartStore } from '@/stores/cartStore'

const props = defineProps({ fullPage: { type: Boolean, default: false } })
const emit = defineEmits(['add-to-cart'])
const cartStore = useCartStore()
const sale = ref(null),
  books = ref([]),
  loading = ref(true),
  error = ref(''),
  page = ref(1),
  pages = ref(1),
  failedImages = ref({})

const sliderTrack = ref(null)
const canSlideLeft = ref(false)
const canSlideRight = ref(false)

function updateArrows() {
  const el = sliderTrack.value
  if (!el) {
    canSlideLeft.value = false
    canSlideRight.value = false
    return
  }
  canSlideLeft.value = el.scrollLeft > 4
  canSlideRight.value = el.scrollLeft + el.clientWidth < el.scrollWidth - 4
}

function slideBy(direction) {
  const el = sliderTrack.value
  if (!el) return
  const card = el.querySelector('.flash-slider-item')
  const step = card ? (card.offsetWidth + 16) * 2 : el.clientWidth * 0.75
  el.scrollBy({ left: direction * step, behavior: 'smooth' })
}

function onAddToCart(book) {
  if (!Number(book.inventory?.stock_quantity)) return
  if (props.fullPage) {
    cartStore.addToCart(book.book_id, 1)
  } else {
    emit('add-to-cart', book)
  }
}
const remaining = ref(0)
let offset = 0,
  timer,
  requestId = 0,
  lastExpired = ''
const countdown = computed(() => ({
  hours: String(Math.floor(remaining.value / 3600)).padStart(2, '0'),
  minutes: String(Math.floor((remaining.value % 3600) / 60)).padStart(2, '0'),
  seconds: String(remaining.value % 60).padStart(2, '0'),
}))
const money = (n) => Number(n || 0).toLocaleString('vi-VN') + ' đ'
function tick() {
  if (!sale.value) return
  const target = sale.value.display_status === 'upcoming' ? sale.value.start_at : sale.value.end_at
  remaining.value = Math.max(
    0,
    Math.ceil((new Date(target).getTime() - (Date.now() + offset)) / 1000),
  )
  const key = sale.value.flash_sale_id + ':' + target
  if (remaining.value === 0 && lastExpired !== key) {
    lastExpired = key
    page.value = 1
    load()
  }
}
async function load() {
  const id = ++requestId
  loading.value = true
  error.value = ''
  try {
    const r = await flashSaleService.current({ page: page.value })
    if (id !== requestId) return
    offset = new Date(r.server_now).getTime() - Date.now()
    sale.value = r.sale
    books.value = r.books
    pages.value = r.pagination.totalPages
    failedImages.value = {}
    tick()
  } catch {
    if (id === requestId) error.value = 'Không thể tải chương trình Flash Sale.'
  } finally {
    if (id === requestId) {
      loading.value = false
      nextTick(updateArrows)
    }
  }
}
function changePage(p) {
  page.value = p
  load()
}
function visible() {
  if (document.visibilityState === 'visible') load()
}
onMounted(() => {
  load()
  timer = setInterval(tick, 1000)
  document.addEventListener('visibilitychange', visible)
  window.addEventListener('resize', updateArrows)
})
onBeforeUnmount(() => {
  requestId++
  clearInterval(timer)
  document.removeEventListener('visibilitychange', visible)
  window.removeEventListener('resize', updateArrows)
})
</script>
<style scoped>
.flash-section {
  border: 2px solid #e31837;
  background-color: #fff5f6;
}
.flash-header {
  background: linear-gradient(90deg, #df1b33 0%, #ef233c 65%, #e31837 100%);
}
.flash-heading-text {
  letter-spacing: 0.5px;
}
.flash-divider {
  width: 1.5px;
  height: 22px;
  background-color: rgba(255, 255, 255, 0.45);
}
.flash-timer-box {
  background-color: #ffffff;
  color: #d90429;
  font-weight: 800;
  font-size: 15px;
  min-width: 34px;
  height: 30px;
  padding: 0 7px;
  border-radius: 6px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.12);
}
.flash-see-all {
  border: 1.5px solid rgba(255, 255, 255, 0.85);
  background-color: rgba(255, 255, 255, 0.08);
  transition: background-color 0.15s, transform 0.15s;
}
.flash-see-all:hover {
  background-color: rgba(255, 255, 255, 0.22);
  transform: translateX(2px);
}
.flash-body {
  background: linear-gradient(180deg, #fff6f7 0%, #fde4e8 78%, #fbd0d7 100%);
  min-height: 340px;
  overflow: hidden;
}
.flash-bg-bolt {
  position: absolute;
  right: 90px;
  top: 10px;
  width: 170px;
  height: 270px;
  pointer-events: none;
  z-index: 0;
}
.flash-bottom-wave {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  width: 100%;
  height: 85px;
  pointer-events: none;
  z-index: 0;
}
.flash-card {
  box-shadow: 0 6px 18px rgba(185, 28, 28, 0.08);
  transition: transform 0.2s, box-shadow 0.2s;
}
.flash-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 10px 22px rgba(185, 28, 28, 0.16);
}
.flash-cover {
  height: 200px;
  object-fit: contain;
}
.flash-pill-badge {
  background: linear-gradient(90deg, #e51c23 0%, #ff4b2b 100%);
  color: #ffffff;
  font-size: 11px;
  font-weight: 700;
  padding: 4px 10px;
  border-radius: 999px;
  box-shadow: 0 3px 8px rgba(229, 28, 35, 0.35);
}
.flash-title {
  font-size: 14px;
  line-height: 1.45;
  height: 41px;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.flash-sale-price {
  color: #d90429;
  font-size: 19px;
  font-weight: 800;
}
.flash-discount-badge {
  background-color: #e31837;
  color: #ffffff;
  font-size: 11px;
  font-weight: 700;
  padding: 3px 8px;
  border-radius: 999px;
}
.flash-old-price {
  min-height: 20px;
}
.flash-cart-btn {
  width: 38px;
  height: 32px;
  border-radius: 8px;
  border: none;
  background-color: #e31837;
  color: #ffffff;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 15px;
  transition: background-color 0.15s, transform 0.15s;
}
.flash-cart-btn:hover:not(:disabled) {
  background-color: #b8122b;
  transform: scale(1.05);
}
.flash-cart-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}
.flash-slider-track {
  display: flex;
  gap: 16px;
  overflow-x: auto;
  scroll-snap-type: x mandatory;
  scroll-behavior: smooth;
  padding: 4px 2px 8px;
  scrollbar-width: none;
  -ms-overflow-style: none;
}
.flash-slider-track::-webkit-scrollbar {
  display: none;
}
.flash-slider-item {
  flex: 0 0 calc((100% - 64px) / 5);
  min-width: 0;
  scroll-snap-align: start;
}
.flash-nav-btn {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  width: 38px;
  height: 38px;
  border-radius: 50%;
  border: 1px solid #f1d4d8;
  background-color: #ffffff;
  color: #374151;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  z-index: 5;
  transition: background-color 0.15s, color 0.15s, transform 0.15s;
}
.flash-nav-btn:hover {
  background-color: #e31837;
  border-color: #e31837;
  color: #ffffff;
  transform: translateY(-50%) scale(1.06);
}
.flash-nav-prev {
  left: -12px;
}
.flash-nav-next {
  right: -12px;
}
@media (max-width: 991.98px) {
  .flash-slider-item {
    flex: 0 0 calc((100% - 32px) / 3);
  }
}
@media (max-width: 575.98px) {
  .flash-slider-item {
    flex: 0 0 calc((100% - 12px) / 2);
  }
  .flash-cover {
    height: 155px;
  }
  .flash-sale-price {
    font-size: 16px;
  }
}
</style>
