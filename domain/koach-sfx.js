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
  var KSFX = {
    preload: function () { return decodeAll() },
    ok: function (n) { var c = ctx(); return !!(c && c.state === 'running' && on() && buf[n || 'go']) },
    play: function (n, delay, gain) {
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

  /* c241 · SONIDO FORZADO: los sonidos de KOACH suenan aunque el iPhone esté en silencio (solo manda el volumen).
     iOS 17+: audioSession 'playback'. iOS anterior: un audio HTML mudo en el primer toque saca a Web Audio del canal "ambiente".
     Android ya suena con el volumen multimedia, sin importar el modo silencio/vibración. */
  function forzar() { try { if (navigator.audioSession && navigator.audioSession.type !== 'playback') navigator.audioSession.type = 'playback' } catch (_) {} }
  var SIL = 'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQQAAAAAAAAA', silEl = null;
  function puenteIOS() {
    if (navigator.audioSession || silEl) return;
    if (!/iP(hone|ad|od)|Macintosh/.test(navigator.userAgent) || !('ontouchend' in document)) return;
    try { silEl = new Audio(SIL); silEl.setAttribute('playsinline', ''); silEl.loop = true; silEl.volume = 0.01; var p = silEl.play(); if (p && p.catch) p.catch(function () { silEl = null }) } catch (_) { silEl = null }
  }
  forzar();
  /* desbloqueo del audio en el primer toque de la app (regla de iOS/Android) y decodificación inmediata */
  function unlock() { try { forzar(); puenteIOS(); if (typeof kAudioUnlock === 'function') kAudioUnlock(); KSFX.preload() } catch (_) {} }
  document.addEventListener('visibilitychange', function () { if (!document.hidden) { forzar(); try { var c = ctx(); if (c && c.state !== 'running') c.resume() } catch (_) {} } });
  ['pointerdown', 'touchend', 'click'].forEach(function (ev) { document.addEventListener(ev, unlock, { capture: true, passive: true }) });

  /* ── KLOGO · video original del encendido ── */
  var KLOGO = {
    run: function (sonido) {
      var vs = document.querySelectorAll('video.klv');
      for (var i = 0; i < vs.length; i++) { var v = vs[i]; try { v.currentTime = 0; var p = v.play(); if (p && p.catch) p.catch(function () {}) } catch (_) {} }
      if (sonido) KSFX.play('logo');
    }
  };
  window.KSFX = KSFX; window.KLOGO = KLOGO;
})();
