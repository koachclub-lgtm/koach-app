/* ═══════════════════════════════════════════════════════════════
   KOACH COMPOSICIÓN · Motor de composición corporal (ISAK)
   Absorbe el "motor validado v2.0" de Nutrición Pro (koach-nutricionv2) en el ecosistema KOACH.
   · % grasa: Durnin & Womersley 1974 (4 pliegues) + Siri 1961
   · Masa muscular: Lee 2000 (circunferencias corregidas brazo/muslo/pantorrilla)
   · FFMI: Kouri 1995 (normalizado a 1,80 m) · ICC · ICT
   · Masa ósea: referencia poblacional (declarada como tal) · residual = remanente
   Regla nueva respecto de Nutrición Pro: un dato que falta NUNCA se rellena con un valor
   poblacional y se guarda como medición. Si falta, queda null y se avisa.
   Sin dependencias. Funciones puras. Vanilla JS.
   ═══════════════════════════════════════════════════════════════ */
(function(root){
'use strict'
const VERSION = 'koach-composicion@1.0.0'
const num = v => { const n = typeof v === 'string' ? parseFloat(v.replace(',', '.')) : +v; return Number.isFinite(n) && n > 0 ? n : null }
const r1 = v => v == null ? null : Math.round(v * 10) / 10
const r2 = v => v == null ? null : Math.round(v * 100) / 100
const esH = s => /^h/i.test(String(s || ''))   // 'hombre' | 'Hombre' | 'H'

// Durnin & Womersley 1974 · coeficientes por sexo y tramo de edad
function coefsDW(edad, sexo){
  const t = esH(sexo)
    ? [[20,1.1620,0.0630],[30,1.1631,0.0632],[40,1.1422,0.0544],[50,1.1620,0.0700],[Infinity,1.1715,0.0779]]
    : [[20,1.1549,0.0678],[30,1.1599,0.0717],[40,1.1423,0.0632],[50,1.1333,0.0612],[Infinity,1.1339,0.0645]]
  const f = t.find(([max]) => edad < max) || t[t.length - 1]
  return { C: f[1], M: f[2] }
}
const DW4 = ['biceps','triceps','subescapular','crestaIliaca']
const SUMA6 = ['triceps','subescapular','supraespinal','abdominal','muslo','pantorrilla']
const SUMA8 = SUMA6.concat(['biceps','crestaIliaca'])
const NOMBRE = { biceps:'bíceps', triceps:'tríceps', subescapular:'subescapular', crestaIliaca:'cresta ilíaca',
  supraespinal:'supraespinal', abdominal:'abdominal', muslo:'muslo', pantorrilla:'pantorrilla' }

function suma(pl, sitios){ return sitios.every(k => num(pl[k]) != null) ? sitios.reduce((s,k) => s + num(pl[k]), 0) : null }

function grasaDW4(pl, edad, sexo){
  const faltan = DW4.filter(k => num(pl[k]) == null)
  if (faltan.length) return { pct: null, faltan }
  const s4 = suma(pl, DW4), { C, M } = coefsDW(edad || 25, sexo)
  const BD = C - M * Math.log10(s4)
  return { pct: Math.max(3, Math.min(60, 495 / BD - 450)), sum4: s4, densidad: BD }
}

function musculoLee(talla, edad, sexo, pl, pe){
  const PB = num(pe.brazo), PM = num(pe.muslo), PG = num(pe.pantorrilla)
  if (!PB || !PM || !PG || !talla) return { kg: null }
  const CAB = PB - Math.PI * ((num(pl.triceps) || 0) / 10)
  const CAM = PM - Math.PI * ((num(pl.muslo) || 0) / 10)
  const CAP = PG - Math.PI * ((num(pl.pantorrilla) || 0) / 10)
  const MM = talla * (0.00744*CAB*CAB + 0.00088*CAM*CAM + 0.00441*CAP*CAP) / 100 + 2.4*(esH(sexo) ? 1 : 0) - 0.048*(edad || 25) + 7.8
  return { kg: Math.max(0, MM), CAB, CAM, CAP }
}

function clasGrasa(pct, sexo){
  if (pct == null) return null
  const r = esH(sexo) ? [['ESENCIAL',5],['ATLETA',13],['FITNESS',17],['ACEPTABLE',24],['ELEVADO',100]]
                      : [['ESENCIAL',13],['ATLETA',20],['FITNESS',24],['ACEPTABLE',31],['ELEVADO',100]]
  for (const [l, m] of r) if (pct < m) return l
  return null
}
function clasFFMI(n, sexo){
  if (n == null) return null
  const t = esH(sexo) ? [['BAJO EL PROMEDIO',18],['PROMEDIO',20],['SOBRE EL PROMEDIO',22],['EXCELENTE',24],['SUPERIOR',25],['FUERA DE RANGO NATURAL',99]]
                      : [['BAJO EL PROMEDIO',15],['PROMEDIO',17],['SOBRE EL PROMEDIO',19],['EXCELENTE',21],['SUPERIOR',22],['FUERA DE RANGO NATURAL',99]]
  for (const [l, m] of t) if (n < m) return l
  return null
}

// Edad biológica (biomarcador KOACH de Nutrición Pro) · requiere % grasa medido y FFMI
function edadBiologica(edad, sexo, pctGrasa, ffmiNorm, icc, ict){
  if (edad == null || pctGrasa == null || ffmiNorm == null) return null
  const H = esH(sexo); let s = 0
  const g = H ? { fit:14, acep:18, ob:25 } : { fit:21, acep:25, ob:32 }
  s += pctGrasa < g.fit - 6 ? -6 : pctGrasa < g.fit ? -3 : pctGrasa < g.acep ? 0 : pctGrasa < g.ob ? 5 : 10
  const f = H ? { sup:22, norm:20, bajo:18 } : { sup:19, norm:17, bajo:15 }
  s += ffmiNorm >= f.sup ? -4 : ffmiNorm >= f.norm ? -1 : ffmiNorm >= f.bajo ? 3 : 6
  if (icc != null){ const u = H ? 0.95 : 0.85; s += icc < u - 0.12 ? -3 : icc < u ? 0 : icc < u + 0.08 ? 4 : 8 }
  if (ict != null){ s += ict < 0.4 ? -2 : ict < 0.5 ? 0 : ict < 0.58 ? 3 : 7 }
  return Math.max(16, Math.min(75, edad + s))
}

/** Calcula una evaluación completa.
 *  input: { peso, talla, edad, sexo, pliegues:{triceps,biceps,subescapular,crestaIliaca,supraespinal,abdominal,muslo,pantorrilla},
 *           perimetros:{brazo,muslo,pantorrilla,cintura,cadera} } */
function calcular(input){
  const peso = num(input.peso), talla = num(input.talla), edad = num(input.edad), sexo = input.sexo
  const pl = input.pliegues || {}, pe = input.perimetros || {}
  const avisos = []
  if (!peso) avisos.push('Falta el peso')
  if (!talla) avisos.push('Falta la talla')
  if (!edad) avisos.push('Falta la edad (fecha de nacimiento en el perfil)')
  if (!sexo) avisos.push('Falta el sexo en el perfil (cambia los coeficientes)')
  const g = grasaDW4(pl, edad, sexo)
  if (g.pct == null) avisos.push('Faltan pliegues para % grasa: ' + g.faltan.map(k => NOMBRE[k]).join(', '))
  const m = musculoLee(talla, edad, sexo, pl, pe)
  if (m.kg == null) avisos.push('Faltan perímetros de brazo, muslo y pantorrilla para masa muscular')

  const grasaKg = peso && g.pct != null ? peso * g.pct / 100 : null
  const oseaKg = peso ? peso * (esH(sexo) ? 0.15 : 0.12) : null
  const residualKg = peso && grasaKg != null && m.kg != null ? Math.max(0, peso - grasaKg - m.kg - oseaKg) : null
  let calidad = null
  if (residualKg != null){ const rp = residualKg / peso * 100
    if (rp < 10) calidad = 'Grasa + músculo resultan muy altos en conjunto: revisa las mediciones'
    else if (rp > 45) calidad = 'Grasa + músculo resultan muy bajos en conjunto: revisa las mediciones' }

  const h = talla ? talla / 100 : null
  const ffm = peso && g.pct != null ? peso * (1 - g.pct / 100) : null
  const ffmi = ffm != null && h ? ffm / (h * h) : null
  const ffmiNorm = ffmi != null ? ffmi + 6.1 * (1.8 - h) : null
  const cin = num(pe.cintura), cad = num(pe.cadera)
  const icc = cin && cad ? cin / cad : null
  const ict = cin && talla ? cin / talla : null
  const pct = v => v != null && peso ? r1(v / peso * 100) : null

  return {
    version: VERSION,
    completo: g.pct != null && m.kg != null,
    grasa: { pct: r1(g.pct), kg: r2(grasaKg), medida: g.pct != null, clase: clasGrasa(g.pct, sexo), sum4: g.sum4 != null ? r1(g.sum4) : null },
    muscular: { kg: r2(m.kg), pct: pct(m.kg), medida: m.kg != null },
    osea: { kg: r2(oseaKg), pct: pct(oseaKg), referencial: true },
    residual: { kg: r2(residualKg), pct: pct(residualKg) },
    suma6: suma(pl, SUMA6) != null ? r1(suma(pl, SUMA6)) : null,
    suma8: suma(pl, SUMA8) != null ? r1(suma(pl, SUMA8)) : null,
    ffmi: r2(ffmi), ffmiNorm: r2(ffmiNorm), ffmiClase: clasFFMI(ffmiNorm, sexo),
    imc: peso && h ? r1(peso / (h * h)) : null,
    icc: icc != null ? r2(icc) : null, ict: ict != null ? r2(ict) : null,
    edadBiologica: edadBiologica(edad, sexo, g.pct, ffmiNorm, icc, ict),
    avisos, calidad
  }
}

// Pauta sugerida (punto de partida para nutrición; siempre editable) · Mifflin-St Jeor + reparto por programa
function sugerirPauta({ peso, talla, edad, sexo, actividad, programa }){
  peso = num(peso); talla = num(talla); edad = num(edad)
  if (!peso || !talla || !edad) return null
  const tmb = esH(sexo) ? 10*peso + 6.25*talla - 5*edad + 5 : 10*peso + 6.25*talla - 5*edad - 161
  const f = { sedentario:1.2, ligero:1.375, moderado:1.55, activo:1.725, muyActivo:1.9 }[actividad] || 1.55
  const tdee = tmb * f, P = String(programa || '').toUpperCase()
  let kcal, prot, gr
  if (P === 'BURN'){ kcal = tdee - 400; prot = peso*2.4; gr = peso*0.9 }
  else if (P === 'STRONG'){ kcal = tdee + 350; prot = peso*2.2; gr = peso*1.0 }
  else { kcal = tdee; prot = peso*1.8; gr = peso*0.9 }
  prot = Math.round(prot); gr = Math.round(gr)
  const cho = Math.max(Math.round((kcal - prot*4 - gr*9) / 4), Math.round(peso*2))
  return { tmb: Math.round(tmb), tdee: Math.round(tdee), kcal: prot*4 + cho*4 + gr*9, proteina_g: prot, carbohidrato_g: cho, grasa_g: gr }
}

/** Fila para evaluaciones_nutricion a partir del formulario + resultado */
function aFila(input, res){
  const pl = input.pliegues || {}, pe = input.perimetros || {}
  return {
    peso_kg: num(input.peso), talla_cm: num(input.talla), edad_eval: num(input.edad) != null ? Math.round(num(input.edad)) : null,
    sexo_eval: input.sexo ? (esH(input.sexo) ? 'hombre' : 'mujer') : null,
    triceps_mm: num(pl.triceps), biceps_mm: num(pl.biceps), subescapular_mm: num(pl.subescapular), cresta_iliaca_mm: num(pl.crestaIliaca),
    supraespinal_mm: num(pl.supraespinal), abdominal_mm: num(pl.abdominal), muslo_mm: num(pl.muslo), pantorrilla_mm: num(pl.pantorrilla),
    brazo_relajado_cm: num(pe.brazo), muslo_cm: num(pe.muslo), pantorrilla_cm: num(pe.pantorrilla), cintura_cm: num(pe.cintura), cadera_cm: num(pe.cadera),
    porcentaje_grasa: res.grasa.pct, masa_grasa_kg: res.grasa.kg, grasa_medida: res.grasa.medida,
    masa_muscular_kg: res.muscular.kg, musculo_medido: res.muscular.medida,
    masa_osea_kg: res.osea.kg, masa_residual_kg: res.residual.kg,
    suma6_mm: res.suma6, suma8_mm: res.suma8, ffmi: res.ffmi, ffmi_norm: res.ffmiNorm, imc: res.imc, icc: res.icc, ict: res.ict,
    edad_biologica: res.edadBiologica, motor_version: res.version
  }
}
/** Inversa: fila → input del formulario (para editar un borrador) */
function deFila(f){
  return { peso: f.peso_kg, talla: f.talla_cm, edad: f.edad_eval, sexo: f.sexo_eval,
    pliegues: { triceps: f.triceps_mm, biceps: f.biceps_mm, subescapular: f.subescapular_mm, crestaIliaca: f.cresta_iliaca_mm,
      supraespinal: f.supraespinal_mm, abdominal: f.abdominal_mm, muslo: f.muslo_mm, pantorrilla: f.pantorrilla_mm },
    perimetros: { brazo: f.brazo_cm != null ? f.brazo_cm : f.brazo_relajado_cm, muslo: f.muslo_cm, pantorrilla: f.pantorrilla_cm, cintura: f.cintura_cm, cadera: f.cadera_cm } }
}

/** Cambio de un indicador entre evaluaciones (ordenadas por fecha asc).
 *  mejora: +1 si subir es bueno (músculo), -1 si bajar es bueno (grasa, cintura), 0 neutro (peso) */
function cambio(evs, clave, mejora){
  const conDato = (evs || []).filter(e => e && e[clave] != null)
  if (!conDato.length) return null
  const ult = conDato[conDato.length - 1], ant = conDato.length > 1 ? conDato[conDato.length - 2] : null, pri = conDato[0]
  const d = (a, b) => a && b && a !== b ? r1(+b[clave] - +a[clave]) : null
  const vsAnt = d(ant, ult), vsIni = d(pri, ult)
  const tono = x => x == null || Math.abs(x) < 0.1 || !mejora ? 'neutro' : (x * mejora > 0 ? 'mejora' : 'retroceso')
  return { actual: +ult[clave], vsAnterior: vsAnt, vsInicio: vsIni, tonoAnterior: tono(vsAnt), tonoInicio: tono(vsIni),
    fechaAnterior: ant ? ant.fecha : null, fechaInicio: pri !== ult ? pri.fecha : null, serie: conDato.map(e => ({ fecha: e.fecha, v: +e[clave] })) }
}

// Forma corporal (lógica Muscle-Fat de InBody, como en Nutrición Pro) — lenguaje para el socio, no letras técnicas
function formaCorporal(pctGrasa, ffmiNorm, sexo){
  const cg = clasGrasa(pctGrasa, sexo), cf = clasFFMI(ffmiNorm, sexo)
  if (!cg || !cf) return null
  const gBaja = ['ESENCIAL','ATLETA','FITNESS'].includes(cg), gAlta = cg === 'ELEVADO'
  const fAlto = ['SOBRE EL PROMEDIO','EXCELENTE','SUPERIOR','FUERA DE RANGO NATURAL'].includes(cf), fBajo = ['BAJO EL PROMEDIO','PROMEDIO'].includes(cf)
  if (gBaja && fAlto) return { id:'D', label:'ATLÉTICO', msg:'Músculo alto con grasa baja.' }
  if (gAlta && fBajo) return { id:'C', label:'POR EQUILIBRAR', msg:'La prioridad es bajar grasa y sumar músculo.' }
  return { id:'I', label:'EQUILIBRADO', msg:'Peso, músculo y grasa en proporción razonable.' }
}

// Meta a 6 meses (tasas de Nutrición Pro: Helms 2014 / McDonald / Aragon). nivel es interno: nunca se muestra al socio.
function metaSeisMeses(peso, programa, nivel, comp){
  peso = num(peso); if (!peso) return null; comp = comp || {}
  const P = String(programa || '').toUpperCase(), sem = 26
  const n = /avanz/i.test(nivel || '') ? 'avanzado' : /b[aá]sic|princip/i.test(nivel || '') ? 'principiante' : 'intermedio'
  if (P === 'STRONG'){ const mes = peso * ({ principiante:0.0125, intermedio:0.0075, avanzado:0.004 }[n]); const tot = mes * (sem / 4.345)
    return { tipo:'MÚSCULO', valor: r1(tot), unidad:'kg', texto:'+' + String(r1(tot)).replace('.', ',') + ' kg de masa muscular en 6 meses', hitos:[30,60,90].map(d => ({ dias:d, valor:r1(mes * d / 30.4) })) } }
  if (P === 'BURN'){
    // Corrección vs Nutrición Pro: el tope era 20 % del PESO (podía proyectar bajar casi toda la grasa).
    // Ahora, si hay % grasa medido, nunca se proyecta bajo un piso saludable (hombre 12 %, mujer 20 %) conservando la masa magra.
    const pg = num(comp.pctGrasa), piso = esH(comp.sexo) ? 12 : 20
    const maxGrasa = pg != null ? Math.max(0, peso * pg / 100 - (peso * (1 - pg / 100)) / (1 - piso / 100) * piso / 100) : peso * 0.2
    const s = peso * 0.0075, tot = Math.min(s * sem, maxGrasa)
    if (tot < 0.5) return { tipo:'MANTENCIÓN', valor:0, unidad:'kg', texto:'Ya estás en un rango de grasa bajo: el foco es mantenerlo y sumar músculo', hitos:[] }
    return { tipo:'GRASA', valor: -r1(tot), unidad:'kg', texto:'−' + String(r1(tot)).replace('.', ',') + ' kg de grasa en 6 meses', hitos:[30,60,90].map(d => ({ dias:d, valor:-r1(Math.min(s * d / 7, tot)) })) } }
  return { tipo:'MANTENCIÓN', valor:0, unidad:'kg', texto:'Mantener grasa y músculo estables, con reevaluación mensual', hitos:[] }
}

// Gasto real entre evaluaciones (principio MacroFactor): cambio de peso real vs calorías prescritas. 7.700 kcal ≈ 1 kg
function tdeeAdaptativo(ant, act){
  if (!ant || !act || !num(ant.kcal) || !num(ant.peso) || !num(act.peso) || !ant.fecha || !act.fecha) return null
  const dias = Math.round((new Date(act.fecha + 'T12:00:00') - new Date(ant.fecha + 'T12:00:00')) / 86400000)
  if (dias < 14) return null
  const dPeso = num(act.peso) - num(ant.peso)
  return { tdeeReal: Math.round(num(ant.kcal) - dPeso * 7700 / dias), kcalPrescritas: Math.round(num(ant.kcal)), dias, deltaPeso: r1(dPeso) }
}

// Lectura por sector (página "Mediciones" del PDF)
const SECTORES = [
  { id:'SUP', nombre:'TREN SUPERIOR', pl:[['biceps_mm','Bíceps'],['triceps_mm','Tríceps'],['subescapular_mm','Subescapular']], pe:[['brazo_cm','Brazo']] },
  { id:'CORE', nombre:'ZONA MEDIA', pl:[['cresta_iliaca_mm','Cresta ilíaca'],['supraespinal_mm','Supraespinal'],['abdominal_mm','Abdominal']], pe:[['cintura_cm','Cintura'],['cadera_cm','Cadera']] },
  { id:'INF', nombre:'TREN INFERIOR', pl:[['muslo_mm','Muslo'],['pantorrilla_mm','Pantorrilla']], pe:[['muslo_cm','Muslo'],['pantorrilla_cm','Pantorrilla']] }
]
function sectores(ev, ant){
  return SECTORES.map(s => {
    const d = (lista) => { let sum = 0, n = 0; lista.forEach(([k]) => { if (ant && ant[k] != null && ev[k] != null){ sum += +ev[k] - +ant[k]; n++ } }); return n ? { suma: r1(sum), prom: r1(sum / n) } : null }
    const dp = d(s.pl), dq = d(s.pe)
    let lectura = 'Línea base: primera medición de esta zona.'
    if (dp || dq){ const ps = dp ? dp.suma : 0, qa = dq ? dq.prom : 0
      lectura = dp && ps < -1 && qa >= -0.2 ? 'Recomposición: menos grasa manteniendo o ganando volumen.'
        : dp && ps < -1 ? 'Reducción general de la zona.'
        : dp && ps > 1 && qa > 0.2 ? 'Aumento de tejido: revisar con nutrición si es grasa o músculo.'
        : 'Zona estable, sin cambios relevantes.' }
    return { id:s.id, nombre:s.nombre, lectura, dPliegues: dp, dPerimetros: dq,
      pliegues: s.pl.map(([k,l]) => ({ k, l, v: ev[k] != null ? +ev[k] : null, d: ant && ant[k] != null && ev[k] != null ? r1(+ev[k] - +ant[k]) : null })),
      perimetros: s.pe.map(([k,l]) => ({ k, l, v: ev[k] != null ? +ev[k] : null, d: ant && ant[k] != null && ev[k] != null ? r1(+ev[k] - +ant[k]) : null })) }
  })
}

// Reparto de macros (página "Gasto energético")
function reparto(kcal, p, c, g, peso){
  p = num(p) || 0; c = num(c) || 0; g = num(g) || 0; peso = num(peso)
  const tot = p*4 + c*4 + g*9; if (!tot) return null
  const pc = x => Math.round(x / tot * 100)
  return { kcalMacros: Math.round(tot), kcal: num(kcal) || Math.round(tot),
    proteina: { g:p, pct:pc(p*4), gkg: peso ? r1(p/peso) : null }, carbohidrato: { g:c, pct:pc(c*4), gkg: peso ? r1(c/peso) : null }, grasa: { g:g, pct:pc(g*9), gkg: peso ? r1(g/peso) : null } }
}

/** Plan nutricional estructurado: normaliza lo que entrega la IA o el editor. Nunca confía en la forma recibida. */
function normPlan(x){
  const t = v => v == null ? '' : String(v).trim()
  const arr = v => Array.isArray(v) ? v : []
  x = x && typeof x === 'object' ? x : {}
  return {
    resumen: t(x.resumen),
    comidas: arr(x.comidas).map(c => ({ nombre: t(c && c.nombre).toUpperCase(), hora: t(c && c.hora), aporte: t(c && c.aporte),
      opciones: arr(c && c.opciones).map((o, i) => ({ etiqueta: t(o && o.etiqueta) || String.fromCharCode(65 + i),
        alimentos: arr(o && o.alimentos).map(a => ({ alimento: t(a && a.alimento), cantidad: t(a && a.cantidad) })).filter(a => a.alimento),
        nota: t(o && o.nota) })).filter(o => o.alimentos.length) })).filter(c => c.nombre && c.opciones.length)
      .map((c, i) => ({ c, i, k: /^\d{1,2}:\d{2}$/.test(c.hora) ? c.hora.padStart(5, '0') : null }))
      .sort((a, b) => a.k && b.k ? a.k.localeCompare(b.k) || a.i - b.i : a.i - b.i).map(x => x.c),
    suplementos: arr(x.suplementos).map(s => ({ producto: t(s && s.producto), dosis: t(s && s.dosis), horario: t(s && s.horario) })).filter(s => s.producto),
    hidratacion: t(x.hidratacion),
    indicaciones: arr(x.indicaciones).map(t).filter(Boolean),
    evitar: arr(x.evitar).map(t).filter(Boolean),
    metas: arr(x.metas).map(m => ({ plazo: t(m && m.plazo), meta: t(m && m.meta) })).filter(m => m.meta)
  }
}

const KC = { VERSION, calcular, sugerirPauta, aFila, deFila, cambio, clasGrasa, clasFFMI, formaCorporal, metaSeisMeses, tdeeAdaptativo, sectores, reparto, normPlan, _coefsDW: coefsDW }
if (typeof module !== 'undefined' && module.exports) module.exports = KC
else root.KC = KC
})(typeof self !== 'undefined' ? self : this)
