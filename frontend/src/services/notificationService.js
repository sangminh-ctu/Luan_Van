import api from './api';

export const notificationService = {
  async list(params) {
    return (await api.get('/notifications', { params })).data;
  },
  async markAllRead(through) {
    await api.patch('/notifications/read', { through });
  },
  async markRead(id) {
    await api.patch(`/notifications/${id}/read`);
  },
};
