// KOACH · Notificaciones de Flow. verify_jwt = false: Flow solo envía un token y el estado real
// SIEMPRE se consulta firmado a Flow.
//   ?t=confirm  urlConfirmation de pagos únicos     ?t=return  vuelta del pagador (pago único)
//   ?t=card     vuelta del registro de tarjeta       ?t=sub     urlCallback de cada cobro automático
//   ?t=sync     realinea el primer cobro con el fin del acceso (&socio=uuid opcional)
//   ?t=conciliar estado de cobro de cada suscripción contra Flow (cron diario; &socio=uuid opcional)
//   ?t=ping     diagnóstico de llaves (no expone valores)
import { createClient } from "npm:@supabase/supabase-js@2";
import { flow, tokenDe, APP, API_KEY } from "./flow.ts";

const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const ir = (q: string) => new Response(null, { status: 303, headers: { Location: APP + "?" + q } });
const ahora = () => new Date().toISOString();
const hoyCL = () => new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 10);

async function procesarPago(token: string) {
  const st = await flow("GET", "payment/getStatus", { token });
  const { data, error } = await admin.rpc("flow_procesar", { p_token: token, p_status: st });
  if (error) {
    await admin.from("flow_ordenes").update({ estado: "error", error: error.message.slice(0, 500), flow_status: st, updated_at: ahora() }).eq("flow_token", token);
    throw error;
  }
  return { st, res: data as { estado: string } };
}

// Tarjeta registrada → crear la suscripción. Si el socio tiene membresía vigente, el primer cobro es cuando termina.
async function activarSuscripcion(token: string) {
  const { data: s } = await admin.from("flow_suscripciones").select("*").eq("register_token", token).maybeSingle();
  if (!s) throw new Error("registro de tarjeta desconocido");
  if (s.estado === "activa" || s.estado === "activando") return "activa";
  // bloqueo atómico: solo una ejecución pasa de 'registrando_tarjeta' a 'activando' (evita dos suscripciones)
  const { data: tomada } = await admin.from("flow_suscripciones").update({ estado: "activando", updated_at: ahora() })
    .eq("id", s.id).eq("estado", "registrando_tarjeta").select("id");
  if (!tomada || !tomada.length) return "activa";
  const rs = await flow("GET", "customer/getRegisterStatus", { token });
  if (String(rs.status) !== "1") {
    await admin.from("flow_suscripciones").update({ estado: "error", error: "tarjeta no registrada", flow_data: rs, updated_at: ahora() }).eq("id", s.id);
    return "tarjeta_rechazada";
  }
  const { data: acc } = await admin.rpc("_flow_fin_acceso", { p_socio: s.socio_id });
  const hoy = hoyCL();
  const inicio = acc && acc > hoy ? acc : hoy;
  const sub = await flow("POST", "subscription/create", { planId: s.flow_plan_id, customerId: s.flow_customer_id, subscription_start: inicio,
    ...(s.flow_coupon_id ? { couponId: Number(s.flow_coupon_id) } : {}) });
  const permHasta = s.permanencia_meses > 0 ? (() => { const d = new Date(inicio + "T12:00:00Z"); d.setUTCMonth(d.getUTCMonth() + s.permanencia_meses); return d.toISOString().slice(0, 10); })() : null;
  await admin.from("flow_suscripciones").update({
    estado: "activa", flow_subscription_id: sub.subscriptionId, inicio, permanencia_hasta: permHasta,
    proximo_cobro: inicio,
    tarjeta_tipo: rs.creditCardType || null, tarjeta_ult4: rs.last4CardDigits || null,
    flow_data: sub, error: null, updated_at: ahora(),
  }).eq("id", s.id);
  return "activa";
}

// Sincronización: el primer cobro de una suscripción que AÚN NO cobra nada debe coincidir con el fin real del acceso.
// Caso típico: se activó con una membresía vigente (primer cobro = su vencimiento) y luego esa membresía se anuló.
// Se crea la suscripción nueva ANTES de cancelar la anterior: si Flow falla, no se pierde nada.
async function realinear(socio?: string | null) {
  let q = admin.from("flow_suscripciones").select("*").eq("estado", "activa").not("flow_subscription_id", "is", null).eq("cobros_pagados", 0);
  if (socio) q = q.eq("socio_id", socio);
  const { data: lista } = await q;
  const hoy = hoyCL(), res: unknown[] = [];
  // cola "cobrar ahora" (la llena el staff desde el Dashboard): el primer cobro pasa a HOY; los días vigentes no se pierden
  const { data: cfg } = await admin.from("config_pagos").select("valor").eq("clave", "cobrar_ahora").maybeSingle();
  const ya: string[] = Array.isArray(cfg?.valor?.socios) ? cfg!.valor.socios : [];
  for (const s of lista || []) {
    if (!s.inicio || s.inicio <= hoy) continue;                       // ya entró en cobro: no se toca
    const { count } = await admin.from("flow_cobros").select("id", { count: "exact", head: true }).eq("suscripcion_id", s.id);
    if (count) continue;
    const { data: acc } = await admin.rpc("_flow_fin_acceso", { p_socio: s.socio_id });
    const ahoraYa = ya.includes(s.socio_id);
    const ancla = ahoraYa ? hoy : (acc && acc > hoy ? acc : hoy);
    if (ancla === s.inicio) continue;
    const { data: tomada } = await admin.from("flow_suscripciones").update({ estado: "activando", updated_at: ahora() }).eq("id", s.id).eq("estado", "activa").select("id");
    if (!tomada?.length) continue;
    try {
      const sub = await flow("POST", "subscription/create", { planId: s.flow_plan_id, customerId: s.flow_customer_id, subscription_start: ancla,
        ...(s.flow_coupon_id ? { couponId: Number(s.flow_coupon_id) } : {}) });
      let aviso: string | null = null;
      try { await flow("POST", "subscription/cancel", { subscriptionId: s.flow_subscription_id, at_period_end: 0 }); }
      catch (e) { aviso = "no se pudo cancelar " + s.flow_subscription_id + ": " + String((e as Error).message).slice(0, 200); }
      const permHasta = s.permanencia_meses > 0 ? (() => { const d = new Date(ancla + "T12:00:00Z"); d.setUTCMonth(d.getUTCMonth() + s.permanencia_meses); return d.toISOString().slice(0, 10); })() : null;
      await admin.from("flow_suscripciones").update({ estado: "activa", flow_subscription_id: sub.subscriptionId, inicio: ancla, proximo_cobro: ancla,
        permanencia_hasta: permHasta, flow_data: sub, error: aviso, updated_at: ahora() }).eq("id", s.id);
      await admin.from("admin_eventos").insert({ socio_id: s.socio_id, entidad: "pago_automatico", entidad_id: s.id, accion: "realinear",
        despues: { primer_cobro_antes: s.inicio, primer_cobro: ancla, suscripcion_anterior: s.flow_subscription_id, suscripcion: sub.subscriptionId, aviso },
        actor_nombre: "FLOW · sincronización", motivo: ahoraYa ? "cobro adelantado a hoy por el staff" : "el primer cobro no coincidía con el fin del acceso" });
      if (aviso) await admin.from("flow_eventos").insert({ socio_id: s.socio_id, origen: "realinear", codigo: "cancel", mensaje: aviso });
      if (ahoraYa) await admin.from("config_pagos").update({ valor: { socios: ya.filter((x) => x !== s.socio_id) } }).eq("clave", "cobrar_ahora");
      res.push({ socio: s.socio_id, de: s.inicio, a: ancla });
    } catch (e) {
      await admin.from("flow_suscripciones").update({ estado: "activa", updated_at: ahora() }).eq("id", s.id);
      await admin.from("flow_eventos").insert({ socio_id: s.socio_id, origen: "realinear", codigo: String((e as { code?: unknown }).code ?? ""), mensaje: String((e as Error).message).slice(0, 500) });
      res.push({ socio: s.socio_id, error: String((e as Error).message).slice(0, 200) });
    }
  }
  return res;
}

// Conciliación diaria con Flow (cron): estado de cobro de cada pago automático.
// Flow subscription.morose: 0 al día · 1 importe vencido (rechazado tras los reintentos) · 2 pendiente, aún en reintentos.
// Con mora vencida sobre 30 días se cierra el pago automático en Flow (T&C cl. 10), sin cobro de salida, y queda alerta al staff.
async function conciliar(socio?: string | null) {
  const hoy = hoyCL(), res: unknown[] = [];
  let q = admin.from("flow_suscripciones").select("*").eq("estado", "activa").not("flow_subscription_id", "is", null);
  if (socio) q = q.eq("socio_id", socio);
  const { data: lista } = await q;
  for (const s of lista || []) {
    if (!socio && !(s.morosa > 0) && s.proximo_cobro && s.proximo_cobro > hoy) continue;   // nada que revisar todavía
    let sub: Record<string, any>;
    try { sub = await flow("GET", "subscription/get", { subscriptionId: s.flow_subscription_id }); }
    catch (e) { await admin.from("flow_eventos").insert({ socio_id: s.socio_id, origen: "conciliar", codigo: String((e as { code?: unknown }).code ?? ""), mensaje: String((e as Error).message).slice(0, 500) }); continue; }
    const m = Number(sub.morose || 0);
    const desde = m === 1 ? (s.morosa_desde || hoy) : (m === 0 ? null : s.morosa_desde);
    await admin.from("flow_suscripciones").update({ morosa: m, morosa_desde: desde, flow_data: sub, conciliada_at: ahora() }).eq("id", s.id);
    if (m === 1 && s.morosa !== 1)
      await admin.from("admin_eventos").insert({ socio_id: s.socio_id, entidad: "pago_automatico", entidad_id: s.id, accion: "cobro_vencido",
        despues: { monto: s.monto, proximo_cobro: s.proximo_cobro }, actor_nombre: "FLOW · conciliación", motivo: "el cobro automático no se pudo realizar tras los reintentos" });
    if (m === 0 && s.proximo_cobro && s.proximo_cobro < new Date(Date.now() - 3 * 3600e3 - 2 * 864e5).toISOString().slice(0, 10))
      await admin.from("flow_eventos").insert({ socio_id: s.socio_id, origen: "conciliar", codigo: "sin_acreditar",
        mensaje: "Flow no registra deuda pero el cobro del " + s.proximo_cobro + " no se acreditó en la app: revisar en Flow" });
    // mora sobre 30 días → cierre del pago automático (cl. 10)
    const d30 = new Date(Date.now() - 3 * 3600e3 - 30 * 864e5).toISOString().slice(0, 10);
    if (m === 1 && desde && desde <= d30) {
      try { await flow("POST", "subscription/cancel", { subscriptionId: s.flow_subscription_id, at_period_end: 0 }); } catch (_) { /* ya cancelada */ }
      const termino = { tipo: "mora", causal: "cobro automático impago por más de 30 días (T&C cl. 10)", at: ahora() };
      await admin.from("flow_suscripciones").update({ estado: "cancelada_fin_periodo", termino, updated_at: ahora() }).eq("id", s.id);
      await admin.from("admin_eventos").insert({ socio_id: s.socio_id, entidad: "pago_automatico", entidad_id: s.id, accion: "terminar",
        despues: termino, actor_nombre: "FLOW · conciliación", motivo: termino.causal });
      res.push({ socio: s.socio_id, cerrada_por_mora: true });
    } else res.push({ socio: s.socio_id, morosa: m });
  }
  return res;
}

Deno.serve(async (req) => {
  const t = new URL(req.url).searchParams.get("t");
  if (t === "sync") {
    const r = await realinear(new URL(req.url).searchParams.get("socio"));
    return new Response(JSON.stringify({ ok: true, realineadas: r }), { headers: { "Content-Type": "application/json" } });
  }
  if (t === "conciliar") {
    const r = await conciliar(new URL(req.url).searchParams.get("socio"));
    return new Response(JSON.stringify({ ok: true, revisadas: r }), { headers: { "Content-Type": "application/json" } });
  }
  if (t === "ping") {
    let flowR: unknown = null;
    try { await flow("GET", "payment/getStatus", { token: "ping_koach" }); } catch (e) { flowR = String((e as Error).message).slice(0, 300); }
    let planes: unknown = null;
    try { const l = await flow("GET", "plans/list", { limit: 50 }); planes = { total: l.total, ids: (l.data || []).map((x: { planId: string }) => x.planId) }; }
    catch (e) { planes = "error: " + String((e as Error).message).slice(0, 200); }
    // ?cargo=1 · verifica el contrato de Cargo Automático con un cliente técnico de KOACH (no cobra nada)
    let cargo: unknown = null;
    if (new URL(req.url).searchParams.get("cargo") === "1") {
      try {
        let cid: string | undefined;
        try { cid = (await flow("POST", "customer/create", { name: "KOACH verificacion", email: "koachclub@gmail.com", externalId: "koach-verificacion-contrato" })).customerId; }
        catch (_) {
          for (let start = 0; start < 2000 && !cid; start += 100) {
            const l = await flow("GET", "customer/list", { start, limit: 100 }).catch(() => null);
            cid = (l?.data || []).find((c: { externalId?: string }) => c.externalId === "koach-verificacion-contrato")?.customerId;
            if (!l?.hasMore) break;
          }
        }
        const reg = await flow("POST", "customer/register", { customerId: cid, url_return: "https://app.koachclub.cl/app.html" });
        cargo = { ok: true, registro: !!reg.token };
      } catch (e) { cargo = { ok: false, codigo: (e as { code?: unknown }).code ?? null, mensaje: String((e as Error).message).slice(0, 200) }; }
    }
    return new Response(JSON.stringify({ api_key: !!API_KEY, flow: flowR, planes, cargo }), { headers: { "Content-Type": "application/json" } });
  }
  const token = await tokenDe(req);

  if (t === "return") {
    let estado = "pendiente", orden = "";
    try { if (token) { const { st, res } = await procesarPago(token); estado = res?.estado || "pendiente"; orden = st.commerceOrder || ""; } } catch (_) { /* pendiente */ }
    return ir("pago=" + encodeURIComponent(estado) + (orden ? "&orden=" + encodeURIComponent(orden) : ""));
  }
  if (t === "card") {
    let r = "error";
    try { if (token) r = await activarSuscripcion(token); } catch (e) {
      console.error("flow card", (e as Error).message);
      try { await admin.from("flow_eventos").insert({ origen: "flow-webhook card", codigo: String((e as { code?: unknown }).code ?? ""), mensaje: String((e as Error).message).slice(0, 500) }); } catch (_) { /* */ }
      await admin.from("flow_suscripciones").update({ estado: "error", error: String((e as Error).message).slice(0, 500), updated_at: ahora() }).eq("register_token", token);
    }
    if (new URL(req.url).searchParams.get("v") === "regreso") return new Response(null, { status: 303, headers: { Location: "https://app.koachclub.cl/regreso?susc=" + r } });
    return ir("susc=" + r);
  }
  if (!token) return new Response("token requerido", { status: 400 });
  try {
    if (t === "sub") {
      const st = await flow("GET", "payment/getStatus", { token });
      const { error } = await admin.rpc("flow_cobro_procesar", { p_token: token, p_status: st });
      if (error) throw error;
    } else await procesarPago(token);
    return new Response("OK", { status: 200 });
  } catch (e) { console.error("flow " + t, e); return new Response("error", { status: 500 }); }
});
