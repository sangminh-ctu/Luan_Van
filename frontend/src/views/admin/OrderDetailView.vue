<template>
  <div class="container-fluid py-2">
    <!-- Toast Thông báo -->
    <div
      v-if="toast.show"
      class="position-fixed top-0 end-0 p-3"
      style="z-index: 1080; margin-top: 20px;"
    >
      <div
        class="toast show align-items-center border-0 shadow"
        :class="toast.type === 'error' ? 'text-bg-danger' : 'text-bg-success'"
      >
        <div class="d-flex">
          <div class="toast-body fw-medium">{{ toast.message }}</div>
          <button type="button" class="btn-close btn-close-white me-2 m-auto" @click="toast.show = false"></button>
        </div>
      </div>
    </div>

    <!-- Header & Nút quay lại -->
    <div class="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-3">
      <div>
        <router-link to="/admin/orders" class="text-decoration-none text-secondary small fw-semibold">
          <i class="bi bi-arrow-left me-1"></i>Quay lại danh sách đơn hàng
        </router-link>
        <div class="d-flex align-items-center gap-3 mt-1">
          <h4 class="fw-bold text-dark mb-0">
            Đơn hàng {{ order?.order_code || '' }}
          </h4>
          <span
            v-if="order"
            class="badge rounded-pill px-3 py-2 fw-semibold"
            :class="getOrderStatusBadgeClass(order.order_status)"
          >
            {{ getOrderStatusLabel(order.order_status) }}
          </span>
        </div>
      </div>

      <div v-if="order" class="text-secondary small">
        <i class="bi bi-clock me-1"></i>Ngày đặt: <strong>{{ formatDateTime(order.order_date) }}</strong>
      </div>
    </div>

    <div v-if="isLoading" class="card border-0 shadow-sm rounded-4 p-5 text-center">
      <div class="spinner-border text-primary mb-2" role="status"></div>
      <div class="text-secondary small">Đang tải chi tiết đơn hàng...</div>
    </div>

    <div v-else-if="!order" class="card border-0 shadow-sm rounded-4 p-5 text-center text-secondary">
      Không tìm thấy thông tin đơn hàng.
    </div>

    <div v-else class="row g-3">
      <!-- Cột trái: Tiến trình + Danh sách sách + Thông tin người nhận -->
      <div class="col-lg-8">
        <!-- Thanh tiến trình đơn hàng -->
        <div v-if="order.order_status !== 'cancelled'" class="card border-0 shadow-sm rounded-4 mb-3">
          <div class="card-body py-3 px-4">
            <div class="d-flex justify-content-between position-relative">
              <div
                v-for="(step, idx) in orderSteps"
                :key="step.key"
                class="d-flex flex-column align-items-center text-center flex-fill"
              >
                <div
                  class="rounded-circle d-flex align-items-center justify-content-center mb-1 fw-bold"
                  style="width: 34px; height: 34px; font-size: 14px;"
                  :class="isStepReached(idx) ? 'bg-primary text-white shadow-sm' : 'bg-light text-secondary border'"
                >
                  <i :class="step.icon"></i>
                </div>
                <div
                  class="small fw-semibold"
                  :class="isStepReached(idx) ? 'text-primary' : 'text-secondary'"
                >
                  {{ step.label }}
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Danh sách sách trong đơn -->
        <div class="card border-0 shadow-sm rounded-4 overflow-hidden mb-3">
          <div class="card-header bg-white py-3 px-4 d-flex align-items-center justify-content-between">
            <h6 class="fw-bold text-dark mb-0">
              <i class="bi bi-book me-2 text-primary"></i>Danh sách sản phẩm ({{ order.items?.length || 0 }})
            </h6>
          </div>
          <div class="card-body p-0">
            <div class="table-responsive">
              <table class="table align-middle mb-0">
                <thead class="table-light">
                  <tr>
                    <th class="ps-4">Sản phẩm</th>
                    <th class="text-end">Đơn giá mua</th>
                    <th class="text-center">Số lượng</th>
                    <th class="text-end pe-4">Thành tiền</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="item in order.items" :key="item.order_item_id">
                    <td class="ps-4">
                      <div class="d-flex align-items-center gap-3">
                        <img
                          :src="getBookImage(item.book)"
                          :alt="item.book?.title"
                          class="rounded border p-1 bg-white flex-shrink-0"
                          style="width: 48px; height: 64px; object-fit: contain;"
                        >
                        <div>
                          <div class="fw-semibold text-dark">{{ item.book?.title }}</div>
                          <div class="small text-secondary">
                            {{ item.book?.cover_type || 'Bìa mềm' }}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td class="text-end">{{ formatCurrency(item.unit_price_at_purchase) }}</td>
                    <td class="text-center">
                      <span class="badge bg-light text-dark border px-2 py-1">x{{ item.quantity }}</span>
                    </td>
                    <td class="text-end pe-4 fw-bold text-danger">{{ formatCurrency(item.line_total) }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
          <div class="card-footer bg-white py-3 px-4 text-end">
            <div class="small text-secondary mb-1">
              Tạm tính: <strong>{{ formatCurrency(order.subtotal) }}</strong>
              <span class="mx-2">|</span>
              Phí vận chuyển:
              <strong>{{ order.shipping_fee === 0 ? 'Miễn phí' : formatCurrency(order.shipping_fee) }}</strong>
            </div>
            <div class="fs-5 fw-bold text-danger">
              Tổng cộng: {{ formatCurrency(order.total_amount) }}
            </div>
          </div>
        </div>

        <!-- Thông tin người nhận & Địa chỉ -->
        <div class="card border-0 shadow-sm rounded-4">
          <div class="card-header bg-white py-3 px-4">
            <h6 class="fw-bold text-dark mb-0">
              <i class="bi bi-geo-alt-fill text-danger me-2"></i>Thông tin người nhận hàng
            </h6>
          </div>
          <div class="card-body px-4">
            <div class="row g-2 small">
              <div class="col-md-6">
                <span class="text-secondary">Họ và tên người nhận:</span>
                <strong class="text-dark ms-1">{{ order.address?.recipient_name }}</strong>
              </div>
              <div class="col-md-6">
                <span class="text-secondary">Số điện thoại:</span>
                <strong class="text-dark ms-1">{{ order.address?.recipient_phone }}</strong>
              </div>
              <div class="col-12 mt-2">
                <span class="text-secondary">Địa chỉ giao hàng:</span>
                <span class="text-dark fw-medium ms-1">
                  {{ order.address?.street_detail }}, {{ order.address?.ward }},
                  {{ order.address?.district }}, {{ order.address?.province }}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Cột phải: Xử lý đơn hàng & Vận chuyển -->
      <div class="col-lg-4">
        <!-- Khung xử lý trạng thái đơn hàng -->
        <div class="card border-0 shadow-sm rounded-4 mb-3">
          <div class="card-header bg-white py-3 px-4">
            <h6 class="fw-bold text-dark mb-0">Xử lý trạng thái đơn hàng</h6>
          </div>
          <div class="card-body px-4">
            <div class="mb-3 small">
              <div class="d-flex justify-content-between align-items-center mb-2">
                <span class="text-secondary">Trạng thái đơn:</span>
                <span class="badge rounded-pill px-2 py-1" :class="getOrderStatusBadgeClass(order.order_status)">
                  {{ getOrderStatusLabel(order.order_status) }}
                </span>
              </div>
              <div class="d-flex justify-content-between align-items-center mb-2">
                <span class="text-secondary">Hình thức thanh toán:</span>
                <strong class="text-dark">Thanh toán khi nhận hàng (COD)</strong>
              </div>
              <div class="d-flex justify-content-between align-items-center">
                <span class="text-secondary">Trạng thái thanh toán:</span>
                <span class="badge rounded-pill px-2 py-1" :class="getPaymentStatusBadgeClass(order.payment_status)">
                  {{ getPaymentStatusLabel(order.payment_status) }}
                </span>
              </div>
            </div>

            <hr>

            <!-- Bước 1: Chờ xác nhận -> Xác nhận đơn hoặc Hủy đơn -->
            <div v-if="order.order_status === 'processing'" class="d-grid gap-2">
              <button
                type="button"
                class="btn btn-primary fw-semibold py-2"
                :disabled="isUpdating"
                @click="handleTransition('confirmed')"
              >
                <span v-if="isUpdating" class="spinner-border spinner-border-sm me-1"></span>
                <i v-else class="bi bi-check2-circle me-1"></i>
                Xác nhận đơn hàng
              </button>
              <button
                type="button"
                class="btn btn-outline-danger fw-semibold py-2"
                :disabled="isUpdating"
                @click="showCancelConfirm = true"
              >
                <i class="bi bi-x-circle me-1"></i>Hủy đơn & Hoàn kho
              </button>
            </div>

            <!-- Bước 2: Đã xác nhận -> Bàn giao vận chuyển hoặc Hủy đơn -->
            <div v-else-if="order.order_status === 'confirmed'">
              <div class="mb-2">
                <label class="form-label small fw-semibold text-secondary mb-1">Đơn vị vận chuyển</label>
                <input
                  v-model.trim="shipmentForm.carrier_name"
                  type="text"
                  class="form-control form-control-sm"
                  placeholder="VD: Giao Hàng Nhanh / Viettel Post"
                >
              </div>
              <div class="mb-3">
                <label class="form-label small fw-semibold text-secondary mb-1">Mã vận đơn</label>
                <input
                  v-model.trim="shipmentForm.tracking_code"
                  type="text"
                  class="form-control form-control-sm"
                  placeholder="VD: GHN8923412"
                >
              </div>
              <div class="d-grid gap-2">
                <button
                  type="button"
                  class="btn btn-primary fw-semibold py-2"
                  :disabled="isUpdating"
                  @click="handleTransition('shipping')"
                >
                  <span v-if="isUpdating" class="spinner-border spinner-border-sm me-1"></span>
                  <i v-else class="bi bi-truck me-1"></i>
                  Bàn giao cho đơn vị vận chuyển
                </button>
                <button
                  type="button"
                  class="btn btn-outline-danger fw-semibold py-2"
                  :disabled="isUpdating"
                  @click="showCancelConfirm = true"
                >
                  <i class="bi bi-x-circle me-1"></i>Hủy đơn & Hoàn kho
                </button>
              </div>
            </div>

            <!-- Bước 3: Đang giao hàng -> Xác nhận Đã giao hàng -->
            <div v-else-if="order.order_status === 'shipping'" class="d-grid gap-2">
              <button
                type="button"
                class="btn btn-success fw-semibold py-2"
                :disabled="isUpdating"
                @click="handleTransition('delivered')"
              >
                <span v-if="isUpdating" class="spinner-border spinner-border-sm me-1"></span>
                <i v-else class="bi bi-bag-check me-1"></i>
                Xác nhận đã giao hàng thành công
              </button>
            </div>

            <!-- Trạng thái kết thúc -->
            <div
              v-else
              class="alert py-2 px-3 small mb-0"
              :class="order.order_status === 'delivered' ? 'alert-success' : 'alert-secondary'"
            >
              <i
                class="bi me-1"
                :class="order.order_status === 'delivered' ? 'bi-check-circle-fill' : 'bi-info-circle-fill'"
              ></i>
              <span v-if="order.order_status === 'delivered'">
                Đơn hàng đã giao thành công và hoàn tất thu tiền.
              </span>
              <span v-else>
                Đơn hàng này đã bị hủy và số lượng sách đã được hoàn lại vào kho.
              </span>
            </div>
          </div>
        </div>

        <!-- Khung Thông tin vận chuyển -->
        <div class="card border-0 shadow-sm rounded-4">
          <div class="card-header bg-white py-3 px-4 d-flex align-items-center justify-content-between">
            <h6 class="fw-bold text-dark mb-0">Thông tin vận chuyển</h6>
            <span
              class="badge rounded-pill px-2 py-1"
              :class="getShippingStatusBadgeClass(order.shipment?.shipping_status, order.order_status)"
            >
              {{ getShippingStatusLabel(order.shipment?.shipping_status, order.order_status) }}
            </span>
          </div>
          <div class="card-body px-4">
            <div class="mb-2">
              <label class="form-label small fw-semibold text-secondary mb-1">Đơn vị vận chuyển</label>
              <input
                v-model.trim="shipmentForm.carrier_name"
                type="text"
                class="form-control form-control-sm"
                :disabled="order.order_status === 'cancelled' || order.order_status === 'delivered'"
                placeholder="VD: Giao Hàng Nhanh, Viettel Post..."
              >
            </div>
            <div class="mb-3">
              <label class="form-label small fw-semibold text-secondary mb-1">Mã vận đơn</label>
              <input
                v-model.trim="shipmentForm.tracking_code"
                type="text"
                class="form-control form-control-sm"
                :disabled="order.order_status === 'cancelled' || order.order_status === 'delivered'"
                placeholder="Nhập mã tra cứu vận đơn"
              >
            </div>
            <button
              v-if="order.order_status !== 'cancelled' && order.order_status !== 'delivered'"
              type="button"
              class="btn btn-outline-secondary btn-sm w-100 fw-semibold"
              :disabled="isUpdating"
              @click="handleSaveShipmentOnly"
            >
              Cập nhật thông tin vận đơn
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Modal xác nhận hủy đơn dành cho Admin -->
    <div
      v-if="showCancelConfirm"
      class="modal fade show d-block"
      tabindex="-1"
      style="background-color: rgba(0, 0, 0, 0.5); z-index: 1060;"
      @click.self="showCancelConfirm = false"
    >
      <div class="modal-dialog modal-dialog-centered modal-sm">
        <div class="modal-content border-0 shadow rounded-3">
          <div class="modal-body p-4 text-center">
            <i class="bi bi-exclamation-triangle text-danger display-6 d-block mb-3"></i>
            <h6 class="fw-bold text-dark mb-2">Hủy đơn hàng này?</h6>
            <p class="small text-secondary mb-4">
              Đơn hàng <strong>{{ order?.order_code }}</strong> sẽ chuyển sang trạng thái
              <strong>Đã hủy</strong> và hoàn lại toàn bộ số lượng sách vào kho.
            </p>
            <div class="d-flex gap-2 justify-content-center">
              <button
                type="button"
                class="btn btn-light border px-3 fw-semibold flex-grow-1"
                :disabled="isUpdating"
                @click="showCancelConfirm = false"
              >
                Đóng
              </button>
              <button
                type="button"
                class="btn btn-danger px-3 fw-semibold flex-grow-1"
                :disabled="isUpdating"
                @click="confirmCancelByAdmin"
              >
                <span v-if="isUpdating" class="spinner-border spinner-border-sm me-1"></span>
                Xác nhận hủy
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import { adminOrderService } from '@/services/orderService';
import { getBookCoverUrl } from '@/utils/imageHelper';

const route = useRoute();
const order = ref(null);
const isLoading = ref(false);
const isUpdating = ref(false);
const showCancelConfirm = ref(false);

const shipmentForm = reactive({
  carrier_name: '',
  tracking_code: ''
});

const orderSteps = [
  { key: 'processing', label: 'Chờ xác nhận', icon: 'bi bi-receipt' },
  { key: 'confirmed', label: 'Đã xác nhận', icon: 'bi bi-check2-circle' },
  { key: 'shipping', label: 'Đang giao hàng', icon: 'bi bi-truck' },
  { key: 'delivered', label: 'Giao thành công', icon: 'bi bi-bag-check-fill' }
];

const toast = reactive({
  show: false,
  message: '',
  type: 'success'
});

function triggerToast(message, type = 'success') {
  toast.message = message;
  toast.type = type;
  toast.show = true;
  setTimeout(() => {
    toast.show = false;
  }, 3000);
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

function isStepReached(stepIndex) {
  if (!order.value) return false;
  const currentIdx = orderSteps.findIndex(s => s.key === order.value.order_status);
  return currentIdx >= stepIndex;
}

function getOrderStatusLabel(status) {
  const map = {
    processing: 'Chờ xác nhận',
    confirmed: 'Đã xác nhận',
    shipping: 'Đang giao hàng',
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
    pending: 'Chưa thanh toán',
    paid: 'Đã thanh toán',
    failed: 'Thanh toán lỗi',
    refunded: 'Đã hoàn tiền'
  };
  return map[status] || status;
}

function getPaymentStatusBadgeClass(status) {
  const map = {
    pending: 'bg-warning-subtle text-warning-emphasis border border-warning-subtle',
    paid: 'bg-success-subtle text-success border border-success-subtle',
    failed: 'bg-danger-subtle text-danger border border-danger-subtle',
    refunded: 'bg-secondary-subtle text-secondary border border-secondary-subtle'
  };
  return map[status] || 'bg-light text-secondary border';
}

function getShippingStatusLabel(shippingStatus, orderStatus) {
  if (orderStatus === 'cancelled') return 'Đã hủy giao';
  const map = {
    pending: 'Chờ bàn giao',
    picked_up: 'Đã lấy hàng',
    in_transit: 'Đang vận chuyển',
    delivered: 'Đã giao hàng',
    failed: 'Giao thất bại'
  };
  return map[shippingStatus] || 'Chờ bàn giao';
}

function getShippingStatusBadgeClass(shippingStatus, orderStatus) {
  if (orderStatus === 'cancelled') {
    return 'bg-secondary-subtle text-secondary border border-secondary-subtle';
  }
  const map = {
    pending: 'bg-light text-secondary border',
    picked_up: 'bg-info-subtle text-info-emphasis border border-info-subtle',
    in_transit: 'bg-primary-subtle text-primary border border-primary-subtle',
    delivered: 'bg-success-subtle text-success border border-success-subtle',
    failed: 'bg-danger-subtle text-danger border border-danger-subtle'
  };
  return map[shippingStatus] || 'bg-light text-secondary border';
}

async function loadOrder() {
  try {
    isLoading.value = true;
    const res = await adminOrderService.getOrderById(route.params.id);
    order.value = res.order;
    shipmentForm.carrier_name = res.order?.shipment?.carrier_name || '';
    shipmentForm.tracking_code = res.order?.shipment?.tracking_code || '';
  } catch (error) {
    triggerToast(error.response?.data?.message || 'Không thể tải đơn hàng', 'error');
  } finally {
    isLoading.value = false;
  }
}

async function handleTransition(nextStatus) {
  if (!order.value) return;
  try {
    isUpdating.value = true;
    const res = await adminOrderService.updateOrderStatus(order.value.order_id, {
      order_status: nextStatus,
      carrier_name: shipmentForm.carrier_name,
      tracking_code: shipmentForm.tracking_code
    });
    order.value = res.order;
    triggerToast(res.message || 'Cập nhật trạng thái thành công', 'success');
  } catch (error) {
    triggerToast(error.response?.data?.message || 'Lỗi khi chuyển trạng thái', 'error');
  } finally {
    isUpdating.value = false;
  }
}

async function confirmCancelByAdmin() {
  showCancelConfirm.value = false;
  await handleTransition('cancelled');
}

async function handleSaveShipmentOnly() {
  if (!order.value) return;
  try {
    isUpdating.value = true;
    const res = await adminOrderService.updateShipment(order.value.order_id, {
      carrier_name: shipmentForm.carrier_name,
      tracking_code: shipmentForm.tracking_code
    });
    order.value = res.order;
    triggerToast('Đã lưu thông tin vận đơn', 'success');
  } catch (error) {
    triggerToast(error.response?.data?.message || 'Không thể lưu thông tin vận đơn', 'error');
  } finally {
    isUpdating.value = false;
  }
}

onMounted(() => {
  loadOrder();
});
</script>
