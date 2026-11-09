// KOACH · Flow — urlConfirmation (?t=confirm) y urlReturn (?t=return). verify_jwt = false:
// el cuerpo solo trae un token; el estado real SIEMPRE se consulta firmado a Flow (payment/getStatus).
import { createClient } from "npm:@supabase/supabase-js@2";

const FLOW_API = Deno.env.get("FLOW_API_URL") || "https://www.flow.cl/api";
const API_KEY = Deno.env.get("FLOW_API_KEY")!;
const SECRET = Deno.env.get("FLOW_SECRET_KEY")!;
const APP = Deno.env.get("KOACH_APP_URL") || "https://app.koachclub.cl/app.html";
const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

async function firmar(p: Record<string, string>) {
  const txt = Object.keys(p).sort().map((k) => k + p[k]).join("");
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(SECRET), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(txt));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
async function estadoFlow(token: string) {
  const p: Record<string, string> = { apiKey: API_KEY, token };
  p.s = await firmar(p);
  const r = await fetch(FLOW_API + "/payment/getStatus?" + new URLSearchParams(p));
  const d = await r.json();
  if (!r.ok || d.status == null) throw new Error("getStatus: " + JSON.stringify(d));
  return d;
}
async function procesar(token: string) {
  const st = await estadoFlow(token);
  const { data, error } = await admin.rpc("flow_procesar", { p_token: token, p_status: st });
  if (error) {
    await admin.from("flow_ordenes").update({ estado: "error", error: error.message.slice(0, 500), flow_status: st, updated_at: new Date().toISOString() }).eq("flow_token", token);
    throw error;
  }
  return { st, res: data as { estado: string } };
}

Deno.serve(async (req) => {
  const t = new URL(req.url).searchParams.get("t");
  let token = "";
  try {
    const ct = req.headers.get("content-type") || "";
    if (req.method === "POST") {
      if (ct.includes("json")) token = (await req.json()).token || "";
      else token = (new URLSearchParams(await req.text())).get("token") || "";
    } else token = new URL(req.url).searchParams.get("token") || "";
  } catch (_) { /* sin token */ }

  if (t === "return") {
    let estado = "pendiente", orden = "";
    try {
      if (token) { const { st, res } = await procesar(token); estado = res?.estado || "pendiente"; orden = st.commerceOrder || ""; }
    } catch (_) { estado = "pendiente"; }
    return new Response(null, { status: 303, headers: { Location: APP + "?pago=" + encodeURIComponent(estado) + (orden ? "&orden=" + encodeURIComponent(orden) : "") } });
  }
  // confirmación servidor a servidor
  if (!token) return new Response("token requerido", { status: 400 });
  try { await procesar(token); return new Response("OK", { status: 200 }); }
  catch (e) { console.error("flow confirm", e); return new Response("error", { status: 500 }); }
});
