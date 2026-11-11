/* KOACH · DIAGNÓSTICO DE COMPOSICIÓN A PANTALLA COMPLETA (KD)
   Lo que nutrición le presenta al socio al terminar la evaluación, y lo que el socio puede volver a ver en su app.
   Escritorio: horizontal, todo a la vista. Celular: vertical, una sección bajo otra.
   Entrada: evaluaciones ordenadas por fecha (forma de koach_composicion). Usa KC (koach-composicion.js) si está cargado.
   Global KDG (no KD: ese nombre es del motor de entrenamiento koach-domain.js). Sin dependencias del anfitrión: KDG.abrir({ evs, nombre, programa, nivel, sexo, i }) */
(function(){
'use strict'
const VERSION = 'koach-diagnostico@1.0.0'
const M = ['ENE','FEB','MAR','ABR','MAY','JUN','JUL','AGO','SEP','OCT','NOV','DIC']
const fecha = iso => { const d = new Date(String(iso).slice(0,10) + 'T12:00:00'); return d.getDate() + ' ' + M[d.getMonth()] + ' ' + String(d.getFullYear()).slice(2) }
const dias = (a, b) => Math.round((new Date(String(b).slice(0,10) + 'T12:00:00') - new Date(String(a).slice(0,10) + 'T12:00:00')) / 864e5)
const n = v => v == null || v === '' || !Number.isFinite(+v) ? null : +v
const f1 = v => v == null ? '—' : (Math.round(+v * 10) / 10).toFixed(1).replace('.', ',')
const fx = v => v == null ? '—' : (Math.abs(v) < 0.05 ? '±0,0' : (v > 0 ? '+' : '−') + f1(Math.abs(v)))
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]))
const masaGrasa = e => e ? (n(e.masa_grasa_kg) != null ? n(e.masa_grasa_kg) : n(e.porcentaje_grasa) != null && n(e.peso_kg) ? n(e.peso_kg) * n(e.porcentaje_grasa) / 100 : null) : null
const val = (e, k) => !e ? null : k === 'masa_grasa' ? masaGrasa(e) : n(e[k])

// indicadores: clave, etiqueta, unidad, sentido (+1 subir es bueno · −1 bajar es bueno · 0 neutro)
const IND = [
  ['peso_kg','PESO','kg',0], ['porcentaje_grasa','% GRASA','%',-1], ['masa_muscular_kg','MASA MUSCULAR','kg',1],
  ['masa_grasa','MASA GRASA','kg',-1], ['cintura_cm','CINTURA','cm',-1], ['suma6_mm','Σ6 PLIEGUES','mm',-1]
]
// segmentos del cuerpo: pliegues (mm, bajar es bueno) y perímetros (cm, con su sentido)
const SEG = [
  { id:'BRA', nombre:'BRAZOS', pl:[['triceps_mm','Tríceps'],['biceps_mm','Bíceps']], pe:[['brazo_cm','Brazo relajado',1]] },
  { id:'TRO', nombre:'TRONCO', pl:[['subescapular_mm','Subescapular']], pe:[] },
  { id:'ABD', nombre:'ABDOMEN', pl:[['abdominal_mm','Abdominal'],['supraespinal_mm','Supraespinal'],['cresta_iliaca_mm','Cresta ilíaca']], pe:[['cintura_cm','Cintura',-1]] },
  { id:'CAD', nombre:'CADERA', pl:[], pe:[['cadera_cm','Cadera',-1]] },
  { id:'MUS', nombre:'MUSLOS', pl:[['muslo_mm','Muslo anterior']], pe:[['muslo_cm','Muslo medio',1]] },
  { id:'PAN', nombre:'PANTORRILLAS', pl:[['pantorrilla_mm','Pantorrilla medial']], pe:[['pantorrilla_cm','Pantorrilla máx.',1]] }
]
const MET = [['porcentaje_grasa','% GRASA','%',-1],['masa_muscular_kg','MÚSCULO','kg',1],['peso_kg','PESO','kg',0],['masa_grasa','MASA GRASA','kg',-1],['cintura_cm','CINTURA','cm',-1],['suma6_mm','Σ6 PLIEGUES','mm',-1]]

const S = { evs:[], i:0, cmp:'ini', seg:'ABD', met:'porcentaje_grasa', o:{} }
const actual = () => S.evs[S.i]
const base = () => S.cmp === 'ant' ? (S.i > 0 ? S.evs[S.i - 1] : null) : (S.i > 0 ? S.evs[0] : null)
const tono = (d, sentido, umbral) => d == null ? 'nd' : Math.abs(d) < (umbral || 0.1) || !sentido ? 'est' : d * sentido > 0 ? 'mej' : 'ret'
const pct = (a, b) => a != null && b != null && b !== 0 ? (a - b) / Math.abs(b) * 100 : null

// ── lectura de un segmento: sube o baja grasa local (pliegues) y volumen (perímetro)
function segmento(s, e, b){
  const filas = s.pl.map(([k, l]) => ({ k, l, u:'mm', s:-1 })).concat(s.pe.map(([k, l, sn]) => ({ k, l, u:'cm', s:sn })))
    .map(r => ({ ...r, v: val(e, r.k), b: val(b, r.k) })).map(r => ({ ...r, d: r.v != null && r.b != null ? r.v - r.b : null }))
  const dp = filas.filter(r => r.u === 'mm' && r.d != null), dq = filas.filter(r => r.u === 'cm' && r.d != null)
  const sp = dp.length ? dp.reduce((x, r) => x + r.d, 0) : null, sq = dq.length ? dq.reduce((x, r) => x + r.d * r.s, 0) : null
  let t = 'nd', lectura = b ? 'Sin datos comparables en esta zona.' : 'Línea base: primera medición de esta zona.'
  if (sp != null){ t = sp < -0.5 ? 'mej' : sp > 0.5 ? 'ret' : 'est' }
  else if (sq != null){ t = sq > 0.3 ? 'mej' : sq < -0.3 ? 'ret' : 'est' }
  if (b && (sp != null || sq != null)){
    const vol = dq.length ? dq.reduce((x, r) => x + r.d, 0) / dq.length : null
    lectura = sp != null && sp < -0.5 && vol != null && vol >= -0.2 && s.pe.some(p => p[2] === 1) ? 'Recomposición: menos grasa en la zona manteniendo o ganando volumen muscular.'
      : t === 'mej' ? 'Mejora: la zona reduce grasa.'
      : t === 'ret' ? 'Aumentó la grasa en esta zona: es el foco del próximo período.'
      : 'Zona estable, sin cambios relevantes.'
  }
  const mag = Math.min(1, Math.abs(sp != null ? sp / 6 : (sq || 0) / 3))
  return { ...s, filas, sp, sq, t, lectura, mag }
}

// ── meta del período (6 meses) con avance real desde la primera evaluación
function meta(){
  const ini = S.evs[0], e = actual(); if (!ini || !e || typeof KC === 'undefined' || !KC.metaSeisMeses) return null
  const m = KC.metaSeisMeses(ini.peso_kg, S.o.programa, S.o.nivel, { pctGrasa: ini.porcentaje_grasa, sexo: S.o.sexo || ini.sexo_eval }); if (!m) return null
  let hecho = null
  if (m.tipo === 'GRASA'){ const a = masaGrasa(ini), b = masaGrasa(e); if (a != null && b != null) hecho = b - a }
  if (m.tipo === 'MÚSCULO'){ const a = n(ini.masa_muscular_kg), b = n(e.masa_muscular_kg); if (a != null && b != null) hecho = b - a }
  const avance = hecho != null && m.valor ? Math.max(0, Math.min(1, hecho / m.valor)) : null
  return { ...m, hecho, avance }
}

function logros(){
  const e = actual(), ini = S.evs[0], out = []; if (!e) return out
  const d = (k) => S.i > 0 ? (val(e, k) != null && val(ini, k) != null ? val(e, k) - val(ini, k) : null) : null
  const g = d('porcentaje_grasa'); if (g != null && g <= -0.5) out.push(['−' + f1(-g), 'PUNTOS DE GRASA', 'desde tu primera evaluación'])
  const mu = d('masa_muscular_kg'); if (mu != null && mu >= 0.3) out.push(['+' + f1(mu), 'KG DE MÚSCULO', 'masa muscular nueva'])
  const mg = d('masa_grasa'); if (mg != null && mg <= -0.5) out.push(['−' + f1(-mg), 'KG DE GRASA', 'grasa corporal que ya no está'])
  const ci = d('cintura_cm'); if (ci != null && ci <= -1) out.push(['−' + f1(-ci), 'CM DE CINTURA', 'medida que más se nota'])
  const s6 = d('suma6_mm'); if (s6 != null && s6 <= -3) out.push(['−' + f1(-s6), 'MM DE PLIEGUES', 'suma de 6 pliegues'])
  const ses = S.evs.slice(1, S.i + 1).reduce((x, v) => x + (n(v.sesiones_periodo) || 0), 0); if (ses >= 6) out.push([String(ses), 'SESIONES', 'entrenadas entre evaluaciones'])
  if (n(e.edad_biologica) != null && n(e.edad_eval) != null && e.edad_biologica < e.edad_eval - 0.5) out.push([String(Math.round(e.edad_eval - e.edad_biologica)), 'AÑOS MÁS JOVEN', 'edad biológica estimada vs tu edad'])
  if (S.i >= 2) out.push([String(S.i + 1), 'EVALUACIONES', 'la constancia es el método'])
  return out
}

// ── cuerpo: maniquí por segmentos, coloreado según cómo cambió cada zona
const COL_STAFF = { mej:'#2BB3C0', ret:'#D9774A', est:'#BDBBB4', nd:'#DEDCD6' }
// en la app del socio: solo grises + verde funcional de mejora (manual de marca)
const COL_SOCIO = { mej:'#2F7D4F', ret:'#121212', est:'#BDBBB4', nd:'#E2E1DD' }
const COL = Object.assign({}, COL_STAFF)
function cuerpo(segs){
  const g = id => segs.find(s => s.id === id)
  const sh = (id, d, extra) => { const s = g(id), c = COL[s.t], op = s.t === 'mej' || s.t === 'ret' ? (0.55 + 0.45 * s.mag).toFixed(2) : 1
    return '<path class="kdSg' + (S.seg === id ? ' on' : '') + '" data-seg="' + id + '" d="' + d + '" fill="' + c + '" fill-opacity="' + op + '"' + (extra || '') + '/>' }
  const rr = (x, y, w, h, r) => 'M' + (x + r) + ',' + y + 'h' + (w - 2 * r) + 'a' + r + ',' + r + ' 0 0 1 ' + r + ',' + r + 'v' + (h - 2 * r) + 'a' + r + ',' + r + ' 0 0 1 -' + r + ',' + r + 'h-' + (w - 2 * r) + 'a' + r + ',' + r + ' 0 0 1 -' + r + ',-' + r + 'v-' + (h - 2 * r) + 'a' + r + ',' + r + ' 0 0 1 ' + r + ',-' + r + 'z'
  const X = 80 // desplazamiento del maniquí dentro del lienzo (deja espacio para las etiquetas)
  const p = (d) => d.replace(/(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/g, (_, a, b) => (+a + X) + ',' + b)
  const brazo = rr(X + 34, 70, 20, 82, 10) + rr(X + 30, 155, 17, 72, 8) + rr(X + 146, 70, 20, 82, 10) + rr(X + 153, 155, 17, 72, 8)
  const musl = rr(X + 66, 236, 31, 90, 15) + rr(X + 103, 236, 31, 90, 15), pant = rr(X + 70, 330, 24, 74, 12) + rr(X + 106, 330, 24, 74, 12)
  const lab = (id, lado, y, ty) => { const s = g(id), cx = lado === 'i' ? 6 : 354, anc = lado === 'i' ? 'start' : 'end', d = s.sp != null ? s.sp : s.sq
    const v = d == null ? (S.i ? 'SIN DATO' : 'BASE') : s.sp != null ? fx(s.sp) + ' MM' : fx(s.filas.find(r => r.u === 'cm' && r.d != null).d) + ' CM'
    const lx = lado === 'i' ? 94 : 266
    return '<g class="kdLb' + (S.seg === id ? ' on' : '') + '" data-seg="' + id + '"><line x1="' + lx + '" y1="' + y + '" x2="' + (lado === 'i' ? X + 38 : X + 140) + '" y2="' + ty + '" class="kdLl"/>' +
      '<text x="' + cx + '" y="' + (y - 6) + '" text-anchor="' + anc + '" class="kdLt">' + s.nombre + '</text>' +
      '<text x="' + cx + '" y="' + (y + 9) + '" text-anchor="' + anc + '" class="kdLv kdT-' + s.t + '">' + v + '</text></g>' }
  return '<svg class="kdBody" viewBox="0 0 360 420" role="img" aria-label="Mapa del cuerpo: cambio por zona">' +
    '<circle cx="' + (X + 100) + '" cy="34" r="20" fill="#D3D1CB"/><rect x="' + (X + 92) + '" y="52" width="16" height="12" rx="4" fill="#D3D1CB"/>' +
    sh('TRO', p('M62,70 Q100,60 138,70 L134,148 L66,148 Z')) + sh('ABD', p('M66,151 L134,151 L131,196 L69,196 Z')) + sh('CAD', p('M69,199 L131,199 L137,233 L63,233 Z')) +
    sh('BRA', brazo) + sh('MUS', musl) + sh('PAN', pant) +
    '<rect x="' + (X + 70) + '" y="406" width="24" height="9" rx="4" fill="#D3D1CB"/><rect x="' + (X + 106) + '" y="406" width="24" height="9" rx="4" fill="#D3D1CB"/>' +
    lab('BRA', 'i', 118, 110) + lab('CAD', 'i', 222, 216) + lab('PAN', 'i', 370, 366) + lab('TRO', 'd', 92, 100) + lab('ABD', 'd', 172, 174) + lab('MUS', 'd', 282, 280) + '</svg>'
}
function panelSeg(segs){
  const s = segs.find(x => x.id === S.seg) || segs[0], b = base()
  const max = Math.max(1, ...s.filas.map(r => Math.max(r.v || 0, r.b || 0)))
  return '<div class="kdSp"><span class="kdK">ZONA · ' + (b ? (S.cmp === 'ant' ? 'VS EVALUACIÓN ANTERIOR' : 'VS PRIMERA EVALUACIÓN') : 'LÍNEA BASE') + '</span>' +
    '<h3 class="kdH3">' + s.nombre + '</h3><p class="kdLec kdT-' + s.t + '">' + esc(s.lectura) + '</p>' +
    (s.filas.length ? s.filas.map(r => { const tn = tono(r.d, r.s, r.u === 'mm' ? 0.3 : 0.2)
      return '<div class="kdMr"><div class="kdMr__h"><span>' + esc(r.l) + '</span><b>' + f1(r.v) + ' <i>' + r.u + '</i></b><em class="kdT-' + tn + '">' + (r.d != null ? fx(r.d) + ' ' + r.u : '—') + '</em></div>' +
        '<div class="kdMr__bar">' + (r.b != null ? '<i class="kdMr__a" style="width:' + (r.b / max * 100).toFixed(1) + '%"></i>' : '') + '<i class="kdMr__b kdBg-' + tn + '" style="width:' + ((r.v || 0) / max * 100).toFixed(1) + '%"></i></div>' +
        (r.b != null ? '<small>' + (S.cmp === 'ant' ? 'Anterior ' : 'Inicio ') + f1(r.b) + ' ' + r.u + '</small>' : '') + '</div>' }).join('') : '<p class="kdLec">Sin mediciones registradas.</p>') +
    '<div class="kdSegs">' + segs.map(x => '<button type="button" data-seg="' + x.id + '" aria-pressed="' + (x.id === S.seg) + '"><i style="background:' + COL[x.t] + '"></i>' + x.nombre + '</button>').join('') + '</div></div>'
}

// ── evolución: línea con área, puntos y lectura al pasar el cursor
function evolucion(){
  const [k, l, u, sn] = MET.find(m => m[0] === S.met), pts = S.evs.slice(0, S.i + 1).map((e, i) => ({ i, f: e.fecha, v: val(e, k) })).filter(p => p.v != null)
  const tabs = '<div class="kdTabs" role="tablist">' + MET.map(m => '<button type="button" role="tab" data-met="' + m[0] + '" aria-selected="' + (m[0] === S.met) + '">' + m[1] + '</button>').join('') + '</div>'
  if (pts.length < 2) return tabs + '<div class="kdVac">Con la próxima evaluación verás aquí tu curva de ' + l.toLowerCase() + '.</div>'
  const W = Math.round(Math.max(320, Math.min(1500, (typeof innerWidth !== 'undefined' ? innerWidth : 900) - 120))), H = W < 600 ? 230 : 280, L = 44, R = 24, T = 26, B = 34, vs = pts.map(p => p.v), mn = Math.min(...vs), mx = Math.max(...vs), rg = Math.max(mx - mn, 0.6)
  const lo = mn - rg * 0.25, hi = mx + rg * 0.25, X = i => L + (pts.length < 2 ? 0 : i * (W - L - R) / (pts.length - 1)), Y = v => T + (H - T - B) * (1 - (v - lo) / (hi - lo))
  const tn = tono(pts[pts.length - 1].v - pts[0].v, sn), col = tn === 'ret' ? COL.ret : tn === 'mej' ? COL.mej : '#121212'
  let grid = ''; for (let j = 0; j <= 3; j++){ const v = lo + (hi - lo) * j / 3; grid += '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + Y(v) + '" y2="' + Y(v) + '" class="kdGl"/><text x="' + (L - 8) + '" y="' + (Y(v) + 3) + '" text-anchor="end" class="kdAx">' + f1(v) + '</text>' }
  const line = pts.map((p, i) => X(i).toFixed(1) + ',' + Y(p.v).toFixed(1)).join(' ')
  const area = 'M' + X(0) + ',' + (H - B) + ' L' + line.split(' ').join(' L') + ' L' + X(pts.length - 1) + ',' + (H - B) + ' Z'
  const dots = pts.map((p, i) => '<circle cx="' + X(i) + '" cy="' + Y(p.v) + '" r="' + (i === pts.length - 1 ? 6 : 4.5) + '" fill="' + (i === pts.length - 1 ? col : '#fff') + '" stroke="' + col + '" stroke-width="2"/>' +
    '<text x="' + X(i) + '" y="' + (Y(p.v) - 12) + '" text-anchor="' + (i === 0 ? 'start' : i === pts.length - 1 ? 'end' : 'middle') + '" class="kdPv">' + f1(p.v) + '</text>' +
    '<text x="' + X(i) + '" y="' + (H - 10) + '" text-anchor="' + (i === 0 ? 'start' : i === pts.length - 1 ? 'end' : 'middle') + '" class="kdAx">' + fecha(p.f) + '</text>').join('')
  const tot = pts[pts.length - 1].v - pts[0].v, pc = pct(pts[pts.length - 1].v, pts[0].v)
  return tabs + '<div class="kdEvH"><b class="kdT-' + tn + '">' + fx(tot) + ' ' + u + '</b><span>' + (pc != null && u !== '%' ? fx(pc) + ' % · ' : '') + 'en ' + dias(pts[0].f, pts[pts.length - 1].f) + ' días · ' + pts.length + ' evaluaciones</span></div>' +
    '<div class="kdCh" data-pts=\'' + JSON.stringify(pts.map((p, i) => [X(i) / W, p.f, p.v])) + '\' data-u="' + u + '"><svg viewBox="0 0 ' + W + ' ' + H + '" aria-label="Evolución de ' + l + '">' +
    '<defs><linearGradient id="kdGr" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="' + col + '" stop-opacity=".22"/><stop offset="1" stop-color="' + col + '" stop-opacity="0"/></linearGradient></defs>' +
    grid + '<path d="' + area + '" fill="url(#kdGr)"/><polyline points="' + line + '" fill="none" stroke="' + col + '" stroke-width="2.5" stroke-linejoin="round" class="kdDraw"/>' + dots + '</svg><div class="kdTip" hidden></div></div>'
}

function composicion(){
  const e = actual(), b = S.i > 0 ? S.evs[0] : null
  const partes = x => { if (!x) return null; const pe = n(x.peso_kg); if (!pe) return null
    const gr = masaGrasa(x), mu = n(x.masa_muscular_kg), os = n(x.masa_osea_kg), rs = n(x.masa_residual_kg)
    const arr = [['GRASA', gr, '#121212', '#F4F3F0'], ['MÚSCULO', mu, COL.mej, COL.mej === '#2BB3C0' ? '#06363B' : '#F4F3F0'], ['ÓSEA', os, '#8F8D86', '#F4F3F0'], ['RESIDUAL', rs, '#CFCDC7', '#121212']].filter(p => p[1] != null)
    const resto = pe - arr.reduce((s, p) => s + p[1], 0); if (arr.length < 4 && resto > 0.2) arr.push(['RESTO', resto, '#E2E0DA', '#121212'])
    return { pe, arr } }
  const bar = (x, t) => { const pz = partes(x); if (!pz) return ''
    return '<div class="kdCo"><div class="kdCo__h"><span class="kdK">' + t + '</span><b>' + f1(pz.pe) + ' <i>kg</i></b></div><div class="kdCo__bar">' +
      pz.arr.map(p => '<i style="flex:' + p[1].toFixed(2) + ';background:' + p[2] + ';color:' + p[3] + '" title="' + p[0] + ' ' + f1(p[1]) + ' kg"><span>' + (p[1] / pz.pe > 0.12 ? f1(p[1]) : '') + '</span></i>').join('') + '</div></div>' }
  const pz = partes(e)
  const ley = pz ? '<div class="kdCo__ley">' + pz.arr.map(p => '<span><i style="background:' + p[2] + '"></i>' + p[0] + ' <b>' + f1(p[1]) + ' kg</b> · ' + Math.round(p[1] / pz.pe * 100) + ' %</span>').join('') + '</div>' : ''
  const K = typeof KC !== 'undefined' ? KC : null, sx = S.o.sexo || e.sexo_eval
  const cg = K && K.clasGrasa ? K.clasGrasa(e.porcentaje_grasa, sx) : null, cf = K && K.clasFFMI ? K.clasFFMI(e.ffmi_norm, sx) : null, fc = K && K.formaCorporal ? K.formaCorporal(e.porcentaje_grasa, e.ffmi_norm, sx) : null
  const cl = [fc ? ['FORMA CORPORAL', fc.label, fc.msg] : null, cg ? ['NIVEL DE GRASA', cg, f1(e.porcentaje_grasa) + ' % de grasa'] : null, cf ? ['ÍNDICE MUSCULAR', cf, 'FFMI ' + f1(e.ffmi_norm)] : null,
    n(e.edad_biologica) != null ? ['EDAD BIOLÓGICA', Math.round(e.edad_biologica) + ' AÑOS', n(e.edad_eval) != null ? 'Edad real ' + e.edad_eval + ' años' : ''] : null,
    n(e.ict) != null ? ['CINTURA / TALLA', String(e.ict).replace('.', ','), e.ict < 0.5 ? 'En rango saludable (< 0,5)' : 'Sobre 0,5: foco en cintura'] : null].filter(Boolean)
  return bar(b, 'INICIO · ' + (b ? fecha(b.fecha) : '')) + bar(e, 'HOY · ' + fecha(e.fecha)) + ley +
    (cl.length ? '<div class="kdCl">' + cl.map(c => '<div><span class="kdK">' + c[0] + '</span><b>' + esc(c[1]) + '</b><small>' + esc(c[2]) + '</small></div>').join('') + '</div>' : '')
}

function tabla(){
  const e = actual(), a = S.i > 0 ? S.evs[S.i - 1] : null, ini = S.i > 0 ? S.evs[0] : null
  const G = [['BÁSICOS', [['peso_kg','Peso','kg',0],['talla_cm','Talla','cm',0],['porcentaje_grasa','% grasa','%',-1],['masa_grasa','Masa grasa','kg',-1],['masa_muscular_kg','Masa muscular','kg',1],['masa_osea_kg','Masa ósea','kg',0]]],
    ['PLIEGUES · MM', [['triceps_mm','Tríceps','mm',-1],['biceps_mm','Bíceps','mm',-1],['subescapular_mm','Subescapular','mm',-1],['cresta_iliaca_mm','Cresta ilíaca','mm',-1],['supraespinal_mm','Supraespinal','mm',-1],['abdominal_mm','Abdominal','mm',-1],['muslo_mm','Muslo anterior','mm',-1],['pantorrilla_mm','Pantorrilla medial','mm',-1],['suma6_mm','Σ6 pliegues','mm',-1]]],
    ['PERÍMETROS · CM', [['brazo_cm','Brazo relajado','cm',1],['cintura_cm','Cintura','cm',-1],['cadera_cm','Cadera','cm',-1],['muslo_cm','Muslo medio','cm',1],['pantorrilla_cm','Pantorrilla máx.','cm',1]]]]
  return '<div class="kdTb">' + G.map(([t, rows]) => { const rs = rows.filter(r => val(e, r[0]) != null); if (!rs.length) return ''
    return '<table><thead><tr><th>' + t + '</th>' + (ini ? '<th>INICIO</th>' : '') + (a && a !== ini ? '<th>ANTERIOR</th>' : '') + '<th>HOY</th>' + (ini ? '<th>Δ INICIO</th>' : '') + '</tr></thead><tbody>' +
      rs.map(([k, l, u, sn]) => { const v = val(e, k), d = ini && val(ini, k) != null ? v - val(ini, k) : null
        return '<tr><td>' + l + '</td>' + (ini ? '<td>' + f1(val(ini, k)) + '</td>' : '') + (a && a !== ini ? '<td>' + f1(val(a, k)) + '</td>' : '') + '<td><b>' + f1(v) + '</b> <i>' + u + '</i></td>' +
          (ini ? '<td class="kdT-' + tono(d, sn) + '">' + (d != null ? fx(d) : '—') + '</td>' : '') + '</tr>' }).join('') + '</tbody></table>' }).join('') + '</div>'
}

function html(){
  const e = actual(), b = base(), ini = S.evs[0], segs = SEG.map(s => segmento(s, e, b)), mt = meta(), lg = logros()
  const nom = esc(S.o.nombre || ''), pn = nom.split(' ')[0]
  const dI = S.i > 0 ? dias(ini.fecha, e.fecha) : 0
  // frase principal: los dos cambios que más importan, en lenguaje del socio
  const dg = S.i > 0 ? val(e, 'porcentaje_grasa') - val(ini, 'porcentaje_grasa') : null, dm = S.i > 0 && val(e, 'masa_muscular_kg') != null && val(ini, 'masa_muscular_kg') != null ? val(e, 'masa_muscular_kg') - val(ini, 'masa_muscular_kg') : null
  const fr = []; if (dg != null && !isNaN(dg) && Math.abs(dg) >= 0.3) fr.push((dg < 0 ? 'bajaste ' : 'subiste ') + f1(Math.abs(dg)) + ' puntos de grasa'); if (dm != null && Math.abs(dm) >= 0.3) fr.push((dm > 0 ? 'sumaste ' : 'perdiste ') + f1(Math.abs(dm)) + ' kg de músculo')
  const frase = S.i === 0 ? 'Esta es tu línea base. Desde aquí medimos cada avance.' : fr.length ? 'En ' + dI + ' días ' + fr.join(' y ') + '.' : 'En ' + dI + ' días tu composición se mantuvo estable.'
  const kpis = IND.map(([k, l, u, sn]) => { const v = val(e, k), bv = val(b, k), d = v != null && bv != null ? v - bv : null, tn = tono(d, sn), pc = pct(v, bv)
    const serie = S.evs.slice(0, S.i + 1).map(x => val(x, k)).filter(x => x != null)
    let sp = ''; if (serie.length > 1){ const mn = Math.min(...serie), mx = Math.max(...serie), rg = mx - mn || 1; sp = '<svg viewBox="0 0 100 26" preserveAspectRatio="none" class="kdSpk"><polyline fill="none" stroke="currentColor" stroke-width="2" points="' + serie.map((x, i) => (i * 100 / (serie.length - 1)).toFixed(1) + ',' + (23 - (x - mn) / rg * 20).toFixed(1)).join(' ') + '"/></svg>' }
    return '<div class="kdKp kdT-' + tn + '"><span class="kdK">' + l + '</span><b>' + f1(v) + '<i>' + u + '</i></b>' +
      '<em>' + (d != null ? fx(d) + ' ' + u + (pc != null && u !== '%' ? ' · ' + fx(pc) + ' %' : '') : S.i ? 'sin dato previo' : 'línea base') + '</em>' + sp + '</div>' }).join('')
  const ring = mt && mt.avance != null ? (() => { const R = 54, C = 2 * Math.PI * R, a = mt.avance
      return '<div class="kdMeta"><svg viewBox="0 0 140 140" class="kdRing"><circle cx="70" cy="70" r="' + R + '" class="kdRing__bg"/><circle cx="70" cy="70" r="' + R + '" class="kdRing__fg" stroke-dasharray="' + C.toFixed(1) + '" stroke-dashoffset="' + (C * (1 - a)).toFixed(1) + '" style="--c:' + C.toFixed(1) + '"/>' +
        '<text x="70" y="70" text-anchor="middle" class="kdRing__n">' + Math.round(a * 100) + '%</text><text x="70" y="90" text-anchor="middle" class="kdRing__l">DE TU META</text></svg>' +
        '<div><span class="kdK">META 6 MESES · ' + esc(String(S.o.programa || '').toUpperCase() || 'KOACH') + '</span><b>' + esc(mt.texto) + '</b><small>Llevas ' + fx(mt.hecho) + ' kg de ' + (mt.tipo === 'GRASA' ? 'grasa' : 'músculo') + '. ' +
        (a >= 1 ? 'Meta cumplida: toca fijar la siguiente.' : 'Te falta ' + f1(Math.abs(mt.valor - mt.hecho)) + ' kg. Pégate al plan.') + '</small></div></div>' })()
    : mt ? '<div class="kdMeta kdMeta--t"><div><span class="kdK">META 6 MESES</span><b>' + esc(mt.texto) + '</b><small>' + (S.i ? '' : 'Desde la próxima evaluación verás tu avance hacia la meta.') + '</small></div></div>' : ''
  const opts = S.evs.map((x, i) => '<option value="' + i + '"' + (i === S.i ? ' selected' : '') + '>' + fecha(x.fecha) + (x.estado === 'borrador' ? ' · BORRADOR' : '') + '</option>').join('')
  return (S.inline ? '<div class="kdBar kdBar--in"><label class="kdSel">EVALUACIÓN<select data-act="ev">' + opts + '</select></label>' +
    (S.i > 0 ? '<div class="kdSeg" role="group" aria-label="Comparar con"><button type="button" data-cmp="ini" aria-pressed="' + (S.cmp === 'ini') + '">VS INICIO</button><button type="button" data-cmp="ant" aria-pressed="' + (S.cmp === 'ant') + '">VS ANTERIOR</button></div>' : '') + '</div>' :
    '<div class="kdBar"><span class="kdBar__l">KOACH <em>DIAGNÓSTICO</em></span>' +
    '<label class="kdSel">EVALUACIÓN<select data-act="ev">' + opts + '</select></label>' +
    (S.i > 0 ? '<div class="kdSeg" role="group" aria-label="Comparar con"><button type="button" data-cmp="ini" aria-pressed="' + (S.cmp === 'ini') + '">VS INICIO</button><button type="button" data-cmp="ant" aria-pressed="' + (S.cmp === 'ant') + '">VS ANTERIOR</button></div>' : '') +
    '<button type="button" class="kdX" data-act="cerrar" aria-label="Cerrar diagnóstico">CERRAR ✕</button></div>') +
    '<div class="kdIn">' +
    '<section class="kdHero"><div><span class="kdK">EVALUACIÓN N° ' + (S.i + 1) + ' · ' + fecha(e.fecha) + (S.o.programa ? ' · ' + esc(String(S.o.programa).toUpperCase()) : '') + '</span>' +
      '<h1 class="kdH1">' + nom + '</h1><p class="kdFr">' + esc(frase) + '</p>' + (e.nota_socio ? '<blockquote class="kdNota">' + esc(e.nota_socio) + '<cite>NUTRICIÓN KOACH</cite></blockquote>' : '') + '</div>' + ring + '</section>' +
    '<section class="kdKps">' + kpis + '</section>' +
    '<section class="kdGrid">' +
      '<div class="kdCard kdCard--body"><span class="kdK">CÓMO CAMBIÓ CADA ZONA · TOCA UNA ZONA</span><div class="kdBodyW"><div id="kdBody">' + cuerpo(segs) + '</div><div id="kdSp">' + panelSeg(segs) + '</div></div>' +
        '<div class="kdLeg"><span><i style="background:' + COL.mej + '"></i>MEJORA</span><span><i style="background:' + COL.est + '"></i>ESTABLE</span><span><i style="background:' + COL.ret + '"></i>FOCO</span></div></div>' +
      '<div class="kdCard"><span class="kdK">DE QUÉ ESTÁ HECHO TU PESO</span>' + composicion() + '</div>' +
    '</section>' +
    '<section class="kdCard kdCard--ev"><span class="kdK">TU EVOLUCIÓN</span><div id="kdEv">' + evolucion() + '</div></section>' +
    (lg.length ? '<section class="kdLog"><span class="kdK">LOGROS' + (pn ? ' DE ' + pn.toUpperCase() : '') + '</span><div class="kdLog__g">' + lg.map((x, i) => '<div class="kdBadge" style="--d:' + (i * 70) + 'ms"><b>' + x[0] + '</b><span>' + x[1] + '</span><small>' + x[2] + '</small></div>').join('') + '</div></section>' : '') +
    '<section class="kdCard"><span class="kdK">TODO LO QUE MEDIMOS · PROTOCOLO ISAK</span>' + tabla() + '</section>' +
    '<p class="kdPie">' + VERSION + ' · Estimaciones antropométricas ISAK: orientan el trabajo de nutrición y entrenamiento, no son un diagnóstico médico.</p></div>'
}

let ov = null
function pintar(){ if (!ov) return; if (S.inline){ ov.innerHTML = html(); return enlazarChart() } const y = ov.scrollTop; ov.innerHTML = html(); ov.scrollTop = y; enlazarChart() }
function repSeg(){ const e = actual(), b = base(), segs = SEG.map(s => segmento(s, e, b)); ov.querySelector('#kdBody').innerHTML = cuerpo(segs); ov.querySelector('#kdSp').innerHTML = panelSeg(segs) }
function enlazarChart(){
  const ch = ov && ov.querySelector('.kdCh'); if (!ch) return
  const pts = JSON.parse(ch.dataset.pts || '[]'), tip = ch.querySelector('.kdTip'), u = ch.dataset.u
  ch.onpointermove = ev => { const r = ch.getBoundingClientRect(), x = (ev.clientX - r.left) / r.width
    let best = pts[0]; pts.forEach(p => { if (Math.abs(p[0] - x) < Math.abs(best[0] - x)) best = p })
    tip.hidden = false; tip.style.left = (best[0] * 100) + '%'; tip.innerHTML = '<b>' + f1(best[2]) + ' ' + u + '</b>' + fecha(best[1]) }
  ch.onpointerleave = () => { tip.hidden = true }
}
function onClick(ev){
  const t = ev.target.closest('[data-seg],[data-met],[data-cmp],[data-act]'); if (!t) return
  if (t.dataset.act === 'cerrar') return cerrar()
  if (t.dataset.seg){ S.seg = t.dataset.seg; return repSeg() }
  if (t.dataset.met){ S.met = t.dataset.met; ov.querySelector('#kdEv').innerHTML = evolucion(); return enlazarChart() }
  if (t.dataset.cmp){ S.cmp = t.dataset.cmp; return pintar() }
}
function onKey(ev){ if (ev.key === 'Escape') cerrar() }
function cerrar(){ if (!ov) return; if (S.inline){ ov = null; S.inline = false; return } ov.remove(); ov = null; document.documentElement.style.overflow = ''; document.removeEventListener('keydown', onKey) }
function abrir(o){
  o = o || {}; const evs = (o.evs || []).filter(e => e && e.fecha).slice().sort((a, b) => String(a.fecha).localeCompare(String(b.fecha)))
  if (!evs.length) return false
  ensureCss(); cerrar(); Object.assign(COL, COL_STAFF)
  S.evs = evs; S.o = o; S.i = o.i != null ? Math.max(0, Math.min(evs.length - 1, o.i)) : evs.length - 1; S.cmp = 'ini'; S.met = 'porcentaje_grasa'
  // parte en la zona con el cambio más visible
  const segs = SEG.map(s => segmento(s, actual(), base())).filter(s => s.t === 'mej' || s.t === 'ret').sort((a, b) => b.mag - a.mag); S.seg = segs[0] ? segs[0].id : 'ABD'
  ov = document.createElement('div'); ov.className = 'kd'; ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-modal', 'true'); ov.setAttribute('aria-label', 'Diagnóstico de composición corporal')
  ov.addEventListener('click', onClick)
  ov.addEventListener('change', ev => { if (ev.target.dataset.act === 'ev'){ S.i = +ev.target.value; if (S.i === 0) S.cmp = 'ini'; pintar() } })
  document.body.appendChild(ov); document.documentElement.style.overflow = 'hidden'; document.addEventListener('keydown', onKey)
  pintar(); return true
}

const CSS = `
.kd{position:fixed;inset:0;z-index:1000;overflow:auto;background:#EFEEEA;color:#121212;font-family:var(--font-body,'Inter Display',Arial,sans-serif);font-variant-numeric:tabular-nums;-webkit-font-smoothing:antialiased;animation:kdIn .25s ease-out}
@keyframes kdIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
.kd *{box-sizing:border-box}
.kdK{display:block;font:700 10px/1.4 var(--font-mono,'Space Mono',monospace);letter-spacing:.14em;text-transform:uppercase;color:#6B6A65}
.kdBar{position:sticky;top:0;z-index:3;display:flex;align-items:center;gap:16px;flex-wrap:wrap;min-height:64px;padding:10px clamp(16px,3vw,40px);background:#0B0B0C;color:#F4F3F0}
.kdBar__l{font:900 18px/1 var(--font-display,Arial);letter-spacing:.02em}.kdBar__l em{font:700 10px var(--font-mono,monospace);letter-spacing:.18em;color:#2BB3C0;font-style:normal;margin-left:10px;vertical-align:middle}
.kdSel{display:flex;align-items:center;gap:8px;margin-left:auto;font:700 9.5px var(--font-mono,monospace);letter-spacing:.14em;color:#A3A29C}
.kdSel select{min-height:36px;padding:0 10px;border-radius:999px;border:1px solid #333;background:#151515;color:#F4F3F0;font:700 11px var(--font-mono,monospace)}
.kdSeg{display:inline-flex;padding:3px;border-radius:999px;background:#1C1C1D}
.kdSeg button,.kdX{min-height:34px;padding:0 14px;border:0;border-radius:999px;background:transparent;color:#A3A29C;font:700 10px var(--font-mono,monospace);letter-spacing:.12em;cursor:pointer}
.kdSeg button[aria-pressed="true"]{background:#F4F3F0;color:#0B0B0C}
.kdX{border:1px solid #333;color:#F4F3F0}
.kdIn{padding:clamp(16px,2.4vw,36px) clamp(16px,3vw,40px) 48px;display:flex;flex-direction:column;gap:clamp(12px,1.4vw,20px)}
.kdHero{display:grid;grid-template-columns:minmax(0,1.5fr) minmax(320px,1fr);gap:24px;align-items:center}
.kdH1{margin:8px 0 10px;font:900 clamp(34px,5.2vw,76px)/.92 var(--font-display,Arial);font-stretch:110%;text-transform:uppercase;letter-spacing:-.01em}
.kdFr{margin:0;max-width:760px;font:600 clamp(17px,1.7vw,24px)/1.3 var(--font-body,Arial)}
.kdNota{margin:16px 0 0;max-width:760px;padding:14px 18px;border-left:3px solid #2BB3C0;background:#FBFAF8;border-radius:0 12px 12px 0;font:400 15px/1.5 var(--font-body,Arial);color:#2C2B28}
.kdNota cite{display:block;margin-top:6px;font:700 9.5px var(--font-mono,monospace);letter-spacing:.14em;color:#6B6A65;font-style:normal}
.kdMeta{display:flex;align-items:center;gap:18px;padding:18px;border-radius:20px;background:#121212;color:#F4F3F0}
.kdMeta .kdK{color:#A3A29C}.kdMeta b{display:block;margin:6px 0;font:800 20px/1.15 var(--font-display,Arial);text-transform:uppercase}.kdMeta small{display:block;color:#C9C7C1;font-size:13.5px;line-height:1.4}
.kdRing{flex:none;width:132px;height:132px}.kdRing__bg{fill:none;stroke:#2A2A2B;stroke-width:12}
.kdRing__fg{fill:none;stroke:#2BB3C0;stroke-width:12;stroke-linecap:round;transform:rotate(-90deg);transform-origin:70px 70px;animation:kdRing 1.1s cubic-bezier(.2,.7,.2,1)}
@keyframes kdRing{from{stroke-dashoffset:var(--c)}}
.kdRing__n{font:800 30px var(--font-display,Arial);fill:#F4F3F0}.kdRing__l{font:700 8.5px var(--font-mono,monospace);letter-spacing:.14em;fill:#A3A29C}
.kdKps{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:10px}
.kdKp{position:relative;padding:16px 16px 12px;border-radius:16px;background:#FBFAF8;border:1px solid rgba(18,18,18,.08);overflow:hidden;color:#6B6A65}
.kdKp b{display:block;margin:8px 0 4px;font:800 clamp(28px,2.6vw,40px)/1 var(--font-display,Arial);color:#121212}.kdKp b i{font:700 12px var(--font-mono,monospace);font-style:normal;margin-left:4px;color:#6B6A65}
.kdKp em{display:block;font:700 11px var(--font-mono,monospace);font-style:normal;letter-spacing:.04em}
.kdSpk{display:block;width:100%;height:26px;margin-top:8px;opacity:.85}
.kdT-mej{color:#13848F}.kdT-ret{color:#B85A2E}.kdT-est,.kdT-nd{color:#6B6A65}
.kdBg-mej{background:#2BB3C0}.kdBg-ret{background:#D9774A}.kdBg-est,.kdBg-nd{background:#8F8D86}
.kdGrid{display:grid;grid-template-columns:minmax(0,1.35fr) minmax(0,1fr);gap:clamp(12px,1.4vw,20px)}
.kdCard{padding:clamp(16px,1.6vw,24px);border-radius:20px;background:#FBFAF8;border:1px solid rgba(18,18,18,.08)}
.kdBodyW{display:grid;grid-template-columns:minmax(260px,1fr) minmax(0,1fr);gap:18px;align-items:start;margin-top:10px}
.kdBody{width:100%;max-height:520px;display:block}
.kdSg{cursor:pointer;stroke:#FBFAF8;stroke-width:2;transition:filter .15s,stroke .15s}.kdSg:hover{filter:brightness(.92)}.kdSg.on{stroke:#121212;stroke-width:2.5}
.kdLb{cursor:pointer}.kdLl{stroke:rgba(18,18,18,.25);stroke-width:1}.kdLb.on .kdLl{stroke:#121212}
.kdLt{font:700 9px var(--font-mono,monospace);letter-spacing:.12em;fill:#6B6A65}.kdLb.on .kdLt{fill:#121212}
.kdLv{font:700 12px var(--font-mono,monospace);fill:currentColor}
.kdH3{margin:4px 0 6px;font:900 28px/1 var(--font-display,Arial);text-transform:uppercase}
.kdLec{margin:0 0 14px;font:600 14.5px/1.45 var(--font-body,Arial)}
.kdMr{padding:10px 0;border-top:1px solid rgba(18,18,18,.08)}
.kdMr__h{display:grid;grid-template-columns:1fr auto auto;gap:12px;align-items:baseline;font-size:14px}
.kdMr__h b{font:700 16px var(--font-mono,monospace)}.kdMr__h b i{font-style:normal;font-size:11px;color:#6B6A65}.kdMr__h em{font:700 12px var(--font-mono,monospace);font-style:normal;min-width:78px;text-align:right}
.kdMr__bar{position:relative;height:8px;margin-top:8px;border-radius:4px;background:#ECEAE5;overflow:hidden}
.kdMr__bar i{position:absolute;left:0;top:0;bottom:0;border-radius:4px}.kdMr__a{background:rgba(18,18,18,.18);height:100%}.kdMr__b{height:4px!important;top:2px!important;animation:kdW .8s ease-out}
@keyframes kdW{from{width:0}}
.kdMr small{display:block;margin-top:4px;font:400 10.5px var(--font-mono,monospace);color:#6B6A65}
.kdSegs{display:flex;flex-wrap:wrap;gap:6px;margin-top:14px}
.kdSegs button{display:inline-flex;align-items:center;gap:6px;min-height:32px;padding:0 12px;border-radius:999px;border:1px solid rgba(18,18,18,.12);background:transparent;font:700 9.5px var(--font-mono,monospace);letter-spacing:.1em;cursor:pointer;color:#4A4945}
.kdSegs button i{width:8px;height:8px;border-radius:50%}.kdSegs button[aria-pressed="true"]{background:#121212;color:#F4F3F0;border-color:#121212}
.kdLeg{display:flex;gap:16px;margin-top:10px;font:700 9.5px var(--font-mono,monospace);letter-spacing:.12em;color:#6B6A65}.kdLeg i{display:inline-block;width:10px;height:10px;border-radius:3px;margin-right:6px;vertical-align:-1px}
.kdCo{margin-top:14px}.kdCo__h{display:flex;justify-content:space-between;align-items:baseline}.kdCo__h b{font:800 22px var(--font-display,Arial)}.kdCo__h b i{font:700 11px var(--font-mono,monospace);font-style:normal;color:#6B6A65}
.kdCo__bar{display:flex;gap:2px;height:42px;margin-top:6px;border-radius:10px;overflow:hidden}
.kdCo__bar i{display:flex;align-items:center;justify-content:center;min-width:2px;animation:kdGrow .9s cubic-bezier(.2,.7,.2,1);transform-origin:left}
.kdCo__bar i span{font:700 11px var(--font-mono,monospace);}
@keyframes kdGrow{from{transform:scaleX(0)}}
.kdCo__ley{display:flex;flex-wrap:wrap;gap:6px 16px;margin-top:12px;font:400 12px var(--font-body,Arial);color:#4A4945}.kdCo__ley i{display:inline-block;width:10px;height:10px;border-radius:3px;margin-right:6px;vertical-align:-1px}
.kdCl{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:8px;margin-top:16px}
.kdCl div{padding:12px;border-radius:12px;background:#F1F0EC}.kdCl b{display:block;margin:6px 0 2px;font:800 17px/1.1 var(--font-display,Arial);text-transform:uppercase}.kdCl small{font-size:12px;color:#6B6A65}
.kdTabs{display:flex;flex-wrap:wrap;gap:6px;margin:10px 0 12px}
.kdTabs button{min-height:34px;padding:0 14px;border-radius:999px;border:1px solid rgba(18,18,18,.12);background:transparent;font:700 10px var(--font-mono,monospace);letter-spacing:.12em;cursor:pointer;color:#4A4945}
.kdTabs button[aria-selected="true"]{background:#121212;color:#F4F3F0;border-color:#121212}
.kdEvH{display:flex;align-items:baseline;gap:14px;flex-wrap:wrap;margin-bottom:4px}.kdEvH b{font:900 34px var(--font-display,Arial)}.kdEvH span{font:700 11px var(--font-mono,monospace);letter-spacing:.06em;color:#6B6A65}
.kdCh{position:relative}.kdCh svg{display:block;width:100%;height:auto;overflow:visible}
.kdGl{stroke:rgba(18,18,18,.07)}.kdAx{font:400 10px var(--font-mono,monospace);fill:#6B6A65}.kdPv{font:700 12px var(--font-mono,monospace);fill:#121212}
.kdDraw{stroke-dasharray:2000;animation:kdDraw 1.2s ease-out}@keyframes kdDraw{from{stroke-dashoffset:2000}to{stroke-dashoffset:0}}
.kdTip{position:absolute;top:0;transform:translateX(-50%);padding:8px 10px;border-radius:10px;background:#121212;color:#F4F3F0;font:400 10px var(--font-mono,monospace);pointer-events:none;white-space:nowrap}.kdTip b{display:block;font-size:14px}
.kdVac{padding:28px;border:1px dashed rgba(18,18,18,.15);border-radius:14px;color:#6B6A65;font-size:14px}
.kdLog__g{display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:10px;margin-top:10px}
.kdBadge{padding:18px;border-radius:18px;background:#121212;color:#F4F3F0;animation:kdPop .5s cubic-bezier(.2,.9,.3,1.3) both;animation-delay:var(--d)}
.kdBadge b{display:block;font:900 40px/1 var(--font-display,Arial);color:#2BB3C0}.kdBadge span{display:block;margin-top:8px;font:700 10.5px var(--font-mono,monospace);letter-spacing:.12em}.kdBadge small{display:block;margin-top:4px;color:#A3A29C;font-size:12.5px}
@keyframes kdPop{from{opacity:0;transform:scale(.9) translateY(6px)}}
.kdTb{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:18px;margin-top:10px}
.kdTb table{width:100%;border-collapse:collapse;font-size:13.5px}
.kdTb th{text-align:right;padding:8px 6px;font:700 9px var(--font-mono,monospace);letter-spacing:.12em;color:#6B6A65;border-bottom:1px solid rgba(18,18,18,.12)}.kdTb th:first-child{text-align:left;color:#121212}
.kdTb td{padding:8px 6px;border-bottom:1px solid rgba(18,18,18,.06);text-align:right;font:400 12.5px var(--font-mono,monospace)}.kdTb td:first-child{text-align:left;font:400 13.5px var(--font-body,Arial)}
.kdTb td i{font-style:normal;color:#6B6A65;font-size:10.5px}.kdTb td.kdT-mej,.kdTb td.kdT-ret{font-weight:700}
.kdPie{margin:0;font:400 10.5px var(--font-mono,monospace);color:#8F8D86}
@media (max-width:1200px){.kdKps{grid-template-columns:repeat(3,minmax(0,1fr))}.kdGrid{grid-template-columns:1fr}.kdTb{grid-template-columns:1fr 1fr}}
@media (max-width:760px){.kdHero{grid-template-columns:1fr}.kdKps{grid-template-columns:repeat(2,minmax(0,1fr))}.kdBodyW{grid-template-columns:1fr}.kdBody{max-height:440px}.kdTb{grid-template-columns:1fr}.kdSel{margin-left:auto;font-size:0;gap:0}.kdBar{gap:10px}.kdMeta{flex-direction:column;text-align:center}}
@media (prefers-reduced-motion:reduce){.kd,.kd *{animation:none!important}}
.kd.kd--in{position:static;inset:auto;z-index:auto;overflow:visible;background:transparent;animation:none}
.kd--in .kdBar--in{position:static;min-height:0;padding:8px 8px 8px 16px;border-radius:20px;background:#121212;justify-content:space-between;flex-wrap:nowrap}
.kd--in section.kdCard{background:#FBFAF8!important;border-radius:20px!important}
.kd--in .kdPie{color:#2A2A2A}
.kd--in .kdHero .kdK,.kd--in .kdLog>.kdK{color:#2A2A2A}
@media (max-width:420px){.kd--in .kdBar--in .kdSel{font-size:0;gap:0;margin-left:0}.kd--in .kdSeg button{padding:0 10px}}
.kd--in .kdBar--in .kdSel{margin-left:10px;font-size:9.5px;gap:8px}
.kd--in .kdIn{padding:12px 0 8px}
.kd--in .kdNota{border-left-color:#121212}
.kd--in .kdT-mej{color:#2F7D4F}.kd--in .kdT-ret{color:#121212}.kd--in .kdBg-mej{background:#2F7D4F}.kd--in .kdBg-ret{background:#121212}
.kd--in .kdRing__fg{stroke:#2F7D4F}.kd--in .kdBadge b{color:#F4F3F0}.kd--in .kdSeg button{white-space:nowrap}
.kd--in .kdH1{font-size:clamp(30px,9vw,44px)}
`
function ensureCss(){ if (document.getElementById('kdCss')) return; const s = document.createElement('style'); s.id = 'kdCss'; s.textContent = CSS; document.head.appendChild(s) }

// En línea dentro de una pantalla (app del socio): mismo diagnóstico, sin barra de cierre ni capa fija
function montar(el, o){
  o = o || {}; const evs = (o.evs || []).filter(e => e && e.fecha).slice().sort((a, b) => String(a.fecha).localeCompare(String(b.fecha)))
  if (!el || !evs.length) return false
  ensureCss(); if (ov && !S.inline) cerrar()
  Object.assign(COL, o.paleta === 'socio' ? COL_SOCIO : COL_STAFF)
  S.inline = true; S.evs = evs; S.o = o; S.i = evs.length - 1; S.cmp = 'ini'; S.met = 'porcentaje_grasa'
  const segs = SEG.map(s => segmento(s, actual(), base())).filter(s => s.t === 'mej' || s.t === 'ret').sort((a, b) => b.mag - a.mag); S.seg = segs[0] ? segs[0].id : 'ABD'
  ov = el; el.classList.add('kd', 'kd--in')
  if (!el._kd){ el._kd = 1; el.addEventListener('click', ev => { if (ov === el) onClick(ev) })
    el.addEventListener('change', ev => { if (ov === el && ev.target.dataset.act === 'ev'){ S.i = +ev.target.value; if (S.i === 0) S.cmp = 'ini'; pintar() } }) }
  el.innerHTML = html(); enlazarChart(); return true
}
const KDG = { VERSION, abrir, cerrar, montar, _segmento: segmento, _S: S }
if (typeof window !== 'undefined') window.KDG = KDG
if (typeof module !== 'undefined') module.exports = KDG
})()
