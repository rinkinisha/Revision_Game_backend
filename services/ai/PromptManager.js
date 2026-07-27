/**
 * services/ai/PromptManager.js
 * Manages prompts and JSON schemas for AI engines.
 */

class PromptManager {
  static getMissionSystemPrompt() {
    return `You are a Senior Coding Educator building missions for a spaced-repetition revision platform.
You must return ONLY a JSON object matching the requested schema. Do not include markdown blocks or any other text.`;
  }

  static getMissionUserPrompt(profile) {
    const { phase, weakConcepts, strongConcepts, difficulty, availableMinutes } = profile;
    return `
STUDENT PROFILE:
- Target Concept / Topic (must reinforce syntax): ${weakConcepts.join(', ')}
- Contextual concepts: ${strongConcepts.join(', ')}
- Difficulty: ${difficulty}
- Available time: ${availableMinutes || 12} minutes

RULES FOR SYNTAX DEBUGGING MISSION (DO NOT BUILD PROJECTS):
1. The mission MUST be a **Syntax Debugging Challenge** focusing specifically on the syntax and structure of the target concept: "${weakConcepts.join(', ')}". Do NOT ask the student to build a project or write code from scratch.
2. Inside "starterCode", write a complete JavaScript snippet that contains exactly 2 to 4 intentional syntax errors, ReferenceErrors, TypeErrors, or logical syntax bugs specifically related to the usage, declaration, or syntax of "${weakConcepts.join(', ')}".
3. In "requirements", explicitly list the syntax rules or debugging tasks the student must solve (e.g., "Find and fix the syntax error in the parameter declaration", "Ensure the syntax follows the correct ES6 standard for this topic").
4. In "description", explain that this is a syntax debugging challenge for "${weakConcepts.join(', ')}" and describe what the code is attempting to do when correct.
5. In "evaluationRubric", set the weights for grading the corrections.

SCHEMA:
{
  "title": "string (e.g. 'Debug Syntax: [Topic Name]')",
  "description": "string (2-3 sentences describing what the code is meant to do and the syntax debugging goal)",
  "requirements": ["string (e.g., 'Identify and fix the syntax bug on line X')", "..."],
  "starterCode": "string (the code snippet containing the syntax/logical bugs)",
  "expectedConcepts": ["string (syntax rules/concepts to fix)", "..."],
  "evaluationRubric": { "logic": 30, "conceptUsage": 30, "readability": 20, "bestPractices": 20 },
  "estimatedDurationMinutes": number
}
`;
  }

  static getCodeEvaluationSystemPrompt() {
    return `You are a Senior Software Engineer evaluating a student's code submission.
Evaluate strictly on semantics, logic, and concepts, not exact string matches.
You must return ONLY a JSON object matching the requested schema.`;
  }

  static getCodeEvaluationUserPrompt(mission, submittedCode) {
    return `
MISSION CONTEXT (SYNTAX DEBUGGING CHALLENGE):
Title: ${mission.title}
Requirements: ${mission.requirements.join(', ')}
Expected Concepts: ${mission.expectedConcepts.join(', ')}

ORIGINAL BUGGY STARTER CODE:
${mission.starterCode}

SUBMITTED CODE BY STUDENT:
${submittedCode}

EVALUATION RULES:
1. Compare the SUBMITTED CODE BY STUDENT with the ORIGINAL BUGGY STARTER CODE.
2. CRITICAL RULE: If the SUBMITTED CODE BY STUDENT is identical (or almost identical, ignoring minor whitespaces/formatting) to the ORIGINAL BUGGY STARTER CODE, the student has NOT attempted the challenge. You MUST score the attempt very low (totalScore <= 15) and explicitly state in the feedback: "No changes detected. You submitted the unmodified buggy starter code. Please locate and fix the bugs before submitting."
3. Ensure the student successfully identified and corrected all syntax, structural, reference, or logical bugs in the code.
4. Verify that the final code is syntactically valid and compiles cleanly.
5. Score out of 100 based on the rubric: logic (30), conceptUsage (30), readability (20), bestPractices (20).

SCHEMA:
{
  "scores": { "logic": number, "conceptUsage": number, "readability": number, "bestPractices": number },
  "totalScore": number,
  "strengths": ["string", "..."],
  "weaknesses": ["string", "..."],
  "feedback": "string (constructive and personalized)"
}
`;
  }

  static getBossBattleSystemPrompt() {
    return `You are building a dynamic, adaptive timed quiz battle for a coding revision platform.
You must generate questions covering multiple topics and formats. 
You must return ONLY a JSON object containing an array of questions.`;
  }

  static getBossBattleUserPrompt(profile) {
    const { phase, weakConcepts, strongConcepts } = profile;
    return `
STUDENT PROFILE:
- Phase: ${phase}
- Weak concepts (prioritize heavily): ${weakConcepts.join(', ')}
- Strong concepts (include as foundation): ${strongConcepts.join(', ')}

BATTLE RULES:
1. Generate EXACTLY 15 questions.
2. Questions should progressively scale in difficulty.
3. Use a mix of types: mcq, output, fill, debug.
4. Ensure the content accurately targets the weak and strong concepts.
5. Provide clear explanations for the correct answers.

SCHEMA:
{
  "questions": [
    {
      "index": number,
      "type": "mcq" | "output" | "fill" | "debug",
      "question": "string",
      "options": ["string", "string", "string", "string"], // Only for mcq
      "correctAnswer": "string",
      "explanation": "string",
      "concept": "string",
      "difficulty": "easy" | "medium" | "hard",
      "xpValue": number (10-50 based on difficulty)
    }
  ]
}
`;
  }

  static getBossBattleEvaluationSystemPrompt() {
    return `You are a personalized AI tutor analyzing a student's performance in a Boss Battle.
Identify gaps in knowledge and suggest a revision strategy.
You must return ONLY a JSON object matching the schema.`;
  }

  static getBossBattleEvaluationUserPrompt(battle) {
    return `
BATTLE PERFORMANCE:
Total Accuracy: ${battle.accuracy}%
Average Response Time: ${battle.avgResponseTimeMs}ms
Completed Questions: ${battle.answers.length}

Evaluate the student's performance based on their accuracy and response times.
Determine which topics need immediate revision (Weak Topics).
Calculate mastery deltas (from -10 to +10) for each concept based on whether they answered correctly and how fast they answered.

SCHEMA:
{
  "weakTopics": ["string", "..."],
  "nextRevisionDays": number (1, 3, or 7),
  "masteryDeltas": { "ConceptName": number },
  "feedback": "string (personalized encouraging feedback)"
}
`;
  }
}

module.exports = PromptManager;
