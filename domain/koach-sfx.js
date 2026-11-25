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
    /* c348 · SINCRONÍA: si el sonido ya está decodificado se programa en el reloj de audio (preciso al milisegundo), también en Android.
       El audio del sistema (duck) queda solo de respaldo: tarda 100–300 ms en partir y desfasaba el logo y el DROP del PR.
       Si el contexto estaba suspendido, se espera a que despierte y se descuenta el tiempo perdido (nunca suena tarde). */
    play: function (n, delay, gain, rate) {
      var c = ctx(), listo = !!(c && buf[n]);
      if (!listo && DUCK[n] && ANDROID && on() && duck(n, delay, gain)) return true;
      if (!c || !on()) return false;
      if (!buf[n]) { decodeAll(); return false }
      try {
        var t0 = performance.now(), d = delay || 0, b = buf[n];
        var arranca = function () {
          var pas = (performance.now() - t0) / 1000, s = c.createBufferSource(), g = c.createGain();
          s.buffer = b; if (rate) s.playbackRate.value = rate; g.gain.value = gain == null ? 1 : gain;
          s.connect(g); g.connect(c.destination);
          var falta = d - pas;
          if (falta >= 0) s.start(c.currentTime + 0.005 + falta);
          else { var off = -falta * (rate || 1); if (off < b.duration - 0.05) s.start(c.currentTime + 0.005, off) }
        };
        if (c.state !== 'running') { var p = c.resume(); if (p && p.then) p.then(arranca, function () {}); else arranca() } else arranca();
        return true;
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
  /* c349 · LOGO + SONIDO SIMULTÁNEOS en toda pantalla con el logo (inicio y transiciones).
     El sonido no se dispara "al llamar": se amarra al PRIMER CUADRO que el video realmente pinta (requestVideoFrameCallback)
     y parte en ese mismo punto del archivo. Si el video se queda cargando, el sonido se detiene y retoma en el punto del video.
     Con el audio ya activo (tras un toque) usa el reloj de audio, exacto; si no, un audio precargado que se corrige solo. */
  var LOGO_A = null, LOGO_V = null, LOGO_S = null;
  function logoPre() { if (!LOGO_A) { try { LOGO_A = new Audio('/sfx/logo.mp3'); LOGO_A.preload = 'auto'; LOGO_A.load() } catch (_) { LOGO_A = null } } return LOGO_A }
  if (on()) logoPre();
  function logoStop() {
    try { if (LOGO_S) { LOGO_S.stop() } } catch (_) {} LOGO_S = null;
    try { if (LOGO_A && !LOGO_A.paused) LOGO_A.pause() } catch (_) {}
  }
  function logoDesde(t, gain) {
    logoStop(); if (!on()) return;
    var c = ctx();
    if (c && c.state === 'running' && buf.logo) {
      if (t >= buf.logo.duration - 0.05) return;
      try { var s = c.createBufferSource(), g = c.createGain(); s.buffer = buf.logo; g.gain.value = gain == null ? 1 : gain; s.connect(g); g.connect(c.destination); s.start(c.currentTime, Math.max(0, t)); LOGO_S = s } catch (_) {}
      return;
    }
    var a = logoPre(); if (!a) return;
    try {
      a.volume = gain == null ? 1 : gain; a.currentTime = Math.max(0, t);
      a.addEventListener('playing', function () { try { var v = LOGO_V; if (v && Math.abs(v.currentTime - a.currentTime) > 0.05) a.currentTime = Math.max(0, v.currentTime + 0.03) } catch (_) {} }, { once: true });
      var p = a.play(); if (p && p.catch) p.catch(function () {});
    } catch (_) {}
  }
  function logoSync(v, gain) {
    if (!v || !on()) return;
    LOGO_V = v; logoStop();
    var tok = (logoSync.tok = (logoSync.tok || 0) + 1);
    var arrancar = function (t) { if (tok !== logoSync.tok || LOGO_V !== v) return; logoDesde(t, gain) };
    var primero = function () {
      if (v.requestVideoFrameCallback) v.requestVideoFrameCallback(function (_n, m) { arrancar((m && m.mediaTime) || v.currentTime) });
      else arrancar(v.currentTime);
    };
    if (!v.paused && v.readyState >= 3 && v.currentTime > 0) primero(); else v.addEventListener('playing', primero, { once: true });
    if (!v._kLogoW) { v._kLogoW = 1
      v.addEventListener('waiting', function () { if (LOGO_V === v) logoStop() });
      v.addEventListener('playing', function () { if (LOGO_V === v && v.currentTime > 0.05 && !LOGO_S && LOGO_A && LOGO_A.paused) logoDesde(v.currentTime, gain) });
      v.addEventListener('ended', function () { if (LOGO_V === v) { LOGO_V = null } });
    }
  }
  KSFX.logoSync = logoSync; KSFX.logoStop = logoStop;
  function splashSonido() {
    var v = document.querySelector('#oAuth video.klv'); if (!v || splashSonido.hecho) return; splashSonido.hecho = true;
    if (v.currentTime < 1.2) logoSync(v);
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
