/* TESTS DE REGRESIÓN · motor de métricas KOACH · ejecutar: node domain/koach-motor.tests.js */
const KM = require('./koach-motor.js')
let n = 0, fail = 0
const ok = (nombre, cond) => { n++; if (!cond) { fail++; console.log('✗', nombre) } else console.log('✓', nombre) }
const casi = (a, b, tol = 0.5) => a != null && b != null && Math.abs(a - b) <= tol
const fecha = (hoy, menos) => new Date(Date.parse(hoy) - menos * 864e5).toISOString().slice(0, 10)
const HOY = '2026-11-16'

// ── 1RM (Epley)
ok('1RM 100 kg × 10 = 133,3', casi(KM.rm1(100, 10), 133.3, 0.05))
ok('1RM con 1 rep = la carga', KM.rm1(140, 1) === 140)
ok('1RM reps "8-10" usa 8', casi(KM.rm1(60, '8-10'), 76, 0.05))
ok('1RM sobre 12 reps = null', KM.rm1(40, 15) === null)
ok('1RM sin peso = null', KM.rm1(null, 10) === null && KM.rm1(0, 10) === null)

// ── Tonelaje y mejor 1RM
const sets = [
  { ejercicio_id: 'a', peso: 50, reps: '10', completado: true },
  { ejercicio_id: 'a', peso: 55, reps: '8', completado: true },
  { ejercicio_id: 'b', peso: '20,5', reps: '12', completado: true },
  { ejercicio_id: 'b', peso: 90, reps: '10', completado: false },
  { ejercicio_id: 'c', peso: null, reps: '15', completado: true }
]
ok('tonelaje ignora no completados y sin peso', KM.tonelaje(sets) === 50 * 10 + 55 * 8 + 20.5 * 12)
const m = KM.mejor1RM(sets)
ok('mejor 1RM por ejercicio', casi(m.a, 69.7, 0.05) && casi(m.b, 28.7, 0.05) && m.c === undefined)

// ── Carga aguda:crónica
const estable = [0, 2, 4, 7, 9, 11, 14, 16, 18, 21, 23, 25].map(d => ({ fecha: fecha(HOY, d), ton: 5000 }))
const ac = KM.cargaAC(estable, HOY)
ok('ACWR estable ≈ 1', ac.zona === 'ESTABLE' && casi(ac.ratio, 1, 0.01))
const pico = estable.map((x, i) => i < 3 ? { fecha: x.fecha, ton: 12000 } : x)
ok('ACWR con pico = ALTA', KM.cargaAC(pico, HOY).zona === 'ALTA')
ok('ACWR sin historial = null', KM.cargaAC([{ fecha: HOY, ton: 5000 }], HOY).ratio === null)

// ── HRV
const hrvBase = Array.from({ length: 40 }, (_, i) => ({ fecha: fecha(HOY, i + 7), rmssd: 55 + (i % 5) - 2 }))
const hrvNormal = hrvBase.concat([0, 1, 2, 3, 4, 5, 6].map(d => ({ fecha: fecha(HOY, d), rmssd: 55 })))
const hrvBaja = hrvBase.concat([0, 1, 2, 3, 4, 5, 6].map(d => ({ fecha: fecha(HOY, d), rmssd: 42 })))
ok('HRV en rango', KM.hrvEstado(hrvNormal, HOY).estado === 'RANGO')
ok('HRV baja', KM.hrvEstado(hrvBaja, HOY).estado === 'BAJO')
ok('HRV sin base = null', KM.hrvEstado(hrvBaja.slice(-10), HOY).estado === null)

// ── Pulso en reposo
const fcb = Array.from({ length: 25 }, (_, i) => ({ fecha: fecha(HOY, i + 3), lpm: 58 }))
ok('FC reposo alta', KM.fcReposoEstado(fcb.concat([0, 1, 2].map(d => ({ fecha: fecha(HOY, d), lpm: 65 }))), HOY).estado === 'BAJO')
ok('FC reposo normal', KM.fcReposoEstado(fcb.concat([{ fecha: HOY, lpm: 59 }]), HOY).estado === 'RANGO')

// ── Sueño y deuda
const noches = Array.from({ length: 14 }, (_, i) => ({ fecha: fecha(HOY, i), minutos: i === 0 ? 330 : 440 }))
const s = KM.sueno(noches, HOY, 460)
ok('sueño: noche corta = BAJO', s.estado === 'BAJO' && s.anocheMin === 330)
ok('deuda 14 noches con necesidad 460', casi(s.deudaH, (130 + 13 * 20) / 60, 0.05))
ok('sin necesidad conocida no inventa deuda', KM.sueno(noches, HOY, null).deudaH === null)

// ── Check-in y estado del día
ok('check-in bajo su normal', KM.checkinEstado({ total: 14, base: 18, alertas: ['BAJO_SU_NORMAL'] }).estado === 'BAJO')
ok('check-in sobre su base', KM.checkinEstado({ total: 21, base: 18, alertas: [] }).estado === 'SOBRE')
ok('check-in sin base, 17 = RANGO', KM.checkinEstado({ total: 17, base: null, alertas: [] }).estado === 'RANGO')
const listo = KM.estadoDia({ checkin: { estado: 'RANGO', total: 18 }, carga: { zona: 'ESTABLE' } })
ok('estado LISTO', listo.estado === 'LISTO' && listo.confianza === 'MEDIA')
ok('estado AJUSTAR con un componente bajo', KM.estadoDia({ checkin: { estado: 'RANGO', total: 18 }, sueno: { estado: 'BAJO' } }).estado === 'AJUSTAR')
ok('estado CUIDAR con sueño y HRV bajos', KM.estadoDia({ checkin: { estado: 'RANGO', total: 18 }, sueno: { estado: 'BAJO' }, hrv: { estado: 'BAJO' } }).estado === 'CUIDAR')
ok('estado CUIDAR con check-in muy bajo', KM.estadoDia({ checkin: { estado: 'BAJO', total: 9 } }).estado === 'CUIDAR')
ok('carga ALTA cuenta como componente bajo', KM.estadoDia({ checkin: { estado: 'RANGO', total: 18 }, carga: { zona: 'ALTA' } }).estado === 'AJUSTAR')
ok('sin datos = null', KM.estadoDia({}).estado === null)

// ── Calorías de sesión
ok('STRONG 80 kg 60 min = 464 kcal (MET 5,8)', KM.kcalSesion({ pesoKg: 80, minutos: 60, programa: 'STRONG' }).kcal === 464)
ok('BURN 65 kg 50 min = 406 kcal (MET 7,5)', KM.kcalSesion({ pesoKg: 65, minutos: 50, programa: 'burn' }).kcal === 406)
ok('HEALTHY 70 kg 60 min = 245 kcal (MET 3,5)', KM.kcalSesion({ pesoKg: 70, minutos: 60, programa: 'HEALTHY' }).kcal === 245)
// Keytel hombre 35 a, 81,6 kg, 140 lpm = 13,5 kcal/min → 30 min ≈ 405
const k = KM.kcalSesion({ pesoKg: 81.6, minutos: 30, programa: 'STRONG', fcMedia: 140, edad: 35, sexo: 'hombre' })
ok('Keytel hombre ≈ 405 kcal en 30 min', k.metodo === 'PULSO_KEYTEL_2005' && casi(k.kcal, 405, 1))
ok('pulso bajo 90 cae a MET', KM.kcalSesion({ pesoKg: 80, minutos: 60, programa: 'STRONG', fcMedia: 80, edad: 35, sexo: 'h' }).metodo === 'MET_02055')
ok('sin peso no inventa', KM.kcalSesion({ minutos: 60, programa: 'STRONG' }).motivo === 'FALTA_PESO')

// ── Energía neta, hábitos, adherencia
ok('energía neta', KM.energiaNeta(2080, 2400).neta === -320)
ok('hábitos 2 de 4', KM.habitos([{ meta: 8000, valor: 9000 }, { meta: 2.5, valor: 1.5 }, { meta: 10, valor: 10 }, { meta: 20, valor: 0 }]).pct === 50)
ok('adherencia 2/3 = 67 %', KM.adherencia(2, 3).pct === 67)
ok('adherencia con extra no pasa 100', KM.adherencia(4, 3).pct === 100)
ok('versión en cada resultado', /koach-motor@/.test(KM.estadoDia({ checkin: { estado: 'RANGO', total: 18 } }).version))

console.log(`\n${n - fail}/${n} pruebas OK`)
process.exit(fail ? 1 : 0)
