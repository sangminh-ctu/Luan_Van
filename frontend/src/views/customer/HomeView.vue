<template>
  <div class="p-4">
    <h2>Trang chủ</h2>
    <div v-if="authStore.isLoggedIn">
      <p>Xin chào: <strong>{{ authStore.user?.full_name }}</strong></p>
      <button @click="authStore.logout" class="btn btn-danger mt-3">Đăng xuất</button>
    </div>
    <div v-else>
      <router-link to="/login" class="btn btn-primary me-2">Đăng nhập</router-link>
      <router-link to="/register" class="btn btn-outline-primary">Đăng ký</router-link>
    </div>
  </div>
</template>

<script setup>
import { useAuthStore } from '@/stores/authStore'
const authStore = useAuthStore()
</script>
