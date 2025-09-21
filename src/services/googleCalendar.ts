// Service for Google Calendar calls via Supabase Edge Functions
const CANDIDATE_BASES = [
  `${import.meta.env.VITE_SUPABASE_URL?.replace(/\/+$/, "")}/functions/v1`,
].filter(Boolean) as string[];

export class GoogleCalendarService {
  private base!: string;
  private ready = false;
  private signedIn = false;
  private connected = false;

  async initialize(): Promise<void> {
    this.base = CANDIDATE_BASES[0];
    this.ready = !!this.base;

    // We don't read google_tokens from the browser (RLS). Just ask the server.
    try {
      const res = await fetch(`${this.base}/google-calendar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "isConnected" }),
      });
      const json = await res.json().catch(() => ({}));
      this.connected = !!json?.connected;
    } catch {
      this.connected = false;
    }
  }

  isReady() { return this.ready; }
  isSignedIn() { return this.signedIn; } // kept for compatibility
  isConnected() { return this.connected; }

  // Generic helper for your existing actions
  async call<T = unknown>(action: string, payload: Record<string, unknown> = {}): Promise<T> {
    const res = await fetch(`${this.base}/google-calendar`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, ...payload }),
    });
    if (!res.ok) throw new Error(`${action} failed: ${res.status}`);
    return res.json();
  }

  // Example wrappers (optional)
  listEvents(params: Record<string, unknown> = {}) { return this.call("listEvents", params); }
  createEvent(event: unknown) { return this.call("createEvent", { event }); }
  deleteEvent(id: string) { return this.call("deleteEvent", { id }); }
}

export const googleCalendar = new GoogleCalendarService();
