<template>
  <div>
    <h2 class="fw-bold mb-4">Đánh giá sách</h2>

    <div class="row g-3 mb-4">
      <div v-for="stat in stats" :key="stat.key" class="col-12 col-sm-4">
        <div class="bg-white shadow-sm rounded-3 border-start border-4 p-3 h-100 d-flex align-items-center gap-3"
          :class="`border-${stat.color}`">
          <span class="review-stat-icon" :class="[`bg-${stat.color}-subtle`, `text-${stat.color}-emphasis`]">
            <i class="bi" :class="stat.icon" aria-hidden="true"></i>
          </span>
          <div>
            <div class="text-secondary small fw-semibold">{{ stat.label }}</div>
            <strong class="fs-3" :class="`text-${stat.color}-emphasis`">{{ listing?.[stat.key] ?? '—' }}</strong>
          </div>
        </div>
      </div>
    </div>

    <section class="bg-white shadow-sm rounded-3 p-3 p-md-4 mb-4" aria-label="Danh sách đánh giá">
      <div class="d-flex flex-wrap gap-3 align-items-center justify-content-between mb-3">
        <div class="nav nav-pills" aria-label="Lọc trạng thái đánh giá">
          <button v-for="tab in tabs" :key="tab.key" type="button" class="nav-link"
            :class="{ active: filter === tab.key }" :aria-pressed="filter === tab.key"
            @click="selectFilter(tab.key)">
            {{ tab.label }}{{ tab.key === 'pending' && listing ? ` (${listing.pending})` : '' }}
          </button>
        </div>
        <form class="d-flex gap-2" role="search" @submit.prevent="searchBooks">
          <input v-model.trim="searchInput" type="search" maxlength="200" class="form-control"
            aria-label="Tìm theo tên sách" placeholder="Tìm theo tên sách">
          <button class="btn btn-outline-primary text-nowrap">Tìm</button>
        </form>
      </div>

      <p v-if="loading" role="status">Đang tải đánh giá…</p>
      <div v-else-if="error" class="alert alert-danger" role="alert">
        {{ error }} <button class="btn btn-sm btn-link" type="button" @click="loadList(page)">Thử lại</button>
      </div>
      <p v-else-if="!listing?.reviews.length" class="text-secondary mb-0">Không có đánh giá phù hợp.</p>
      <div v-else class="table-responsive">
        <table class="table table-hover align-middle mb-0 review-table">
          <thead class="table-light">
            <tr><th scope="col">Sách và người đánh giá</th><th scope="col">Nhận xét</th><th scope="col">Trạng thái</th><th scope="col">Thao tác</th></tr>
          </thead>
          <tbody>
            <tr v-for="review in listing.reviews" :key="review.review_id">
              <td><strong>{{ review.book_title }}</strong><div class="small text-secondary">{{ review.author_name }}</div></td>
              <td class="review-text">
                <ReviewStars :rating="review.rating" />
                <div v-if="review.comment" class="comment-preview">{{ review.comment }}</div>
              </td>
              <td>
                <span class="badge rounded-pill" :class="statusStyle(review)">{{ statusLabel(review) }}</span>
                <span v-if="review.pending_reports" class="badge text-bg-warning">{{ review.pending_reports }} báo cáo chờ</span>
              </td>
              <td><button class="btn btn-sm btn-outline-primary text-nowrap" type="button" :disabled="saving"
                @click="openDetail(review.review_id)">Xem chi tiết</button></td>
            </tr>
          </tbody>
        </table>
      </div>
      <nav v-if="!loading && !error && listing?.totalPages > 1" aria-label="Phân trang đánh giá" class="d-flex gap-2 align-items-center mt-3">
        <button type="button" class="btn btn-sm btn-outline-secondary" :disabled="page === 1" @click="loadList(page - 1)">Trang trước</button>
        <span>{{ page }} / {{ listing.totalPages }}</span>
        <button type="button" class="btn btn-sm btn-outline-secondary" :disabled="page >= listing.totalPages" @click="loadList(page + 1)">Trang sau</button>
      </nav>
    </section>

    <section v-if="selectedId" ref="detailPanel" class="bg-white shadow-sm rounded-3 p-3 p-md-4 mb-4" aria-labelledby="review-detail-title">
      <div class="d-flex justify-content-between align-items-start mb-3">
        <h3 id="review-detail-title" class="h5 fw-bold mb-0">Chi tiết đánh giá</h3>
        <button type="button" class="btn-close" aria-label="Đóng chi tiết" :disabled="saving" @click="closeDetail"></button>
      </div>
      <p v-if="detailLoading" role="status">Đang tải chi tiết…</p>
      <div v-if="detailError" class="alert alert-danger" role="alert">
        {{ detailError }}
        <button v-if="!detail" type="button" class="btn btn-sm btn-link" @click="openDetail(selectedId)">Thử lại</button>
      </div>
      <p v-if="notice" class="alert alert-success" role="status">{{ notice }}</p>
      <template v-if="detail">
        <p class="mb-1"><strong>{{ detail.book_title }}</strong> · {{ detail.author_name }}</p>
        <div class="d-flex align-items-center flex-wrap gap-2 mb-3">
          <ReviewStars :rating="detail.rating" />
          <span class="badge rounded-pill" :class="statusStyle(detail)">{{ statusLabel(detail) }}</span>
          <span class="small text-secondary">{{ formatDate(detail.created_at) }}</span>
        </div>
        <p v-if="detail.comment" class="review-body">{{ detail.comment }}</p>
        <p v-if="detail.moderation_reason" class="text-secondary review-body"><strong>Lý do ẩn</strong> {{ detail.moderation_reason }}</p>

        <h4 class="h6 fw-bold mt-4">Báo cáo</h4>
        <p v-if="!detail.reports.length" class="text-secondary small">Chưa có báo cáo.</p>
        <ul v-else class="list-group mb-3">
          <li v-for="report in detail.reports" :key="report.report_id" class="list-group-item">
            <strong>{{ reviewReportReasons[report.reason] }}</strong>
            <span class="badge text-bg-light ms-2">{{ reportLabel(report) }}</span>
            <div class="text-secondary small">{{ formatDate(report.created_at) }}</div>
            <p v-if="report.description" class="review-body mb-1">{{ report.description }}</p>
            <details class="small">
              <summary>Nội dung tại thời điểm báo cáo <ReviewStars class="ms-1" :rating="report.reported_rating" /></summary>
              <p class="review-body mt-1 mb-0">{{ report.reported_comment || 'Không có nhận xét.' }}</p>
            </details>
          </li>
        </ul>

        <h4 class="h6 fw-bold mt-4">Lịch sử kiểm duyệt</h4>
        <p v-if="!detail.history.length" class="text-secondary small">Chưa có thao tác kiểm duyệt.</p>
        <ul v-else class="list-group list-group-flush mb-3">
          <li v-for="entry in detail.history" :key="entry.history_id" class="list-group-item px-0">
            <strong>{{ actionLabels[entry.action] }}</strong>
            <div class="small text-secondary">{{ entry.actor_name }} · {{ formatDate(entry.created_at) }}</div>
            <p v-if="entry.reason" class="review-body mb-0">{{ entry.reason }}</p>
          </li>
        </ul>

        <form v-if="actions.length" class="border-top pt-3" @submit.prevent="moderate">
          <label class="form-label d-block">
            Quyết định
            <select v-model="decision" class="form-select" required :disabled="saving" @change="reason = ''; customReason = ''">
              <option value="" disabled>Chọn quyết định</option>
              <option v-for="action in actions" :key="action" :value="action">{{ actionLabels[action] }}</option>
            </select>
          </label>
          <label v-if="reasonRequired" class="form-label d-block">
            Lý do ẩn
            <select v-model="reason" class="form-select" required :disabled="saving" @change="customReason = ''">
              <option value="" disabled>Chọn lý do ẩn</option>
              <option v-for="(label, code) in reviewHideReasons" :key="code" :value="code">{{ label }}</option>
              <option value="other">Lý do khác</option>
            </select>
          </label>
          <label v-if="reasonRequired && reason === 'other'" class="form-label d-block">
            Lý do ẩn cụ thể
            <textarea v-model.trim="customReason" class="form-control" rows="3" maxlength="1000"
              :disabled="saving" required></textarea>
          </label>
          <label v-else-if="decision" class="form-label d-block">
            Ghi chú (không bắt buộc)
            <textarea v-model.trim="reason" class="form-control" rows="2" maxlength="1000" :disabled="saving"></textarea>
          </label>
          <button class="btn btn-primary" :disabled="saving || !decision || (reasonRequired && (!reason || (reason === 'other' && !customReason)))">Xác nhận xử lý</button>
        </form>
      </template>
    </section>
  </div>
</template>

<script setup>
import { computed, nextTick, onMounted, ref } from 'vue';
import ReviewStars from '@/components/admin/ReviewStars.vue';
import { adminReviewService, reviewReportReasons, reviewHideReasons } from '@/services/reviewService';

const stats = [
  { key: 'active', label: 'Tổng đánh giá đang lưu hành', color: 'primary', icon: 'bi-chat-left-text' },
  { key: 'pending', label: 'Chờ xử lý', color: 'warning', icon: 'bi-flag' },
  { key: 'hidden', label: 'Đã ẩn', color: 'danger', icon: 'bi-eye-slash' },
];
const tabs = [
  { key: 'pending', label: 'Chờ xử lý' },
  { key: 'all', label: 'Tất cả' },
  { key: 'hidden', label: 'Đã ẩn' },
];
const actionLabels = {
  kept: 'Bỏ qua báo cáo',
  hidden: 'Ẩn đánh giá',
  restored: 'Khôi phục',
  kept_hidden: 'Tiếp tục ẩn',
  review_requested: 'Yêu cầu xem xét lại',
  author_deleted: 'Tác giả đã xóa',
};
const listing = ref(null);
const filter = ref('pending');
const searchInput = ref('');
const search = ref('');
const page = ref(1);
const loading = ref(false);
const error = ref('');
const selectedId = ref(null);
const detail = ref(null);
const detailPanel = ref(null);
const detailLoading = ref(false);
const detailError = ref('');
const notice = ref('');
const saving = ref(false);
const decision = ref('');
const reason = ref('');
const customReason = ref('');
let listRequest = 0;
let detailRequest = 0;

const actions = computed(() => {
  const review = detail.value;
  if (!review || review.deleted_at) return [];
  if (review.visibility_status === 'hidden') {
    return ['restored'];
  }
  return review.reports.some(report => report.status === 'pending') ? ['kept', 'hidden'] : ['hidden'];
});
const reasonRequired = computed(() => decision.value === 'hidden');

function statusLabel(review) {
  if (review.deleted_at) return 'Tác giả đã xóa';
  return review.visibility_status === 'hidden' ? 'Đã ẩn' : 'Công khai';
}

function statusStyle(review) {
  if (review.deleted_at) return 'bg-secondary-subtle text-secondary-emphasis';
  return review.visibility_status === 'hidden'
    ? 'bg-danger-subtle text-danger-emphasis'
    : 'bg-success-subtle text-success-emphasis';
}

function reportLabel(report) {
  if (report.resolution === 'author_deleted') return 'Tác giả đã xóa';
  return { pending: 'Chờ xử lý', resolved: 'Đã xử lý', rejected: 'Đã bỏ qua' }[report.status];
}

function formatDate(value) {
  return value ? new Date(value).toLocaleString('vi-VN') : '—';
}

function message(error, fallback) {
  return error.response?.data?.message || fallback;
}

async function loadList(targetPage = 1) {
  const request = ++listRequest;
  page.value = targetPage;
  loading.value = true;
  error.value = '';
  try {
    const result = await adminReviewService.list({ filter: filter.value, search: search.value, page: targetPage });
    if (request !== listRequest) return;
    if (targetPage > 1 && targetPage > result.totalPages) {
      await loadList(Math.max(1, result.totalPages));
      return;
    }
    listing.value = result;
  } catch (err) {
    if (request === listRequest) error.value = message(err, 'Không thể tải danh sách đánh giá.');
  } finally {
    if (request === listRequest) loading.value = false;
  }
}

function selectFilter(value) {
  filter.value = value;
  loadList();
}

function searchBooks() {
  search.value = searchInput.value;
  loadList();
}

function closeDetail() {
  detailRequest++;
  selectedId.value = null;
  detail.value = null;
}

async function openDetail(id, scroll = true) {
  const request = ++detailRequest;
  selectedId.value = id;
  detail.value = null;
  detailError.value = '';
  notice.value = '';
  decision.value = '';
  reason.value = '';
  customReason.value = '';
  detailLoading.value = true;
  if (scroll) {
    await nextTick();
    detailPanel.value?.scrollIntoView({ block: 'start' });
  }
  try {
    const result = await adminReviewService.detail(id);
    if (request === detailRequest) detail.value = result;
  } catch (err) {
    if (request === detailRequest) detailError.value = message(err, 'Không thể tải chi tiết đánh giá.');
  } finally {
    if (request === detailRequest) detailLoading.value = false;
  }
}

async function moderate() {
  if (saving.value || !detail.value || !actions.value.includes(decision.value)) return;
  const { review_id: id, version } = detail.value;
  saving.value = true;
  detailError.value = '';
  notice.value = '';
  try {
    await adminReviewService.moderate(id, {
      action: decision.value, version, reason: reason.value,
      customReason: reasonRequired.value && reason.value === 'other' ? customReason.value : undefined,
    });
    await Promise.all([openDetail(id, false), loadList(page.value)]);
    notice.value = 'Đã lưu quyết định kiểm duyệt.';
  } catch (err) {
    if (err.response?.status === 409) await Promise.all([openDetail(id, false), loadList(page.value)]);
    detailError.value = message(err, 'Không thể xử lý đánh giá.');
  } finally {
    saving.value = false;
  }
}

onMounted(() => loadList());
</script>

<style scoped>
.review-stat-icon {
  display: grid;
  place-items: center;
  flex: 0 0 2.5rem;
  height: 2.5rem;
  border-radius: 0.65rem;
  font-size: 1.15rem;
}

.review-table th,
.review-table td {
  padding: 0.8rem;
}

.review-table td .badge {
  margin-inline-end: 0.25rem;
}

.review-text {
  min-width: 12rem;
  max-width: 34rem;
}

.comment-preview {
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  overflow: hidden;
  overflow-wrap: anywhere;
}

.review-body {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
</style>
