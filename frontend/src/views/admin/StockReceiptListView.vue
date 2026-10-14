<template>
  <div class="container-fluid py-2">
    <!-- Tiêu đề & Nút thao tác -->
    <div class="d-flex justify-content-between align-items-center mb-4">
      <div>
        <h4 class="fw-bold text-dark mb-1">Quản lý Phiếu Nhập / Xuất Kho</h4>
        <p class="text-muted small mb-0">Theo dõi toàn bộ lịch sử chứng từ biến động hàng hóa trong kho</p>
      </div>
      <div class="d-flex gap-2">
        <router-link to="/admin/inventory" class="btn btn-outline-secondary shadow-sm">
          <i class="bi bi-boxes me-1"></i> Báo cáo tồn kho
        </router-link>
        <router-link to="/admin/stock-receipts/create" class="btn btn-primary shadow-sm">
          <i class="bi bi-plus-circle me-1"></i> Tạo phiếu mới
        </router-link>
      </div>
    </div>

    <!-- Thông báo lỗi / thành công -->
    <div v-if="alertMsg" :class="`alert ${alertType === 'success' ? 'alert-success' : 'alert-danger'} alert-dismissible fade show shadow-sm`" role="alert">
      {{ alertMsg }}
      <button type="button" class="btn-close" @click="alertMsg = ''"></button>
    </div>

    <!-- Bộ lọc & Tìm kiếm -->
    <div class="card border-0 shadow-sm rounded-4 mb-4">
      <div class="card-body p-3">
        <div class="row g-2 align-items-center">
          <div class="col-md-5">
            <div class="input-group">
              <span class="input-group-text bg-white border-end-0 text-muted"><i class="bi bi-search"></i></span>
              <input 
                type="text" 
                class="form-control border-start-0 ps-0 shadow-none" 
                v-model="filters.search" 
                placeholder="Tìm theo mã phiếu, nhà cung cấp, ghi chú..."
                @keyup.enter="handleSearch"
              >
            </div>
          </div>
          <div class="col-md-2">
            <select class="form-select shadow-none" v-model="filters.type" @change="handleSearch">
              <option value="">Tất cả loại phiếu</option>
              <option value="import">Phiếu Nhập kho</option>
              <option value="export">Phiếu Xuất kho</option>
            </select>
          </div>
          <div class="col-md-3">
            <select class="form-select shadow-none" v-model="filters.status" @change="handleSearch">
              <option value="">Tất cả trạng thái</option>
              <option value="pending">Chờ duyệt (Pending)</option>
              <option value="completed">Đã hoàn thành (Completed)</option>
              <option value="cancelled">Đã hủy (Cancelled)</option>
            </select>
          </div>
          <div class="col-md-2 d-flex gap-2">
            <button class="btn btn-primary w-100" @click="handleSearch">Lọc</button>
            <button class="btn btn-light" @click="resetFilter" title="Đặt lại bộ lọc"><i class="bi bi-arrow-counterclockwise"></i></button>
          </div>
        </div>
      </div>
    </div>

    <!-- Bảng danh sách phiếu -->
    <div class="card border-0 shadow-sm rounded-4 overflow-hidden mb-4">
      <div class="table-responsive">
        <table class="table table-hover align-middle mb-0">
          <thead class="table-light">
            <tr>
              <th scope="col" class="ps-4" style="width: 170px;">Mã phiếu</th>
              <th scope="col" style="width: 130px;">Loại phiếu</th>
              <th scope="col">Đối tác / Nhà cung cấp</th>
              <th scope="col" class="text-end" style="width: 150px;">Tổng giá trị</th>
              <th scope="col" style="width: 170px;">Ngày tạo</th>
              <th scope="col" class="text-center" style="width: 140px;">Trạng thái</th>
              <th scope="col" class="text-end pe-4" style="width: 160px;">Thao tác</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="isLoading">
              <td colspan="7" class="text-center py-5">
                <div class="spinner-border text-primary" role="status"><span class="visually-hidden">Loading...</span></div>
              </td>
            </tr>
            <tr v-else-if="receipts.length === 0">
              <td colspan="7" class="text-center py-5 text-muted">
                <i class="bi bi-journal-x fs-1 d-block mb-2 text-secondary opacity-50"></i>
                Không tìm thấy phiếu kho nào.
              </td>
            </tr>
            <tr v-else v-for="receipt in receipts" :key="receipt.receipt_id">
              <!-- Mã phiếu -->
              <td class="ps-4">
                <span class="font-monospace fw-bold text-dark">{{ receipt.receipt_code }}</span>
              </td>

              <!-- Loại phiếu -->
              <td>
                <span 
                  class="badge px-2 py-1 rounded-pill"
                  :class="receipt.type === 'import' ? 'bg-success-subtle text-success-emphasis border border-success-subtle' : 'bg-warning-subtle text-warning-emphasis border border-warning-subtle'"
                >
                  <i :class="receipt.type === 'import' ? 'bi bi-arrow-down-left' : 'bi bi-arrow-up-right'" class="me-1"></i>
                  {{ receipt.type === 'import' ? 'Nhập kho' : 'Xuất kho' }}
                </span>
              </td>

              <!-- Nhà cung cấp / Ghi chú -->
              <td>
                <div class="fw-bold text-dark">
                  {{ receipt.type === 'import' ? (receipt.supplier_name || 'Không xác định') : 'Xuất kho nội bộ' }}
                </div>
                <small v-if="receipt.note" class="text-muted text-truncate d-block" style="max-width: 250px;" :title="receipt.note">
                  {{ receipt.note }}
                </small>
                <small v-if="receipt.status === 'cancelled' && receipt.cancel_reason" class="text-danger text-truncate d-block mt-1" style="max-width: 250px;" :title="'Lý do hủy: ' + receipt.cancel_reason">
                  <i class="bi bi-x-circle me-1"></i>Lý do hủy: {{ receipt.cancel_reason }}
                </small>
              </td>

              <!-- Tổng giá trị -->
              <td class="text-end fw-bold text-dark">
                {{ formatCurrency(receipt.total_cost) }}
              </td>

              <!-- Ngày tạo -->
              <td>
                <span class="small text-secondary">{{ formatDate(receipt.created_date) }}</span>
              </td>

              <!-- Trạng thái -->
              <td class="text-center">
                <span 
                  class="badge px-3 py-2 rounded-pill"
                  :class="getStatusBadgeClass(receipt.status)"
                >
                  {{ getStatusText(receipt.status) }}
                </span>
              </td>

              <!-- Thao tác -->
              <td class="text-end pe-4">
                <button 
                  class="btn btn-sm btn-outline-info me-1" 
                  @click="viewDetails(receipt.receipt_id)"
                  title="Xem chi tiết"
                >
                  <i class="bi bi-eye"></i>
                </button>

                <!-- Nút Duyệt chỉ hiện khi Pending -->
                <button 
                  v-if="receipt.status === 'pending'"
                  class="btn btn-sm btn-outline-success me-1" 
                  @click="openCompleteModal(receipt)"
                  title="Duyệt hoàn tất phiếu"
                >
                  <i class="bi bi-check-lg"></i>
                </button>

                <!-- Nút Hủy chỉ hiện khi Pending -->
                <button 
                  v-if="receipt.status === 'pending'"
                  class="btn btn-sm btn-outline-danger" 
                  @click="openCancelModal(receipt)"
                  title="Hủy phiếu"
                >
                  <i class="bi bi-x-lg"></i>
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Phân trang -->
      <div v-if="pagination.totalPages > 1" class="card-footer bg-white border-0 py-3 d-flex justify-content-between align-items-center">
        <span class="text-muted small">
          Hiển thị trang {{ pagination.page }} trên {{ pagination.totalPages }} (Tổng cộng {{ pagination.total }} phiếu)
        </span>
        <ul class="pagination pagination-sm mb-0">
          <li class="page-item" :class="{ disabled: pagination.page <= 1 }">
            <button class="page-link" @click="changePage(pagination.page - 1)">&laquo;</button>
          </li>
          <li 
            v-for="p in pagination.totalPages" 
            :key="p" 
            class="page-item" 
            :class="{ active: p === pagination.page }"
          >
            <button class="page-link" @click="changePage(p)">{{ p }}</button>
          </li>
          <li class="page-item" :class="{ disabled: pagination.page >= pagination.totalPages }">
            <button class="page-link" @click="changePage(pagination.page + 1)">&raquo;</button>
          </li>
        </ul>
      </div>
    </div>

    <!-- MODAL XEM CHI TIẾT PHIẾU -->
    <div v-if="showDetailModal" class="modal-backdrop fade show" style="opacity: 0.5;"></div>
    <div v-if="showDetailModal" class="modal fade show d-block" tabindex="-1">
      <div class="modal-dialog modal-dialog-centered modal-lg">
        <div class="modal-content border-0 shadow-lg rounded-4">
          <div class="modal-header border-bottom-0 pb-0">
            <div>
              <h5 class="modal-title fw-bold text-dark">
                Chi tiết phiếu: <span class="text-primary font-monospace">{{ selectedReceipt?.receipt_code }}</span>
              </h5>
              <div class="small text-muted mt-2 d-flex flex-wrap gap-2 align-items-center">
                <span>Loại: <strong>{{ selectedReceipt?.type === 'import' ? 'Nhập kho' : 'Xuất kho' }}</strong></span>
                <span>•</span>
                <span v-if="selectedReceipt?.type === 'import'">
                  Nhà cung cấp: <strong class="text-primary">{{ selectedReceipt?.supplier_name || 'Không xác định' }}</strong>
                </span>
                <span v-else>
                  Hình thức: <strong class="text-secondary">Xuất kho nội bộ</strong>
                </span>
                <span>•</span>
                <span>Ngày tạo: {{ formatDate(selectedReceipt?.created_date) }}</span>
                <span>•</span>
                <span>Trạng thái: <span class="badge" :class="getStatusBadgeClass(selectedReceipt?.status)">{{ getStatusText(selectedReceipt?.status) }}</span></span>
              </div>
            </div>
            <button type="button" class="btn-close" @click="showDetailModal = false"></button>
          </div>
          <div class="modal-body p-4">
            <!-- Ghi chú ban đầu của phiếu -->
            <div v-if="selectedReceipt?.note" class="alert alert-light border small mb-2 d-flex align-items-start gap-2">
              <i class="bi bi-chat-left-text text-secondary mt-1"></i>
              <div>
                <strong>Ghi chú:</strong> {{ selectedReceipt.note }}
              </div>
            </div>

            <!-- Khung cảnh báo Lý do hủy (nếu phiếu đã hủy) -->
            <div v-if="selectedReceipt?.status === 'cancelled' && selectedReceipt?.cancel_reason" class="alert alert-danger border-danger-subtle small mb-3 d-flex align-items-start gap-2">
              <i class="bi bi-exclamation-octagon-fill text-danger mt-1 fs-6"></i>
              <div>
                <strong class="text-danger">Lý do hủy phiếu:</strong> {{ selectedReceipt.cancel_reason }}
              </div>
            </div>

            <div class="table-responsive rounded-3 border">
              <table class="table table-sm align-middle mb-0">
                <thead class="table-light">
                  <tr>
                    <th scope="col" class="ps-3">#</th>
                    <th scope="col">Tên sách</th>
                    <th scope="col" class="text-center" style="width: 100px;">Số lượng</th>
                    <th scope="col" class="text-end" style="width: 130px;">Đơn giá</th>
                    <th scope="col" class="text-end pe-3" style="width: 150px;">Thành tiền</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="(item, idx) in selectedReceipt?.details" :key="idx">
                    <td class="ps-3 text-muted">{{ idx + 1 }}</td>
                    <td>
                      <div class="fw-bold text-dark">{{ item.book?.title }}</div>
                      <small class="text-secondary">{{ item.book?.isbn ? 'ISBN: ' + item.book.isbn : '' }}</small>
                    </td>
                    <td class="text-center fw-bold">{{ item.quantity }}</td>
                    <td class="text-end">{{ formatCurrency(item.unit_cost) }}</td>
                    <td class="text-end pe-3 fw-bold">{{ formatCurrency(item.quantity * (item.unit_cost || 0)) }}</td>
                  </tr>
                </tbody>
                <tfoot class="table-light">
                  <tr>
                    <td colspan="4" class="text-end fw-bold">Tổng cộng:</td>
                    <td class="text-end pe-3 fw-bold fs-6 text-danger">
                      {{ formatCurrency(selectedReceipt?.total_cost) }}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            <div class="d-flex justify-content-end gap-2 mt-4">
              <button type="button" class="btn btn-light" @click="showDetailModal = false">Đóng</button>
              <button 
                v-if="selectedReceipt?.status === 'pending'" 
                type="button" 
                class="btn btn-success" 
                @click="openCompleteModal(selectedReceipt)"
              >
                <i class="bi bi-check-circle me-1"></i> Duyệt phiếu này
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- MODAL XÁC NHẬN DUYỆT PHIẾU -->
    <div v-if="showCompleteModal" class="modal-backdrop fade show" style="opacity: 0.5;"></div>
    <div v-if="showCompleteModal" class="modal fade show d-block" tabindex="-1">
      <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content border-0 shadow-lg rounded-4">
          <div class="modal-header border-bottom-0 pb-0">
            <h5 class="modal-title fw-bold text-success"><i class="bi bi-check-circle me-2"></i>Xác nhận duyệt phiếu</h5>
            <button type="button" class="btn-close" @click="showCompleteModal = false"></button>
          </div>
          <div class="modal-body p-4">
            <p class="mb-2">
              Bạn có chắc chắn muốn duyệt hoàn tất phiếu <strong>{{ targetReceipt?.receipt_code }}</strong>?
            </p>
            <div class="alert alert-warning small mb-0">
              <i class="bi bi-exclamation-triangle-fill me-1"></i>
              Hành động này sẽ <strong>{{ targetReceipt?.type === 'import' ? 'cộng dồn' : 'khấu trừ' }}</strong> số lượng trực tiếp vào tồn kho và không thể hoàn tác.
            </div>
            <div class="d-flex justify-content-end gap-2 mt-4">
              <button type="button" class="btn btn-light" @click="showCompleteModal = false">Hủy bỏ</button>
              <button 
                type="button" 
                class="btn btn-success px-4" 
                :disabled="isSubmitting"
                @click="confirmComplete"
              >
                <span v-if="isSubmitting" class="spinner-border spinner-border-sm me-2"></span>
                Xác nhận Duyệt
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- MODAL HỦY PHIẾU -->
    <div v-if="showCancelModal" class="modal-backdrop fade show" style="opacity: 0.5;"></div>
    <div v-if="showCancelModal" class="modal fade show d-block" tabindex="-1">
      <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content border-0 shadow-lg rounded-4">
          <div class="modal-header border-bottom-0 pb-0">
            <h5 class="modal-title fw-bold text-danger"><i class="bi bi-x-circle me-2"></i>Hủy phiếu kho</h5>
            <button type="button" class="btn-close" @click="showCancelModal = false"></button>
          </div>
          <div class="modal-body p-4">
            <p class="mb-3">
              Bạn đang yêu cầu hủy phiếu <strong>{{ targetReceipt?.receipt_code }}</strong>.
            </p>
            <div class="mb-3">
              <label class="form-label small fw-bold text-secondary">Lý do hủy</label>
              <textarea class="form-control" rows="3" v-model="cancelReason" placeholder="Nhập lý do hủy phiếu này..."></textarea>
            </div>
            <div class="d-flex justify-content-end gap-2">
              <button type="button" class="btn btn-light" @click="showCancelModal = false">Bỏ qua</button>
              <button 
                type="button" 
                class="btn btn-danger px-4" 
                :disabled="isSubmitting"
                @click="confirmCancel"
              >
                <span v-if="isSubmitting" class="spinner-border spinner-border-sm me-2"></span>
                Xác nhận Hủy
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { inventoryService } from '@/services/adminService'

const receipts = ref([])
const isLoading = ref(false)
const isSubmitting = ref(false)
const alertMsg = ref('')
const alertType = ref('success')

// Modals state
const showDetailModal = ref(false)
const selectedReceipt = ref(null)

const showCompleteModal = ref(false)
const targetReceipt = ref(null)

const showCancelModal = ref(false)
const cancelReason = ref('')

const filters = reactive({
  search: '',
  type: '',
  status: '',
  page: 1,
  limit: 10
})

const pagination = reactive({
  total: 0,
  page: 1,
  limit: 10,
  totalPages: 1
})

const fetchReceipts = async () => {
  try {
    isLoading.value = true
    const res = await inventoryService.getReceipts({ ...filters })
    receipts.value = res.receipts
    pagination.total = res.pagination.total
    pagination.page = res.pagination.page
    pagination.totalPages = res.pagination.totalPages
  } catch (error) {
    alertType.value = 'danger'
    alertMsg.value = 'Lỗi tải danh sách phiếu kho: ' + (error.response?.data?.message || error.message)
  } finally {
    isLoading.value = false
  }
}

const handleSearch = () => {
  filters.page = 1
  fetchReceipts()
}

const resetFilter = () => {
  filters.search = ''
  filters.type = ''
  filters.status = ''
  filters.page = 1
  fetchReceipts()
}

const changePage = (newPage) => {
  filters.page = newPage
  fetchReceipts()
}

// Xem chi tiết phiếu
const viewDetails = async (id) => {
  try {
    const res = await inventoryService.getReceiptById(id)
    selectedReceipt.value = res
    showDetailModal.value = true
  } catch (error) {
    alertType.value = 'danger'
    alertMsg.value = 'Lỗi xem chi tiết: ' + (error.response?.data?.message || error.message)
  }
}

// Mở modal duyệt phiếu
const openCompleteModal = (receipt) => {
  targetReceipt.value = receipt
  showDetailModal.value = false
  showCompleteModal.value = true
}

// Xác nhận duyệt phiếu
const confirmComplete = async () => {
  if (!targetReceipt.value) return
  try {
    isSubmitting.value = true
    const res = await inventoryService.completeReceipt(targetReceipt.value.receipt_id)
    alertType.value = 'success'
    alertMsg.value = res.message || 'Đã duyệt hoàn tất phiếu thành công!'
    showCompleteModal.value = false
    await fetchReceipts()
  } catch (error) {
    alertType.value = 'danger'
    alertMsg.value = error.response?.data?.message || 'Lỗi duyệt phiếu: ' + error.message
  } finally {
    isSubmitting.value = false
  }
}

// Mở modal hủy phiếu
const openCancelModal = (receipt) => {
  targetReceipt.value = receipt
  cancelReason.value = ''
  showCancelModal.value = true
}

// Xác nhận hủy phiếu
const confirmCancel = async () => {
  if (!targetReceipt.value) return
  try {
    isSubmitting.value = true
    const res = await inventoryService.cancelReceipt(targetReceipt.value.receipt_id, cancelReason.value)
    alertType.value = 'success'
    alertMsg.value = res.message || 'Đã hủy phiếu thành công!'
    showCancelModal.value = false
    await fetchReceipts()
  } catch (error) {
    alertType.value = 'danger'
    alertMsg.value = error.response?.data?.message || 'Lỗi hủy phiếu: ' + error.message
  } finally {
    isSubmitting.value = false
  }
}

// Helpers
const formatCurrency = (val) => {
  if (!val && val !== 0) return '0 đ'
  return Number(val).toLocaleString('vi-VN') + ' đ'
}

const formatDate = (dateStr) => {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  return d.toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

const getStatusBadgeClass = (status) => {
  if (status === 'completed') return 'bg-success text-white'
  if (status === 'pending') return 'bg-warning-subtle text-warning-emphasis border border-warning'
  return 'bg-secondary text-white'
}

const getStatusText = (status) => {
  if (status === 'completed') return 'Hoàn tất'
  if (status === 'pending') return 'Chờ duyệt'
  if (status === 'cancelled') return 'Đã hủy'
  return status
}

onMounted(() => {
  fetchReceipts()
})
</script>
