// KOACH · Aviso de fin de descanso (Web Push). verify_jwt = true
// La app lo programa solo cuando el socio sale de la app (pantalla bloqueada / otra app) durante un descanso.
// acciones: clave · suscribir {sub} · programar {seg, titulo?, cuerpo?} · cancelar
import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const j = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...CORS, "Content-Type": "application/json" } });
const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

// llaves VAPID: se generan una sola vez en el servidor y quedan en config_privada (solo la pública sale del servidor)
let VAPID: { publicKey: string; privateKey: string } | null = null;
async function llaves() {
  if (VAPID) return VAPID;
  const { data } = await admin.from("config_privada").select("valor").eq("clave", "vapid").maybeSingle();
  if (data?.valor?.publicKey) VAPID = data.valor;
  else {
    const k = webpush.generateVAPIDKeys();
    const { error } = await admin.from("config_privada").insert({ clave: "vapid", valor: k });
    if (error) { const { data: d2 } = await admin.from("config_privada").select("valor").eq("clave", "vapid").maybeSingle(); VAPID = d2!.valor; }
    else VAPID = k;
  }
  webpush.setVapidDetails("https://app.koachclub.cl", VAPID!.publicKey, VAPID!.privateKey);
  return VAPID!;
}

async function enviar(avisoId: string) {
  const { data: a } = await admin.from("push_avisos").select("*").eq("id", avisoId).maybeSingle();
  if (!a || a.estado !== "pendiente") return;
  await llaves();
  const { data: subs } = await admin.from("push_subs").select("*").eq("socio_id", a.socio_id);
  const payload = JSON.stringify({ titulo: a.titulo || "KOACH · Descanso terminado", cuerpo: a.cuerpo || "Tu siguiente set está listo. Vuelve a la app.", tag: "descanso" });
  let ok = 0;
  for (const s of subs || []) {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, { TTL: 60, urgency: "high" });
      ok++; await admin.from("push_subs").update({ ultimo_ok: new Date().toISOString() }).eq("id", s.id);
    } catch (e) {
      const st = (e as { statusCode?: number }).statusCode;
      if (st === 404 || st === 410) await admin.from("push_subs").delete().eq("id", s.id);   // suscripción vencida
    }
  }
  await admin.from("push_avisos").update({ estado: ok ? "enviado" : "error", enviado_at: new Date().toISOString() }).eq("id", avisoId).eq("estado", "pendiente");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const jwt = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
    const { data: u } = await admin.auth.getUser(jwt);
    if (!u?.user) return j({ error: "Sesión no válida" }, 401);
    const uid = u.user.id;
    const body = await req.json().catch(() => ({}));

    if (body.accion === "clave") return j({ publicKey: (await llaves()).publicKey });

    if (body.accion === "suscribir") {
      const s = body.sub || {};
      if (!s.endpoint || !s.keys?.p256dh || !s.keys?.auth) return j({ error: "Suscripción inválida" }, 400);
      await admin.from("push_subs").upsert({ socio_id: uid, endpoint: s.endpoint, p256dh: s.keys.p256dh, auth: s.keys.auth }, { onConflict: "endpoint" });
      return j({ ok: true });
    }

    if (body.accion === "cancelar") {
      await admin.from("push_avisos").update({ estado: "cancelado" }).eq("socio_id", uid).eq("estado", "pendiente");
      return j({ ok: true });
    }

    if (body.accion === "programar") {
      const seg = Math.max(1, Math.min(390, Math.round(Number(body.seg) || 0)));
      await admin.from("push_avisos").update({ estado: "cancelado" }).eq("socio_id", uid).eq("estado", "pendiente");
      const { data: a, error } = await admin.from("push_avisos").insert({ socio_id: uid, envia_at: new Date(Date.now() + seg * 1000).toISOString(),
        titulo: body.titulo ? String(body.titulo).slice(0, 80) : null, cuerpo: body.cuerpo ? String(body.cuerpo).slice(0, 160) : null }).select("id").single();
      if (error) return j({ error: "No se pudo programar" }, 500);
      const tarea = new Promise((r) => setTimeout(r, seg * 1000)).then(() => enviar(a.id)).catch(() => {});
      // @ts-ignore EdgeRuntime existe en Supabase Edge
      if (typeof EdgeRuntime !== "undefined") EdgeRuntime.waitUntil(tarea); else await tarea;
      return j({ ok: true, id: a.id });
    }
    return j({ error: "Acción no válida" }, 400);
  } catch (e) {
    return j({ error: String((e as Error)?.message || e) }, 500);
  }
});
