import api from './api';

export const userService = {
    getMe: () => api.get('/auth/me').then(res => res.data),
    updateProfile: (payload) => api.put('/auth/profile', payload).then(res => res.data),
    changePassword: (payload) => api.put('/auth/password', payload).then(res => res.data)
};

export default userService;
