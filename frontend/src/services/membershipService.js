import api from './api'
export const membershipService = {
  get: () => api.get('/membership').then((r) => r.data),
  list: () => api.get('/admin/membership-tiers').then((r) => r.data),
  save: (tiers) => api.put('/admin/membership-tiers', { tiers }).then((r) => r.data),
}
