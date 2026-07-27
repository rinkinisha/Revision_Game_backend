/**
 * models/Topic.js – Topic schema for Revision OS
 * Stores learning topics with tags, difficulty, and memory scoring.
 */

const mongoose = require('mongoose');

const topicSchema = new mongoose.Schema(
  {
    // ── Ownership ───────────────────────────────────────────────────────────
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },

    // ── Topic Details ───────────────────────────────────────────────────────
    title: {
      type: String,
      required: [true, 'Topic title is required'],
      trim: true,
      maxlength: [100, 'Title cannot exceed 100 characters'],
    },
    description: {
      type: String,
      trim: true,
      maxlength: [2000, 'Description cannot exceed 2000 characters'],
      default: '',
    },
    tags: {
      type: [String],
      default: [],
      set: (tags) => tags.map((t) => t.toLowerCase().trim()),
    },
    subject: {
      type: String,
      trim: true,
      default: 'General',
    },

    // ── Learning Metadata ───────────────────────────────────────────────────
    dateLearnerd: {
      type: Date,
      required: [true, 'Date learned is required'],
      default: Date.now,
    },
    difficulty: {
      type: Number,
      min: 1,
      max: 5,
      default: 3, // 1=Easy, 5=Very Hard
    },

    // ── Revision Statistics ─────────────────────────────────────────────────
    revisionCount: {
      type: Number,
      default: 0, // How many revisions completed
    },
    totalScheduled: {
      type: Number,
      default: 5, // Always 5 (Day 3,7,21,45,90)
    },
    memoryScore: {
      type: Number,
      min: 0,
      max: 100,
      default: 0, // Calculated from completed revisions
    },
    lastRevisedAt: {
      type: Date,
      default: null,
    },

    // ── Status ──────────────────────────────────────────────────────────────
    isArchived: {
      type: Boolean,
      default: false,
    },
    notes: {
      type: String,
      default: '',
      maxlength: [5000, 'Notes cannot exceed 5000 characters'],
    },
  },
  {
    timestamps: true,
  }
);

// ── Virtual: Completion Percentage ─────────────────────────────────────────
topicSchema.virtual('completionPercent').get(function () {
  if (this.totalScheduled === 0) return 0;
  return Math.round((this.revisionCount / this.totalScheduled) * 100);
});

// ── Virtual: Is a Weak Topic (score < 60 or fewer than 2 revisions done) ──
topicSchema.virtual('isWeak').get(function () {
  return this.memoryScore < 60 || (this.revisionCount < 2 && this.totalScheduled > 0);
});

topicSchema.set('toJSON', { virtuals: true });
topicSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Topic', topicSchema);
