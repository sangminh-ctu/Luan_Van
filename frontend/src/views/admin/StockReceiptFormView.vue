<template>
  <div class="container-fluid py-2">
    <!-- Nút quay lại & Tiêu đề -->
    <div class="d-flex align-items-center mb-4">
      <router-link to="/admin/stock-receipts" class="btn btn-light me-3 shadow-sm rounded-circle p-2 d-flex align-items-center justify-content-center" style="width: 40px; height: 40px;">
        <i class="bi bi-arrow-left fs-5"></i>
      </router-link>
      <div>
        <h4 class="fw-bold text-dark mb-0">Lập Phiếu Nhập / Xuất Kho</h4>
        <small class="text-muted">Tạo chứng từ biến động kho và hỗ trợ hoàn tất cập nhật số lượng tồn ngay lập tức</small>
      </div>
    </div>

    <!-- Thông báo lỗi -->
    <div v-if="alertMsg" class="alert alert-danger alert-dismissible fade show shadow-sm" role="alert">
      {{ alertMsg }}
      <button type="button" class="btn-close" @click="alertMsg = ''"></button>
    </div>

    <form @submit.prevent="handleSubmit(false)">
      <div class="row g-4">
        
        <!-- CỘT TRÁI: Danh sách hàng hóa trong phiếu -->
        <div class="col-lg-8">
          <div class="card border-0 shadow-sm rounded-4 mb-4">
            <div class="card-header bg-white border-bottom-0 pt-4 px-4 pb-0 d-flex justify-content-between align-items-center">
              <div>
                <h5 class="fw-bold mb-0 text-primary"><i class="bi bi-box-seam me-2"></i>Danh sách sách trong phiếu <span class="text-danger">*</span></h5>
                <small class="text-muted" style="font-size: 11px;">Gõ tên sách hoặc mã ISBN để tìm kiếm và chọn nhanh</small>
              </div>
              <button type="button" class="btn btn-sm btn-outline-primary" @click="addBookRow">
                <i class="bi bi-plus me-1"></i>Thêm dòng
              </button>
            </div>

            <div class="card-body p-4">
              <div v-if="form.details.length === 0" class="text-center py-4 text-muted small border rounded-3 bg-light">
                Chưa có cuốn sách nào trong phiếu. Hãy bấm "Thêm dòng" ở trên.
              </div>

              <div 
                v-for="(item, index) in form.details" 
                :key="index" 
                class="p-3 mb-3 rounded-3 bg-light border"
              >
                <!-- Hàng điều khiển chính: Tất cả ô nhập và nút xóa thẳng hàng tăm tắp -->
                <div class="row g-2 align-items-start">
                  <!-- Cột Tìm kiếm & Chọn Sách -->
                  <div :class="form.type === 'import' ? 'col-md-5' : 'col-md-7'" class="position-relative">
                    <label class="form-label small fw-bold text-secondary mb-1">Cuốn sách <span class="text-danger">*</span></label>
                    <div class="input-group">
                      <span class="input-group-text bg-white border-end-0 text-muted"><i class="bi bi-search"></i></span>
                      <input 
                        type="text" 
                        class="form-control border-start-0 shadow-none bg-white" 
                        v-model="item.searchKeyword"
                        placeholder="Tìm tên hoặc ISBN..."
                        @focus="item.showDropdown = true"
                        @input="item.showDropdown = true"
                      >
                      <button 
                        v-if="item.book_id" 
                        class="btn btn-outline-secondary" 
                        type="button" 
                        @click="clearBookSelection(item)"
                        title="Chọn lại"
                      >
                        <i class="bi bi-x-circle"></i>
                      </button>
                    </div>

                    <!-- Dropdown danh sách sách gợi ý -->
                    <div 
                      v-if="item.showDropdown" 
                      class="position-absolute bg-white shadow-lg border rounded-3 w-100 mt-1 py-1 overflow-auto" 
                      style="max-height: 220px; z-index: 1050; top: 100%; left: 0;"
                    >
                      <div 
                        v-for="b in filterBooks(item.searchKeyword)" 
                        :key="b.book_id"
                        class="px-3 py-2 cursor-pointer dropdown-item-book border-bottom"
                        @click="selectBook(item, b)"
                      >
                        <div class="fw-bold text-dark text-truncate">{{ b.title }}</div>
                        <div class="d-flex justify-content-between small text-muted" style="font-size: 11px;">
                          <span>ISBN: {{ b.isbn || 'Không có' }}</span>
                          <span class="fw-bold text-primary">Tồn: {{ b.inventory?.stock_quantity || 0 }} cuốn</span>
                        </div>
                      </div>
                      <div v-if="filterBooks(item.searchKeyword).length === 0" class="px-3 py-2 text-muted small text-center">
                        Không tìm thấy sách phù hợp
                      </div>
                    </div>
                  </div>

                  <!-- Cột Số lượng -->
                  <div :class="form.type === 'import' ? 'col-md-3' : 'col-md-4'">
                    <label class="form-label small fw-bold text-secondary mb-1">Số lượng <span class="text-danger">*</span></label>
                    <input 
                      type="number" 
                      min="1" 
                      class="form-control shadow-none" 
                      v-model.number="item.quantity" 
                      required 
                      placeholder="Số lượng..."
                    >
                  </div>

                  <!-- Cột Đơn giá (Chỉ hiện khi nhập kho) -->
                  <div v-if="form.type === 'import'" class="col-md-3">
                    <label class="form-label small fw-bold text-secondary mb-1">Đơn giá nhập (đ) <span class="text-danger">*</span></label>
                    <div class="input-group">
                      <input 
                        type="number" 
                        min="0" 
                        step="1000" 
                        class="form-control shadow-none" 
                        v-model.number="item.unit_cost" 
                        required
                        placeholder="0"
                      >
                    </div>
                  </div>

                  <!-- Nút Xóa dòng -->
                  <div class="col-md-1 text-end">
                    <label class="form-label small fw-bold text-secondary mb-1 d-block">&nbsp;</label>
                    <button 
                      type="button" 
                      class="btn btn-outline-danger btn-sm p-0 w-100 d-flex align-items-center justify-content-center" 
                      style="height: 38px;"
                      @click="removeBookRow(index)" 
                      :disabled="form.details.length <= 1"
                      title="Xóa dòng này"
                    >
                      <i class="bi bi-trash"></i>
                    </button>
                  </div>
                </div>

                <!-- Thanh thông tin phụ: Tồn kho hiện tại & Cảnh báo vượt tồn & Thành tiền -->
                <div v-if="item.book_id" class="d-flex justify-content-between align-items-center mt-2 pt-2 border-top small">
                  <div>
                    <span class="badge bg-white text-secondary border py-1 px-2">
                      <i class="bi bi-box me-1"></i>Tồn kho hiện tại: <strong class="text-dark">{{ item.current_stock }}</strong> cuốn
                    </span>
                    <span 
                      v-if="form.type === 'export' && item.quantity > item.current_stock" 
                      class="text-danger fw-bold ms-2"
                    >
                      <i class="bi bi-exclamation-triangle-fill me-1"></i>Vượt quá tồn kho (hiện chỉ còn {{ item.current_stock }} cuốn)!
                    </span>
                  </div>
                  <div v-if="form.type === 'import'" class="text-muted">
                    Thành tiền: <strong class="text-dark fs-6">{{ formatCurrency((item.quantity || 0) * (item.unit_cost || 0)) }}</strong>
                  </div>
                </div>
              </div>
            </div>

            <!-- Tổng cộng tiền toàn phiếu -->
            <div class="card-footer bg-white border-top p-3 d-flex justify-content-between align-items-center">
              <span class="fw-bold text-secondary">Tổng giá trị phiếu:</span>
              <span class="fs-4 fw-bold text-danger">{{ formatCurrency(computedTotalCost) }}</span>
            </div>
          </div>
        </div>

        <!-- CỘT PHẢI: Thông tin phiếu & Hành động -->
        <div class="col-lg-4">
          <div class="card border-0 shadow-sm rounded-4 mb-4">
            <div class="card-header bg-white border-bottom-0 pt-4 px-4 pb-0">
              <h5 class="fw-bold mb-0 text-primary"><i class="bi bi-card-checklist me-2"></i>Thông tin chứng từ</h5>
            </div>
            <div class="card-body p-4">
              <!-- Chọn Loại phiếu -->
              <div class="mb-3">
                <label class="form-label fw-bold text-secondary small">Loại phiếu <span class="text-danger">*</span></label>
                <div class="d-flex gap-2">
                  <div class="form-check flex-fill p-2 border rounded-3 bg-white" :class="{ 'border-success bg-success-subtle': form.type === 'import' }">
                    <input class="form-check-input ms-1" type="radio" name="receiptType" id="typeImport" value="import" v-model="form.type">
                    <label class="form-check-label fw-bold ms-2 cursor-pointer" for="typeImport">
                      <i class="bi bi-arrow-down-left text-success me-1"></i>Nhập kho
                    </label>
                  </div>
                  <div class="form-check flex-fill p-2 border rounded-3 bg-white" :class="{ 'border-warning bg-warning-subtle': form.type === 'export' }">
                    <input class="form-check-input ms-1" type="radio" name="receiptType" id="typeExport" value="export" v-model="form.type">
                    <label class="form-check-label fw-bold ms-2 cursor-pointer" for="typeExport">
                      <i class="bi bi-arrow-up-right text-warning me-1"></i>Xuất kho
                    </label>
                  </div>
                </div>
              </div>

              <!-- Nhà cung cấp (Chỉ khi Nhập kho) -->
              <div v-if="form.type === 'import'" class="mb-3">
                <div class="d-flex justify-content-between align-items-center mb-1">
                  <label class="form-label fw-bold text-secondary small mb-0">Nhà cung cấp / Đối tác <span class="text-danger">*</span></label>
                  <button 
                    type="button" 
                    class="btn btn-sm btn-link text-primary text-decoration-none p-0 fw-bold small"
                    @click="openQuickSupplierModal"
                  >
                    <i class="bi bi-plus-circle me-1"></i>Thêm nhanh
                  </button>
                </div>
                <select class="form-select shadow-none" v-model="form.supplier_id" required>
                  <option value="" disabled>-- Chọn Nhà cung cấp --</option>
                  <option v-for="s in suppliersList" :key="s.supplier_id" :value="s.supplier_id">
                    {{ s.supplier_code ? '[' + s.supplier_code + '] ' : '' }}{{ s.supplier_name }}{{ s.contact_person ? ' - ' + s.contact_person : '' }}{{ s.phone ? ' (' + s.phone + ')' : '' }}
                  </option>
                </select>
                <div v-if="selectedSupplier" class="mt-2 p-2 bg-light border rounded small text-secondary">
                  <div><i class="bi bi-building me-1"></i><strong>{{ selectedSupplier.supplier_name }}</strong></div>
                  <div v-if="selectedSupplier.contact_person"><i class="bi bi-person me-1"></i>Liên hệ: {{ selectedSupplier.contact_person }}</div>
                  <div v-if="selectedSupplier.phone"><i class="bi bi-telephone me-1"></i>SĐT: {{ selectedSupplier.phone }}</div>
                  <div v-if="selectedSupplier.address"><i class="bi bi-geo-alt me-1"></i>{{ selectedSupplier.address }}</div>
                </div>
              </div>

              <!-- Ghi chú / Lý do (Bắt buộc khi Xuất kho) -->
              <div class="mb-4">
                <label class="form-label fw-bold text-secondary small">
                  {{ form.type === 'export' ? 'Lý do xuất kho' : 'Ghi chú phiếu' }}
                  <span v-if="form.type === 'export'" class="text-danger">*</span>
                </label>
                <textarea 
                  class="form-control shadow-none" 
                  rows="3" 
                  v-model="form.note" 
                  :placeholder="form.type === 'export' ? 'Bắt buộc: VD xuất trả NXB, hủy sách rách hỏng...' : 'Ghi chú đợt giao nhận...'"
                  :required="form.type === 'export'"
                ></textarea>
              </div>

              <!-- Các nút bấm Lưu -->
              <div class="d-grid gap-2">
                <!-- Nút Lưu & Hoàn tất ngay (Gói 1 transaction) -->
                <button 
                  type="button" 
                  class="btn btn-success py-2 fw-bold shadow-sm"
                  :disabled="isSaving"
                  @click="handleSubmit(true)"
                >
                  <span v-if="isSaving && isAutoComplete" class="spinner-border spinner-border-sm me-2"></span>
                  <i class="bi bi-check2-circle me-1"></i> Lưu & Hoàn tất ngay
                </button>

                <!-- Nút Lưu tạm chờ duyệt -->
                <button 
                  type="button" 
                  class="btn btn-outline-primary py-2 fw-bold"
                  :disabled="isSaving"
                  @click="handleSubmit(false)"
                >
                  <span v-if="isSaving && !isAutoComplete" class="spinner-border spinner-border-sm me-2"></span>
                  <i class="bi bi-save me-1"></i> Lưu tạm (Chờ duyệt)
                </button>

                <router-link to="/admin/stock-receipts" class="btn btn-light py-2 text-secondary">
                  Hủy bỏ
                </router-link>
              </div>

            </div>
          </div>
        </div>

      </div>
    </form>

    <!-- Modal Thêm nhanh Nhà cung cấp -->
    <div v-if="showQuickSupplierModal" class="modal-backdrop fade show" style="opacity: 0.5; z-index: 1060;"></div>
    <div v-if="showQuickSupplierModal" class="modal fade show d-block" tabindex="-1" style="z-index: 1065;">
      <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content border-0 shadow-lg rounded-4">
          <div class="modal-header border-bottom-0 pb-0">
            <h5 class="modal-title fw-bold text-dark">
              <i class="bi bi-building me-2 text-primary"></i>Thêm nhanh Nhà cung cấp
            </h5>
            <button type="button" class="btn-close" @click="showQuickSupplierModal = false"></button>
          </div>
          <div class="modal-body">
            <div v-if="quickSupplierError" class="alert alert-danger py-2 small mb-3">
              <i class="bi bi-exclamation-circle me-1"></i>{{ quickSupplierError }}
            </div>
            <form @submit.prevent="handleSaveQuickSupplier">
              <div class="mb-3">
                <label class="form-label fw-bold text-secondary small">Mã nhà cung cấp <span class="text-danger">*</span></label>
                <input 
                  type="text" 
                  class="form-control text-uppercase" 
                  v-model="quickSupplierForm.supplier_code" 
                  required 
                  maxlength="20"
                  pattern="[A-Za-z0-9_\-]{2,20}"
                  title="2-20 ký tự: chữ không dấu, số, dấu - hoặc _"
                  placeholder="VD: NCC001, FAHASA"
                >
              </div>
              <div class="mb-3">
                <label class="form-label fw-bold text-secondary small">Tên nhà cung cấp <span class="text-danger">*</span></label>
                <input 
                  type="text" 
                  class="form-control" 
                  v-model="quickSupplierForm.supplier_name" 
                  required 
                  maxlength="150"
                  placeholder="VD: Công ty Fahasa..."
                >
              </div>
              <div class="row g-2 mb-3">
                <div class="col-6">
                  <label class="form-label fw-bold text-secondary small">Người liên hệ</label>
                  <input type="text" class="form-control" v-model="quickSupplierForm.contact_person" placeholder="Tên liên hệ...">
                </div>
                <div class="col-6">
                  <label class="form-label fw-bold text-secondary small">Số điện thoại</label>
                  <input type="text" class="form-control" v-model="quickSupplierForm.phone" placeholder="090...">
                </div>
              </div>
              <div class="mb-3">
                <label class="form-label fw-bold text-secondary small">Email</label>
                <input type="email" class="form-control" v-model="quickSupplierForm.email" placeholder="email@...">
              </div>
              <div class="mb-3">
                <label class="form-label fw-bold text-secondary small">Địa chỉ</label>
                <input type="text" class="form-control" v-model="quickSupplierForm.address" placeholder="Địa chỉ đối tác...">
              </div>
              <div class="d-flex justify-content-end gap-2 pt-2 border-top">
                <button type="button" class="btn btn-light btn-sm" @click="showQuickSupplierModal = false">Hủy</button>
                <button type="submit" class="btn btn-primary btn-sm px-3 fw-bold" :disabled="isQuickSaving">
                  <span v-if="isQuickSaving" class="spinner-border spinner-border-sm me-1"></span>
                  Lưu & Chọn ngay
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { inventoryService, bookService, supplierService } from '@/services/adminService'

const route = useRoute()
const router = useRouter()

const isSaving = ref(false)
const isAutoComplete = ref(false)
const alertMsg = ref('')

const allBooksList = ref([])
const suppliersList = ref([])

const form = reactive({
  type: 'import',
  supplier_id: '',
  note: '',
  details: [
    { book_id: '', quantity: 1, unit_cost: 0, searchKeyword: '', showDropdown: false, current_stock: 0 }
  ]
})

const selectedSupplier = computed(() => {
  if (!form.supplier_id) return null
  return suppliersList.value.find(s => s.supplier_id === Number(form.supplier_id)) || null
})

// Quick Supplier Modal State
const showQuickSupplierModal = ref(false)
const isQuickSaving = ref(false)
const quickSupplierError = ref('')
const quickSupplierForm = reactive({
  supplier_code: '',
  supplier_name: '',
  contact_person: '',
  phone: '',
  email: '',
  address: ''
})

const openQuickSupplierModal = () => {
  quickSupplierError.value = ''
  quickSupplierForm.supplier_code = ''
  quickSupplierForm.supplier_name = ''
  quickSupplierForm.contact_person = ''
  quickSupplierForm.phone = ''
  quickSupplierForm.email = ''
  quickSupplierForm.address = ''
  showQuickSupplierModal.value = true
}

const handleSaveQuickSupplier = async () => {
  quickSupplierError.value = ''
  try {
    isQuickSaving.value = true
    const created = await supplierService.create(quickSupplierForm)
    await fetchSuppliersList()
    form.supplier_id = created.supplier_id
    showQuickSupplierModal.value = false
  } catch (err) {
    quickSupplierError.value = err.response?.data?.message || 'Lỗi tạo nhà cung cấp: ' + err.message
  } finally {
    isQuickSaving.value = false
  }
}

const fetchSuppliersList = async () => {
  try {
    suppliersList.value = await supplierService.getOptions()
  } catch (err) {
    console.error('Lỗi tải danh mục nhà cung cấp:', err)
  }
}

// Tính tổng giá trị phiếu
const computedTotalCost = computed(() => {
  if (form.type === 'export') return 0
  return form.details.reduce((sum, item) => sum + (Number(item.quantity || 0) * Number(item.unit_cost || 0)), 0)
})

// Lọc sách theo từ khóa
const filterBooks = (keyword) => {
  if (!keyword || !keyword.trim()) return allBooksList.value.slice(0, 15)
  const kw = keyword.toLowerCase().trim()
  return allBooksList.value.filter(b => 
    b.title.toLowerCase().includes(kw) || 
    (b.isbn && b.isbn.toLowerCase().includes(kw))
  ).slice(0, 15)
}

// Chọn sách
const selectBook = (item, book) => {
  // Kiểm tra xem cuốn sách này đã có ở một dòng khác chưa (nếu có thì gộp số lượng)
  const existingRow = form.details.find(d => d !== item && d.book_id === book.book_id)
  if (existingRow) {
    existingRow.quantity += (item.quantity || 1)
    // Xóa dòng hiện tại nếu đang thêm dòng mới
    if (form.details.length > 1) {
      const idx = form.details.indexOf(item)
      form.details.splice(idx, 1)
    } else {
      clearBookSelection(item)
    }
    return
  }

  item.book_id = book.book_id
  item.searchKeyword = book.title
  item.current_stock = book.inventory?.stock_quantity || 0
  item.showDropdown = false
  // Gợi ý giá nhập từ giá niêm yết (nếu chưa nhập)
  if (form.type === 'import' && (!item.unit_cost || item.unit_cost === 0)) {
    item.unit_cost = Math.round(Number(book.price) * 0.7) // Gợi ý giá nhập ~70% giá bán
  }
}

const clearBookSelection = (item) => {
  item.book_id = ''
  item.searchKeyword = ''
  item.current_stock = 0
  item.showDropdown = true
}

const addBookRow = () => {
  form.details.push({
    book_id: '',
    quantity: 1,
    unit_cost: 0,
    searchKeyword: '',
    showDropdown: false,
    current_stock: 0
  })
}

const removeBookRow = (index) => {
  form.details.splice(index, 1)
}

// Tải danh sách sách để tìm kiếm
const fetchAllBooks = async () => {
  try {
    const res = await bookService.getAll({ limit: 1000 })
    allBooksList.value = res.books
  } catch (error) {
    console.error('Lỗi tải danh mục sách:', error)
  }
}

// Submit Form
const handleSubmit = async (autoCompleteFlag) => {
  alertMsg.value = ''

  // Validate các dòng sách
  const validDetails = form.details.filter(d => d.book_id)
  if (validDetails.length === 0) {
    alertMsg.value = 'Vui lòng chọn ít nhất một cuốn sách hợp lệ vào phiếu!'
    return
  }

  for (const item of validDetails) {
    if (!item.quantity || item.quantity <= 0) {
      alertMsg.value = 'Số lượng sách phải lớn hơn 0!'
      return
    }
    if (form.type === 'export' && item.quantity > item.current_stock) {
      alertMsg.value = `Sách "${item.searchKeyword}" không đủ số lượng trong kho để xuất (tồn: ${item.current_stock}, yêu cầu: ${item.quantity})!`
      return
    }
  }

  if (form.type === 'import' && !form.supplier_id) {
    alertMsg.value = 'Vui lòng chọn Nhà cung cấp / Đối tác cho phiếu nhập kho!'
    return
  }

  if (form.type === 'export' && (!form.note || !form.note.trim())) {
    alertMsg.value = 'Phiếu xuất kho bắt buộc phải nhập lý do vào ô Ghi chú!'
    return
  }

  try {
    isSaving.value = true
    isAutoComplete.value = autoCompleteFlag

    const payload = {
      type: form.type,
      supplier_id: form.type === 'import' ? Number(form.supplier_id) : null,
      note: form.note,
      details: validDetails.map(d => ({
        book_id: d.book_id,
        quantity: d.quantity,
        unit_cost: form.type === 'import' ? d.unit_cost : 0
      })),
      auto_complete: autoCompleteFlag
    }

    await inventoryService.createReceipt(payload)
    router.push('/admin/stock-receipts')
  } catch (error) {
    alertMsg.value = error.response?.data?.message || 'Lỗi lập phiếu: ' + error.message
  } finally {
    isSaving.value = false
  }
}

// Helpers
const formatCurrency = (val) => {
  if (!val && val !== 0) return '0 đ'
  return Number(val).toLocaleString('vi-VN') + ' đ'
}

onMounted(async () => {
  await Promise.all([
    fetchAllBooks(),
    fetchSuppliersList()
  ])

  // Nếu url có ?book_id=... thì tự động chọn sách đó vào dòng đầu
  const preSelectedBookId = route.query.book_id
  if (preSelectedBookId && allBooksList.value.length > 0) {
    const found = allBooksList.value.find(b => b.book_id === Number(preSelectedBookId))
    if (found && form.details.length > 0) {
      selectBook(form.details[0], found)
    }
  }
})
</script>

<style scoped>
.cursor-pointer {
  cursor: pointer;
}
.dropdown-item-book:hover {
  background-color: #f0f4f8;
}
</style>
