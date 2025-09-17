/** Decode a JWT payload (no verify). Returns null on failure. */
export function decodeJwtPayload(token?: string | null): Record<string, any> | null {
  try {
    if (!token) return null;
    const parts = token.split(".");
    if (parts.length < 2) return null;
    const b64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const json = decodeURIComponent(
      atob(b64)
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join("")
    );
    return JSON.parse(json);
  } catch {
    return null;
  }
}

/** Extract a 20-char Supabase project ref from a URL like https://<ref>.supabase.co/... */
export function extractRefFromIss(iss?: string): string | undefined {
  if (!iss) return;
  const m = iss.match(/^https:\/\/([a-z0-9]{20})\.supabase\.co/i);
  return m?.[1];
}