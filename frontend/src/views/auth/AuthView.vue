<template>
  <div class="container py-5 d-flex justify-content-center align-items-center" style="min-height: 80vh;">
    <div class="row bg-white shadow-lg rounded overflow-hidden" style="max-width: 900px; width: 100%;">
      
      <!-- CỘT TRÁI: Hình ảnh và Quyền lợi -->
      <div class="col-md-5 d-none d-md-flex flex-column p-0" style="background-color: #f4f6f8;">
        <!-- Phần hình minh họa -->
        <div class="text-center bg-light p-4 flex-grow-1 d-flex align-items-center justify-content-center">
          <img src="https://cdni.iconscout.com/illustration/premium/thumb/online-shopping-8356973-6625892.png?f=webp" alt="Shopping" class="img-fluid" style="max-height: 250px; object-fit: contain;">
        </div>
        
        <!-- Phần quyền lợi bên dưới -->
        <div class="p-4 bg-white border-top">
          <h6 class="fw-bold mb-3 text-uppercase">Quyền lợi thành viên</h6>
          <ul class="list-unstyled text-muted" style="font-size: 13.5px; line-height: 1.6;">
            <li class="mb-2 d-flex">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="#5bc0de" class="bi bi-check-circle me-2 flex-shrink-0 mt-1" viewBox="0 0 16 16">
                <path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14zm0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16z"/>
                <path d="M10.97 4.97a.235.235 0 0 0-.02.022L7.477 9.417 5.384 7.323a.75.75 0 0 0-1.06 1.06L6.97 11.03a.75.75 0 0 0 1.079-.02l3.992-4.99a.75.75 0 0 0-1.071-1.05z"/>
              </svg>
              <span>Mua hàng khắp thế giới cực dễ dàng, nhanh chóng</span>
            </li>
            <li class="mb-2 d-flex">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="#5bc0de" class="bi bi-check-circle me-2 flex-shrink-0 mt-1" viewBox="0 0 16 16">
                <path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14zm0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16z"/>
                <path d="M10.97 4.97a.235.235 0 0 0-.02.022L7.477 9.417 5.384 7.323a.75.75 0 0 0-1.06 1.06L6.97 11.03a.75.75 0 0 0 1.079-.02l3.992-4.99a.75.75 0 0 0-1.071-1.05z"/>
              </svg>
              <span>Theo dõi chi tiết đơn hàng, địa chỉ thanh toán dễ dàng</span>
            </li>
            <li class="mb-2 d-flex">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="#5bc0de" class="bi bi-check-circle me-2 flex-shrink-0 mt-1" viewBox="0 0 16 16">
                <path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14zm0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16z"/>
                <path d="M10.97 4.97a.235.235 0 0 0-.02.022L7.477 9.417 5.384 7.323a.75.75 0 0 0-1.06 1.06L6.97 11.03a.75.75 0 0 0 1.079-.02l3.992-4.99a.75.75 0 0 0-1.071-1.05z"/>
              </svg>
              <span>Nhận nhiều chương trình ưu đãi hấp dẫn từ chúng tôi</span>
            </li>
          </ul>
        </div>
      </div>

      <!-- CỘT PHẢI: Form Đăng nhập / Đăng ký -->
      <div class="col-md-7 p-0 d-flex flex-column">
        <!-- Tabs -->
        <div class="d-flex text-center border-bottom">
          <div 
            class="flex-fill py-3 fw-bold auth-tab"
            :class="{ 'active': activeTab === 'login' }"
            @click="switchTab('login')"
          >
            Đăng nhập
          </div>
          <div 
            class="flex-fill py-3 fw-bold auth-tab"
            :class="{ 'active': activeTab === 'register' }"
            @click="switchTab('register')"
          >
            Đăng ký
          </div>
        </div>

        <div class="p-4 p-md-5 flex-grow-1 d-flex flex-column justify-content-center">
          <div v-if="errorMessage" class="alert alert-danger p-2 mb-3 text-center" style="font-size: 14px;">{{ errorMessage }}</div>

          <!-- FORM ĐĂNG NHẬP -->
          <form v-if="activeTab === 'login'" @submit.prevent="handleLogin">
            <div class="mb-3">
              <label class="form-label fw-bold text-uppercase text-muted" style="font-size: 12px;">Email <span class="text-danger">*</span></label>
              <input type="email" v-model="loginForm.email" class="form-control px-3 py-2" placeholder="Nhập Địa chỉ Email" required />
            </div>
            <div class="mb-2">
              <label class="form-label fw-bold text-uppercase text-muted" style="font-size: 12px;">Mật khẩu <span class="text-danger">*</span></label>
              <input type="password" v-model="loginForm.password" class="form-control px-3 py-2" placeholder="Nhập Mật khẩu" required minlength="6" />
            </div>
            <div class="text-end mb-4">
              <a href="#" class="text-decoration-none" style="font-size: 13.5px; color: #5bc0de;">Quên mật khẩu?</a>
            </div>
            
            <button type="submit" class="btn text-white w-100 fw-bold py-2 mb-3" style="background-color: #5bc0de; border-radius: 4px;" :disabled="isLoading">
              {{ isLoading ? 'ĐANG XỬ LÝ...' : 'ĐĂNG NHẬP' }}
            </button>
            <p class="text-center text-muted mx-auto" style="font-size: 12px; max-width: 90%;">
              Fahasa cam kết bảo mật và sẽ không bao giờ đăng hay chia sẻ thông tin mà chưa có được sự đồng ý của bạn.
            </p>
          </form>

          <!-- FORM ĐĂNG KÝ -->
          <form v-else @submit.prevent="handleRegister">
            <div class="mb-3">
              <label class="form-label fw-bold text-uppercase text-muted" style="font-size: 12px;">Họ và tên <span class="text-danger">*</span></label>
              <input type="text" v-model="registerForm.fullName" class="form-control px-3 py-2" placeholder="Nhập Họ và tên" required />
            </div>
            <div class="mb-3">
              <label class="form-label fw-bold text-uppercase text-muted" style="font-size: 12px;">Email <span class="text-danger">*</span></label>
              <input type="email" v-model="registerForm.email" class="form-control px-3 py-2" placeholder="Nhập Địa chỉ Email" required />
            </div>
            <div class="mb-3">
              <label class="form-label fw-bold text-uppercase text-muted" style="font-size: 12px;">Mật khẩu <span class="text-danger">*</span></label>
              <input type="password" v-model="registerForm.password" class="form-control px-3 py-2" placeholder="Nhập Mật khẩu" required minlength="6" />
            </div>
            <div class="mb-4">
              <label class="form-label fw-bold text-uppercase text-muted" style="font-size: 12px;">Số điện thoại</label>
              <input type="text" v-model="registerForm.phone" class="form-control px-3 py-2" placeholder="Nhập Số điện thoại (Tùy chọn)" />
            </div>
            
            <button type="submit" class="btn text-white w-100 fw-bold py-2 mb-3" style="background-color: #5bc0de; border-radius: 4px;" :disabled="isLoading">
              {{ isLoading ? 'ĐANG XỬ LÝ...' : 'TẠO TÀI KHOẢN' }}
            </button>
          </form>

          <!-- MẠNG XÃ HỘI (Chung cho cả 2 tab) -->
          <div class="position-relative text-center my-4">
            <hr class="text-muted">
            <span class="position-absolute top-50 start-50 translate-middle bg-white px-3 text-muted" style="font-size: 13px; border-radius: 20px; border: 1px solid #ddd; white-space: nowrap;">
              hoặc đăng nhập qua
            </span>
          </div>
          
          <div class="row g-2">
            <div class="col-6">
              <button type="button" class="btn w-100 text-white d-flex align-items-center justify-content-center gap-2" style="background-color: #3b5998; font-size: 14px; border-radius: 4px;">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-facebook" viewBox="0 0 16 16">
                  <path d="M16 8.049c0-4.446-3.582-8.05-8-8.05C3.58 0-.002 3.603-.002 8.05c0 4.017 2.926 7.347 6.75 7.951v-5.625h-2.03V8.05H6.75V6.275c0-2.017 1.195-3.131 3.022-3.131.876 0 1.791.157 1.791.157v1.98h-1.009c-.993 0-1.303.621-1.303 1.258v1.51h2.218l-.354 2.326H9.25V16c3.824-.604 6.75-3.934 6.75-7.951z"/>
                </svg>
                Facebook
              </button>
            </div>
            <div class="col-6">
              <button type="button" class="btn w-100 text-white d-flex align-items-center justify-content-center gap-2" style="background-color: #dd4b39; font-size: 14px; border-radius: 4px;">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-google" viewBox="0 0 16 16">
                  <path d="M15.545 6.558a9.42 9.42 0 0 1 .139 1.626c0 2.434-.87 4.492-2.384 5.885h.002C11.978 15.292 10.158 16 8 16A8 8 0 1 1 8 0a7.689 7.689 0 0 1 5.352 2.082l-2.284 2.284A4.347 4.347 0 0 0 8 3.166c-2.087 0-3.86 1.408-4.492 3.304a4.792 4.792 0 0 0 0 3.063h.003c.635 1.893 2.405 3.301 4.492 3.301 1.078 0 2.004-.276 2.722-.764h-.003a3.702 3.702 0 0 0 1.599-2.431H8v-3.08h7.545z"/>
                </svg>
                Google
              </button>
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

<style scoped>
.auth-tab {
  color: #777;
  border-bottom: 3px solid transparent;
  cursor: pointer;
  transition: all 0.3s ease;
  background-color: #fafafa;
}
.auth-tab:hover {
  color: #5bc0de;
  background-color: #fff;
}
.auth-tab.active {
  color: #333;
  border-bottom: 3px solid #5bc0de;
  background-color: #fff;
}
.form-control:focus {
  border-color: #5bc0de;
  box-shadow: 0 0 0 0.2rem rgba(91, 192, 222, 0.25);
}
</style>
