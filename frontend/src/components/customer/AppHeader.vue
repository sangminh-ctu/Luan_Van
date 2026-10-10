<script setup>
import { ref } from 'vue'
import { useAuthStore } from '@/stores/authStore'
const authStore = useAuthStore()
const showAccountMenu = ref(false)
</script>

<template>
  <header>
    <!-- Topbar (Banner ngang trên cùng) -->
    <div class="w-100" style="cursor: pointer;">
      <img src="../../assets/images/banners/banner5.webp" alt="Top Banner" class="w-100 d-block" style="object-fit: cover;">
    </div>

    <!-- Middlebar (Logo, Search, Các nút icon mới) -->
    <div class="bg-white border-bottom py-3">
      <div class="container d-flex align-items-center justify-content-between gap-4">
        
        <!-- Logo -->
        <router-link to="/" class="text-decoration-none">
          <img src="../../assets/images/logo/logo1.png" alt="FAHASA" height="40" style="object-fit: contain;">
        </router-link>

        <!-- Search Area -->
        <div class="flex-grow-1 mx-2 d-flex align-items-center gap-3">
          
          <!-- Icon Menu dạng lưới -->
          <div class="d-flex align-items-center text-secondary custom-icon-btn px-2" style="cursor: pointer;">
            <svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round">
              <rect x="3" y="3" width="7" height="7" rx="1.5"></rect>
              <rect x="14" y="14" width="7" height="7" rx="1.5"></rect>
              <rect x="3" y="14" width="7" height="7" rx="1.5"></rect>
              <circle cx="17.5" cy="6.5" r="3.5"></circle>
            </svg>
            <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" fill="currentColor" class="ms-1" viewBox="0 0 16 16" style="margin-top: 2px;">
              <path fill-rule="evenodd" d="M1.646 4.646a.5.5 0 0 1 .708 0L8 10.293l5.646-5.647a.5.5 0 0 1 .708.708l-6 6a.5.5 0 0 1-.708 0l-6-6a.5.5 0 0 1 0-.708z"/>
            </svg>
          </div>

          <!-- Thanh Search -->
          <div class="flex-grow-1 position-relative d-flex align-items-center bg-white border border-secondary-subtle" style="border-radius: 8px; padding: 4px;">
            <input type="text" class="form-control border-0 shadow-none text-secondary ps-3" placeholder="50 năm Fahasang" style="font-size: 14px; background: transparent; height: 38px;">
            <button class="btn border-0 d-flex align-items-center justify-content-center" style="border-radius: 6px; width: 65px; height: 38px; background-color: #c92127;">
              <!-- Icon Kính lúp -->
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="white" viewBox="0 0 16 16">
                <path d="M11.742 10.344a6.5 6.5 0 1 0-1.397 1.398h-.001c.03.04.062.078.098.115l3.85 3.85a1 1 0 0 0 1.415-1.414l-3.85-3.85a1.007 1.007 0 0 0-.115-.1zM12 6.5a5.5 5.5 0 1 1-11 0 5.5 5.5 0 0 1 11 0z"/>
              </svg>
            </button>
          </div>
        </div>

        <!-- Các Nút Icon -->
        <div class="d-flex align-items-center gap-4 ms-3">
          <!-- Thông Báo -->
          <div class="text-center text-secondary custom-icon-btn d-flex flex-column align-items-center">
            <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24" class="mb-1">
              <path stroke-linecap="round" stroke-linejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
            <div style="font-size: 13px;">Thông Báo</div>
          </div>
          
          <!-- Giỏ Hàng -->
          <div class="text-center text-secondary custom-icon-btn position-relative d-flex flex-column align-items-center">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24" class="mb-1">
              <path stroke-linecap="round" stroke-linejoin="round" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            <span class="position-absolute translate-middle badge rounded-pill bg-danger" style="top: 2px; left: 70%; font-size: 10px;">3</span>
            <div style="font-size: 13px;">Giỏ Hàng</div>
          </div>
          
          <!-- Tài khoản (Dropdown) -->
          <div class="position-relative" @mouseenter="showAccountMenu = true" @mouseleave="showAccountMenu = false">
            <div class="text-center text-secondary custom-icon-btn d-flex flex-column align-items-center" @click="showAccountMenu = !showAccountMenu">
              <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24" class="mb-1">
                <path stroke-linecap="round" stroke-linejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              <div style="font-size: 13px;">Tài khoản</div>
            </div>
            
            <!-- Popup Tài khoản -->
            <div v-show="showAccountMenu" class="position-absolute bg-white shadow rounded p-3" style="top: 100%; right: -20px; min-width: 260px; z-index: 1000; border: 1px solid #eee;">
              <template v-if="!authStore.isLoggedIn">
                <router-link to="/login" class="btn btn-danger w-100 mb-2 fw-bold" style="border-radius: 8px;">Đăng nhập</router-link>
                <router-link to="/register" class="btn btn-outline-danger w-100 fw-bold" style="border-radius: 8px; color: #c92127; border-color: #c92127; background-color: white;">Đăng ký</router-link>
              </template>
              <template v-else>
                <div class="text-center mb-3">
                  <p class="mb-0 text-muted" style="font-size: 13px;">Xin chào,</p>
                  <h6 class="fw-bold mb-0 text-truncate" :title="authStore.user?.full_name">{{ authStore.user?.full_name }}</h6>
                </div>
                <hr class="mb-3">
                <button @click="authStore.logout" class="btn btn-danger w-100 fw-bold" style="border-radius: 8px;">Đăng xuất</button>
              </template>
            </div>
          </div>
        </div>

      </div>
    </div>

    <!-- Bottombar (Danh Mục Menu) -->
    <div class="bg-white shadow-sm">
      <div class="container d-flex align-items-center">
        <!-- Nút Danh mục -->
        <div class="text-white px-3 py-2 fw-bold d-flex align-items-center gap-2" style="background-color: #c92127; border-top-left-radius: 8px; border-top-right-radius: 8px; cursor: pointer;">
          <span>☰</span> DANH MỤC SẢN PHẨM <span class="ms-1">▼</span>
        </div>
        
        <!-- Navbar link -->
        <nav class="d-flex gap-4 ms-4 overflow-auto py-2 flex-grow-1" style="font-size: 14px; white-space: nowrap;">
          <a href="#" class="text-dark text-decoration-none fw-bold hover-danger">Sách Trong Nước</a>
          <a href="#" class="text-secondary text-decoration-none hover-danger">Foreign Books</a>
          <a href="#" class="text-secondary text-decoration-none hover-danger">VPP - Dụng Cụ Học Sinh</a>
          <a href="#" class="text-secondary text-decoration-none hover-danger">Đồ Chơi</a>
          <a href="#" class="text-secondary text-decoration-none hover-danger">Làm Đẹp - Sức Khỏe</a>
          <a href="#" class="text-secondary text-decoration-none hover-danger">Sách Giáo Khoa</a>
          <a href="#" class="text-secondary text-decoration-none hover-danger">Bách Hóa Online</a>
        </nav>
      </div>
    </div>
  </header>
</template>

<style scoped>
.hover-danger:hover { color: #c92127 !important; }
.hover-underline:hover { text-decoration: underline !important; }
.custom-icon-btn { cursor: pointer; transition: color 0.2s; }
.custom-icon-btn:hover { color: #c92127 !important; }

/* Ẩn outline mặc định của input khi click */
input.form-control:focus {
  box-shadow: none !important;
  outline: none !important;
}
</style>
