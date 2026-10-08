/* ═══ c65 · ASISTENCIA DEL EQUIPO · utilidades comunes (kiosko.html, marcar.html, panel EQUIPO) ═══ */
(function (g) {
  'use strict'
  var SB_URL = 'https://siecbdatfgmqbpxqtvsl.supabase.co'
  var SB_KEY = 'sb_publishable_ffGsmagqocuP1n1jvKUVGw_hVzdojas'

  function cliente () {
    if (g.sb && g.sb.rpc) return g.sb                       // en el dashboard reutiliza el cliente existente
    if (!g.__koachSb) g.__koachSb = g.supabase.createClient(SB_URL, SB_KEY, { auth: { persistSession: true, autoRefreshToken: true } })
    return g.__koachSb
  }

  // Errores del servidor (KA:CODIGO) → voz KOACH
  var MSG = {
    SIN_SESION: ['INICIA SESIÓN', 'Entra con tu cuenta del equipo KOACH para marcar.'],
    NO_ES_STAFF: ['CUENTA SIN ACCESO', 'Esta cuenta no pertenece al equipo KOACH. El control de asistencia es solo para el staff.'],
    QR_INVALIDO: ['QR NO VÁLIDO', 'Este código no corresponde a un QR del club. Escanea el que está en la pantalla de recepción.'],
    QR_USADO: ['QR YA USADO', 'Cada código sirve una sola vez. Escanea el QR nuevo que aparece en pantalla.'],
    QR_VENCIDO: ['QR VENCIDO', 'Este código ya expiró. Escanea el QR que está en pantalla ahora.'],
    DISPOSITIVO_INVALIDO: ['DISPOSITIVO NO RECONOCIDO', 'Tu navegador no permite guardar el registro del equipo. Desactiva el modo incógnito e inténtalo de nuevo.'],
    DISPOSITIVO_NO_AUTORIZADO: ['CELULAR NO AUTORIZADO', 'Solo puedes marcar desde el celular que tienes registrado. Si cambiaste de equipo, pide a administración que libere tu dispositivo.'],
    MARCA_RECIENTE: ['YA MARCASTE', 'Registraste una marca hace menos de un minuto. No es necesario repetirla.'],
    SIN_PERMISO: ['SIN PERMISO', 'Tu rol no permite esta acción.'],
    MOTIVO_REQUERIDO: ['FALTA EL MOTIVO', 'Toda corrección requiere un motivo (mínimo 4 caracteres).'],
    FECHA_FUTURA: ['FECHA NO VÁLIDA', 'No se pueden registrar marcas en el futuro.'],
    FECHA_MUY_ANTIGUA: ['FECHA NO VÁLIDA', 'Solo se pueden corregir marcas de los últimos 62 días.'],
    YA_ANULADA: ['YA ANULADA', 'Esa marca ya estaba anulada.'],
    TURNO_INVALIDO: ['TURNO NO VÁLIDO', 'Revisa que cada turno termine después de comenzar.'],
    RANGO_MAX_93: ['RANGO MUY LARGO', 'Consulta como máximo 3 meses a la vez.'],
    LIBRO_INMUTABLE: ['NO EDITABLE', 'Las marcas no se editan ni se borran: se anulan con motivo.']
  }
  function codigo (err) {
    var m = String((err && (err.message || err)) || '').match(/KA:([A-Z0-9_]+)/)
    return m ? m[1] : null
  }
  function mensaje (err) {
    var c = codigo(err)
    if (c && MSG[c]) return { codigo: c, titulo: MSG[c][0], texto: MSG[c][1] }
    var t = String((err && err.message) || err || '')
    if (/fetch|network|Failed to fetch|NetworkError/i.test(t)) return { codigo: 'RED', titulo: 'SIN CONEXIÓN', texto: 'No hay conexión con el servidor. Revisa el internet e inténtalo de nuevo.' }
    if (/JWT|token|session/i.test(t)) return { codigo: 'SESION', titulo: 'SESIÓN VENCIDA', texto: 'Vuelve a iniciar sesión con tu cuenta.' }
    return { codigo: 'ERROR', titulo: 'NO SE PUDO', texto: 'Ocurrió un problema. Inténtalo de nuevo en unos segundos.' }
  }

  // Identificador estable del dispositivo (vive en este navegador; el servidor guarda solo su hash)
  function dispositivo () {
    var k = 'koach_dispositivo_staff', v = null
    try { v = localStorage.getItem(k) } catch (_) {}
    if (!v || v.length < 32) {
      var a = new Uint8Array(24); (g.crypto || g.msCrypto).getRandomValues(a)
      v = Array.prototype.map.call(a, function (b) { return ('0' + b.toString(16)).slice(-2) }).join('')
      try { localStorage.setItem(k, v) } catch (_) { return null }
    }
    return v
  }

  var TZ = 'America/Santiago'
  function hora (iso, seg) {
    try { return new Date(iso).toLocaleTimeString('es-CL', { timeZone: TZ, hour: '2-digit', minute: '2-digit', second: seg ? '2-digit' : undefined, hour12: false }) } catch (_) { return '—' }
  }
  function fecha (iso, larga) {
    try {
      var d = typeof iso === 'string' && iso.length === 10 ? new Date(iso + 'T12:00:00') : new Date(iso)
      return d.toLocaleDateString('es-CL', larga ? { timeZone: TZ, weekday: 'long', day: 'numeric', month: 'long' } : { timeZone: TZ, weekday: 'short', day: '2-digit', month: '2-digit' })
    } catch (_) { return '—' }
  }
  function hoyISO () {
    var p = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
    return p
  }
  function esc (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] }) }
  function min2h (m) { m = Math.max(0, Math.round(m || 0)); return Math.floor(m / 60) + ' h ' + ('0' + (m % 60)).slice(-2) + ' min' }

  g.KAsist = { cliente: cliente, codigo: codigo, mensaje: mensaje, dispositivo: dispositivo, hora: hora, fecha: fecha, hoyISO: hoyISO, esc: esc, min2h: min2h, TZ: TZ }
})(window)
