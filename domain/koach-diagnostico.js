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
const COL_SOCIO = { mej:'#2BB3C0', ret:'#E07A3F', est:'#BDBBB4', nd:'#E2E1DD' }
const COL = Object.assign({}, COL_STAFF)
function cuerpo(segs){
  if (S.inline && S.d3 !== false) return cuerpo3d(segs)
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

// ── CUERPO 3D (app del socio): maniquí isométrico que gira; la zona elegida se ve en calipso. Proporciones desde las medidas reales.
const B3 = { r:null, cam:null, scene:null, grupo:null, partes:[], key:'', ang:0.5, raf:0, drag:null, carga:null }
const CALIPSO = 0x2BB3C0, METAL = 0xC9CBCE, NEUTRO = 0xDCDDDF
const P3 = { BRA:['i', 27], CAD:['i', 49], PAN:['i', 76], TRO:['d', 23], ABD:['d', 40], MUS:['d', 62] }
function lect3(s){
  const mm = s.filas.filter(r => r.u === 'mm' && r.v != null), cm = s.filas.filter(r => r.u === 'cm' && r.v != null)
  if (mm.length){ const v = mm.reduce((a, r) => a + r.v, 0); return { v, u:'MM', l: mm.length > 1 ? 'Σ ' + mm.length + ' PLIEGUES' : mm[0].l.toUpperCase(), d: s.sp } }
  if (cm.length){ const r = cm[0]; return { v:r.v, u:'CM', l:r.l.toUpperCase(), d:r.d } }
  return null
}
function cuerpo3d(segs){
  const lab = segs.map(s => { const p = P3[s.id]; if (!p) return ''; const L = lect3(s), on = S.seg === s.id
    const dl = L && L.d != null ? '<em class="kdT-' + s.t + '">' + fx(L.d) + ' ' + L.u + '</em>' : '<em>' + (S.i ? 'SIN DATO PREVIO' : 'LÍNEA BASE') + '</em>'
    return '<button type="button" class="kd3__p kd3__p--' + p[0] + (on ? ' on' : '') + '" data-seg="' + s.id + '" style="top:' + p[1] + '%"><span>' + s.nombre + '</span>' +
      (L ? '<b><span data-cnt="' + L.v + '">' + f1(L.v) + '</span><i>' + L.u + '</i></b><small>' + esc(L.l) + '</small>' : '<b>—</b>') + dl + '</button>' }).join('')
  return '<div class="kd3" id="kd3" role="img" aria-label="Cuerpo en 3D: toca una zona para ver su cambio"><svg class="kd3__ln" id="kd3Ln" aria-hidden="true">' +
    Object.keys(P3).map(k => '<path data-l="' + k + '"/><circle data-c="' + k + '" r="3.5"/>').join('') + '</svg>' + lab +
    '<span class="kd3__h">ARRASTRA PARA GIRAR · TOCA UNA ZONA</span></div>'
}
function tag3(segs){ const s = segs.find(x => x.id === S.seg) || segs[0], d = s.sp != null ? s.sp : s.sq
  const v = d == null ? (S.i ? 'SIN DATO' : 'LÍNEA BASE') : s.sp != null ? fx(s.sp) + ' MM' : fx(s.filas.find(r => r.u === 'cm' && r.d != null).d) + ' CM'
  return '<i></i><span>' + s.nombre + '</span><b>' + v + '</b>' }
function b3Tag(segs){ if (!ov) return; ov.querySelectorAll('.kd3__p').forEach(b => b.classList.toggle('on', b.dataset.seg === S.seg)) }
function b3Cargar(){
  if (window.THREE) return Promise.resolve(true)
  if (!B3.carga) B3.carga = new Promise(ok => { const sc = document.createElement('script'); sc.src = '/vendor/three-r128.min.js'; sc.async = true
    sc.onload = () => ok(!!window.THREE); sc.onerror = () => ok(false); document.head.appendChild(sc) })
  return B3.carga
}
function anilloAnim(){
  const t = ov && ov.querySelector('.kdRing__n'); if (!t) return; const fin = parseInt(t.textContent, 10) || 0, t0 = performance.now(), D = 1800
  t.textContent = '0%'; const paso = now => { const k = Math.min(1, Math.max(0, (now - t0 - 150) / D)), e = 1 - Math.pow(1 - k, 3); t.textContent = Math.round(fin * e) + '%'; if (k < 1 && t.isConnected) requestAnimationFrame(paso) }; requestAnimationFrame(paso)
}
function b3Enlazar(){
  const box = ov && ov.querySelector('#kd3'); if (!box) return
  if (!window.THREE){ b3Cargar().then(ok => { if (!ok){ S.d3 = false; if (ov && ov.querySelector('#kd3')) ov.querySelector('#kdBody').innerHTML = cuerpo(SEG.map(x => segmento(x, actual(), base()))) } else b3Enlazar() }); return }
  const T = window.THREE
  if (!B3.r){
    try { B3.r = new T.WebGLRenderer({ antialias:true, alpha:true }) } catch (e) { S.d3 = false; return repSeg() }
    B3.r.setPixelRatio(Math.min(2, window.devicePixelRatio || 1))
    B3.scene = new T.Scene(); B3.cam = new T.OrthographicCamera(-1, 1, 1, -1, 0.1, 50)
    B3.cam.position.set(0, 1.35, 3.2); B3.cam.lookAt(0, 0.05, 0)
    B3.scene.add(new T.HemisphereLight(0xffffff, 0x6f7276, 0.95))
    const d1 = new T.DirectionalLight(0xffffff, 0.85); d1.position.set(2, 4, 3); B3.scene.add(d1)
    const d2 = new T.DirectionalLight(0xffffff, 0.35); d2.position.set(-3, 2, -2); B3.scene.add(d2)
    const piso = new T.Mesh(new T.CircleGeometry(0.5, 64), new T.MeshBasicMaterial({ color:0x121212, transparent:true, opacity:0.08 })); piso.rotation.x = -Math.PI / 2; piso.position.y = -0.86; B3.scene.add(piso)
    const anillo = new T.Mesh(new T.RingGeometry(0.52, 0.535, 96), new T.MeshBasicMaterial({ color:0x121212, transparent:true, opacity:0.25, side:T.DoubleSide })); anillo.rotation.x = -Math.PI / 2; anillo.position.y = -0.859; B3.scene.add(anillo)
    const cv = B3.r.domElement; cv.className = 'kd3__cv'
    cv.addEventListener('pointerdown', e => { B3.drag = { x:e.clientX, a:B3.ang, t:Date.now(), mv:0 }; cv.setPointerCapture(e.pointerId) })
    cv.addEventListener('pointermove', e => { if (!B3.drag) return; const dx = e.clientX - B3.drag.x; B3.drag.mv = Math.max(B3.drag.mv, Math.abs(dx)); B3.ang = B3.drag.a + dx * 0.012 })
    cv.addEventListener('pointerup', e => { const d = B3.drag; B3.drag = null; if (!d || d.mv > 6) { B3.quieto = Date.now(); return } b3Tocar(e) })
    cv.addEventListener('pointercancel', () => { B3.drag = null })
  }
  box.insertBefore(B3.r.domElement, box.firstChild)
  const e = actual(), key = S.i + ':' + (e && e.id)
  if (key !== B3.key){ B3.key = key; b3Armar(e) }
  b3Color(); b3Tam()
  if (!B3.raf) b3Loop()
}
function b3Tocar(ev){
  const T = window.THREE, cv = B3.r.domElement, rc = cv.getBoundingClientRect(), ray = new T.Raycaster()
  ray.setFromCamera(new T.Vector2((ev.clientX - rc.left) / rc.width * 2 - 1, -((ev.clientY - rc.top) / rc.height) * 2 + 1), B3.cam)
  const hit = ray.intersectObjects(B3.partes, false)[0]; if (hit){ S.seg = hit.object.userData.seg; repSeg() }
}
function b3Tam(){ if (!B3.r) return; const box = B3.r.domElement.parentNode; if (!box) return
  const W = box.clientWidth || 320, H = box.clientHeight || 380; B3.r.setSize(W, H, false)
  const a = W / H, h = 1.08; B3.cam.left = -h * a; B3.cam.right = h * a; B3.cam.top = h; B3.cam.bottom = -h; B3.cam.updateProjectionMatrix() }
function b3Loop(){
  const cv = B3.r && B3.r.domElement
  if (!cv || !cv.isConnected){ B3.raf = 0; return }
  B3.raf = requestAnimationFrame(b3Loop)
  const r = cv.getBoundingClientRect(); if (r.bottom < 0 || r.top > innerHeight) return
  if (!B3.drag && (!B3.quieto || Date.now() - B3.quieto > 2500)) B3.ang += 0.006
  if (B3.grupo) B3.grupo.rotation.y = B3.ang
  if ((B3.fr = (B3.fr || 0) + 1) % 2 === 0) b3Lineas()
  if (cv.width !== Math.round(cv.parentNode.clientWidth * B3.r.getPixelRatio())) b3Tam()
  B3.r.render(B3.scene, B3.cam)
}
function b3Lineas(){
  const T = window.THREE, svg = ov && ov.querySelector('#kd3Ln'); if (!svg || !B3.anc || !B3.grupo) return
  const box = svg.parentNode, W = box.clientWidth, H = box.clientHeight, cs = Math.cos(B3.ang), sn = Math.sin(B3.ang), v = new T.Vector3()
  Object.keys(P3).forEach(k => { const [lado, top] = P3[k], pts = B3.anc[k]; if (!pts) return
    let best = null
    pts.forEach(c => { v.set(c.x * cs + c.z * sn, c.y + B3.grupo.position.y, -c.x * sn + c.z * cs).project(B3.cam)
      const x = (v.x + 1) / 2 * W, y = (1 - v.y) / 2 * H; if (!best || (lado === 'd' ? x > best[0] : x < best[0])) best = [x, y] })
    const lb = box.querySelector('.kd3__p[data-seg="' + k + '"]'); if (!lb || !best) return
    const ly = lb.offsetTop + 14, lx = lado === 'd' ? lb.offsetLeft - 6 : lb.offsetLeft + lb.offsetWidth + 6, ex = lado === 'd' ? lx - 14 : lx + 14
    svg.querySelector('[data-l="' + k + '"]').setAttribute('d', 'M' + best[0].toFixed(1) + ' ' + best[1].toFixed(1) + ' L' + ex.toFixed(1) + ' ' + ly + ' L' + lx.toFixed(1) + ' ' + ly)
    const c = svg.querySelector('[data-c="' + k + '"]'); c.setAttribute('cx', best[0].toFixed(1)); c.setAttribute('cy', best[1].toFixed(1))
    const on = k === S.seg; svg.querySelector('[data-l="' + k + '"]').classList.toggle('on', on); c.classList.toggle('on', on) })
}
function b3Color(){ const T = window.THREE; if (!T) return
  B3.partes.forEach(m => { const on = m.userData.seg === S.seg; m.material.color = new T.Color(on ? CALIPSO : METAL); m.material.emissive = new T.Color(on ? 0x0b3a3e : 0x000000) }) }
function b3Armar(e){
  const T = window.THREE; e = e || {}
  if (B3.grupo) B3.scene.remove(B3.grupo)
  B3.partes = []; const g = new T.Group(); g.position.y = -0.86; B3.grupo = g; B3.scene.add(g)
  const v = (k, d) => { const x = n(e[k]); return x != null && x > 0 ? x : d }
  const r = c => c / (2 * Math.PI) / 100, gm = x => x / 1000, pc = (per, pl) => r(per - Math.PI * pl / 10)
  const suave = (k, m) => { const out = [], P = i => k[Math.max(0, Math.min(k.length - 1, i))]
    for (let i = 0; i < k.length - 1; i++){ const p0 = P(i - 1), p1 = P(i), p2 = P(i + 1), p3 = P(i + 2)
      for (let j = 0; j < m; j++){ const t = j / m, t2 = t * t, t3 = t2 * t, f = (a, b, c, d) => 0.5 * ((2 * b) + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3)
        out.push([Math.max(0.004, f(p0[0], p1[0], p2[0], p3[0])), f(p0[1], p1[1], p2[1], p3[1])]) } }
    out.push(k[k.length - 1]); return out }
  const tramo = (pf, y0, y1) => { const at = y => { for (let i = 0; i < pf.length - 1; i++){ const a = pf[i], b = pf[i + 1]; if (y >= a[1] && y <= b[1]){ const t = (y - a[1]) / ((b[1] - a[1]) || 1); return [a[0] + (b[0] - a[0]) * t, y] } } return pf[y < pf[0][1] ? 0 : pf.length - 1] }
    return [at(y0)].concat(pf.filter(p => p[1] > y0 && p[1] < y1), [at(y1)]) }
  const lathe = pf => new T.LatheGeometry(pf.map(([a, b]) => new T.Vector2(a, b)), 48)
  const neutro = geo => new T.Mesh(geo, new T.MeshStandardMaterial({ color:NEUTRO, roughness:0.5, metalness:0.12 }))
  const zona = (pf, zEsc, seg) => { const m = new T.Mesh(lathe(pf), new T.MeshStandardMaterial({ color:METAL, roughness:0.42, metalness:0.18 })); m.scale.z = zEsc; m.userData.seg = seg; B3.partes.push(m); return m }
  const rp = pc(v('pantorrilla_cm', 36), v('pantorrilla_mm', 10)) + gm(v('pantorrilla_mm', 10)), rm = pc(v('muslo_cm', 54), v('muslo_mm', 14)) + gm(v('muslo_mm', 14))
  const pierna = suave([[0.026, 0.06], [0.03, 0.12], [rp * 0.86, 0.22], [rp, 0.31], [rp * 0.78, 0.42], [0.05, 0.48], [rm * 0.72, 0.56], [rm, 0.68], [rm * 1.06, 0.8], [rm * 1.04, 0.9], [rm * 0.7, 0.97]], 10)
  ;[-1, 1].forEach(sd => { const x = 0.088 * sd
    ;[['PAN', 0.06, 0.48], ['MUS', 0.48, 0.97]].forEach(([id, a, b]) => { const m = zona(tramo(pierna, a, b), 1, id); m.position.x = x; g.add(m) })
    const pie = neutro(new T.SphereGeometry(0.05, 24, 16)); pie.scale.set(0.85, 0.5, 2.1); pie.position.set(x, 0.035, 0.05); g.add(pie) })
  const rc = r(v('cadera_cm', 98)) * 0.93, ra = r(v('cintura_cm', 82)) * 0.95, rt = Math.max(ra * 1.2, 0.16)
  const tronco = suave([[0.11, 0.84], [rc * 0.95, 0.88], [rc, 0.94], [rc * 0.96, 1.0], [ra * 1.02, 1.05], [ra, 1.1], [ra * 1.04, 1.16], [rt * 0.98, 1.24], [rt, 1.32], [rt * 1.02, 1.38], [rt * 0.9, 1.43], [0.12, 1.47], [0.065, 1.5]], 10)
  ;[['CAD', 0.84, 1.03], ['ABD', 1.03, 1.19], ['TRO', 1.19, 1.5]].forEach(([id, a, b]) => g.add(zona(tramo(tronco, a, b), 0.66, id)))
  const cue = neutro(lathe(suave([[0.07, 1.48], [0.054, 1.53], [0.052, 1.57], [0.06, 1.6]], 6))); cue.scale.z = 0.9; g.add(cue)
  const cab = neutro(new T.SphereGeometry(0.095, 40, 28)); cab.scale.set(0.86, 1.12, 0.98); cab.position.y = 1.68; g.add(cab)
  const rb = pc(v('brazo_cm', 31), v('triceps_mm', 10)) + gm(v('triceps_mm', 10))
  const brazo = suave([[0.05, 0], [rb * 1.02, 0.06], [rb, 0.13], [rb * 0.84, 0.22], [0.042, 0.29], [0.044, 0.36], [0.04, 0.44], [0.03, 0.53], [0.024, 0.56]], 10)
  ;[-1, 1].forEach(sd => { const a = new T.Group(); a.position.set(0.175 * sd, 1.41, 0); a.rotation.z = Math.PI + sd * 0.13
    const m = zona(tramo(brazo, 0, 0.3), 1, 'BRA'); a.add(m); a.add(neutro(lathe(tramo(brazo, 0.3, 0.56))))
    const mano = neutro(new T.SphereGeometry(0.036, 20, 14)); mano.scale.set(0.7, 1.45, 0.45); mano.position.y = 0.6; a.add(mano)
    const hom = new T.Mesh(new T.SphereGeometry(rb * 1.08, 28, 18), m.material); hom.position.y = 0.01; hom.scale.set(1, 0.85, 1); hom.userData.seg = 'BRA'; B3.partes.push(hom); a.add(hom)
    g.add(a) })
  g.rotation.y = 0; g.updateMatrixWorld(true); B3.anc = {}
  B3.partes.forEach(m => { const c = new T.Box3().setFromObject(m).getCenter(new T.Vector3()); c.y -= g.position.y; (B3.anc[m.userData.seg] = B3.anc[m.userData.seg] || []).push(c) })
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

function tablero(e, b, mt){
  const ST = [['% GRASA', 'porcentaje_grasa', 'PTS', '%', -1], ['MASA GRASA', 'masa_grasa', 'KG', 'KG', -1], ['MÚSCULO', 'masa_muscular_kg', 'KG', 'KG', 1], ['PESO', 'peso_kg', 'KG', 'KG', 0]]
  const it = ST.map(([l, k, ud, uv, sn], i) => { const v = val(e, k), bv = val(b, k), d = v != null && bv != null ? v - bv : null, tn = d != null ? tono(d, sn) : 'nd'
    const x = d != null ? d : v, pc = d != null ? Math.abs(pct(v, bv) || 0) : null, w = pc != null ? Math.max(6, Math.min(100, pc * 9)) : 0
    return '<div class="kdTb2__s kdT-' + tn + '" style="--d:' + (0.25 + i * 0.12).toFixed(2) + 's"><span class="kdK">' + l + '</span>' +
      (x != null ? '<b>' + (d != null ? (d > 0.05 ? '+' : d < -0.05 ? '−' : '±') : '') + '<span data-cnt="' + Math.abs(x) + '">' + f1(Math.abs(x)) + '</span><i>' + (d != null ? ud : uv) + '</i></b>' : '<b>—</b>') +
      (d != null ? '<em><s class="kdBg-' + tn + '" style="width:' + w.toFixed(0) + '%"></s></em><small>' + (S.cmp === 'ant' ? 'VS ANTERIOR' : 'VS INICIO') + '</small>' : '<small>' + (S.i ? 'SIN DATO PREVIO' : 'LÍNEA BASE') + '</small>') + '</div>' })
  let centro
  if (mt && mt.avance != null){ const R = 54, C = 2 * Math.PI * R, a = mt.avance
    centro = '<svg viewBox="0 0 140 140" class="kdRing"><circle cx="70" cy="70" r="' + R + '" class="kdRing__bg"/><circle cx="70" cy="70" r="' + R + '" class="kdRing__fg" stroke-dasharray="' + C.toFixed(1) + '" stroke-dashoffset="' + (C * (1 - a)).toFixed(1) + '" style="--c:' + C.toFixed(1) + '"/>' +
      '<text x="70" y="70" text-anchor="middle" class="kdRing__n">' + Math.round(a * 100) + '%</text><text x="70" y="90" text-anchor="middle" class="kdRing__l">DE TU META</text></svg>'
  } else centro = '<div class="kdTb2__c"><b>' + (S.i + 1) + '</b><span>' + (S.i ? 'EVALUACIONES' : 'LÍNEA BASE') + '</span></div>'
  const pie = mt ? '<div class="kdTb2__m"><span class="kdK">META 6 MESES' + (S.o.programa ? ' · ' + esc(String(S.o.programa).toUpperCase()) : '') + '</span><b>' + esc(mt.texto) + '</b>' +
    (mt.avance != null ? '<small>Llevas ' + fx(mt.hecho) + ' kg · ' + (mt.avance >= 1 ? 'meta cumplida' : 'faltan ' + f1(Math.abs(mt.valor - mt.hecho)) + ' kg') + '</small>' : '<small>Desde la próxima evaluación verás tu avance.</small>') + '</div>' : ''
  return '<div class="kdTb2"><div class="kdTb2__g"><div class="kdTb2__col">' + it[0] + it[1] + '</div><div class="kdTb2__ce">' + centro + '</div><div class="kdTb2__col kdTb2__col--d">' + it[2] + it[3] + '</div></div>' + pie + '</div>'
}
function compActual(){
  const e = actual(), pe = n(e.peso_kg); if (!pe) return ''
  const arr = [['GRASA', masaGrasa(e), '#E07A3F', '#FFFFFF'], ['MÚSCULO', n(e.masa_muscular_kg), '#2BB3C0', '#04363B'], ['ÓSEA', n(e.masa_osea_kg), '#8F8D86', '#FFFFFF'], ['RESIDUAL', n(e.masa_residual_kg), '#CFCDC7', '#121212']].filter(x => x[1] != null)
  const resto = pe - arr.reduce((a, x) => a + x[1], 0); if (arr.length < 4 && resto > 0.2) arr.push(['RESTO', resto, '#E2E0DA', '#121212'])
  const K = typeof KC !== 'undefined' ? KC : null, sx = S.o.sexo || e.sexo_eval
  const cg = K && K.clasGrasa ? K.clasGrasa(e.porcentaje_grasa, sx) : null, cf = K && K.clasFFMI ? K.clasFFMI(e.ffmi_norm, sx) : null, fc = K && K.formaCorporal ? K.formaCorporal(e.porcentaje_grasa, e.ffmi_norm, sx) : null
  const cl = [fc ? ['FORMA CORPORAL', fc.label, fc.msg] : null, cg ? ['NIVEL DE GRASA', cg, f1(e.porcentaje_grasa) + ' % de grasa'] : null, cf ? ['ÍNDICE MUSCULAR', cf, 'FFMI ' + f1(e.ffmi_norm)] : null,
    n(e.edad_biologica) != null ? ['EDAD BIOLÓGICA', Math.round(e.edad_biologica) + ' AÑOS', n(e.edad_eval) != null ? 'Edad real ' + e.edad_eval + ' años' : ''] : null,
    n(e.ict) != null ? ['CINTURA / TALLA', String(e.ict).replace('.', ','), e.ict < 0.5 ? 'En rango saludable (< 0,5)' : 'Sobre 0,5: foco en cintura'] : null].filter(Boolean)
  return '<section class="kdCard kdCa"><div class="kdCa__h"><span class="kdK">TU COMPOSICIÓN CORPORAL · ' + fecha(e.fecha) + '</span><b><span data-cnt="' + pe + '">' + f1(pe) + '</span><i>kg</i></b></div>' +
    '<div class="kdCa__bar">' + arr.map((x, i) => '<i style="flex:' + x[1].toFixed(2) + ';background:' + x[2] + ';color:' + x[3] + ';animation-delay:' + (0.15 + i * 0.18).toFixed(2) + 's"><span>' + (x[1] / pe > 0.1 ? Math.round(x[1] / pe * 100) + '%' : '') + '</span></i>').join('') + '</div>' +
    '<div class="kdCa__g">' + arr.map(x => '<div><span class="kdK"><i style="background:' + x[2] + '"></i>' + x[0] + '</span><b><span data-cnt="' + x[1] + '">' + f1(x[1]) + '</span><i>kg</i></b><small><span data-cnt="' + Math.round(x[1] / pe * 100) + '" data-d="0">' + Math.round(x[1] / pe * 100) + '</span> %</small></div>').join('') + '</div>' +
    '</section>' + (cl.length ? '\u0000' + '<section class="kdCard"><span class="kdK">EXTRA · CLASIFICACIÓN DE TU CUERPO</span><div class="kdCl">' + cl.map(c => '<div><span class="kdK">' + c[0] + '</span><b>' + esc(c[1]) + '</b><small>' + esc(c[2]) + '</small></div>').join('') + '</div></section>' : '')
}
function contar(){
  if (!ov) return; const els = [...ov.querySelectorAll('[data-cnt]')].filter(x => x.dataset.cnt !== ''); if (!els.length) return
  const t0 = performance.now(), D = 1400
  const paso = now => { const k = Math.min(1, Math.max(0, (now - t0 - 120) / D)), e = 1 - Math.pow(1 - k, 3)
    els.forEach(x => { const v = +x.dataset.cnt * e; x.textContent = x.dataset.d === '0' ? String(Math.round(v)) : f1(v) })
    if (k < 1 && els[0].isConnected) requestAnimationFrame(paso) }
  requestAnimationFrame(paso)
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
    return '<div class="kdKp kdT-' + tn + '"><span class="kdK">' + l + '</span><b><span data-cnt="' + (v != null ? v : '') + '">' + f1(v) + '</span><i>' + u + '</i></b>' +
      '<em>' + (d != null ? fx(d) + ' ' + u + (pc != null && u !== '%' ? ' · ' + fx(pc) + ' %' : '') : S.i ? 'sin dato previo' : 'línea base') + '</em>' + sp + '</div>' }).join('')
  const ring = mt && mt.avance != null ? (() => { const R = 54, C = 2 * Math.PI * R, a = mt.avance
      return '<div class="kdMeta"><svg viewBox="0 0 140 140" class="kdRing"><circle cx="70" cy="70" r="' + R + '" class="kdRing__bg"/><circle cx="70" cy="70" r="' + R + '" class="kdRing__fg" stroke-dasharray="' + C.toFixed(1) + '" stroke-dashoffset="' + (C * (1 - a)).toFixed(1) + '" style="--c:' + C.toFixed(1) + '"/>' +
        '<text x="70" y="70" text-anchor="middle" class="kdRing__n">' + Math.round(a * 100) + '%</text><text x="70" y="90" text-anchor="middle" class="kdRing__l">DE TU META</text></svg>' +
        '<div><span class="kdK">META 6 MESES · ' + esc(String(S.o.programa || '').toUpperCase() || 'KOACH') + '</span><b>' + esc(mt.texto) + '</b><small>Llevas ' + fx(mt.hecho) + ' kg de ' + (mt.tipo === 'GRASA' ? 'grasa' : 'músculo') + '. ' +
        (a >= 1 ? 'Meta cumplida: toca fijar la siguiente.' : 'Te falta ' + f1(Math.abs(mt.valor - mt.hecho)) + ' kg. Pégate al plan.') + '</small></div></div>' })()
    : mt ? '<div class="kdMeta kdMeta--t"><div><span class="kdK">META 6 MESES</span><b>' + esc(mt.texto) + '</b><small>' + (S.i ? '' : 'Desde la próxima evaluación verás tu avance hacia la meta.') + '</small></div></div>' : ''
  const CA = S.inline ? compActual().split('\u0000') : []
  const opts = S.evs.map((x, i) => '<option value="' + i + '"' + (i === S.i ? ' selected' : '') + '>' + fecha(x.fecha) + (x.estado === 'borrador' ? ' · BORRADOR' : '') + '</option>').join('')
  return (S.inline ? '<div class="kdBar kdBar--in"><label class="kdSel">EVALUACIÓN<select data-act="ev">' + opts + '</select></label>' +
    (S.i > 0 ? '<div class="kdSeg" role="group" aria-label="Comparar con"><button type="button" data-cmp="ini" aria-pressed="' + (S.cmp === 'ini') + '">VS INICIO</button><button type="button" data-cmp="ant" aria-pressed="' + (S.cmp === 'ant') + '">VS ANTERIOR</button></div>' : '') + '</div>' :
    '<div class="kdBar"><span class="kdBar__l">KOACH <em>DIAGNÓSTICO</em></span>' +
    '<label class="kdSel">EVALUACIÓN<select data-act="ev">' + opts + '</select></label>' +
    (S.i > 0 ? '<div class="kdSeg" role="group" aria-label="Comparar con"><button type="button" data-cmp="ini" aria-pressed="' + (S.cmp === 'ini') + '">VS INICIO</button><button type="button" data-cmp="ant" aria-pressed="' + (S.cmp === 'ant') + '">VS ANTERIOR</button></div>' : '') +
    '<button type="button" class="kdX" data-act="cerrar" aria-label="Cerrar diagnóstico">CERRAR ✕</button></div>') +
    '<div class="kdIn">' +
    '<section class="kdHero"><div><span class="kdK">EVALUACIÓN N° ' + (S.i + 1) + ' · ' + fecha(e.fecha) + (S.o.programa ? ' · ' + esc(String(S.o.programa).toUpperCase()) : '') + '</span>' +
      '<h1 class="kdH1">' + nom + '</h1>' + (S.inline ? '' : '<p class="kdFr">' + esc(frase) + '</p>' + (e.nota_socio ? '<blockquote class="kdNota">' + esc(e.nota_socio) + '<cite>NUTRICIÓN KOACH</cite></blockquote>' : '')) + '</div>' + (S.inline ? '' : ring) + '</section>' +
    (S.inline ? tablero(e, b, mt) + CA[0] : '<section class="kdKps">' + kpis + '</section>') +
    '<section class="kdGrid">' +
      '<div class="kdCard kdCard--body"><span class="kdK">CÓMO CAMBIÓ CADA ZONA · TOCA UNA ZONA</span><div class="kdBodyW"><div id="kdBody">' + cuerpo(segs) + '</div><div id="kdSp">' + panelSeg(segs) + '</div></div>' +
        '<div class="kdLeg"><span><i style="background:' + COL.mej + '"></i>MEJORA</span><span><i style="background:' + COL.est + '"></i>ESTABLE</span><span><i style="background:' + COL.ret + '"></i>FOCO</span></div></div>' +
      (S.inline ? '' : '<div class="kdCard"><span class="kdK">DE QUÉ ESTÁ HECHO TU PESO</span>' + composicion() + '</div>') +
    '</section>' +
    (S.inline ? '' : '<section class="kdCard kdCard--ev"><span class="kdK">TU EVOLUCIÓN</span><div id="kdEv">' + evolucion() + '</div></section>') +
    (S.inline ? '<section class="kdKps">' + kpis + '</section>' + (CA[1] || '') : '') +
    (S.inline ? '<section class="kdCard kdRes"><span class="kdK">RESUMEN DE TU EVALUACIÓN</span><p class="kdFr">' + esc(frase) + '</p>' + (e.nota_socio ? '<blockquote class="kdNota">' + esc(e.nota_socio) + '<cite>NUTRICIÓN KOACH</cite></blockquote>' : '') + '</section>' : '') +
    (lg.length ? '<section class="kdLog"><span class="kdK">LOGROS' + (pn ? ' DE ' + pn.toUpperCase() : '') + '</span><div class="kdLog__g">' + lg.map((x, i) => '<div class="kdBadge" style="--d:' + (i * 70) + 'ms"><b>' + x[0] + '</b><span>' + x[1] + '</span><small>' + x[2] + '</small></div>').join('') + '</div></section>' : '') +
    (S.inline && S.i > 0 ? '<section class="kdCard kdCard--ev"><span class="kdK">EXTRA · TU EVOLUCIÓN ENTRE EVALUACIONES</span><div id="kdEv">' + evolucion() + '</div></section>' : '') +
    '<section class="kdCard"><span class="kdK">TODO LO QUE MEDIMOS · PROTOCOLO ISAK</span>' + tabla() + '</section>' +
    '<p class="kdPie">' + VERSION + ' · Estimaciones antropométricas ISAK: orientan el trabajo de nutrición y entrenamiento, no son un diagnóstico médico.</p></div>'
}

let ov = null
function pintar(){ if (!ov) return; if (S.inline){ ov.innerHTML = html(); b3Enlazar(); anilloAnim(); contar(); return enlazarChart() } const y = ov.scrollTop; ov.innerHTML = html(); ov.scrollTop = y; enlazarChart() }
function repSeg(){ const e = actual(), b = base(), segs = SEG.map(s => segmento(s, e, b)); if (S.inline && B3.r && ov.querySelector('#kd3')){ b3Color(); b3Tag(segs) } else { ov.querySelector('#kdBody').innerHTML = cuerpo(segs); b3Enlazar() } ov.querySelector('#kdSp').innerHTML = panelSeg(segs) }
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
.kd3{position:relative;height:clamp(340px,92vw,460px);margin:6px -6px 0;border-radius:18px;background:radial-gradient(70% 55% at 50% 48%,#FFFFFF 0%,#EFEEEA 70%,#E4E3DF 100%);overflow:hidden;touch-action:pan-y}
.kd3__cv{position:absolute;inset:0;width:100%!important;height:100%!important;display:block;cursor:grab}
.kd3__tag{position:absolute;left:12px;top:12px;z-index:2;display:flex;align-items:center;gap:8px;padding:8px 12px;border-radius:999px;background:#121212;color:#F4F3F0;font:700 9.5px var(--font-mono,monospace);letter-spacing:.12em;pointer-events:none}
.kd3__tag i{width:9px;height:9px;border-radius:50%;background:#2BB3C0;box-shadow:0 0 10px #2BB3C0}
.kd3__tag b{color:#7FD6DD;font-weight:700}
.kd3__h{position:absolute;left:0;right:0;bottom:10px;z-index:2;text-align:center;font:700 8.5px var(--font-mono,monospace);letter-spacing:.16em;color:#8E8D88;pointer-events:none}
.kd--in .kdSegs button[aria-pressed="true"]{background:#121212;color:#F4F3F0}
.kd--in .kdSegs button[aria-pressed="true"] i{background:#2BB3C0!important}
.kd--in .kdBar.kdBar--in{flex-wrap:wrap;gap:6px}.kd--in .kdBar--in .kdSeg{margin-left:auto}
.kd--in .kdH1{font-size:clamp(22px,6.4vw,30px)!important;line-height:1;margin:6px 0 8px}
.kd--in .kdFr{font-size:16px}
.kdCa{margin-top:14px}
.kd--in .kdRingW{margin-top:14px}
.kdCa__h{display:flex;justify-content:space-between;align-items:flex-end;gap:10px}
.kdCa__h b{font:700 34px/1 var(--font-mono,monospace);letter-spacing:-.05em}.kdCa__h b i{font-size:13px;font-style:normal;letter-spacing:0;color:#6B6A65;margin-left:3px}
.kdCa__bar{display:flex;gap:3px;height:46px;margin-top:14px}
.kdCa__bar i{min-width:0;border-radius:8px;display:flex;align-items:center;justify-content:center;overflow:hidden;animation:kdGrow 1.3s cubic-bezier(.2,.8,.2,1) both}
.kdCa__bar i span{font:700 11px var(--font-mono,monospace);white-space:nowrap;animation:kdFade .4s ease 1.2s both}
@keyframes kdGrow{from{flex-grow:0;opacity:.3}}@keyframes kdFade{from{opacity:0}}
.kdCa__g{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px 16px;margin-top:16px}
.kdCa__g .kdK{display:flex;align-items:center;gap:6px}.kdCa__g .kdK i{width:9px;height:9px;border-radius:2px}
.kdCa__g b{display:block;margin-top:4px;font:700 24px/1 var(--font-mono,monospace);letter-spacing:-.04em}.kdCa__g b i{font-size:11px;font-style:normal;color:#6B6A65;margin-left:3px;letter-spacing:0}
.kdCa__g small{font:400 11px var(--font-mono,monospace);color:#6B6A65}
.kdCa .kdCl{margin-top:16px}
@media (prefers-reduced-motion:reduce){.kdCa__bar i,.kdCa__bar i span{animation:none}}
.kd--in .kd3{height:clamp(440px,118vw,560px);margin:8px -8px 0}
.kd3__ln{position:absolute;inset:0;width:100%;height:100%;z-index:1;pointer-events:none;overflow:visible}
.kd3__ln path{fill:none;stroke:#121212;stroke-width:1;opacity:.45}.kd3__ln path.on{stroke:#2BB3C0;stroke-width:2;opacity:1}
.kd3__ln circle{fill:#121212}.kd3__ln circle.on{fill:#2BB3C0}
.kd3__p{position:absolute;z-index:2;max-width:31%;padding:6px 8px;border:0;border-radius:10px;background:rgba(251,250,248,.82);-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px);color:#121212;cursor:pointer;font-family:var(--font-mono,monospace);animation:kdFade .5s ease both}
.kd3__p--i{left:8px;text-align:left}.kd3__p--d{right:8px;text-align:right}
.kd3__p span{display:block;font:700 8.5px var(--font-mono,monospace);letter-spacing:.14em;color:#5E5D59}
.kd3__p b{display:block;margin-top:3px;font:700 22px/1 var(--font-mono,monospace);letter-spacing:-.04em}.kd3__p b span{display:inline;font:inherit;color:inherit;letter-spacing:inherit}.kd3__p b i{font-size:10px;font-style:normal;margin-left:2px;letter-spacing:0;color:#6B6A65}
.kd3__p small{display:block;margin-top:2px;font:400 8px var(--font-mono,monospace);letter-spacing:.08em;color:#8E8D88;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.kd3__p em{display:block;margin-top:3px;font:700 10px var(--font-mono,monospace);font-style:normal;letter-spacing:.04em;color:#8E8D88}
.kd3__p.on{background:#121212;color:#F4F3F0;box-shadow:0 0 0 2px #2BB3C0,0 8px 20px rgba(43,179,192,.3)}.kd3__p.on>span,.kd3__p.on b i,.kd3__p.on small{color:#A7A9AE}.kd3__p.on b span{color:#F4F3F0}.kd3__p.on em.kdT-mej{color:#7FD6DD}.kd3__p.on em.kdT-ret{color:#F2A273}
.kd3__p:nth-of-type(2){animation-delay:.08s}.kd3__p:nth-of-type(3){animation-delay:.16s}.kd3__p:nth-of-type(4){animation-delay:.24s}.kd3__p:nth-of-type(5){animation-delay:.32s}.kd3__p:nth-of-type(6){animation-delay:.4s}
.kdTb2{margin-top:12px;padding:18px 14px 16px;border-radius:22px;background:#0B0B0B radial-gradient(90% 70% at 50% 35%,#1E1E1E 0%,#0B0B0B 70%);color:#F4F3F0;box-shadow:0 18px 40px rgba(0,0,0,.25)}
.kdTb2__g{display:grid;grid-template-columns:minmax(0,1fr) auto minmax(0,1fr);gap:10px;align-items:center}
.kdTb2__col{display:flex;flex-direction:column;gap:14px}.kdTb2__col--d{text-align:right}
.kdTb2__s{animation:kdFade .5s ease var(--d) both}
.kdTb2__s .kdK{color:#8E8D88;font-size:8.5px}
.kdTb2__s b{display:block;margin-top:4px;font:700 22px/1 var(--font-mono,monospace);letter-spacing:-.04em;color:#F4F3F0}.kdTb2__s b span{font:inherit;color:inherit}.kdTb2__s b i{font-size:9px;font-style:normal;margin-left:3px;letter-spacing:.06em;color:#8E8D88}
.kdTb2__s.kdT-mej b{color:#7FD6DD}.kdTb2__s.kdT-ret b{color:#F2A273}
.kdTb2__s em{display:block;height:4px;margin-top:6px;border-radius:2px;background:#262626;overflow:hidden}.kdTb2__col--d em{display:flex;justify-content:flex-end}
.kdTb2__s em s{display:block;height:100%;text-decoration:none;animation:nuW2 1.4s cubic-bezier(.2,.8,.2,1) var(--d) both}
@keyframes nuW2{from{width:0}}
.kdTb2__s small{display:block;margin-top:4px;font:700 7.5px var(--font-mono,monospace);letter-spacing:.14em;color:#5E5D59}
.kdTb2 .kdRing{width:clamp(112px,32vw,140px);height:auto}
.kdTb2__c{width:112px;height:112px;border-radius:50%;border:10px solid #262626;display:flex;flex-direction:column;align-items:center;justify-content:center}.kdTb2__c b{font:800 34px/1 var(--font-display,Arial)}.kdTb2__c span{font:700 7.5px var(--font-mono,monospace);letter-spacing:.14em;color:#8E8D88;margin-top:4px}
.kdTb2__m{margin-top:14px;padding-top:12px;border-top:1px solid #262626;text-align:center}.kdTb2__m .kdK{color:#8E8D88}.kdTb2__m b{display:block;margin-top:4px;font:900 16px/1.1 var(--font-display,Arial);text-transform:uppercase}.kdTb2__m small{display:block;margin-top:4px;font:400 11px var(--font-mono,monospace);color:#A7A9AE}
.kd--in .kdHero{margin-bottom:0}.kd--in .kdHero .kdH1{margin-bottom:0}
.kd--in .kdRes .kdFr{margin:8px 0 0;font-size:15px}
.kd.kd--in{position:static;inset:auto;z-index:auto;overflow:visible;background:transparent;animation:none}
.kd--in .kdBar--in{position:static;min-height:0;padding:8px 8px 8px 16px;border-radius:20px;background:#121212;justify-content:space-between;flex-wrap:nowrap}
.kd--in section.kdCard{background:#FBFAF8!important;border-radius:20px!important;padding:18px 18px 20px!important;border:1px solid rgba(18,18,18,.06)!important;box-shadow:0 14px 34px rgba(18,18,18,.10)!important}
.kd--in .kdPie{color:#2A2A2A}
.kd--in .kdHero .kdK,.kd--in .kdLog>.kdK{color:#2A2A2A}
@media (max-width:420px){.kd--in .kdBar--in .kdSel{font-size:0;gap:0;margin-left:0}.kd--in .kdSeg button{padding:0 10px}}
.kd--in .kdBar--in .kdSel{margin-left:10px;font-size:9.5px;gap:8px}
.kd--in .kdIn{padding:12px 0 8px}
.kd--in .kdNota{border-left-color:#121212}
.kd--in .kdT-mej{color:#13848F}.kd--in .kdT-ret{color:#C2602F}.kd--in .kdBg-mej{background:#2BB3C0}.kd--in .kdBg-ret{background:#E07A3F}
.kd--in .kdRing__fg{stroke:#2BB3C0;filter:drop-shadow(0 0 6px rgba(43,179,192,.55));animation:kdRing 1.8s cubic-bezier(.2,.7,.2,1) .15s both}.kd--in .kdBadge b{color:#F4F3F0}.kd--in .kdSeg button{white-space:nowrap}
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
  el.innerHTML = html(); b3Enlazar(); anilloAnim(); contar(); enlazarChart(); return true
}
const KDG = { VERSION, abrir, cerrar, montar, _segmento: segmento, _S: S, _B3: B3 }
if (typeof window !== 'undefined') window.KDG = KDG
if (typeof module !== 'undefined') module.exports = KDG
})()
