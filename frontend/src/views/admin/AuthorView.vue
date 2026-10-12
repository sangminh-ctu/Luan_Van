<template>
  <div class="container-fluid py-2">
    <!-- Tiêu đề & Nút Thêm mới -->
    <div class="d-flex justify-content-between align-items-center mb-4">
      <h4 class="fw-bold text-dark mb-0">Quản lý Tác giả</h4>
      <button class="btn btn-primary shadow-sm" @click="openModal()">
        <i class="bi bi-plus-circle me-2"></i> Thêm tác giả mới
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
              <th scope="col" style="width: 250px;">Tên tác giả</th>
              <th scope="col">Tiểu sử</th>
              <th scope="col" class="text-end pe-4" style="width: 150px;">Thao tác</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="isLoading">
              <td colspan="4" class="text-center py-4">
                <div class="spinner-border text-primary" role="status"><span class="visually-hidden">Loading...</span></div>
              </td>
            </tr>
            <tr v-else-if="authors.length === 0">
              <td colspan="4" class="text-center py-4 text-muted">Chưa có dữ liệu tác giả.</td>
            </tr>
            <tr v-else v-for="author in authors" :key="author.author_id">
              <td class="ps-4 fw-bold text-secondary">#{{ author.author_id }}</td>
              <td class="fw-bold text-dark">{{ author.author_name }}</td>
              <td class="text-secondary small">{{ author.bio || 'Chưa có thông tin' }}</td>
              <td class="text-end pe-4">
                <button class="btn btn-sm btn-outline-primary me-2" @click="openModal(author)">
                  <i class="bi bi-pencil-square"></i>
                </button>
                <button class="btn btn-sm btn-outline-danger" @click="deleteAuthor(author.author_id)">
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
            <h5 class="modal-title fw-bold">{{ isEditing ? 'Cập nhật Tác giả' : 'Thêm Tác giả mới' }}</h5>
            <button type="button" class="btn-close" @click="closeModal()"></button>
          </div>
          <div class="modal-body">
            <form @submit.prevent="saveAuthor">
              <div class="mb-3">
                <label class="form-label fw-bold text-secondary small">Tên tác giả <span class="text-danger">*</span></label>
                <input type="text" class="form-control" v-model="formData.author_name" required placeholder="Nhập tên tác giả...">
              </div>
              <div class="mb-4">
                <label class="form-label fw-bold text-secondary small">Tiểu sử</label>
                <textarea class="form-control" rows="3" v-model="formData.bio" placeholder="Nhập tóm tắt tiểu sử hoặc giới thiệu..."></textarea>
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
import { authorService } from '@/services/adminService'

const authors = ref([])
const isLoading = ref(false)
const alertMsg = ref('')

// Modal state
const showModal = ref(false)
const isEditing = ref(false)
const isSaving = ref(false)
const formData = ref({ author_id: null, author_name: '', bio: '' })

const fetchAuthors = async () => {
  try {
    isLoading.value = true
    authors.value = await authorService.getAll()
  } catch (error) {
    alertMsg.value = 'Lỗi tải danh sách tác giả: ' + (error.response?.data?.message || error.message)
  } finally {
    isLoading.value = false
  }
}

const openModal = (author = null) => {
  if (author) {
    isEditing.value = true
    formData.value = { ...author }
  } else {
    isEditing.value = false
    formData.value = { author_id: null, author_name: '', bio: '' }
  }
  showModal.value = true
}

const closeModal = () => {
  showModal.value = false
}

const saveAuthor = async () => {
  try {
    isSaving.value = true
    if (isEditing.value) {
      await authorService.update(formData.value.author_id, formData.value)
      alertMsg.value = 'Cập nhật tác giả thành công!'
    } else {
      await authorService.create(formData.value)
      alertMsg.value = 'Thêm tác giả thành công!'
    }
    closeModal()
    await fetchAuthors()
  } catch (error) {
    alertMsg.value = error.response?.data?.message || 'Lỗi lưu dữ liệu: ' + error.message
  } finally {
    isSaving.value = false
  }
}

const deleteAuthor = async (id) => {
  if (!confirm('Bạn có chắc chắn muốn xóa tác giả này không?')) return
  try {
    await authorService.delete(id)
    alertMsg.value = 'Đã xóa tác giả thành công!'
    await fetchAuthors()
  } catch (error) {
    alertMsg.value = error.response?.data?.message || 'Lỗi xóa tác giả: ' + error.message
  }
}

onMounted(() => {
  fetchAuthors()
})
</script>
