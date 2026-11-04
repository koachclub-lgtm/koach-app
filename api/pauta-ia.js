// POST /api/pauta-ia · Redacta el plan nutricional estructurado con Claude (servidor; la clave nunca llega al navegador).
// Solo nutrición/admin. Los NÚMEROS (kcal, macros) vienen del motor KOACH en el request: la IA reparte alimentos
// para cumplirlos y redacta indicaciones, nunca recalcula metas. Requiere ANTHROPIC_API_KEY en Vercel (proyecto koach-app).
const SB_URL = 'https://siecbdatfgmqbpxqtvsl.supabase.co'
const SB_KEY = 'sb_publishable_ffGsmagqocuP1n1jvKUVGw_hVzdojas'
const MODELO = process.env.KOACH_PAUTA_MODEL || 'claude-sonnet-5-5'

const ALIMENTOS_KOACH = `Proteínas: pollo 150 g, carne magra 130 g, pescado 180 g, huevos, yoghurt griego 200 g, quesillo 80 g, atún 120 g, whey 30 g
Carbohidratos: arroz cocido 150 g, papa 180 g, pan integral 60 g, avena 60 g, pasta 80 g, fruta 150 g
Grasas: palta 50 g, maní 30 g, aceite de oliva 1 cda, frutos secos 25 g
Base: verduras mixtas libres en cada comida
EXCLUIR: quinoa, camote, jugos procesados, bebidas azucaradas, embutidos, pan blanco, azúcar refinada`

const PROTOCOLO = { BURN: 'déficit calórico · alta proteína · preservar músculo · reducir % de grasa', STRONG: 'superávit calórico · carbohidratos estratégicos alrededor del entrenamiento · maximizar síntesis proteica', HEALTHY: 'balance energético neutro · calidad nutricional · salud y rendimiento' }
const OBJ = { deficit: 'déficit', mant: 'mantención', super: 'superávit' }

const ESQUEMA = {
  type: 'object', additionalProperties: false,
  required: ['resumen', 'comidas', 'suplementos', 'hidratacion', 'indicaciones', 'evitar', 'metas'],
  properties: {
    resumen: { type: 'string', description: '2–3 frases para el socio: qué busca este plan y cómo se vive el día. Sin jerga.' },
    comidas: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['nombre', 'hora', 'aporte', 'opciones'],
      properties: {
        nombre: { type: 'string', description: 'DESAYUNO, COLACIÓN, ALMUERZO, PRE ENTRENO, POST ENTRENO, CENA…' },
        hora: { type: 'string', description: 'HH:MM' },
        aporte: { type: 'string', description: 'Una frase: qué aporta esta comida al objetivo del día' },
        opciones: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['etiqueta', 'alimentos'],
          properties: { etiqueta: { type: 'string', enum: ['A', 'B'] }, nota: { type: 'string' },
            alimentos: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['alimento', 'cantidad'],
              properties: { alimento: { type: 'string' }, cantidad: { type: 'string', description: 'gramos o medida casera exacta, ej. "150 g", "1 cda", "2 unidades"' } } } } } } }
      } } },
    suplementos: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['producto', 'dosis', 'horario'],
      properties: { producto: { type: 'string' }, dosis: { type: 'string' }, horario: { type: 'string' } } } },
    hidratacion: { type: 'string' },
    indicaciones: { type: 'array', items: { type: 'string' }, description: 'Indicaciones del protocolo, frases cortas y accionables' },
    evitar: { type: 'array', items: { type: 'string' } },
    metas: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['plazo', 'meta'],
      properties: { plazo: { type: 'string', enum: ['30 DÍAS', '60 DÍAS', '90 DÍAS'] }, meta: { type: 'string' } } } }
  }
}

async function json(url, opts) { const r = await fetch(url, opts); const t = await r.text(); let d = null; try { d = JSON.parse(t) } catch (_) {} return { ok: r.ok, status: r.status, d, t } }

// Corrector: aplica SOLO lo que pide nutrición. La IA devuelve un PARCHE (solo lo que cambia) y el servidor lo
// funde sobre el plan actual: ~5× menos tokens de salida que reescribir el plan, y lo no pedido queda idéntico por construcción.
const MODELO_CORR = process.env.KOACH_CORR_MODEL || 'claude-haiku-5-5'
const nul = sch => ({ anyOf: [sch, { type: 'null' }] })
const P = ESQUEMA.properties
const ESQUEMA_P = { type: 'object', additionalProperties: false,
  required: ['cambios', 'comidas', 'quitar', 'resumen', 'suplementos', 'hidratacion', 'indicaciones', 'evitar', 'metas'],
  properties: {
    cambios: { type: 'string', description: '1–2 frases: qué cambiaste exactamente' },
    comidas: { type: 'array', description: 'SOLO las comidas modificadas o nuevas, completas. Lista vacía si no cambia ninguna.',
      items: { type: 'object', additionalProperties: false, required: ['numero', 'comida'],
        properties: { numero: { type: 'integer', description: 'Número de la comida (desde 1). Un número mayor que el total agrega una comida nueva.' }, comida: P.comidas.items } } },
    quitar: { type: 'array', items: { type: 'integer' }, description: 'Números de comidas a eliminar. Vacía si no se elimina ninguna.' },
    resumen: nul(P.resumen), suplementos: nul(P.suplementos), hidratacion: nul(P.hidratacion),
    indicaciones: nul(P.indicaciones), evitar: nul(P.evitar), metas: nul(P.metas)
  } }
function fundir(plan, pa) {
  const out = JSON.parse(JSON.stringify(plan)), cm = out.comidas
  for (const x of (pa.comidas || [])) { const i = (x.numero | 0) - 1; if (!x.comida || i < 0) continue; if (i < cm.length) cm[i] = x.comida; else cm.push(x.comida) }
  const q = new Set((pa.quitar || []).map(n => (n | 0) - 1)); out.comidas = cm.filter((_, i) => !q.has(i))
  for (const k of ['resumen', 'suplementos', 'hidratacion', 'indicaciones', 'evitar', 'metas']) if (pa[k] != null) out[k] = pa[k]
  return out
}
async function corregir(req, res, b, m, ix, c) {
  const ins = String(b.instruccion || '').trim().slice(0, 1500), plan = b.plan_actual
  if (ins.length < 4) return res.status(400).json({ error: 'Escribe qué quieres corregir' })
  if (!plan || !Array.isArray(plan.comidas) || !plan.comidas.length) return res.status(400).json({ error: 'No hay un plan con comidas para corregir' })
  const numerado = Object.assign({}, plan, { comidas: plan.comidas.map((x, i) => Object.assign({ numero: i + 1 }, x)) })
  const prompt = `Eres el nutricionista de KOACH Club. Corrige el PLAN NUTRICIONAL según la instrucción de nutrición. Español de Chile, sin emojis ni markdown.

INSTRUCCIÓN: ${ins}

REGLAS:
- Devuelve SOLO lo que cambia: en "comidas" únicamente las comidas modificadas (completas, con su "numero"); en las demás secciones null si no cambian.
- No toques nada que la instrucción no pida.
- Números fijos del día: ${m.kcal} kcal · proteína ${m.proteina_g} g · carbohidratos ${m.carbohidrato_g || '—'} g · grasas ${m.grasa_g || '—'} g. Si el cambio altera el aporte, compensa ajustando CANTIDADES dentro de la MISMA comida (±5 % del día); agrega alimentos solo si la instrucción lo pide.
- Respeta restricciones: ${ix.restricciones || 'ninguna'} · no consume: ${ix.no_consume || 'nada'}.
- Si piden algo inseguro o médico, no lo apliques y explícalo en "cambios".
- Para reemplazos usa ALIMENTOS KOACH:
${ALIMENTOS_KOACH}

PLAN ACTUAL (comidas numeradas):
${JSON.stringify(numerado)}`
  const r = await json('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: MODELO_CORR, max_tokens: 6000, output_config: { effort: 'low', format: { type: 'json_schema', schema: ESQUEMA_P } }, messages: [{ role: 'user', content: prompt }] })
  })
  if (!r.ok) return res.status(502).json({ error: 'La IA no respondió (' + r.status + ')', detalle: r.d && r.d.error && r.d.error.message })
  if (r.d.stop_reason === 'refusal') return res.status(422).json({ error: 'La IA no pudo aplicar esta corrección. Hazla a mano.' })
  if (r.d.stop_reason === 'max_tokens') return res.status(422).json({ error: 'La corrección quedó incompleta: vuelve a intentar.' })
  const txt = (r.d.content || []).filter(x => x.type === 'text').map(x => x.text).join('')
  let pa = null; try { pa = JSON.parse(txt) } catch (_) {}
  if (!pa) return res.status(502).json({ error: 'La IA no entregó la corrección estructurada' })
  const nuevo = fundir(plan, pa)
  if (!nuevo.comidas.length) return res.status(422).json({ error: 'La corrección dejaría el plan sin comidas' })
  return res.status(200).json({ plan: nuevo, cambios: pa.cambios || '', modelo: MODELO_CORR, uso: r.d.usage && { entrada: r.d.usage.input_tokens, salida: r.d.usage.output_tokens } })
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).json({ error: 'Método no permitido' }) }
  const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '')
  if (!token) return res.status(401).json({ error: 'Sin sesión' })
  // 1 · Identidad y rol con el propio token del usuario (respeta RLS)
  const u = await json(SB_URL + '/auth/v1/user', { headers: { apikey: SB_KEY, Authorization: 'Bearer ' + token } })
  if (!u.ok || !u.d || !u.d.id) return res.status(401).json({ error: 'Sesión inválida' })
  const p = await json(SB_URL + '/rest/v1/profiles?select=role,activo&id=eq.' + encodeURIComponent(u.d.id), { headers: { apikey: SB_KEY, Authorization: 'Bearer ' + token } })
  const rol = p.ok && p.d && p.d[0] && p.d[0].activo !== false ? p.d[0].role : null
  if (!['admin', 'nutricionista'].includes(rol)) return res.status(403).json({ error: 'Solo nutrición o administración pueden generar planes' })
  if (!process.env.ANTHROPIC_API_KEY) return res.status(503).json({ error: 'Falta configurar ANTHROPIC_API_KEY en Vercel (proyecto koach-app)' })

  const b = req.body || {}, m = b.metas_numericas || {}, ix = b.intake || {}, c = b.composicion || {}
  if (!m.kcal || !m.proteina_g) return res.status(400).json({ error: 'Faltan kcal y proteína: defínelos antes de generar' })
  const orden = Array.isArray(ix.orden_comidas) ? ix.orden_comidas.map(String).filter(Boolean).slice(0, 8) : []
  const sup = Array.isArray(ix.suplementos_abordar) ? ix.suplementos_abordar.map(String).filter(Boolean).slice(0, 15) : []
  if (b.modo === 'corregir') return corregir(req, res, b, m, ix, c)
  const prompt = `Eres el nutricionista de KOACH Club (Concepción, Chile). Diseña el PLAN NUTRICIONAL de un socio para mostrarlo dentro de la app.
Escribe en español de Chile, tono profesional, directo y cercano, sin emojis ni markdown.

NÚMEROS FIJOS (calculados por el motor KOACH y validados por nutrición — NO los cambies, reparte los alimentos para cumplirlos con ±5 %):
- Calorías: ${m.kcal} kcal/día
- Proteína: ${m.proteina_g} g · Carbohidratos: ${m.carbohidrato_g || '—'} g · Grasas: ${m.grasa_g || '—'} g

SOCIO: ${c.sexo || '—'}, ${c.edad || '—'} años, ${c.peso || '—'} kg, ${c.talla || '—'} cm · Nivel ${c.nivel || '—'}
PROTOCOLO ${b.programa || '—'}: ${PROTOCOLO[String(b.programa || '').toUpperCase()] || 'objetivo definido por nutrición'} · Objetivo energético: ${OBJ[b.objetivo] || '—'}
Gasto: metabolismo basal ${c.tmb || '—'} kcal · mantención (TDEE) ${c.tdee || '—'} kcal → meta ${m.kcal} kcal (${c.tdee ? (m.kcal - c.tdee > 0 ? '+' : '') + Math.round(m.kcal - c.tdee) + ' kcal' : '—'})

COMPOSICIÓN CORPORAL (ISAK · Durnin & Womersley + Siri / Lee):
% grasa ${c.pct_grasa != null ? c.pct_grasa + ' %' : 'no medida'}${c.clas_grasa ? ' (' + c.clas_grasa + ')' : ''} · masa grasa ${c.masa_grasa != null ? c.masa_grasa + ' kg' : '—'}
Masa muscular ${c.masa_muscular != null ? c.masa_muscular + ' kg' : 'no medida'} · masa ósea ${c.masa_osea != null ? c.masa_osea + ' kg' : '—'} · residual ${c.masa_residual != null ? c.masa_residual + ' kg' : '—'}
FFMI ${c.ffmi != null ? c.ffmi : '—'}${c.clas_ffmi ? ' (' + c.clas_ffmi + ')' : ''} · forma corporal ${c.forma || '—'} · ICC ${c.icc != null ? c.icc : '—'} · ICT ${c.ict != null ? c.ict : '—'} · edad biológica ${c.edad_biologica != null ? c.edad_biologica + ' años' : '—'}
Meta a 6 meses: ${b.meta || '—'}

PREFERENCIAS E INTAKE (definidas por nutrición, son obligatorias):
Comidas al día: ${ix.comidas_dia || '4-5'}${orden.length ? ' · ORDEN EXACTO (usa estos nombres y este orden, una comida por elemento): ' + orden.map((x, i) => (i + 1) + '. ' + x).join(' · ') : ''}
Horario de entrenamiento: ${ix.horario_entreno || 'sin especificar'}
Suplementos a abordar: ${sup.length ? sup.join(', ') + ' — inclúyelos TODOS y solo esos en "suplementos", con dosis habitual segura (sin megadosis) y horario según el entrenamiento' : 'ninguno: deja "suplementos" vacío'}
Restricciones/alergias: ${ix.restricciones || 'ninguna'} · No consume: ${ix.no_consume || 'nada'}
Preferencias: ${ix.preferencias || 'sin especificar'} · Suplementos actuales: ${ix.suplementos || 'ninguno'}
Contexto: ${ix.contexto || 'sin especificar'}

ALIMENTOS KOACH (porciones de referencia):
${ALIMENTOS_KOACH}

REGLAS: cada comida con hora, alimentos con gramaje exacto y qué aporta esa comida al objetivo del día. Las indicaciones son las propias del protocolo ${b.programa || ''} para este socio (según su composición, ICC/ICT y meta). Opción A y B solo en las comidas principales. Ubica pre y post entreno según el horario de entrenamiento.
Metas 30/60/90 días coherentes con la meta a 6 meses (no inventes otras tasas). Sin recomendaciones médicas ni diagnósticos.`

  const r = await json('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
    // Salida estructurada con output_config.format: en Sonnet/Opus 5.5 el tool_choice forzado devuelve 400
    body: JSON.stringify({ model: MODELO, max_tokens: 16000, output_config: { effort: 'low', format: { type: 'json_schema', schema: ESQUEMA } }, messages: [{ role: 'user', content: prompt }] })
  })
  if (!r.ok) return res.status(502).json({ error: 'La IA no respondió (' + r.status + ')', detalle: r.d && r.d.error && r.d.error.message })
  if (r.d.stop_reason === 'refusal') return res.status(422).json({ error: 'La IA no pudo redactar este plan. Escríbelo a mano.' })
  if (r.d.stop_reason === 'max_tokens') return res.status(422).json({ error: 'El plan quedó incompleto: reduce comidas u opciones y vuelve a intentar.' })
  const txt = (r.d.content || []).filter(c => c.type === 'text').map(c => c.text).join('')
  let plan = null; try { plan = JSON.parse(txt) } catch (_) {}
  if (!plan) return res.status(502).json({ error: 'La IA no entregó un plan estructurado' })
  return res.status(200).json({ plan, modelo: MODELO })
}
