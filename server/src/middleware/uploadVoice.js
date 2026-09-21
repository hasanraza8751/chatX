const multer = require('multer');
const AppError = require('../utils/AppError');

// Phase 9C: voice gates mirror image/video (memory buffer, friendly errors).
// 10 MB is generous for a 2-minute voice note in any recorder codec
// (Opus ≈ 0.5 MB, AAC ≈ 2 MB) yet bounded for RAM. Independent of the
// frontend's 2-minute duration cap. (uploadImage/Video left untouched.)
// NOTE: file-type reports WebM audio as video/webm, MP4 audio as
// video/mp4 or audio/mp4, and Ogg Opus as audio/opus — all container
// variants are accepted here; the sniffed (truthful) MIME is what gets stored.
const MAX_VOICE_BYTES = 10 * 1024 * 1024;
const ALLOWED_VOICE_MIME = new Set([
  'audio/webm',
  'video/webm',
  'audio/mp4',
  'video/mp4',
  'audio/ogg',
  'audio/opus',
]);

// Browser Blobs may carry codec parameters (audio/webm;codecs=opus);
// busboy can pass those through, so normalize before the allowlist check.
function baseMime(mimetype) {
  return String(mimetype || '').split(';')[0].trim().toLowerCase();
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_VOICE_BYTES, files: 1 },
  fileFilter: (req, file, cb) => {
    if (ALLOWED_VOICE_MIME.has(baseMime(file.mimetype))) return cb(null, true);
    return cb(new AppError('Unsupported audio type. Send a recorded voice message.', 400));
  },
});

function uploadSingleVoice(req, res, next) {
  upload.single('voice')(req, res, (err) => {
    if (!err) return next();
    if (err.code === 'LIMIT_FILE_SIZE') {
      return next(new AppError('Voice message must be 10 MB or smaller.', 413));
    }
    if (err.code === 'LIMIT_UNEXPECTED_FILE') {
      return next(new AppError('Upload a single voice recording.', 400));
    }
    return next(err instanceof AppError ? err : new AppError('Voice upload failed.', 400));
  });
}

module.exports = { uploadSingleVoice, MAX_VOICE_BYTES, ALLOWED_VOICE_MIME, baseMime };
