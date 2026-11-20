<template>
  <div>
    <AppHeader />
    <main class="main-content">
      <RouterView />
    </main>
    <AppFooter />
    <BookChat />
  </div>
</template>

<script setup>
import { RouterView } from 'vue-router'
import AppHeader from '../components/customer/AppHeader.vue'
import AppFooter from '../components/customer/AppFooter.vue'
import BookChat from '../components/customer/BookChat.vue'
</script>

<style scoped>
.main-content {
  min-height: 80vh; 
}
</style>
