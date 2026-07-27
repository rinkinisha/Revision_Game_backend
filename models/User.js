/**
 * models/User.js – User schema for Revision OS
 * Stores authentication info, revision streak, and memory stats.
 */

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      maxlength: [50, 'Name cannot exceed 50 characters'],
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email'],
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [6, 'Password must be at least 6 characters'],
      select: false, // Never return password in queries
    },
    avatar: {
      type: String,
      default: '', // URL to avatar image (optional)
    },
    role: {
      type: String,
      enum: ['student', 'admin'],
      default: 'student',
    },
    // ── Streak Tracking ─────────────────────────────────────────────────────
    revisionStreak: {
      type: Number,
      default: 0,
    },
    longestStreak: {
      type: Number,
      default: 0,
    },
    lastActiveDate: {
      type: Date,
      default: null,
    },
    // ── Notification Preferences ────────────────────────────────────────────
    notifications: {
      email: { type: Boolean, default: true },
      browser: { type: Boolean, default: true },
    },
  },
  {
    timestamps: true, // createdAt, updatedAt
  }
);

// ── Pre-save Hook: Hash password before saving ─────────────────────────────
userSchema.pre('save', async function (next) {
  // Only hash if password is new or modified
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(12);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// ── Instance Method: Compare entered password with hashed password ──────────
userSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

// ── Instance Method: Update streak based on last active date ───────────────
userSchema.methods.updateStreak = function () {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (!this.lastActiveDate) {
    this.revisionStreak = 1;
  } else {
    const last = new Date(this.lastActiveDate);
    last.setHours(0, 0, 0, 0);
    const diffDays = Math.floor((today - last) / (1000 * 60 * 60 * 24));

    if (diffDays === 1) {
      // Consecutive day – increment streak
      this.revisionStreak += 1;
    } else if (diffDays === 0) {
      // Same day – no change
    } else {
      // Streak broken
      this.revisionStreak = 1;
    }
  }

  if (this.revisionStreak > this.longestStreak) {
    this.longestStreak = this.revisionStreak;
  }

  this.lastActiveDate = today;
};

module.exports = mongoose.model('User', userSchema);
