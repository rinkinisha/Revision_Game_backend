/**
 * models/Revision.js – Revision schedule document
 * One document per scheduled revision slot (5 per topic).
 * Tracks the spaced repetition intervals: Day 3, 7, 21, 45, 90.
 */

const mongoose = require('mongoose');

const revisionSchema = new mongoose.Schema(
  {
    // ── References ───────────────────────────────────────────────────────────
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    topicId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Topic',
      required: true,
      index: true,
    },

    // ── Schedule ─────────────────────────────────────────────────────────────
    intervalDay: {
      type: Number,
      enum: [3, 7, 21, 45, 90],
      required: true,
    },
    scheduledDate: {
      type: Date,
      required: true,
      index: true, // Frequently queried for "due today" lookups
    },
    completedDate: {
      type: Date,
      default: null,
    },

    // ── Status ───────────────────────────────────────────────────────────────
    status: {
      type: String,
      enum: ['pending', 'completed', 'overdue', 'skipped'],
      default: 'pending',
      index: true,
    },

    // ── Performance ──────────────────────────────────────────────────────────
    score: {
      type: Number,
      min: 0,
      max: 100,
      default: null, // Score given when completing revision (0-100)
    },
    confidenceLevel: {
      type: String,
      enum: ['low', 'medium', 'high', null],
      default: null,
    },

    // ── Session Notes ────────────────────────────────────────────────────────
    notes: {
      type: String,
      default: '',
      maxlength: [2000, 'Notes cannot exceed 2000 characters'],
    },
  },
  {
    timestamps: true,
  }
);

// ── Compound Index for efficient "due today" queries ─────────────────────────
revisionSchema.index({ userId: 1, scheduledDate: 1, status: 1 });

module.exports = mongoose.model('Revision', revisionSchema);
