import api from './client.js';

// Isolated translation API surface. Backend owns detection, provider calls,
// caching and membership checks; the original message is never modified.
export const translateMessage = (messageId, targetLanguage) =>
  api.post('/translation/translate', { messageId, targetLanguage }).then((r) => r.data);
