import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/authStore'

// Layouts
import CustomerLayout from '@/layouts/CustomerLayout.vue'

// Views
import HomeView from '@/views/customer/HomeView.vue'
import DashboardView from '@/views/admin/DashboardView.vue'
import LoginView from '@/views/auth/LoginView.vue'
import RegisterView from '@/views/auth/RegisterView.vue'
import AdminLoginView from '@/views/auth/AdminLoginView.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    // --- CÁC TRANG AUTH KHÔNG CÓ LAYOUT ---
    { path: '/login', name: 'login', component: LoginView },
    { path: '/register', name: 'register', component: RegisterView },
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
      // Tạm thời chưa dùng AdminLayout trong nhiệm vụ này theo yêu cầu
      // component: AdminLayout, 
      meta: { requiresAuth: true, requiresAdmin: true },
      children: [
        { path: '', name: 'admin-dashboard', component: DashboardView }
      ]
    }
  ]
})

router.beforeEach((to, from, next) => {
  const authStore = useAuthStore()

  if (to.meta.requiresAdmin) {
    if (!authStore.isLoggedIn || !authStore.isAdmin) {
      return next({ name: 'admin-login' })
    }
  }
  
  if (to.meta.requiresAuth && !to.meta.requiresAdmin) {
    if (!authStore.isLoggedIn) {
      return next({ name: 'login', query: { redirect: to.fullPath } })
    }
  }

  next()
})

export default router