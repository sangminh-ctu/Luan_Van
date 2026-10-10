<template>
  <div class="container mt-5" style="max-width: 400px;">
    <div class="card shadow-sm border-0">
      <div class="card-body p-4 bg-dark text-white rounded">
        <h3 class="text-center mb-4 text-uppercase">Quản Trị Hệ Thống</h3>
        
        <div v-if="errorMessage" class="alert alert-danger">{{ errorMessage }}</div>
        
        <form @submit.prevent="handleAdminLogin">
          <div class="mb-3">
            <label>Email Quản trị</label>
            <input type="email" v-model="email" class="form-control" required />
          </div>
          
          <div class="mb-4">
            <label>Mật khẩu</label>
            <input type="password" v-model="password" class="form-control" required minlength="6" />
          </div>
          
          <button type="submit" class="btn btn-warning w-100 fw-bold" :disabled="isLoading">
            {{ isLoading ? 'Đang xác thực...' : 'ĐĂNG NHẬP ADMIN' }}
          </button>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import authService from '@/services/authService'
import { useAuthStore } from '@/stores/authStore'

const router = useRouter()
const authStore = useAuthStore()

const email = ref('')
const password = ref('')
const errorMessage = ref('')
const isLoading = ref(false)

const handleAdminLogin = async () => {
  try {
    isLoading.value = true
    errorMessage.value = ''
    
    const data = await authService.adminLogin({ email: email.value, password: password.value })
    authStore.setAuth(data.token, data.user)
    router.push('/admin')
  } catch (error) {
    errorMessage.value = error.response?.data?.message || 'Có lỗi xảy ra, vui lòng thử lại'
  } finally {
    isLoading.value = false
  }
}
</script>
