import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY!,
});

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { prompt, actionType } = req.body;
  if (!prompt) {
    return res.status(400).json({ error: 'Missing prompt' });
  }

  // Set SSE headers for real-time token streaming
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const model = 'gemini-3.1-flash-lite'; // Simplify to one model for now, can add retry logic if needed

  try {
    const responseStream = await ai.models.generateContentStream({
      model,
      contents: prompt,
      config: actionType === 'quiz' || actionType === 'flashcards' 
        ? { responseMimeType: 'application/json' }
        : undefined
    });

    for await (const chunk of responseStream) {
      const text = chunk.text || '';
      if (text) {
        res.write(`data: ${JSON.stringify({ text })}\n\n`);
      }
    }
    res.write('data: [DONE]\n\n');
    res.end();
  } catch (err: any) {
    console.error('Gemini failed:', err);
    res.write(`data: ${JSON.stringify({ error: err?.message || 'AI request failed.' })}\n\n`);
    res.end();
  }
}
