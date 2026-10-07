// KOACH · koach-acceso — recuperación de acceso de socios desde el Dashboard (server side).
// La service role vive SOLO aquí (env del runtime). Nunca se devuelve, nunca se registra.
// Acciones: estado · enviar_correo · generar_enlace · corregir_correo
import { createClient } from 'npm:@supabase/supabase-js@2'

const APP = 'https://app.koachclub.cl'
const REDIRECT = APP + '/app.html'                       // flujo de recuperación existente (PASSWORD_RECOVERY → fNueva)
const ORIGENES = ['https://dashboard.koachclub.cl', 'https://app.koachclub.cl', 'https://koach-app-three.vercel.app']
const STAFF = ['admin', 'coach', 'recepcion']             // nutricionista no gestiona accesos
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
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i
function enmascarar(e: string) { const [u, d] = e.split('@'); return (u.length <= 2 ? u[0] + '*' : u.slice(0, 4) + '***') + '@' + d }
function errTxt(m: string) {
  if (/rate|seconds|too many|limit/i.test(m)) return { codigo: 'RATE', msg: 'Demasiados intentos. Prueba nuevamente en unos minutos.' }
  if (/invalid.*email|email.*invalid|validate email/i.test(m)) return { codigo: 'EMAIL_INVALIDO', msg: 'El correo no es válido. Revisa la dirección registrada.' }
  if (/already|registered|exists/i.test(m)) return { codigo: 'EMAIL_EN_USO', msg: 'Ese correo ya pertenece a otra cuenta.' }
  if (/not found|no user/i.test(m)) return { codigo: 'SIN_CUENTA', msg: 'Este socio no tiene una cuenta de acceso creada.' }
  return { codigo: 'ERROR', msg: 'No pudimos completar la acción. Intenta otra vez.' }
}

Deno.serve(async (req) => {
  const h = { ...cors(req), 'Content-Type': 'application/json' }
  const out = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: h })
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors(req) })
  if (req.method !== 'POST') return out(405, { ok: false, codigo: 'METODO', msg: 'Método no permitido.' })

  // 1 · sesión del staff (no se confía en que el botón esté oculto)
  const jwt = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '')
  if (!jwt) return out(401, { ok: false, codigo: 'SIN_SESION', msg: 'Tu sesión expiró. Vuelve a ingresar.' })
  const adm = createClient(URL_SB, SRV, { auth: { persistSession: false, autoRefreshToken: false } })
  const { data: yo, error: eYo } = await adm.auth.getUser(jwt)
  if (eYo || !yo?.user) return out(401, { ok: false, codigo: 'SIN_SESION', msg: 'Tu sesión expiró. Vuelve a ingresar.' })
  const { data: actor } = await adm.from('profiles').select('id,role,nombre,apellido,activo').eq('id', yo.user.id).maybeSingle()
  if (!actor || actor.activo === false || !STAFF.includes(String(actor.role)))
    return out(403, { ok: false, codigo: 'SIN_PERMISO', msg: 'Tu rol no permite gestionar accesos de socios.' })

  let body: Record<string, string> = {}
  try { body = await req.json() } catch { return out(400, { ok: false, codigo: 'BODY', msg: 'Solicitud inválida.' }) }
  const accion = String(body.accion || ''), socioId = String(body.socio_id || '')
  if (!/^[0-9a-f-]{36}$/i.test(socioId)) return out(400, { ok: false, codigo: 'SOCIO', msg: 'Socio inválido.' })

  // 2 · socio objetivo: solo socios (un admin puede gestionar cualquier cuenta; nadie se gestiona a sí mismo por aquí)
  const { data: soc } = await adm.from('profiles').select('id,role,nombre,apellido,email').eq('id', socioId).maybeSingle()
  if (!soc) return out(404, { ok: false, codigo: 'SOCIO', msg: 'No encontramos a este socio.' })
  if (socioId === actor.id) return out(403, { ok: false, codigo: 'PROPIA', msg: 'Para tu propia cuenta usa MI CLAVE.' })
  if (soc.role !== 'socio' && actor.role !== 'admin') return out(403, { ok: false, codigo: 'SIN_PERMISO', msg: 'Solo un administrador puede gestionar cuentas del equipo.' })

  const { data: au, error: eAu } = await adm.auth.admin.getUserById(socioId)
  const u = au?.user
  const actorNombre = ((actor.nombre || '') + ' ' + (actor.apellido || '')).trim() || 'STAFF'
  const auditar = (acc: string, antes: unknown = null, despues: unknown = null) =>
    adm.from('admin_eventos').insert({ socio_id: socioId, entidad: 'acceso', entidad_id: socioId, accion: acc, antes, despues, actor_id: actor.id, actor_nombre: actorNombre })
      .then(({ error }) => { if (error) console.error('audit', acc, error.message) })

  if (accion === 'estado') {
    if (eAu || !u) return out(200, { ok: true, existe: false })
    return out(200, { ok: true, existe: true, email: u.email || null, ultimo_acceso: u.last_sign_in_at || null,
      creado: u.created_at, recuperacion_enviada: (u as any).recovery_sent_at || null, nunca_ingreso: !u.last_sign_in_at })
  }
  if (eAu || !u) return out(200, { ok: false, ...errTxt('not found') })
  const email = (u.email || '').trim()

  if (accion === 'enviar_correo') {
    if (!email) return out(200, { ok: false, codigo: 'SIN_EMAIL', msg: 'Sin correo registrado. Agrega uno primero.' })
    if (!EMAIL_RE.test(email)) return out(200, { ok: false, ...errTxt('invalid email') })
    const { error } = await adm.auth.resetPasswordForEmail(email, { redirectTo: REDIRECT })
    if (error) return out(200, { ok: false, ...errTxt(error.message) })
    await auditar('recovery_email_sent', null, { destino: enmascarar(email), nunca_ingreso: !u.last_sign_in_at })
    return out(200, { ok: true, destino: enmascarar(email), espera_seg: 60 })
  }

  if (accion === 'generar_enlace') {
    if (!email) return out(200, { ok: false, codigo: 'SIN_EMAIL', msg: 'Sin correo registrado. Agrega uno primero.' })
    const { data, error } = await adm.auth.admin.generateLink({ type: 'recovery', email, options: { redirectTo: REDIRECT } })
    if (error || !data?.properties?.hashed_token) return out(200, { ok: false, ...errTxt(error?.message || '') })
    // El enlace vive en app.koachclub.cl: la app canjea el token con verifyOtp al abrirse (las vistas previas
    // de WhatsApp no ejecutan JS, así que no lo consumen). No se persiste ni se registra.
    const url = APP + '/app.html?acceso=' + encodeURIComponent(data.properties.hashed_token)
    await auditar('recovery_link_generated', null, { nunca_ingreso: !u.last_sign_in_at })
    return out(200, { ok: true, url })
  }

  if (accion === 'corregir_correo') {
    const nuevo = String(body.email || '').trim().toLowerCase()
    if (!EMAIL_RE.test(nuevo) || /@(gmail|hotmail|outlook|yahoo)\.(con|cmo|co)$|@gma\.com$|@gmai\.com$/.test(nuevo))
      return out(200, { ok: false, ...errTxt('invalid email') })
    if (nuevo === email.toLowerCase()) return out(200, { ok: false, codigo: 'IGUAL', msg: 'Es el mismo correo registrado.' })
    const { data: dup } = await adm.from('profiles').select('id').ilike('email', nuevo).neq('id', socioId).limit(1)
    if (dup && dup.length) return out(200, { ok: false, ...errTxt('already') })
    // Una sola verdad: primero Auth (identidad), luego el perfil. Si el perfil falla, se revierte Auth.
    const { error: e1 } = await adm.auth.admin.updateUserById(socioId, { email: nuevo, email_confirm: true })
    if (e1) return out(200, { ok: false, ...errTxt(e1.message) })
    const { error: e2 } = await adm.from('profiles').update({ email: nuevo }).eq('id', socioId)
    if (e2) { await adm.auth.admin.updateUserById(socioId, { email, email_confirm: true }); return out(200, { ok: false, ...errTxt(e2.message) }) }
    await auditar('email_updated', { email }, { email: nuevo })
    return out(200, { ok: true, email: nuevo })
  }

  return out(400, { ok: false, codigo: 'ACCION', msg: 'Acción no reconocida.' })
})
