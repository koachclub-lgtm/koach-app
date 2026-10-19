/* TESTS · motor de biomarcadores · ejecutar: node domain/koach-biomarcadores.tests.js */
const KB = require('./koach-biomarcadores.js')
let n = 0, fail = 0
const ok = (nombre, cond) => { n++; if (!cond) { fail++; console.log('✗', nombre) } else console.log('✓', nombre) }
const casi = (a, b, t = 0.05) => a != null && Math.abs(a - b) <= t

// 1 · Reconocimiento de nombres como vienen en laboratorios chilenos
const casos = [['Glicemia','glucosa'],['GLUCOSA BASAL','glucosa'],['Glucosa en ayunas','glucosa'],['Glicemia 120 min post carga','glucosa_post'],
  ['Insulina basal','insulina'],['Hemoglobina glicosilada A1c','hba1c'],['Hemoglobina','hemoglobina'],['Colesterol total','col_total'],
  ['Colesterol HDL','hdl'],['Colesterol LDL (calculado)','ldl'],['Colesterol VLDL','vldl'],['Triglicéridos','tg'],['Proteína C reactiva ultrasensible','pcr'],
  ['GOT (AST)','got'],['GPT/ALT','gpt'],['Gamma glutamil transferasa','ggt'],['Fosfatasas alcalinas','fa'],['Albúmina','albumina'],
  ['Creatinina','creatinina'],['Nitrógeno ureico','bun'],['Uremia','urea'],['Ácido úrico','ac_urico'],['Hematocrito','hematocrito'],
  ['Recuento de leucocitos','leucocitos'],['Linfocitos','linfocitos_pct'],['VCM','vcm'],['RDW-CV','rdw'],['Recuento de plaquetas','plaquetas'],
  ['Ferritina','ferritina'],['TSH','tsh'],['T4 libre','t4l'],['Vitamina D 25-OH','vit_d'],['Vitamina B12','b12'],['Sodio','sodio'],['Potasio','potasio'],
  ['Testosterona total','testosterona'],['Bilirrubina total','bili_total']]
const malos = casos.filter(([a, b]) => KB.identificar(a, '') !== b)
ok('reconoce ' + casos.length + ' nombres de laboratorio' + (malos.length ? ' · fallan: ' + malos.map(x => x[0] + '→' + KB.identificar(x[0], '')).join(', ') : ''), !malos.length)
ok('linfocitos absolutos por unidad', KB.identificar('Linfocitos', '10^3/uL') === 'linfocitos_abs')
ok('índice CT/HDL no se confunde con HDL', KB.identificar('Índice colesterol total/HDL', '') === null)
ok('RDW-SD en fL no se confunde con RDW %', KB.identificar('RDW-SD', 'fL') === null)
ok('analito desconocido = null', KB.identificar('Antígeno prostático', 'ng/mL') === null)

// 2 · Conversión de unidades
const c = (nom, v, u) => KB.normalizar({ nombre:nom, valor:v, unidad:u }, 'hombre')
ok('glucosa 5,5 mmol/L → 99,1 mg/dL', casi(c('Glucosa', '5,5', 'mmol/L').valor, 99.09, 0.05))
ok('colesterol 5,2 mmol/L → 201 mg/dL', casi(c('Colesterol total', 5.2, 'mmol/L').valor, 201.08, 0.1))
ok('TG 1,7 mmol/L → 150,6 mg/dL', casi(c('Triglicéridos', 1.7, 'mmol/L').valor, 150.57, 0.1))
ok('HbA1c 48 mmol/mol → 6,5 %', casi(c('HbA1c', 48, 'mmol/mol').valor, 6.54, 0.02))
ok('PCR 0,3 mg/dL → 3 mg/L', casi(c('PCR', '0,3', 'mg/dL').valor, 3))
ok('creatinina 88,4 µmol/L → 1 mg/dL', casi(c('Creatinina', 88.4, 'µmol/L').valor, 1, 0.001))
ok('vitamina D 75 nmol/L → 30 ng/mL', casi(c('Vitamina D', 75, 'nmol/L').valor, 30.05, 0.05))
ok('leucocitos 6.200 /µL → 6,2 mil', casi(c('Leucocitos', '6.200', '/uL').valor, 6.2))
ok('leucocitos 6200 sin unidad → 6,2 con aviso', casi(c('Leucocitos', 6200, '').valor, 6.2) && c('Leucocitos', 6200, '').avisos.length > 0)
ok('plaquetas 250 x10^3/uL', casi(c('Plaquetas', 250, 'x10^3/uL').valor, 250))
ok('albúmina 42 g/L → 4,2 g/dL', casi(c('Albúmina', 42, 'g/L').valor, 4.2))
ok('"<0,5" conserva operador', c('PCR', '<0,5', 'mg/L').operador === '<' && casi(c('PCR', '<0,5', 'mg/L').valor, 0.5))
ok('rango del laboratorio convertido', (() => { const x = KB.normalizar({ nombre:'Glucosa', valor:5, unidad:'mmol/L', ref_min:3.9, ref_max:5.5 }); return casi(x.rango_min, 70.3, 0.1) && casi(x.rango_max, 99.1, 0.1) && x.rango_origen === 'laboratorio' })())
ok('valor imposible = error de lectura', c('Glucosa', 9500, 'mg/dL').valido === false)
ok('unidad rara con valor plausible: se acepta con aviso', (() => { const x = c('Glucosa', 92, 'mg%'); return x.valido && x.avisos.length === 1 })())

// 3 · Estados
const e = (k, v, o) => KB.estado(k, v, o || { sexo:'hombre' })
ok('glucosa 92 en rango', e('glucosa', 92).nivel === 'ok')
ok('glucosa 110 → glucosa alterada en ayunas', e('glucosa', 110).nivel === 'fuera' && /ALTERADA/.test(e('glucosa', 110).etiqueta))
ok('glucosa 130 → rango de diabetes, confirmar', /DIABETES/.test(e('glucosa', 130).etiqueta))
ok('glucosa 300 → crítico', e('glucosa', 300).nivel === 'critico')
ok('rango del laboratorio manda', e('glucosa', 102, { rango_min:70, rango_max:105 }).nivel === 'fuera')   // corte ADA sigue mandando sobre 100
ok('HbA1c 6,0 → prediabetes', /PREDIABETES/.test(e('hba1c', 6.0).etiqueta))
ok('LDL 115 → en rango con margen', e('ldl', 115).nivel === 'mejorable')
ok('HDL 45 hombre ok · mujer bajo', e('hdl', 45).nivel === 'ok' && KB.estado('hdl', 45, { sexo:'mujer' }).nivel === 'fuera')
ok('potasio 6,5 crítico', e('potasio', 6.5).nivel === 'critico')
ok('vitamina D 18 bajo', e('vit_d', 18).lado === 'bajo')

// 4 · Índices
const d = KB.derivar({ glucosa:100, insulina:12, tg:150, hdl:50, col_total:200, creatinina:1.0 }, { edad:40, sexo:'hombre' })
ok('HOMA-IR 100×12/405 = 2,96', d.homa_ir === 2.96)
ok('TG/HDL = 3', d.tg_hdl === 3)
ok('no-HDL = 150', d.no_hdl === 150)
ok('eGFR CKD-EPI 2021 H 40a creat 1,0 ≈ 97', casi(KB.eGFR(1.0, 40, 'hombre'), 96.9, 1))
ok('eGFR mujer 50a creat 0,8 ≈ 89', casi(KB.eGFR(0.8, 50, 'mujer'), 88.7, 1.5))
ok('linfocitos % desde absoluto', KB.derivar({ linfocitos_abs:1.86, leucocitos:6.2 }, {})._phenoFaltan.indexOf('linfocitos_pct') === -1)

// 5 · PhenoAge (Levine 2018)
const sano = { albumina:4.5, creatinina:0.9, glucosa:85, pcr:0.5, linfocitos_pct:32, vcm:89, rdw:12.5, fa:60, leucocitos:5.5 }
const p45 = KB.phenoAge(sano, 45).valor, pMal = KB.phenoAge(Object.assign({}, sano, { glucosa:140, pcr:8, rdw:15.5, albumina:3.8 }), 45).valor
ok('PhenoAge perfil sano 45 a < edad real (' + (p45 && p45.toFixed(1)) + ')', p45 < 45 && p45 > 30)
ok('PhenoAge perfil desfavorable > edad real (' + (pMal && pMal.toFixed(1)) + ')', pMal > 45)
ok('PhenoAge sube con la edad', KB.phenoAge(sano, 60).valor > p45)
ok('PhenoAge exige los 9 marcadores', KB.phenoAge({ glucosa:90 }, 40).faltan.length === 8)
ok('PCR indetectable no rompe (piso)', KB.phenoAge(Object.assign({}, sano, { pcr:0 }), 45).valor != null)

// 6 · Tendencia contra el punto de partida
ok('glucosa 112 → 96: mejora (vuelve a rango)', KB.comparar('glucosa', 112, 96) === 'mejora')
ok('glucosa 90 → 93: estable (bajo variación mínima)', KB.comparar('glucosa', 90, 93) === 'estable')
ok('HDL 42 → 50: mejora (subir es mejor)', KB.comparar('hdl', 42, 50, { sexo:'hombre' }) === 'mejora')
ok('TG 120 → 180: empeora', KB.comparar('tg', 120, 180) === 'empeora')
ok('creatinina 1,0 → 1,2 dentro de rango: estable (sin dirección)', KB.comparar('creatinina', 1.0, 1.2, { sexo:'hombre' }) === 'estable')
ok('HbA1c 5,9 → 5,5: mejora', KB.comparar('hba1c', 5.9, 5.5) === 'mejora')

// 7 · Resumen completo
const R = KB.resumen([
  { id:'b', fecha:'2026-10-01', valores:[{ codigo:'glucosa', valor:94 }, { codigo:'insulina', valor:8 }, { codigo:'tg', valor:110 }, { codigo:'hdl', valor:52 }, { codigo:'ldl', valor:135 }] },
  { id:'a', fecha:'2026-04-01', valores:[{ codigo:'glucosa', valor:108 }, { codigo:'insulina', valor:16 }, { codigo:'tg', valor:190 }, { codigo:'hdl', valor:41 }, { codigo:'ldl', valor:140 }] }
], { sexo:'hombre', fechaNac:'1986-05-10' })
ok('resumen ordena por fecha y toma el último', R.ultimo === '2026-10-01' && R.primero === '2026-04-01')
ok('resumen: HOMA-IR calculado y mejora', (() => { const h = R.marcadores.find(x => x.codigo === 'homa_ir'); return h && h.inicio.tendencia === 'mejora' && h.actual === 1.86 })())
ok('resumen: mejoras incluye glucosa, TG, HDL', ['glucosa','tg','hdl'].every(k => R.mejoras.some(x => x.codigo === k)))
ok('resumen: a trabajar incluye LDL', R.trabajar.some(x => x.codigo === 'ldl'))
ok('resumen: edad biológica pide marcadores faltantes', R.edadBiologica.actual === null && R.edadBiologica.faltan.length >= 5)
ok('resumen: educación por marcador', R.marcadores.every(x => x.edu && x.edu.que))
ok('todo marcador del catálogo tiene educación', KB.CATALOGO.concat(KB.DERIVADOS).every(m => KB.EDU[m.c]))

console.log(`\n${n - fail}/${n} OK`)
process.exit(fail ? 1 : 0)
