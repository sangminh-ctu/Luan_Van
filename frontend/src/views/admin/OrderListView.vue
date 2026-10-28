<template>
  <div class="container-fluid py-2">
    <!-- Tiêu đề trang -->
    <div class="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-4">
      <div>
        <h4 class="fw-bold text-dark mb-1">Quản lý Đơn hàng</h4>
        <p class="text-secondary small mb-0">
          Theo dõi, xác nhận đơn hàng, cập nhật vận đơn và trạng thái giao hàng
        </p>
      </div>
      <button
        type="button"
        class="btn btn-outline-secondary btn-sm shadow-sm px-3"
        :disabled="isLoading"
        @click="fetchOrders"
      >
        <i class="bi bi-arrow-clockwise me-1"></i>Làm mới
      </button>
    </div>

    <!-- Bộ lọc trạng thái & Tìm kiếm mã đơn -->
    <div class="card border-0 shadow-sm rounded-4 mb-4">
      <div class="card-body p-3">
        <div class="row g-2 align-items-center">
          <div class="col-md-5">
            <div class="input-group">
              <span class="input-group-text bg-white border-end-0 text-muted">
                <i class="bi bi-search"></i>
              </span>
              <input
                v-model.trim="filters.search"
                type="text"
                class="form-control border-start-0 ps-0 shadow-none"
                placeholder="Tìm theo mã đơn hàng (VD: DH-20261017-0001)..."
                @keyup.enter="applyFilters"
              >
              <button class="btn btn-primary px-3" type="button" @click="applyFilters">
                Tìm kiếm
              </button>
            </div>
          </div>

          <div class="col-md-3">
            <select v-model="filters.status" class="form-select shadow-none" @change="applyFilters">
              <option value="all">Tất cả trạng thái đơn</option>
              <option value="processing">Chờ xác nhận</option>
              <option value="confirmed">Đã xác nhận</option>
              <option value="shipping">Đang vận chuyển</option>
              <option value="delivered">Đã giao thành công</option>
              <option value="cancelled">Đã hủy</option>
            </select>
          </div>

          <div class="col-md-3">
            <select v-model="filters.payment_status" class="form-select shadow-none" @change="applyFilters">
              <option value="all">Tất cả thanh toán</option>
              <option value="pending">Chưa thanh toán</option>
              <option value="paid">Đã thanh toán</option>
            </select>
          </div>

          <div class="col-md-1 text-end">
            <button
              type="button"
              class="btn btn-light border w-100"
              title="Đặt lại bộ lọc"
              @click="resetFilters"
            >
              <i class="bi bi-arrow-counterclockwise"></i>
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Bảng danh sách đơn hàng -->
    <div class="card border-0 shadow-sm rounded-4 overflow-hidden">
      <div class="card-body p-0">
        <div v-if="isLoading" class="p-5 text-center">
          <div class="spinner-border text-primary mb-2" role="status"></div>
          <div class="text-secondary small">Đang tải danh sách đơn hàng...</div>
        </div>

        <div v-else-if="orders.length === 0" class="p-5 text-center text-secondary">
          <i class="bi bi-inbox fs-1 d-block mb-2 text-muted"></i>
          Không tìm thấy đơn hàng nào phù hợp.
        </div>

        <div v-else class="table-responsive">
          <table class="table table-hover align-middle mb-0">
            <thead class="table-light">
              <tr>
                <th class="ps-4">Mã đơn</th>
                <th>Người nhận</th>
                <th>Ngày đặt</th>
                <th class="text-end">Tổng tiền</th>
                <th class="text-center">Thanh toán</th>
                <th class="text-center">Trạng thái đơn</th>
                <th class="text-center">Vận chuyển</th>
                <th class="text-end pe-4">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="order in orders" :key="order.order_id">
                <td class="ps-4">
                  <router-link
                    :to="`/admin/orders/${order.order_id}`"
                    class="fw-bold text-dark text-decoration-none"
                  >
                    {{ order.order_code }}
                  </router-link>
                  <div class="text-muted" style="font-size: 12px;">
                    {{ order.items?.length || 0 }} sản phẩm
                  </div>
                </td>
                <td>
                  <div class="fw-semibold text-dark">
                    {{ order.address?.recipient_name || order.user?.full_name }}
                  </div>
                  <div class="small text-secondary">
                    {{ order.address?.recipient_phone || order.user?.phone }}
                  </div>
                </td>
                <td class="small text-secondary">
                  {{ formatDateTime(order.order_date) }}
                </td>
                <td class="text-end fw-bold text-danger">
                  {{ formatCurrency(order.total_amount) }}
                </td>
                <td class="text-center">
                  <span
                    class="badge rounded-pill px-2 py-1 fw-medium"
                    :class="getPaymentStatusBadgeClass(order.payment_status)"
                  >
                    {{ getPaymentStatusLabel(order.payment_status) }}
                  </span>
                </td>
                <td class="text-center">
                  <span
                    class="badge rounded-pill px-2 py-1 fw-medium"
                    :class="getOrderStatusBadgeClass(order.order_status)"
                  >
                    {{ getOrderStatusLabel(order.order_status) }}
                  </span>
                </td>
                <td class="text-center">
                  <span
                    class="badge rounded-pill px-2 py-1 fw-medium"
                    :class="getShippingStatusBadgeClass(order.shipment?.shipping_status, order.order_status)"
                  >
                    {{ getShippingStatusLabel(order.shipment?.shipping_status, order.order_status) }}
                  </span>
                  <div
                    v-if="order.shipment?.tracking_code"
                    class="text-muted mt-1"
                    style="font-size: 11px;"
                  >
                    MVĐ: {{ order.shipment.tracking_code }}
                  </div>
                </td>
                <td class="text-end pe-4">
                  <router-link
                    :to="`/admin/orders/${order.order_id}`"
                    class="btn btn-sm btn-outline-primary fw-semibold px-3"
                  >
                    Chi tiết / Xử lý
                  </router-link>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Phân trang -->
      <div
        v-if="pagination.totalPages > 1"
        class="card-footer bg-white d-flex align-items-center justify-content-between py-3 px-4"
      >
        <span class="small text-secondary">
          Tổng cộng <strong>{{ pagination.total }}</strong> đơn hàng
        </span>
        <div class="btn-group btn-group-sm">
          <button
            type="button"
            class="btn btn-outline-secondary"
            :disabled="pagination.page <= 1"
            @click="changePage(pagination.page - 1)"
          >
            Trước
          </button>
          <button type="button" class="btn btn-light border disabled">
            Trang {{ pagination.page }} / {{ pagination.totalPages }}
          </button>
          <button
            type="button"
            class="btn btn-outline-secondary"
            :disabled="pagination.page >= pagination.totalPages"
            @click="changePage(pagination.page + 1)"
          >
            Sau
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue';
import { adminOrderService } from '@/services/orderService';

const orders = ref([]);
const isLoading = ref(false);

const filters = reactive({
  search: '',
  status: 'all',
  payment_status: 'all',
  page: 1,
  limit: 10
});

const pagination = reactive({
  total: 0,
  page: 1,
  limit: 10,
  totalPages: 1
});

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
    pending: 'COD • Chưa thu tiền',
    paid: 'COD • Đã thanh toán',
    failed: 'Thanh toán lỗi',
    refunded: 'Đã hoàn tiền'
  };
  return map[status] || status;
}

function getPaymentStatusBadgeClass(status) {
  const map = {
    pending: 'bg-light text-secondary border',
    paid: 'bg-success-subtle text-success border border-success-subtle',
    failed: 'bg-danger-subtle text-danger border border-danger-subtle',
    refunded: 'bg-warning-subtle text-warning-emphasis border border-warning-subtle'
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

async function fetchOrders() {
  try {
    isLoading.value = true;
    const res = await adminOrderService.getOrders({ ...filters });
    orders.value = res.orders || [];
    if (res.pagination) {
      Object.assign(pagination, res.pagination);
    }
  } catch (error) {
    console.error('Lỗi tải danh sách đơn hàng:', error);
  } finally {
    isLoading.value = false;
  }
}

function applyFilters() {
  filters.page = 1;
  fetchOrders();
}

function resetFilters() {
  filters.search = '';
  filters.status = 'all';
  filters.payment_status = 'all';
  filters.page = 1;
  fetchOrders();
}

function changePage(newPage) {
  filters.page = newPage;
  fetchOrders();
}

onMounted(() => {
  fetchOrders();
});
</script>
