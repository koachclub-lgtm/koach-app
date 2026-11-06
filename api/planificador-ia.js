// POST /api/planificador-ia · Planificador por voz/selección con el MASTERMIND HYPERTROPHY (Claude, servidor).
// El koach dicta o elige criterios; la IA arma la semana del socio con ejercicios de la biblioteca KOACH y las reglas
// del Método. NO escribe en la base: devuelve una propuesta; el koach la revisa (con el evaluador) y decide aplicarla.
// Solo koach/admin. Requiere ANTHROPIC_API_KEY en Vercel (proyecto koach-app).
const SB_URL = 'https://siecbdatfgmqbpxqtvsl.supabase.co'
const SB_KEY = 'sb_publishable_ffGsmagqocuP1n1jvKUVGw_hVzdojas'
const MODELO = process.env.KOACH_PLAN_MODEL || 'claude-sonnet-5-5'

const ESQUEMA = {
  type: 'object', additionalProperties: false,
  required: ['resumen', 'decisiones', 'sesiones'],
  properties: {
    resumen: { type: 'string', description: '1–2 frases para el koach: qué se armó y por qué.' },
    decisiones: { type: 'array', items: { type: 'string' }, description: 'Decisiones técnicas clave en frases cortas (volumen por músculo, prioridades, por qué cada ancla, tiempos). Máx. 6.' },
    sesiones: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['nombre', 'objetivo', 'bloques'],
      properties: {
        nombre: { type: 'string', description: 'Nombre corto en mayúsculas: FULL BODY A · PRIORIDAD SUPERIOR, LOWER, etc.' },
        objetivo: { type: 'string' },
        bloques: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['bloque', 'sets', 'descanso_seg', 'ejercicios'],
          properties: {
            bloque: { type: 'string', enum: ['B1', 'B2', 'B3', 'B4'] },
            sets: { type: 'integer' },
            descanso_seg: { type: 'integer' },
            ejercicios: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['nombre', 'reps', 'tiempo', 'rir', 'ancla'],
              properties: {
                nombre: { type: 'string', description: 'Nombre EXACTO de la biblioteca KOACH' },
                reps: { type: 'string', description: 'Reps ("10", "8-10") o segundos si tiempo=true ("30")' },
                tiempo: { type: 'boolean', description: 'true si se mide en segundos (core isométrico, movilidad, cardio)' },
                rir: { type: 'string', description: 'RIR objetivo ("1-2", "2", "3"); vacío en core/movilidad/cardio' },
                ancla: { type: 'boolean', description: 'true solo en el ejercicio ancla del patrón (máx. 1 por bloque, en B2)' } } } } } } } } } }
  }
}

const METODO = `MÉTODO KOACH (estructura, obligatorio salvo que el koach dicte otra cosa):
- Cada sesión: B1 activación (demanda MEDIA/BAJA; CORE penúltimo y MOVILIDAD al final) · B2 fuerza principal con el ancla liderando (demanda ALTA/MEDIA) · B3 cierre accesorio (solo demanda BAJA). Un B4 solo si el koach lo pide o el tiempo lo exige.
- Orden en cada bloque: demanda ALTA → MEDIA → BAJA; compuesto antes que aislado; bíceps/tríceps al final del bloque. Nunca un ejercicio técnico complejo después de aislados.
- No mezclar bilateral + unilateral del mismo segmento en un bloque. Un mismo músculo no lidera 2 bloques el mismo día. ≥1 dominante de cadera por sesión. Tracción ≥ empuje en la semana.
- Hombre: bíceps y tríceps nunca el mismo día; isquios ≥ glúteo. Mujer: cadera > rodilla; glúteo con un ejercicio en largo (RDL/sentadilla), uno en acortado (hip thrust/puente) y abducción.
- Nivel BÁSICO: nada de sentadilla/banca/peso muerto con barra, saltos ni olímpicos; usa máquinas y mancuernas. Respeta el nivel mínimo de cada ejercicio.
- Regla de los tercios: B2 pesado (ancla), B1 moderado (8–12), B3 liviano (12–20).
- Anclas (máx. 1 por bloque, en B2, liderando): rodilla, cadera, empuje y tracción en la semana.
DOSIS POR PROGRAMA:
- STRONG: sets 3/4/3 · descanso B1 60 · B2 120–180 · B3 60–90 s · ancla básico 12–15 / intermedio 8–10 / avanzado 6–8 · resto 10–15 · RIR compuestos 1–2, máquinas/aislados 0–1.
- BURN: sets 3/4/3 + 30 s de cardio al inicio de B1 · descansos 45–60 / 60–90 / 45–60 s · ancla 12–15 / 10–12 / 8–10 · RIR 1–3.
- HEALTHY: sets 3/4/3 · descansos 60–90 / 75–120 / 60–90 s · reps 12–15 · RIR 2–3.
EVIDENCIA (mastermind):
- Volumen semanal por músculo (series duras; sinergistas cuentan 0,5): mínimo 4; músculos grandes objetivo 10–20; techo útil ~20; ≤ ~11 series por músculo por sesión.
- Frecuencia ≥2 por semana en músculos objetivo. RIR 0–3. Básicos 1–3 RIR (técnica primero).
- Elegir el ejercicio con mejor relación estímulo/fatiga (SFR): máquinas y poleas para básicos y gimnasio externo; barra cuando el objetivo sea fuerza y el nivel lo permita.
- Tiempo: estima ~ (reps×3 s + 15 s por ejercicio + descanso) × sets por bloque. Respeta el tiempo pedido.`

async function json(url, opts) { const r = await fetch(url, opts); const t = await r.text(); let d = null; try { d = JSON.parse(t) } catch (_) {} return { ok: r.ok, status: r.status, d, t } }
const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim()

module.exports = async (req, res) => {
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).json({ error: 'Método no permitido' }) }
  const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '')
  if (!token) return res.status(401).json({ error: 'Sin sesión' })
  const H = { apikey: SB_KEY, Authorization: 'Bearer ' + token }
  const u = await json(SB_URL + '/auth/v1/user', { headers: H })
  if (!u.ok || !u.d || !u.d.id) return res.status(401).json({ error: 'Sesión inválida' })
  const p = await json(SB_URL + '/rest/v1/profiles?select=role,activo&id=eq.' + encodeURIComponent(u.d.id), { headers: H })
  const rol = p.ok && p.d && p.d[0] && p.d[0].activo !== false ? p.d[0].role : null
  if (!['admin', 'coach'].includes(rol)) return res.status(403).json({ error: 'Solo el koach o administración pueden planificar' })
  if (!process.env.ANTHROPIC_API_KEY) return res.status(503).json({ error: 'Falta configurar ANTHROPIC_API_KEY en Vercel (proyecto koach-app)' })

  const b = req.body || {}, c = b.criterios || {}
  const dictado = String(b.instruccion || '').trim().slice(0, 4000)
  if (dictado.length < 4 && !c.programa) return res.status(400).json({ error: 'Dicta o elige qué quieres planificar' })

  // Biblioteca activa (fuente de verdad de nombres) y anamnesis del socio si existe
  const lib = await json(SB_URL + '/rest/v1/ejercicios?select=id,nombre,estimulo,demanda,nivel_min,patron,implemento,tipo_registro&activo=is.true&order=estimulo,nombre', { headers: H })
  if (!lib.ok || !Array.isArray(lib.d) || !lib.d.length) return res.status(502).json({ error: 'No se pudo leer la biblioteca de ejercicios' })
  let anam = null
  if (b.socio_id && /^[0-9a-f-]{36}$/i.test(b.socio_id)) {
    const a = await json(SB_URL + '/rest/v1/anamnesis_prueba?select=respuestas&socio_id=eq.' + b.socio_id, { headers: H })
    if (a.ok && a.d && a.d[0]) anam = a.d[0].respuestas
  }
  const catalogo = lib.d.map(e => [e.nombre, e.estimulo, e.demanda, e.nivel_min, e.patron, e.implemento || ''].join(' | ')).join('\n')

  const prompt = `Eres el MASTERMIND HYPERTROPHY de KOACH Club (Concepción, Chile): el planificador técnico del head koach.
Arma la SEMANA de entrenamiento del socio según el DICTADO del koach y sus CRITERIOS. El dictado manda sobre los valores por defecto; el Método KOACH manda sobre tus preferencias. Español de Chile, sin emojis.

SOCIO: ${c.nombre || '—'} · sexo ${c.sexo || '—'} · nivel ${c.nivel || '—'} · programa ${c.programa || '—'}
CRITERIOS ELEGIDOS: ${JSON.stringify(c)}
${anam ? 'ANAMNESIS DE LA CLASE DE PRUEBA (respuestas del socio): ' + JSON.stringify(anam).slice(0, 3000) : ''}

DICTADO DEL KOACH:
"""${dictado || '(sin dictado: usa solo los criterios)'}"""

${METODO}

REGLAS DE SALIDA:
- Una sesión por cada día de entrenamiento pedido (días fijos + día rotativo si lo pide; el rotativo completa lo que falte de volumen y grupos).
- Usa SOLO ejercicios de la BIBLIOTECA, con el nombre EXACTO. Respeta el nivel mínimo y el implemento que pida el koach.
- Core y movilidad con tiempo=true (segundos). Cardio de BURN con tiempo=true.
- En "decisiones" explica en frases cortas el volumen semanal logrado por músculo grande y secundario y cualquier regla que no se pudo cumplir por pedido del koach.

BIBLIOTECA KOACH (nombre | estímulo | demanda | nivel mínimo | patrón | implemento):
${catalogo}`

  const r = await json('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: MODELO, max_tokens: 12000, output_config: { effort: 'medium', format: { type: 'json_schema', schema: ESQUEMA } }, messages: [{ role: 'user', content: prompt }] })
  })
  if (!r.ok) return res.status(502).json({ error: 'La IA no respondió (' + r.status + ')', detalle: r.d && r.d.error && r.d.error.message })
  if (r.d.stop_reason === 'refusal') return res.status(422).json({ error: 'La IA no pudo planificar este pedido.' })
  if (r.d.stop_reason === 'max_tokens') return res.status(422).json({ error: 'La propuesta quedó incompleta: pide menos sesiones o ejercicios.' })
  const txt = (r.d.content || []).filter(x => x.type === 'text').map(x => x.text).join('')
  let plan = null; try { plan = JSON.parse(txt) } catch (_) {}
  if (!plan || !Array.isArray(plan.sesiones)) return res.status(502).json({ error: 'La IA no entregó una propuesta estructurada' })

  // Vincula cada ejercicio con su id de la biblioteca (exacto → normalizado); lo que no existe se informa y se quita
  const exacto = new Map(lib.d.map(e => [e.nombre, e])), suave = new Map(lib.d.map(e => [norm(e.nombre), e]))
  const fuera = []
  plan.sesiones.forEach(s => (s.bloques || []).forEach(bl => {
    bl.ejercicios = (bl.ejercicios || []).filter(x => {
      const e = exacto.get(x.nombre) || suave.get(norm(x.nombre))
      if (!e) { fuera.push(x.nombre); return false }
      x.id = e.id; x.nombre = e.nombre; x.estimulo = e.estimulo; return true
    })
  }))
  return res.status(200).json({ plan, fuera, modelo: MODELO, uso: r.d.usage && { entrada: r.d.usage.input_tokens, salida: r.d.usage.output_tokens } })
}
