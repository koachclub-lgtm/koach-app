// KOACH nativa · copia la app web a www/ para empaquetarla dentro del binario (no es un visor de la web:
// las pantallas, fuentes, imágenes y lógica viajan dentro de la app y abren sin conexión).
// Uso: node sync-web.mjs   (después: npx cap sync)
import { cpSync, rmSync, mkdirSync, readFileSync, writeFileSync, readdirSync, statSync, existsSync } from 'node:fs'
import { join, dirname, extname } from 'node:path'
import { fileURLToPath } from 'node:url'

const AQUI = dirname(fileURLToPath(import.meta.url))
const RAIZ = join(AQUI, '..')
const WWW = join(AQUI, 'www')
const APP = 'https://app.koachclub.cl'

// Lo que la app del socio necesita. Dashboard, previews y SQL quedan fuera.
const ARCHIVOS = ['app.html', 'terminos.html', 'privacidad.html', 'eliminar-cuenta.html', 'manifest.webmanifest',
  'favicon.ico', 'favicon-16.png', 'favicon-32.png', 'apple-touch-icon.png', 'icon-48.png', 'icon-96.png',
  'icon-192.png', 'icon-512.png', 'icon-maskable-512.png', 'isotipo-256.png']
const CARPETAS = ['domain', 'fonts', 'img', 'sfx', 'models', 'vendor']

rmSync(WWW, { recursive: true, force: true })
mkdirSync(WWW, { recursive: true })
for (const f of ARCHIVOS) if (existsSync(join(RAIZ, f))) cpSync(join(RAIZ, f), join(WWW, f))
for (const d of CARPETAS) cpSync(join(RAIZ, d), join(WWW, d), { recursive: true,
  filter: (src) => !/\.tests\.js$/.test(src) })
cpSync(join(AQUI, 'koach-native.js'), join(WWW, 'koach-native.js'))

// index.html → app.html (Capacitor abre index.html)
writeFileSync(join(WWW, 'index.html'),
  '<!doctype html><meta charset="utf-8"><meta http-equiv="refresh" content="0;url=/app.html"><script>location.replace("/app.html"+location.hash)</script>')

// Ajustes de origen: dentro de la app el origen es localhost, las API viven en app.koachclub.cl
function ajustar(txt) {
  return txt
    .replace(/(['"`])\/api\//g, `$1${APP}/api/`)
    .replace(/location\.origin\s*\+\s*'\/app\.html'/g, `'${APP}/app.html'`)
    // el equipo (koach, recepción, admin) no usa la app nativa: va al Dashboard web
    .replace(": '/coach.html')", ": 'https://dashboard.koachclub.cl/coach.html')")
}
function recorrer(dir) {
  for (const n of readdirSync(dir)) {
    const p = join(dir, n)
    if (statSync(p).isDirectory()) recorrer(p)
    else if (['.html', '.js'].includes(extname(p)) && n !== 'koach-native.js') {
      const a = readFileSync(p, 'utf8'), b = ajustar(a)
      if (a !== b) writeFileSync(p, b)
    }
  }
}
recorrer(WWW)

// Puente nativo: primer script del <head>, antes de que se cree el cliente de Supabase
const appHtml = join(WWW, 'app.html')
let h = readFileSync(appHtml, 'utf8')
if (!h.includes('koach-native.js')) h = h.replace(/<head([^>]*)>/i, '<head$1>\n<script src="/koach-native.js"></script>')
writeFileSync(appHtml, h)

let n = 0; (function c(d) { for (const x of readdirSync(d)) { const p = join(d, x); statSync(p).isDirectory() ? c(p) : n++ } })(WWW)
console.log(`www listo: ${n} archivos`)
