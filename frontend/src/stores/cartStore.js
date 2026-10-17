import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { cartService } from '@/services/cartService';
import { useAuthStore } from './authStore';
import router from '@/router';

const STORAGE_KEY = 'cart_selected_ids';

function loadSavedSelection() {
    try {
        const raw = sessionStorage.getItem(STORAGE_KEY);
        if (raw === null) return null;
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed.map(Number).filter(id => Number.isInteger(id) && id > 0) : null;
    } catch {
        return null;
    }
}

export const useCartStore = defineStore('cart', () => {
    const items = ref([]);
    const summary = ref({
        total_items: 0,
        total_quantity: 0,
        total_price: 0,
        has_issues: false
    });
    const isLoading = ref(false);
    const loadError = ref(null);

    const savedSelection = loadSavedSelection();
    const selectedBookIds = ref(savedSelection || []);
    const hasInitializedSelection = ref(savedSelection !== null);

    function saveSelectionToStorage() {
        try {
            sessionStorage.setItem(STORAGE_KEY, JSON.stringify(selectedBookIds.value));
        } catch (err) {
            console.error('Không thể lưu trạng thái chọn giỏ hàng:', err);
        }
    }

    function isItemSelectable(item) {
        return Boolean(item && !item.flags?.is_unavailable && !item.flags?.is_out_of_stock);
    }

    function applyCartState(cartData) {
        items.value = cartData?.items || [];
        summary.value = cartData?.summary || {
            total_items: 0,
            total_quantity: 0,
            total_price: 0,
            has_issues: false
        };

        const validSelectableIds = items.value
            .filter(isItemSelectable)
            .map(i => i.book_id);

        if (!hasInitializedSelection.value) {
            selectedBookIds.value = [...validSelectableIds];
            hasInitializedSelection.value = true;
        } else {
            const validSet = new Set(validSelectableIds);
            selectedBookIds.value = selectedBookIds.value.filter(id => validSet.has(id));
        }

        saveSelectionToStorage();
    }

    const totalItems = computed(() => summary.value.total_items);
    const totalQuantity = computed(() => summary.value.total_quantity);
    const totalPrice = computed(() => summary.value.total_price);

    const selectableItems = computed(() => items.value.filter(isItemSelectable));

    const selectedItems = computed(() => {
        const selectedSet = new Set(selectedBookIds.value);
        return items.value.filter(item => selectedSet.has(item.book_id) && isItemSelectable(item));
    });

    const selectedCount = computed(() => selectedItems.value.length);

    const selectedTotalQuantity = computed(() =>
        selectedItems.value.reduce((sum, item) => sum + Number(item.quantity || 0), 0)
    );

    // Cộng trực tiếp subtotal đã làm tròn VND từ server của các dòng được chọn
    const selectedTotalPrice = computed(() =>
        selectedItems.value.reduce((sum, item) => sum + Number(item.subtotal || 0), 0)
    );

    const isAllSelected = computed(() =>
        selectableItems.value.length > 0 &&
        selectableItems.value.every(item => selectedBookIds.value.includes(item.book_id))
    );

    const hasSelectedIssues = computed(() =>
        selectedItems.value.some(
            item => item.flags?.is_unavailable || item.flags?.is_out_of_stock || item.flags?.exceeds_stock
        )
    );

    const canCheckout = computed(() => selectedCount.value > 0 && !hasSelectedIssues.value);

    async function fetchCart() {
        const authStore = useAuthStore();
        if (!authStore.isLoggedIn || authStore.isAdmin) {
            clearLocalCart();
            return { success: true };
        }

        try {
            isLoading.value = true;
            loadError.value = null;
            const res = await cartService.getCart();
            applyCartState(res);
            return { success: true };
        } catch (error) {
            const msg = error.response?.data?.message || 'Không thể tải thông tin giỏ hàng. Vui lòng thử lại.';
            loadError.value = msg;
            console.error('Lỗi tải giỏ hàng:', error);
            return { success: false, message: msg };
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
            return { success: false, message: 'Tài khoản Quản trị viên không thể mua hàng.' };
        }

        try {
            isLoading.value = true;
            const parsedId = Number(bookId);
            const res = await cartService.addToCart(parsedId, quantity);
            if (!selectedBookIds.value.includes(parsedId)) {
                selectedBookIds.value.push(parsedId);
                hasInitializedSelection.value = true;
            }
            applyCartState(res.cart);
            return { success: true };
        } catch (error) {
            const msg = error.response?.data?.message || error.message;
            return { success: false, message: msg };
        } finally {
            isLoading.value = false;
        }
    }

    async function updateQuantity(bookId, quantity) {
        try {
            const res = await cartService.updateQuantity(bookId, quantity);
            applyCartState(res.cart);
            return { success: true, cart: res.cart };
        } catch (error) {
            const msg = error.response?.data?.message || 'Không thể cập nhật số lượng';
            return { success: false, message: msg };
        }
    }

    async function removeItem(bookId) {
        try {
            const res = await cartService.removeItem(bookId);
            applyCartState(res.cart);
            return { success: true, message: res.message };
        } catch (error) {
            const msg = error.response?.data?.message || 'Không thể xóa sản phẩm khỏi giỏ hàng';
            return { success: false, message: msg };
        }
    }

    async function removeSelectedItems() {
        if (selectedBookIds.value.length === 0) {
            return { success: false, message: 'Chưa có sản phẩm nào được chọn để xóa' };
        }
        try {
            const idsToRemove = [...selectedBookIds.value];
            const res = await cartService.clearCart(idsToRemove);
            applyCartState(res.cart);
            return { success: true, message: res.message };
        } catch (error) {
            const msg = error.response?.data?.message || 'Không thể xóa các sản phẩm đã chọn';
            return { success: false, message: msg };
        }
    }

    async function clearCart() {
        try {
            const res = await cartService.clearCart();
            applyCartState(res.cart);
            return { success: true, message: res.message };
        } catch (error) {
            const msg = error.response?.data?.message || 'Không thể làm trống giỏ hàng';
            return { success: false, message: msg };
        }
    }

    function toggleSelectItem(bookId) {
        const parsedId = Number(bookId);
        const item = items.value.find(i => i.book_id === parsedId);
        if (!isItemSelectable(item)) return;

        const idx = selectedBookIds.value.indexOf(parsedId);
        if (idx > -1) {
            selectedBookIds.value.splice(idx, 1);
        } else {
            selectedBookIds.value.push(parsedId);
        }
        saveSelectionToStorage();
    }

    function toggleSelectAll(checked) {
        if (checked) {
            selectedBookIds.value = selectableItems.value.map(i => i.book_id);
        } else {
            selectedBookIds.value = [];
        }
        saveSelectionToStorage();
    }

    function isItemSelected(bookId) {
        return selectedBookIds.value.includes(Number(bookId));
    }

    function clearLocalCart() {
        items.value = [];
        summary.value = {
            total_items: 0,
            total_quantity: 0,
            total_price: 0,
            has_issues: false
        };
        selectedBookIds.value = [];
        hasInitializedSelection.value = false;
        try {
            sessionStorage.removeItem(STORAGE_KEY);
        } catch {
            // ignore storage errors
        }
    }

    return {
        items,
        summary,
        selectedBookIds,
        selectableItems,
        selectedItems,
        selectedCount,
        selectedTotalQuantity,
        selectedTotalPrice,
        isAllSelected,
        hasSelectedIssues,
        canCheckout,
        totalItems,
        totalQuantity,
        totalPrice,
        isLoading,
        loadError,
        fetchCart,
        addToCart,
        updateQuantity,
        removeItem,
        removeSelectedItems,
        clearCart,
        toggleSelectItem,
        toggleSelectAll,
        isItemSelected,
        clearLocalCart
    };
});
