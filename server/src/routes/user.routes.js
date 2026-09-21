const express = require('express');
const auth = require('../middleware/auth');
const { searchUsers, getUserById, updateMyProfile } = require('../controllers/user.controller');

const router = express.Router();

// All user routes require login (backend authorization, never React-only).
router.use(auth);

// Order matters: /search before /:id so "search" is not treated as an id.
router.get('/search', searchUsers);
router.patch('/profile', updateMyProfile);
router.get('/:id', getUserById);

module.exports = router;
