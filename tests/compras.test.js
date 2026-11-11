// Compra semanal: reparto A/B, suma, crudo, unidades y pasillos
global.KE = require('../domain/koach-escaner.js')
const KCO = require('../domain/koach-compras.js')
const ok = (c, m) => { if (!c) { console.error('FALLA:', m); process.exit(1) } }
const com = [
  { opciones: [{ alimentos: [{ alimento: 'Avena', cantidad: '60 g' }, { alimento: 'Huevo', cantidad: '2 unidades' }] }] },
  { opciones: [
    { alimentos: [{ alimento: 'Pollo (cocido)', cantidad: '150 g' }, { alimento: 'Arroz cocido', cantidad: '300 g' }, { alimento: 'Verduras mixtas', cantidad: 'Libre' }] },
    { alimentos: [{ alimento: 'Pollo cocido', cantidad: '150 g' }, { alimento: 'Palta', cantidad: '50 g' }] }] }
]
ok(JSON.stringify(KCO.reparto(7, 2)) === '[4,3]', 'reparto 7/2')
const L = KCO.lista(com, { dias: 7 })
const it = n => L.items.find(i => i.nombre.toLowerCase().startsWith(n))
ok(it('avena').g === 420 && it('avena').txt === '450 g', 'avena 7×60 → 450 g ' + JSON.stringify(it('avena')))
ok(it('huevo').txt === '14 huevos', 'huevos ' + it('huevo').txt)
const p = it('pollo'); ok(p && Math.abs(p.g - Math.round(150 * 7 * 1.33)) <= 1 && p.crudo, 'pollo A+B unido y en crudo ' + JSON.stringify(p))
ok(p.txt === '1,4 kg', 'pollo en kg ' + p.txt)
const a = it('arroz'); ok(a.crudo && a.g === Math.round(300 * 4 * 0.37), 'arroz solo 4 días y en crudo ' + JSON.stringify(a))
ok(it('verdura').libre && it('verdura').txt === 'A gusto', 'libre')
ok(it('palta').txt === '1 palta', 'palta 3×50 → 1 ' + it('palta').txt)
ok(L.grupos[0].id === 'PROT' && L.grupos.some(g => g.id === 'FRUV'), 'pasillos')
ok(KCO.lista(com, { dias: 5 }).items.find(i => i.nombre.startsWith('Avena')).g === 300, 'días 5')
ok(/Mi compra semanal KOACH · 7 días/.test(KCO.texto(L)), 'texto')
console.log('compras OK')
