import api from './client.js';

// Thin wrappers. Cookie is sent automatically (withCredentials).
// Responses contain { user } only — never a JWT.
export const register = (payload) => api.post('/auth/register', payload).then((r) => r.data);
export const login = (payload) => api.post('/auth/login', payload).then((r) => r.data);
export const fetchMe = () => api.get('/auth/me').then((r) => r.data);
export const logout = () => api.post('/auth/logout').then((r) => r.data);
