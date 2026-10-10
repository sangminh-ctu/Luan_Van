<template>
  <div class="d-flex flex-column flex-shrink-0 p-3 bg-white border-end shadow-sm h-100" style="width: 280px; overflow-y: auto;">
    
    <!-- Logo -->
    <router-link to="/admin" class="d-flex align-items-center mb-3 mb-md-0 me-md-auto link-dark text-decoration-none px-2">
      <i class="bi bi-book-half fs-4 text-primary me-2"></i>
      <span class="fs-5 fw-bold text-primary">BookStore AI</span>
    </router-link>
    <hr>
    
    <!-- Menu -->
    <ul class="nav nav-pills flex-column mb-auto">
      
      <!-- Tổng quan -->
      <li class="nav-item mb-1">
        <router-link to="/admin" class="nav-link text-dark custom-nav-link" exact-active-class="active shadow-sm text-white">
          <i class="bi bi-speedometer2 me-2"></i> Tổng quan
        </router-link>
      </li>
      
      <!-- Quản lý sách -->
      <li class="nav-item mb-1">
        <a class="nav-link text-dark d-flex justify-content-between align-items-center custom-nav-link" href="#" @click.prevent="openMenu.books = !openMenu.books">
          <span><i class="bi bi-journal-text me-2"></i> Quản lý sách</span>
          <i class="bi" :class="openMenu.books ? 'bi-chevron-down' : 'bi-chevron-right'" style="font-size: 12px;"></i>
        </a>
        <ul class="nav flex-column ms-3 mt-1" v-show="openMenu.books">
          <li class="nav-item"><router-link to="/admin/books" class="nav-link text-muted py-2 small" active-class="text-primary fw-bold bg-light"><i class="bi bi-dash me-1"></i> Danh sách sách</router-link></li>
          <li class="nav-item"><router-link to="/admin/categories" class="nav-link text-muted py-2 small" active-class="text-primary fw-bold bg-light"><i class="bi bi-dash me-1"></i> Thể loại</router-link></li>
          <li class="nav-item"><router-link to="/admin/authors" class="nav-link text-muted py-2 small" active-class="text-primary fw-bold bg-light"><i class="bi bi-dash me-1"></i> Tác giả</router-link></li>
          <li class="nav-item"><router-link to="/admin/publishers" class="nav-link text-muted py-2 small" active-class="text-primary fw-bold bg-light"><i class="bi bi-dash me-1"></i> Nhà xuất bản</router-link></li>
        </ul>
      </li>

      <!-- Quản lý kho -->
      <li class="nav-item mb-1">
        <a class="nav-link text-dark d-flex justify-content-between align-items-center custom-nav-link" href="#" @click.prevent="openMenu.inventory = !openMenu.inventory">
          <span><i class="bi bi-box-seam me-2"></i> Quản lý kho</span>
          <i class="bi" :class="openMenu.inventory ? 'bi-chevron-down' : 'bi-chevron-right'" style="font-size: 12px;"></i>
        </a>
        <ul class="nav flex-column ms-3 mt-1" v-show="openMenu.inventory">
          <li class="nav-item"><router-link to="/admin/inventory" class="nav-link text-muted py-2 small" active-class="text-primary fw-bold bg-light"><i class="bi bi-dash me-1"></i> Tồn kho</router-link></li>
          <li class="nav-item"><router-link to="/admin/stock-receipts" class="nav-link text-muted py-2 small" active-class="text-primary fw-bold bg-light"><i class="bi bi-dash me-1"></i> Phiếu nhập/xuất</router-link></li>
        </ul>
      </li>

      <!-- Quản lý đơn hàng -->
      <li class="nav-item mb-1">
        <a class="nav-link text-dark d-flex justify-content-between align-items-center custom-nav-link" href="#" @click.prevent="openMenu.orders = !openMenu.orders">
          <span><i class="bi bi-cart3 me-2"></i> Quản lý đơn hàng</span>
          <i class="bi" :class="openMenu.orders ? 'bi-chevron-down' : 'bi-chevron-right'" style="font-size: 12px;"></i>
        </a>
        <ul class="nav flex-column ms-3 mt-1" v-show="openMenu.orders">
          <li class="nav-item"><router-link to="/admin/orders" class="nav-link text-muted py-2 small" active-class="text-primary fw-bold bg-light"><i class="bi bi-dash me-1"></i> Đơn hàng</router-link></li>
          <li class="nav-item"><router-link to="/admin/shipments" class="nav-link text-muted py-2 small" active-class="text-primary fw-bold bg-light"><i class="bi bi-dash me-1"></i> Vận chuyển</router-link></li>
        </ul>
      </li>

      <!-- Người dùng -->
      <li class="nav-item mb-1">
        <router-link to="/admin/users" class="nav-link text-dark custom-nav-link" active-class="active shadow-sm text-white">
          <i class="bi bi-people me-2"></i> Người dùng
        </router-link>
      </li>
      
      <!-- Khuyến mãi -->
      <li class="nav-item mb-1">
        <router-link to="/admin/vouchers" class="nav-link text-dark custom-nav-link" active-class="active shadow-sm text-white">
          <i class="bi bi-ticket-perforated me-2"></i> Khuyến mãi
        </router-link>
      </li>
    </ul>
    
    <hr>
    
    <!-- User Profile & Logout -->
    <div class="dropdown">
      <a href="#" class="d-flex align-items-center link-dark text-decoration-none dropdown-toggle px-2" id="dropdownAdmin" data-bs-toggle="dropdown" aria-expanded="false">
        <img src="https://ui-avatars.com/api/?name=Admin&background=0D8ABC&color=fff" alt="" width="35" height="35" class="rounded-circle me-2 shadow-sm">
        <div class="d-flex flex-column">
          <strong class="text-truncate" style="max-width: 140px; font-size: 14px;">{{ authStore.user?.full_name || 'Quản trị viên' }}</strong>
          <small class="text-muted" style="font-size: 11px;">Admin System</small>
        </div>
      </a>
      <ul class="dropdown-menu text-small shadow border-0" aria-labelledby="dropdownAdmin">
        <li><a class="dropdown-item" href="#"><i class="bi bi-gear me-2 text-muted"></i> Cài đặt</a></li>
        <li><a class="dropdown-item" href="#"><i class="bi bi-person me-2 text-muted"></i> Hồ sơ</a></li>
        <li><hr class="dropdown-divider"></li>
        <li><a class="dropdown-item text-danger fw-bold" href="#" @click.prevent="authStore.logout"><i class="bi bi-box-arrow-right me-2"></i> Đăng xuất</a></li>
      </ul>
    </div>
  </div>
</template>

<script setup>
import { reactive, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/authStore'

const authStore = useAuthStore()
const route = useRoute()

// Quản lý trạng thái mở/đóng của các menu con
const openMenu = reactive({
  books: false,
  inventory: false,
  orders: false
})

// Tự động mở menu con nếu đang truy cập vào trang thuộc nhóm đó
watch(() => route.path, (newPath) => {
  if (['/admin/books', '/admin/categories', '/admin/authors', '/admin/publishers'].includes(newPath)) openMenu.books = true
  if (['/admin/inventory', '/admin/stock-receipts'].includes(newPath)) openMenu.inventory = true
  if (['/admin/orders', '/admin/shipments'].includes(newPath)) openMenu.orders = true
}, { immediate: true })
</script>

<style scoped>
.custom-nav-link {
  border-radius: 8px;
  transition: all 0.2s ease-in-out;
}
.custom-nav-link:hover:not(.active) {
  background-color: #f0f4f8;
  color: #0d6efd !important;
  transform: translateX(3px);
}
.nav-link.active {
  background-color: #0d6efd !important;
}
/* Tuỳ chỉnh thanh cuộn cho sidebar */
::-webkit-scrollbar {
  width: 5px;
}
::-webkit-scrollbar-thumb {
  background: #cbd5e1; 
  border-radius: 10px;
}
::-webkit-scrollbar-thumb:hover {
  background: #94a3b8; 
}
</style>
