import api from './api';

export const cartService = {
    getCart: () => api.get('/cart').then(res => res.data),
    addToCart: (bookId, quantity = 1) => api.post('/cart', { book_id: bookId, quantity }).then(res => res.data),
    updateQuantity: (bookId, quantity) => api.put(`/cart/${bookId}`, { quantity }).then(res => res.data),
    removeItem: (bookId) => api.delete(`/cart/${bookId}`).then(res => res.data),
    clearCart: () => api.delete('/cart').then(res => res.data)
};

export default cartService;
