/* KOACH · COMPRA SEMANAL (KCO) — del plan de comidas a la lista del supermercado.
   Reparte las opciones A/B de cada comida en los días de la semana, suma los gramos de cada alimento,
   pasa lo cocido a crudo (lo que se compra) y lo ordena por pasillo. Sin dependencias de UI. */
(function(){
'use strict'
const VERSION = 'koach-compras@1.0.0'

// pasillos del supermercado, en el orden en que se recorren
const CATS = [
  ['PROT', 'PROTEÍNAS', /whey|prote[ií]na|pollo|pavo|carne|vacuno|cerdo|lomo|posta|pescado|salm[oó]n|merluza|reineta|jurel|congrio|at[uú]n|pechuga|filete|bistec|tofu|hamburguesa|camar[oó]n|huevo|clara|jam[oó]n/i],
  ['LACT', 'LÁCTEOS', /leche|yogh?urt|k[eé]fir|quesillo|queso|ricotta|reques[oó]n/i],
  ['CARB', 'CEREALES, LEGUMBRES Y PAN', /arroz|avena|granola|cereal|pan\b|marraqueta|hallulla|tortilla|pasta|fideo|tallar|[nñ]oqui|quinoa|cous|mote|lenteja|poroto|garbanzo|papa|camote|galleta|choclo/i],
  ['FRUV', 'FRUTAS Y VERDURAS', /fruta|pl[aá]tano|manzana|pera|naranja|kiwi|mango|durazno|mandarina|frutilla|ar[aá]ndano|berr|frambuesa|uva|pi[nñ]a|mel[oó]n|sand[ií]a|verdura|ensalada|lechuga|tomate|br[oó]coli|zanahoria|espinaca|zapallo|pepino|repollo|coliflor|esp[aá]rrago|r[uú]cula|acelga|cebolla|piment[oó]n|champi|betarraga|apio/i],
  ['GRAS', 'GRASAS Y FRUTOS SECOS', /aceite|palta|nuez|nueces|almendra|man[ií]|pistacho|semilla|ch[ií]a|linaza|mantequilla|aceituna/i],
  ['OTRO', 'OTROS', /./]
]
// cocido → crudo (lo que pesa al comprarlo). Solo se aplica si el alimento dice "cocido".
const CRUDO = [
  [/arroz/i, 0.37], [/quinoa/i, 0.38], [/fideo|pasta|tallar/i, 0.45], [/lenteja|poroto|garbanzo/i, 0.42], [/cous/i, 0.4], [/mote/i, 0.45],
  [/pollo|pavo|pechuga/i, 1.33], [/carne|vacuno|posta|lomo|cerdo|bistec/i, 1.35], [/pescado|salm[oó]n|merluza|reineta|jurel|congrio/i, 1.25], [/papa|camote/i, 1.0]
]
// lo que se compra por unidad
const UNID = [
  [/clara/i, 33, 'claras', 'huevos para claras'], [/huevo/i, 50, 'huevos'], [/palta/i, 200, 'paltas'], [/marraqueta|hallulla/i, 100, 'unidades'],
  [/pl[aá]tano|manzana|pera|naranja|kiwi|durazno|mandarina|mango/i, 150, 'unidades'], [/at[uú]n/i, 120, 'latas']
]
const quita = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '')
function nombreBase(n){
  return String(n || '').replace(/\(.*?\)/g, ' ').replace(/\b(cocid[oa]s?|crud[oa]s?|hervid[oa]s?|a la plancha|al horno|natural(es)?)\b/gi, ' ').replace(/\s+/g, ' ').trim()
}
const clave = n => quita(nombreBase(n)).toLowerCase().replace(/s\b/g, '')
const cap = s => s ? s.charAt(0).toUpperCase() + s.slice(1) : s
const cat = n => CATS.find(c => c[2].test(n))
const libre = q => /libre|a gusto|a voluntad|sin l[ií]mite/i.test(String(q || ''))

// gramos de una porción: usa la medida casera del motor si existe; si no, un número suelto
function gramos(nombre, cantidad){
  if (typeof KE !== 'undefined' && KE.gramosDe){ const g = KE.gramosDe(nombre, cantidad); if (g != null) return g }
  const m = /(\d+(?:[.,]\d+)?)\s*(g|gr|grs|gramos|ml|cc)\b/i.exec(String(cantidad || '')); return m ? Math.round(+m[1].replace(',', '.')) : null
}
// días que toca cada opción: 7 días con A/B → A 4, B 3
function reparto(dias, k){ const b = Math.floor(dias / k), r = dias % k; return Array.from({ length:k }, (_, i) => b + (i < r ? 1 : 0)) }

// presentación de compra: unidades, kg o g redondeados hacia arriba
function compra(nombre, g){
  const u = UNID.find(x => x[0].test(nombre))
  if (u){ const n = Math.max(1, Math.ceil(g / u[1])); return { txt: n + ' ' + (n === 1 ? u[2].replace(/s$/, '').replace(/es$/, '') : u[2]), n } }
  if (g >= 1000) return { txt: (Math.ceil(g / 100) / 10).toLocaleString('es-CL') + ' kg' }
  return { txt: Math.ceil(g / 50) * 50 + ' g' }
}

/** comidas: [{ nombre?, opciones:[{ etiqueta, alimentos:[{alimento, cantidad}] }] }] · o: { dias=7 }
 *  → { dias, items, grupos:[{ id, nombre, items }], total } */
function lista(comidas, o){
  o = o || {}; const dias = Math.max(1, Math.min(7, +o.dias || 7)), M = new Map()
  ;(comidas || []).forEach((c, ci) => {
    const ops = (c && c.opciones || []).filter(op => op && (op.alimentos || []).length); if (!ops.length) return
    const rep = reparto(dias, ops.length)
    ops.forEach((op, oi) => { const d = rep[oi]; if (!d) return
      op.alimentos.forEach(a => {
        const nom = String(a.alimento || a.nombre || '').trim(); if (!nom) return
        const k = clave(nom); if (!M.has(k)) M.set(k, { clave:k, nombre:cap(nombreBase(nom)) || nom, g:0, crudo:false, libre:false, sinDato:false, comidas:new Set(), porciones:0 })
        const it = M.get(k); it.comidas.add(ci + 1); it.porciones += d
        if (libre(a.cantidad)) { it.libre = true; return }
        let g = gramos(nom, a.cantidad); if (g == null) { it.sinDato = true; it.txtOrig = it.txtOrig || String(a.cantidad || ''); return }
        if (/cocid/i.test(nom)){ const f = CRUDO.find(x => x[0].test(nom)); if (f && f[1] !== 1){ g = g * f[1]; it.crudo = true } }
        it.g += g * d
      })
    })
  })
  const items = [...M.values()].map(it => {
    const c = cat(it.nombre), p = it.g > 0 ? compra(it.nombre, it.g) : null
    return { clave:it.clave, nombre:it.nombre, cat:c[0], g:Math.round(it.g), txt: p ? p.txt : it.libre ? 'A gusto' : (it.txtOrig || '—'),
      crudo:it.crudo, libre:it.libre && !it.g, comidas:[...it.comidas].sort((a, b) => a - b), porciones:it.porciones }
  }).sort((a, b) => b.g - a.g)
  const grupos = CATS.map(([id, nombre]) => ({ id, nombre, items: items.filter(i => i.cat === id) })).filter(g => g.items.length)
  return { dias, items, grupos, total: items.length }
}
/** texto para compartir por WhatsApp o copiar */
function texto(L, titulo){
  return (titulo || 'Mi compra semanal KOACH') + ' · ' + L.dias + ' días\n' + L.grupos.map(g => '\n' + g.nombre + '\n' + g.items.map(i => '• ' + i.nombre + ' — ' + i.txt + (i.crudo ? ' (en crudo)' : '')).join('\n')).join('\n')
}
const KCO = { VERSION, lista, texto, reparto, _clave: clave, _compra: compra }
if (typeof window !== 'undefined') window.KCO = KCO
if (typeof module !== 'undefined') module.exports = KCO
})()
