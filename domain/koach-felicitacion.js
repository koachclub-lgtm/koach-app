/* KOACH · Felicitación de cierre (Club del 1%) — pantalla de gratificación pura, no se comparte.
   Estructura fija:  FELICITACIONES, {NOMBRE}.  ·  Ya eres 1% más fuerte que ayer.  ·  {dato real}  ·  {frase aspiracional}
   Regla: el dato es SIEMPRE un hecho del socio (no se afirma nada que no haya pasado). Si falta el dato, se omite esa línea.
   Prioridad de contexto (gana el primero que aplica):
   PRIMERA > CICLO > VUELTA > NUEVA_CARGA > SEMANA > HITO > DIA_DIFICIL > CONSTANCIA > AVANCE
   Ciencia: celebrar justo después de la conducta (Fogg), premiar la vuelta tras faltar (Milkman), identidad (Clear),
   nunca mencionar una racha rota (Silverman & Barasch). */
(function (root, f) { if (typeof module === 'object' && module.exports) module.exports = f(); else root.KFelicitacion = f() })(this, function () {
  'use strict'
  const VERSION = 'koach-felicitacion@1.0.0'
  const FIRMA = 'Ya eres 1% más fuerte que ayer.'
  const HITOS = [10, 25, 50, 75, 100, 150, 200, 250, 300, 400, 500]
  const DIAS_VUELTA = 7

  // Frases aspiracionales: vocabulario ya usado en la app (titulares por programa). Matías puede reemplazarlas o sumar.
  const ASPIRA = {
    STRONG: ['Construyendo tu versión más fuerte.', 'La fuerza se entrena.', 'Cada set cuenta.', 'Más carga, misma técnica.', 'Hoy entrenaste para rendir mejor.'],
    BURN: ['Un paso más en tu proceso.', 'Hoy sumaste, no restaste.', 'Constancia es el método.', 'Cada sesión te acerca.'],
    HEALTHY: ['Fuerza para tu día a día.', 'Moverte mejor empieza aquí.', 'Hoy ganaste movilidad y fuerza.', 'Un cuerpo que responde.'],
  }

  const n0 = (v) => (typeof v === 'number' && isFinite(v) ? v : null)
  const plural = (n, s, p) => n + ' ' + (n === 1 ? s : p)
  const kg = (v) => String(Math.round(v * 10) / 10).replace('.', ',') + ' kg'

  /* ctx: {
       nombre, programa ('STRONG'|'BURN'|'HEALTHY'),
       sesionesTotales,            // incluida la de hoy
       diasDesdeAnterior,          // días entre la sesión anterior y hoy (null si es la primera)
       cargas: [{ejercicio, prev, hoy}],   // ejercicios donde hoy superó su carga anterior
       semanaCompleta: {hechas, total} | null,
       ciclo: {numero, cumplidas, semanas} | null,   // solo si hoy cerró el ciclo
       rachaSemanas,               // semanas completadas seguidas (sin contar una rota)
       checkin: {total, alertas:[]} | null,          // total 5–25
       semanaPct,                  // % de la semana tras esta sesión
       semilla                     // número estable por sesión para rotar la frase (ej. id o fecha)
     } */
  function felicitacion(ctx) {
    ctx = ctx || {}
    const nombre = String(ctx.nombre || '').trim().split(/\s+/)[0] || ''
    const titulo = nombre ? 'FELICITACIONES, ' + nombre.toUpperCase() + '.' : 'FELICITACIONES.'
    const tot = n0(ctx.sesionesTotales), dias = n0(ctx.diasDesdeAnterior), racha = n0(ctx.rachaSemanas) || 0
    const cargas = (ctx.cargas || []).filter((c) => c && c.ejercicio && n0(c.hoy) != null && n0(c.prev) != null && c.hoy > c.prev)
    const ck = ctx.checkin && n0(ctx.checkin.total) != null ? ctx.checkin : null
    let tipo, dato

    if (tot === 1) { tipo = 'PRIMERA'; dato = 'Completaste tu primera sesión del Método KOACH. Aquí empieza tu proceso.' }
    else if (ctx.ciclo && n0(ctx.ciclo.semanas)) {
      tipo = 'CICLO'; dato = 'Cerraste tu ciclo ' + (ctx.ciclo.numero || '') + ': ' + ctx.ciclo.cumplidas + ' de ' + ctx.ciclo.semanas + ' semanas completadas.'
      dato = dato.replace('ciclo :', 'ciclo:')
    }
    else if (dias != null && dias >= DIAS_VUELTA) { tipo = 'VUELTA'; dato = 'Volviste después de ' + plural(dias, 'día', 'días') + '. Volver es lo que construye el hábito.' }
    else if (cargas.length) {
      const c = cargas.slice().sort((a, b) => (b.hoy - b.prev) / b.prev - (a.hoy - a.prev) / a.prev)[0]
      tipo = 'NUEVA_CARGA'; dato = 'Nueva carga en ' + c.ejercicio + ': de ' + kg(c.prev) + ' a ' + kg(c.hoy) + '.' + (cargas.length > 1 ? ' Y ' + plural(cargas.length - 1, 'ejercicio más', 'ejercicios más') + ' con más carga.' : '')
    }
    else if (ctx.semanaCompleta && n0(ctx.semanaCompleta.total)) { tipo = 'SEMANA'; dato = 'Completaste las ' + ctx.semanaCompleta.total + ' sesiones de tu semana.' }
    else if (tot != null && HITOS.includes(tot)) { tipo = 'HITO'; dato = 'Llevas ' + tot + ' sesiones en KOACH.' }
    else if (ck && (ck.total < 11 || (ck.alertas || []).includes('BAJO_SU_NORMAL'))) { tipo = 'DIA_DIFICIL'; dato = 'Hoy llegaste con menos energía y entrenaste igual.' }
    else if (racha >= 2) { tipo = 'CONSTANCIA'; dato = 'Llevas ' + racha + ' semanas seguidas cumpliendo tu plan.' }
    else { tipo = 'AVANCE'; const p = n0(ctx.semanaPct); dato = p != null ? 'Tu semana va en ' + Math.round(p) + '%.' : null }

    const prog = String(ctx.programa || '').toUpperCase()
    const pool = ASPIRA[prog] || ASPIRA.STRONG
    const seed = Math.abs(Math.round(n0(ctx.semilla) != null ? ctx.semilla : (tot || 0)))
    const aspiracional = tipo === 'PRIMERA' ? pool[0] : pool[seed % pool.length]

    return { version: VERSION, tipo, k: 'CLUB DEL 1%', titulo, firma: FIRMA, dato, aspiracional, compartible: false }
  }

  return { VERSION, FIRMA, ASPIRA, HITOS, DIAS_VUELTA, felicitacion }
})
