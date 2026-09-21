const express = require('express');
const { body } = require('express-validator');
const auth = require('../middleware/auth');
const requireParticipant = require('../middleware/requireParticipant');
const { uploadSingleImage } = require('../middleware/uploadImage');
const { uploadSingleVideo } = require('../middleware/uploadVideo');
const { uploadSingleVoice } = require('../middleware/uploadVoice');
const { list, send, sendImage, sendVideo, sendVoice } = require('../controllers/message.controller');

const router = express.Router();
router.use(auth);

function validate(req, res, next) {
  const { validationResult } = require('express-validator');
  const errors = validationResult(req);
  if (errors.isEmpty()) return next();
  return res.status(400).json({ message: errors.array()[0].msg });
}

// requireParticipant reads the id from params (GET) or body (POST)
// and rejects invalid ids / non-participants before any DB read/write.
router.get('/:conversationId', requireParticipant, list);
router.post(
  '/',
  body('conversationId').notEmpty().withMessage('conversationId is required.').isMongoId().withMessage('Invalid conversation id.'),
  body('content').notEmpty().withMessage('Message content is required.').isLength({ max: 2000 }).withMessage('Message is too long (max 2000).'),
  validate,
  requireParticipant,
  send
);

// Phase 9A: image upload. Multer FIRST (parses multipart into req.body/req.file),
// then participant check, then magic-byte + storage validation in the controller.
// NOTE: '/image' must be registered before '/:conversationId' GET? No conflict:
// this is POST /image vs GET /:conversationId (different methods), order is safe.
router.post('/image', uploadSingleImage, requireParticipant, sendImage);

// Phase 9B: video upload. Same chain with video gates.
// (POST /video vs GET /:conversationId: different methods, no route conflict.)
router.post('/video', uploadSingleVideo, requireParticipant, sendVideo);

// Phase 9C: voice upload. Same chain with voice gates; field name is 'voice'
// plus an optional durationMs text field (multipart body parsed by multer).
router.post('/voice', uploadSingleVoice, requireParticipant, sendVoice);

module.exports = router;
