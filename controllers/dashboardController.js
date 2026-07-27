/**
 * controllers/dashboardController.js
 * Aggregates stats for the Dashboard: totals, memory health, weak topics, streak.
 */

const asyncHandler = require('express-async-handler');
const Topic = require('../models/Topic');
const Revision = require('../models/Revision');
const RevisionSession = require('../models/RevisionSession');

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Get comprehensive dashboard stats for logged-in user
// @route   GET /api/dashboard/stats
// @access  Private
// ─────────────────────────────────────────────────────────────────────────────
const getDashboardStats = asyncHandler(async (req, res) => {
  const userId = req.user._id;

  // ── Date helpers ────────────────────────────────────────────────────────────
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const endOfToday = new Date();
  endOfToday.setHours(23, 59, 59, 999);

  // ── Run all queries in parallel ─────────────────────────────────────────────
  const [
    totalTopics,
    archivedTopics,
    dueTodayCount,
    overdueCount,
    completedTotal,
    totalRevisions,
    weakTopics,
    recentSessions,
    upcomingRevisions,
  ] = await Promise.all([
    // 1. Total active topics
    Topic.countDocuments({ userId, isArchived: false }),

    // 2. Archived topics
    Topic.countDocuments({ userId, isArchived: true }),

    // 3. Due today (pending and scheduled for today)
    Revision.countDocuments({
      userId,
      scheduledDate: { $gte: startOfToday, $lte: endOfToday },
      status: 'pending',
    }),

    // 4. Overdue (pending and scheduled before today)
    Revision.countDocuments({
      userId,
      scheduledDate: { $lt: startOfToday },
      status: { $in: ['pending', 'overdue'] },
    }),

    // 5. Total completed revisions
    Revision.countDocuments({ userId, status: 'completed' }),

    // 6. Total revision slots created
    Revision.countDocuments({ userId }),

    // 7. Weak topics (memoryScore < 60)
    Topic.find({ userId, isArchived: false, memoryScore: { $lt: 60 } })
      .select('title memoryScore revisionCount tags difficulty lastRevisedAt')
      .sort('memoryScore')
      .limit(5),

    // 8. Recent 7 sessions for activity chart
    RevisionSession.find({ userId })
      .populate('topicId', 'title')
      .sort('-createdAt')
      .limit(7),

    // 9. Upcoming revisions (next 7 days)
    Revision.find({
      userId,
      scheduledDate: { $gt: endOfToday, $lte: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) },
      status: 'pending',
    })
      .populate('topicId', 'title subject')
      .sort('scheduledDate')
      .limit(10),
  ]);

  // ── Memory Health % Calculation ─────────────────────────────────────────────
  // = (completed revisions / total scheduled) × 100
  const memoryHealth =
    totalRevisions > 0
      ? Math.round((completedTotal / totalRevisions) * 100)
      : 0;

  // ── Today's activity for streak ─────────────────────────────────────────────
  const completedToday = await Revision.countDocuments({
    userId,
    completedDate: { $gte: startOfToday, $lte: endOfToday },
    status: 'completed',
  });

  // ── Tag frequency map from weak topics + all topics ─────────────────────────
  const allTopics = await Topic.find({ userId, isArchived: false }).select('tags');
  const tagFrequency = {};
  allTopics.forEach((t) => {
    t.tags.forEach((tag) => {
      tagFrequency[tag] = (tagFrequency[tag] || 0) + 1;
    });
  });
  const topTags = Object.entries(tagFrequency)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([tag, count]) => ({ tag, count }));

  res.json({
    success: true,
    data: {
      // Core stats
      totalTopics,
      archivedTopics,
      dueTodayCount,
      overdueCount,
      completedTotal,
      totalRevisions,
      memoryHealth,
      completedToday,

      // Streak (from user object attached by middleware)
      revisionStreak: req.user.revisionStreak,
      longestStreak: req.user.longestStreak,

      // Lists
      weakTopics,
      recentSessions,
      upcomingRevisions,
      topTags,
    },
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Get activity heatmap data (last 90 days)
// @route   GET /api/dashboard/activity
// @access  Private
// ─────────────────────────────────────────────────────────────────────────────
const getActivityData = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

  const sessions = await RevisionSession.find({
    userId,
    createdAt: { $gte: ninetyDaysAgo },
  }).select('createdAt score');

  // Group by date
  const activityMap = {};
  sessions.forEach((session) => {
    const dateKey = session.createdAt.toISOString().split('T')[0];
    activityMap[dateKey] = (activityMap[dateKey] || 0) + 1;
  });

  res.json({
    success: true,
    data: activityMap,
  });
});

module.exports = { getDashboardStats, getActivityData };
