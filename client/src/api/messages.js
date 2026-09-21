import api from './client.js';

export const listMessages = (conversationId, page = 1, limit = 30) =>
  api.get(`/messages/${conversationId}`, { params: { page, limit } }).then((r) => r.data);
export const sendMessage = (conversationId, content) =>
  api.post('/messages', { conversationId, content }).then((r) => r.data);
// Phase 9A: multipart upload (browser sets the boundary automatically).
export const sendImage = (conversationId, file) => {
  const form = new FormData();
  form.append('conversationId', conversationId);
  form.append('image', file);
  return api.post('/messages/image', form).then((r) => r.data);
};
