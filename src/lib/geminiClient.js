import { GEMINI_API_KEY, GEMINI_MODEL } from './llmConfig';

/**
 * Calls Google Gemini's free-tier API to generate content.
 * Returns the text response from the model.
 *
 * @param {string} prompt - The prompt to send to the model
 * @param {Object} jsonSchema - Optional JSON schema for structured output
 * @returns {Promise<Object|string>} Parsed JSON object if jsonSchema provided, otherwise text string
 */
export async function callGemini(prompt, jsonSchema = null) {
  if (!GEMINI_API_KEY) {
    throw new Error('Gemini API key not configured. Add your free key in src/lib/llmConfig.js');
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

  const body = {
    contents: [
      {
        parts: [{ text: prompt }]
      }
    ],
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 2048
    }
  };

  // Use structured output if a JSON schema is provided
  if (jsonSchema) {
    body.generationConfig.responseMimeType = 'application/json';
    body.generationConfig.responseSchema = jsonSchema;
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini API error (${response.status}): ${errorText}`);
  }

  const data = await response.json();

  // Extract text from response
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!text) {
    throw new Error('Gemini returned no content');
  }

  // If JSON schema was provided, parse the response
  if (jsonSchema) {
    try {
      return JSON.parse(text);
    } catch (e) {
      // Try to extract JSON from the text
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      throw new Error('Failed to parse JSON response from Gemini');
    }
  }

  return text;
}