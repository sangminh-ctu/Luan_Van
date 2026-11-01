<template>
  <div class="bg-light py-4">
    <div class="container">
      <nav class="small mb-3" aria-label="Đường dẫn">
        <RouterLink to="/" class="text-secondary text-decoration-none">Trang chủ</RouterLink
        ><span class="mx-2">/</span>Flash Sale
      </nav>
      <FlashSaleSection full-page />
    </div>
  </div>
</template>
<script setup>
import FlashSaleSection from '@/components/customer/FlashSaleSection.vue'
</script>
