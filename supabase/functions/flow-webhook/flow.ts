// KOACH · cliente mínimo de la API de Flow (firma HMAC-SHA256 de parámetros ordenados)
export const FLOW_API = Deno.env.get("FLOW_API_URL") || "https://www.flow.cl/api";
export const API_KEY = Deno.env.get("FLOW_API_KEY") || "";
const SECRET = Deno.env.get("FLOW_SECRET_KEY") || "";
export const HOOK = (Deno.env.get("SUPABASE_URL") || "") + "/functions/v1/flow-webhook";
export const APP = Deno.env.get("KOACH_APP_URL") || "https://app.koachclub.cl/app.html";

async function firmar(p: Record<string, string>) {
  const txt = Object.keys(p).sort().map((k) => k + p[k]).join("");
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(SECRET), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(txt));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
export class FlowError extends Error { constructor(public code: number | string, msg: string, public data?: unknown) { super(msg); } }
export async function flow(metodo: "GET" | "POST", servicio: string, params: Record<string, string | number | undefined | null>) {
  const p: Record<string, string> = { apiKey: API_KEY };
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== "") p[k] = String(v);
  p.s = await firmar(p);
  const url = FLOW_API + "/" + servicio;
  const r = metodo === "GET"
    ? await fetch(url + "?" + new URLSearchParams(p))
    : await fetch(url, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams(p) });
  const d = await r.json().catch(() => ({}));
  if (!r.ok)
    throw new FlowError(d?.code ?? r.status, d?.message || ("HTTP " + r.status), d);
  return d;
}
export async function tokenDe(req: Request) {
  try {
    if (req.method === "POST") {
      const ct = req.headers.get("content-type") || "";
      if (ct.includes("json")) return (await req.json()).token || "";
      return new URLSearchParams(await req.text()).get("token") || "";
    }
  } catch (_) { /* */ }
  return new URL(req.url).searchParams.get("token") || "";
}
