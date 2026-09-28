// ═══ KOACH · PROGRAM_CATALOG — COPY OFICIAL DE LOS PROGRAMAS (fuente única) ═══
// Toda pantalla que muestre la definición de un programa lee de aquí. No reescribir este copy en otro lugar.
// La frecuencia semanal NO es parte del programa: pertenece a la planificación individual de cada socio.
;(function(g){
  var PROGRAM_CATALOG = Object.freeze({
    STRONG: Object.freeze({
      name: 'STRONG',
      tagline: 'GAIN MUSCLE & STRENGTH',
      description: 'Entrenamiento de fuerza diseñado para estimular hipertrofia localizada, priorizando los grupos musculares que más te importan — sin dejar de trabajar todo tu cuerpo.'
    }),
    BURN: Object.freeze({
      name: 'BURN',
      tagline: 'FAT LOSS & PERFORMANCE',
      description: 'Entrenamiento híbrido que combina circuitos con máquinas de fuerza y movimientos globales con peso libre, diseñados para promover un estímulo metabólico.\n\nAceleras tu gasto energético y favoreces la recomposición corporal.'
    }),
    HEALTHY: Object.freeze({
      name: 'HEALTHY',
      tagline: 'VITALITY & WELLNESS',
      description: 'Entrenamiento de fuerza controlado y progresivo, para quienes buscan una intensidad baja, comienzan desde cero o vuelven después de una pausa.\n\nConstruyes un cuerpo saludable y sin dolores físicos, avanzando a tu propio ritmo.'
    })
  })
  g.PROGRAM_CATALOG = PROGRAM_CATALOG
  g.PROGRAM_ORDER = Object.freeze(['STRONG','BURN','HEALTHY'])
  g.programaDef = function(k){ return PROGRAM_CATALOG[String(k||'').toUpperCase()] || null }
})(typeof window!=='undefined'?window:globalThis);
