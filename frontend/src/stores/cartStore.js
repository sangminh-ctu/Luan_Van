import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { cartService } from '@/services/cartService';
import { useAuthStore } from './authStore';
import router from '@/router';

export const useCartStore = defineStore('cart', () => {
    const items = ref([]);
    const summary = ref({
        total_items: 0,
        total_quantity: 0,
        total_price: 0,
        has_issues: false
    });
    const isLoading = ref(false);

    const totalItems = computed(() => summary.value.total_items);
    const totalPrice = computed(() => summary.value.total_price);

    async function fetchCart() {
        const authStore = useAuthStore();
        if (!authStore.isLoggedIn || authStore.isAdmin) {
            clearLocalCart();
            return;
        }

        try {
            isLoading.value = true;
            const res = await cartService.getCart();
            items.value = res.items || [];
            summary.value = res.summary || { total_items: 0, total_quantity: 0, total_price: 0, has_issues: false };
        } catch (error) {
            console.error('Lỗi tải giỏ hàng:', error);
        } finally {
            isLoading.value = false;
        }
    }

    async function addToCart(bookId, quantity = 1) {
        const authStore = useAuthStore();
        if (!authStore.isLoggedIn) {
            router.push({ path: '/login', query: { redirect: router.currentRoute.value.fullPath } });
            return { success: false, requireLogin: true };
        }

        if (authStore.isAdmin) {
            alert('Tài khoản Quản trị viên không thể mua hàng.');
            return { success: false };
        }

        try {
            isLoading.value = true;
            const res = await cartService.addToCart(bookId, quantity);
            items.value = res.cart.items || [];
            summary.value = res.cart.summary;
            return { success: true };
        } catch (error) {
            const msg = error.response?.data?.message || error.message;
            alert(msg);
            return { success: false, message: msg };
        } finally {
            isLoading.value = false;
        }
    }

    function clearLocalCart() {
        items.value = [];
        summary.value = {
            total_items: 0,
            total_quantity: 0,
            total_price: 0,
            has_issues: false
        };
    }

    return {
        items,
        summary,
        totalItems,
        totalPrice,
        isLoading,
        fetchCart,
        addToCart,
        clearLocalCart
    };
});
