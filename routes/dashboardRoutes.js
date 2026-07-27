/**
 * routes/dashboardRoutes.js – Dashboard stats endpoints
 */
const express = require('express');
const router = express.Router();
const { getDashboardStats, getActivityData } = require('../controllers/dashboardController');
const { protect } = require('../middleware/authMiddleware');

router.use(protect);

router.get('/stats', getDashboardStats);
router.get('/activity', getActivityData);

module.exports = router;
