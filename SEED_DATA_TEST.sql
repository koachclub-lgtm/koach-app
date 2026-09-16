-- SEED DATA: Datos de test mínimos para KOACH App
-- Ejecutar en Supabase DESTINO (SQL Editor) con acceso de admin
-- Después de que Matías cree usuarios auth, actualizar IDs de profiles

BEGIN;

-- ==========================================================================
-- 1. USUARIOS TEST (profiles)
-- ==========================================================================
-- Nota: Estos UUIDs son ficticios para testing. Luego reemplazar con IDs reales de auth.users

INSERT INTO public.profiles (
  id, nombre, apellido, email, role, activo, estado, fecha_inicio
) VALUES
  ('11111111-1111-1111-1111-111111111111'::uuid, 'Test', 'Socio', 'socio.test@koach.cl', 'socio', true, 'activo', '2026-09-16'::date),
  ('22222222-2222-2222-2222-222222222222'::uuid, 'Test', 'Coach', 'coach.test@koach.cl', 'coach', true, 'activo', '2026-09-16'::date),
  ('33333333-3333-3333-3333-333333333333'::uuid, 'Test', 'Admin', 'admin.test@koach.cl', 'admin', true, 'activo', '2026-09-16'::date)
ON CONFLICT (id) DO NOTHING;

-- ==========================================================================
-- 2. EJERCICIOS BASE (mínimo para testing)
-- ==========================================================================
-- Se asume que exercicios ya existen en DESTINO (migraron del schema)
-- Si no existen, descomentar y ejecutar:

-- INSERT INTO public.ejercicios (nombre, grupo_muscular, descripcion)
-- VALUES
--   ('Sentadilla', 'Pierna', 'Ejercicio compuesto'),
--   ('Press de Banca', 'Pecho', 'Ejercicio compuesto')
-- ON CONFLICT DO NOTHING;

-- ==========================================================================
-- 3. PROTOCOLO DE TEST (para socio)
-- ==========================================================================

INSERT INTO public.protocolos (
  nombre, socio_id, estado, ciclo_semanas, sexo
) VALUES (
  'Protocolo Test', '11111111-1111-1111-1111-111111111111'::uuid, 'activo', 4, 'M'
)
ON CONFLICT DO NOTHING
RETURNING id INTO proto_id;

-- Si no tenemos RETURNING, usar query separada:
-- SELECT id FROM public.protocolos WHERE nombre='Protocolo Test' AND socio_id='11111111-1111-1111-1111-111111111111' LIMIT 1;

-- ==========================================================================
-- 4. SESIONES DE PROTOCOLO
-- ==========================================================================
-- (Requiere proto_id del paso anterior)

-- En un paso anterior se debe haber insertado en protocolos
-- Para simplificar, usar INSERT directo:

INSERT INTO public.sesiones_protocolo (
  nombre, protocolo_id, numero, objetivo
) VALUES
  ('Sesión 1 - Upper', (SELECT id FROM public.protocolos WHERE nombre='Protocolo Test' LIMIT 1), 1, 'Fuerza pecho y espalda'),
  ('Sesión 2 - Lower', (SELECT id FROM public.protocolos WHERE nombre='Protocolo Test' LIMIT 1), 2, 'Fuerza pierna')
ON CONFLICT DO NOTHING;

-- ==========================================================================
-- 5. BLOQUES (ejercicios agrupados)
-- ==========================================================================

INSERT INTO public.bloques (
  sesion_id, bloque, sets, descanso_seg, rol, etiqueta
) VALUES
  ((SELECT id FROM public.sesiones_protocolo WHERE nombre='Sesión 1 - Upper' LIMIT 1), 'B1', 4, 90, 'Strength', 'Press')
ON CONFLICT DO NOTHING;

-- ==========================================================================
-- 6. ASIGNACIÓN (protocolo a socio)
-- ==========================================================================

INSERT INTO public.asignaciones (
  socio_id, protocolo_id, estado, semana_actual
) VALUES (
  '11111111-1111-1111-1111-111111111111'::uuid,
  (SELECT id FROM public.protocolos WHERE nombre='Protocolo Test' LIMIT 1),
  'activa',
  1
)
ON CONFLICT DO NOTHING;

-- ==========================================================================
-- VERIFICACIÓN
-- ==========================================================================

SELECT '--- PROFILES ---' as info;
SELECT id, nombre, email, role FROM public.profiles WHERE email LIKE '%.test@%';

SELECT '--- PROTOCOLOS ---' as info;
SELECT id, nombre, socio_id, estado FROM public.protocolos WHERE nombre='Protocolo Test';

SELECT '--- SESIONES_PROTOCOLO ---' as info;
SELECT id, nombre, numero FROM public.sesiones_protocolo WHERE nombre LIKE '%Upper%' OR nombre LIKE '%Lower%';

SELECT '--- ASIGNACIONES ---' as info;
SELECT socio_id, protocolo_id, estado FROM public.asignaciones 
WHERE socio_id='11111111-1111-1111-1111-111111111111'::uuid;

COMMIT;
