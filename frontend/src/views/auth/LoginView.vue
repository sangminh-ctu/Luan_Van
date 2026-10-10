<template>
  <div class="container mt-5" style="max-width: 400px;">
    <h3 class="text-center mb-4">Đăng Nhập Khách Hàng</h3>
    
    <div v-if="errorMessage" class="alert alert-danger">{{ errorMessage }}</div>
    
    <form @submit.prevent="handleLogin">
      <div class="mb-3">
        <label>Email</label>
        <input type="email" v-model="email" class="form-control" required />
      </div>
      
      <div class="mb-3">
        <label>Mật khẩu</label>
        <input type="password" v-model="password" class="form-control" required minlength="6" />
      </div>
      
      <button type="submit" class="btn btn-primary w-100" :disabled="isLoading">
        {{ isLoading ? 'Đang đăng nhập...' : 'Đăng nhập' }}
      </button>
    </form>
    
    <div class="text-center mt-3">
      <router-link to="/register">Chưa có tài khoản? Đăng ký ngay</router-link>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import authService from '@/services/authService'
import { useAuthStore } from '@/stores/authStore'

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()

const email = ref('')
const password = ref('')
const errorMessage = ref('')
const isLoading = ref(false)

const handleLogin = async () => {
  try {
    isLoading.value = true
    errorMessage.value = ''
    
    const data = await authService.login({ email: email.value, password: password.value })
    authStore.setAuth(data.token, data.user)
    
    const redirectPath = route.query.redirect || '/'
    router.push(redirectPath)
  } catch (error) {
    errorMessage.value = error.response?.data?.message || 'Có lỗi xảy ra, vui lòng thử lại'
  } finally {
    isLoading.value = false
  }
}
</script>
