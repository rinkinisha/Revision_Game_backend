/**
 * controllers/aiController.js
 * Handles Gemini AI chat interactions and completing AI-guided revision sessions.
 */

const asyncHandler = require('express-async-handler');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const Topic = require('../models/Topic');
const Revision = require('../models/Revision');
const RevisionSession = require('../models/RevisionSession');
const User = require('../models/User');
const mongoose = require('mongoose');
const AiService = require('../services/ai/AiService');

const presetMockScenarios = {
  'general': {
    questions: [
      "Let's start your revision. In your own words, what is the core concept of this topic and why is it important?",
      "Good. Can you give a practical example or use-case of how this concept is applied?",
      "Excellent. What do you think is the most challenging or commonly misunderstood part of this topic?",
      "That makes sense. If you had to explain this topic to a complete beginner, what analogy would you use?",
      "Almost there! Let's wrap up. What is the single most important takeaway you want to remember about this topic?"
    ],
    summary: {
      explainedWell: "You demonstrated a clear understanding of the core concept and its practical applications.",
      needsImprovement: "Make sure to review the edge cases and potential challenges associated with this topic.",
      takeaway: "Keep practicing and connecting this topic to other related concepts to strengthen your understanding."
    }
  }
};


// ─────────────────────────────────────────────────────────────────────────────
// @desc    Chat with the AI Revision Coach (Stage 1)
// @route   POST /api/ai/chat
// @access  Private
// ─────────────────────────────────────────────────────────────────────────────
const chatWithCoach = asyncHandler(async (req, res) => {
  const { topicId, messages = [], priorConversation = [], chosenRole, stage = 1, sessionMemory = '', endSession = false } = req.body;

  if (![1, 2].includes(Number(stage))) {
    res.status(400);
    throw new Error('Stage must be either 1 or 2');
  }

  // 1. Fetch topic details if topicId is provided
  let topicTitle = 'General Revision';
  let topicSubject = 'General';
  let previousTopics = [];
  if (topicId) {
    if (mongoose.Types.ObjectId.isValid(topicId)) {
      const topic = await Topic.findOne({ _id: topicId, userId: req.user._id });
      if (topic) {
        topicTitle = topic.title;
        topicSubject = topic.subject || 'General';

        // Stage 2 uses topics learned before the current topic as the learner's
        // existing mental models. Limit the list to keep the AI prompt focused.
        if (Number(stage) === 2) {
          previousTopics = await Topic.find({
            userId: req.user._id,
            _id: { $ne: topic._id },
            isArchived: false,
            dateLearnerd: { $lte: topic.dateLearnerd },
          })
            .sort('-dateLearnerd')
            .limit(12)
            .select('title subject tags description')
            .lean();
        }
      }
    } else {
      // Non-ObjectId topic (e.g. from reflection dummy ID), use details passed in the request
      if (req.body.topicTitle) {
        topicTitle = req.body.topicTitle;
        topicSubject = req.body.topicSubject || 'General';
      }
    }
  }

  // 2. Resolve/Pick Role
  const roles = [
    'Tech Interviewer',
  ];

  let activeRole = Number(stage) === 2 ? 'Connected Concepts Coach' : chosenRole;
  if (!activeRole) {
    activeRole = roles[Math.floor(Math.random() * roles.length)];
  }

  const userMsgCount = messages.filter((m) => m.role === 'user').length;

  // 3. Manage turn instructions based on endSession request
  let turnInstruction = '';
  if (endSession) {
    if (Number(stage) === 2) {
      turnInstruction = `\n[System note: The user has requested to end the session. You MUST conclude the conversation now, evaluate their connection understanding, and include the exact line "Connected mental map complete.". Do not ask another question.]`;
    } else {
      turnInstruction = `\n[System note: The user has requested to end the session. You MUST conclude the conversation now. Provide the final 3-point summary immediately (Explained Well, Concepts to Improve, Takeaway). Do not ask any more questions.]`;
    }
  } else {
    if (Number(stage) === 2) {
      turnInstruction = `\n[System note: Keep the conversation active. Probe their connection mapping, ask guiding questions, and do NOT conclude the session or include "Connected mental map complete." yet.]`;
    } else {
      turnInstruction = `\n[System note: Keep the conversation active. Probe their thinking, ask guiding questions, and guide them Socratic-style. Do NOT conclude the session or output a summary block yet.]`;
    }
  }

  // 4. Session Memory section — injected into the prompt for personalised follow-ups
  const memorySection = sessionMemory
    ? `\n### Session Memory (Personalisation Context)\nThe following is a live summary of how the student has performed so far in this session. Use it naturally — like a mentor who remembers. Reference past struggles with empathy, not criticism. Celebrate progress where it is evident.\n${sessionMemory}\n`
    : '';

  // 5. Construct the system instruction
  const previousTopicContext = previousTopics.length
    ? previousTopics.map((topic) => `- ${topic.title}${topic.subject ? ` (${topic.subject})` : ''}${topic.tags?.length ? ` [${topic.tags.join(', ')}]` : ''}`).join('\n')
    : '- No earlier topics are available. Help the learner connect the current topic to foundational JavaScript concepts they may already know.';
  const priorConversationContext = priorConversation.length
    ? priorConversation.slice(-12).map((message) => `${message.role === 'assistant' ? 'Coach' : 'Learner'}: ${String(message.content || '').slice(0, 600)}`).join('\n')
    : 'No Stage 1 conversation was supplied.';

  const stageTwoPrompt = `
You are an experienced, warm, and adaptive Socratic mentor guiding a student to build a connected mental web for: "${topicTitle}" (Subject: ${topicSubject}).
Your goal is to help them connect this new topic to earlier concepts they learned, building a strong, unified mental map.

### Previously Learned Topics (Use these for connection context)
${previousTopicContext}

### Stage 1 Conversation Context
${priorConversationContext}

### Socratic Connection Rules
1. BE A HUMAN MENTOR, NOT A CHATBOT. Never use robotic phrases like "Here is your next question", "Excellent connection, now let's discuss...", or outputting structured lists of questions. Speak like a senior developer/mentor in a whiteboard session.
2. SOCRATIC CONNECTION: Ask exactly one connection question at a time. Probe relationships between the current topic and previous concepts (e.g., "How does the lexical scope we discussed in closures relate to execution context?").
3. ADAPTIVE DIALOGUE & CONTINUITY: Listen carefully to their explanation. Pay close attention to previous answers. Build directly on what the student says. If they state a connection exists, ask them to explain *why* or to give an example. Challenge their logic if they confuse reference or scope behavior.
4. NO TEXT DUMPS: Keep explanations minimal. Guide them to formulate the connection themselves. Keep responses under 3-4 sentences.

### Session Ending
When concluding the session, ask them to summarize the main connection web in their own words. Once they reply, provide a brief feedback/closing and include the exact line: "Connected mental map complete." Do not ask another question after that line.

${memorySection}${turnInstruction}
`;

  const stageOnePrompt = `
You are an experienced, warm, and highly adaptive human mentor guiding a student through a Socratic revision of the topic: "${topicTitle}" (Subject: ${topicSubject}).
You are playing the role of a **${activeRole}**. Adopt this persona's tone, wisdom, and professional background.

### Conversation Guidelines
1. BE A HUMAN MENTOR, NOT A CHATBOT.
   - Speak exactly like a friendly senior developer mentoring a junior developer.
   - Never sound like an AI assistant, textbook, or lecturer.
   - Avoid robotic phrases such as "Here is your next question," "Excellent work," "Let's move on," or "As your mentor."
   - Your replies should feel like a natural back-and-forth conversation.
2. THE SOCRATIC METHOD: Your primary tool is the question. Do not dump code or explanations. Instead, ask one focused conceptual question that forces the student to retrieve knowledge or think from first principles.
3. CONVERSATIONAL CONTINUITY: You MUST pay close attention to previous answers. Build directly on what the student says. If they use a term, probe deeper: "What do you mean by that? How does that actually work under the hood?" Reference their past statements to make the conversation feel like a single continuous stream of thought.
4. ADAPT & CHALLENGE:
   - If their answer is correct but simple: ask for a real-world example or challenge their assumptions ("Are you sure that doesn't cause a memory leak? What if...").
   - If they make a mistake: do not say "Incorrect" or provide the correct answer. Guide them with a gentle counter-question or hypothetical scenario that exposes the flaw in their reasoning.
   - If they are completely stuck: provide a tiny, curious clue or analogy, and ask a guiding micro-question. Only provide a brief explanation if they explicitly request it or remain stuck after multiple hints.
5. ONE QUESTION AT A TIME: Never ask more than one question per turn. Keep your replies concise (under 3-4 sentences) to maintain high-energy dialogue.
6. CELEBRATE THINKING: Appreciate their process and effort. Be supportive and curious.
### Language & Communication Style
7. USE SIMPLE ENGLISH:
   - Always speak in very simple, easy-to-understand English suitable for beginners.
   - Avoid advanced vocabulary, complex sentence structures, or overly academic language.
   - Explain ideas using short sentences and everyday words.
   - If you need to use a technical term (e.g., closure, hoisting, lexical scope), mention the term but explain it in simple language.
   - Prefer a friendly conversation over formal teaching.
   - Speak as if you're mentoring a first-year developer or someone who is still learning English.
   - Keep your questions natural, short, and easy to understand.
### Natural Conversation
8. TALK LIKE A REAL PERSON:
   - Occasionally use natural conversational phrases like:
     - "Hmm..."
     - "Interesting."
     - "That's a good point."
     - "Let's think about this."
     - "Can you explain that a little more?"
     - "Why do you think that?"
   - Don't use these in every response—use them naturally and sparingly.
   - Avoid sounding scripted or repetitive.   
### Concluding the Session
When wrapping up, say something like: "We've had a great session covering this. Let's do a quick post-session check. Here's a brief breakdown of what we discussed:" and provide EXACTLY these three points in a summary block:
- What the student explained well.
- What concepts still need improvement.
- One takeaway to remember.

${memorySection}${turnInstruction}
`;

  const systemPrompt = Number(stage) === 2 ? stageTwoPrompt : stageOnePrompt;

  let chatHistoryText = '';
  if (messages && messages.length > 0) {
    chatHistoryText = messages.map(msg => `${msg.role === 'assistant' ? 'Coach' : 'Learner'}: ${msg.content}`).join('\n');
  }

  let userPrompt = '';
  if (messages.length === 0) {
    userPrompt = Number(stage) === 2
      ? `I am ready to build connections around "${topicTitle}". Introduce yourself as my Connected Concepts Coach and ask the first one-question reflection prompt.`
      : `Hello! I am ready to start revising "${topicTitle}". Introduce yourself as my Memory Coach playing the role of a ${activeRole}, and ask the first open-ended conceptual question to start our session.`;
  } else {
    userPrompt = `Here is our conversation history so far:\n${chatHistoryText}\n\nLearner: ${messages[messages.length - 1].content}\n\nCoach, please respond based on the conversation history and the system instructions.`;
  }

  try {
    const cleanText = await AiService.callLLM(systemPrompt, userPrompt, false);
    if (!cleanText) {
      throw new Error('No response from AI Service');
    }

    // Parse emotion prefix if present: e.g. [EMOTION: Proud]
    let emotion = 'neutral';
    let contentOnly = cleanText;
    const emotionMatch = cleanText.match(/^\[EMOTION:\s*([A-Za-z]+)\]/i);
    if (emotionMatch) {
      emotion = emotionMatch[1].toLowerCase();
      contentOnly = cleanText.replace(/^\[EMOTION:\s*[A-Za-z]+\]\s*/i, '');
    }

    // Check if AI concluded the session (detect presence of the summary block or completion phrase)
    const hasExplainedWell = /explained well/i.test(contentOnly);
    const hasNeedImprovement = /need(s)? improvement/i.test(contentOnly) || /concepts still/i.test(contentOnly);
    const hasTakeaway = /takeaway/i.test(contentOnly);
    const isCompleted = Number(stage) === 2
      ? /connected mental map complete/i.test(contentOnly)
      : hasExplainedWell && hasNeedImprovement && hasTakeaway;

    res.json({
      success: true,
      data: {
        content: contentOnly,
        emotion: emotion,
        chosenRole: activeRole,
        stage: Number(stage),
        isCompleted,
        userMsgCount,
      },
    });
  } catch (error) {
    console.error('AI API call failed, attempting Socratic fallback:', error.message);

    const isQuotaOrAuth = 
      error.message.includes('429') || 
      error.message.includes('quota') || 
      error.message.includes('exhausted') || 
      error.message.includes('API_KEY') ||
      error.message.includes('API key') ||
      error.message.includes('Forbidden') ||
      error.message.includes('not found') ||
      error.message.includes('supported');

    if (isQuotaOrAuth) {
      console.log('🤖 Quota/Auth issue detected. Initiating Local Socratic Fallback...');

      if (Number(stage) === 2) {
        const connectionQuestions = [
          `Before we focus on ${topicTitle}, which earlier concept do you think JavaScript needs in order for it to work, and why?`,
          `What problem would ${topicTitle} fail to solve if that earlier concept did not exist?`,
          `How does ${topicTitle} behave differently from the closest similar concept you know?`,
          `Which later JavaScript concept do you think depends on ${topicTitle}, and what is the dependency?`,
          `Can you now describe the chain from the prerequisite concept to ${topicTitle} in your own words?`,
        ];

        const connectionComplete = endSession;
        const fallbackEmotion = connectionComplete
          ? 'proud'
          : userMsgCount === 0
          ? 'neutral'
          : userMsgCount % 2 === 0
          ? 'happy'
          : 'curious';

        return res.json({
          success: true,
          data: {
            content: connectionComplete
              ? 'You have connected the ideas thoughtfully. Connected mental map complete.'
              : connectionQuestions[userMsgCount % connectionQuestions.length],
            emotion: fallbackEmotion,
            chosenRole: 'Connected Concepts Coach',
            stage: 2,
            isCompleted: connectionComplete,
            userMsgCount,
          },
        });
      }
      
      const scenarioKey = presetMockScenarios[topicId] ? topicId : 'general';
      const scenario = presetMockScenarios[scenarioKey];
      
      let replyContent = '';
      let isCompleted = false;
      let fallbackEmotion = 'curious';

      if (endSession) {
        replyContent = `Excellent job working through this topic with me! Let's wrap up our session. Here is a summary of your revision:

- **What you explained well**: ${scenario.summary.explainedWell}
- **What concepts still need improvement**: ${scenario.summary.needsImprovement}
- **One takeaway to remember**: ${scenario.summary.takeaway}

Keep practicing, you are doing great!`;
        isCompleted = true;
        fallbackEmotion = 'proud';
      } else {
        const questionIdx = userMsgCount % scenario.questions.length;
        replyContent = scenario.questions[questionIdx];
        fallbackEmotion = questionIdx === 0
          ? 'neutral'
          : questionIdx % 2 === 0
          ? 'happy'
          : 'curious';
      }

      return res.json({
        success: true,
        data: {
          content: replyContent,
          emotion: fallbackEmotion,
          chosenRole: activeRole,
          stage: 1,
          isCompleted,
          userMsgCount,
        },
      });
    }

    res.status(500);
    throw new Error(`AI API Error: ${error.message}`);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Complete and save an AI guided revision session
// @route   POST /api/ai/complete
// @access  Private
// ─────────────────────────────────────────────────────────────────────────────
const completeAISession = asyncHandler(async (req, res) => {
  const { topicId, messages = [], confidenceLevel = 'medium', selfAssessment = 'okay', notes = '' } = req.body;

  if (!topicId) {
    res.status(400);
    throw new Error('Topic ID is required');
  }

  let topic;
  const isPreset = !mongoose.Types.ObjectId.isValid(topicId);

  if (!isPreset) {
    topic = await Topic.findOne({ _id: topicId, userId: req.user._id });
    if (!topic) {
      res.status(404);
      throw new Error('Topic not found');
    }
  } else {
    // Dynamic topic resolution for reflection topics or unsaved topics
    let titleToUse = req.body.topicTitle;
    let subjectToUse = req.body.topicSubject || 'General';
    let tagsToUse = req.body.topicTags || [];

    if (!titleToUse) {
      res.status(400);
      throw new Error('Topic title is required for non-database topics');
    }

    // Check if the user already has a topic with this title (case-insensitive)
    topic = await Topic.findOne({
      userId: req.user._id,
      title: { $regex: new RegExp(`^${titleToUse.trim()}$`, 'i') }
    });

    if (!topic) {
      topic = await Topic.create({
        userId: req.user._id,
        title: titleToUse.trim(),
        subject: subjectToUse,
        tags: tagsToUse,
        difficulty: 3,
        dateLearnerd: new Date()
      });

      // Auto-schedule spaced-repetition revisions
      const { generateRevisionSchedule } = require('../utils/spacedRepetition');
      const schedule = generateRevisionSchedule(topic.dateLearnerd);
      const revisionDocs = schedule.map((slot) => ({
        userId: req.user._id,
        topicId: topic._id,
        intervalDay: slot.intervalDay,
        scheduledDate: slot.scheduledDate,
        status: 'pending',
      }));
      await Revision.insertMany(revisionDocs);
    }
  }

  // 1. Find active pending/overdue scheduled revision
  let revision = null;
  if (!isPreset) {
    revision = await Revision.findOne({
      userId: req.user._id,
      topicId: topic._id,
      status: { $in: ['pending', 'overdue'] },
    }).sort('scheduledDate');
  }

  const now = new Date();
  const scoreMap = { easy: 95, okay: 85, hard: 70, very_hard: 55 };
  const score = scoreMap[selfAssessment] || 80;

  // 2. If a scheduled revision is found, complete it
  if (revision) {
    revision.status = 'completed';
    revision.completedDate = now;
    revision.score = score;
    revision.confidenceLevel = confidenceLevel;
    revision.notes = notes || 'Revised via AI Coach';
    await revision.save();
  }

  // 3. Log the revision session
  const session = await RevisionSession.create({
    userId: req.user._id,
    topicId: topic._id,
    revisionId: revision ? revision._id : new mongoose.Types.ObjectId(), // fallback if no scheduled revision
    startTime: new Date(Date.now() - 5 * 60 * 1000), // Approximate 5 mins ago
    endTime: now,
    notesAdded: notes || 'Revised via AI Coach',
    aiUsed: true,
    aiConversationLog: messages.map((m) => ({
      role: m.role,
      content: m.content,
      timestamp: m.timestamp || new Date(),
    })),
    score,
    confidenceLevel,
    selfAssessment,
  });

  // 4. Update Topic Stats
  topic.revisionCount += 1;
  topic.lastRevisedAt = now;

  // Recalculate average memory score from completed revisions
  const completedRevisions = await Revision.find({
    topicId: topic._id,
    status: 'completed',
  });

  if (completedRevisions.length > 0) {
    const avgScore =
      completedRevisions.reduce((sum, r) => sum + (r.score || 0), 0) /
      completedRevisions.length;
    topic.memoryScore = Math.round(avgScore);
  } else {
    // If not a scheduled revision, update with the session score
    topic.memoryScore = Math.round((topic.memoryScore + score) / 2 || score);
  }
  await topic.save();

  // 5. Update user streak
  const user = await User.findById(req.user._id);
  if (user) {
    user.updateStreak();
    await user.save();
  }

  res.json({
    success: true,
    message: 'AI Revision Session saved successfully! 🚀',
    data: {
      session,
      updatedStreak: user ? user.revisionStreak : 0,
    },
  });
});

// New unified generation and evaluation endpoints
const generateRevisionQuestion = asyncHandler(async (req, res) => {
  const { topic, stageType } = req.body;

  if (!stageType) {
    res.status(400);
    throw new Error('Stage type is required');
  }

  const topicName = topic?.title || 'General Web Development';
  let systemPrompt = '';
  let userPrompt = '';

  // Dynamic randomization drivers to prevent repetitive AI questions
  const focusAngles = [
    'real-world production scenarios and unexpected edge cases',
    'performance, optimization, and memory implications',
    'debugging, common developer errors, and security pitfalls',
    'under-the-hood execution flow and core internal mechanisms',
    'best practices vs bad code anti-patterns'
  ];
  const selectedAngle = focusAngles[Math.floor(Math.random() * focusAngles.length)];
  const sessionSeed = `${Date.now()}_${Math.random().toString(36).substring(7)}`;

  if (stageType === 'wakeup') {
    systemPrompt = 'You are an expert technical interviewer creating unique revision challenges.';
    userPrompt = `Generate a fresh, unique warmup question about the topic: "${topicName}".
    Focus Angle: ${selectedAngle}.
    Session Seed: ${sessionSeed}.
    Do NOT ask generic textbook definition questions. Create a creative scenario or riddle.
    Randomly choose the format: either "mcq", "fill_in_blank", or "riddle".
    Return ONLY a JSON object exactly in this format, with no markdown formatting or extra text:
    {
      "type": "mcq" | "fill_in_blank" | "riddle",
      "question": "The unique question text here",
      "options": ["Opt1", "Opt2", "Opt3", "Opt4"], // ONLY if type is mcq, otherwise empty array
      "answer": "The exact correct answer as a string"
    }`;
  } else if (stageType === 'memory') {
    systemPrompt = 'You are an expert technical interviewer creating fresh recall questions.';
    userPrompt = `Generate exactly 5 fresh, unique questions for a "pure recall" memory challenge about the topic: "${topicName}". 
    Focus Angle: ${selectedAngle}.
    Session Seed: ${sessionSeed}.
    
    Structure the 5 questions dynamically across distinct perspectives:
    - Question 1 (Easy): Basic concept or core purpose of "${topicName}".
    - Question 2 (Easy/Medium): How "${topicName}" functions in real project code.
    - Question 3 (Medium): Common use-case or key advantage of "${topicName}".
    - Question 4 (Challenging): Test a specific edge case, pitfall, or under-the-hood behavior.
    - Question 5 (Challenging): Advanced comparison, trade-off, or architectural detail.

    For each question, provide 3 progressive hints leading up to the final answer (4 items total in the hints array: hint 1, hint 2, hint 3, and the exact answer).
    
    Return ONLY a JSON object exactly in this format, with no markdown formatting or extra text:
    {
      "questions": [
        {
          "question": "Question text here",
          "hints": ["Hint 1", "Hint 2", "Hint 3", "The final correct answer"]
        },
        ... (exactly 5 objects)
      ]
    }`;
  } else if (stageType === 'connect_dots') {
    systemPrompt = 'You are a friendly senior developer mentoring beginner and intermediate students.';
    userPrompt = `You are explaining how the programming concept "${topicName}" is used in simple, relatable real-world projects that beginners build (e.g. Todo App, Shopping Cart, Weather Dashboard, Social Media Like Button, Login Form, Quiz App).

    Do NOT use overly complex enterprise jargon. Keep the language very simple, clear, and beginner-friendly!
    Generate 2 to 3 simple, relatable project examples showing step-by-step how "${topicName}" works in practice.

    For each project example, provide:
    - projectName: Friendly relatable project name (e.g. "Simple Login & User Session", "Shopping Cart Counter", "Weather App Forecast")
    - projectDescription: 1 simple sentence describing what the project does
    - whyUsed: Exactly 1 easy-to-understand sentence explaining WHY "${topicName}" is used in this project
    - highlightStepIndex: The 0-based index of the step where "${topicName}" is actively used/executed
    - steps: An array of 4 to 6 simple sequential steps. Each step MUST have:
      - stepNumber: number (1-indexed)
      - title: Short clear step title (e.g., "1. User Clicks Login", "2. Save User Token")
      - description: 1 simple sentence explaining what happens in plain English (used in step tooltip)
      - isConceptStep: boolean (true ONLY for the step where "${topicName}" is directly used)
      - conceptRole: short clear badge label like "${topicName} in Action"

    Return ONLY a JSON object formatted strictly as follows with no markdown block formatting:
    {
      "concept": "${topicName}",
      "projects": [
        {
          "id": "proj_1",
          "projectName": "Beginner Project Name",
          "projectDescription": "Simple overview of project.",
          "whyUsed": "Simple sentence explaining why ${topicName} is needed here.",
          "highlightStepIndex": 1,
          "steps": [
            {
              "stepNumber": 1,
              "title": "User Action",
              "description": "Simple step 1 explanation.",
              "isConceptStep": false
            },
            {
              "stepNumber": 2,
              "title": "Concept Execution",
              "description": "Simple explanation of concept step.",
              "isConceptStep": true,
              "conceptRole": "${topicName} Active"
            },
            {
              "stepNumber": 3,
              "title": "Result",
              "description": "Simple step 3 explanation.",
              "isConceptStep": false
            }
          ]
        }
      ]
    }`;
  } else {
    systemPrompt = 'You are an expert technical interviewer.';
    userPrompt = `Generate a challenging question about the topic: "${topicName}".
    Focus Angle: ${selectedAngle}.
    Session Seed: ${sessionSeed}.
    Return ONLY a JSON object exactly in this format, with no markdown formatting or extra text:
    {
      "question": "The question text here"
    }`;
  }

  const data = await AiService.callLLM(systemPrompt, userPrompt, true);
  if (!data) {
    res.status(500);
    throw new Error('AI Service failed to generate question');
  }

  let responseData = data;
  if (stageType === 'memory') {
    let questionsList = [];
    if (Array.isArray(data)) {
      questionsList = data;
    } else if (data && typeof data === 'object') {
      if (Array.isArray(data.questions)) {
        questionsList = data.questions;
      } else if (Array.isArray(data.data)) {
        questionsList = data.data;
      }
    }

    responseData = questionsList.map((q, idx) => {
      const questionText = q.question || q.text || `Review concept ${idx + 1} of ${topicName}.`;
      const hintsList = Array.isArray(q.hints) && q.hints.length > 0 
        ? q.hints 
        : ["Think about its primary purpose.", "How does it interact with other components?", "What is its syntax or general shape?", "Consider its underlying mechanism."];
      return {
        question: questionText,
        hints: hintsList
      };
    });

    if (responseData.length === 0) {
      responseData = Array(5).fill(null).map((_, idx) => ({
        question: `Recall question ${idx + 1} about ${topicName}.`,
        hints: ["Think about its primary purpose.", "How does it interact with other components?", "What is its syntax or general shape?", "Consider its underlying mechanism."]
      }));
    }
  }

  res.json({
    success: true,
    data: responseData,
  });
});

const evaluateRevisionAnswer = asyncHandler(async (req, res) => {
  const { question, userAnswer } = req.body;

  if (!question || userAnswer === undefined) {
    res.status(400);
    throw new Error('Question and userAnswer are required');
  }

  const systemPrompt = `You are an expert AI grader. Evaluate the user's answer to the following technical question.
  Evaluate if the context of the user's answer is correct. 
  Assign a score from 0 to 100 based on conceptual accuracy.
  If the score is 40 or higher, consider it "correct" enough to pass (isCorrect: true).
  Provide a short, encouraging feedback message (max 2 sentences).
  
  Return ONLY a JSON object exactly in this format, with no markdown formatting or extra text:
  {
    "isCorrect": boolean,
    "score": number,
    "feedback": "Short feedback message"
  }`;

  const userPrompt = `Question: "${question}"\nUser Answer: "${userAnswer}"`;

  const data = await AiService.callLLM(systemPrompt, userPrompt, true);
  if (!data) {
    return res.json({
      success: true,
      data: {
        isCorrect: userAnswer.length > 5,
        score: userAnswer.length > 5 ? 50 : 0,
        feedback: "Network error checking your answer. We'll accept this for now!"
      }
    });
  }

  res.json({
    success: true,
    data,
  });
});

module.exports = {
  chatWithCoach,
  completeAISession,
  generateRevisionQuestion,
  evaluateRevisionAnswer,
};
