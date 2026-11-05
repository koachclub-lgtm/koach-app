/* KOACH · ESCÁNER DE PLATO · interfaz del socio (window.KEU)
   Foto → /api/escaner (IA de visión identifica; reglas KOACH deciden) → resultado con zonas tocables, acciones y tarjeta para compartir.
   La foto viaja comprimida (≤1024 px JPEG) y no se guarda. La tarjeta NO muestra el foco de salud del socio.
   KEU.init({ token: async () => 'jwt', escaneos: async () => rows, toast, whatsapp }) · KEU.abrir(num, total, nombre) · KEU.semana() */
(function(){
'use strict'
const esc = t => String(t == null ? '' : t).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]))
const n0 = v => Math.round(+v || 0).toLocaleString('es-CL')
const DIAS = ['DOMINGO','LUNES','MARTES','MIÉRCOLES','JUEVES','VIERNES','SÁBADO']
const VER = {
  adecuado: { k: 'ADECUADO', c: '#2F7D4F', ico: '<path d="M5 12.5l4.5 4.5L19 7.5"/>', card: 'Adecuado para mi plan' },
  relativo: { k: 'RELATIVAMENTE ADECUADO', c: '#C48A2C', ico: '<path d="M6 12h12"/>', card: 'Relativamente adecuado' },
  alerta:   { k: 'ALERTA', c: '#121212', ico: '<path d="M12 6.5v7"/><path d="M12 17.2v.3"/>', card: 'Fuera de mi plan' },
  no_comida:{ k: 'SIN COMIDA', c: '#6B6A65', ico: '<path d="M8 8l8 8M16 8l-8 8"/>', card: '' }
}
const GR = { proteina: 'PROTEÍNA', carbohidrato: 'CARBOHIDRATO', verdura: 'VERDURA', fruta: 'FRUTA', grasa: 'GRASA', lacteo: 'LÁCTEO', legumbre: 'LEGUMBRE', dulce: 'DULCE', bebida: 'BEBIDA', otro: 'OTRO' }
const S = { cfg: {}, ctx: null, img: null, url: null, r: null, sel: 0, file: null, busy: false, semana: null }

const CSS = `
.keu{position:fixed;inset:0;z-index:9000;display:flex;flex-direction:column;background:#F4F3F0;color:#121212;font-family:var(--font-display,'Inter Display',Inter,Arial,sans-serif);font-variant-numeric:tabular-nums;overflow:hidden}
.keu[hidden]{display:none}
.keu *{box-sizing:border-box}
.keu__top{flex-shrink:0;height:52px;display:flex;align-items:center;justify-content:space-between;padding:0 16px;padding-top:env(safe-area-inset-top);background:#121212;color:#F4F3F0}
.keu__top button{display:flex;align-items:center;gap:8px;height:40px;padding:0 6px;border:0;background:none;color:inherit;font:600 10px var(--font-mono,'IBM Plex Mono',monospace);letter-spacing:.16em;cursor:pointer}
.keu__top button svg{width:16px;height:16px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
.keu__top span{font:500 10px var(--font-mono,'IBM Plex Mono',monospace);letter-spacing:.16em;color:#A7A9AE}
.keu__sc{flex:1;overflow-y:auto;-webkit-overflow-scrolling:touch;padding-bottom:calc(20px + env(safe-area-inset-bottom))}
.keu__ph{position:relative;background:#1E1F22;overflow:hidden}
.keu__ph img{display:block;width:100%;max-height:52vh;object-fit:contain;margin:0 auto}
.keu__zs{position:absolute;inset:0;margin:0 auto}
.keu__z{position:absolute;border:1.5px dashed rgba(244,243,240,.75);border-radius:14px;background:none;padding:0;cursor:pointer;transition:background .2s,border-color .2s}
.keu__z.on{border:2.5px solid #F4F3F0;background:rgba(244,243,240,.14)}
.keu__z i{position:absolute;left:6px;top:6px;min-width:22px;height:22px;border-radius:999px;background:rgba(18,18,18,.78);color:#F4F3F0;font:600 10px/22px var(--font-mono,'IBM Plex Mono',monospace);font-style:normal;text-align:center}
.keu__z.on i{background:#F4F3F0;color:#121212}
.keu__scan{position:absolute;left:0;right:0;height:3px;background:linear-gradient(90deg,transparent,#F4F3F0,transparent);box-shadow:0 0 18px 4px rgba(244,243,240,.45);animation:keuScan 1.6s ease-in-out infinite alternate}
@keyframes keuScan{from{top:6%}to{top:92%}}
.keu__load{position:absolute;left:50%;bottom:16px;transform:translateX(-50%);padding:8px 14px;border-radius:999px;background:rgba(18,18,18,.8);color:#F4F3F0;font:600 10px var(--font-mono,'IBM Plex Mono',monospace);letter-spacing:.14em;white-space:nowrap}
.keu__chips{display:flex;gap:8px;overflow-x:auto;padding:12px 16px 4px;scrollbar-width:none}
.keu__chips::-webkit-scrollbar{display:none}
.keu__chips button{flex-shrink:0;height:34px;padding:0 12px;border-radius:999px;border:1px solid rgba(18,18,18,.18);background:#fff;color:#121212;font:600 10px var(--font-mono,'IBM Plex Mono',monospace);letter-spacing:.08em;cursor:pointer;white-space:nowrap}
.keu__chips button[aria-pressed="true"]{background:#121212;color:#F4F3F0;border-color:#121212}
.keu__ver{display:flex;gap:12px;align-items:flex-start;padding:16px 20px;background:#121212;color:#F4F3F0}
.keu__ic{width:40px;height:40px;flex-shrink:0;border-radius:999px;display:flex;align-items:center;justify-content:center;background:var(--c);border:2px solid var(--c)}
.keu__ver--alerta .keu__ic{background:none;border-color:#F4F3F0}
.keu__ic svg{width:22px;height:22px;fill:none;stroke:#fff;stroke-width:2.6;stroke-linecap:round;stroke-linejoin:round}
.keu__ver small{display:block;font:600 10px var(--font-mono,'IBM Plex Mono',monospace);letter-spacing:.16em;color:#C9CDD3}
.keu__ver b{display:block;margin-top:4px;font:700 20px/1.15 var(--font-display,'Inter Display',Inter,Arial,sans-serif);letter-spacing:-.02em}
.keu__ver p{margin:4px 0 0;font:400 14px/1.4 var(--font-display,'Inter Display',Inter,Arial,sans-serif);color:#A7A9AE}
.keu__b{padding:14px 20px 0;display:flex;flex-direction:column;gap:14px}
.keu__det{background:#FBFAF8;border:1px solid rgba(18,18,18,.08);border-radius:18px;padding:12px 16px}
.keu__det .h{display:flex;justify-content:space-between;align-items:baseline;gap:8px}
.keu__det .h span{font:600 10px var(--font-mono,'IBM Plex Mono',monospace);letter-spacing:.14em;color:#5E5D59}
.keu__det .h em{font:600 11px var(--font-mono,'IBM Plex Mono',monospace);font-style:normal;color:#5E5D59}
.keu__det b{display:block;margin-top:6px;font:700 16px/1.25 var(--font-display,'Inter Display',Inter,Arial,sans-serif)}
.keu__tags{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}
.keu__tags i{font:600 9px var(--font-mono,'IBM Plex Mono',monospace);font-style:normal;letter-spacing:.1em;padding:4px 8px;border-radius:999px;background:#121212;color:#F4F3F0}
.keu__tags i.ok{background:#E3EEE7;color:#2F7D4F}
.keu__kc .r{display:flex;justify-content:space-between;align-items:baseline;gap:8px}
.keu__kc .r b{font:700 22px var(--font-display,'Inter Display',Inter,Arial,sans-serif);letter-spacing:-.02em}
.keu__kc .r b small{font-size:13px;font-weight:400;color:#5E5D59}
.keu__kc .r span,.keu__kc>span{font:600 11px var(--font-mono,'IBM Plex Mono',monospace);color:#5E5D59}
.keu__bar{position:relative;height:8px;margin:8px 0 6px;border-radius:4px;background:#E7E6E2;overflow:hidden}
.keu__bar i{position:absolute;left:0;top:0;bottom:0;border-radius:4px;background:#121212}
.keu__acc>span{display:block;margin-bottom:8px;font:600 10px var(--font-mono,'IBM Plex Mono',monospace);letter-spacing:.16em;color:#5E5D59}
.keu__acc div{display:flex;gap:10px;align-items:flex-start;margin-top:8px;font:400 14px/1.4 var(--font-display,'Inter Display',Inter,Arial,sans-serif)}
.keu__acc div em{font:600 11px var(--font-mono,'IBM Plex Mono',monospace);font-style:normal;padding-top:2px}
.keu__bt{display:flex;flex-direction:column;gap:10px;padding:18px 20px 0}
.keu__bt button,.keu__bt a{height:54px;border-radius:18px;border:1px solid #121212;background:#121212;color:#F4F3F0;display:flex;align-items:center;justify-content:space-between;padding:0 20px;font:700 16px var(--font-display,'Inter Display',Inter,Arial,sans-serif);text-decoration:none;cursor:pointer}
.keu__bt .sec{background:transparent;color:#121212}
.keu__bt span{font:600 10px var(--font-mono,'IBM Plex Mono',monospace);letter-spacing:.16em;opacity:.7}
.keu__pie{margin:14px 20px 0;text-align:center;font:600 10px var(--font-mono,'IBM Plex Mono',monospace);letter-spacing:.12em;color:#5E5D59}
.keu__err{padding:28px 20px 0;text-align:center}
.keu__err b{display:block;font:700 20px/1.2 var(--font-display,'Inter Display',Inter,Arial,sans-serif)}
.keu__err p{margin:8px 0 0;font:400 15px/1.45 var(--font-display,'Inter Display',Inter,Arial,sans-serif);color:#5E5D59}
.keu__st{min-height:16px;margin:10px 20px 0;text-align:center;font:600 10px var(--font-mono,'IBM Plex Mono',monospace);letter-spacing:.1em;color:#5E5D59}
@media (prefers-reduced-motion:reduce){.keu__scan{animation:none;top:50%}}
@media (min-width:640px){.keu__sc{max-width:520px;margin:0 auto;width:100%}}
`
function css(){ if (document.getElementById('keuCss')) return; const s = document.createElement('style'); s.id = 'keuCss'; s.textContent = CSS; document.head.appendChild(s) }
function el(){
  let o = document.getElementById('keuO'); if (o) return o
  css(); o = document.createElement('div'); o.id = 'keuO'; o.className = 'keu'; o.hidden = true; o.setAttribute('role', 'dialog'); o.setAttribute('aria-modal', 'true'); o.setAttribute('aria-label', 'Escáner de plato')
  o.innerHTML = '<div class="keu__top"><button type="button" onclick="KEU.cerrar()"><svg viewBox="0 0 24 24"><path d="M15 6l-6 6 6 6"/></svg>ESCÁNER</button><span id="keuT"></span></div><div class="keu__sc" id="keuSc"></div>'
  document.body.appendChild(o)
  const f = document.createElement('input'); f.type = 'file'; f.accept = 'image/*'; f.id = 'keuF'; f.hidden = true
  f.addEventListener('change', () => { const x = f.files && f.files[0]; f.value = ''; if (x) foto(x) })
  document.body.appendChild(f)
  return o
}
const $ = id => document.getElementById(id)

/** Abre la cámara (o la galería) para la comida num de total. Debe llamarse desde un toque. */
function abrir(num, total, nombre){
  if (S.busy) return
  el(); S.ctx = { num: +num || null, total: +total || null, nombre: String(nombre || '').toUpperCase() }
  $('keuF').click()
}
function cerrar(){ const o = $('keuO'); if (!o) return; o.hidden = true; document.documentElement.style.overflow = ''; if (S.url) { URL.revokeObjectURL(S.url); S.url = null } }

async function comprimir(file){
  let bmp
  try { bmp = await createImageBitmap(file, { imageOrientation: 'from-image' }) } catch (_) {
    try { bmp = await createImageBitmap(file) } catch (__) { bmp = new Image(); bmp.src = URL.createObjectURL(file); await bmp.decode() } }
  const w = bmp.width || bmp.naturalWidth, h = bmp.height || bmp.naturalHeight, k = Math.min(1, 1024 / Math.max(w, h))
  const cv = document.createElement('canvas'); cv.width = Math.round(w * k); cv.height = Math.round(h * k)
  cv.getContext('2d').drawImage(bmp, 0, 0, cv.width, cv.height)
  const blob = await new Promise(ok => cv.toBlob(ok, 'image/jpeg', .82))
  const data = cv.toDataURL('image/jpeg', .82)
  return { data, blob, w: cv.width, h: cv.height }
}

async function foto(file){
  const o = el(); o.hidden = false; document.documentElement.style.overflow = 'hidden'
  const c = S.ctx || {}
  $('keuT').textContent = (c.nombre || 'COMIDA') + ' · ' + new Date().toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit', hour12: false })
  S.r = null; S.file = null; S.busy = true
  try {
    S.img = await comprimir(file)
    if (S.url) URL.revokeObjectURL(S.url); S.url = URL.createObjectURL(S.img.blob)
  } catch (e) { S.busy = false; return error('No pudimos leer la foto', 'Prueba con otra foto o con la cámara.') }
  $('keuSc').innerHTML = '<div class="keu__ph"><img src="' + S.url + '" alt="Tu plato"><div class="keu__scan"></div><div class="keu__load">ANALIZANDO TU PLATO…</div></div>'
  try {
    const tok = S.cfg.token ? await S.cfg.token() : null
    if (!tok) throw Object.assign(new Error('sesion'), { msg: 'Tu sesión expiró. Vuelve a entrar.' })
    const ctl = new AbortController(), to = setTimeout(() => ctl.abort(), 60000)
    let r
    try { r = await fetch(S.cfg.api || '/api/escaner', { method: 'POST', signal: ctl.signal, headers: { 'content-type': 'application/json', Authorization: 'Bearer ' + tok },
      body: JSON.stringify({ imagen: S.img.data, comida: c.nombre || null, comida_num: c.num }) }) } finally { clearTimeout(to) }
    const j = await r.json().catch(() => ({}))
    if (!r.ok) throw Object.assign(new Error('api'), { msg: j.error || 'El escáner no respondió (' + r.status + ')' })
    S.r = j; S.sel = 0; pintar(); preparar()
    semana().then(() => pie()).catch(() => {})
  } catch (e) {
    console.error('escaner', e)
    error(e && e.msg ? e.msg : e && e.name === 'AbortError' ? 'El análisis tardó demasiado' : 'No pudimos analizar tu plato', e && e.msg ? '' : 'Revisa tu conexión y vuelve a intentar.')
  } finally { S.busy = false }
}
function error(t, p){
  $('keuSc').innerHTML = (S.url ? '<div class="keu__ph"><img src="' + S.url + '" alt="Tu plato"></div>' : '') +
    '<div class="keu__err"><b>' + esc(t) + '</b>' + (p ? '<p>' + esc(p) + '</p>' : '') + '</div>' +
    '<div class="keu__bt"><button type="button" onclick="KEU.otra()">Intentar con otra foto<span>→</span></button><button type="button" class="sec" onclick="KEU.cerrar()">Volver a mi plan<span>←</span></button></div>'
}
function otra(){ if (S.busy) return; $('keuF').click() }

function zonas(){
  const r = S.r.resultado, im = S.img
  return r.alimentos.map((a, i) => {
    if (!a.zona) return ''
    const [y0, x0, y1, x1] = a.zona, t = Math.min(y0, y1) / 10, l = Math.min(x0, x1) / 10, h = Math.abs(y1 - y0) / 10, w = Math.abs(x1 - x0) / 10
    if (w < 2 || h < 2) return ''
    return '<button type="button" class="keu__z' + (i === S.sel ? ' on' : '') + '" style="top:' + t + '%;left:' + l + '%;width:' + w + '%;height:' + h + '%" onclick="KEU.sel(' + i + ')" aria-label="' + esc(a.nombre) + '"><i>' + (i + 1) + '</i></button>'
  }).join('')
}
function ajustarZonas(){
  // las zonas se alinean a la imagen real (object-fit:contain deja bandas)
  const img = document.querySelector('#keuSc .keu__ph img'), zs = $('keuZs'); if (!img || !zs) return
  const W = img.clientWidth, H = img.clientHeight, k = Math.min(W / S.img.w, H / S.img.h), w = S.img.w * k, h = S.img.h * k
  zs.style.width = w + 'px'; zs.style.height = h + 'px'; zs.style.left = (W - w) / 2 + 'px'; zs.style.top = (H - h) / 2 + 'px'; zs.style.right = 'auto'; zs.style.bottom = 'auto'
}
function pintar(){
  const j = S.r, r = j.resultado, v = VER[r.veredicto] || VER.relativo, c = S.ctx || {}, cx = j.contexto || {}
  if (r.veredicto === 'no_comida'){ error(r.titulo, r.mensaje); return }
  const nCom = cx.comidas_dia || c.total
  const kick = r.cheat ? 'ALERTA · CHEAT MEAL DETECTADO' : v.k + (c.num && nCom ? ' · COMIDA ' + c.num + ' DE ' + nCom : '')
  let h = '<div class="keu__ph"><img src="' + S.url + '" alt="' + esc(j.deteccion.plato || 'Tu plato') + '"><div class="keu__zs" id="keuZs">' + zonas() + '</div></div>'
  h += '<div class="keu__chips" role="group" aria-label="Alimentos detectados">' + r.alimentos.map((a, i) => '<button type="button" aria-pressed="' + (i === S.sel) + '" onclick="KEU.sel(' + i + ')">' + (i + 1) + ' · ' + esc(a.nombre.toUpperCase()) + '</button>').join('') + '</div>'
  h += '<div class="keu__ver keu__ver--' + r.veredicto + '" style="--c:' + v.c + ';margin-top:10px"><div class="keu__ic"><svg viewBox="0 0 24 24">' + v.ico + '</svg></div><div><small>' + esc(kick) + '</small><b>' + esc(r.titulo) + '</b><p>' + esc(r.mensaje) + '</p></div></div>'
  h += '<div class="keu__b"><div class="keu__det" id="keuDet">' + detalle() + '</div>'
  const t = r.totales, meta = r.ratio_comida ? Math.round(t.kcal / r.ratio_comida) : null, pct = r.porcentaje_dia
  h += '<div class="keu__kc"><div class="r"><b>≈ ' + n0(t.kcal) + ' <small>kcal estimadas</small></b>' + (pct != null ? '<span>' + pct + ' % DE TU DÍA</span>' : '') + '</div>' +
    (pct != null ? '<div class="keu__bar"><i style="width:' + Math.min(100, pct) + '%"></i></div>' : '<div style="height:6px"></div>') +
    '<span>P ' + n0(t.proteina_g) + ' · C ' + n0(t.carbohidrato_g) + ' · G ' + n0(t.grasa_g) + ' g' + (meta ? ' · TU PAUTA PARA ESTA COMIDA: ' + n0(meta) + ' KCAL' : '') + '</span></div>'
  if (r.acciones.length) h += '<div class="keu__acc"><span>' + (r.veredicto === 'alerta' ? 'PARA VOLVER A TU PLAN HOY' : r.veredicto === 'relativo' ? 'PARA AJUSTARLO' : 'PARA LA PRÓXIMA') + '</span>' + r.acciones.map((a, i) => '<div><em>0' + (i + 1) + '</em><span>' + esc(a) + '</span></div>').join('') + '</div>'
  h += '</div><div class="keu__bt"><button type="button" onclick="KEU.compartir()">Compartir mi plato<span>HISTORIA · WHATSAPP</span></button>'
  if (r.veredicto === 'alerta' && S.cfg.whatsapp) h += '<a href="' + esc(S.cfg.whatsapp('Hola, escaneé mi ' + (c.nombre || 'comida').toLowerCase() + ' (' + (j.deteccion.plato || '') + ') y salió fuera de mi plan. ¿Cómo lo compenso sin saltarme comidas?')) + '" target="_blank" rel="noopener" class="sec">Consultar a mi nutricionista<span>→</span></a>'
  h += '<button type="button" class="sec" onclick="KEU.otra()">Escanear otro plato<span>+</span></button><button type="button" class="sec" onclick="KEU.cerrar()">Listo<span>←</span></button></div>'
  h += '<div class="keu__st" id="keuSt" role="status"></div><p class="keu__pie" id="keuPie">KCAL ESTIMADAS POR FOTO · NO REEMPLAZA A TU NUTRICIONISTA</p>'
  $('keuSc').innerHTML = h; $('keuSc').scrollTop = 0
  const img = document.querySelector('#keuSc .keu__ph img'); if (img.complete) ajustarZonas(); else img.onload = ajustarZonas
}
function detalle(){
  const r = S.r.resultado, a = r.alimentos[S.sel]; if (!a) return ''
  const b = r.banderas.filter(x => x.idx === S.sel).map(x => '<i>' + esc(x.tipo.replace(/_/g, ' ').toUpperCase()) + '</i>')
  if (!b.length && a.nova <= 2 && a.preparacion !== 'frito') b.push('<i class="ok">' + (a.nova === 1 ? 'ALIMENTO REAL' : 'BUENA OPCIÓN') + '</i>')
  return '<div class="h"><span>' + (S.sel + 1) + ' · ' + (GR[a.grupo] || 'OTRO') + ' · ' + esc(a.preparacion.toUpperCase()) + '</span><em>≈ ' + n0(a.gramos) + ' g · ' + n0(a.kcal) + ' kcal</em></div><b>' + esc(a.nombre.charAt(0).toUpperCase() + a.nombre.slice(1)) + '</b><div class="keu__tags">' + b.join('') + '</div>'
}
function sel(i){
  S.sel = i
  document.querySelectorAll('#keuSc .keu__z').forEach(z => z.classList.toggle('on', z.getAttribute('onclick') === 'KEU.sel(' + i + ')'))
  document.querySelectorAll('#keuSc .keu__chips button').forEach((b, k) => b.setAttribute('aria-pressed', String(k === i)))
  const d = $('keuDet'); if (d) d.innerHTML = detalle()
}

// ═══ Tarjeta 1080×1920 (sin datos de salud: solo plato, veredicto y comida de su plan)
function rr(g, x, y, w, h, r){ g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath() }
async function tarjeta(){
  const j = S.r, r = j.resultado, v = VER[r.veredicto] || VER.relativo, c = S.ctx || {}, cx = j.contexto || {}
  const D = getComputedStyle(document.documentElement).getPropertyValue('--font-display').trim() || "'Inter Display', Inter, Arial, sans-serif"
  const M = getComputedStyle(document.documentElement).getPropertyValue('--font-mono').trim() || "'IBM Plex Mono', monospace"
  try { await document.fonts.ready } catch (_) {}
  const cv = document.createElement('canvas'); cv.width = 1080; cv.height = 1920; const g = cv.getContext('2d')
  g.fillStyle = '#121212'; g.fillRect(0, 0, 1080, 1920)
  g.fillStyle = '#F4F3F0'; g.textBaseline = 'alphabetic'
  g.font = '700 64px ' + D; g.fillText('KOACH', 80, 150)
  g.font = '500 26px ' + M; g.fillStyle = '#A7A9AE'; g.textAlign = 'right'
  g.fillText(((c.nombre || 'MI COMIDA') + ' · ' + DIAS[new Date().getDay()]).slice(0, 34), 1000, 146); g.textAlign = 'left'
  // foto recortada en cuadrado (cover) con zonas
  const X = 80, Y = 210, L = 920, im = new Image(); im.src = S.url; await im.decode()
  const iw = im.naturalWidth, ih = im.naturalHeight, s = Math.max(L / iw, L / ih), dw = iw * s, dh = ih * s, ox = X + (L - dw) / 2, oy = Y + (L - dh) / 2
  g.save(); rr(g, X, Y, L, L, 48); g.clip(); g.drawImage(im, ox, oy, dw, dh)
  g.fillStyle = 'rgba(18,18,18,.18)'; g.fillRect(X, Y, L, L)
  const et = [], cajas = []
  const iou = (a, b) => { const ix = Math.max(0, Math.min(a[2], b[2]) - Math.max(a[0], b[0])), iy = Math.max(0, Math.min(a[3], b[3]) - Math.max(a[1], b[1])), i = ix * iy, u = (a[2] - a[0]) * (a[3] - a[1]) + (b[2] - b[0]) * (b[3] - b[1]) - i; return u ? i / u : 0 }
  r.alimentos.slice(0, 5).forEach((a, i) => { if (!a.zona) return
    const [y0, x0, y1, x1] = a.zona, zx = ox + Math.min(x0, x1) / 1000 * dw, zy = oy + Math.min(y0, y1) / 1000 * dh, zw = Math.abs(x1 - x0) / 1000 * dw, zh = Math.abs(y1 - y0) / 1000 * dh
    if (zw < 30 || zh < 30) return
    const bx4 = [zx, zy, zx + zw, zy + zh], dup = cajas.some(c => iou(c, bx4) > .8); cajas.push(bx4)
    if (!dup) { g.setLineDash([12, 10]); g.lineWidth = 3; g.strokeStyle = 'rgba(244,243,240,.85)'; rr(g, zx, zy, zw, zh, 22); g.stroke(); g.setLineDash([]) }
    et.push({ x: Math.max(X + 16, Math.min(zx + 12, X + L - 40)), y: Math.max(Y + 16, Math.min(zy + 12, Y + L - 60)), t: (GR[a.grupo] || '') + ' · ' + a.nombre.toUpperCase() })
  })
  g.font = '500 24px ' + M
  const usadas = []
  et.forEach(e => { const t = e.t.length > 26 ? e.t.slice(0, 25) + '…' : e.t, w = g.measureText(t).width + 44, x = Math.min(e.x, X + L - w - 16)
    while (usadas.some(u => x < u[0] + u[2] && u[0] < x + w && e.y < u[1] + 52 && u[1] < e.y + 52) && e.y < Y + L - 70) e.y += 62
    usadas.push([x, e.y, w])
    g.fillStyle = 'rgba(18,18,18,.78)'; rr(g, x, e.y, w, 52, 26); g.fill(); g.strokeStyle = 'rgba(244,243,240,.4)'; g.lineWidth = 1.5; g.stroke()
    g.fillStyle = '#F4F3F0'; g.fillText(t, x + 22, e.y + 34) })
  g.restore()
  // tarjeta inferior
  const CY = 1180; g.fillStyle = '#1E1F22'; rr(g, 64, CY, 952, 600, 56); g.fill(); g.strokeStyle = 'rgba(244,243,240,.12)'; g.lineWidth = 2; g.stroke()
  g.beginPath(); g.arc(196, CY + 120, 52, 0, Math.PI * 2)
  if (r.veredicto === 'alerta') { g.strokeStyle = '#F4F3F0'; g.lineWidth = 5; g.stroke() } else { g.fillStyle = v.c; g.fill() }
  g.save(); g.translate(196 - 28, CY + 120 - 28); g.scale(56 / 24, 56 / 24); g.strokeStyle = '#fff'; g.lineWidth = 3; g.lineCap = 'round'; g.lineJoin = 'round'
  const ic = { adecuado: 'M5 12.5l4.5 4.5L19 7.5', relativo: 'M6 12h12', alerta: 'M12 6.5v7M12 17.2v.3' }[r.veredicto]; if (ic) g.stroke(new Path2D(ic)); g.restore()
  g.fillStyle = '#A7A9AE'; g.font = '500 26px ' + M; g.fillText('MI ' + (c.nombre || 'COMIDA'), 276, CY + 92)
  g.fillStyle = '#F4F3F0'
  const tt = r.cheat ? 'Cheat meal detectado' : v.card; let fs = 70; g.font = '700 ' + fs + 'px ' + D
  while (g.measureText(tt).width > 690 && fs > 44) { fs -= 2; g.font = '700 ' + fs + 'px ' + D }
  g.fillText(tt, 276, CY + 166)
  const t = r.totales
  g.font = '700 72px ' + D; g.fillText('≈ ' + n0(t.kcal), 128, CY + 320); const kw = g.measureText('≈ ' + n0(t.kcal)).width
  g.font = '400 30px ' + D; g.fillStyle = '#A7A9AE'; g.fillText('kcal', 128 + kw + 14, CY + 320)
  g.font = '500 30px ' + M; g.fillStyle = '#C9CDD3'; g.textAlign = 'right'; g.fillText('P ' + n0(t.proteina_g) + ' · C ' + n0(t.carbohidrato_g) + ' · G ' + n0(t.grasa_g) + ' g', 952, CY + 316); g.textAlign = 'left'
  const kp = t.proteina_g * 4, kc = t.carbohidrato_g * 4, kg = t.grasa_g * 9, kt = kp + kc + kg || 1; let bx = 128
  ;[[kp, '#F4F3F0'], [kc, '#C9CDD3'], [kg, '#8A8F97']].forEach(([k, col]) => { const w = Math.max(0, k / kt * 824 - 6); g.fillStyle = col; rr(g, bx, CY + 352, Math.max(w, 1), 20, 6); g.fill(); bx += w + 6 })
  g.font = '500 22px ' + M; g.fillStyle = '#A7A9AE'; g.fillText('PROTEÍNA      CARBOHIDRATOS      GRASAS', 128, CY + 412)
  g.fillStyle = 'rgba(244,243,240,.12)'; g.fillRect(128, CY + 460, 824, 2)
  const nCom = cx.comidas_dia || c.total
  g.fillStyle = '#F4F3F0'; g.font = '500 26px ' + M
  if (c.num && nCom) {
    g.fillText('COMIDA ' + c.num + ' DE ' + nCom + ' DE MI PLAN', 128, CY + 530)
    const n = Math.min(nCom, 8), sw = 56, gap = 10; let sx = 952 - n * sw - (n - 1) * gap
    for (let i = 1; i <= n; i++) { g.fillStyle = i <= c.num ? '#C9CDD3' : '#2A2B2E'; rr(g, sx, CY + 512, sw, 14, 6); g.fill(); sx += sw + gap }
  } else g.fillText('ESCANEADO CON KOACH', 128, CY + 530)
  g.font = '500 24px ' + M; g.fillStyle = '#8E8D88'; g.fillText('MÉTODO KOACH · NUTRICIÓN', 80, 1840); g.textAlign = 'right'; g.fillText('KCAL ESTIMADAS POR FOTO', 1000, 1840); g.textAlign = 'left'
  return await new Promise((ok, no) => cv.toBlob(b => b ? ok(new File([b], 'koach-plato-' + Date.now() + '.jpg', { type: 'image/jpeg' })) : no(new Error('img')), 'image/jpeg', .9))
}
// La tarjeta se arma apenas llega el resultado: el toque en COMPARTIR abre el menú del teléfono sin trabajo previo (iOS lo exige)
function preparar(){ S.file = null; tarjeta().then(f => { S.file = f }).catch(e => console.error('tarjeta', e)) }
function st(m){ const s = $('keuSt'); if (s) s.textContent = m || '' }
function bajar(f){ const a = document.createElement('a'); a.href = URL.createObjectURL(f); a.download = f.name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000) }
async function compartir(){
  let f = S.file
  if (!f) { st('Preparando tu tarjeta…'); try { f = S.file = await tarjeta() } catch (e) { st('No se pudo generar la imagen.'); return } st('Lista. Toca COMPARTIR otra vez.'); return }
  let ok = false; try { ok = !!(navigator.canShare && navigator.share && navigator.canShare({ files: [f] })) } catch (_) {}
  if (!ok) { bajar(f); st('La imagen se descargó.'); return }
  st('En el menú elige Instagram → Historia, o WhatsApp.')
  navigator.share({ files: [f] }).then(() => st(''), e => { if (!e || e.name !== 'AbortError') st('No se pudo abrir el menú. Prueba de nuevo.') })
}

// ═══ Resumen semanal (sobre lo escaneado: no castiga a quien escanea poco)
async function semana(){
  if (!S.cfg.escaneos) return null
  const rows = await S.cfg.escaneos()
  S.semana = { rows: rows || [], res: (window.KE || {}).semana ? KE.semana(rows) : null }
  pintarSemana(); return S.semana
}
function pintarSemana(){
  const box = document.getElementById('knEscSem'); if (!box || !S.semana || !S.semana.res) return
  const s = S.semana.res; if (!s.escaneos) return
  const hoy = new Date(), dias = []
  for (let i = 6; i >= 0; i--) { const d = new Date(hoy); d.setDate(d.getDate() - i); const k = d.toLocaleDateString('sv-SE', { timeZone: 'America/Santiago' })
    const del = S.semana.rows.filter(r => String(r.fecha) === k && r.veredicto !== 'no_comida')
    dias.push(!del.length ? '' : del.some(r => r.veredicto === 'alerta') ? 'x' : del.some(r => r.veredicto === 'relativo') ? 'r' : 'a') }
  box.innerHTML = '<span class="knK">ESCÁNER DE PLATO · ÚLTIMOS 7 DÍAS</span><div class="knEsN"><div><b>' + s.escaneos + '</b><span>PLATOS ESCANEADOS</span></div><div><b>' + s.dias + '<small style="font-size:12px;color:#A3A29C">/7</small></b><span>DÍAS CON ESCÁNER</span></div><div><b>' + (s.aciertos != null ? s.aciertos + '%' : '—') + '</b><span>EN PLAN</span></div></div>' +
    '<div class="knEsD" aria-hidden="true">' + dias.map(d => '<i class="' + d + '"></i>').join('') + '</div>' +
    (s.patron ? '<p class="knEsP">Tu ' + esc(s.patron.comida.toLowerCase()) + ' salió fuera de plan ' + s.patron.veces + ' veces esta semana. Ahí está tu mayor oportunidad.</p>' : s.alertas === 0 ? '<p class="knEsP">Todo lo que escaneaste va con tu plan. Sigue así.</p>' : '')
}
function pie(){
  const p = $('keuPie'), s = S.semana && S.semana.res; if (!p || !s || !s.escaneos) return
  p.textContent = s.escaneos + (s.escaneos === 1 ? ' PLATO ESCANEADO' : ' PLATOS ESCANEADOS') + ' ESTA SEMANA' + (s.aciertos != null ? ' · ' + s.aciertos + ' % EN PLAN' : '') + ' · KCAL ESTIMADAS POR FOTO'
}

function init(cfg){ S.cfg = Object.assign(S.cfg, cfg || {}); window.addEventListener('resize', () => { if ($('keuO') && !$('keuO').hidden) ajustarZonas() }) }
window.KEU = { init, abrir, cerrar, otra, sel, compartir, semana, pintarSemana, _S: S }
})()
