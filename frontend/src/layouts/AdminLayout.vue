<template>
  <div class="d-flex vw-100 vh-100 bg-light overflow-hidden">
    <!-- Sidebar -->
    <AdminSidebar />
    
    <!-- Main Content Area -->
    <div class="flex-grow-1 overflow-auto d-flex flex-column">
      
      <!-- Navbar (Chỉ dành cho phiên bản mobile hoặc hiển thị thêm thông tin nếu muốn) -->
      <nav class="navbar navbar-expand-lg navbar-light bg-white border-bottom shadow-sm px-4 py-3 d-md-none">
        <span class="navbar-brand fw-bold text-primary">
          <i class="bi bi-book-half me-2"></i> BookStore AI
        </span>
      </nav>

      <!-- Nội dung động của Router -->
      <div class="p-4 flex-grow-1">
        <router-view />
      </div>
      
    </div>
  </div>
</template>

<script setup>
import AdminSidebar from '@/components/admin/AdminSidebar.vue'
</script>
