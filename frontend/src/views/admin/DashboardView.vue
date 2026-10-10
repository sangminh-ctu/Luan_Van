<template>
  <div class="container-fluid py-2">
    <!-- Tiêu đề trang -->
    <div class="d-flex justify-content-between align-items-center mb-4">
      <h3 class="fw-bold mb-0 text-dark" style="font-size: 1.5rem;">Tổng quan hệ thống</h3>
      <div class="text-muted small">
        <i class="bi bi-calendar3 me-1"></i> {{ currentDate }}
      </div>
    </div>
    
    <!-- Nội dung trống (Placeholder) -->
    <div class="row">
      <div class="col-12">
        <div class="card border-0 shadow-sm rounded-4 text-center py-5" style="background-color: #f8fbff; border-top: 4px solid #0d6efd !important;">
          <div class="card-body py-5">
            <img src="https://cdni.iconscout.com/illustration/premium/thumb/empty-state-2130362-1800926.png" alt="Empty Dashboard" class="mb-4 opacity-75" style="max-height: 200px; object-fit: contain;">
            <h4 class="fw-bold text-dark mb-2">Dashboard đang trống</h4>
            <p class="text-secondary mx-auto" style="max-width: 500px;">
              Chào mừng bạn đến với trang quản trị BookStore AI. Các biểu đồ, số liệu thống kê và báo cáo hệ thống sẽ được hiển thị tại đây trong tương lai.
            </p>
            <button class="btn btn-primary mt-3 px-4 shadow-sm" style="border-radius: 8px;">
              <i class="bi bi-plus-circle me-2"></i>Thêm widget mới
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';

const currentDate = computed(() => {
  const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
  return new Date().toLocaleDateString('vi-VN', options);
});
</script>
