<template>
  <div 
    class="card h-100 border-0 shadow-sm product-card cursor-pointer position-relative bg-white"
    :class="{ 'out-of-stock': isOutOfStock }"
    @click="goToDetail"
  >
    <!-- Huy hiệu góc trên ảnh -->
    <div class="position-absolute top-0 start-0 m-2 d-flex flex-wrap gap-1" style="z-index: 2;">
      <span v-if="book.is_new" class="badge bg-primary shadow-sm">
        Mới
      </span>
      <span v-if="book.discount_percent > 0" class="badge bg-danger shadow-sm">
        -{{ Math.round(book.discount_percent) }}%
      </span>
      <span v-else-if="(book.total_sold || 0) > 0" class="badge bg-danger shadow-sm">
        Bán chạy 🔥
      </span>
    </div>

    <!-- Huy hiệu hết hàng nếu stock <= 0 -->
    <div v-if="isOutOfStock" class="position-absolute top-0 end-0 m-2" style="z-index: 2;">
      <span class="badge bg-secondary shadow-sm">Hết hàng</span>
    </div>

    <!-- Ảnh bìa sách -->
    <div class="p-3 text-center position-relative">
      <img 
        :src="coverUrl" 
        class="rounded img-fluid book-img" 
        :alt="book.title"
        loading="lazy"
        style="aspect-ratio: 3/4; object-fit: cover; width: 100%; max-height: 220px;"
      >
      <!-- Overlay mờ khi hết hàng -->
      <div 
        v-if="isOutOfStock" 
        class="position-absolute top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center bg-white bg-opacity-50 rounded"
      >
        <span class="badge bg-dark text-white px-3 py-2 fw-semibold shadow-sm">Tạm hết hàng</span>
      </div>
    </div>

    <!-- Thông tin sách -->
    <div class="card-body p-3 d-flex flex-column">
      <!-- Tên sách -->
      <h6 
        class="card-title text-truncate-2 mb-1 fw-bold text-dark" 
        style="font-size: 14px; min-height: 38px; line-height: 1.35;" 
        :title="book.title"
      >
        {{ book.title }}
      </h6>

      <!-- Tác giả (nếu có) -->
      <div v-if="authorsText" class="text-muted small text-truncate mb-2" style="font-size: 12px;">
        <i class="bi bi-pen me-1"></i>{{ authorsText }}
      </div>

      <div class="mt-auto">
        <!-- Giá bán -->
        <div class="d-flex align-items-center mb-1 flex-wrap gap-1">
          <span class="text-danger fw-bold fs-5">{{ formatCurrency(book.final_price) }}</span>
          <span v-if="book.discount_percent > 0" class="badge bg-danger small" style="font-size: 11px;">
            -{{ Math.round(book.discount_percent) }}%
          </span>
        </div>
        <div v-if="book.discount_percent > 0" class="text-muted text-decoration-line-through small" style="font-size: 12px;">
          {{ formatCurrency(book.price) }}
        </div>

        <!-- Thanh tiến độ đã bán từ CSDL -->
        <div class="progress position-relative rounded-pill mt-2 overflow-hidden" style="height: 16px; background-color: #ffebee;">
          <div 
            class="progress-bar rounded-pill" 
            role="progressbar" 
            :style="{ width: progressPercent + '%', backgroundColor: '#ef9a9a' }"
          ></div>
          <div 
            class="position-absolute top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center fw-bold"
            style="font-size: 10px; line-height: 1; color: #b71c1c;"
          >
            <span v-if="(book.total_sold || 0) > 0">Đã bán {{ book.total_sold }}</span>
            <span v-else class="text-secondary fw-normal">Vừa mở bán</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import { getBookCoverUrl } from '@/utils/imageHelper';

const props = defineProps({
  book: {
    type: Object,
    required: true
  }
});

const router = useRouter();

const isOutOfStock = computed(() => {
  return (props.book.inventory?.stock_quantity ?? 1) <= 0;
});

const coverUrl = computed(() => {
  return getBookCoverUrl(props.book.images, props.book.title);
});

const authorsText = computed(() => {
  if (!props.book.authors || props.book.authors.length === 0) return '';
  return props.book.authors.map(a => a.author_name).join(', ');
});

const progressPercent = computed(() => {
  const sold = Number(props.book.total_sold) || 0;
  if (sold <= 0) return 0;
  return Math.min(100, Math.max(15, (sold / 50) * 100));
});

function formatCurrency(val) {
  if (!val && val !== 0) return '0 đ';
  return Number(val).toLocaleString('vi-VN') + ' đ';
}

function goToDetail() {
  router.push(`/books/${props.book.book_id}`);
}
</script>

<style scoped>
.product-card {
  transition: all 0.2s ease-in-out;
}
.product-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 0.5rem 1rem rgba(0, 0, 0, 0.12) !important;
}
.product-card.out-of-stock .book-img {
  filter: grayscale(30%);
}
.cursor-pointer {
  cursor: pointer;
}
.text-truncate-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>
