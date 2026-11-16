// KOACH · Avisos al teléfono (Web Push) — c281. verify_jwt = false (autentica adentro).
// acciones:
//   diario  → (cron cada 5 min, header x-clave) envía el aviso del día si es la hora y aún no salió hoy
//   enviar  → (koach/admin con su sesión) {destino:{tipo,valor}, titulo, cuerpo, url?} aviso manual
//   probar  → (koach/admin) se envía a sí mismo el aviso de un día {dia} o un texto {titulo,cuerpo}
import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info, x-clave", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const j = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...CORS, "Content-Type": "application/json" } });
const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const TIPOS = ["todos", "programa", "socio", "sin_semana", "por_vencer"];

let listo = false;
async function llaves() {
  if (listo) return;
  const { data } = await admin.from("config_privada").select("valor").eq("clave", "vapid").maybeSingle();
  if (!data?.valor?.publicKey) throw new Error("Sin llaves VAPID");
  webpush.setVapidDetails("https://app.koachclub.cl", data.valor.publicKey, data.valor.privateKey);
  listo = true;
}

type Msg = { socio_id: string; titulo: string; cuerpo: string; url: string; tag: string };
async function enviarLote(msgs: Msg[]) {
  await llaves();
  const ids = [...new Set(msgs.map((m) => m.socio_id))];
  if (!ids.length) return 0;
  const { data: subs } = await admin.from("push_subs").select("*").in("socio_id", ids);
  const porSocio = new Map<string, any[]>();
  for (const s of subs || []) { if (!porSocio.has(s.socio_id)) porSocio.set(s.socio_id, []); porSocio.get(s.socio_id)!.push(s); }
  let entregados = 0;
  await Promise.all(msgs.map(async (m) => {
    let ok = false;
    for (const s of porSocio.get(m.socio_id) || []) {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          JSON.stringify({ titulo: m.titulo, cuerpo: m.cuerpo, tag: m.tag, url: m.url }), { TTL: 4 * 3600, urgency: "normal" });
        ok = true; await admin.from("push_subs").update({ ultimo_ok: new Date().toISOString() }).eq("id", s.id);
      } catch (e) {
        const st = (e as { statusCode?: number }).statusCode;
        if (st === 404 || st === 410) await admin.from("push_subs").delete().eq("id", s.id);
      }
    }
    if (ok) entregados++;
  }));
  return entregados;
}

function ahoraStgo() {
  const p = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Santiago", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", weekday: "short", hour12: false }).formatToParts(new Date());
  const g = (t: string) => p.find((x) => x.type === t)!.value;
  const dias: Record<string, number> = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };
  return { fecha: `${g("year")}-${g("month")}-${g("day")}`, min: (Number(g("hour")) % 24) * 60 + Number(g("minute")), dia: dias[g("weekday")] };
}

async function staff(req: Request) {
  const jwt = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  const { data: u } = await admin.auth.getUser(jwt);
  if (!u?.user) return null;
  const { data: p } = await admin.from("profiles").select("id,role,nombre,apellido").eq("id", u.user.id).maybeSingle();
  if (!p || !["admin", "coach"].includes(String(p.role))) return null;
  return p;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const body = await req.json().catch(() => ({}));

    if (body.accion === "diario") {
      const { data: k } = await admin.from("config_privada").select("valor").eq("clave", "avisos_cron").maybeSingle();
      if (!k?.valor?.clave || req.headers.get("x-clave") !== k.valor.clave) return j({ error: "No autorizado" }, 401);
      const t = ahoraStgo();
      const { data: cfg } = await admin.from("avisos_semana").select("*").eq("dia", t.dia).maybeSingle();
      if (!cfg?.activo) return j({ ok: true, nada: "apagado" });
      const ini = cfg.hora * 60 + cfg.minuto;
      if (t.min < ini || t.min > ini + 90) return j({ ok: true, nada: "fuera de hora" });
      // reclamo atómico: solo una ejecución por día
      const { data: claim } = await admin.from("avisos_semana").update({ ultimo_envio: t.fecha }).eq("dia", t.dia)
        .or(`ultimo_envio.is.null,ultimo_envio.neq.${t.fecha}`).select("dia");
      if (!claim?.length) return j({ ok: true, nada: "ya enviado" });
      const { data: lote, error } = await admin.rpc("koach_avisos_lote", { p_dia: t.dia });
      if (error) return j({ error: error.message }, 500);
      const n = await enviarLote(lote || []);
      await admin.from("push_envios").insert({ tipo: "diario", titulo: cfg.titulo, cuerpo: cfg.cuerpo, destino: { dia: t.dia, tema: cfg.tema }, socios: (lote || []).length, entregados: n });
      return j({ ok: true, socios: (lote || []).length, entregados: n });
    }

    const yo = await staff(req);
    if (!yo) return j({ error: "Sin permiso" }, 403);
    const nombre = [yo.nombre, yo.apellido].filter(Boolean).join(" ");

    if (body.accion === "enviar") {
      const tipo = String(body.destino?.tipo || ""), valor = body.destino?.valor == null ? null : String(body.destino.valor);
      const titulo = String(body.titulo || "").trim().slice(0, 70), cuerpo = String(body.cuerpo || "").trim().slice(0, 140);
      if (!TIPOS.includes(tipo)) return j({ error: "Destino no válido" }, 400);
      if (!titulo) return j({ error: "Escribe el título del aviso" }, 400);
      const { data: ds, error } = await admin.rpc("koach_avisos_destino", { p_tipo: tipo, p_valor: valor });
      if (error) return j({ error: error.message }, 500);
      const url = typeof body.url === "string" && body.url.startsWith("/app.html") ? body.url : "/app.html";
      const msgs = (ds || []).map((d: { socio_id: string }) => ({ socio_id: d.socio_id, titulo, cuerpo, url, tag: "koach-" + Date.now() }));
      const n = await enviarLote(msgs);
      await admin.from("push_envios").insert({ tipo: "manual", titulo, cuerpo, destino: { tipo, valor }, socios: msgs.length, entregados: n, creado_por: yo.id, creado_por_nombre: nombre });
      return j({ ok: true, socios: msgs.length, entregados: n });
    }

    if (body.accion === "probar") {
      let titulo = String(body.titulo || ""), cuerpo = String(body.cuerpo || ""), url = "/app.html";
      if (body.dia) {
        const { data: cfg } = await admin.from("avisos_semana").select("*").eq("dia", Number(body.dia)).maybeSingle();
        if (!cfg) return j({ error: "Día no válido" }, 400);
        titulo = cfg.titulo.replace("{h}", "1").replace("{p}", "3").replace("{r}", "2 sesiones"); cuerpo = cfg.cuerpo; url = cfg.url;
      }
      if (!titulo) return j({ error: "Sin texto" }, 400);
      const n = await enviarLote([{ socio_id: yo.id, titulo, cuerpo, url, tag: "prueba" }]);
      return j({ ok: true, entregados: n, sin_suscripcion: n === 0 });
    }
    return j({ error: "Acción no válida" }, 400);
  } catch (e) {
    return j({ error: String((e as Error)?.message || e) }, 500);
  }
});
