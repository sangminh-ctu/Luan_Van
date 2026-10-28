import api from './api';

export const orderService = {
    getShippingConfig: () => api.get('/orders/shipping-config').then(res => res.data),
    createOrder: (payload) => api.post('/orders', payload).then(res => res.data),
    getMyOrders: (params) => api.get('/orders', { params }).then(res => res.data),
    getMyOrderDetail: (idOrCode) => api.get(`/orders/${idOrCode}`).then(res => res.data),
    cancelMyOrder: (orderId) => api.post(`/orders/${orderId}/cancel`).then(res => res.data)
};

export const adminOrderService = {
    getOrders: (params) => api.get('/admin/orders', { params }).then(res => res.data),
    getOrderById: (id) => api.get(`/admin/orders/${id}`).then(res => res.data),
    updateOrderStatus: (id, payload) => api.patch(`/admin/orders/${id}/status`, payload).then(res => res.data),
    updateShipment: (id, payload) => api.patch(`/admin/orders/${id}/shipment`, payload).then(res => res.data)
};

export default orderService;
