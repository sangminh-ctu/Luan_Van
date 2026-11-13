<template>
  <div class="container-fluid py-4">
    <h2 class="fw-bold">Hạng thành viên</h2>
    <p class="text-muted">
      Xét theo tiền hàng thực trả của các đơn đã giao và đã thanh toán, tích lũy toàn bộ lịch sử.
    </p>
    <div v-if="error" class="alert alert-danger" role="alert">
      {{ error }}
      <button class="btn btn-sm btn-outline-danger" :disabled="loading" @click="load">
        Tải lại
      </button>
    </div>
    <div v-if="notice" class="alert alert-success" role="status">{{ notice }}</div>
    <div v-if="loading" class="py-5 text-center">Đang tải cấu hình hạng…</div>
    <form v-else-if="tiers.length" novalidate @submit.prevent="review">
      <div class="row g-3">
        <div v-for="tier in tiers" :key="tier.tier_id" class="col-md-4">
          <div class="card border-0 shadow-sm h-100">
            <div class="card-body">
              <i class="bi bi-award fs-2 text-primary"></i>
              <h5 class="mt-2">{{ tier.tier_name }}</h5>
              <label :for="`tier-${tier.tier_code}`" class="form-label">Chi tiêu từ (đ)</label>
              <input
                :id="`tier-${tier.tier_code}`"
                v-model="tier.min_spend"
                type="number"
                min="0"
                max="999999999999"
                step="1"
                required
                class="form-control"
                :class="{ 'is-invalid': errors[tier.tier_code] }"
                :disabled="saving || tier.level === 1"
                :aria-invalid="!!errors[tier.tier_code]"
                :aria-describedby="`tier-${tier.tier_code}-error`"
                @input="clearError(tier.tier_code)"
              />
              <div :id="`tier-${tier.tier_code}-error`" class="invalid-feedback">
                {{ errors[tier.tier_code] }}
              </div>
              <div v-if="tier.level === 1" class="form-text">
                Hạng mặc định cho mọi tài khoản, luôn bắt đầu từ 0đ.
              </div>
            </div>
          </div>
        </div>
      </div>
      <div class="alert alert-info mt-4">
        Thay đổi ngưỡng sẽ tính lại hạng của khách hàng, có thể làm tăng hoặc giảm hạng. Giá và ưu
        đãi của các đơn đã đặt được giữ nguyên.
      </div>
      <button class="btn btn-primary" :disabled="saving">
        {{ saving ? 'Đang lưu…' : 'Lưu ngưỡng hạng' }}
      </button>
    </form>
    <div v-if="confirming" class="modal-backdrop show" style="opacity: 0.5"></div>
    <div
      v-if="confirming"
      class="modal d-block"
      role="dialog"
      aria-modal="true"
      aria-labelledby="tier-confirm-title"
      tabindex="-1"
      @keydown.esc="closeConfirm"
    >
      <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content">
          <div class="modal-header">
            <h5 id="tier-confirm-title" class="modal-title">Xác nhận thay đổi hạng</h5>
            <button
              class="btn-close"
              aria-label="Đóng"
              :disabled="saving"
              @click="closeConfirm"
            ></button>
          </div>
          <div class="modal-body">
            Ngưỡng mới:
            <div v-for="tier in tiers" :key="tier.tier_id">
              {{ tier.tier_name }}: từ {{ Number(tier.min_spend).toLocaleString('vi-VN') }}đ
            </div>
            <p class="mt-3 mb-0">Hạng khách hàng sẽ được tính lại theo các ngưỡng này.</p>
          </div>
          <div class="modal-footer">
            <button class="btn btn-light" :disabled="saving" @click="closeConfirm">Hủy</button
            ><button class="btn btn-primary" :disabled="saving" @click="save">
              {{ saving ? 'Đang lưu…' : 'Xác nhận lưu' }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
<script setup>
import { ref, reactive, onMounted, nextTick } from 'vue'
import { membershipService } from '@/services/membershipService'
const tiers = ref([]),
  loading = ref(true),
  saving = ref(false),
  error = ref(''),
  notice = ref(''),
  confirming = ref(false)
const errors = reactive({})
function clearError(code) {
  delete errors[code]
  notice.value = ''
}
function closeConfirm() {
  if (!saving.value) confirming.value = false
}
async function load() {
  loading.value = true
  error.value = ''
  try {
    tiers.value = (await membershipService.list()).tiers
  } catch (e) {
    error.value = e.response?.data?.message || 'Không tải được cấu hình. Vui lòng thử lại.'
  } finally {
    loading.value = false
  }
}
async function review() {
  error.value = ''
  notice.value = ''
  Object.keys(errors).forEach((key) => delete errors[key])
  tiers.value.forEach((tier, index) => {
    if (!/^\d+$/.test(String(tier.min_spend)) || Number(tier.min_spend) > 999999999999)
      errors[tier.tier_code] = 'Nhập số nguyên từ 0 đến 999.999.999.999đ.'
    else if (index && Number(tier.min_spend) <= Number(tiers.value[index - 1].min_spend))
      errors[tier.tier_code] = 'Ngưỡng phải lớn hơn hạng liền trước.'
  })
  if (Object.keys(errors).length) {
    await nextTick()
    document.querySelector('.is-invalid')?.focus()
    return
  }
  confirming.value = true
}
async function save() {
  saving.value = true
  try {
    const result = await membershipService.save(
      tiers.value.map((t) => ({ tier_id: t.tier_id, min_spend: t.min_spend })),
    )
    tiers.value = result.tiers
    notice.value = result.message
  } catch (e) {
    Object.assign(errors, e.response?.data?.fieldErrors || {})
    error.value = e.response?.data?.message || 'Không lưu được cấu hình. Vui lòng thử lại.'
  } finally {
    saving.value = false
    confirming.value = false
  }
}
onMounted(load)
</script>
