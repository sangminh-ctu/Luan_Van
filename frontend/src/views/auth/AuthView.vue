<template>
  <div class="container py-5 d-flex justify-content-center align-items-center" style="min-height: 80vh;">
    <div class="card shadow-lg border-0 w-100 overflow-hidden" style="max-width: 900px;">
      <div class="row g-0">
        
        <!-- CỘT TRÁI: Hình ảnh và Quyền lợi -->
        <div class="col-md-5 d-none d-md-flex flex-column border-end">
          <div class="p-0 flex-grow-1 position-relative overflow-hidden">
            <img src="../../assets/images/banners/banner6.jpg" alt="Shopping" class="w-100 h-100 position-absolute top-0 start-0" style="object-fit: cover;">
          </div>
          <div class="p-4 bg-white z-1 shadow-sm">
            <h6 class="fw-bold mb-3 text-uppercase">Quyền lợi thành viên</h6>
            <ul class="list-unstyled text-muted small" style="line-height: 1.6;">
              <li class="mb-2 d-flex align-items-start">
                <i class="bi bi-check-circle-fill text-info me-2 mt-1"></i>
                <span>Mua hàng cực dễ dàng, nhanh chóng</span>
              </li>
              <li class="mb-2 d-flex align-items-start">
                <i class="bi bi-check-circle-fill text-info me-2 mt-1"></i>
                <span>Theo dõi chi tiết đơn hàng, địa chỉ thanh toán dễ dàng</span>
              </li>
              <li class="mb-2 d-flex align-items-start">
                <i class="bi bi-check-circle-fill text-info me-2 mt-1"></i>
                <span>Nhận nhiều chương trình ưu đãi hấp dẫn từ chúng tôi</span>
              </li>
            </ul>
          </div>
        </div>

        <!-- CỘT PHẢI: Form Đăng nhập / Đăng ký -->
        <div class="col-md-7 d-flex flex-column bg-white">
          
          <!-- Nav Tabs Bootstrap -->
          <ul class="nav nav-tabs nav-justified border-bottom-0 shadow-sm" role="tablist">
            <li class="nav-item" role="presentation">
              <button 
                class="nav-link py-3 fw-bold rounded-0 border-0 border-bottom"
                :class="activeTab === 'login' ? 'active text-info border-info border-3' : 'text-secondary border-transparent'"
                @click="switchTab('login')"
                type="button"
                style="transition: all 0.2s;"
              >
                Đăng nhập
              </button>
            </li>
            <li class="nav-item" role="presentation">
              <button 
                class="nav-link py-3 fw-bold rounded-0 border-0 border-bottom"
                :class="activeTab === 'register' ? 'active text-info border-info border-3' : 'text-secondary border-transparent'"
                @click="switchTab('register')"
                type="button"
                style="transition: all 0.2s;"
              >
                Đăng ký
              </button>
            </li>
          </ul>

          <div class="p-4 p-md-5 flex-grow-1 d-flex flex-column justify-content-center">
            
            <div v-if="errorMessage" class="alert alert-danger p-2 mb-3 text-center small">
              <i class="bi bi-exclamation-triangle-fill me-1"></i> {{ errorMessage }}
            </div>

            <!-- FORM ĐĂNG NHẬP -->
            <form v-if="activeTab === 'login'" @submit.prevent="handleLogin">
              <div class="mb-3">
                <label class="form-label fw-bold text-uppercase text-secondary small">Email <span class="text-danger">*</span></label>
                <input type="email" v-model="loginForm.email" class="form-control" placeholder="Nhập Địa chỉ Email" required />
              </div>
              <div class="mb-2">
                <label class="form-label fw-bold text-uppercase text-secondary small">Mật khẩu <span class="text-danger">*</span></label>
                <input type="password" v-model="loginForm.password" class="form-control" placeholder="Nhập Mật khẩu" required minlength="6" />
              </div>
              <div class="text-end mb-4">
                <a href="#" class="text-info text-decoration-none small">Quên mật khẩu?</a>
              </div>
              
              <button type="submit" class="btn btn-info text-white w-100 fw-bold py-2 mb-3" :disabled="isLoading">
                <span v-if="isLoading" class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                {{ isLoading ? 'ĐANG XỬ LÝ...' : 'ĐĂNG NHẬP' }}
              </button>
              <p class="text-center text-muted small mx-auto" style="max-width: 90%;">
                Fahasa cam kết bảo mật và sẽ không bao giờ đăng hay chia sẻ thông tin mà chưa có được sự đồng ý của bạn.
              </p>
            </form>

            <!-- FORM ĐĂNG KÝ -->
            <form v-else @submit.prevent="handleRegister">
              <div class="mb-3">
                <label class="form-label fw-bold text-uppercase text-secondary small">Họ và tên <span class="text-danger">*</span></label>
                <input type="text" v-model="registerForm.fullName" class="form-control" placeholder="Nhập Họ và tên" required />
              </div>
              <div class="mb-3">
                <label class="form-label fw-bold text-uppercase text-secondary small">Email <span class="text-danger">*</span></label>
                <input type="email" v-model="registerForm.email" class="form-control" placeholder="Nhập Địa chỉ Email" required />
              </div>
              <div class="mb-3">
                <label class="form-label fw-bold text-uppercase text-secondary small">Mật khẩu <span class="text-danger">*</span></label>
                <input type="password" v-model="registerForm.password" class="form-control" placeholder="Nhập Mật khẩu" required minlength="6" />
              </div>
              <div class="mb-4">
                <label class="form-label fw-bold text-uppercase text-secondary small">Số điện thoại</label>
                <input type="text" v-model="registerForm.phone" class="form-control" placeholder="Nhập Số điện thoại (Tùy chọn)" />
              </div>
              
              <button type="submit" class="btn btn-info text-white w-100 fw-bold py-2 mb-3" :disabled="isLoading">
                <span v-if="isLoading" class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                {{ isLoading ? 'ĐANG XỬ LÝ...' : 'TẠO TÀI KHOẢN' }}
              </button>
            </form>

            <!-- MẠNG XÃ HỘI (Chung cho cả 2 tab) -->
            <div class="position-relative text-center my-4">
              <hr class="text-muted">
              <span class="position-absolute top-50 start-50 translate-middle bg-white px-3 text-muted small border rounded-pill">
                hoặc đăng nhập qua
              </span>
            </div>
            
            <div class="row g-2">
              <div class="col-6">
                <button type="button" class="btn w-100 text-white d-flex align-items-center justify-content-center" style="background-color: #3b5998;">
                  <i class="bi bi-facebook me-2"></i> Facebook
                </button>
              </div>
              <div class="col-6">
                <button type="button" class="btn w-100 text-white d-flex align-items-center justify-content-center" style="background-color: #dd4b39;">
                  <i class="bi bi-google me-2"></i> Google
                </button>
              </div>
            </div>

          </div>
        </div>

      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import authService from '@/services/authService'
import { useAuthStore } from '@/stores/authStore'

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()

const activeTab = ref('login')

const isLoading = ref(false)
const errorMessage = ref('')

const loginForm = ref({ email: '', password: '' })
const registerForm = ref({ fullName: '', email: '', password: '', phone: '' })

// Chuyển tab Đăng nhập / Đăng ký
const switchTab = (tab) => {
  errorMessage.value = ''
  if (tab === 'login') {
    router.push('/login')
  } else {
    router.push('/register')
  }
}

// Lắng nghe thay đổi route để cập nhật tab tương ứng
watch(() => route.path, (newPath) => {
  if (newPath.includes('/register')) activeTab.value = 'register'
  else activeTab.value = 'login'
})

onMounted(() => {
  if (route.path.includes('/register')) activeTab.value = 'register'
  else activeTab.value = 'login'
})

// Xử lý Đăng nhập
const handleLogin = async () => {
  try {
    isLoading.value = true
    errorMessage.value = ''
    const data = await authService.login(loginForm.value)
    authStore.setAuth(data.token, data.user)
    router.push(route.query.redirect || '/')
  } catch (error) {
    errorMessage.value = error.response?.data?.message || 'Lỗi đăng nhập, vui lòng kiểm tra lại thông tin'
  } finally {
    isLoading.value = false
  }
}

// Xử lý Đăng ký
const handleRegister = async () => {
  try {
    isLoading.value = true
    errorMessage.value = ''
    const data = await authService.register({
      full_name: registerForm.value.fullName,
      email: registerForm.value.email,
      password: registerForm.value.password,
      phone: registerForm.value.phone
    })
    authStore.setAuth(data.token, data.user)
    router.push('/')
  } catch (error) {
    errorMessage.value = error.response?.data?.message || 'Lỗi đăng ký, vui lòng kiểm tra lại thông tin'
  } finally {
    isLoading.value = false
  }
}
</script>
