// Vercel Function (Node.js runtime, Web Standard `fetch` export - see
// https://vercel.com/docs/functions/runtimes/node-js#create-a-node.js-function-in-/api).
// Lives at the project root's /api directory - Vercel does not read
// /functions/api the way Cloudflare Pages does, which is why this endpoint
// was 404ing under that structure. request.formData() is a standard Web API
// method, so no extra multipart-parsing library is needed here.
//
// Proxies audio transcription to Groq's free Whisper Large v3 endpoint
// (strong multilingual accuracy, including Persian).
const corsHeaders = (origin) => ({
  'Access-Control-Allow-Origin': origin || '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age': '86400',
});

export default {
  async fetch(request) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(request.headers.get('Origin')) });
    }

    if (request.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    try {
      const incomingForm = await request.formData();
      const audioFile = incomingForm.get('audio');
      const language = incomingForm.get('language') || undefined;

      if (!audioFile) {
        return new Response(JSON.stringify({ error: 'no audio file provided' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      const groqForm = new FormData();
      // Use the filename the browser actually sent (VoiceButton.jsx names it to
      // match the real recorded format) instead of hardcoding .webm - Whisper
      // needs the extension to match the container format to decode it correctly.
      const filename = audioFile.name && /\.[a-z0-9]+$/i.test(audioFile.name) ? audioFile.name : 'audio.webm';
      groqForm.append('file', audioFile, filename);
      groqForm.append('model', 'whisper-large-v3');
      if (language) groqForm.append('language', language);

      const groqResponse = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
        },
        body: groqForm,
      });

      if (!groqResponse.ok) {
        const errText = await groqResponse.text();
        return new Response(JSON.stringify({ error: errText }), {
          status: groqResponse.status,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      const data = await groqResponse.json();
      return new Response(JSON.stringify({ text: data.text || '' }), {
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (err) {
      return new Response(JSON.stringify({ error: String(err) }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  },
};
