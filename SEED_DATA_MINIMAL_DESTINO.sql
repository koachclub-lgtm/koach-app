-- ═════════════════════════════════════════════════════════════════════════════
-- SEED DATA MINIMAL — DESTINO BRASIL
-- ═════════════════════════════════════════════════════════════════════════════
-- Este script carga datos TEST mínimos para END-TO-END
-- 
-- INSTRUCCIONES:
-- 1. Después de crear user auth (socio.test@koach.cl), copiar su UUID real
-- 2. Reemplazar {SOCIO_UUID} en este script con ese UUID
-- 3. Ejecutar en Supabase SQL Editor

-- ASUMIENDO IDs (reemplazar con valores reales después):
-- socio_id: {SOCIO_UUID} ← REEMPLAZAR DESPUÉS DE SIGNUP
-- protocolo_id: generaremos uno nuevo
-- sesiones: generaremos UUIDs nuevos

-- ═════════════════════════════════════════════════════════════════════════════
-- 1. EJERCICIOS BASE
-- ═════════════════════════════════════════════════════════════════════════════

INSERT INTO public.ejercicios 
  (nombre, estimulo, patron, con_carga, nivel_min, demanda)
VALUES
  ('Press de Banca', 'hipertrofia', 'push', true, 'basico', 'media'),
  ('Sentadilla', 'fuerza', 'squat', true, 'basico', 'alta'),
  ('Peso Muerto', 'fuerza', 'pull', true, 'intermedio', 'muy_alta'),
  ('Flexiones', 'hipertrofia', 'push', false, 'basico', 'media'),
  ('Dominadas', 'fuerza', 'pull', false, 'basico', 'media')
ON CONFLICT DO NOTHING;

-- ═════════════════════════════════════════════════════════════════════════════
-- 2. PROTOCOLO TEST
-- ═════════════════════════════════════════════════════════════════════════════

INSERT INTO public.protocolos 
  (nombre, descripcion, ciclo_semanas, programa, estado, creado_por)
VALUES
  ('Protocolo Test', 'Protocolo para testing END-TO-END', 4, 'Strength', 'activo', '00000000-0000-0000-0000-000000000001')
RETURNING id INTO @protocolo_id;

-- GUARDAR ID PARA USAR EN SIGUIENTE
SELECT @protocolo_id;

-- ═════════════════════════════════════════════════════════════════════════════
-- 3. SESIONES PROTOCOLO
-- ═════════════════════════════════════════════════════════════════════════════

-- Primero, obtener el protocolo creado (si no se guardó en variable)
WITH proto AS (
  SELECT id FROM public.protocolos 
  WHERE nombre = 'Protocolo Test' 
  ORDER BY created_at DESC LIMIT 1
)
INSERT INTO public.sesiones_protocolo 
  (protocolo_id, numero, nombre, objetivo, semana)
SELECT 
  proto.id,
  1,
  'Sesión 1: Upper Body',
  'Desarrollar fuerza en tren superior',
  1
FROM proto
ON CONFLICT DO NOTHING;

WITH proto AS (
  SELECT id FROM public.protocolos 
  WHERE nombre = 'Protocolo Test' 
  ORDER BY created_at DESC LIMIT 1
)
INSERT INTO public.sesiones_protocolo 
  (protocolo_id, numero, nombre, objetivo, semana)
SELECT 
  proto.id,
  2,
  'Sesión 2: Lower Body',
  'Desarrollar fuerza en tren inferior',
  2
FROM proto
ON CONFLICT DO NOTHING;

-- ═════════════════════════════════════════════════════════════════════════════
-- 4. BLOQUES
-- ═════════════════════════════════════════════════════════════════════════════

WITH sesiones AS (
  SELECT id, numero FROM public.sesiones_protocolo 
  WHERE nombre LIKE 'Sesión%' 
  ORDER BY numero
)
INSERT INTO public.bloques 
  (sesion_id, bloque, rol, sets, descanso_segundos)
SELECT 
  (SELECT id FROM sesiones WHERE numero = 1),
  'fuerza',
  'competente',
  4,
  180
ON CONFLICT DO NOTHING;

WITH sesiones AS (
  SELECT id, numero FROM public.sesiones_protocolo 
  WHERE nombre LIKE 'Sesión%' 
  ORDER BY numero
)
INSERT INTO public.bloques 
  (sesion_id, bloque, rol, sets, descanso_segundos)
SELECT 
  (SELECT id FROM sesiones WHERE numero = 2),
  'fuerza',
  'competente',
  4,
  180
ON CONFLICT DO NOTHING;

-- ═════════════════════════════════════════════════════════════════════════════
-- 5. BLOQUE_EJERCICIOS
-- ═════════════════════════════════════════════════════════════════════════════

-- Sesión 1: Press de Banca
WITH datos AS (
  SELECT 
    (SELECT id FROM public.bloques WHERE sesion_id = (SELECT id FROM public.sesiones_protocolo WHERE numero = 1) LIMIT 1) as bloque_id,
    (SELECT id FROM public.ejercicios WHERE nombre = 'Press de Banca' LIMIT 1) as ejer_id
)
INSERT INTO public.bloque_ejercicios 
  (bloque_id, ejercicio_id, orden, reps, es_ancla)
SELECT bloque_id, ejer_id, 1, '6-8', true
FROM datos
ON CONFLICT DO NOTHING;

-- Sesión 1: Flexiones
WITH datos AS (
  SELECT 
    (SELECT id FROM public.bloques WHERE sesion_id = (SELECT id FROM public.sesiones_protocolo WHERE numero = 1) LIMIT 1) as bloque_id,
    (SELECT id FROM public.ejercicios WHERE nombre = 'Flexiones' LIMIT 1) as ejer_id
)
INSERT INTO public.bloque_ejercicios 
  (bloque_id, ejercicio_id, orden, reps, es_ancla)
SELECT bloque_id, ejer_id, 2, '8-12', false
FROM datos
ON CONFLICT DO NOTHING;

-- Sesión 2: Sentadilla
WITH datos AS (
  SELECT 
    (SELECT id FROM public.bloques WHERE sesion_id = (SELECT id FROM public.sesiones_protocolo WHERE numero = 2) LIMIT 1) as bloque_id,
    (SELECT id FROM public.ejercicios WHERE nombre = 'Sentadilla' LIMIT 1) as ejer_id
)
INSERT INTO public.bloque_ejercicios 
  (bloque_id, ejercicio_id, orden, reps, es_ancla)
SELECT bloque_id, ejer_id, 1, '6-8', true
FROM datos
ON CONFLICT DO NOTHING;

-- Sesión 2: Peso Muerto
WITH datos AS (
  SELECT 
    (SELECT id FROM public.bloques WHERE sesion_id = (SELECT id FROM public.sesiones_protocolo WHERE numero = 2) LIMIT 1) as bloque_id,
    (SELECT id FROM public.ejercicios WHERE nombre = 'Peso Muerto' LIMIT 1) as ejer_id
)
INSERT INTO public.bloque_ejercicios 
  (bloque_id, ejercicio_id, orden, reps, es_ancla)
SELECT bloque_id, ejer_id, 2, '5-6', false
FROM datos
ON CONFLICT DO NOTHING;

-- ═════════════════════════════════════════════════════════════════════════════
-- 6. VERIFICACIÓN
-- ═════════════════════════════════════════════════════════════════════════════

SELECT 
  'Ejercicios' as item, COUNT(*) as cantidad FROM public.ejercicios
UNION ALL
SELECT 'Protocolos', COUNT(*) FROM public.protocolos WHERE nombre = 'Protocolo Test'
UNION ALL
SELECT 'Sesiones Test', COUNT(*) FROM public.sesiones_protocolo WHERE nombre LIKE 'Sesión%'
UNION ALL
SELECT 'Bloques', COUNT(*) FROM public.bloques
UNION ALL
SELECT 'Bloque_Ejercicios', COUNT(*) FROM public.bloque_ejercicios;

-- ═════════════════════════════════════════════════════════════════════════════
-- INSTRUCCIONES PARA CREAR ASIGNACIÓN (DESPUÉS DEL SIGNUP):
-- ═════════════════════════════════════════════════════════════════════════════
-- 
-- 1. Guardar UUID del socio creado: {SOCIO_UUID}
-- 2. Reemplazar en este SQL:
-- 
-- INSERT INTO public.asignaciones 
--   (socio_id, protocolo_id, semana_actual, asignada_por, activa)
-- SELECT 
--   '{SOCIO_UUID}',
--   id,
--   1,
--   '00000000-0000-0000-0000-000000000001',
--   true
-- FROM public.protocolos WHERE nombre = 'Protocolo Test';
--
-- ═════════════════════════════════════════════════════════════════════════════

