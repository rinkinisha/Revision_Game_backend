/**
 * models/Mission.js
 * Stores AI-generated coding missions for Stage 5 of the revision flow.
 */

const mongoose = require('mongoose');

const evaluationRubricSchema = new mongoose.Schema({
  logic:        { type: Number, default: 30 },
  conceptUsage: { type: Number, default: 30 },
  readability:  { type: Number, default: 20 },
  bestPractices:{ type: Number, default: 20 },
}, { _id: false });

const missionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    // Topics this mission covers (can span multiple)
    topicIds: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Topic',
    }],

    // ── Mission Content (from Gemini) ───────────────────────────────────────
    title:               { type: String, required: true, trim: true },
    description:         { type: String, required: true },
    requirements:        { type: [String], default: [] },
    starterCode:         { type: String, default: '' },
    expectedConcepts:    { type: [String], default: [] },
    evaluationRubric:    { type: evaluationRubricSchema, default: () => ({}) },
    estimatedDurationMinutes: { type: Number, default: 12 },

    // ── Student Profile snapshot at generation time ─────────────────────────
    studentPhase:        { type: String, default: 'Frontend' },
    weakConcepts:        { type: [String], default: [] },
    strongConcepts:      { type: [String], default: [] },
    difficulty:          { type: String, enum: ['beginner', 'intermediate', 'advanced'], default: 'intermediate' },

    // ── Status ──────────────────────────────────────────────────────────────
    status: {
      type: String,
      enum: ['generated', 'active', 'submitted', 'evaluated'],
      default: 'generated',
    },

    // Draft code saved during active coding session
    draftCode:    { type: String, default: '' },
    lastSavedAt:  { type: Date, default: null },
  },
  { timestamps: true }
);

missionSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model('Mission', missionSchema);
