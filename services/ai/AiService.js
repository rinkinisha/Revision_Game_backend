/**
 * services/ai/AiService.js
 * Core Communication Layer for LLMs.
 * Handles API calls, retries, JSON validation, and error recovery.
 */

class AiService {
  /**
   * Helper: parses JSON strings even if wrapped in markdown blocks.
   */
  static parseJsonContent(text) {
    const cleanText = text.trim();
    const jsonMatch = cleanText.match(/```json\s*([\s\S]*?)\s*```/) ||
                      cleanText.match(/```\s*([\s\S]*?)\s*```/) ||
                      [null, cleanText];
    const jsonStr = jsonMatch[1].trim();
    return JSON.parse(jsonStr);
  }

  /**
   * Calls the Groq API (Primary provider).
   */
  static async callGroq(systemPrompt, userPrompt, useJson) {
    if (!process.env.GROQ_API_KEY) {
      throw new Error('GROQ_API_KEY is not set in environment variables.');
    }

    const payload = {
      model: 'llama-3.1-8b-instant',
      temperature: 0.85,
      top_p: 0.9,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ]
    };

    if (useJson) {
      payload.response_format = { type: 'json_object' };
    }

    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errData = await res.text();
      throw new Error(`Groq HTTP ${res.status}: ${errData}`);
    }

    const data = await res.json();
    return data.choices?.[0]?.message?.content || '';
  }

  /**
   * Calls the OpenRouter API (Fallback provider).
   */
  static async callOpenRouter(systemPrompt, userPrompt, useJson) {
    if (!process.env.OPENROUTER_API_KEY) {
      throw new Error('OPENROUTER_API_KEY is not set in environment variables.');
    }

    const payload = {
      model: 'meta-llama/llama-3.3-70b-instruct:free',
      temperature: 0.85,
      top_p: 0.9,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ]
    };

    if (useJson) {
      payload.response_format = { type: 'json_object' };
    }

    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'HTTP-Referer': 'http://localhost:5173',
        'X-Title': 'Revision OS',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errData = await res.text();
      throw new Error(`OpenRouter HTTP ${res.status}: ${errData}`);
    }

    const data = await res.json();
    return data.choices?.[0]?.message?.content || '';
  }

  /**
   * Unified entry point with auto-failover.
   */
  static async callLLM(systemPrompt, userPrompt, useJson = true, attempt = 1) {
    try {
      // 1. Try Groq (Primary)
      try {
        console.log(`🤖 [AiService] Trying primary provider (Groq)...`);
        const text = await this.callGroq(systemPrompt, userPrompt, useJson);
        return useJson ? this.parseJsonContent(text) : text;
      } catch (groqErr) {
        console.warn(`⚠️ [AiService] Groq failed: ${groqErr.message}. Trying fallback (OpenRouter)...`);
        
        // 2. Try OpenRouter (Fallback)
        const text = await this.callOpenRouter(systemPrompt, userPrompt, useJson);
        return useJson ? this.parseJsonContent(text) : text;
      }
    } catch (err) {
      const maxRetries = 2;
      if (attempt < maxRetries) {
        console.warn(`⚠️ [AiService] LLM call failed: ${err.message}. Retrying main flow (Attempt ${attempt + 1}/${maxRetries})...`);
        await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
        return this.callLLM(systemPrompt, userPrompt, useJson, attempt + 1);
      }
      
      console.error(`❌ [AiService] All AI providers failed. Returning fallback null.`);
      return null;
    }
  }

  /**
   * Backwards-compatible wrapper.
   */
  static async callGemini(systemPrompt, userPrompt) {
    return this.callLLM(systemPrompt, userPrompt, true);
  }
}

module.exports = AiService;
