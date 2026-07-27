/**
 * services/ai/EvaluationEngine.js
 * Responsible for semantic evaluation of user submissions (Missions and Boss Battles).
 */

const AiService = require('./AiService');
const PromptManager = require('./PromptManager');

class EvaluationEngine {
  /**
   * Evaluates a Mission code submission.
   * @param {Object} mission 
   * @param {string} submittedCode 
   * @returns {Object} Evaluation Results
   */
  static async evaluateCode(mission, submittedCode) {
    const cleanStarter = (mission?.starterCode || '').replace(/\s+/g, '');
    const cleanSubmitted = (submittedCode || '').replace(/\s+/g, '');

    if (cleanSubmitted === cleanStarter) {
      return {
        scores: { logic: 0, conceptUsage: 0, readability: 10, bestPractices: 0 },
        totalScore: 10,
        strengths: [],
        weaknesses: ["Unmodified starter code submitted", "No debugging changes made"],
        feedback: "No changes detected. You submitted the unmodified buggy starter code. Please locate and fix the syntax errors before submitting!"
      };
    }

    const systemPrompt = PromptManager.getCodeEvaluationSystemPrompt();
    const userPrompt = PromptManager.getCodeEvaluationUserPrompt(mission, submittedCode);

    const data = await AiService.callGemini(systemPrompt, userPrompt);

    if (!data || !data.scores) {
      return this._getMockCodeEvaluation(mission, submittedCode);
    }

    return data;
  }

  /**
   * Evaluates a Boss Battle performance.
   * @param {Object} battle 
   * @returns {Object} Boss Battle Evaluation Results
   */
  static async evaluateBossBattle(battle) {
    const systemPrompt = PromptManager.getBossBattleEvaluationSystemPrompt();
    const userPrompt = PromptManager.getBossBattleEvaluationUserPrompt(battle);

    const data = await AiService.callGemini(systemPrompt, userPrompt);

    if (!data || !data.nextRevisionDays) {
      return this._getMockBossBattleEvaluation();
    }

    return data;
  }

  static _getMockCodeEvaluation(mission, submittedCode) {
    const isUnchanged = !submittedCode || 
      submittedCode.trim() === (mission?.starterCode || '').trim() ||
      submittedCode.length < 50;

    if (isUnchanged) {
      return {
        scores: { logic: 0, conceptUsage: 0, readability: 10, bestPractices: 0 },
        totalScore: 10,
        strengths: [],
        weaknesses: ["No changes detected", "Unmodified buggy starter code submitted"],
        feedback: "No changes detected. You submitted the unmodified buggy starter code. Please locate and fix the syntax errors before submitting!"
      };
    } else {
      return {
        scores: { logic: 25, conceptUsage: 25, readability: 15, bestPractices: 15 },
        totalScore: 80,
        strengths: ["Bugs corrected successfully", "Correct syntax structures applied"],
        weaknesses: ["Could improve comments"],
        feedback: "Great job! You found and corrected the syntax bugs."
      };
    }
  }

  static _getMockBossBattleEvaluation() {
    return {
      weakTopics: ["React", "CSS"],
      nextRevisionDays: 3,
      masteryDeltas: { "React": 5, "CSS": -2 },
      feedback: "You did great on HTML, but React needs a bit more work. Keep pushing!"
    };
  }
}

module.exports = EvaluationEngine;
