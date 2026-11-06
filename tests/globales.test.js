// node tests/globales.test.js — ningún script de /domain puede pisar el nombre global de otro (caso KD 5-nov-2026)
const fs = require('fs'), vm = require('vm'), path = require('path')
const raiz = path.join(__dirname, '..')
let fallas = 0
for (const pagina of ['app.html', 'coach.html', 'nutricion.html']) {
  const html = fs.readFileSync(path.join(raiz, pagina), 'utf8')
  const srcs = [...html.matchAll(/<script[^>]+src="\/(domain\/[^"]+\.js)"/g)].map(m => m[1])
  const ctx = { console, setTimeout, clearTimeout, navigator: {}, document: { getElementById: () => null, createElement: () => ({ style: {} }), head: { appendChild() {} }, addEventListener() {} }, addEventListener() {} }
  ctx.window = ctx; ctx.self = ctx; vm.createContext(ctx)
  const duenio = {}
  for (const src of srcs) {
    const antes = new Map(Object.keys(ctx).map(k => [k, ctx[k]]))
    try { vm.runInContext(fs.readFileSync(path.join(raiz, src), 'utf8'), ctx, { filename: src }) } catch (e) { console.log('  (aviso) ' + src + ': ' + e.message) }
    for (const k of Object.keys(ctx)) {
      if (antes.has(k) && antes.get(k) !== ctx[k] && duenio[k] && duenio[k] !== src) { console.log('✗ ' + pagina + ': ' + src + ' pisa window.' + k + ' de ' + duenio[k]); fallas++ }
      if (!antes.has(k)) duenio[k] = src
    }
  }
  console.log('ok · ' + pagina + ' · ' + srcs.length + ' scripts')
}
if (fallas) { console.log(fallas + ' choque(s) de nombres globales'); process.exit(1) }
console.log('sin choques de nombres globales')
