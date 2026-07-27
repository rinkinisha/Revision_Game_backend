/**
 * routes/revisionRoutes.js – Revision tracking endpoints
 */
const express = require('express');
const router = express.Router();
const {
  getRevisions,
  getDueRevisions,
  completeRevision,
  getSessionHistory,
} = require('../controllers/revisionController');
const { protect } = require('../middleware/authMiddleware');

// All routes are protected
router.use(protect);

router.get('/', getRevisions);
router.get('/due', getDueRevisions);
router.get('/sessions', getSessionHistory);
router.put('/:id/complete', completeRevision);

module.exports = router;
