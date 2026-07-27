/**
 * services/ai/QuestionGenerator.js
 * Responsible for generating dynamic missions and boss battle questions.
 */

const AiService = require('./AiService');
const PromptManager = require('./PromptManager');

class QuestionGenerator {
  /**
   * Generates a new Mission with a coding task targeting weak concepts.
   * @param {Object} profile 
   * @returns {Object} Mission Data
   */
  static async generateMission(profile) {
    const systemPrompt = PromptManager.getMissionSystemPrompt();
    const userPrompt = PromptManager.getMissionUserPrompt(profile);

    const data = await AiService.callGemini(systemPrompt, userPrompt);

    if (!data) {
      // Mock Fallback if API completely fails
      return {
        title: "Task Tracker Component",
        description: "Build a responsive task tracker component. This will test your knowledge of React state and CSS flexbox.",
        requirements: [
          "Create an input field to add new tasks",
          "Display tasks in a list using CSS Flexbox",
          "Add a button to mark tasks as complete"
        ],
        starterCode: "export default function TaskTracker() {\n  return (\n    <div>\n      {/* Build your UI here */}\n    </div>\n  );\n}",
        expectedConcepts: ["React State", "CSS Flexbox"],
        evaluationRubric: { logic: 30, conceptUsage: 30, readability: 20, bestPractices: 20 },
        estimatedDurationMinutes: 12
      };
    }

    return data;
  }

  /**
   * Generates 15 dynamic questions for a Boss Battle.
   * @param {Object} profile 
   * @returns {Array} Array of questions
   */
  static async generateBossBattleQuestions(profile) {
    const systemPrompt = PromptManager.getBossBattleSystemPrompt();
    const userPrompt = PromptManager.getBossBattleUserPrompt(profile);

    const data = await AiService.callGemini(systemPrompt, userPrompt);

    // Validate and extract
    if (!data || !data.questions || !Array.isArray(data.questions) || data.questions.length === 0) {
      // Fallback
      return this._getMockBossBattleQuestions();
    }

    // Ensure indexes are correct and capped at 15
    return data.questions.slice(0, 15).map((q, i) => ({ ...q, index: i }));
  }

  static _getMockBossBattleQuestions() {
    const MOCK_QUESTIONS = [
      { type: 'mcq', question: 'What is the purpose of React useState?', options: ['A) State management', 'B) Routing', 'C) Styling', 'D) Fetching'], correctAnswer: 'A) State management', explanation: 'useState adds state variables to functional components.', concept: 'React' },
      { type: 'mcq', question: 'Which hook should you use for side effects in React?', options: ['A) useReducer', 'B) useEffect', 'C) useMemo', 'D) useContext'], correctAnswer: 'B) useEffect', explanation: 'useEffect lets you perform side effects in function components.', concept: 'React' },
      { type: 'mcq', question: 'How do you pass data from a parent component to a child component?', options: ['A) Context API', 'B) Redux', 'C) Props', 'D) State'], correctAnswer: 'C) Props', explanation: 'Props are arguments passed into React components.', concept: 'React' },
      { type: 'mcq', question: 'What is the Virtual DOM?', options: ['A) A direct copy of the actual DOM', 'B) An in-memory representation of the UI', 'C) A new HTML standard', 'D) A browser plugin'], correctAnswer: 'B) An in-memory representation of the UI', explanation: 'React keeps a lightweight representation of the UI in memory.', concept: 'React' },
      { type: 'output', question: 'What does this print?\nconsole.log(typeof null);', correctAnswer: 'object', explanation: 'In JS, typeof null is notoriously evaluated as object.', concept: 'JavaScript' },
      { type: 'fill', question: 'Fill in the blank to destructure the user object:\nconst { name, age } = _______;', correctAnswer: 'user', explanation: 'You destructure from the object itself.', concept: 'JavaScript' },
      { type: 'mcq', question: 'What is the CSS display property used for creating flexible layouts?', options: ['A) grid', 'B) flex', 'C) block', 'D) inline-block'], correctAnswer: 'B) flex', explanation: 'Flexbox is used for 1D flexible layouts.', concept: 'CSS' },
      { type: 'mcq', question: 'Which array method creates a new array with the results of calling a function for every array element?', options: ['A) filter()', 'B) map()', 'C) reduce()', 'D) forEach()'], correctAnswer: 'B) map()', explanation: 'map() creates a new array populated with the results.', concept: 'JavaScript' },
      { type: 'mcq', question: 'In JavaScript, what is the output of: "2" + 2?', options: ['A) 4', 'B) 22', 'C) NaN', 'D) undefined'], correctAnswer: 'B) 22', explanation: 'The number is coerced to a string and concatenated.', concept: 'JavaScript' },
      { type: 'mcq', question: 'What does CSS stand for?', options: ['A) Cascading Style Sheets', 'B) Creative Style System', 'C) Computer Style Sheets', 'D) Colorful Style Sheets'], correctAnswer: 'A) Cascading Style Sheets', explanation: 'CSS describes how HTML elements are displayed.', concept: 'CSS' },
      { type: 'fill', question: 'Which CSS property is used to change the background color?\n_________: #ffffff;', correctAnswer: 'background-color', explanation: 'background-color sets the background color of an element.', concept: 'CSS' },
      { type: 'output', question: 'What does this array method return?\n[1, 2, 3].includes(2);', correctAnswer: 'true', explanation: 'includes() determines whether an array includes a certain value.', concept: 'JavaScript' },
      { type: 'debug', question: 'Find the bug:\nfunction add(a, b) {\n  return a - b;\n}', correctAnswer: 'return a + b;', explanation: 'An addition function should add, not subtract.', concept: 'JavaScript' },
      { type: 'mcq', question: 'What is a Closure in JavaScript?', options: ['A) A function having access to the parent scope', 'B) Closing a browser tab', 'C) An enclosed JSON object', 'D) A locked API endpoint'], correctAnswer: 'A) A function having access to the parent scope', explanation: 'Closures give you access to an outer functions scope from an inner function.', concept: 'JavaScript' },
      { type: 'mcq', question: 'Which HTML tag is used for the largest heading?', options: ['A) <heading>', 'B) <h6>', 'C) <h1>', 'D) <head>'], correctAnswer: 'C) <h1>', explanation: '<h1> defines the most important/largest heading.', concept: 'HTML' }
    ];
    
    // Shuffle and pick 15
    const shuffled = MOCK_QUESTIONS.sort(() => 0.5 - Math.random());
    return shuffled.slice(0, 15).map((q, i) => ({
      ...q,
      index: i,
      difficulty: 'medium',
      xpValue: 20
    }));
  }
}

module.exports = QuestionGenerator;
