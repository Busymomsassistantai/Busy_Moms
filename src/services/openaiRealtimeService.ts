import { aiAssistantService } from './aiAssistantService';
import { supabase } from "../lib/supabase";

// Fallback minimal speech types (safe for TS projects without full lib.dom)
interface MinimalSpeechResult { transcript: string }
interface MinimalSpeechEvent { results?: Array<Array<MinimalSpeechResult>> }
interface MinimalSpeechErrorEvent { error?: string }
interface MinimalSpeechRecognition {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: (event: MinimalSpeechEvent) => void;
  onerror?: (e: MinimalSpeechErrorEvent) => void;
  onend?: () => void;
  start: () => void;
  stop: () => void;
}
type SpeechRecognitionCtor = new () => MinimalSpeechRecognition;
type WindowSpeech = { SpeechRecognition?: SpeechRecognitionCtor; webkitSpeechRecognition?: SpeechRecognitionCtor };

export interface OpenAIRealtimeConfig {
  model: string;
  wakeWord?: string; // e.g. "hey sara"
  vadThreshold?: number; // amplitude gate
  voice?: 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer';
  instructions?: string;
}

export interface RealtimeEvent {
  type: string;
  [key: string]: unknown;
}

class Emitter {
  private listeners = new Map<string, Array<(ev: RealtimeEvent) => void>>();
  on(type: string, fn: (ev: RealtimeEvent) => void) {
    const arr = this.listeners.get(type) || [];
    arr.push(fn);
    this.listeners.set(type, arr);
  }
  off(type: string, fn: (ev: RealtimeEvent) => void) {
    const arr = this.listeners.get(type) || [];
    this.listeners.set(type, arr.filter(f => f !== fn));
  }
  emit(ev: RealtimeEvent) {
    const arr = this.listeners.get(ev.type) || [];
    for (const f of arr) f(ev);
  }
}

const RTC_URL = import.meta.env.VITE_OPENAI_REALTIME_URL as string | undefined;
const EPHEMERAL_URL = import.meta.env.VITE_OPENAI_EPHEMERAL_URL as string | undefined;
const FUNCTIONS_BASE = String(import.meta.env.VITE_FUNCTIONS_URL ?? '').replace(/\/+$/, '');
const SUPABASE_URL = String(import.meta.env.VITE_SUPABASE_URL ?? '').replace(/\/+$/, '');

export class OpenAIRealtimeService extends Emitter {
  private pc?: RTCPeerConnection;
  private dc?: RTCDataChannel;
  private micStream?: MediaStream;
  private audioEl?: HTMLAudioElement;
  private recognition?: MinimalSpeechRecognition;
  private wakeWordRecognition?: MinimalSpeechRecognition;
  private vadThreshold: number;
  private buffer: Float32Array[] = [];
  private currentUserId?: string;
  private connected = false;
  private lastTokenFetchError?: string;
  private sessionConfigured = false;
  private pendingFunctionCalls = new Map<string, any>();

  // Callbacks required by UI
  private onEventCb?: (event: RealtimeEvent) => void;
  private onConnStateCb?: (state: RTCPeerConnectionState) => void;
  private onWakeWordDetectedCb?: () => void;
  private isListeningForWakeWordFlag = false;

  constructor(private config: OpenAIRealtimeConfig) {
    super();
    this.vadThreshold = config.vadThreshold ?? 0.03;
  }

  // == Public API expected by UI ==
  onEvent(cb: (event: RealtimeEvent) => void) { this.onEventCb = cb; }
  offEvent(_cb?: (event: RealtimeEvent) => void) { this.onEventCb = undefined; } // single-subscriber is fine here
  onConnectionStateChange(cb: (state: RTCPeerConnectionState) => void) { this.onConnStateCb = cb; }
  onWakeWordDetected(cb: () => void) { this.onWakeWordDetectedCb = cb; }

  isSupported(): boolean { return typeof RTCPeerConnection !== 'undefined'; }
  isConnected(): boolean { return this.connected; }
  getAudioElement(): HTMLAudioElement | undefined { return this.audioEl; }

  async initialize(userId: string) {
    this.currentUserId = userId;
    await this.connectRealtime();
    await this.startWakeWordDetection();
  }

  async startConversation() { await this.startRecording(); }
  async stopConversation() { this.stopRecording(); }
  async disconnect() { await this.disconnectRealtime(); }
  async mute() { if (this.micStream) this.micStream.getAudioTracks().forEach(t => (t.enabled = false)); }
  async unmute() { if (this.micStream) this.micStream.getAudioTracks().forEach(t => (t.enabled = true)); }
  async interrupt() { this.buffer = []; }

  sendMessage(text: string) {
    if (!this.dc || this.dc.readyState !== 'open') {
      console.error('❌ Data channel not ready');
      return;
    }
    console.log('📤 Sending text message:', text);
    const event = {
      type: 'conversation.item.create',
      item: {
        type: 'message',
        role: 'user',
        content: [{ type: 'input_text', text }]
      }
    };
    this.dc.send(JSON.stringify(event));
    this.dc.send(JSON.stringify({ type: 'response.create' }));
  }

  // == Internals ==
  private emitUI(event: RealtimeEvent) { this.onEventCb?.(event); this.emit(event); }
  private emitConn(state: RTCPeerConnectionState) { this.onConnStateCb?.(state); this.emitUI({ type: 'connection.state', state }); }

  private getFunctionTools() {
    return [
      {
        type: 'function',
        name: 'create_calendar_event',
        description: 'Create a new calendar event/meeting/appointment',
        parameters: {
          type: 'object',
          properties: {
            title: { type: 'string', description: 'The title/name of the event' },
            date: { type: 'string', description: 'The date in YYYY-MM-DD format or natural language like "today", "tomorrow"' },
            start_time: { type: 'string', description: 'The start time in HH:MM format or natural language like "2pm", "14:30"' },
            end_time: { type: 'string', description: 'The end time in HH:MM format or natural language like "3pm", "15:30"' },
            location: { type: 'string', description: 'The location of the event' },
            participants: { type: 'array', items: { type: 'string' }, description: 'List of participants' }
          },
          required: ['title', 'date']
        }
      },
      {
        type: 'function',
        name: 'query_calendar',
        description: 'Query the calendar for events or check availability',
        parameters: {
          type: 'object',
          properties: {
            query_type: {
              type: 'string',
              enum: ['today', 'week', 'availability', 'search', 'next'],
              description: 'Type of query: today (today\'s events), week (upcoming events), availability (check if free), search (find specific events), next (next upcoming event)'
            },
            date: { type: 'string', description: 'Date to check (for availability queries)' },
            search_term: { type: 'string', description: 'Search term to find events (for search queries)' }
          },
          required: ['query_type']
        }
      },
      {
        type: 'function',
        name: 'update_calendar_event',
        description: 'Update an existing calendar event',
        parameters: {
          type: 'object',
          properties: {
            search_term: { type: 'string', description: 'Term to find the event to update' },
            updates: {
              type: 'object',
              properties: {
                date: { type: 'string', description: 'New date' },
                start_time: { type: 'string', description: 'New start time' },
                end_time: { type: 'string', description: 'New end time' },
                location: { type: 'string', description: 'New location' },
                title: { type: 'string', description: 'New title' }
              }
            }
          },
          required: ['search_term', 'updates']
        }
      },
      {
        type: 'function',
        name: 'delete_calendar_event',
        description: 'Delete a calendar event',
        parameters: {
          type: 'object',
          properties: {
            search_term: { type: 'string', description: 'Term to find the event to delete' },
            date: { type: 'string', description: 'Date of the event (optional, helps narrow down)' }
          },
          required: ['search_term']
        }
      },
      {
        type: 'function',
        name: 'create_reminder',
        description: 'Set a reminder for a specific date and time',
        parameters: {
          type: 'object',
          properties: {
            title: { type: 'string', description: 'What to be reminded about' },
            date: { type: 'string', description: 'Date for the reminder' },
            time: { type: 'string', description: 'Time for the reminder' }
          },
          required: ['title', 'date']
        }
      },
      {
        type: 'function',
        name: 'add_shopping_item',
        description: 'Add an item to the shopping list',
        parameters: {
          type: 'object',
          properties: {
            title: { type: 'string', description: 'The item to add' },
            category: {
              type: 'string',
              enum: ['dairy', 'produce', 'meat', 'bakery', 'baby', 'household', 'other'],
              description: 'Category of the item'
            },
            quantity: { type: 'number', description: 'How many to buy' }
          },
          required: ['title']
        }
      }
    ];
  }

  private configureSession() {
    if (!this.dc || this.dc.readyState !== 'open' || this.sessionConfigured) return;

    console.log('⚙️ Configuring OpenAI Realtime session with function tools');

    const sessionConfig = {
      type: 'session.update',
      session: {
        modalities: ['text', 'audio'],
        instructions: this.config.instructions,
        voice: this.config.voice || 'alloy',
        input_audio_format: 'pcm16',
        output_audio_format: 'pcm16',
        input_audio_transcription: {
          model: 'whisper-1'
        },
        turn_detection: {
          type: 'server_vad',
          threshold: 0.5,
          prefix_padding_ms: 300,
          silence_duration_ms: 500
        },
        tools: this.getFunctionTools(),
        tool_choice: 'auto',
        temperature: 0.8
      }
    };

    this.dc.send(JSON.stringify(sessionConfig));
    this.sessionConfigured = true;
    console.log('✅ Session configured with function tools');
  }

  /** Build a list of candidate URLs for the ephemeral token endpoint. */
  private buildTokenUrlCandidates(): string[] {
    const urls: string[] = [];
    if (EPHEMERAL_URL) urls.push(EPHEMERAL_URL);
    if (FUNCTIONS_BASE) {
      urls.push(
        `${FUNCTIONS_BASE}/openai-token`,
        `${FUNCTIONS_BASE}/webrtc-token`,
        `${FUNCTIONS_BASE}/realtime-token`,
        `${FUNCTIONS_BASE}/functions/v1/openai-token`,
        `${FUNCTIONS_BASE}/functions/v1/webrtc-token`,
        `${FUNCTIONS_BASE}/functions/v1/realtime-token`,
      );
    }
    if (SUPABASE_URL) {
      urls.push(
        `${SUPABASE_URL}/functions/v1/openai-token`,
        `${SUPABASE_URL}/functions/v1/webrtc-token`,
        `${SUPABASE_URL}/functions/v1/realtime-token`,
      );
    }
    // Netlify Functions convention
    urls.push(
      '/.netlify/functions/openai-token',
      '/.netlify/functions/webrtc-token',
      '/.netlify/functions/realtime-token',
    );
    // Local fallbacks (dev proxy, custom API, etc.)
    urls.push(
      '/openai-token',
      '/webrtc-token',
      '/realtime-token',
      '/api/openai-token',
      '/api/webrtc-token',
      '/api/realtime-token'
    );
    return Array.from(new Set(urls));
  }

  /** Attempt JSON POST to each candidate; require JSON content-type; return parsed JSON. */
  private async fetchJsonFirst(body: unknown): Promise<any> {
    const candidates = this.buildTokenUrlCandidates();
    const authHeader: Record<string, string> = {};
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.access_token) authHeader.Authorization = `Bearer ${session.access_token}`;
    } catch { /* optional; ignore */ }

    const tried: string[] = [];
    for (const url of candidates) {
      try {
        const resp = await fetch(url, {
          method: 'POST',
          headers: { 'content-type': 'application/json', ...authHeader },
          body: JSON.stringify(body ?? {}),
        });
        tried.push(`${url} -> ${resp.status}`);
        const ct = resp.headers.get('content-type') || '';
        if (!resp.ok) continue;
        if (!ct.includes('application/json')) continue;
        return await resp.json();
      } catch (e) {
        tried.push(`${url} -> ${e instanceof Error ? e.message : String(e)}`);
        continue;
      }
    }
    this.lastTokenFetchError = `Tried: ${tried.join(' | ')}`;
    throw new Error(`No valid token endpoint responded with JSON. ${this.lastTokenFetchError}`);
  }

  /** Extract the ephemeral key from commonly used JSON shapes. */
  private extractEphemeralKey(json: any): string {
    return json?.client_secret?.value || json?.value || json?.token || '';
  }

  async startWakeWordDetection() {
    const SpeechRecognitionCtor =
      (window as unknown as WindowSpeech).SpeechRecognition ||
      (window as unknown as WindowSpeech).webkitSpeechRecognition;
    if (!SpeechRecognitionCtor) return;

    this.wakeWordRecognition = new SpeechRecognitionCtor();
    this.wakeWordRecognition.continuous = true;
    this.wakeWordRecognition.interimResults = false;
    this.wakeWordRecognition.lang = 'en-US';
    const wake = (this.config.wakeWord || 'hey sara').toLowerCase();

    this.wakeWordRecognition.onresult = (event: MinimalSpeechEvent) => {
      const results = (event as unknown as { results?: Array<Array<{ transcript: string }>> }).results || [];
      for (const result of results) {
        const transcript = (result?.[0]?.transcript || '').toLowerCase();
        if (transcript.includes(wake)) {
          this.onWakeWordDetectedCb?.();
          this.startRecording().catch(e => {
            this.emitUI({ type: 'assistant.error', message: e instanceof Error ? e.message : String(e) });
          });
          break;
        }
      }
    };
    this.wakeWordRecognition.onerror = () => { /* ignore */ };
    this.wakeWordRecognition.onend = () => { if (this.isListeningForWakeWordFlag) this.startWakeWordDetection(); };
    this.wakeWordRecognition.start();
    this.isListeningForWakeWordFlag = true;
  }

  stopWakeWordDetection() {
    this.isListeningForWakeWordFlag = false;
    this.wakeWordRecognition?.stop();
    this.wakeWordRecognition = undefined;
  }

  async startRecording() {
    console.log('🎤 Starting recording (audio is handled by OpenAI Realtime API)');
    this.emitUI({ type: 'recording.started' });
  }

  stopRecording() {
    console.log('🛑 Stopping recording');
    this.emitUI({ type: 'recording.stopped' });
  }

  async connectRealtime() {
    if (this.pc) return;

    // Acquire ephemeral key from your backend (Edge Function/Server), trying multiple candidates.
    const tokenJson = await this.fetchJsonFirst({ userId: this.currentUserId || 'anonymous', roomId: 'default' });
    const EPHEMERAL_KEY = this.extractEphemeralKey(tokenJson);
    if (!EPHEMERAL_KEY) throw new Error('Token endpoint JSON missing client_secret.value/token');

    this.pc = new RTCPeerConnection();
    this.pc.onconnectionstatechange = () => {
      const s = this.pc!.connectionState;
      this.connected = (s === 'connected');
      this.emitConn(s);
    };

    // Mic
    this.micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    this.micStream.getTracks().forEach((t) => this.pc!.addTrack(t, this.micStream!));

    // Remote audio
    const audioEl = document.createElement('audio');
    audioEl.autoplay = true;
    this.audioEl = audioEl;
    this.pc.ontrack = (e) => { this.audioEl!.srcObject = e.streams[0]; };

    // Data channel
    this.dc = this.pc.createDataChannel('oai-events');
    this.dc.onopen = () => {
      console.log('✅ Data channel opened');
      this.configureSession();
    };
    this.dc.onmessage = async (ev) => {
      try {
        const event = JSON.parse(ev.data);
        console.log('📨 Received OpenAI event:', event.type, event);
        this.emitUI({ type: event.type, ...event });
        await this.handleOpenAIEvent(event);
      } catch (e) {
        console.error('❌ Failed to parse data channel message:', e);
      }
    };

    // SDP exchange
    const offer = await this.pc.createOffer();
    await this.pc.setLocalDescription(offer);

    if (!offer.sdp) throw new Error('Failed to create SDP offer.');
    const resp = await fetch(`${(RTC_URL || 'https://api.openai.com/v1/realtime')}?model=${this.config.model}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${EPHEMERAL_KEY}`,
        'Content-Type': 'application/sdp',
      },
      body: offer.sdp,
    });
    if (!resp.ok) throw new Error(`Realtime connect failed: ${resp.status} ${resp.statusText}`);

    await this.pc.setRemoteDescription({ type: 'answer', sdp: await resp.text() });
    this.emitUI({ type: 'realtime.connected' });
  }

  async disconnectRealtime() {
    if (this.pc) {
      this.pc.close();
      this.pc = undefined;
      this.dc = undefined;
      this.emitUI({ type: 'realtime.disconnected' });
    }
    this.stopRecording();
    this.stopWakeWordDetection();
    this.connected = false;
    this.audioEl = undefined;
  }

  async processUserText(message: string) {
    try {
      const result = await aiAssistantService.processUserMessage(message, this.currentUserId!);
      this.emitUI({ type: 'assistant.action', data: result });
    } catch (e: unknown) {
      this.emitUI({ type: 'assistant.error', message: (e instanceof Error ? e.message : String(e)) || 'Action failed' });
    }
  }

  private async handleOpenAIEvent(event: any) {
    switch (event.type) {
      case 'session.created':
      case 'session.updated':
        console.log('✅ Session ready:', event.type);
        break;

      case 'conversation.item.created':
        console.log('💬 Conversation item:', event.item);
        break;

      case 'response.function_call_arguments.delta':
        if (event.call_id) {
          const existing = this.pendingFunctionCalls.get(event.call_id) || { name: event.name, arguments: '' };
          existing.arguments += event.delta || '';
          this.pendingFunctionCalls.set(event.call_id, existing);
        }
        break;

      case 'response.function_call_arguments.done':
        if (event.call_id) {
          const call = this.pendingFunctionCalls.get(event.call_id);
          if (call) {
            await this.executeFunctionCall(event.call_id, call.name || event.name, call.arguments || event.arguments);
            this.pendingFunctionCalls.delete(event.call_id);
          }
        }
        break;

      case 'response.done':
        console.log('✅ Response completed');
        break;

      case 'error':
        console.error('❌ OpenAI error:', event.error);
        this.emitUI({ type: 'error', error: event.error });
        break;
    }
  }

  private async executeFunctionCall(callId: string, functionName: string, argsJson: string) {
    console.log('🔧 Executing function:', functionName, 'with args:', argsJson);

    try {
      const args = JSON.parse(argsJson);
      let result: any;

      switch (functionName) {
        case 'create_calendar_event':
          result = await this.handleCreateCalendarEvent(args);
          break;
        case 'query_calendar':
          result = await this.handleQueryCalendar(args);
          break;
        case 'update_calendar_event':
          result = await this.handleUpdateCalendarEvent(args);
          break;
        case 'delete_calendar_event':
          result = await this.handleDeleteCalendarEvent(args);
          break;
        case 'create_reminder':
          result = await this.handleCreateReminder(args);
          break;
        case 'add_shopping_item':
          result = await this.handleAddShoppingItem(args);
          break;
        default:
          result = { success: false, message: `Unknown function: ${functionName}` };
      }

      this.sendFunctionResult(callId, result);
    } catch (e) {
      console.error('❌ Function execution error:', e);
      this.sendFunctionResult(callId, {
        success: false,
        message: `Error: ${e instanceof Error ? e.message : String(e)}`
      });
    }
  }

  private sendFunctionResult(callId: string, result: any) {
    if (!this.dc || this.dc.readyState !== 'open') return;

    console.log('📤 Sending function result for', callId, ':', result);

    const outputMessage = result.message || JSON.stringify(result);

    const event = {
      type: 'conversation.item.create',
      item: {
        type: 'function_call_output',
        call_id: callId,
        output: outputMessage
      }
    };

    this.dc.send(JSON.stringify(event));
    this.dc.send(JSON.stringify({ type: 'response.create' }));
  }

  private async handleCreateCalendarEvent(args: any) {
    console.log('📅 Voice AI creating calendar event with args:', args);

    const details: Record<string, unknown> = {
      title: args.title,
      date: args.date,
      start_time: args.start_time || args.time,
      end_time: args.end_time,
      location: args.location,
      participants: args.participants
    };

    return await aiAssistantService.createCalendarEvent(details, this.currentUserId!);
  }

  private async handleQueryCalendar(args: any) {
    let message = '';
    switch (args.query_type) {
      case 'today':
        message = "what's on my calendar today";
        break;
      case 'week':
        message = "what's on my calendar this week";
        break;
      case 'availability':
        message = `am I free on ${args.date}`;
        break;
      case 'search':
        message = `find ${args.search_term} on my calendar`;
        break;
      case 'next':
        message = "what's my next event";
        break;
    }
    return await aiAssistantService.processUserMessage(message, this.currentUserId!);
  }

  private async handleUpdateCalendarEvent(args: any) {
    console.log('✏️ Voice AI updating calendar event with args:', args);

    const details: Record<string, unknown> = {
      search_term: args.search_term,
      updates: args.updates || {}
    };

    return await aiAssistantService.updateCalendarEvent(details, this.currentUserId!);
  }

  private async handleDeleteCalendarEvent(args: any) {
    console.log('🗑️ Voice AI deleting calendar event with args:', args);

    const details: Record<string, unknown> = {
      search_term: args.search_term,
      date: args.date
    };

    return await aiAssistantService.deleteCalendarEvent(details, this.currentUserId!);
  }

  private async handleCreateReminder(args: any) {
    const message = `remind me to ${args.title} on ${args.date}${args.time ? ' at ' + args.time : ''}`;
    return await aiAssistantService.processUserMessage(message, this.currentUserId!);
  }

  private async handleAddShoppingItem(args: any) {
    const message = `add ${args.title} to shopping list${args.quantity ? ' quantity ' + args.quantity : ''}`;
    return await aiAssistantService.processUserMessage(message, this.currentUserId!);
  }
}

export const openaiRealtimeService = new OpenAIRealtimeService({
  model: 'gpt-4o-realtime-preview',
  wakeWord: 'hey sara',
  vadThreshold: 0.03,
  voice: 'alloy',
  instructions: `You are Sara, a helpful AI assistant for busy parents embedded in a family organizer app.

You have full access to the user's calendar and can help them manage their schedule. You can:
- Answer questions about their schedule ("What's on my calendar today?")
- Check availability ("Am I free tomorrow afternoon?")
- Find events ("When is my dentist appointment?")
- Create new events ("Schedule a meeting tomorrow at 2pm")
- Update events ("Move my dentist appointment to next week")
- Delete events ("Cancel my meeting tomorrow")
- Set reminders and create tasks
- Add items to shopping lists
- Provide parenting advice and support

Keep responses natural, conversational, and concise for voice interaction. Always check for schedule conflicts when creating events and proactively warn users. Use a warm, supportive tone and speak like you're having a friendly conversation.`
});

export default openaiRealtimeService;
