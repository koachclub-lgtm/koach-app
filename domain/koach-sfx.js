/* ═══ c240 · SONIDO KOACH ("Señal fría") + ENCENDIDO DEL LOGO ═══
   KSFX  · sonidos de la app desde /sfx (mp3 cortos, 192 KB en total). Usa el mismo AudioContext del descanso (KAU.ctx),
           respeta el ajuste de Perfil (k_sonido) y solo suena tras un toque (regla de iOS/Android).
           Mapa: logo (pantalla de carga) · appear (la app aparece) · start · set · block · tick1-3 + riser (3·2·1) · go · logro (PR, exclusivo de gamificación).
   KLOGO · encendido del logotipo: el VIDEO ORIGINAL de redes (9:16, negro puro #000) en la pantalla de carga. */
(function () {
  var FILES = ['logo', 'appear', 'start', 'set', 'block', 'tick1', 'tick2', 'tick3', 'riser', 'go', 'logro'];
  var raw = {}, buf = {}, fetching = null;
  function ctx() { try { return (typeof KAU !== 'undefined' && KAU.ctx) || null } catch (_) { return null } }
  function on() { try { return typeof kSonidoOn === 'function' ? kSonidoOn() : true } catch (_) { return true } }
  function fetchAll() {
    if (fetching) return fetching;
    fetching = Promise.all(FILES.map(function (n) {
      return fetch('/sfx/' + n + '.mp3').then(function (r) { return r.ok ? r.arrayBuffer() : null }).then(function (a) { if (a) raw[n] = a }).catch(function () {})
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
    play: function (n, delay, gain) {
      if (DUCK[n] && ANDROID && on() && duck(n, delay, gain)) return true;
      var c = ctx(); if (!c || !on()) return false;
      if (!buf[n]) { decodeAll(); return false }
      try {
        if (c.state !== 'running') c.resume();
        var s = c.createBufferSource(), g = c.createGain(); s.buffer = buf[n]; g.gain.value = gain == null ? 1 : gain;
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
  window.KSFX = KSFX; window.KLOGO = KLOGO;
})();
