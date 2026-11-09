// KOACH · Flow — crea una orden de pago para el socio autenticado (verify_jwt = true)
import { createClient } from "npm:@supabase/supabase-js@2";

const FLOW_API = Deno.env.get("FLOW_API_URL") || "https://www.flow.cl/api";
const API_KEY = Deno.env.get("FLOW_API_KEY")!;
const SECRET = Deno.env.get("FLOW_SECRET_KEY")!;
const SB_URL = Deno.env.get("SUPABASE_URL")!;
const SRV = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const j = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...CORS, "Content-Type": "application/json" } });

async function firmar(p: Record<string, string>) {
  const txt = Object.keys(p).sort().map((k) => k + p[k]).join("");
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(SECRET), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(txt));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    if (!API_KEY || !SECRET) return j({ error: "Flow no está configurado" }, 500);
    const admin = createClient(SB_URL, SRV);
    const jwt = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
    const { data: u } = await admin.auth.getUser(jwt);
    if (!u?.user) return j({ error: "Sesión no válida" }, 401);
    const body = await req.json().catch(() => ({}));

    if (body.accion === "planes") {
      const { data } = await admin.from("planes").select("id,nombre,precio,duracion_tipo,duracion_valor,hora_limite").eq("activo", true).gte("precio", 350).order("precio");
      const { data: cobros } = await admin.from("cobros_socio").select("id,monto,duracion_tipo,duracion_valor,tipo_comercial,recurrente,concepto,created_at").eq("socio_id", u.user.id).eq("estado", "pendiente").order("created_at", { ascending: false });
      return j({ planes: data || [], cobros: cobros || [] });
    }
    if (body.accion === "estado") {
      const { data } = await admin.from("flow_ordenes").select("id,estado,plan_nombre,monto,pagada_at").eq("socio_id", u.user.id).eq("commerce_order", String(body.orden || "")).maybeSingle();
      return j({ orden: data });
    }

    // accion: crear — desde un plan del catálogo o desde un cobro individual asignado por el staff
    let plan: { id: string | null; nombre: string; precio: number; duracion_tipo: string; duracion_valor: number; tc: string; cobro_id: string | null } | null = null;
    if (body.cobro_id) {
      const { data: c } = await admin.from("cobros_socio").select("*").eq("id", body.cobro_id).eq("socio_id", u.user.id).eq("estado", "pendiente").maybeSingle();
      if (!c || c.recurrente) return j({ error: "Este cobro ya no está disponible" }, 400);
      const dur = c.duracion_tipo === "mes" ? (c.duracion_valor === 1 ? "1 MES" : c.duracion_valor + " MESES") : c.duracion_tipo === "semana" ? c.duracion_valor + " SEMANA" + (c.duracion_valor > 1 ? "S" : "") : "DAY PASS";
      plan = { id: null, nombre: c.concepto || dur, precio: c.monto, duracion_tipo: c.duracion_tipo, duracion_valor: c.duracion_valor, tc: c.tipo_comercial, cobro_id: c.id };
    } else {
      const { data: pl } = await admin.from("planes").select("*").eq("id", body.plan_id).eq("activo", true).maybeSingle();
      if (pl) plan = { id: pl.id, nombre: pl.nombre, precio: pl.precio, duracion_tipo: pl.duracion_tipo, duracion_valor: pl.duracion_valor, tc: "normal", cobro_id: null };
    }
    if (!plan || !(plan.precio >= 350)) return j({ error: "Plan no disponible para pago en línea" }, 400);
    const { data: perfil } = await admin.from("profiles").select("id,email,nombre,apellido").eq("id", u.user.id).maybeSingle();
    if (!perfil) return j({ error: "Perfil no encontrado" }, 400);
    const email = perfil.email || u.user.email;
    const { data: o, error: eo } = await admin.from("flow_ordenes").insert({
      socio_id: perfil.id, plan_id: plan.id, plan_nombre: plan.nombre, monto: plan.precio,
      duracion_tipo: plan.duracion_tipo, duracion_valor: plan.duracion_valor, email, tipo_comercial: plan.tc, cobro_id: plan.cobro_id,
    }).select().single();
    if (eo) return j({ error: eo.message }, 500);

    const hook = SB_URL + "/functions/v1/flow-webhook";
    const p: Record<string, string> = {
      apiKey: API_KEY, commerceOrder: o.commerce_order,
      subject: ("KOACH · Membresía " + plan.nombre).slice(0, 255),
      currency: "CLP", amount: String(plan.precio), email,
      urlConfirmation: hook + "?t=confirm", urlReturn: hook + "?t=return",
      paymentMethod: "9", optional: JSON.stringify({ socio: perfil.id, plan: plan.nombre }),
    };
    p.s = await firmar(p);
    const r = await fetch(FLOW_API + "/payment/create", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams(p) });
    const fr = await r.json().catch(() => ({}));
    if (!r.ok || !fr.token) {
      await admin.from("flow_ordenes").update({ estado: "error", error: JSON.stringify(fr).slice(0, 500), updated_at: new Date().toISOString() }).eq("id", o.id);
      return j({ error: "Flow rechazó la orden", detalle: fr }, 502);
    }
    await admin.from("flow_ordenes").update({ flow_token: fr.token, flow_order: fr.flowOrder, estado: "pendiente", updated_at: new Date().toISOString() }).eq("id", o.id);
    return j({ url: fr.url + "?token=" + fr.token, orden: o.commerce_order });
  } catch (e) {
    return j({ error: String((e as Error)?.message || e) }, 500);
  }
});
