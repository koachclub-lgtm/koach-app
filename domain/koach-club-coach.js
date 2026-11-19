/* ═══ 1% CLUB · panel del koach (c300) ═══
   Botón flotante "CHALLENGE · N POR VALIDAR" en el Dashboard (admin, coach, recepción) mientras hay un challenge visible.
   Validar o rechazar marcas, corregir la cifra y registrar la marca de un socio que no anda con el teléfono. */
(function () {
  'use strict'
  var K = { ch: null, ent: [], abierto: false, t: null }
  function $(id) { return document.getElementById(id) }
  function esc(t) { return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] }) }
  function cli() { try { return sb } catch (_) { return null } }
  function yo() { try { return C && C.yo } catch (_) { return null } }
  function socios() { try { return (C.socios || []).filter(function (s) { return s.role === 'socio' || !s.role }) } catch (_) { return [] } }
  async function rpc(n, a) { var r = await cli().rpc(n, a || {}); if (r.error) throw r.error; return r.data }
  function aviso(m) { try { toast(m) } catch (_) { alert(m) } }
  var css = `
.kccB{position:fixed;right:16px;bottom:calc(84px + env(safe-area-inset-bottom,0px));z-index:70;border:1px solid #3EC6B0;background:#0B0C0E;color:#F2F2F2;border-radius:999px;padding:12px 16px;font:700 11px/1 'Space Mono',monospace;letter-spacing:.12em;cursor:pointer;box-shadow:0 8px 24px rgba(0,0,0,.25)}
.kccB b{color:#3EC6B0}
.kccM{position:fixed;inset:0;z-index:120;background:rgba(10,10,12,.6);display:none;align-items:flex-end;justify-content:center}
.kccM.on{display:flex}
.kccP{width:min(560px,100%);max-height:88vh;overflow:auto;background:#17191C;color:#F2F2F2;border-radius:16px 16px 0 0;padding:18px 16px calc(18px + env(safe-area-inset-bottom,0px));box-sizing:border-box}
.kccH{display:flex;justify-content:space-between;align-items:center;margin-bottom:12px}
.kccH b{font:900 20px/1 'KOACH Display',sans-serif}.kccH small{display:block;font:700 9px/1.6 'Space Mono',monospace;letter-spacing:.14em;color:#979C9F}
.kccX{width:36px;height:36px;border-radius:50%;border:1px solid rgba(255,255,255,.2);background:transparent;color:#fff;cursor:pointer}
.kccR{display:grid;grid-template-columns:1fr 70px auto;gap:8px;align-items:center;padding:10px;border-radius:10px;background:rgba(255,255,255,.05);margin-bottom:6px}
.kccR.pendiente{border:1px solid rgba(62,198,176,.45)}.kccR.rechazado{opacity:.5}
.kccR .n{font-weight:800;font-size:13px}.kccR .n small{display:block;font:700 8px/1.5 'Space Mono',monospace;letter-spacing:.12em;color:#979C9F}
.kccR input,.kccA input{width:100%;box-sizing:border-box;background:#0B0C0E;border:1px solid #434649;color:#fff;border-radius:8px;padding:9px;font:900 18px/1 'KOACH Display',sans-serif;text-align:center}
.kccR .a{display:flex;gap:6px}
.kccR button,.kccA button{border:1px solid #6F7377;background:transparent;color:#F2F2F2;border-radius:8px;padding:9px 10px;font:700 10px/1 'Space Mono',monospace;cursor:pointer}
.kccR button.ok{border-color:#3EC6B0;color:#3EC6B0}.kccR button.no{border-color:#FF4200;color:#FF4200}
.kccA{display:grid;grid-template-columns:1fr 70px auto;gap:8px;margin:14px 0 4px}
.kccA input[type=text]{font:400 13px/1 system-ui,sans-serif;text-align:left}
.kccS{font:700 9px/1 'Space Mono',monospace;letter-spacing:.16em;color:#979C9F;margin:16px 0 8px}
`
  function estilos() { if ($('kccCss')) return; var s = document.createElement('style'); s.id = 'kccCss'; s.textContent = css; document.head.appendChild(s) }
  async function cargar() {
    try { var st = await rpc('club_estado'); K.ch = st && st.challenge || null } catch (_) { K.ch = null }
    if (!K.ch) { boton(); return }
    try { K.ent = await rpc('club_entradas_staff', { p_challenge: K.ch.id }) || [] } catch (_) { K.ch = null; K.ent = [] }
    boton(); if (K.abierto) pintar()
  }
  function boton() {
    var b = $('kccBtn')
    if (!K.ch) { if (b) b.remove(); return }
    if (!b) { b = document.createElement('button'); b.id = 'kccBtn'; b.className = 'kccB'; b.type = 'button'; b.onclick = abrir; document.body.appendChild(b) }
    var n = K.ent.filter(function (e) { return e.estado === 'pendiente' }).length
    b.innerHTML = 'CHALLENGE · ' + (n ? '<b>' + n + ' POR VALIDAR</b>' : K.ent.length + ' MARCAS')
  }
  function abrir() { K.abierto = true; pintar(); cargar() }
  function cerrar() { K.abierto = false; var m = $('kccMod'); if (m) m.classList.remove('on') }
  function pintar() {
    var m = $('kccMod'); if (!m) { m = document.createElement('div'); m.id = 'kccMod'; m.className = 'kccM'; m.onclick = function (e) { if (e.target === m) cerrar() }; document.body.appendChild(m) }
    var ch = K.ch || {}
    var lista = K.ent.map(function (e) {
      return '<div class="kccR ' + e.estado + '"><span class="n">' + esc(e.nombre) + '<small>' + (e.estado === 'pendiente' ? 'POR VALIDAR' : e.estado === 'validado' ? '✓ VALIDADA' : 'RECHAZADA') + '</small></span>' +
        '<input type="number" inputmode="numeric" min="1" max="150" value="' + e.score + '" id="kcc_' + e.id + '" aria-label="Marca de ' + esc(e.nombre) + '">' +
        '<span class="a"><button type="button" class="ok" onclick="KCLUBK.validar(\'' + e.id + '\',\'' + e.socio_id + '\',' + e.score + ')">✓</button><button type="button" class="no" onclick="KCLUBK.rechazar(\'' + e.id + '\')">✕</button></span></div>'
    }).join('')
    m.innerHTML = '<div class="kccP"><div class="kccH"><div><small>1% CLUB · VALIDACIÓN</small><b>' + esc(ch.titulo || 'CHALLENGE') + '</b></div><button type="button" class="kccX" aria-label="Cerrar" onclick="KCLUBK.cerrar()">✕</button></div>' +
      '<div class="kccS">REGISTRAR MARCA DE UN SOCIO</div><div class="kccA"><input type="text" id="kccSoc" list="kccSocL" placeholder="Nombre del socio" autocomplete="off"><input type="number" inputmode="numeric" id="kccSc" placeholder="0" min="1" max="150"><button type="button" onclick="KCLUBK.registrar()">GUARDAR</button></div>' +
      '<datalist id="kccSocL">' + socios().map(function (s) { return '<option value="' + esc(((s.nombre || '') + ' ' + (s.apellido || '')).trim()) + '">' }).join('') + '</datalist>' +
      '<div class="kccS">MARCAS · ' + K.ent.length + '</div>' + (lista || '<p style="font:400 12px/1.6 system-ui;color:#979C9F">Todavía no hay marcas.</p>') + '</div>'
    m.classList.add('on')
  }
  async function validar(id, socio, original) {
    var v = parseInt(($('kcc_' + id) || {}).value)
    try { if (v && v !== original) await rpc('club_registrar_staff', { p_challenge: K.ch.id, p_socio: socio, p_score: v }); else await rpc('club_validar', { p_entrada: id, p_ok: true }); aviso('Marca validada.') }
    catch (e) { aviso(e.message || 'No se pudo validar.') }
    cargar()
  }
  async function rechazar(id) {
    if (!confirm('¿Rechazar esta marca? Sale del ranking.')) return
    try { await rpc('club_validar', { p_entrada: id, p_ok: false }) } catch (e) { aviso(e.message || 'No se pudo rechazar.') }
    cargar()
  }
  async function registrar() {
    var q = String(($('kccSoc') || {}).value || '').trim().toLowerCase(), v = parseInt(($('kccSc') || {}).value)
    var s = socios().filter(function (x) { return ((x.nombre || '') + ' ' + (x.apellido || '')).trim().toLowerCase() === q })[0]
    if (!s) { aviso('Elige el socio de la lista.'); return }
    if (!v || v < 1 || v > 150) { aviso('Ingresa una marca entre 1 y 150.'); return }
    try { await rpc('club_registrar_staff', { p_challenge: K.ch.id, p_socio: s.id, p_score: v }); aviso('Marca guardada y validada.') } catch (e) { aviso(e.message || 'No se pudo guardar.') }
    cargar()
  }
  function iniciar() {
    estilos()
    var n = 0, t = setInterval(function () {
      if (++n > 600) { clearInterval(t); return }
      var y = yo(); if (!cli() || !y) return
      clearInterval(t)
      if (['admin', 'coach', 'recepcion'].indexOf(y.role) < 0) return
      cargar(); K.t = setInterval(function () { if (!document.hidden && yo()) cargar() }, 60000)
    }, 700)
  }
  window.KCLUBK = { validar: validar, rechazar: rechazar, registrar: registrar, cerrar: cerrar, abrir: abrir }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar); else iniciar()
})()
