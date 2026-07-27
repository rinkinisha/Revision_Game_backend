/**
 * services/ai/AnalyticsEngine.js
 * Tracks learning metrics and parses AI evaluations.
 */

class AnalyticsEngine {
  /**
   * Processes the raw evaluation output and tracks metrics.
   * @param {Object} evaluation 
   * @param {Object} battle 
   */
  static processBattleAnalytics(evaluation, battle) {
    const accuracy = battle.accuracy || 0;
    const time = battle.avgResponseTimeMs || 0;

    return {
      weakTopicsDetected: evaluation.weakTopics || [],
      nextRevisionDays: evaluation.nextRevisionDays || 3,
      masteryDeltas: evaluation.masteryDeltas || {},
      feedback: evaluation.feedback || "Great job completing the battle!",
      metrics: {
        accuracy,
        avgResponseTimeMs: time,
        completedAt: new Date()
      }
    };
  }
}

module.exports = AnalyticsEngine;
