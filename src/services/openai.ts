import OpenAI from 'openai';

type Role = 'user' | 'assistant' | 'system';

export interface ChatMessage {
role: Role;
content: string;
}

/**

Centralized client for model interactions used by the app.

NOTE: In production you should proxy requests via your own backend or Supabase Edge Functions.

We keep browser SDK enabled for local development convenience.
*/
const openai = new OpenAI({
apiKey: import.meta.env.VITE_OPENAI_API_KEY,
// WARNING: Exposes your key in the browser. Replace with server proxy in production.
dangerouslyAllowBrowser: true,
});

export class AIService {
/** Basic chat wrapper that returns plain text. */
async chat(messages: ChatMessage[], model = 'gpt-4o-mini'): Promise<string> {
try {
if (!import.meta.env.VITE_OPENAI_API_KEY) {
throw new Error('Missing VITE_OPENAI_API_KEY');
}
const resp = await openai.chat.completions.create({
model,
messages: messages.map(m => ({ role: m.role, content: m.content })),
temperature: 0.2,
});
const first = resp.choices?.[0]?.message?.content ?? '';
return typeof first === 'string' ? first : JSON.stringify(first);
} catch (err: any) {
// Surface the error message to callers so they can fall back gracefully.
const msg = err?.message || 'OpenAI request failed';
console.error('[aiService.chat] error:', msg);
throw new Error(msg);
}
}
}

export const aiService = new AIService();