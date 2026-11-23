const K = require('./koach-ruta.js'); const assert = require('assert'); let ok = 0
const t = (n, f) => { try { f(); ok++ } catch (e) { console.error('✗', n, e.message); process.exitCode = 1 } }
// Serrano 489, Concepción aprox.; 1° de latitud ≈ 111.195 m
const L0 = -36.8270, G0 = -73.0500, mLat = 1 / 111195
function carrera(metros, vel, cadaS, extra) { const pts = []; let t0 = 1.7e12
  for (let s = 0; s * vel <= metros; s += cadaS) pts.push({ lat: L0 + s * vel * mLat, lng: G0, t: t0 + s * 1000, acc: 8 })
  return extra ? extra(pts) : pts }
t('distancia haversine 1 km', () => { const d = K.distancia({ lat: L0, lng: G0 }, { lat: L0 + 1000 * mLat, lng: G0 }); assert.ok(Math.abs(d - 1000) < 2, d) })
t('carrera 2 km a 3 m/s', () => { const r = K.resumen(carrera(2000, 3, 5)); assert.ok(Math.abs(r.distancia_m - 2000) < 20, r.distancia_m); assert.ok(r.valida); assert.ok(Math.abs(r.ritmo_min_km - 5.56) < 0.05, r.ritmo_min_km); assert.strictEqual(r.ritmo_txt, '5:33 /KM') })
t('muestreo 1 Hz no pierde distancia', () => { const r = K.resumen(carrera(2000, 3, 1)); assert.ok(Math.abs(r.distancia_m - 2000) < 20, r.distancia_m) })
t('descarta punto impreciso', () => { const r = K.resumen(carrera(1000, 3, 5, (p) => { p[10] = Object.assign({}, p[10], { lng: G0 + 0.01, acc: 80 }); return p })); assert.ok(Math.abs(r.distancia_m - 1000) < 20, r.distancia_m); assert.strictEqual(r.descartados, 1) })
t('descarta salto imposible', () => { const r = K.resumen(carrera(1000, 3, 5, (p) => { p[10] = Object.assign({}, p[10], { lng: G0 + 0.01 }); return p })); assert.ok(Math.abs(r.distancia_m - 1000) < 20, r.distancia_m) })
t('temblor quieto no suma', () => { const pts = []; for (let i = 0; i < 120; i++) pts.push({ lat: L0 + (i % 2 ? 2 : -2) * mLat, lng: G0, t: 1.7e12 + i * 5000, acc: 10 }); const r = K.resumen(pts); assert.ok(r.distancia_m < 10, r.distancia_m); assert.strictEqual(r.valida, false); assert.strictEqual(r.motivo, 'DISTANCIA_CORTA') })
t('pausa no suma tiempo en movimiento', () => { const a = carrera(1000, 3, 5); const last = a[a.length - 1]; for (let i = 1; i <= 24; i++) a.push({ lat: last.lat, lng: last.lng, t: last.t + i * 5000, acc: 8 }); const r = K.resumen(a); assert.ok(r.duracion_s - r.movimiento_s >= 110, r.duracion_s + ' ' + r.movimiento_s) })
t('corta en tiempo no valida', () => { const r = K.resumen(carrera(400, 4, 5)); assert.strictEqual(r.valida, false); assert.strictEqual(r.motivo, 'TIEMPO_CORTO') })
t('polyline conocido', () => assert.strictEqual(K.polyline([{ lat: 38.5, lng: -120.2 }, { lat: 40.7, lng: -120.95 }, { lat: 43.252, lng: -126.453 }]), '_p~iF~ps|U_ulLnnqC_mqNvxq`@'))
t('sin puntos', () => { const r = K.resumen([]); assert.strictEqual(r.distancia_m, 0); assert.strictEqual(r.valida, false); assert.strictEqual(r.ritmo_min_km, null) })
console.log(ok + ' pruebas OK')
