/* KOACH · COMPARTIR MI COMIDA (window.KESH) · historias 1080×1920 para Instagram, copia del sistema de las fotos de entrenamiento
   (zona segura, logotipo, pills, ticket de cristal con código, señaladores y escáner), adaptado a comida. Los filtros son propios de comida: color vivo, no los B/N dramáticos de entrenamiento.
   Regla: la tarjeta muestra kcal, macros y la comida del plan (COMIDA 2/5 · ALMUERZO). NUNCA nombres de alimentos ni datos de salud.
   Solo se abre con un registro válido hecho con foto real (no errores, no pantallas/internet). La foto vive en memoria: no se sube ni se guarda.
   KESH.abrir({ foto: canvas|bitmap, al: [{grupo, kcal, proteina_g, carbohidrato_g, grasa_g, zona:[y0,x0,y1,x1] 0-1000}], tot: {kcal, proteina_g, carbohidrato_g, grasa_g},
                num, n, comida, estado: 'plan'|'completada'|'registrada', fecha }) */
(function(){
'use strict'
const W = 1080, H = 1920, ST = 250, SB = 250, SX = 110, B = '#FFFFFF', G = '#C9CDD3'
const DISP = "'Inter Display', Inter, Arial, sans-serif", MONO = "'IBM Plex Mono', monospace"
const PLANT = [['mapa', 'MAPA'], ['ticket', 'TICKET'], ['scan', 'ESCÁNER'], ['editorial', 'EDITORIAL'], ['dia', 'DÍA']]
const FILT = [['vivo', 'VIVO'], ['calido', 'CÁLIDO'], ['fresco', 'FRESCO'], ['natural', 'NATURAL']]
const ROL = { proteina: ['PROTEÍNA', 'proteina_g'], legumbre: ['PROTEÍNA', 'proteina_g'], lacteo: ['PROTEÍNA', 'proteina_g'], carbohidrato: ['CARBOS', 'carbohidrato_g'], fruta: ['CARBOS', 'carbohidrato_g'], grasa: ['GRASAS', 'grasa_g'], verdura: ['VERDURAS', 'kcal'] }
const EST = { plan: 'EN TU PLAN', completada: 'COMPLETADA', registrada: 'REGISTRADA' }
const K = { d: null, plant: 'mapa', filt: 'vivo', cache: {}, logo: null, fondo: null }
const $ = id => document.getElementById(id)
const n0 = v => Math.round(+v || 0).toLocaleString('es-CL')

// ── Foto: recorte 9:16 centrado en el plato (unión de las zonas) y filtros KOACH hechos a mano (Safari no tiene ctx.filter)
function encuadre(){
  const f = K.d.foto, fw = f.width, fh = f.height, s = Math.max(W / fw, H / fh)
  const zs = K.d.al.map(a => a.zona).filter(Boolean)
  let cx = fw / 2, cy = fh / 2
  if (zs.length) { const x0 = Math.min(...zs.map(z => z[1])), x1 = Math.max(...zs.map(z => z[3])), y0 = Math.min(...zs.map(z => z[0])), y1 = Math.max(...zs.map(z => z[2])); cx = (x0 + x1) / 2000 * fw; cy = (y0 + y1) / 2000 * fh }
  // foto horizontal (lo normal en un plato): completa a todo el ancho sobre su propio fondo desenfocado, así no se corta el plato
  if (fw / fh > .8) { const k = W * 1.12 / fw, h = fh * k, ox = Math.min(0, Math.max(W - fw * k, W / 2 - cx * k)); return { s: k, ox, oy: Math.round(Math.min(H - SB - 520 - h, Math.max(ST + 90, H * .42 - h / 2))), fw, fh, fit: true } }
  const ox = Math.min(0, Math.max(W - fw * s, W / 2 - cx * s)), oy = Math.min(0, Math.max(H - fh * s, H * .46 - cy * s))
  return { s, ox, oy, fw, fh }
}
// zona de un alimento → caja en la tarjeta (null si quedó fuera del recorte)
function caja(a){
  if (!a.zona) return null; const e = K.enc, [y0, x0, y1, x1] = a.zona
  const r = { x: e.ox + x0 / 1000 * e.fw * e.s, y: e.oy + y0 / 1000 * e.fh * e.s, w: (x1 - x0) / 1000 * e.fw * e.s, h: (y1 - y0) / 1000 * e.fh * e.s }
  const cx = r.x + r.w / 2, cy = r.y + r.h / 2
  if (cx < 60 || cx > W - 60 || cy < ST || cy > H - SB) return null
  return Object.assign(r, { cx, cy })
}
function base(){
  const k = K.filt; if (K.cache[k]) return K.cache[k]
  const c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d', { willReadFrequently: true }), e = K.enc
  x.fillStyle = '#121212'; x.fillRect(0, 0, W, H); x.imageSmoothingQuality = 'high'
  if (e.fit) {   // fondo: la misma foto a sangre, muy desenfocada y oscurecida
    const sc = Math.max(W / e.fw, H / e.fh), a = document.createElement('canvas'); a.width = 54; a.height = 96; const ax = a.getContext('2d'); ax.imageSmoothingQuality = 'high'
    ax.drawImage(K.d.foto, (W - e.fw * sc) / 2 / 20, (H - e.fh * sc) / 2 / 20, e.fw * sc / 20, e.fh * sc / 20)
    x.drawImage(a, -40, -40, W + 80, H + 80); x.fillStyle = 'rgba(12,13,15,.32)'; x.fillRect(0, 0, W, H) }
  x.drawImage(K.d.foto, e.ox, e.oy, e.fw * e.s, e.fh * e.s)
  color(x, FC[k] || FC.natural)
  K.cache[k] = c; return c
}
/* Filtros de COMIDA (distintos a los de entrenamiento): color vivo que resalta los tonos del plato.
   vib = intensidad que sube más los colores apagados que los ya intensos (no quema la piel de un tomate) · sat = saturación pareja
   wb = balance de blancos por canal · con = contraste en curva S suave · luz = brillo · som = levanta sombras (el plato no se hunde) · vig = viñeta */
const FC = {
  vivo:    { vib: .70, sat: 1.14, wb: [1.03, 1, .97], con: .20, luz: 4, som: .10, vig: .18 },
  calido:  { vib: .40, sat: 1.08, wb: [1.10, 1.02, .86], con: .16, luz: 2, som: .12, vig: .24 },
  fresco:  { vib: .50, sat: 1.06, wb: [.96, 1.02, 1.05], con: .10, luz: 12, som: .14, vig: .08 },
  natural: { vib: .12, sat: 1.0, wb: [1, 1, 1], con: .06, luz: 2, som: .04, vig: 0 }
}
function color(x, o){
  const C = new Float32Array(256)
  for (let v = 0; v < 256; v++) { let t = v / 255; t = t + o.som * (1 - t) * Math.pow(1 - t, 2) * 1.6   // sombras arriba
    t = t + o.con * (t - .5) * (1 - Math.abs(2 * t - 1)) * 2                                           // curva S suave
    C[v] = Math.max(0, Math.min(255, t * 255 + o.luz)) }
  const px = x.getImageData(0, 0, W, H), d = px.data
  for (let i = 0; i < d.length; i += 4) {
    let r = d[i] * o.wb[0], g = d[i + 1] * o.wb[1], b = d[i + 2] * o.wb[2]
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b), sat = mx > 0 ? (mx - mn) / mx : 0, l = .299 * r + .587 * g + .114 * b
    const k = o.sat * (1 + o.vib * (1 - sat))
    r = l + (r - l) * k; g = l + (g - l) * k; b = l + (b - l) * k
    d[i] = C[r < 0 ? 0 : r > 255 ? 255 : r | 0]; d[i + 1] = C[g < 0 ? 0 : g > 255 ? 255 : g | 0]; d[i + 2] = C[b < 0 ? 0 : b > 255 ? 255 : b | 0] }
  x.putImageData(px, 0, 0)
  if (o.vig) { const v = x.createRadialGradient(W / 2, H * .45, H * .3, W / 2, H * .45, H * .8); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,' + o.vig + ')'); x.fillStyle = v; x.fillRect(0, 0, W, H) }
}
// ── Piezas de dibujo (las mismas de las tarjetas de entrenamiento)
function logo(color){
  const key = 'l' + color; if (K[key]) return K[key].ok ? K[key].c : null
  const im = new Image(); K[key] = { ok: false }
  im.onload = () => { const c = document.createElement('canvas'); c.width = im.width; c.height = im.height; const x = c.getContext('2d'); x.drawImage(im, 0, 0); x.globalCompositeOperation = 'source-in'; x.fillStyle = color; x.fillRect(0, 0, c.width, c.height); K[key] = { ok: true, c }; pintar() }
  im.src = '/img/brand/logotipo-koach.png'; return null
}
function dibLogo(ctx, x, y, h, color, centro){ const lg = logo(color || B); if (!lg) return; const w = lg.width * h / lg.height; ctx.drawImage(lg, centro ? (W - w) / 2 : x, y, w, h) }
function txt(ctx, s, x, y, w, size, fam, track, color, align){
  ctx.font = w + ' ' + size + 'px ' + (fam === 'mono' ? MONO : DISP); if ('letterSpacing' in ctx) ctx.letterSpacing = (track || 0) + 'px'
  ctx.fillStyle = color; ctx.textAlign = align || 'left'; ctx.textBaseline = 'alphabetic'; ctx.fillText(s, x, y)
  const m = ctx.measureText(s).width; if ('letterSpacing' in ctx) ctx.letterSpacing = '0px'; return m
}
function rr(ctx, x, y, w, h, r){ ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(x, y, w, h, r); else ctx.rect(x, y, w, h) }
function pills(ctx, list, x, y, maxW, o){
  ctx.font = '500 ' + o.size + 'px ' + MONO; if ('letterSpacing' in ctx) ctx.letterSpacing = o.track + 'px'
  let cx = x, cy = y; const h = o.h, gap = o.gap
  list.forEach(t => { const w = ctx.measureText(t).width + o.px * 2; if (cx + w > x + maxW && cx > x) { cx = x; cy += h + gap }
    rr(ctx, cx, cy, w, h, h / 2); if (o.fill) { ctx.fillStyle = o.fill; ctx.fill() } if (o.stroke) { ctx.lineWidth = o.lw; ctx.strokeStyle = o.stroke; ctx.stroke() }
    ctx.fillStyle = o.color; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillText(t, cx + o.px, cy + h / 2 + 1); cx += w + gap })
  if ('letterSpacing' in ctx) ctx.letterSpacing = '0px'; ctx.textBaseline = 'alphabetic'; return cy + h - y
}
function barras(ctx, x, y, w, h, color, seed){
  let hs = 0; for (const c of String(seed)) hs = (hs * 31 + c.charCodeAt(0)) >>> 0; ctx.fillStyle = color; let cx = x
  while (cx < x + w) { hs = (hs * 1103515245 + 12345) >>> 0; const bw = 3 + (hs >>> 16) % 3 * 3; if (cx + bw > x + w) break; ctx.fillRect(cx, y, bw, h); hs = (hs * 1103515245 + 12345) >>> 0; cx += bw + 3 + (hs >>> 16) % 2 * 3 }
}
function velo(ctx, stops){ const g = ctx.createLinearGradient(0, 0, 0, H); stops.forEach(([p, a]) => g.addColorStop(p, 'rgba(18,18,18,' + a + ')')); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H) }
const sombra = (ctx, b) => { ctx.shadowColor = 'rgba(0,0,0,.4)'; ctx.shadowBlur = b || 16 }
// ── Datos de la tarjeta: solo kcal, macros y comida del plan
function datos(){
  const d = K.d, t = d.tot || {}, f = d.fecha ? new Date(d.fecha + 'T12:00:00') : new Date()
  const roles = [...new Set(d.al.map(a => ROL[a.grupo] && ROL[a.grupo][0]).filter(Boolean))]
  const orden = ['PROTEÍNA', 'CARBOS', 'VERDURAS', 'GRASAS']; roles.sort((a, b) => orden.indexOf(a) - orden.indexOf(b))
  return { kcal: n0(t.kcal), p: n0(t.proteina_g), c: n0(t.carbohidrato_g), g: n0(t.grasa_g), roles: roles.length ? roles : ['COMIDA'],
    cn: 'COMIDA ' + d.num + '/' + d.n, nombre: String(d.comida || 'Comida').toLowerCase().replace(/(^|\s)\S/g, c => c.toUpperCase()), est: EST[d.estado] || 'COMPLETADA',
    dia: ['DOMINGO', 'LUNES', 'MARTES', 'MIÉRCOLES', 'JUEVES', 'VIERNES', 'SÁBADO'][f.getDay()],
    cod: String(f.getFullYear()).slice(2) + String(f.getMonth() + 1).padStart(2, '0') + String(f.getDate()).padStart(2, '0') + '-' + d.num }
}
// señaladores: hasta 4 alimentos con más kcal que quedaron dentro del recorte (rol + su macro, nunca el nombre)
function puntos(){
  return K.d.al.map(a => ({ a, c: caja(a), r: ROL[a.grupo] })).filter(x => x.c && x.r).sort((x, y) => (y.a.kcal || 0) - (x.a.kcal || 0)).slice(0, 4)
    .map(x => ({ x: x.c.cx, y: x.c.cy, c: x.c, lab: x.r[0], val: x.r[1] === 'kcal' ? n0(x.a.kcal) + ' KCAL' : n0(x.a[x.r[1]]) + ' G' }))
}

// 1 · MAPA: señaladores sobre el plato + kcal grandes al pie
function mapa(ctx){
  const d = datos(); ctx.drawImage(base(), 0, 0); velo(ctx, [[0, .45], [.18, 0], [.6, 0], [1, .88]])
  ctx.save(); sombra(ctx, 18); dibLogo(ctx, SX, ST - 60, 39); ctx.restore()
  const pts = puntos(), cols = { i: [], d: [] }; pts.forEach(p => cols[p.x < W / 2 ? 'i' : 'd'].push(p))
  ;['i', 'd'].forEach(l => { const c = cols[l].sort((a, b) => a.y - b.y); let ult = -1e9
    c.forEach(p => { const cerca = l === 'd' ? W - SX - p.x < 320 : p.x - SX < 320; p.ly = Math.min(Math.max(p.y - (cerca ? 190 : 40), ult + 170, ST + 110), H - SB - 470); ult = p.ly })
    c.forEach(p => {
      const lx = l === 'i' ? SX : W - SX, ctx2 = ctx
      ctx2.save(); sombra(ctx2, 10); ctx2.strokeStyle = 'rgba(255,255,255,.85)'; ctx2.lineWidth = 3
      // la línea va del punto al borde más cercano del bloque etiqueta + valor
      const bw = 230, bx0 = l === 'i' ? lx : lx - bw, by0 = p.ly, by1 = p.ly + 122, ex = Math.max(bx0, Math.min(bx0 + bw, p.x)), ey = Math.max(by0, Math.min(by1, p.y))
      const dx = p.x - ex, dy = p.y - ey; if (Math.hypot(dx, dy) > 40) { ctx2.beginPath(); ctx2.moveTo(p.x - dx / Math.hypot(dx, dy) * 26, p.y - dy / Math.hypot(dx, dy) * 26); ctx2.lineTo(ex + Math.sign(dx) * 10, ey + Math.sign(dy) * 10); ctx2.stroke() }
      ctx2.fillStyle = B; ctx2.beginPath(); ctx2.arc(p.x, p.y, 13, 0, Math.PI * 2); ctx2.fill(); ctx2.lineWidth = 4; ctx2.beginPath(); ctx2.arc(p.x, p.y, 26, 0, Math.PI * 2); ctx2.stroke(); ctx2.restore()
      ctx.font = '500 22px ' + MONO; if ('letterSpacing' in ctx) ctx.letterSpacing = '3px'; const tw = ctx.measureText(p.lab).width + 40; if ('letterSpacing' in ctx) ctx.letterSpacing = '0px'
      const px = l === 'i' ? lx : lx - tw
      ctx.save(); rr(ctx, px, p.ly, tw, 52, 26); ctx.fillStyle = B; ctx.fill(); ctx.restore()
      txt(ctx, p.lab, px + 20, p.ly + 35, 500, 22, 'mono', 3, '#121212')
      ctx.save(); sombra(ctx, 14); txt(ctx, p.val, l === 'i' ? lx : lx, p.ly + 52 + 58, 700, 52, 'disp', -1, B, l === 'i' ? 'left' : 'right'); ctx.restore() }) })
  // pie: kcal a la izquierda, comida del plan a la derecha
  const y = H - SB; ctx.save(); ctx.strokeStyle = 'rgba(255,255,255,.3)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(SX, y - 210); ctx.lineTo(W - SX, y - 210); ctx.stroke(); ctx.restore()
  txt(ctx, 'KCAL DE ESTA COMIDA', SX, y - 158, 500, 24, 'mono', 4, G)
  const wk = txt(ctx, d.kcal, SX - 4, y - 10, 700, 150, 'disp', -6, B); txt(ctx, 'KCAL', SX + wk + 10, y - 14, 500, 30, 'mono', 4, B)
  txt(ctx, d.nombre.toUpperCase(), W - SX, y - 52, 500, 24, 'mono', 4, B, 'right'); txt(ctx, d.cn + ' · ' + d.est, W - SX, y - 14, 500, 22, 'mono', 3.5, G, 'right')
}
// 2 · TICKET: foto a sangre + ticket de cristal con código
function ticket(ctx){
  const d = datos(); ctx.drawImage(base(), 0, 0); velo(ctx, [[0, .5], [.2, 0], [.62, 0], [1, .55]])
  ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.35)'; ctx.shadowBlur = 14; dibLogo(ctx, SX, ST - 60, 39); ctx.restore()
  const tx = SX, tw = W - 2 * SX, tp = 44, PO = { size: 20, track: 2.5, h: 58, gap: 10, px: 18 }
  const ph = pills(document.createElement('canvas').getContext('2d'), d.roles, 0, 0, tw - 2 * tp, Object.assign({ color: B }, PO))
  const tS = 76, th = tp + 24 + 22 + tS * .92 + 30 + ph + 36 + 30 + 62 + 46 + tp, ty = H - SB + 30 - th
  // cristal: la foto desenfocada debajo + velo gris + brillo de borde
  const bl = document.createElement('canvas'), sc = 18; bl.width = Math.ceil(tw / sc); bl.height = Math.ceil(th / sc); const bx = bl.getContext('2d')
  bx.imageSmoothingQuality = 'high'; bx.drawImage(ctx.canvas, tx, ty, tw, th, 0, 0, bl.width, bl.height)
  for (let n = 0; n < 2; n++) { bx.globalAlpha = .5; [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([a, b]) => bx.drawImage(bl, a, b)); bx.globalAlpha = 1 }
  ctx.save(); ctx.shadowColor = 'rgba(20,28,40,.22)'; ctx.shadowBlur = 60; ctx.shadowOffsetY = 24; rr(ctx, tx, ty, tw, th, 60); ctx.fillStyle = 'rgba(0,0,0,.01)'; ctx.fill(); ctx.restore()
  ctx.save(); rr(ctx, tx, ty, tw, th, 60); ctx.clip(); ctx.imageSmoothingQuality = 'high'; ctx.drawImage(bl, tx - 6, ty - 6, tw + 12, th + 12)
  const gv = ctx.createLinearGradient(tx, ty, tx + tw, ty + th); gv.addColorStop(0, 'rgba(158,160,164,.50)'); gv.addColorStop(.45, 'rgba(104,107,112,.42)'); gv.addColorStop(.65, 'rgba(74,76,80,.40)'); gv.addColorStop(1, 'rgba(150,152,157,.46)')
  ctx.fillStyle = gv; ctx.fillRect(tx, ty, tw, th)
  const br = ctx.createLinearGradient(tx, 0, tx + tw, 0); br.addColorStop(.18, 'rgba(255,255,255,0)'); br.addColorStop(.32, 'rgba(255,255,255,.14)'); br.addColorStop(.46, 'rgba(255,255,255,0)'); ctx.fillStyle = br; ctx.fillRect(tx, ty, tw, th); ctx.restore()
  ctx.save(); rr(ctx, tx, ty, tw, th, 60); ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(255,255,255,.5)'; ctx.stroke(); ctx.restore()
  const MU = 'rgba(255,255,255,.78)'; ctx.save(); ctx.shadowColor = 'rgba(20,28,40,.3)'; ctx.shadowBlur = 14
  let y = ty + tp + 24; const x0 = tx + tp, x1 = tx + tw - tp
  txt(ctx, d.cn + ' · ' + d.est, x0, y, 500, 21, 'mono', 4, MU)
  y += 22 + tS * .92; txt(ctx, d.nombre, x0, y, 700, tS, 'disp', -tS * .03, B)
  y += 30; pills(ctx, d.roles, x0, y, tw - 2 * tp, Object.assign({ stroke: 'rgba(255,255,255,.85)', lw: 3, color: B }, PO))
  y += ph + 36; ctx.save(); ctx.shadowBlur = 0; ctx.setLineDash([9, 9]); ctx.strokeStyle = 'rgba(255,255,255,.4)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x1, y); ctx.stroke(); ctx.restore()
  y += 30 + 58; txt(ctx, d.kcal + ' KCAL', x0, y, 700, 58, 'disp', -1.5, B)
  txt(ctx, 'P ' + d.p + ' · C ' + d.c + ' · G ' + d.g, x0, y + 44, 500, 20, 'mono', 3.5, MU)
  barras(ctx, x1 - 190, y - 54, 190, 62, B, 'C' + d.cod); txt(ctx, 'Nº ' + d.cod, x1, y + 44, 500, 20, 'mono', 3.5, B, 'right')
  ctx.restore()
}
// 3 · ESCÁNER: el plato detectado con esquinas, cada alimento marcado por su rol y una ficha de datos
function scan(ctx){
  const d = datos(); ctx.drawImage(base(), 0, 0); ctx.fillStyle = 'rgba(12,13,15,.28)'; ctx.fillRect(0, 0, W, H)
  ctx.save(); ctx.strokeStyle = 'rgba(255,255,255,.09)'; ctx.lineWidth = 2; for (let x = 60; x < W; x += 120) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke() } for (let y = 60; y < H; y += 120) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke() } ctx.restore()
  const cs = K.d.al.map(caja).filter(Boolean), cl = (v, a, b) => Math.max(a, Math.min(b, v))
  let bx = cs.length ? { x: Math.min(...cs.map(c => c.x)) - 40, y: Math.min(...cs.map(c => c.y)) - 40, x1: Math.max(...cs.map(c => c.x + c.w)) + 40, y1: Math.max(...cs.map(c => c.y + c.h)) + 40 } : { x: W * .14, y: H * .3, x1: W * .86, y1: H * .62 }
  bx = { x: cl(bx.x, 40, W - 300), y: cl(bx.y, ST + 40, H - 700), x1: cl(bx.x1, bx.x + 260, W - 40), y1: cl(bx.y1, bx.y + 300, H - SB - 420) }
  ctx.save(); ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.lineWidth = 2; ctx.strokeRect(bx.x, bx.y, bx.x1 - bx.x, bx.y1 - bx.y)
  ctx.strokeStyle = B; ctx.lineWidth = 6; ctx.lineCap = 'square'; const L = 64
  ;[[bx.x, bx.y, 1, 1], [bx.x1, bx.y, -1, 1], [bx.x, bx.y1, 1, -1], [bx.x1, bx.y1, -1, -1]].forEach(([x, y, sx, sy]) => { ctx.beginPath(); ctx.moveTo(x, y + sy * L); ctx.lineTo(x, y); ctx.lineTo(x + sx * L, y); ctx.stroke() })
  ctx.restore()
  // cada alimento: caja fina + etiqueta de rol (nunca el nombre)
  puntos().forEach(p => { const c = p.c; ctx.save(); ctx.strokeStyle = 'rgba(255,255,255,.75)'; ctx.lineWidth = 2.5; ctx.setLineDash([12, 10]); rr(ctx, c.x, c.y, c.w, c.h, 18); ctx.stroke(); ctx.setLineDash([])
    ctx.fillStyle = B; ctx.beginPath(); ctx.arc(c.cx, c.cy, 9, 0, Math.PI * 2); ctx.fill(); ctx.restore()
    ctx.font = '500 20px ' + MONO; if ('letterSpacing' in ctx) ctx.letterSpacing = '3px'; const tw = ctx.measureText(p.lab).width + 32; if ('letterSpacing' in ctx) ctx.letterSpacing = '0px'
    const lx = cl(c.x + 8, 20, W - tw - 20), ly = cl(c.y - 54, ST, H - SB); ctx.fillStyle = 'rgba(18,18,18,.82)'; rr(ctx, lx, ly, tw, 44, 6); ctx.fill(); txt(ctx, p.lab, lx + 16, ly + 30, 500, 20, 'mono', 3, B) })
  // ficha de datos al pie (dentro de la zona segura)
  const fw = W - 2 * SX, fh = 360, fx = SX, fy = H - SB - fh + 20
  ctx.save(); ctx.fillStyle = 'rgba(18,18,18,.78)'; rr(ctx, fx, fy, fw, fh, 8); ctx.fill(); ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.lineWidth = 2; ctx.stroke(); ctx.restore()
  ctx.fillStyle = B; ctx.fillRect(fx, fy, fw, 58); txt(ctx, 'PERFIL DE COMIDA', fx + 28, fy + 39, 600, 22, 'mono', 4, '#121212'); txt(ctx, d.cn, fx + fw - 28, fy + 39, 600, 22, 'mono', 4, '#121212', 'right')
  txt(ctx, d.nombre.toUpperCase() + ' · ' + d.est, fx + 28, fy + 112, 500, 22, 'mono', 3.5, G)
  const wk = txt(ctx, d.kcal, fx + 24, fy + 222, 700, 104, 'disp', -3, B); txt(ctx, 'KCAL', fx + 30 + wk + 8, fy + 222, 500, 26, 'mono', 4, B)
  ;[['PROTEÍNA', d.p], ['CARBOS', d.c], ['GRASAS', d.g]].forEach(([l, v], i) => { const yy = fy + 150 + i * 62; txt(ctx, '• ' + l, fx + fw - 300, yy, 500, 20, 'mono', 3, G); txt(ctx, v + ' G', fx + fw - 28, yy, 600, 30, 'mono', 0, B, 'right') })
  txt(ctx, 'SOCIO KOACH · PLAN NUTRICIONAL', fx + 28, fy + fh - 34, 500, 18, 'mono', 3.5, 'rgba(255,255,255,.6)')
  ctx.save(); sombra(ctx, 14); dibLogo(ctx, SX, ST - 60, 39); ctx.restore()
}
// 4 · EDITORIAL: foto a sangre, nombre de la comida, roles y tres datos en columnas
function editorial(ctx){
  const d = datos(); ctx.drawImage(base(), 0, 0); velo(ctx, [[0, .5], [.26, 0], [.38, 0], [.8, .85], [1, .92]])
  dibLogo(ctx, SX, ST - 60, 39)
  let y = H - SB; const cw = (W - 2 * SX) / 3
  ;[[d.kcal, 'KCAL'], [d.p + ' G', 'PROTEÍNA'], [d.cn.replace('COMIDA ', ''), 'COMIDA']].forEach(([v, l], i) => { const xc = SX + cw * i + cw / 2
    txt(ctx, l, xc, y, 500, 24, 'mono', 4, G, 'center'); txt(ctx, v, xc, y - 46, 700, 66, 'disp', -1.5, B, 'center')
    if (i) { ctx.save(); ctx.strokeStyle = 'rgba(255,255,255,.18)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(SX + cw * i, y - 100); ctx.lineTo(SX + cw * i, y + 8); ctx.stroke(); ctx.restore() } })
  y -= 46 + 66 + 36; ctx.save(); ctx.strokeStyle = 'rgba(255,255,255,.3)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(SX, y); ctx.lineTo(W - SX, y); ctx.stroke(); ctx.restore()
  const O = { size: 23, track: 2.5, h: 68, gap: 12, px: 22, color: B }, ph = pills(document.createElement('canvas').getContext('2d'), d.roles, 0, 0, W - 2 * SX, O)
  y -= 36 + ph; pills(ctx, d.roles, SX, y, W - 2 * SX, Object.assign({ stroke: 'rgba(255,255,255,.55)', lw: 3 }, O))
  const s = 156; y -= 40; txt(ctx, d.nombre, SX - 4, y, 700, s, 'disp', -s * .04, B); y -= s * .95
  txt(ctx, d.cn + ' · ' + d.est, SX, y - 6, 500, 27, 'mono', 5, G)
}
// 5 · DÍA: el día y las kcal al centro; comida del plan debajo; logo al pie
function dia(ctx){
  const d = datos(); ctx.drawImage(base(), 0, 0); velo(ctx, [[0, .4], [.2, 0], [.42, .14], [.6, .14], [.85, 0]])
  const kc = d.kcal + ' KCAL'; let s = 150; const F = (w, z) => w + ' ' + z + 'px ' + DISP
  ctx.font = F(900, s); if ('letterSpacing' in ctx) ctx.letterSpacing = '-4px'; while (ctx.measureText(kc).width > W - 2 * SX && s > 80) { s -= 4; ctx.font = F(900, s) }
  const bw = ctx.measureText(kc).width; if ('letterSpacing' in ctx) ctx.letterSpacing = '0px'
  const x0 = (W - bw) / 2, yc = H * .53
  ctx.save(); sombra(ctx, 18); ctx.fillStyle = B; ctx.textBaseline = 'alphabetic'
  ctx.font = F(800, Math.round(s * .58)); ctx.textAlign = 'center'; ctx.fillText(d.dia, W / 2, yc - s * .82)
  ctx.textAlign = 'left'; ctx.font = F(900, s); if ('letterSpacing' in ctx) ctx.letterSpacing = '-4px'; ctx.fillText(kc, x0, yc); if ('letterSpacing' in ctx) ctx.letterSpacing = '0px'
  const fs = Math.max(22, Math.round(s * .2)), y2 = yc + fs * 1.9; ctx.font = '700 ' + fs + 'px ' + MONO; if ('letterSpacing' in ctx) ctx.letterSpacing = '3px'
  ctx.fillText(d.cn, x0 + 4, y2); ctx.textAlign = 'right'; ctx.fillText(d.nombre.toUpperCase(), x0 + bw - 4, y2); if ('letterSpacing' in ctx) ctx.letterSpacing = '0px'
  ctx.restore(); ctx.save(); sombra(ctx, 14); dibLogo(ctx, 0, H - SB - 10, 39, B, true); ctx.restore()
}
const RENDER = { mapa, ticket, scan, editorial, dia }

// ── Interfaz: superficie Inmersiva (negro carbón), un CTA
const CSS = `
.kesh{--d:var(--font-display,'Inter Display',Inter,Arial,sans-serif);--m:var(--font-mono,'IBM Plex Mono',monospace);position:fixed;inset:0;z-index:9100;display:flex;flex-direction:column;background:#121212;color:#F4F3F0;font-family:var(--d)}
.kesh[hidden]{display:none}
.kesh *{box-sizing:border-box}
.kesh__top{position:relative;flex-shrink:0;height:calc(56px + env(safe-area-inset-top,0px));display:flex;align-items:center;justify-content:space-between;padding:env(safe-area-inset-top,0px) 12px 0}
.kesh__top button{display:flex;align-items:center;gap:6px;height:44px;padding:0 8px;border:0;background:none;color:inherit;font:500 10px var(--m);letter-spacing:.16em;cursor:pointer}
.kesh__top svg{width:16px;height:16px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
.kesh__top img{position:absolute;left:50%;top:calc(50% + env(safe-area-inset-top,0px)/2);transform:translate(-50%,-50%);width:88px;height:auto}
.kesh__bd{flex:1;min-height:0;display:flex;flex-direction:column;gap:10px;padding:4px 16px calc(14px + env(safe-area-inset-bottom,0px));max-width:520px;width:100%;margin:0 auto}
.kesh__st{flex:1 1 auto;min-height:0;display:flex;justify-content:center}
.kesh__st canvas{height:100%;max-width:100%;aspect-ratio:9/16;border-radius:18px;background:#1E1F22;object-fit:contain}
.kesh__row{display:flex;gap:6px;overflow-x:auto;scrollbar-width:none;flex:none;margin:0 -16px;padding:0 16px}
.kesh__row::-webkit-scrollbar{display:none}
.kesh__row span{flex:none;align-self:center;padding-right:4px;font:500 9px var(--m);letter-spacing:.14em;color:#A7A9AE}
.kesh__row button{flex:none;min-height:38px;padding:0 14px;border-radius:999px;border:1px solid rgba(255,255,255,.22);background:transparent;color:#A7A9AE;font:500 10px var(--m);letter-spacing:.12em;white-space:nowrap;cursor:pointer}
.kesh__row button[aria-pressed="true"]{background:#F4F3F0;border-color:#F4F3F0;color:#121212}
.kesh__ac{display:grid;grid-template-columns:1.7fr 1fr;gap:8px;flex:none}
.kesh__ac button{min-height:54px;border-radius:18px;border:1px solid rgba(255,255,255,.22);background:transparent;color:#F4F3F0;font:500 10px var(--m);letter-spacing:.14em;cursor:pointer}
.kesh__ac .cta{border:0;background:#F4F3F0;color:#121212;font:700 17px var(--d);letter-spacing:-.01em}
.kesh__ac button:disabled{opacity:.5}
.kesh__msg{min-height:14px;text-align:center;font:500 10px var(--m);letter-spacing:.1em;color:#A7A9AE;flex:none}
.kesh button:focus-visible{outline:2px solid #F4F3F0;outline-offset:2px}
`
function el(){
  let o = $('keshO'); if (o) return o
  const s = document.createElement('style'); s.textContent = CSS; document.head.appendChild(s)
  o = document.createElement('div'); o.id = 'keshO'; o.className = 'kesh'; o.hidden = true; o.setAttribute('role', 'dialog'); o.setAttribute('aria-modal', 'true'); o.setAttribute('aria-label', 'Compartir mi comida')
  o.innerHTML = '<div class="kesh__top"><button type="button" onclick="KESH.cerrar()"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 6l-6 6 6 6"/></svg>VOLVER</button><img src="/img/brand/logotipo-koach.png" alt="KOACH"><span></span></div>' +
    '<div class="kesh__bd"><div class="kesh__st"><canvas id="keshCv" width="' + W + '" height="' + H + '" role="img" aria-label="Vista previa de tu historia"></canvas></div>' +
    '<div class="kesh__row" role="group" aria-label="Plantilla"><span>PLANTILLA</span>' + PLANT.map(([k, t]) => '<button type="button" data-p="' + k + '" onclick="KESH.plantilla(\'' + k + '\')">' + t + '</button>').join('') + '</div>' +
    '<div class="kesh__row" role="group" aria-label="Filtro"><span>FILTRO</span>' + FILT.map(([k, t]) => '<button type="button" data-f="' + k + '" onclick="KESH.filtro(\'' + k + '\')">' + t + '</button>').join('') + '</div>' +
    '<div class="kesh__ac"><button type="button" class="cta" id="keshSh" onclick="KESH.compartir()">Compartir</button><button type="button" onclick="KESH.descargar()">DESCARGAR</button></div><div class="kesh__msg" id="keshM" role="status"></div></div>'
  document.body.appendChild(o); return o
}
function marcar(){ document.querySelectorAll('#keshO [data-p]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.p === K.plant))); document.querySelectorAll('#keshO [data-f]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.f === K.filt))) }
let raf = 0
function pintar(){ if (!K.d || raf) return; raf = requestAnimationFrame(() => { raf = 0; const cv = $('keshCv'); if (!cv) return; const ctx = cv.getContext('2d'); ctx.clearRect(0, 0, W, H); try { RENDER[K.plant](ctx) } catch (e) { console.error('kesh', e) } }) }
function abrir(d){
  if (!d || !d.foto) return
  K.d = d; K.cache = {}; K.enc = encuadre(); el().hidden = false; marcar(); msg(''); pintar()
}
function cerrar(){ const o = $('keshO'); if (o) o.hidden = true }
function plantilla(k){ if (!RENDER[k]) return; K.plant = k; marcar(); pintar() }
function filtro(k){ K.filt = k; marcar(); pintar() }
function msg(t){ const m = $('keshM'); if (m) m.textContent = t || '' }
const blob = () => new Promise(ok => $('keshCv').toBlob(ok, 'image/jpeg', .92))
const nombre = () => 'koach-comida-' + datos().cod + '.jpg'
async function compartir(){
  const b = await blob(); if (!b) return msg('No pudimos preparar la imagen.')
  const f = new File([b], nombre(), { type: 'image/jpeg' })
  if (navigator.canShare && navigator.canShare({ files: [f] })) { try { await navigator.share({ files: [f] }); msg('') } catch (e) { if (e && e.name !== 'AbortError') msg('No se pudo compartir. Descárgala y súbela a tu historia.') } }
  else { await descargar(); msg('Tu historia quedó descargada: súbela a Instagram.') }
}
async function descargar(){ const b = await blob(); if (!b) return; const u = URL.createObjectURL(b), a = document.createElement('a'); a.href = u; a.download = nombre(); document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(u), 4000) }
window.KESH = { abrir, cerrar, plantilla, filtro, compartir, descargar, _K: K, _render: (ctx, k) => RENDER[k](ctx), PLANT }
})()
