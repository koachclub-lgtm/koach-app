/* KOACH · ESCÁNER DE COMIDAS · interfaz del socio (window.KEU) · v2
   Flujo: elegir comida del plan → foto → /api/escaner (la IA identifica alimentos, gramos y zonas; la foto NO se guarda)
   → veredicto con reglas KOACH + comparación con la comida de la pauta (en tu plan / reemplazo / falta / porción) + alertas inflamatorias
   → el socio corrige alimentos y gramos (recalcula) → CONFIRMAR registra la comida (cumplida o cheat meal).
   La tarjeta para Instagram es una capa aparte (más adelante): esta pantalla es el registro interno.
   KEU.init({ token, plan: () => ({ pauta, comidas, estado(num) }), confirmar: async (id, num, det, res), onRegistrado }) · KEU.abrir(num?) */
(function(){
'use strict'
const esc = t => String(t == null ? '' : t).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]))
const n0 = v => Math.round(+v || 0).toLocaleString('es-CL')
const VER = {
  adecuado: { k: 'ADECUADO', c: '#2F7D4F', ico: '<path d="M5 12.5l4.5 4.5L19 7.5"/>', card: 'Adecuado para mi plan' },
  relativo: { k: 'RELATIVAMENTE ADECUADO', c: '#C48A2C', ico: '<path d="M6 12h12"/>', card: 'Relativamente adecuado' },
  alerta:   { k: 'ALERTA', c: '#121212', ico: '<path d="M12 6.5v7"/><path d="M12 17.2v.3"/>', card: 'Fuera de mi plan' },
  no_comida:{ k: 'SIN COMIDA', c: '#6B6A65', ico: '<path d="M8 8l8 8M16 8l-8 8"/>', card: '' }
}
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
const KEU_CSS2 = `
.keu__pick{padding:22px 20px 0}
.keu__pick h2{margin:6px 0 16px;font:700 26px/1.1 var(--font-display,'Inter Display',Inter,Arial,sans-serif);letter-spacing:-.02em}
.keu__pick small{display:block;font:600 10px var(--font-mono,'IBM Plex Mono',monospace);letter-spacing:.16em;color:#5E5D59}
.keu__pk{display:flex;flex-direction:column;gap:10px}
.keu__pk button{display:grid;grid-template-columns:44px 1fr auto;align-items:center;gap:12px;min-height:64px;padding:10px 16px;border-radius:18px;border:1px solid rgba(18,18,18,.14);background:#fff;color:#121212;text-align:left;cursor:pointer}
.keu__pk button b{font:700 17px var(--font-display,'Inter Display',Inter,Arial,sans-serif)}
.keu__pk button em{font:600 22px var(--font-mono,'IBM Plex Mono',monospace);font-style:normal}
.keu__pk button span{font:600 9.5px var(--font-mono,'IBM Plex Mono',monospace);letter-spacing:.12em;color:#5E5D59}
.keu__pk button.ok span{color:#2F7D4F}.keu__pk button.ch span{color:#B23A2E}
.keu__ms{display:flex;gap:6px;padding:12px 16px 0;overflow-x:auto;scrollbar-width:none}
.keu__ms::-webkit-scrollbar{display:none}
.keu__ms button{flex:1 0 auto;min-width:74px;height:50px;border-radius:14px;border:1.5px solid rgba(18,18,18,.16);background:#fff;color:#121212;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;font:600 13px var(--font-mono,'IBM Plex Mono',monospace);cursor:pointer}
.keu__ms button span{font-size:8.5px;letter-spacing:.08em}
.keu__ms button[aria-pressed="true"]{background:#121212;border-color:#121212;color:#F4F3F0}
.keu__k{display:block;margin-bottom:8px;font:600 10px var(--font-mono,'IBM Plex Mono',monospace);letter-spacing:.16em;color:#5E5D59}
.keu__card{background:#fff;border:1px solid rgba(18,18,18,.08);border-radius:18px;padding:14px 16px}
.keu__cm{display:flex;gap:10px;align-items:flex-start;padding:8px 0;border-top:1px solid rgba(18,18,18,.07);font:400 14px/1.4 var(--font-display,'Inter Display',Inter,Arial,sans-serif)}
.keu__cm:first-of-type{border-top:0}
.keu__cm i{flex-shrink:0;min-width:96px;padding:4px 8px;border-radius:999px;font:600 8.5px/1.3 var(--font-mono,'IBM Plex Mono',monospace);font-style:normal;letter-spacing:.1em;text-align:center}
.keu__cm i.plan{background:#E3EEE7;color:#1F5B38}.keu__cm i.reemplazo{background:#E8EEF6;color:#244A73}.keu__cm i.fuera{background:#121212;color:#F4F3F0}.keu__cm i.extra{background:#EFEDE8;color:#4A4945}.keu__cm i.falta{background:#FBEFD9;color:#7A4E0E}.keu__cm i.ajuste{background:#F1F0EC;color:#121212}
.keu__inf{background:#121212;color:#F4F3F0;border-radius:18px;padding:14px 16px}
.keu__inf .keu__k{color:#C9CDD3}
.keu__inf div{display:flex;justify-content:space-between;gap:10px;padding:7px 0;border-top:1px solid rgba(244,243,240,.12);font:600 14px var(--font-display,'Inter Display',Inter,Arial,sans-serif)}
.keu__inf div:first-of-type{border-top:0}
.keu__inf div span{font:600 9.5px var(--font-mono,'IBM Plex Mono',monospace);letter-spacing:.1em;color:#E8B4AC;text-align:right}
.keu__ed{display:grid;grid-template-columns:24px minmax(0,1fr) 78px 36px;gap:8px;align-items:center;padding:10px 0;border-top:1px solid rgba(18,18,18,.07)}
.keu__ed:first-of-type{border-top:0}
.keu__ed>em{width:24px;height:24px;border-radius:999px;background:#121212;color:#F4F3F0;font:600 10px/24px var(--font-mono,'IBM Plex Mono',monospace);font-style:normal;text-align:center}
.keu__ed.on>em{background:#2F7D4F}
.keu__ed input{width:100%;min-width:0;height:40px;border-radius:10px;border:1px solid rgba(18,18,18,.16);background:#FBFAF8;padding:0 10px;font:600 15px var(--font-display,'Inter Display',Inter,Arial,sans-serif);color:#121212}
.keu__ed input:focus{outline:2px solid #121212;outline-offset:0;border-color:#121212}
.keu__g{position:relative}.keu__g input{padding-right:22px;text-align:right;font-family:var(--font-mono,'IBM Plex Mono',monospace)}
.keu__g b{position:absolute;right:8px;top:50%;transform:translateY(-50%);font:600 10px var(--font-mono,'IBM Plex Mono',monospace);color:#5E5D59}
.keu__ed button{width:36px;height:40px;border-radius:10px;border:1px solid rgba(18,18,18,.12);background:transparent;color:#5E5D59;cursor:pointer;font-size:16px}
.keu__ed small{grid-column:2/-1;margin-top:-2px;font:600 9.5px var(--font-mono,'IBM Plex Mono',monospace);letter-spacing:.06em;color:#5E5D59}
.keu__ed small b{display:inline-block;margin-right:6px;padding:2px 6px;border-radius:999px;border:1px solid #121212;color:#121212;font-weight:600;letter-spacing:.1em}
.keu__add{margin-top:8px;width:100%;height:44px;border-radius:12px;border:1px dashed rgba(18,18,18,.3);background:transparent;font:600 10.5px var(--font-mono,'IBM Plex Mono',monospace);letter-spacing:.12em;color:#121212;cursor:pointer}
.keu__nota{margin:8px 0 0;font:400 12.5px/1.45 var(--font-display,'Inter Display',Inter,Arial,sans-serif);color:#5E5D59}
.keu__tot{display:flex;justify-content:space-between;align-items:baseline;gap:8px;margin-top:10px;padding-top:12px;border-top:2px solid #121212}
.keu__tot b{font:700 26px var(--font-display,'Inter Display',Inter,Arial,sans-serif);letter-spacing:-.02em}.keu__tot b small{font-size:12px;font-weight:400;color:#5E5D59}
.keu__tot span{font:600 10px var(--font-mono,'IBM Plex Mono',monospace);letter-spacing:.06em}
.keu__mt{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:10px}
.keu__mt div{font:600 9.5px var(--font-mono,'IBM Plex Mono',monospace);letter-spacing:.08em;color:#5E5D59}
.keu__mt div b{display:block;margin-top:3px;font:600 13px var(--font-mono,'IBM Plex Mono',monospace);color:#121212}
.keu__mt i{display:block;height:5px;margin-top:5px;border-radius:3px;background:#E7E6E2;overflow:hidden}.keu__mt i s{display:block;height:100%;background:#121212;text-decoration:none}
.keu__mt i s.over{background:#B23A2E}
.keu__bt button[disabled]{opacity:.45;cursor:default}
.keu__ok{padding:40px 24px 0;text-align:center}
.keu__ok .keu__ic{width:76px;height:76px;margin:0 auto 18px}.keu__ok .keu__ic svg{width:40px;height:40px}
.keu__ok b{display:block;font:700 26px/1.15 var(--font-display,'Inter Display',Inter,Arial,sans-serif);letter-spacing:-.02em}
.keu__ok p{margin:8px 0 0;font:400 15px/1.45 var(--font-display,'Inter Display',Inter,Arial,sans-serif);color:#5E5D59}
`
const S = { cfg: {}, num: null, img: null, url: null, r: null, al: [], res: null, cmp: null, sel: 0, busy: false, sucio: false, edit: false }
function css(){ if (document.getElementById('keuCss')) return; const s = document.createElement('style'); s.id = 'keuCss'; s.textContent = CSS + KEU_CSS2; document.head.appendChild(s) }
function el(){
  let o = document.getElementById('keuO'); if (o) return o
  css(); o = document.createElement('div'); o.id = 'keuO'; o.className = 'keu'; o.hidden = true; o.setAttribute('role', 'dialog'); o.setAttribute('aria-modal', 'true'); o.setAttribute('aria-label', 'Escáner de comidas')
  o.innerHTML = '<div class="keu__top"><button type="button" onclick="KEU.cerrar()"><svg viewBox="0 0 24 24"><path d="M15 6l-6 6 6 6"/></svg>ESCÁNER</button><span id="keuT"></span></div><div class="keu__sc" id="keuSc"></div>'
  document.body.appendChild(o)
  const f = document.createElement('input'); f.type = 'file'; f.accept = 'image/*'; f.id = 'keuF'; f.hidden = true
  f.addEventListener('change', () => { const x = f.files && f.files[0]; f.value = ''; if (x) foto(x) })
  document.body.appendChild(f)
  return o
}
const $ = id => document.getElementById(id)
// Plan del socio (lo entrega la app): { pauta, comidas:[{nombre,hora,opciones}], estado(num) → 'cumplida'|'cheat'|null }
const plan = () => (S.cfg.plan && S.cfg.plan()) || { pauta: null, comidas: [] }
const comidaN = n => plan().comidas[n - 1] || null
function mostrar(){ const o = el(); o.hidden = false; document.documentElement.style.overflow = 'hidden' }
function titulo(t){ const e = $('keuT'); if (e) e.textContent = t || '' }

/** Abre el escáner. Con num: directo a la cámara para esa comida. Sin num: primero elige la comida (el toque abre la cámara). */
function abrir(num){
  if (S.busy) return
  el(); S.r = null; S.al = []; S.res = null; S.cmp = null; S.sucio = false
  if (num) { S.num = +num; $('keuF').click(); return }
  S.num = null; mostrar(); titulo('ELIGE TU COMIDA')
  const p = plan()
  $('keuSc').innerHTML = '<div class="keu__pick"><small>ESCÁNER DE COMIDAS</small><h2>¿Qué comida de tu plan vas a escanear?</h2><div class="keu__pk">' +
    p.comidas.map((c, i) => { const e = p.estado ? p.estado(i + 1) : null
      return '<button type="button" class="' + (e === 'cumplida' ? 'ok' : e === 'cheat' ? 'ch' : '') + '" onclick="KEU.elegir(' + (i + 1) + ')"><em>' + (i + 1) + '</em><b>' + esc(c.nombre) + '</b><span>' + (e === 'cumplida' ? '✓ LISTA' : e === 'cheat' ? 'CHEAT MEAL' : esc(c.hora || 'PENDIENTE')) + '</span></button>' }).join('') +
    '</div><p class="keu__nota" style="margin-top:14px">Saca la foto desde arriba, con buena luz y el plato completo. La foto no se guarda: solo se usa para reconocer tu comida.</p></div>'
}
function elegir(n){ S.num = +n; $('keuF').click() }
function cerrar(){ const o = $('keuO'); if (!o) return; o.hidden = true; document.documentElement.style.overflow = ''; if (S.url) { URL.revokeObjectURL(S.url); S.url = null } }

async function comprimir(file){
  let bmp
  try { bmp = await createImageBitmap(file, { imageOrientation: 'from-image' }) } catch (_) {
    try { bmp = await createImageBitmap(file) } catch (__) { bmp = new Image(); bmp.src = URL.createObjectURL(file); await bmp.decode() } }
  const w = bmp.width || bmp.naturalWidth, h = bmp.height || bmp.naturalHeight, k = Math.min(1, 1024 / Math.max(w, h))
  const cv = document.createElement('canvas'); cv.width = Math.round(w * k); cv.height = Math.round(h * k)
  cv.getContext('2d').drawImage(bmp, 0, 0, cv.width, cv.height)
  const blob = await new Promise(ok => cv.toBlob(ok, 'image/jpeg', .82))
  return { data: cv.toDataURL('image/jpeg', .82), blob, w: cv.width, h: cv.height }
}
async function api(body){
  const tok = S.cfg.token ? await S.cfg.token() : null
  if (!tok) throw Object.assign(new Error('sesion'), { msg: 'Tu sesión expiró. Vuelve a entrar.' })
  const ctl = new AbortController(), to = setTimeout(() => ctl.abort(), 60000)
  let r; try { r = await fetch(S.cfg.api || '/api/escaner', { method: 'POST', signal: ctl.signal, headers: { 'content-type': 'application/json', Authorization: 'Bearer ' + tok }, body: JSON.stringify(body) }) } finally { clearTimeout(to) }
  const j = await r.json().catch(() => ({}))
  if (!r.ok) throw Object.assign(new Error('api'), { msg: j.error || 'El escáner no respondió (' + r.status + ')' })
  return j
}
async function foto(file){
  mostrar(); const c = comidaN(S.num)
  titulo((c ? c.nombre : 'COMIDA') + ' · ' + new Date().toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit', hour12: false }))
  S.r = null; S.busy = true
  try { S.img = await comprimir(file); if (S.url) URL.revokeObjectURL(S.url); S.url = URL.createObjectURL(S.img.blob) }
  catch (e) { S.busy = false; return error('No pudimos leer la foto', 'Prueba con otra foto o con la cámara.') }
  $('keuSc').innerHTML = '<div class="keu__ph"><img src="' + S.url + '" alt="Tu plato"><div class="keu__scan"></div><div class="keu__load">ANALIZANDO TU COMIDA…</div></div>'
  try {
    S.r = await api({ imagen: S.img.data, comida: c ? c.nombre : null, comida_num: S.num })
    S.al = ((S.r.resultado && S.r.resultado.alimentos) || []).map(a => Object.assign({}, a)); S.sel = 0; S.sucio = false
    if (!S.al.length || (S.r.resultado && S.r.resultado.veredicto === 'no_comida')) return error('No reconocimos comida', 'Toma la foto desde arriba, con buena luz y el plato completo.')
    recalc(); pintar()
  } catch (e) {
    console.error('escaner', e)
    error(e && e.msg ? e.msg : e && e.name === 'AbortError' ? 'El análisis tardó demasiado' : 'No pudimos analizar tu comida', e && e.msg ? '' : 'Revisa tu conexión y vuelve a intentar.')
  } finally { S.busy = false }
}
function error(t, p){
  $('keuSc').innerHTML = (S.url ? '<div class="keu__ph"><img src="' + S.url + '" alt="Tu plato"></div>' : '') +
    '<div class="keu__err"><b>' + esc(t) + '</b>' + (p ? '<p>' + esc(p) + '</p>' : '') + '</div>' +
    '<div class="keu__bt"><button type="button" onclick="KEU.otra()">Intentar con otra foto<span>→</span></button><button type="button" class="sec" onclick="KEU.cerrar()">Volver<span>←</span></button></div>'
}
function otra(){ if (S.busy) return; $('keuF').click() }

// Veredicto (reglas KOACH) + comparación con la comida de la pauta, siempre sobre los alimentos ya corregidos
function recalc(){
  const p = plan(), pa = p.pauta || {}, n = p.comidas.length || null, c = comidaN(S.num)
  S.res = KE.evaluar({ es_comida: true, alimentos: S.al }, { foco: (pa.intake && pa.intake.foco) || (S.r && S.r.contexto && S.r.contexto.foco) || 'general',
    comida: c ? { nombre: c.nombre } : null, kcal_dia: pa.kcal || null, comidas_dia: n })
  S.cmp = c ? KE.comparar(S.res.alimentos, c, KE.metasComida(pa)) : null
}
function zonas(){
  return S.res.alimentos.map((a, i) => {
    if (!a.zona) return ''
    const [y0, x0, y1, x1] = a.zona, t = Math.min(y0, y1) / 10, l = Math.min(x0, x1) / 10, h = Math.abs(y1 - y0) / 10, w = Math.abs(x1 - x0) / 10
    if (w < 2 || h < 2) return ''
    return '<button type="button" class="keu__z' + (i === S.sel ? ' on' : '') + '" data-i="' + i + '" style="top:' + t + '%;left:' + l + '%;width:' + w + '%;height:' + h + '%" onclick="KEU.sel(' + i + ')" aria-label="' + esc(a.nombre) + '"><i>' + (i + 1) + '</i></button>'
  }).join('')
}
function ajustarZonas(){
  const img = document.querySelector('#keuSc .keu__ph img'), zs = $('keuZs'); if (!img || !zs || !S.img) return
  const W = img.clientWidth, H = img.clientHeight, k = Math.min(W / S.img.w, H / S.img.h), w = S.img.w * k, h = S.img.h * k
  zs.style.width = w + 'px'; zs.style.height = h + 'px'; zs.style.left = (W - w) / 2 + 'px'; zs.style.top = (H - h) / 2 + 'px'; zs.style.right = 'auto'; zs.style.bottom = 'auto'
}
const ROLX = { proteina: 'PROTEÍNA', legumbre: 'PROTEÍNA', lacteo: 'PROTEÍNA', carbohidrato: 'CARBOHIDRATO', fruta: 'CARBOHIDRATO', verdura: 'VERDURAS', grasa: 'GRASAS', dulce: 'DULCE', bebida: 'BEBIDA', otro: 'OTRO' }
function pintar(){
  const sc = $('keuSc'), y = sc.scrollTop, r = S.res, v = VER[r.veredicto] || VER.relativo, p = plan(), c = comidaN(S.num), n = p.comidas.length
  titulo(c ? 'COMIDA ' + S.num + ' DE ' + n + ' · ' + c.nombre : 'ESCÁNER')
  let h = '<div class="keu__ph"><img src="' + S.url + '" alt="Tu comida"><div class="keu__zs" id="keuZs">' + zonas() + '</div></div>'
  // a qué comida corresponde (cambia la comparación al instante)
  h += '<div class="keu__ms" role="group" aria-label="¿Qué comida de tu plan es?">' + p.comidas.map((x, i) => '<button type="button" aria-pressed="' + (S.num === i + 1) + '" onclick="KEU.comida(' + (i + 1) + ')">' + (i + 1) + '<span>' + esc(String(x.nombre).slice(0, 10)) + '</span></button>').join('') + '</div>'
  const kick = r.cheat ? 'ALERTA · CHEAT MEAL DETECTADO' : v.k + (c ? ' · COMIDA ' + S.num + ' DE ' + n : '')
  h += '<div class="keu__ver keu__ver--' + r.veredicto + '" style="--c:' + v.c + ';margin-top:12px"><div class="keu__ic"><svg viewBox="0 0 24 24">' + v.ico + '</svg></div><div><small>' + esc(kick) + '</small><b>' + esc(r.titulo) + '</b><p>' + esc(r.mensaje) + '</p></div></div>'
  h += '<div class="keu__b">'
  // cómo va con la pauta
  if (S.cmp) {
    const E = { plan: 'EN TU PLAN', reemplazo: 'REEMPLAZO ADECUADO', fuera: 'NO ADECUADO', extra: 'FUERA DE PAUTA' }
    let rows = S.cmp.items.map(it => { const a = r.alimentos[it.idx]
      return '<div class="keu__cm"><i class="' + it.estado + '">' + E[it.estado] + '</i><span><b>' + esc(cap(a.nombre)) + '</b>' + (it.estado === 'reemplazo' && it.ref ? ' en vez de ' + esc(it.ref.toLowerCase()) : '') + '</span></div>' }).join('')
    rows += S.cmp.faltan.map(f => '<div class="keu__cm"><i class="falta">FALTA ' + f.rol + '</i><span>Tu plan incluye ' + esc(f.ej.join(' o ').toLowerCase() || f.rol.toLowerCase()) + '.</span></div>').join('')
    rows += S.cmp.ajustes.map(a => '<div class="keu__cm"><i class="ajuste">PORCIÓN</i><span>' + esc(a.texto) + '</span></div>').join('')
    h += '<div class="keu__card"><span class="keu__k">CÓMO VA CON TU PLAN · ' + esc(c.nombre) + '</span>' + rows + '</div>'
  }
  // alimentos inflamatorios / contra tu perfil
  const inf = KE.inflamatorios(r)
  if (inf.length) h += '<div class="keu__inf"><span class="keu__k">ALERTA · ALIMENTOS INFLAMATORIOS</span>' + inf.map(x => '<div>' + esc(cap(x.nombre)) + '<span>' + esc(x.motivos.join(' · ').toUpperCase()) + '</span></div>').join('') + '</div>'
  // revisión: nombre y gramos editables
  h += '<div class="keu__card"><span class="keu__k">REVISA LO QUE DETECTAMOS</span>' +
    S.al.map((a, i) => { const ra = r.alimentos[i] || a
      return '<div class="keu__ed' + (i === S.sel ? ' on' : '') + '"><em>' + (i + 1) + '</em><input type="text" value="' + esc(a.nombre) + '" aria-label="Alimento ' + (i + 1) + '" oninput="KEU.nombre(' + i + ',this.value)" onfocus="KEU.sel(' + i + ',1)">' +
        '<label class="keu__g"><input type="number" inputmode="numeric" min="0" max="2000" value="' + Math.round(a.gramos) + '" aria-label="Gramos de ' + esc(a.nombre) + '" onchange="KEU.gramos(' + i + ',this.value)"><b>g</b></label>' +
        '<button type="button" aria-label="Quitar ' + esc(a.nombre) + '" onclick="KEU.quitar(' + i + ')">✕</button>' +
        '<small><b>' + (ROLX[ra.grupo] || 'OTRO') + '</b>' + n0(ra.kcal) + ' KCAL · P ' + n0(ra.proteina_g) + ' · C ' + n0(ra.carbohidrato_g) + ' · G ' + n0(ra.grasa_g) + '</small></div>' }).join('') +
    '<button type="button" class="keu__add" onclick="KEU.agregar()">+ AGREGAR UN ALIMENTO</button>' +
    '<p class="keu__nota">Los gramos son una lectura aproximada de la foto. Si pesaste tu comida, corrígelos: así tu registro queda exacto.</p>'
  const t = r.totales, m = S.cmp && S.cmp.metas
  const barra = (lbl, val, meta) => '<div>' + lbl + '<b>' + n0(val) + (meta ? ' / ' + n0(meta) : '') + ' g</b>' + (meta ? '<i><s class="' + (val > meta * 1.25 ? 'over' : '') + '" style="width:' + Math.min(100, val / meta * 100) + '%"></s></i>' : '') + '</div>'
  h += '<div class="keu__tot"><span>TOTAL' + (m ? ' · TU PAUTA: ' + n0(m.kcal) + ' KCAL' : '') + '</span><b>≈ ' + n0(t.kcal) + ' <small>kcal</small></b></div>' +
    '<div class="keu__mt">' + barra('PROTEÍNA', t.proteina_g, m && m.proteina_g) + barra('CARBOHIDRATOS', t.carbohidrato_g, m && m.carbohidrato_g) + barra('GRASAS', t.grasa_g, m && m.grasa_g) + '</div></div></div>'
  h += '<div class="keu__bt" id="keuBt">' + botones() + '</div>'
  h += '<div class="keu__st" id="keuSt" role="status"></div><p class="keu__pie">KCAL ESTIMADAS POR FOTO · LA FOTO NO SE GUARDA</p>'
  sc.innerHTML = h; sc.scrollTop = y
  const img = sc.querySelector('.keu__ph img'); if (img.complete) ajustarZonas(); else img.onload = ajustarZonas
}
const cap = s => { s = String(s || ''); return s.charAt(0).toUpperCase() + s.slice(1) }
function st(m){ const s = $('keuSt'); if (s) s.textContent = m || '' }
function sel(i, sinPintar){
  S.sel = i
  document.querySelectorAll('#keuSc .keu__z').forEach(z => z.classList.toggle('on', +z.dataset.i === i))
  document.querySelectorAll('#keuSc .keu__ed').forEach((z, k) => z.classList.toggle('on', k === i))
  if (!sinPintar) { const row = document.querySelectorAll('#keuSc .keu__ed')[i]; if (row) row.scrollIntoView({ behavior: 'smooth', block: 'center' }) }
}
function comida(n){ S.num = +n; recalc(); pintar() }
function nombre(i, v){ if (!S.al[i]) return; S.al[i].nombre = String(v).slice(0, 60); S.al[i]._n = 1; if (!S.sucio) { S.sucio = true; pintarBotones() } }
function gramos(i, v){ if (!S.al[i]) return; S.al[i] = Object.assign(KE.regramar(S.al[i], v), { _n: S.al[i]._n }); recalc(); pintar() }
function quitar(i){ S.al.splice(i, 1); if (S.sel >= S.al.length) S.sel = 0; if (!S.al.length) { S.al.push({ nombre: '', gramos: 100, kcal: 0, proteina_g: 0, carbohidrato_g: 0, grasa_g: 0, grupo: 'otro', preparacion: 'otro', nova: 1, zona: null, _n: 1 }); S.sucio = true } recalc(); pintar() }
function agregar(){ S.al.push({ nombre: '', gramos: 100, kcal: 0, proteina_g: 0, carbohidrato_g: 0, grasa_g: 0, grupo: 'otro', preparacion: 'otro', nova: 1, zona: null, _n: 1 }); S.sucio = true; S.sel = S.al.length - 1; recalc(); pintar()
  const ins = document.querySelectorAll('#keuSc .keu__ed input[type=text]'); const x = ins[ins.length - 1]; if (x) x.focus() }
function botones(){ const c = comidaN(S.num)
  return (S.sucio ? '<button type="button" onclick="KEU.recalcular()">Recalcular con mis cambios<span>IA</span></button>' : '') +
    '<button type="button"' + (S.sucio || !c ? ' disabled' : '') + ' onclick="KEU.confirmar()">' + (c ? 'Confirmar y registrar ' + esc(c.nombre.toLowerCase()) : 'Elige la comida') + '<span>✓</span></button>' +
    '<button type="button" class="sec" onclick="KEU.otra()">Escanear otra foto<span>+</span></button><button type="button" class="sec" onclick="KEU.cerrar()">Descartar<span>✕</span></button>' }
// escribir un nombre no repinta la pantalla (no se pierde el foco): solo cambian los botones
function pintarBotones(){ const b = $('keuBt'); if (b) b.innerHTML = botones() }
async function recalcular(){
  if (S.busy) return
  const lista = S.al.filter(a => String(a.nombre).trim()).map(a => ({ nombre: String(a.nombre).trim(), gramos: Math.round(a.gramos) || 100 }))
  if (!lista.length) { st('Escribe al menos un alimento.'); return }
  S.busy = true; st('Recalculando…')
  try {
    const j = await api({ modo: 'recalcular', alimentos: lista })
    const prev = S.al.filter(a => String(a.nombre).trim())
    S.al = (j.alimentos || []).map((x, i) => Object.assign({}, x, { zona: (prev[i] && prev[i].zona) || null }))
    S.sucio = false; recalc(); pintar(); st('Listo: calorías y macros actualizados.')
  } catch (e) { st((e && e.msg) || 'No pudimos recalcular. Prueba de nuevo.') }
  finally { S.busy = false }
}
async function confirmar(){
  if (S.busy || S.sucio || !S.r || !S.num) return
  S.busy = true; st('Registrando…')
  try {
    const det = { plato: (S.r.deteccion && S.r.deteccion.plato) || '', confianza: S.r.deteccion && S.r.deteccion.confianza, editado: S.al.some(a => a._n), detectado: (S.r.resultado && S.r.resultado.alimentos || []).map(a => ({ nombre: a.nombre, gramos: a.gramos })) }
    const res = Object.assign({}, S.res, { comparacion: S.cmp && { items: S.cmp.items, faltan: S.cmp.faltan.map(f => f.rol), ajustes: S.cmp.ajustes.map(a => a.tipo) } })
    await S.cfg.confirmar(S.r.id, S.num, det, res)
    const c = comidaN(S.num), v = VER[S.res.veredicto] || VER.relativo
    $('keuSc').innerHTML = '<div class="keu__ok"><div class="keu__ic" style="--c:' + (S.res.cheat ? '#121212' : '#2F7D4F') + '"><svg viewBox="0 0 24 24">' + (S.res.cheat ? VER.alerta.ico : VER.adecuado.ico) + '</svg></div>' +
      '<b>' + esc(c ? cap(c.nombre.toLowerCase()) : 'Comida') + (S.res.cheat ? ' registrado como cheat meal' : ' registrado') + '</b><p>≈ ' + n0(S.res.totales.kcal) + ' kcal · P ' + n0(S.res.totales.proteina_g) + ' · C ' + n0(S.res.totales.carbohidrato_g) + ' · G ' + n0(S.res.totales.grasa_g) + ' g' +
      (S.res.cheat ? '<br>Sigue tu pauta en la próxima comida. No te la saltes.' : '') + '</p></div>' +
      '<div class="keu__bt"><button type="button" onclick="KEU.cerrar()">Volver a mi día<span>←</span></button></div>'
    titulo('REGISTRADO')
    if (S.cfg.onRegistrado) S.cfg.onRegistrado({ num: S.num, estado: S.res.cheat ? 'cheat' : 'cumplida' })
  } catch (e) { console.error('confirmar', e); st((e && (e.msg || e.message)) || 'No pudimos registrar. Prueba de nuevo.') }
  finally { S.busy = false }
}
function init(cfg){ S.cfg = Object.assign(S.cfg, cfg || {}); if (!S._rz) { S._rz = 1; window.addEventListener('resize', () => { if ($('keuO') && !$('keuO').hidden) ajustarZonas() }) } }
window.KEU = { init, abrir, elegir, cerrar, otra, sel, comida, nombre, gramos, quitar, agregar, recalcular, confirmar, _S: S }
})()
