<template>
  <div class="cart-page bg-light py-4 min-vh-100">
    <!-- Toast Thông báo -->
    <div
      v-if="toast.show"
      class="position-fixed top-0 end-0 p-3"
      style="z-index: 1080; margin-top: 70px;"
    >
      <div
        class="toast show align-items-center border-0 shadow"
        :class="toast.type === 'error' ? 'text-bg-danger' : toast.type === 'warning' ? 'text-bg-warning' : 'text-bg-success'"
        role="alert"
      >
        <div class="d-flex">
          <div class="toast-body d-flex align-items-center gap-2 fw-medium">
            <i
              class="bi fs-5"
              :class="toast.type === 'error' ? 'bi-exclamation-octagon-fill' : toast.type === 'warning' ? 'bi-exclamation-triangle-fill' : 'bi-check-circle-fill'"
            ></i>
            <span>{{ toast.message }}</span>
          </div>
          <button
            type="button"
            class="btn-close me-2 m-auto"
            :class="toast.type === 'warning' ? '' : 'btn-close-white'"
            @click="toast.show = false"
          ></button>
        </div>
      </div>
    </div>

    <div class="container">
      <!-- Tiêu đề trang -->
      <div class="d-flex align-items-baseline mb-3">
        <h1 class="h4 fw-bold text-dark mb-0 text-uppercase">Giỏ hàng</h1>
        <span class="ms-2 text-secondary fs-6">({{ cartStore.totalItems }} sản phẩm)</span>
      </div>

      <!-- Trạng thái đang tải lần đầu -->
      <div
        v-if="cartStore.isLoading && cartStore.items.length === 0"
        class="bg-white rounded-3 shadow-sm p-5 text-center my-2"
      >
        <div class="spinner-border text-danger mb-3" role="status">
          <span class="visually-hidden">Đang tải...</span>
        </div>
        <p class="text-secondary mb-0">Đang tải thông tin giỏ hàng của bạn...</p>
      </div>

      <!-- Trạng thái lỗi khi gọi API -->
      <div
        v-else-if="cartStore.loadError && cartStore.items.length === 0"
        class="bg-white rounded-3 shadow-sm p-5 text-center my-2"
      >
        <i class="bi bi-wifi-off text-danger display-4 d-block mb-3"></i>
        <h5 class="fw-bold text-dark mb-2">Không thể tải giỏ hàng</h5>
        <p class="text-secondary mb-4">{{ cartStore.loadError }}</p>
        <button
          type="button"
          class="btn btn-danger px-4 py-2 fw-semibold"
          @click="cartStore.fetchCart()"
        >
          <i class="bi bi-arrow-clockwise me-2"></i>Thử lại
        </button>
      </div>

      <!-- Trạng thái giỏ hàng trống -->
      <div
        v-else-if="cartStore.items.length === 0"
        class="bg-white rounded-3 shadow-sm p-5 text-center my-2"
      >
        <div class="py-3">
          <div
            class="d-inline-flex align-items-center justify-content-center rounded-circle bg-light mb-3"
            style="width: 110px; height: 110px;"
          >
            <i class="bi bi-cart-x text-secondary" style="font-size: 3.2rem;"></i>
          </div>
          <p class="text-secondary mb-4">Chưa có sản phẩm trong giỏ hàng của bạn.</p>
          <router-link
            to="/"
            class="btn btn-danger px-5 py-2 fw-bold text-uppercase rounded-1 shadow-sm"
          >
            Mua sắm ngay
          </router-link>
        </div>
      </div>

      <!-- Bố cục 2 cột khi có sản phẩm -->
      <div v-else class="row g-3 pb-5 pb-lg-0">
        <!-- CỘT TRÁI: Thanh tiêu đề & Danh sách sản phẩm -->
        <div class="col-lg-8">
          <!-- Thanh Chọn tất cả -->
          <div class="bg-white rounded-3 px-3 py-2 mb-2 shadow-sm d-flex align-items-center">
            <div class="form-check d-flex align-items-center mb-0 flex-grow-1">
              <input
                id="selectAllCart"
                type="checkbox"
                class="form-check-input border-secondary me-3 mt-0 cursor-pointer"
                style="width: 18px; height: 18px;"
                :checked="cartStore.isAllSelected"
                :disabled="cartStore.selectableItems.length === 0"
                @change="onToggleSelectAll"
              >
              <label
                for="selectAllCart"
                class="form-check-label fw-semibold text-dark cursor-pointer user-select-none"
              >
                Chọn tất cả ({{ cartStore.totalItems }} sản phẩm)
              </label>
            </div>

            <div class="d-none d-md-flex align-items-center text-secondary small fw-semibold">
              <div class="text-center" style="width: 120px;">Số lượng</div>
              <div class="text-center" style="width: 130px;">Thành tiền</div>
            </div>

            <div class="text-end" style="width: 40px;">
              <button
                type="button"
                class="btn btn-link text-secondary p-1 border-0"
                :disabled="cartStore.selectedCount === 0 || isBatchDeleting"
                title="Xóa các sản phẩm đã chọn"
                @click="showBatchDeleteModal = true"
              >
                <i class="bi bi-trash3 fs-5"></i>
              </button>
            </div>
          </div>

          <!-- Khung danh sách các dòng sách trong giỏ -->
          <div class="bg-white rounded-3 px-3 py-1 shadow-sm">
            <div
              v-for="(item, index) in cartStore.items"
              :key="item.book_id"
              class="py-3 d-flex flex-wrap flex-md-nowrap align-items-center"
              :class="{
                'border-bottom': index < cartStore.items.length - 1,
                'item-unavailable': item.flags?.is_unavailable || item.flags?.is_out_of_stock
              }"
            >
              <!-- Checkbox chọn dòng -->
              <div class="me-3 d-flex align-items-center">
                <input
                  type="checkbox"
                  class="form-check-input border-secondary mt-0 cursor-pointer"
                  style="width: 18px; height: 18px;"
                  :checked="cartStore.isItemSelected(item.book_id)"
                  :disabled="item.flags?.is_unavailable || item.flags?.is_out_of_stock"
                  @change="cartStore.toggleSelectItem(item.book_id)"
                >
              </div>

              <!-- Ảnh bìa sách -->
              <router-link
                :to="item.book ? `/books/${item.book_id}` : '#'"
                class="flex-shrink-0 me-3 text-decoration-none d-flex align-items-center justify-content-center bg-white rounded p-1"
                style="width: 90px; height: 115px;"
              >
                <img
                  :src="getBookImage(item.book)"
                  :alt="item.book?.title || 'Book cover'"
                  class="img-fluid"
                  style="max-width: 100%; max-height: 105px; object-fit: contain;"
                  @error="handleImageError"
                >
              </router-link>

              <!-- Thông tin sách & Đơn giá -->
              <div
                class="flex-grow-1 me-md-2 d-flex flex-column justify-content-between"
                style="min-width: 180px; min-height: 105px;"
              >
                <div>
                  <router-link
                    v-if="item.book"
                    :to="`/books/${item.book_id}`"
                    class="text-dark text-decoration-none fw-normal cart-book-title mb-2 d-block"
                  >
                    {{ item.book.title }}
                  </router-link>
                  <span v-else class="text-secondary fst-italic d-block mb-2">
                    Sản phẩm không còn tồn tại
                  </span>

                  <!-- Cờ cảnh báo tồn kho / trạng thái kinh doanh -->
                  <div v-if="item.flags?.is_unavailable" class="mb-2">
                    <span class="badge bg-secondary-subtle text-secondary border border-secondary-subtle fw-medium">
                      Ngừng kinh doanh
                    </span>
                  </div>

                  <div v-else-if="item.flags?.is_out_of_stock" class="mb-2">
                    <span class="badge bg-danger-subtle text-danger border border-danger-subtle fw-medium">
                      Hết hàng
                    </span>
                  </div>

                  <div
                    v-else-if="item.flags?.exceeds_stock"
                    class="alert alert-warning py-1 px-2 small mb-2 d-inline-flex align-items-center flex-wrap gap-2"
                  >
                    <span>
                      <i class="bi bi-exclamation-triangle-fill me-1"></i>
                      Kho chỉ còn <strong>{{ item.flags.available_stock }}</strong> cuốn
                    </span>
                    <button
                      type="button"
                      class="btn btn-sm btn-warning py-0 px-2 fw-semibold"
                      style="font-size: 0.78rem;"
                      :disabled="isItemUpdating(item.book_id)"
                      @click="adjustToMaxStock(item)"
                    >
                      Điều chỉnh về tối đa ({{ item.flags.available_stock }} cuốn)
                    </button>
                  </div>

                  <div
                    v-else-if="item.flags?.available_stock > 0 && item.flags?.available_stock <= 5"
                    class="small text-warning-emphasis mb-1"
                  >
                    Chỉ còn {{ item.flags.available_stock }} cuốn trong kho
                  </div>
                </div>

                <!-- Đơn giá bán & Giá bìa gạch ngang -->
                <div class="mt-auto pt-1 d-flex align-items-baseline flex-wrap gap-2">
                  <span class="fw-bold text-dark">
                    {{ formatCurrency(item.book?.final_price || 0) }}
                  </span>
                  <span
                    v-if="item.book?.discount_percent > 0"
                    class="text-muted text-decoration-line-through small"
                  >
                    {{ formatCurrency(item.book?.price || 0) }}
                  </span>
                </div>
              </div>

              <!-- Cụm điều chỉnh số lượng + Thành tiền + Xóa -->
              <div class="d-flex align-items-center justify-content-between justify-content-md-end w-100 w-md-auto mt-3 mt-md-0 ps-4 ps-md-0">
                <!-- Bộ chọn số lượng [ - 1 + ] -->
                <div class="d-flex flex-column align-items-center justify-content-center" style="width: 120px;">
                  <div
                    class="d-inline-flex align-items-center border border-secondary-subtle rounded-2 bg-white overflow-hidden"
                    style="height: 32px;"
                  >
                    <button
                      type="button"
                      class="btn btn-sm btn-light border-0 px-2 h-100 d-flex align-items-center justify-content-center text-secondary bg-transparent"
                      style="width: 28px;"
                      :disabled="isItemDisabled(item) || getDisplayQty(item) <= 1"
                      @click="changeQtyStep(item, -1)"
                    >
                      <i class="bi bi-dash"></i>
                    </button>
                    <input
                      type="text"
                      inputmode="numeric"
                      class="form-control form-control-sm border-0 text-center fw-semibold px-0 h-100 shadow-none no-spinners bg-transparent"
                      style="width: 38px; font-size: 0.9rem;"
                      :value="getInputDisplayValue(item)"
                      :disabled="isItemDisabled(item)"
                      @input="onQtyInput(item, $event)"
                      @blur="onQtyBlur(item)"
                      @keydown.enter.prevent="$event.target.blur()"
                    >
                    <button
                      type="button"
                      class="btn btn-sm btn-light border-0 px-2 h-100 d-flex align-items-center justify-content-center text-secondary bg-transparent"
                      style="width: 28px;"
                      :disabled="isItemDisabled(item) || getDisplayQty(item) >= getMaxAllowedQty(item)"
                      @click="changeQtyStep(item, 1)"
                    >
                      <i class="bi bi-plus"></i>
                    </button>
                  </div>
                </div>

                <!-- Thành tiền của dòng -->
                <div class="text-center" style="width: 130px;">
                  <span class="fw-bold text-danger">
                    {{ formatCurrency(item.subtotal) }}
                  </span>
                </div>

                <!-- Nút xóa dòng -->
                <div class="text-end" style="width: 40px;">
                  <button
                    type="button"
                    class="btn btn-link text-secondary p-1 border-0"
                    :disabled="deletingMap[item.book_id]"
                    title="Xóa sản phẩm"
                    @click="handleRemoveItem(item)"
                  >
                    <span
                      v-if="deletingMap[item.book_id]"
                      class="spinner-border spinner-border-sm text-secondary"
                    ></span>
                    <i v-else class="bi bi-trash3 fs-5"></i>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- CỘT PHẢI: Khung Thông tin đơn hàng (Sticky) -->
        <div class="col-lg-4">
          <div class="bg-white rounded-3 p-4 shadow-sm sticky-top" style="top: 90px; z-index: 10;">
            <h2 class="h5 fw-bold text-dark pb-3 mb-0 border-bottom">
              Thông tin đơn hàng
            </h2>

            <div class="d-flex justify-content-between align-items-center py-3 mb-3 border-bottom">
              <div class="fw-bold text-dark">
                Tổng tiền:
                <div class="fw-normal text-secondary small">
                  ({{ cartStore.selectedCount }} sản phẩm đã chọn)
                </div>
              </div>
              <div class="fs-4 fw-bold text-danger">
                {{ formatCurrency(cartStore.selectedTotalPrice) }}
              </div>
            </div>

            <div
              v-if="cartStore.hasSelectedIssues"
              class="alert alert-danger py-2 px-3 small mb-3"
            >
              <i class="bi bi-exclamation-circle-fill me-1"></i>
              Có sản phẩm đã chọn vượt quá tồn kho hoặc ngừng bán. Vui lòng điều chỉnh trước khi thanh toán.
            </div>

            <button
              type="button"
              class="btn btn-danger w-100 py-2 fw-bold text-uppercase rounded-1"
              :disabled="!cartStore.canCheckout"
              @click="handleCheckout"
            >
              Thanh toán
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Thanh cố định ở đáy cho màn hình nhỏ (Mobile/Tablet) -->
    <div
      v-if="cartStore.items.length > 0"
      class="d-lg-none fixed-bottom bg-white border-top px-3 py-2 shadow"
      style="z-index: 1030;"
    >
      <div class="container px-0 d-flex align-items-center justify-content-between gap-3">
        <div>
          <div class="small text-secondary">
            Tổng tiền ({{ cartStore.selectedCount }} sản phẩm):
          </div>
          <div class="fs-5 fw-bold text-danger">
            {{ formatCurrency(cartStore.selectedTotalPrice) }}
          </div>
        </div>
        <button
          type="button"
          class="btn btn-danger px-4 py-2 fw-bold text-uppercase rounded-1"
          :disabled="!cartStore.canCheckout"
          @click="handleCheckout"
        >
          Thanh toán
        </button>
      </div>
    </div>

    <!-- Hộp thoại xác nhận xóa các sản phẩm đã chọn -->
    <div
      v-if="showBatchDeleteModal"
      class="modal fade show d-block"
      tabindex="-1"
      style="background-color: rgba(0, 0, 0, 0.5); z-index: 1060;"
      @click.self="showBatchDeleteModal = false"
    >
      <div class="modal-dialog modal-dialog-centered modal-sm">
        <div class="modal-content border-0 shadow rounded-3">
          <div class="modal-body p-4 text-center">
            <i class="bi bi-trash3 text-danger display-6 d-block mb-3"></i>
            <h6 class="fw-bold text-dark mb-2">Xóa sản phẩm đã chọn?</h6>
            <p class="small text-secondary mb-4">
              Bạn có chắc muốn xóa {{ cartStore.selectedCount }} sản phẩm đã chọn khỏi giỏ hàng?
            </p>
            <div class="d-flex gap-2 justify-content-center">
              <button
                type="button"
                class="btn btn-light border px-3 fw-semibold flex-grow-1"
                :disabled="isBatchDeleting"
                @click="showBatchDeleteModal = false"
              >
                Hủy
              </button>
              <button
                type="button"
                class="btn btn-danger px-3 fw-semibold flex-grow-1"
                :disabled="isBatchDeleting"
                @click="confirmBatchDelete"
              >
                <span v-if="isBatchDeleting" class="spinner-border spinner-border-sm me-1"></span>
                Xóa
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, onBeforeUnmount } from 'vue';
import { useRouter } from 'vue-router';
import { useCartStore } from '@/stores/cartStore';
import { getBookCoverUrl } from '@/utils/imageHelper';

const router = useRouter();
const cartStore = useCartStore();

// Quản lý trạng thái chỉnh sửa số lượng từng dòng (optimistic UI + debounce 450ms)
const draftQuantities = reactive({});
const confirmedQuantities = reactive({});
const updatingSeqMap = reactive({});
const deletingMap = reactive({});
const debounceTimers = new Map();

const showBatchDeleteModal = ref(false);
const isBatchDeleting = ref(false);

// Toast thông báo
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

// Định dạng tiền tệ VND
function formatCurrency(val) {
  const num = Math.round(Number(val) || 0);
  return num.toLocaleString('vi-VN') + ' đ';
}

// Lấy ảnh bìa chính của sách (nối tiền tố backend cho đường dẫn /uploads/...)
function getBookImage(book) {
  return getBookCoverUrl(book?.images, book?.title || 'Book');
}

function handleImageError(e) {
  e.target.src = 'https://placehold.co/200x260/f8f9fa/6c757d?text=Book';
}

function isItemDisabled(item) {
  return Boolean(
    item.flags?.is_unavailable ||
    item.flags?.is_out_of_stock ||
    deletingMap[item.book_id]
  );
}

function isItemUpdating(bookId) {
  return Boolean(updatingSeqMap[bookId]);
}

function getMaxAllowedQty(item) {
  const stock = Number(item.flags?.available_stock || 0);
  if (stock <= 0) return 1;
  return Math.min(99, stock);
}

function getDisplayQty(item) {
  const draft = draftQuantities[item.book_id];
  if (typeof draft === 'number' && Number.isInteger(draft)) {
    return draft;
  }
  return item.quantity;
}

function getInputDisplayValue(item) {
  if (Object.prototype.hasOwnProperty.call(draftQuantities, item.book_id)) {
    return draftQuantities[item.book_id];
  }
  return item.quantity;
}

// Áp dụng tạm thời số lượng trên giao diện trước khi request hoàn tất
function applyOptimisticQty(item, newQty) {
  if (confirmedQuantities[item.book_id] === undefined) {
    confirmedQuantities[item.book_id] = item.quantity;
  }
  draftQuantities[item.book_id] = newQty;
  const unitPrice = Number(item.book?.final_price || 0);
  item.quantity = newQty;
  item.subtotal = unitPrice * newQty;

  if (item.flags) {
    item.flags.exceeds_stock = newQty > Number(item.flags.available_stock || 0);
  }
}

// Lên lịch gọi API cập nhật sau 450ms ngừng thao tác
function scheduleQuantityCommit(item, targetQty) {
  const bookId = item.book_id;
  if (debounceTimers.has(bookId)) {
    clearTimeout(debounceTimers.get(bookId));
  }

  const timerId = setTimeout(() => {
    debounceTimers.delete(bookId);
    commitQuantityUpdate(item, targetQty);
  }, 450);

  debounceTimers.set(bookId, timerId);
}

async function commitQuantityUpdate(item, targetQty) {
  const bookId = item.book_id;
  const prevConfirmed = confirmedQuantities[bookId] ?? item.quantity;

  // Nếu giá trị mới bằng đúng giá trị đã lưu trên server và không vượt tồn thì không cần gọi API
  if (targetQty === prevConfirmed && !item.flags?.exceeds_stock) {
    delete draftQuantities[bookId];
    delete confirmedQuantities[bookId];
    return;
  }

  const seq = (updatingSeqMap[bookId] || 0) + 1;
  updatingSeqMap[bookId] = seq;

  const res = await cartStore.updateQuantity(bookId, targetQty);

  // Chỉ xử lý phản hồi của request mới nhất trên dòng sách này
  if (updatingSeqMap[bookId] !== seq) return;

  delete updatingSeqMap[bookId];
  delete draftQuantities[bookId];
  delete confirmedQuantities[bookId];

  if (!res.success) {
    triggerToast(res.message || 'Không thể cập nhật số lượng', 'error');
    // Tải lại giỏ hàng từ server để quay về trạng thái chuẩn xác
    await cartStore.fetchCart();
  }
}

// Bấm nút +/-
function changeQtyStep(item, delta) {
  if (isItemDisabled(item)) return;

  const currentQty = getDisplayQty(item);
  const maxQty = getMaxAllowedQty(item);
  let nextQty = currentQty + delta;

  if (nextQty < 1) nextQty = 1;
  if (nextQty > maxQty) {
    nextQty = maxQty;
    triggerToast(`Kho chỉ còn tối đa ${maxQty} cuốn.`, 'warning');
  }

  if (nextQty === currentQty && !item.flags?.exceeds_stock) return;

  applyOptimisticQty(item, nextQty);
  scheduleQuantityCommit(item, nextQty);
}

// Gõ trực tiếp vào ô số lượng
function onQtyInput(item, event) {
  if (isItemDisabled(item)) return;

  const bookId = item.book_id;
  const rawValue = event.target.value;

  // Loại bỏ mọi ký tự không phải chữ số (chặn âm, thập phân, chữ cái)
  const digitsOnly = rawValue.replace(/[^\d]/g, '');

  // Nếu người dùng xóa trống ô nhập: tạm giữ trống, chưa gửi API
  if (digitsOnly === '') {
    if (confirmedQuantities[bookId] === undefined) {
      confirmedQuantities[bookId] = item.quantity;
    }
    draftQuantities[bookId] = '';
    if (debounceTimers.has(bookId)) {
      clearTimeout(debounceTimers.get(bookId));
      debounceTimers.delete(bookId);
    }
    return;
  }

  let parsed = parseInt(digitsOnly, 10);
  const maxQty = getMaxAllowedQty(item);

  if (isNaN(parsed) || parsed < 1) {
    parsed = 1;
    triggerToast('Số lượng tối thiểu là 1. Nếu muốn bỏ sách, vui lòng bấm biểu tượng thùng rác.', 'warning');
  } else if (parsed > maxQty) {
    parsed = maxQty;
    triggerToast(`Số lượng tối đa có thể mua là ${maxQty} cuốn.`, 'warning');
  }

  event.target.value = String(parsed);
  applyOptimisticQty(item, parsed);
  scheduleQuantityCommit(item, parsed);
}

// Khi rời khỏi ô nhập (blur)
function onQtyBlur(item) {
  const bookId = item.book_id;
  const draft = draftQuantities[bookId];

  // Nếu để trống khi rời ô nhập, khôi phục về số lượng đã xác nhận trước đó
  if (draft === '' || draft === undefined) {
    if (draft === '') {
      const fallbackQty = confirmedQuantities[bookId] ?? item.quantity;
      applyOptimisticQty(item, fallbackQty);
      delete draftQuantities[bookId];
      delete confirmedQuantities[bookId];
    }
    return;
  }

  // Nếu đang có timer chờ debounce thì thực thi ngay khi blur
  if (debounceTimers.has(bookId)) {
    clearTimeout(debounceTimers.get(bookId));
    debounceTimers.delete(bookId);
    commitQuantityUpdate(item, Number(draft));
  }
}

// Nút "Điều chỉnh về tối đa" khi sách bị vượt tồn kho (exceeds_stock)
async function adjustToMaxStock(item) {
  const maxStock = Number(item.flags?.available_stock || 0);
  if (maxStock < 1) return;

  if (debounceTimers.has(item.book_id)) {
    clearTimeout(debounceTimers.get(item.book_id));
    debounceTimers.delete(item.book_id);
  }

  applyOptimisticQty(item, maxStock);
  await commitQuantityUpdate(item, maxStock);
  triggerToast(`Đã điều chỉnh số lượng về tối đa (${maxStock} cuốn).`, 'success');
}

// Chọn / Bỏ chọn tất cả
function onToggleSelectAll(event) {
  cartStore.toggleSelectAll(event.target.checked);
}

// Xóa 1 sản phẩm
async function handleRemoveItem(item) {
  const bookId = item.book_id;
  if (debounceTimers.has(bookId)) {
    clearTimeout(debounceTimers.get(bookId));
    debounceTimers.delete(bookId);
  }

  deletingMap[bookId] = true;
  const res = await cartStore.removeItem(bookId);
  delete deletingMap[bookId];

  if (res.success) {
    triggerToast('Đã xóa sản phẩm khỏi giỏ hàng.', 'success');
  } else {
    triggerToast(res.message || 'Lỗi khi xóa sản phẩm', 'error');
  }
}

// Xác nhận xóa hàng loạt các sản phẩm đang chọn
async function confirmBatchDelete() {
  if (cartStore.selectedCount === 0) {
    showBatchDeleteModal.value = false;
    return;
  }

  isBatchDeleting.value = true;
  const res = await cartStore.removeSelectedItems();
  isBatchDeleting.value = false;
  showBatchDeleteModal.value = false;

  if (res.success) {
    triggerToast('Đã xóa các sản phẩm đã chọn khỏi giỏ hàng.', 'success');
  } else {
    triggerToast(res.message || 'Không thể xóa các sản phẩm đã chọn', 'error');
  }
}

// Chuyển sang bước Thanh toán (/checkout)
function handleCheckout() {
  if (!cartStore.canCheckout) return;
  router.push('/checkout');
}

// Tải lại giỏ hàng mỗi lần vào trang để cập nhật giá & tồn kho mới nhất
onMounted(() => {
  cartStore.fetchCart();
});

onBeforeUnmount(() => {
  for (const timerId of debounceTimers.values()) {
    clearTimeout(timerId);
  }
  debounceTimers.clear();
  if (toastTimer) clearTimeout(toastTimer);
});
</script>

<style scoped>
.cursor-pointer {
  cursor: pointer;
}

.cart-book-title {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  line-height: 1.45;
  font-size: 0.95rem;
  transition: color 0.15s ease;
}

.cart-book-title:hover {
  color: #c92127 !important;
}

.item-unavailable {
  opacity: 0.65;
  background-color: #fafafa;
}

.form-check-input:checked {
  background-color: #c92127;
  border-color: #c92127;
}

.form-check-input:focus {
  box-shadow: 0 0 0 0.2rem rgba(201, 33, 39, 0.2);
}

/* Ẩn mũi tên tăng giảm mặc định của input số */
.no-spinners::-webkit-outer-spin-button,
.no-spinners::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}
.no-spinners {
  -moz-appearance: textfield;
}
</style>
