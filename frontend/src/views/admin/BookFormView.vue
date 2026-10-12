<template>
  <div class="container-fluid py-2">
    <!-- Nút quay lại & Tiêu đề -->
    <div class="d-flex align-items-center mb-4">
      <router-link to="/admin/books" class="btn btn-light me-3 shadow-sm rounded-circle p-2 d-flex align-items-center justify-content-center" style="width: 40px; height: 40px;">
        <i class="bi bi-arrow-left fs-5"></i>
      </router-link>
      <div>
        <h4 class="fw-bold text-dark mb-0">{{ isEditMode ? 'Chỉnh sửa Sách' : 'Thêm Sách mới' }}</h4>
        <small class="text-muted">{{ isEditMode ? 'Cập nhật thông tin chi tiết' : 'Tạo mới cuốn sách kèm tác giả, hình ảnh và khởi tạo tồn kho' }}</small>
      </div>
    </div>

    <!-- Thông báo lỗi / thành công -->
    <div v-if="alertMsg" class="alert alert-danger alert-dismissible fade show shadow-sm" role="alert">
      {{ alertMsg }}
      <button type="button" class="btn-close" @click="alertMsg = ''"></button>
    </div>

    <form @submit.prevent="handleSubmit">
      <div class="row g-4">
        
        <!-- CỘT TRÁI: Thông tin chính -->
        <div class="col-lg-8">
          
          <!-- KHỐI 1: Thông tin cơ bản -->
          <div class="card border-0 shadow-sm rounded-4 mb-4">
            <div class="card-header bg-white border-bottom-0 pt-4 px-4 pb-0">
              <h5 class="fw-bold mb-0 text-primary"><i class="bi bi-info-circle me-2"></i>1. Thông tin chung</h5>
            </div>
            <div class="card-body p-4">
              <div class="mb-3">
                <label class="form-label fw-bold text-secondary small">Tên sách <span class="text-danger">*</span></label>
                <input type="text" class="form-control" v-model="form.title" required placeholder="Nhập tên đầy đủ của cuốn sách...">
              </div>

              <div class="row g-3 mb-3">
                <div class="col-md-6">
                  <label class="form-label fw-bold text-secondary small">Mã ISBN (10 hoặc 13 số)</label>
                  <input type="text" class="form-control" v-model="form.isbn" placeholder="Ví dụ: 9786045892345">
                </div>
                <div class="col-md-6">
                  <label class="form-label fw-bold text-secondary small">Loại bìa</label>
                  <input 
                    type="text" 
                    class="form-control" 
                    list="coverTypeOptions" 
                    v-model="form.cover_type" 
                    placeholder="Chọn gợi ý hoặc tự nhập loại bìa mới..."
                  >
                  <datalist id="coverTypeOptions">
                    <option value="Bìa mềm"></option>
                    <option value="Bìa cứng"></option>
                    <option value="Bìa gập (Tay gập)"></option>
                    <option value="Bìa da"></option>
                    <option value="Bìa áo (Dust jacket)"></option>
                    <option value="Boxset (Bộ hộp)"></option>
                  </datalist>
                </div>
              </div>

              <div class="row g-3 mb-3">
                <div class="col-md-6">
                  <label class="form-label fw-bold text-secondary small">Năm xuất bản</label>
                  <input type="number" class="form-control" v-model.number="form.publication_year" placeholder="VD: 2024">
                </div>
                <div class="col-md-6">
                  <label class="form-label fw-bold text-secondary small">Số trang</label>
                  <input type="number" class="form-control" v-model.number="form.page_count" placeholder="VD: 320">
                </div>
              </div>

              <!-- Kích thước và Trọng lượng (Phục vụ đóng gói & Vận chuyển) -->
              <div class="row g-3 mb-3 p-3 bg-light rounded-3 border">
                <div class="col-md-3">
                  <label class="form-label fw-bold text-secondary small">Trọng lượng (gram)</label>
                  <input type="number" step="0.1" class="form-control" v-model.number="form.weight" placeholder="VD: 450">
                </div>
                <div class="col-md-3">
                  <label class="form-label fw-bold text-secondary small">Chiều dài (cm)</label>
                  <input type="number" step="0.1" class="form-control" v-model.number="form.length" placeholder="VD: 20.5">
                </div>
                <div class="col-md-3">
                  <label class="form-label fw-bold text-secondary small">Chiều rộng (cm)</label>
                  <input type="number" step="0.1" class="form-control" v-model.number="form.width" placeholder="VD: 14.5">
                </div>
                <div class="col-md-3">
                  <label class="form-label fw-bold text-secondary small">Độ dày / cao (cm)</label>
                  <input type="number" step="0.1" class="form-control" v-model.number="form.height" placeholder="VD: 1.8">
                </div>
                <div class="col-12 mt-2">
                  <small class="text-muted fst-italic">
                    <i class="bi bi-box-seam me-1"></i> Kích thước đóng gói: 
                    <strong>{{ (form.length || 0) }} x {{ (form.width || 0) }} x {{ (form.height || 0) }} cm</strong>
                  </small>
                </div>
              </div>

              <div class="mb-0">
                <label class="form-label fw-bold text-secondary small">Mô tả nội dung sách</label>
                <textarea class="form-control" rows="4" v-model="form.description" placeholder="Nhập tóm tắt giới thiệu cuốn sách..."></textarea>
              </div>
            </div>
          </div>

          <!-- KHỐI 2: Giá cả & Khuyến mãi -->
          <div class="card border-0 shadow-sm rounded-4 mb-4">
            <div class="card-header bg-white border-bottom-0 pt-4 px-4 pb-0">
              <h5 class="fw-bold mb-0 text-primary"><i class="bi bi-tag me-2"></i>2. Giá cả & Khuyến mãi</h5>
            </div>
            <div class="card-body p-4">
              <div class="row g-3 align-items-center">
                <div class="col-md-4">
                  <label class="form-label fw-bold text-secondary small">Giá niêm yết (Gốc) <span class="text-danger">*</span></label>
                  <div class="input-group">
                    <input type="number" min="0" step="1000" class="form-control" v-model.number="form.price" required placeholder="0">
                    <span class="input-group-text">đ</span>
                  </div>
                </div>
                <div class="col-md-4">
                  <label class="form-label fw-bold text-secondary small">Giảm giá (%)</label>
                  <div class="input-group">
                    <input type="number" min="0" max="100" class="form-control" v-model.number="form.discount_percent">
                    <span class="input-group-text">%</span>
                  </div>
                </div>
                <div class="col-md-4">
                  <label class="form-label fw-bold text-secondary small">Giá bán thực tế (Preview)</label>
                  <div class="fs-5 fw-bold text-danger py-1">
                    {{ computedCurrentPrice }}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- KHỐI 3: Tác giả & Dịch giả (Dynamic Array) -->
          <div class="card border-0 shadow-sm rounded-4 mb-4">
            <div class="card-header bg-white border-bottom-0 pt-4 px-4 pb-0 d-flex justify-content-between align-items-center">
              <h5 class="fw-bold mb-0 text-primary"><i class="bi bi-people me-2"></i>3. Danh sách Tác giả / Dịch giả <span class="text-danger">*</span></h5>
              <button type="button" class="btn btn-sm btn-outline-primary" @click="addAuthorRow">
                <i class="bi bi-plus me-1"></i>Thêm tác giả
              </button>
            </div>
            <div class="card-body p-4">
              <div v-if="form.authors.length === 0" class="text-center py-3 text-muted small border rounded-3 bg-light">
                Chưa có tác giả nào. Hãy bấm "Thêm tác giả" ở trên.
              </div>
              <div v-for="(item, index) in form.authors" :key="index" class="row g-2 align-items-center mb-2">
                <div class="col-7">
                  <select class="form-select" v-model="item.author_id" required>
                    <option value="" disabled>-- Chọn tác giả --</option>
                    <option v-for="auth in authorsList" :key="auth.author_id" :value="auth.author_id">
                      {{ auth.author_name }}
                    </option>
                  </select>
                </div>
                <div class="col-4">
                  <select class="form-select" v-model="item.role">
                    <option value="author">Tác giả</option>
                    <option value="translator">Dịch giả</option>
                  </select>
                </div>
                <div class="col-1 text-end">
                  <button type="button" class="btn btn-outline-danger btn-sm p-1" @click="removeAuthorRow(index)" :disabled="form.authors.length <= 1">
                    <i class="bi bi-x-lg"></i>
                  </button>
                </div>
              </div>
            </div>
          </div>

        </div>

        <!-- CỘT PHẢI: Phân loại, Trạng thái & Upload Hình ảnh -->
        <div class="col-lg-4">
          
          <!-- Phân loại & Xuất bản -->
          <div class="card border-0 shadow-sm rounded-4 mb-4">
            <div class="card-header bg-white border-bottom-0 pt-4 px-4 pb-0">
              <h5 class="fw-bold mb-0 text-primary"><i class="bi bi-folder2-open me-2"></i>Phân loại</h5>
            </div>
            <div class="card-body p-4">
              <div class="mb-3">
                <label class="form-label fw-bold text-secondary small">Thể loại sách <span class="text-danger">*</span></label>
                <select class="form-select" v-model="form.category_id" required>
                  <option value="" disabled>-- Chọn thể loại --</option>
                  <option v-for="cat in categoriesList" :key="cat.category_id" :value="cat.category_id">
                    {{ cat.category_name }}
                  </option>
                </select>
              </div>

              <div class="mb-3">
                <label class="form-label fw-bold text-secondary small">Nhà xuất bản</label>
                <select class="form-select" v-model="form.publisher_id">
                  <option :value="null">-- Không có / Khác --</option>
                  <option v-for="pub in publishersList" :key="pub.publisher_id" :value="pub.publisher_id">
                    {{ pub.publisher_name }}
                  </option>
                </select>
              </div>

              <div class="form-check form-switch pt-2">
                <input class="form-check-input" type="checkbox" role="switch" id="activeSwitch" v-model="form.is_active">
                <label class="form-check-label fw-bold small text-secondary" for="activeSwitch">Hiển thị bán trên website</label>
              </div>
            </div>
          </div>

          <!-- Quản lý Hình ảnh & Upload Multer -->
          <div class="card border-0 shadow-sm rounded-4 mb-4">
            <div class="card-header bg-white border-bottom-0 pt-4 px-4 pb-0">
              <h5 class="fw-bold mb-0 text-primary"><i class="bi bi-image me-2"></i>Hình ảnh bìa sách</h5>
            </div>
            <div class="card-body p-4">
              <!-- Nút chọn file tải lên -->
              <div class="mb-3">
                <label class="btn btn-outline-primary w-100 py-2 border-dashed d-flex align-items-center justify-content-center cursor-pointer">
                  <i class="bi bi-cloud-arrow-up me-2 fs-5"></i>
                  <span>{{ isUploading ? 'Đang tải ảnh lên...' : 'Tải ảnh từ máy tính' }}</span>
                  <input type="file" class="d-none" accept="image/*" @change="handleFileUpload" :disabled="isUploading">
                </label>
                <small class="text-muted d-block text-center mt-1" style="font-size: 11px;">Chấp nhận JPG, PNG, WEBP (Tối đa 5MB)</small>
              </div>

              <!-- Danh sách preview ảnh -->
              <div v-if="form.images.length === 0" class="text-center py-4 text-muted small border rounded-3 bg-light">
                Chưa có hình ảnh nào.
              </div>
              <div v-else class="d-flex flex-column gap-2">
                <div 
                  v-for="(img, idx) in form.images" 
                  :key="idx" 
                  class="d-flex align-items-center p-2 border rounded-3"
                  :class="{ 'border-primary bg-primary-subtle': img.is_primary }"
                >
                  <img :src="getImageUrl(img.image_url)" alt="thumb" class="rounded me-2" style="width: 45px; height: 60px; object-fit: cover;">
                  <div class="flex-grow-1 overflow-hidden">
                    <div class="form-check">
                      <input 
                        class="form-check-input" 
                        type="radio" 
                        name="primaryImgRadio" 
                        :id="`imgRadio${idx}`" 
                        :checked="img.is_primary"
                        @change="setPrimaryImage(idx)"
                      >
                      <label class="form-check-label small fw-bold cursor-pointer" :for="`imgRadio${idx}`">
                        {{ img.is_primary ? 'Ảnh chính' : 'Ảnh phụ' }}
                      </label>
                    </div>
                  </div>
                  <button type="button" class="btn btn-sm btn-outline-danger p-1" @click="removeImage(idx)">
                    <i class="bi bi-trash"></i>
                  </button>
                </div>
              </div>
            </div>
          </div>

          <!-- Nút Lưu -->
          <div class="d-flex gap-2">
            <router-link to="/admin/books" class="btn btn-light w-50 py-2 fw-bold">Hủy bỏ</router-link>
            <button type="submit" class="btn btn-primary w-50 py-2 fw-bold shadow-sm" :disabled="isSaving">
              <span v-if="isSaving" class="spinner-border spinner-border-sm me-2"></span>
              {{ isEditMode ? 'Cập nhật' : 'Tạo sách' }}
            </button>
          </div>

        </div>

      </div>
    </form>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { 
  bookService, 
  categoryService, 
  authorService, 
  publisherService 
} from '@/services/adminService'

const route = useRoute()
const router = useRouter()

const isEditMode = computed(() => !!route.params.id)
const isSaving = ref(false)
const isUploading = ref(false)
const alertMsg = ref('')

// Dropdowns data
const categoriesList = ref([])
const authorsList = ref([])
const publishersList = ref([])

// Form state
const form = reactive({
  title: '',
  isbn: '',
  cover_type: 'Bìa mềm',
  price: 0,
  discount_percent: 0,
  description: '',
  publication_year: new Date().getFullYear(),
  page_count: null,
  weight: null,
  length: null,
  width: null,
  height: null,
  category_id: '',
  publisher_id: null,
  is_active: true,
  authors: [{ author_id: '', role: 'author' }],
  images: []
})

// Tính giá bán thực tế
const computedCurrentPrice = computed(() => {
  const p = Number(form.price) || 0
  const d = Number(form.discount_percent) || 0
  const current = p * (1 - d / 100)
  return Math.round(current).toLocaleString('vi-VN') + ' đ'
})

// Tác giả Actions
const addAuthorRow = () => {
  form.authors.push({ author_id: '', role: 'author' })
}

const removeAuthorRow = (index) => {
  form.authors.splice(index, 1)
}

// Upload file ảnh thật qua Multer
const handleFileUpload = async (e) => {
  const file = e.target.files[0]
  if (!file) return

  try {
    isUploading.value = true
    alertMsg.value = ''
    const res = await bookService.uploadImage(file)
    // Thêm ảnh vào mảng images
    const isFirst = form.images.length === 0
    form.images.push({
      image_url: res.image_url,
      is_primary: isFirst
    })
  } catch (error) {
    alertMsg.value = error.response?.data?.message || 'Lỗi tải ảnh lên: ' + error.message
  } finally {
    isUploading.value = false
    e.target.value = ''
  }
}

const setPrimaryImage = (selectedIndex) => {
  form.images.forEach((img, idx) => {
    img.is_primary = idx === selectedIndex
  })
}

const removeImage = (index) => {
  const removed = form.images.splice(index, 1)[0]
  // Nếu vừa xóa ảnh chính mà vẫn còn ảnh khác, đặt ảnh đầu tiên làm ảnh chính
  if (removed.is_primary && form.images.length > 0) {
    form.images[0].is_primary = true
  }
}

const getImageUrl = (url) => {
  if (url && url.startsWith('/uploads')) {
    return `http://localhost:5000${url}`
  }
  return url || 'https://via.placeholder.com/150x200?text=No+Cover'
}

// Load dropdowns
const loadDropdowns = async () => {
  try {
    const [cats, auths, pubs] = await Promise.all([
      categoryService.getAll(),
      authorService.getAll(),
      publisherService.getAll()
    ])
    categoriesList.value = cats
    authorsList.value = auths
    publishersList.value = pubs
  } catch (error) {
    console.error('Lỗi tải danh mục dropdown:', error)
  }
}

// Load chi tiết sách khi ở chế độ Edit
const loadBookDetails = async (id) => {
  try {
    const book = await bookService.getById(id)
    form.title = book.title
    form.isbn = book.isbn || ''
    form.cover_type = book.cover_type || 'Bìa mềm'
    form.price = Number(book.price)
    form.discount_percent = Number(book.discount_percent) || 0
    form.description = book.description || ''
    form.publication_year = book.publication_year
    form.page_count = book.page_count
    form.weight = book.weight
    form.length = book.length
    form.width = book.width
    form.height = book.height
    form.category_id = book.category_id
    form.publisher_id = book.publisher_id
    form.is_active = book.is_active

    // Map tác giả
    if (book.book_authors && book.book_authors.length > 0) {
      form.authors = book.book_authors.map(ba => ({
        author_id: ba.author_id,
        role: ba.role || 'author'
      }))
    }

    // Map ảnh (giữ lại image_id để bảo toàn embedding_vector)
    if (book.images && book.images.length > 0) {
      form.images = book.images.map(img => ({
        image_id: img.image_id,
        image_url: img.image_url,
        is_primary: img.is_primary
      }))
    }
  } catch (error) {
    alertMsg.value = 'Lỗi tải thông tin sách: ' + (error.response?.data?.message || error.message)
  }
}

// Submit Form
const handleSubmit = async () => {
  // Validate tác giả
  const validAuthors = form.authors.filter(a => a.author_id)
  if (validAuthors.length === 0) {
    alertMsg.value = 'Vui lòng chọn ít nhất 1 tác giả cho cuốn sách!'
    return
  }

  try {
    isSaving.value = true
    const discountVal = form.discount_percent === '' || form.discount_percent === null ? 0 : Number(form.discount_percent)
    if (isNaN(discountVal) || discountVal < 0 || discountVal > 100) {
      alertMsg.value = 'Phần trăm giảm giá phải nằm trong khoảng từ 0% đến 100%!'
      return
    }

    const payload = {
      ...form,
      price: Number(form.price) || 0,
      discount_percent: discountVal,
      authors: validAuthors
    }

    if (isEditMode.value) {
      await bookService.update(route.params.id, payload)
    } else {
      await bookService.create(payload)
    }

    router.push('/admin/books')
  } catch (error) {
    alertMsg.value = error.response?.data?.message || 'Lỗi lưu thông tin sách: ' + error.message
  } finally {
    isSaving.value = false
  }
}

onMounted(async () => {
  await loadDropdowns()
  if (isEditMode.value) {
    await loadBookDetails(route.params.id)
  }
})
</script>

<style scoped>
.border-dashed {
  border-style: dashed !important;
  border-width: 2px !important;
}
.cursor-pointer {
  cursor: pointer;
}
</style>
