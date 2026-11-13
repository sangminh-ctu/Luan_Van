import api from './api'

export const orderService = {
  getPaymentConfig: () => api.get('/payments/vnpay/config').then((res) => res.data),
  paymentLink: (orderId) =>
    api.post(`/payments/vnpay/orders/${orderId}/link`).then((res) => res.data),
  paymentStatus: (reference) =>
    api.get(`/payments/vnpay/${reference}/status`).then((res) => res.data),
  reconcilePayment: (reference) =>
    api.post(`/payments/vnpay/${reference}/reconcile`).then((res) => res.data),
  voucherSuggestions: (payload) =>
    api.post('/orders/voucher-suggestions', payload).then((res) => res.data),
  preview: (payload) => api.post('/orders/preview', payload).then((res) => res.data),
  getShippingConfig: () => api.get('/orders/shipping-config').then((res) => res.data),
  createOrder: (payload) => api.post('/orders', payload).then((res) => res.data),
  getMyOrders: (params) => api.get('/orders', { params }).then((res) => res.data),
  getMyOrderDetail: (idOrCode) => api.get(`/orders/${idOrCode}`).then((res) => res.data),
  cancelMyOrder: (orderId) => api.post(`/orders/${orderId}/cancel`).then((res) => res.data),
}

export const adminOrderService = {
  getOrders: (params) => api.get('/admin/orders', { params }).then((res) => res.data),
  getOrderById: (id) => api.get(`/admin/orders/${id}`).then((res) => res.data),
  updateOrderStatus: (id, payload) =>
    api.patch(`/admin/orders/${id}/status`, payload).then((res) => res.data),
  updateShipment: (id, payload) =>
    api.patch(`/admin/orders/${id}/shipment`, payload).then((res) => res.data),
}

export default orderService
