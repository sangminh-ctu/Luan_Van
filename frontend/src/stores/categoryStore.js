import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { publicCategoryService } from '@/services/categoryService';

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 phút

export const useCategoryStore = defineStore('category', () => {
  const categoryTree = ref([]);
  const flatCategories = ref([]);
  const lastFetched = ref(null);
  const isLoading = ref(false);
  const error = ref(null);

  // Danh mục gốc hiển thị trên thanh ngang (tối đa 6 mục đầu để không bị tràn)
  const visibleTopCategories = computed(() => {
    return categoryTree.value.slice(0, 6);
  });

  const isCacheValid = computed(() => {
    return (
      lastFetched.value !== null &&
      Date.now() - lastFetched.value < CACHE_TTL_MS &&
      categoryTree.value.length > 0
    );
  });

  function rebuildFlatCategories(tree) {
    const flat = [];
    for (const parent of tree) {
      flat.push({
        category_id: parent.category_id,
        category_name: parent.category_name,
        parent_category_id: null
      });
      if (Array.isArray(parent.children)) {
        for (const child of parent.children) {
          flat.push({
            category_id: child.category_id,
            category_name: child.category_name,
            parent_category_id: parent.category_id
          });
        }
      }
    }
    return flat;
  }

  async function fetchCategories(force = false) {
    if (!force && isCacheValid.value) {
      return categoryTree.value;
    }

    try {
      isLoading.value = true;
      error.value = null;
      const data = await publicCategoryService.getCategories();
      categoryTree.value = Array.isArray(data) ? data : [];
      flatCategories.value = rebuildFlatCategories(categoryTree.value);
      lastFetched.value = Date.now();
      return categoryTree.value;
    } catch (err) {
      console.error('Lỗi tải danh mục thể loại:', err);
      error.value = err.message || 'Không thể tải danh mục';
      // Giữ nguyên categoryTree cũ nếu có, không làm vỡ UI
      return categoryTree.value;
    } finally {
      isLoading.value = false;
    }
  }

  function getCategoryById(id) {
    if (!id) return null;
    const numId = Number(id);
    return flatCategories.value.find(c => c.category_id === numId) || null;
  }

  /**
   * Kiểm tra xem một danh mục cha hoặc chính nó có đang active hay không
   */
  function isParentOrSelfActive(catId, currentRouteCatId) {
    if (!currentRouteCatId) return false;
    const targetId = Number(catId);
    const currentId = Number(currentRouteCatId);
    if (targetId === currentId) return true;

    const currentCat = getCategoryById(currentId);
    if (currentCat && Number(currentCat.parent_category_id) === targetId) {
      return true;
    }
    return false;
  }

  /**
   * Trả về mảng breadcrumb cha > con: [ { category_id, category_name }, ... ]
   */
  function getBreadcrumb(currentRouteCatId) {
    if (!currentRouteCatId) return [];
    const currentCat = getCategoryById(currentRouteCatId);
    if (!currentCat) return [];

    if (currentCat.parent_category_id) {
      const parentCat = getCategoryById(currentCat.parent_category_id);
      if (parentCat) {
        return [parentCat, currentCat];
      }
    }
    return [currentCat];
  }

  // Tự động kiểm tra làm mới cache khi người dùng quay lại tab
  if (typeof window !== 'undefined' && typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && !isCacheValid.value) {
        fetchCategories();
      }
    });
  }

  return {
    categoryTree,
    flatCategories,
    visibleTopCategories,
    isLoading,
    error,
    lastFetched,
    fetchCategories,
    getCategoryById,
    isParentOrSelfActive,
    getBreadcrumb
  };
});
