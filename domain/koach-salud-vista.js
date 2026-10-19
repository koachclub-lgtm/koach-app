/* ═══════════════════════════════════════════════════════════════
   KOACH SALUD · VISTA + FLUJO DE CARGA (compartido app del socio / dashboard de nutrición)
   · vista(resumen, ctx): resultado → qué mejoró → qué trabajar → tu entrenamiento detrás → por sistema
   · detalle(marcador): qué es, por qué importa, cómo lo mueve tu entrenamiento, qué ayuda, historia
   · subir({...}): consentimiento → foto/PDF → lectura IA → confirmación humana → guardado
   Lenguaje: comparación contra uno mismo, sin rojo salvo valores que piden consulta médica pronta.
   Depende de KB (koach-biomarcadores.js). Vanilla JS.
   ═══════════════════════════════════════════════════════════════ */
(function(root){
'use strict'
const KBx = () => root.KB
const esc = t => String(t == null ? '' : t).replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]))
const MES = ['ENE','FEB','MAR','ABR','MAY','JUN','JUL','AGO','SEP','OCT','NOV','DIC']
const fecha = (iso, anio) => { if (!iso) return '—'; const d = new Date(String(iso).slice(0, 10) + 'T12:00:00'); return d.getDate() + ' ' + MES[d.getMonth()] + (anio ? ' ' + d.getFullYear() : '') }
const fmt = (v, u) => { if (v == null) return '—'; const a = Math.abs(v), d = a >= 100 ? 0 : a >= 10 ? 1 : 2
  let s = (Math.round(v * Math.pow(10, d)) / Math.pow(10, d)).toFixed(d); if (d) s = s.replace(/0+$/, '').replace(/\.$/, ''); return s.replace('.', ',') }
const sg = v => v == null ? '' : (v > 0 ? '+' : v < 0 ? '−' : '±') + fmt(Math.abs(v))
const TEND = { mejora:'MEJORA', empeora:'EN OTRA DIRECCIÓN', estable:'ESTABLE' }
const CONSENT_V = 'examenes-ia-v1-2026-10'
const CONSENT_TXT = 'Autorizo a KOACH Club a guardar los exámenes de laboratorio que suba y a leerlos con inteligencia artificial (Anthropic, proveedor externo) para ordenar sus valores en mi app. Entiendo que: (1) son datos de salud sensibles y solo los verán la nutricionista, administración y yo; nunca los coaches; (2) KOACH no diagnostica: lo que esté fuera de rango debo conversarlo con mi médico; (3) puedo revocar esta autorización cuando quiera desde mi perfil o pidiéndolo en recepción.'

const CSS = `
.ksal{--sI:#0B0B0C;--sB:#F4F3F0;--sG5:#4A4945;--sG4:#6B6A65;--sG3:#A3A29C;--sL:rgba(11,11,12,.12);--sS:#2BB3C0;--sA:#B4442C;
  --sD:var(--font-display,'KOACH Display','Inter Display',Inter,Arial,sans-serif);--sM:var(--font-mono,'Space Mono','IBM Plex Mono',monospace);color:var(--sI);font-variant-numeric:tabular-nums;font-family:var(--sD)}
.ksal *{box-sizing:border-box}
.ksal .sK{display:block;font:700 10px/1.4 var(--sM);letter-spacing:.14em;text-transform:uppercase;color:var(--sG4)}
.ksal .sH{margin:6px 0 4px;font:900 clamp(26px,8vw,34px)/.98 var(--sD);font-stretch:108%;letter-spacing:-.015em}
.ksal .sP{margin:8px 0 0;font:400 15px/1.5 var(--sD);color:var(--sG5)}
.ksal .sBox{background:#fff;border:1px solid var(--sL);border-radius:20px;padding:18px;margin:0 0 12px}
.ksal .sDark{background:var(--sI);color:var(--sB);border-color:var(--sI)}.ksal .sDark .sK{color:#A7A6A0}.ksal .sDark .sP{color:#D6D5CF}
.ksal .sNums{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin:14px 0 4px}
.ksal .sNums b{display:block;font:700 clamp(30px,9vw,40px)/1 var(--sM);letter-spacing:-.04em}
.ksal .sNums b i{font-style:normal;font-size:.42em;color:#A7A6A0;margin-left:2px}
.ksal .sNums small{display:block;margin-top:6px;font:700 9px/1.35 var(--sM);letter-spacing:.1em;color:#A7A6A0}
.ksal .sAlert{display:flex;gap:12px;align-items:flex-start;padding:16px;border-radius:18px;margin:0 0 12px;background:#fff;border:1.5px solid var(--sA)}
.ksal .sAlert b{display:block;font:700 10.5px var(--sM);letter-spacing:.12em;color:var(--sA)}
.ksal .sAlert p{margin:4px 0 0;font:400 14px/1.45 var(--sD)}
.ksal .sAlert i{flex:none;width:10px;height:10px;margin-top:4px;background:var(--sA)}
.ksal .sBtn{display:inline-flex;align-items:center;justify-content:center;gap:8px;min-height:48px;padding:0 20px;border-radius:999px;border:1.5px solid var(--sI);background:var(--sI);color:var(--sB);font:700 11px var(--sM);letter-spacing:.12em;cursor:pointer;text-decoration:none}
.ksal .sBtn--l{background:transparent;color:var(--sI)}.ksal .sBtn:disabled{opacity:.4;cursor:default}
.ksal .sBtn--w{width:100%}
.ksal .sSec{display:flex;justify-content:space-between;align-items:baseline;margin:22px 4px 10px}
.ksal .sSec h3{margin:0;font:900 20px/1 var(--sD);font-stretch:106%;text-transform:uppercase}
.ksal .sSec span{font:700 10px var(--sM);letter-spacing:.12em;color:var(--sG4)}
.ksal .sChips{display:flex;flex-wrap:wrap;gap:8px}
.ksal .sChip{display:inline-flex;align-items:center;gap:8px;min-height:40px;padding:0 14px;border-radius:999px;border:1px solid var(--sL);background:#fff;font:500 13.5px var(--sD);cursor:pointer;color:var(--sI)}
.ksal .sChip em{font:700 11px var(--sM);font-style:normal;letter-spacing:.04em}
.ksal .sChip--up em{color:#1E7F86}
.ksal .sRow{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:4px 12px;align-items:center;width:100%;padding:14px 0;border:0;border-top:1px solid var(--sL);background:none;text-align:left;cursor:pointer;color:var(--sI)}
.ksal .sRow:first-of-type{border-top:0}
.ksal .sRow__n{font:600 15px/1.25 var(--sD)}
.ksal .sRow__v{font:700 15px var(--sM);text-align:right;white-space:nowrap}.ksal .sRow__v small{font-weight:400;font-size:10.5px;color:var(--sG4);margin-left:3px}
.ksal .sRow__m{grid-column:1/-1;display:flex;align-items:center;gap:10px;font:700 9.5px var(--sM);letter-spacing:.1em;color:var(--sG4)}
.ksal .sRow__m .sBar{flex:1}
.ksal .sSt{display:inline-flex;align-items:center;gap:6px;white-space:nowrap}
.ksal .sSt::before{content:'';width:8px;height:8px;border-radius:50%;background:var(--sI)}
.ksal .sSt--mejorable::before{background:transparent;border:2px solid var(--sG4)}
.ksal .sSt--fuera::before{border-radius:1px;transform:rotate(45deg)}
.ksal .sSt--critico{color:var(--sA)}.ksal .sSt--critico::before{background:var(--sA);border-radius:1px}
.ksal .sTd{font:700 9.5px var(--sM);letter-spacing:.08em;white-space:nowrap}.ksal .sTd--mejora{color:#1E7F86}
.ksal .sBar{position:relative;height:6px;border-radius:3px;background:rgba(11,11,12,.08)}
.ksal .sBar u{position:absolute;top:0;bottom:0;border-radius:3px;background:rgba(11,11,12,.22)}
.ksal .sBar i{position:absolute;top:-4px;width:4px;height:14px;margin-left:-2px;border-radius:2px;background:var(--sI)}
.ksal .sBar--big{height:10px;margin:28px 0 8px}.ksal .sBar--big i{top:-6px;height:22px;width:5px}
.ksal .sBar--big b{position:absolute;top:-30px;transform:translateX(-50%);font:700 12px var(--sM);white-space:nowrap}
.ksal .sBarL{display:flex;justify-content:space-between;font:400 10px var(--sM);color:var(--sG4);letter-spacing:.06em}
.ksal .sLink{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin-top:12px}
.ksal .sLink b{display:block;font:700 24px/1 var(--sM);letter-spacing:-.03em}
.ksal .sLink small{display:block;margin-top:6px;font:700 9px/1.35 var(--sM);letter-spacing:.1em;color:#A7A6A0}
.ksal .sEd{display:flex;align-items:flex-end;gap:18px;margin:12px 0 4px}
.ksal .sEd b{font:700 54px/.9 var(--sM);letter-spacing:-.05em}.ksal .sEd s{text-decoration:none;font:700 30px/.9 var(--sM);color:var(--sG3)}
.ksal .sEd small{display:block;font:700 9px var(--sM);letter-spacing:.12em;color:var(--sG4);margin-bottom:6px}
.ksal .sFalta{margin:6px 0 0;font:400 12.5px/1.45 var(--sD);color:var(--sG4)}
.ksal .sPie{margin:16px 4px 0;font:400 10px/1.55 var(--sM);letter-spacing:.06em;color:var(--sG3)}
.ksal .sVac{padding:22px 18px;border:1px dashed var(--sL);border-radius:18px;background:#fff}
.ksal .sAcc{border-top:1px solid var(--sL)}
.ksal .sAcc h4{margin:16px 0 6px;font:700 10px var(--sM);letter-spacing:.14em;color:var(--sG4)}
.ksal .sAcc p,.ksal .sAcc li{font:400 15px/1.55 var(--sD);margin:0}
.ksal .sAcc ul{margin:0;padding-left:18px}
.ksal .sHist{width:100%;height:auto;display:block;margin:6px 0 2px}
.ksal .sHist text{font:400 9px var(--sM);fill:var(--sG4)}
/* flujo de carga */
.ksal .sF{display:grid;gap:12px}
.ksal .sF label{display:flex;flex-direction:column;gap:6px;font:700 9.5px var(--sM);letter-spacing:.12em;color:var(--sG4)}
.ksal .sF input,.ksal .sF select{min-height:46px;padding:0 12px;border:1px solid var(--sL);border-radius:12px;background:#fff;font:500 16px var(--sD);color:var(--sI)}
.ksal .sCk{display:flex;gap:12px;align-items:flex-start;padding:14px;border-radius:14px;background:#fff;border:1px solid var(--sL);font:400 14px/1.5 var(--sD);cursor:pointer}
.ksal .sCk input{width:22px;height:22px;flex:none;margin:1px 0 0;accent-color:#0B0B0C}
.ksal .sV:first-child{border-top:0}.ksal .sV{display:grid;grid-template-columns:24px minmax(0,1fr) 110px;gap:10px;align-items:center;padding:12px 0;border-top:1px solid var(--sL)}
.ksal .sV input[type=checkbox]{width:20px;height:20px;accent-color:#0B0B0C}
.ksal .sV input[type=text]{min-height:42px;width:100%;padding:0 10px;border:1px solid var(--sL);border-radius:10px;font:700 15px var(--sM);text-align:right}
.ksal .sV b{display:block;font:600 14.5px/1.25 var(--sD)}.ksal .sV small{display:block;font:400 10.5px/1.4 var(--sM);color:var(--sG4);letter-spacing:.02em}
.ksal .sV small.av{color:var(--sA)}
.ksal .sThumbs{display:flex;gap:8px;flex-wrap:wrap}.ksal .sThumbs span{width:64px;height:84px;border-radius:10px;background:#E6E5E1 center/cover;display:grid;place-items:center;font:700 10px var(--sM)}
.ksal .sLoad{display:grid;place-items:center;gap:14px;padding:46px 10px;text-align:center}
.ksal .sLoad i{width:34px;height:34px;border:3px solid rgba(11,11,12,.15);border-top-color:var(--sI);border-radius:50%;animation:sGir 1s linear infinite}
@keyframes sGir{to{transform:rotate(360deg)}}
@media (prefers-reduced-motion:reduce){ .ksal .sLoad i{animation:none} }
.ksalOv{position:fixed;inset:0;z-index:960;background:#F4F3F0;overflow-y:auto;-webkit-overflow-scrolling:touch;overscroll-behavior:contain}
.ksalOv[hidden]{display:none}
.ksalOv__bar{position:sticky;top:0;z-index:2;display:flex;align-items:center;justify-content:space-between;gap:10px;padding:calc(12px + env(safe-area-inset-top,0px)) 18px 12px;background:rgba(244,243,240,.94);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);border-bottom:1px solid rgba(11,11,12,.08)}
.ksalOv__bar span{font:700 10.5px 'Space Mono',monospace;letter-spacing:.14em}
.ksalOv__bar button{min-height:40px;padding:0 14px;border-radius:999px;border:1px solid rgba(11,11,12,.2);background:transparent;font:700 10px 'Space Mono',monospace;letter-spacing:.12em;color:#0B0B0C;cursor:pointer}
.ksalOv__in{max-width:560px;margin:0 auto;padding:16px 16px calc(40px + env(safe-area-inset-bottom,0px))}
`
function ensureCss(){ if (typeof document === 'undefined' || document.getElementById('ksalCss')) return
  const s = document.createElement('style'); s.id = 'ksalCss'; s.textContent = CSS; document.head.appendChild(s) }

// ── piezas ───────────────────────────────────────────────────────
function barra(m, big){
  const e = m.estado || {}, v = m.actual, mn = e.min, mx = e.max
  let lo, hi
  if (mn != null && mx != null){ const sp = (mx - mn) || Math.abs(mx) || 1; lo = mn - sp * .5; hi = mx + sp * .5 }
  else if (mx != null){ lo = 0; hi = mx * 1.6 } else if (mn != null){ lo = mn * .4; hi = mn * 2 } else return ''
  lo = Math.min(lo, v); hi = Math.max(hi, v); const pos = x => Math.max(0, Math.min(100, (x - lo) / (hi - lo) * 100))
  const a = mn != null ? pos(mn) : 0, b = mx != null ? pos(mx) : 100
  return '<div class="sBar' + (big ? ' sBar--big' : '') + '" role="img" aria-label="Rango de referencia ' + (mn != null ? fmt(mn) : '') + ' a ' + (mx != null ? fmt(mx) : '') + '; tu valor ' + fmt(v) + '">' +
    '<u style="left:' + a + '%;width:' + (b - a) + '%"></u><i style="left:' + pos(v) + '%"></i>' + (big ? '<b style="left:' + pos(v) + '%">' + fmt(v) + '</b>' : '') + '</div>' +
    (big ? '<div class="sBarL"><span>' + (mn != null ? 'MÍN ' + fmt(mn) : '') + '</span><span>RANGO ' + (e.min != null || e.max != null ? (m.rangoOrigen === 'koach' ? 'DE REFERENCIA' : 'DE TU LABORATORIO') : '') + '</span><span>' + (mx != null ? 'MÁX ' + fmt(mx) : '') + '</span></div>' : '')
}
const stChip = e => e ? '<span class="sSt sSt--' + e.nivel + '">' + esc(e.etiqueta) + '</span>' : ''
const tdChip = t => t && t.tendencia ? '<span class="sTd sTd--' + t.tendencia + '">' + (t.tendencia === 'estable' ? 'ESTABLE' : sg(t.delta) + ' · ' + TEND[t.tendencia]) + '</span>' : ''

function fila(m, onclick){
  return '<button type="button" class="sRow" onclick="' + onclick + '"><span class="sRow__n">' + esc(m.nombre) + '</span><span class="sRow__v">' + fmt(m.actual) + (m.unidad ? '<small>' + esc(m.unidad) + '</small>' : '') + '</span>' +
    '<span class="sRow__m">' + stChip(m.estado) + barra(m) + (m.inicio ? tdChip(m.inicio) : '') + '</span></button>'
}

/** Vista principal. R = KB.resumen(...) · ctx = { entre:{ sesiones, kg, musculo, grasa, desde, hasta }, onDetalle:'fn', onSubir:'js', puedeSubir, staff } */
function vista(R, ctx){
  ctx = ctx || {}; const det = c => (ctx.onDetalle || 'KSAL.abrirDetalle') + "('" + c + "')"
  let h = '<div class="ksal">'
  const subir = ctx.puedeSubir !== false ? '<button type="button" class="sBtn sBtn--w" onclick="' + (ctx.onSubir || 'KSAL.subirDesdeApp()') + '">SUBIR EXAMEN · FOTO O PDF</button>' : ''
  if (!R || !R.examenes){
    return h + '<div class="sBox"><span class="sK">TU SALUD · CAPA CLÍNICA</span><h3 class="sH">Tu punto de partida en sangre</h3>' +
      '<p class="sP">Sube una foto o el PDF de tus exámenes de sangre (cualquier laboratorio). Ordenamos tus valores, los comparamos con el rango de tu laboratorio y, en cada examen nuevo, contra ti mismo: así ves cómo tu entrenamiento cambia también por dentro.</p>' +
      '<p class="sP" style="font-size:13px">Te sirve un perfil básico: glicemia e insulina en ayunas, perfil lipídico, hemograma, PCR, perfil hepático, creatinina y albúmina.</p><div style="margin-top:16px">' + subir + '</div></div>' +
      (ctx.aviso ? '<p class="sPie">' + esc(ctx.aviso) + '</p>' : '') + '</div>'
  }
  if (R.criticos.length) h += '<div class="sAlert" role="alert"><i></i><div><b>CONVERSAR PRONTO CON TU MÉDICO</b><p>' + R.criticos.map(m => esc(m.nombre)).join(', ') + (R.criticos.length > 1 ? ' están' : ' está') + ' en un nivel que conviene revisar con un médico en los próximos días. No es un diagnóstico: es una señal para no esperar.</p></div></div>'
  // resultado
  const mej = R.mejoras.length, dos = R.examenes > 1
  const tit = !dos ? 'Tu punto de partida' : mej && !R.empeoran.length ? 'Tu cuerpo mejora también por dentro' : mej ? 'Mejoras y tareas pendientes' : 'Tu salud, medida'
  h += '<div class="sBox sDark"><span class="sK">TU SALUD · ' + (dos ? 'DESDE ' + fecha(R.primero, true) : 'EXAMEN ' + fecha(R.ultimo, true)) + '</span><h3 class="sH" style="color:#F4F3F0">' + tit + '</h3>' +
    '<div class="sNums"><div><b>' + R.enRango + '<i>/' + R.evaluados + '</i></b><small>EN RANGO</small></div>' +
    '<div><b>' + (dos ? mej : '—') + '</b><small>' + (dos ? 'MEJORARON<br>DESDE TU INICIO' : 'MEJORAS<br>EN TU 2º EXAMEN') + '</small></div>' +
    '<div><b>' + R.examenes + '</b><small>EXÁMENES<br>ÚLTIMO ' + fecha(R.ultimo) + '</small></div></div></div>'
  // entrenamiento detrás del cambio
  const E = ctx.entre
  if (dos && E && (E.sesiones || E.kg)){
    h += '<div class="sBox"><span class="sK">TU ENTRENAMIENTO DETRÁS DEL CAMBIO · ' + fecha(E.desde) + ' → ' + fecha(E.hasta) + '</span><div class="sLink" style="color:var(--sI)">' +
      '<div><b>' + (E.sesiones || 0) + '</b><small style="color:var(--sG4)">SESIONES</small></div>' +
      '<div><b>' + (E.kg ? (E.kg >= 1000 ? fmt(E.kg / 1000) + 't' : fmt(E.kg)) : '—') + '</b><small style="color:var(--sG4)">CARGA MOVILIZADA</small></div>' +
      '<div><b>' + (E.musculo != null ? sg(E.musculo) + '<span style="font-size:12px">kg</span>' : E.grasa != null ? sg(E.grasa) + '<span style="font-size:12px">%</span>' : '—') + '</b><small style="color:var(--sG4)">' + (E.musculo != null ? 'MÚSCULO' : 'GRASA') + '</small></div></div>' +
      '<p class="sP" style="font-size:13.5px">' + (mej ? 'Mientras entrenabas, ' + mej + (mej === 1 ? ' marcador mejoró' : ' marcadores mejoraron') + '. El músculo que construyes es también un órgano metabólico.' : 'Tu constancia es la variable que más mueve estos marcadores en el tiempo.') + '</p></div>'
  }
  // edad biológica
  const B = R.edadBiologica
  if (B && B.actual != null){
    const d = B.edad != null ? Math.round((B.actual - B.edad) * 10) / 10 : null
    h += '<button type="button" class="sBox" style="display:block;width:100%;text-align:left;cursor:pointer" onclick="' + det('phenoage') + '"><span class="sK">EDAD BIOLÓGICA · PHENOAGE (9 MARCADORES)</span>' +
      '<div class="sEd"><div><small>REAL</small><s>' + (B.edad != null ? B.edad : '—') + '</s></div><div><small>BIOLÓGICA</small><b>' + fmt(B.actual) + '</b></div></div>' +
      '<p class="sP" style="font-size:14px">' + (d == null ? '' : d <= -1 ? 'Tu sangre se parece a la de alguien ' + fmt(-d) + ' años menor.' : d < 1 ? 'Tu sangre está a la par de tu edad.' : 'Tu sangre muestra ' + fmt(d) + ' años más que tu edad: es una de las cosas que el entrenamiento y la alimentación pueden mover.') +
      (B.inicio != null ? ' Desde tu primer cálculo: ' + sg(Math.round((B.actual - B.inicio) * 10) / 10) + ' años.' : '') + '</p></button>'
  } else if (B && B.faltan && B.faltan.length && B.faltan.length <= 9){
    h += '<p class="sFalta" style="margin:0 4px 12px">Para estimar tu edad biológica (PhenoAge) faltan: ' + esc(B.faltan.join(', ')) + '. Pídelos en tu próximo examen.</p>'
  }
  // qué mejoró / qué trabajar
  if (dos && mej) h += '<div class="sSec"><h3>Lo que mejoró</h3><span>DESDE TU INICIO</span></div><div class="sChips">' +
    R.mejoras.map(m => '<button type="button" class="sChip sChip--up" onclick="' + det(m.codigo) + '">' + esc(m.nombre) + ' <em>' + sg(m.inicio.delta) + '</em></button>').join('') + '</div>'
  if (R.trabajar.length) h += '<div class="sSec"><h3>Lo que vamos a trabajar</h3><span>' + R.trabajar.length + '</span></div><div class="sBox" style="padding:4px 18px">' + R.trabajar.map(m => fila(m, det(m.codigo))).join('') + '</div>'
  // por sistema
  h += '<div class="sSec"><h3>Todos tus marcadores</h3><span>POR SISTEMA</span></div>'
  R.porCategoria.filter(g => g.cat !== 'EDAD BIOLÓGICA').forEach(g => {
    h += '<span class="sK" style="margin:14px 4px 6px">' + g.cat + '</span><div class="sBox" style="padding:4px 18px">' + g.items.map(m => fila(m, det(m.codigo))).join('') + '</div>' })
  h += '<div style="margin:18px 0 0">' + subir + '</div>'
  h += '<p class="sPie">KOACH NO DIAGNOSTICA. COMPARAMOS TUS VALORES CON EL RANGO IMPRESO POR TU LABORATORIO Y CON GUÍAS CLÍNICAS PUBLICADAS (ADA PARA GLUCOSA). UN CAMBIO CUENTA SOLO SI SUPERA LA VARIACIÓN NORMAL DEL MARCADOR. LO QUE ESTÉ FUERA DE RANGO, CONVERSALO CON TU MÉDICO.</p>'
  return h + '</div>'
}

function historia(m){
  const s = (m.serie || []).filter(x => x.valor != null); if (s.length < 2) return ''
  const W = 340, H = 120, L = 8, R = 8, T = 18, B = 20, e = m.estado || {}
  const vals = s.map(x => x.valor).concat([e.min, e.max].filter(x => x != null))
  let lo = Math.min.apply(null, vals), hi = Math.max.apply(null, vals); const sp = (hi - lo) || 1; lo -= sp * .15; hi += sp * .15
  const X = i => L + i * (W - L - R) / (s.length - 1), Y = v => T + (H - T - B) * (1 - (v - lo) / (hi - lo))
  let g = ''
  if (e.min != null || e.max != null){ const y1 = Y(e.max != null ? e.max : hi), y2 = Y(e.min != null ? e.min : lo); g += '<rect x="' + L + '" y="' + y1 + '" width="' + (W - L - R) + '" height="' + Math.max(0, y2 - y1) + '" fill="rgba(11,11,12,.06)"/>' }
  g += '<polyline fill="none" stroke="#0B0B0C" stroke-width="2.2" stroke-linejoin="round" points="' + s.map((x, i) => X(i) + ',' + Y(x.valor)).join(' ') + '"/>'
  s.forEach((x, i) => { g += '<rect x="' + (X(i) - 4) + '" y="' + (Y(x.valor) - 4) + '" width="8" height="8" fill="' + (i === s.length - 1 ? '#2BB3C0' : '#F4F3F0') + '" stroke="' + (i === s.length - 1 ? '#2BB3C0' : '#0B0B0C') + '" stroke-width="2"/>' +
    '<text x="' + X(i) + '" y="' + (Y(x.valor) - 9) + '" text-anchor="' + (i === 0 ? 'start' : i === s.length - 1 ? 'end' : 'middle') + '" style="font-weight:700;fill:#0B0B0C">' + fmt(x.valor) + '</text>' +
    '<text x="' + X(i) + '" y="' + (H - 5) + '" text-anchor="' + (i === 0 ? 'start' : i === s.length - 1 ? 'end' : 'middle') + '">' + fecha(x.fecha) + '</text>' })
  return '<svg class="sHist" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Historia de ' + esc(m.nombre) + '">' + g + '</svg>'
}

/** Ficha de un marcador */
function detalle(m){
  if (!m) return ''
  const e = m.estado, u = m.edu || {}, fuera = e && (e.nivel === 'fuera' || e.nivel === 'critico')
  let h = '<div class="ksal"><span class="sK">' + esc(m.cat) + '</span><h3 class="sH">' + esc(m.nombre) + '</h3>'
  h += '<div class="sBox"><div style="display:flex;justify-content:space-between;align-items:baseline;gap:10px"><b style="font:700 44px/1 var(--sM);letter-spacing:-.04em">' + fmt(m.actual) + '<small style="font-size:14px;color:var(--sG4);margin-left:4px">' + esc(m.unidad || '') + '</small></b><span class="sK">' + fecha(m.fecha, true) + '</span></div>' +
    (e ? '<div style="margin-top:10px">' + stChip(e) + '</div>' + barra(m, true) : '') +
    (m.inicio ? '<p class="sP" style="font-size:14px">Desde tu inicio (' + fecha(m.inicio.fecha) + '): <b>' + sg(m.inicio.delta) + '</b> · ' + TEND[m.inicio.tendencia] + (m.anterior && m.anterior.fecha !== m.inicio.fecha ? ' · vs anterior: ' + sg(m.anterior.delta) : '') + '</p>' : '') +
    historia(m) + (m.nota ? '<p class="sFalta">' + esc(m.nota) + '</p>' : '') + '</div>'
  if (fuera) h += '<div class="sAlert"><i></i><div><b>' + (e.nivel === 'critico' ? 'CONVERSAR PRONTO CON TU MÉDICO' : 'CONVERSARLO CON TU MÉDICO') + '</b><p>Este valor está fuera del rango de referencia. Muéstrale el examen a tu médico: puede necesitar confirmación o tratamiento. Lo que sigue es educativo y no reemplaza esa consulta.</p></div></div>'
  h += '<div class="sBox"><div class="sAcc" style="border:0"><h4 style="margin-top:0">QUÉ ES</h4><p>' + esc(u.que || '') + '</p></div>' +
    '<div class="sAcc"><h4>POR QUÉ IMPORTA</h4><p>' + esc(u.importa || '') + '</p></div>' +
    '<div class="sAcc"><h4>CÓMO LO MUEVE TU ENTRENAMIENTO</h4><p>' + esc(u.entreno || '') + '</p></div>' +
    ((u.habitos || []).length ? '<div class="sAcc"><h4>' + (fuera || (e && e.nivel === 'mejorable') ? 'CÓMO LO VAMOS CORRIGIENDO' : 'QUÉ LO MANTIENE BIEN') + '</h4><ul>' + u.habitos.map(x => '<li>' + esc(x) + '</li>').join('') + '</ul></div>' : '') + '</div>'
  h += '<p class="sPie">INFORMACIÓN EDUCATIVA. NO REEMPLAZA LA EVALUACIÓN DE TU MÉDICO.</p>'
  return h + '</div>'
}

// ── overlay propio ────────────────────────────────────────────────
function ov(titulo, html){
  ensureCss(); let o = document.getElementById('ksalOv')
  if (!o){ o = document.createElement('div'); o.id = 'ksalOv'; o.className = 'ksalOv'; o.setAttribute('role', 'dialog'); o.setAttribute('aria-modal', 'true')
    o.innerHTML = '<div class="ksalOv__bar"><span id="ksalOvT"></span><button type="button" onclick="KSAL.cerrar()">CERRAR ✕</button></div><div class="ksalOv__in" id="ksalOvB"></div>'; document.body.appendChild(o) }
  document.getElementById('ksalOvT').textContent = titulo; document.getElementById('ksalOvB').innerHTML = html
  if (o.hidden !== false || !o._abierto){ o.hidden = false; o._abierto = true; document.documentElement.style.overflow = 'hidden'; try { history.pushState({ ksal:1 }, '') } catch (_) {} }
  o.scrollTop = 0
}
function cerrar(){ const o = document.getElementById('ksalOv'); if (!o || o.hidden) return; o.hidden = true; o._abierto = false; document.documentElement.style.overflow = '' }
if (typeof window !== 'undefined') window.addEventListener('popstate', () => cerrar())

// ── flujo de carga ───────────────────────────────────────────────
const F = {}
async function reducir(file){
  if (file.type === 'application/pdf'){ const b = await leer(file); return { tipo:'application/pdf', data:b, ext:'pdf', blob:file } }
  const bmp = await (window.createImageBitmap ? createImageBitmap(file) : new Promise((ok, ko) => { const i = new Image(); i.onload = () => ok(i); i.onerror = ko; i.src = URL.createObjectURL(file) }))
  const k = Math.min(1, 2000 / Math.max(bmp.width, bmp.height)), c = document.createElement('canvas')
  c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k); c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height)
  const blob = await new Promise(ok => c.toBlob(ok, 'image/jpeg', .85))
  return { tipo:'image/jpeg', data: await leer(blob), ext:'jpg', blob }
}
const leer = b => new Promise((ok, ko) => { const r = new FileReader(); r.onload = () => ok(String(r.result).split(',')[1]); r.onerror = ko; r.readAsDataURL(b) })

/** Abre el flujo. o = { sb, socioId, sexo, propio (bool: el socio sube lo suyo), consiente, menor, onListo } */
function subir(o){
  Object.assign(F, o, { archivos:[], res:null })
  if (o.menor && o.propio) return ov('SUBIR EXAMEN', '<div class="ksal"><div class="sBox"><h3 class="sH">Lo registra nutrición</h3><p class="sP">Los exámenes de menores de edad los registra la nutricionista con autorización de tu apoderado. Pídelo en recepción.</p></div></div>')
  if (o.propio && !o.consiente) return pasoConsent()
  pasoElegir()
}
function pasoConsent(){
  ov('AUTORIZACIÓN', '<div class="ksal"><span class="sK">ANTES DE SUBIR TU PRIMER EXAMEN</span><h3 class="sH">Tus datos de salud son tuyos</h3>' +
    '<label class="sCk" style="margin-top:14px"><input type="checkbox" id="ksalCk" onchange="document.getElementById(\'ksalCkB\').disabled=!this.checked"><span>' + esc(CONSENT_TXT) + '</span></label>' +
    '<div style="margin-top:16px;display:grid;gap:8px"><button type="button" class="sBtn sBtn--w" id="ksalCkB" disabled onclick="KSAL._aceptar()">AUTORIZO Y CONTINÚO</button><button type="button" class="sBtn sBtn--l sBtn--w" onclick="KSAL.cerrar()">AHORA NO</button></div>' +
    '<p class="sPie">VERSIÓN ' + CONSENT_V.toUpperCase() + ' · QUEDA REGISTRADA CON FECHA Y HORA (LEY 21.719)</p></div>')
}
async function _aceptar(){
  const b = document.getElementById('ksalCkB'); b.disabled = true; b.textContent = 'GUARDANDO…'
  const { error } = await F.sb.from('consentimientos').insert([{ socio_id:F.socioId, tipo:'examenes_ia', version:CONSENT_V, otorgado:true, texto:CONSENT_TXT },
    { socio_id:F.socioId, tipo:'almacenamiento_salud', version:CONSENT_V, otorgado:true, texto:CONSENT_TXT }])
  if (error){ b.disabled = false; b.textContent = 'AUTORIZO Y CONTINÚO'; alert('No se pudo guardar tu autorización: ' + (error.message || 'error')); return }
  F.consiente = true; pasoElegir()
}
function pasoElegir(){
  const th = F.archivos.map((a, i) => '<span' + (a.url ? ' style="background-image:url(' + a.url + ')"' : '') + '>' + (a.tipo === 'application/pdf' ? 'PDF' : '') + '</span>').join('')
  ov('SUBIR EXAMEN', '<div class="ksal"><span class="sK">PASO 1 DE 2</span><h3 class="sH">Foto o PDF de tu examen</h3>' +
    '<p class="sP">Fotografía cada hoja completa, derecha y con buena luz (hasta 4), o sube el PDF que te envió el laboratorio.</p>' +
    '<div class="sThumbs" style="margin:14px 0">' + th + '</div>' +
    '<div style="display:grid;gap:8px"><label class="sBtn sBtn--l sBtn--w" style="cursor:pointer">TOMAR FOTO<input type="file" accept="image/*" capture="environment" hidden onchange="KSAL._agregar(this.files)"></label>' +
    '<label class="sBtn sBtn--l sBtn--w" style="cursor:pointer">ELEGIR FOTOS O PDF<input type="file" accept="image/*,application/pdf" multiple hidden onchange="KSAL._agregar(this.files)"></label>' +
    '<button type="button" class="sBtn sBtn--w" ' + (F.archivos.length ? '' : 'disabled ') + 'onclick="KSAL._leer()">LEER EXAMEN →</button>' +
    '<button type="button" class="sBtn sBtn--l sBtn--w" style="border-color:transparent" onclick="KSAL._confirmar(null)">INGRESAR VALORES A MANO</button></div></div>')
}
async function _agregar(fl){
  const lista = Array.from(fl || [])
  for (const f of lista){ if (F.archivos.length >= 4) break
    if (f.type === 'application/pdf'){ if (f.size > 3e6){ alert('El PDF pesa más de 3 MB. Toma fotos de las hojas en su lugar.'); continue } F.archivos = [await reducir(f)]; break }
    if (F.archivos.some(a => a.tipo === 'application/pdf')) F.archivos = []
    try { const r = await reducir(f); r.url = URL.createObjectURL(r.blob); F.archivos.push(r) } catch (_) { alert('No se pudo abrir esa imagen.') } }
  pasoElegir()
}
async function _leer(){
  ov('SUBIR EXAMEN', '<div class="ksal"><div class="sLoad"><i></i><span class="sK">LEYENDO TU EXAMEN · 15–40 S</span><p class="sP" style="font-size:13px">Transcribimos solo los valores impresos. Tú los revisas antes de guardar.</p></div></div>')
  try {
    const { data:{ session } } = await F.sb.auth.getSession()
    const r = await fetch('/api/examen-ia', { method:'POST', headers:{ 'content-type':'application/json', authorization:'Bearer ' + (session && session.access_token) },
      body: JSON.stringify({ socio_id:F.socioId, archivos:F.archivos.map(a => ({ tipo:a.tipo, data:a.data })) }) })
    const j = await r.json().catch(() => ({}))
    if (!r.ok) throw new Error(j.error || ('Error ' + r.status))
    F.res = j; _confirmar(j)
  } catch (e){
    ov('SUBIR EXAMEN', '<div class="ksal"><div class="sBox"><h3 class="sH">No pudimos leerlo</h3><p class="sP">' + esc((e && e.message) || 'Error') + '</p>' +
      '<div style="display:grid;gap:8px;margin-top:14px"><button type="button" class="sBtn sBtn--w" onclick="KSAL._leer()">REINTENTAR</button><button type="button" class="sBtn sBtn--l sBtn--w" onclick="KSAL._confirmar(null)">INGRESAR A MANO</button></div></div></div>')
  }
}
function _confirmar(j){
  const K = KBx(); F.res = j; F.filas = (j && j.reconocidos ? j.reconocidos.filter(x => x.valor != null) : []).map(x => Object.assign({ usar: x.valido !== false }, x))
  const hoy = new Date().toISOString().slice(0, 10)
  const opts = K.CATALOGO.map(m => '<option value="' + m.c + '">' + esc(m.n) + ' (' + esc(m.u) + ')</option>').join('')
  ov('SUBIR EXAMEN', '<div class="ksal"><span class="sK">PASO 2 DE 2 · REVISA ANTES DE GUARDAR</span><h3 class="sH">' + (F.filas.length ? 'Leímos ' + F.filas.length + ' valores' : 'Ingresa tus valores') + '</h3>' +
    (j && !j.legible ? '<div class="sAlert"><i></i><div><b>LECTURA PARCIAL</b><p>' + esc(j.problemas || 'Parte del examen no se pudo leer.') + ' Revisa con calma o vuelve a fotografiar.</p></div></div>' : (j && j.problemas ? '<p class="sFalta">' + esc(j.problemas) + '</p>' : '')) +
    '<div class="sF" style="margin:14px 0"><label>FECHA DE TOMA DE MUESTRA<input type="date" id="ksalFe" value="' + ((j && j.fecha_examen) || '') + '" max="' + hoy + '"></label>' +
    '<label>LABORATORIO<input type="text" id="ksalLab" value="' + esc((j && j.laboratorio) || '') + '" placeholder="ej. Clínica Sanatorio Alemán"></label></div>' +
    '<p class="sP" style="font-size:13px">Compara cada valor con tu examen. Corrige si hace falta y desmarca lo que no corresponda.</p>' +
    '<div class="sBox" style="padding:4px 16px" id="ksalFilas"></div>' +
    '<div class="sF" style="grid-template-columns:minmax(0,1fr) 84px 48px;align-items:end;margin-bottom:14px"><label>AGREGAR OTRO VALOR<select id="ksalAddC"><option value="">—</option>' + opts + '</select></label><label>VALOR<input type="text" inputmode="decimal" id="ksalAddV"></label>' +
    '<button type="button" class="sBtn sBtn--l" onclick="KSAL._agregarFila()">+</button></div>' +
    (j && j.no_reconocidos && j.no_reconocidos.length ? '<p class="sFalta">No usamos todavía: ' + esc(j.no_reconocidos.map(x => x.nombre).join(', ')) + '.</p>' : '') +
    '<button type="button" class="sBtn sBtn--w" id="ksalGuardar" style="margin-top:12px" onclick="KSAL._guardar()">GUARDAR EXAMEN</button>' +
    '<p class="sPie">LOS VALORES QUEDAN COMO "CONFIRMADOS POR TI" HASTA QUE NUTRICIÓN LOS VALIDE.</p></div>')
  _pintarFilas()
}
function _pintarFilas(){
  const K = KBx(), el = document.getElementById('ksalFilas'); if (!el) return
  el.innerHTML = F.filas.length ? F.filas.map((x, i) => {
    const e = x.valor != null ? K.estado(x.codigo, x.valor, { rango_min:x.rango_min, rango_max:x.rango_max, sexo:F.sexo }) : null
    return '<div class="sV"><input type="checkbox" ' + (x.usar ? 'checked ' : '') + 'aria-label="Usar ' + esc(x.nombre) + '" onchange="KSAL._fila(' + i + ',\'usar\',this.checked)">' +
      '<div><b>' + esc(x.nombre) + '</b><small>' + (x.nombre_original ? 'Leído: ' + (x.nombre_original !== x.nombre ? '"' + esc(x.nombre_original) + '" ' : '') + esc(x.valor_texto || '') + ' ' + esc(x.unidad_original || '') + ' → ' : '') + esc(x.unidad) +
        (x.rango_min != null || x.rango_max != null ? ' · ref ' + (x.rango_min != null ? fmt(x.rango_min) : '') + '–' + (x.rango_max != null ? fmt(x.rango_max) : '') : '') + (e ? ' · ' + esc(e.etiqueta) : '') + '</small>' +
        (x.avisos || []).map(a => '<small class="av">' + esc(a) + '</small>').join('') + '</div>' +
      '<input type="text" inputmode="decimal" value="' + (x.valor != null ? fmt(x.valor).replace(/\./g, '') : '') + '" aria-label="Valor de ' + esc(x.nombre) + '" onchange="KSAL._fila(' + i + ',\'valor\',this.value)"></div>' }).join('')
    : '<p class="sP" style="padding:14px 0">Aún no hay valores. Agrégalos abajo.</p>'
  const g = document.getElementById('ksalGuardar'); if (g) g.disabled = !F.filas.some(x => x.usar && x.valor != null)
}
function _fila(i, k, v){ const x = F.filas[i]; if (!x) return
  if (k === 'valor'){ const n = KBx().aNumero(v); if (!n){ alert('Valor no válido'); _pintarFilas(); return } if (Math.abs(n.v - x.valor) > 1e-9){ x.valor = n.v; x.editado = true; x.operador = n.op } }
  else x[k] = v; _pintarFilas() }
function _agregarFila(){
  const c = document.getElementById('ksalAddC').value, n = KBx().aNumero(document.getElementById('ksalAddV').value), m = KBx().porCodigo(c)
  if (!m || !n){ alert('Elige el examen y escribe el valor'); return }
  F.filas = F.filas.filter(x => x.codigo !== c)
  F.filas.push({ codigo:c, nombre:m.n, unidad:m.u, valor:n.v, operador:n.op, usar:true, editado:true, rango_origen:'koach', valor_texto:String(n.v), avisos:[] }); _pintarFilas()
  document.getElementById('ksalAddC').value = ''; document.getElementById('ksalAddV').value = ''
}
async function _guardar(){
  const fe = document.getElementById('ksalFe').value, lab = document.getElementById('ksalLab').value.trim(), filas = F.filas.filter(x => x.usar && x.valor != null)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fe)){ alert('Indica la fecha de toma de muestra del examen'); return }
  if (!filas.length) return
  const b = document.getElementById('ksalGuardar'); b.disabled = true; b.textContent = 'GUARDANDO…'
  const id = (crypto.randomUUID ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-8xxx-xxxxxxxxxxxx'.replace(/x/g, () => (Math.random() * 16 | 0).toString(16)))
  const archivos = []
  for (let i = 0; i < F.archivos.length; i++){ const a = F.archivos[i], path = F.socioId + '/' + id + '/' + (i + 1) + '.' + a.ext
    try { const { error } = await F.sb.storage.from('examenes').upload(path, a.blob, { contentType:a.tipo, upsert:false }); if (!error) archivos.push(path) } catch (_) {} }
  const ex = { id, socio_id:F.socioId, fecha_examen:fe, laboratorio:lab || null, origen: F.propio ? 'socio' : 'staff', estado:'confirmado', archivos,
    extraccion: F.res ? { analitos:F.res.extraccion, no_reconocidos:F.res.no_reconocidos, problemas:F.res.problemas, motor:F.res.motor } : null, modelo: F.res ? F.res.modelo : null }
  const r1 = await F.sb.from('examenes').insert(ex)
  if (r1.error){ b.disabled = false; b.textContent = 'GUARDAR EXAMEN'; alert('No se pudo guardar: ' + (r1.error.message || 'error')); return }
  const rows = filas.map(x => ({ examen_id:id, socio_id:F.socioId, codigo:x.codigo, valor:x.valor, unidad:x.unidad, operador:x.operador || null,
    nombre_original:x.nombre_original || null, valor_texto:x.valor_texto || null, unidad_original:x.unidad_original || null,
    rango_min:x.rango_min != null ? x.rango_min : null, rango_max:x.rango_max != null ? x.rango_max : null, rango_texto:x.rango_texto || null,
    rango_origen:x.rango_origen || 'koach', editado:!!x.editado }))
  const r2 = await F.sb.from('biomarcadores').insert(rows)
  if (r2.error){ await F.sb.from('examenes').update({ anulado:true }).eq('id', id); b.disabled = false; b.textContent = 'GUARDAR EXAMEN'; alert('No se pudieron guardar los valores: ' + (r2.error.message || 'error')); return }
  cerrar(); if (typeof F.onListo === 'function') F.onListo(id)
}

const KSAL = { VERSION:'koach-salud-vista@1.0.0', CSS, ensureCss, vista, detalle, historia, ov, cerrar, subir, CONSENT_V,
  _aceptar, _agregar, _leer, _confirmar, _fila, _agregarFila, _guardar, _f:F,
  abrirDetalle: c => { const m = root.KSAL_R && root.KSAL_R.marcadores.find(x => x.codigo === c); if (m) ov(String(m.cat), detalle(m)) },
  subirDesdeApp: () => {} }
if (typeof module !== 'undefined' && module.exports) module.exports = KSAL
else root.KSAL = KSAL
})(typeof self !== 'undefined' ? self : this)
