<template>
  <div class="bg-body-tertiary py-4 min-vh-100">
    <!-- Toast thông báo -->
    <div
      v-if="toast.show"
      class="position-fixed top-0 end-0 p-3"
      style="z-index: 1080; margin-top: 70px"
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
      <div class="row g-3">
        <!-- CỘT TRÁI: SIDEBAR TÀI KHOẢN -->
        <div class="col-lg-3">
          <div class="card border-0 shadow-sm rounded-3 py-4">
            <!-- Thông tin hạng thành viên -->
            <div class="text-center px-3 pb-3 border-bottom">
              <div
                class="rounded-circle bg-secondary bg-opacity-10 border border-4 border-white shadow-sm d-inline-flex align-items-center justify-content-center mb-2"
                style="width: 84px; height: 84px"
              >
                <i class="bi bi-award-fill fs-1 text-secondary"></i>
              </div>
              <div class="fw-bold text-dark text-truncate mb-1" :title="profile.full_name">
                {{ profile.full_name || 'Khách hàng' }}
              </div>
              <div class="mb-2">
                <span class="badge rounded-pill text-bg-secondary bg-opacity-75 px-3 py-1 fw-medium">
                  {{ memberTier.name }}
                </span>
              </div>
              <div class="text-secondary small">Điểm tích lũy {{ pointsBalance.toLocaleString('vi-VN') }}</div>
              <div v-if="memberTier.nextNeeded > 0" class="text-muted" style="font-size: 12px">
                Thêm {{ memberTier.nextNeeded.toLocaleString('vi-VN') }} để nâng hạng {{ memberTier.nextName }}
              </div>
            </div>

            <!-- Menu điều hướng -->
            <ul class="nav flex-column pt-2">
              <!-- Nhóm Thông tin tài khoản -->
              <li class="nav-item">
                <button
                  type="button"
                  class="nav-link w-100 text-start d-flex align-items-center justify-content-between px-3 py-2 border-0 bg-transparent fw-semibold"
                  :class="isAccountGroupActive ? 'text-danger account-active-bar' : 'text-dark'"
                  @click="accountGroupOpen = !accountGroupOpen"
                >
                  <span class="d-flex align-items-center gap-2">
                    <i class="bi bi-person fs-5"></i>
                    <span>Thông tin tài khoản</span>
                  </span>
                  <i class="bi small" :class="accountGroupOpen ? 'bi-chevron-down' : 'bi-chevron-right'"></i>
                </button>

                <ul v-show="accountGroupOpen" class="nav flex-column ps-4 pe-2 pb-1">
                  <li class="nav-item">
                    <button
                      type="button"
                      class="nav-link w-100 text-start py-2 border-0 bg-transparent small"
                      :class="activeTab === 'profile' ? 'text-danger fw-semibold' : 'text-secondary'"
                      @click="switchTab('profile')"
                    >
                      Hồ sơ cá nhân
                    </button>
                  </li>
                  <li class="nav-item">
                    <button
                      type="button"
                      class="nav-link w-100 text-start py-2 border-0 bg-transparent small"
                      :class="activeTab === 'addresses' ? 'text-danger fw-semibold' : 'text-secondary'"
                      @click="switchTab('addresses')"
                    >
                      Sổ địa chỉ
                    </button>
                  </li>
                  <li class="nav-item">
                    <button
                      type="button"
                      class="nav-link w-100 text-start py-2 border-0 bg-transparent small"
                      :class="activeTab === 'password' ? 'text-danger fw-semibold' : 'text-secondary'"
                      @click="switchTab('password')"
                    >
                      Đổi mật khẩu
                    </button>
                  </li>
                  <li class="nav-item">
                    <button
                      type="button"
                      class="nav-link w-100 text-start py-2 border-0 bg-transparent small"
                      :class="activeTab === 'benefits' ? 'text-danger fw-semibold' : 'text-secondary'"
                      @click="switchTab('benefits')"
                    >
                      Ưu đãi thành viên
                    </button>
                  </li>
                </ul>
              </li>

              <!-- Đơn hàng của tôi -->
              <li class="nav-item">
                <router-link
                  to="/orders"
                  class="nav-link d-flex align-items-center gap-2 px-3 py-2 text-dark fw-normal"
                >
                  <i class="bi bi-receipt fs-5 text-secondary"></i>
                  <span>Đơn hàng của tôi</span>
                </router-link>
              </li>

              <!-- Ví voucher -->
              <li class="nav-item">
                <button
                  type="button"
                  class="nav-link w-100 text-start d-flex align-items-center justify-content-between px-3 py-2 border-0 bg-transparent"
                  :class="activeTab === 'vouchers' ? 'text-danger fw-semibold account-active-bar' : 'text-dark'"
                  @click="switchTab('vouchers')"
                >
                  <span class="d-flex align-items-center gap-2">
                    <i class="bi bi-ticket-perforated fs-5 text-secondary"></i>
                    <span>Ví voucher</span>
                  </span>
                  <span v-if="vouchers.length > 0" class="badge rounded-pill bg-danger">
                    {{ vouchers.length }}
                  </span>
                </button>
              </li>

              <!-- Điểm tích lũy -->
              <li class="nav-item">
                <button
                  type="button"
                  class="nav-link w-100 text-start d-flex align-items-center gap-2 px-3 py-2 border-0 bg-transparent"
                  :class="activeTab === 'benefits' ? 'text-danger fw-semibold' : 'text-dark'"
                  @click="switchTab('benefits')"
                >
                  <span
                    class="rounded-circle bg-warning text-white d-inline-flex align-items-center justify-content-center fw-bold flex-shrink-0"
                    style="width: 20px; height: 20px; font-size: 11px"
                  >
                    F
                  </span>
                  <span>Tài khoản Điểm thưởng</span>
                </button>
              </li>
            </ul>
          </div>
        </div>

        <!-- CỘT PHẢI: NỘI DUNG CHÍNH -->
        <div class="col-lg-9">
          <!-- Thanh nhắc cập nhật thông tin nếu thiếu SĐT hoặc họ tên -->
          <div
            v-if="needsProfileUpdate"
            class="alert bg-white border-0 shadow-sm rounded-3 py-2 px-3 mb-3 d-flex align-items-center gap-2 small"
            role="alert"
          >
            <i class="bi bi-exclamation-triangle-fill text-danger"></i>
            <span class="text-secondary">Bạn vui lòng cập nhật đầy đủ thông tin tài khoản:</span>
            <button
              type="button"
              class="btn btn-link p-0 text-danger fw-semibold text-decoration-none small"
              @click="switchTab('profile')"
            >
              Cập nhật thông tin ngay
            </button>
          </div>

          <!-- Khối Banner Thành Viên & Thống kê Ưu đãi / Thành tích -->
          <div class="card border-0 shadow-sm rounded-3 overflow-hidden mb-3">
            <!-- Banner Linh vật & Nút Thành viên -->
            <div class="member-banner position-relative py-4 text-center">
              <button
                type="button"
                class="btn btn-sm bg-white shadow-sm rounded-3 px-3 py-1 fw-medium position-absolute top-0 end-0 m-3 text-secondary"
                @click="switchTab('benefits')"
              >
                Thành viên <i class="bi bi-chevron-right small"></i>
              </button>

              <!-- Biểu tượng Linh vật / Huy hiệu -->
              <div class="d-inline-flex flex-column align-items-center">
                <div
                  class="rounded-circle bg-danger text-white shadow d-flex flex-column align-items-center justify-content-center position-relative"
                  style="width: 78px; height: 78px; border: 4px solid #fff"
                >
                  <i class="bi bi-Crown-fill bi-award-fill text-warning fs-5 position-absolute" style="top: -14px"></i>
                  <i class="bi bi-emoji-smile-fill fs-1"></i>
                </div>
                <div
                  class="bg-secondary bg-opacity-25 rounded-pill mt-1"
                  style="width: 96px; height: 10px"
                ></div>
              </div>
            </div>

            <!-- 2 khung: Ưu đãi của bạn & Thành tích năm -->
            <div class="card-body p-3 p-md-4 bg-white">
              <div class="row g-3">
                <!-- Ưu đãi của bạn -->
                <div class="col-md-6">
                  <div class="border rounded-3 p-3 h-100">
                    <h6 class="fw-semibold text-dark mb-3">Ưu đãi của bạn</h6>
                    <div class="row g-2">
                      <div class="col-6">
                        <div class="bg-body-tertiary rounded-3 p-3 h-100">
                          <div class="text-secondary small mb-1">Điểm hiện có</div>
                          <div class="fw-bold text-danger fs-5">
                            {{ pointsBalance.toLocaleString('vi-VN') }}
                          </div>
                        </div>
                      </div>
                      <div class="col-6">
                        <div class="bg-body-tertiary rounded-3 p-3 h-100">
                          <div class="text-secondary small mb-1">Voucher hiện có</div>
                          <div class="fw-bold text-danger fs-5">{{ vouchers.length }} lần</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <!-- Thành tích năm -->
                <div class="col-md-6">
                  <div class="border rounded-3 p-3 h-100">
                    <h6 class="fw-semibold text-dark mb-3">Thành tích năm {{ stats.year }}</h6>
                    <div class="row g-2">
                      <div class="col-6">
                        <div class="bg-body-tertiary rounded-3 p-3 h-100">
                          <div class="text-secondary small mb-1">Số đơn hàng</div>
                          <div class="fw-bold text-danger fs-5">{{ stats.order_count }} đơn hàng</div>
                        </div>
                      </div>
                      <div class="col-6">
                        <div class="bg-body-tertiary rounded-3 p-3 h-100">
                          <div class="text-secondary small mb-1">Đã thanh toán</div>
                          <div class="fw-bold text-danger fs-5">
                            {{ formatCurrency(stats.total_spent) }}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div class="mt-3 small text-secondary">
                Khám phá hạng thành viên.
                <a
                  href="#"
                  class="text-primary text-decoration-underline"
                  @click.prevent="switchTab('benefits')"
                >
                  Xem chi tiết
                </a>
              </div>
            </div>
          </div>

          <!-- TAB 1: HỒ SƠ CÁ NHÂN -->
          <div v-if="activeTab === 'profile'" class="card border-0 shadow-sm rounded-3 p-4">
            <h5 class="fw-bold text-dark mb-4">Hồ sơ cá nhân</h5>

            <form @submit.prevent="saveProfile">
              <!-- Họ -->
              <div class="row mb-3 align-items-center">
                <label class="col-sm-3 col-form-label text-secondary small">
                  Họ<span class="text-danger">*</span>
                </label>
                <div class="col-sm-7">
                  <input
                    v-model.trim="profileForm.lastName"
                    type="text"
                    class="form-control"
                    placeholder="Nhập họ"
                    required
                  />
                </div>
              </div>

              <!-- Tên -->
              <div class="row mb-3 align-items-center">
                <label class="col-sm-3 col-form-label text-secondary small">
                  Tên<span class="text-danger">*</span>
                </label>
                <div class="col-sm-7">
                  <input
                    v-model.trim="profileForm.firstName"
                    type="text"
                    class="form-control"
                    placeholder="Nhập tên"
                    required
                  />
                </div>
              </div>

              <!-- Số điện thoại -->
              <div class="row mb-3 align-items-center">
                <label class="col-sm-3 col-form-label text-secondary small">Số điện thoại</label>
                <div class="col-sm-7">
                  <div class="input-group">
                    <input
                      ref="phoneInputRef"
                      v-model.trim="profileForm.phone"
                      type="tel"
                      class="form-control border-end-0"
                      :readonly="!editingPhone"
                      placeholder="Nhập số điện thoại (VD: 0912345678)"
                    />
                    <span class="input-group-text bg-white border-start-0">
                      <button
                        type="button"
                        class="btn btn-link btn-sm p-0 text-decoration-none"
                        @click="enablePhoneEdit"
                      >
                        {{ profileForm.phone ? 'Thay đổi' : 'Thêm mới' }}
                      </button>
                    </span>
                  </div>
                </div>
              </div>

              <!-- Email -->
              <div class="row mb-3 align-items-center">
                <label class="col-sm-3 col-form-label text-secondary small">Email</label>
                <div class="col-sm-7">
                  <div class="input-group">
                    <input
                      ref="emailInputRef"
                      v-model.trim="profileForm.email"
                      type="email"
                      class="form-control border-end-0"
                      :readonly="!editingEmail"
                      placeholder="Chưa có email"
                      required
                    />
                    <span class="input-group-text bg-white border-start-0">
                      <button
                        type="button"
                        class="btn btn-link btn-sm p-0 text-decoration-none"
                        @click="enableEmailEdit"
                      >
                        {{ profileForm.email ? 'Thay đổi' : 'Thêm mới' }}
                      </button>
                    </span>
                  </div>
                </div>
              </div>

              <!-- Giới tính -->
              <div class="row mb-3 align-items-center">
                <label class="col-sm-3 col-form-label text-secondary small">
                  Giới tính<span class="text-danger">*</span>
                </label>
                <div class="col-sm-7 d-flex align-items-center gap-4">
                  <div class="form-check mb-0">
                    <input
                      id="genderMale"
                      v-model="profileForm.gender"
                      class="form-check-input"
                      type="radio"
                      value="male"
                    />
                    <label class="form-check-label small" for="genderMale">Nam</label>
                  </div>
                  <div class="form-check mb-0">
                    <input
                      id="genderFemale"
                      v-model="profileForm.gender"
                      class="form-check-input"
                      type="radio"
                      value="female"
                    />
                    <label class="form-check-label small" for="genderFemale">Nữ</label>
                  </div>
                </div>
              </div>

              <!-- Birthday -->
              <div class="row mb-4 align-items-center">
                <label class="col-sm-3 col-form-label text-secondary small">
                  Birthday<span class="text-danger">*</span>
                </label>
                <div class="col-sm-7">
                  <div class="row g-2">
                    <div class="col-4">
                      <input
                        v-model.trim="profileForm.birthDay"
                        type="text"
                        maxlength="2"
                        class="form-control text-center"
                        placeholder="DD"
                      />
                    </div>
                    <div class="col-4">
                      <input
                        v-model.trim="profileForm.birthMonth"
                        type="text"
                        maxlength="2"
                        class="form-control text-center"
                        placeholder="MM"
                      />
                    </div>
                    <div class="col-4">
                      <input
                        v-model.trim="profileForm.birthYear"
                        type="text"
                        maxlength="4"
                        class="form-control text-center"
                        placeholder="YYYY"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div class="row">
                <div class="col-sm-7 offset-sm-3 text-center">
                  <button
                    type="submit"
                    class="btn btn-brand-danger px-5 py-2 fw-semibold rounded-3"
                    :disabled="savingProfile"
                  >
                    <span v-if="savingProfile" class="spinner-border spinner-border-sm me-2"></span>
                    Lưu thay đổi
                  </button>
                </div>
              </div>
            </form>
          </div>

          <!-- TAB 2: SỔ ĐỊA CHỈ -->
          <div v-else-if="activeTab === 'addresses'" class="card border-0 shadow-sm rounded-3 p-4">
            <div class="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-4">
              <h5 class="fw-bold text-dark mb-0">Sổ địa chỉ</h5>
              <button
                type="button"
                class="btn btn-brand-danger btn-sm px-3 py-2 fw-semibold"
                @click="openAddressForm()"
              >
                <i class="bi bi-plus-lg me-1"></i>Thêm địa chỉ mới
              </button>
            </div>

            <!-- Form thêm/sửa địa chỉ -->
            <div v-if="showAddressForm" class="bg-body-tertiary border rounded-3 p-3 mb-4">
              <h6 class="fw-bold mb-3">
                {{ editingAddressId ? 'Cập nhật địa chỉ' : 'Thêm địa chỉ nhận hàng mới' }}
              </h6>
              <form @submit.prevent="saveAddress">
                <div class="row g-3">
                  <div class="col-md-6">
                    <label class="form-label small text-secondary mb-1">
                      Họ tên người nhận <span class="text-danger">*</span>
                    </label>
                    <input
                      v-model.trim="addressForm.recipient_name"
                      type="text"
                      class="form-control"
                      placeholder="Nhập họ tên người nhận"
                      required
                    />
                  </div>
                  <div class="col-md-6">
                    <label class="form-label small text-secondary mb-1">
                      Số điện thoại <span class="text-danger">*</span>
                    </label>
                    <input
                      v-model.trim="addressForm.recipient_phone"
                      type="tel"
                      class="form-control"
                      placeholder="VD: 0912345678"
                      required
                    />
                  </div>
                  <div class="col-md-4">
                    <label class="form-label small text-secondary mb-1">
                      Tỉnh/Thành phố <span class="text-danger">*</span>
                    </label>
                    <input
                      v-model.trim="addressForm.province"
                      type="text"
                      class="form-control"
                      placeholder="VD: TP. Hồ Chí Minh"
                      required
                    />
                  </div>
                  <div class="col-md-4">
                    <label class="form-label small text-secondary mb-1">
                      Quận/Huyện <span class="text-danger">*</span>
                    </label>
                    <input
                      v-model.trim="addressForm.district"
                      type="text"
                      class="form-control"
                      placeholder="VD: Quận 1"
                      required
                    />
                  </div>
                  <div class="col-md-4">
                    <label class="form-label small text-secondary mb-1">
                      Phường/Xã <span class="text-danger">*</span>
                    </label>
                    <input
                      v-model.trim="addressForm.ward"
                      type="text"
                      class="form-control"
                      placeholder="VD: Phường Bến Nghé"
                      required
                    />
                  </div>
                  <div class="col-12">
                    <label class="form-label small text-secondary mb-1">
                      Địa chỉ cụ thể <span class="text-danger">*</span>
                    </label>
                    <input
                      v-model.trim="addressForm.street_detail"
                      type="text"
                      class="form-control"
                      placeholder="Số nhà, tên đường..."
                      required
                    />
                  </div>
                  <div class="col-12">
                    <div class="form-check">
                      <input
                        id="defaultAddrCheck"
                        v-model="addressForm.is_default"
                        class="form-check-input"
                        type="checkbox"
                      />
                      <label class="form-check-label small" for="defaultAddrCheck">
                        Đặt làm địa chỉ mặc định
                      </label>
                    </div>
                  </div>
                  <div class="col-12 d-flex justify-content-end gap-2">
                    <button
                      type="button"
                      class="btn btn-light border px-3"
                      @click="showAddressForm = false"
                    >
                      Hủy
                    </button>
                    <button
                      type="submit"
                      class="btn btn-brand-danger px-4 fw-semibold"
                      :disabled="savingAddress"
                    >
                      <span v-if="savingAddress" class="spinner-border spinner-border-sm me-1"></span>
                      Lưu địa chỉ
                    </button>
                  </div>
                </div>
              </form>
            </div>

            <div v-if="loadingAddresses" class="text-center py-4 text-secondary">
              <span class="spinner-border spinner-border-sm text-danger me-2"></span>Đang tải sổ địa chỉ...
            </div>
            <div v-else-if="addresses.length === 0" class="text-center py-4 text-secondary">
              <i class="bi bi-geo-alt fs-1 d-block mb-2 text-muted"></i>
              Bạn chưa lưu địa chỉ nhận hàng nào.
            </div>
            <div v-else class="d-flex flex-column gap-3">
              <div
                v-for="addr in addresses"
                :key="addr.address_id"
                class="border rounded-3 p-3 d-flex flex-wrap justify-content-between align-items-start gap-3"
              >
                <div>
                  <div class="d-flex align-items-center flex-wrap gap-2 mb-1">
                    <span class="fw-bold text-dark">{{ addr.recipient_name }}</span>
                    <span class="text-secondary small">| {{ addr.recipient_phone }}</span>
                    <span
                      v-if="addr.is_default"
                      class="badge bg-danger-subtle text-danger border border-danger-subtle"
                    >
                      Mặc định
                    </span>
                  </div>
                  <div class="text-secondary small">
                    {{ addr.street_detail }}, {{ addr.ward }}, {{ addr.district }}, {{ addr.province }}
                  </div>
                </div>
                <div class="d-flex align-items-center gap-2">
                  <button
                    type="button"
                    class="btn btn-outline-primary btn-sm"
                    @click="openAddressForm(addr)"
                  >
                    Sửa
                  </button>
                  <button
                    v-if="!addr.is_default"
                    type="button"
                    class="btn btn-outline-secondary btn-sm"
                    @click="makeDefaultAddress(addr.address_id)"
                  >
                    Đặt mặc định
                  </button>
                  <button
                    v-if="!addr.is_default"
                    type="button"
                    class="btn btn-outline-danger btn-sm"
                    @click="removeAddress(addr.address_id)"
                  >
                    Xóa
                  </button>
                </div>
              </div>
            </div>
          </div>

          <!-- TAB 3: ĐỔI MẬT KHẨU -->
          <div v-else-if="activeTab === 'password'" class="card border-0 shadow-sm rounded-3 p-4">
            <h5 class="fw-bold text-dark mb-4">Đổi mật khẩu</h5>
            <form @submit.prevent="submitPasswordChange">
              <div class="row mb-3 align-items-center">
                <label class="col-sm-3 col-form-label text-secondary small">
                  Mật khẩu hiện tại<span class="text-danger">*</span>
                </label>
                <div class="col-sm-7">
                  <input
                    v-model="passwordForm.current_password"
                    type="password"
                    class="form-control"
                    placeholder="Nhập mật khẩu hiện tại"
                    required
                  />
                </div>
              </div>
              <div class="row mb-3 align-items-center">
                <label class="col-sm-3 col-form-label text-secondary small">
                  Mật khẩu mới<span class="text-danger">*</span>
                </label>
                <div class="col-sm-7">
                  <input
                    v-model="passwordForm.new_password"
                    type="password"
                    class="form-control"
                    placeholder="Nhập mật khẩu mới (tối thiểu 6 ký tự)"
                    required
                  />
                </div>
              </div>
              <div class="row mb-4 align-items-center">
                <label class="col-sm-3 col-form-label text-secondary small">
                  Nhập lại mật khẩu mới<span class="text-danger">*</span>
                </label>
                <div class="col-sm-7">
                  <input
                    v-model="passwordForm.confirm_password"
                    type="password"
                    class="form-control"
                    placeholder="Nhập lại mật khẩu mới"
                    required
                  />
                </div>
              </div>
              <div class="row">
                <div class="col-sm-7 offset-sm-3 text-center">
                  <button
                    type="submit"
                    class="btn btn-brand-danger px-5 py-2 fw-semibold rounded-3"
                    :disabled="savingPassword"
                  >
                    <span v-if="savingPassword" class="spinner-border spinner-border-sm me-2"></span>
                    Lưu thay đổi
                  </button>
                </div>
              </div>
            </form>
          </div>

          <!-- TAB 4: VÍ VOUCHER -->
          <div v-else-if="activeTab === 'vouchers'" class="card border-0 shadow-sm rounded-3 p-4">
            <h5 class="fw-bold text-dark mb-4">Ví voucher</h5>
            <div v-if="vouchers.length === 0" class="text-center py-4 text-secondary">
              <i class="bi bi-ticket-perforated fs-1 d-block mb-2 text-muted"></i>
              Hiện chưa có mã giảm giá nào đang áp dụng.
            </div>
            <div v-else class="row g-3">
              <div v-for="v in vouchers" :key="v.voucher_id" class="col-md-6">
                <div class="border rounded-3 p-3 h-100 d-flex flex-column justify-content-between bg-body-tertiary">
                  <div>
                    <div class="d-flex align-items-center justify-content-between gap-2 mb-2">
                      <span class="badge bg-danger px-2 py-1 fs-6">{{ v.code }}</span>
                      <span class="small text-secondary">
                        HSD: {{ formatDate(v.end_date) }}
                      </span>
                    </div>
                    <div class="fw-bold text-dark mb-1">
                      <template v-if="v.discount_type === 'percent'">
                        Giảm {{ Number(v.discount_value) }}%
                        <span v-if="v.max_discount_amount">
                          (Tối đa {{ formatCurrency(v.max_discount_amount) }})
                        </span>
                      </template>
                      <template v-else>
                        Giảm {{ formatCurrency(v.discount_value) }}
                      </template>
                    </div>
                    <div class="small text-secondary mb-3">
                      Đơn tối thiểu: {{ formatCurrency(v.min_order_value) }}
                    </div>
                  </div>
                  <div class="d-flex justify-content-between align-items-center pt-2 border-top">
                    <button
                      type="button"
                      class="btn btn-outline-danger btn-sm fw-semibold"
                      @click="copyVoucherCode(v.code)"
                    >
                      <i class="bi bi-clipboard me-1"></i>Sao chép mã
                    </button>
                    <router-link to="/cart" class="btn btn-brand-danger btn-sm fw-semibold">
                      Dùng ngay
                    </router-link>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- TAB 5: ƯU ĐÃI THÀNH VIÊN -->
          <div v-else-if="activeTab === 'benefits'" class="card border-0 shadow-sm rounded-3 p-4">
            <h5 class="fw-bold text-dark mb-3">Ưu đãi thành viên</h5>
            <p class="text-secondary small mb-4">
              Tích lũy điểm thưởng qua mỗi đơn hàng hoàn tất để nâng hạng thành viên và nhận thêm nhiều đặc quyền tại BookStore.
            </p>
            <div class="row g-3">
              <div class="col-md-4">
                <div class="border rounded-3 p-3 h-100 bg-body-tertiary">
                  <span class="badge text-bg-secondary mb-2">Thành viên Bạc</span>
                  <div class="fw-bold mb-1">Từ 0 điểm</div>
                  <ul class="small text-secondary ps-3 mb-0">
                    <li>Nhận thông báo khuyến mãi & Flash Sale sớm</li>
                    <li>Sử dụng mã giảm giá toàn sàn</li>
                  </ul>
                </div>
              </div>
              <div class="col-md-4">
                <div class="border border-warning rounded-3 p-3 h-100 bg-warning bg-opacity-10">
                  <span class="badge text-bg-warning mb-2">Thành viên Vàng</span>
                  <div class="fw-bold mb-1">Từ 30.000 điểm</div>
                  <ul class="small text-secondary ps-3 mb-0">
                    <li>Tất cả quyền lợi hạng Bạc</li>
                    <li>Ưu tiên nhận voucher giảm giá đặc biệt</li>
                  </ul>
                </div>
              </div>
              <div class="col-md-4">
                <div class="border border-primary rounded-3 p-3 h-100 bg-primary bg-opacity-10">
                  <span class="badge text-bg-primary mb-2">Thành viên Kim Cương</span>
                  <div class="fw-bold mb-1">Từ 100.000 điểm</div>
                  <ul class="small text-secondary ps-3 mb-0">
                    <li>Tất cả quyền lợi hạng Vàng</li>
                    <li>Đặc quyền săn sách Ấn bản giới hạn</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/authStore'
import { userService } from '@/services/userService'
import { addressService } from '@/services/addressService'

const authStore = useAuthStore()
const route = useRoute()
const router = useRouter()

const activeTab = ref(route.query.tab || 'profile')
const accountGroupOpen = ref(true)

const profile = ref({
  user_id: authStore.user?.user_id || null,
  full_name: authStore.user?.full_name || '',
  email: authStore.user?.email || '',
  phone: authStore.user?.phone || '',
  reward_points_balance: authStore.user?.reward_points_balance || 0,
})

const stats = ref({
  year: new Date().getFullYear(),
  order_count: 0,
  total_spent: 0,
})

const vouchers = ref([])

const profileForm = reactive({
  lastName: '',
  firstName: '',
  phone: '',
  email: '',
  gender: 'male',
  birthDay: '',
  birthMonth: '',
  birthYear: '',
})

const editingPhone = ref(false)
const editingEmail = ref(false)
const phoneInputRef = ref(null)
const emailInputRef = ref(null)
const savingProfile = ref(false)

// Địa chỉ
const addresses = ref([])
const loadingAddresses = ref(false)
const showAddressForm = ref(false)
const editingAddressId = ref(null)
const savingAddress = ref(false)
const addressForm = reactive({
  recipient_name: '',
  recipient_phone: '',
  province: '',
  district: '',
  ward: '',
  street_detail: '',
  is_default: false,
})

// Đổi mật khẩu
const savingPassword = ref(false)
const passwordForm = reactive({
  current_password: '',
  new_password: '',
  confirm_password: '',
})

const toast = reactive({
  show: false,
  type: 'success',
  message: '',
})

let toastTimer = null
function showToast(message, type = 'success') {
  toast.message = message
  toast.type = type
  toast.show = true
  if (toastTimer) clearTimeout(toastTimer)
  toastTimer = setTimeout(() => {
    toast.show = false
  }, 3200)
}

const isAccountGroupActive = computed(() =>
  ['profile', 'addresses', 'password', 'benefits'].includes(activeTab.value),
)

const pointsBalance = computed(() => Number(profile.value.reward_points_balance || 0))

const memberTier = computed(() => {
  const pts = pointsBalance.value
  if (pts >= 100000) {
    return { name: 'Thành viên Kim Cương', nextName: '', nextNeeded: 0 }
  }
  if (pts >= 30000) {
    return { name: 'Thành viên Vàng', nextName: 'Kim Cương', nextNeeded: 100000 - pts }
  }
  return { name: 'Thành viên Bạc', nextName: 'Vàng', nextNeeded: 30000 - pts }
})

const needsProfileUpdate = computed(() => {
  return !profile.value.phone || !profileForm.birthDay || !profileForm.birthMonth || !profileForm.birthYear
})

function splitFullName(fullName) {
  const parts = String(fullName || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
  if (parts.length === 0) return { lastName: '', firstName: '' }
  if (parts.length === 1) return { lastName: '', firstName: parts[0] }
  return {
    lastName: parts.slice(0, -1).join(' '),
    firstName: parts[parts.length - 1],
  }
}

function loadExtraMeta(userId) {
  try {
    const raw = localStorage.getItem(`user_profile_meta_${userId}`)
    if (!raw) return
    const meta = JSON.parse(raw)
    if (meta.gender) profileForm.gender = meta.gender
    if (meta.birthDay) profileForm.birthDay = meta.birthDay
    if (meta.birthMonth) profileForm.birthMonth = meta.birthMonth
    if (meta.birthYear) profileForm.birthYear = meta.birthYear
  } catch {
    // ignore
  }
}

function saveExtraMeta(userId) {
  if (!userId) return
  localStorage.setItem(
    `user_profile_meta_${userId}`,
    JSON.stringify({
      gender: profileForm.gender,
      birthDay: profileForm.birthDay,
      birthMonth: profileForm.birthMonth,
      birthYear: profileForm.birthYear,
    }),
  )
}

function syncFormFromProfile(userObj) {
  const { lastName, firstName } = splitFullName(userObj.full_name)
  profileForm.lastName = lastName
  profileForm.firstName = firstName
  profileForm.phone = userObj.phone || ''
  profileForm.email = userObj.email || ''
  editingPhone.value = !userObj.phone
  editingEmail.value = !userObj.email
  loadExtraMeta(userObj.user_id)
}

async function fetchAccountData() {
  try {
    const data = await userService.getMe()
    if (data.user) {
      profile.value = data.user
      authStore.updateUser(data.user)
      syncFormFromProfile(data.user)
    }
    if (data.stats) {
      stats.value = data.stats
    }
    if (Array.isArray(data.vouchers)) {
      vouchers.value = data.vouchers
    }
  } catch (err) {
    showToast(err.response?.data?.message || 'Không thể tải thông tin tài khoản', 'error')
  }
}

async function fetchAddresses() {
  loadingAddresses.value = true
  try {
    const res = await addressService.getAddresses()
    addresses.value = res.addresses || []
  } catch {
    showToast('Không thể tải sổ địa chỉ', 'error')
  } finally {
    loadingAddresses.value = false
  }
}

function switchTab(tab) {
  activeTab.value = tab
  router.replace({ query: { ...route.query, tab } })
  if (tab === 'addresses' && addresses.value.length === 0) {
    fetchAddresses()
  }
}

function enablePhoneEdit() {
  editingPhone.value = true
  nextTick(() => phoneInputRef.value?.focus())
}

function enableEmailEdit() {
  editingEmail.value = true
  nextTick(() => emailInputRef.value?.focus())
}

async function saveProfile() {
  const fullName = [profileForm.lastName, profileForm.firstName].filter(Boolean).join(' ').trim()
  if (!fullName) {
    showToast('Vui lòng nhập đầy đủ Họ và Tên', 'error')
    return
  }

  savingProfile.value = true
  try {
    const res = await userService.updateProfile({
      full_name: fullName,
      phone: profileForm.phone,
      email: profileForm.email,
    })
    if (res.user) {
      profile.value = res.user
      authStore.updateUser(res.user)
      saveExtraMeta(res.user.user_id)
      editingPhone.value = false
      editingEmail.value = false
    }
    showToast(res.message || 'Cập nhật hồ sơ thành công')
  } catch (err) {
    showToast(err.response?.data?.message || 'Cập nhật hồ sơ thất bại', 'error')
  } finally {
    savingProfile.value = false
  }
}

function openAddressForm(addr = null) {
  if (addr) {
    editingAddressId.value = addr.address_id
    addressForm.recipient_name = addr.recipient_name
    addressForm.recipient_phone = addr.recipient_phone
    addressForm.province = addr.province
    addressForm.district = addr.district
    addressForm.ward = addr.ward
    addressForm.street_detail = addr.street_detail
    addressForm.is_default = !!addr.is_default
  } else {
    editingAddressId.value = null
    addressForm.recipient_name = profile.value.full_name || ''
    addressForm.recipient_phone = profile.value.phone || ''
    addressForm.province = ''
    addressForm.district = ''
    addressForm.ward = ''
    addressForm.street_detail = ''
    addressForm.is_default = addresses.value.length === 0
  }
  showAddressForm.value = true
}

async function saveAddress() {
  savingAddress.value = true
  try {
    if (editingAddressId.value) {
      await addressService.updateAddress(editingAddressId.value, { ...addressForm })
      showToast('Đã cập nhật địa chỉ')
    } else {
      await addressService.createAddress({ ...addressForm })
      showToast('Đã thêm địa chỉ mới')
    }
    showAddressForm.value = false
    await fetchAddresses()
  } catch (err) {
    showToast(err.response?.data?.message || 'Không thể lưu địa chỉ', 'error')
  } finally {
    savingAddress.value = false
  }
}

async function makeDefaultAddress(addressId) {
  try {
    await addressService.setDefaultAddress(addressId)
    showToast('Đã đặt làm địa chỉ mặc định')
    await fetchAddresses()
  } catch (err) {
    showToast(err.response?.data?.message || 'Không thể đặt mặc định', 'error')
  }
}

async function removeAddress(addressId) {
  if (!window.confirm('Bạn có chắc muốn xóa địa chỉ này?')) return
  try {
    await addressService.deleteAddress(addressId)
    showToast('Đã xóa địa chỉ')
    await fetchAddresses()
  } catch (err) {
    showToast(err.response?.data?.message || 'Không thể xóa địa chỉ', 'error')
  }
}

async function submitPasswordChange() {
  if (passwordForm.new_password !== passwordForm.confirm_password) {
    showToast('Mật khẩu nhập lại không khớp', 'error')
    return
  }
  savingPassword.value = true
  try {
    const res = await userService.changePassword({
      current_password: passwordForm.current_password,
      new_password: passwordForm.new_password,
    })
    passwordForm.current_password = ''
    passwordForm.new_password = ''
    passwordForm.confirm_password = ''
    showToast(res.message || 'Đổi mật khẩu thành công')
  } catch (err) {
    showToast(err.response?.data?.message || 'Đổi mật khẩu thất bại', 'error')
  } finally {
    savingPassword.value = false
  }
}

async function copyVoucherCode(code) {
  try {
    await navigator.clipboard.writeText(code)
    showToast(`Đã sao chép mã ${code}`)
  } catch {
    showToast(`Mã giảm giá: ${code}`)
  }
}

const formatCurrency = (val) => Number(val || 0).toLocaleString('vi-VN') + ' đ'
const formatDate = (str) => {
  if (!str) return ''
  const d = new Date(str)
  return Number.isNaN(d.getTime()) ? str : d.toLocaleDateString('vi-VN')
}

onMounted(() => {
  syncFormFromProfile(profile.value)
  fetchAccountData()
  if (activeTab.value === 'addresses') {
    fetchAddresses()
  }
})
</script>

<style scoped>
.account-active-bar {
  border-left: 3px solid #c92127 !important;
}
.member-banner {
  background: radial-gradient(circle at center, #ffffff 0%, #eef0f3 55%, #e2e5e9 100%);
}
.btn-brand-danger {
  background-color: #c92127;
  border-color: #c92127;
  color: #ffffff;
}
.btn-brand-danger:hover:not(:disabled) {
  background-color: #a81b20;
  border-color: #a81b20;
  color: #ffffff;
}
</style>
