import api from './api';

export const publicCategoryService = {
    getCategories: () => api.get('/categories').then(res => res.data)
};

export default publicCategoryService;
