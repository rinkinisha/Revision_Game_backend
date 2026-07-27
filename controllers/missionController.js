/**
 * controllers/missionController.js
 * Handles Stage 5 – Mission Challenge CRUD and AI evaluation.
 */

const asyncHandler = require('express-async-handler');
const Mission       = require('../models/Mission');
const MissionAttempt = require('../models/MissionAttempt');
const Topic         = require('../models/Topic');
const { QuestionGenerator, EvaluationEngine } = require('../services/ai');
const masteryService = require('../services/masteryService');

// ── POST /api/missions/generate ───────────────────────────────────────────────
// Generate a mission via Gemini (does NOT save yet – returns preview)
const generateMission = asyncHandler(async (req, res) => {
  const { phase, weakConcepts, strongConcepts, difficulty, availableMinutes, topicIds } = req.body;

  if (!phase || !weakConcepts?.length || !strongConcepts?.length) {
    res.status(400);
    throw new Error('phase, weakConcepts, and strongConcepts are required.');
  }

  const missionData = await QuestionGenerator.generateMission({
    phase,
    weakConcepts,
    strongConcepts,
    difficulty: difficulty || 'intermediate',
    availableMinutes: availableMinutes || 12,
  });

  // Save to DB immediately with 'generated' status
  const mission = await Mission.create({
    userId: req.user._id,
    topicIds: topicIds || [],
    ...missionData,
    studentPhase:    phase,
    weakConcepts,
    strongConcepts,
    difficulty:      difficulty || 'intermediate',
    status:          'generated',
  });

  res.status(201).json({
    success: true,
    data: mission,
  });
});

// ── PUT /api/missions/:id/start ───────────────────────────────────────────────
// Mark a mission as active (student has started coding)
const startMission = asyncHandler(async (req, res) => {
  const mission = await Mission.findOne({ _id: req.params.id, userId: req.user._id });
  if (!mission) {
    res.status(404);
    throw new Error('Mission not found.');
  }

  mission.status = 'active';
  await mission.save();

  res.json({ success: true, data: mission });
});

// ── PUT /api/missions/:id/save ────────────────────────────────────────────────
// Autosave draft code during coding session
const saveDraftCode = asyncHandler(async (req, res) => {
  const { code } = req.body;
  if (code === undefined) {
    res.status(400);
    throw new Error('code is required.');
  }

  const mission = await Mission.findOneAndUpdate(
    { _id: req.params.id, userId: req.user._id },
    { draftCode: code, lastSavedAt: new Date(), status: 'active' },
    { new: true }
  );

  if (!mission) {
    res.status(404);
    throw new Error('Mission not found.');
  }

  res.json({ success: true, savedAt: mission.lastSavedAt });
});

// ── POST /api/missions/:id/submit ─────────────────────────────────────────────
// Submit code for Gemini evaluation + update mastery
const submitMission = asyncHandler(async (req, res) => {
  const { code, timeTakenSeconds } = req.body;

  if (!code?.trim()) {
    res.status(400);
    throw new Error('Submitted code cannot be empty.');
  }

  const mission = await Mission.findOne({ _id: req.params.id, userId: req.user._id });
  if (!mission) {
    res.status(404);
    throw new Error('Mission not found.');
  }

  // Determine attempt number
  const attemptCount = await MissionAttempt.countDocuments({
    missionId: mission._id,
    userId: req.user._id,
  });

  // Create attempt record (pending evaluation)
  const attempt = await MissionAttempt.create({
    missionId: mission._id,
    userId: req.user._id,
    submittedCode: code,
    attemptNumber: attemptCount + 1,
    timeTakenSeconds: timeTakenSeconds || 0,
    evaluationStatus: 'pending',
  });

  // Run Gemini evaluation
  try {
    const evaluation = await EvaluationEngine.evaluateCode(mission, code);

    attempt.scores           = evaluation.scores;
    attempt.totalScore       = evaluation.totalScore;
    attempt.strengths        = evaluation.strengths;
    attempt.weaknesses       = evaluation.weaknesses;
    attempt.feedback         = evaluation.feedback;
    attempt.evaluationStatus = 'evaluated';
    await attempt.save();

    // Update mission status
    mission.status    = 'evaluated';
    mission.draftCode = code;
    await mission.save();

    // Update topic mastery asynchronously (fire-and-forget)
    masteryService
      .updateMissionMastery(req.user._id, attempt, mission.topicIds)
      .catch((err) => console.error('Mastery update failed:', err.message));

  } catch (err) {
    attempt.evaluationStatus = 'failed';
    attempt.evaluationError  = err.message;
    await attempt.save();
    // Still return the attempt so UI can show "evaluation failed" gracefully
  }

  res.json({ success: true, data: attempt });
});

// ── GET /api/missions/history ─────────────────────────────────────────────────
// Paginated mission attempt history for the logged-in user
const getMissionHistory = asyncHandler(async (req, res) => {
  const page  = parseInt(req.query.page)  || 1;
  const limit = parseInt(req.query.limit) || 10;
  const skip  = (page - 1) * limit;

  const [attempts, total] = await Promise.all([
    MissionAttempt.find({ userId: req.user._id })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('missionId', 'title difficulty studentPhase'),
    MissionAttempt.countDocuments({ userId: req.user._id }),
  ]);

  res.json({
    success: true,
    data: attempts,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  });
});

// ── GET /api/missions/:id ─────────────────────────────────────────────────────
// Fetch a single mission with its attempts
const getMission = asyncHandler(async (req, res) => {
  const mission = await Mission.findOne({ _id: req.params.id, userId: req.user._id });
  if (!mission) {
    res.status(404);
    throw new Error('Mission not found.');
  }

  const attempts = await MissionAttempt.find({
    missionId: mission._id,
    userId: req.user._id,
  }).sort({ attemptNumber: 1 });

  res.json({ success: true, data: { mission, attempts } });
});

// ── GET /api/missions ─────────────────────────────────────────────────────────
// List all missions for the user (for history page)
const listMissions = asyncHandler(async (req, res) => {
  const page  = parseInt(req.query.page)  || 1;
  const limit = parseInt(req.query.limit) || 10;
  const skip  = (page - 1) * limit;

  const [missions, total] = await Promise.all([
    Mission.find({ userId: req.user._id })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .select('-draftCode -starterCode'), // Exclude heavy fields from list
    Mission.countDocuments({ userId: req.user._id }),
  ]);

  res.json({
    success: true,
    data: missions,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  });
});

module.exports = {
  generateMission,
  startMission,
  saveDraftCode,
  submitMission,
  getMissionHistory,
  getMission,
  listMissions,
};
