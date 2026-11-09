// KOACH · Pago automático (suscripción Flow). verify_jwt = true
// T&C v2.0 cl. 4: autorización expresa (4.1), desactivación en un toque (4.4), permanencia y salida anticipada (4.9).
// acciones socio: estado · cotizar · iniciar {autorizo, acepto_permanencia} · cancelar · terminar {confirmo}
// acciones staff:  staff_estado {socio} · staff_terminar {socio, causal} (término sin cobro de salida, cl. 4.9)
import { createClient } from "npm:@supabase/supabase-js@2";
import { flow, FlowError, HOOK, API_KEY } from "./flow.ts";

const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const j = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...CORS, "Content-Type": "application/json" } });
const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const ahora = () => new Date().toISOString();
const hoyCL = () => new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 10);
const masMeses = (iso: string, m: number) => { const d = new Date(iso + "T12:00:00Z"); d.setUTCMonth(d.getUTCMonth() + m); return d.toISOString().slice(0, 10); };
type Susc = Record<string, any>;

// Plan Flow por monto (Flow no permite editar el monto de un plan con suscritos)
async function planFlow(nombre: string, precio: number, meses: number) {
  const id = ("KOACH_" + nombre.normalize("NFD").replace(/[^A-Za-z0-9]+/g, "_") + "_" + meses + "M_" + precio).toUpperCase().slice(0, 60);
  try { await flow("GET", "plans/get", { planId: id }); return id; } catch (_) { /* no existe */ }
  await flow("POST", "plans/create", {
    planId: id, name: "KOACH · Membresía " + nombre, currency: "CLP", amount: precio,
    interval: 3, interval_count: meses, urlCallback: HOOK + "?t=sub", charges_retries_number: 3,
  });
  return id;
}

// Salida anticipada (cl. 4.9): descuento recibido = (lista − valor mensual) × meses pagados, solo dentro de la permanencia
function salida(s: Susc) {
  const hoy = hoyCL();
  const enPermanencia = !!(s.permanencia_meses > 0 && s.permanencia_hasta && hoy < s.permanencia_hasta);
  const desc = Math.max(0, (s.precio_lista || 80000 * (s.duracion_valor || 1)) - s.monto); // por cobro (precio_lista = lista × periodo)
  const monto = enPermanencia ? desc * (s.cobros_pagados || 0) : 0;
  return { en_permanencia: enPermanencia, permanencia_hasta: s.permanencia_hasta, meses_pagados: s.cobros_pagados || 0, descuento_mensual: desc, monto };
}
const publica = (s: Susc | null) => s ? {
  id: s.id, estado: s.estado, plan_nombre: s.plan_nombre, monto: s.monto, tarjeta_tipo: s.tarjeta_tipo, tarjeta_ult4: s.tarjeta_ult4,
  inicio: s.inicio, proximo_cobro: s.proximo_cobro, permanencia_meses: s.permanencia_meses, permanencia_hasta: s.permanencia_hasta,
  cobros_pagados: s.cobros_pagados, periodo_meses: s.duracion_valor || 1, salida: salida(s),
} : null;

async function vivaDe(uid: string) {
  const { data } = await admin.from("flow_suscripciones").select("*").eq("socio_id", uid)
    .in("estado", ["registrando_tarjeta", "activa", "cancelada_fin_periodo"]).order("created_at", { ascending: false }).limit(1).maybeSingle();
  return data as Susc | null;
}
async function cerrar(s: Susc, termino: Record<string, unknown>) {
  await flow("POST", "subscription/cancel", { subscriptionId: s.flow_subscription_id, at_period_end: 1 });
  await admin.from("flow_suscripciones").update({ estado: "cancelada_fin_periodo", termino: { ...termino, at: ahora() }, updated_at: ahora() }).eq("id", s.id);
  await admin.from("admin_eventos").insert({ socio_id: s.socio_id, entidad: "pago_automatico", entidad_id: s.id, accion: "terminar", despues: termino, actor_id: termino.actor_id ?? null, actor_nombre: termino.actor_nombre ?? "FLOW · app del socio", motivo: termino.causal ?? termino.tipo });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    if (!API_KEY) return j({ error: "Flow no está configurado" }, 500);
    const jwt = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
    const { data: u } = await admin.auth.getUser(jwt);
    if (!u?.user) return j({ error: "Sesión no válida" }, 401);
    const uid = u.user.id;
    const body = await req.json().catch(() => ({}));

    // ── staff (admin / recepción)
    if (String(body.accion || "").startsWith("staff_")) {
      const { data: yo } = await admin.from("profiles").select("role,nombre,apellido").eq("id", uid).maybeSingle();
      if (!yo || !["admin", "recepcion"].includes(yo.role)) return j({ error: "Sin permiso" }, 403);
      const s = await vivaDe(body.socio);
      if (body.accion === "staff_estado") return j({ suscripcion: publica(s && s.estado !== "registrando_tarjeta" ? s : null) });
      if (body.accion === "staff_terminar") {
        if (!s || s.estado !== "activa") return j({ error: "El socio no tiene pago automático activo" }, 400);
        const causal = String(body.causal || "").trim();
        if (!causal) return j({ error: "Indica la causal" }, 400);
        await cerrar(s, { tipo: "sin_cobro_salida", causal, actor_id: uid, actor_nombre: [yo.nombre, yo.apellido].filter(Boolean).join(" ") });
        return j({ ok: true });
      }
      return j({ error: "Acción no válida" }, 400);
    }

    const viva = await vivaDe(uid);

    if (body.accion === "estado") return j({ suscripcion: publica(viva && viva.estado !== "registrando_tarjeta" ? viva : null) });

    if (body.accion === "cotizar") {
      const { data: t } = await admin.rpc("tarifa_auto_de", { p_socio: uid });
      const { data: acc } = await admin.rpc("_flow_fin_acceso", { p_socio: uid });
      const hoy = hoyCL(), primero = acc && acc > hoy ? acc : hoy;
      const perm = t?.permanencia_meses || 0, per = t?.periodo_meses || 1;
      return j({ monto: t.monto, precio_lista: t.precio_lista * per, personalizada: !!t.personalizada, permanencia_meses: perm, periodo_meses: per,
        primer_cobro: primero, permanencia_hasta: perm ? masMeses(primero, perm) : null, descuento_mensual: Math.max(0, t.precio_lista * per - t.monto) });
    }

    // desactivar sin costo (sin permanencia o permanencia cumplida) — cl. 4.4 / 4.10
    if (body.accion === "cancelar" || body.accion === "terminar") {
      if (!viva || viva.estado !== "activa") return j({ error: "No tienes un pago automático activo" }, 400);
      const sl = salida(viva);
      if (body.accion === "cancelar" && sl.monto > 0) return j({ error: "Tu membresía tiene permanencia: revisa el monto de salida", salida: sl }, 409);
      if (sl.monto > 0) {
        if (!body.confirmo) return j({ salida: sl });
        // cobro único de salida a la tarjeta registrada (cl. 4.9)
        const orden = "KCH-SAL-" + viva.id.slice(0, 8).toUpperCase() + "-" + Date.now().toString(36).toUpperCase();
        let ch: Record<string, any>;
        try {
          ch = await flow("POST", "customer/charge", { customerId: viva.flow_customer_id, amount: sl.monto, subject: "KOACH · Término anticipado de permanencia", commerceOrder: orden, currency: "CLP" });
        } catch (e) { return j({ error: "No se pudo cobrar el monto de salida en tu tarjeta. No se cerró tu pago automático. Acércate a recepción.", detalle: (e as Error).message }, 402); }
        const st = Number(ch?.status ?? ch?.paymentData?.status ?? 0);
        if (st !== 2) return j({ error: "Tu banco no aprobó el cobro de salida. No se cerró tu pago automático. Acércate a recepción.", flow: ch }, 402);
        await cerrar(viva, { tipo: "salida_anticipada", monto_salida: sl.monto, meses_pagados: sl.meses_pagados, flow_order: ch.flowOrder ?? null, commerce_order: orden });
        return j({ ok: true, cobrado: sl.monto });
      }
      await cerrar(viva, { tipo: "desactivacion" });
      return j({ ok: true, cobrado: 0 });
    }

    // iniciar — exige autorización expresa (cl. 4.1) y, si hay permanencia, su aceptación (cl. 4.9)
    if (viva && viva.estado !== "registrando_tarjeta") return j({ error: "Ya tienes el pago automático activo" }, 400);
    const { data: t } = await admin.rpc("tarifa_auto_de", { p_socio: uid });
    if (!t?.monto || t.monto < 350) return j({ error: "Pago automático no disponible" }, 400);
    const perm = t.permanencia_meses || 0, per = t.periodo_meses || 1;
    const periodicidad = per === 1 ? "mensual" : "cada " + per + " meses";
    if (body.autorizo !== true) return j({ error: "Debes autorizar el cobro automático" }, 400);
    if (perm > 0 && body.acepto_permanencia !== true) return j({ error: "Debes aceptar la permanencia" }, 400);
    if (Number(body.monto_visto) !== Number(t.monto)) return j({ error: "La tarifa cambió. Vuelve a abrir el pago automático." }, 409);
    if (viva) await admin.from("flow_suscripciones").update({ estado: "error", error: "reemplazada por un nuevo intento", updated_at: ahora() }).eq("id", viva.id);

    const { data: perfil } = await admin.from("profiles").select("id,email,nombre,apellido").eq("id", uid).maybeSingle();
    const email = (perfil?.email || u.user.email || "").trim();
    if (!email) return j({ error: "Tu cuenta no tiene correo" }, 400);
    const { data: ver } = await admin.from("config_pagos").select("valor").eq("clave", "tyc_version").maybeSingle();
    const flowPlan = await planFlow(per === 1 ? "MENSUAL AUTO" : "AUTO", t.monto, per);

    const { data: prev } = await admin.from("flow_suscripciones").select("flow_customer_id").eq("socio_id", uid).not("flow_customer_id", "is", null).order("created_at", { ascending: false }).limit(1).maybeSingle();
    let customerId = prev?.flow_customer_id as string | undefined;
    if (!customerId) {
      const nombre = [perfil?.nombre, perfil?.apellido].filter(Boolean).join(" ") || email;
      try { customerId = (await flow("POST", "customer/create", { name: nombre, email, externalId: uid })).customerId; }
      catch (e) {
        const l = await flow("GET", "customer/list", { filter: email, limit: 100 }).catch(() => null);
        const hit = (l?.data || []).find((c: { externalId?: string; email?: string }) => c.externalId === uid || (c.email || "").toLowerCase() === email.toLowerCase());
        if (!hit) throw e;
        customerId = hit.customerId;
      }
    }
    const reg = await flow("POST", "customer/register", { customerId, url_return: HOOK + "?t=card" });
    await admin.from("flow_suscripciones").insert({
      socio_id: uid, plan_id: null, plan_nombre: per === 1 ? "MENSUAL AUTOMÁTICO" : "AUTOMÁTICO CADA " + per + " MESES", monto: t.monto, duracion_valor: per,
      flow_plan_id: flowPlan, flow_customer_id: customerId, email, register_token: reg.token, tipo_comercial: t.tipo_comercial || "promocion",
      permanencia_meses: perm, precio_lista: t.precio_lista * per,
      autorizacion: { texto: "Autorizo el cobro automático de mi membresía", monto: t.monto, periodicidad, periodo_meses: per, permanencia_meses: perm,
        acepto_permanencia: perm > 0, tyc: ver?.valor?.version || "v2.0", at: ahora(), ua: req.headers.get("user-agent") || null,
        ip: (req.headers.get("x-forwarded-for") || "").split(",")[0] || null },
    });
    return j({ url: reg.url + "?token=" + reg.token });
  } catch (e) {
    const fe = e as FlowError;
    console.error("flow-suscripcion", fe?.message, fe?.data);
    return j({ error: fe instanceof FlowError ? "Flow: " + fe.message : String(fe?.message || e) }, 502);
  }
});
