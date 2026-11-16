/* KOACH · puente nativo v1 (Capacitor). Se empaqueta a www/koach-native.js con esbuild.
   En el navegador no hace nada: window.KN.nativo === false.
   Funciones nativas de la v1:
   · QR de sala ........ KN.qr()                → texto del código o null
   · Cámara ............ KN.foto({ galeria })   → dataURL JPEG o null
   · Aviso de descanso . notificación local al terminar el descanso con la app en segundo plano
   · Push remoto ....... KN.push.registrar()    → token del dispositivo (evento 'koach:push-token')
   · Sin conexión ...... lecturas de Supabase guardadas en el dispositivo + aviso en pantalla
   · Botón atrás Android, barra de estado oscura, splash */
import { Capacitor } from '@capacitor/core'
import { App } from '@capacitor/app'
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera'
import { Network } from '@capacitor/network'
import { LocalNotifications } from '@capacitor/local-notifications'
import { PushNotifications } from '@capacitor/push-notifications'
import { SplashScreen } from '@capacitor/splash-screen'
import { StatusBar, Style } from '@capacitor/status-bar'
import { BarcodeScanner, BarcodeFormat } from '@capacitor-mlkit/barcode-scanning'

const nativo = Capacitor.isNativePlatform()
const KN = (window.KN = { nativo, plataforma: Capacitor.getPlatform(), version: 'koach-native@1.0.0' })

if (nativo) {
  document.documentElement.classList.add('k-nativo', 'k-' + KN.plataforma)
  iniciarSinConexion()
  iniciarSistema()
}

/* ───────── QR ───────── */
KN.qr = async function () {
  if (!nativo) return null
  try {
    if (KN.plataforma === 'android') {
      const { available } = await BarcodeScanner.isGoogleBarcodeScannerModuleAvailable()
      if (!available) { await BarcodeScanner.installGoogleBarcodeScannerModule(); }
    }
    const { barcodes } = await BarcodeScanner.scan({ formats: [BarcodeFormat.QrCode] })
    return (barcodes && barcodes[0] && barcodes[0].rawValue) || null
  } catch (e) { console.warn('[KN.qr]', e); return null }
}

/* ───────── Cámara ───────── */
KN.foto = async function (op) {
  if (!nativo) return null
  try {
    const f = await Camera.getPhoto({ quality: 82, width: 1600, correctOrientation: true, allowEditing: false,
      resultType: CameraResultType.DataUrl, source: op && op.galeria ? CameraSource.Photos : CameraSource.Camera })
    return f.dataUrl || null
  } catch (e) { return null }   // el socio canceló
}

/* ───────── Aviso de fin de descanso (local, sin servidor) ───────── */
const ID_DESCANSO = 4201
async function permisoAvisos() {
  try { let p = await LocalNotifications.checkPermissions()
    if (p.display === 'prompt' || p.display === 'prompt-with-rationale') p = await LocalNotifications.requestPermissions()
    return p.display === 'granted' } catch (_) { return false }
}
function sonidoOn() { try { return localStorage.getItem('k_sonido') !== '0' } catch (_) { return true } }
async function programarDescanso() {
  const fin = typeof window.kAvisoFin === 'function' ? window.kAvisoFin() : null
  if (!fin || !sonidoOn() || fin - Date.now() < 3000) return
  if (!(await permisoAvisos())) return
  await LocalNotifications.schedule({ notifications: [{ id: ID_DESCANSO, title: 'Descanso terminado',
    body: 'Tu siguiente set está listo. Vuelve a KOACH y sigue.', schedule: { at: new Date(fin), allowWhileIdle: true } }] })
}
function cancelarDescanso() { LocalNotifications.cancel({ notifications: [{ id: ID_DESCANSO }] }).catch(() => {}) }

/* ───────── Push remoto (token; el guardado en base queda para cuando exista la tabla) ───────── */
KN.push = {
  async registrar() {
    if (!nativo) return null
    let p = await PushNotifications.checkPermissions()
    if (p.receive === 'prompt' || p.receive === 'prompt-with-rationale') p = await PushNotifications.requestPermissions()
    if (p.receive !== 'granted') return null
    return new Promise((ok) => {
      PushNotifications.addListener('registration', (t) => {
        try { localStorage.setItem('k_push_token', t.value) } catch (_) {}
        window.dispatchEvent(new CustomEvent('koach:push-token', { detail: { token: t.value, plataforma: KN.plataforma } }))
        ok(t.value)
      })
      PushNotifications.addListener('registrationError', () => ok(null))
      PushNotifications.register()
    })
  },
}

/* ───────── Sistema ───────── */
function iniciarSistema() {
  StatusBar.setStyle({ style: Style.Dark }).catch(() => {})
  if (KN.plataforma === 'android') StatusBar.setBackgroundColor({ color: '#000000' }).catch(() => {})
  window.addEventListener('load', () => setTimeout(() => SplashScreen.hide().catch(() => {}), 150))

  App.addListener('backButton', ({ canGoBack }) => {
    const abierto = document.querySelector('[aria-modal="true"]:not([hidden]), .modal.on, .sheet.on')
    if (abierto && typeof window.cerrarModal === 'function') return window.cerrarModal()
    if (canGoBack || location.hash) return history.back()
    App.minimizeApp()
  })

  // descanso: al pasar a segundo plano se programa el aviso; al volver se cancela
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') programarDescanso().catch(() => {})
    else cancelarDescanso()
  })
  // el permiso se pide en el primer descanso (viene de un toque del socio)
  window.addEventListener('load', () => {
    // cerrar sesión borra también la copia sin conexión (lo promete la política de privacidad)
    const salirOrig = window.salir
    if (typeof salirOrig === 'function') window.salir = function () {
      try { indexedDB.deleteDatabase('koach-offline') } catch (_) {}
      try { localStorage.removeItem('k_push_token') } catch (_) {}
      return salirOrig.apply(this, arguments)
    }
    const orig = window.kAvisoPreparar
    if (typeof orig === 'function') window.kAvisoPreparar = function () { permisoAvisos(); }
  })

  // tocar una notificación abre la app donde estaba
  LocalNotifications.addListener('localNotificationActionPerformed', () => {})
  PushNotifications.addListener('pushNotificationActionPerformed', (a) => {
    const u = a && a.notification && a.notification.data && a.notification.data.url
    if (u && u.startsWith('/')) location.href = u
  })
}

/* ───────── Sin conexión ─────────
   Cada lectura (GET) a Supabase que sale bien se guarda en el dispositivo (IndexedDB).
   Si no hay señal, la misma lectura responde con lo último guardado.
   Las escrituras NO se encolan en esta versión: sin señal, la app avisa y no finge que guardó. */
function iniciarSinConexion() {
  const DB = 'koach-offline', ST = 'r'
  const abrir = () => new Promise((ok, mal) => { const q = indexedDB.open(DB, 1)
    q.onupgradeneeded = () => q.result.createObjectStore(ST); q.onsuccess = () => ok(q.result); q.onerror = () => mal(q.error) })
  const tx = async (modo, fn) => { const db = await abrir(); return new Promise((ok, mal) => {
    const t = db.transaction(ST, modo), s = t.objectStore(ST), r = fn(s); t.oncomplete = () => ok(r && r.result); t.onerror = () => mal(t.error) }) }
  const guardar = (k, v) => tx('readwrite', (s) => s.put(v, k)).catch(() => {})
  const leer = (k) => tx('readonly', (s) => s.get(k)).catch(() => null)

  const esSupabase = (u) => /\.supabase\.co\/(rest|storage)\/v1\//.test(u)
  const usuario = () => { try { for (const k of Object.keys(localStorage)) if (/^sb-.*-auth-token$/.test(k)) {
    const s = JSON.parse(localStorage.getItem(k)); return (s && s.user && s.user.id) || 'anon' } } catch (_) {} return 'anon' }

  const fetchOrig = window.fetch.bind(window)
  window.fetch = async function (input, init) {
    const url = typeof input === 'string' ? input : (input && input.url) || ''
    const metodo = ((init && init.method) || (input && input.method) || 'GET').toUpperCase()
    if (metodo !== 'GET' || !esSupabase(url) || /\/storage\/v1\/object\/(?!public)/.test(url)) {
      if (metodo !== 'GET' && esSupabase(url) && KN.enLinea === false) avisoEscritura()
      return fetchOrig(input, init)
    }
    const clave = usuario() + '|' + url
    try {
      const r = await fetchOrig(input, init)
      if (r.ok && !/\/storage\//.test(url)) r.clone().text().then((body) => guardar(clave, {
        body, status: r.status, ct: r.headers.get('content-type') || 'application/json',
        cr: r.headers.get('content-range') || '', t: Date.now() })).catch(() => {})
      return r
    } catch (e) {
      const c = await leer(clave)
      if (!c) throw e
      const h = { 'content-type': c.ct, 'x-koach-offline': String(c.t) }; if (c.cr) h['content-range'] = c.cr
      return new Response(c.body, { status: c.status, headers: h })
    }
  }

  // aviso en pantalla (gris, sin colores de fondo; rojo naranjo solo en el contorno)
  const css = document.createElement('style')
  css.textContent = '#kOff{position:fixed;left:12px;right:12px;top:calc(env(safe-area-inset-top,0px) + 8px);z-index:99999;' +
    'padding:10px 14px;border-radius:12px;background:rgba(67,70,73,.92);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);' +
    'border:1px solid #FF4200;color:#fff;font:600 12px/1.35 "Space Mono",ui-monospace,monospace;letter-spacing:.02em;' +
    'transform:translateY(-140%);transition:transform .35s ease}#kOff.on{transform:none}'
  const pintar = (on, txt) => {
    let b = document.getElementById('kOff')
    if (!b) { if (!document.body) return; b = document.createElement('div'); b.id = 'kOff'; b.setAttribute('role', 'status'); document.body.appendChild(b) }
    if (txt) b.textContent = txt
    b.classList.toggle('on', on)
  }
  let tAviso = 0
  function avisoEscritura() { pintar(true, 'SIN CONEXIÓN · ESTE CAMBIO NO SE GUARDÓ. INTÉNTALO AL VOLVER LA SEÑAL.'); clearTimeout(tAviso); tAviso = setTimeout(() => KN.enLinea && pintar(false), 4000) }
  const estado = (on) => { KN.enLinea = on; pintar(!on, 'SIN CONEXIÓN · ESTÁS VIENDO TUS ÚLTIMOS DATOS GUARDADOS') }
  document.addEventListener('DOMContentLoaded', () => { document.head.appendChild(css)
    Network.getStatus().then((s) => estado(s.connected)).catch(() => {}) })
  Network.addListener('networkStatusChange', (s) => estado(s.connected))
}
