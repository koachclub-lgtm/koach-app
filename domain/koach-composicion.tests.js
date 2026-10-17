/* TESTS DE REGRESIÓN · motor de composición · ejecutar: node domain/koach-composicion.tests.js */
const KC = require('./koach-composicion.js')
let n = 0, fail = 0
const ok = (nombre, cond) => { n++; if (!cond) { fail++; console.log('✗', nombre) } else console.log('✓', nombre) }
const casi = (a, b, tol = 0.05) => a != null && b != null && Math.abs(a - b) <= tol

// ── Referencia: fórmulas originales de Nutrición Pro (koach-nutricionv2/src/App.js, motor v2.0), copiadas literal
function refCoefs(edad, sexo){ const t = sexo === 'Hombre'
  ? [[20,1.1620,0.0630],[30,1.1631,0.0632],[40,1.1422,0.0544],[50,1.1620,0.0700],[Infinity,1.1715,0.0779]]
  : [[20,1.1549,0.0678],[30,1.1599,0.0717],[40,1.1423,0.0632],[50,1.1333,0.0612],[Infinity,1.1339,0.0645]]
  const f = t.find(([m]) => edad < m) || t[t.length-1]; return { C: f[1], M: f[2] } }
function refGrasa(p, edad, sexo){ const s4 = p.biceps + p.triceps + p.subescapular + p.crestaIliaca, { C, M } = refCoefs(edad, sexo)
  return Math.max(3, Math.min(60, 495 / (C - M * Math.log10(s4)) - 450)) }
function refMM(talla, edad, sexo, p, pe){ const CAB = pe.brazo - Math.PI*(p.triceps/10), CAM = pe.muslo - Math.PI*(p.muslo/10), CAP = pe.pantorrilla - Math.PI*(p.pantorrilla/10)
  return Math.max(0, talla*(0.00744*CAB*CAB + 0.00088*CAM*CAM + 0.00441*CAP*CAP)/100 + 2.4*(sexo==='Hombre'?1:0) - 0.048*edad + 7.8) }

// ── 1 · Caso fijo conocido (hombre 34 años)
const H = { peso: 82, talla: 178, edad: 34, sexo: 'hombre',
  pliegues: { triceps: 10, biceps: 5, subescapular: 14, crestaIliaca: 18, supraespinal: 9, abdominal: 20, muslo: 12, pantorrilla: 7 },
  perimetros: { brazo: 35, muslo: 57, pantorrilla: 38, cintura: 84, cadera: 98 } }
const rH = KC.calcular(H)
// Σ4 = 47 · D&W 30-39 H: C=1.1422 M=0.0544 → BD = 1.1422 − 0.0544·log10(47) = 1.05124 → Siri = 20.87 %
ok('D&W+Siri hombre 34a = 20,9 %', casi(rH.grasa.pct, 20.9))
ok('completo con todos los sitios', rH.completo === true && rH.avisos.length === 0)
ok('masas suman el peso', casi(rH.grasa.kg + rH.muscular.kg + rH.osea.kg + rH.residual.kg, 82, 0.03))
ok('Σ6 y Σ8', rH.suma6 === 72 && rH.suma8 === 95)
ok('ICC/ICT', rH.icc === 0.86 && rH.ict === 0.47)

// ── 2 · Regresión contra Nutrición Pro en 500 casos aleatorios (ambos sexos, 18–70 años)
let difG = 0, difM = 0
let seed = 7; const rnd = (a, b) => { seed = (seed * 16807) % 2147483647; return a + (b - a) * (seed / 2147483647) }
for (let i = 0; i < 500; i++){
  const sexo = i % 2 ? 'Hombre' : 'Mujer', edad = Math.round(rnd(18, 70)), talla = rnd(150, 195)
  const p = { triceps: rnd(4, 35), biceps: rnd(2, 25), subescapular: rnd(5, 40), crestaIliaca: rnd(4, 45), muslo: rnd(5, 40), pantorrilla: rnd(3, 25) }
  const pe = { brazo: rnd(24, 45), muslo: rnd(45, 70), pantorrilla: rnd(30, 45) }
  const r = KC.calcular({ peso: rnd(50, 120), talla, edad, sexo: sexo.toLowerCase(), pliegues: p, perimetros: pe })
  difG = Math.max(difG, Math.abs(r.grasa.pct - refGrasa(p, edad, sexo)))
  difM = Math.max(difM, Math.abs(r.muscular.kg - refMM(talla, edad, sexo, p, pe)))
}
ok('regresión % grasa = Nutrición Pro (±0,05)', difG <= 0.05)
ok('regresión masa muscular = Nutrición Pro (±0,005 kg)', difM <= 0.005)

// ── 3 · Faltan datos: nunca se rellena con valores poblacionales
const sinCresta = KC.calcular({ ...H, pliegues: { ...H.pliegues, crestaIliaca: '' } })
ok('sin cresta ilíaca ⇒ % grasa null (no 20 % poblacional)', sinCresta.grasa.pct === null && sinCresta.grasa.medida === false)
ok('sin cresta ilíaca ⇒ aviso nombra el sitio', sinCresta.avisos.some(a => /cresta ilíaca/.test(a)))
ok('sin grasa ⇒ residual y edad biológica null', sinCresta.residual.kg === null && sinCresta.edadBiologica === null)
const sinPer = KC.calcular({ ...H, perimetros: { cintura: 84 } })
ok('sin perímetros ⇒ masa muscular null', sinPer.muscular.kg === null && sinPer.muscular.medida === false && sinPer.grasa.pct != null)
ok('acepta coma decimal', casi(KC.calcular({ ...H, peso: '82,0' }).grasa.kg, rH.grasa.kg, 0.01))

// ── 4 · Sexo y edad cambian coeficientes
ok('mujer ≠ hombre con mismos pliegues', KC.calcular({ ...H, sexo: 'mujer' }).grasa.pct > rH.grasa.pct)
ok('tramo 50+ usa coeficientes propios', KC._coefsDW(55, 'hombre').C === 1.1715)

// ── 5 · Fila ida y vuelta
const fila = KC.aFila(H, rH), back = KC.deFila({ ...fila, brazo_cm: fila.brazo_relajado_cm })
ok('aFila guarda motor y banderas', fila.motor_version === KC.VERSION && fila.grasa_medida && fila.musculo_medido && fila.cresta_iliaca_mm === 18)
ok('deFila → calcular reproduce', casi(KC.calcular(back).grasa.pct, rH.grasa.pct, 1e-9))

// ── 6 · Cambio entre evaluaciones
const evs = [{ fecha: '2026-06-01', porcentaje_grasa: 24, masa_muscular_kg: 33 }, { fecha: '2026-08-01', porcentaje_grasa: 22.5 },
             { fecha: '2026-10-01', porcentaje_grasa: 21.2, masa_muscular_kg: 34.1 }]
const cg = KC.cambio(evs, 'porcentaje_grasa', -1), cm = KC.cambio(evs, 'masa_muscular_kg', 1)
ok('grasa: −1,3 vs anterior · −2,8 vs inicio · mejora', cg.vsAnterior === -1.3 && cg.vsInicio === -2.8 && cg.tonoInicio === 'mejora')
ok('músculo salta evaluación sin dato', cm.vsAnterior === 1.1 && cm.fechaAnterior === '2026-06-01' && cm.vsInicio === 1.1)
ok('una sola evaluación ⇒ sin deltas', KC.cambio([evs[0]], 'porcentaje_grasa', -1).vsAnterior === null)
ok('sin datos ⇒ null', KC.cambio(evs, 'cintura_cm', -1) === null)

// ── 7 · Pauta sugerida
const pa = KC.sugerirPauta({ peso: 82, talla: 178, edad: 34, sexo: 'hombre', actividad: 'moderado', programa: 'BURN' })
ok('pauta BURN: déficit y 2,4 g/kg proteína', pa.proteina_g === 197 && pa.kcal < pa.tdee)

console.log(`\n${n - fail}/${n} OK`)
process.exit(fail ? 1 : 0)
