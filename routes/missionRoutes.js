/**
 * routes/missionRoutes.js
 * Stage 5 – Mission Challenge API routes.
 * All routes require JWT authentication.
 */

const express = require('express');
const rateLimit = require('express-rate-limit');
const { protect } = require('../middleware/authMiddleware');
const {
  generateMission,
  startMission,
  saveDraftCode,
  submitMission,
  getMissionHistory,
  getMission,
  listMissions,
} = require('../controllers/missionController');

const router = express.Router();

// Rate limit AI-heavy endpoints (10 per minute per IP)
const aiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: { success: false, message: 'Too many AI requests, please slow down.' },
  standardHeaders: true,
  legacyHeaders: false,
  validate: false,
});

router.use(protect); // All mission routes require auth

router.get('/',              listMissions);
router.get('/history',       getMissionHistory);
router.get('/:id',           getMission);
router.post('/generate',     aiLimiter, generateMission);
router.put('/:id/start',     startMission);
router.put('/:id/save',      saveDraftCode);
router.post('/:id/submit',   aiLimiter, submitMission);

module.exports = router;
