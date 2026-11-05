/* KOACH · ESCÁNER DE PLATO (KE) — motor de reglas compartido (servidor /api/escaner + app + tests)
   La IA de visión SOLO identifica qué hay en el plato (alimentos, preparación, porción, NOVA, zona).
   El veredicto lo deciden ESTAS reglas, firmadas por nutrición, según el foco del socio y su pauta:
   el mismo plato da siempre el mismo veredicto y cada alerta se puede explicar.
   Nunca se sugiere saltarse una comida ni compensar con restricción. */
(function(){
'use strict'
const VERSION = 'koach-escaner@1.0.0'

const FOCOS = {
  general:          { label: 'General',          nota: 'Calidad del plato y porción según tu pauta.' },
  antiinflamatorio: { label: 'Antiinflamatorio', nota: 'Menos frituras y ultraprocesados; más verdura, pescado y legumbres.' },
  glucosa:          { label: 'Glucosa',          nota: 'Carbohidratos de absorción lenta, con proteína y fibra en el mismo plato.' },
  trigliceridos:    { label: 'Triglicéridos',    nota: 'Menos azúcar, harinas refinadas, alcohol y frituras.' }
}
const GRUPOS = ['proteina', 'carbohidrato', 'verdura', 'fruta', 'grasa', 'lacteo', 'legumbre', 'dulce', 'bebida', 'otro']
const PREP = ['crudo', 'plancha', 'horno', 'hervido', 'vapor', 'salteado', 'frito', 'procesado', 'otro']

// Lo que la IA de visión debe devolver (JSON Schema simple: sirve para Gemini y para Claude)
const ESQUEMA = {
  type: 'object',
  properties: {
    es_comida: { type: 'boolean', description: 'true si la foto muestra comida o bebida para consumir' },
    plato: { type: 'string', description: 'Nombre corto del plato en español de Chile, ej: "Salmón con arroz y ensalada"' },
    confianza: { type: 'number', description: '0 a 1: qué tan seguro estás de la identificación general' },
    alimentos: {
      type: 'array', maxItems: 8,
      items: {
        type: 'object',
        properties: {
          nombre: { type: 'string', description: 'Alimento en español de Chile, ej: "arroz blanco", "palta", "papas fritas"' },
          grupo: { type: 'string', enum: GRUPOS },
          preparacion: { type: 'string', enum: PREP },
          nova: { type: 'integer', minimum: 1, maximum: 4, description: 'Clasificación NOVA: 1 natural/mínimamente procesado, 2 ingrediente culinario, 3 procesado, 4 ultraprocesado' },
          refinado: { type: 'boolean', description: 'true si es harina o cereal refinado (pan blanco, arroz blanco, pasta blanca, masa)' },
          azucar_anadida: { type: 'boolean' },
          carne_procesada: { type: 'boolean', description: 'embutidos, hamburguesa industrial, nuggets, salchicha, tocino, jamón' },
          alcohol: { type: 'boolean' },
          gramos: { type: 'integer', description: 'Porción visible estimada en gramos (o ml si es líquido)' },
          kcal: { type: 'integer' },
          proteina_g: { type: 'number' },
          carbohidrato_g: { type: 'number' },
          grasa_g: { type: 'number' },
          zona: { type: 'array', items: { type: 'integer' }, minItems: 4, maxItems: 4, description: '[ymin, xmin, ymax, xmax] normalizado 0-1000 sobre la foto' }
        },
        required: ['nombre', 'grupo', 'preparacion', 'nova', 'refinado', 'azucar_anadida', 'carne_procesada', 'alcohol', 'gramos', 'kcal', 'proteina_g', 'carbohidrato_g', 'grasa_g', 'zona']
      }
    }
  },
  required: ['es_comida', 'plato', 'confianza', 'alimentos']
}

function prompt(ctx){
  ctx = ctx || {}
  return 'Eres el ojo del escáner de alimentos de KOACH Club (Concepción, Chile). Analiza la foto del plato.\n' +
    '- Identifica cada alimento visible por separado (máximo 8), con nombres de Chile (palta, porotos, marraqueta, quesillo, completo, sopaipilla, etc.).\n' +
    '- Estima la porción VISIBLE en gramos y sus kcal y macros para esa porción. Sé conservador: no infles ni achiques.\n' +
    '- Indica la preparación (frito, plancha, horno…), la clasificación NOVA y si es refinado, con azúcar añadida, carne procesada o alcohol.\n' +
    '- zona = caja del alimento en la foto, [ymin, xmin, ymax, xmax] normalizado de 0 a 1000.\n' +
    '- Si la foto no es comida, es_comida=false y alimentos vacío.\n' +
    '- No juzgues si el plato es bueno o malo: solo describe con precisión. El veredicto lo decide KOACH.\n' +
    (ctx.comida ? '- Contexto (no lo asumas si no se ve): el socio dice que es su ' + String(ctx.comida).slice(0, 40).toLowerCase() + '.\n' : '')
}

const r1 = v => Math.round((+v || 0) * 10) / 10
const has = (a, k) => a.some(x => x[k])

// contexto: { foco, comida:{nombre}, comidas_dia, kcal_dia }
function evaluar(det, ctx){
  ctx = ctx || {}
  const foco = FOCOS[ctx.foco] ? ctx.foco : 'general'
  const al = ((det && det.alimentos) || []).filter(a => a && a.nombre).slice(0, 8).map(a => ({
    nombre: String(a.nombre).slice(0, 60), grupo: GRUPOS.includes(a.grupo) ? a.grupo : 'otro', preparacion: PREP.includes(a.preparacion) ? a.preparacion : 'otro',
    nova: Math.min(4, Math.max(1, Math.round(+a.nova || 1))), refinado: !!a.refinado, azucar_anadida: !!a.azucar_anadida, carne_procesada: !!a.carne_procesada, alcohol: !!a.alcohol,
    gramos: Math.max(0, Math.round(+a.gramos || 0)), kcal: Math.max(0, Math.round(+a.kcal || 0)),
    proteina_g: r1(a.proteina_g), carbohidrato_g: r1(a.carbohidrato_g), grasa_g: r1(a.grasa_g),
    zona: Array.isArray(a.zona) && a.zona.length === 4 ? a.zona.map(v => Math.min(1000, Math.max(0, Math.round(+v || 0)))) : null
  }))
  if (!det || det.es_comida === false || !al.length){
    return { version: VERSION, foco, veredicto: 'no_comida', puntaje: null, cheat: false, titulo: 'No reconocimos comida', mensaje: 'Toma la foto desde arriba, con buena luz y el plato completo.', acciones: [], banderas: [], alimentos: [], totales: null }
  }
  const tot = al.reduce((t, a) => ({ kcal: t.kcal + a.kcal, proteina_g: r1(t.proteina_g + a.proteina_g), carbohidrato_g: r1(t.carbohidrato_g + a.carbohidrato_g), grasa_g: r1(t.grasa_g + a.grasa_g) }), { kcal: 0, proteina_g: 0, carbohidrato_g: 0, grasa_g: 0 })
  const ban = [] // {tipo, texto, idx, pena}
  const marcar = (cond, tipo, pena, texto) => al.forEach((a, i) => { if (cond(a)) ban.push({ tipo, idx: i, pena, texto: texto(a) }) })
  // Pesos base (foco general) y ajustes por foco
  const W = { ultra: 22, frito: 14, procesada: 14, dulce: 18, bebida: 20, refinado: 4, alcohol: 15 }
  if (foco === 'antiinflamatorio') Object.assign(W, { ultra: 28, frito: 22, procesada: 20, dulce: 20, alcohol: 18 })
  if (foco === 'glucosa') Object.assign(W, { dulce: 26, bebida: 28, refinado: 12 })
  if (foco === 'trigliceridos') Object.assign(W, { dulce: 26, bebida: 28, refinado: 9, alcohol: 28, frito: 16 })
  marcar(a => a.nova === 4, 'ultraprocesado', W.ultra, a => a.nombre + ' (ultraprocesado)')
  marcar(a => a.preparacion === 'frito', 'frito', W.frito, a => a.nombre + ' (frito)')
  marcar(a => a.carne_procesada, 'carne_procesada', W.procesada, a => a.nombre + ' (carne procesada)')
  marcar(a => a.grupo === 'dulce' || (a.azucar_anadida && a.grupo !== 'bebida'), 'azucar', W.dulce, a => a.nombre + ' (azúcar añadida)')
  marcar(a => a.grupo === 'bebida' && a.azucar_anadida, 'bebida_azucarada', W.bebida, a => a.nombre + ' (bebida azucarada)')
  marcar(a => a.refinado, 'refinado', W.refinado, a => a.nombre + ' (harina refinada)')
  marcar(a => a.alcohol, 'alcohol', W.alcohol, a => a.nombre + ' (alcohol)')
  // el mismo alimento no se castiga dos veces por lo mismo y cada tipo pesa como máximo 1,5 veces
  const porTipo = {}; ban.forEach(b => { porTipo[b.tipo] = (porTipo[b.tipo] || 0) + 1 })
  let pts = 100
  Object.keys(porTipo).forEach(t => { const w = ban.find(b => b.tipo === t).pena; pts -= Math.round(w * Math.min(1.5, 1 + (porTipo[t] - 1) * 0.5)) })
  const prin = /almuerzo|cena|comida/i.test((ctx.comida && ctx.comida.nombre) || '') || tot.kcal >= 450
  const conProt = al.some(a => a.grupo === 'proteina' || a.grupo === 'legumbre' || (a.grupo === 'lacteo' && a.proteina_g >= 10))
  const conVerd = al.some(a => a.grupo === 'verdura' || a.grupo === 'legumbre')
  if (prin && !conProt){ pts -= foco === 'glucosa' ? 14 : 10; ban.push({ tipo: 'sin_proteina', idx: null, pena: 10, texto: 'Sin una fuente clara de proteína' }) }
  if (prin && !conVerd){ pts -= foco === 'general' ? 6 : 10; ban.push({ tipo: 'sin_verdura', idx: null, pena: 8, texto: 'Sin verdura en el plato' }) }
  if (conVerd) pts += 4
  if (foco === 'antiinflamatorio' && al.some(a => /salm|jurel|sardin|atun|atún|caball|pescad/i.test(a.nombre) && a.preparacion !== 'frito')) pts += 6
  if (al.some(a => a.grupo === 'legumbre')) pts += foco === 'general' ? 2 : 5
  // Porción contra la pauta: la comida debería rondar kcal_día / comidas_día
  let ratio = null
  const meta = ctx.kcal_dia && ctx.comidas_dia ? ctx.kcal_dia / ctx.comidas_dia : null
  if (meta && tot.kcal){ ratio = tot.kcal / meta
    if (ratio > 1.8){ pts -= 22; ban.push({ tipo: 'porcion', idx: null, pena: 22, texto: 'Porción muy sobre tu pauta' }) }
    else if (ratio > 1.35){ pts -= 10; ban.push({ tipo: 'porcion', idx: null, pena: 10, texto: 'Porción sobre tu pauta' }) } }
  pts = Math.max(0, Math.min(100, pts))
  const ultra = al.filter(a => a.nova === 4).length, frit = has(al, 'preparacion') && al.some(a => a.preparacion === 'frito')
  const veredicto = pts >= 75 ? 'adecuado' : pts >= 50 ? 'relativo' : 'alerta'
  const cheat = veredicto === 'alerta' && (ultra >= 2 || (ratio != null && ratio > 1.8) || (frit && al.some(a => a.carne_procesada)) || al.some(a => a.grupo === 'dulce' && a.kcal >= 300))
  // Acciones concretas, de lo que más pesó a lo que menos; nunca restricción compensatoria
  const ACC = {
    frito: 'Próxima vez, prefiérelo al horno, a la plancha o al vapor.',
    ultraprocesado: 'Cambia el ultraprocesado por su versión casera o un alimento real.',
    carne_procesada: 'Reemplaza la carne procesada por pollo, pescado, huevo o carne magra.',
    bebida_azucarada: 'Cambia la bebida por agua, agua con limón o una bebida sin azúcar.',
    azucar: 'Deja lo dulce para una ocasión puntual; si quieres algo dulce, fruta entera.',
    refinado: foco === 'glucosa' ? 'Prefiere la versión integral y come primero la proteína y la verdura.' : 'Cuando puedas, prefiere la versión integral.',
    alcohol: 'Evita el alcohol con las comidas mientras trabajas tu foco.',
    sin_proteina: 'Suma una proteína: huevo, pollo, pescado, legumbres o quesillo.',
    sin_verdura: 'Agrega verdura: la mitad del plato.',
    porcion: 'Ajusta la porción a tu pauta la próxima vez.'
  }
  const orden = Object.entries(ban.reduce((m, b) => (m[b.tipo] = (m[b.tipo] || 0) + b.pena, m), {})).sort((a, b) => b[1] - a[1]).map(x => x[0])
  const acciones = orden.map(t => ACC[t]).filter(Boolean).slice(0, 3)
  if (veredicto === 'alerta') acciones.push('Sigue tu pauta en la próxima comida. No te la saltes.')
  const TIT = { adecuado: 'Adecuado para tu plan', relativo: 'Relativamente adecuado', alerta: 'No es adecuado para tu plan' }
  const buenos = [conProt && 'proteína', conVerd && 'verdura'].filter(Boolean)
  const mensaje = veredicto === 'adecuado' ? (buenos.length ? 'Bien: ' + buenos.join(' y ') + ' en el plato.' : 'Va con tu plan.') + (ban.length ? ' Un detalle: ' + ban[0].texto.toLowerCase() + '.' : '')
    : veredicto === 'relativo' ? 'Sirve, con un ajuste: ' + (ban[0] ? ban[0].texto.toLowerCase() : 'revisa la porción') + '.'
    : (cheat ? 'Cheat meal: ' : '') + (ban.slice(0, 2).map(b => b.texto.toLowerCase()).join(' y ') || 'no va con tu plan') + '.'
  return { version: VERSION, foco, veredicto, puntaje: pts, cheat, titulo: TIT[veredicto], mensaje, acciones,
    banderas: ban.map(b => ({ tipo: b.tipo, idx: b.idx, texto: b.texto })), alimentos: al, totales: tot,
    porcentaje_dia: ctx.kcal_dia ? Math.round(tot.kcal / ctx.kcal_dia * 100) : null, ratio_comida: ratio != null ? Math.round(ratio * 100) / 100 : null }
}

// Resumen semanal: escaneos hechos y % de aciertos SOBRE LO ESCANEADO (no castiga a quien escanea poco)
function semana(rows){
  rows = (rows || []).filter(r => r && r.veredicto && r.veredicto !== 'no_comida')
  const dias = new Set(rows.map(r => String(r.fecha || r.created_at || '').slice(0, 10)).filter(Boolean))
  const ok = rows.filter(r => r.veredicto === 'adecuado' || r.veredicto === 'relativo').length
  const porComida = {}; rows.filter(r => r.veredicto === 'alerta').forEach(r => { const k = (r.comida || 'FUERA DE PLAN').toUpperCase(); porComida[k] = (porComida[k] || 0) + 1 })
  const foco = Object.entries(porComida).sort((a, b) => b[1] - a[1])[0] || null
  return { escaneos: rows.length, dias: dias.size, aciertos: rows.length ? Math.round(ok / rows.length * 100) : null, alertas: rows.length - ok, patron: foco && foco[1] >= 2 ? { comida: foco[0], veces: foco[1] } : null }
}

const KE = { VERSION, FOCOS, GRUPOS, ESQUEMA, prompt, evaluar, semana }
if (typeof module !== 'undefined' && module.exports) module.exports = KE
if (typeof window !== 'undefined') window.KE = KE
})()
