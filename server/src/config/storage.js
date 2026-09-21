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
  return uploadBuffer(buffer, { resourceType: 'image', timeout: 30000 });
}

// Phase 9B: video upload. resource_type:'video' + longer timeout (large files).
// Returns secure_url/public_id/width/height/duration like the image uploader.
function uploadVideoBuffer(buffer, filename) {
  return uploadBuffer(buffer, { resourceType: 'video', timeout: 120000 });
}

// Phase 9C: voice upload. Cloudinary stores audio under the 'video'
// resource type; voice files are small so 60s is ample.
function uploadAudioBuffer(buffer, filename) {
  return uploadBuffer(buffer, { resourceType: 'video', timeout: 60000 });
}

function uploadBuffer(buffer, { resourceType, timeout }) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: 'chatx', resource_type: resourceType, timeout },
      (err, result) => (err ? reject(err) : resolve(result))
    );
    stream.on('error', reject);
    stream.end(buffer);
  });
}

// Poster thumbnail for a stored video: Cloudinary renders the .jpg delivery
// URL as a still frame — no extra library or eager transformation needed.
function videoThumbnailUrl(publicId) {
  return cloudinary.url(publicId, { resource_type: 'video', format: 'jpg' });
}

// Best-effort orphan cleanup (used when MongoDB persistence fails after upload).
function deleteAsset(publicId, resourceType) {
  return cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
}

module.exports = { cloudinary, isConfigured, uploadImageBuffer, uploadVideoBuffer, uploadAudioBuffer, videoThumbnailUrl, deleteAsset };
