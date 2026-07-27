/**
 * services/ai/index.js
 * Exposes the modular AI engine services.
 */

const QuestionGenerator = require('./QuestionGenerator');
const EvaluationEngine = require('./EvaluationEngine');
const AnalyticsEngine = require('./AnalyticsEngine');
const DifficultyEngine = require('./DifficultyEngine');

module.exports = {
  QuestionGenerator,
  EvaluationEngine,
  AnalyticsEngine,
  DifficultyEngine
};
