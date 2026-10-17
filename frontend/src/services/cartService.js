import api from './api';

export const cartService = {
    getCart: () => api.get('/cart').then(res => res.data),
    addToCart: (bookId, quantity = 1) => api.post('/cart', { book_id: bookId, quantity }).then(res => res.data),
    updateQuantity: (bookId, quantity) => api.put(`/cart/${bookId}`, { quantity }).then(res => res.data),
    removeItem: (bookId) => api.delete(`/cart/${bookId}`).then(res => res.data),
    clearCart: (bookIds) => api.delete('/cart', {
        data: Array.isArray(bookIds) && bookIds.length > 0 ? { book_ids: bookIds } : undefined
    }).then(res => res.data)
};

export default cartService;
