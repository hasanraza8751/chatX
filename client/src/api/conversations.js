import api from './client.js';

export const listConversations = () => api.get('/conversations').then((r) => r.data);
export const createConversation = (userId) =>
  api.post('/conversations', { userId }).then((r) => r.data);
export const getConversation = (id) => api.get(`/conversations/${id}`).then((r) => r.data);
// Per-conversation translation target override for ME (null clears it).
export const setConversationLanguage = (id, targetLanguage) =>
  api.patch(`/conversations/${id}/language`, { targetLanguage }).then((r) => r.data);
