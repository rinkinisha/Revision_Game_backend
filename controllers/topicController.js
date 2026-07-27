/**
 * controllers/topicController.js
 * CRUD operations for topics + auto-scheduling revisions on creation.
 */

const asyncHandler = require('express-async-handler');
const Topic = require('../models/Topic');
const Revision = require('../models/Revision');
const RevisionSession = require('../models/RevisionSession');
const { generateRevisionSchedule } = require('../utils/spacedRepetition');

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Get all topics for logged-in user
// @route   GET /api/topics
// @access  Private
// ─────────────────────────────────────────────────────────────────────────────
const getTopics = asyncHandler(async (req, res) => {
  const { search, tag, subject, archived, sort = '-createdAt' } = req.query;

  const filter = { userId: req.user._id };

  // Filter archived topics
  filter.isArchived = archived === 'true' ? true : false;

  // Search by title or description
  if (search) {
    filter.$or = [
      { title: { $regex: search, $options: 'i' } },
      { description: { $regex: search, $options: 'i' } },
    ];
  }

  // Filter by tag
  if (tag) {
    filter.tags = { $in: [tag.toLowerCase()] };
  }

  // Filter by subject
  if (subject) {
    filter.subject = { $regex: subject, $options: 'i' };
  }

  const topics = await Topic.find(filter).sort(sort);

  res.json({
    success: true,
    count: topics.length,
    data: topics,
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Get single topic by ID
// @route   GET /api/topics/:id
// @access  Private
// ─────────────────────────────────────────────────────────────────────────────
const getTopic = asyncHandler(async (req, res) => {
  const topic = await Topic.findOne({
    _id: req.params.id,
    userId: req.user._id,
  });

  if (!topic) {
    res.status(404);
    throw new Error('Topic not found');
  }

  // Get all revisions for this topic
  const revisions = await Revision.find({ topicId: topic._id }).sort('scheduledDate');

  // Get recent sessions
  const sessions = await RevisionSession.find({ topicId: topic._id })
    .sort('-createdAt')
    .limit(10);

  res.json({
    success: true,
    data: { topic, revisions, sessions },
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Create a new topic + auto-schedule revisions
// @route   POST /api/topics
// @access  Private
// ─────────────────────────────────────────────────────────────────────────────
const createTopic = asyncHandler(async (req, res) => {
  const { title, description, tags, subject, dateLearnerd, difficulty, notes } = req.body;

  if (!title) {
    res.status(400);
    throw new Error('Topic title is required');
  }

  // Create the topic
  const topic = await Topic.create({
    userId: req.user._id,
    title,
    description,
    tags: tags || [],
    subject: subject || 'General',
    dateLearnerd: dateLearnerd ? new Date(dateLearnerd) : new Date(),
    difficulty: difficulty || 3,
    notes,
  });

  // Auto-generate spaced repetition revision schedule
  const schedule = generateRevisionSchedule(topic.dateLearnerd);

  // Bulk insert 5 revision documents
  const revisionDocs = schedule.map((slot) => ({
    userId: req.user._id,
    topicId: topic._id,
    intervalDay: slot.intervalDay,
    scheduledDate: slot.scheduledDate,
    status: 'pending',
  }));

  await Revision.insertMany(revisionDocs);

  res.status(201).json({
    success: true,
    message: `Topic created with ${schedule.length} revisions scheduled`,
    data: topic,
    schedule,
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Update a topic
// @route   PUT /api/topics/:id
// @access  Private
// ─────────────────────────────────────────────────────────────────────────────
const updateTopic = asyncHandler(async (req, res) => {
  const topic = await Topic.findOne({
    _id: req.params.id,
    userId: req.user._id,
  });

  if (!topic) {
    res.status(404);
    throw new Error('Topic not found');
  }

  const { title, description, tags, subject, difficulty, notes, isArchived } = req.body;

  // Update fields
  if (title !== undefined) topic.title = title;
  if (description !== undefined) topic.description = description;
  if (tags !== undefined) topic.tags = tags;
  if (subject !== undefined) topic.subject = subject;
  if (difficulty !== undefined) topic.difficulty = difficulty;
  if (notes !== undefined) topic.notes = notes;
  if (isArchived !== undefined) topic.isArchived = isArchived;

  const updatedTopic = await topic.save();

  res.json({
    success: true,
    message: 'Topic updated successfully',
    data: updatedTopic,
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Delete a topic + all its revisions and sessions
// @route   DELETE /api/topics/:id
// @access  Private
// ─────────────────────────────────────────────────────────────────────────────
const deleteTopic = asyncHandler(async (req, res) => {
  const topic = await Topic.findOne({
    _id: req.params.id,
    userId: req.user._id,
  });

  if (!topic) {
    res.status(404);
    throw new Error('Topic not found');
  }

  // Cascade delete revisions and sessions
  await Revision.deleteMany({ topicId: topic._id });
  await RevisionSession.deleteMany({ topicId: topic._id });
  await topic.deleteOne();

  res.json({
    success: true,
    message: 'Topic and all related data deleted successfully',
  });
});
module.exports = { getTopics, getTopic, createTopic, updateTopic, deleteTopic };
