// KOACH · Pago automático (suscripción Flow) del socio autenticado. verify_jwt = true
// acciones: estado · iniciar {plan_id} · cancelar
import { createClient } from "npm:@supabase/supabase-js@2";
import { flow, FlowError, HOOK, API_KEY } from "./flow.ts";

const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const j = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...CORS, "Content-Type": "application/json" } });
const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const COLS = "id,estado,plan_nombre,monto,duracion_valor,tarjeta_tipo,tarjeta_ult4,inicio,proximo_cobro,created_at";

// Plan Flow por plan KOACH y precio (si cambia el precio, nace un plan nuevo: Flow no permite editar monto con suscritos)
async function planFlow(plan: { nombre: string; precio: number; duracion_valor: number }) {
  const id = ("KOACH_" + plan.nombre.normalize("NFD").replace(/[^A-Za-z0-9]+/g, "_") + "_" + plan.precio).toUpperCase().slice(0, 60);
  try { await flow("GET", "plans/get", { planId: id }); return id; } catch (_) { /* no existe */ }
  await flow("POST", "plans/create", {
    planId: id, name: "KOACH · Membresía " + plan.nombre, currency: "CLP", amount: plan.precio,
    interval: 3, interval_count: plan.duracion_valor, urlCallback: HOOK + "?t=sub", charges_retries_number: 3,
  });
  return id;
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
    const { data: viva } = await admin.from("flow_suscripciones").select("*").eq("socio_id", uid)
      .in("estado", ["registrando_tarjeta", "activa", "cancelada_fin_periodo"]).order("created_at", { ascending: false }).limit(1).maybeSingle();

    if (body.accion === "estado") {
      const s = viva && viva.estado !== "registrando_tarjeta" ? viva : null;
      return j({ suscripcion: s ? Object.fromEntries(COLS.split(",").map((k) => [k, (s as Record<string, unknown>)[k]])) : null });
    }

    if (body.accion === "cancelar") {
      if (!viva || viva.estado !== "activa") return j({ error: "No tienes un pago automático activo" }, 400);
      await flow("POST", "subscription/cancel", { subscriptionId: viva.flow_subscription_id, at_period_end: 1 });
      await admin.from("flow_suscripciones").update({ estado: "cancelada_fin_periodo", updated_at: new Date().toISOString() }).eq("id", viva.id);
      return j({ ok: true });
    }

    // iniciar
    if (viva && viva.estado !== "registrando_tarjeta") return j({ error: "Ya tienes el pago automático activo" }, 400);
    if (viva) await admin.from("flow_suscripciones").update({ estado: "error", error: "reemplazada por un nuevo intento", updated_at: new Date().toISOString() }).eq("id", viva.id);
    const { data: plan } = await admin.from("planes").select("*").eq("id", body.plan_id).eq("activo", true).maybeSingle();
    if (!plan || plan.duracion_tipo !== "mes" || plan.hora_limite || !(plan.precio >= 350)) return j({ error: "Este plan no admite pago automático" }, 400);
    const { data: perfil } = await admin.from("profiles").select("id,email,nombre,apellido").eq("id", uid).maybeSingle();
    const email = (perfil?.email || u.user.email || "").trim();
    if (!email) return j({ error: "Tu cuenta no tiene correo" }, 400);

    const flowPlan = await planFlow(plan);
    // cliente Flow: se reutiliza el último conocido del socio
    const { data: prev } = await admin.from("flow_suscripciones").select("flow_customer_id").eq("socio_id", uid).not("flow_customer_id", "is", null).order("created_at", { ascending: false }).limit(1).maybeSingle();
    let customerId = prev?.flow_customer_id as string | undefined;
    if (!customerId) {
      const nombre = [perfil?.nombre, perfil?.apellido].filter(Boolean).join(" ") || email;
      try { customerId = (await flow("POST", "customer/create", { name: nombre, email, externalId: uid })).customerId; }
      catch (e) {
        // ya existe en Flow con este externalId → buscarlo
        const l = await flow("GET", "customer/list", { filter: email, limit: 100 }).catch(() => null);
        const hit = (l?.data || []).find((c: { externalId?: string; email?: string }) => c.externalId === uid || (c.email || "").toLowerCase() === email.toLowerCase());
        if (!hit) throw e;
        customerId = hit.customerId;
      }
    }
    const reg = await flow("POST", "customer/register", { customerId, url_return: HOOK + "?t=card" });
    await admin.from("flow_suscripciones").insert({
      socio_id: uid, plan_id: plan.id, plan_nombre: plan.nombre, monto: plan.precio, duracion_valor: plan.duracion_valor,
      flow_plan_id: flowPlan, flow_customer_id: customerId, email, register_token: reg.token,
    });
    return j({ url: reg.url + "?token=" + reg.token });
  } catch (e) {
    const fe = e as FlowError;
    console.error("flow-suscripcion", fe?.message, fe?.data);
    return j({ error: fe instanceof FlowError ? "Flow: " + fe.message : String(fe?.message || e) }, 502);
  }
});
