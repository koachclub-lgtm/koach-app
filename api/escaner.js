// POST /api/escaner · Escáner de plato del socio. La foto llega comprimida (JPEG ≤1024 px, base64) y NO se guarda.
// La IA de visión (Gemini Flash; Claude Haiku si falta GEMINI_API_KEY) solo IDENTIFICA alimentos, porciones y zonas.
// El veredicto lo da el motor de reglas KOACH (domain/koach-escaner.js) según el foco de la pauta vigente.
// Cupo diario y registro en Supabase con el token del socio (RPC koach_escaneo_reservar / koach_escaneo_completar).
// Gemini: usar SOLO una clave de proyecto con facturación (nivel pagado): en el nivel gratis Google puede revisar los datos.
const KE = require('../domain/koach-escaner.js')
const SB_URL = 'https://siecbdatfgmqbpxqtvsl.supabase.co'
const SB_KEY = 'sb_publishable_ffGsmagqocuP1n1jvKUVGw_hVzdojas'
const GEMINI = process.env.KOACH_ESCANER_MODEL || 'gemini-3.8-flash'
const CLAUDE = process.env.KOACH_ESCANER_CLAUDE || 'claude-haiku-5-5'
const MAX_B64 = 3.5 * 1024 * 1024

async function json(url, opts) {
  const ctl = new AbortController(), to = setTimeout(() => ctl.abort(), (opts && opts.timeout) || 45000)
  try { const r = await fetch(url, Object.assign({}, opts, { signal: ctl.signal })); const t = await r.text(); let d = null; try { d = JSON.parse(t) } catch (_) {} return { ok: r.ok, status: r.status, d, t } }
  catch (e) { return { ok: false, status: e && e.name === 'AbortError' ? 504 : 599, d: null, t: String(e && e.message || e) } }
  finally { clearTimeout(to) }
}
const rpc = (tok, fn, args) => json(SB_URL + '/rest/v1/rpc/' + fn, { method: 'POST', headers: { apikey: SB_KEY, Authorization: 'Bearer ' + tok, 'content-type': 'application/json' }, body: JSON.stringify(args || {}), timeout: 10000 })
// JSON tolerante: quita ```json y toma el primer objeto completo
function leerJSON(s) {
  if (!s) return null
  s = String(s).replace(/^\s*```(?:json)?/i, '').replace(/```\s*$/, '').trim()
  try { return JSON.parse(s) } catch (_) {}
  const i = s.indexOf('{'), j = s.lastIndexOf('}')
  if (i >= 0 && j > i) { try { return JSON.parse(s.slice(i, j + 1)) } catch (_) {} }
  return null
}
// Claude structured outputs: objetos cerrados y sin límites numéricos/de largo
function esquemaClaude(s) {
  if (Array.isArray(s)) return s.map(esquemaClaude)
  if (!s || typeof s !== 'object') return s
  const o = {}
  for (const k of Object.keys(s)) { if (['minItems', 'maxItems', 'minimum', 'maximum'].includes(k)) continue; o[k] = esquemaClaude(s[k]) }
  if (o.type === 'object') o.additionalProperties = false
  return o
}

async function gemini(b64, mime, prompt) {
  const url = 'https://generativelanguage.googleapis.com/v1beta/models/' + encodeURIComponent(GEMINI) + ':generateContent'
  const base = { contents: [{ role: 'user', parts: [{ inline_data: { mime_type: mime, data: b64 } }, { text: prompt }] }] }
  const gc = { thinkingConfig: { thinkingLevel: 'low' }, maxOutputTokens: 4096 }
  // La API cambió el nombre del campo de salida estructurada; se prueba el actual y, si responde 400, la variante anterior
  const variantes = [
    Object.assign({}, gc, { responseMimeType: 'application/json', responseJsonSchema: KE.ESQUEMA }),
    Object.assign({}, gc, { responseFormat: { text: { mimeType: 'APPLICATION_JSON', schema: KE.ESQUEMA } } }),
    Object.assign({}, gc, { responseMimeType: 'application/json' })
  ]
  let r
  for (let i = 0; i < variantes.length; i++) {
    r = await json(url, { method: 'POST', headers: { 'content-type': 'application/json', 'x-goog-api-key': process.env.GEMINI_API_KEY }, body: JSON.stringify(Object.assign({}, base, { generationConfig: variantes[i] })), timeout: 40000 })
    if (r.ok || r.status !== 400 || /api key|API_KEY/i.test(r.t)) break
  }
  if (!r.ok) return { error: 'La IA de visión no respondió (' + r.status + ')', status: r.status === 429 ? 429 : 502, detalle: r.d && r.d.error && r.d.error.message }
  const c = r.d && r.d.candidates && r.d.candidates[0]
  if (!c) return { error: 'La IA bloqueó la foto. Prueba con otra.', status: 422, detalle: r.d && r.d.promptFeedback && r.d.promptFeedback.blockReason }
  if (c.finishReason && !['STOP', 'MAX_TOKENS'].includes(c.finishReason)) return { error: 'La IA no pudo analizar esta foto. Prueba con otra.', status: 422, detalle: c.finishReason }
  const txt = ((c.content && c.content.parts) || []).filter(p => p.text && !p.thought).map(p => p.text).join('')
  const det = leerJSON(txt)
  if (!det) return { error: c.finishReason === 'MAX_TOKENS' ? 'El análisis quedó incompleto: vuelve a intentar.' : 'La IA no entregó el análisis estructurado', status: 502 }
  const u = r.d.usageMetadata || {}
  return { det, modelo: GEMINI, uso: { entrada: u.promptTokenCount, salida: (u.candidatesTokenCount || 0) + (u.thoughtsTokenCount || 0) } }
}

async function claude(b64, mime, prompt) {
  const r = await json('https://api.anthropic.com/v1/messages', {
    method: 'POST', timeout: 45000,
    headers: { 'content-type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: CLAUDE, max_tokens: 4096, output_config: { effort: 'low', format: { type: 'json_schema', schema: esquemaClaude(KE.ESQUEMA) } },
      messages: [{ role: 'user', content: [{ type: 'image', source: { type: 'base64', media_type: mime, data: b64 } }, { type: 'text', text: prompt }] }] })
  })
  if (!r.ok) return { error: 'La IA de visión no respondió (' + r.status + ')', status: r.status === 429 ? 429 : 502, detalle: r.d && r.d.error && r.d.error.message }
  if (r.d.stop_reason === 'refusal') return { error: 'La IA no pudo analizar esta foto. Prueba con otra.', status: 422 }
  const det = leerJSON(((r.d.content || []).find(x => x.type === 'text') || {}).text)
  if (!det) return { error: r.d.stop_reason === 'max_tokens' ? 'El análisis quedó incompleto: vuelve a intentar.' : 'La IA no entregó el análisis estructurado', status: 502 }
  return { det, modelo: CLAUDE, uso: r.d.usage && { entrada: r.d.usage.input_tokens, salida: r.d.usage.output_tokens } }
}

module.exports = async (req, res) => {
  const t0 = Date.now()
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).json({ error: 'Método no permitido' }) }
  const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '')
  if (!token) return res.status(401).json({ error: 'Sin sesión' })
  const b = req.body || {}
  const m = /^data:(image\/(?:jpeg|png|webp));base64,/.exec(String(b.imagen || '').slice(0, 40))
  const mime = m ? m[1] : (['image/jpeg', 'image/png', 'image/webp'].includes(b.mime) ? b.mime : 'image/jpeg')
  const b64 = String(b.imagen || '').replace(/^data:[^,]+,/, '')
  if (b64.length < 200 || !/^[A-Za-z0-9+/=\s]+$/.test(b64.slice(0, 400))) return res.status(400).json({ error: 'Falta la foto' })
  if (b64.length > MAX_B64) return res.status(413).json({ error: 'La foto es muy pesada' })
  if (!process.env.GEMINI_API_KEY && !process.env.ANTHROPIC_API_KEY) return res.status(503).json({ error: 'El escáner aún no está configurado (falta GEMINI_API_KEY en Vercel)' })

  // 1 · Cupo y contexto con el token del socio (valida sesión, acceso vigente y límite diario antes de gastar IA)
  const comida = String(b.comida || '').slice(0, 40) || null
  const num = Number.isInteger(+b.comida_num) && +b.comida_num > 0 ? +b.comida_num : null
  const rv = await rpc(token, 'koach_escaneo_reservar', { p_comida: comida, p_num: num })
  if (!rv.ok) {
    const msg = (rv.d && (rv.d.message || rv.d.msg)) || rv.t || ''
    if (/limite diario/.test(msg)) return res.status(429).json({ error: 'Llegaste al máximo de escaneos de hoy. Mañana sigues.' })
    if (/sin acceso/.test(msg)) return res.status(403).json({ error: 'Tu plan no está vigente.' })
    if (rv.status === 401 || /JWT|no autenticado/i.test(msg)) return res.status(401).json({ error: 'Sesión inválida' })
    return res.status(502).json({ error: 'No pudimos registrar el escaneo', detalle: msg.slice(0, 200) })
  }
  const cx = rv.d || {}
  const ctx = { foco: cx.foco, comida: comida && { nombre: comida }, kcal_dia: cx.kcal_dia, comidas_dia: cx.comidas_dia }

  // 2 · Visión: Gemini Flash; si falla por caída/limite y hay clave de Claude, segundo intento con Claude
  const prompt = KE.prompt(ctx)
  let v = process.env.GEMINI_API_KEY ? await gemini(b64, mime, prompt) : await claude(b64, mime, prompt)
  if (v.error && process.env.GEMINI_API_KEY && process.env.ANTHROPIC_API_KEY && v.status !== 422) v = await claude(b64, mime, prompt)
  const ms = Date.now() - t0
  if (v.error) {
    await rpc(token, 'koach_escaneo_completar', { p_id: cx.id, p_estado: 'error', p_det: null, p_res: { error: v.error, detalle: v.detalle || null }, p_modelo: v.modelo || null, p_ms: ms })
    return res.status(v.status || 502).json({ error: v.error, detalle: v.detalle })
  }

  // 3 · Veredicto con reglas KOACH y registro
  const resultado = KE.evaluar(v.det, ctx)
  const det = { es_comida: v.det.es_comida !== false, plato: String(v.det.plato || '').slice(0, 80), confianza: Math.max(0, Math.min(1, +v.det.confianza || 0)) }
  await rpc(token, 'koach_escaneo_completar', { p_id: cx.id, p_estado: 'listo', p_det: det, p_res: resultado, p_modelo: v.modelo, p_ms: ms })
  return res.status(200).json({ id: cx.id, deteccion: det, resultado, contexto: { foco: resultado.foco, comida, comida_num: num, comidas_dia: cx.comidas_dia, usados: cx.usados, limite: cx.limite }, modelo: v.modelo, ms, uso: v.uso })
}
