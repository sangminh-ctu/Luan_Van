import api from './api';

export const addressService = {
    getAddresses: () => api.get('/addresses').then(res => res.data),
    createAddress: (payload) => api.post('/addresses', payload).then(res => res.data),
    updateAddress: (id, payload) => api.put(`/addresses/${id}`, payload).then(res => res.data),
    setDefaultAddress: (id) => api.patch(`/addresses/${id}/default`).then(res => res.data),
    deleteAddress: (id) => api.delete(`/addresses/${id}`).then(res => res.data)
};

export default addressService;
