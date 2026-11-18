<template>
  <component :is="notification.order_id ? RouterLink : 'div'" :to="orderLink"
    class="notification-item d-flex align-items-start gap-3 p-3 text-body text-decoration-none"
    :class="{ 'is-unread': !notification.read_at, 'notification-compact': compact }" @click="openOrder">
    <span class="notification-icon" aria-hidden="true"><i class="bi" :class="icon"></i></span>
    <div class="notification-content">
      <div class="d-flex flex-wrap align-items-center gap-2 mb-1">
        <strong class="small">{{ notification.title }}</strong>
        <span v-if="!notification.read_at" class="unread-dot">
          <span class="visually-hidden">Chưa đọc</span>
        </span>
      </div>
      <p class="small text-secondary mb-1">{{ notification.message }}</p>
      <time class="small text-secondary" :datetime="notification.created_at" :title="date">{{ compact ? relativeDate : date }}</time>
      <button v-if="!notification.order_id && !notification.read_at && !compact" type="button"
        class="btn btn-link btn-sm p-0 ms-2" @click="$emit('read', notification.notification_id)">Đánh dấu đã đọc</button>
    </div>
  </component>
</template>

<script setup>
import { computed } from 'vue';
import { RouterLink } from 'vue-router';

const props = defineProps({ notification: { type: Object, required: true }, compact: Boolean });
const emit = defineEmits(['read']);
const orderLink = computed(() => props.notification.order_id
  ? { name: 'customer-order-detail', params: { orderId: props.notification.order_id } }
  : undefined);
const icons = {
  order_placed: 'bi-receipt',
  order_confirmed: 'bi-box-seam',
  order_picked_up: 'bi-box-arrow-right',
  order_shipping: 'bi-truck',
  order_delivered: 'bi-check-circle',
  order_cancelled: 'bi-x-circle',
};
const icon = computed(() => icons[props.notification.event_type] || 'bi-chat-square-text');
const date = computed(() => new Date(props.notification.created_at).toLocaleDateString('vi-VN'));
const relativeDate = computed(() => {
  const minutes = Math.max(0, Math.floor((Date.now() - Date.parse(props.notification.created_at)) / 60000));
  if (minutes < 1) return 'Vừa xong';
  if (minutes < 60) return `${minutes} phút trước`;
  if (minutes < 1440) return `${Math.floor(minutes / 60)} giờ trước`;
  return date.value;
});

function openOrder() {
  if (props.notification.order_id && !props.notification.read_at) emit('read', props.notification.notification_id);
}
</script>

<style scoped>
.notification-item {
  background: var(--bs-body-bg);
  border: 1px solid #e2e8f0;
  border-radius: 0.75rem;
}
.notification-item.is-unread {
  background: #f3f8ff;
  border-color: #d8e6f7;
}
.notification-compact,
.notification-compact.is-unread {
  border: 0;
  border-radius: 0;
  background: transparent;
}
a.notification-compact:hover { background: #f3f8ff; }
a.notification-item:hover { border-color: #a9bfda; }
.notification-icon {
  display: grid;
  place-items: center;
  flex: 0 0 2.25rem;
  height: 2.25rem;
  border-radius: 50%;
  background: #e7effa;
  color: #315e91;
}
.notification-content { min-width: 0; overflow-wrap: anywhere; }
.unread-dot { width: 0.45rem; height: 0.45rem; border-radius: 50%; background: #3b74b4; }
</style>
