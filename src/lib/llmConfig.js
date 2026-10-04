/**
 * LLM Configuration
 *
 * To remove integration credit costs, this app uses Google's Gemini API
 * (free tier: 15 requests/min, 1500 requests/day — $0 cost).
 *
 * SETUP:
 * 1. Get a FREE API key from Google AI Studio: https://aistudio.google.com/apikey
 * 2. Paste it below between the quotes.
 * 3. (Recommended) In Google AI Studio, restrict the key to your app's domain
 *    (e.g. mrjudge.base44.app) so it can't be used from other sites.
 *
 * NOTE: This key is embedded in the frontend code. Restricting it to your
 * domain in Google AI Studio prevents abuse. For production use with many
 * users, upgrade to Builder+ and move this to a backend function.
 */
export const GEMINI_API_KEY = "";

/**
 * The Gemini model to use. "gemini-2.0-flash" is fast and free-tier eligible.
 */
export const GEMINI_MODEL = "gemini-2.0-flash";

/**
 * Whether the Gemini key is configured.
 */
export const isGeminiConfigured = () => GEMINI_API_KEY && GEMINI_API_KEY.length > 10;
