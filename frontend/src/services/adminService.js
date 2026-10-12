import api from './api';

export const categoryService = {
    getAll: () => api.get('/admin/categories').then(res => res.data),
    create: (data) => api.post('/admin/categories', data).then(res => res.data),
    update: (id, data) => api.put(`/admin/categories/${id}`, data).then(res => res.data),
    delete: (id) => api.delete(`/admin/categories/${id}`).then(res => res.data)
};

export const authorService = {
    getAll: () => api.get('/admin/authors').then(res => res.data),
    create: (data) => api.post('/admin/authors', data).then(res => res.data),
    update: (id, data) => api.put(`/admin/authors/${id}`, data).then(res => res.data),
    delete: (id) => api.delete(`/admin/authors/${id}`).then(res => res.data)
};

export const publisherService = {
    getAll: () => api.get('/admin/publishers').then(res => res.data),
    create: (data) => api.post('/admin/publishers', data).then(res => res.data),
    update: (id, data) => api.put(`/admin/publishers/${id}`, data).then(res => res.data),
    delete: (id) => api.delete(`/admin/publishers/${id}`).then(res => res.data)
};

export const bookService = {
    getAll: (params) => api.get('/admin/books', { params }).then(res => res.data),
    getById: (id) => api.get(`/admin/books/${id}`).then(res => res.data),
    create: (data) => api.post('/admin/books', data).then(res => res.data),
    update: (id, data) => api.put(`/admin/books/${id}`, data).then(res => res.data),
    toggleActive: (id, is_active) => api.patch(`/admin/books/${id}/toggle-active`, { is_active }).then(res => res.data),
    delete: (id) => api.delete(`/admin/books/${id}`).then(res => res.data),
    uploadImage: (file) => {
        const formData = new FormData();
        formData.append('image', file);
        return api.post('/admin/books/upload-image', formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
        }).then(res => res.data);
    }
};
