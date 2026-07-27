/**
 * routes/topicRoutes.js – Topic CRUD endpoints
 */
const express = require('express');
const router = express.Router();
const {
  getTopics,
  getTopic,
  createTopic,
  updateTopic,
  deleteTopic,
} = require('../controllers/topicController');
const { protect } = require('../middleware/authMiddleware');

// All routes are protected
router.use(protect);

router.route('/').get(getTopics).post(createTopic);
router.route('/:id').get(getTopic).put(updateTopic).delete(deleteTopic);

module.exports = router;
