import React, { useMemo } from "react";
import { decodeJwtPayload, extractRefFromIss } from "../lib/jwt";

const SB_URL = (import.meta.env.VITE_SUPABASE_URL as string) || "";
const SB_REF = (import.meta.env.VITE_SUPABASE_PROJECT_REF as string) || "";
const ANON = (import.meta.env.VITE_SUPABASE_ANON_KEY as string) || "";

function classNames(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

export default function ConfigBanner() {
  const info = useMemo(() => {
    const payload = decodeJwtPayload(ANON);
    const role = payload?.role as string | undefined;
    const iss = payload?.iss as string | undefined;
    const anonRef = extractRefFromIss(iss);
    const usingRef = SB_REF || (SB_URL.match(/^https:\/\/([a-z0-9]{20})\.supabase\.co/i)?.[1] ?? "");
    const refOk = !!usingRef && !!anonRef && usingRef === anonRef;
    return { role, iss, anonRef, usingRef, refOk };
  }, []);

  // Only show if something is wrong AND we actually have values to compare
  const show =
    (!!ANON && !!info.anonRef && !!info.usingRef && !info.refOk) ||
    (!!ANON && info.role && info.role !== "anon");

  if (!show) return null;

  return (
    <div className={classNames(
      "w-full border-b px-4 py-2 text-sm",
      "bg-yellow-50 border-yellow-300 text-yellow-900"
    )}>
      <strong>Config Warning:</strong>{" "}
      {info.role && info.role !== "anon" ? (
        <>
          Supabase key role is <code>{String(info.role)}</code>, expected <code>anon</code>. Provide the **anon public key** from your project's
          <em> Project Settings → API</em>.
        </>
      ) : (
        <>
          Anon key project <code>{info.anonRef || "(unknown)"}</code> doesn't match app project{" "}
          <code>{info.usingRef || "(unknown)"}</code>. Update your hosting env to use the
          anon key for <code>{info.usingRef || "(expected project)"}</code>.
        </>
      )}
    </div>
  );
}