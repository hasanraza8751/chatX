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
// Phase 9B: video upload with progress (axios onUploadProgress needs no
// architecture change) and a longer timeout for large files.
export const sendVideo = (conversationId, file, onProgress) => {
  const form = new FormData();
  form.append('conversationId', conversationId);
  form.append('video', file);
  return api
    .post('/messages/video', form, {
      timeout: 180000,
      onUploadProgress: (e) => {
        if (onProgress && e.total) onProgress(Math.round((e.loaded * 100) / e.total));
      },
    })
    .then((r) => r.data);
};
// Phase 9C: voice upload. Small files (2-minute cap), no progress bar needed.
export const sendVoice = (conversationId, { blob, filename, mimeType, durationMs }) => {
  const form = new FormData();
  form.append('conversationId', conversationId);
  form.append('voice', blob, filename);
  form.append('durationMs', String(durationMs));
  form.append('mimeType', mimeType);
  return api.post('/messages/voice', form, { timeout: 120000 }).then((r) => r.data);
};
