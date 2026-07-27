/**
 * models/BossBattle.js
 * Stores a generated 15-question Boss Battle session for Stage 6.
 * Questions are embedded documents for atomic reads.
 */

const mongoose = require('mongoose');

const questionSchema = new mongoose.Schema({
  index:         { type: Number, required: true },
  type:          { type: String, enum: ['mcq', 'output', 'fill', 'debug'], required: true },
  question:      { type: String, required: true },
  options:       { type: [String], default: [] },      // MCQ choices (A/B/C/D)
  correctAnswer: { type: String, required: true },
  explanation:   { type: String, default: '' },
  concept:       { type: String, default: '' },         // Which concept this tests
  difficulty:    { type: String, enum: ['easy', 'medium', 'hard'], default: 'medium' },
  xpValue:       { type: Number, default: 10 },
}, { _id: false });

const answerSchema = new mongoose.Schema({
  questionIndex:  { type: Number, required: true },
  userAnswer:     { type: String, default: '' },
  isCorrect:      { type: Boolean, default: false },
  responseTimeMs: { type: Number, default: 0 },
  xpEarned:       { type: Number, default: 0 },
  comboActive:    { type: Boolean, default: false },
  skipped:        { type: Boolean, default: false },
}, { _id: false });

const bossBattleSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    topicIds: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Topic',
    }],

    // ── Student Profile snapshot ─────────────────────────────────────────────
    studentPhase:    { type: String, default: 'Frontend' },
    weakConcepts:    { type: [String], default: [] },
    strongConcepts:  { type: [String], default: [] },

    // ── Battle Content (from Gemini) ─────────────────────────────────────────
    questions: { type: [questionSchema], default: [] },

    // ── Battle Progress ──────────────────────────────────────────────────────
    status: {
      type: String,
      enum: ['generated', 'active', 'completed'],
      default: 'generated',
    },
    answers:          { type: [answerSchema], default: [] },
    currentQuestion:  { type: Number, default: 0 },
    startedAt:        { type: Date, default: null },
    completedAt:      { type: Date, default: null },

    // ── Results ──────────────────────────────────────────────────────────────
    totalXp:           { type: Number, default: 0 },
    maxCombo:          { type: Number, default: 0 },
    accuracy:          { type: Number, min: 0, max: 100, default: 0 },  // %
    avgResponseTimeMs: { type: Number, default: 0 },
    correctCount:      { type: Number, default: 0 },
    weakTopicsDetected:{ type: [String], default: [] },
    nextRevisionDate:  { type: Date, default: null },
  },
  { timestamps: true }
);

bossBattleSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model('BossBattle', bossBattleSchema);
