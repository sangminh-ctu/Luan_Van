import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/authStore'

// Layouts
import CustomerLayout from '@/layouts/CustomerLayout.vue'
import AdminLayout from '@/layouts/AdminLayout.vue'

// Views
import HomeView from '@/views/customer/HomeView.vue'
import DashboardView from '@/views/admin/DashboardView.vue'
import BookListView from '@/views/admin/BookListView.vue'
import BookFormView from '@/views/admin/BookFormView.vue'
import CategoryView from '@/views/admin/CategoryView.vue'
import AuthorView from '@/views/admin/AuthorView.vue'
import PublisherView from '@/views/admin/PublisherView.vue'
import InventoryView from '@/views/admin/InventoryView.vue'
import StockReceiptListView from '@/views/admin/StockReceiptListView.vue'
import StockReceiptFormView from '@/views/admin/StockReceiptFormView.vue'
import AuthView from '@/views/auth/AuthView.vue'
import AdminLoginView from '@/views/auth/AdminLoginView.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    // --- CÁC TRANG AUTH KHÔNG CÓ LAYOUT ---
    { path: '/login', name: 'login', component: AuthView },
    { path: '/register', name: 'register', component: AuthView },
    { path: '/admin/login', name: 'admin-login', component: AdminLoginView },

    // --- CÁC TRANG CỦA KHÁCH HÀNG ---
    {
      path: '/',
      component: CustomerLayout,
      children: [
        { path: '', name: 'home', component: HomeView }
      ]
    },

    // --- CÁC TRANG CỦA ADMIN ---
    {
      path: '/admin',
      component: AdminLayout,
      meta: { requiresAuth: true, requiresAdmin: true },
      children: [
        { path: '', name: 'admin-dashboard', component: DashboardView },
        { path: 'books', name: 'admin-books', component: BookListView },
        { path: 'books/create', name: 'admin-books-create', component: BookFormView },
        { path: 'books/:id/edit', name: 'admin-books-edit', component: BookFormView },
        { path: 'categories', name: 'admin-categories', component: CategoryView },
        { path: 'authors', name: 'admin-authors', component: AuthorView },
        { path: 'publishers', name: 'admin-publishers', component: PublisherView },
        { path: 'inventory', name: 'admin-inventory', component: InventoryView },
        { path: 'stock-receipts', name: 'admin-stock-receipts', component: StockReceiptListView },
        { path: 'stock-receipts/create', name: 'admin-stock-receipts-create', component: StockReceiptFormView },
        { path: 'orders', name: 'admin-orders', component: DashboardView },
        { path: 'shipments', name: 'admin-shipments', component: DashboardView },
        { path: 'users', name: 'admin-users', component: DashboardView },
        { path: 'vouchers', name: 'admin-vouchers', component: DashboardView },
      ]
    }
  ]
})

// Navigation Guard
router.beforeEach((to, from, next) => {
  const authStore = useAuthStore()

  // Kiểm tra route cần đăng nhập
  if (to.meta.requiresAuth && !authStore.isLoggedIn) {
    if (to.meta.requiresAdmin) {
      return next({ name: 'admin-login' })
    }
    return next({ name: 'login', query: { redirect: to.fullPath } })
  }

  // Kiểm tra route cần quyền admin
  if (to.meta.requiresAdmin && !authStore.isAdmin) {
    return next({ name: 'admin-login' })
  }

  // Nếu đã đăng nhập mà cố vào lại trang login/register thì chặn
  if (authStore.isLoggedIn && (to.name === 'login' || to.name === 'register' || to.name === 'admin-login')) {
    if (authStore.isAdmin) {
      return next({ name: 'admin-dashboard' })
    }
    return next({ name: 'home' })
  }

  next()
})

export default router
