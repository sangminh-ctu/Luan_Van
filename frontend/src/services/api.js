import axios from 'axios';
import router from '@/router';

const api = axios.create({
    baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api',
});

api.interceptors.request.use((config) => {
    const token = localStorage.getItem('token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response && error.response.status === 401) {
            const url = error.config.url;
            if (!url.includes('/auth/login') && !url.includes('/auth/admin/login') && !url.includes('/auth/register')) {
                const userStr = localStorage.getItem('user');
                let isAdmin = false;
                if (userStr) {
                    try {
                        const user = JSON.parse(userStr);
                        isAdmin = user.role === 'admin';
                    } catch (e) { console.warn(e) }
                }
                localStorage.removeItem('token');
                localStorage.removeItem('user');
                
                if (isAdmin) {
                    router.push('/admin/login');
                } else {
                    router.push('/login');
                }
            }
        }
        return Promise.reject(error);
    }
);

export default api;
