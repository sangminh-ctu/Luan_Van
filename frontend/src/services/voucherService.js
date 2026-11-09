import api from './api'

export const voucherService = {
  list: (params) => api.get('/admin/vouchers', { params }).then((r) => r.data),
  detail: (id) => api.get(`/admin/vouchers/${id}`).then((r) => r.data),
  save: (id, data) =>
    (id ? api.put(`/admin/vouchers/${id}`, data) : api.post('/admin/vouchers', data)).then(
      (r) => r.data,
    ),
  changeStatus: (id, status) =>
    api.patch(`/admin/vouchers/${id}/status`, { status }).then((r) => r.data),
  remove: (id) => api.delete(`/admin/vouchers/${id}`).then((r) => r.data),
}
