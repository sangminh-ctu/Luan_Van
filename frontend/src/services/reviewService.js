import api from './api';

export const reviewService = {
  async list(bookId, page) {
    return (await api.get(`/reviews/books/${bookId}`, { params: { page } })).data;
  },
  async mine(itemIds) {
    const { data } = await api.get('/reviews/mine', { params: { order_item_ids: itemIds.join(',') } });
    return data.reviews;
  },
  async create(itemId, input) {
    return (await api.post(`/reviews/order-items/${itemId}`, input)).data;
  },
  async reportStatus(bookId) {
    return (await api.get(`/reviews/books/${bookId}/report-status`)).data;
  },
  async report(reviewId, input) {
    await api.post(`/reviews/${reviewId}/reports`, input);
  },
};

export const reviewHideReasons = {
  spam: 'Spam hoặc quảng cáo',
  harassment: 'Xúc phạm hoặc quấy rối',
  personal_info: 'Tiết lộ thông tin cá nhân',
  inappropriate: 'Nội dung không phù hợp',
};

export const reviewReportReasons = {
  ...reviewHideReasons,
  other: 'Lý do khác',
};

export const adminReviewService = {
  async list(params) {
    return (await api.get('/admin/reviews', { params })).data;
  },
  async detail(id) {
    return (await api.get(`/admin/reviews/${id}`)).data;
  },
  async moderate(id, input) {
    await api.post(`/admin/reviews/${id}/moderate`, input);
  },
};
