<template>
  <section
    v-if="loading || error || (spotlight && tabs.length)"
    class="spotlight bg-white rounded-4 shadow-sm overflow-hidden mb-4"
    :aria-label="spotlight?.title || 'Sách tuyển chọn'"
    :aria-busy="loading"
  >
    <div v-if="loading" class="p-5 text-center text-secondary" role="status">
      Đang tải sách tuyển chọn…
    </div>
    <div v-else-if="error" class="p-4 text-center" role="alert">
      <p>{{ error }}</p>
      <button class="btn btn-outline-danger btn-sm" @click="load">Thử lại</button>
    </div>
    <template v-else>
      <img
        v-if="spotlight.banner_url && !bannerFailed"
        :src="formatImageUrl(spotlight.banner_url)"
        :alt="spotlight.banner_alt || spotlight.title"
        class="spotlight-banner"
        @error="bannerFailed = true"
      />
      <div class="p-3 p-md-4">
        <div class="d-flex flex-wrap justify-content-between align-items-center gap-3 mb-4">
          <h4 class="fw-bold mb-0 text-danger">{{ spotlight.title }}</h4>
          <div
            v-if="tabs.length > 1"
            class="spotlight-tabs d-flex gap-2"
            role="group"
            aria-label="Chọn nhóm sách"
          >
            <button
              v-for="tab in tabs"
              :key="tab.key"
              type="button"
              class="btn btn-sm rounded-pill text-nowrap"
              :class="selectedKey === tab.key ? 'btn-danger' : 'btn-outline-secondary'"
              :aria-pressed="selectedKey === tab.key"
              @click="selectedKey = tab.key"
            >
              {{ tab.label }}
            </button>
          </div>
        </div>
        <div class="spotlight-grid">
          <RouterLink
            v-for="book in currentTab?.books || []"
            :key="book.book_id"
            :to="'/books/' + book.book_id"
            class="spotlight-book border rounded-3 text-decoration-none text-dark p-3 d-flex flex-column"
          >
            <div class="position-relative mb-3">
              <img
                v-if="book.images?.length && !failedImages[book.book_id]"
                :src="getBookCoverUrl(book.images, book.title)"
                :alt="book.title"
                class="book-cover"
                loading="lazy"
                @error="failedImages[book.book_id] = true"
              />
              <div v-else class="book-cover cover-fallback">
                <i class="bi bi-book fs-1" aria-hidden="true"></i>
              </div>
              <span
                v-if="!Number(book.inventory?.stock_quantity)"
                class="badge bg-secondary position-absolute bottom-0 start-0"
                >Hết hàng</span
              >
            </div>
            <div class="d-flex gap-1 flex-wrap mb-2">
              <span
                v-for="tag in (book.tags || []).slice(0, 2)"
                :key="tag.tag_id"
                class="badge"
                :style="{ backgroundColor: tag.color }"
                >{{ tag.tag_name }}</span
              >
            </div>
            <h6 class="book-title" :title="book.title">{{ book.title }}</h6>
            <div class="mt-auto">
              <div class="d-flex flex-wrap align-items-center gap-2">
                <strong class="text-danger">{{ money(book.final_price) }}</strong
                ><span v-if="discount(book) > 0" class="badge bg-danger"
                  >-{{ Math.round(discount(book)) }}%</span
                >
              </div>
              <small
                v-if="discount(book) > 0"
                class="text-secondary text-decoration-line-through"
                >{{ money(book.price) }}</small
              >
              <div class="small text-secondary mt-2">
                Đã bán <strong class="text-dark">{{ book.total_sold || 0 }}</strong>
              </div>
            </div>
          </RouterLink>
        </div>
        <div v-if="currentTab?.category_id" class="text-end mt-3">
          <RouterLink
            :to="{ path: '/books', query: { category_id: currentTab.category_id } }"
            class="text-danger fw-semibold text-decoration-none"
            >Xem tất cả <i class="bi bi-chevron-right" aria-hidden="true"></i
          ></RouterLink>
        </div>
      </div>
    </template>
  </section>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { siteConfigService } from '@/services/siteConfigService'
import { formatImageUrl, getBookCoverUrl } from '@/utils/imageHelper'

const props = defineProps({ config: { type: Object, default: undefined } })
const loaded = ref(null)
const loading = ref(false)
const error = ref('')
const bannerFailed = ref(false)
const failedImages = ref({})
const selectedKey = ref('')
const spotlight = computed(() => (props.config === undefined ? loaded.value : props.config))
const tabs = computed(() => {
  const data = spotlight.value
  if (!data) return []
  const result = data.manual_books?.length
    ? [{ key: 'manual', label: data.manual_tab_label, books: data.manual_books }]
    : []
  for (const category of data.categories || []) {
    if (category.books?.length)
      result.push({
        key: String(category.category_id),
        label: category.category_name,
        category_id: category.category_id,
        books: category.books,
      })
  }
  return result
})
const currentTab = computed(
  () => tabs.value.find((tab) => tab.key === selectedKey.value) || tabs.value[0],
)
watch(spotlight, () => {
  bannerFailed.value = false
  failedImages.value = {}
  selectedKey.value = ''
})
watch(
  tabs,
  (value) => {
    if (!value.some((tab) => tab.key === selectedKey.value)) selectedKey.value = value[0]?.key || ''
  },
  { immediate: true },
)
async function load() {
  loading.value = true
  error.value = ''
  try {
    loaded.value = await siteConfigService.getSpotlight()
  } catch {
    error.value = 'Không thể tải sách tuyển chọn. Vui lòng thử lại.'
  } finally {
    loading.value = false
  }
}
const money = (value) => Number(value || 0).toLocaleString('vi-VN') + ' đ'
const discount = (book) => Number(book.effective_discount_percent ?? book.discount_percent ?? 0)
onMounted(() => {
  if (props.config === undefined) load()
})
</script>

<style scoped>
.spotlight-banner {
  display: block;
  width: 100%;
  height: auto;
}
.spotlight-tabs {
  max-width: 100%;
  overflow-x: auto;
  padding-bottom: 4px;
}
.spotlight-grid {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 16px;
}
.spotlight-book {
  transition: box-shadow 0.2s;
}
.spotlight-book:hover {
  box-shadow: 0 4px 16px #0002;
}
.spotlight-book:focus-visible {
  outline: 2px solid #c92127;
  outline-offset: 3px;
}
.book-cover {
  width: 100%;
  height: 190px;
  object-fit: contain;
}
.cover-fallback {
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f8f9fa;
  color: #999;
}
.book-title {
  font-size: 14px;
  line-height: 1.5;
  height: 42px;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
@media (max-width: 991px) {
  .spotlight-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}
@media (max-width: 575px) {
  .spotlight-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px;
  }
  .book-cover {
    height: 150px;
  }
}
</style>
