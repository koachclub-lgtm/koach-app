/* ═══ c240 · SONIDO KOACH ("Señal fría") + ENCENDIDO DEL LOGO ═══
   KSFX  · sonidos de la app desde /sfx (mp3 cortos, 192 KB en total). Usa el mismo AudioContext del descanso (KAU.ctx),
           respeta el ajuste de Perfil (k_sonido) y solo suena tras un toque (regla de iOS/Android).
           Mapa: logo (pantalla de carga) · appear (la app aparece) · start · set · block · tick1-3 + riser (3·2·1) · go · logro (PR, exclusivo de gamificación).
   KLOGO · encendido del logotipo: el VIDEO ORIGINAL de redes (9:16, negro puro #000) en la pantalla de carga. */
(function () {
  var FILES = ['logo', 'menu', 'datos', 'bloque-ini', 'scan-captura', 'scan-paso', 'scan-lock', 'scan-datos', 'scan-lista', 'scan-error', 'appear', 'start', 'set', 'block', 'tick1', 'tick2', 'tick3', 'riser', 'go', 'logro', 'placa'];
  var raw = {}, buf = {}, fetching = null;
  function ctx() { try { return (typeof KAU !== 'undefined' && KAU.ctx) || null } catch (_) { return null } }
  function on() { try { return typeof kSonidoOn === 'function' ? kSonidoOn() : true } catch (_) { return true } }
  function fetchAll() {
    if (fetching) return fetching;
    fetching = Promise.all(FILES.map(function (n) {
      return fetch('/sfx/' + n + (n === 'scan-datos' ? '.wav' : '.mp3')).then(function (r) { return r.ok ? r.arrayBuffer() : null }).then(function (a) { if (a) raw[n] = a }).catch(function () {})
    }));
    return fetching;
  }
  function decodeAll() {
    var c = ctx(); if (!c) return Promise.resolve();
    return fetchAll().then(function () {
      return Promise.all(Object.keys(raw).map(function (n) {
        if (buf[n]) return null;
        var a = raw[n]; raw[n] = null; if (!a) return null;
        return new Promise(function (res) { c.decodeAudioData(a, function (b) { buf[n] = b; res() }, function () { res() }) });
      }));
    });
  }
  /* c243 · MOMENTOS PRINCIPALES (logo, PR, cuenta regresiva, GO): en Android suenan como audio corto del sistema, y Android
     BAJA el volumen de Spotify mientras suenan y lo devuelve al terminar (foco "transitorio con atenuación" de Chrome para audios
     de menos de 5 s). El resto de los botones sigue por Web Audio, mezclado sin tocar la música.
     En iPhone la web no puede atenuar otras apps: ahí todo se mezcla. */
  var ANDROID = /Android/i.test(navigator.userAgent);
  var DUCK = { logo: 1, logro: 1, riser: 1, go: 1 }, els = {};
  function el(n) { if (!els[n]) { var a = new Audio('/sfx/' + n + '.mp3'); a.preload = 'auto'; els[n] = a } return els[n] }
  if (ANDROID) Object.keys(DUCK).forEach(el);
  function duck(n, delay, gain) {
    try {
      var a = el(n); a.volume = Math.max(0, Math.min(1, gain == null ? 1 : gain));
      var go = function () { try { a.pause(); a.currentTime = 0 } catch (_) {} var p = a.play(); if (p && p.catch) p.catch(function () {}) };
      if (delay) setTimeout(go, delay * 1000); else go();
      return true;
    } catch (_) { return false }
  }
  var KSFX = {
    preload: function () { return decodeAll() },
    ok: function (n) { var c = ctx(); return !!(c && c.state === 'running' && on() && buf[n || 'go']) },
    /* c245 · lecho en loop (escáner): entra y sale con fundido; devuelve una función para detenerlo */
    loop: function (n, gain) {
      var c = ctx(); if (!c || !on() || !buf[n]) { decodeAll(); return function () {} }
      try {
        if (c.state !== 'running') c.resume();
        var s = c.createBufferSource(), g = c.createGain(), t = c.currentTime, G = gain == null ? 1 : gain;
        s.buffer = buf[n]; s.loop = true; g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(G, t + 0.3);
        s.connect(g); g.connect(c.destination); s.start(t);
        return function () { try { var u = c.currentTime; g.gain.cancelScheduledValues(u); g.gain.setValueAtTime(g.gain.value, u); g.gain.linearRampToValueAtTime(0, u + 0.18); s.stop(u + 0.2) } catch (_) {} };
      } catch (_) { return function () {} }
    },
    play: function (n, delay, gain, rate) {
      if (DUCK[n] && ANDROID && on() && duck(n, delay, gain)) return true;
      var c = ctx(); if (!c || !on()) return false;
      if (!buf[n]) { decodeAll(); return false }
      try {
        if (c.state !== 'running') c.resume();
        var s = c.createBufferSource(), g = c.createGain(); s.buffer = buf[n]; if (rate) s.playbackRate.value = rate; g.gain.value = gain == null ? 1 : gain;
        s.connect(g); g.connect(c.destination); s.start(c.currentTime + 0.005 + (delay || 0)); return true;
      } catch (_) { return false }
    }
  };
  fetchAll();   // descarga liviana en segundo plano; se decodifica al primer toque

  /* c242 · los sonidos se MEZCLAN con la música del cliente (nunca la cortan). iOS: sesión 'ambient'.
     (c241 forzaba 'playback' para saltarse el silencio del iPhone, pero en iOS eso pausa Spotify: se descarta.) */
  function forzar() { try { if (navigator.audioSession && navigator.audioSession.type !== 'ambient') navigator.audioSession.type = 'ambient' } catch (_) {} }
  function puenteIOS() {}
  forzar();
  /* desbloqueo del audio en el primer toque de la app (regla de iOS/Android) y decodificación inmediata */
  function unlock() { try { forzar(); puenteIOS(); if (typeof kAudioUnlock === 'function') kAudioUnlock(); KSFX.preload() } catch (_) {} }
  document.addEventListener('visibilitychange', function () { if (!document.hidden) { forzar(); try { var c = ctx(); if (c && c.state !== 'running') c.resume() } catch (_) {} } });
  ['pointerdown', 'touchend', 'click'].forEach(function (ev) { document.addEventListener(ev, unlock, { capture: true, passive: true }) });

  /* ── KLOGO · video original del encendido ── */
  var KLOGO = {
    fin: Promise.resolve(),
    /* c242 · arranca el encendido en la pantalla de carga. Si el splash inicial (#oAuth) ya lo venía mostrando,
       continúa desde ese punto (no se reinicia a la mitad). KLOGO.fin se cumple cuando el logo terminó de armarse. */
    run: function (sonido) {
      var v = document.querySelector('#oLoad video.klv'); if (!v) { KLOGO.fin = Promise.resolve(); return }
      var a = document.querySelector('#oAuth video.klv'), desde = 0;
      try { if (a && a.offsetParent !== null && !a.ended && a.currentTime > 0) desde = a.currentTime } catch (_) {}
      KLOGO.fin = new Promise(function (res) {
        var listo = false, fin = function () { if (!listo) { listo = true; v.removeEventListener('ended', fin); res() } };
        v.addEventListener('ended', fin);
        setTimeout(fin, Math.max(400, 3200 - desde * 1000));          // tope por si el video no puede reproducirse
        try { v.currentTime = desde; var p = v.play(); if (p && p.catch) p.catch(fin) } catch (_) { fin() }
      });
      if (sonido && desde < 0.15) KSFX.play('logo');
    }
  };
  /* c244 · SONIDO AL ABRIR: el logo del splash inicial intenta sonar junto con su video. El navegador solo lo permite sin un toque
     previo cuando la app está instalada en la pantalla de inicio (Android) o el sitio ya es de uso frecuente; si no, queda en silencio. */
  function logoEl(desde) {
    if (!on()) return;
    try { var a = new Audio('/sfx/logo.mp3'); a.preload = 'auto'; if (desde) a.currentTime = desde; var p = a.play(); if (p && p.catch) p.catch(function () {}) } catch (_) {}
  }
  function splashSonido() {
    var v = document.querySelector('#oAuth video.klv'); if (!v || splashSonido.hecho) return; splashSonido.hecho = true;
    var ir = function () { if (v.offsetParent !== null && v.currentTime < 1.2) logoEl(v.currentTime) };
    if (!v.paused && v.currentTime > 0) ir(); else v.addEventListener('playing', ir, { once: true });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', splashSonido); else splashSonido();
  /* c264 · logo centrado en la PANTALLA, no en el área web: instalada en iPhone con barra de estado negra, la web empieza bajo la barra
     y su centro queda ~30 pt más abajo que el centro físico. Se sube la mitad de esa diferencia. */
  function centrar() { try {
    var sa = matchMedia('(display-mode: standalone)').matches || navigator.standalone === true
    var d = sa ? Math.max(0, Math.min(80, (screen.height - innerHeight) / 2)) : 0
    if (sa && innerWidth > innerHeight) d = 0
    document.documentElement.style.setProperty('--klvUp', d + 'px') } catch (_) {} }
  centrar(); addEventListener('resize', centrar); addEventListener('orientationchange', centrar)
  window.KSFX = KSFX; window.KLOGO = KLOGO;
})();
