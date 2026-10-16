<template>
  <div class="container-fluid py-2">
    <!-- Tiêu đề & Nút thao tác nhanh -->
    <div class="d-flex justify-content-between align-items-center mb-4">
      <div>
        <h4 class="fw-bold text-dark mb-1">Quản lý Tồn kho</h4>
        <p class="text-muted small mb-0">Theo dõi số lượng tồn thực tế của từng đầu sách và cảnh báo hết hàng</p>
      </div>
      <div class="d-flex gap-2">
        <router-link to="/admin/stock-receipts" class="btn btn-outline-secondary shadow-sm">
          <i class="bi bi-clock-history me-1"></i> Lịch sử Nhập / Xuất
        </router-link>
        <router-link to="/admin/stock-receipts/create" class="btn btn-primary shadow-sm">
          <i class="bi bi-plus-circle me-1"></i> Lập phiếu nhập kho
        </router-link>
      </div>
    </div>

    <!-- Thông báo lỗi -->
    <div v-if="alertMsg" class="alert alert-danger alert-dismissible fade show shadow-sm" role="alert">
      {{ alertMsg }}
      <button type="button" class="btn-close" @click="alertMsg = ''"></button>
    </div>

    <!-- 4 Thẻ Thống Kê Tổng Quan -->
    <div class="row g-3 mb-4">
      <div class="col-sm-6 col-xl-3">
        <div class="card border-0 shadow-sm rounded-3 p-3 bg-white h-100 border-start border-primary border-4">
          <div class="text-muted small fw-semibold mb-1">Tổng đầu sách</div>
          <div class="fs-3 fw-bold text-dark">{{ stats.total_books || 0 }}</div>
        </div>
      </div>

      <div class="col-sm-6 col-xl-3">
        <div class="card border-0 shadow-sm rounded-3 p-3 bg-white h-100 border-start border-success border-4">
          <div class="text-muted small fw-semibold mb-1">Tổng tồn kho</div>
          <div class="fs-3 fw-bold text-success">{{ formatNumber(stats.total_quantity) }}</div>
        </div>
      </div>

      <div class="col-sm-6 col-xl-3">
        <div class="card border-0 shadow-sm rounded-3 p-3 bg-white h-100 border-start border-warning border-4">
          <div class="text-muted small fw-semibold mb-1">Sắp hết hàng</div>
          <div class="fs-3 fw-bold text-warning">{{ stats.low_stock_count || 0 }}</div>
        </div>
      </div>

      <div class="col-sm-6 col-xl-3">
        <div class="card border-0 shadow-sm rounded-3 p-3 bg-white h-100 border-start border-danger border-4">
          <div class="text-muted small fw-semibold mb-1">Hết hàng</div>
          <div class="fs-3 fw-bold text-danger">{{ stats.out_of_stock_count || 0 }}</div>
        </div>
      </div>
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
            <select class="form-select shadow-none" v-model="filters.stock_status" @change="handleSearch">
              <option value="">Tất cả mức tồn</option>
              <option value="in_stock">Còn hàng</option>
              <option value="low_stock">Sắp hết hàng</option>
              <option value="out_of_stock">Hết hàng</option>
            </select>
          </div>
          <div class="col-md-2 d-flex gap-2">
            <button class="btn btn-primary w-100" @click="handleSearch">Lọc</button>
            <button class="btn btn-light" @click="resetFilter" title="Đặt lại bộ lọc"><i class="bi bi-arrow-counterclockwise"></i></button>
          </div>
        </div>
      </div>
    </div>

    <!-- Bảng Tồn kho -->
    <div class="card border-0 shadow-sm rounded-4 overflow-hidden mb-4">
      <div class="table-responsive">
        <table class="table table-hover align-middle mb-0">
          <thead class="table-light">
            <tr>
              <th scope="col" class="ps-4" style="width: 80px;">Ảnh</th>
              <th scope="col" style="min-width: 280px;">Tên sách / ISBN</th>
              <th scope="col">Thể loại</th>
              <th scope="col" class="text-center" style="width: 160px;">Tồn kho thực tế</th>
              <th scope="col" class="text-center" style="width: 150px;">Tình trạng</th>
              <th scope="col" style="width: 170px;">Cập nhật lần cuối</th>
              <th scope="col" class="text-end pe-4" style="width: 120px;">Thao tác</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="isLoading">
              <td colspan="7" class="text-center py-5">
                <div class="spinner-border text-primary" role="status"><span class="visually-hidden">Loading...</span></div>
              </td>
            </tr>
            <tr v-else-if="inventoryList.length === 0">
              <td colspan="7" class="text-center py-5 text-muted">
                <i class="bi bi-inbox fs-1 d-block mb-2 text-secondary opacity-50"></i>
                Không tìm thấy dữ liệu tồn kho phù hợp.
              </td>
            </tr>
            <tr v-else v-for="book in inventoryList" :key="book.book_id">
              <!-- Ảnh bìa -->
              <td class="ps-4">
                <img 
                  :src="getPrimaryImage(book.images)" 
                  alt="Cover" 
                  class="rounded shadow-sm border"
                  style="width: 48px; height: 64px; object-fit: cover;"
                >
              </td>

              <!-- Tên sách & ISBN -->
              <td>
                <div class="fw-bold text-dark mb-1 text-truncate" style="max-width: 320px;" :title="book.title">
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

              <!-- Số lượng tồn kho -->
              <td class="text-center">
                <span class="fs-5 fw-bold" :class="getStockTextColor(book.inventory?.stock_quantity)">
                  {{ formatNumber(book.inventory?.stock_quantity) }}
                </span>
                <span class="text-muted small ms-1">cuốn</span>
              </td>

              <!-- Nhãn tình trạng tồn kho -->
              <td class="text-center">
                <span 
                  class="badge px-3 py-2"
                  :class="getStockBadgeClass(book.inventory?.stock_quantity)"
                >
                  {{ getStockStatusText(book.inventory?.stock_quantity) }}
                </span>
              </td>

              <!-- Cập nhật lần cuối -->
              <td>
                <span class="small text-secondary">
                  {{ formatDate(book.inventory?.last_updated) }}
                </span>
              </td>

              <!-- Thao tác nhập thêm -->
              <td class="text-end pe-4">
                <router-link 
                  :to="`/admin/stock-receipts/create?book_id=${book.book_id}`" 
                  class="btn btn-sm btn-outline-primary"
                  title="Lập phiếu nhập thêm cho cuốn sách này"
                >
                  Nhập thêm
                </router-link>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Phân trang -->
      <div v-if="pagination.totalPages > 1" class="card-footer bg-white border-0 py-3 d-flex justify-content-between align-items-center">
        <span class="text-muted small">
          Hiển thị trang {{ pagination.page }} trên {{ pagination.totalPages }} (Tổng cộng {{ pagination.total }} đầu sách)
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
import { inventoryService, categoryService } from '@/services/adminService'

const inventoryList = ref([])
const categories = ref([])
const isLoading = ref(false)
const alertMsg = ref('')

const stats = reactive({
  total_books: 0,
  total_quantity: 0,
  low_stock_count: 0,
  out_of_stock_count: 0,
  low_stock_threshold: 5
})

const filters = reactive({
  search: '',
  category_id: '',
  stock_status: '',
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

const fetchInventory = async () => {
  try {
    isLoading.value = true
    alertMsg.value = ''
    const res = await inventoryService.getInventory({ ...filters })
    inventoryList.value = res.inventory
    pagination.total = res.pagination.total
    pagination.page = res.pagination.page
    pagination.totalPages = res.pagination.totalPages

    // Gán thống kê
    Object.assign(stats, res.stats)
  } catch (error) {
    alertMsg.value = 'Lỗi tải danh sách tồn kho: ' + (error.response?.data?.message || error.message)
  } finally {
    isLoading.value = false
  }
}

const handleSearch = () => {
  filters.page = 1
  fetchInventory()
}

const resetFilter = () => {
  filters.search = ''
  filters.category_id = ''
  filters.stock_status = ''
  filters.page = 1
  fetchInventory()
}

const changePage = (newPage) => {
  filters.page = newPage
  fetchInventory()
}

// Helpers định dạng
const formatNumber = (num) => {
  if (num === undefined || num === null) return '0'
  return Number(num).toLocaleString('vi-VN')
}

const formatDate = (dateStr) => {
  if (!dateStr) return 'Chưa cập nhật'
  const d = new Date(dateStr)
  return d.toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

const getStockTextColor = (qty) => {
  const q = Number(qty) || 0
  if (q === 0) return 'text-danger'
  if (q <= stats.low_stock_threshold) return 'text-warning'
  return 'text-success'
}

const getStockBadgeClass = (qty) => {
  const q = Number(qty) || 0
  if (q === 0) return 'bg-danger-subtle text-danger-emphasis border border-danger-subtle'
  if (q <= stats.low_stock_threshold) return 'bg-warning-subtle text-warning-emphasis border border-warning-subtle'
  return 'bg-success-subtle text-success-emphasis border border-success-subtle'
}

const getStockStatusText = (qty) => {
  const q = Number(qty) || 0
  if (q === 0) return 'Hết hàng'
  if (q <= stats.low_stock_threshold) return 'Sắp hết hàng'
  return 'Còn hàng'
}

const getPrimaryImage = (images) => {
  if (!images || images.length === 0) {
    return 'https://via.placeholder.com/150x200?text=No+Cover'
  }
  const primary = images.find(img => img.is_primary)
  const url = primary ? primary.image_url : images[0].image_url
  if (url && url.startsWith('/uploads')) {
    return `http://localhost:5000${url}`
  }
  return url || 'https://via.placeholder.com/150x200?text=No+Cover'
}

onMounted(() => {
  fetchCategories()
  fetchInventory()
})
</script>
