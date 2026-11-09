// KOACH · Notificaciones de Flow. verify_jwt = false: Flow solo envía un token y el estado real
// SIEMPRE se consulta firmado a Flow.
//   ?t=confirm  urlConfirmation de pagos únicos     ?t=return  vuelta del pagador (pago único)
//   ?t=card     vuelta del registro de tarjeta       ?t=sub     urlCallback de cada cobro automático
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
  if (s.estado === "activa") return "activa";
  const rs = await flow("GET", "customer/getRegisterStatus", { token });
  if (String(rs.status) !== "1") {
    await admin.from("flow_suscripciones").update({ estado: "error", error: "tarjeta no registrada", flow_data: rs, updated_at: ahora() }).eq("id", s.id);
    return "tarjeta_rechazada";
  }
  const { data: acc } = await admin.rpc("_flow_fin_acceso", { p_socio: s.socio_id });
  const hoy = hoyCL();
  const inicio = acc && acc > hoy ? acc : hoy;
  const sub = await flow("POST", "subscription/create", { planId: s.flow_plan_id, customerId: s.flow_customer_id, subscription_start: inicio });
  const permHasta = s.permanencia_meses > 0 ? (() => { const d = new Date(inicio + "T12:00:00Z"); d.setUTCMonth(d.getUTCMonth() + s.permanencia_meses); return d.toISOString().slice(0, 10); })() : null;
  await admin.from("flow_suscripciones").update({
    estado: "activa", flow_subscription_id: sub.subscriptionId, inicio, permanencia_hasta: permHasta,
    proximo_cobro: inicio,
    tarjeta_tipo: rs.creditCardType || null, tarjeta_ult4: rs.last4CardDigits || null,
    flow_data: sub, error: null, updated_at: ahora(),
  }).eq("id", s.id);
  return "activa";
}

Deno.serve(async (req) => {
  const t = new URL(req.url).searchParams.get("t");
  if (t === "ping") {
    let flowR: unknown = null;
    try { await flow("GET", "payment/getStatus", { token: "ping_koach" }); } catch (e) { flowR = String((e as Error).message).slice(0, 300); }
    let planes: unknown = null;
    try { const l = await flow("GET", "plans/list", { limit: 50 }); planes = { total: l.total, ids: (l.data || []).map((x: { planId: string }) => x.planId) }; }
    catch (e) { planes = "error: " + String((e as Error).message).slice(0, 200); }
    return new Response(JSON.stringify({ api_key: !!API_KEY, flow: flowR, planes }), { headers: { "Content-Type": "application/json" } });
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
      await admin.from("flow_suscripciones").update({ estado: "error", error: String((e as Error).message).slice(0, 500), updated_at: ahora() }).eq("register_token", token);
    }
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
