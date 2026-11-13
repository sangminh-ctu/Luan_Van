<template>
  <main class="container py-5" style="max-width: 720px">
    <div class="card border-0 shadow-sm p-4 p-md-5" aria-live="polite">
      <div v-if="isSuccess" class="text-center text-success mb-4">
        <div
          class="d-inline-flex align-items-center justify-content-center rounded-circle bg-success-subtle p-3 mb-3"
          aria-hidden="true"
        >
          <i class="bi bi-check-lg fs-1 lh-1"></i>
        </div>
        <h1 class="h4 fw-bold mb-0">{{ heading }}!</h1>
      </div>
      <h1 v-else class="h4 fw-bold">{{ heading }}</h1>
      <p class="text-secondary">{{ description }}</p>
      <div v-if="error" class="alert alert-warning" role="alert">{{ error }}</div>
      <div v-if="loading && !result" class="spinner-border text-danger" role="status">
        <span class="visually-hidden">Đang kiểm tra</span>
      </div>
      <dl v-if="result" class="row small">
        <dt class="col-5">Đơn hàng</dt>
        <dd class="col-7">{{ result.order_code }}</dd>
        <dt class="col-5">Số tiền</dt>
        <dd class="col-7 fw-bold">{{ Number(result.amount).toLocaleString('vi-VN') }}đ</dd>
        <dt class="col-5">Mã giao dịch</dt>
        <dd class="col-7 text-break">{{ result.reference }}</dd>
        <dt class="col-5">Hạn thanh toán</dt>
        <dd class="col-7">
          {{
            new Date(result.expires_at).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })
          }}
        </dd>
      </dl>
      <div v-if="isSuccess" class="row g-3 mt-2">
        <div class="col-12 col-sm-6">
          <RouterLink
            to="/books"
            class="btn btn-outline-primary w-100 d-flex align-items-center justify-content-center gap-2 py-2 rounded-3 fw-semibold"
          >
            <i class="bi bi-cart3" aria-hidden="true"></i>
            Tiếp tục mua sắm
          </RouterLink>
        </div>
        <div class="col-12 col-sm-6">
          <RouterLink
            to="/orders"
            class="btn btn-primary w-100 d-flex align-items-center justify-content-center gap-2 py-2 rounded-3 fw-semibold"
          >
            <i class="bi bi-receipt" aria-hidden="true"></i>
            Đơn hàng của tôi
          </RouterLink>
        </div>
      </div>
      <div v-else class="d-flex flex-wrap gap-2 mt-2">
        <button
          v-if="!result || !terminal"
          class="btn btn-outline-danger"
          :disabled="loading"
          @click="refresh(true)"
        >
          {{ loading ? 'Đang kiểm tra…' : 'Kiểm tra lại thanh toán' }}
        </button>
        <button
          v-if="result?.can_pay && result.status === 'failed'"
          class="btn btn-danger"
          :disabled="loading"
          @click="retry"
        >
          Thanh toán lại
        </button>
        <RouterLink to="/orders" class="btn btn-danger payment-orders-button">
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.8"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
            focusable="false"
          >
            <path
              d="M8 3H5a1 1 0 0 0-1 1v17l4-2 4 2 4-2 4 2V4a1 1 0 0 0-1-1h-3M9 3h6v4H9zM8 11h8M8 15h5"
            />
          </svg>
          Đơn hàng của tôi
          <span aria-hidden="true">→</span>
        </RouterLink>
      </div>
    </div>
  </main>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { useRoute } from 'vue-router'
import { orderService } from '@/services/orderService'

const route = useRoute()
const result = ref(null),
  loading = ref(false),
  statusError = ref(''),
  reconciliationError = ref('')
const reference = String(route.query.reference || '')
const isSuccess = computed(
  () =>
    result.value?.payment_status === 'paid' &&
    !result.value?.payment_review_required &&
    result.value?.order_status !== 'cancelled',
)
let timer,
  disposed = false,
  polls = 0
const terminal = computed(
  () =>
    result.value &&
    (result.value.payment_review_required ||
      result.value.payment_status === 'paid' ||
      result.value.order_status === 'cancelled' ||
      result.value.status === 'failed'),
)
const returnNotice = computed(
  () =>
    ({
      invalid:
        'Không xác minh được chữ ký kết quả trả về từ VNPAY. Hệ thống chưa ghi nhận thanh toán; hãy kiểm tra lại giao dịch.',
      mismatch:
        'Kết quả VNPAY chưa khớp mã giao dịch hoặc số tiền của đơn. Vui lòng liên hệ cửa hàng để đối soát.',
      unavailable:
        'Chưa lưu được kết quả trả về từ VNPAY. Vui lòng kiểm tra lại thanh toán hoặc liên hệ cửa hàng.',
    })[route.query.return_status] || '',
)
const error = computed(
  () =>
    statusError.value || (terminal.value ? '' : reconciliationError.value || returnNotice.value),
)
const heading = computed(() => {
  if (result.value?.payment_review_required) return 'Giao dịch đang cần đối soát'
  if (result.value?.payment_status === 'paid') return 'Thanh toán thành công'
  if (result.value?.order_status === 'cancelled') return 'Đơn hàng đã hủy'
  if (result.value?.status === 'failed') return 'Thanh toán chưa thành công'
  return 'Đang chờ xác nhận thanh toán'
})
const description = computed(() => {
  if (result.value?.payment_review_required)
    return 'Vui lòng liên hệ cửa hàng và cung cấp mã giao dịch bên dưới. Đơn hàng cần được kiểm tra trước khi xử lý tiếp.'
  if (result.value?.payment_status === 'paid')
    return 'Đơn hàng của bạn đã được thanh toán thành công. Bạn có thể theo dõi đơn trong Đơn hàng của tôi.'
  if (result.value?.order_status === 'cancelled')
    return 'Đơn đã hết hạn thanh toán hoặc được hủy. Nếu tài khoản đã bị trừ tiền, vui lòng liên hệ cửa hàng để đối soát.'
  if (result.value?.status === 'failed')
    return 'Bạn có thể thanh toán lại trong thời hạn giữ đơn, hoặc hủy đơn chưa thanh toán.'
  return 'Kết quả đang được kiểm tra với VNPAY. Nếu đã bị trừ tiền, vui lòng chờ xác nhận trước khi thực hiện giao dịch khác.'
})
async function refresh(reconcile = false) {
  if (loading.value || disposed) return
  if (!/^[a-f0-9]{32}$/.test(reference)) {
    statusError.value = 'Không tìm thấy mã giao dịch. Vui lòng mở Đơn hàng của tôi để kiểm tra.'
    return
  }
  loading.value = true
  try {
    const data = reconcile
      ? await orderService.reconcilePayment(reference)
      : await orderService.paymentStatus(reference)
    if (!disposed) {
      result.value = data
      statusError.value = ''
      if (reconcile) {
        const notices = {
          throttled:
            'Giao dịch vừa được kiểm tra. Vui lòng chờ khoảng một phút rồi kiểm tra lại; hệ thống vẫn đang chờ xác nhận từ VNPAY.',
          not_found:
            'VNPAY chưa tìm thấy giao dịch trong lần truy vấn này. Nếu đã bị trừ tiền, vui lòng chờ đối soát, không thanh toán lại.',
          pending:
            'VNPAY cho biết giao dịch chưa hoàn tất. Vui lòng chờ xác nhận hoặc kiểm tra lại sau.',
        }
        reconciliationError.value = notices[data.reconciliation?.state] || ''
      }
    }
  } catch (err) {
    if (!disposed) {
      const message =
        err.response?.data?.message || 'Chưa kiểm tra được thanh toán. Vui lòng thử lại.'
      if (reconcile) reconciliationError.value = message
      else statusError.value = message
    }
  } finally {
    if (!disposed) loading.value = false
  }
}
async function retry() {
  loading.value = true
  statusError.value = ''
  try {
    const data = await orderService.paymentLink(result.value.order_id)
    window.location.assign(data.payment_url)
  } catch (err) {
    statusError.value = err.response?.data?.message || 'Chưa tạo được giao dịch. Vui lòng thử lại.'
  } finally {
    loading.value = false
  }
}
onMounted(async () => {
  await refresh()
  if (!terminal.value && result.value) await refresh(true)
  if (disposed || terminal.value) return
  timer = setInterval(async () => {
    await refresh()
    if (terminal.value || ++polls >= 20) clearInterval(timer)
  }, 3000)
})
onBeforeUnmount(() => {
  disposed = true
  clearInterval(timer)
})
</script>

<style scoped>
.payment-orders-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.625rem;
  padding: 0.75rem 1.5rem;
  border-radius: 0.625rem;
  font-weight: 600;
  box-shadow: 0 4px 12px rgb(220 53 69 / 18%);
  transition:
    background-color 0.15s ease,
    box-shadow 0.15s ease;
}

.payment-orders-button:hover {
  box-shadow: 0 6px 16px rgb(220 53 69 / 28%);
}

.payment-orders-button:focus-visible {
  outline: 3px solid #a71d2a;
  outline-offset: 3px;
}
</style>
