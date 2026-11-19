/* ═══ 1% CLUB · comunidad y challenges (c300) ═══
   Pestaña "1% CLUB" en la barra inferior + challenge temático (primer caso: GTA CHALLENGE · burpees 3:00).
   - Pantalla especial al tocar START de la sesión mientras el challenge está abierto (una vez al día si se omite).
   - Unirse al club → temporizador 3:00 (reloj de siete segmentos) → registrar marca → koach valida en el Dashboard.
   - Ranking (todos / mujeres / hombres) + feed automático con reacciones predeterminadas.
   - Historia 9:16 para compartir, generada en el teléfono (sin IA, sin costo).
   Datos: RPC club_* (Supabase). Sin realtime: el feed se actualiza cada 25 s solo mientras la pestaña está abierta. */
(function () {
  'use strict'
  var K = { st: null, ch: null, rank: [], feed: [], filtro: 'todos', poll: null, run: null, desde: null, cargando: false }
  var REAC = [['implacable', 'IMPLACABLE'], ['subid', 'SUBID JUNTOS'], ['fuego', '1% MEJOR CADA DÍA']]
  function $(id) { return document.getElementById(id) }
  function esc(t) { return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] }) }
  function perfil() { try { return S && S.perfil } catch (_) { return null } }
  function cli() { try { return sb } catch (_) { return null } }
  function snd(n, g) { try { kAudioUnlock(); window.KSFX && KSFX.play(n, 0, g == null ? .8 : g) } catch (_) {} }
  function aviso(m) { try { toast(m) } catch (_) { alert(m) } }
  function hoy() { var d = new Date(); return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate() }
  function seg(t) { try { return bkSeg(t) } catch (_) { return esc(t) } }
  function mmss(s) { s = Math.max(0, Math.ceil(s)); return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0') }

  /* ── estilos (tema gta: grafito + neón turquesa de la marca + magenta solo de esta edición) ── */
  var css = `
.kcG,.kcR{position:fixed;inset:0;z-index:95;display:none;flex-direction:column;overflow:auto;color:#F2F2F2;
  background:linear-gradient(180deg,#0B0C0E 0%,#17191C 46%,#26292D 100%);font-family:'KOACH Display','KOACH Display Fallback',system-ui,sans-serif}
.kcG.on,.kcR.on{display:flex}
.kcBg{position:absolute;inset:0;overflow:hidden;pointer-events:none}
.kcSun{position:absolute;left:50%;top:30%;width:min(78vw,380px);aspect-ratio:1;transform:translate(-50%,-50%);border-radius:50%;
  background:repeating-linear-gradient(180deg,rgba(255,61,154,.55) 0 7px,transparent 7px 13px);
  -webkit-mask:linear-gradient(180deg,#000 0%,#000 55%,transparent 82%);mask:linear-gradient(180deg,#000 0%,#000 55%,transparent 82%);
  box-shadow:0 0 90px rgba(255,61,154,.18)}
.kcGrid{position:absolute;left:-50%;right:-50%;bottom:-6%;height:46%;transform:perspective(320px) rotateX(62deg);transform-origin:50% 100%;
  background-image:linear-gradient(rgba(62,198,176,.55) 1px,transparent 1px),linear-gradient(90deg,rgba(62,198,176,.55) 1px,transparent 1px);
  background-size:44px 44px;-webkit-mask:linear-gradient(0deg,#000 30%,transparent 100%);mask:linear-gradient(0deg,#000 30%,transparent 100%)}
@media (prefers-reduced-motion:no-preference){.kcGrid{animation:kcRoad 1.6s linear infinite}}
@keyframes kcRoad{to{background-position:0 44px,0 0}}
.kcIn{position:relative;z-index:1;display:flex;flex-direction:column;align-items:center;min-height:100%;padding:calc(18px + env(safe-area-inset-top,0px)) 22px calc(22px + env(safe-area-inset-bottom,0px));text-align:center;box-sizing:border-box}
.kcLogo{height:20px;width:auto;opacity:.95;margin-bottom:auto}
.kcK{font:700 10px/1 'Space Mono','Space Mono Fallback',monospace;letter-spacing:.24em;color:#3EC6B0;margin:0 0 14px}
.kcT{margin:0;line-height:.86;font-weight:900;font-stretch:115%;text-transform:uppercase;transform:skewX(-9deg)}
.kcT b{display:block;font-size:clamp(84px,30vw,150px);color:#fff;letter-spacing:-.02em;text-shadow:0 0 18px rgba(255,61,154,.75),0 0 2px #fff,4px 4px 0 #FF3D9A}
.kcT span{display:block;font:700 clamp(15px,5vw,22px)/1 'Space Mono','Space Mono Fallback',monospace;letter-spacing:.42em;color:#3EC6B0;margin-top:12px;text-shadow:0 0 12px rgba(62,198,176,.6);transform:skewX(9deg)}
.kcD{font-size:17px;font-weight:700;line-height:1.35;margin:22px 0 6px;max-width:330px}
.kcS{font:400 11px/1.6 'Space Mono','Space Mono Fallback',monospace;color:#B9BCBF;max-width:320px;margin:0}
.kcStats{display:flex;gap:10px;margin:18px 0 0}
.kcStats div{border:1px solid rgba(255,255,255,.16);border-radius:8px;padding:9px 12px;min-width:96px;background:rgba(255,255,255,.04)}
.kcStats b{display:block;font-size:22px;font-weight:900}.kcStats small{font:700 8.5px/1 'Space Mono',monospace;letter-spacing:.14em;color:#979C9F}
.kcAct{width:100%;max-width:400px;margin-top:auto;padding-top:22px;display:flex;flex-direction:column;gap:10px}
.kcB{appearance:none;border:0;border-radius:10px;height:54px;width:100%;font:700 13px/1 'Space Mono','Space Mono Fallback',monospace;letter-spacing:.16em;cursor:pointer}
.kcB--p{background:#F2F2F2;color:#0B0C0E;box-shadow:0 0 0 1px #3EC6B0,0 0 22px rgba(62,198,176,.35)}
.kcB--s{background:transparent;color:#F2F2F2;border:1px solid rgba(255,255,255,.28)}
.kcB--t{background:transparent;color:#979C9F;height:40px;font-size:11px}
.kcB:disabled{opacity:.5}
.kcClk{color:#3EC6B0;filter:drop-shadow(0 0 10px rgba(62,198,176,.5));margin:16px 0 6px}
.kcClk svg{height:min(26vw,120px);width:auto;display:block;margin:0 auto}
.kcClk.fin{color:#FF3D9A;filter:drop-shadow(0 0 10px rgba(255,61,154,.6))}
.kcBig{font-size:clamp(110px,40vw,190px);font-weight:900;line-height:.9;letter-spacing:-.03em;margin:8px 0}
.kcStep{display:flex;align-items:center;gap:14px;margin:6px 0 2px}
.kcStep button{width:58px;height:58px;border-radius:50%;border:1px solid rgba(255,255,255,.3);background:rgba(255,255,255,.05);color:#fff;font-size:28px;font-weight:700;cursor:pointer}
.kcStep input{width:150px;background:transparent;border:0;border-bottom:2px solid #3EC6B0;color:#fff;text-align:center;font:900 72px/1 'KOACH Display',sans-serif;outline:none;-moz-appearance:textfield}
.kcStep input::-webkit-outer-spin-button,.kcStep input::-webkit-inner-spin-button{-webkit-appearance:none;margin:0}
.kcX{position:absolute;top:calc(12px + env(safe-area-inset-top,0px));right:12px;z-index:2;width:40px;height:40px;border-radius:50%;border:1px solid rgba(255,255,255,.2);background:rgba(0,0,0,.3);color:#fff;font-size:16px;cursor:pointer}
/* pestaña */
.tabbar.vis.kcTab6{grid-template-columns:.76fr 1.34fr 1.02fr .94fr .84fr .8fr}
.kcTab6 .tb .tl{font-size:8px!important;letter-spacing:.02em!important;white-space:nowrap}
#tb-vClub{position:relative}
#tb-vClub .kcDot{position:absolute;top:5px;right:22%;width:7px;height:7px;border-radius:50%;background:#3EC6B0;box-shadow:0 0 6px #3EC6B0}
/* vista 1% CLUB */
#vClub{min-height:100vh;background:linear-gradient(180deg,#15171A 0%,#22252A 60%,#2E3135 100%);color:#F2F2F2;padding:calc(16px + env(safe-area-inset-top,0px)) 16px calc(120px + env(safe-area-inset-bottom,0px));box-sizing:border-box}
#vClub .kcTop{display:flex;justify-content:center;margin-bottom:18px}#vClub .kcTop img{height:18px}
.kcH{font:900 34px/1 'KOACH Display',sans-serif;font-stretch:115%;margin:0}
.kcHs{font:700 9.5px/1.5 'Space Mono',monospace;letter-spacing:.16em;color:#979C9F;margin:6px 0 18px}
.kcCard{position:relative;overflow:hidden;border-radius:14px;padding:20px 18px;margin-bottom:14px;background:linear-gradient(180deg,#0B0C0E,#1D1F23);border:1px solid rgba(62,198,176,.35)}
.kcCard .kcBg .kcSun{top:22%;width:220px}.kcCard .kcBg .kcGrid{height:60%}
.kcCard .kcIn{padding:0;min-height:0;align-items:stretch;text-align:left}
.kcCard .kcT b{font-size:64px}.kcCard .kcT span{font-size:13px;margin-top:8px}
.kcMia{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-top:16px;padding:12px 14px;border-radius:10px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12)}
.kcMia b{font-size:30px;font-weight:900}.kcMia small{display:block;font:700 8.5px/1.4 'Space Mono',monospace;letter-spacing:.14em;color:#979C9F}
.kcEst{font:700 8.5px/1 'Space Mono',monospace;letter-spacing:.12em;padding:6px 8px;border-radius:999px;border:1px solid}
.kcEst--ok{color:#3EC6B0;border-color:#3EC6B0}.kcEst--pend{color:#C9CCCF;border-color:#6F7377}
.kcSec{font:700 10px/1 'Space Mono',monospace;letter-spacing:.2em;color:#979C9F;margin:22px 2px 10px;display:flex;justify-content:space-between;align-items:center}
.kcSeg{display:flex;gap:6px}.kcSeg button{border:1px solid rgba(255,255,255,.2);background:transparent;color:#C9CCCF;border-radius:999px;padding:7px 11px;font:700 9px/1 'Space Mono',monospace;letter-spacing:.1em;cursor:pointer}
.kcSeg button[aria-pressed=true]{background:#F2F2F2;color:#0B0C0E;border-color:#F2F2F2}
.kcRow{display:grid;grid-template-columns:34px 36px 1fr auto;align-items:center;gap:10px;padding:10px 12px;border-radius:10px;background:rgba(255,255,255,.04);margin-bottom:6px;border:1px solid transparent}
.kcRow.yo{border-color:#3EC6B0;background:rgba(62,198,176,.08)}
.kcRow .p{font:900 18px/1 'KOACH Display',sans-serif;color:#979C9F}.kcRow.t1 .p{color:#FF3D9A}.kcRow.t2 .p,.kcRow.t3 .p{color:#3EC6B0}
.kcRow .n{font-weight:800;font-size:13px;letter-spacing:.02em;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.kcRow .n small{display:block;font:700 8px/1.4 'Space Mono',monospace;letter-spacing:.12em;color:#6F7377}
.kcRow .s{font:900 22px/1 'KOACH Display',sans-serif}
.kcAv{width:36px;height:36px;border-radius:50%;overflow:hidden;display:flex;align-items:center;justify-content:center;background:#434649;font-weight:900;font-size:14px;color:#E3E3E3}
.kcAv img{width:100%;height:100%;object-fit:cover}
.kcEv{padding:12px 12px 10px;border-radius:10px;background:rgba(255,255,255,.04);margin-bottom:8px}
.kcEv .h{display:flex;gap:10px;align-items:center}.kcEv .h p{margin:0;font-size:13px;line-height:1.35}.kcEv .h p b{font-weight:900}
.kcEv .h time{display:block;font:700 8px/1.4 'Space Mono',monospace;letter-spacing:.12em;color:#6F7377}
.kcEv.lider{border:1px solid rgba(255,61,154,.5)}
.kcRe{display:flex;gap:6px;flex-wrap:wrap;margin-top:9px;padding-left:46px}
.kcRe button{border:1px solid rgba(255,255,255,.18);background:transparent;color:#C9CCCF;border-radius:999px;padding:6px 9px;font:700 8.5px/1 'Space Mono',monospace;letter-spacing:.08em;cursor:pointer}
.kcRe button[aria-pressed=true]{border-color:#3EC6B0;color:#3EC6B0;background:rgba(62,198,176,.1)}
.kcVac{font:400 11px/1.6 'Space Mono',monospace;color:#979C9F;padding:14px;text-align:center;border:1px dashed rgba(255,255,255,.15);border-radius:10px}
.kcConf{position:fixed;inset:0;pointer-events:none;z-index:96}
.kcR .kcSun{opacity:.32;top:24%}
`
  function estilos() { if ($('kcCss')) return; var s = document.createElement('style'); s.id = 'kcCss'; s.textContent = css; document.head.appendChild(s) }
  function fondo() { return '<div class="kcBg" aria-hidden="true"><div class="kcSun"></div><div class="kcGrid"></div></div>' }
  function titulo(ch) { var t = String(ch.titulo || '').split(' '), a = t.shift() || '', b = t.join(' '); return '<h1 class="kcT"><b>' + esc(a) + '</b><span>' + esc(b) + '</span></h1>' }

  /* ── datos ── */
  async function rpc(n, a) { var r = await cli().rpc(n, a || {}); if (r.error) throw r.error; return r.data }
  async function cargarEstado() { try { K.st = await rpc('club_estado'); K.ch = K.st && K.st.challenge || null } catch (e) { console.error('club_estado', e); K.st = K.st || null } marcarTab(); return K.st }
  async function cargarListas() {
    if (!K.ch) { K.rank = []; K.feed = []; return }
    var r = await Promise.all([rpc('club_ranking', { p_challenge: K.ch.id }).catch(function () { return [] }), rpc('club_feed', { p_challenge: K.ch.id, p_limit: 40 }).catch(function () { return [] })])
    K.rank = r[0] || []; K.feed = r[1] || []
    var paths = K.rank.map(function (x) { return x.avatar }).concat(K.feed.map(function (x) { return x.avatar })).filter(Boolean)
    if (paths.length && window.KAvatar) try { await KAvatar.urls(cli(), Array.from(new Set(paths))) } catch (_) {}
  }
  function av(path, nombre) { try { if (window.KAvatar) return KAvatar.html(path, nombre, 'kcAv') } catch (_) {} return '<span class="kcAv">' + esc(String(nombre || '?').charAt(0)) + '</span>' }

  /* ── pestaña en la barra inferior ── */
  function montarTab() {
    var tb = $('tabbar'); if (!tb || $('tb-vClub')) return
    var b = document.createElement('button'); b.className = 'tb'; b.id = 'tb-vClub'; b.type = 'button'
    b.innerHTML = '<span class="ti"><svg class="tic" viewBox="0 0 24 24" aria-hidden="true"><circle class="ts" cx="7.5" cy="7.5" r="2.6"/><circle class="ts" cx="16.5" cy="16.5" r="2.6"/><path class="ts" d="M18 6L6 18"/></svg></span><span class="tl">1% CLUB</span>'
    b.onclick = function () { tab('vClub') }
    var pf = $('tb-vPerfil'); tb.insertBefore(b, pf || null); tb.classList.add('kcTab6')
    if (!$('vClub')) { var v = document.createElement('div'); v.className = 'vista conTab'; v.id = 'vClub'; var ref = $('vPerfil'); (ref && ref.parentNode || document.body).insertBefore(v, ref ? ref.nextSibling : null) }
    marcarTab()
  }
  function marcarTab() {
    var b = $('tb-vClub'); if (!b) return
    var dot = b.querySelector('.kcDot'), pend = !!(K.ch && K.ch.abierto && !(K.st && K.st.mia))
    if (pend && !dot) { dot = document.createElement('i'); dot.className = 'kcDot'; b.appendChild(dot) } else if (!pend && dot) dot.remove()
  }

  /* ── vista 1% CLUB ── */
  async function abrirVista() {
    var v = $('vClub'); if (!v) return
    if (!K.st) v.innerHTML = '<div class="kcTop"><img src="/img/brand/logotipo-koach.png" alt="KOACH"></div><p class="kcHs">CARGANDO EL CLUB…</p>'
    await cargarEstado(); await cargarListas(); pintarVista()
    clearInterval(K.poll); K.poll = setInterval(function () { if (!v.classList.contains('on')) { clearInterval(K.poll); return } refrescar() }, 25000)
  }
  async function refrescar() { await cargarEstado(); await cargarListas(); if ($('vClub') && $('vClub').classList.contains('on')) pintarVista() }
  function pintarVista() {
    var v = $('vClub'); if (!v) return
    var st = K.st || {}, ch = K.ch, h = '<div class="kcTop"><img src="/img/brand/logotipo-koach.png" alt="KOACH"></div>' +
      '<h2 class="kcH">1% CLUB</h2><p class="kcHs">DESAFÍOS · COMUNIDAD · ACTIVIDADES' + (st.miembros ? ' · ' + st.miembros + ' EN EL CLUB' : '') + '</p>'
    if (!ch) { v.innerHTML = h + '<div class="kcVac">Pronto se abre el próximo challenge del club.</div>' + (st.miembro ? '' : '<div class="kcAct" style="margin:16px auto 0"><button class="kcB kcB--p" type="button" onclick="KCLUB.unirse()">ÚNETE AL CLUB DEL 1%</button></div>'); return }
    var mia = st.mia, abierto = ch.abierto
    h += '<div class="kcCard">' + fondo() + '<div class="kcIn"><p class="kcK" style="margin-bottom:10px">CHALLENGE · ' + (abierto ? 'ABIERTO HASTA EL ' + ['DOMINGO','LUNES','MARTES','MIÉRCOLES','JUEVES','VIERNES','SÁBADO'][new Date(ch.fin).getDay()] : 'CERRADO · RESULTADOS') + '</p>' + titulo(ch) +
      '<p class="kcD" style="margin:16px 0 4px;font-size:15px">' + esc(ch.descripcion || '') + '</p><p class="kcS">' + esc(ch.estandar || '') + '</p>' +
      (mia ? '<div class="kcMia"><div><small>TU MARCA</small><b>' + mia.score + '</b></div><div style="text-align:right"><small>' + posTxt() + '</small>' + estTag(mia.estado) + '</div></div>' : '') +
      (abierto ? '<div class="kcAct" style="padding-top:14px">' + (!st.miembro ? '<button class="kcB kcB--p" type="button" onclick="KCLUB.unirse(true)">ÚNETE AL CLUB DEL 1%</button>' :
        '<button class="kcB kcB--p" type="button" onclick="KCLUB.challenge()">' + (mia ? 'MEJORAR MI MARCA' : 'ENTRAR AL CHALLENGE') + '</button>') +
        (mia ? '<button class="kcB kcB--s" type="button" onclick="KCLUB.compartir()">COMPARTIR HISTORIA</button>' : '') + '</div>' : (mia ? '<div class="kcAct" style="padding-top:14px"><button class="kcB kcB--s" type="button" onclick="KCLUB.compartir()">COMPARTIR HISTORIA</button></div>' : '')) +
      '</div></div>'
    h += '<div class="kcSec"><span>RANKING · ' + (st.participantes || 0) + '</span><span class="kcSeg">' + ['todos', 'mujeres', 'hombres'].map(function (f) { return '<button type="button" aria-pressed="' + (K.filtro === f) + '" onclick="KCLUB.filtro(\'' + f + '\')">' + f.toUpperCase() + '</button>' }).join('') + '</span></div>'
    var lista = K.rank.filter(function (x) { return K.filtro === 'todos' || (K.filtro === 'mujeres' ? x.sexo === 'mujer' : x.sexo === 'hombre') })
    h += lista.length ? lista.map(function (x, i) { var p = K.filtro === 'todos' ? x.pos : i + 1
      return '<div class="kcRow' + (x.yo ? ' yo' : '') + (p <= 3 ? ' t' + p : '') + '"><span class="p">' + String(p).padStart(2, '0') + '</span>' + av(x.avatar, x.nombre) +
        '<span class="n">' + esc(x.nombre) + '<small>' + (x.estado === 'validado' ? 'VALIDADO POR KOACH' : 'POR VALIDAR') + '</small></span><span class="s">' + x.score + '</span></div>' }).join('')
      : '<div class="kcVac">Todavía no hay marcas. La primera puede ser la tuya.</div>'
    h += '<div class="kcSec"><span>EN VIVO · CHALLENGE</span></div>'
    h += K.feed.length ? K.feed.map(evento).join('') : '<div class="kcVac">Aquí aparece quién entra al challenge y cada marca.</div>'
    v.innerHTML = h
  }
  function posTxt() { var y = K.rank.filter(function (x) { return x.yo })[0]; return y ? 'POSICIÓN #' + y.pos + ' DE ' + K.rank.length : '' }
  function estTag(e) { return e === 'validado' ? '<span class="kcEst kcEst--ok">✓ VALIDADA</span>' : e === 'rechazado' ? '<span class="kcEst kcEst--pend">REVISAR CON TU KOACH</span>' : '<span class="kcEst kcEst--pend">POR VALIDAR</span>' }
  function hace(at) { var m = Math.round((Date.now() - new Date(at).getTime()) / 60000); return m < 1 ? 'AHORA' : m < 60 ? 'HACE ' + m + ' MIN' : m < 1440 ? 'HACE ' + Math.round(m / 60) + ' H' : 'HACE ' + Math.round(m / 1440) + ' D' }
  function evento(e) {
    var n = '<b>' + esc(e.nombre) + '</b>', p = e.payload || {}, t =
      e.tipo === 'unido' ? n + ' se unió al Club del 1%.' :
      e.tipo === 'marca' ? n + ' marcó <b>' + p.score + ' burpees</b>' + (p.pos ? ' · #' + p.pos + ' del ranking.' : '.') :
      e.tipo === 'lider' ? n + ' toma el primer lugar con <b>' + p.score + '</b>.' : n
    var mias = e.mias || [], cnt = e.reac || {}
    return '<div class="kcEv' + (e.tipo === 'lider' ? ' lider' : '') + '" data-ev="' + e.id + '"><div class="h">' + av(e.avatar, e.nombre) + '<p>' + t + '<time>' + hace(e.at) + '</time></p></div>' +
      '<div class="kcRe">' + REAC.map(function (r) { var on = mias.indexOf(r[0]) >= 0
        return '<button type="button" aria-pressed="' + on + '" onclick="KCLUB.reaccionar(' + e.id + ',\'' + r[0] + '\',this)">' + r[1] + (cnt[r[0]] ? ' · ' + cnt[r[0]] : '') + '</button>' }).join('') + '</div></div>'
  }
  async function reaccionar(id, clave, btn) {
    if (!(K.st && K.st.miembro)) { aviso('Únete al Club del 1% para reaccionar.'); return }
    var ev = K.feed.filter(function (x) { return x.id === id })[0]; if (!ev) return
    try { snd('set', .6); var c = await rpc('club_reaccionar', { p_evento: id, p_clave: clave }); ev.reac = c || {}
      var i = (ev.mias || []).indexOf(clave); if (i >= 0) ev.mias.splice(i, 1); else (ev.mias = ev.mias || []).push(clave)
      var box = document.querySelector('.kcEv[data-ev="' + id + '"]'); if (box) box.outerHTML = evento(ev)
    } catch (e) { aviso(e.message || 'No se pudo reaccionar.') }
  }
  async function unirse(irChallenge) {
    try { K.st = await rpc('club_unirse'); K.ch = K.st.challenge || K.ch; snd('logro', .7); confeti(); aviso('Bienvenido al Club del 1%.') }
    catch (e) { aviso(e.message || 'No se pudo unir.'); return false }
    marcarTab(); if (irChallenge) { abrirRun() } else if ($('vClub') && $('vClub').classList.contains('on')) refrescar()
    return true
  }

  /* ── pantalla especial al iniciar la sesión ── */
  function gateAplica() {
    var p = perfil(); if (!p || !K.ch || !K.ch.abierto || (K.st && K.st.mia)) return false
    try { if (localStorage.getItem('kc_gate_' + K.ch.slug) === hoy()) return false } catch (_) {}
    return true
  }
  function gate(cont) {
    estilos(); K.desde = cont
    var g = $('kcGate'); if (!g) { g = document.createElement('div'); g.className = 'kcG'; g.id = 'kcGate'; g.setAttribute('role', 'dialog'); g.setAttribute('aria-modal', 'true'); document.body.appendChild(g) }
    var st = K.st || {}, ch = K.ch
    g.innerHTML = fondo() + '<div class="kcIn"><img class="kcLogo" src="/img/brand/logotipo-koach.png" alt="KOACH">' +
      '<p class="kcK">1% CLUB · CHALLENGE 01</p>' + titulo(ch) + '<p class="kcD">' + esc(ch.descripcion) + '</p>' +
      '<p class="kcS">' + (st.miembro ? 'Tu marca entra al ranking de todo el club.' : 'Hoy únete a la comunidad del Club del 1%: un canal interno de desafíos, comunidad y actividades.') + '</p>' +
      '<div class="kcStats"><div><b>' + (st.miembros || 0) + '</b><small>EN EL CLUB</small></div><div><b>' + (st.participantes || 0) + '</b><small>MARCAS</small></div></div>' +
      '<div class="kcAct">' + (st.miembro ? '<button class="kcB kcB--p" type="button" onclick="KCLUB._gateRun()">ENTRAR AL CHALLENGE</button>'
        : '<button class="kcB kcB--p" type="button" onclick="KCLUB._gateUnir()">ÚNETE AL CLUB DEL 1%</button>') +
      '<button class="kcB kcB--t" type="button" onclick="KCLUB._gateSalir()">AHORA NO · IR A MI SESIÓN</button></div></div>'
    g.classList.add('on'); try { kAudioUnlock(); KSFX.play('appear', 0, .7) } catch (_) {}
  }
  function cerrarGate() { var g = $('kcGate'); if (g) g.classList.remove('on') }
  function continuar() { var c = K.desde; K.desde = null; cerrarGate(); cerrarRun(); if (c) try { c() } catch (e) { console.error(e) } }

  /* ── challenge: instrucciones → 3·2·1 → 3:00 → marca → resultado ── */
  function runEl() { estilos(); var r = $('kcRun'); if (!r) { r = document.createElement('div'); r.className = 'kcR'; r.id = 'kcRun'; r.setAttribute('role', 'dialog'); r.setAttribute('aria-modal', 'true'); document.body.appendChild(r) } return r }
  function runPintar(cuerpo, acciones) {
    var r = runEl()
    r.innerHTML = fondo() + '<button class="kcX" type="button" aria-label="Cerrar" onclick="KCLUB._runCerrar()">✕</button><div class="kcIn"><img class="kcLogo" src="/img/brand/logotipo-koach.png" alt="KOACH">' + cuerpo + '<div class="kcAct">' + acciones + '</div></div>'
    r.classList.add('on')
  }
  function abrirRun() {
    cerrarGate(); var ch = K.ch; if (!ch) return
    runPintar('<p class="kcK">' + esc(ch.titulo) + '</p><div class="kcClk">' + seg(mmss(ch.duracion_seg || 180)) + '</div>' +
      '<p class="kcD">' + esc(ch.descripcion) + '</p><p class="kcS">' + esc(ch.estandar || '') + '<br><br>Hazlo en pareja: uno hace, el otro cuenta. Después cambian.</p>',
      '<button class="kcB kcB--p" type="button" onclick="KCLUB._runStart()">START ' + mmss(ch.duracion_seg || 180) + '</button>' +
      '<button class="kcB kcB--t" type="button" onclick="KCLUB._runMarca()">YA LO HICE · REGISTRAR MI MARCA</button>')
  }
  async function wake(on) { try { if (on && navigator.wakeLock) K.wl = await navigator.wakeLock.request('screen'); else if (!on && K.wl) { K.wl.release(); K.wl = null } } catch (_) {} }
  function runStart() {
    var ch = K.ch, dur = ch.duracion_seg || 180, n = 3; wake(true)
    var paso = function () {
      if (n > 0) { runPintar('<p class="kcK">PREPÁRATE</p><div class="kcClk">' + seg('0' + n) + '</div>', '<button class="kcB kcB--t" type="button" onclick="KCLUB._runParar()">CANCELAR</button>'); snd('tick' + (4 - n)); if (n === 3) snd('riser', .5); n--; K.run = setTimeout(paso, 1000); return }
      snd('go'); var fin = Date.now() + dur * 1000, ult = -1
      runPintar('<p class="kcK">' + esc(ch.metrica) + ' · MÁXIMO</p><div class="kcClk" id="kcClk">' + seg(mmss(dur)) + '</div><p class="kcS">Pecho al suelo. Extensión completa. No pares.</p>', '<button class="kcB kcB--t" type="button" onclick="KCLUB._runParar()">DETENER</button>')
      var tick = function () {
        var r = (fin - Date.now()) / 1000, s = Math.max(0, Math.ceil(r)), el = $('kcClk'); if (!el) return
        if (s !== ult) { ult = s; el.innerHTML = seg(mmss(s)); if (s <= 10) el.classList.add('fin'); if (s > 0 && s <= 3) snd('tick' + (4 - s)) }
        if (r <= 0) { K.run = null; snd('block'); try { navigator.vibrate && navigator.vibrate([200, 80, 200]) } catch (_) {} wake(false); pedirMarca(true); return }
        K.run = setTimeout(tick, 200)
      }
      tick()
    }
    paso()
  }
  function runParar() { clearTimeout(K.run); K.run = null; wake(false); abrirRun() }
  function pedirMarca(tiempo) {
    var prev = (K.st && K.st.mia && K.st.mia.score) || ''
    runPintar('<p class="kcK">' + (tiempo ? 'TIEMPO' : 'REGISTRA TU MARCA') + '</p><p class="kcD" style="margin-top:6px">¿Cuántos burpees completaste?</p>' +
      '<div class="kcStep"><button type="button" aria-label="Restar" onclick="KCLUB._paso(-1)">−</button><input id="kcNum" type="number" inputmode="numeric" min="1" max="150" value="' + esc(prev) + '" placeholder="0"><button type="button" aria-label="Sumar" onclick="KCLUB._paso(1)">+</button></div>' +
      '<p class="kcS" style="margin-top:14px">Tu koach valida la marca en la sala.</p>',
      '<button class="kcB kcB--p" type="button" id="kcReg" onclick="KCLUB._registrar()">REGISTRAR MARCA</button>')
  }
  function pasoNum(d) { var i = $('kcNum'); if (!i) return; i.value = Math.max(1, Math.min(150, (parseInt(i.value) || 0) + d)) }
  async function registrar() {
    var i = $('kcNum'), v = parseInt(i && i.value), b = $('kcReg')
    if (!v || v < 1 || v > 150) { aviso('Ingresa una marca entre 1 y 150.'); return }
    b.disabled = true
    try {
      var r = await rpc('club_registrar', { p_challenge: K.ch.id, p_score: v })
      snd('logro'); confeti(); await cargarEstado(); cargarListas().then(function () { if ($('vClub') && $('vClub').classList.contains('on')) pintarVista() })
      runPintar('<p class="kcK">MARCA REGISTRADA</p><div class="kcBig">' + r.score + '</div><p class="kcD" style="margin-top:0">' + esc(K.ch.metrica) + ' EN ' + mmss(K.ch.duracion_seg || 180) + '</p>' +
        '<div class="kcStats"><div><b>#' + r.pos + '</b><small>DE ' + r.total + '</small></div><div><b style="font-size:13px;line-height:1.9">POR VALIDAR</b><small>TU KOACH</small></div></div>',
        '<button class="kcB kcB--p" type="button" onclick="KCLUB.compartir()">COMPARTIR HISTORIA</button>' +
        (K.desde ? '<button class="kcB kcB--s" type="button" onclick="KCLUB._continuar()">IR A MI SESIÓN</button>' : '<button class="kcB kcB--s" type="button" onclick="KCLUB._verRanking()">VER RANKING</button>'))
    } catch (e) { b.disabled = false; aviso(e.message || 'No se pudo registrar la marca.') }
  }
  function cerrarRun() { clearTimeout(K.run); K.run = null; wake(false); var r = $('kcRun'); if (r) r.classList.remove('on') }
  function runCerrar() { if (K.desde) { continuar(); return } cerrarRun(); if ($('vClub') && $('vClub').classList.contains('on')) refrescar() }

  /* ── confeti (serpentina) ── */
  function confeti() {
    try { if (matchMedia('(prefers-reduced-motion: reduce)').matches) return } catch (_) {}
    var c = document.createElement('canvas'); c.className = 'kcConf'; c.width = innerWidth; c.height = innerHeight; document.body.appendChild(c)
    var x = c.getContext('2d'), col = ['#3EC6B0', '#FF3D9A', '#F2F2F2', '#979C9F'], P = []
    for (var i = 0; i < 90; i++) P.push({ x: innerWidth / 2, y: innerHeight * .45, vx: (Math.random() - .5) * 14, vy: -Math.random() * 14 - 4, r: Math.random() * 6.28, w: 4 + Math.random() * 6, h: 8 + Math.random() * 10, c: col[i % 4] })
    var t0 = performance.now()
    ;(function f(t) { var dt = t - t0; x.clearRect(0, 0, c.width, c.height)
      P.forEach(function (p) { p.vy += .42; p.x += p.vx; p.y += p.vy; p.r += .2; x.save(); x.translate(p.x, p.y); x.rotate(p.r); x.fillStyle = p.c; x.fillRect(-p.w / 2, -p.h / 2, p.w, p.h); x.restore() })
      if (dt < 1800) requestAnimationFrame(f); else c.remove() })(t0)
  }

  /* ── historia 9:16 ── */
  function img(src) { return new Promise(function (ok) { var i = new Image(); i.onload = function () { ok(i) }; i.onerror = function () { ok(null) }; i.src = src }) }
  async function historia() {
    var mia = K.st && K.st.mia; if (!mia || !K.ch) return null
    try { await Promise.all([document.fonts.load('900 200px "KOACH Display"'), document.fonts.load('700 40px "Space Mono"')]) } catch (_) {}
    var W = 1080, H = 1920, c = document.createElement('canvas'); c.width = W; c.height = H; var x = c.getContext('2d')
    var g = x.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#0B0C0E'); g.addColorStop(.5, '#17191C'); g.addColorStop(1, '#2A2D31'); x.fillStyle = g; x.fillRect(0, 0, W, H)
    // sol rayado
    x.save(); x.beginPath(); x.arc(W / 2, 640, 330, 0, Math.PI * 2); x.clip()
    for (var y = 310; y < 900; y += 30) { x.fillStyle = 'rgba(255,61,154,' + Math.max(0, .62 - (y - 310) / 900) + ')'; x.fillRect(0, y, W, 16) }
    x.restore()
    // grilla en perspectiva
    x.strokeStyle = 'rgba(62,198,176,.5)'; x.lineWidth = 2; var hz = 1180
    for (var k = -14; k <= 14; k++) { x.beginPath(); x.moveTo(W / 2 + k * 40, hz); x.lineTo(W / 2 + k * 260, H); x.stroke() }
    for (var j = 0; j < 14; j++) { var yy = hz + Math.pow(j / 13, 2.1) * (H - hz); x.beginPath(); x.moveTo(0, yy); x.lineTo(W, yy); x.stroke() }
    var lg = await img('/img/brand/logotipo-koach.png'); if (lg) { var lw = 300, lh = lw * lg.height / lg.width; x.drawImage(lg, (W - lw) / 2, 120, lw, lh) }
    x.textAlign = 'center'
    x.font = '700 34px "Space Mono", monospace'; x.fillStyle = '#3EC6B0'; x.fillText('1% CLUB · CHALLENGE 01', W / 2, 300)
    var partes = String(K.ch.titulo || '').split(' '), a = partes.shift(), b = partes.join(' ')
    x.save(); x.translate(W / 2, 640); x.transform(1, 0, -.16, 1, 0, 0)
    x.font = '900 300px "KOACH Display", sans-serif'; x.fillStyle = '#FF3D9A'; x.fillText(a, 12, 12)
    x.shadowColor = 'rgba(255,61,154,.8)'; x.shadowBlur = 40; x.fillStyle = '#FFFFFF'; x.fillText(a, 0, 0); x.restore()
    x.font = '700 58px "Space Mono", monospace'; x.fillStyle = '#3EC6B0'; x.fillText(b.split('').join(' '), W / 2, 760)
    x.shadowColor = 'rgba(0,0,0,.6)'; x.shadowBlur = 30
    x.font = '900 400px "KOACH Display", sans-serif'; x.fillStyle = '#FFFFFF'; x.fillText(String(mia.score), W / 2, 1230)
    x.shadowBlur = 0
    x.font = '700 44px "Space Mono", monospace'; x.fillStyle = '#E3E3E3'; x.fillText(String(K.ch.metrica || '') + ' EN ' + mmss(K.ch.duracion_seg || 180), W / 2, 1320)
    var y0 = K.rank.filter(function (r) { return r.yo })[0]
    if (y0) { x.font = '900 120px "KOACH Display", sans-serif'; x.fillStyle = '#3EC6B0'; x.fillText('#' + y0.pos, W / 2, 1520); x.font = '700 34px "Space Mono", monospace'; x.fillStyle = '#979C9F'; x.fillText('DE ' + K.rank.length + ' EN EL RANKING DEL CLUB', W / 2, 1580) }
    var p = perfil(); x.font = '900 64px "KOACH Display", sans-serif'; x.fillStyle = '#FFFFFF'; x.fillText(String((p && p.nombre) || '').toUpperCase(), W / 2, 1720)
    x.font = '700 30px "Space Mono", monospace'; x.fillStyle = '#979C9F'; x.fillText('KOACHCLUB.CL', W / 2, 1810)
    return await new Promise(function (ok) { c.toBlob(function (bl) { ok(bl ? new File([bl], 'koach-' + K.ch.slug + '.jpg', { type: 'image/jpeg' }) : null) }, 'image/jpeg', .9) })
  }
  async function compartir() {
    if (!(K.st && K.st.mia)) { aviso('Registra tu marca primero.'); return }
    if (!K.rank.length) await cargarListas()
    var f = K.file && K.fileScore === K.st.mia.score ? K.file : null
    if (!f) { f = await historia(); K.file = f; K.fileScore = K.st.mia.score }
    if (!f) { aviso('No se pudo crear la imagen.'); return }
    var puede = false; try { puede = !!(navigator.canShare && navigator.share && navigator.canShare({ files: [f] })) } catch (_) {}
    if (puede) { try { await navigator.share({ files: [f] }); return } catch (e) { if (e && e.name === 'AbortError') return } }
    var a = document.createElement('a'); a.href = URL.createObjectURL(f); a.download = f.name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(function () { URL.revokeObjectURL(a.href) }, 4000)
    aviso('La imagen se descargó.')
  }

  /* ── enganches con la app (después de que cargó el script principal) ── */
  function enganchar() {
    if (typeof window.abrirSesion !== 'function' || typeof window.tab !== 'function' || typeof window.vista !== 'function') return false
    var _abrir = window.abrirSesion
    window.abrirSesion = function (num) {
      var args = arguments
      if (gateAplica() && !(S && S.memBloqueo)) { gate(function () { _abrir.apply(window, args) }); return Promise.resolve() }
      return _abrir.apply(window, args)
    }
    var _vista = window.vista
    window.vista = function (id) {
      var r = _vista.apply(window, arguments)
      if (id === 'vClub') { var tb = $('tabbar'); if (tb && perfil()) tb.classList.add('vis') }
      return r
    }
    var _tab = window.tab
    window.tab = function (id) {
      if (id !== 'vClub') return _tab.apply(window, arguments)
      try { var on = (document.querySelector('.vista.on') || {}).id; if (on !== 'vClub') { kAudioUnlock(); KSFX.play('set') } } catch (_) {}
      window.vista('vClub'); document.querySelectorAll('.tb').forEach(function (b) { b.classList.toggle('on', b.id === 'tb-vClub') })
      abrirVista()
    }
    return true
  }
  function iniciar() {
    estilos()
    var n = 0, t = setInterval(function () {
      n++; if (n > 600) { clearInterval(t); return }
      if (!cli() || !perfil() || !$('tabbar')) return
      clearInterval(t)
      if (!enganchar()) return
      montarTab(); cargarEstado()
      setInterval(function () { if (!document.hidden && perfil()) cargarEstado() }, 300000)
    }, 500)
  }

  window.KCLUB = {
    unirse: unirse, challenge: abrirRun, compartir: compartir, reaccionar: reaccionar,
    filtro: function (f) { K.filtro = f; pintarVista() },
    _gateUnir: async function () { if (await unirse(false)) abrirRun() },
    _gateRun: function () { abrirRun() },
    _gateSalir: function () { try { localStorage.setItem('kc_gate_' + K.ch.slug, hoy()) } catch (_) {} continuar() },
    _runStart: runStart, _runParar: runParar, _runMarca: function () { pedirMarca(false) }, _paso: pasoNum, _registrar: registrar,
    _runCerrar: runCerrar, _continuar: continuar,
    _verRanking: function () { cerrarRun(); tab('vClub') },
    _estado: function () { return K }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar); else iniciar()
})()
