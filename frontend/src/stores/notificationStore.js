import { defineStore } from 'pinia';
import { ref } from 'vue';
import { notificationService } from '@/services/notificationService';
import { useAuthStore } from '@/stores/authStore';

export const useNotificationStore = defineStore('notifications', () => {
  const auth = useAuthStore();
  const recent = ref([]);
  const unread = ref(0);
  const loading = ref(false);
  const error = ref(false);
  const marking = ref(false);
  let request = 0;

  function reset() {
    request++;
    recent.value = [];
    unread.value = 0;
    loading.value = false;
    error.value = false;
    marking.value = false;
  }

  async function refresh() {
    if (!auth.isLoggedIn || loading.value) return;
    const current = ++request;
    loading.value = true;
    error.value = false;
    try {
      const data = await notificationService.list({ limit: 3 });
      if (current !== request) return;
      recent.value = data.notifications;
      unread.value = data.unread;
    } catch {
      if (current === request) error.value = true;
    } finally {
      if (current === request) loading.value = false;
    }
  }

  async function markRead(id, all = false) {
    if (marking.value || !auth.isLoggedIn) return;
    const token = auth.token;
    marking.value = true;
    try {
      if (all) await notificationService.markAllRead(id);
      else await notificationService.markRead(id);
      if (auth.token !== token) return;
      request++;
      loading.value = false;
      await refresh();
    } finally {
      if (auth.token === token) marking.value = false;
    }
  }

  return { recent, unread, loading, error, marking, reset, refresh, markRead };
});
