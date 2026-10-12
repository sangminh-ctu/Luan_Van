<template>
  <div class="container-fluid py-2">
    <!-- Tiêu đề & Nút Thêm mới -->
    <div class="d-flex justify-content-between align-items-center mb-4">
      <div>
        <h4 class="fw-bold text-dark mb-1">Quản lý Sách</h4>
        <p class="text-muted small mb-0">Quản lý danh mục sách, giá bán, tồn kho và trạng thái kinh doanh</p>
      </div>
      <router-link to="/admin/books/create" class="btn btn-primary shadow-sm">
        <i class="bi bi-plus-circle me-2"></i> Thêm sách mới
      </router-link>
    </div>

    <!-- Thông báo lỗi / thành công -->
    <div v-if="alertMsg" class="alert alert-info alert-dismissible fade show shadow-sm" role="alert">
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
                placeholder="Tìm theo tên sách hoặc mã ISBN..."
                @keyup.enter="handleSearch"
              >
            </div>
          </div>
          <div class="col-md-3">
            <select class="form-select shadow-none" v-model="filters.category_id" @change="handleSearch">
              <option value="">-- Tất cả thể loại --</option>
              <option v-for="cat in categories" :key="cat.category_id" :value="cat.category_id">
                {{ cat.category_name }}
              </option>
            </select>
          </div>
          <div class="col-md-2">
            <select class="form-select shadow-none" v-model="filters.is_active" @change="handleSearch">
              <option value="">-- Trạng thái --</option>
              <option value="true">Đang hiển thị</option>
              <option value="false">Đang ẩn</option>
            </select>
          </div>
          <div class="col-md-2 d-flex gap-2">
            <button class="btn btn-primary w-100" @click="handleSearch">Lọc</button>
            <button class="btn btn-light" @click="resetFilter" title="Đặt lại bộ lọc"><i class="bi bi-arrow-counterclockwise"></i></button>
          </div>
        </div>
      </div>
    </div>

    <!-- Bảng danh sách sách -->
    <div class="card border-0 shadow-sm rounded-4 overflow-hidden mb-4">
      <div class="table-responsive">
        <table class="table table-hover align-middle mb-0">
          <thead class="table-light">
            <tr>
              <th scope="col" class="ps-4" style="width: 80px;">Ảnh</th>
              <th scope="col" style="min-width: 260px;">Tên sách / ISBN</th>
              <th scope="col">Thể loại</th>
              <th scope="col">Tác giả</th>
              <th scope="col">Giá bán</th>
              <th scope="col" class="text-center">Tồn kho</th>
              <th scope="col" class="text-center">Hiển thị</th>
              <th scope="col" class="text-end pe-4" style="width: 140px;">Thao tác</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="isLoading">
              <td colspan="8" class="text-center py-5">
                <div class="spinner-border text-primary" role="status"><span class="visually-hidden">Loading...</span></div>
              </td>
            </tr>
            <tr v-else-if="books.length === 0">
              <td colspan="8" class="text-center py-5 text-muted">
                <i class="bi bi-journal-x fs-1 d-block mb-2 text-secondary opacity-50"></i>
                Không tìm thấy cuốn sách nào phù hợp.
              </td>
            </tr>
            <tr v-else v-for="book in books" :key="book.book_id">
              <!-- Ảnh bìa -->
              <td class="ps-4">
                <img 
                  :src="getPrimaryImage(book.images)" 
                  alt="Cover" 
                  class="rounded shadow-sm border"
                  style="width: 50px; height: 68px; object-fit: cover;"
                >
              </td>

              <!-- Tên sách & ISBN -->
              <td>
                <div class="fw-bold text-dark mb-1 text-truncate" style="max-width: 280px;" :title="book.title">
                  {{ book.title }}
                </div>
                <div class="text-muted small">
                  <span class="badge bg-light text-secondary border me-1">{{ book.cover_type || 'Bìa mềm' }}</span>
                  <span v-if="book.isbn">ISBN: {{ book.isbn }}</span>
                  <span v-else class="text-secondary opacity-50">Chưa có ISBN</span>
                </div>
              </td>

              <!-- Thể loại -->
              <td>
                <span class="badge bg-info-subtle text-info-emphasis border border-info-subtle">
                  {{ book.category?.category_name || 'Chưa phân loại' }}
                </span>
              </td>

              <!-- Tác giả -->
              <td>
                <div class="small text-truncate" style="max-width: 180px;">
                  {{ formatAuthors(book.book_authors) }}
                </div>
              </td>

              <!-- Giá bán & Khuyến mãi -->
              <td>
                <div class="fw-bold text-danger">
                  {{ formatCurrency(book.current_price || (book.price * (1 - book.discount_percent/100))) }}
                </div>
                <div v-if="book.discount_percent > 0" class="text-muted small text-decoration-line-through">
                  {{ formatCurrency(book.price) }} 
                  <span class="badge bg-danger ms-1">-{{ Math.round(book.discount_percent) }}%</span>
                </div>
              </td>

              <!-- Tồn kho -->
              <td class="text-center">
                <span 
                  class="badge px-3 py-2" 
                  :class="(book.inventory?.stock_quantity || 0) > 0 ? 'bg-success-subtle text-success-emphasis border border-success-subtle' : 'bg-danger-subtle text-danger-emphasis border border-danger-subtle'"
                >
                  {{ book.inventory?.stock_quantity || 0 }}
                </span>
              </td>

              <!-- Toggle Ẩn / Hiện sách -->
              <td class="text-center">
                <div class="form-check form-switch d-inline-block">
                  <input 
                    class="form-check-input cursor-pointer" 
                    type="checkbox" 
                    role="switch"
                    :checked="book.is_active"
                    @change="toggleStatus(book)"
                  >
                </div>
              </td>

              <!-- Thao tác Sửa / Xóa -->
              <td class="text-end pe-4">
                <router-link :to="`/admin/books/${book.book_id}/edit`" class="btn btn-sm btn-outline-primary me-2" title="Chỉnh sửa">
                  <i class="bi bi-pencil-square"></i>
                </router-link>
                <button class="btn btn-sm btn-outline-danger" @click="deleteBook(book.book_id)" title="Xóa sách">
                  <i class="bi bi-trash"></i>
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Phân trang -->
      <div v-if="pagination.totalPages > 1" class="card-footer bg-white border-0 py-3 d-flex justify-content-between align-items-center">
        <span class="text-muted small">
          Hiển thị trang {{ pagination.page }} trên {{ pagination.totalPages }} (Tổng cộng {{ pagination.total }} sách)
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
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { bookService, categoryService } from '@/services/adminService'

const books = ref([])
const categories = ref([])
const isLoading = ref(false)
const alertMsg = ref('')

const filters = reactive({
  search: '',
  category_id: '',
  is_active: '',
  page: 1,
  limit: 10
})

const pagination = reactive({
  total: 0,
  page: 1,
  limit: 10,
  totalPages: 1
})

const fetchCategories = async () => {
  try {
    categories.value = await categoryService.getAll()
  } catch (error) {
    console.error('Lỗi tải thể loại:', error)
  }
}

const fetchBooks = async () => {
  try {
    isLoading.value = true
    const res = await bookService.getAll({ ...filters })
    books.value = res.books
    pagination.total = res.pagination.total
    pagination.page = res.pagination.page
    pagination.totalPages = res.pagination.totalPages
  } catch (error) {
    alertMsg.value = 'Lỗi tải danh sách sách: ' + (error.response?.data?.message || error.message)
  } finally {
    isLoading.value = false
  }
}

const handleSearch = () => {
  filters.page = 1
  fetchBooks()
}

const resetFilter = () => {
  filters.search = ''
  filters.category_id = ''
  filters.is_active = ''
  filters.page = 1
  fetchBooks()
}

const changePage = (newPage) => {
  filters.page = newPage
  fetchBooks()
}

// Bật / Tắt Ẩn Hiện Sách (Soft Toggle)
const toggleStatus = async (book) => {
  try {
    const nextStatus = !book.is_active
    await bookService.toggleActive(book.book_id, nextStatus)
    book.is_active = nextStatus
    alertMsg.value = `Đã ${nextStatus ? 'hiển thị' : 'ẩn'} cuốn sách: "${book.title}"`
  } catch (error) {
    alertMsg.value = 'Lỗi cập nhật trạng thái: ' + (error.response?.data?.message || error.message)
    // Hoàn tác lại trạng thái UI nếu lỗi
    book.is_active = !book.is_active
  }
}

// Xóa sách vĩnh viễn
const deleteBook = async (id) => {
  if (!confirm('Bạn có chắc chắn muốn xóa cuốn sách này? Lưu ý: Nếu sách đã có đơn hàng hoặc phiếu nhập xuất, hệ thống sẽ từ chối xóa.')) return
  try {
    await bookService.delete(id)
    alertMsg.value = 'Đã xóa sách thành công!'
    await fetchBooks()
  } catch (error) {
    alertMsg.value = error.response?.data?.message || 'Lỗi xóa sách: ' + error.message
  }
}

// Helper: Tìm ảnh chính hoặc ảnh đầu tiên
const getPrimaryImage = (images) => {
  if (!images || images.length === 0) {
    return 'https://via.placeholder.com/150x200?text=No+Cover'
  }
  const primary = images.find(img => img.is_primary)
  const url = primary ? primary.image_url : images[0].image_url
  // Nếu là ảnh upload local thì ghép domain localhost
  if (url.startsWith('/uploads')) {
    return `http://localhost:5000${url}`
  }
  return url
}

// Helper: Định dạng danh sách tác giả
const formatAuthors = (bookAuthors) => {
  if (!bookAuthors || bookAuthors.length === 0) return 'Chưa có tác giả'
  return bookAuthors.map(ba => ba.author?.author_name || 'Vô danh').join(', ')
}

// Helper: Định dạng tiền tệ VND
const formatCurrency = (val) => {
  if (!val && val !== 0) return '0 đ'
  return Number(val).toLocaleString('vi-VN') + ' đ'
}

onMounted(() => {
  fetchCategories()
  fetchBooks()
})
</script>

<style scoped>
.cursor-pointer {
  cursor: pointer;
}
</style>
