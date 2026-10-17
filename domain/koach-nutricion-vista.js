/* ═══════════════════════════════════════════════════════════════
   KOACH NUTRICIÓN · VISTA · reemplaza el PDF de Nutrición Pro
   Un solo renderizador para el plan nutricional y el informe de composición:
   la app del socio lo muestra y el dashboard lo usa como vista previa (lo que nutrición ve = lo que ve el socio).
   Devuelve HTML (strings) con estilos propios bajo .kn. Depende de KC (koach-composicion.js). Vanilla JS.
   Jerarquía: resultado → tendencia → datos → detalle (a pedido). El motor habla en datos, la interfaz en objetivos.
   ═══════════════════════════════════════════════════════════════ */
(function(root){
'use strict'
const KCx = () => root.KC || (typeof require === 'function' ? require('./koach-composicion.js') : null)
const esc = t => String(t == null ? '' : t).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]))
const f1 = v => v == null || v === '' || isNaN(+v) ? '—' : ((Math.round(+v * 10) / 10) % 1 === 0 ? String(Math.round(+v * 10) / 10) : (Math.round(+v * 10) / 10).toFixed(1).replace('.', ','))
const sg = v => v == null ? '' : (v > 0 ? '+' : v < 0 ? '−' : '±') + f1(Math.abs(v))
const MES = ['ENE','FEB','MAR','ABR','MAY','JUN','JUL','AGO','SEP','OCT','NOV','DIC']
const fecha = (iso, anio) => { if (!iso) return ''; const d = new Date(String(iso).slice(0, 10) + 'T12:00:00'); return d.getDate() + ' ' + MES[d.getMonth()] + (anio ? ' ' + d.getFullYear() : '') }
const C = { ink:'#0B0B0C', sig:'#2BB3C0', g3:'#A3A29C', g2:'#D1D0CB', bg:'#F4F3F0' }

const CSS = `
.kn{--knI:#0B0B0C;--knB:#F4F3F0;--knG5:#4A4945;--knG4:#6B6A65;--knG3:#A3A29C;--knL:rgba(11,11,12,.12);--knS:#2BB3C0;
  --knD:var(--font-display,'KOACH Display','Inter Display',Inter,Arial,sans-serif);--knM:var(--font-mono,'Space Mono','IBM Plex Mono',monospace);
  color:var(--knI);font-variant-numeric:tabular-nums;font-family:var(--knD)}
.kn *{box-sizing:border-box}
.kn .knK{display:block;font:700 10px/1.4 var(--knM);letter-spacing:.14em;text-transform:uppercase;color:var(--knG4)}
.kn .knH{margin:6px 0 2px;font:900 clamp(26px,8vw,34px)/.98 var(--knD);font-stretch:108%;letter-spacing:-.015em}
.kn .knP{margin:8px 0 0;font:400 15px/1.5 var(--knD);color:var(--knG5)}
.kn .knBox{background:#fff;border:1px solid var(--knL);border-radius:20px;padding:18px;margin:0 0 12px}
.kn .knDark{background:var(--knI);color:var(--knB);border-color:var(--knI)}
.kn .knDark .knK{color:#A7A6A0}
.kn .knBig{display:flex;align-items:baseline;gap:6px;margin:8px 0 14px}
.kn .knBig b{font:700 clamp(44px,13vw,56px)/.9 var(--knM);letter-spacing:-.05em}
.kn .knBig i{font:700 13px var(--knM);font-style:normal;color:#A7A6A0;letter-spacing:.1em}
.kn .knBar{display:flex;height:10px;border-radius:3px;overflow:hidden;background:rgba(127,127,127,.15)}
.kn .knBar i{display:block;height:100%}
.kn .knMac{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin-top:14px}
.kn .knMac b{display:block;font:700 22px/1 var(--knM);letter-spacing:-.03em}
.kn .knMac b small{font-size:11px;color:#A7A6A0;margin-left:2px}
.kn .knMac span{display:block;margin-top:6px;font:700 9px/1.35 var(--knM);letter-spacing:.1em;color:#A7A6A0}
.kn .knMac span::before{content:'';display:inline-block;width:7px;height:7px;margin-right:5px;border-radius:2px;background:var(--c);vertical-align:0}
.kn .knTl{position:relative;margin:4px 0 12px;padding-left:18px}
.kn .knTl::before{content:'';position:absolute;left:4px;top:8px;bottom:8px;border-left:1px dashed var(--knG3)}
.kn .knM{position:relative;background:#fff;border:1px solid var(--knL);border-radius:18px;padding:14px 16px;margin-bottom:10px}
.kn .knM::before{content:'';position:absolute;left:-18px;top:20px;width:9px;height:9px;background:var(--knI);border:2px solid var(--knB)}
.kn .knM__h{display:flex;align-items:baseline;gap:10px;flex-wrap:wrap}
.kn .knM__h em{font:700 12px var(--knM);font-style:normal;letter-spacing:.06em;color:var(--knG4)}
.kn .knM__h b{font:800 18px/1.1 var(--knD);letter-spacing:.02em}
.kn .knM__a{margin:4px 0 8px;font:400 13px/1.45 var(--knD);color:var(--knG4)}
.kn .knOp{display:inline-flex;gap:4px;padding:3px;margin:2px 0 8px;border-radius:999px;background:rgba(11,11,12,.06)}
.kn .knOp button{min-width:44px;min-height:32px;padding:0 12px;white-space:nowrap;border:0;border-radius:999px;background:transparent;font:700 10px var(--knM);letter-spacing:.12em;color:var(--knG4);cursor:pointer}
.kn .knOp button[aria-pressed="true"]{background:var(--knI);color:var(--knB)}
.kn .knAl{list-style:none;margin:0;padding:0}
.kn .knAl li{display:grid;grid-template-columns:auto minmax(12px,1fr) auto;align-items:baseline;gap:8px;padding:6px 0;font:400 15px/1.3 var(--knD)}
.kn .knAl li i{border-bottom:1px dotted var(--knG3);transform:translateY(-4px)}
.kn .knAl li b{font:700 12px var(--knM);letter-spacing:.04em;white-space:nowrap}
.kn .knNo{margin:6px 0 0;font:400 12.5px/1.45 var(--knD);color:var(--knG4)}
.kn details.knAc{border-top:1px solid var(--knL)}
.kn details.knAc:last-child{border-bottom:1px solid var(--knL)}
.kn details.knAc summary{display:flex;justify-content:space-between;align-items:center;min-height:54px;cursor:pointer;list-style:none;font:700 11px var(--knM);letter-spacing:.12em}
.kn details.knAc summary::-webkit-details-marker{display:none}
.kn details.knAc summary::after{content:'+';font:400 18px var(--knM);color:var(--knG4)}
.kn details.knAc[open] summary::after{content:'−'}
.kn details.knAc>div{padding:0 0 16px}
.kn .knLi{margin:0;padding:0 0 0 18px;font:400 15px/1.55 var(--knD)}
.kn .knLi li{margin:4px 0}
.kn .knSu{display:grid;grid-template-columns:1fr auto;gap:2px 10px;padding:10px 0;border-bottom:1px solid var(--knL)}
.kn .knSu b{font:700 15px var(--knD)}.kn .knSu span{font:700 12px var(--knM);text-align:right}.kn .knSu small{grid-column:1/-1;font:400 12px var(--knM);color:var(--knG4);letter-spacing:.04em}
.kn .knMt{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}
.kn .knMt div{padding:12px 10px;border-radius:14px;background:var(--knB)}
.kn .knMt b{display:block;font:700 10px var(--knM);letter-spacing:.12em;color:var(--knG4)}
.kn .knMt p{margin:6px 0 0;font:500 13px/1.35 var(--knD)}
.kn .knPie{margin:14px 2px 0;font:400 10px/1.5 var(--knM);letter-spacing:.08em;color:var(--knG3)}
/* informe */
.kn .knCov{background:var(--knI);color:var(--knB);border-radius:22px;padding:22px 20px;margin-bottom:12px}
.kn .knCov h2{margin:10px 0 0;font:900 clamp(32px,10vw,42px)/.92 var(--knD);font-stretch:110%;text-transform:uppercase;letter-spacing:-.01em}
.kn .knCov h2 span{color:#6B6A65}
.kn .knCov ul{list-style:none;margin:16px 0 0;padding:12px 0 0;border-top:1px solid rgba(244,243,240,.14);display:grid;gap:7px}
.kn .knCov li{display:grid;grid-template-columns:auto minmax(12px,1fr) auto;gap:8px;align-items:center;font:400 10px var(--knM);letter-spacing:.14em;color:#8A8984}
.kn .knCov li i{border-bottom:1px dotted rgba(244,243,240,.22)}.kn .knCov li b{color:var(--knB);font-weight:700;letter-spacing:.1em}
.kn .knSec{display:flex;align-items:baseline;gap:10px;margin:22px 2px 10px}
.kn .knSec b{font:700 11px var(--knM);letter-spacing:.14em;color:var(--knG3)}
.kn .knSec h3{margin:0;font:900 22px/1 var(--knD);font-stretch:106%;text-transform:uppercase}
.kn .knTb{width:100%;border-collapse:collapse;font:400 13px var(--knD)}
.kn .knTb td{padding:9px 0;border-top:1px solid var(--knL)}
.kn .knTb td+td{text-align:right;font:700 12px var(--knM)}
.kn .knTb td i{display:inline-block;width:9px;height:9px;margin-right:8px;border-radius:2px;vertical-align:0}
.kn .knTb small{display:block;font:400 10px var(--knM);color:var(--knG4);letter-spacing:.04em}
.kn .knRg{position:relative;margin:26px 0 22px}
.kn .knRg__b{display:flex;height:8px;border-radius:4px;overflow:hidden;gap:2px}
.kn .knRg__b i{flex:1;background:var(--knG3)}
.kn .knRg__b i.on{background:var(--knI)}
.kn .knRg__l{display:flex;gap:2px;margin-top:6px}
.kn .knRg__l span{flex:1;font:700 8px var(--knM);letter-spacing:.06em;color:var(--knG4);text-align:center}
.kn .knRg__m{position:absolute;top:-24px;transform:translateX(-50%);font:700 11px var(--knM);white-space:nowrap}
.kn .knRg__m::after{content:'';position:absolute;left:50%;top:17px;width:2px;height:15px;margin-left:-1px;background:var(--knS)}
.kn .knZn{border:1px solid var(--knL);border-radius:16px;overflow:hidden;margin-bottom:10px;background:#fff}
.kn .knZn header{display:flex;justify-content:space-between;gap:10px;padding:12px 14px;background:var(--knI);color:var(--knB);font:700 11px var(--knM);letter-spacing:.12em}
.kn .knZn header span{color:#A7A6A0;font-weight:400}
.kn .knZn p{margin:0;padding:10px 14px 0;font:500 13.5px/1.4 var(--knD)}
.kn .knZn__c{display:grid;grid-template-columns:1fr 1fr;gap:4px 16px;padding:8px 14px 12px}
.kn .knZn__c div{display:flex;justify-content:space-between;gap:6px;padding:5px 0;border-bottom:1px solid var(--knL);font:400 12px var(--knD)}
.kn .knZn__c div b{font:700 11.5px var(--knM)}.kn .knZn__c div b em{font-style:normal;font-weight:400;color:var(--knG4);margin-left:4px}
.kn .knZn__c h5{grid-column:span 1;margin:6px 0 0;font:700 9px var(--knM);letter-spacing:.12em;color:var(--knG4)}
.kn .knI{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}
.kn .knI div{padding:14px;border-radius:16px;background:#fff;border:1px solid var(--knL)}
.kn .knI div.knDark{background:var(--knI)}
.kn .knI b{display:block;margin:6px 0 4px;font:700 28px/1 var(--knM);letter-spacing:-.03em}
.kn .knI small{display:block;font:700 9px/1.4 var(--knM);letter-spacing:.1em;color:var(--knG4)}
.kn .knI .knDark small{color:#A7A6A0}
.kn .knEd{display:flex;align-items:flex-end;gap:16px;margin-top:6px}
.kn .knEd b{font:700 52px/.9 var(--knM);letter-spacing:-.05em}
.kn .knEd s{text-decoration:none;font:700 30px/.9 var(--knM);color:var(--knG3)}
.kn .knBtn{display:inline-flex;align-items:center;min-height:44px;margin-top:12px;padding:0 18px;border-radius:999px;border:1.5px solid var(--knI);background:transparent;font:700 10.5px var(--knM);letter-spacing:.12em;color:var(--knI);cursor:pointer;text-decoration:none}
.kn .knVac{padding:22px 18px;border:1px dashed var(--knL);border-radius:18px;font:400 15px/1.5 var(--knD);color:var(--knG5);background:#fff}
@media (prefers-reduced-motion:no-preference){ .kn .knM{animation:knIn .35s ease-out both} @keyframes knIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}} }
`
function ensureCss(doc){
  doc = doc || (typeof document !== 'undefined' ? document : null); if (!doc || doc.getElementById('knCss')) return
  const s = doc.createElement('style'); s.id = 'knCss'; s.textContent = CSS; doc.head.appendChild(s)
}

// Alterna opción A/B de una comida (sin estado global)
function op(btn){
  const m = btn.closest('.knM'); if (!m) return
  m.querySelectorAll('.knOp button').forEach(b => b.setAttribute('aria-pressed', String(b === btn)))
  m.querySelectorAll('[data-op]').forEach(u => { u.hidden = u.dataset.op !== btn.dataset.op })
}

function macros(p, peso){
  const K = KCx(), r = K.reparto(p.kcal, p.proteina_g, p.carbohidrato_g, p.grasa_g, peso); if (!r) return ''
  const it = [['PROTEÍNA', r.proteina, '#F4F3F0'], ['CARBOHIDRATOS', r.carbohidrato, C.sig], ['GRASAS', r.grasa, '#8A8984']]
  return '<div class="knBar" role="img" aria-label="Reparto de calorías: proteína '+r.proteina.pct+'%, carbohidratos '+r.carbohidrato.pct+'%, grasas '+r.grasa.pct+'%">'+
    it.map(([, m, c]) => '<i style="width:'+m.pct+'%;background:'+c+'"></i>').join('')+'</div>'+
    '<div class="knMac">'+it.map(([l, m, c]) => '<div style="--c:'+c+'"><b>'+Math.round(m.g)+'<small>g</small></b><span>'+l+'<br>'+m.pct+'%'+(m.gkg != null ? ' · '+f1(m.gkg)+' G/KG' : '')+'</span></div>').join('')+'</div>'
}

/** Plan nutricional (página del socio). p = fila de pautas_nutricion · o = { peso, nota } */
function plan(p, o){
  o = o || {}; if (!p) return '<div class="kn"><div class="knVac">Tu plan nutricional aparece aquí cuando nutrición KOACH lo publique después de tu evaluación.</div></div>'
  const K = KCx(), c = K.normPlan(p.contenido)
  let h = '<div class="kn">'
  h += '<div class="knBox knDark"><span class="knK">TU DÍA EN NÚMEROS'+(p.programa ? ' · '+esc(String(p.programa).toUpperCase()) : '')+'</span>'+
    '<div class="knBig"><b>'+(p.kcal != null ? Math.round(p.kcal).toLocaleString('es-CL') : '—')+'</b><i>KCAL / DÍA</i></div>'+macros(p, o.peso)+'</div>'
  if (c.resumen) h += '<p class="knP" style="margin:4px 4px 16px">'+esc(c.resumen)+'</p>'
  if (o.nota) h += '<div class="knBox"><span class="knK">MENSAJE DE NUTRICIÓN</span><p class="knP" style="color:var(--knI)">'+esc(o.nota)+'</p></div>'
  if (c.comidas.length){
    h += '<span class="knK" style="margin:18px 4px 10px">TUS COMIDAS · '+c.comidas.length+'</span><div class="knTl">'
    c.comidas.forEach((m, i) => {
      h += '<article class="knM" style="animation-delay:'+(i * 40)+'ms"><div class="knM__h">'+(m.hora ? '<em>'+esc(m.hora)+'</em>' : '')+'<b>'+esc(m.nombre)+'</b></div>'+
        (m.aporte ? '<p class="knM__a">'+esc(m.aporte)+'</p>' : '')
      if (m.opciones.length > 1) h += '<div class="knOp" role="group" aria-label="Opciones de '+esc(m.nombre.toLowerCase())+'">'+m.opciones.map((x, j) => '<button type="button" data-op="'+j+'" aria-pressed="'+(j === 0)+'" onclick="KN.op(this)">OPCIÓN '+esc(x.etiqueta)+'</button>').join('')+'</div>'
      m.opciones.forEach((x, j) => { h += '<div data-op="'+j+'"'+(j ? ' hidden' : '')+'><ul class="knAl">'+x.alimentos.map(a => '<li><span>'+esc(a.alimento)+'</span><i></i><b>'+esc(a.cantidad)+'</b></li>').join('')+'</ul>'+(x.nota ? '<p class="knNo">'+esc(x.nota)+'</p>' : '')+'</div>' })
      h += '</article>'
    })
    h += '</div>'
  }
  const acc = (t, body, abierto) => body ? '<details class="knAc"'+(abierto ? ' open' : '')+'><summary>'+t+'</summary><div>'+body+'</div></details>' : ''
  const metas = c.metas.length ? '<div class="knMt">'+c.metas.map(m => '<div><b>'+esc(m.plazo)+'</b><p>'+esc(m.meta)+'</p></div>').join('')+'</div>' : ''
  const sup = c.suplementos.map(s => '<div class="knSu"><b>'+esc(s.producto)+'</b><span>'+esc(s.dosis)+'</span>'+(s.horario ? '<small>'+esc(s.horario)+'</small>' : '')+'</div>').join('')
  const lst = a => a.length ? '<ul class="knLi">'+a.map(x => '<li>'+esc(x)+'</li>').join('')+'</ul>' : ''
  const extra = acc('METAS 30 · 60 · 90 DÍAS', metas, true) + acc('SUPLEMENTACIÓN', sup) + acc('HIDRATACIÓN', c.hidratacion ? '<p class="knP">'+esc(c.hidratacion)+'</p>' : '') +
    acc('INDICACIONES', lst(c.indicaciones)) + acc('EVITAR', lst(c.evitar))
  if (extra) h += '<div class="knBox" style="padding:4px 18px">'+extra+'</div>'
  h += '<p class="knPie">PLAN '+(p.estado === 'publicada' ? 'VIGENTE · PUBLICADO EL '+fecha(p.publicada_at || p.fecha, true) : String(p.estado || 'BORRADOR').toUpperCase())+' · NUTRICIÓN KOACH</p>'
  return h + '</div>'
}

function rango(valor, cortes, etiquetas, fmt){
  // cortes: límites superiores de cada tramo (el último Infinity). Marcador posicionado dentro de su tramo.
  if (valor == null) return ''
  const n = etiquetas.length, idx = cortes.findIndex(x => valor < x), k = idx < 0 ? n - 1 : idx
  const lo = k === 0 ? (cortes[0] - (cortes[1] - cortes[0])) : cortes[k - 1], hi = isFinite(cortes[k]) ? cortes[k] : lo + (cortes[k - 1] - (cortes[k - 2] || 0))
  const pos = (k + Math.max(0, Math.min(1, (valor - lo) / (hi - lo || 1)))) / n * 100
  return '<div class="knRg"><span class="knRg__m" style="left:'+pos+'%">'+fmt(valor)+'</span><div class="knRg__b">'+etiquetas.map((_, i) => '<i class="'+(i === k ? 'on' : '')+'"></i>').join('')+'</div>'+
    '<div class="knRg__l">'+etiquetas.map(e => '<span>'+e+'</span>').join('')+'</div></div>'
}

/** Informe completo de una evaluación (reemplaza el PDF de 7 páginas).
 *  ev, ant = evaluaciones (ant puede ser null) · ctx = { nombre, programa, nivel, pauta, irPlan } */
function informe(ev, ant, ctx){
  ctx = ctx || {}; const K = KCx(); if (!ev) return ''
  const H = /^h/i.test(ev.sexo_eval || ctx.sexo || ''), peso = +ev.peso_kg || 0, pct = ev.porcentaje_grasa
  const forma = K.formaCorporal(pct, ev.ffmi_norm, ev.sexo_eval || ctx.sexo)
  let h = '<div class="kn">'
  // Portada
  h += '<div class="knCov"><span class="knK">INFORME DE COMPOSICIÓN CORPORAL · ISAK</span><h2>Informe<br><span>nutricional</span></h2><ul>'+
    [['SOCIO', esc(ctx.nombre || '—')], ['FECHA', fecha(ev.fecha, true)], ['PROGRAMA', esc(String(ctx.programa || '—').toUpperCase())], ['PERFIL', (ev.edad_eval ? ev.edad_eval+' AÑOS · ' : '')+f1(ev.peso_kg)+' KG · '+f1(ev.talla_cm)+' CM']]
      .map(([k, v]) => '<li><span>'+k+'</span><i></i><b>'+v+'</b></li>').join('')+'</ul></div>'
  // 01 Composición
  const comp = [['Grasa', ev.masa_grasa_kg, C.ink], ['Músculo', ev.masa_muscular_kg, C.sig], ['Hueso (referencia)', ev.masa_osea_kg, C.g3], ['Otros tejidos', ev.masa_residual_kg, C.g2]]
  const ok4 = peso && comp.every(x => x[1] != null)
  h += '<div class="knSec"><b>01</b><h3>Composición</h3></div><div class="knBox">'
  if (pct != null) h += '<span class="knK">GRASA CORPORAL</span>'+rango(+pct, H ? [6,14,18,25,Infinity] : [14,21,25,32,Infinity], ['ESENCIAL','ATLETA','FITNESS','ACEPTABLE','ELEVADO'], v => f1(v)+' %')
  if (ok4) h += '<div class="knBar" style="height:14px;margin:6px 0 10px" role="img" aria-label="Tu peso dividido en grasa, músculo, hueso y otros tejidos">'+comp.map(x => '<i style="width:'+(x[1] / peso * 100)+'%;background:'+x[2]+'"></i>').join('')+'</div>'
  h += '<table class="knTb">'+comp.filter(x => x[1] != null).map(x => '<tr><td><i style="background:'+x[2]+'"></i>'+x[0]+'</td><td>'+f1(x[1])+' kg'+(peso ? ' · '+Math.round(x[1] / peso * 100)+'%' : '')+'</td></tr>').join('')+
    '<tr><td>Peso total</td><td>'+f1(ev.peso_kg)+' kg</td></tr></table>'
  if (!ok4) h += '<p class="knNo">Algunas mediciones no se tomaron en esta evaluación; se muestra solo lo medido.</p>'
  h += '</div>'
  // 02 Mediciones por zona
  const zs = K.sectores(ev, ant)
  if (zs.some(z => z.pliegues.concat(z.perimetros).some(x => x.v != null))){
    h += '<div class="knSec"><b>02</b><h3>Mediciones por zona</h3></div>'
    zs.forEach(z => {
      const fila = x => x.v == null ? '' : '<div><span>'+x.l+'</span><b>'+f1(x.v)+(x.d != null && Math.abs(x.d) >= .1 ? '<em>'+sg(x.d)+'</em>' : '')+'</b></div>'
      const pl = z.pliegues.map(fila).join(''), pe = z.perimetros.map(fila).join('')
      if (!pl && !pe) return
      h += '<div class="knZn"><header>'+z.nombre+'<span>'+(z.dPliegues ? 'PLIEGUES '+sg(z.dPliegues.suma)+' MM' : ant ? '' : 'LÍNEA BASE')+'</span></header><p>'+z.lectura+'</p>'+
        '<div class="knZn__c"><div style="display:block;border:0;padding:0"><h5>PLIEGUES (MM)</h5>'+(pl || '<div><span>—</span></div>')+'</div><div style="display:block;border:0;padding:0"><h5>PERÍMETROS (CM)</h5>'+(pe || '<div><span>—</span></div>')+'</div></div></div>'
    })
    if (ev.suma6_mm != null || ev.suma8_mm != null) h += '<p class="knNo" style="margin:0 4px">Suma de pliegues: '+(ev.suma6_mm != null ? '6 sitios '+f1(ev.suma6_mm)+' mm' : '')+(ev.suma8_mm != null ? ' · 8 sitios '+f1(ev.suma8_mm)+' mm' : '')+(ant && ant.suma6_mm != null && ev.suma6_mm != null ? ' · '+sg(ev.suma6_mm - ant.suma6_mm)+' mm vs anterior' : '')+'. Es el indicador más directo de grasa subcutánea: si baja, vas bien.</p>'
  }
  // 03 Índices y edad
  const idx = []
  if (ev.ffmi_norm != null) idx.push('<div class="knDark"><small>MASA MAGRA RELATIVA (FFMI)</small><b>'+f1(ev.ffmi_norm)+'</b><small>'+esc(K.clasFFMI(+ev.ffmi_norm, ev.sexo_eval || ctx.sexo) || '')+'</small></div>')
  if (forma) idx.push('<div><small>FORMA CORPORAL</small><b style="font-size:20px;line-height:1.2">'+forma.label+'</b><small style="font-weight:400;letter-spacing:.02em">'+forma.msg+'</small></div>')
  if (ev.ict != null) idx.push('<div><small>CINTURA / ESTATURA</small><b>'+String(Math.round(ev.ict * 100) / 100).replace('.', ',')+'</b><small>'+(ev.ict > .6 ? 'RIESGO MUY ALTO' : ev.ict > .5 ? 'RIESGO AUMENTADO' : 'SALUDABLE · BAJO 0,5')+'</small></div>')
  if (ev.icc != null) idx.push('<div><small>CINTURA / CADERA</small><b>'+String(Math.round(ev.icc * 100) / 100).replace('.', ',')+'</b><small>'+(ev.icc > (H ? .95 : .85) ? 'SOBRE LO RECOMENDADO' : 'DENTRO DE LO RECOMENDADO')+'</small></div>')
  if (idx.length || ev.edad_biologica != null){
    h += '<div class="knSec"><b>03</b><h3>Índices y edad</h3></div>'
    if (idx.length) h += '<div class="knI" style="margin-bottom:12px">'+idx.join('')+'</div>'
    if (ev.edad_biologica != null && ev.edad_eval != null){
      const d = Math.round(ev.edad_biologica - ev.edad_eval)
      h += '<div class="knBox"><span class="knK">EDAD CORPORAL</span><div class="knEd"><div><small class="knK">REAL</small><s>'+ev.edad_eval+'</s></div><div><small class="knK">CORPORAL</small><b>'+Math.round(ev.edad_biologica)+'</b></div></div>'+
        '<p class="knP">'+(d <= -4 ? 'Tu cuerpo funciona como el de alguien '+Math.abs(d)+' años menor.' : d <= 0 ? 'Tu cuerpo está a la par o mejor que tu edad.' : 'Tu cuerpo muestra '+d+' años más que tu edad real: es lo que vamos a mover juntos.')+
        ' Se estima con tu grasa, tu masa magra y tus medidas de cintura.</p></div>'
    }
  }
  // 04 Energía y macros (pauta vinculada a la evaluación o la vigente)
  const p = ctx.pauta
  if (p && p.kcal){
    h += '<div class="knSec"><b>04</b><h3>Energía y macros</h3></div><div class="knBox knDark"><div class="knI" style="grid-template-columns:1fr 1fr;margin-bottom:14px">'+
      '<div class="knDark" style="padding:0;border:0"><small>GASTO ESTIMADO</small><b style="color:#F4F3F0">'+(p.tdee ? Math.round(p.tdee).toLocaleString('es-CL') : '—')+'</b><small>KCAL / DÍA</small></div>'+
      '<div class="knDark" style="padding:0;border:0"><small>TU META</small><b style="color:var(--knS)">'+Math.round(p.kcal).toLocaleString('es-CL')+'</b><small>KCAL / DÍA'+(p.tdee ? ' · '+sg(Math.round(p.kcal - p.tdee))+' VS GASTO' : '')+'</small></div></div>'+macros(p, peso)+'</div>'
  }
  // 05 Metas a 6 meses
  const meta = K.metaSeisMeses(peso, ctx.programa, ctx.nivel, { pctGrasa: pct, sexo: ev.sexo_eval || ctx.sexo })
  if (meta){
    h += '<div class="knSec"><b>05</b><h3>Meta a 6 meses</h3></div><div class="knBox knDark"><span class="knK">PROYECCIÓN CON EVIDENCIA · '+meta.tipo+'</span>'+
      '<p style="margin:10px 0 0;font:800 22px/1.15 var(--knD)">'+meta.texto+'</p>'+
      (meta.hitos.length ? '<div class="knMt" style="margin-top:14px">'+meta.hitos.map(x => '<div style="background:rgba(244,243,240,.08)"><b style="color:#A7A6A0">'+x.dias+' DÍAS</b><p style="color:#F4F3F0;font-family:var(--knM);font-weight:700">'+sg(x.valor)+' KG</p></div>').join('')+'</div>' : '')+
      (ctx.adaptativo ? '<p class="knNo" style="color:#A7A6A0;margin-top:14px">Gasto real medido entre evaluaciones: '+ctx.adaptativo.tdeeReal.toLocaleString('es-CL')+' kcal/día ('+sg(ctx.adaptativo.deltaPeso)+' kg en '+ctx.adaptativo.dias+' días con '+ctx.adaptativo.kcalPrescritas.toLocaleString('es-CL')+' kcal).</p>' : '')+'</div>'
  }
  // 06 Plan
  if (ctx.irPlan) h += '<div class="knSec"><b>06</b><h3>Plan nutricional</h3></div><div class="knBox"><p class="knP" style="margin:0">Tu plan de comidas, opciones y suplementación viven en la app y se actualizan con cada evaluación.</p><button type="button" class="knBtn" onclick="'+esc(ctx.irPlan)+'">VER MI PLAN →</button></div>'
  h += '<p class="knPie">MEDICIÓN ISAK · % GRASA: DURNIN & WOMERSLEY + SIRI · MÚSCULO: LEE 2000 · HUESO: REFERENCIA POBLACIONAL · KOACH CLUB</p>'
  return h + '</div>'
}

const KN = { VERSION:'koach-nutricion-vista@1.0.0', CSS, ensureCss, plan, informe, op, _esc: esc, _fecha: fecha }
if (typeof module !== 'undefined' && module.exports) module.exports = KN
else root.KN = KN
})(typeof self !== 'undefined' ? self : this)
