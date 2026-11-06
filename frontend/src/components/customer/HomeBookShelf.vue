<template>
  <section
    class="home-shelf rounded-4 shadow-sm overflow-hidden mb-4"
    :class="variant === 'limited' ? 'shelf-limited' : 'bg-white'"
    :aria-label="title"
    :aria-busy="loading"
  >
    <div class="shelf-heading d-flex justify-content-between align-items-center gap-3 p-3">
      <div class="d-flex align-items-center gap-3">
        <img v-if="iconImage" :src="iconImage" alt="" class="shelf-icon-img flex-shrink-0" />
        <div>
          <div class="d-flex align-items-center flex-wrap gap-2">
            <h5 class="fw-bold mb-0" :class="variant === 'limited' ? 'text-dark fs-4' : ''">
              <i v-if="!iconImage" :class="['bi', icon, 'text-danger me-2']" aria-hidden="true"></i>{{ title }}
            </h5>
            <span v-if="badgeText" class="shelf-badge">{{ badgeText }}</span>
          </div>
          <p v-if="description" class="small text-secondary mt-1 mb-0">{{ description }}</p>
        </div>
      </div>
      <RouterLink
        :to="{ path: '/books', query }"
        class="small text-decoration-none fw-semibold text-nowrap"
        :class="variant === 'limited' ? 'limited-more-link' : 'text-danger'"
      >{{ variant === 'limited' ? 'Xem thêm' : 'Xem tất cả' }} <i class="bi bi-chevron-right" aria-hidden="true"></i></RouterLink>
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
        <article
          v-for="book in books"
          :key="book.book_id"
          class="shelf-card rounded-3 border bg-white"
        >
          <RouterLink :to="'/books/' + book.book_id" class="book-link d-flex flex-column">
            <div class="cover-wrap">
              <img v-if="book.images?.length && !failedImages[book.book_id]" :src="getBookCoverUrl(book.images, book.title)" :alt="book.title" loading="lazy" @error="failedImages[book.book_id] = true">
              <div v-else class="cover-fallback"><i class="bi bi-book fs-1" aria-hidden="true"></i><span>{{ book.title }}</span></div>
              <div v-if="book.tags?.length" class="tag-badges d-flex flex-wrap gap-1">
                <span
                  v-for="tag in book.tags.slice(0, 2)"
                  :key="tag.tag_id"
                  class="badge shadow-sm"
                  :style="{ backgroundColor: tag.color }"
                >{{ tag.tag_name }}</span>
              </div>
            </div>
            <div class="p-3 pt-2 d-flex flex-column flex-grow-1">
              <h6 class="book-title" :title="book.title" :class="variant === 'limited' ? 'fw-bold' : ''">{{ book.title }}</h6>

              <template v-if="variant === 'limited'">
                <div class="limited-meta small mt-1">
                  <div class="limited-edition-line">
                    <i class="bi bi-gem me-1"></i>Phát hành giới hạn
                    <template v-if="Number(book.inventory?.stock_quantity) > 0">· Còn {{ book.inventory.stock_quantity }} bản</template>
                  </div>
                  <div v-if="Number(book.inventory?.stock_quantity) > 0" class="text-secondary mt-1">
                    <i class="bi bi-lightning-fill text-warning me-1"></i>Sẵn sàng giao ngay
                  </div>
                  <div v-else class="text-danger mt-1">Tạm hết hàng</div>
                </div>
                <div class="d-flex align-items-center justify-content-between gap-2 mt-auto pt-2">
                  <div>
                    <div class="d-flex align-items-center flex-wrap gap-1">
                      <span class="limited-price">{{ formatCurrency(book.final_price ?? book.current_price ?? book.price) }}</span>
                      <span v-if="Number((book.effective_discount_percent ?? book.discount_percent)) > 0" class="badge bg-danger discount-badge">-{{ Math.round((book.effective_discount_percent ?? book.discount_percent)) }}%</span>
                    </div>
                    <div v-if="Number((book.effective_discount_percent ?? book.discount_percent)) > 0" class="small text-secondary"><del>{{ formatCurrency(book.price) }}</del></div>
                  </div>
                  <button
                    type="button"
                    class="limited-cart-btn"
                    :disabled="!Number(book.inventory?.stock_quantity)"
                    title="Thêm vào giỏ hàng"
                    @click.prevent.stop="$emit('add-to-cart', book)"
                  >
                    <i class="bi bi-cart3"></i>
                  </button>
                </div>
              </template>

              <template v-else>
                <div class="small text-secondary text-truncate mb-2">{{ book.category?.category_name || 'Sách' }}</div>
                <div class="d-flex align-items-center flex-wrap gap-2">
                  <span class="book-price">{{ formatCurrency(book.final_price ?? book.current_price ?? book.price) }}</span>
                  <span v-if="Number((book.effective_discount_percent ?? book.discount_percent)) > 0" class="badge bg-danger discount-badge">-{{ Math.round((book.effective_discount_percent ?? book.discount_percent)) }}%</span>
                </div>
                <div class="original-price small text-secondary"><del v-if="Number((book.effective_discount_percent ?? book.discount_percent)) > 0">{{ formatCurrency(book.price) }}</del></div>
                <div class="small mt-2" :class="Number(book.inventory?.stock_quantity) > 0 ? 'text-secondary' : 'text-danger'">
                  <template v-if="!Number(book.inventory?.stock_quantity)">Tạm hết hàng</template>
                  <template v-else-if="Number(book.total_sold) > 0">Đã bán <strong class="text-dark">{{ book.total_sold }}</strong></template>
                  <template v-else>Còn hàng</template>
                </div>
              </template>
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
  iconImage: { type: String, default: '' },
  badgeText: { type: String, default: '' },
  variant: { type: String, default: 'default' },
  query: { type: Object, required: true },
  emptyMessage: { type: String, default: 'Sách trong mục này đang được cập nhật.' },
});
defineEmits(['add-to-cart']);
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
.shelf-limited {
  background: linear-gradient(180deg, #fdf6e4 0%, #ffffff 48%);
  border: 1px solid #f3e3bd;
}
.shelf-limited .shelf-heading {
  background: transparent;
  border-bottom: none;
  padding-bottom: 4px !important;
}
.shelf-icon-img {
  width: 52px;
  height: 52px;
  object-fit: contain;
}
.shelf-badge {
  background: linear-gradient(90deg, #f3d08a 0%, #e4b363 100%);
  color: #4a2c00;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.4px;
  padding: 4px 10px;
  border-radius: 6px;
  text-transform: uppercase;
}
.limited-more-link {
  color: #b4690e;
}
.limited-more-link:hover {
  color: #8a4f08;
}
.limited-edition-line {
  color: #b4690e;
  font-weight: 600;
}
.limited-price {
  color: #111827;
  font-weight: 800;
  font-size: 18px;
}
.limited-cart-btn {
  width: 36px;
  height: 36px;
  border-radius: 8px;
  border: none;
  background-color: #111827;
  color: #fbbf24;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  transition: transform 0.15s, background-color 0.15s;
}
.limited-cart-btn:hover:not(:disabled) {
  background-color: #1f2937;
  transform: scale(1.05);
}
.limited-cart-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}
.shelf-grid { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 16px; }
.shelf-card { min-width: 0; overflow: hidden; transition: transform .2s, box-shadow .2s; }
.shelf-card:hover { transform: translateY(-3px); box-shadow: 0 6px 18px #00000012; }
.book-link { display: block; height: 100%; color: #212529; text-decoration: none; }
.book-link:focus-visible { outline: 3px solid #c92127; outline-offset: -3px; }
.cover-wrap { position: relative; height: 220px; padding: 16px; }
.cover-wrap img { width: 100%; height: 100%; object-fit: contain; }
.cover-fallback { height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; background: #faf3ef; color: #986c58; text-align: center; padding: 12px; }
.tag-badges { position: absolute; top: 8px; left: 8px; z-index: 2; }
.discount-badge { background-color: #c92127 !important; font-size: 12px; font-weight: 700; padding: 4px 6px; border-radius: 4px; }
.book-title { font-size: 14px; line-height: 1.5; height: 42px; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.book-price { color: #c92127; font-weight: 700; font-size: 18px; }
.original-price { min-height: 20px; }
.shelf-placeholder { height: 330px; background: #f4f4f4; overflow: hidden; color: #eee; }
@media (max-width: 991.98px) { .shelf-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
@media (max-width: 575.98px) { .shelf-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; } .cover-wrap { height: 180px; padding: 12px; } .book-price { font-size: 16px; } }
@media (prefers-reduced-motion: reduce) { .shelf-card { transition: none; } .shelf-card:hover { transform: none; } }
</style>
