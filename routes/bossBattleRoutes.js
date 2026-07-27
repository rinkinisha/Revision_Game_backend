/**
 * routes/bossBattleRoutes.js
 * Stage 6 – Boss Battle API routes.
 * All routes require JWT authentication.
 */

const express = require('express');
const rateLimit = require('express-rate-limit');
const { protect } = require('../middleware/authMiddleware');
const {
  generateBossBattle,
  startBossBattle,
  submitAnswer,
  submitBossBattle,
  getBattleHistory,
  getBossBattle,
} = require('../controllers/bossBattleController');

const router = express.Router();

// Rate limit generation endpoint (5 per minute — heavier Gemini call)
const battleGenLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  message: { success: false, message: 'Too many battle generation requests.' },
  standardHeaders: true,
  legacyHeaders: false,
  validate: false,
});

router.use(protect);

router.get('/history',         getBattleHistory);
router.get('/:id',             getBossBattle);
router.post('/generate',       battleGenLimiter, generateBossBattle);
router.put('/:id/start',       startBossBattle);
router.post('/:id/answer',     submitAnswer);
router.post('/:id/submit',     submitBossBattle);

module.exports = router;
