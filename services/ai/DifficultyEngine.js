/**
 * services/ai/DifficultyEngine.js
 * Adaptive difficulty logic.
 */

class DifficultyEngine {
  /**
   * Adjusts the difficulty level of questions based on a user's previous performance.
   * @param {Object} history - The user's past battle or mission results
   * @returns {string} The recommended difficulty: 'easy', 'medium', or 'hard'
   */
  static calculateAdaptiveDifficulty(history) {
    if (!history || !history.recentAccuracy) {
      return 'medium'; // Default
    }

    const { recentAccuracy, streak } = history;

    if (recentAccuracy >= 85 && streak >= 3) {
      return 'hard';
    } else if (recentAccuracy >= 60) {
      return 'medium';
    } else {
      return 'easy';
    }
  }
}

module.exports = DifficultyEngine;
