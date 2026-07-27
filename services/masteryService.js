/**
 * services/masteryService.js
 * Updates topic mastery scores based on Mission and Boss Battle results.
 * Uses weighted rolling average to prevent single-attempt volatility.
 */

const Topic = require('../models/Topic');

// ── Constants ─────────────────────────────────────────────────────────────────
const MISSION_WEIGHT = 0.4;   // Mission score contributes 40% to mastery
const BATTLE_WEIGHT  = 0.3;   // Battle accuracy contributes 30% to mastery

/**
 * Update mastery for topics covered by a mission attempt.
 * @param {string} userId
 * @param {Object} attempt - MissionAttempt document
 * @param {Array}  topicIds - Topic IDs the mission covered
 */
async function updateMissionMastery(userId, attempt, topicIds) {
  if (!topicIds || topicIds.length === 0) return;

  const topics = await Topic.find({ _id: { $in: topicIds }, userId });

  await Promise.all(
    topics.map(async (topic) => {
      const current = topic.memoryScore || 0;
      // Weighted blend: preserve existing score, blend in new attempt
      const updated = Math.round(current * (1 - MISSION_WEIGHT) + attempt.totalScore * MISSION_WEIGHT);
      topic.memoryScore = Math.min(100, Math.max(0, updated));
      topic.lastRevisedAt = new Date();
      await topic.save();
    })
  );
}

/**
 * Update mastery for topics based on Boss Battle concept performance.
 * @param {string} userId
 * @param {Object} battleResult - { weakTopics, masteryDeltas }
 * @param {Array}  topicIds
 */
async function updateBattleMastery(userId, battleResult, topicIds) {
  if (!topicIds || topicIds.length === 0) return;

  const topics = await Topic.find({ _id: { $in: topicIds }, userId });

  await Promise.all(
    topics.map(async (topic) => {
      const current = topic.memoryScore || 0;
      // Apply mastery delta from Gemini evaluation (clamped)
      const delta = battleResult.masteryDeltas?.[topic.title] || 0;
      const clampedDelta = Math.max(-10, Math.min(10, delta));
      topic.memoryScore = Math.min(100, Math.max(0, current + clampedDelta));
      topic.lastRevisedAt = new Date();
      await topic.save();
    })
  );
}

/**
 * Calculate next revision date using spaced repetition logic.
 * @param {number} masteryScore - 0-100
 * @returns {Date}
 */
function calculateNextRevisionDate(masteryScore) {
  let daysUntilNext;
  if (masteryScore >= 80)      daysUntilNext = 7;
  else if (masteryScore >= 60) daysUntilNext = 3;
  else if (masteryScore >= 40) daysUntilNext = 1;
  else                          daysUntilNext = 1;

  const date = new Date();
  date.setDate(date.getDate() + daysUntilNext);
  date.setHours(9, 0, 0, 0); // 9 AM
  return date;
}

module.exports = {
  updateMissionMastery,
  updateBattleMastery,
  calculateNextRevisionDate,
};
