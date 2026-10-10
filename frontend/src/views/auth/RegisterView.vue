<template>
  <div class="container mt-5" style="max-width: 400px;">
    <h3 class="text-center mb-4">Đăng Ký Tài Khoản</h3>
    
    <div v-if="errorMessage" class="alert alert-danger">{{ errorMessage }}</div>
    
    <form @submit.prevent="handleRegister">
      <div class="mb-3">
        <label>Họ và tên</label>
        <input type="text" v-model="fullName" class="form-control" required />
      </div>

      <div class="mb-3">
        <label>Email</label>
        <input type="email" v-model="email" class="form-control" required />
      </div>
      
      <div class="mb-3">
        <label>Mật khẩu (ít nhất 6 ký tự)</label>
        <input type="password" v-model="password" class="form-control" required minlength="6" />
      </div>

      <div class="mb-3">
        <label>Số điện thoại (tùy chọn)</label>
        <input type="text" v-model="phone" class="form-control" />
      </div>
      
      <button type="submit" class="btn btn-success w-100" :disabled="isLoading">
        {{ isLoading ? 'Đang xử lý...' : 'Đăng ký' }}
      </button>
    </form>
    
    <div class="text-center mt-3">
      <router-link to="/login">Đã có tài khoản? Đăng nhập</router-link>
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

const fullName = ref('')
const email = ref('')
const password = ref('')
const phone = ref('')
const errorMessage = ref('')
const isLoading = ref(false)

const handleRegister = async () => {
  try {
    isLoading.value = true
    errorMessage.value = ''
    
    const data = await authService.register({
      full_name: fullName.value,
      email: email.value,
      password: password.value,
      phone: phone.value
    })
    
    // Tự động đăng nhập sau khi đăng ký thành công
    authStore.setAuth(data.token, data.user)
    router.push('/')
  } catch (error) {
    errorMessage.value = error.response?.data?.message || 'Có lỗi xảy ra, vui lòng thử lại'
  } finally {
    isLoading.value = false
  }
}
</script>
