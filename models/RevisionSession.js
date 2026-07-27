/**
 * models/RevisionSession.js – Tracks individual revision sessions
 * Records time spent, AI usage, scores, and notes per session.
 */

const mongoose = require('mongoose');

const revisionSessionSchema = new mongoose.Schema(
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
    },
    revisionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Revision',
      required: true,
    },

    // ── Session Timing ───────────────────────────────────────────────────────
    startTime: {
      type: Date,
      default: Date.now,
    },
    endTime: {
      type: Date,
      default: null,
    },
    durationMinutes: {
      type: Number,
      default: 0, // Calculated from start/end
    },

    // ── Session Content ──────────────────────────────────────────────────────
    notesAdded: {
      type: String,
      default: '',
      maxlength: [3000, 'Notes cannot exceed 3000 characters'],
    },
    aiUsed: {
      type: Boolean,
      default: false, // Whether the AI assistant was used
    },
    aiConversationLog: {
      type: [
        {
          role: { type: String, enum: ['user', 'assistant'] },
          content: String,
          timestamp: { type: Date, default: Date.now },
        },
      ],
      default: [],
    },

    // ── Performance ──────────────────────────────────────────────────────────
    score: {
      type: Number,
      min: 0,
      max: 100,
      default: null,
    },
    confidenceLevel: {
      type: String,
      enum: ['low', 'medium', 'high', null],
      default: null,
    },
    selfAssessment: {
      type: String,
      enum: ['easy', 'okay', 'hard', 'very_hard', null],
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// ── Pre-save Hook: Calculate duration ────────────────────────────────────────
revisionSessionSchema.pre('save', function (next) {
  if (this.endTime && this.startTime) {
    this.durationMinutes = Math.round(
      (this.endTime - this.startTime) / (1000 * 60)
    );
  }
  next();
});

module.exports = mongoose.model('RevisionSession', revisionSessionSchema);
