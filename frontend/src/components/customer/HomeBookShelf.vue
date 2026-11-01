<template>
  <section class="home-shelf bg-white rounded-4 shadow-sm overflow-hidden mb-4" :aria-label="title" :aria-busy="loading">
    <div class="shelf-heading d-flex justify-content-between gap-3 p-3">
      <div>
        <h5 class="fw-bold mb-0"><i :class="['bi', icon, 'text-danger me-2']" aria-hidden="true"></i>{{ title }}</h5>
        <p v-if="description" class="small text-secondary mt-2 mb-0">{{ description }}</p>
      </div>
      <RouterLink :to="{ path: '/books', query }" class="small text-danger text-decoration-none fw-semibold text-nowrap">Xem tất cả <i class="bi bi-chevron-right" aria-hidden="true"></i></RouterLink>
    </div>
    <div class="p-3">
      <div v-if="loading" class="shelf-grid" role="status">
        <span class="visually-hidden">Đang tải sách</span>
        <div v-for="n in 10" :key="n" class="shelf-placeholder rounded-3 placeholder-glow" aria-hidden="true"><span class="placeholder w-100 h-100"></span></div>
      </div>
      <div v-else-if="error" class="text-center py-4" role="alert">
        <p class="text-secondary">{{ error }}</p>
        <button type="button" class="btn btn-outline-danger btn-sm" @click="loadBooks">Thử lại</button>
      </div>
      <div v-else-if="!books.length" class="text-center text-secondary py-4">
        <i class="bi bi-journal-bookmark fs-2 d-block mb-2" aria-hidden="true"></i>{{ emptyMessage }}
      </div>
      <div v-else class="shelf-grid">
        <article v-for="book in books" :key="book.book_id" class="shelf-card rounded-3 border">
          <RouterLink :to="'/books/' + book.book_id" class="book-link">
            <div class="cover-wrap">
              <img v-if="book.images?.length && !failedImages[book.book_id]" :src="getBookCoverUrl(book.images, book.title)" :alt="book.title" loading="lazy" @error="failedImages[book.book_id] = true">
              <div v-else class="cover-fallback"><i class="bi bi-book fs-1" aria-hidden="true"></i><span>{{ book.title }}</span></div>
              <span v-if="Number((book.effective_discount_percent ?? book.discount_percent)) > 0" class="badge bg-danger discount-label">-{{ Math.round((book.effective_discount_percent ?? book.discount_percent)) }}%</span>
            </div>
            <div class="p-3 pt-2">
              <h6 class="book-title" :title="book.title">{{ book.title }}</h6>
              <div class="small text-secondary text-truncate mb-2">{{ book.category?.category_name || 'Sách' }}</div>
              <div class="book-price">{{ formatCurrency(book.final_price ?? book.current_price ?? book.price) }}</div>
              <div class="original-price small text-secondary"><del v-if="Number((book.effective_discount_percent ?? book.discount_percent)) > 0">{{ formatCurrency(book.price) }}</del></div>
              <div class="small mt-2" :class="Number(book.inventory?.stock_quantity) > 0 ? 'text-secondary' : 'text-danger'">
                <template v-if="!Number(book.inventory?.stock_quantity)">Tạm hết hàng</template>
                <template v-else-if="Number(book.total_sold) > 0">Đã bán {{ book.total_sold }}</template>
                <template v-else>Còn hàng</template>
              </div>
            </div>
          </RouterLink>
        </article>
      </div>
    </div>
  </section>
</template>
<script setup>
import { ref, watch, onBeforeUnmount } from 'vue';
import { publicBookService } from '@/services/bookService';
import { getBookCoverUrl } from '@/utils/imageHelper';
const props = defineProps({
  title: { type: String, required: true },
  description: { type: String, default: '' },
  icon: { type: String, default: 'bi-book' },
  query: { type: Object, required: true },
  emptyMessage: { type: String, default: 'Sách trong mục này đang được cập nhật.' },
});
const books = ref([]);
const loading = ref(true);
const error = ref('');
const failedImages = ref({});
let requestId = 0;
async function loadBooks() {
  const id = ++requestId;
  loading.value = true;
  error.value = '';
  try {
    const result = await publicBookService.getBooks({ ...props.query, limit: 10 });
    if (id === requestId) {
      books.value = (result.books || []).slice(0, 10);
      failedImages.value = {};
    }
  } catch {
    if (id === requestId) error.value = 'Không thể tải sách. Vui lòng thử lại.';
  } finally {
    if (id === requestId) loading.value = false;
  }
}
const formatCurrency = value => Number(value || 0).toLocaleString('vi-VN') + ' đ';
watch(() => props.query, loadBooks, { immediate: true, deep: true });
onBeforeUnmount(() => { requestId++; });
</script>
<style scoped>
.shelf-heading { background: #fce4ec; border-bottom: 1px solid #f5d9df; }
.shelf-grid { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 16px; }
.shelf-card { min-width: 0; overflow: hidden; transition: transform .2s, box-shadow .2s; }
.shelf-card:hover { transform: translateY(-3px); box-shadow: 0 6px 18px #00000012; }
.book-link { display: block; height: 100%; color: #212529; text-decoration: none; }
.book-link:focus-visible { outline: 3px solid #c92127; outline-offset: -3px; }
.cover-wrap { position: relative; height: 220px; padding: 16px; }
.cover-wrap img { width: 100%; height: 100%; object-fit: contain; }
.cover-fallback { height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; background: #faf3ef; color: #986c58; text-align: center; padding: 12px; }
.discount-label { position: absolute; top: 8px; left: 8px; }
.book-title { font-size: 14px; line-height: 1.5; height: 42px; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.book-price { color: #c92127; font-weight: 700; font-size: 18px; }
.original-price { min-height: 20px; }
.shelf-placeholder { height: 330px; background: #f4f4f4; overflow: hidden; color: #eee; }
@media (max-width: 991.98px) { .shelf-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
@media (max-width: 575.98px) { .shelf-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; } .cover-wrap { height: 180px; padding: 12px; } .book-price { font-size: 16px; } }
@media (prefers-reduced-motion: reduce) { .shelf-card { transition: none; } .shelf-card:hover { transform: none; } }
</style>
