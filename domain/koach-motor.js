/* ═══════════════════════════════════════════════════════════════
   KOACH MOTOR · el "cerebro" de métricas del socio (Biohacking OS)
   Una sola lógica para la app web, la app nativa, el dashboard y Jake.
   · 1RM estimado: Epley (carga × (1 + reps/30)), solo hasta 12 reps
   · Carga aguda:crónica: tonelaje 7 días / promedio semanal de 28 días (zona 0,8–1,3)
   · HRV: ln(RMSSD), promedio móvil 7 días vs línea base propia ± 0,5 DE (método Plews)
   · Sueño: noche vs promedio propio de 14 noches + deuda de sueño de 14 noches
   · Calorías de sesión: MET del 2024 Adult Compendium × peso × horas reales,
     o ecuación de pulso de Keytel 2005 cuando hay frecuencia cardiaca media
   · Estado del día: cada componente contra el propio promedio del socio → LISTO / AJUSTAR / CUIDAR
   Reglas: un dato que falta NUNCA se reemplaza por un valor poblacional: queda null y se avisa.
   Funciones puras, sin dependencias. Vanilla JS. Cada resultado lleva la versión del motor.
   ═══════════════════════════════════════════════════════════════ */
(function(root){
'use strict'
const VERSION = 'koach-motor@1.0.0'
const num = v => { const n = typeof v === 'string' ? parseFloat(v.replace(',', '.')) : +v; return Number.isFinite(n) ? n : null }
const pos = v => { const n = num(v); return n != null && n > 0 ? n : null }
const r0 = v => v == null ? null : Math.round(v)
const r1 = v => v == null ? null : Math.round(v * 10) / 10
const r2 = v => v == null ? null : Math.round(v * 100) / 100
const prom = a => a.length ? a.reduce((s, x) => s + x, 0) / a.length : null
const de = a => { if (a.length < 2) return null; const m = prom(a); return Math.sqrt(a.reduce((s, x) => s + (x - m) ** 2, 0) / (a.length - 1)) }
const DIA = 864e5
const dias = (a, b) => Math.round((Date.parse(a) - Date.parse(b)) / DIA)   // fechas 'YYYY-MM-DD'

// ── Repeticiones: '10' → 10 · '8-10' → 8 (lo conservador) · 'AMRAP'/'' → null
function repsDe(v){ const m = String(v == null ? '' : v).match(/\d+/); const n = m ? parseInt(m[0], 10) : null; return n && n > 0 ? n : null }

// ── 1RM estimado (Epley). Sobre 12 reps la estimación pierde validez: se devuelve null.
function rm1(peso, reps){
  const p = pos(peso), r = repsDe(reps)
  if (p == null || r == null || r > 12) return null
  return r === 1 ? r1(p) : r1(p * (1 + r / 30))
}

// ── Tonelaje de una lista de sets ({peso, reps, completado})
function tonelaje(sets){
  return r0((sets || []).reduce((s, x) => {
    if (x && x.completado === false) return s
    const p = pos(x && x.peso), r = repsDe(x && x.reps)
    return p != null && r != null ? s + p * r : s
  }, 0))
}

// ── Mejor 1RM por ejercicio (para récords y progresión de fuerza)
function mejor1RM(sets){
  const out = {}
  for (const x of sets || []) {
    if (!x || x.completado === false || !x.ejercicio_id) continue
    const e = rm1(x.peso, x.reps)
    if (e != null && (out[x.ejercicio_id] == null || e > out[x.ejercicio_id])) out[x.ejercicio_id] = e
  }
  return out
}

// ── Carga aguda vs crónica. dias = [{fecha, ton}] (uno por día con entrenamiento), hoy = 'YYYY-MM-DD'
// Uso interno del koach. Zona 0,8–1,3: carga estable · > 1,3: subida brusca · < 0,8: descarga.
function cargaAC(diasTon, hoy){
  const d = (diasTon || []).map(x => ({ e: dias(hoy, x.fecha), t: pos(x.ton) || 0 })).filter(x => x.e >= 0 && x.e < 28)
  const aguda = d.filter(x => x.e < 7).reduce((s, x) => s + x.t, 0)
  const cronica = d.reduce((s, x) => s + x.t, 0) / 4
  const semanasConDatos = new Set(d.map(x => Math.floor(x.e / 7))).size
  if (semanasConDatos < 3 || !cronica) return { aguda: r0(aguda), cronica: r0(cronica), ratio: null, zona: null, motivo: 'HISTORIAL_INSUFICIENTE', version: VERSION }
  const ratio = aguda / cronica
  return { aguda: r0(aguda), cronica: r0(cronica), ratio: r2(ratio), zona: ratio > 1.3 ? 'ALTA' : ratio < 0.8 ? 'BAJA' : 'ESTABLE', version: VERSION }
}

// ── HRV. serie = [{fecha, rmssd}] (una por noche). Necesita ≥ 14 noches de base fuera de los últimos 7 días.
function hrvEstado(serie, hoy){
  const v = (serie || []).map(x => ({ e: dias(hoy, x.fecha), l: pos(x.rmssd) })).filter(x => x.l != null && x.e >= 0 && x.e < 60)
    .map(x => ({ e: x.e, l: Math.log(x.l) }))
  const ult = v.filter(x => x.e < 7).map(x => x.l), base = v.filter(x => x.e >= 7).map(x => x.l)
  if (ult.length < 3 || base.length < 14) return { estado: null, motivo: 'HISTORIAL_INSUFICIENTE', noches: v.length, version: VERSION }
  const m7 = prom(ult), mb = prom(base), swc = 0.5 * de(base)
  const estado = m7 < mb - swc ? 'BAJO' : m7 > mb + swc ? 'SOBRE' : 'RANGO'
  return { estado, rmssd7: r1(Math.exp(m7)), rmssdBase: r1(Math.exp(mb)), rango: [r1(Math.exp(mb - swc)), r1(Math.exp(mb + swc))], version: VERSION }
}

// ── Pulso en reposo. Alerta si el promedio de 3 días supera en 5 lpm o más la base de 28 días.
function fcReposoEstado(serie, hoy){
  const v = (serie || []).map(x => ({ e: dias(hoy, x.fecha), f: pos(x.lpm) })).filter(x => x.f != null && x.e >= 0 && x.e < 31)
  const ult = v.filter(x => x.e < 3).map(x => x.f), base = v.filter(x => x.e >= 3).map(x => x.f)
  if (!ult.length || base.length < 7) return { estado: null, motivo: 'HISTORIAL_INSUFICIENTE', version: VERSION }
  const d = prom(ult) - prom(base)
  return { estado: d >= 5 ? 'BAJO' : d <= -3 ? 'SOBRE' : 'RANGO', lpm3: r0(prom(ult)), lpmBase: r0(prom(base)), version: VERSION }
}

// ── Sueño. noches = [{fecha, minutos}]. necesidadMin = necesidad propia del socio (si no se conoce, null:
// se informa el promedio y la noche, pero no se calcula deuda con un valor poblacional).
function sueno(noches, hoy, necesidadMin){
  const v = (noches || []).map(x => ({ e: dias(hoy, x.fecha), m: pos(x.minutos) })).filter(x => x.m != null && x.e >= 0 && x.e < 14)
  if (!v.length) return { estado: null, motivo: 'SIN_DATOS', version: VERSION }
  const anoche = v.reduce((a, x) => x.e < a.e ? x : a, v[0]), resto = v.filter(x => x !== anoche).map(x => x.m)
  const base = resto.length >= 5 ? prom(resto) : null
  const nec = pos(necesidadMin)
  const deuda = nec ? r1(v.reduce((s, x) => s + Math.max(0, nec - x.m), 0) / 60) : null
  let estado = null
  if (base != null) estado = anoche.m < base - 45 ? 'BAJO' : anoche.m > base + 30 ? 'SOBRE' : 'RANGO'
  return { estado, anocheMin: r0(anoche.m), promedioMin: r0(base), deudaH: deuda, noches: v.length, version: VERSION }
}

// ── Check-in de bienestar (ya calculado en Supabase por _bienestar_eval): {total, base, alertas[]}
function checkinEstado(c){
  if (!c || pos(c.total) == null) return { estado: null, motivo: 'SIN_CHECKIN', version: VERSION }
  const al = c.alertas || [], t = +c.total, b = pos(c.base)
  let estado = 'RANGO'
  if (t < 11 || al.includes('BAJO_SU_NORMAL')) estado = 'BAJO'
  else if (b != null && t >= b + 2) estado = 'SOBRE'
  else if (b == null && t >= 21) estado = 'SOBRE'
  return { estado, total: t, base: b, alertas: al, version: VERSION }
}

// ── Estado del día: combina los componentes disponibles. Nunca necesita todos: usa los que hay.
// LISTO = sesión como está · AJUSTAR = mismas cargas, una serie menos por bloque · CUIDAR = volumen reducido, sin test de fuerza
// La decisión final es siempre del koach: esto es una propuesta.
function estadoDia(comp){
  const c = comp || {}
  const partes = [
    ['checkin', c.checkin && c.checkin.estado],
    ['sueno', c.sueno && c.sueno.estado],
    ['hrv', c.hrv && c.hrv.estado],
    ['fcReposo', c.fcReposo && c.fcReposo.estado],
    ['carga', c.carga && c.carga.zona === 'ALTA' ? 'BAJO' : c.carga && c.carga.zona ? 'RANGO' : null]
  ].filter(p => p[1])
  if (!partes.length) return { estado: null, motivo: 'SIN_DATOS', componentes: [], version: VERSION }
  const bajos = partes.filter(p => p[1] === 'BAJO').map(p => p[0])
  const fisio = bajos.filter(k => k === 'hrv' || k === 'sueno' || k === 'fcReposo').length
  const checkinMuyBajo = c.checkin && c.checkin.total != null && c.checkin.total < 11
  const estado = (bajos.length >= 2 || fisio >= 2 || checkinMuyBajo) ? 'CUIDAR' : bajos.length === 1 ? 'AJUSTAR' : 'LISTO'
  const propuesta = { LISTO: 'Sesión como está planificada', AJUSTAR: 'Mismas cargas, una serie menos por bloque', CUIDAR: 'Volumen reducido y sin test de fuerza hoy' }[estado]
  return { estado, propuesta, bajos, componentes: partes.map(p => ({ k: p[0], estado: p[1] })), confianza: partes.length >= 3 ? 'ALTA' : partes.length === 2 ? 'MEDIA' : 'BAJA', version: VERSION }
}

// ── Calorías de una sesión KOACH
// MET (2024 Adult Compendium of Physical Activities), por programa:
//   STRONG  5,8 · 02055 Resistance training, circuit, reciprocal supersets (bloques de biseries/triseries)
//   BURN    7,5 · 02040 Circuit training, some aerobic movement with minimal rest, vigorous
//   HEALTHY 3,5 · 02054 Resistance training, multiple exercises, 8-15 reps at varied resistance
// kcal = MET × peso (kg) × horas. Con pulso medio se usa Keytel 2005 (más preciso para el individuo).
const MET = { STRONG: { met: 5.8, codigo: '02055' }, BURN: { met: 7.5, codigo: '02040' }, HEALTHY: { met: 3.5, codigo: '02054' } }
function kcalSesion(o){
  const x = o || {}, peso = pos(x.pesoKg), min = pos(x.minutos), fc = pos(x.fcMedia), edad = pos(x.edad)
  if (peso == null || min == null) return { kcal: null, motivo: peso == null ? 'FALTA_PESO' : 'FALTA_DURACION', version: VERSION }
  // Keytel solo es lineal con esfuerzo submáximo: bajo 90 lpm de promedio se usa el MET
  if (fc != null && fc >= 90 && edad != null && x.sexo) {
    const h = /^h/i.test(String(x.sexo))
    const porMin = h ? (-55.0969 + 0.6309 * fc + 0.1988 * peso + 0.2017 * edad) / 4.184
                     : (-20.4022 + 0.4472 * fc - 0.1263 * peso + 0.074 * edad) / 4.184
    if (porMin > 0) return { kcal: r0(porMin * min), metodo: 'PULSO_KEYTEL_2005', version: VERSION }
  }
  const prog = String(x.programa || '').toUpperCase(), m = MET[prog]
  if (!m) return { kcal: null, motivo: 'PROGRAMA_DESCONOCIDO', version: VERSION }
  return { kcal: r0(m.met * peso * (min / 60)), metodo: 'MET_' + m.codigo, met: m.met, version: VERSION }
}

// ── Energía neta del día: lo comido (escáner) − lo gastado (sesión + resto del día si viene del reloj)
function energiaNeta(comidoKcal, gastadoKcal){
  const c = pos(comidoKcal), g = pos(gastadoKcal)
  if (c == null || g == null) return { neta: null, motivo: c == null ? 'SIN_COMIDAS' : 'SIN_GASTO', version: VERSION }
  return { neta: r0(c - g), comido: r0(c), gastado: r0(g), version: VERSION }
}

// ── Hábitos: metas = [{meta, valor}] de los hábitos que el socio activó
function habitos(metas){
  const v = (metas || []).filter(x => pos(x && x.meta) != null)
  if (!v.length) return { pct: null, cumplidas: 0, activas: 0, version: VERSION }
  const ok = v.filter(x => (num(x.valor) || 0) >= +x.meta).length
  return { pct: r0(ok / v.length * 100), cumplidas: ok, activas: v.length, version: VERSION }
}

// ── Adherencia semanal: sesiones completadas / planificadas (sin contar extras)
function adherencia(completadas, planificadas){
  const p = pos(planificadas), c = Math.max(0, num(completadas) || 0)
  if (p == null) return { pct: null, version: VERSION }
  return { pct: r0(Math.min(1, c / p) * 100), completadas: c, planificadas: p, version: VERSION }
}

const KM = { VERSION, MET, repsDe, rm1, tonelaje, mejor1RM, cargaAC, hrvEstado, fcReposoEstado, sueno, checkinEstado, estadoDia, kcalSesion, energiaNeta, habitos, adherencia }
if (typeof module !== 'undefined' && module.exports) module.exports = KM
else root.KM = KM
})(typeof self !== 'undefined' ? self : this)
