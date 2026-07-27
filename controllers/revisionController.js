/**
 * controllers/revisionController.js
 * Manages revision retrieval, completion, and session recording.
 */

const asyncHandler = require('express-async-handler');
const Revision = require('../models/Revision');
const Topic = require('../models/Topic');
const RevisionSession = require('../models/RevisionSession');
const User = require('../models/User');

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Get all revisions for the user (with filters)
// @route   GET /api/revisions
// @access  Private
// ─────────────────────────────────────────────────────────────────────────────
const getRevisions = asyncHandler(async (req, res) => {
  const { status, topicId } = req.query;

  const filter = { userId: req.user._id };
  if (status) filter.status = status;
  if (topicId) filter.topicId = topicId;

  const revisions = await Revision.find(filter)
    .populate('topicId', 'title tags subject difficulty memoryScore')
    .sort('scheduledDate');

  res.json({
    success: true,
    count: revisions.length,
    data: revisions,
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Get revisions due today + overdue
// @route   GET /api/revisions/due
// @access  Private
// ─────────────────────────────────────────────────────────────────────────────
const getDueRevisions = asyncHandler(async (req, res) => {
  const today = new Date();
  today.setHours(23, 59, 59, 999); // End of today

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  // Due today: scheduled today and still pending
  const dueToday = await Revision.find({
    userId: req.user._id,
    scheduledDate: { $gte: startOfToday, $lte: today },
    status: 'pending',
  }).populate('topicId', 'title tags subject difficulty memoryScore');

  // Overdue: scheduled before today and still pending
  const overdue = await Revision.find({
    userId: req.user._id,
    scheduledDate: { $lt: startOfToday },
    status: 'pending',
  }).populate('topicId', 'title tags subject difficulty memoryScore');

  // Update overdue status in DB (background update)
  if (overdue.length > 0) {
    const overdueIds = overdue.map((r) => r._id);
    await Revision.updateMany(
      { _id: { $in: overdueIds } },
      { $set: { status: 'overdue' } }
    );
  }

  res.json({
    success: true,
    data: {
      dueToday,
      overdue,
      totalDue: dueToday.length + overdue.length,
    },
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Mark a revision as complete + update topic stats
// @route   PUT /api/revisions/:id/complete
// @access  Private
// ─────────────────────────────────────────────────────────────────────────────
const completeRevision = asyncHandler(async (req, res) => {
  const { score, confidenceLevel, notes, selfAssessment } = req.body;

  const revision = await Revision.findOne({
    _id: req.params.id,
    userId: req.user._id,
  });

  if (!revision) {
    res.status(404);
    throw new Error('Revision not found');
  }

  if (revision.status === 'completed') {
    res.status(400);
    throw new Error('Revision already completed');
  }

  // Mark revision as completed
  revision.status = 'completed';
  revision.completedDate = new Date();
  revision.score = score !== undefined ? score : 80;
  revision.confidenceLevel = confidenceLevel || 'medium';
  revision.notes = notes || '';
  await revision.save();

  // Update topic stats
  const topic = await Topic.findById(revision.topicId);
  if (topic) {
    topic.revisionCount += 1;
    topic.lastRevisedAt = new Date();

    // Recalculate memory score (average of all completed revision scores)
    const completedRevisions = await Revision.find({
      topicId: topic._id,
      status: 'completed',
    });

    if (completedRevisions.length > 0) {
      const avgScore =
        completedRevisions.reduce((sum, r) => sum + (r.score || 0), 0) /
        completedRevisions.length;
      topic.memoryScore = Math.round(avgScore);
    }

    await topic.save();
  }

  // Create a revision session record
  const session = await RevisionSession.create({
    userId: req.user._id,
    topicId: revision.topicId,
    revisionId: revision._id,
    startTime: new Date(),
    endTime: new Date(),
    score: revision.score,
    confidenceLevel: revision.confidenceLevel,
    selfAssessment: selfAssessment || null,
    notesAdded: notes || '',
  });

  // Update user streak
  const user = await User.findById(req.user._id);
  user.updateStreak();
  await user.save();

  res.json({
    success: true,
    message: 'Revision completed! Great work! 🎉',
    data: { revision, session, updatedStreak: user.revisionStreak },
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Get revision session history
// @route   GET /api/revisions/sessions
// @access  Private
// ─────────────────────────────────────────────────────────────────────────────
const getSessionHistory = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20 } = req.query;
  const skip = (page - 1) * limit;

  const sessions = await RevisionSession.find({ userId: req.user._id })
    .populate('topicId', 'title subject tags')
    .sort('-createdAt')
    .skip(skip)
    .limit(parseInt(limit));

  const total = await RevisionSession.countDocuments({ userId: req.user._id });

  res.json({
    success: true,
    count: sessions.length,
    total,
    page: parseInt(page),
    pages: Math.ceil(total / limit),
    data: sessions,
  });
});

module.exports = { getRevisions, getDueRevisions, completeRevision, getSessionHistory };
