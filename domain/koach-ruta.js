/* KOACH · Ruta de carrera (Run Club) — cálculo puro sobre puntos GPS.
   Entrada: puntos {lat, lng, t (ms), acc (m, precisión del GPS)} en orden de llegada.
   Salida: distancia real, tiempo, tiempo en movimiento, ritmo, ruta comprimida (polyline) y si cuenta como carrera válida.
   Limpieza: descarta lecturas imprecisas, saltos imposibles y el "temblor" del GPS cuando el socio está quieto. */
(function (root, f) { if (typeof module === 'object' && module.exports) module.exports = f(); else root.KRuta = f() })(this, function () {
  'use strict'
  const VERSION = 'koach-ruta@1.0.0'
  const CFG = {
    precisionMax: 35,     // m: lecturas con peor precisión se descartan
    pasoMin: 4,           // m: piso del umbral de temblor (el umbral real es la precisión del punto, hasta 20 m)
    velMax: 8,            // m/s (28,8 km/h): saltos más rápidos son errores
    pausaVel: 0.6,        // m/s: bajo esto se considera detenido (no suma tiempo en movimiento)
    validaDistMin: 300,   // m: mínimo para marcar la carrera como hecha
    validaTiempoMin: 180, // s
  }
  const R = 6371008.8
  const rad = (d) => d * Math.PI / 180
  function distancia(a, b) {
    const dLat = rad(b.lat - a.lat), dLng = rad(b.lng - a.lng)
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2
    return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)))
  }

  function limpiar(puntos, cfg) {
    cfg = Object.assign({}, CFG, cfg)
    const out = []
    for (const p of puntos || []) {
      if (!p || !isFinite(p.lat) || !isFinite(p.lng) || !isFinite(p.t)) continue
      if (p.acc != null && p.acc > cfg.precisionMax) continue
      const u = out[out.length - 1]
      if (!u) { out.push(p); continue }
      if (p.t <= u.t) continue
      const d = distancia(u, p), dt = (p.t - u.t) / 1000
      if (d / dt > cfg.velMax) continue      // salto imposible
      const umbral = Math.max(cfg.pasoMin, Math.min(p.acc != null ? p.acc : 0, 20))
      if (d < umbral) continue               // temblor: se espera a que se aleje más que el error del GPS
      out.push(p)
    }
    return out
  }

  // Google Encoded Polyline (precisión 1e-5): ~5 bytes por punto, cabe en una columna text
  function polyline(pts) {
    let lat0 = 0, lng0 = 0, s = ''
    const enc = (v) => { v = v < 0 ? ~(v << 1) : v << 1; let r = ''; while (v >= 0x20) { r += String.fromCharCode((0x20 | (v & 0x1f)) + 63); v >>= 5 } return r + String.fromCharCode(v + 63) }
    for (const p of pts) { const la = Math.round(p.lat * 1e5), ln = Math.round(p.lng * 1e5); s += enc(la - lat0) + enc(ln - lng0); lat0 = la; lng0 = ln }
    return s
  }

  function resumen(puntos, opt) {
    const cfg = Object.assign({}, CFG, opt)
    const pts = limpiar(puntos, cfg)
    let dist = 0, mov = 0
    for (let i = 1; i < pts.length; i++) {
      const d = distancia(pts[i - 1], pts[i]), dt = (pts[i].t - pts[i - 1].t) / 1000
      dist += d
      if (d / dt >= cfg.pausaVel) mov += dt
    }
    const crudos = (puntos || []).filter((p) => p && isFinite(p.t))
    const total = crudos.length > 1 ? (crudos[crudos.length - 1].t - crudos[0].t) / 1000 : 0
    const km = dist / 1000
    const ritmo = km >= 0.1 && mov > 0 ? (mov / 60) / km : null   // min/km sobre tiempo en movimiento
    const valida = dist >= cfg.validaDistMin && total >= cfg.validaTiempoMin
    return {
      version: VERSION,
      distancia_m: Math.round(dist),
      km: Math.round(km * 100) / 100,
      duracion_s: Math.round(total),
      movimiento_s: Math.round(mov),
      ritmo_min_km: ritmo == null ? null : Math.round(ritmo * 100) / 100,
      ritmo_txt: ritmo == null ? null : (() => { const s = Math.round(ritmo * 60); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0') + ' /KM' })(),
      puntos: pts.length,
      descartados: crudos.length - pts.length,
      ruta: polyline(pts),
      valida,
      motivo: valida ? null : dist < cfg.validaDistMin ? 'DISTANCIA_CORTA' : 'TIEMPO_CORTO',
    }
  }

  return { VERSION, CFG, distancia, limpiar, polyline, resumen }
})
