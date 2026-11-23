/* KOACH · ESTRICTOS — challenge permanente del 1% CLUB.
   Muestra a los socios con asistencia al 100% cada semana (todas las sesiones que programó su koach, completadas)
   y su ranking por semanas seguidas al 100%. Regla y datos: club_estrictos_estado (koach_gamif_calc).
   Sub-branding: plata cromada sobre negro, grilla de semanas cumplidas. */
(function () {
  'use strict'
  var E = { st: null, cargando: false, anim: false }
  function $(id) { return document.getElementById(id) }
  function esc(t) { return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] }) }
  function cli() { try { return sb } catch (_) { return null } }
  function av(path, n) { try { if (window.KAvatar) return KAvatar.html(path, n, 'kcAv') } catch (_) {} return '<span class="kcAv">' + esc(String(n || 'K')[0]) + '</span>' }

  var css = `
.esCard,.esMini,.bmCard.est{--es:linear-gradient(180deg,#FFFFFF 0%,#C9CDD1 38%,#7D8287 52%,#E6E8EA 70%,#9DA2A6 100%)}
.esCard{position:relative;margin:16px 0 4px;padding:18px 16px 16px;border-radius:16px;background:linear-gradient(180deg,#151618 0%,#0B0C0D 100%);border:1px solid rgba(255,255,255,.14);overflow:hidden}
.esGrid{position:absolute;inset:0;pointer-events:none;opacity:.5;background-image:linear-gradient(rgba(255,255,255,.07) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.07) 1px,transparent 1px);background-size:18px 18px;-webkit-mask:linear-gradient(200deg,#000 0%,transparent 60%);mask:linear-gradient(200deg,#000 0%,transparent 60%)}
.esT{position:relative;margin:12px 0 0;font:900 44px/.9 'KOACH Display','KOACH Display Fallback',sans-serif;font-stretch:118%;letter-spacing:.01em;background:var(--es);-webkit-background-clip:text;background-clip:text;color:transparent;filter:drop-shadow(0 0 14px rgba(255,255,255,.18))}
.esHd{position:relative;display:flex;justify-content:space-between;font:700 9px/1 'Space Mono','Space Mono Fallback',monospace;letter-spacing:.18em;color:#979C9F}
.esHd span:first-child{color:#E6E8EA}
.esD{position:relative;margin:10px 0 0;font:600 13.5px/1.45 'KOACH Display',sans-serif;color:#D5D7D9;max-width:330px}
.esSt{position:relative;display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:14px}
.esSt div{border:1px solid rgba(255,255,255,.14);border-radius:10px;padding:10px 8px;background:rgba(0,0,0,.3)}
.esSt b{display:block;font:900 24px/1 'KOACH Display',sans-serif;color:#F2F2F2}
.esSt b small{font:700 10px/1 'Space Mono',monospace;color:#979C9F;margin-left:3px}
.esSt span{display:block;margin-top:6px;font:700 8px/1.3 'Space Mono',monospace;letter-spacing:.12em;color:#979C9F}
.esWk{position:relative;display:grid;grid-template-columns:repeat(8,1fr);gap:5px;margin-top:14px}
.esWk i{height:22px;border-radius:3px;background:#26282B;border:1px solid rgba(255,255,255,.06)}
.esWk i.ok{background:var(--es);border-color:transparent;box-shadow:0 0 10px rgba(255,255,255,.12)}
.esWk i.cur{background:transparent;border:1px dashed rgba(255,255,255,.45)}
.esWk i.pa{background:repeating-linear-gradient(135deg,#26282B 0 4px,#1A1B1D 4px 8px)}
.esWkL{position:relative;display:flex;justify-content:space-between;margin-top:6px;font:700 7.5px/1 'Space Mono',monospace;letter-spacing:.14em;color:#6F7377}
.esSem{position:relative;margin-top:12px;font:700 9px/1.5 'Space Mono',monospace;letter-spacing:.12em;color:#B9BCBF}
.esSem.ok{color:#3EC6B0}
.esRk{position:relative;margin-top:16px}.esRk .kcSec{margin:0 0 8px}
.esCard .kcRow.yo{border-color:#E6E8EA;background:rgba(255,255,255,.06)}
.esCard .kcRow.t1 .p,.esCard .kcRow.t2 .p,.esCard .kcRow.t3 .p{color:#F2F2F2}
.esU{font:700 9px/1 'Space Mono',monospace;color:#979C9F;margin-left:3px}
.esMini{background:linear-gradient(180deg,#121315,#0A0B0C)}
.esMini .esGrid{-webkit-mask:linear-gradient(270deg,#000 0%,transparent 70%);mask:linear-gradient(270deg,#000 0%,transparent 70%)}
.esBar{position:absolute;right:16px;top:44px;display:grid;grid-template-columns:repeat(4,14px);gap:4px}
.esBar i{height:14px;border-radius:2px;background:var(--es);opacity:.9}
.esBar i:nth-child(3n){opacity:.35}
.esMiniT{margin-top:16px;font-size:40px}
@media (prefers-reduced-motion:no-preference){
.esCard.esAnim .esT,.bm.bmAnim .esMiniT{animation:esShine 1.2s ease-out both}
.esCard.esAnim .esWk i{animation:esPop .35s cubic-bezier(.2,1.4,.4,1) both}
.esCard.esAnim .esWk i:nth-child(2){animation-delay:.05s}.esCard.esAnim .esWk i:nth-child(3){animation-delay:.1s}.esCard.esAnim .esWk i:nth-child(4){animation-delay:.15s}
.esCard.esAnim .esWk i:nth-child(5){animation-delay:.2s}.esCard.esAnim .esWk i:nth-child(6){animation-delay:.25s}.esCard.esAnim .esWk i:nth-child(7){animation-delay:.3s}.esCard.esAnim .esWk i:nth-child(8){animation-delay:.35s}}
@keyframes esShine{0%{opacity:0;letter-spacing:.3em;filter:blur(6px)}100%{opacity:1;letter-spacing:.01em;filter:drop-shadow(0 0 14px rgba(255,255,255,.18))}}
@keyframes esPop{from{transform:scaleY(.2);opacity:0}to{transform:none;opacity:1}}
`
  function estilos() { if ($('esCss')) return; var s = document.createElement('style'); s.id = 'esCss'; s.textContent = css; document.head.appendChild(s) }
  async function cargar() {
    try { var r = await cli().rpc('club_estrictos_estado'); if (!r.error) E.st = r.data } catch (e) { console.error('club_estrictos_estado', e) }
    return E.st
  }
  function semanaTxt(s) {
    var w = s.semana || {}, p = w.planif, h = w.hechas || 0
    if (!s.con_plan) return '<p class="esSem">CUANDO TU KOACH TE ASIGNE TU PROGRAMA, TU ASISTENCIA SE MIDE AQUÍ.</p>'
    if (w.estado === 'pausa') return '<p class="esSem">SEMANA EN PAUSA POR CONGELAMIENTO: NO AFECTA TU RACHA.</p>'
    if (!p) return '<p class="esSem">ESTA SEMANA NO TIENES SESIONES PROGRAMADAS.</p>'
    if (h >= p) return '<p class="esSem ok">✓ ESTA SEMANA YA ESTÁS AL 100%</p>'
    return '<p class="esSem">' + (p - h === 1 ? 'TE FALTA 1 SESIÓN' : 'TE FALTAN ' + (p - h) + ' SESIONES') + ' PARA CERRAR ESTA SEMANA AL 100%' + (s.racha ? ' Y LLEVAR TU RACHA A ' + (s.racha + 1) : '') + '</p>'
  }
  function semanas(s) {
    var L = (s.semanas || []).slice().reverse(); while (L.length < 8) L.unshift(null)
    return '<div class="esWk">' + L.map(function (w) { if (!w) return '<i></i>'
      return '<i class="' + (w.estado === 'cumplida' ? 'ok' : w.estado === 'en_curso' ? 'cur' : w.estado === 'pausa' ? 'pa' : '') + '"></i>' }).join('') + '</div><div class="esWkL"><span>8 SEMANAS</span><span>ESTA SEMANA</span></div>'
  }
  function cardHTML() {
    var s = E.st || {}, w = s.semana || {}
    var h = '<div class="esGrid" aria-hidden="true"></div><div class="esHd"><span>CHALLENGE PERMANENTE</span><span>' + (s.estrictos || 0) + ' ESTRICTOS</span></div><h2 class="esT">ESTRICTOS</h2>' +
      '<p class="esD">Asistencia al 100% cada semana: todas las sesiones que programó tu koach, completadas. Cada semana al 100% suma a tu racha.</p>' +
      '<div class="esSt"><div><b>' + (s.racha || 0) + '<small>SEM</small></b><span>RACHA AL 100%</span></div><div><b>' + (w.planif ? Math.min(w.hechas || 0, w.planif) + '/' + w.planif : '—') + '</b><span>ESTA SEMANA</span></div><div><b>' + (s.racha_max || 0) + '<small>SEM</small></b><span>MEJOR RACHA</span></div></div>' +
      semanas(s) + semanaTxt(s)
    var rk = s.ranking || [], top = rk.slice(0, 10), yo = rk.filter(function (x) { return x.yo && x.pos > 10 })[0]
    var filas = top.concat(yo ? [yo] : []).map(function (x) {
      return '<div class="kcRow' + (x.yo ? ' yo' : '') + (x.pos <= 3 ? ' t' + x.pos : '') + '"><span class="p">' + String(x.pos).padStart(2, '0') + '</span>' + av(x.avatar, x.nombre) +
        '<span class="n">' + esc(x.nombre) + '<small>' + x.cumplidas + (x.cumplidas === 1 ? ' SEMANA AL 100%' : ' SEMANAS AL 100%') + '</small></span><span class="s">' + x.racha + '<small class="esU">SEM</small></span></div>' }).join('')
    h += '<div class="esRk"><div class="kcSec"><span>RANKING · ESTRICTOS</span><span>SEMANAS SEGUIDAS</span></div>' +
      (filas || '<div class="kcVac">LA PRIMERA SEMANA AL 100% ABRE EL RANKING.</div>') + '</div>'
    return h
  }
  function miniHTML(n) {
    estilos(); var s = E.st || {}, w = s.semana || {}
    return '<div class="bmArt esMini" aria-hidden="true"><div class="esGrid"></div><div class="esBar">' + new Array(13).join('<i></i>') + '</div></div><div class="bmIn">' +
      '<div class="bmMeta"><span><b>' + String(n).padStart(2, '0') + '</b> · PERMANENTE</span><span>' + (s.estrictos || 0) + ' ESTRICTOS</span></div>' +
      '<p class="esT esMiniT">ESTRICTOS</p>' +
      '<div class="bmDat"><div>' + (s.racha || 0) + '<span>SEM AL 100%</span></div>' + (w.planif ? '<div>' + Math.min(w.hechas || 0, w.planif) + '/' + w.planif + '<span>ESTA SEMANA</span></div>' : '') + '</div></div>'
  }
  function montar(v) {
    estilos(); if (!v) return
    var body = v.querySelector('.kcBody'); if (!body) return
    var c = body.querySelector('#esCard'); if (!c) { c = document.createElement('section'); c.id = 'esCard'; c.className = 'esCard'; body.appendChild(c) }
    var h = cardHTML(); if (c._h !== h) { c.innerHTML = h; c._h = h }
    if (!E.anim) { E.anim = true; c.classList.add('esAnim') }
    if (!E.st && !E.cargando) { E.cargando = true; cargar().then(function () { E.cargando = false; if (E.st) montar(v) }) }
  }
  window.KEST = { cargar: cargar, montar: montar, miniHTML: miniHTML, _estado: function () { return E } }
})()
