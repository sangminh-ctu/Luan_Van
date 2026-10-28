<template>
  <div class="orders-page bg-light py-4 min-vh-100">
    <!-- Toast Thông báo -->
    <div
      v-if="toast.show"
      class="position-fixed top-0 end-0 p-3"
      style="z-index: 1080; margin-top: 70px;"
    >
      <div
        class="toast show align-items-center border-0 shadow"
        :class="toast.type === 'error' ? 'text-bg-danger' : 'text-bg-success'"
        role="alert"
      >
        <div class="d-flex">
          <div class="toast-body d-flex align-items-center gap-2 fw-medium">
            <i
              class="bi fs-5"
              :class="toast.type === 'error' ? 'bi-exclamation-octagon-fill' : 'bi-check-circle-fill'"
            ></i>
            <span>{{ toast.message }}</span>
          </div>
          <button
            type="button"
            class="btn-close btn-close-white me-2 m-auto"
            @click="toast.show = false"
          ></button>
        </div>
      </div>
    </div>

    <div class="container">
      <!-- Banner Đặt hàng thành công (khi chuyển hướng từ /checkout sang) -->
      <div
        v-if="placedOrderCode"
        class="bg-white border border-success border-opacity-25 rounded-3 shadow-sm p-4 mb-4 d-flex flex-wrap align-items-center justify-content-between gap-3"
      >
        <div class="d-flex align-items-center gap-3">
          <div
            class="rounded-circle bg-success-subtle text-success d-inline-flex align-items-center justify-content-center flex-shrink-0"
            style="width: 54px; height: 54px;"
          >
            <i class="bi bi-check-lg fs-2"></i>
          </div>
          <div>
            <h5 class="fw-bold text-success mb-1">Đặt hàng thành công!</h5>
            <p class="mb-0 text-secondary small">
              Mã đơn hàng của bạn là <strong class="text-dark">{{ placedOrderCode }}</strong>.
              Cảm ơn bạn đã mua sắm tại BookStore!
            </p>
          </div>
        </div>
        <div class="d-flex gap-2">
          <router-link to="/" class="btn btn-outline-danger btn-sm px-3 fw-semibold">
            Tiếp tục mua sắm
          </router-link>
        </div>
      </div>

      <!-- Tiêu đề trang -->
      <div class="d-flex align-items-center justify-content-between mb-3">
        <h1 class="h4 fw-bold text-dark mb-0 text-uppercase">Đơn hàng của tôi</h1>
        <router-link to="/" class="text-decoration-none text-secondary small fw-semibold">
          <i class="bi bi-house-door me-1"></i>Về trang chủ
        </router-link>
      </div>

      <!-- Thanh lọc theo trạng thái -->
      <div class="bg-white rounded-3 shadow-sm mb-3 px-2">
        <ul class="nav nav-underline flex-nowrap overflow-auto">
          <li v-for="tab in statusTabs" :key="tab.value" class="nav-item">
            <button
              type="button"
              class="nav-link py-3 px-3 text-nowrap fw-semibold"
              :class="activeStatus === tab.value ? 'active text-danger border-danger' : 'text-secondary'"
              @click="selectStatusTab(tab.value)"
            >
              {{ tab.label }}
            </button>
          </li>
        </ul>
      </div>

      <!-- Trạng thái đang tải -->
      <div v-if="isLoading" class="bg-white rounded-3 shadow-sm p-5 text-center">
        <div class="spinner-border text-danger mb-3" role="status"></div>
        <p class="text-secondary mb-0">Đang tải danh sách đơn hàng...</p>
      </div>

      <!-- Trạng thái trống -->
      <div v-else-if="orders.length === 0" class="bg-white rounded-3 shadow-sm p-5 text-center">
        <i class="bi bi-receipt text-secondary display-4 d-block mb-3"></i>
        <p class="text-secondary mb-4">Bạn chưa có đơn hàng nào trong mục này.</p>
        <router-link to="/" class="btn btn-danger px-4 py-2 fw-semibold">
          Khám phá sách ngay
        </router-link>
      </div>

      <!-- Danh sách đơn hàng -->
      <div v-else class="d-flex flex-column gap-3">
        <div
          v-for="order in orders"
          :key="order.order_id"
          class="bg-white rounded-3 shadow-sm p-4"
          :class="{ 'border border-danger': placedOrderCode === order.order_code }"
        >
          <!-- Header của thẻ đơn hàng -->
          <div class="d-flex flex-wrap align-items-center justify-content-between gap-2 pb-3 mb-3 border-bottom">
            <div class="d-flex align-items-center flex-wrap gap-2">
              <span class="fw-bold text-dark">{{ order.order_code }}</span>
              <span class="text-secondary small">• {{ formatDateTime(order.order_date) }}</span>
            </div>
            <div class="d-flex align-items-center gap-2">
              <span class="badge" :class="getOrderStatusBadgeClass(order.order_status)">
                {{ getOrderStatusLabel(order.order_status) }}
              </span>
              <span class="badge bg-light text-secondary border">
                {{ getPaymentStatusLabel(order.payment_status) }}
              </span>
            </div>
          </div>

          <!-- Danh sách sách trong đơn -->
          <div
            v-for="item in order.items"
            :key="item.order_item_id"
            class="py-2 d-flex align-items-center gap-3"
          >
            <router-link :to="`/books/${item.book_id}`" class="flex-shrink-0">
              <img
                :src="getBookImage(item.book)"
                :alt="item.book?.title"
                class="rounded border p-1 bg-white"
                style="width: 60px; height: 78px; object-fit: contain;"
              >
            </router-link>
            <div class="flex-grow-1 min-w-0">
              <router-link
                :to="`/books/${item.book_id}`"
                class="text-dark text-decoration-none fw-medium d-block mb-1"
              >
                {{ item.book?.title || `Sách #${item.book_id}` }}
              </router-link>
              <div class="small text-secondary">
                Đơn giá lúc mua: {{ formatCurrency(item.unit_price_at_purchase) }} × {{ item.quantity }}
              </div>
            </div>
            <div class="text-end fw-semibold text-dark">
              {{ formatCurrency(item.line_total) }}
            </div>
          </div>

          <!-- Địa chỉ nhận & Thông tin vận chuyển + Tổng tiền -->
          <div class="pt-3 mt-3 border-top d-flex flex-wrap align-items-end justify-content-between gap-3">
            <div class="small text-secondary">
              <div v-if="order.address" class="mb-1">
                <i class="bi bi-geo-alt me-1 text-danger"></i>
                <strong>{{ order.address.recipient_name }}</strong> ({{ order.address.recipient_phone }}) —
                {{ order.address.street_detail }}, {{ order.address.ward }},
                {{ order.address.district }}, {{ order.address.province }}
              </div>
              <div v-if="order.shipment && (order.shipment.carrier_name || order.shipment.tracking_code)">
                <i class="bi bi-truck me-1 text-primary"></i>
                Đơn vị giao: <strong>{{ order.shipment.carrier_name || 'Đang cập nhật' }}</strong>
                <span v-if="order.shipment.tracking_code" class="ms-2">
                  | Mã vận đơn: <strong>{{ order.shipment.tracking_code }}</strong>
                </span>
              </div>
            </div>

            <div class="text-end ms-auto">
              <div class="small text-secondary mb-1">
                Tạm tính: {{ formatCurrency(order.subtotal) }} |
                Phí vận chuyển: {{ order.shipping_fee === 0 ? 'Miễn phí' : formatCurrency(order.shipping_fee) }}
              </div>
              <div class="mb-2">
                <span class="text-secondary me-2">Tổng số tiền:</span>
                <span class="fs-5 fw-bold text-danger">{{ formatCurrency(order.total_amount) }}</span>
              </div>

              <!-- Chỉ cho phép khách hủy đơn khi order_status === 'processing' -->
              <div v-if="order.order_status === 'processing'">
                <button
                  type="button"
                  class="btn btn-outline-danger btn-sm px-3 fw-semibold"
                  :disabled="cancellingId === order.order_id"
                  @click="openCancelConfirm(order)"
                >
                  <span v-if="cancellingId === order.order_id" class="spinner-border spinner-border-sm me-1"></span>
                  Hủy đơn hàng
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- Phân trang (5 đơn / trang) -->
        <div
          v-if="pagination.totalPages > 1"
          class="bg-white rounded-3 shadow-sm py-3 px-4 d-flex flex-wrap align-items-center justify-content-between gap-2 mt-1"
        >
          <span class="small text-secondary">
            Hiển thị <strong>{{ orders.length }}</strong> / <strong>{{ pagination.total }}</strong> đơn hàng
          </span>
          <div class="d-flex align-items-center gap-1">
            <button
              type="button"
              class="btn btn-sm btn-outline-secondary px-3"
              :disabled="pagination.page <= 1"
              @click="changePage(pagination.page - 1)"
            >
              <i class="bi bi-chevron-left me-1"></i>Trước
            </button>
            <button
              v-for="pageNum in pagination.totalPages"
              :key="pageNum"
              type="button"
              class="btn btn-sm px-3 fw-semibold"
              :class="pagination.page === pageNum ? 'btn-danger text-white' : 'btn-light border text-secondary'"
              @click="changePage(pageNum)"
            >
              {{ pageNum }}
            </button>
            <button
              type="button"
              class="btn btn-sm btn-outline-secondary px-3"
              :disabled="pagination.page >= pagination.totalPages"
              @click="changePage(pagination.page + 1)"
            >
              Sau<i class="bi bi-chevron-right ms-1"></i>
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Modal xác nhận hủy đơn hàng -->
    <div
      v-if="orderToCancel"
      class="modal fade show d-block"
      tabindex="-1"
      style="background-color: rgba(0, 0, 0, 0.5); z-index: 1060;"
      @click.self="orderToCancel = null"
    >
      <div class="modal-dialog modal-dialog-centered modal-sm">
        <div class="modal-content border-0 shadow rounded-3">
          <div class="modal-body p-4 text-center">
            <i class="bi bi-x-circle text-danger display-6 d-block mb-3"></i>
            <h6 class="fw-bold text-dark mb-2">Xác nhận hủy đơn hàng?</h6>
            <p class="small text-secondary mb-4">
              Bạn có chắc muốn hủy đơn hàng <strong>{{ orderToCancel.order_code }}</strong>?
              Số lượng sách sẽ được hoàn lại vào kho.
            </p>
            <div class="d-flex gap-2 justify-content-center">
              <button
                type="button"
                class="btn btn-light border px-3 fw-semibold flex-grow-1"
                :disabled="cancellingId !== null"
                @click="orderToCancel = null"
              >
                Đóng
              </button>
              <button
                type="button"
                class="btn btn-danger px-3 fw-semibold flex-grow-1"
                :disabled="cancellingId !== null"
                @click="confirmCancelOrder"
              >
                <span v-if="cancellingId !== null" class="spinner-border spinner-border-sm me-1"></span>
                Hủy đơn
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, onBeforeUnmount } from 'vue';
import { useRoute } from 'vue-router';
import { orderService } from '@/services/orderService';
import { getBookCoverUrl } from '@/utils/imageHelper';

const route = useRoute();

const orders = ref([]);
const isLoading = ref(false);
const activeStatus = ref('all');
const cancellingId = ref(null);
const orderToCancel = ref(null);

const pagination = reactive({
  total: 0,
  page: 1,
  limit: 5,
  totalPages: 1
});

const placedOrderCode = computed(() => route.query.placed || '');

const statusTabs = [
  { value: 'all', label: 'Tất cả' },
  { value: 'processing', label: 'Chờ xác nhận' },
  { value: 'confirmed', label: 'Đã xác nhận' },
  { value: 'shipping', label: 'Đang giao hàng' },
  { value: 'delivered', label: 'Đã giao' },
  { value: 'cancelled', label: 'Đã hủy' }
];

const toast = reactive({
  show: false,
  message: '',
  type: 'success'
});
let toastTimer = null;

function triggerToast(message, type = 'success') {
  if (toastTimer) clearTimeout(toastTimer);
  toast.message = message;
  toast.type = type;
  toast.show = true;
  toastTimer = setTimeout(() => {
    toast.show = false;
  }, 3200);
}

function formatCurrency(val) {
  const num = Math.round(Number(val) || 0);
  return num.toLocaleString('vi-VN') + ' đ';
}

function formatDateTime(dateStr) {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
}

function getBookImage(book) {
  return getBookCoverUrl(book?.images, book?.title || 'Book');
}

function getOrderStatusLabel(status) {
  const map = {
    processing: 'Chờ xác nhận',
    confirmed: 'Đã xác nhận',
    shipping: 'Đang vận chuyển',
    delivered: 'Giao thành công',
    cancelled: 'Đã hủy'
  };
  return map[status] || status;
}

function getOrderStatusBadgeClass(status) {
  const map = {
    processing: 'bg-warning-subtle text-warning-emphasis border border-warning-subtle',
    confirmed: 'bg-info-subtle text-info-emphasis border border-info-subtle',
    shipping: 'bg-primary-subtle text-primary border border-primary-subtle',
    delivered: 'bg-success-subtle text-success border border-success-subtle',
    cancelled: 'bg-secondary-subtle text-secondary border border-secondary-subtle'
  };
  return map[status] || 'bg-secondary';
}

function getPaymentStatusLabel(status) {
  const map = {
    pending: 'COD - Chưa thanh toán',
    paid: 'Đã thanh toán',
    failed: 'Thanh toán lỗi',
    refunded: 'Đã hoàn tiền'
  };
  return map[status] || status;
}

async function fetchOrders() {
  try {
    isLoading.value = true;
    const res = await orderService.getMyOrders({
      status: activeStatus.value,
      page: pagination.page,
      limit: pagination.limit
    });
    orders.value = res.orders || [];
    if (res.pagination) {
      Object.assign(pagination, res.pagination);
    }
  } catch (error) {
    triggerToast(error.response?.data?.message || 'Không thể tải danh sách đơn hàng', 'error');
  } finally {
    isLoading.value = false;
  }
}

function selectStatusTab(status) {
  activeStatus.value = status;
  pagination.page = 1;
  fetchOrders();
}

function changePage(newPage) {
  if (newPage < 1 || newPage > pagination.totalPages || newPage === pagination.page) return;
  pagination.page = newPage;
  window.scrollTo({ top: 0, behavior: 'smooth' });
  fetchOrders();
}

function openCancelConfirm(order) {
  orderToCancel.value = order;
}

async function confirmCancelOrder() {
  if (!orderToCancel.value) return;
  const targetId = orderToCancel.value.order_id;

  try {
    cancellingId.value = targetId;
    const res = await orderService.cancelMyOrder(targetId);
    triggerToast(res.message || 'Đã hủy đơn hàng thành công', 'success');
    orderToCancel.value = null;
    await fetchOrders();
  } catch (error) {
    triggerToast(error.response?.data?.message || 'Không thể hủy đơn hàng', 'error');
  } finally {
    cancellingId.value = null;
  }
}

onMounted(() => {
  fetchOrders();
});

onBeforeUnmount(() => {
  if (toastTimer) clearTimeout(toastTimer);
});
</script>
