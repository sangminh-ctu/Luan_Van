<template>
  <section
    v-if="sale || loading || error || fullPage"
    class="rounded-4 p-3 mb-4 bg-danger bg-gradient shadow-sm"
    aria-label="Flash Sale"
    :aria-busy="loading"
  >
    <div
      class="bg-white rounded-3 p-3 d-flex align-items-center justify-content-between flex-wrap gap-3"
    >
      <div class="d-flex align-items-center flex-wrap gap-3">
        <h4 class="fw-bold fst-italic text-danger mb-0">
          <i class="bi bi-lightning-fill"></i>FLASH SALE
        </h4>
        <template v-if="sale"
          ><span class="small">{{
            sale.display_status === 'upcoming' ? 'Bắt đầu sau' : 'Kết thúc trong'
          }}</span
          ><span class="d-flex align-items-center gap-1 fw-bold" aria-label="Thời gian còn lại"
            ><span class="badge text-bg-dark">{{ countdown.hours }}</span
            >:<span class="badge text-bg-dark">{{ countdown.minutes }}</span
            >:<span class="badge text-bg-dark">{{ countdown.seconds }}</span></span
          ></template
        >
      </div>
      <RouterLink
        v-if="!fullPage && sale"
        to="/flash-sale"
        class="small text-primary text-decoration-none fw-semibold"
        >Xem tất cả <i class="bi bi-chevron-right"></i
      ></RouterLink>
    </div>
    <div v-if="loading" class="text-center text-white py-4" role="status">
      <span class="spinner-border spinner-border-sm me-2"></span>Đang tải Flash Sale...
    </div>
    <div v-else-if="error" class="alert alert-light mt-3 mb-0 text-center" role="alert">
      {{ error }}<button class="btn btn-outline-danger btn-sm ms-3" @click="load">Thử lại</button>
    </div>
    <template v-else-if="sale">
      <div
        class="text-white mt-3 mb-2 d-flex justify-content-between align-items-center gap-2 flex-wrap"
      >
        <h5 class="mb-0">{{ sale.name }}</h5>
        <span v-if="sale.display_status === 'upcoming'" class="badge text-bg-light"
          >Sắp diễn ra · Giá ưu đãi áp dụng khi bắt đầu</span
        >
      </div>
      <div v-if="!books.length" class="bg-white rounded-3 text-secondary text-center p-4">
        Sách trong chương trình đang được cập nhật.
      </div>
      <div v-else class="row row-cols-2 row-cols-md-3 row-cols-lg-5 g-3 mt-0">
        <div v-for="book in books" :key="book.book_id" class="col">
          <RouterLink
            :to="'/books/' + book.book_id"
            class="card h-100 border-0 rounded-3 text-decoration-none text-dark overflow-hidden"
          >
            <div class="p-3 position-relative text-center">
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
                class="flash-cover bg-light d-flex align-items-center justify-content-center"
              >
                <i class="bi bi-book fs-1 text-secondary"></i>
              </div>
              <span
                v-if="book.flash_sale_item_id"
                class="badge text-bg-danger position-absolute top-0 start-0 m-2"
                >Flash Sale</span
              >
            </div>
            <div class="card-body pt-0 d-flex flex-column">
              <h6 class="flash-title mb-2" :title="book.title">{{ book.title }}</h6>
              <div class="d-flex align-items-center flex-wrap gap-2 mt-auto">
                <strong class="text-danger fs-5">{{ money(book.effective_price) }}</strong
                ><span v-if="book.effective_discount_percent > 0" class="badge text-bg-danger"
                  >-{{ book.effective_discount_percent }}%</span
                >
              </div>
              <div class="small text-secondary mb-2">
                <del v-if="book.effective_price < Number(book.price)">{{ money(book.price) }}</del>
              </div>
              <div v-if="!Number(book.inventory?.stock_quantity)" class="small text-danger">
                Tạm hết hàng
              </div>
              <div v-else class="small text-secondary">Đã đặt {{ book.placed_count || 0 }}</div>
            </div>
          </RouterLink>
        </div>
      </div>
      <nav
        v-if="fullPage && pages > 1"
        class="d-flex justify-content-center align-items-center gap-3 mt-3"
        aria-label="Phân trang Flash Sale"
      >
        <button class="btn btn-light btn-sm" :disabled="page <= 1" @click="changePage(page - 1)">
          Trước</button
        ><span class="text-white">{{ page }}/{{ pages }}</span
        ><button
          class="btn btn-light btn-sm"
          :disabled="page >= pages"
          @click="changePage(page + 1)"
        >
          Sau
        </button>
      </nav>
    </template>
    <div v-else class="bg-white text-secondary text-center rounded-3 p-4 mt-3">
      Hiện chưa có chương trình Flash Sale.
      <RouterLink to="/books" class="text-danger">Khám phá sách</RouterLink>
    </div>
  </section>
</template>
<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { flashSaleService } from '@/services/flashSaleService'
import { getBookCoverUrl } from '@/utils/imageHelper'
defineProps({ fullPage: { type: Boolean, default: false } })
const sale = ref(null),
  books = ref([]),
  loading = ref(true),
  error = ref(''),
  page = ref(1),
  pages = ref(1),
  failedImages = ref({})
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
    if (id === requestId) loading.value = false
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
})
onBeforeUnmount(() => {
  requestId++
  clearInterval(timer)
  document.removeEventListener('visibilitychange', visible)
})
</script>
<style scoped>
.flash-cover {
  height: 220px;
  object-fit: contain;
}
.flash-title {
  font-size: 14px;
  line-height: 1.5;
  height: 42px;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
@media (max-width: 575.98px) {
  .flash-cover {
    height: 160px;
  }
}
</style>
