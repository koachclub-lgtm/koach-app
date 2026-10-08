/* ═══ c65 · EQUIPO · control de asistencia del personal dentro del Dashboard (coach.html) ═══
   Todo el staff: MI ASISTENCIA (sus marcas, turno, dispositivo).
   Admin: HOY · REGISTRO (rango + CSV) · EQUIPO (turnos y dispositivos) · correcciones con motivo.
   Admin y recepción: botón para abrir el KIOSKO QR (/kiosko.html) en el PC central.
   Las reglas viven en la base (RPC asist_*): aquí solo se muestra y se piden acciones. */
(function (g) {
  'use strict'
  var A = g.KAsist
  var EQ = { tab: null, rango: 'semana', persona: '', equipo: null, filas: null, mi: null, abiertos: {} }
  var DIAS = ['', 'LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB', 'DOM']
  var ROL = { admin: 'ADMIN', coach: 'COACH', recepcion: 'RECEPCIÓN', nutricionista: 'NUTRICIÓN' }
  var EST = { ok: ['A TIEMPO', ''], atraso: ['ATRASO', 'w'], ausente: ['AUSENTE', 'x'], sin_salida: ['SIN SALIDA', 'w'], en_turno: ['EN EL CLUB', 'k'],
              pendiente: ['POR LLEGAR', ''], programado: ['PROGRAMADO', ''], anulado: ['ANULADO', ''] }

  function rol () { return (g.C && g.C.yo && g.C.yo.role) || '' }
  function esAdm () { return rol() === 'admin' }
  function esCom () { return rol() === 'admin' || rol() === 'recepcion' }
  function sb () { return A.cliente() }
  function $ (id) { return document.getElementById(id) }
  function avisoErr (e) { var m = A.mensaje(e); if (g.kAviso) g.kAviso(m.titulo + '\n' + m.texto, 'ASISTENCIA'); else alert(m.texto) }
  function tst (t) { if (g.toast) g.toast(t) }
  function hm (t) { return t ? String(t).slice(0, 5) : '—' }

  // ─── estilos (scoped .eq*) ───
  var css = '' +
    '.eqTop{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:12px}' +
    '.eqTop .stit{margin-right:auto}' +
    '.eqBtn{appearance:none;font-family:var(--font-mono);font-weight:500;font-size:10px;letter-spacing:.08em;text-transform:uppercase;border:1px solid var(--koach-border-strong);background:var(--koach-control);color:var(--koach-ink);border-radius:var(--radius-pill,999px);padding:9px 14px;min-height:38px;cursor:pointer;text-decoration:none;display:inline-flex;align-items:center;gap:6px}' +
    '.eqBtn--p{background:var(--koach-ink);color:var(--koach-surface);border-color:var(--koach-ink)}' +
    '.eqBtn--s{min-height:30px;padding:6px 10px;font-size:9px}' +
    '.eqTabs{display:flex;gap:6px;flex-wrap:wrap;margin:0 0 14px}' +
    '.eqTabs button{font-family:var(--font-mono);font-weight:500;font-size:10px;letter-spacing:.06em;border:1px solid var(--koach-border-strong);background:transparent;color:var(--koach-ink);border-radius:var(--radius-pill,999px);padding:9px 14px;min-height:38px;cursor:pointer}' +
    '.eqTabs button.on{background:var(--koach-ink);color:var(--koach-surface);border-color:var(--koach-ink)}' +
    '.eqKpi{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;margin:0 0 12px}' +
    '@media (max-width:700px){.eqKpi{grid-template-columns:repeat(2,minmax(0,1fr))}}' +
    '.eqKpi div{background:var(--koach-surface);border:1px solid var(--koach-border);border-radius:10px;padding:12px}' +
    '.eqKpi b{display:block;font-family:var(--font-display);font-weight:800;font-size:26px;line-height:1}' +
    '.eqKpi span{display:block;font-family:var(--font-mono);font-size:9px;letter-spacing:.08em;color:var(--koach-text-secondary);margin-top:6px;text-transform:uppercase}' +
    '.eqCard{background:var(--koach-surface);border:1px solid var(--koach-border);border-radius:10px;padding:14px;margin-bottom:8px}' +
    '.eqRow{display:grid;grid-template-columns:minmax(0,1.4fr) auto;gap:10px;align-items:start}' +
    '.eqN{font-family:var(--font-display);font-weight:700;font-size:16px;line-height:1.15;text-transform:uppercase}' +
    '.eqS{font-family:var(--font-mono);font-size:10px;letter-spacing:.04em;color:var(--koach-text-secondary);margin-top:4px;line-height:1.5}' +
    '.eqM{display:flex;gap:14px;flex-wrap:wrap;margin-top:10px;font-family:var(--font-mono);font-size:11px}' +
    '.eqM span small{display:block;font-size:8.5px;letter-spacing:.08em;color:var(--koach-text-secondary)}' +
    '.eqT{display:inline-block;font-family:var(--font-mono);font-weight:500;font-size:9px;letter-spacing:.06em;border:1px solid var(--koach-border-strong);border-radius:6px;padding:4px 7px;white-space:nowrap}' +
    '.eqT.w{border-color:#B07A12;color:#8A5E08}.eqT.x{border-color:#B3261E;color:#B3261E}.eqT.k{background:var(--koach-ink);color:var(--koach-surface);border-color:var(--koach-ink)}' +
    '.eqMk{margin-top:10px;border-top:1px dashed var(--koach-border);padding-top:8px}' +
    '.eqMk div{display:grid;grid-template-columns:auto 1fr auto;gap:10px;align-items:center;font-family:var(--font-mono);font-size:11px;padding:5px 0}' +
    '.eqMk div.anu{opacity:.45;text-decoration:line-through}' +
    '.eqMk em{font-style:normal;color:var(--koach-text-secondary);font-size:10px;overflow:hidden;text-overflow:ellipsis}' +
    '.eqFil{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:10px}' +
    '.eqSel,.eqIn{font-family:var(--font-mono);font-size:12px;border:1px solid var(--koach-border-strong);background:var(--koach-surface);color:var(--koach-ink);border-radius:8px;padding:9px 10px;min-height:38px}' +
    '.eqTbl{width:100%;border-collapse:collapse;font-family:var(--font-mono);font-size:11px}' +
    '.eqTbl th{font-weight:500;font-size:9px;letter-spacing:.08em;color:var(--koach-text-secondary);text-align:left;padding:8px 6px;border-bottom:1px solid var(--koach-border-strong);white-space:nowrap}' +
    '.eqTbl td{padding:9px 6px;border-bottom:1px solid var(--koach-border);vertical-align:top}' +
    '.eqTbl tr.clk{cursor:pointer}.eqTbl tr.clk:hover td{background:var(--koach-control)}' +
    '.eqWrap{overflow-x:auto;background:var(--koach-surface);border:1px solid var(--koach-border);border-radius:10px;padding:4px 8px;margin-bottom:12px}' +
    '.eqNote{font-family:var(--font-mono);font-size:10px;line-height:1.6;color:var(--koach-text-secondary);margin:14px 0}' +
    '.eqMod{position:fixed;inset:0;z-index:90;background:rgba(0,0,0,.45);display:flex;align-items:flex-end;justify-content:center}' +
    '@media (min-width:700px){.eqMod{align-items:center}}' +
    '.eqMod__c{background:var(--koach-surface);color:var(--koach-ink);width:100%;max-width:460px;border-radius:14px 14px 0 0;padding:18px 18px calc(18px + env(safe-area-inset-bottom,0));max-height:92vh;overflow:auto}' +
    '@media (min-width:700px){.eqMod__c{border-radius:14px}}' +
    '.eqMod__c h3{font-family:var(--font-display);font-weight:800;font-size:20px;text-transform:uppercase;margin:4px 0 12px}' +
    '.eqMod__c label{display:block;font-family:var(--font-mono);font-size:9px;letter-spacing:.08em;color:var(--koach-text-secondary);margin:10px 0 4px;text-transform:uppercase}' +
    '.eqMod__c .eqSel,.eqMod__c .eqIn{width:100%}' +
    '.eqMod__b{display:flex;gap:8px;justify-content:flex-end;margin-top:16px}' +
    '.eqTur{display:grid;grid-template-columns:44px 1fr 1fr 1fr 1fr;gap:6px;align-items:center;margin-bottom:6px}' +
    '.eqTur b{font-family:var(--font-mono);font-size:10px}' +
    '.eqTur input{font-family:var(--font-mono);font-size:12px;border:1px solid var(--koach-border-strong);background:var(--koach-surface);color:var(--koach-ink);border-radius:6px;padding:7px 4px;width:100%;min-width:0}' +
    '.eqErr{color:#B3261E;font-family:var(--font-mono);font-size:11px;min-height:16px;margin-top:8px}'
  var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st)

  // ─── vista ───
  function asegurarVista () {
    if ($('vEquipo')) return
    var v = document.createElement('div'); v.className = 'vista'; v.id = 'vEquipo'
    v.innerHTML = '<div class="eqTop"><button class="sback" onclick="verSala()" aria-label="Volver a la Sala">←</button><div class="stit">Equipo</div>' +
      '<span id="eqAcc"></span></div><div class="ssub" id="eqSub">ASISTENCIA DEL EQUIPO · ENTRADAS Y SALIDAS</div>' +
      '<div class="eqTabs" id="eqTabs" role="tablist"></div><div id="eqBody"><div class="vacio">Cargando…</div></div>'
    var ref = $('vBib') || document.querySelector('.vista:last-of-type')
    ref.parentNode.insertBefore(v, ref.nextSibling)
  }

  function verEquipo (tab) {
    asegurarVista()
    var tabs = esAdm() ? [['hoy', 'HOY'], ['reg', 'REGISTRO'], ['eq', 'EQUIPO Y TURNOS'], ['mi', 'MI ASISTENCIA']] : [['mi', 'MI ASISTENCIA']]
    if (!tab || !tabs.some(function (t) { return t[0] === tab })) tab = EQ.tab && tabs.some(function (t) { return t[0] === EQ.tab }) ? EQ.tab : tabs[0][0]
    EQ.tab = tab
    if (g.vista) g.vista('vEquipo')
    $('eqAcc').innerHTML = esCom() ? '<a class="eqBtn eqBtn--p" href="/kiosko.html" target="_blank" rel="noopener">ABRIR KIOSKO QR ↗</a>' : ''
    $('eqTabs').innerHTML = tabs.map(function (t) {
      return '<button role="tab" aria-selected="' + (t[0] === tab) + '" class="' + (t[0] === tab ? 'on' : '') + '" onclick="EQUIPO.ver(\'' + t[0] + '\')">' + t[1] + '</button>' }).join('')
    if (g.rtSet) g.rtSet(tab === 'mi' ? '#/equipo/mi' : '#/equipo' + (tab === 'hoy' ? '' : '/' + tab), 'Equipo | KOACH')
    $('eqBody').innerHTML = '<div class="vacio">Cargando…</div>'
    if (tab === 'hoy') return pintarHoy()
    if (tab === 'reg') return pintarReg()
    if (tab === 'eq') return pintarEquipo()
    return pintarMi()
  }

  // ─── tarjeta de un día ───
  function tag (estado) { var e = EST[estado] || [String(estado || '').toUpperCase(), '']; return '<span class="eqT ' + e[1] + '">' + e[0] + '</span>' }
  function marcasHTML (f, admin) {
    if (!f.marcas || !f.marcas.length) return ''
    return '<div class="eqMk">' + f.marcas.map(function (m) {
      var det = m.anulada ? 'ANULADA · ' + (m.motivo_anul || '') : m.origen === 'manual' ? 'MANUAL · ' + (m.motivo || '') : 'QR · ' + (m.terminal || '')
      return '<div class="' + (m.anulada ? 'anu' : '') + '"><b>' + (m.tipo === 'entrada' ? 'ENTRADA' : 'SALIDA') + ' ' + A.hora(m.at) + '</b><em title="' + A.esc(det) + '">' + A.esc(det) + '</em>' +
        (admin && !m.anulada ? '<button class="eqBtn eqBtn--s" onclick="EQUIPO.anular(\'' + m.id + '\')">ANULAR</button>' : '<span></span>') + '</div>'
    }).join('') + '</div>'
  }
  function diaCard (f, admin, conNombre) {
    var turno = f.turno_inicio ? hm(f.turno_inicio) + '–' + hm(f.turno_fin) : 'SIN TURNO'
    return '<div class="eqCard"><div class="eqRow"><div>' +
      (conNombre ? '<div class="eqN">' + A.esc(f.nombre) + '</div><div class="eqS">' + (ROL[f.rol] || f.rol) + ' · TURNO ' + turno + '</div>'
                 : '<div class="eqN">' + A.esc(A.fecha(f.fecha, true)) + '</div><div class="eqS">TURNO ' + turno + '</div>') +
      '</div>' + tag(f.estado) + '</div>' +
      '<div class="eqM"><span><small>ENTRADA</small>' + (f.entrada ? A.hora(f.entrada) : '—') + '</span><span><small>SALIDA</small>' + (f.salida ? A.hora(f.salida) : '—') + '</span>' +
      '<span><small>TRABAJADO</small>' + (f.minutos ? A.min2h(f.minutos) : '—') + '</span>' +
      (f.atraso_min ? '<span><small>ATRASO</small>' + f.atraso_min + ' min</span>' : '') + '</div>' +
      marcasHTML(f, admin) + '</div>'
  }

  // ─── HOY (admin) ───
  async function pintarHoy () {
    var h = A.hoyISO()
    var r = await sb().rpc('asist_admin_resumen', { p_desde: h, p_hasta: h })
    if (r.error) { $('eqBody').innerHTML = '<div class="vacio">' + A.esc(A.mensaje(r.error).texto) + '</div>'; return }
    var f = r.data || []
    var dentro = f.filter(function (x) { return x.abierta }).length
    var atr = f.filter(function (x) { return x.estado === 'atraso' }).length
    var aus = f.filter(function (x) { return x.estado === 'ausente' }).length
    var pen = f.filter(function (x) { return x.estado === 'pendiente' }).length
    $('eqBody').innerHTML =
      '<div class="eqKpi"><div><b>' + dentro + '</b><span>EN EL CLUB AHORA</span></div><div><b>' + atr + '</b><span>ATRASOS HOY</span></div>' +
      '<div><b>' + aus + '</b><span>AUSENTES</span></div><div><b>' + pen + '</b><span>POR LLEGAR</span></div></div>' +
      '<div class="eqFil"><button class="eqBtn" onclick="EQUIPO.manual()">+ MARCA MANUAL</button><button class="eqBtn" onclick="EQUIPO.ver(\'hoy\')">ACTUALIZAR</button></div>' +
      (f.length ? f.sort(function (a, b) { return ordenEstado(a) - ordenEstado(b) || String(a.nombre).localeCompare(b.nombre) })
        .map(function (x) { return diaCard(x, true, true) }).join('')
        : '<div class="vacio">Nadie marcó hoy y no hay turnos programados.<br><br>Define los turnos en EQUIPO Y TURNOS para medir atrasos y ausencias.</div>') +
      '<p class="eqNote">Atraso = entrada más de 5 min después del inicio del turno. Las marcas no se editan ni se borran: se anulan con motivo o se agrega una marca manual con motivo. Todo queda en el registro.</p>'
  }
  function ordenEstado (x) { return ({ en_turno: 0, atraso: 1, ausente: 2, sin_salida: 3, pendiente: 4, ok: 5 })[x.estado] != null ? ({ en_turno: 0, atraso: 1, ausente: 2, sin_salida: 3, pendiente: 4, ok: 5 })[x.estado] : 9 }

  // ─── REGISTRO (admin) ───
  function rangoFechas (k) {
    var h = A.hoyISO(), d = new Date(h + 'T12:00:00'), dow = (d.getDay() + 6) % 7
    function iso (x) { return x.toISOString().slice(0, 10) }
    function add (x, n) { var y = new Date(x); y.setDate(y.getDate() + n); return y }
    if (k === 'semana') return [iso(add(d, -dow)), h]
    if (k === 'semana_ant') return [iso(add(d, -dow - 7)), iso(add(d, -dow - 1))]
    if (k === 'mes') return [h.slice(0, 8) + '01', h]
    if (k === 'mes_ant') { var p = new Date(d.getFullYear(), d.getMonth() - 1, 1, 12), u = new Date(d.getFullYear(), d.getMonth(), 0, 12); return [iso(p), iso(u)] }
    return [h, h]
  }
  async function pintarReg () {
    if (!EQ.equipo) { var e = await sb().rpc('asist_admin_equipo'); EQ.equipo = e.data || [] }
    var rg = rangoFechas(EQ.rango)
    var r = await sb().rpc('asist_admin_resumen', { p_desde: rg[0], p_hasta: rg[1], p_staff: EQ.persona || null })
    if (r.error) { $('eqBody').innerHTML = '<div class="vacio">' + A.esc(A.mensaje(r.error).texto) + '</div>'; return }
    var filas = (r.data || []).filter(function (x) { return x.estado !== 'programado' })
    EQ.filas = filas
    var tot = {}
    filas.forEach(function (x) {
      var t = tot[x.staff_id] = tot[x.staff_id] || { nombre: x.nombre, dias: 0, min: 0, minT: 0, atr: 0, atrMin: 0, aus: 0, sinS: 0 }
      if (x.entrada) t.dias++
      t.min += x.minutos || 0; t.minT += x.minutos_turno || 0
      if (x.estado === 'atraso') { t.atr++; t.atrMin += x.atraso_min || 0 }
      if (x.estado === 'ausente') t.aus++
      if (x.estado === 'sin_salida') t.sinS++
    })
    var R = [['semana', 'ESTA SEMANA'], ['semana_ant', 'SEMANA PASADA'], ['mes', 'ESTE MES'], ['mes_ant', 'MES PASADO']]
    $('eqBody').innerHTML =
      '<div class="eqFil"><div class="adChips" style="margin:0">' + R.map(function (x) { return '<button class="' + (EQ.rango === x[0] ? 'on' : '') + '" onclick="EQUIPO.rango(\'' + x[0] + '\')">' + x[1] + '</button>' }).join('') + '</div>' +
      '<select class="eqSel" onchange="EQUIPO.persona(this.value)" aria-label="Persona"><option value="">TODO EL EQUIPO</option>' +
      EQ.equipo.map(function (p) { return '<option value="' + p.id + '"' + (EQ.persona === p.id ? ' selected' : '') + '>' + A.esc(p.nombre) + '</option>' }).join('') + '</select>' +
      '<button class="eqBtn" onclick="EQUIPO.csv()">DESCARGAR CSV</button><button class="eqBtn" onclick="EQUIPO.manual()">+ MARCA MANUAL</button></div>' +
      '<div class="eqS" style="margin:-2px 0 10px">' + A.esc(A.fecha(rg[0])).toUpperCase() + ' → ' + A.esc(A.fecha(rg[1])).toUpperCase() + '</div>' +
      '<div class="adK" style="margin-top:6px"><span>TOTALES POR PERSONA</span></div>' +
      '<div class="eqWrap"><table class="eqTbl"><thead><tr><th>PERSONA</th><th>DÍAS</th><th>HORAS</th><th>HORAS TURNO</th><th>ATRASOS</th><th>AUSENCIAS</th><th>SIN SALIDA</th></tr></thead><tbody>' +
      (Object.keys(tot).length ? Object.keys(tot).map(function (k) { var t = tot[k]
        return '<tr><td><b>' + A.esc(t.nombre) + '</b></td><td>' + t.dias + '</td><td>' + A.min2h(t.min) + '</td><td>' + (t.minT ? A.min2h(t.minT) : '—') + '</td><td>' + t.atr + (t.atrMin ? ' · ' + t.atrMin + ' min' : '') + '</td><td>' + t.aus + '</td><td>' + t.sinS + '</td></tr>' }).join('')
        : '<tr><td colspan="7" class="vacio">Sin registros en este período.</td></tr>') + '</tbody></table></div>' +
      '<div class="adK"><span>DÍA A DÍA</span><span>TOCA UNA FILA PARA VER LAS MARCAS</span></div>' +
      '<div class="eqWrap"><table class="eqTbl"><thead><tr><th>FECHA</th><th>PERSONA</th><th>ENTRADA</th><th>SALIDA</th><th>TRABAJADO</th><th>TURNO</th><th>ESTADO</th></tr></thead><tbody>' +
      (filas.length ? filas.map(function (x, i) {
        var k = x.staff_id + x.fecha
        return '<tr class="clk" onclick="EQUIPO.toggle(\'' + k + '\')"><td>' + A.esc(A.fecha(x.fecha)).toUpperCase() + '</td><td>' + A.esc(x.nombre) + '</td><td>' + (x.entrada ? A.hora(x.entrada) : '—') + '</td><td>' + (x.salida ? A.hora(x.salida) : '—') +
          '</td><td>' + (x.minutos ? A.min2h(x.minutos) : '—') + '</td><td>' + (x.turno_inicio ? hm(x.turno_inicio) + '–' + hm(x.turno_fin) : '—') + '</td><td>' + tag(x.estado) + (x.atraso_min && x.estado === 'atraso' ? ' <small>' + x.atraso_min + ' min</small>' : '') + '</td></tr>' +
          (EQ.abiertos[k] ? '<tr><td colspan="7">' + (marcasHTML(x, true) || '<span class="eqS">Sin marcas.</span>') + '</td></tr>' : '')
      }).join('') : '<tr><td colspan="7" class="vacio">Sin registros.</td></tr>') + '</tbody></table></div>'
  }
  function csv () {
    var f = EQ.filas || []
    var rows = [['fecha', 'persona', 'rol', 'entrada', 'salida', 'minutos_trabajados', 'turno_inicio', 'turno_fin', 'minutos_turno', 'atraso_min', 'estado', 'marcas']]
    f.forEach(function (x) {
      rows.push([x.fecha, x.nombre, x.rol, x.entrada ? A.hora(x.entrada, true) : '', x.salida ? A.hora(x.salida, true) : '', x.minutos || 0, hm(x.turno_inicio).replace('—', ''), hm(x.turno_fin).replace('—', ''),
        x.minutos_turno || 0, x.atraso_min == null ? '' : x.atraso_min, x.estado,
        (x.marcas || []).map(function (m) { return (m.anulada ? '[ANULADA] ' : '') + m.tipo + ' ' + A.hora(m.at, true) + ' ' + m.origen + (m.motivo ? ' (' + m.motivo + ')' : '') }).join(' | ')])
    })
    var txt = '﻿' + rows.map(function (r) { return r.map(function (c) { c = String(c == null ? '' : c); return /[";,\n]/.test(c) ? '"' + c.replace(/"/g, '""') + '"' : c }).join(';') }).join('\n')
    var rg = rangoFechas(EQ.rango), a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([txt], { type: 'text/csv;charset=utf-8' })); a.download = 'asistencia-equipo_' + rg[0] + '_' + rg[1] + '.csv'
    document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove() }, 500)
  }

  // ─── EQUIPO Y TURNOS (admin) ───
  async function pintarEquipo () {
    var e = await sb().rpc('asist_admin_equipo')
    if (e.error) { $('eqBody').innerHTML = '<div class="vacio">' + A.esc(A.mensaje(e.error).texto) + '</div>'; return }
    EQ.equipo = e.data || []
    $('eqBody').innerHTML =
      (EQ.equipo.length ? EQ.equipo.map(function (p) {
        var tur = p.turnos.length ? agruparTurnos(p.turnos) : 'SIN TURNOS DEFINIDOS'
        var dev = p.dispositivo ? 'REGISTRADO ' + A.fecha(p.dispositivo.enrolado_at).toUpperCase() + ' · ' + A.esc(uaCorto(p.dispositivo.ua)) : 'SIN DISPOSITIVO · SE REGISTRA EN SU PRIMERA MARCA'
        return '<div class="eqCard"><div class="eqRow"><div><div class="eqN">' + A.esc(p.nombre) + '</div><div class="eqS">' + (ROL[p.rol] || p.rol) + ' · ' + A.esc(p.email || '') + '</div></div>' +
          (p.ultima ? '<span class="eqT' + (p.ultima.tipo === 'entrada' && p.ultima.at && String(p.ultima.at).slice(0, 10) >= A.hoyISO().slice(0, 8) ? '' : '') + '">ÚLT. ' + (p.ultima.tipo === 'entrada' ? 'ENTRADA' : 'SALIDA') + ' · ' + A.fecha(p.ultima.at).toUpperCase() + ' ' + A.hora(p.ultima.at) + '</span>' : '<span class="eqT">SIN MARCAS</span>') + '</div>' +
          '<div class="eqS" style="margin-top:10px"><b>TURNOS</b> · ' + tur + '</div><div class="eqS"><b>CELULAR</b> · ' + dev + '</div>' +
          '<div class="eqFil" style="margin:10px 0 0"><button class="eqBtn eqBtn--s" onclick="EQUIPO.turnos(\'' + p.id + '\')">EDITAR TURNOS</button>' +
          (p.dispositivo ? '<button class="eqBtn eqBtn--s" onclick="EQUIPO.liberar(\'' + p.id + '\')">LIBERAR CELULAR</button>' : '') +
          '<button class="eqBtn eqBtn--s" onclick="EQUIPO.persona(\'' + p.id + '\',true)">VER REGISTRO</button></div></div>'
      }).join('') : '<div class="vacio">No hay cuentas del equipo. Créalas en + NUEVO USUARIO con rol COACH, RECEPCIÓN o NUTRICIÓN.</div>') +
      '<div class="eqFil" style="margin-top:14px"><button class="eqBtn" onclick="EQUIPO.verificar()">VERIFICAR INTEGRIDAD DEL REGISTRO</button></div>' +
      '<p class="eqNote">Cada persona marca solo desde su celular registrado (el primero con que marca). Si cambia de equipo o borra el navegador, libera su celular y el próximo quedará registrado.<br>Cambiar un turno aplica desde hoy: los atrasos de días anteriores se calculan con el turno que estaba vigente.</p>'
  }
  function agruparTurnos (ts) {
    var by = {}; ts.forEach(function (t) { (by[t.dia] = by[t.dia] || []).push(hm(t.inicio) + '–' + hm(t.fin)) })
    return Object.keys(by).sort().map(function (d) { return DIAS[d] + ' ' + by[d].join(' / ') }).join(' · ')
  }
  function uaCorto (ua) {
    ua = String(ua || ''); var m = ua.match(/(iPhone|iPad|Android [0-9.]+|Windows|Macintosh)/); var b = ua.match(/(CriOS|Chrome|Safari|Firefox|SamsungBrowser)/)
    return (m ? m[1] : 'Dispositivo') + (b ? ' · ' + b[1].replace('CriOS', 'Chrome') : '')
  }

  // ─── MI ASISTENCIA (todo el staff) ───
  async function pintarMi () {
    var h = A.hoyISO(), desde = h.slice(0, 8) + '01'
    var r = await sb().rpc('asist_mi_resumen', { p_desde: desde, p_hasta: h })
    if (r.error) { $('eqBody').innerHTML = '<div class="vacio">' + A.esc(A.mensaje(r.error).texto) + '</div>'; return }
    var d = r.data || {}, dias = (d.dias || []).filter(function (x) { return x.estado !== 'programado' })
    var min = dias.reduce(function (s, x) { return s + (x.minutos || 0) }, 0)
    var trab = dias.filter(function (x) { return x.entrada }).length
    var atr = dias.filter(function (x) { return x.estado === 'atraso' }).length
    var hoyF = dias.find(function (x) { return x.fecha === h })
    $('eqBody').innerHTML =
      '<div class="eqCard"><div class="eqRow"><div><div class="eqS">HOY</div><div class="eqN" style="font-size:22px">' +
      (hoyF && hoyF.abierta ? 'EN EL CLUB DESDE ' + A.hora(hoyF.entrada) : hoyF && hoyF.salida ? 'SALIDA ' + A.hora(hoyF.salida) : 'SIN MARCAS') + '</div>' +
      '<div class="eqS">TU PRÓXIMA MARCA SERÁ DE <b>' + (d.siguiente === 'salida' ? 'SALIDA' : 'ENTRADA') + '</b> · ESCANEA EL QR DEL PC CENTRAL</div></div>' + (hoyF ? tag(hoyF.estado) : '') + '</div></div>' +
      '<div class="eqKpi"><div><b>' + trab + '</b><span>DÍAS ESTE MES</span></div><div><b>' + Math.floor(min / 60) + '<small style="font-size:14px"> h ' + ('0' + (min % 60)).slice(-2) + '</small></b><span>HORAS ESTE MES</span></div>' +
      '<div><b>' + atr + '</b><span>ATRASOS</span></div><div><b>' + (d.turnos && d.turnos.length ? d.turnos.length : '—') + '</b><span>TURNOS / SEMANA</span></div></div>' +
      '<div class="eqS" style="margin:0 0 10px"><b>TURNOS</b> · ' + (d.turnos && d.turnos.length ? agruparTurnos(d.turnos) : 'SIN TURNOS DEFINIDOS') +
      '<br><b>CELULAR</b> · ' + (d.dispositivo ? 'REGISTRADO ' + A.fecha(d.dispositivo.enrolado_at).toUpperCase() + ' · ' + A.esc(uaCorto(d.dispositivo.ua)) : 'SE REGISTRA EN TU PRIMERA MARCA') + '</div>' +
      (dias.length ? dias.map(function (x) { return diaCard(x, false, false) }).join('') : '<div class="vacio">Aún no tienes marcas este mes.</div>') +
      '<p class="eqNote">Para marcar: escanea con la cámara de tu celular el QR que aparece en el PC central. Si una marca quedó mal, pide la corrección a administración: queda registrada con motivo.</p>'
  }

  // ─── acciones admin ───
  function modal (titulo, cuerpo, onOk, okTxt) {
    var m = document.createElement('div'); m.className = 'eqMod'; m.setAttribute('role', 'dialog'); m.setAttribute('aria-modal', 'true')
    m.innerHTML = '<div class="eqMod__c"><div class="adK"><span>ASISTENCIA DEL EQUIPO</span></div><h3>' + titulo + '</h3>' + cuerpo +
      '<div class="eqErr" id="eqMErr" role="alert"></div><div class="eqMod__b"><button class="eqBtn" data-x>CANCELAR</button><button class="eqBtn eqBtn--p" data-ok>' + (okTxt || 'GUARDAR') + '</button></div></div>'
    function cerrar () { m.remove(); document.removeEventListener('keydown', kd) }
    function kd (e) { if (e.key === 'Escape') cerrar() }
    m.addEventListener('click', function (e) { if (e.target === m) cerrar() })
    m.querySelector('[data-x]').onclick = cerrar
    m.querySelector('[data-ok]').onclick = async function () {
      var b = this; b.disabled = true; $('eqMErr').textContent = ''
      try { var ok = await onOk(m); if (ok !== false) cerrar() } catch (e) { var x = A.mensaje(e); $('eqMErr').textContent = x.titulo + ' · ' + x.texto }
      b.disabled = false }
    document.addEventListener('keydown', kd); document.body.appendChild(m)
    var f = m.querySelector('select,input,textarea'); if (f) setTimeout(function () { f.focus() }, 40)
    return m
  }

  async function manual () {
    if (!EQ.equipo) { var e = await sb().rpc('asist_admin_equipo'); if (e.error) return avisoErr(e.error); EQ.equipo = e.data || [] }
    var now = new Date(), loc = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
    modal('Marca manual',
      '<label for="eqMP">Persona</label><select class="eqSel" id="eqMP">' + EQ.equipo.map(function (p) { return '<option value="' + p.id + '">' + A.esc(p.nombre) + ' · ' + (ROL[p.rol] || p.rol) + '</option>' }).join('') + '</select>' +
      '<label for="eqMT">Tipo</label><select class="eqSel" id="eqMT"><option value="entrada">ENTRADA</option><option value="salida">SALIDA</option></select>' +
      '<label for="eqMF">Fecha y hora</label><input class="eqIn" type="datetime-local" id="eqMF" value="' + loc + '" max="' + loc + '">' +
      '<label for="eqMM">Motivo (obligatorio)</label><input class="eqIn" id="eqMM" maxlength="200" placeholder="Ej: olvidó marcar la salida; confirmado con recepción">',
      async function () {
        var v = $('eqMF').value; if (!v) throw { message: 'KA:FECHA_FUTURA' }
        var r = await sb().rpc('asist_admin_marca_manual', { p_staff: $('eqMP').value, p_tipo: $('eqMT').value, p_at: new Date(v).toISOString(), p_motivo: $('eqMM').value })
        if (r.error) throw r.error
        tst('Marca manual registrada ✓'); verEquipo(EQ.tab)
      }, 'REGISTRAR')
  }

  function anular (id) {
    modal('Anular marca', '<p class="eqS" style="font-size:11px">La marca no se borra: queda tachada en el registro con tu nombre y el motivo.</p>' +
      '<label for="eqAM">Motivo (obligatorio)</label><input class="eqIn" id="eqAM" maxlength="200" placeholder="Ej: marcó dos veces por error">',
      async function () {
        var r = await sb().rpc('asist_admin_anular', { p_marca: id, p_motivo: $('eqAM').value })
        if (r.error) throw r.error
        tst('Marca anulada ✓'); verEquipo(EQ.tab)
      }, 'ANULAR')
  }

  async function liberar (id) {
    var p = (EQ.equipo || []).find(function (x) { return x.id === id }) || {}
    var ok = g.kHoja ? await g.kHoja({ msg: 'Liberar el celular de ' + (p.nombre || 'esta persona') + '. Su próxima marca registrará el nuevo dispositivo.', k: 'ASISTENCIA', si: 'LIBERAR' }) : confirm('¿Liberar celular?')
    if (!ok) return
    var r = await sb().rpc('asist_admin_dispositivo_liberar', { p_staff: id })
    if (r.error) return avisoErr(r.error)
    tst('Celular liberado ✓'); pintarEquipo()
  }

  function turnos (id) {
    var p = (EQ.equipo || []).find(function (x) { return x.id === id }); if (!p) return
    function val (dia, i, k) { var t = p.turnos.filter(function (x) { return x.dia === dia })[i]; return t ? hm(t[k]) : '' }
    var filas = ''
    for (var d = 1; d <= 7; d++) {
      filas += '<div class="eqTur"><b>' + DIAS[d] + '</b>' +
        '<input type="time" data-d="' + d + '" data-i="0" data-k="inicio" value="' + val(d, 0, 'inicio') + '" aria-label="' + DIAS[d] + ' tramo 1 inicio">' +
        '<input type="time" data-d="' + d + '" data-i="0" data-k="fin" value="' + val(d, 0, 'fin') + '" aria-label="' + DIAS[d] + ' tramo 1 fin">' +
        '<input type="time" data-d="' + d + '" data-i="1" data-k="inicio" value="' + val(d, 1, 'inicio') + '" aria-label="' + DIAS[d] + ' tramo 2 inicio">' +
        '<input type="time" data-d="' + d + '" data-i="1" data-k="fin" value="' + val(d, 1, 'fin') + '" aria-label="' + DIAS[d] + ' tramo 2 fin"></div>'
    }
    modal('Turnos · ' + A.esc(p.nombre),
      '<p class="eqS" style="font-size:11px;margin-bottom:10px">Hasta dos tramos por día (ej. mañana y tarde). Deja vacío el día libre. Aplica desde hoy.</p>' +
      '<div class="eqTur"><span></span><b>INICIO 1</b><b>FIN 1</b><b>INICIO 2</b><b>FIN 2</b></div>' + filas,
      async function (m) {
        var map = {}
        m.querySelectorAll('input[type=time]').forEach(function (i) { var k = i.dataset.d + '_' + i.dataset.i; (map[k] = map[k] || { dia: +i.dataset.d })[i.dataset.k] = i.value })
        var out = []
        Object.keys(map).forEach(function (k) { var t = map[k]
          if (!t.inicio && !t.fin) return
          if (!t.inicio || !t.fin || t.fin <= t.inicio) throw { message: 'KA:TURNO_INVALIDO' }
          out.push(t) })
        var r = await sb().rpc('asist_admin_turnos_guardar', { p_staff: id, p_turnos: out })
        if (r.error) throw r.error
        tst('Turnos guardados ✓'); pintarEquipo()
      })
  }

  async function verificar () {
    var r = await sb().rpc('asist_verificar_cadena')
    if (r.error) return avisoErr(r.error)
    var d = r.data || {}
    if (g.kAviso) g.kAviso(d.integro ? 'Registro íntegro ✓\n' + d.marcas + ' marcas verificadas: ninguna fue alterada.' : 'ALERTA: ' + d.alteradas.length + ' marca(s) no cuadran con la cadena de verificación.\nRevisa con soporte técnico.', 'INTEGRIDAD')
  }

  g.EQUIPO = {
    ver: verEquipo, manual: manual, anular: anular, liberar: liberar, turnos: turnos, verificar: verificar, csv: csv,
    rango: function (k) { EQ.rango = k; pintarReg() },
    persona: function (id, ir) { EQ.persona = id || ''; if (ir) { EQ.rango = 'mes'; verEquipo('reg') } else pintarReg() },
    toggle: function (k) { EQ.abiertos[k] = !EQ.abiertos[k]; pintarRegLocal() }
  }
  function pintarRegLocal () { pintarReg() }
})(window)
