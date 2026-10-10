<template>
  <div class="p-4">
    <h2>Admin Dashboard</h2>
    <div v-if="authStore.user">
      <p>Xin chào Admin: <strong>{{ authStore.user.full_name }}</strong></p>
    </div>
    <button @click="authStore.logout" class="btn btn-danger mt-3">Đăng xuất</button>
  </div>
</template>

<script setup>
import { useAuthStore } from '@/stores/authStore'
const authStore = useAuthStore()
</script>
