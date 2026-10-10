import api from './api';

const authService = {
    async register(data) {
        const response = await api.post('/auth/register', data);
        return response.data;
    },
    async login(data) {
        const response = await api.post('/auth/login', data);
        return response.data;
    },
    async adminLogin(data) {
        const response = await api.post('/auth/admin/login', data);
        return response.data;
    }
};

export default authService;
