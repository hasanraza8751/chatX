const multer = require('multer');
const AppError = require('../utils/AppError');

// Phase 9B: video gates mirror the image uploader (memory buffer, MIME allowlist,
// friendly errors) with video-appropriate limits: 50 MB fits Cloudinary
// signed-upload limits, bounds RAM under memoryStorage, and keeps mobile
// upload times sane. (uploadImage.js is intentionally left untouched.)
const MAX_VIDEO_BYTES = 50 * 1024 * 1024;
const ALLOWED_VIDEO_MIME = new Set(['video/mp4', 'video/webm', 'video/quicktime']);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_VIDEO_BYTES, files: 1 },
  fileFilter: (req, file, cb) => {
    if (ALLOWED_VIDEO_MIME.has(file.mimetype)) return cb(null, true);
    return cb(new AppError('Unsupported video type. Allowed: MP4, WebM, QuickTime.', 400));
  },
});

function uploadSingleVideo(req, res, next) {
  upload.single('video')(req, res, (err) => {
    if (!err) return next();
    if (err.code === 'LIMIT_FILE_SIZE') {
      return next(new AppError('Video must be 50 MB or smaller.', 413));
    }
    if (err.code === 'LIMIT_UNEXPECTED_FILE') {
      return next(new AppError('Upload a single video file.', 400));
    }
    return next(err instanceof AppError ? err : new AppError('Video upload failed.', 400));
  });
}

module.exports = { uploadSingleVideo, MAX_VIDEO_BYTES, ALLOWED_VIDEO_MIME };
