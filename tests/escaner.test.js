// node tests/escaner.test.js — motor de reglas del escáner (sin IA)
const KE = require('../domain/koach-escaner.js'), assert = require('assert')
const A = (nombre, grupo, prep, nova, kcal, x = {}) => Object.assign({ nombre, grupo, preparacion: prep, nova, refinado: false, azucar_anadida: false, carne_procesada: false, alcohol: false, gramos: 100, kcal, proteina_g: 0, carbohidrato_g: 0, grasa_g: 0, zona: [0, 0, 500, 500] }, x)
const ctx = { foco: 'general', comida: { nombre: 'ALMUERZO' }, kcal_dia: 2000, comidas_dia: 4 }
let n = 0; const t = (nom, f) => { f(); n++; console.log('ok ·', nom) }

t('plato balanceado = adecuado', () => {
  const r = KE.evaluar({ es_comida: true, plato: 'Salmón con arroz', alimentos: [A('salmón', 'proteina', 'horno', 1, 280, { proteina_g: 35 }), A('arroz integral', 'carbohidrato', 'hervido', 1, 180), A('ensalada', 'verdura', 'crudo', 1, 40), A('palta', 'grasa', 'crudo', 1, 80)] }, ctx)
  assert.equal(r.veredicto, 'adecuado'); assert.equal(r.cheat, false); assert.equal(r.totales.kcal, 580); assert.ok(r.puntaje >= 90)
})
t('hamburguesa + papas fritas + bebida = alerta + cheat', () => {
  const r = KE.evaluar({ es_comida: true, plato: 'Hamburguesa', alimentos: [A('hamburguesa', 'proteina', 'frito', 4, 650, { carne_procesada: true, refinado: true }), A('papas fritas', 'carbohidrato', 'frito', 4, 420), A('bebida cola', 'bebida', 'otro', 4, 210, { azucar_anadida: true })] }, ctx)
  assert.equal(r.veredicto, 'alerta'); assert.equal(r.cheat, true); assert.ok(r.acciones.some(a => /No te la saltes/.test(a)))
  assert.ok(!r.acciones.some(a => /salta|ayun|compens/i.test(a.replace('No te la saltes', ''))))
})
t('foco glucosa castiga más el pan blanco que general', () => {
  const d = { es_comida: true, alimentos: [A('marraqueta', 'carbohidrato', 'horno', 3, 270, { refinado: true }), A('palta', 'grasa', 'crudo', 1, 90), A('huevo', 'proteina', 'plancha', 1, 140, { proteina_g: 12 })] }
  const g = KE.evaluar(d, Object.assign({}, ctx, { foco: 'glucosa', comida: { nombre: 'DESAYUNO' } })), b = KE.evaluar(d, Object.assign({}, ctx, { comida: { nombre: 'DESAYUNO' } }))
  assert.ok(g.puntaje < b.puntaje, g.puntaje + ' < ' + b.puntaje)
})
t('antiinflamatorio: fritura pesa más', () => {
  const d = { es_comida: true, alimentos: [A('pollo frito', 'proteina', 'frito', 3, 450, { proteina_g: 35 }), A('ensalada', 'verdura', 'crudo', 1, 30)] }
  assert.ok(KE.evaluar(d, Object.assign({}, ctx, { foco: 'antiinflamatorio' })).puntaje < KE.evaluar(d, ctx).puntaje)
})
t('porción muy sobre la pauta baja el puntaje', () => {
  const d = { es_comida: true, alimentos: [A('pollo', 'proteina', 'plancha', 1, 600, { proteina_g: 60 }), A('arroz', 'carbohidrato', 'hervido', 1, 500), A('verdura', 'verdura', 'vapor', 1, 50)] }
  const r = KE.evaluar(d, ctx); assert.ok(r.ratio_comida > 2); assert.ok(r.banderas.some(b => b.tipo === 'porcion')); assert.equal(r.porcentaje_dia, 57)
})
t('sin comida', () => { const r = KE.evaluar({ es_comida: false, alimentos: [] }, ctx); assert.equal(r.veredicto, 'no_comida'); assert.equal(r.puntaje, null) })
t('entrada sucia no rompe', () => {
  const r = KE.evaluar({ es_comida: true, alimentos: [{ nombre: 'x', grupo: 'raro', nova: 9, kcal: '120', zona: [1, 2] }, null, {}] }, {})
  assert.equal(r.alimentos.length, 1); assert.equal(r.alimentos[0].nova, 4); assert.equal(r.alimentos[0].zona, null); assert.equal(r.foco, 'general')
})
t('determinista', () => { const d = { es_comida: true, alimentos: [A('completo', 'proteina', 'procesado', 4, 500, { carne_procesada: true, refinado: true })] }; assert.deepEqual(KE.evaluar(d, ctx), KE.evaluar(d, ctx)) })
t('semana', () => {
  const s = KE.semana([{ fecha: '2026-11-03', veredicto: 'adecuado' }, { fecha: '2026-11-03', veredicto: 'alerta', comida: 'cena' }, { fecha: '2026-11-04', veredicto: 'alerta', comida: 'CENA' }, { fecha: '2026-11-05', veredicto: 'relativo' }, { veredicto: 'no_comida' }])
  assert.deepEqual(s, { escaneos: 4, dias: 3, aciertos: 50, alertas: 2, patron: { comida: 'CENA', veces: 2 } })
})
console.log(n + ' pruebas OK')
