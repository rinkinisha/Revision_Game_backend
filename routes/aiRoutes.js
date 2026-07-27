/**
 * routes/aiRoutes.js – AI Revision Coach routes
 */
const express = require('express');
const router = express.Router();
const {
  chatWithCoach,
  completeAISession,
  generateRevisionQuestion,
  evaluateRevisionAnswer,
} = require('../controllers/aiController');
const { protect } = require('../middleware/authMiddleware');

// All routes are protected
router.use(protect);

router.post('/chat', chatWithCoach);
router.post('/complete', completeAISession);
router.post('/generate', generateRevisionQuestion);
router.post('/evaluate', evaluateRevisionAnswer);

module.exports = router;
