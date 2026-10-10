import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import router from '@/router';

export const useAuthStore = defineStore('auth', () => {
    const token = ref(localStorage.getItem('token') || null);
    const user = ref(JSON.parse(localStorage.getItem('user')) || null);

    const isLoggedIn = computed(() => !!token.value);
    const isAdmin = computed(() => user.value?.role === 'admin');

    function setAuth(newToken, newUser) {
        token.value = newToken;
        user.value = newUser;
        localStorage.setItem('token', newToken);
        localStorage.setItem('user', JSON.stringify(newUser));
    }

    function logout() {
        token.value = null;
        user.value = null;
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        
        // Cải tiến: Nếu đang ở các trang quản trị thì đẩy về admin/login, ngược lại về /login chung
        if (router.currentRoute.value.path.startsWith('/admin')) {
            router.push('/admin/login');
        } else {
            router.push('/login');
        }
    }

    return { token, user, isLoggedIn, isAdmin, setAuth, logout };
});
