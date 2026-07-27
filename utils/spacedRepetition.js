/**
 * utils/spacedRepetition.js
 * Generates the 5-stage spaced repetition revision schedule.
 * Intervals: Day 3, 7, 21, 45, 90 from the date learned.
 */

const INTERVALS = [3, 7, 21, 45, 90]; // Days after dateLearnerd

/**
 * Generates scheduled revision dates for a given start date.
 * @param {Date} dateLearnerd - The date the topic was first learned.
 * @returns {Array} Array of { intervalDay, scheduledDate } objects.
 */
const generateRevisionSchedule = (dateLearnerd) => {
  return INTERVALS.map((interval) => {
    const scheduledDate = new Date(dateLearnerd);
    scheduledDate.setDate(scheduledDate.getDate() + interval);

    // Normalize to start of day (UTC midnight)
    scheduledDate.setHours(0, 0, 0, 0);

    return {
      intervalDay: interval,
      scheduledDate,
      status: 'pending',
    };
  });
};

/**
 * Checks if a date is today (UTC).
 * @param {Date} date
 * @returns {boolean}
 */
const isToday = (date) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d.getTime() === today.getTime();
};

/**
 * Checks if a date is in the past (before today).
 * @param {Date} date
 * @returns {boolean}
 */
const isOverdue = (date) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d < today;
};

module.exports = { generateRevisionSchedule, INTERVALS, isToday, isOverdue };
