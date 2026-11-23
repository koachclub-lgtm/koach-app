// KOACH · eliminar-cuenta — el socio pide eliminar su cuenta desde la app (requisito App Store 5.1.1(v) y Google Play).
// 1) valida la sesión del propio socio  2) cierra su acceso de inmediato (ban)  3) deja la solicitud registrada
// para que el borrado de datos se complete dentro de 30 días (los comprobantes de pago se conservan por ley tributaria).
// NO DESPLEGADA: requiere aplicar antes la migración 20261116120000_solicitudes_eliminacion.sql
import { createClient } from 'npm:@supabase/supabase-js@2'

const ORIGENES = ['https://app.koachclub.cl', 'https://koach-app-three.vercel.app', 'capacitor://localhost', 'https://localhost']
const URL_SB = Deno.env.get('SUPABASE_URL')!
const SRV = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

function cors(req: Request) {
  const o = req.headers.get('origin') || ''
  return {
    'Access-Control-Allow-Origin': ORIGENES.includes(o) ? o : ORIGENES[0],
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  }
}

Deno.serve(async (req) => {
  const h = { ...cors(req), 'Content-Type': 'application/json' }
  const out = (s: number, b: unknown) => new Response(JSON.stringify(b), { status: s, headers: h })
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors(req) })
  if (req.method !== 'POST') return out(405, { ok: false, codigo: 'METODO' })

  const jwt = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '')
  if (!jwt) return out(401, { ok: false, codigo: 'SIN_SESION' })
  const body = await req.json().catch(() => ({}))
  if (body?.confirmar !== true) return out(400, { ok: false, codigo: 'SIN_CONFIRMAR' })

  const admin = createClient(URL_SB, SRV, { auth: { persistSession: false } })
  const { data: u, error: eU } = await admin.auth.getUser(jwt)
  if (eU || !u?.user) return out(401, { ok: false, codigo: 'SESION_INVALIDA' })
  const user = u.user

  const { error: eS } = await admin.from('solicitudes_eliminacion').insert({
    auth_user_id: user.id, email: user.email, origen: req.headers.get('origin') || null,
  })
  if (eS && !/duplicate/i.test(eS.message)) return out(500, { ok: false, codigo: 'REGISTRO' })

  // cierre de acceso inmediato: el borrado definitivo lo ejecuta el equipo al procesar la solicitud
  const { error: eB } = await admin.auth.admin.updateUserById(user.id, { ban_duration: '876000h' })
  if (eB) return out(500, { ok: false, codigo: 'BLOQUEO' })
  await admin.auth.admin.signOut(jwt, 'global').catch(() => {})

  return out(200, { ok: true })
})
