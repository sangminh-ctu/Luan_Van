import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/authStore'

// Layouts
import CustomerLayout from '@/layouts/CustomerLayout.vue'
import AdminLayout from '@/layouts/AdminLayout.vue'

// Views
import HomeView from '@/views/customer/HomeView.vue'
import DashboardView from '@/views/admin/DashboardView.vue'
import CategoryView from '@/views/admin/CategoryView.vue'
import AuthView from '@/views/auth/AuthView.vue'
import AdminLoginView from '@/views/auth/AdminLoginView.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    // --- CÃC TRANG AUTH KHÃ”NG CÃ“ LAYOUT ---
    { path: '/login', name: 'login', component: AuthView },
    { path: '/register', name: 'register', component: AuthView },
    { path: '/admin/login', name: 'admin-login', component: AdminLoginView },

    // --- CÃC TRANG Cá»¦A KHÃCH HÃ€NG ---
    {
      path: '/',
      component: CustomerLayout,
      children: [
        { path: '', name: 'home', component: HomeView }
      ]
    },

    // --- CÃC TRANG Cá»¦A ADMIN ---
    {
      path: '/admin',
      component: AdminLayout,
      meta: { requiresAuth: true, requiresAdmin: true },
      children: [
        { path: '', name: 'admin-dashboard', component: DashboardView },
        // ThÃªm route áº£o Ä‘á»ƒ trÃ¡nh bÃ¡o lá»—i khi click vÃ o menu
        { path: 'books', name: 'admin-books', component: DashboardView },
        { path: 'categories', name: 'admin-categories', component: CategoryView },
        { path: 'authors', name: 'admin-authors', component: DashboardView },
        { path: 'publishers', name: 'admin-publishers', component: DashboardView },
        { path: 'inventory', name: 'admin-inventory', component: DashboardView },
        { path: 'stock-receipts', name: 'admin-stock-receipts', component: DashboardView },
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

  // Kiá»ƒm tra route cáº§n Ä‘Äƒng nháº­p
  if (to.meta.requiresAuth && !authStore.isLoggedIn) {
    if (to.meta.requiresAdmin) {
      return next({ name: 'admin-login' })
    }
    return next({ name: 'login', query: { redirect: to.fullPath } })
  }

  // Kiá»ƒm tra route cáº§n quyá»n admin
  if (to.meta.requiresAdmin && !authStore.isAdmin) {
    return next({ name: 'admin-login' })
  }

  // Náº¿u Ä‘Ã£ Ä‘Äƒng nháº­p mÃ  cá»‘ vÃ o láº¡i trang login/register thÃ¬ cháº·n
  if (authStore.isLoggedIn && (to.name === 'login' || to.name === 'register' || to.name === 'admin-login')) {
    if (authStore.isAdmin) {
      return next({ name: 'admin-dashboard' })
    }
    return next({ name: 'home' })
  }

  next()
})

export default router
