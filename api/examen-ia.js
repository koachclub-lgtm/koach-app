// POST /api/examen-ia · Lee una foto o PDF de examen de laboratorio y devuelve los valores ordenados.
// La IA SOLO transcribe lo impreso (nunca interpreta ni calcula); el motor KOACH (domain/koach-biomarcadores.js)
// identifica cada analito, convierte unidades y marca lecturas dudosas. Nada se guarda aquí: el socio o nutrición
// revisa y confirma en la app antes de guardar. Requiere ANTHROPIC_API_KEY en Vercel.
const KB = require('../domain/koach-biomarcadores.js')
const SB_URL = 'https://siecbdatfgmqbpxqtvsl.supabase.co'
const SB_KEY = 'sb_publishable_ffGsmagqocuP1n1jvKUVGw_hVzdojas'
const MODELO = process.env.KOACH_EXAMEN_MODEL || 'claude-sonnet-5-5'
const MAX_ARCHIVOS = 4, MAX_B64 = 4300000
const TIPOS = ['image/jpeg','image/png','image/webp','image/gif','application/pdf']

const ESQUEMA = {
  type:'object', additionalProperties:false, required:['legible','fecha_examen','laboratorio','analitos','problemas'],
  properties:{
    legible:{ type:'boolean', description:'false si la imagen no permite leer los resultados con seguridad' },
    problemas:{ type:'string', description:'Qué no se pudo leer o qué está borroso/cortado. Vacío si todo se leyó bien.' },
    fecha_examen:{ type:'string', description:'Fecha de toma de muestra en formato AAAA-MM-DD. Si no aparece, vacío.' },
    laboratorio:{ type:'string', description:'Nombre del laboratorio o centro de salud. Vacío si no aparece.' },
    analitos:{ type:'array', items:{ type:'object', additionalProperties:false, required:['nombre','valor','unidad','ref_min','ref_max','ref_texto'],
      properties:{
        nombre:{ type:'string', description:'Nombre del examen tal como está impreso (ej. "Glicemia", "Colesterol HDL", "Linfocitos %").' },
        valor:{ type:'string', description:'Resultado tal como está impreso, con su signo si lo tiene (ej. "94", "5,6", "<0,5").' },
        unidad:{ type:'string', description:'Unidad tal como está impresa (ej. "mg/dL", "%", "x10^3/uL"). Vacío si no hay.' },
        ref_min:{ type:'string', description:'Límite inferior del valor de referencia impreso. Vacío si no hay.' },
        ref_max:{ type:'string', description:'Límite superior del valor de referencia impreso. Vacío si no hay.' },
        ref_texto:{ type:'string', description:'Texto completo del valor de referencia tal como está impreso.' }
      } } }
  }
}
const PROMPT = `Eres un transcriptor de exámenes de laboratorio clínico de Chile. Transcribe EXACTAMENTE los resultados numéricos que aparecen en el documento.
Reglas:
- Copia nombre, resultado, unidad y valor de referencia tal como están impresos. No corrijas, no redondees, no calcules, no interpretes.
- Incluye todos los resultados de sangre (bioquímica, perfil lipídico, perfil hepático, hemograma, hormonas, vitaminas, electrolitos). Omite orina y textos sin valor numérico.
- En el hemograma, si un analito aparece en % y en recuento absoluto, entrégalos como dos analitos con el nombre indicando cuál es (ej. "Linfocitos %" y "Linfocitos absolutos").
- Si una curva de glucosa o insulina tiene varios tiempos, incluye el tiempo en el nombre (ej. "Glicemia basal", "Glicemia 120 min").
- Si el valor de referencia es "< 200", ref_min vacío y ref_max "200". Si es "40 - 60", ref_min "40" y ref_max "60". Si depende de sexo o edad, usa solo el tramo que corresponde si es evidente; si no, deja ref_min y ref_max vacíos y copia el texto en ref_texto.
- NO incluyas datos personales: nombre del paciente, RUT, dirección, teléfono, nombre del médico ni números de folio.
- Si algo está borroso, cortado o tapado, no lo inventes: omítelo y descríbelo en "problemas".`

async function json(url, opts){ const r = await fetch(url, opts); const t = await r.text(); let d = null; try { d = JSON.parse(t) } catch (_) {} return { ok:r.ok, status:r.status, d, t } }
const rest = (path, token, body) => json(SB_URL + path, { method: body ? 'POST' : 'GET', headers:{ apikey:SB_KEY, Authorization:'Bearer ' + token, 'content-type':'application/json' }, body: body ? JSON.stringify(body) : undefined })

module.exports = async (req, res) => {
  if (req.method !== 'POST'){ res.setHeader('Allow', 'POST'); return res.status(405).json({ error:'Método no permitido' }) }
  const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '')
  if (!token) return res.status(401).json({ error:'Sin sesión' })
  const u = await rest('/auth/v1/user', token)
  if (!u.ok || !u.d || !u.d.id) return res.status(401).json({ error:'Sesión inválida' })
  const yo = await rest('/rest/v1/profiles?select=role,activo,sex&id=eq.' + encodeURIComponent(u.d.id), token)
  const p = yo.ok && yo.d && yo.d[0]; if (!p || p.activo === false) return res.status(403).json({ error:'Cuenta sin acceso' })
  const b = req.body || {}, staff = ['admin','nutricionista'].includes(p.role)
  const socio = b.socio_id || u.d.id
  if (socio !== u.d.id && !staff) return res.status(403).json({ error:'Solo puedes subir tus propios exámenes' })
  let sexo = p.sex
  if (socio !== u.d.id){ const s = await rest('/rest/v1/profiles?select=sex&id=eq.' + encodeURIComponent(socio), token); sexo = s.ok && s.d && s.d[0] ? s.d[0].sex : null }
  else {
    const c = await rest('/rest/v1/rpc/koach_consiente', token, { p_socio:socio, p_tipo:'examenes_ia' })
    if (!c.ok || c.d !== true) return res.status(403).json({ error:'Falta tu autorización para leer exámenes con IA', codigo:'consentimiento' })
    const m = await rest('/rest/v1/rpc/koach_es_menor', token, { p_socio:socio })
    if (m.ok && m.d === true) return res.status(403).json({ error:'Los exámenes de menores de edad los registra nutrición con autorización de su apoderado', codigo:'menor' })
  }
  if (!process.env.ANTHROPIC_API_KEY) return res.status(503).json({ error:'Falta configurar ANTHROPIC_API_KEY en Vercel (proyecto koach-app)' })

  const arch = Array.isArray(b.archivos) ? b.archivos : []
  if (!arch.length || arch.length > MAX_ARCHIVOS) return res.status(400).json({ error:'Sube entre 1 y ' + MAX_ARCHIVOS + ' imágenes o un PDF' })
  if (arch.some(a => !a || !TIPOS.includes(a.tipo) || typeof a.data !== 'string')) return res.status(400).json({ error:'Formato no soportado: usa foto (JPG/PNG) o PDF' })
  if (arch.reduce((s, a) => s + a.data.length, 0) > MAX_B64) return res.status(413).json({ error:'Archivo muy pesado: usa fotos o un PDF de menos de 3 MB' })

  const content = arch.map(a => a.tipo === 'application/pdf'
    ? { type:'document', source:{ type:'base64', media_type:'application/pdf', data:a.data } }
    : { type:'image', source:{ type:'base64', media_type:a.tipo, data:a.data } })
  content.push({ type:'text', text:'Transcribe los resultados de este examen.' })
  const r = await json('https://api.anthropic.com/v1/messages', {
    method:'POST', headers:{ 'content-type':'application/json', 'x-api-key':process.env.ANTHROPIC_API_KEY, 'anthropic-version':'2023-06-01' },
    // Salida estructurada con output_config.format: en Sonnet/Opus 5.5 el tool_choice forzado devuelve 400
    body: JSON.stringify({ model:MODELO, max_tokens:8000, system:PROMPT, output_config:{ format:{ type:'json_schema', schema:ESQUEMA } }, messages:[{ role:'user', content }] })
  })
  if (!r.ok) return res.status(502).json({ error:'No se pudo leer el examen (' + r.status + ')', detalle: r.d && r.d.error && r.d.error.message })
  if (r.d.stop_reason === 'refusal') return res.status(422).json({ error:'El documento no pudo procesarse. Ingresa los valores a mano.' })
  if (r.d.stop_reason === 'max_tokens') return res.status(422).json({ error:'El examen es muy extenso: súbelo en partes (una hoja por vez).' })
  const txt = (r.d.content || []).filter(c => c.type === 'text').map(c => c.text).join('')
  let x = null; try { x = JSON.parse(txt) } catch (_) {}
  if (!x) return res.status(502).json({ error:'La lectura no devolvió resultados' })
  const analitos = Array.isArray(x.analitos) ? x.analitos : []
  const norm = analitos.map(a => KB.normalizar(a, sexo))
  // un código por examen: si se repite, gana el que tiene valor válido y rango del laboratorio
  const vistos = {}, reconocidos = []
  norm.filter(n => n.reconocido && n.codigo).forEach(n => { const k = n.codigo, prev = vistos[k]
    const score = v => (v.valido ? 2 : 0) + (v.rango_origen === 'laboratorio' ? 1 : 0)
    if (!prev){ vistos[k] = n; reconocidos.push(n) } else if (score(n) > score(prev)){ reconocidos[reconocidos.indexOf(prev)] = n; vistos[k] = n } })
  const fecha = /^\d{4}-\d{2}-\d{2}$/.test(x.fecha_examen || '') ? x.fecha_examen : null
  return res.status(200).json({
    legible: x.legible !== false, problemas: x.problemas || '', fecha_examen: fecha, laboratorio: (x.laboratorio || '').slice(0, 120),
    reconocidos, no_reconocidos: norm.filter(n => !n.reconocido).map(n => ({ nombre:n.nombre_original, valor:n.valor_texto, unidad:n.unidad_original })),
    extraccion: analitos, modelo: MODELO, motor: KB.VERSION
  })
}
