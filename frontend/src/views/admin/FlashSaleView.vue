<template>
  <div class="container-fluid py-4">
    <div class="d-flex justify-content-between align-items-center mb-4 gap-3">
      <div>
        <h2 class="fw-bold mb-1">
          <i class="bi bi-lightning-charge text-primary me-2"></i>Flash Sale
        </h2>
        <p class="text-secondary mb-0">Quản lý chương trình, thời gian và giá ưu đãi của sách.</p>
      </div>
      <button v-if="!editing" class="btn btn-primary text-nowrap" @click="create">
        <i class="bi bi-plus-lg me-2"></i>Tạo chương trình
      </button>
    </div>
    <div v-if="error" class="alert alert-danger" role="alert">{{ error }}</div>
    <div v-if="message" class="alert alert-success" role="status">{{ message }}</div>
    <form v-if="editing" @submit.prevent="save">
      <fieldset :disabled="busy">
        <div class="card border-0 shadow-sm mb-4">
          <div class="card-header bg-white py-3">
            <h5 class="mb-0 text-primary">Thông tin chương trình</h5>
          </div>
          <div class="card-body">
            <div v-if="!editable" class="alert alert-info">
              Chương trình này chỉ được xem thông tin.
            </div>
            <div class="row g-3">
              <div class="col-12">
                <label for="saleName" class="form-label"
                  >Tên chương trình <span class="text-danger">*</span></label
                ><input
                  id="saleName"
                  v-model.trim="form.name"
                  class="form-control"
                  maxlength="150"
                  required
                  :readonly="!editable"
                />
              </div>
              <div class="col-md-6">
                <label for="saleStart" class="form-label"
                  >Bắt đầu (giờ Việt Nam) <span class="text-danger">*</span></label
                ><input
                  id="saleStart"
                  v-model="form.start_at"
                  type="datetime-local"
                  class="form-control"
                  required
                  :readonly="!editable"
                />
              </div>
              <div class="col-md-6">
                <label for="saleEnd" class="form-label"
                  >Kết thúc (giờ Việt Nam) <span class="text-danger">*</span></label
                ><input
                  id="saleEnd"
                  v-model="form.end_at"
                  type="datetime-local"
                  class="form-control"
                  required
                  :readonly="!editable"
                />
                <div class="form-text">Các chương trình đã bật không được trùng thời gian.</div>
              </div>
            </div>
          </div>
        </div>
        <div class="card border-0 shadow-sm mb-4">
          <div class="card-header bg-white d-flex justify-content-between align-items-center py-3">
            <h5 class="mb-0 text-primary">Sách tham gia ({{ form.items.length }})</h5>
            <button
              v-if="editable"
              type="button"
              class="btn btn-outline-primary btn-sm"
              @click="openPicker"
            >
              Chọn sách
            </button>
          </div>
          <div class="card-body">
            <p v-if="!form.items.length" class="text-secondary text-center py-3 mb-0">
              Chưa chọn sách. Thêm sách và nhập giá Flash Sale trước khi bật chương trình.
            </p>
            <div v-else class="table-responsive">
              <table class="table align-middle">
                <thead>
                  <tr>
                    <th>Sách</th>
                    <th>Giá thường</th>
                    <th>Giá Flash Sale</th>
                    <th class="text-nowrap">So với giá thường</th>
                    <th class="text-nowrap">So với giá bìa</th>
                    <th>Tồn kho</th>
                    <th v-if="editable">Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="(item, index) in form.items" :key="item.book_id">
                    <td>
                      <div class="d-flex align-items-center gap-3">
                        <img
                          :src="bookCover(item.book)"
                          :alt="item.book.title"
                          class="rounded shadow-sm border book-thumb"
                        />
                        <div>
                          <strong>{{ item.book.title }}</strong>
                          <div class="small text-secondary">{{ item.book.isbn }}</div>
                          <span v-if="!item.book.is_active" class="badge text-bg-warning"
                            >Đã ngừng bán</span
                          >
                        </div>
                      </div>
                    </td>
                    <td class="text-nowrap">
                      <div class="fw-semibold">{{ money(regular(item.book)) }}</div>
                      <div
                        v-if="regular(item.book) < Number(item.book.price)"
                        class="small text-secondary"
                      >
                        <s>{{ money(item.book.price) }}</s>
                        <span class="badge text-bg-light border ms-1"
                          >-{{ Number(item.book.discount_percent) }}%</span
                        >
                      </div>
                    </td>
                    <td class="flash-price-cell">
                      <div class="input-group has-validation">
                        <input
                          v-model.number="item.sale_price"
                          :aria-label="'Giá Flash Sale: ' + item.book.title"
                          class="form-control"
                          :class="{ 'is-invalid': invalidPrice(item) }"
                          type="number"
                          min="1"
                          :max="regular(item.book) - 1"
                          step="1"
                          required
                          :readonly="!editable"
                          placeholder="0"
                        />
                        <span class="input-group-text">đ</span>
                        <div class="invalid-feedback">
                          Giá phải lớn hơn 0 và thấp hơn {{ money(regular(item.book)) }}.
                        </div>
                      </div>
                      <div v-if="!invalidPrice(item)" class="mt-1">
                        <span class="fw-bold text-danger fs-6">{{ money(item.sale_price) }}</span>
                        <span class="small text-success ms-1"
                          >(rẻ hơn {{ money(regular(item.book) - item.sale_price) }})</span
                        >
                      </div>
                    </td>
                    <td>
                      <span
                        v-if="!invalidPrice(item)"
                        class="badge rounded-pill text-bg-danger fs-6 fw-semibold"
                        >-{{ discountPercent(item.sale_price, regular(item.book)) }}%</span
                      >
                      <span v-else class="text-secondary">—</span>
                    </td>
                    <td>
                      <span
                        v-if="!invalidPrice(item)"
                        class="badge rounded-pill text-bg-warning fs-6 fw-semibold"
                        >-{{ discountPercent(item.sale_price, item.book.price) }}%</span
                      >
                      <span v-else class="text-secondary">—</span>
                    </td>
                    <td>
                      <span
                        :class="
                          Number(item.book.inventory?.stock_quantity) > 0
                            ? ''
                            : 'text-warning-emphasis'
                        "
                        >{{ item.book.inventory?.stock_quantity || 0 }}</span
                      >
                      <div
                        v-if="!Number(item.book.inventory?.stock_quantity)"
                        class="small text-warning-emphasis"
                      >
                        Đang hết hàng
                      </div>
                    </td>
                    <td v-if="editable">
                      <div class="btn-group">
                        <button
                          type="button"
                          class="btn btn-sm btn-outline-secondary"
                          :disabled="index === 0"
                          aria-label="Đưa sách lên"
                          @click="move(index, -1)"
                        >
                          <i class="bi bi-arrow-up"></i></button
                        ><button
                          type="button"
                          class="btn btn-sm btn-outline-secondary"
                          :disabled="index === form.items.length - 1"
                          aria-label="Đưa sách xuống"
                          @click="move(index, 1)"
                        >
                          <i class="bi bi-arrow-down"></i></button
                        ><button
                          type="button"
                          class="btn btn-sm btn-outline-danger"
                          aria-label="Bỏ sách"
                          @click="form.items.splice(index, 1)"
                        >
                          <i class="bi bi-trash"></i>
                        </button>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
        <div class="d-flex gap-2">
          <button v-if="editable" type="submit" class="btn btn-primary">
            {{ busy ? 'Đang lưu...' : 'Lưu chương trình' }}</button
          ><button type="button" class="btn btn-outline-secondary" @click="editing = false">
            Về danh sách
          </button>
        </div>
      </fieldset>
    </form>
    <div v-else class="card border-0 shadow-sm">
      <div v-if="loading" class="card-body text-center py-5" role="status">
        Đang tải chương trình...
      </div>
      <div v-else class="table-responsive">
        <table class="table table-hover align-middle mb-0">
          <thead class="table-light">
            <tr>
              <th class="ps-3">Chương trình</th>
              <th>Bắt đầu</th>
              <th>Kết thúc</th>
              <th>Trạng thái</th>
              <th>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="sale in sales" :key="sale.flash_sale_id">
              <td class="ps-3 fw-semibold">{{ sale.name }}</td>
              <td>{{ date(sale.start_at) }}</td>
              <td>{{ date(sale.end_at) }}</td>
              <td>
                <span
                  class="badge"
                  :class="
                    sale.display_status === 'active'
                      ? 'text-bg-success'
                      : sale.display_status === 'upcoming'
                        ? 'text-bg-primary'
                        : 'text-bg-secondary'
                  "
                  >{{ labels[sale.display_status] }}</span
                >
              </td>
              <td>
                <div class="d-flex gap-2 flex-wrap">
                  <button
                    class="btn btn-sm btn-outline-primary"
                    :disabled="busy"
                    @click="edit(sale.flash_sale_id)"
                  >
                    {{ ['draft', 'upcoming'].includes(sale.display_status) ? 'Sửa' : 'Xem' }}
                  </button>
                  <button
                    v-if="sale.display_status === 'draft'"
                    class="btn btn-sm btn-success"
                    :disabled="busy"
                    @click="ask(sale, 'publish')"
                  >
                    Bật
                  </button>
                  <button
                    v-if="sale.display_status === 'upcoming'"
                    class="btn btn-sm btn-outline-danger"
                    :disabled="busy"
                    @click="ask(sale, 'cancel')"
                  >
                    Hủy
                  </button>
                  <button
                    v-if="sale.display_status === 'active'"
                    class="btn btn-sm btn-outline-danger"
                    :disabled="busy"
                    @click="ask(sale, 'end')"
                  >
                    Kết thúc sớm
                  </button>
                  <button
                    v-if="sale.display_status === 'draft'"
                    class="btn btn-sm btn-outline-danger"
                    :disabled="busy"
                    @click="ask(sale, 'delete')"
                  >
                    Xóa nháp
                  </button>
                </div>
              </td>
            </tr>
            <tr v-if="!sales.length">
              <td colspan="5" class="text-center text-secondary py-5">
                Chưa có chương trình Flash Sale.
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div class="card-footer bg-white d-flex align-items-center justify-content-end gap-3">
        <button
          class="btn btn-outline-secondary btn-sm"
          :disabled="page <= 1 || loading"
          @click="load(page - 1)"
        >
          Trước</button
        ><span class="small">{{ page }}/{{ pages }}</span
        ><button
          class="btn btn-outline-secondary btn-sm"
          :disabled="page >= pages || loading"
          @click="load(page + 1)"
        >
          Sau
        </button>
      </div>
    </div>

    <div
      v-if="picker"
      class="modal d-block"
      tabindex="-1"
      role="dialog"
      aria-modal="true"
      aria-labelledby="pickerTitle"
      @keydown.esc="picker = false"
    >
      <div class="modal-dialog modal-xl modal-dialog-scrollable">
        <div class="modal-content">
          <div class="modal-header">
            <h5 id="pickerTitle" class="modal-title">Chọn sách tham gia</h5>
            <button
              type="button"
              class="btn-close"
              aria-label="Đóng"
              @click="picker = false"
            ></button>
          </div>
          <div class="modal-body">
            <form class="input-group mb-3" @submit.prevent="searchBooks(1)">
              <input
                ref="searchInput"
                v-model="search"
                class="form-control"
                placeholder="Tên sách hoặc ISBN"
                aria-label="Tìm sách"
              /><button class="btn btn-primary" :disabled="searching">Tìm kiếm</button>
            </form>
            <div v-if="pickerError" class="alert alert-danger">{{ pickerError }}</div>
            <p v-if="searching" role="status">Đang tìm sách...</p>
            <div v-else class="table-responsive">
              <table class="table align-middle">
                <thead>
                  <tr>
                    <th style="width: 72px">Ảnh</th>
                    <th>Tên sách</th>
                    <th>Giá thường</th>
                    <th>Tồn kho</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="book in candidates" :key="book.book_id">
                    <td>
                      <img
                        :src="bookCover(book)"
                        :alt="book.title"
                        class="rounded shadow-sm border book-thumb"
                      />
                    </td>
                    <td>
                      <div class="fw-semibold">{{ book.title }}</div>
                      <div class="small text-secondary">{{ book.isbn }}</div>
                      <span v-if="!book.is_active" class="badge text-bg-warning">Ngừng bán</span>
                    </td>
                    <td>
                      <div class="fw-semibold">{{ money(regular(book)) }}</div>
                      <div
                        v-if="regular(book) < Number(book.price)"
                        class="small text-secondary"
                      >
                        <s>{{ money(book.price) }}</s>
                        <span class="badge text-bg-light border ms-1"
                          >-{{ Number(book.discount_percent) }}%</span
                        >
                      </div>
                    </td>
                    <td>{{ book.inventory?.stock_quantity || 0 }}</td>
                    <td>
                      <button
                        type="button"
                        class="btn btn-outline-primary btn-sm"
                        :disabled="
                          !book.is_active ||
                          form.items.some((i) => i.book_id === book.book_id) ||
                          form.items.length >= 200 ||
                          regular(book) <= 1
                        "
                        @click="add(book)"
                      >
                        {{
                          form.items.some((i) => i.book_id === book.book_id) ? 'Đã chọn' : 'Thêm'
                        }}
                      </button>
                    </td>
                  </tr>
                  <tr v-if="!candidates.length">
                    <td colspan="5" class="text-center text-secondary">Không tìm thấy sách.</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
          <div class="modal-footer">
            <button
              class="btn btn-outline-secondary btn-sm"
              :disabled="bookPage <= 1 || searching"
              @click="searchBooks(bookPage - 1)"
            >
              Trước</button
            ><span>{{ bookPage }}/{{ bookPages }}</span
            ><button
              class="btn btn-outline-secondary btn-sm"
              :disabled="bookPage >= bookPages || searching"
              @click="searchBooks(bookPage + 1)"
            >
              Sau</button
            ><button class="btn btn-primary" @click="picker = false">
              Xong ({{ form.items.length }} sách)
            </button>
          </div>
        </div>
      </div>
    </div>
    <div v-if="picker" class="modal-backdrop show"></div>
    <div
      v-if="confirmation"
      class="modal d-block"
      tabindex="-1"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirmTitle"
      @keydown.esc="confirmation = null"
    >
      <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content">
          <div class="modal-header">
            <h5 id="confirmTitle" class="modal-title">{{ actionLabels[confirmation.action] }}</h5>
            <button
              class="btn-close"
              aria-label="Đóng"
              :disabled="busy"
              @click="confirmation = null"
            ></button>
          </div>
          <div class="modal-body">
            Bạn muốn {{ actionLabels[confirmation.action].toLowerCase() }} chương trình “{{
              confirmation.sale.name
            }}”?
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" :disabled="busy" @click="confirmation = null">
              Quay lại</button
            ><button class="btn btn-primary" :disabled="busy" @click="runAction">
              {{ busy ? 'Đang xử lý...' : 'Xác nhận' }}
            </button>
          </div>
        </div>
      </div>
    </div>
    <div v-if="confirmation" class="modal-backdrop show"></div>
  </div>
</template>
<script setup>
import { ref, computed, onMounted, nextTick, onBeforeUnmount } from 'vue'
import { flashSaleService } from '@/services/flashSaleService'
import { bookService } from '@/services/adminService'
const sales = ref([]),
  page = ref(1),
  pages = ref(1),
  loading = ref(false),
  busy = ref(false),
  error = ref(''),
  message = ref('')
const editing = ref(false),
  form = ref({ items: [] }),
  picker = ref(false),
  search = ref(''),
  candidates = ref([]),
  searching = ref(false),
  pickerError = ref('')
const bookPage = ref(1),
  bookPages = ref(1),
  searchInput = ref(null),
  confirmation = ref(null)
const labels = {
  draft: 'Bản nháp',
  upcoming: 'Sắp diễn ra',
  active: 'Đang diễn ra',
  ended: 'Đã kết thúc',
  cancelled: 'Đã hủy',
}
const actionLabels = { publish: 'Bật', cancel: 'Hủy', end: 'Kết thúc sớm', delete: 'Xóa nháp' }
const editable = computed(
  () => !form.value.flash_sale_id || ['draft', 'upcoming'].includes(form.value.display_status),
)
const regular = (b) => Math.round(Number(b.price) * (1 - Number(b.discount_percent || 0) / 100))
// Phần trăm giảm của giá Flash Sale so với một mốc giá (giá thường hoặc giá bìa).
const discountPercent = (salePrice, basePrice) => {
  const base = Number(basePrice)
  const sale = Number(salePrice)
  if (!(base > 0) || !Number.isFinite(sale)) return 0
  return Math.round((1 - sale / base) * 1000) / 10
}
const invalidPrice = (i) =>
  !Number.isSafeInteger(i.sale_price) || i.sale_price <= 0 || i.sale_price >= regular(i.book)
const money = (n) => Number(n || 0).toLocaleString('vi-VN') + ' đ'
const bookCover = (book) => {
  const images = book?.images
  if (!images || !images.length) return 'https://via.placeholder.com/150x200?text=No+Cover'
  const primary = images.find((img) => img.is_primary)
  const url = primary ? primary.image_url : images[0].image_url
  return url.startsWith('/uploads') ? `http://localhost:5000${url}` : url
}
const date = (v) => new Date(v).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })
function localDate(value) {
  const parts = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(value))
  return parts.replace(' ', 'T')
}
async function load(p = page.value) {
  loading.value = true
  error.value = ''
  try {
    const r = await flashSaleService.list({ page: p })
    sales.value = r.sales
    page.value = r.pagination.page
    pages.value = r.pagination.totalPages
  } catch (e) {
    error.value = e.response?.data?.message || 'Không thể tải chương trình.'
  } finally {
    loading.value = false
  }
}
function create() {
  error.value = ''
  message.value = ''
  form.value = { name: '', start_at: '', end_at: '', items: [] }
  editing.value = true
}
async function edit(id) {
  busy.value = true
  error.value = ''
  try {
    const r = await flashSaleService.detail(id)
    form.value = {
      ...r,
      start_at: localDate(r.start_at),
      end_at: localDate(r.end_at),
      items: r.items.map((i) => ({ ...i, sale_price: Number(i.sale_price) })),
    }
    editing.value = true
  } catch (e) {
    error.value = e.response?.data?.message || 'Không thể tải chương trình.'
  } finally {
    busy.value = false
  }
}
async function save() {
  error.value = ''
  message.value = ''
  if (form.value.end_at <= form.value.start_at) {
    error.value = 'Thời gian kết thúc phải sau thời gian bắt đầu.'
    return
  }
  if (form.value.items.some(invalidPrice)) {
    error.value = 'Kiểm tra lại giá Flash Sale của các sách.'
    return
  }
  busy.value = true
  try {
    await flashSaleService.save(form.value.flash_sale_id, {
      name: form.value.name,
      start_at: new Date(form.value.start_at + ':00+07:00').toISOString(),
      end_at: new Date(form.value.end_at + ':00+07:00').toISOString(),
      items: form.value.items.map((i) => ({ book_id: i.book_id, sale_price: i.sale_price })),
    })
    editing.value = false
    message.value = 'Đã lưu chương trình.'
    await load(1)
  } catch (e) {
    error.value = e.response?.data?.message || 'Không thể lưu chương trình.'
  } finally {
    busy.value = false
  }
}
function ask(sale, action) {
  error.value = ''
  confirmation.value = { sale, action }
}
async function runAction() {
  busy.value = true
  const c = confirmation.value
  try {
    if (c.action === 'delete') await flashSaleService.delete(c.sale.flash_sale_id)
    else await flashSaleService.action(c.sale.flash_sale_id, c.action)
    message.value = 'Đã cập nhật chương trình.'
    await load(1)
  } catch (e) {
    error.value = e.response?.data?.message || 'Không thể thực hiện thao tác.'
  } finally {
    busy.value = false
    confirmation.value = null
  }
}
let searchId = 0
async function searchBooks(p = 1) {
  const id = ++searchId
  searching.value = true
  pickerError.value = ''
  try {
    const r = await bookService.getAll({ search: search.value, page: p, limit: 10 })
    if (id !== searchId) return
    candidates.value = r.books || r.data || []
    bookPage.value = p
    bookPages.value = r.pagination?.totalPages || 1
  } catch (e) {
    if (id === searchId) pickerError.value = e.response?.data?.message || 'Không thể tìm sách.'
  } finally {
    if (id === searchId) searching.value = false
  }
}
async function openPicker() {
  picker.value = true
  await nextTick()
  searchInput.value?.focus()
  searchBooks(1)
}
function add(book) {
  if (form.value.items.some((i) => i.book_id === book.book_id)) return
  form.value.items.push({
    book_id: book.book_id,
    book,
    sale_price: Math.max(1, Math.floor(regular(book) * 0.9)),
  })
}
function move(i, delta) {
  const j = i + delta
  ;[form.value.items[i], form.value.items[j]] = [form.value.items[j], form.value.items[i]]
}
onMounted(() => load(1))
onBeforeUnmount(() => {
  searchId++
})
</script>

<style scoped>
.flash-price-cell {
  min-width: 200px;
}
.book-thumb {
  width: 48px;
  height: 64px;
  object-fit: cover;
  flex-shrink: 0;
}
</style>
