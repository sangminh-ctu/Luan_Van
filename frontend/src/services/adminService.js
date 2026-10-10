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
