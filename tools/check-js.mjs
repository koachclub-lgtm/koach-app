// Guardia de deploy: compila (sin ejecutar) todo el JS inline de los .html y los .js de /domain.
// Si hay un error de sintaxis, el build de Vercel falla y producción se queda en la última versión buena.
import { readFileSync, readdirSync } from 'node:fs'
import vm from 'node:vm'
const archivos = readdirSync('.').filter(f => f.endsWith('.html')).concat(readdirSync('domain').filter(f => f.endsWith('.js')).map(f => 'domain/' + f))
let errores = 0, bloques = 0
for (const f of archivos) {
  const src = readFileSync(f, 'utf8')
  const scripts = f.endsWith('.js') ? [[src, 1]] : [...src.matchAll(/<script(\s[^>]*)?>([\s\S]*?)<\/script>/gi)]
    .filter(m => !/\bsrc=/.test(m[1] || '') && !/type=["']?(application\/(ld\+)?json|text\/(template|x-template|html))/i.test(m[1] || '') && !/type=["']?module/i.test(m[1] || ''))
    .map(m => [m[2], src.slice(0, m.index).split('\n').length])
  for (const [code, linea] of scripts) {
    if (!code.trim()) continue
    bloques++
    try { new vm.Script(code, { filename: f }) }
    catch (e) { errores++; const l = (e.stack.match(new RegExp(f.replace(/[.\/]/g, '\\$&') + ':(\\d+)')) || [])[1]
      console.error(`✗ ${f} (script desde línea ${linea}${l ? ', línea ' + (linea + +l - 1) : ''}): ${e.message}`) }
  }
}
console.log(`check-js: ${archivos.length} archivos, ${bloques} bloques, ${errores} errores`)
process.exit(errores ? 1 : 0)
