<template>
  <div class="container-fluid py-2">
    <!-- Tiêu đề & Nút Thêm mới -->
    <div class="d-flex justify-content-between align-items-center mb-4">
      <h4 class="fw-bold text-dark mb-0">Quản lý Thể loại</h4>
      <button class="btn btn-primary shadow-sm" @click="openModal()">
        <i class="bi bi-plus-circle me-2"></i> Thêm thể loại mới
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
              <th scope="col" class="ps-4">ID</th>
              <th scope="col">Tên thể loại</th>
              <th scope="col">Thể loại cha (ID)</th>
              <th scope="col" class="text-end pe-4">Thao tác</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="isLoading">
              <td colspan="4" class="text-center py-4">
                <div class="spinner-border text-primary" role="status"><span class="visually-hidden">Loading...</span></div>
              </td>
            </tr>
            <tr v-else-if="categories.length === 0">
              <td colspan="4" class="text-center py-4 text-muted">Chưa có dữ liệu thể loại.</td>
            </tr>
            <tr v-else v-for="cat in categories" :key="cat.category_id">
              <td class="ps-4 fw-bold text-secondary">#{{ cat.category_id }}</td>
              <td class="fw-bold text-dark">{{ cat.category_name }}</td>
              <td>
                <span v-if="cat.parent_category_id" class="badge bg-light text-dark border">
                  {{ cat.parent_category_id }} - {{ getParentName(cat.parent_category_id) }}
                </span>
                <span v-else class="badge bg-secondary opacity-50">Không có</span>
              </td>
              <td class="text-end pe-4">
                <button class="btn btn-sm btn-outline-primary me-2" @click="openModal(cat)">
                  <i class="bi bi-pencil-square"></i>
                </button>
                <button class="btn btn-sm btn-outline-danger" @click="deleteCategory(cat.category_id)">
                  <i class="bi bi-trash"></i>
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Modal Thêm/Sửa (Custom Vue Modal) -->
    <div v-if="showModal" class="modal-backdrop fade show" style="opacity: 0.5;"></div>
    <div v-if="showModal" class="modal fade show d-block" tabindex="-1" role="dialog">
      <div class="modal-dialog modal-dialog-centered" role="document">
        <div class="modal-content border-0 shadow-lg rounded-4">
          <div class="modal-header border-bottom-0 pb-0">
            <h5 class="modal-title fw-bold">{{ isEditing ? 'Cập nhật Thể loại' : 'Thêm Thể loại mới' }}</h5>
            <button type="button" class="btn-close" @click="closeModal()"></button>
          </div>
          <div class="modal-body">
            <form @submit.prevent="saveCategory">
              <div class="mb-3">
                <label class="form-label fw-bold text-secondary small">Tên thể loại <span class="text-danger">*</span></label>
                <input type="text" class="form-control" v-model="formData.category_name" required placeholder="Nhập tên thể loại...">
              </div>
              <div class="mb-4">
                <label class="form-label fw-bold text-secondary small">Thuộc thể loại cha</label>
                <select class="form-select" v-model="formData.parent_category_id">
                  <option :value="null">-- Không có (Thể loại gốc) --</option>
                  <!-- Lọc bỏ chính nó ra khỏi danh sách cha khi đang edit -->
                  <option v-for="c in availableParents" :key="c.category_id" :value="c.category_id">
                    {{ c.category_name }}
                  </option>
                </select>
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
import { ref, onMounted, computed } from 'vue'
import { categoryService } from '@/services/adminService'

const categories = ref([])
const isLoading = ref(false)
const alertMsg = ref('')

// Modal state
const showModal = ref(false)
const isEditing = ref(false)
const isSaving = ref(false)
const formData = ref({ category_id: null, category_name: '', parent_category_id: null })

// Lọc danh sách cha khả dụng (không chọn chính nó làm cha)
const availableParents = computed(() => {
  if (!isEditing.value) return categories.value
  return categories.value.filter(c => c.category_id !== formData.value.category_id)
})

const getParentName = (parentId) => {
  const parent = categories.value.find(c => c.category_id === parentId)
  return parent ? parent.category_name : ''
}

const fetchCategories = async () => {
  try {
    isLoading.value = true
    categories.value = await categoryService.getAll()
  } catch (error) {
    alertMsg.value = 'Lỗi tải danh sách thể loại: ' + (error.response?.data?.message || error.message)
  } finally {
    isLoading.value = false
  }
}

const openModal = (cat = null) => {
  if (cat) {
    isEditing.value = true
    formData.value = { ...cat }
  } else {
    isEditing.value = false
    formData.value = { category_id: null, category_name: '', parent_category_id: null }
  }
  showModal.value = true
}

const closeModal = () => {
  showModal.value = false
}

const saveCategory = async () => {
  try {
    isSaving.value = true
    if (isEditing.value) {
      await categoryService.update(formData.value.category_id, formData.value)
      alertMsg.value = 'Cập nhật thành công!'
    } else {
      await categoryService.create(formData.value)
      alertMsg.value = 'Thêm mới thành công!'
    }
    closeModal()
    await fetchCategories()
  } catch (error) {
    alertMsg.value = 'Lỗi lưu dữ liệu: ' + (error.response?.data?.message || error.message)
  } finally {
    isSaving.value = false
  }
}

const deleteCategory = async (id) => {
  if (!confirm('Bạn có chắc chắn muốn xóa thể loại này không?')) return
  try {
    await categoryService.delete(id)
    alertMsg.value = 'Đã xóa thể loại thành công!'
    await fetchCategories()
  } catch (error) {
    alertMsg.value = error.response?.data?.message || 'Đã xảy ra lỗi không xác định khi xóa dữ liệu.'
  }
}

onMounted(() => {
  fetchCategories()
})
</script>
