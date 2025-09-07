import OpenAI from 'openai';

type Role = 'user' | 'assistant' | 'system';

export interface ChatMessage {
role: Role;
content: string;
}

interface WhatsAppParseResult {
isEvent: boolean;
eventDetails?: {
title?: string;
date?: string; // YYYY-MM-DD
time?: string; // HH:MM:SS
end_time?: string; // HH:MM:SS
location?: string;
participants?: string[];
};
}

/**

Centralized client for model interactions used by the app.

NOTE: The browser SDK is enabled via dangerouslyAllowBrowser: true.

In production, route through your own API to avoid exposing keys.
*/
const openai = new OpenAI({
apiKey: import.meta.env.VITE_OPENAI_API_KEY,
dangerouslyAllowBrowser: true
});

export class AIService {
/**

Basic chat wrapper that returns plain text.
*/
async chat(messages: ChatMessage[], model = 'gpt-4o-mini'): Promise<string> {
const resp = await openai.chat.completions.create({
model,
messages: messages.map(m => ({ role: m.role, content: m.content }))
});
const first = resp.choices?.[0]?.message?.content ?? '';
return typeof first === 'string' ? first : JSON.stringify(first);
}

/**

Parse a WhatsApp message for event details.

We instruct the model to reply ONLY with strict JSON in a fixed schema.

We then strip any stray code-fence markers and parse safely.
*/
async parseWhatsAppMessage(text: string): Promise<WhatsAppParseResult> {
const system = [
'You extract calendar event details from casual WhatsApp messages.',
'Return ONLY JSON with this shape:',
'{ "isEvent": boolean, "eventDetails": { "title": string, "date": "YYYY-MM-DD", "time": "HH:MM:SS", "end_time": "HH:MM:SS", "location": string, "participants": string[] } }',
'If no event present, return { "isEvent": false }.',
'Dates MUST be ISO (YYYY-MM-DD). Times MUST be 24h HH:MM:SS.',
'Do not include any extra commentary, just JSON.'
].join(' ');

const user = [

  'Message:',
  text
].join('\n');

const raw = await this.chat([
  { role: 'system', content: system },
  { role: 'user', content: user }
]);

// Clean common code-fence noise and parse JSON
const cleaned = raw.trim()
  .replace(/^[\s\uFEFF\u200B]+/, '')
  .replace(/^```json\s*/i, '')
  .replace(/^```\s*/i, '')
  .replace(/\s*```\s*$/i, '');

try {
  const parsed = JSON.parse(cleaned);
  // Minimal guard-rails
  if (parsed && typeof parsed.isEvent === 'boolean') {
    return parsed;
  }
} catch (e) {
  // fallthrough to default below
  console.error('parseWhatsAppMessage JSON parse error:', e, 'raw:', raw);
}
return { isEvent: false };


}
}

export const aiService = new AIService();