import api from './api'

export const siteConfigService = {
  get: () => api.get('/admin/site-config').then((res) => res.data),
  save: (data) => api.put('/admin/site-config', data).then((res) => res.data),
  preview: (data) => api.post('/admin/site-config/preview', data).then((res) => res.data),
  getSpotlight: () => api.get('/site-config/spotlight').then((res) => res.data),
  uploadBanner: (file) => {
    const data = new FormData()
    data.append('image', file)
    return api.post('/admin/site-config/upload-banner', data).then((res) => res.data)
  },
}
