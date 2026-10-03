/* KOACH · FOTO DE PERFIL (una sola fuente: profiles.avatar_path → bucket privado "avatares")
   Socio: su propia carpeta. Staff (coach/recepción/admin): puede cargar o corregir; queda trazado (trigger en la base).
   Flujo: elegir (selfie o galería) → recorte 1:1 → 768×768 WebP/JPEG en el teléfono → subir → actualizar perfil → borrar la anterior.
   El avatar visible solo cambia después de confirmar la persistencia. */
(function () {
  const BUCKET = 'avatares', LADO = 768, TTL = 6 * 3600;
  const cache = {}; // path -> { url, exp }

  function inicial(nombre) { return (String(nombre || '').trim()[0] || 'K').toUpperCase() }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])) }

  /* URLs firmadas en lote (bucket privado, sin URLs públicas) */
  async function urls(sb, paths) {
    const now = Date.now(), faltan = [...new Set((paths || []).filter(p => p && !(cache[p] && cache[p].exp > now + 60000)))]
    if (faltan.length) {
      try {
        const r = await sb.storage.from(BUCKET).createSignedUrls(faltan, TTL)
        ;(r.data || []).forEach(x => { if (x && x.signedUrl && x.path) cache[x.path] = { url: x.signedUrl, exp: now + TTL * 1000 } })
      } catch (e) { console.error('avatar urls', e) }
    }
    const out = {}; (paths || []).forEach(p => { if (p && cache[p]) out[p] = cache[p].url }); return out
  }
  function urlDe(path) { const c = path && cache[path]; return c && c.exp > Date.now() ? c.url : null }

  /* HTML del avatar: foto si existe, inicial si no (nunca imagen rota) */
  function html(path, nombre, cls) {
    const u = urlDe(path), k = cls || 'kav'
    return '<span class="' + k + '" data-ini="' + esc(inicial(nombre)) + '">' +
      (u ? '<img src="' + esc(u) + '" alt="" loading="lazy" onerror="this.parentNode.textContent=this.parentNode.dataset.ini">' : esc(inicial(nombre))) + '</span>'
  }

  /* Elegir archivo: selfie (cámara frontal) o galería */
  function elegir(modo) {
    return new Promise(res => {
      const i = document.createElement('input'); i.type = 'file'; i.accept = 'image/*'
      if (modo === 'selfie') i.setAttribute('capture', 'user')
      i.style.cssText = 'position:fixed;left:-9999px;opacity:0'
      i.onchange = () => { const f = i.files && i.files[0]; i.remove(); res(f || null) }
      i.addEventListener('cancel', () => { i.remove(); res(null) })
      document.body.appendChild(i); i.click()
    })
  }

  async function decodificar(file) {
    try { return await createImageBitmap(file, { imageOrientation: 'from-image' }) } catch (_) {}
    try { return await createImageBitmap(file) } catch (_) {}
    const im = new Image(); im.src = URL.createObjectURL(file); await im.decode(); return im
  }

  /* Recorte 1:1 simple: arrastrar + zoom. Devuelve Blob 768×768 o null si cancela */
  function recortar(file) {
    return new Promise(async (res) => {
      let img; try { img = await decodificar(file) } catch (e) { res(null); return }
      const W = img.width, H = img.height, V = 300
      const ov = document.createElement('div'); ov.className = 'kavCrop'
      ov.innerHTML = '<div class="kavCrop__b"><b class="kavCrop__t">AJUSTA TU FOTO</b>' +
        '<div class="kavCrop__v"><canvas width="600" height="600"></canvas></div>' +
        '<label class="kavCrop__z"><span>ZOOM</span><input type="range" min="1" max="3" step="0.01" value="1" aria-label="Zoom"></label>' +
        '<div class="kavCrop__a"><button type="button" data-k="no">CANCELAR</button><button type="button" data-k="ok" class="on">USAR FOTO</button></div></div>'
      document.body.appendChild(ov)
      const cv = ov.querySelector('canvas'), ctx = cv.getContext('2d'), zr = ov.querySelector('input')
      const base = Math.max(600 / W, 600 / H); let z = 1, cx = W / 2, cy = H / 2
      function limitar() { const s = base * z, hw = 300 / s, hh = 300 / s; cx = Math.min(Math.max(cx, hw), W - hw); cy = Math.min(Math.max(cy, hh), H - hh) }
      function pintar() { limitar(); const s = base * z; ctx.clearRect(0, 0, 600, 600); ctx.drawImage(img, 300 - cx * s, 300 - cy * s, W * s, H * s) }
      pintar()
      let drag = null
      cv.addEventListener('pointerdown', e => { drag = { x: e.clientX, y: e.clientY, cx, cy }; cv.setPointerCapture(e.pointerId) })
      cv.addEventListener('pointermove', e => { if (!drag) return; const k = (600 / cv.getBoundingClientRect().width) / (base * z); cx = drag.cx - (e.clientX - drag.x) * k; cy = drag.cy - (e.clientY - drag.y) * k; pintar() })
      cv.addEventListener('pointerup', () => { drag = null })
      zr.addEventListener('input', () => { z = +zr.value; pintar() })
      ov.addEventListener('click', async e => {
        const k = e.target && e.target.dataset && e.target.dataset.k; if (!k) return
        if (k === 'no') { ov.remove(); res(null); return }
        const out = document.createElement('canvas'); out.width = out.height = LADO
        const o = out.getContext('2d'), s = base * z * (LADO / 600)
        o.imageSmoothingQuality = 'high'; o.drawImage(img, LADO / 2 - cx * s, LADO / 2 - cy * s, W * s, H * s)
        let blob = await new Promise(r => out.toBlob(r, 'image/webp', 0.85))
        if (!blob || blob.type !== 'image/webp') blob = await new Promise(r => out.toBlob(r, 'image/jpeg', 0.86))
        ov.remove(); res(blob)
      })
    })
  }

  /* Subir y asociar al socio (por id). Rollback si falla la actualización del perfil. */
  async function guardar(sb, socioId, blob, pathAnterior) {
    const ext = blob.type === 'image/webp' ? 'webp' : 'jpg'
    const path = socioId + '/' + Date.now() + '.' + ext
    const up = await sb.storage.from(BUCKET).upload(path, blob, { contentType: blob.type, upsert: false, cacheControl: '3600' })
    if (up.error) throw up.error
    const r = await sb.from('profiles').update({ avatar_path: path }).eq('id', socioId).select('avatar_path').maybeSingle()
    if (r.error || !r.data || r.data.avatar_path !== path) {
      try { await sb.storage.from(BUCKET).remove([path]) } catch (_) {}
      throw (r.error || new Error('perfil no actualizado'))
    }
    if (pathAnterior && pathAnterior !== path) { try { await sb.storage.from(BUCKET).remove([pathAnterior]) } catch (_) {} delete cache[pathAnterior] }
    await urls(sb, [path])
    return path
  }
  async function eliminar(sb, socioId, pathAnterior) {
    const r = await sb.from('profiles').update({ avatar_path: null }).eq('id', socioId).select('id').maybeSingle()
    if (r.error || !r.data) throw (r.error || new Error('perfil no actualizado'))
    if (pathAnterior) { try { await sb.storage.from(BUCKET).remove([pathAnterior]) } catch (_) {} delete cache[pathAnterior] }
  }

  /* Hoja de edición completa: TOMAR SELFIE / ELEGIR DE GALERÍA / ELIMINAR. onCambio(nuevoPath|null) tras persistir. */
  function editar(sb, socioId, pathActual, onCambio, opts) {
    const o = opts || {}
    const ov = document.createElement('div'); ov.className = 'kavSheet'
    ov.innerHTML = '<div class="kavSheet__b" role="dialog" aria-modal="true" aria-label="Editar foto">' +
      '<b class="kavSheet__t">' + esc(o.titulo || 'EDITAR FOTO') + '</b>' +
      '<button type="button" data-k="selfie">TOMAR SELFIE</button>' +
      '<button type="button" data-k="galeria">ELEGIR DE GALERÍA</button>' +
      (pathActual ? '<button type="button" data-k="borrar" class="sec">ELIMINAR FOTO</button>' : '') +
      '<button type="button" data-k="cerrar" class="sec">CANCELAR</button>' +
      '<p class="kavSheet__st" aria-live="polite"></p></div>'
    document.body.appendChild(ov)
    const st = ov.querySelector('.kavSheet__st'), btns = () => ov.querySelectorAll('button')
    const ocupado = v => btns().forEach(b => { b.disabled = v })
    let ultimo = null
    async function correr(k) {
      try {
        if (k === 'borrar') { ocupado(true); st.textContent = 'ELIMINANDO…'; await eliminar(sb, socioId, pathActual); st.textContent = 'FOTO ELIMINADA ✓'; onCambio && onCambio(null); setTimeout(() => ov.remove(), 700); return }
        const f = await elegir(k === 'selfie' ? 'selfie' : 'galeria'); if (!f) return
        const blob = await recortar(f); if (!blob) return
        ultimo = blob; ocupado(true); st.textContent = 'SUBIENDO FOTO…'
        const p = await guardar(sb, socioId, blob, pathActual)
        st.textContent = 'GUARDADA ✓'; onCambio && onCambio(p); setTimeout(() => ov.remove(), 700)
      } catch (e) {
        console.error('avatar', e); ocupado(false)
        st.innerHTML = 'NO PUDIMOS GUARDAR LA FOTO. ' + (ultimo ? '<button type="button" data-k="reintentar" class="sec">REINTENTAR</button>' : '')
      }
    }
    ov.addEventListener('click', e => {
      const k = e.target && e.target.dataset && e.target.dataset.k
      if (e.target === ov || k === 'cerrar') { ov.remove(); return }
      if (k === 'reintentar' && ultimo) { (async () => { try { ocupado(true); st.textContent = 'SUBIENDO FOTO…'; const p = await guardar(sb, socioId, ultimo, pathActual); st.textContent = 'GUARDADA ✓'; onCambio && onCambio(p); setTimeout(() => ov.remove(), 700) } catch (er) { ocupado(false); st.textContent = 'NO PUDIMOS GUARDAR LA FOTO. Revisa tu conexión.' } })(); return }
      if (k) correr(k)
    })
  }

  /* Estilos compartidos (una sola vez) */
  const css = document.createElement('style')
  css.textContent = '.kav{display:inline-flex;align-items:center;justify-content:center;border-radius:50%;overflow:hidden;background:#2A2B2E;color:#F4F3F0;font-weight:700;flex-shrink:0}' +
    '.kav img{width:100%;height:100%;object-fit:cover;display:block}' +
    '.kavSheet{position:fixed;inset:0;z-index:2000;background:rgba(0,0,0,.55);display:flex;align-items:flex-end;justify-content:center}' +
    '.kavSheet__b{width:100%;max-width:460px;background:#121212;color:#F4F3F0;border-radius:24px 24px 0 0;padding:20px 18px calc(22px + env(safe-area-inset-bottom,0px));display:flex;flex-direction:column;gap:8px}' +
    '.kavSheet__t{font:500 11px/1 "IBM Plex Mono",monospace;letter-spacing:.16em;color:#A7A9AE;margin:4px 2px 8px}' +
    '.kavSheet__b button{min-height:52px;border-radius:16px;border:0;background:#F4F3F0;color:#121212;font:500 11px/1 "IBM Plex Mono",monospace;letter-spacing:.12em;cursor:pointer}' +
    '.kavSheet__b button.sec{background:transparent;color:#F4F3F0;border:1px solid rgba(255,255,255,.22)}' +
    '.kavSheet__b button:disabled{opacity:.45}' +
    '.kavSheet__st{min-height:18px;margin:6px 2px 0;font:500 11px/1.5 "IBM Plex Mono",monospace;letter-spacing:.1em;color:#A7A9AE}' +
    '.kavSheet__st button{min-height:40px;margin-left:6px;padding:0 14px}' +
    '.kavCrop{position:fixed;inset:0;z-index:2100;background:#0B0B0B;display:flex;align-items:center;justify-content:center;padding:20px}' +
    '.kavCrop__b{width:100%;max-width:400px;display:flex;flex-direction:column;gap:16px;color:#F4F3F0}' +
    '.kavCrop__t{font:500 11px/1 "IBM Plex Mono",monospace;letter-spacing:.16em;color:#A7A9AE}' +
    '.kavCrop__v{width:100%;aspect-ratio:1/1;border-radius:50%;overflow:hidden;background:#1E1F22;touch-action:none}' +
    '.kavCrop__v canvas{width:100%;height:100%;display:block;cursor:grab}' +
    '.kavCrop__z{display:flex;align-items:center;gap:12px;font:500 10px/1 "IBM Plex Mono",monospace;letter-spacing:.14em;color:#A7A9AE}.kavCrop__z input{flex:1;accent-color:#F4F3F0}' +
    '.kavCrop__a{display:grid;grid-template-columns:1fr 1fr;gap:8px}.kavCrop__a button{min-height:52px;border-radius:16px;border:1px solid rgba(255,255,255,.22);background:transparent;color:#F4F3F0;font:500 11px/1 "IBM Plex Mono",monospace;letter-spacing:.12em;cursor:pointer}' +
    '.kavCrop__a button.on{background:#F4F3F0;color:#121212;border-color:#F4F3F0}'
  document.head.appendChild(css)

  window.KAvatar = { urls, urlDe, html, editar, inicial, recortar }
})()
