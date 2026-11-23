/* KOACH · RUN CLUB — challenge permanente del 1% CLUB.
   Registra la ruta de carrera con el GPS del teléfono (app abierta y pantalla encendida), la limpia con KRuta
   y la guarda en Supabase (club_run_guardar). Racha = semanas seguidas con ≥1 carrera válida; distancia acumulada.
   Se monta dentro de la vista 1% CLUB (KCLUB llama a KRUN.montar). */
(function () {
  'use strict'
  var R = { st: null, pts: [], watch: null, t0: null, tick: null, wl: null, ult: 0, guardadoAt: 0, res: null, acc: null, err: null }
  var LS = 'kr_run_v1'
  function $(id) { return document.getElementById(id) }
  function esc(t) { return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] }) }
  function cli() { try { return sb } catch (_) { return null } }
  function perfil() { try { return S && S.perfil } catch (_) { return null } }
  function snd(n, g) { try { kAudioUnlock(); window.KSFX && KSFX.play(n, 0, g == null ? .8 : g) } catch (_) {} }
  function aviso(m) { try { toast(m) } catch (_) { alert(m) } }
  function nombre() { return String((perfil() && perfil().nombre) || '').trim().split(/\s+/)[0].toUpperCase() }
  function reloj(s) { s = Math.max(0, Math.floor(s)); var h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), x = s % 60
    return (h ? h + ':' + String(m).padStart(2, '0') : String(m).padStart(2, '0')) + ':' + String(x).padStart(2, '0') }
  function ritmo(min) { if (min == null || !isFinite(min)) return '--:--'; var s = Math.round(min * 60); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0') }
  function km(n) { return (Math.round((n || 0) * 10) / 10).toLocaleString('es-CL', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) }
  var MES = ['ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO', 'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE']
  var LOGO = '<img class="krLogo" src="/img/brand/logotipo-koach.png" alt="KOACH">'
  var CHECK = '<svg viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="29" fill="none" stroke="#3EC6B0" stroke-width="3"/><path d="M19 33l9 9 17-19" fill="none" stroke="#3EC6B0" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg>'

  var css = `
.krCard{position:relative;margin:16px 0 4px;padding:18px 16px 16px;border-radius:16px;background:linear-gradient(180deg,#1C1E21 0%,#141518 100%);border:1px solid rgba(255,255,255,.12);overflow:hidden}
.krCard:before{content:'';position:absolute;inset:0;background:repeating-linear-gradient(90deg,rgba(255,255,255,.035) 0 1px,transparent 1px 22px);pointer-events:none}
.krHd{position:relative;display:flex;justify-content:space-between;font:700 9px/1 'Space Mono','Space Mono Fallback',monospace;letter-spacing:.18em;color:#979C9F}
.krHd span:first-child{color:#3EC6B0}
.krT{position:relative;margin:12px 0 0;font:900 44px/.9 'KOACH Display','KOACH Display Fallback',sans-serif;font-stretch:115%;letter-spacing:-.01em;color:#F2F2F2;transform:skewX(-8deg);transform-origin:left}
.krD{position:relative;margin:10px 0 0;font:600 13.5px/1.45 'KOACH Display',sans-serif;color:#D5D7D9;max-width:330px}
.krSt{position:relative;display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:14px}
.krSt div{border:1px solid rgba(255,255,255,.14);border-radius:10px;padding:10px 8px;background:rgba(0,0,0,.25)}
.krSt b{display:block;font:900 24px/1 'KOACH Display',sans-serif;color:#F2F2F2}
.krSt b small{font:700 10px/1 'Space Mono',monospace;color:#979C9F;margin-left:3px}
.krSt span{display:block;margin-top:6px;font:700 8px/1.3 'Space Mono',monospace;letter-spacing:.12em;color:#979C9F}
.krSem{position:relative;margin-top:12px;font:700 9px/1.5 'Space Mono',monospace;letter-spacing:.12em;color:#B9BCBF}
.krSem.ok{color:#3EC6B0}
.krCard .kcB{position:relative;margin-top:14px}
.krCard .kcRow{position:relative}
.krRk{position:relative;margin-top:16px}
.krRk .kcSec{margin:0 0 8px}
.krCard .kcRow.t1 .p{color:#F2F2F2}
.krO{position:fixed;inset:0;z-index:97;display:none;flex-direction:column;overflow:auto;color:#F2F2F2;background:linear-gradient(180deg,#0B0C0E 0%,#1A1C1F 60%,#26292D 100%);font-family:'KOACH Display','KOACH Display Fallback',system-ui,sans-serif}
.krO.on{display:flex}
.krIn{flex:1;display:flex;flex-direction:column;align-items:center;text-align:center;padding:calc(18px + env(safe-area-inset-top,0px)) 22px calc(22px + env(safe-area-inset-bottom,0px));box-sizing:border-box}
.krLogo{height:18px;width:auto;opacity:.95}
.krK{margin:22px 0 0;font:700 10px/1 'Space Mono',monospace;letter-spacing:.24em;color:#3EC6B0}
.krBig{margin:18px 0 0;font:900 clamp(96px,32vw,160px)/.85 'KOACH Display',sans-serif;letter-spacing:-.03em;font-variant-numeric:tabular-nums}
.krBig small{display:block;margin-top:10px;font:700 13px/1 'Space Mono',monospace;letter-spacing:.3em;color:#979C9F}
.krGr{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;width:100%;max-width:400px;margin-top:26px}
.krGr div{border:1px solid rgba(255,255,255,.14);border-radius:10px;padding:12px 6px;background:rgba(255,255,255,.04)}
.krGr b{display:block;font:900 24px/1 'KOACH Display',sans-serif;font-variant-numeric:tabular-nums}
.krGr span{display:block;margin-top:6px;font:700 8px/1 'Space Mono',monospace;letter-spacing:.14em;color:#979C9F}
.krGps{margin-top:16px;font:700 9px/1.6 'Space Mono',monospace;letter-spacing:.12em;color:#979C9F;text-transform:uppercase}
.krGps i{display:inline-block;width:8px;height:8px;border-radius:50%;background:#6F7377;margin-right:6px;vertical-align:0}
.krGps.ok i{background:#3EC6B0;box-shadow:0 0 8px #3EC6B0}.krGps.mal i{background:#FF4200}
.krTx{margin:14px 0 0;max-width:330px;font:700 10px/1.7 'Space Mono',monospace;letter-spacing:.08em;color:#B9BCBF;text-transform:uppercase}
.krH1{margin:18px 0 0;font:900 30px/1.02 'KOACH Display',sans-serif;font-stretch:115%;text-transform:uppercase}
.krFirma{margin:10px 0 0;font:600 16px/1.4 'KOACH Display',sans-serif;color:#D5D7D9}
.krChk{width:76px;height:76px;margin-top:26px}
.krChk svg{width:100%;height:100%}
@media (prefers-reduced-motion:no-preference){.krChk svg path{stroke-dasharray:40;stroke-dashoffset:40;animation:krDraw .5s ease-out .2s forwards}.krChk svg circle{transform-origin:32px 32px;animation:krPop .45s cubic-bezier(.2,1.4,.4,1)}}
@keyframes krDraw{to{stroke-dashoffset:0}}@keyframes krPop{from{transform:scale(.6)}to{transform:none}}
.krAct{width:100%;max-width:400px;margin-top:auto;padding-top:24px;display:flex;flex-direction:column;gap:10px}
.krO .kcB{appearance:none;border:0;border-radius:10px;height:54px;width:100%;font:700 13px/1 'Space Mono','Space Mono Fallback',monospace;letter-spacing:.16em;cursor:pointer}
.krO .kcB--p{background:#F2F2F2;color:#0B0C0E;box-shadow:0 0 0 1px #3EC6B0}
.krO .kcB--s{background:transparent;color:#F2F2F2;border:1px solid rgba(255,255,255,.28)}
.krO .kcB--f{background:transparent;color:#FF4200;border:1px solid #FF4200}
.krO .kcB--t{background:transparent;color:#979C9F;height:40px;font-size:11px}
`
  function estilos() { if ($('krCss')) return; var s = document.createElement('style'); s.id = 'krCss'; s.textContent = css; document.head.appendChild(s) }

  async function rpc(n, a) { var r = await cli().rpc(n, a || {}); if (r.error) throw r.error; return r.data }
  async function cargar() { try { R.st = await rpc('club_run_estado') } catch (e) { console.error('club_run_estado', e) } return R.st }

  /* ── tarjeta dentro de la vista 1% CLUB ── */
  function cardHTML() {
    var s = R.st || {}, racha = s.racha_semanas || 0, mes = MES[new Date().getMonth()]
    var sem = s.semana_ok ? '<p class="krSem ok">✓ ESTA SEMANA YA CORRISTE · RACHA AL DÍA</p>'
      : racha ? '<p class="krSem">UNA CARRERA ESTA SEMANA Y TU RACHA SUBE A ' + (racha + 1) + '</p>'
      : '<p class="krSem">TU PRIMERA CARRERA ABRE TU RACHA</p>'
    var rk = (s.ranking || []), top = rk.slice(0, 5), yo = rk.filter(function (x) { return x.yo && x.pos > 5 })[0]
    var filas = top.concat(yo ? [yo] : []).map(function (x) {
      return '<div class="kcRow' + (x.yo ? ' yo' : '') + (x.pos <= 3 ? ' t' + x.pos : '') + '"><span class="p">' + String(x.pos).padStart(2, '0') + '</span>' + av(x.avatar, x.nombre) +
        '<span class="n">' + esc(x.nombre) + '<small>' + x.n + (x.n === 1 ? ' CARRERA' : ' CARRERAS') + '</small></span><span class="s">' + km(x.km) + '</span></div>' }).join('')
    return '<div class="krHd"><span>CHALLENGE PERMANENTE</span><span>GPS</span></div>' +
      '<h2 class="krT">RUN CLUB</h2>' +
      '<p class="krD">Sal a correr con la app abierta: registramos tu ruta y la distancia. Una carrera por semana mantiene tu racha.</p>' +
      '<div class="krSt"><div><b>' + racha + '<small>SEM</small></b><span>RACHA</span></div><div><b>' + km(s.km_total) + '<small>KM</small></b><span>DISTANCIA TOTAL</span></div><div><b>' + (s.carreras || 0) + '</b><span>CARRERAS</span></div></div>' + sem +
      '<button class="kcB kcB--p" type="button" onclick="KRUN.abrir()">INICIAR CARRERA</button>' +
      '<div class="krRk"><div class="kcSec"><span>KM · ' + mes + '</span><span>' + (s.km_mes ? 'TÚ · ' + km(s.km_mes) + ' KM' : '') + '</span></div>' +
      (filas || '<div class="kcVac">NADIE HA CORRIDO ESTE MES. LA PRIMERA CARRERA PUEDE SER LA TUYA.</div>') + '</div>'
  }
  function av(path, n) { try { if (window.KAvatar) return KAvatar.html(path, n, 'kcAv') } catch (_) {} return '<span class="kcAv">' + esc(String(n || 'K')[0]) + '</span>' }
  function montar(v) {
    estilos(); if (!v) return
    var c = v.querySelector('#krCard'); if (!c) { c = document.createElement('section'); c.id = 'krCard'; c.className = 'krCard' }
    var body = v.querySelector('.kcBody')
    if (body) { // después del ranking del challenge activo y antes del feed EN VIVO
      var secs = [].filter.call(body.children, function (x) { return x.classList.contains('kcSec') }), ref = secs[1] || null
      if (c.parentNode !== body || c.nextSibling !== ref) body.insertBefore(c, ref) } else { var w = document.createElement('div'); w.className = 'kcBody'; w.appendChild(c); v.appendChild(w) }
    var h = cardHTML(); if (c._h !== h) { c.innerHTML = h; c._h = h }
    if (!R.st && !R.cargando) { R.cargando = true; cargar().then(function () { R.cargando = false; if (R.st) montar(v) }) }
  }
  function repintar() { var v = $('vClub'); if (v && v.classList.contains('on')) montar(v) }

  /* ── grabador ── */
  function el() { estilos(); var o = $('krO'); if (!o) { o = document.createElement('div'); o.id = 'krO'; o.className = 'krO'; o.setAttribute('role', 'dialog'); o.setAttribute('aria-modal', 'true'); document.body.appendChild(o) } return o }
  function pintar(cuerpo, acciones) { var o = el(); o.innerHTML = '<div class="krIn">' + LOGO + cuerpo + '<div class="krAct">' + acciones + '</div></div>'; o.classList.add('on') }
  function cerrar() { var o = $('krO'); if (o) o.classList.remove('on') }
  async function wake(on) { try { if (on && navigator.wakeLock) R.wl = await navigator.wakeLock.request('screen'); else if (!on && R.wl) { R.wl.release(); R.wl = null } } catch (_) {} }
  document.addEventListener('visibilitychange', function () { if (!document.hidden && R.watch != null) wake(true) })

  function pendiente() { try { var x = JSON.parse(localStorage.getItem(LS) || 'null'); if (x && x.t0 && Date.now() - x.t0 < 6 * 3600e3 && Array.isArray(x.p)) return x } catch (_) {} return null }
  function persistir(force) { if (!force && Date.now() - R.guardadoAt < 10000) return; R.guardadoAt = Date.now()
    try { localStorage.setItem(LS, JSON.stringify({ t0: R.t0, p: R.pts.map(function (p) { return [+p.lat.toFixed(6), +p.lng.toFixed(6), p.t, Math.round(p.acc || 0)] }) })) } catch (_) {} }
  function limpiarLS() { try { localStorage.removeItem(LS) } catch (_) {} }

  function abrir() {
    if (R.watch != null) { pintarVivo(); return }
    var p = pendiente()
    if (p) {
      pintar('<p class="krK">RUN CLUB</p><h2 class="krH1">Tienes una carrera sin terminar</h2><p class="krTx">EMPEZÓ HACE ' + reloj((Date.now() - p.t0) / 1000) + '. PUEDES RETOMARLA O DESCARTARLA.</p>',
        '<button class="kcB kcB--p" type="button" onclick="KRUN._retomar()">RETOMAR CARRERA</button><button class="kcB kcB--s" type="button" onclick="KRUN._terminarPend()">TERMINAR Y REVISAR</button><button class="kcB kcB--t" type="button" onclick="KRUN._descartar()">DESCARTAR</button>')
      return
    }
    if (!('geolocation' in navigator)) { aviso('Este teléfono no permite usar el GPS desde el navegador.'); return }
    pintar('<p class="krK">1% CLUB · CHALLENGE</p><h2 class="krH1" style="font-size:46px;transform:skewX(-8deg)">RUN CLUB</h2>' +
      '<p class="krFirma">Registramos tu ruta con el GPS y guardamos la distancia.</p>' +
      '<p class="krTx">MANTÉN LA APP ABIERTA Y LA PANTALLA ENCENDIDA MIENTRAS CORRES. CUENTA DESDE 300 M Y 3 MINUTOS.</p>',
      '<button class="kcB kcB--p" type="button" onclick="KRUN._iniciar()">INICIAR CARRERA</button><button class="kcB kcB--t" type="button" onclick="KRUN.cerrar()">AHORA NO</button>')
  }
  function iniciar(retomar) {
    var p = retomar ? pendiente() : null
    R.pts = p ? p.p.map(function (a) { return { lat: a[0], lng: a[1], t: a[2], acc: a[3] } }) : []
    R.t0 = p ? p.t0 : Date.now(); R.acc = null; R.err = null; R.ult = 0; R.res = null
    try { R.watch = navigator.geolocation.watchPosition(punto, errorGps, { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 }) }
    catch (e) { aviso('No se pudo iniciar el GPS.'); return }
    wake(true); snd('go'); try { navigator.vibrate && navigator.vibrate(60) } catch (_) {}
    persistir(true); pintarVivo()
    clearInterval(R.tick); R.tick = setInterval(actualizar, 1000)
  }
  function punto(pos) {
    var c = pos.coords, t = pos.timestamp || Date.now(); R.acc = c.accuracy; R.err = null
    var u = R.pts[R.pts.length - 1]; if (u && t - u.t < 1000) return
    R.pts.push({ lat: c.latitude, lng: c.longitude, t: t, acc: c.accuracy })
    persistir(false)
  }
  function errorGps(e) {
    R.err = e && e.code === 1 ? 'PERMISO' : 'SEÑAL'
    if (R.err === 'PERMISO') { parar(); pintar('<p class="krK">RUN CLUB</p><h2 class="krH1">Activa la ubicación</h2><p class="krTx">PERMITE EL ACCESO A LA UBICACIÓN PARA KOACH EN TU NAVEGADOR Y VUELVE A INTENTARLO.</p>',
      '<button class="kcB kcB--p" type="button" onclick="KRUN.abrir()">REINTENTAR</button><button class="kcB kcB--t" type="button" onclick="KRUN.cerrar()">CERRAR</button>') }
    actualizar()
  }
  function parar() { if (R.watch != null) try { navigator.geolocation.clearWatch(R.watch) } catch (_) {} R.watch = null; clearInterval(R.tick); R.tick = null; wake(false) }

  function pintarVivo() {
    pintar('<p class="krK">RUN CLUB · EN CURSO</p><div class="krBig"><span id="krKm">0,00</span><small>KILÓMETROS</small></div>' +
      '<div class="krGr"><div><b id="krTi">00:00</b><span>TIEMPO</span></div><div><b id="krRi">--:--</b><span>RITMO /KM</span></div><div><b id="krPu">0</b><span>PUNTOS GPS</span></div></div>' +
      '<p class="krGps" id="krGps"><i></i>BUSCANDO SEÑAL GPS…</p><p class="krTx">MANTÉN LA APP ABIERTA Y LA PANTALLA ENCENDIDA.</p>',
      '<button class="kcB kcB--p" type="button" onclick="KRUN._terminar()">TERMINAR CARRERA</button><button class="kcB kcB--t" type="button" onclick="KRUN._cancelar()">CANCELAR</button>')
    actualizar()
  }
  function actualizar() {
    var r = window.KRuta ? KRuta.resumen(R.pts) : null
    var ti = $('krTi'); if (!ti) return
    ti.textContent = reloj((Date.now() - R.t0) / 1000)
    if (r) { $('krKm').textContent = (r.distancia_m / 1000).toFixed(2).replace('.', ','); $('krRi').textContent = ritmo(r.ritmo_min_km); $('krPu').textContent = r.puntos }
    var g = $('krGps'), a = R.acc
    if (g) {
      if (R.err) { g.className = 'krGps mal'; g.innerHTML = '<i></i>SIN SEÑAL GPS · SAL A CIELO ABIERTO' }
      else if (a == null) { g.className = 'krGps'; g.innerHTML = '<i></i>BUSCANDO SEÑAL GPS…' }
      else if (a <= 35) { g.className = 'krGps ok'; g.innerHTML = '<i></i>GPS ACTIVO · ±' + Math.round(a) + ' M' }
      else { g.className = 'krGps mal'; g.innerHTML = '<i></i>SEÑAL DÉBIL · ±' + Math.round(a) + ' M' }
    }
  }

  function terminar() {
    parar(); persistir(true)
    var r = R.res = window.KRuta.resumen(R.pts)
    var dur = Math.round((Date.now() - R.t0) / 1000)
    R.dur = Math.max(dur, r.duracion_s)
    var dato = '<div class="krBig">' + (r.distancia_m / 1000).toFixed(2).replace('.', ',') + '<small>KILÓMETROS</small></div>' +
      '<div class="krGr"><div><b>' + reloj(R.dur) + '</b><span>TIEMPO</span></div><div><b>' + ritmo(r.ritmo_min_km) + '</b><span>RITMO /KM</span></div><div><b>' + reloj(r.movimiento_s) + '</b><span>EN MOVIMIENTO</span></div></div>'
    if (!r.valida) {
      var falta = r.motivo === 'DISTANCIA_CORTA' ? 'LA CARRERA CUENTA DESDE 300 M.' : 'LA CARRERA CUENTA DESDE 3 MINUTOS.'
      pintar('<p class="krK">RUN CLUB</p><h2 class="krH1">Todavía no cuenta</h2>' + dato + '<p class="krTx">' + falta + (r.puntos < 3 ? ' EL GPS CASI NO REGISTRÓ PUNTOS: REVISA LA UBICACIÓN Y CORRE A CIELO ABIERTO.' : '') + '</p>',
        '<button class="kcB kcB--p" type="button" onclick="KRUN._retomar()">SEGUIR CORRIENDO</button><button class="kcB kcB--t" type="button" onclick="KRUN._descartar()">DESCARTAR</button>')
      return
    }
    snd('block', .7)
    pintar('<p class="krK">RUN CLUB · CARRERA TERMINADA</p>' + dato + '<p class="krTx">REVISA TU CARRERA Y GUÁRDALA PARA SUMAR A TU RACHA Y A TU DISTANCIA.</p>',
      '<button class="kcB kcB--p" type="button" id="krGuardar" onclick="KRUN._guardar()">✓ GUARDAR CARRERA</button><button class="kcB kcB--t" type="button" onclick="KRUN._descartar()">DESCARTAR</button>')
  }
  async function guardar() {
    var r = R.res, b = $('krGuardar'); if (!r) return; if (b) b.disabled = true
    var pts = R.pts, ini = new Date(Math.min(R.t0, pts.length ? pts[0].t : R.t0)), fin = new Date(Math.max(Date.now(), ini.getTime() + 1000))
    try {
      var s = await rpc('club_run_guardar', { p_inicio: ini.toISOString(), p_fin: fin.toISOString(), p_distancia_m: r.distancia_m, p_duracion_s: R.dur || r.duracion_s,
        p_movimiento_s: r.movimiento_s, p_ruta: r.ruta, p_motor: r.version })
      limpiarLS(); R.st = s; repintar()
      var g = s.guardada || {}
      if (!g.valida) {
        pintar('<p class="krK">RUN CLUB</p><h2 class="krH1">Carrera guardada</h2><p class="krTx">NO SUMA A LA RACHA: EL RITMO REGISTRADO NO CORRESPONDE A UNA CARRERA A PIE.</p>', '<button class="kcB kcB--p" type="button" onclick="KRUN.cerrar()">VOLVER AL CLUB</button>')
        return
      }
      snd('logro'); try { KCLUB._confeti && KCLUB._confeti() } catch (_) {} try { navigator.vibrate && navigator.vibrate([120, 60, 120]) } catch (_) {}
      var n = nombre()
      pintar('<div class="krChk">' + CHECK + '</div><p class="krK">RUN CLUB · ' + (r.distancia_m / 1000).toFixed(2).replace('.', ',') + ' KM</p>' +
        '<h2 class="krH1">Felicitaciones' + (n ? ', ' + esc(n) : '') + '.</h2><p class="krFirma">Ya eres 1% más fuerte que ayer.</p>' +
        '<div class="krGr"><div><b>' + (s.racha_semanas || 0) + '</b><span>' + ((s.racha_semanas || 0) === 1 ? 'SEMANA' : 'SEMANAS') + ' DE RACHA</span></div><div><b>' + km(s.km_total) + '</b><span>KM TOTALES</span></div><div><b>' + (s.carreras || 0) + '</b><span>CARRERAS</span></div></div>',
        '<button class="kcB kcB--p" type="button" onclick="KRUN.cerrar()">VOLVER AL CLUB</button>')
    } catch (e) {
      console.error(e); if (b) b.disabled = false
      aviso('No se pudo guardar. Tu carrera sigue en el teléfono: vuelve a intentarlo con conexión.')
    }
  }
  function descartar() { if (!confirm('¿Descartar esta carrera? No se guarda.')) return; parar(); limpiarLS(); R.pts = []; R.res = null; cerrar() }
  function cancelar() { if (!confirm('¿Cancelar la carrera? Se pierde el recorrido.')) return; parar(); limpiarLS(); R.pts = []; cerrar() }
  function terminarPend() { var p = pendiente(); if (!p) { abrir(); return } R.t0 = p.t0; R.pts = p.p.map(function (a) { return { lat: a[0], lng: a[1], t: a[2], acc: a[3] } }); terminar() }

  window.KRUN = { montar: montar, cargar: cargar, abrir: abrir, cerrar: function () { cerrar(); repintar() },
    _iniciar: function () { iniciar(false) }, _retomar: function () { iniciar(true) }, _terminar: function () { if (confirm('¿Terminar la carrera?')) terminar() },
    _cancelar: cancelar, _descartar: descartar, _guardar: guardar, _terminarPend: terminarPend, _estado: function () { return R } }
})()
