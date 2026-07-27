/**
 * controllers/bossBattleController.js
 * Handles Stage 6 – Boss Battle generation, answer recording, and evaluation.
 */

const asyncHandler   = require('express-async-handler');
const BossBattle     = require('../models/BossBattle');
const { QuestionGenerator, EvaluationEngine, AnalyticsEngine } = require('../services/ai');
const masteryService = require('../services/masteryService');

// XP multipliers for combos
const COMBO_THRESHOLDS = [
  { minStreak: 5, multiplier: 2.0, label: '2×' },
  { minStreak: 3, multiplier: 1.5, label: '1.5×' },
  { minStreak: 2, multiplier: 1.2, label: '1.2×' },
];

function getComboMultiplier(streak) {
  for (const t of COMBO_THRESHOLDS) {
    if (streak >= t.minStreak) return t.multiplier;
  }
  return 1;
}

// ── POST /api/boss-battle/generate ───────────────────────────────────────────
// Generate a new Boss Battle from Gemini
const generateBossBattle = asyncHandler(async (req, res) => {
  const { phase, weakConcepts, strongConcepts, topicIds } = req.body;

  if (!phase || !weakConcepts?.length || !strongConcepts?.length) {
    res.status(400);
    throw new Error('phase, weakConcepts, and strongConcepts are required.');
  }

  const questions = await QuestionGenerator.generateBossBattleQuestions({
    phase,
    weakConcepts,
    strongConcepts,
  });

  const battle = await BossBattle.create({
    userId: req.user._id,
    topicIds: topicIds || [],
    studentPhase:   phase,
    weakConcepts,
    strongConcepts,
    questions,
    status: 'generated',
  });

  res.status(201).json({ success: true, data: battle });
});

// ── PUT /api/boss-battle/:id/start ───────────────────────────────────────────
// Mark battle as active and record start time
const startBossBattle = asyncHandler(async (req, res) => {
  const battle = await BossBattle.findOne({ _id: req.params.id, userId: req.user._id });
  if (!battle) {
    res.status(404);
    throw new Error('Battle not found.');
  }
  if (battle.status === 'completed') {
    res.status(400);
    throw new Error('This battle is already completed.');
  }

  battle.status    = 'active';
  battle.startedAt = new Date();
  await battle.save();

  res.json({ success: true, data: battle });
});

// ── POST /api/boss-battle/:id/answer ─────────────────────────────────────────
// Record a single answer and return XP earned + whether correct
const submitAnswer = asyncHandler(async (req, res) => {
  const { questionIndex, userAnswer, responseTimeMs } = req.body;

  if (questionIndex === undefined || userAnswer === undefined) {
    res.status(400);
    throw new Error('questionIndex and userAnswer are required.');
  }

  const battle = await BossBattle.findOne({ _id: req.params.id, userId: req.user._id });
  if (!battle) {
    res.status(404);
    throw new Error('Battle not found.');
  }
  if (battle.status !== 'active') {
    res.status(400);
    throw new Error('Battle is not currently active.');
  }

  // Prevent double-answering the same question
  if (battle.answers.some((a) => a.questionIndex === questionIndex)) {
    res.status(400);
    throw new Error('This question has already been answered.');
  }

  const question = battle.questions[questionIndex];
  if (!question) {
    res.status(404);
    throw new Error('Question not found.');
  }

  // Evaluate correctness (case-insensitive trim)
  const isCorrect = userAnswer.trim().toLowerCase() ===
                    question.correctAnswer.trim().toLowerCase();

  // Calculate streak and combo
  const recentAnswers = [...battle.answers].sort((a, b) => a.questionIndex - b.questionIndex);
  let currentStreak = 0;
  for (let i = recentAnswers.length - 1; i >= 0; i--) {
    if (recentAnswers[i].isCorrect) currentStreak++;
    else break;
  }
  if (isCorrect) currentStreak++;

  const comboMultiplier = getComboMultiplier(currentStreak);
  const comboActive     = comboMultiplier > 1;
  const xpEarned        = isCorrect ? Math.round(question.xpValue * comboMultiplier) : 0;

  battle.answers.push({
    questionIndex,
    userAnswer,
    isCorrect,
    responseTimeMs: responseTimeMs || 0,
    xpEarned,
    comboActive,
    skipped: false,
  });

  battle.totalXp   = battle.answers.reduce((sum, a) => sum + a.xpEarned, 0);
  battle.maxCombo  = Math.max(battle.maxCombo, currentStreak);
  battle.currentQuestion = questionIndex + 1;
  await battle.save();

  res.json({
    success: true,
    data: {
      isCorrect,
      xpEarned,
      comboActive,
      comboMultiplier,
      currentStreak,
      correctAnswer: question.correctAnswer,
      explanation:   question.explanation,
      totalXp: battle.totalXp,
    },
  });
});

// ── POST /api/boss-battle/:id/submit ─────────────────────────────────────────
// Finalize battle, run Gemini evaluation, update mastery
const submitBossBattle = asyncHandler(async (req, res) => {
  const battle = await BossBattle.findOne({ _id: req.params.id, userId: req.user._id });
  if (!battle) {
    res.status(404);
    throw new Error('Battle not found.');
  }
  if (battle.status === 'completed') {
    return res.json({ success: true, data: battle }); // Idempotent
  }

  const totalAnswered   = battle.answers.length;
  const correctAnswers  = battle.answers.filter((a) => a.isCorrect).length;
  const accuracy        = totalAnswered > 0 ? (correctAnswers / totalAnswered) * 100 : 0;
  const avgResponseTime = totalAnswered > 0
    ? battle.answers.reduce((sum, a) => sum + a.responseTimeMs, 0) / totalAnswered
    : 0;

  battle.accuracy          = Math.round(accuracy * 10) / 10;
  battle.avgResponseTimeMs = Math.round(avgResponseTime);
  battle.correctCount      = correctAnswers;
  battle.completedAt       = new Date();
  battle.status            = 'completed';

  // Gemini evaluation for weak topic detection + mastery deltas
  try {
    const rawEvaluation = await EvaluationEngine.evaluateBossBattle({
      questions: battle.questions,
      answers:   battle.answers,
      accuracy:  battle.accuracy,
      avgResponseTimeMs: battle.avgResponseTimeMs
    });

    const analytics = AnalyticsEngine.processBattleAnalytics(rawEvaluation, battle);

    battle.weakTopicsDetected = analytics.weakTopicsDetected;
    battle.nextRevisionDate   = masteryService.calculateNextRevisionDate(battle.accuracy);

    // Update topic mastery
    masteryService
      .updateBattleMastery(req.user._id, analytics, battle.topicIds)
      .catch((err) => console.error('Battle mastery update failed:', err.message));

    battle._evaluationFeedback = analytics.feedback; // Transient – added to response

  } catch (err) {
    console.error('Battle evaluation failed:', err.message);
    battle.nextRevisionDate = masteryService.calculateNextRevisionDate(battle.accuracy);
  }

  await battle.save();

  res.json({ success: true, data: battle });
});

// ── GET /api/boss-battle/history ──────────────────────────────────────────────
// Paginated battle history
const getBattleHistory = asyncHandler(async (req, res) => {
  const page  = parseInt(req.query.page)  || 1;
  const limit = parseInt(req.query.limit) || 10;
  const skip  = (page - 1) * limit;

  const [battles, total] = await Promise.all([
    BossBattle.find({ userId: req.user._id, status: 'completed' })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .select('-questions -answers'), // Exclude heavy arrays from list
    BossBattle.countDocuments({ userId: req.user._id, status: 'completed' }),
  ]);

  res.json({
    success: true,
    data: battles,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  });
});

// ── GET /api/boss-battle/:id ──────────────────────────────────────────────────
// Fetch single battle with all questions and answers
const getBossBattle = asyncHandler(async (req, res) => {
  const battle = await BossBattle.findOne({ _id: req.params.id, userId: req.user._id });
  if (!battle) {
    res.status(404);
    throw new Error('Battle not found.');
  }
  res.json({ success: true, data: battle });
});

module.exports = {
  generateBossBattle,
  startBossBattle,
  submitAnswer,
  submitBossBattle,
  getBattleHistory,
  getBossBattle,
};
