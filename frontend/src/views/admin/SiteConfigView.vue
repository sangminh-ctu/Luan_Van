<template>
  <div>
    <div class="d-flex flex-wrap justify-content-between align-items-center gap-3 mb-4">
      <div>
        <h2 class="fw-bold">Cấu hình trang chủ</h2>
        <p class="text-secondary mb-0">
          Quản lý khối sách tuyển chọn và các tab danh mục trên trang chủ.
        </p>
      </div>
      <div class="d-flex gap-2">
        <button
          class="btn btn-outline-primary"
          :disabled="busy || loading || loadFailed"
          @click="showPreview"
        >
          Xem trước</button
        ><button class="btn btn-primary" :disabled="busy || loading || loadFailed" @click="save">
          {{ saving ? 'Đang lưu…' : 'Lưu thay đổi' }}
        </button>
      </div>
    </div>
    <div
      v-if="message"
      class="alert"
      :class="messageError ? 'alert-danger' : 'alert-success'"
      role="status"
    >
      {{ message }}
    </div>
    <div v-if="loading" class="p-5 text-center" role="status">Đang tải cấu hình…</div>
    <div v-else-if="loadFailed" class="alert alert-danger">
      Không thể tải cấu hình.
      <button class="btn btn-outline-danger btn-sm" @click="load">Thử lại</button>
    </div>
    <template v-else>
      <fieldset :disabled="busy" class="border-0 p-0 m-0">
        <div class="card border-0 shadow-sm rounded-4 p-4 mb-4">
          <div class="d-flex justify-content-between mb-3">
            <h5 class="fw-bold">Banner và tiêu đề</h5>
            <div class="form-check form-switch">
              <input
                id="spotlight-active"
                v-model="form.is_active"
                type="checkbox"
                class="form-check-input"
              /><label for="spotlight-active" class="form-check-label"
                >Hiển thị trên trang chủ</label
              >
            </div>
          </div>
          <label for="spotlight-title" class="form-label">Tiêu đề chuyên đề</label
          ><input
            id="spotlight-title"
            v-model="form.title"
            class="form-control mb-3"
            maxlength="150"
            required
            placeholder="THÁNG 11 ĐỌC GÌ?"
          />
          <label for="spotlight-banner" class="form-label">Banner</label
          ><input
            id="spotlight-banner"
            ref="fileInput"
            class="form-control"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            @change="uploadBanner"
          />
          <p class="small text-secondary mt-2">
            JPG, PNG, WebP, tối đa 5 MB. Nên dùng ảnh ngang khoảng 1920 × 600; ảnh sẽ được giữ
            nguyên tỉ lệ.
          </p>
          <div v-if="form.banner_url" class="mb-3">
            <img
              :src="formatImageUrl(form.banner_url)"
              alt="Xem trước banner"
              class="w-100 rounded border"
            /><button class="btn btn-sm btn-outline-danger mt-2" @click="form.banner_url = null">
              Bỏ banner
            </button>
          </div>
          <label for="spotlight-alt" class="form-label">Mô tả ảnh</label
          ><input
            id="spotlight-alt"
            v-model="form.banner_alt"
            class="form-control"
            maxlength="200"
          />
        </div>
        <div class="card border-0 shadow-sm rounded-4 p-4 mb-4">
          <div class="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
            <h5 class="fw-bold mb-0">Sách chọn thủ công ({{ selectedBooks.length }}/10)</h5>
            <button
              class="btn btn-outline-primary"
              :disabled="selectedBooks.length >= 10"
              @click="openPicker"
            >
              + Chọn sách thủ công
            </button>
          </div>
          <label for="manual-label" class="form-label">Tên tab tuyển chọn</label
          ><input
            id="manual-label"
            v-model="form.manual_tab_label"
            class="form-control mb-3"
            maxlength="80"
            required
          />
          <p v-if="!selectedBooks.length" class="text-secondary">
            Chưa chọn sách. Nếu chỉ chọn danh mục, khối sẽ mở tab danh mục đầu tiên có sách.
          </p>
          <div v-else class="table-responsive">
            <table class="table align-middle">
              <thead>
                <tr>
                  <th>Sách</th>
                  <th>Trạng thái</th>
                  <th class="text-end">Thứ tự</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(book, index) in selectedBooks" :key="book.book_id">
                  <td>
                    <div class="d-flex align-items-center gap-2">
                      <img
                        v-if="book.images?.length"
                        :src="getBookCoverUrl(book.images, book.title)"
                        :alt="book.title"
                        class="picker-cover"
                      />
                      <div>
                        <strong>{{ book.title }}</strong>
                        <div class="small text-secondary">ISBN: {{ book.isbn || '—' }}</div>
                      </div>
                    </div>
                  </td>
                  <td>
                    <span :class="book.is_active ? 'text-success' : 'text-danger'">{{
                      book.is_active ? 'Đang hiển thị' : 'Đang ẩn – không hiện cho khách'
                    }}</span>
                  </td>
                  <td>
                    <div class="d-flex justify-content-end gap-1">
                      <button
                        class="btn btn-sm btn-light"
                        :disabled="index === 0"
                        :aria-label="'Đưa lên: ' + book.title"
                        @click="move(selectedBooks, index, -1)"
                      >
                        ↑</button
                      ><button
                        class="btn btn-sm btn-light"
                        :disabled="index === selectedBooks.length - 1"
                        :aria-label="'Đưa xuống: ' + book.title"
                        @click="move(selectedBooks, index, 1)"
                      >
                        ↓</button
                      ><button
                        class="btn btn-sm btn-outline-danger"
                        :aria-label="'Bỏ: ' + book.title"
                        @click="selectedBooks.splice(index, 1)"
                      >
                        Bỏ
                      </button>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
        <div class="card border-0 shadow-sm rounded-4 p-4 mb-4">
          <h5 class="fw-bold">Các tab danh mục ({{ form.category_ids.length }}/6)</h5>
          <p class="text-secondary small">
            Mỗi tab tự lấy tối đa 10 sách mới nhất của danh mục và các danh mục con. Sách trong tab
            này có thể nằm ngoài chủ đề tuyển chọn.
          </p>
          <label for="category-search" class="visually-hidden">Tìm danh mục</label
          ><input
            id="category-search"
            v-model="categorySearch"
            class="form-control mb-3"
            placeholder="Tìm danh mục…"
          />
          <div class="d-flex gap-2 flex-wrap mb-3">
            <button
              v-for="category in filteredCategories"
              :key="category.category_id"
              class="btn btn-sm rounded-pill"
              :class="
                form.category_ids.includes(category.category_id)
                  ? 'btn-primary'
                  : 'btn-outline-secondary'
              "
              :aria-pressed="form.category_ids.includes(category.category_id)"
              :disabled="
                !form.category_ids.includes(category.category_id) && form.category_ids.length >= 6
              "
              @click="toggleCategory(category.category_id)"
            >
              {{ categoryName(category) }}
            </button>
          </div>
          <div
            v-for="(id, index) in form.category_ids"
            :key="id"
            class="d-flex justify-content-between align-items-center border-top py-2 gap-2"
          >
            <span
              >{{ index + 1 }}.
              {{ categories.find((c) => c.category_id === id)?.category_name }}</span
            >
            <div class="d-flex gap-1">
              <button
                class="btn btn-sm btn-light"
                :disabled="index === 0"
                aria-label="Đưa danh mục lên"
                @click="move(form.category_ids, index, -1)"
              >
                ↑</button
              ><button
                class="btn btn-sm btn-light"
                :disabled="index === form.category_ids.length - 1"
                aria-label="Đưa danh mục xuống"
                @click="move(form.category_ids, index, 1)"
              >
                ↓</button
              ><button class="btn btn-sm btn-outline-danger" @click="toggleCategory(id)">Bỏ</button>
            </div>
          </div>
        </div>
      </fieldset>
      <section v-if="preview" class="mb-4" aria-label="Xem trước cấu hình">
        <h5 class="fw-bold">Xem trước {{ dirty ? '(có thay đổi chưa lưu)' : '' }}</h5>
        <p v-if="previewStale" class="alert alert-warning">
          Cấu hình đã thay đổi. Bấm “Xem trước” để cập nhật.
        </p>
        <p v-if="!form.is_active" class="text-secondary">
          Khối đang tắt. Bản xem trước vẫn được hiển thị để kiểm tra.
        </p>
        <p
          v-if="!preview.manual_books.length && !preview.categories.some((c) => c.books.length)"
          class="alert alert-warning"
        >
          Không có sách hợp lệ, khối sẽ được ẩn trên trang chủ.
        </p>
        <p
          v-for="category in preview.categories.filter((c) => !c.books.length)"
          :key="category.category_id"
          class="alert alert-warning"
        >
          Danh mục “{{ category.category_name }}” chưa có sách đang hiển thị; tab này sẽ được ẩn.
        </p>
        <HomeSpotlightSection :config="preview" />
      </section>
    </template>

    <div v-if="pickerOpen" class="modal-backdrop-custom" @click.self="closePicker">
      <div
        ref="pickerDialog"
        class="picker-dialog bg-white rounded-4 shadow p-4"
        role="dialog"
        aria-modal="true"
        aria-labelledby="picker-title"
        tabindex="-1"
        @keydown.esc="closePicker"
        @keydown.tab="trapFocus"
      >
        <div class="d-flex justify-content-between align-items-center mb-3">
          <h5 id="picker-title" class="fw-bold mb-0">Chọn sách ({{ selectedBooks.length }}/10)</h5>
          <button class="btn-close" aria-label="Đóng" @click="closePicker"></button>
        </div>
        <form class="d-flex gap-2 mb-3" @submit.prevent="searchBooks(1)">
          <label for="book-search" class="visually-hidden">Tên sách hoặc ISBN</label
          ><input
            id="book-search"
            ref="searchInput"
            v-model="search"
            class="form-control"
            placeholder="Tìm theo tên sách hoặc ISBN"
          /><button class="btn btn-primary" :disabled="searchLoading">Tìm</button>
        </form>
        <p v-if="pickerError" class="alert alert-danger" role="alert">{{ pickerError }}</p>
        <div v-if="searchLoading" class="py-4 text-center" role="status">Đang tìm sách…</div>
        <template v-else
          ><p v-if="!searchResults.length" class="text-secondary">Không tìm thấy sách phù hợp.</p>
          <div
            v-for="book in searchResults"
            :key="book.book_id"
            class="d-flex gap-3 align-items-center border-bottom py-2"
          >
            <img
              v-if="book.images?.length"
              :src="getBookCoverUrl(book.images, book.title)"
              :alt="book.title"
              class="picker-cover"
            />
            <div class="flex-grow-1">
              <strong>{{ book.title }}</strong>
              <div class="small text-secondary">ISBN: {{ book.isbn || '—' }}</div>
              <div class="small">
                <span class="text-danger fw-bold">{{ money(book.final_price) }}</span> · Tồn:
                {{ book.inventory?.stock_quantity || 0 }}
              </div>
            </div>
            <button
              class="btn btn-sm btn-outline-primary"
              :disabled="
                selectedBooks.length >= 10 || selectedBooks.some((b) => b.book_id === book.book_id)
              "
              @click="selectBook(book)"
            >
              {{ selectedBooks.some((b) => b.book_id === book.book_id) ? 'Đã chọn' : 'Chọn' }}
            </button>
          </div></template
        >
        <div class="d-flex justify-content-between align-items-center mt-3">
          <button
            class="btn btn-sm btn-outline-secondary"
            :disabled="searchPage <= 1 || searchLoading"
            @click="searchBooks(searchPage - 1)"
          >
            Trước</button
          ><small>Trang {{ searchPage }} / {{ searchPages }}</small
          ><button
            class="btn btn-sm btn-outline-secondary"
            :disabled="searchPage >= searchPages || searchLoading"
            @click="searchBooks(searchPage + 1)"
          >
            Sau
          </button>
        </div>
        <div class="text-end mt-3">
          <button class="btn btn-primary" @click="closePicker">Xong</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { onBeforeRouteLeave } from 'vue-router'
import { siteConfigService } from '@/services/siteConfigService'
import { categoryService } from '@/services/adminService'
import { publicBookService } from '@/services/bookService'
import { formatImageUrl, getBookCoverUrl } from '@/utils/imageHelper'
import HomeSpotlightSection from '@/components/customer/HomeSpotlightSection.vue'

const form = reactive({
  title: '',
  banner_url: null,
  banner_alt: '',
  manual_tab_label: 'Tuyển chọn',
  is_active: false,
  category_ids: [],
})
const selectedBooks = ref([]),
  categories = ref([]),
  categorySearch = ref('')
const loading = ref(true),
  loadFailed = ref(false),
  saving = ref(false),
  uploading = ref(false),
  previewLoading = ref(false)
const message = ref(''),
  messageError = ref(false),
  baseline = ref(''),
  preview = ref(null),
  previewSnapshot = ref('')
const fileInput = ref(null),
  pickerOpen = ref(false),
  searchInput = ref(null),
  pickerDialog = ref(null)
const search = ref(''),
  searchResults = ref([]),
  searchLoading = ref(false),
  pickerError = ref(''),
  searchPage = ref(1),
  searchPages = ref(1)
let searchRequest = 0,
  previousFocus
const busy = computed(() => saving.value || uploading.value || previewLoading.value)
const payload = () => ({
  ...form,
  category_ids: [...form.category_ids],
  book_ids: selectedBooks.value.map((book) => book.book_id),
})
const snapshot = computed(() => JSON.stringify(payload()))
const dirty = computed(() => !!baseline.value && snapshot.value !== baseline.value)
const previewStale = computed(() => !!preview.value && snapshot.value !== previewSnapshot.value)
const categoryName = (category) => {
  const parent = categories.value.find((c) => c.category_id === category.parent_category_id)
  return parent ? `${parent.category_name} / ${category.category_name}` : category.category_name
}
const filteredCategories = computed(() =>
  categories.value.filter((category) =>
    categoryName(category)
      .toLocaleLowerCase('vi')
      .includes(categorySearch.value.toLocaleLowerCase('vi')),
  ),
)
function notify(text, error = false) {
  message.value = text
  messageError.value = error
}
function apply(data) {
  for (const key of Object.keys(form)) form[key] = data[key]
  selectedBooks.value = data.books
  baseline.value = snapshot.value
}
async function load() {
  loading.value = true
  loadFailed.value = false
  try {
    const [data, list] = await Promise.all([siteConfigService.get(), categoryService.getAll()])
    categories.value = list
    apply(data)
  } catch (error) {
    loadFailed.value = true
    notify(error.response?.data?.message || 'Không thể tải cấu hình.', true)
  } finally {
    loading.value = false
  }
}
async function save() {
  saving.value = true
  try {
    apply(await siteConfigService.save(payload()))
    notify('Đã lưu cấu hình trang chủ.')
  } catch (error) {
    notify(error.response?.data?.message || 'Không thể lưu cấu hình.', true)
  } finally {
    saving.value = false
  }
}
async function showPreview() {
  previewLoading.value = true
  const data = payload()
  try {
    preview.value = await siteConfigService.preview(data)
    previewSnapshot.value = JSON.stringify(data)
    notify('Đã cập nhật bản xem trước.')
  } catch (error) {
    notify(error.response?.data?.message || 'Không thể xem trước.', true)
  } finally {
    previewLoading.value = false
  }
}
async function uploadBanner(event) {
  const file = event.target.files?.[0]
  if (!file) return
  if (
    !['image/jpeg', 'image/png', 'image/webp'].includes(file.type) ||
    file.size > 5 * 1024 * 1024
  ) {
    notify('Chọn ảnh JPG, PNG hoặc WebP tối đa 5 MB.', true)
    event.target.value = ''
    return
  }
  uploading.value = true
  try {
    form.banner_url = (await siteConfigService.uploadBanner(file)).banner_url
    notify('Đã tải banner. Bấm Lưu thay đổi để áp dụng.')
  } catch (error) {
    notify(error.response?.data?.message || 'Không thể tải ảnh.', true)
  } finally {
    uploading.value = false
    if (fileInput.value) fileInput.value.value = ''
  }
}
function move(list, index, offset) {
  const target = index + offset
  if (target >= 0 && target < list.length) [list[index], list[target]] = [list[target], list[index]]
}
function toggleCategory(id) {
  const index = form.category_ids.indexOf(id)
  if (index >= 0) form.category_ids.splice(index, 1)
  else if (form.category_ids.length < 6) form.category_ids.push(id)
}
async function openPicker() {
  previousFocus = document.activeElement
  pickerOpen.value = true
  search.value = ''
  await nextTick()
  searchInput.value?.focus()
  searchBooks(1)
}
function closePicker() {
  pickerOpen.value = false
  searchRequest++
  previousFocus?.focus()
}
function trapFocus(event) {
  const elements = [
    ...pickerDialog.value.querySelectorAll(
      'button:not(:disabled), input:not(:disabled), [tabindex="0"]',
    ),
  ]
  const first = elements[0],
    last = elements[elements.length - 1]
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault()
    last?.focus()
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault()
    first?.focus()
  }
}
async function searchBooks(page) {
  const request = ++searchRequest
  searchLoading.value = true
  pickerError.value = ''
  try {
    const data = await publicBookService.getBooks({ search: search.value, page, limit: 10 })
    if (request !== searchRequest) return
    searchResults.value = data.books
    searchPage.value = data.pagination.page
    searchPages.value = data.pagination.totalPages
  } catch {
    if (request === searchRequest) {
      searchResults.value = []
      pickerError.value = 'Không thể tìm sách. Vui lòng thử lại.'
    }
  } finally {
    if (request === searchRequest) searchLoading.value = false
  }
}
function selectBook(book) {
  if (
    selectedBooks.value.length < 10 &&
    !selectedBooks.value.some((b) => b.book_id === book.book_id)
  )
    selectedBooks.value.push({ ...book, is_active: true })
}
const money = (value) => Number(value || 0).toLocaleString('vi-VN') + ' đ'
function beforeUnload(event) {
  if (dirty.value || busy.value) {
    event.preventDefault()
    event.returnValue = ''
  }
}
onBeforeRouteLeave(() => {
  if (busy.value) {
    notify('Vui lòng đợi thao tác hiện tại hoàn tất.', true)
    return false
  }
  if (dirty.value) return window.confirm('Bạn có thay đổi chưa lưu. Rời trang và bỏ các thay đổi?')
})
onMounted(() => {
  load()
  window.addEventListener('beforeunload', beforeUnload)
})
onBeforeUnmount(() => {
  searchRequest++
  window.removeEventListener('beforeunload', beforeUnload)
})
</script>

<style scoped>
.picker-cover {
  width: 42px;
  height: 58px;
  object-fit: contain;
}
.modal-backdrop-custom {
  position: fixed;
  inset: 0;
  background: #0008;
  z-index: 1060;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}
.picker-dialog {
  width: min(800px, 100%);
  max-height: 90vh;
  overflow-y: auto;
}
</style>
