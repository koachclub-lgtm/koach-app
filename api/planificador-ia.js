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
- Leg curl en máquina (sentado o prono): VOLUMEN = isquio puro (cuenta completo para isquios, sin glúteo); DEMANDA ARTICULAR = rodilla en flexión (no cadera). Es el único que aísla el isquio sin cadera; es infaltable.
- Hombre: bíceps y tríceps nunca el mismo día; isquios ≥ glúteo. Mujer: volumen de cadena posterior (glúteo + isquio) > cuádriceps; glúteo con un ejercicio en largo (RDL/sentadilla), uno en acortado (hip thrust/puente) y abducción.
- Nivel BÁSICO: nada de sentadilla/banca/peso muerto con barra, saltos ni olímpicos; usa máquinas y mancuernas. Respeta el nivel mínimo de cada ejercicio.
- Regla de los tercios: B2 pesado (ancla), B1 moderado (8–12), B3 liviano (12–20).
- Anclas (máx. 1 por bloque, en B2, liderando): rodilla, cadera, empuje y tracción en la semana.
DOSIS POR PROGRAMA:
- STRONG: sets 3/4/3 · descanso B1 60 · B2 120–180 · B3 60–90 s · ancla básico 12–15 / intermedio 8–10 / avanzado 6–8 · resto 10–15 · RIR compuestos 1–2, máquinas/aislados 0–1.
- BURN: sets 3/4/3 + 30 s de cardio al inicio de B1 · descansos 45–60 / 60–90 / 45–60 s · ancla 12–15 / 10–12 / 8–10 · RIR 1–3.
- HEALTHY: sets 3/4/3 · descansos 60–90 / 75–120 / 60–90 s · reps 12–15 · RIR 2–3.
EVIDENCIA (mastermind):
- Volumen semanal por músculo (series duras; sinergistas cuentan con su peso, ~0,5): mínimo 4; músculos objetivo 10–20; techo útil ~20. Más series dan más músculo pero con rendimientos decrecientes (Pelland et al. 2024, 67 estudios; conteo fraccional de sinergistas).
- Por sesión: la ganancia se aplana cerca de ~11 series fraccionales por músculo (Remmert et al. 2025). Si un músculo necesita más volumen semanal, NO lo cargues en un día: repártelo en otra sesión. Por eso la frecuencia es ≥2 por semana en músculos objetivo.
- División (split): full body, upper/lower y push/pull/legs rinden igual a igual volumen semanal (Ramos-Campo et al. 2024, metaanálisis). Lo que decide es la frecuencia y el reparto del volumen: con 2–4 días usa full body o upper/lower (cada músculo 2×); PUSH·PULL·LEGS solo con 5–6 días (si no, cada músculo queda 1× y pasa de ~11 series en ese día).
- RIR 0–3. Básicos 1–3 RIR (técnica primero).
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

  // Biblioteca activa + uso real de los últimos 90 días (el equipo que el club realmente tiene y usa)
  const [lib, uso] = await Promise.all([
    json(SB_URL + '/rest/v1/ejercicios?select=id,nombre,estimulo,demanda,nivel_min,patron,patron_base,implemento,tipo_registro,disponible,zona,sinergistas,cuenta_dosis&activo=is.true&order=estimulo,nombre', { headers: H }),
    json(SB_URL + '/rest/v1/v_ejercicio_uso?select=ejercicio_id,sets_90d', { headers: H })
  ])
  if (!lib.ok || !Array.isArray(lib.d) || !lib.d.length) return res.status(502).json({ error: 'No se pudo leer la biblioteca de ejercicios' })
  const usoM = new Map(((uso.ok && uso.d) || []).map(x => [x.ejercicio_id, x.sets_90d]))
  const dictN = norm(dictado)
  // Máquinas sin piso asignado y sin uso real (< 10 sets en 90 días) o marcadas no disponibles quedan fuera, salvo que el koach las nombre en el dictado
  const pedido = e => dictN && dictN.includes(norm(e.nombre))
  let L = lib.d.filter(e => pedido(e) || (e.disponible !== false && !(e.implemento === 'MACHINE' && !e.zona && (usoM.get(e.id) || 0) < 10)))
  const excluidas = lib.d.filter(e => !L.includes(e) && e.implemento === 'MACHINE').map(e => e.nombre)
  let anam = null
  if (b.socio_id && /^[0-9a-f-]{36}$/i.test(b.socio_id)) {
    const a = await json(SB_URL + '/rest/v1/anamnesis_prueba?select=respuestas&socio_id=eq.' + b.socio_id, { headers: H })
    if (a.ok && a.d && a.d[0]) anam = a.d[0].respuestas
    // Ejercicios que el socio indicó que le provocan dolor: fuera de la biblioteca para este socio (salvo que el koach los nombre)
    const dl = await json(SB_URL + '/rest/v1/ejercicio_dolor?select=ejercicio_id&socio_id=eq.' + b.socio_id, { headers: H })
    const dolorIds = new Set(((dl.ok && dl.d) || []).map(x => x.ejercicio_id))
    if (dolorIds.size) { lib.d.filter(e => dolorIds.has(e.id) && L.includes(e)).forEach(e => { if (!pedido(e)) excluidas.push(e.nombre + ' (dolor)') }); L = L.filter(e => !dolorIds.has(e.id) || pedido(e)) }
  }
  // c356 · POLÍTICA KOACH: cómo los koaches reales ajustan las rutinas (tabla politica_koach, recalculada cada noche desde el historial)
  // + la semana vigente del socio, para que los ajustes sigan el mismo criterio (conservar la base, rotar dentro del patrón).
  const enL = new Set(L.map(e => e.nombre))
  let politica = '', semanaActual = ''
  if (c.programa) {
    const pk = await json(SB_URL + '/rest/v1/politica_koach?select=datos&programa=eq.' + encodeURIComponent(String(c.programa).toUpperCase()), { headers: H })
    const d = pk.ok && pk.d && pk.d[0] && pk.d[0].datos
    if (d) {
      const pool = Object.entries(d.pool || {}).map(([k, v]) => [k, v.filter(n => enL.has(n))]).filter(x => x[1].length).map(([k, v]) => '  ' + k + ': ' + v.join(', ')).join('\n')
      const rem = (d.reemplazos || []).filter(r => r.mismo_patron && enL.has(r.a)).slice(0, 18).map(r => '  ' + r.bloque + ' ' + r.de + ' → ' + r.a).join('\n')
      const porNom = new Map(L.map(e => [e.nombre, e]))
      const combos = Object.entries(d.combos_piso1 || {}).filter(([k]) => porNom.has(k)).map(([k, v]) => [k, v.filter(n => porNom.has(n) && !(porNom.get(n).implemento === 'MACHINE' && porNom.get(k).implemento === 'MACHINE'))]).filter(x => x[1].length).map(([k, v]) => '  ' + k + ': ' + v.join(', ')).join('\n')
      const dos = Object.entries(d.dosis || {}).filter(([, v]) => (v.sube_sets || 0) + (v.baja_sets || 0) > 10).map(([bl, v]) => '  ' + bl + ': sube series ' + v.sube_sets + ' veces vs baja ' + v.baja_sets + (v.cambios_reps && v.cambios_reps[0] ? '; reps más común ' + v.cambios_reps[0].de + '→' + v.cambios_reps[0].a : '')).join('\n')
      politica = `POLÍTICA KOACH (decisiones reales de los koaches en ${d.socios || '—'} socios de ${c.programa}, últimos ${d.dias || 120} días). Úsala para ELEGIR entre opciones que ya cumplen el Método; si algo choca con el Método o la logística, manda el Método:
- Los koaches conservan la base: en una semana editada cambian en promedio ${d.cambios_x_sesion_editada || 3} ejercicios por sesión y mantienen ~70%. Un ejercicio dura en promedio el ciclo completo; casi nunca vuelve uno que se sacó.
- Al reemplazar, mantienen el PATRÓN de movimiento (~80% de los casos) y cambian el implemento (máquina ⇄ polea ⇄ mancuerna). No cambian por bajo rendimiento: cambian por variedad, sala y criterio.
- Ejercicios preferidos por bloque y patrón (orden de preferencia):
${pool}
- Reemplazos habituales (mismo patrón):
${rem}
- Progresión de dosis observada:
${dos}${combos ? '\n- Combinaciones del PISO 1 que usan los koaches en un mismo bloque (ejercicio: compañeros habituales):\n' + combos : ''}`
    }
  }
  if (b.socio_id && /^[0-9a-f-]{36}$/i.test(b.socio_id)) {
    const as = await json(SB_URL + '/rest/v1/asignaciones?select=protocolo_id,semana_actual&activo=is.true&socio_id=eq.' + b.socio_id, { headers: H })
    const a0 = as.ok && as.d && as.d[0]
    if (a0 && a0.protocolo_id) {
      const ss = await json(SB_URL + '/rest/v1/sesiones_protocolo?select=numero,objetivo,semana,bloques(bloque,sets,bloque_ejercicios(orden,reps_txt,reps,ejercicios(nombre)))&protocolo_id=eq.' + a0.protocolo_id + '&semana=eq.' + (a0.semana_actual || 1) + '&order=numero', { headers: H })
      if (ss.ok && Array.isArray(ss.d) && ss.d.length) semanaActual = 'SEMANA VIGENTE DEL SOCIO (semana ' + (a0.semana_actual || 1) + '):\n' + ss.d.map(x => '  ' + (x.objetivo || 'SESIÓN ' + x.numero) + ': ' + (x.bloques || []).sort((p, q) => String(p.bloque).localeCompare(String(q.bloque))).map(bl => bl.bloque + ' ' + bl.sets + 'x [' + (bl.bloque_ejercicios || []).sort((p, q) => (p.orden || 0) - (q.orden || 0)).map(be => (be.ejercicios && be.ejercicios.nombre) + ' ' + (be.reps_txt || be.reps || '')).join('; ') + ']').join(' · ')).join('\n') +
        '\nSi el koach pide AJUSTAR, PROGRESAR o CONTINUAR la rutina: parte de esta semana, conserva la base y cambia como lo hacen los koaches (pocos ejercicios por sesión, dentro del mismo patrón, del pool preferido). Si pide una rutina NUEVA, puedes ignorarla.'
    }
  }
  // c359 · INFALTABLES del head koach (tabla reglas_infaltables): ejercicios y volúmenes que no deben faltar
  const prioTxt = norm([].concat(c.prioridad || c.prioridades || []).join(' '))
  const ri = await json(SB_URL + '/rest/v1/reglas_infaltables?select=nombre,programa,tipo,valores,medida,alcance,minimo,ideal,prioridad,motivo&activo=is.true', { headers: H })
  const enLib = new Set(L.map(e => e.nombre))
  const INF = ((ri.ok && ri.d) || []).filter(r => !r.programa || String(r.programa).toUpperCase() === String(c.programa || '').toUpperCase())
    .filter(r => r.tipo !== 'ejercicio' || r.valores.some(v => enLib.has(v)))   // si el socio no puede hacerlo (dolor/equipo), no se exige
    .map(r => Object.assign({}, r, { exige: (r.ideal != null && (r.prioridad || []).some(pq => prioTxt.includes(norm(pq)))) ? Number(r.ideal) : Number(r.minimo) }))
  const infTxt = INF.length ? 'INFALTABLES DEL HEAD KOACH (obligatorios; el servidor los verifica):\n' + INF.map(r => '- ' + r.nombre + ': ' + (r.tipo === 'ejercicio' ? r.valores.filter(v => enLib.has(v)).join(' o ') : 'estímulo ' + r.valores.join('/')) + ' · mínimo ' + r.exige + ' ' + r.medida + (r.alcance === 'sesion' ? ' en CADA sesión' : ' por semana') + (r.motivo ? '. ' + r.motivo : '')).join('\n') : ''
  const catalogo = L.map(e => [((usoM.get(e.id) || 0) >= 150 ? '★ ' : '') + e.nombre, e.estimulo, e.demanda, e.nivel_min, e.patron, e.implemento || '', e.zona || ''].join(' | ')).join('\n')

  const prompt = `Eres el MASTERMIND HYPERTROPHY de KOACH Club (Concepción, Chile): el planificador técnico del head koach.
Arma la SEMANA de entrenamiento del socio según el DICTADO del koach y sus CRITERIOS. El dictado manda sobre los valores por defecto; el Método KOACH manda sobre tus preferencias. Español de Chile, sin emojis.

SOCIO: ${c.nombre || '—'} · sexo ${c.sexo || '—'} · nivel ${c.nivel || '—'} · programa ${c.programa || '—'}
CRITERIOS ELEGIDOS: ${JSON.stringify(c)}
${anam ? 'ANAMNESIS DE LA CLASE DE PRUEBA (respuestas del socio): ' + JSON.stringify(anam).slice(0, 3000) : ''}

DICTADO DEL KOACH:
"""${dictado || '(sin dictado: usa solo los criterios)'}"""

${METODO}

${infTxt}

${politica}

${semanaActual}

ESTRUCTURA SEMANAL (matriz de frecuencia por días disponibles):
- 2 días: FULL BODY ×2. 3 días: LOWER · UPPER · FULL BODY (frecuencia 2) o FULL BODY ×3 (frecuencia 3). 4 días: LOWER · UPPER · LOWER · UPPER (2), UPPER · LOWER · FULL · FULL (3), FULL ×4 (4). 5 días: LEGS · PUSH · PULL · LOWER · UPPER (2), LEGS · PUSH · PULL · FULL · FULL (3), FULL ×3 · UPPER · LOWER (4), FULL ×5 (5).
- Si el criterio "estructura" trae una secuencia, ÚSALA en ese orden: una sesión por elemento, con ese tipo. Si dice "LA DECIDE EL MASTERMIND", elige de la matriz según los días, el nivel y las prioridades (frecuencia ≥2 por músculo objetivo).
- Día rotativo ("rotativo"): si es "NO", no lo agregues. Si es un tipo (FULL BODY, TREN SUPERIOR, TREN INFERIOR, GLÚTEO, ISQUIOS, BRAZOS, HOMBROS, CORE), agrega UNA sesión final llamada "ROTATIVO · <tipo>" centrada en eso, manteniendo B1-B2-B3. Si es "LO DECIDE EL MASTERMIND", el rotativo completa los músculos que quedaron bajo su mínimo semanal.

LOGÍSTICA DE SALA (obligatorio — los bloques se hacen como circuito, el socio no puede ocupar dos máquinas):
- Máximo 1 ejercicio de implemento MACHINE por bloque. Leg extension y leg curl, por ejemplo, nunca en el mismo bloque.
- Todos los ejercicios de un bloque en la misma zona/piso (columna zona). Sin zona = existe en ambos pisos (mancuernas, banco, suelo/core, globales, polea de pie): combina con cualquier piso.
- PISO 1 está separado del resto: es la estación de glúteo y pierna (Pendulum squat, Abduction machine standing, Hip thrust standing machine, 4 filas de hip thrust con barra, un banco plano, mancuernas en suelo y 2 líneas de polea de pie sin asiento). Un bloque con un ejercicio del PISO 1 se completa SOLO con PISO 1 o portátiles (mancuerna, banco, suelo/core, polea de pie). Nunca lo combines con barra libre, máquinas, poleas sentado ni cardio del PISO 2.
- En la sesión, los bloques del mismo piso van seguidos: como máximo UN cambio de piso por sesión (nada de PISO 2 → PISO 1 → PISO 2).
- PISO 2 = máquinas (chest press, high row, T-bar, leg extension, leg curl, leg press 45, row machine), barra libre (salvo hip thrust), poleas sentado y cardio (spin, assault, ski erg).
- Selección estable y simple: prefiere los ejercicios ★ (los que KOACH usa todos los días). Repite los ejercicios principales en los días que corresponda en vez de inventar variantes nuevas; máximo 1 variante por patrón y músculo en la semana salvo pedido del koach. Nada de ejercicios exóticos.
- Un mismo ejercicio no se repite dentro de la misma sesión.

REGLAS DE SALIDA:
- Una sesión por cada día fijo, en el orden de la estructura, más el rotativo si corresponde.
- Usa SOLO ejercicios de la BIBLIOTECA, con el nombre EXACTO (sin la ★). Respeta el nivel mínimo y el implemento que pida el koach.
- Core y movilidad con tiempo=true (segundos). Cardio de BURN con tiempo=true.
- En "decisiones" explica en frases cortas el volumen semanal logrado por músculo grande y secundario y cualquier regla que no se pudo cumplir por pedido del koach.

BIBLIOTECA KOACH DISPONIBLE (nombre | estímulo | demanda | nivel mínimo | patrón | implemento | zona):
${catalogo}`

  const llamar = async msgs => {
    const r = await json('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: MODELO, max_tokens: 12000, output_config: { effort: 'medium', format: { type: 'json_schema', schema: ESQUEMA } }, messages: msgs })
    })
    if (!r.ok) return { error: 'La IA no respondió (' + r.status + ')', status: 502, detalle: r.d && r.d.error && r.d.error.message }
    if (r.d.stop_reason === 'refusal') return { error: 'La IA no pudo planificar este pedido.', status: 422 }
    if (r.d.stop_reason === 'max_tokens') return { error: 'La propuesta quedó incompleta: pide menos sesiones o ejercicios.', status: 422 }
    const txt = (r.d.content || []).filter(x => x.type === 'text').map(x => x.text).join('')
    let plan = null; try { plan = JSON.parse(txt) } catch (_) {}
    if (!plan || !Array.isArray(plan.sesiones)) return { error: 'La IA no entregó una propuesta estructurada', status: 502 }
    return { plan, txt, usage: r.d.usage }
  }

  // Vincula cada ejercicio con la biblioteca disponible (exacto → normalizado); lo que no está se informa y se quita
  const exacto = new Map(L.map(e => [e.nombre, e])), suave = new Map(L.map(e => [norm(e.nombre), e]))
  const vincular = plan => { const fuera = []
    plan.sesiones.forEach(s => (s.bloques || []).forEach(bl => {
      bl.ejercicios = (bl.ejercicios || []).filter(x => {
        const e = exacto.get(String(x.nombre || '').replace(/^★\s*/, '')) || suave.get(norm(x.nombre))
        if (!e) { fuera.push(x.nombre); return false }
        x.id = e.id; x.nombre = e.nombre; x.estimulo = e.estimulo; x._e = e; return true
      })
    })); return fuera }

  // Revisión dura en servidor: reglas del Método y de logística que la IA no puede saltarse
  const NIV = { BASICO: 0, INTERMEDIO: 1, AVANZADO: 2 }, NMIN = { BAS: 0, INT: 1, AVZ: 2 }, DEM = { ALTA: 3, MEDIA: 2, BAJA: 1 }
  const UP = ['LATS', 'PECS', 'DELTS', 'BIS', 'TRIS'], LO = ['QUADS', 'GLUTS', 'HAMS', 'CALFS']
  const nivel = NIV[String(c.nivel || '').toUpperCase()] != null ? NIV[String(c.nivel || '').toUpperCase()] : 1
  const MUS = ['QUADS', 'GLUTS', 'HAMS', 'LATS', 'PECS', 'DELTS', 'BIS', 'TRIS']
  const SIN = { 'CUÁDRICEPS': 'QUADS', 'GLÚTEOS': 'GLUTS', 'ISQUIOS': 'HAMS', 'ESPALDA': 'LATS', 'PECHO': 'PECS', 'HOMBROS': 'DELTS', 'BÍCEPS': 'BIS', 'TRÍCEPS': 'TRIS' }
  const NOMM = { QUADS: 'cuádriceps', GLUTS: 'glúteos', HAMS: 'isquios', LATS: 'espalda', PECS: 'pecho', DELTS: 'hombros', BIS: 'bíceps', TRIS: 'tríceps' }
  const OBJMIN = { STRONG: [8, 10, 10], BURN: [6, 8, 10], HEALTHY: [6, 6, 8] }
  const revisar = plan => { const E = [], semV = {}, semF = {}
    plan.sesiones.forEach(s => { const sn = s.nombre, vistos = {}, secZ = []; let core = false, bis = false, tris = false
      ;(s.bloques || []).forEach(bl => { const ex = bl.ejercicios || [], es = ex.map(x => x._e)
        const maq = es.filter(e => e.implemento === 'MACHINE'); if (maq.length > 1) E.push(`${sn} ${bl.bloque}: ${maq.length} máquinas (${maq.map(e => e.nombre).join(' + ')}); máximo 1 por bloque`)
        const zonas = [...new Set(es.map(e => e.zona).filter(Boolean))]; if (zonas.length > 1) E.push(`${sn} ${bl.bloque}: mezcla zonas ${zonas.join(' y ')} (el PISO 1 solo combina con PISO 1 o portátiles)`)
        if (zonas.length === 1) secZ.push(zonas[0])
        es.forEach((e, i) => {
          if (vistos[e.nombre]) E.push(`${sn}: ${e.nombre} repetido en la sesión`); vistos[e.nombre] = 1
          if (e.estimulo === 'CORE') core = true; if (e.estimulo === 'BIS') bis = true; if (e.estimulo === 'TRIS') tris = true
          if ((e.estimulo === 'CORE' || e.estimulo === 'MOB') && bl.bloque !== 'B1') E.push(`${sn} ${bl.bloque}: ${e.nombre} (core/movilidad) va solo en B1`)
          if (['CORE', 'MOB', 'CARDIO'].includes(e.estimulo)) return
          if (bl.bloque === 'B1' && e.demanda === 'ALTA') E.push(`${sn} B1: ${e.nombre} es demanda ALTA`)
          if (bl.bloque === 'B3' && e.demanda !== 'BAJA') E.push(`${sn} B3: ${e.nombre} es demanda ${e.demanda} (B3 solo BAJA)`)
          if (bl.bloque === 'B2' && e.demanda === 'BAJA') E.push(`${sn} B2: ${e.nombre} es demanda BAJA`)
          if ((NMIN[e.nivel_min] || 0) > nivel) E.push(`${sn}: ${e.nombre} exige nivel ${e.nivel_min}`)
          if (ex[i].ancla && bl.bloque !== 'B2') E.push(`${sn}: ancla ${e.nombre} fuera de B2`)
        })
        const cr = es.filter(e => !['CORE', 'MOB', 'CARDIO'].includes(e.estimulo))
        for (let i = 0; i + 1 < cr.length; i++) if ((DEM[cr[i].demanda] || 0) < (DEM[cr[i + 1].demanda] || 0)) E.push(`${sn} ${bl.bloque}: ${cr[i + 1].nombre} (${cr[i + 1].demanda}) va después de ${cr[i].nombre} (${cr[i].demanda})`)
        ;[UP, LO].forEach(seg => { const pt = new Set(es.filter(e => seg.includes(e.estimulo) && ['bilateral', 'unilateral'].includes(e.patron)).map(e => e.patron)); if (pt.size === 2) E.push(`${sn} ${bl.bloque}: mezcla bilateral y unilateral del mismo segmento`) })
        if (bl.bloque === 'B1') { const n = es.length; if (n >= 2 && (es[n - 1].estimulo !== 'MOB' || es[n - 2].estimulo !== 'CORE')) E.push(`${sn} B1: CORE penúltimo y movilidad al final`) }
      })
      // volumen fraccional por músculo en la sesión (sinergistas con su peso)
      const vs = {}
      ;(s.bloques || []).forEach(bl => (bl.ejercicios || []).forEach(x => { const e = x._e; if (!e || e.cuenta_dosis === false) return
        const k = bl.sets || 0; if (MUS.includes(e.estimulo)) vs[e.estimulo] = (vs[e.estimulo] || 0) + k
        Object.entries(e.sinergistas || {}).forEach(([m, w]) => { const c2 = SIN[m]; if (c2) vs[c2] = (vs[c2] || 0) + k * (Number(w) || 0) }) }))
      Object.entries(vs).forEach(([m, v]) => { semV[m] = (semV[m] || 0) + v; if (v >= 1) (semF[m] = semF[m] || new Set()).add(sn)
        if (v > 11) E.push(`${sn}: ${NOMM[m]} con ${Math.round(v * 10) / 10} series en la sesión (sobre ~11 la ganancia se aplana: reparte en otra sesión)`) })
      { const cambios = secZ.filter((z, i) => i > 0 && z !== secZ[i - 1]).length; if (cambios > 1) E.push(`${sn}: cambia de piso ${cambios} veces (${secZ.join(' → ')}); deja los bloques del mismo piso seguidos`) }
      if (!core) E.push(`${sn}: sin CORE`)
      if (String(c.sexo || '').toLowerCase() === 'hombre' && bis && tris) E.push(`${sn}: bíceps y tríceps el mismo día (hombre)`)
    })
    // semana: volumen y frecuencia de los músculos objetivo (literatura + Método)
    const obj = String(c.sexo || '').toLowerCase() === 'hombre' ? ['LATS', 'PECS', 'QUADS', 'HAMS'] : ['GLUTS', 'QUADS', 'HAMS', 'LATS']
    const prog = String(c.programa || 'STRONG').toUpperCase(), om = (OBJMIN[prog] || OBJMIN.STRONG)[nivel]
    const nS = plan.sesiones.length
    obj.forEach(m => { const v = Math.round((semV[m] || 0) * 10) / 10
      if (v < om) E.push(`SEMANA: ${NOMM[m]} (objetivo) con ${v} series; mínimo ${om}`)
      if (nS >= 2 && (semF[m] ? semF[m].size : 0) < 2) E.push(`SEMANA: ${NOMM[m]} (objetivo) trabajado en ${semF[m] ? semF[m].size : 0} sesión; debe ser ≥2`) })
    // infaltables
    INF.forEach(r => { const ok = e => r.tipo === 'ejercicio' ? r.valores.includes(e.nombre) : r.valores.includes(e.estimulo)
      const porSes = plan.sesiones.map(s => { let ses = 0, ser = 0; (s.bloques || []).forEach(bl => (bl.ejercicios || []).forEach(x => { if (x._e && ok(x._e)) { ses = 1; ser += bl.sets || 0 } })); return { n: s.nombre, ses, ser } })
      const val = x => r.medida === 'series' ? x.ser : x.ses
      if (r.alcance === 'sesion') porSes.forEach(x => { if (val(x) < r.exige) E.push(`${x.n}: falta ${r.nombre}`) })
      else { const t = porSes.reduce((a, x) => a + val(x), 0); if (t < r.exige) E.push(`SEMANA: ${r.nombre} con ${t} ${r.medida}; mínimo ${r.exige}`) } })
    MUS.forEach(m => { const v = Math.round((semV[m] || 0) * 10) / 10; if (v > 20) E.push(`SEMANA: ${NOMM[m]} con ${v} series/semana (techo útil ~20)`) })
    return E }

  let R = await llamar([{ role: 'user', content: prompt }])
  if (R.error) return res.status(R.status).json({ error: R.error, detalle: R.detalle })
  let fuera = vincular(R.plan), obs = revisar(R.plan), correcciones = 0
  const uso1 = R.usage
  if (obs.length) {
    // Una vuelta de corrección: la IA recibe los errores exactos y devuelve la semana completa corregida
    const R2 = await llamar([{ role: 'user', content: prompt }, { role: 'assistant', content: R.txt },
      { role: 'user', content: 'La revisión del Método KOACH encontró estos errores. Corrígelos TODOS cambiando lo mínimo y devuelve la semana completa corregida con el mismo formato:\n- ' + obs.join('\n- ') + (fuera.length ? '\n- No existen en la biblioteca disponible: ' + fuera.join(', ') : '') }])
    if (!R2.error) { const f2 = vincular(R2.plan), o2 = revisar(R2.plan); if (o2.length <= obs.length) { R = R2; fuera = f2; correcciones = obs.length - o2.length; obs = o2 } }
  }
  R.plan.sesiones.forEach(s => (s.bloques || []).forEach(bl => (bl.ejercicios || []).forEach(x => { delete x._e })))
  return res.status(200).json({ plan: R.plan, fuera, observaciones: obs, corregidas: correcciones, excluidas, modelo: MODELO,
    uso: uso1 && { entrada: uso1.input_tokens, salida: uso1.output_tokens } })
}
