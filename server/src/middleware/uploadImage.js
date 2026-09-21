const multer = require('multer');
const AppError = require('../utils/AppError');

// Phase 9A: first upload gates — memory buffer (never disk/binary in MongoDB),
// 10 MB hard cap, browser-MIME allowlist (magic bytes verified later in controller).
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const ALLOWED_IMAGE_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_IMAGE_BYTES, files: 1 },
  fileFilter: (req, file, cb) => {
    if (ALLOWED_IMAGE_MIME.has(file.mimetype)) return cb(null, true);
    return cb(new AppError('Unsupported image type. Allowed: JPEG, PNG, WebP, GIF.', 400));
  },
});

// Converts multer errors (e.g. oversize) into friendly JSON instead of crashes.
function uploadSingleImage(req, res, next) {
  upload.single('image')(req, res, (err) => {
    if (!err) return next();
    if (err.code === 'LIMIT_FILE_SIZE') {
      return next(new AppError('Image must be 10 MB or smaller.', 413));
    }
    if (err.code === 'LIMIT_UNEXPECTED_FILE') {
      return next(new AppError('Upload a single image file.', 400));
    }
    return next(err instanceof AppError ? err : new AppError('Image upload failed.', 400));
  });
}

module.exports = { uploadSingleImage, MAX_IMAGE_BYTES, ALLOWED_IMAGE_MIME };
