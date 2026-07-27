const axios = require('axios');
const SyncConfig = require('../models/SyncConfig');

class GeminiService {
  /**
   * Extracts technical educational topics from a reflection text using Gemini API
   * @param {string} reflectionText - The student reflection text
   * @param {string} [overrideKey] - Optional override for Gemini API Key
   * @returns {Promise<Array>} List of extracted topics containing { title, subtopics }
   */
  static async extractTopics(reflectionText, overrideKey = '') {
    if (!reflectionText || !reflectionText.trim()) {
      return [];
    }

    // 1. Resolve API key
    let apiKey = overrideKey;
    if (!apiKey) {
      apiKey = process.env.GEMINI_API_KEY;
    }
    if (!apiKey) {
      // Fallback: load from database config
      const config = await SyncConfig.findOne();
      if (config && config.geminiApiKey) {
        apiKey = config.geminiApiKey;
      }
    }

    if (!apiKey) {
      console.warn('⚠️ [GeminiService] No Gemini API key found in args, env, or database config.');
      return [];
    }

    const systemPrompt = `You are a technical education assistant. Analyze the student's reflection text and extract any learning topics, technologies, programming concepts, frameworks, libraries, algorithms, tools, data structures, or languages they studied.
Only extract educational and technical concepts. Ignore normal conversational English words.
For each topic, provide a list of relevant subtopics mentioned.
Return ONLY valid JSON in the exact format shown below:
{
  "topics": [
    {
      "title": "React Hooks",
      "subtopics": ["useState", "useEffect"]
    }
  ]
}
CRITICAL RULES:
- Never return markdown backticks like \`\`\`json or \`\`\`.
- Never return explanation or prologue.
- Return ONLY the raw JSON string starting with { and ending with }.`;

    const userPrompt = `Student Reflection:\n"${reflectionText}"`;

    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
      
      const payload = {
        contents: [
          {
            role: 'user',
            parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }]
          }
        ],
        generationConfig: {
          responseMimeType: 'application/json'
        }
      };

      const response = await axios.post(url, payload, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 10000
      });

      const rawText = response.data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!rawText) {
        throw new Error('Empty response from Gemini API');
      }

      // Parse JSON safely
      const cleanText = rawText.replace(/```json|```/g, '').trim();
      const parsed = JSON.parse(cleanText);
      
      if (parsed && Array.isArray(parsed.topics)) {
        return parsed.topics;
      }
      return [];
    } catch (err) {
      console.error('❌ [GeminiService] Extraction failed:', err.message);
      return [];
    }
  }
}

module.exports = GeminiService;
