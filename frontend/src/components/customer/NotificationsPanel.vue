<template>
  <section class="card border-0 shadow-sm rounded-3 overflow-hidden" aria-labelledby="notifications-heading">
    <div class="d-flex align-items-center justify-content-between flex-wrap gap-2 p-3 p-md-4 border-bottom">
      <h1 id="notifications-heading" class="h5 fw-bold mb-0">Thông báo</h1>
      <button v-if="unread" type="button" class="btn btn-sm btn-outline-primary" :disabled="marking || loading"
        @click="markRead()">
        <i class="bi bi-check2-all me-1" aria-hidden="true"></i>Đánh dấu tất cả đã đọc
      </button>
    </div>
    <p v-if="loading && !notifications.length" class="p-4 mb-0 text-secondary" role="status">Đang tải thông báo…</p>
    <div v-if="error" class="m-3 alert alert-danger" role="alert">
      {{ error }}
      <button v-if="retryLoad" type="button" class="btn btn-sm btn-link" @click="load(retryCursor)">Thử lại</button>
    </div>
    <p v-if="!loading && !error && !notifications.length" class="p-4 mb-0 text-secondary">Bạn chưa có thông báo.</p>
    <ul v-if="notifications.length" class="list-unstyled d-grid gap-3 p-3 p-md-4 mb-0">
      <li v-for="notification in notifications" :key="notification.notification_id">
        <NotificationItem :notification="notification" @read="markRead($event)" />
      </li>
    </ul>
    <div v-if="next && !retryLoad" class="p-3 text-center border-top">
      <button class="btn btn-outline-secondary btn-sm" type="button" :disabled="loading || marking" @click="load(next)">
        {{ loading ? 'Đang tải…' : 'Xem thông báo cũ hơn' }}
      </button>
    </div>
  </section>
</template>

<script setup>
import { onMounted, ref } from 'vue';
import NotificationItem from '@/components/customer/NotificationItem.vue';
import { notificationService } from '@/services/notificationService';
import { useNotificationStore } from '@/stores/notificationStore';

const preview = useNotificationStore();
const notifications = ref([]);
const unread = ref(0);
const next = ref(null);
const loading = ref(false);
const marking = ref(false);
const error = ref('');
const retryLoad = ref(false);
const retryCursor = ref(null);

async function load(before) {
  if (loading.value) return;
  loading.value = true;
  error.value = '';
  retryLoad.value = false;
  try {
    const data = await notificationService.list({ before });
    notifications.value = before ? [...notifications.value, ...data.notifications] : data.notifications;
    next.value = data.next;
    unread.value = data.unread;
  } catch {
    error.value = 'Không thể tải thông báo.';
    retryLoad.value = true;
    retryCursor.value = before;
  } finally {
    loading.value = false;
  }
}

async function markRead(id = null) {
  if (marking.value || loading.value || !notifications.value.length) return;
  marking.value = true;
  error.value = '';
  retryLoad.value = false;
  try {
    await preview.markRead(id ?? notifications.value[0].notification_id, id == null);
    await load();
  } catch {
    error.value = 'Không thể đánh dấu thông báo đã đọc.';
  } finally {
    marking.value = false;
  }
}

onMounted(() => load());
</script>
