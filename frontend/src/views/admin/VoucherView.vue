<template>
  <div class="container-fluid py-4">
    <div class="d-flex justify-content-between align-items-center flex-wrap gap-3 mb-4">
      <div>
        <h2 class="fw-bold mb-1">Quản lý mã giảm giá</h2>
        <p class="text-muted mb-0">Tạo và quản lý ưu đãi cho đơn hàng.</p>
      </div>
      <button class="btn btn-primary" :disabled="busy" @click="openForm()">
        <i class="bi bi-plus-lg me-2"></i>Thêm mã giảm giá
      </button>
    </div>
    <div class="row g-3 mb-4">
      <div v-for="(item, key) in states" :key="key" class="col-6 col-md-4 col-xl">
        <div class="card border-0 shadow-sm h-100">
          <div class="card-body">
            <div class="text-muted small">{{ item.label }}</div>
            <div class="fs-3 fw-bold" :class="item.text">{{ stats[key] || 0 }}</div>
          </div>
        </div>
      </div>
    </div>
    <div v-if="error" class="alert alert-danger" role="alert">
      {{ error }}
      <button class="btn btn-sm btn-outline-danger ms-2" @click="load()">Thử lại</button>
    </div>
    <div v-if="notice" class="alert alert-success" role="status">{{ notice }}</div>
    <div class="card border-0 shadow-sm">
      <form class="card-body border-bottom row g-3 m-0" @submit.prevent="search">
        <div class="col-md-5">
          <label for="voucher-search" class="form-label small">Tìm mã giảm giá</label
          ><input
            id="voucher-search"
            v-model="filters.search"
            class="form-control"
            maxlength="50"
            placeholder="Nhập mã cần tìm"
          />
        </div>
        <div class="col-md-3">
          <label for="voucher-type" class="form-label small">Loại giảm</label
          ><select id="voucher-type" v-model="filters.discount_type" class="form-select">
            <option value="">Tất cả loại</option>
            <option value="percent">Phần trăm</option>
            <option value="fixed_amount">Số tiền</option>
          </select>
        </div>
        <div class="col-md-3">
          <label for="voucher-status" class="form-label small">Trạng thái</label
          ><select id="voucher-status" v-model="filters.status" class="form-select">
            <option value="">Tất cả trạng thái</option>
            <option v-for="(item, key) in states" :key="key" :value="key">{{ item.label }}</option>
          </select>
        </div>
        <div class="col-md-1 d-flex align-items-end">
          <button class="btn btn-outline-primary w-100" :disabled="loading">Lọc</button>
        </div>
      </form>
      <div class="table-responsive">
        <table class="table align-middle mb-0">
          <thead class="table-light">
            <tr>
              <th class="ps-4">Mã giảm giá</th>
              <th>Mức giảm</th>
              <th>Đơn tối thiểu</th>
              <th>Thời gian áp dụng</th>
              <th>Lượt dùng</th>
              <th>Trạng thái</th>
              <th class="text-end pe-4">Thao tác</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="loading">
              <td colspan="7" class="text-center py-5">
                <span class="spinner-border spinner-border-sm me-2"></span>Đang tải mã giảm giá…
              </td>
            </tr>
            <tr v-else-if="!vouchers.length">
              <td colspan="7" class="text-center text-muted py-5">
                <i class="bi bi-ticket-perforated fs-1 d-block mb-2"></i
                >{{
                  error ? 'Không tải được danh sách mã giảm giá.' : 'Chưa có mã giảm giá phù hợp.'
                }}
              </td>
            </tr>
            <template v-else>
              <tr v-for="voucher in vouchers" :key="voucher.voucher_id">
                <td class="ps-4">
                  <span class="fw-bold text-primary">{{ voucher.code }}</span
                  ><small v-if="voucher.has_history" class="d-block text-muted"
                    >Đã có lịch sử sử dụng</small
                  >
                </td>
                <td>
                  <strong>{{
                    voucher.discount_type === 'percent'
                      ? `${voucher.discount_value}%`
                      : currency(voucher.discount_value)
                  }}</strong
                  ><small v-if="voucher.max_discount_amount !== null" class="d-block text-muted"
                    >Tối đa {{ currency(voucher.max_discount_amount) }}</small
                  >
                </td>
                <td>{{ currency(voucher.min_order_value) }}</td>
                <td class="small">
                  <div>{{ dateLabel(voucher.start_date) }}</div>
                  <div class="text-muted">đến {{ dateLabel(voucher.end_date) }}</div>
                </td>
                <td>
                  <div>
                    {{ voucher.used_count }} / {{ voucher.usage_limit ?? 'Không giới hạn' }}
                  </div>
                  <small v-if="voucher.remaining_uses !== null" class="text-muted"
                    >Còn {{ voucher.remaining_uses }} lượt</small
                  >
                  <small class="d-block text-muted"
                    >{{ voucher.per_user_limit }} lượt / tài khoản</small
                  >
                </td>
                <td>
                  <span class="badge" :class="states[voucher.effective_status]?.badge">{{
                    states[voucher.effective_status]?.label
                  }}</span>
                </td>
                <td class="text-end pe-4">
                  <div class="d-flex gap-1 justify-content-end">
                    <button
                      class="btn btn-sm btn-outline-primary"
                      :disabled="busy"
                      :aria-label="`Sửa mã ${voucher.code}`"
                      title="Sửa mã"
                      @click="openForm(voucher)"
                    >
                      <i class="bi bi-pencil-square"></i>
                    </button>
                    <button
                      class="btn btn-sm btn-outline-secondary"
                      :disabled="busy"
                      :title="voucher.status === 'disabled' ? 'Bật mã' : 'Tắt mã'"
                      @click="askAction(voucher, 'status')"
                    >
                      {{ voucher.status === 'disabled' ? 'Bật' : 'Tắt' }}
                    </button>
                    <button
                      class="btn btn-sm btn-outline-danger"
                      :disabled="busy || voucher.has_history"
                      :title="voucher.has_history ? 'Mã có lịch sử sử dụng, hãy tắt mã' : 'Xóa mã'"
                      :aria-label="`Xóa mã ${voucher.code}`"
                      @click="askAction(voucher, 'delete')"
                    >
                      <i class="bi bi-trash"></i>
                    </button>
                  </div>
                </td>
              </tr>
            </template>
          </tbody>
        </table>
      </div>
      <div class="d-flex justify-content-between align-items-center flex-wrap gap-2 p-3 border-top">
        <span class="small text-muted"
          >{{ pagination.total }} mã · Trang {{ pagination.page }} /
          {{ pagination.totalPages }}</span
        >
        <div class="btn-group">
          <button
            class="btn btn-sm btn-outline-secondary"
            :disabled="loading || pagination.page <= 1"
            @click="load(pagination.page - 1)"
          >
            Trước</button
          ><button
            class="btn btn-sm btn-outline-secondary"
            :disabled="loading || pagination.page >= pagination.totalPages"
            @click="load(pagination.page + 1)"
          >
            Sau
          </button>
        </div>
      </div>
    </div>
    <div v-if="showForm || confirmation" class="modal-backdrop show"></div>
    <div
      v-if="showForm"
      ref="formDialog"
      class="modal d-block"
      role="dialog"
      aria-modal="true"
      aria-labelledby="voucher-form-title"
      tabindex="-1"
      @keydown="dialogKeydown"
      @click.self="closeForm"
    >
      <div class="modal-dialog modal-lg modal-dialog-centered modal-dialog-scrollable">
        <form
          class="modal-content border-0 shadow"
          novalidate
          @submit.prevent="save"
          @focusout="touchField"
        >
          <div class="modal-header">
            <h5 id="voucher-form-title" class="modal-title fw-bold">
              {{ editId ? 'Cập nhật mã giảm giá' : 'Thêm mã giảm giá' }}
            </h5>
            <button
              type="button"
              class="btn-close"
              aria-label="Đóng"
              :disabled="saving"
              @click="closeForm"
            ></button>
          </div>
          <div class="modal-body">
            <div v-if="formError" class="alert alert-danger" role="alert" tabindex="-1">
              {{ formError }}
            </div>
            <div v-if="historyLocked" class="alert alert-info small">
              Mã đã có lịch sử sử dụng. Bạn có thể tắt mã, gia hạn thời gian hoặc tăng giới hạn lượt
              dùng.
            </div>
            <div class="row g-3">
              <div class="col-md-6">
                <label for="code" class="form-label"
                  >Mã giảm giá <span class="text-danger">*</span></label
                ><input
                  id="code"
                  v-model="form.code"
                  v-bind="fieldProps('code')"
                  class="form-control text-uppercase"
                  required
                  maxlength="50"
                  pattern="[A-Za-z0-9_\-]{1,50}"
                  :disabled="historyLocked || saving"
                />
                <div
                  v-if="fieldError('code')"
                  id="code-error"
                  class="invalid-feedback d-block"
                  aria-live="polite"
                >
                  {{ fieldError('code') }}
                </div>
                <div class="form-text">
                  Chữ không dấu, số, dấu - hoặc _. Tự chuyển thành chữ hoa.
                </div>
              </div>
              <div class="col-md-6">
                <label for="discount-type" class="form-label">Loại giảm giá</label
                ><select
                  id="discount-type"
                  v-model="form.discount_type"
                  v-bind="fieldProps('discount_type')"
                  class="form-select"
                  :disabled="historyLocked || saving"
                  @change="form.max_discount_amount = null"
                >
                  <option value="percent">Giảm theo phần trăm</option>
                  <option value="fixed_amount">Giảm số tiền</option>
                </select>
                <div
                  v-if="fieldError('discount_type')"
                  id="discount-type-error"
                  class="invalid-feedback d-block"
                  aria-live="polite"
                >
                  {{ fieldError('discount_type') }}
                </div>
              </div>
              <div class="col-md-6">
                <label for="discount-value" class="form-label"
                  >Giá trị giảm ({{ form.discount_type === 'percent' ? '%' : 'đ' }})
                  <span class="text-danger">*</span></label
                ><input
                  id="discount-value"
                  v-model="form.discount_value"
                  v-bind="fieldProps('discount_value')"
                  type="number"
                  min="0.01"
                  :max="form.discount_type === 'percent' ? 100 : Number(form.min_order_value) || 0"
                  step="0.01"
                  class="form-control"
                  required
                  :disabled="historyLocked || saving"
                />
                <div
                  v-if="fieldError('discount_value')"
                  id="discount-value-error"
                  class="invalid-feedback d-block"
                  aria-live="polite"
                >
                  {{ fieldError('discount_value') }}
                </div>
                <div v-if="form.discount_type === 'fixed_amount'" class="form-text">
                  Số tiền giảm không được vượt đơn tối thiểu; nhập đơn tối thiểu trước.
                </div>
              </div>
              <div class="col-md-6">
                <label for="min-order" class="form-label">Đơn tối thiểu (đ)</label
                ><input
                  id="min-order"
                  v-model="form.min_order_value"
                  v-bind="fieldProps('min_order_value')"
                  type="number"
                  min="0"
                  max="9999999999.99"
                  step="0.01"
                  class="form-control"
                  required
                  :disabled="historyLocked || saving"
                />
                <div
                  v-if="fieldError('min_order_value')"
                  id="min-order-error"
                  class="invalid-feedback d-block"
                  aria-live="polite"
                >
                  {{ fieldError('min_order_value') }}
                </div>
              </div>
              <div v-if="form.discount_type === 'percent'" class="col-md-6">
                <label for="max-discount" class="form-label">Giảm tối đa (đ)</label
                ><input
                  id="max-discount"
                  v-model="form.max_discount_amount"
                  v-bind="fieldProps('max_discount_amount')"
                  type="number"
                  min="0.01"
                  :max="Number(form.min_order_value) || 0"
                  step="0.01"
                  class="form-control"
                  :disabled="historyLocked || saving"
                  placeholder="Để trống nếu không giới hạn"
                />
                <div
                  v-if="fieldError('max_discount_amount')"
                  id="max-discount-error"
                  class="invalid-feedback d-block"
                  aria-live="polite"
                >
                  {{ fieldError('max_discount_amount') }}
                </div>
                <div class="form-text">Không được vượt đơn tối thiểu.</div>
              </div>
              <div class="col-md-6">
                <label for="usage-limit" class="form-label">Giới hạn lượt dùng</label
                ><input
                  id="usage-limit"
                  v-model="form.usage_limit"
                  v-bind="fieldProps('usage_limit')"
                  type="number"
                  :min="minimumLimit"
                  max="2147483647"
                  step="1"
                  class="form-control"
                  :disabled="saving || (historyLocked && originalLimit === null)"
                  placeholder="Để trống nếu không giới hạn"
                />
                <div
                  v-if="fieldError('usage_limit')"
                  id="usage-limit-error"
                  class="invalid-feedback d-block"
                  aria-live="polite"
                >
                  {{ fieldError('usage_limit') }}
                </div>
                <div v-if="editId" class="form-text">Đã dùng: {{ usedCount }} lượt.</div>
              </div>
              <div class="col-md-6">
                <label for="per-user-limit" class="form-label"
                  >Lượt dùng mỗi tài khoản <span class="text-danger">*</span></label
                >
                <input
                  id="per-user-limit"
                  v-model="form.per_user_limit"
                  v-bind="fieldProps('per_user_limit')"
                  type="number"
                  :min="historyLocked ? originalPerUserLimit : 1"
                  max="2147483647"
                  step="1"
                  required
                  class="form-control"
                  :disabled="saving"
                />
                <div
                  v-if="fieldError('per_user_limit')"
                  id="per-user-limit-error"
                  class="invalid-feedback d-block"
                  aria-live="polite"
                >
                  {{ fieldError('per_user_limit') }}
                </div>
                <div class="form-text">
                  Mặc định 1 lần mỗi tài khoản. Đơn bị hủy sẽ được hoàn lượt.
                </div>
              </div>
              <div class="col-md-6">
                <label for="start-date" class="form-label"
                  >Bắt đầu <span class="text-danger">*</span></label
                ><input
                  id="start-date"
                  v-model="form.start_date"
                  v-bind="fieldProps('start_date')"
                  type="datetime-local"
                  step="1"
                  :min="startMinimum"
                  class="form-control"
                  required
                  :disabled="historyLocked || saving"
                  @input="chooseStartDate"
                />
                <div
                  v-if="fieldError('start_date')"
                  id="start-date-error"
                  class="invalid-feedback d-block"
                  aria-live="polite"
                >
                  {{ fieldError('start_date') }}
                </div>
                <div v-if="!editId" class="form-check mt-2">
                  <input
                    id="start-now"
                    v-model="form.start_now"
                    type="checkbox"
                    class="form-check-input"
                    :disabled="saving"
                    @change="applyStartNow"
                  />
                  <label for="start-now" class="form-check-label">Áp dụng ngay khi lưu</label>
                </div>
                <div v-if="!historyLocked" class="form-text">
                  {{
                    form.start_now
                      ? 'Mã sẽ bắt đầu khi lưu. Chọn ngày giờ khác sẽ bỏ áp dụng ngay.'
                      : 'Chọn ngày giờ từ hiện tại trở đi, hoặc chọn áp dụng ngay khi lưu.'
                  }}
                </div>
              </div>
              <div class="col-md-6">
                <label for="end-date" class="form-label"
                  >Kết thúc <span class="text-danger">*</span></label
                ><input
                  id="end-date"
                  v-model="form.end_date"
                  v-bind="fieldProps('end_date')"
                  type="datetime-local"
                  step="1"
                  :min="endMinimum"
                  class="form-control"
                  required
                  :disabled="saving"
                />
                <div
                  v-if="fieldError('end_date')"
                  id="end-date-error"
                  class="invalid-feedback d-block"
                  aria-live="polite"
                >
                  {{ fieldError('end_date') }}
                </div>
              </div>
              <div class="col-12 small text-muted">Ngày giờ áp dụng theo giờ Việt Nam (UTC+7).</div>
              <div class="col-md-6">
                <label for="form-status" class="form-label">Trạng thái</label
                ><select
                  id="form-status"
                  v-model="form.status"
                  v-bind="fieldProps('status')"
                  class="form-select"
                  :disabled="saving"
                >
                  <option value="active">Bật mã</option>
                  <option value="disabled">Tắt mã</option>
                  <option v-if="form.status === 'expired'" value="expired">Hết hạn</option>
                </select>
                <div
                  v-if="fieldError('status')"
                  id="form-status-error"
                  class="invalid-feedback d-block"
                  aria-live="polite"
                >
                  {{ fieldError('status') }}
                </div>
                <div class="form-text">Mã bật chỉ áp dụng khi trong thời hạn và còn lượt.</div>
              </div>
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-light" :disabled="saving" @click="closeForm">
              Hủy</button
            ><button class="btn btn-primary" :disabled="saving">
              <span v-if="saving" class="spinner-border spinner-border-sm me-2"></span
              >{{ saving ? 'Đang lưu…' : 'Lưu mã giảm giá' }}
            </button>
          </div>
        </form>
      </div>
    </div>
    <div
      v-if="confirmation"
      ref="confirmDialog"
      class="modal d-block"
      role="dialog"
      aria-modal="true"
      aria-labelledby="voucher-confirm-title"
      tabindex="-1"
      @keydown="dialogKeydown"
      @click.self="closeConfirmation"
    >
      <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content">
          <div class="modal-header">
            <h5 id="voucher-confirm-title" class="modal-title">{{ confirmation.title }}</h5>
            <button
              class="btn-close"
              aria-label="Đóng"
              :disabled="busy"
              @click="closeConfirmation"
            ></button>
          </div>
          <div class="modal-body">
            <div v-if="actionError" class="alert alert-danger" role="alert">{{ actionError }}</div>
            <p class="mb-0">{{ confirmation.message }}</p>
          </div>
          <div class="modal-footer">
            <button class="btn btn-light" :disabled="busy" @click="closeConfirmation">Hủy</button
            ><button
              class="btn"
              :class="confirmation.action === 'delete' ? 'btn-danger' : 'btn-primary'"
              :disabled="busy"
              @click="runAction"
            >
              {{ busy ? 'Đang xử lý…' : 'Xác nhận' }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { voucherService } from '@/services/voucherService'
import { validateVoucherForm } from '@/utils/voucherValidation'

const states = {
  active: { label: 'Đang áp dụng', badge: 'bg-success-subtle text-success', text: 'text-success' },
  scheduled: {
    label: 'Sắp diễn ra',
    badge: 'bg-primary-subtle text-primary',
    text: 'text-primary',
  },
  expired: {
    label: 'Hết hạn',
    badge: 'bg-secondary-subtle text-secondary',
    text: 'text-secondary',
  },
  exhausted: {
    label: 'Hết lượt',
    badge: 'bg-warning-subtle text-warning-emphasis',
    text: 'text-warning',
  },
  disabled: { label: 'Đã tắt', badge: 'bg-danger-subtle text-danger', text: 'text-danger' },
}
const vouchers = ref([]),
  stats = ref({}),
  loading = ref(false),
  error = ref(''),
  notice = ref('')
const filters = reactive({ search: '', discount_type: '', status: '' })
let appliedFilters = { ...filters },
  requestId = 0,
  previousFocus,
  previousOverflow
const pagination = reactive({ page: 1, total: 0, totalPages: 1 })
const showForm = ref(false),
  editId = ref(null),
  saving = ref(false),
  formError = ref('')
const historyLocked = ref(false),
  usedCount = ref(0),
  originalLimit = ref(null),
  originalEnd = ref('')
const originalStart = ref('')
const originalPerUserLimit = ref(1)
const vietnamNow = () => new Date(Date.now() + 7 * 3600000).toISOString().slice(0, 19)
const currentTime = ref(vietnamNow())
let clockTimer
const startMinimum = computed(() =>
  originalStart.value && originalStart.value < currentTime.value
    ? originalStart.value
    : currentTime.value,
)
const endMinimum = computed(() =>
  [
    currentTime.value,
    form.start_now ? currentTime.value : form.start_date || '',
    historyLocked.value ? originalEnd.value : '',
  ]
    .sort()
    .at(-1),
)
const minimumLimit = computed(() =>
  historyLocked.value
    ? Math.max(1, usedCount.value, originalLimit.value || 0)
    : Math.max(1, usedCount.value),
)
const form = reactive({}),
  confirmation = ref(null),
  busy = ref(false),
  actionError = ref('')
const formDialog = ref(null),
  confirmDialog = ref(null)
const currency = (value) =>
  Number(value).toLocaleString('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 2,
  })
const dateLabel = (value) =>
  new Date(value + '+07:00').toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })
const message = (e) => e.response?.data?.message || 'Không thể kết nối máy chủ. Vui lòng thử lại.'
const submitted = ref(false)
const touched = reactive({})
const serverErrors = reactive({})
const fieldIds = {
  code: 'code',
  discount_type: 'discount-type',
  discount_value: 'discount-value',
  min_order_value: 'min-order',
  max_discount_amount: 'max-discount',
  usage_limit: 'usage-limit',
  per_user_limit: 'per-user-limit',
  start_date: 'start-date',
  end_date: 'end-date',
  status: 'form-status',
}
const validationErrors = computed(() =>
  validateVoucherForm(
    form,
    {
      originalStart: originalStart.value,
      originalEnd: originalEnd.value,
      minimumLimit: minimumLimit.value,
      historyLocked: historyLocked.value,
      originalPerUserLimit: originalPerUserLimit.value,
    },
    currentTime.value,
  ),
)
function fieldError(field) {
  return (
    serverErrors[field] || (submitted.value || touched[field] ? validationErrors.value[field] : '')
  )
}
function fieldProps(field) {
  const invalid = !!fieldError(field)
  return {
    class: { 'is-invalid': invalid },
    'aria-invalid': invalid ? 'true' : 'false',
    'aria-describedby': invalid ? `${fieldIds[field]}-error` : undefined,
  }
}
function touchField(event) {
  const field = Object.keys(fieldIds).find((key) => fieldIds[key] === event.target.id)
  if (field) touched[field] = true
}
async function focusFirstError() {
  await nextTick()
  const input =
    formDialog.value?.querySelector('[aria-invalid="true"]:not(:disabled)') ||
    formDialog.value?.querySelector('.alert-danger')
  input?.focus()
  input?.scrollIntoView({ block: 'center', behavior: 'smooth' })
}
watch(
  () => ({ ...form }),
  (values, oldValues) => {
    for (const field of Object.keys(fieldIds))
      if (values[field] !== oldValues[field]) delete serverErrors[field]
    if (values.start_now !== oldValues.start_now) delete serverErrors.start_date
    if (values.discount_type !== oldValues.discount_type) delete serverErrors.max_discount_amount
    if (values.min_order_value !== oldValues.min_order_value) {
      delete serverErrors.discount_value
      delete serverErrors.max_discount_amount
    }
    formError.value = ''
  },
)

async function load(page = pagination.page) {
  const current = ++requestId
  loading.value = true
  error.value = ''
  try {
    const result = await voucherService.list({ ...appliedFilters, page, limit: 10 })
    if (current !== requestId) return
    if (page > result.pagination.totalPages) return load(result.pagination.totalPages)
    vouchers.value = result.vouchers
    stats.value = result.stats
    Object.assign(pagination, result.pagination)
  } catch (e) {
    if (current === requestId) {
      error.value = message(e)
      vouchers.value = []
    }
  } finally {
    if (current === requestId) loading.value = false
  }
}
function search() {
  appliedFilters = { ...filters }
  notice.value = ''
  load(1)
}
async function openForm(voucher) {
  formError.value = ''
  submitted.value = false
  for (const field of Object.keys(touched)) delete touched[field]
  for (const field of Object.keys(serverErrors)) delete serverErrors[field]
  notice.value = ''
  error.value = ''
  busy.value = true
  try {
    const row = voucher ? await voucherService.detail(voucher.voucher_id) : null
    editId.value = row?.voucher_id ?? null
    historyLocked.value = row?.has_history ?? false
    usedCount.value = row?.used_count ?? 0
    originalLimit.value = row?.usage_limit ?? null
    originalEnd.value = row?.end_date ?? ''
    originalStart.value = row?.start_date ?? ''
    originalPerUserLimit.value = row?.per_user_limit ?? 1
    currentTime.value = vietnamNow()
    const later = new Date(Date.now() + 7 * 3600000 + 7 * 86400000).toISOString().slice(0, 19)
    Object.assign(form, {
      code: row?.code ?? '',
      discount_type: row?.discount_type ?? 'percent',
      discount_value: row?.discount_value ?? '',
      max_discount_amount: row?.max_discount_amount ?? null,
      min_order_value: row?.min_order_value ?? 0,
      usage_limit: row?.usage_limit ?? null,
      per_user_limit: row?.per_user_limit ?? 1,
      start_date: row?.start_date ?? '',
      start_now: false,
      end_date: row?.end_date ?? later,
      status: row?.status ?? 'active',
    })
    showForm.value = true
  } catch (e) {
    error.value = message(e)
  } finally {
    busy.value = false
  }
}
function closeForm() {
  if (!saving.value) showForm.value = false
}
function applyStartNow() {
  if (form.start_now) {
    form.start_date = vietnamNow()
    delete serverErrors.start_date
  }
}
function chooseStartDate() {
  form.start_now = false
  touched.start_date = true
}
async function save() {
  formError.value = ''
  submitted.value = true
  currentTime.value = vietnamNow()
  if (Object.keys(validationErrors.value).length || Object.keys(serverErrors).length) {
    await focusFirstError()
    return
  }
  saving.value = true
  try {
    await voucherService.save(editId.value, {
      ...form,
      max_discount_amount: form.discount_type === 'percent' ? form.max_discount_amount : null,
    })
    showForm.value = false
    notice.value = editId.value ? 'Đã cập nhật mã giảm giá.' : 'Đã tạo mã giảm giá.'
    await load(editId.value ? pagination.page : 1)
  } catch (e) {
    const fields = e.response?.data?.fieldErrors
    if (fields && typeof fields === 'object') {
      for (const [field, text] of Object.entries(fields)) {
        if (Object.hasOwn(fieldIds, field) && typeof text === 'string') serverErrors[field] = text
      }
    }
    if (!Object.keys(serverErrors).length) formError.value = message(e)
  } finally {
    saving.value = false
    if (showForm.value) await focusFirstError()
  }
}
function askAction(voucher, action) {
  actionError.value = ''
  notice.value = ''
  const enabling = voucher.status === 'disabled'
  confirmation.value = {
    voucher,
    action,
    status: enabling ? 'active' : 'disabled',
    title:
      action === 'delete' ? 'Xóa mã giảm giá' : enabling ? 'Bật mã giảm giá' : 'Tắt mã giảm giá',
    message:
      action === 'delete'
        ? `Xóa mã ${voucher.code}? Thao tác này không thể hoàn tác.`
        : `${enabling ? 'Bật' : 'Tắt'} mã ${voucher.code}? ${enabling ? 'Mã chỉ áp dụng khi trong thời hạn và còn lượt.' : 'Khách hàng sẽ không thể áp dụng mã này.'}`,
  }
}
function closeConfirmation() {
  if (!busy.value) confirmation.value = null
}
async function runAction() {
  busy.value = true
  actionError.value = ''
  try {
    const { voucher, action, status } = confirmation.value
    if (action === 'delete') await voucherService.remove(voucher.voucher_id)
    else await voucherService.changeStatus(voucher.voucher_id, status)
    confirmation.value = null
    notice.value = 'Đã cập nhật danh sách mã giảm giá.'
    await load()
  } catch (e) {
    actionError.value = message(e)
  } finally {
    busy.value = false
  }
}
function dialogKeydown(event) {
  if (event.key === 'Escape') {
    closeForm()
    closeConfirmation()
  }
  if (event.key !== 'Tab') return
  const nodes = [
    ...event.currentTarget.querySelectorAll(
      'button:not(:disabled), input:not(:disabled), select:not(:disabled)',
    ),
  ]
  const first = nodes[0],
    last = nodes[nodes.length - 1]
  if (!nodes.length) {
    event.preventDefault()
    return
  }
  if (
    event.shiftKey &&
    (document.activeElement === first || document.activeElement === event.currentTarget)
  ) {
    event.preventDefault()
    last.focus()
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault()
    first.focus()
  }
}
watch(
  () => showForm.value || !!confirmation.value,
  async (open) => {
    if (open) {
      previousFocus = document.activeElement
      previousOverflow = document.body.style.overflow
      document.body.style.overflow = 'hidden'
      await nextTick()
      ;(formDialog.value || confirmDialog.value)?.focus()
    } else {
      document.body.style.overflow = previousOverflow || ''
      previousFocus?.focus()
    }
  },
)
onMounted(() => {
  load()
  clockTimer = setInterval(() => {
    currentTime.value = vietnamNow()
  }, 1000)
})
onBeforeUnmount(() => {
  clearInterval(clockTimer)
  requestId++
  if (showForm.value || confirmation.value) document.body.style.overflow = previousOverflow || ''
})
</script>

<style scoped>
th {
  white-space: nowrap;
  font-size: 0.85rem;
  color: #64748b;
  padding-top: 1rem;
  padding-bottom: 1rem;
}
td {
  padding-top: 1rem;
  padding-bottom: 1rem;
}
.modal-backdrop {
  opacity: 0.5;
}
.modal-content {
  border-radius: 1rem;
}
</style>
