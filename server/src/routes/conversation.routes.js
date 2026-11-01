const express = require('express');
const { body } = require('express-validator');
const auth = require('../middleware/auth');
const requireParticipant = require('../middleware/requireParticipant');
const { create, list, getById, setLanguageOverride } = require('../controllers/conversation.controller');

const router = express.Router();
router.use(auth);

function validate(req, res, next) {
  const { validationResult } = require('express-validator');
  const errors = validationResult(req);
  if (errors.isEmpty()) return next();
  return res.status(400).json({ message: errors.array()[0].msg });
}

router.post(
  '/',
  body('userId').notEmpty().withMessage('userId is required.').isMongoId().withMessage('Invalid user id.'),
  validate,
  create
);
router.get('/', list);
router.get('/:id', requireParticipant, getById);
router.patch('/:id/language', requireParticipant, setLanguageOverride);

module.exports = router;
