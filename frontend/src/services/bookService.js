import api from './api';

export const publicBookService = {
    getBooks: (params) => api.get('/books', { params }).then(res => res.data),
    getBookById: (id) => api.get(`/books/${id}`).then(res => res.data),
    getRelatedBooks: (id, categoryId, limit = 10) => api.get(`/books/${id}/related`, { params: { category_id: categoryId, limit } }).then(res => res.data)
};

export default publicBookService;
