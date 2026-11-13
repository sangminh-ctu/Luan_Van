<template>
  <div class="checkout-page bg-white py-4 min-vh-100">
    <!-- Toast Thông báo -->
    <div
      v-if="toast.show"
      class="position-fixed top-0 end-0 p-3"
      style="z-index: 1080; margin-top: 70px"
    >
      <div
        class="toast show align-items-center border-0 shadow"
        :class="
          toast.type === 'error'
            ? 'text-bg-danger'
            : toast.type === 'warning'
              ? 'text-bg-warning'
              : 'text-bg-success'
        "
        role="alert"
      >
        <div class="d-flex">
          <div class="toast-body d-flex align-items-center gap-2 fw-medium">
            <i
              class="bi fs-5"
              :class="
                toast.type === 'error'
                  ? 'bi-exclamation-octagon-fill'
                  : toast.type === 'warning'
                    ? 'bi-exclamation-triangle-fill'
                    : 'bi-check-circle-fill'
              "
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

    <div class="container py-2" style="max-width: 1100px">
      <div v-if="priceChanges.length" class="alert alert-warning" role="alert">
        <h6 class="fw-bold">Giá sách vừa thay đổi</h6>
        <ul>
          <li v-for="item in priceChanges" :key="item.book_id">
            {{ item.title }}: {{ formatCurrency(item.old_price) }} →
            {{ formatCurrency(item.new_price) }}
          </li>
        </ul>
        Tổng tiền đã được cập nhật. Vui lòng kiểm tra và bấm Đặt hàng lần nữa để xác nhận giá mới.
      </div>
      <!-- Khung cảnh báo lỗi 409 khi có sách hết hàng / vượt tồn kho lúc bấm Đặt hàng -->
      <div
        v-if="conflictItems.length > 0"
        class="alert alert-danger border-danger shadow-sm rounded-3 p-4 mb-4"
      >
        <div class="d-flex align-items-start gap-3">
          <i class="bi bi-exclamation-triangle-fill fs-3 text-danger flex-shrink-0"></i>
          <div class="flex-grow-1">
            <h6 class="fw-bold text-danger mb-2">
              Rất tiếc, một số sản phẩm trong đơn hàng vừa thay đổi tồn kho:
            </h6>
            <ul class="mb-3 ps-3 small">
              <li v-for="cItem in conflictItems" :key="cItem.book_id" class="mb-1">
                <strong>{{ cItem.title }}</strong
                >:
                <span v-if="cItem.reason === 'unavailable'">Sản phẩm đã ngừng kinh doanh.</span>
                <span v-else>
                  Bạn chọn mua <strong>{{ cItem.requested }}</strong> cuốn nhưng kho hiện chỉ còn
                  <strong>{{ cItem.available }}</strong> cuốn.
                </span>
              </li>
            </ul>
            <router-link to="/cart" class="btn btn-danger btn-sm fw-semibold px-3">
              <i class="bi bi-cart3 me-1"></i>Quay lại giỏ hàng để điều chỉnh
            </router-link>
          </div>
        </div>
      </div>

      <!-- Trạng thái đang tải -->
      <div v-if="isInitialLoading" class="p-5 text-center my-4">
        <div class="spinner-border text-danger mb-3" role="status">
          <span class="visually-hidden">Đang tải...</span>
        </div>
        <p class="text-secondary mb-0">Đang chuẩn bị thông tin đơn hàng...</p>
      </div>

      <!-- Bố cục 2 cột đơn giản theo mẫu -->
      <div v-else class="row g-4 g-lg-5">
        <!-- CỘT TRÁI: Thông tin giao hàng -->
        <div class="col-lg-7">
          <h2 class="h5 fw-semibold text-dark mb-3">Thông tin giao hàng</h2>

          <!-- Họ và tên & Số điện thoại người nhận -->
          <div class="row g-3 mb-3">
            <div class="col-md-7">
              <label class="form-label small text-secondary mb-1">
                Họ và tên <span class="text-danger">*</span>
              </label>
              <input
                v-model.trim="deliveryForm.recipient_name"
                type="text"
                class="form-control py-2"
                :class="{ 'is-invalid': formErrors.recipient_name }"
                placeholder="Nhập họ và tên người nhận"
                @input="formErrors.recipient_name = ''"
              />
              <div v-if="formErrors.recipient_name" class="invalid-feedback">
                {{ formErrors.recipient_name }}
              </div>
            </div>
            <div class="col-md-5">
              <label class="form-label small text-secondary mb-1">
                Số điện thoại <span class="text-danger">*</span>
              </label>
              <input
                v-model.trim="deliveryForm.recipient_phone"
                type="tel"
                class="form-control py-2"
                :class="{ 'is-invalid': formErrors.recipient_phone }"
                placeholder="Nhập số điện thoại"
                @input="formErrors.recipient_phone = ''"
              />
              <div v-if="formErrors.recipient_phone" class="invalid-feedback">
                {{ formErrors.recipient_phone }}
              </div>
            </div>
          </div>

          <!-- Khung Địa chỉ giao hàng -->
          <div class="border rounded-2 mb-4 overflow-hidden">
            <div class="px-3 py-3 bg-white border-bottom d-flex align-items-center gap-2">
              <i class="bi bi-geo-alt-fill text-danger"></i>
              <span class="small fw-semibold text-dark">Địa chỉ giao hàng</span>
            </div>

            <div class="p-3 bg-light bg-opacity-50">
              <div class="mb-3">
                <label class="form-label small text-secondary mb-1">
                  Địa chỉ nhận hàng (Số nhà, tên đường, ấp/khóm) <span class="text-danger">*</span>
                </label>
                <input
                  v-model.trim="deliveryForm.street_detail"
                  type="text"
                  class="form-control bg-white py-2"
                  :class="{ 'is-invalid': formErrors.street_detail }"
                  placeholder="Ví dụ: 112/6 Hòa Thanh, Thạnh Quới"
                  @input="formErrors.street_detail = ''"
                />
                <div v-if="formErrors.street_detail" class="invalid-feedback">
                  {{ formErrors.street_detail }}
                </div>
              </div>

              <div class="row g-2">
                <div class="col-md-4">
                  <label class="form-label small text-secondary mb-1">
                    Tỉnh / Thành <span class="text-danger">*</span>
                  </label>
                  <input
                    v-model.trim="deliveryForm.province"
                    type="text"
                    class="form-control bg-white py-2"
                    :class="{ 'is-invalid': formErrors.province }"
                    placeholder="VD: Vĩnh Long"
                    @input="formErrors.province = ''"
                  />
                  <div v-if="formErrors.province" class="invalid-feedback">
                    {{ formErrors.province }}
                  </div>
                </div>

                <div class="col-md-4">
                  <label class="form-label small text-secondary mb-1">
                    Quận / Huyện <span class="text-danger">*</span>
                  </label>
                  <input
                    v-model.trim="deliveryForm.district"
                    type="text"
                    class="form-control bg-white py-2"
                    :class="{ 'is-invalid': formErrors.district }"
                    placeholder="VD: Huyện Long Hồ"
                    @input="formErrors.district = ''"
                  />
                  <div v-if="formErrors.district" class="invalid-feedback">
                    {{ formErrors.district }}
                  </div>
                </div>

                <div class="col-md-4">
                  <label class="form-label small text-secondary mb-1">
                    Phường / Xã <span class="text-danger">*</span>
                  </label>
                  <input
                    v-model.trim="deliveryForm.ward"
                    type="text"
                    class="form-control bg-white py-2"
                    :class="{ 'is-invalid': formErrors.ward }"
                    placeholder="VD: Xã Phú Quới"
                    @input="formErrors.ward = ''"
                  />
                  <div v-if="formErrors.ward" class="invalid-feedback">
                    {{ formErrors.ward }}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Phương thức thanh toán -->
          <div class="mb-4">
            <h3 class="h6 fw-semibold text-dark mb-2">Phương thức thanh toán</h3>
            <div class="border rounded-2 px-3 py-3 bg-white d-flex align-items-center gap-3">
              <input
                id="payCodMethod"
                v-model="paymentMethod"
                class="form-check-input mt-0"
                type="radio"
                value="cod"
              />
              <label
                for="payCodMethod"
                class="form-check-label d-flex align-items-center gap-2 small fw-medium text-dark cursor-pointer flex-grow-1"
              >
                <i class="bi bi-cash-coin text-danger fs-5"></i>
                <span>Thanh toán khi nhận hàng (COD)</span>
              </label>
            </div>
          </div>

          <!-- Hàng nút điều hướng dưới cùng cột trái -->
          <div class="d-flex align-items-center justify-content-between pt-2">
            <router-link to="/cart" class="text-decoration-none small fw-medium checkout-back-link">
              Quay lại giỏ hàng
            </router-link>

            <button
              type="button"
              class="btn btn-danger rounded-pill px-4 py-2 fw-bold text-uppercase shadow-sm"
              style="min-width: 210px"
              :disabled="
                isSubmitting ||
                previewBusy ||
                !quote ||
                hasUnappliedCode ||
                cartStore.selectedCount === 0 ||
                cartStore.hasSelectedIssues
              "
              @click="handlePlaceOrder"
            >
              <span v-if="isSubmitting" class="spinner-border spinner-border-sm me-2"></span>
              Xác nhận đặt hàng
            </button>
          </div>
        </div>

        <!-- CỘT PHẢI: Thông tin đơn hàng -->
        <div class="col-lg-5">
          <div class="ps-lg-4 border-start-lg">
            <h2 class="h5 fw-semibold text-dark pb-3 mb-3 border-bottom border-secondary-subtle">
              Thông tin đơn hàng
            </h2>

            <!-- Danh sách sản phẩm đặt mua -->
            <div class="pb-3 mb-3 border-bottom border-secondary-subtle">
              <div
                v-for="item in checkoutItems"
                :key="item.book_id"
                class="d-flex align-items-center gap-3 py-2"
              >
                <img
                  :src="getBookImage(item.book)"
                  :alt="item.book?.title"
                  class="rounded border p-1 bg-white flex-shrink-0"
                  style="width: 58px; height: 76px; object-fit: contain"
                />

                <div class="flex-grow-1 min-w-0">
                  <div class="small fw-semibold text-dark text-truncate-2 mb-1">
                    {{ item.book?.title }}
                  </div>
                  <div class="text-muted" style="font-size: 12px">
                    {{ item.book?.cover_type || 'Bìa mềm' }}
                  </div>
                </div>

                <div class="flex-shrink-0">
                  <span
                    class="d-inline-flex align-items-center justify-content-center border rounded-1 bg-light text-secondary small fw-semibold"
                    style="min-width: 26px; height: 26px; padding: 0 6px"
                  >
                    {{ item.quantity }}
                  </span>
                </div>

                <div class="text-end flex-shrink-0 fw-bold text-dark small" style="min-width: 92px">
                  {{ formatCurrency(item.subtotal) }}
                </div>
              </div>
            </div>

            <form class="mb-4" novalidate @submit.prevent="applyVoucher">
              <button
                type="button"
                class="btn btn-outline-danger btn-sm mb-3"
                :disabled="isSubmitting || previewBusy || suggestionBusy"
                @click="loadSuggestions"
              >
                <i class="bi bi-stars me-1"></i
                >{{ suggestionBusy ? 'Đang tìm ưu đãi…' : 'Tìm mã tiết kiệm nhất' }}
              </button>
              <div v-if="suggestionError" class="small text-danger mb-2" role="alert">
                {{ suggestionError }}
              </div>
              <div
                v-if="suggestionsLoaded && !suggestions.length"
                class="small text-muted mb-3"
                role="status"
              >
                Chưa có mã phù hợp với hạng, lượt sử dụng và giỏ hàng hiện tại.
              </div>
              <div
                v-if="suggestions.length"
                class="border rounded p-3 mb-3 bg-light"
                aria-live="polite"
              >
                <div
                  v-for="(suggestion, index) in suggestions"
                  :key="suggestion.voucher_id"
                  class="d-flex justify-content-between gap-2 py-2"
                  :class="{ 'border-top': index }"
                >
                  <div>
                    <div class="fw-semibold small">
                      {{ suggestion.code }}
                      <span v-if="index === 0" class="badge bg-success">Tiết kiệm nhất</span>
                    </div>
                    <div class="small text-success">
                      Giảm {{ formatCurrency(suggestion.voucher_discount_amount) }} · Thanh toán
                      {{ formatCurrency(suggestion.total_amount) }}
                    </div>
                    <small class="text-muted"
                      >{{
                        suggestion.min_tier_name
                          ? `Dành cho hạng ${suggestion.min_tier_name} trở lên`
                          : 'Dành cho mọi hạng'
                      }}
                      · Đủ điều kiện giỏ hàng hiện tại</small
                    >
                  </div>
                  <button
                    type="button"
                    class="btn btn-sm btn-outline-danger align-self-center text-nowrap"
                    :disabled="isSubmitting || previewBusy"
                    @click="applySuggested(suggestion.code)"
                  >
                    Áp dụng
                  </button>
                </div>
                <small class="text-muted"
                  >Gợi ý không giữ lượt. Điều kiện được kiểm tra lại khi đặt hàng.</small
                >
              </div>
              <label for="checkout-voucher" class="form-label fw-semibold small">Mã giảm giá</label>
              <div class="input-group">
                <input
                  id="checkout-voucher"
                  v-model="voucherDraft"
                  maxlength="50"
                  class="form-control text-uppercase"
                  :class="{ 'is-invalid': voucherError }"
                  :aria-invalid="!!voucherError"
                  aria-describedby="checkout-voucher-message"
                  placeholder="Nhập mã giảm giá"
                  :disabled="isSubmitting"
                  @input="editVoucher"
                />
                <button
                  class="btn btn-outline-danger"
                  :disabled="isSubmitting || previewBusy || !voucherDraft.trim()"
                >
                  {{ previewBusy ? 'Đang kiểm tra…' : 'Áp dụng' }}
                </button>
              </div>
              <div id="checkout-voucher-message" aria-live="polite" class="small mt-2">
                <div v-if="voucherError" class="text-danger">{{ voucherError }}</div>
                <div v-else-if="quote?.voucher" class="text-success">
                  Đã áp dụng {{ quote.voucher.code }}. Còn
                  {{ quote.voucher.user_remaining_uses }} lượt cho tài khoản trước đơn này.
                </div>
                <div v-else-if="hasUnappliedCode" class="text-muted">
                  Bấm Áp dụng để kiểm tra mã trước khi đặt hàng.
                </div>
              </div>
              <button
                v-if="voucherDraft || appliedCode"
                type="button"
                class="btn btn-link btn-sm text-secondary px-0"
                :disabled="isSubmitting || previewBusy"
                @click="removeVoucher"
              >
                Bỏ mã
              </button>
              <div v-if="previewBusy" class="small text-muted mt-2" role="status">
                Đang cập nhật tổng thanh toán…
              </div>
              <div v-if="quoteError" class="alert alert-danger small mt-2" role="alert">
                {{ quoteError }}
                <button
                  type="button"
                  class="btn btn-sm btn-outline-danger"
                  :disabled="isSubmitting || previewBusy"
                  @click="refreshQuote(appliedCode)"
                >
                  Thử lại
                </button>
              </div>
              <div v-if="quoteNotice" class="alert alert-warning small mt-2" role="status">
                {{ quoteNotice }}
              </div>
            </form>
            <!-- Tạm tính & Phí vận chuyển -->
            <div class="pb-3 mb-3 border-bottom border-secondary-subtle">
              <div class="d-flex justify-content-between align-items-center mb-2 small">
                <span class="text-secondary">Tạm tính</span>
                <span class="fw-bold text-dark">{{ formatCurrency(subtotal) }}</span>
              </div>

              <div class="d-flex justify-content-between align-items-center small">
                <span class="text-secondary">Phí vận chuyển</span>
                <span v-if="shippingFee === 0" class="fw-bold text-success">Miễn phí</span>
                <span v-else class="fw-bold text-dark">{{ formatCurrency(shippingFee) }}</span>
              </div>
              <div
                v-if="quote?.voucher"
                class="d-flex justify-content-between align-items-center small text-success mt-2"
              >
                <span>Giảm giá từ mã {{ quote.voucher.code }}</span
                ><strong>−{{ formatCurrency(quote.voucher_discount_amount) }}</strong>
              </div>
            </div>

            <!-- Tổng cộng -->
            <div class="d-flex justify-content-between align-items-center">
              <span class="text-secondary fs-6">Tổng cộng</span>
              <span class="fs-4 fw-bold text-dark">{{ formatCurrency(totalAmount) }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, onBeforeUnmount, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useCartStore } from '@/stores/cartStore'
import { useAuthStore } from '@/stores/authStore'
import { addressService } from '@/services/addressService'
import { orderService } from '@/services/orderService'
import { getBookCoverUrl } from '@/utils/imageHelper'

const router = useRouter()
const cartStore = useCartStore()
const authStore = useAuthStore()

const isInitialLoading = ref(true)
const isSubmitting = ref(false)

const loadedDefaultAddress = ref(null)
const paymentMethod = ref('cod')
const conflictItems = ref([])
const priceChanges = ref([])
const voucherDraft = ref('')
const appliedCode = ref('')
const quote = ref(null)
const previewBusy = ref(false)
const voucherError = ref('')
const quoteError = ref('')
const quoteNotice = ref('')
let previewRequest = 0
const suggestions = ref([]),
  suggestionBusy = ref(false),
  suggestionError = ref(''),
  suggestionsLoaded = ref(false)
let suggestionRequest = 0
async function loadSuggestions() {
  const request = ++suggestionRequest
  suggestionBusy.value = true
  suggestionError.value = ''
  suggestionsLoaded.value = false
  try {
    const result = await orderService.voucherSuggestions({
      book_ids: [...cartStore.selectedBookIds],
    })
    if (request !== suggestionRequest) return
    suggestions.value = result.suggestions
    suggestionsLoaded.value = true
  } catch (error) {
    if (request === suggestionRequest) {
      suggestions.value = []
      suggestionError.value =
        error.response?.data?.message || 'Không tìm được ưu đãi. Vui lòng thử lại.'
    }
  } finally {
    if (request === suggestionRequest) suggestionBusy.value = false
  }
}
async function applySuggested(code) {
  voucherDraft.value = code
  editVoucher()
  await applyVoucher()
}
const hasUnappliedCode = computed(
  () => voucherDraft.value.trim().toUpperCase() !== appliedCode.value,
)
const checkoutItems = computed(() =>
  cartStore.selectedItems.map((item) => {
    const current = quote.value?.items?.find((row) => row.book_id === item.book_id)
    return current ? { ...item, quantity: current.quantity, subtotal: current.subtotal } : item
  }),
)
async function refreshQuote(code = '') {
  const request = ++previewRequest
  previewBusy.value = true
  quoteError.value = ''
  voucherError.value = ''
  quote.value = null
  try {
    const result = await orderService.preview({
      book_ids: [...cartStore.selectedBookIds],
      voucher_code: code || null,
    })
    if (request !== previewRequest) return false
    quote.value = result
    appliedCode.value = result.voucher?.code?.trim().toUpperCase() || ''
    return true
  } catch (error) {
    if (request !== previewRequest) return false
    const data = error.response?.data
    if (data?.fieldErrors?.voucher_code) voucherError.value = data.fieldErrors.voucher_code
    else quoteError.value = data?.message || 'Không thể kiểm tra tổng thanh toán. Vui lòng thử lại.'
    return false
  } finally {
    if (request === previewRequest) previewBusy.value = false
  }
}
function editVoucher() {
  ++previewRequest
  previewBusy.value = false
  quote.value = null
  appliedCode.value = ''
  voucherError.value = ''
  quoteError.value = ''
  quoteNotice.value = ''
  if (!voucherDraft.value.trim()) refreshQuote()
}
async function applyVoucher() {
  if (previewBusy.value || isSubmitting.value) return
  quoteNotice.value = ''
  await refreshQuote(voucherDraft.value.trim().toUpperCase())
}
async function removeVoucher() {
  voucherDraft.value = ''
  appliedCode.value = ''
  quoteNotice.value = ''
  await refreshQuote()
}
watch(
  () =>
    JSON.stringify(
      cartStore.selectedItems.map((item) => [item.book_id, item.quantity, item.subtotal]),
    ),
  () => {
    ++suggestionRequest
    suggestions.value = []
    suggestionsLoaded.value = false
    suggestionBusy.value = false
    suggestionError.value = ''
    if (!isInitialLoading.value && !isSubmitting.value) {
      quoteNotice.value = 'Giỏ hàng đã thay đổi. Vui lòng kiểm tra lại tổng thanh toán.'
      refreshQuote(appliedCode.value)
    }
  },
)

const shippingConfig = reactive({
  free_shipping_threshold: 300000,
  standard_shipping_fee: 30000,
})

const deliveryForm = reactive({
  recipient_name: '',
  recipient_phone: '',
  street_detail: '',
  province: '',
  district: '',
  ward: '',
})

const formErrors = reactive({
  recipient_name: '',
  recipient_phone: '',
  street_detail: '',
  province: '',
  district: '',
  ward: '',
})

const toast = reactive({
  show: false,
  message: '',
  type: 'success',
})
let toastTimer = null

function triggerToast(message, type = 'success') {
  if (toastTimer) clearTimeout(toastTimer)
  toast.message = message
  toast.type = type
  toast.show = true
  toastTimer = setTimeout(() => {
    toast.show = false
  }, 3400)
}

function formatCurrency(val) {
  const num = Math.round(Number(val) || 0)
  return num.toLocaleString('vi-VN') + 'đ'
}

function getBookImage(book) {
  return getBookCoverUrl(book?.images, book?.title || 'Book')
}

const subtotal = computed(() => quote.value?.subtotal ?? cartStore.selectedTotalPrice)

const shippingFee = computed(() => {
  if (quote.value) return quote.value.shipping_fee
  if (subtotal.value <= 0) return 0
  return subtotal.value >= shippingConfig.free_shipping_threshold
    ? 0
    : shippingConfig.standard_shipping_fee
})

const totalAmount = computed(
  () => quote.value?.total_amount ?? Math.max(0, subtotal.value + shippingFee.value),
)

function validateDeliveryForm() {
  let isValid = true
  formErrors.recipient_name = ''
  formErrors.recipient_phone = ''
  formErrors.street_detail = ''
  formErrors.province = ''
  formErrors.district = ''
  formErrors.ward = ''

  if (!deliveryForm.recipient_name) {
    formErrors.recipient_name = 'Vui lòng nhập họ và tên người nhận'
    isValid = false
  }

  if (!deliveryForm.recipient_phone) {
    formErrors.recipient_phone = 'Vui lòng nhập số điện thoại'
    isValid = false
  } else if (!/^[0-9+\-\s]{8,15}$/.test(deliveryForm.recipient_phone)) {
    formErrors.recipient_phone = 'Số điện thoại không hợp lệ'
    isValid = false
  }

  if (!deliveryForm.street_detail) {
    formErrors.street_detail = 'Vui lòng nhập địa chỉ nhận hàng (số nhà, tên đường)'
    isValid = false
  }

  if (!deliveryForm.province) {
    formErrors.province = 'Vui lòng nhập Tỉnh / Thành'
    isValid = false
  }

  if (!deliveryForm.district) {
    formErrors.district = 'Vui lòng nhập Quận / Huyện'
    isValid = false
  }

  if (!deliveryForm.ward) {
    formErrors.ward = 'Vui lòng nhập Phường / Xã'
    isValid = false
  }

  if (!isValid) {
    triggerToast('Vui lòng điền đầy đủ thông tin địa chỉ giao hàng.', 'warning')
  }

  return isValid
}

function isSameAsLoadedAddress() {
  const saved = loadedDefaultAddress.value
  if (!saved) return false
  return (
    saved.recipient_name === deliveryForm.recipient_name &&
    saved.recipient_phone === deliveryForm.recipient_phone &&
    saved.street_detail === deliveryForm.street_detail &&
    saved.province === deliveryForm.province &&
    saved.district === deliveryForm.district &&
    saved.ward === deliveryForm.ward
  )
}

async function resolveAddressIdForOrder() {
  if (!validateDeliveryForm()) {
    return null
  }

  // Nếu người dùng giữ nguyên địa chỉ mặc định đã lưu trước đó thì dùng lại address_id đó
  if (isSameAsLoadedAddress()) {
    return loadedDefaultAddress.value.address_id
  }

  // Nếu người dùng nhập mới hoặc chỉnh sửa thông tin địa chỉ trên form,
  // tự động lưu một bản ghi ADDRESS mới làm mặc định (đơn cũ vẫn giữ nguyên địa chỉ lịch sử)
  try {
    const res = await addressService.createAddress({
      recipient_name: deliveryForm.recipient_name,
      recipient_phone: deliveryForm.recipient_phone,
      street_detail: deliveryForm.street_detail,
      province: deliveryForm.province,
      district: deliveryForm.district,
      ward: deliveryForm.ward,
      is_default: true,
    })
    loadedDefaultAddress.value = res.address
    return res.address.address_id
  } catch (error) {
    const msg = error.response?.data?.message || 'Thông tin địa chỉ giao hàng không hợp lệ'
    triggerToast(msg, 'error')
    return null
  }
}

async function handlePlaceOrder() {
  if (isSubmitting.value) return
  if (previewBusy.value || !quote.value || hasUnappliedCode.value) {
    triggerToast('Vui lòng kiểm tra mã giảm giá và tổng thanh toán trước khi đặt hàng.', 'warning')
    return
  }

  if (cartStore.selectedBookIds.length === 0) {
    router.push('/cart')
    return
  }

  try {
    isSubmitting.value = true
    conflictItems.value = []

    const confirmedQuote = quote.value
    const expectedPrices = confirmedQuote.expected_prices
    const addressId = await resolveAddressIdForOrder()
    if (!addressId) {
      isSubmitting.value = false
      return
    }

    const payload = {
      book_ids: [...cartStore.selectedBookIds],
      address_id: addressId,
      expected_prices: expectedPrices,
      expected_quantities: Object.fromEntries(
        confirmedQuote.items.map((item) => [item.book_id, item.quantity]),
      ),
      voucher_code: appliedCode.value || null,
      expected_quote: Object.fromEntries(
        ['subtotal', 'shipping_fee', 'voucher_discount_amount', 'total_amount'].map((key) => [
          key,
          confirmedQuote[key],
        ]),
      ),
      payment_method: paymentMethod.value,
    }

    const res = await orderService.createOrder(payload)
    const createdOrder = res.order

    await cartStore.fetchCart()

    router.push({
      path: '/orders',
      query: { placed: createdOrder.order_code },
    })
  } catch (error) {
    const status = error.response?.status
    const data = error.response?.data

    if (status === 409 && data?.code === 'PRICE_CHANGED') {
      priceChanges.value = data.price_changes || []
      const refresh = await cartStore.fetchCart()
      if (!refresh.success)
        triggerToast('Không thể tải giá mới. Vui lòng tải lại giỏ hàng trước khi đặt.', 'error')
      await refreshQuote(appliedCode.value)
      quoteNotice.value =
        'Giá đã thay đổi. Vui lòng xem lại tổng tiền và bấm xác nhận đặt hàng lần nữa.'
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } else if (data?.code === 'CHECKOUT_CHANGED') {
      await cartStore.fetchCart()
      await refreshQuote(appliedCode.value)
      quoteNotice.value =
        'Tổng thanh toán đã thay đổi. Vui lòng kiểm tra số tiền mới và xác nhận lại.'
    } else if (data?.fieldErrors?.voucher_code) {
      ++previewRequest
      quote.value = null
      voucherError.value = data.fieldErrors.voucher_code
      document.getElementById('checkout-voucher')?.focus()
    } else if (status === 409 && Array.isArray(data?.out_of_stock_items)) {
      conflictItems.value = data.out_of_stock_items
      await cartStore.fetchCart()
      quote.value = null
      quoteError.value = 'Giỏ hàng không đủ tồn kho. Vui lòng quay lại giỏ hàng để điều chỉnh.'
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } else {
      triggerToast(data?.message || 'Không thể hoàn tất đặt hàng. Vui lòng thử lại.', 'error')
    }
  } finally {
    isSubmitting.value = false
  }
}

onMounted(async () => {
  try {
    isInitialLoading.value = true

    const [, addrRes, shipRes] = await Promise.all([
      cartStore.fetchCart(),
      addressService.getAddresses().catch(() => ({ addresses: [] })),
      orderService.getShippingConfig().catch(() => null),
    ])

    if (shipRes) {
      shippingConfig.free_shipping_threshold = Number(shipRes.free_shipping_threshold || 300000)
      shippingConfig.standard_shipping_fee = Number(shipRes.standard_shipping_fee || 30000)
    }

    if (cartStore.selectedItems.length === 0) {
      router.replace('/cart')
      return
    }

    const savedAddresses = addrRes.addresses || []
    const defaultAddr = savedAddresses.find((a) => a.is_default) || savedAddresses[0] || null

    if (defaultAddr) {
      loadedDefaultAddress.value = defaultAddr
      deliveryForm.recipient_name = defaultAddr.recipient_name
      deliveryForm.recipient_phone = defaultAddr.recipient_phone
      deliveryForm.street_detail = defaultAddr.street_detail
      deliveryForm.province = defaultAddr.province
      deliveryForm.district = defaultAddr.district
      deliveryForm.ward = defaultAddr.ward
    } else {
      deliveryForm.recipient_name = authStore.user?.full_name || ''
      deliveryForm.recipient_phone = authStore.user?.phone || ''
    }
    await refreshQuote()
  } finally {
    isInitialLoading.value = false
  }
})

onBeforeUnmount(() => {
  ++suggestionRequest
  ++previewRequest
  if (toastTimer) clearTimeout(toastTimer)
})
</script>

<style scoped>
.cursor-pointer {
  cursor: pointer;
}

.checkout-back-link {
  color: #194785;
}

.checkout-back-link:hover {
  text-decoration: underline !important;
}

.text-truncate-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  line-height: 1.4;
}

@media (min-width: 992px) {
  .border-start-lg {
    border-left: 1px solid #dee2e6;
  }
}
</style>
