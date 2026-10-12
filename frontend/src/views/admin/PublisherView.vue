<template>
  <div class="container-fluid py-2">
    <!-- Tiêu đề & Nút Thêm mới -->
    <div class="d-flex justify-content-between align-items-center mb-4">
      <h4 class="fw-bold text-dark mb-0">Quản lý Nhà xuất bản</h4>
      <button class="btn btn-primary shadow-sm" @click="openModal()">
        <i class="bi bi-plus-circle me-2"></i> Thêm NXB mới
      </button>
    </div>

    <!-- Thông báo lỗi/thành công -->
    <div v-if="alertMsg" class="alert alert-info alert-dismissible fade show shadow-sm" role="alert">
      {{ alertMsg }}
      <button type="button" class="btn-close" @click="alertMsg = ''"></button>
    </div>

    <!-- Bảng dữ liệu -->
    <div class="card border-0 shadow-sm rounded-4 overflow-hidden">
      <div class="table-responsive">
        <table class="table table-hover align-middle mb-0">
          <thead class="table-light">
            <tr>
              <th scope="col" class="ps-4" style="width: 100px;">ID</th>
              <th scope="col" style="width: 250px;">Tên nhà xuất bản</th>
              <th scope="col">Địa chỉ</th>
              <th scope="col" class="text-end pe-4" style="width: 150px;">Thao tác</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="isLoading">
              <td colspan="4" class="text-center py-4">
                <div class="spinner-border text-primary" role="status"><span class="visually-hidden">Loading...</span></div>
              </td>
            </tr>
            <tr v-else-if="publishers.length === 0">
              <td colspan="4" class="text-center py-4 text-muted">Chưa có dữ liệu nhà xuất bản.</td>
            </tr>
            <tr v-else v-for="pub in publishers" :key="pub.publisher_id">
              <td class="ps-4 fw-bold text-secondary">#{{ pub.publisher_id }}</td>
              <td class="fw-bold text-dark">{{ pub.publisher_name }}</td>
              <td class="text-secondary small">{{ pub.address || 'Chưa có thông tin' }}</td>
              <td class="text-end pe-4">
                <button class="btn btn-sm btn-outline-primary me-2" @click="openModal(pub)">
                  <i class="bi bi-pencil-square"></i>
                </button>
                <button class="btn btn-sm btn-outline-danger" @click="deletePublisher(pub.publisher_id)">
                  <i class="bi bi-trash"></i>
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Modal Thêm/Sửa (Bootstrap 5 Styled Modal) -->
    <div v-if="showModal" class="modal-backdrop fade show" style="opacity: 0.5;"></div>
    <div v-if="showModal" class="modal fade show d-block" tabindex="-1" role="dialog">
      <div class="modal-dialog modal-dialog-centered" role="document">
        <div class="modal-content border-0 shadow-lg rounded-4">
          <div class="modal-header border-bottom-0 pb-0">
            <h5 class="modal-title fw-bold">{{ isEditing ? 'Cập nhật Nhà xuất bản' : 'Thêm Nhà xuất bản mới' }}</h5>
            <button type="button" class="btn-close" @click="closeModal()"></button>
          </div>
          <div class="modal-body">
            <form @submit.prevent="savePublisher">
              <div class="mb-3">
                <label class="form-label fw-bold text-secondary small">Tên nhà xuất bản <span class="text-danger">*</span></label>
                <input type="text" class="form-control" v-model="formData.publisher_name" required placeholder="Nhập tên nhà xuất bản...">
              </div>
              <div class="mb-4">
                <label class="form-label fw-bold text-secondary small">Địa chỉ</label>
                <input type="text" class="form-control" v-model="formData.address" placeholder="Nhập địa chỉ trụ sở NXB...">
              </div>
              <div class="d-flex justify-content-end gap-2">
                <button type="button" class="btn btn-light" @click="closeModal()">Hủy bỏ</button>
                <button type="submit" class="btn btn-primary px-4" :disabled="isSaving">
                  <span v-if="isSaving" class="spinner-border spinner-border-sm me-2"></span>
                  Lưu lại
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
    <!-- End Modal -->
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { publisherService } from '@/services/adminService'

const publishers = ref([])
const isLoading = ref(false)
const alertMsg = ref('')

// Modal state
const showModal = ref(false)
const isEditing = ref(false)
const isSaving = ref(false)
const formData = ref({ publisher_id: null, publisher_name: '', address: '' })

const fetchPublishers = async () => {
  try {
    isLoading.value = true
    publishers.value = await publisherService.getAll()
  } catch (error) {
    alertMsg.value = 'Lỗi tải danh sách nhà xuất bản: ' + (error.response?.data?.message || error.message)
  } finally {
    isLoading.value = false
  }
}

const openModal = (pub = null) => {
  if (pub) {
    isEditing.value = true
    formData.value = { ...pub }
  } else {
    isEditing.value = false
    formData.value = { publisher_id: null, publisher_name: '', address: '' }
  }
  showModal.value = true
}

const closeModal = () => {
  showModal.value = false
}

const savePublisher = async () => {
  try {
    isSaving.value = true
    if (isEditing.value) {
      await publisherService.update(formData.value.publisher_id, formData.value)
      alertMsg.value = 'Cập nhật nhà xuất bản thành công!'
    } else {
      await publisherService.create(formData.value)
      alertMsg.value = 'Thêm nhà xuất bản thành công!'
    }
    closeModal()
    await fetchPublishers()
  } catch (error) {
    alertMsg.value = error.response?.data?.message || 'Lỗi lưu dữ liệu: ' + error.message
  } finally {
    isSaving.value = false
  }
}

const deletePublisher = async (id) => {
  if (!confirm('Bạn có chắc chắn muốn xóa nhà xuất bản này không?')) return
  try {
    await publisherService.delete(id)
    alertMsg.value = 'Đã xóa nhà xuất bản thành công!'
    await fetchPublishers()
  } catch (error) {
    alertMsg.value = error.response?.data?.message || 'Lỗi xóa NXB: ' + error.message
  }
}

onMounted(() => {
  fetchPublishers()
})
</script>
