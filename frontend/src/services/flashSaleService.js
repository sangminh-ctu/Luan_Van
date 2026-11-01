import api from './api'
export const flashSaleService = {
  current: (params) => api.get('/flash-sales/current', { params }).then((r) => r.data),
  list: (params) => api.get('/admin/flash-sales', { params }).then((r) => r.data),
  detail: (id) => api.get('/admin/flash-sales/' + id).then((r) => r.data),
  save: (id, data) =>
    (id ? api.put('/admin/flash-sales/' + id, data) : api.post('/admin/flash-sales', data)).then(
      (r) => r.data,
    ),
  action: (id, action) => api.post('/admin/flash-sales/' + id + '/' + action).then((r) => r.data),
  delete: (id) => api.delete('/admin/flash-sales/' + id).then((r) => r.data),
}
