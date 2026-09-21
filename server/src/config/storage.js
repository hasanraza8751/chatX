const cloudinary = require('cloudinary').v2;

// Phase 9A: Cloudinary object storage for images (approved architecture).
// Credentials live ONLY in server/.env — never in frontend code.
// When absent, the server still boots; uploads return 503 (see controller).
const configured = !!(
  process.env.CLOUDINARY_CLOUD_NAME &&
  process.env.CLOUDINARY_API_KEY &&
  process.env.CLOUDINARY_API_SECRET
);

if (configured) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
}

function isConfigured() {
  return configured;
}

// Buffer -> Cloudinary. resource_type:'image' makes Cloudinary itself reject
// non-images as a second server-side gate (after our MIME + magic-byte checks).
function uploadImageBuffer(buffer, filename) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: 'chatx', resource_type: 'image', timeout: 30000 },
      (err, result) => (err ? reject(err) : resolve(result))
    );
    stream.on('error', reject);
    stream.end(buffer);
  });
}

module.exports = { cloudinary, isConfigured, uploadImageBuffer };
