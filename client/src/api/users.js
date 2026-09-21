import api from './client.js';

export const searchUsers = (q) =>
  api.get('/users/search', { params: { q } }).then((r) => r.data);
export const getUser = (id) => api.get(`/users/${id}`).then((r) => r.data);
export const updateMyProfile = (payload) =>
  api.patch('/users/profile', payload).then((r) => r.data);
