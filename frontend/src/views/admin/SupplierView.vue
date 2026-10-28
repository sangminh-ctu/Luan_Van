<template>
  <div class="container-fluid py-2">
    <!-- Tiêu đề & Nút Thêm mới -->
    <div class="d-flex flex-wrap justify-content-between align-items-center mb-4 gap-3">
      <div>
        <h4 class="fw-bold text-dark mb-1">Quản lý Nhà cung cấp</h4>
        <small class="text-muted">Quản lý danh bạ đối tác cung ứng sách, số lượng phiếu và tổng giá trị nhập kho</small>
      </div>
      <button class="btn btn-primary shadow-sm fw-bold d-flex align-items-center" @click="openModal()">
        <i class="bi bi-plus-circle me-2"></i> Thêm Nhà cung cấp mới
      </button>
    </div>

    <!-- Thông báo Alert -->
    <div v-if="alertMsg" class="alert alert-dismissible fade show shadow-sm" :class="alertType === 'danger' ? 'alert-danger' : 'alert-success'" role="alert">
      <i class="bi me-2" :class="alertType === 'danger' ? 'bi-exclamation-triangle-fill' : 'bi-check-circle-fill'"></i>
      {{ alertMsg }}
      <button type="button" class="btn-close" @click="alertMsg = ''"></button>
    </div>

    <!-- Thanh công cụ: Tìm kiếm & Lọc trạng thái -->
    <div class="card border-0 shadow-sm rounded-4 mb-4 p-3 bg-white">
      <div class="row g-2 align-items-center">
        <div class="col-md-6 col-lg-5">
          <div class="input-group">
            <span class="input-group-text bg-light border-end-0 text-muted"><i class="bi bi-search"></i></span>
            <input 
              type="text" 
              class="form-control border-start-0 bg-light shadow-none" 
              placeholder="Tìm theo tên, SĐT, email, người liên hệ..." 
              v-model="searchQuery"
              @keyup.enter="handleSearch"
            >
            <button class="btn btn-outline-secondary" type="button" @click="handleSearch">Tìm kiếm</button>
          </div>
        </div>

        <div class="col-md-4 col-lg-3">
          <select class="form-select bg-light shadow-none" v-model="filterActive" @change="handleSearch">
            <option value="">Tất cả trạng thái</option>
            <option value="true">Đang hợp tác</option>
            <option value="false">Ngừng hợp tác</option>
          </select>
        </div>

        <div class="col-md-2 col-lg-4 text-md-end text-muted small">
          Tổng số: <strong class="text-dark">{{ pagination.total }}</strong> nhà cung cấp
        </div>
      </div>
    </div>

    <!-- Bảng dữ liệu Nhà cung cấp -->
    <div class="card border-0 shadow-sm rounded-4 overflow-hidden bg-white mb-4">
      <div class="table-responsive">
        <table class="table table-hover align-middle mb-0">
          <thead class="table-light">
            <tr>
              <th scope="col" class="ps-4" style="min-width: 200px;">Nhà cung cấp</th>
              <th scope="col" style="min-width: 170px;">Liên hệ</th>
              <th scope="col" style="min-width: 180px;">Địa chỉ</th>
              <th scope="col" class="text-center" style="width: 110px;">Số phiếu</th>
              <th scope="col" class="text-end" style="width: 140px;">Tổng tiền nhập</th>
              <th scope="col" class="text-center" style="width: 130px;">Trạng thái</th>
              <th scope="col" class="text-end pe-4" style="width: 140px;">Thao tác</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="isLoading">
              <td colspan="7" class="text-center py-5">
                <div class="spinner-border text-primary" role="status"><span class="visually-hidden">Đang tải...</span></div>
                <div class="text-muted small mt-2">Đang tải danh sách nhà cung cấp...</div>
              </td>
            </tr>
            <tr v-else-if="suppliers.length === 0">
              <td colspan="7" class="text-center py-5 text-muted">
                <i class="bi bi-inbox fs-1 d-block mb-2"></i>
                Không tìm thấy nhà cung cấp nào phù hợp.
              </td>
            </tr>
            <tr v-else v-for="sup in suppliers" :key="sup.supplier_id">
              <td class="ps-4">
                <div class="fw-bold text-dark">{{ sup.supplier_name }}</div>
                <div class="small">
                  <span v-if="sup.supplier_code" class="badge bg-light text-secondary border">{{ sup.supplier_code }}</span>
                  <span v-else class="text-warning fst-italic"><i class="bi bi-exclamation-triangle me-1"></i>Chưa có mã</span>
                </div>
                <div v-if="sup.note" class="text-muted small text-truncate" style="max-width: 250px;" :title="sup.note">
                  <i class="bi bi-info-circle me-1"></i>{{ sup.note }}
                </div>
              </td>
              <td>
                <div v-if="sup.contact_person" class="small fw-semibold text-dark">
                  <i class="bi bi-person me-1 text-secondary"></i>{{ sup.contact_person }}
                </div>
                <div v-if="sup.phone" class="small text-muted">
                  <i class="bi bi-telephone me-1 text-secondary"></i>{{ sup.phone }}
                </div>
                <div v-if="sup.email" class="small text-muted text-truncate" style="max-width: 180px;" :title="sup.email">
                  <i class="bi bi-envelope me-1 text-secondary"></i>{{ sup.email }}
                </div>
                <div v-if="!sup.contact_person && !sup.phone && !sup.email" class="text-muted small">
                  Chưa có liên hệ
                </div>
              </td>
              <td>
                <span class="text-secondary small text-truncate-2" :title="sup.address">
                  {{ sup.address || 'Chưa cập nhật' }}
                </span>
              </td>
              <td class="text-center">
                <router-link 
                  v-if="sup.receipt_count > 0 || sup.pending_receipt_count > 0"
                  :to="`/admin/stock-receipts?supplier_id=${sup.supplier_id}&type=import`" 
                  class="btn btn-sm btn-outline-primary py-0 px-2 fw-bold text-decoration-none"
                  title="Bấm để xem các phiếu nhập của nhà cung cấp này"
                >
                  {{ sup.receipt_count }} phiếu
                </router-link>
                <span v-else class="text-muted small">0</span>

                <div v-if="sup.pending_receipt_count > 0" class="mt-1">
                  <span class="badge bg-warning-subtle text-warning-emphasis border" style="font-size: 10px;">
                    {{ sup.pending_receipt_count }} chờ duyệt
                  </span>
                </div>
              </td>
              <td class="text-end fw-bold text-dark">
                {{ formatCurrency(sup.total_value) }}
              </td>
              <td class="text-center">
                <div class="form-check form-switch d-inline-block m-0">
                  <input 
                    class="form-check-input cursor-pointer" 
                    type="checkbox" 
                    role="switch" 
                    :checked="sup.is_active"
                    @change="handleToggleActive(sup)"
                    :title="sup.is_active ? 'Đang hợp tác (Bấm để ngừng)' : 'Đã ngừng hợp tác (Bấm để kích hoạt)'"
                  >
                </div>
                <div class="small" :class="sup.is_active ? 'text-success fw-semibold' : 'text-secondary'">
                  {{ sup.is_active ? 'Hợp tác' : 'Tạm dừng' }}
                </div>
              </td>
              <td class="text-end pe-4">
                <div class="btn-group btn-group-sm">
                  <button class="btn btn-outline-primary" @click="openModal(sup)" title="Sửa thông tin">
                    <i class="bi bi-pencil-square"></i>
                  </button>
                  <button class="btn btn-outline-danger" @click="handleDelete(sup)" title="Xóa nhà cung cấp">
                    <i class="bi bi-trash"></i>
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Phân trang -->
      <div v-if="pagination.totalPages > 1" class="d-flex justify-content-between align-items-center p-3 border-top">
        <span class="small text-muted">
          Trang {{ pagination.page }} / {{ pagination.totalPages }}
        </span>
        <div class="btn-group btn-group-sm">
          <button 
            class="btn btn-outline-secondary" 
            :disabled="pagination.page <= 1"
            @click="changePage(pagination.page - 1)"
          >
            Trước
          </button>
          <button 
            v-for="p in pagination.totalPages" 
            :key="p"
            class="btn"
            :class="p === pagination.page ? 'btn-primary' : 'btn-outline-secondary'"
            @click="changePage(p)"
          >
            {{ p }}
          </button>
          <button 
            class="btn btn-outline-secondary" 
            :disabled="pagination.page >= pagination.totalPages"
            @click="changePage(pagination.page + 1)"
          >
            Sau
          </button>
        </div>
      </div>
    </div>

    <!-- Modal Thêm/Sửa Nhà cung cấp -->
    <div v-if="showModal" class="modal-backdrop fade show" style="opacity: 0.5;"></div>
    <div v-if="showModal" class="modal fade show d-block" tabindex="-1" role="dialog">
      <div class="modal-dialog modal-dialog-centered" role="document">
        <div class="modal-content border-0 shadow-lg rounded-4">
          <div class="modal-header border-bottom-0 pb-0">
            <h5 class="modal-title fw-bold text-dark">
              <i class="bi bi-building me-2 text-primary"></i>
              {{ isEditing ? 'Cập nhật Nhà cung cấp' : 'Thêm Nhà cung cấp mới' }}
            </h5>
            <button type="button" class="btn-close" @click="closeModal()"></button>
          </div>

          <div class="modal-body">
            <!-- Thông báo lỗi bên trong Modal -->
            <div v-if="modalError" class="alert alert-danger py-2 small mb-3">
              <i class="bi bi-exclamation-circle me-1"></i>{{ modalError }}
            </div>

            <form @submit.prevent="saveSupplier">
              <!-- Mã nhà cung cấp -->
              <div class="mb-3">
                <label class="form-label fw-bold text-secondary small">Mã nhà cung cấp <span class="text-danger">*</span></label>
                <input 
                  type="text" 
                  class="form-control text-uppercase" 
                  v-model="formData.supplier_code" 
                  required 
                  maxlength="20"
                  pattern="[A-Za-z0-9_\-]{2,20}"
                  title="2-20 ký tự: chữ không dấu, số, dấu - hoặc _"
                  placeholder="VD: NCC001, FAHASA"
                >
                <div class="form-text">2-20 ký tự: chữ không dấu, số, dấu - hoặc _. Tự động viết hoa.</div>
              </div>

              <!-- Tên nhà cung cấp -->
              <div class="mb-3">
                <label class="form-label fw-bold text-secondary small">Tên nhà cung cấp <span class="text-danger">*</span></label>
                <input 
                  type="text" 
                  class="form-control" 
                  v-model="formData.supplier_name" 
                  required 
                  maxlength="150"
                  
                >
                
              </div>

              <!-- Người liên hệ & SĐT -->
              <div class="row g-2 mb-3">
                <div class="col-md-6">
                  <label class="form-label fw-bold text-secondary small">Người liên hệ</label>
                  <input 
                    type="text" 
                    class="form-control" 
                    v-model="formData.contact_person" 
                    maxlength="100"
                    placeholder=""
                  >
                </div>
                <div class="col-md-6">
                  <label class="form-label fw-bold text-secondary small">Số điện thoại</label>
                  <input 
                    type="text" 
                    class="form-control" 
                    v-model="formData.phone" 
                    maxlength="20"
                    placeholder=""
                  >
                </div>
              </div>

              <!-- Email -->
              <div class="mb-3">
                <label class="form-label fw-bold text-secondary small">Email liên hệ</label>
                <input 
                  type="email" 
                  class="form-control" 
                  v-model="formData.email" 
                  maxlength="100"
                  placeholder=""
                >
              </div>

              <!-- Địa chỉ -->
              <div class="mb-3">
                <label class="form-label fw-bold text-secondary small">Địa chỉ trụ sở / kho giao hàng</label>
                <input 
                  type="text" 
                  class="form-control" 
                  v-model="formData.address" 
                  maxlength="255"
                  placeholder=""
                >
              </div>

              <!-- Ghi chú -->
              <div class="mb-3">
                <label class="form-label fw-bold text-secondary small">Ghi chú đối tác</label>
                <textarea 
                  class="form-control" 
                  rows="2" 
                  v-model="formData.note" 
                  maxlength="255"
                  placeholder="Thông tin chiết khấu, chính sách đổi trả, lịch giao nhận..."
                ></textarea>
              </div>

              <!-- Trạng thái hợp tác -->
              <div class="form-check form-switch mb-4">
                <input 
                  class="form-check-input cursor-pointer" 
                  type="checkbox" 
                  role="switch" 
                  id="modalIsActiveSwitch"
                  v-model="formData.is_active"
                >
                <label class="form-check-label fw-semibold cursor-pointer text-dark small" for="modalIsActiveSwitch">
                  Đang hoạt động / Hợp tác cung ứng sách
                </label>
                <div v-if="!formData.is_active" class="text-danger small mt-1" style="font-size: 11px;">
                  Lưu ý: Nhà cung cấp ngừng hợp tác sẽ không xuất hiện trong ô chọn khi lập phiếu nhập mới.
                </div>
              </div>

              <!-- Nút Lưu -->
              <div class="d-flex justify-content-end gap-2 pt-2 border-top">
                <button type="button" class="btn btn-light" @click="closeModal()">Hủy bỏ</button>
                <button type="submit" class="btn btn-primary px-4 fw-bold" :disabled="isSaving">
                  <span v-if="isSaving" class="spinner-border spinner-border-sm me-2"></span>
                  Lưu lại
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
import { ref, reactive, onMounted } from 'vue'
import { supplierService } from '@/services/adminService'

const suppliers = ref([])
const isLoading = ref(false)
const isSaving = ref(false)
const alertMsg = ref('')
const alertType = ref('success')
const modalError = ref('')

const searchQuery = ref('')
const filterActive = ref('')

const pagination = reactive({
  page: 1,
  limit: 10,
  total: 0,
  totalPages: 1
})

const showModal = ref(false)
const isEditing = ref(false)
const formData = ref({
  supplier_id: null,
  supplier_code: '',
  supplier_name: '',
  contact_person: '',
  phone: '',
  email: '',
  address: '',
  note: '',
  is_active: true
})

const fetchSuppliers = async () => {
  try {
    isLoading.value = true
    alertMsg.value = ''
    const params = {
      page: pagination.page,
      limit: pagination.limit
    }
    if (searchQuery.value.trim()) params.search = searchQuery.value.trim()
    if (filterActive.value !== '') params.is_active = filterActive.value

    const res = await supplierService.getAll(params)
    suppliers.value = res.suppliers || []
    if (res.pagination) {
      Object.assign(pagination, res.pagination)
    }
  } catch (error) {
    alertType.value = 'danger'
    alertMsg.value = 'Lỗi tải danh sách nhà cung cấp: ' + (error.response?.data?.message || error.message)
  } finally {
    isLoading.value = false
  }
}

const handleSearch = () => {
  pagination.page = 1
  fetchSuppliers()
}

const changePage = (newPage) => {
  if (newPage < 1 || newPage > pagination.totalPages || newPage === pagination.page) return
  pagination.page = newPage
  fetchSuppliers()
}

const openModal = (sup = null) => {
  modalError.value = ''
  if (sup) {
    isEditing.value = true
    formData.value = {
      supplier_id: sup.supplier_id,
      supplier_code: sup.supplier_code || '',
      supplier_name: sup.supplier_name,
      contact_person: sup.contact_person || '',
      phone: sup.phone || '',
      email: sup.email || '',
      address: sup.address || '',
      note: sup.note || '',
      is_active: sup.is_active
    }
  } else {
    isEditing.value = false
    formData.value = {
      supplier_id: null,
      supplier_code: '',
      supplier_name: '',
      contact_person: '',
      phone: '',
      email: '',
      address: '',
      note: '',
      is_active: true
    }
  }
  showModal.value = true
}

const closeModal = () => {
  showModal.value = false
  modalError.value = ''
}

const saveSupplier = async () => {
  modalError.value = ''
  try {
    isSaving.value = true
    if (isEditing.value) {
      await supplierService.update(formData.value.supplier_id, formData.value)
      alertType.value = 'success'
      alertMsg.value = `Đã cập nhật nhà cung cấp "${formData.value.supplier_name}" thành công!`
    } else {
      await supplierService.create(formData.value)
      alertType.value = 'success'
      alertMsg.value = `Đã thêm nhà cung cấp mới "${formData.value.supplier_name}" thành công!`
    }
    closeModal()
    await fetchSuppliers()
  } catch (error) {
    modalError.value = error.response?.data?.message || 'Lỗi lưu dữ liệu: ' + error.message
  } finally {
    isSaving.value = false
  }
}

// Bật / Tắt trạng thái hợp tác (kèm cảnh báo nếu còn phiếu chờ duyệt)
const handleToggleActive = async (sup) => {
  const newStatus = !sup.is_active

  // Nếu muốn chuyển sang ngừng hợp tác mà đang có phiếu pending
  if (!newStatus && sup.pending_receipt_count > 0) {
    const confirmMsg = `Nhà cung cấp "${sup.supplier_name}" hiện đang có ${sup.pending_receipt_count} phiếu nhập kho đang ở trạng thái CHỜ DUYỆT (Pending).\n\nNếu ngừng hợp tác, bạn vẫn có thể duyệt các phiếu chờ duyệt này nhưng không thể lập thêm phiếu nhập mới.\n\nBạn có chắc chắn muốn chuyển sang trạng thái Ngừng hợp tác?`
    if (!confirm(confirmMsg)) {
      // Revert switch UI
      sup.is_active = true
      return
    }
  }

  try {
    await supplierService.update(sup.supplier_id, { is_active: newStatus })
    sup.is_active = newStatus
    alertType.value = 'success'
    alertMsg.value = `Đã chuyển trạng thái nhà cung cấp "${sup.supplier_name}" sang "${newStatus ? 'Đang hợp tác' : 'Ngừng hợp tác'}".`
  } catch (error) {
    alertType.value = 'danger'
    alertMsg.value = error.response?.data?.message || 'Lỗi cập nhật trạng thái: ' + error.message
    await fetchSuppliers()
  }
}

const handleDelete = async (sup) => {
  if (!confirm(`Bạn có chắc chắn muốn xóa nhà cung cấp "${sup.supplier_name}" không?`)) return
  try {
    await supplierService.delete(sup.supplier_id)
    alertType.value = 'success'
    alertMsg.value = `Đã xóa nhà cung cấp "${sup.supplier_name}" thành công!`
    await fetchSuppliers()
  } catch (error) {
    alertType.value = 'danger'
    alertMsg.value = error.response?.data?.message || 'Lỗi xóa nhà cung cấp: ' + error.message
  }
}

const formatCurrency = (val) => {
  if (!val && val !== 0) return '0 đ'
  return Number(val).toLocaleString('vi-VN') + ' đ'
}

onMounted(() => {
  fetchSuppliers()
})
</script>

<style scoped>
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
