<script setup>
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/authStore'
import { useCartStore } from '@/stores/cartStore'
import { useCategoryStore } from '@/stores/categoryStore'

const authStore = useAuthStore()
const cartStore = useCartStore()
const categoryStore = useCategoryStore()
const router = useRouter()
const route = useRoute()

const showAccountMenu = ref(false)
const showCategoryDropdown = ref(false)
const searchKeyword = ref('')
const dropdownRef = ref(null)

const currentCategoryId = computed(() => {
  return route.query.category_id ? Number(route.query.category_id) : null
})

const isAllBooksActive = computed(() => {
  return route.path === '/books' && !route.query.category_id
})

const handleSearch = () => {
  if (searchKeyword.value.trim()) {
    router.push({ path: '/books', query: { search: searchKeyword.value.trim() } })
  }
}

const toggleCategoryDropdown = () => {
  showCategoryDropdown.value = !showCategoryDropdown.value
}

const closeCategoryDropdown = () => {
  showCategoryDropdown.value = false
}

const megaMenuRef = ref(null)
const bottomBarRef = ref(null)
const MAX_CHILDREN = 4
const viewportWidth = ref(typeof window !== 'undefined' ? window.innerWidth : 1200)

// Số cột theo màn hình: >=992px: 4, >=768px: 3, nhỏ hơn: 1
const columnCount = computed(() => {
  if (viewportWidth.value >= 992) return 4
  if (viewportWidth.value >= 768) return 3
  return 1
})

const columnClass = computed(() => {
  if (columnCount.value === 4) return 'col-3'
  if (columnCount.value === 3) return 'col-4'
  return 'col-12'
})

// Chia danh mục vào các cột cân bằng theo "trọng lượng", giữ thứ tự A-Z theo chiều dọc
const megaColumns = computed(() => {
  const tree = categoryStore.categoryTree || []
  const n = columnCount.value
  const weightOf = (p) => {
    const kids = p.children?.length || 0
    return 1 + Math.min(kids, MAX_CHILDREN) + (kids > MAX_CHILDREN ? 1 : 0) + 0.5
  }
  const total = tree.reduce((s, p) => s + weightOf(p), 0)
  const target = total / n
  const columns = Array.from({ length: n }, () => [])
  let col = 0
  let acc = 0
  for (const p of tree) {
    const w = weightOf(p)
    if (col < n - 1 && acc > 0 && acc + w / 2 > target) {
      col++
      acc = 0
    }
    columns[col].push(p)
    acc += w
  }
  return columns.filter(c => c.length > 0)
})

const handleResize = () => {
  viewportWidth.value = window.innerWidth
}

const handleClickOutside = (e) => {
  const inButton = dropdownRef.value && dropdownRef.value.contains(e.target)
  const inMenu = megaMenuRef.value && megaMenuRef.value.contains(e.target)
  if (!inButton && !inMenu) {
    showCategoryDropdown.value = false
  }
}

const handleKeydown = (e) => {
  if (e.key === 'Escape') showCategoryDropdown.value = false
}

watch(() => route.fullPath, () => {
  showCategoryDropdown.value = false
})

onMounted(() => {
  cartStore.fetchCart()
  categoryStore.fetchCategories()
  document.addEventListener('click', handleClickOutside)
  document.addEventListener('keydown', handleKeydown)
  window.addEventListener('resize', handleResize)
})

onBeforeUnmount(() => {
  document.removeEventListener('click', handleClickOutside)
  document.removeEventListener('keydown', handleKeydown)
  window.removeEventListener('resize', handleResize)
})
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
        <div class="flex-grow-1 mx-2 d-flex align-items-center">
          <!-- Thanh Search -->
          <div class="flex-grow-1 position-relative d-flex align-items-center bg-white border border-secondary-subtle" style="border-radius: 8px; padding: 4px;">
            <input 
              type="text" 
              class="form-control border-0 shadow-none text-secondary ps-3" 
              placeholder="Tìm kiếm tựa sách, tác giả, ISBN..." 
              v-model="searchKeyword"
              @keyup.enter="handleSearch"
              style="font-size: 14px; background: transparent; height: 38px;"
            >
            <button 
              class="btn border-0 d-flex align-items-center justify-content-center" 
              style="border-radius: 6px; width: 65px; height: 38px; background-color: #c92127;"
              @click="handleSearch"
            >
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
          <router-link to="/cart" class="text-center text-secondary custom-icon-btn position-relative d-flex flex-column align-items-center text-decoration-none">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24" class="mb-1">
              <path stroke-linecap="round" stroke-linejoin="round" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            <span 
              v-if="cartStore.totalItems > 0" 
              class="position-absolute translate-middle badge rounded-pill bg-danger" 
              style="top: 2px; left: 70%; font-size: 10px;"
            >
              {{ cartStore.totalItems }}
            </span>
            <div style="font-size: 13px;">Giỏ Hàng</div>
          </router-link>
          
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
                <div class="text-center mb-2">
                  <p class="mb-0 text-muted" style="font-size: 13px;">Xin chào,</p>
                  <h6 class="fw-bold mb-0 text-truncate" :title="authStore.user?.full_name">{{ authStore.user?.full_name }}</h6>
                </div>
                <hr class="my-2">
                <router-link
                  to="/orders"
                  class="btn btn-light w-100 mb-2 text-start d-flex align-items-center gap-2 fw-semibold text-dark"
                  style="border-radius: 8px; font-size: 14px;"
                  @click="showAccountMenu = false"
                >
                  <i class="bi bi-receipt text-danger"></i>
                  <span>Đơn hàng của tôi</span>
                </router-link>
                <button @click="authStore.logout" class="btn btn-danger w-100 fw-bold" style="border-radius: 8px;">Đăng xuất</button>
              </template>
            </div>
          </div>
        </div>

      </div>
    </div>

    <!-- Bottombar (Danh Mục Menu) -->
    <div class="bg-white shadow-sm position-relative" ref="bottomBarRef">
      <div class="container d-flex align-items-center">
        <!-- Nút Danh mục kèm Dropdown 2 cấp -->
        <div class="position-relative" ref="dropdownRef">
          <div 
            class="text-white px-3 py-2 fw-bold d-flex align-items-center gap-2 user-select-none" 
            style="background-color: #c92127; border-top-left-radius: 8px; border-top-right-radius: 8px; cursor: pointer; min-width: 220px;"
            @click.stop="toggleCategoryDropdown"
          >
            <span>☰</span> DANH MỤC SẢN PHẨM 
            <span class="ms-auto" style="font-size: 11px;">{{ showCategoryDropdown ? '▲' : '▼' }}</span>
          </div>

        </div>

        <!-- Mega Menu đa cột (rộng bằng container, không kéo dài xuống) -->
        <div
          v-if="showCategoryDropdown"
          ref="megaMenuRef"
          class="position-absolute start-0 end-0 mx-auto bg-white shadow-lg rounded-bottom border-top mega-menu"
          style="top: 100%; z-index: 1050;"
        >
          <div class="container py-3">
            <div v-if="categoryStore.isLoading" class="p-3 text-center text-muted small">
              <span class="spinner-border spinner-border-sm me-1 text-danger"></span>Đang tải danh mục...
            </div>
            <div v-else-if="categoryStore.categoryTree.length === 0" class="p-3 text-center text-muted small">
              Chưa có danh mục nào.
            </div>

            <!-- Lưới cột cân bằng (Bootstrap) -->
            <div v-else class="row g-4">
              <div v-for="(column, colIdx) in megaColumns" :key="colIdx" :class="columnClass">
                <div v-for="parent in column" :key="parent.category_id" class="mb-3">
                  <router-link
                    :to="`/books?category_id=${parent.category_id}`"
                    class="d-inline-block text-decoration-none fw-bold small mb-1"
                    :class="categoryStore.isParentOrSelfActive(parent.category_id, currentCategoryId) ? 'text-danger' : 'text-dark hover-danger'"
                    @click="closeCategoryDropdown"
                  >
                    {{ parent.category_name }} <i class="bi bi-chevron-right" style="font-size: 10px;"></i>
                  </router-link>

                  <div v-if="parent.children?.length > 0" class="d-flex flex-column">
                    <router-link
                      v-for="child in parent.children.slice(0, MAX_CHILDREN)"
                      :key="child.category_id"
                      :to="`/books?category_id=${child.category_id}`"
                      class="text-decoration-none small py-1 text-truncate"
                      :class="currentCategoryId === child.category_id ? 'text-danger fw-bold' : 'text-secondary hover-danger'"
                      :title="child.category_name"
                      @click="closeCategoryDropdown"
                    >
                      {{ child.category_name }}
                    </router-link>
                    <router-link
                      v-if="parent.children.length > MAX_CHILDREN"
                      :to="`/books?category_id=${parent.category_id}`"
                      class="text-decoration-none small text-primary py-1"
                      @click="closeCategoryDropdown"
                    >
                      Xem tất cả
                    </router-link>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        <!-- Navbar link (Tất cả sách + Tối đa 6 danh mục gốc) -->
        <nav class="d-flex align-items-center gap-3 ms-3 overflow-auto py-2 flex-grow-1 scrollbar-none" style="font-size: 14px; white-space: nowrap;">
          <router-link
            to="/books"
            class="text-decoration-none py-1 px-2 rounded fw-bold transition-all"
            :class="isAllBooksActive ? 'text-danger fw-bolder border-bottom border-2 border-danger' : 'text-dark hover-danger'"
          >
            Tất Cả Sách
          </router-link>

          <router-link
            v-for="cat in categoryStore.visibleTopCategories"
            :key="cat.category_id"
            :to="`/books?category_id=${cat.category_id}`"
            class="text-decoration-none py-1 px-2 rounded transition-all"
            :class="categoryStore.isParentOrSelfActive(cat.category_id, currentCategoryId) ? 'text-danger fw-bolder border-bottom border-2 border-danger' : 'text-secondary hover-danger'"
          >
            {{ cat.category_name }}
          </router-link>
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

.transition-all { transition: all 0.2s ease-in-out; }
.mega-menu { max-height: 70vh; overflow-y: auto; }
.scrollbar-none::-webkit-scrollbar { display: none; }
.scrollbar-none { -ms-overflow-style: none; scrollbar-width: none; }
</style>
