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
        <h1 class="h4 fw-bold text-dark mb-0 text-uppercase">{{ selectedOrderId ? 'Chi tiết đơn hàng' : 'Đơn hàng của tôi' }}</h1>
        <router-link v-if="selectedOrderId" :to="{ name: 'customer-orders' }" class="text-decoration-none text-secondary small fw-semibold">
          <i class="bi bi-arrow-left me-1" aria-hidden="true"></i>Đơn hàng của tôi
        </router-link>
        <router-link v-else to="/" class="text-decoration-none text-secondary small fw-semibold">
          <i class="bi bi-house-door me-1"></i>Về trang chủ
        </router-link>
      </div>

      <!-- Thanh lọc theo trạng thái -->
      <div v-if="!selectedOrderId" class="bg-white rounded-3 shadow-sm mb-3 px-2">
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
        <p class="text-secondary mb-0">Đang tải đơn hàng...</p>
      </div>
      <div v-else-if="orderError" class="alert alert-danger" role="alert">{{ orderError }}</div>

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
              <button v-if="order.order_status === 'delivered' && !myReviews[item.order_item_id] && reviewItemId !== item.order_item_id"
                type="button" class="btn btn-sm btn-outline-primary mt-2"
                :disabled="reviewBusy" @click="openReview(item)">
                Đánh giá
              </button>
              <div v-if="myReviews[item.order_item_id]" class="small border-start ps-3 mt-2">
                <template v-if="myReviews[item.order_item_id].deleted_at">
                  <strong class="text-secondary">Đánh giá đã được xóa trước đây</strong>
                </template>
                <template v-else-if="myReviews[item.order_item_id].visibility_status === 'hidden'">
                  <strong class="text-warning-emphasis">Đánh giá đã bị ẩn</strong>
                  <p v-if="myReviews[item.order_item_id].moderation_reason" class="mb-0 text-break">
                    Lý do ẩn: {{ myReviews[item.order_item_id].moderation_reason }}
                  </p>
                </template>
                <template v-else>
                  <strong class="text-success">Đã đánh giá</strong>
                  <div class="d-flex align-items-center gap-2 mt-1">
                    <span class="review-summary-stars" role="img" :aria-label="`${myReviews[item.order_item_id].rating} trên 5 sao`">
                      <i v-for="star in 5" :key="star" class="bi" aria-hidden="true"
                        :class="star <= myReviews[item.order_item_id].rating ? 'bi-star-fill' : 'bi-star'"></i>
                    </span>
                    <time v-if="myReviews[item.order_item_id].created_at" class="text-secondary"
                      :datetime="myReviews[item.order_item_id].created_at">{{ formatDateTime(myReviews[item.order_item_id].created_at) }}</time>
                  </div>
                  <p v-if="myReviews[item.order_item_id].comment" class="review-summary-comment mb-0 mt-1">
                    {{ myReviews[item.order_item_id].comment }}
                  </p>
                </template>
              </div>
              <form v-if="reviewItemId === item.order_item_id" class="mt-2" @submit.prevent="saveReview(item)">
                <p class="small text-secondary mb-2">Đánh giá chỉ gửi được một lần và không thể chỉnh sửa hoặc xóa.</p>
                <fieldset class="mb-2" :disabled="reviewBusy">
                  <legend class="form-label float-none fs-6 mb-1">Số sao</legend>
                  <div class="d-flex gap-1">
                    <label v-for="star in 5" :key="star" class="review-star-option">
                      <input v-model="reviewRating" type="radio" :name="`review-rating-${item.order_item_id}`"
                        :value="star" class="visually-hidden" required>
                      <i class="bi" :class="star <= reviewRating ? 'bi-star-fill' : 'bi-star'" aria-hidden="true"></i>
                      <span class="visually-hidden">{{ star }} sao</span>
                    </label>
                  </div>
                </fieldset>
                <label class="form-label d-block">
                  Nhận xét (không bắt buộc)
                  <textarea v-model="reviewComment" class="form-control" maxlength="1000" rows="3" :disabled="reviewBusy"></textarea>
                </label>
                <p v-if="reviewError" class="text-danger small" role="alert">{{ reviewError }}</p>
                <div class="d-flex gap-2 flex-wrap">
                  <button class="btn btn-sm btn-primary" :disabled="reviewBusy || !reviewRating">Gửi đánh giá</button>
                  <button type="button" class="btn btn-sm btn-light" :disabled="reviewBusy" @click="reviewItemId = null">Đóng</button>
                </div>
              </form>
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
                <div v-if="order.voucher_id" class="small text-success mb-1">Mã {{ order.voucher?.code }}: −{{ formatCurrency(order.voucher_discount_amount) }}</div>
                <span class="text-secondary me-2">Tổng số tiền:</span>
                <span class="fs-5 fw-bold text-danger">{{ formatCurrency(order.total_amount) }}</span>
              </div>

              <div v-if="order.payment_method === 'vnpay'" class="small mb-2">
                <span v-if="order.payment_review_required" class="text-danger d-block">Giao dịch cần đối soát. Vui lòng liên hệ cửa hàng.</span>
                <span v-else-if="order.can_pay" class="text-secondary d-block">Thanh toán trước {{ new Date(order.payment_expires_at).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }) }}</span>
                <button v-if="order.can_pay" class="btn btn-danger btn-sm me-2 mt-2" :disabled="payingId === order.order_id" @click="payOrder(order)">{{ payingId === order.order_id ? 'Đang chuyển…' : 'Thanh toán VNPAY' }}</button>
                <RouterLink v-if="order.payment" class="btn btn-outline-secondary btn-sm mt-2" :to="{ path: '/payment/vnpay-return', query: { reference: order.payment.reference } }">Kiểm tra thanh toán</RouterLink>
              </div>
              <div v-if="order.can_cancel">
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
          v-if="!selectedOrderId && pagination.totalPages > 1"
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
import { ref, reactive, computed, watch, onBeforeUnmount } from 'vue';
import { useRoute } from 'vue-router';
import { orderService } from '@/services/orderService';
import { reviewService } from '@/services/reviewService';
import { getBookCoverUrl } from '@/utils/imageHelper';

const route = useRoute();
const selectedOrderId = computed(() => route.params.orderId);
const orderError = ref('');
let orderRequest = 0;

const orders = ref([]);
const myReviews = ref({});
const reviewItemId = ref(null);
const reviewRating = ref('');
const reviewComment = ref('');
const reviewBusy = ref(false);
const reviewError = ref('');

async function openReview(item) {
  const itemId = item.order_item_id;
  if (reviewBusy.value || myReviews.value[itemId]) return;
  reviewBusy.value = true;
  reviewError.value = '';
  reviewItemId.value = null;
  try {
    const [review] = await reviewService.mine([itemId]);
    if (review) {
      myReviews.value[itemId] = review;
      return;
    }
    reviewRating.value = '';
    reviewComment.value = '';
    reviewItemId.value = itemId;
  } catch {
    triggerToast('Không thể kiểm tra đánh giá. Vui lòng thử lại.', 'error');
  } finally {
    reviewBusy.value = false;
  }
}

async function saveReview(item) {
  if (reviewBusy.value || !reviewRating.value) return;
  const itemId = item.order_item_id;
  reviewBusy.value = true;
  reviewError.value = '';
  try {
    myReviews.value[itemId] = await reviewService.create(itemId, {
      rating: reviewRating.value,
      comment: reviewComment.value,
    });
    reviewItemId.value = null;
    triggerToast('Đã gửi đánh giá.');
  } catch (error) {
    reviewError.value = error.response?.data?.message || 'Không thể gửi đánh giá.';
    if (error.response?.status === 409) {
      const [review] = await reviewService.mine([itemId]).catch(() => []);
      if (review) {
        myReviews.value[itemId] = review;
        reviewItemId.value = null;
        triggerToast('Dòng đơn hàng này đã được đánh giá.');
      }
    }
  } finally {
    reviewBusy.value = false;
  }
}

const isLoading = ref(false);
const activeStatus = ref('all');
const cancellingId = ref(null);
const payingId = ref(null);
async function payOrder(order) {
  payingId.value = order.order_id;
  try {
    const data = await orderService.paymentLink(order.order_id);
    window.location.assign(data.payment_url);
  } catch (error) {
    triggerToast(error.response?.data?.message || 'Không thể mở thanh toán. Vui lòng thử lại.', 'error');
  } finally { payingId.value = null; }
}
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
  const request = ++orderRequest;
  orderError.value = '';
  try {
    isLoading.value = true;
    if (selectedOrderId.value) {
      const { order } = await orderService.getMyOrderDetail(selectedOrderId.value);
      if (request !== orderRequest) return;
      orders.value = [order];
    } else {
      const res = await orderService.getMyOrders({
        status: activeStatus.value,
        page: pagination.page,
        limit: pagination.limit
      });
      if (request !== orderRequest) return;
      orders.value = res.orders || [];
      if (res.pagination) Object.assign(pagination, res.pagination);
    }
    reviewItemId.value = null;
    const itemIds = [...new Set(orders.value
      .filter(order => order.order_status === 'delivered')
      .flatMap(order => order.items.map(item => item.order_item_id)))];
    if (itemIds.length) {
      try {
        for (let start = 0; start < itemIds.length; start += 100) {
          const reviews = await reviewService.mine(itemIds.slice(start, start + 100));
          for (const review of reviews) myReviews.value[review.order_item_id] = review;
        }
      } catch {
        // Customers can retry loading their review using the item button.
      }
    }
  } catch (error) {
    if (request === orderRequest) orderError.value = error.response?.data?.message || 'Không thể tải đơn hàng.';
  } finally {
    if (request === orderRequest) isLoading.value = false;
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

watch(selectedOrderId, fetchOrders, { immediate: true });

onBeforeUnmount(() => {
  if (toastTimer) clearTimeout(toastTimer);
});
</script>

<style scoped>
.review-summary-stars {
  display: inline-flex;
  gap: 0.15rem;
  color: #a86400;
}

.review-summary-comment {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.review-star-option {
  position: relative;
  display: grid;
  place-items: center;
  width: 2.25rem;
  height: 2.25rem;
  border-radius: 0.25rem;
  color: #a86400;
  font-size: 1.375rem;
  cursor: pointer;
}

.review-star-option:focus-within {
  outline: 2px solid var(--bs-primary);
  outline-offset: 1px;
}
</style>
