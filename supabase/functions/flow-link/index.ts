// KOACH · Flow — crea el pago en Flow para una orden que Jake o el panel ya prepararon con flow_link_preparar
// (verify_jwt = false). Solo acepta órdenes origen 'jake', en estado 'creada', sin token y creadas hace menos de
// 15 minutos: el monto y el cliente los fija la base con la clave de servicio, esta función no recibe precios.
import { createClient } from "npm:@supabase/supabase-js@2";
import { flow, HOOK } from "./flow.ts";

const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const j = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method !== "POST") return j({ error: "POST" }, 405);
  try {
    const { orden_id } = await req.json().catch(() => ({}));
    if (!orden_id) return j({ error: "falta orden_id" }, 400);
    const { data: o } = await admin.from("flow_ordenes").select("*").eq("id", orden_id).maybeSingle();
    if (!o || o.origen !== "jake" || o.estado !== "creada" || o.flow_token) return j({ error: "orden no disponible" }, 400);
    if (Date.now() - new Date(o.created_at).getTime() > 15 * 60e3) return j({ error: "orden vencida" }, 400);

    let fr: { token?: string; url?: string; flowOrder?: number };
    try {
      fr = await flow("POST", "payment/create", {
        commerceOrder: o.commerce_order,
        subject: ("KOACH Club · " + o.plan_nombre).slice(0, 255),
        currency: "CLP", amount: o.monto, email: o.email,
        urlConfirmation: HOOK + "?t=confirm", urlReturn: HOOK + "?t=return",
        paymentMethod: 9, timeout: 7 * 24 * 3600,
        optional: JSON.stringify({ socio: o.socio_id, oferta: o.oferta, origen: "jake" }),
      });
    } catch (e) {
      await admin.from("flow_ordenes").update({ estado: "error", error: String((e as Error).message).slice(0, 500), updated_at: new Date().toISOString() }).eq("id", o.id);
      return j({ error: "Flow rechazó la orden: " + (e as Error).message }, 502);
    }
    if (!fr?.token || !fr?.url) return j({ error: "Flow no devolvió el link" }, 502);
    await admin.from("flow_ordenes").update({ flow_token: fr.token, flow_order: fr.flowOrder, estado: "pendiente", updated_at: new Date().toISOString() }).eq("id", o.id);
    return j({ url: fr.url + "?token=" + fr.token, orden: o.commerce_order });
  } catch (e) {
    return j({ error: String((e as Error)?.message || e) }, 500);
  }
});
