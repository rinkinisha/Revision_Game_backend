/**
 * models/MissionAttempt.js
 * Records each code submission and its Gemini evaluation for Stage 5.
 */

const mongoose = require('mongoose');

const scoresSchema = new mongoose.Schema({
  logic:         { type: Number, min: 0, max: 30, default: 0 },
  conceptUsage:  { type: Number, min: 0, max: 30, default: 0 },
  readability:   { type: Number, min: 0, max: 20, default: 0 },
  bestPractices: { type: Number, min: 0, max: 20, default: 0 },
}, { _id: false });

const missionAttemptSchema = new mongoose.Schema(
  {
    missionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Mission',
      required: true,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },

    // ── Submission ───────────────────────────────────────────────────────────
    submittedCode:    { type: String, required: true },
    attemptNumber:    { type: Number, default: 1 },
    timeTakenSeconds: { type: Number, default: 0 },

    // ── Gemini Evaluation ────────────────────────────────────────────────────
    scores:      { type: scoresSchema, default: () => ({}) },
    totalScore:  { type: Number, min: 0, max: 100, default: 0 },
    strengths:   { type: [String], default: [] },
    weaknesses:  { type: [String], default: [] },
    feedback:    { type: String, default: '' },

    // ── Evaluation Status ────────────────────────────────────────────────────
    evaluationStatus: {
      type: String,
      enum: ['pending', 'evaluated', 'failed'],
      default: 'pending',
    },
    evaluationError: { type: String, default: null },
  },
  { timestamps: true }
);

missionAttemptSchema.index({ userId: 1, createdAt: -1 });
missionAttemptSchema.index({ missionId: 1, attemptNumber: 1 });

module.exports = mongoose.model('MissionAttempt', missionAttemptSchema);
