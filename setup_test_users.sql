-- SETUP: Crear usuarios test en Auth + Profiles
-- Este script necesita ejecutarse con Service Role Key (acceso admin)

-- TEST USER 1: SOCIO
-- Email: socio.test@koach.cl
-- Password: socio1234
-- Role: socio
-- (Usuario será creado vía Supabase Auth Dashboard, luego insert manual en profiles)

INSERT INTO public.profiles (
  id,
  nombre,
  apellido,
  email,
  role,
  activo,
  estado,
  fecha_inicio
) VALUES (
  '00000000-0000-0000-0000-000000000001'::uuid,
  'Test',
  'Socio',
  'socio.test@koach.cl',
  'socio',
  true,
  'activo',
  NOW()::date
) ON CONFLICT (id) DO UPDATE SET
  nombre = EXCLUDED.nombre,
  activo = EXCLUDED.activo;

-- TEST USER 2: COACH
-- Email: coach.test@koach.cl
-- Password: coach1234
-- Role: coach
INSERT INTO public.profiles (
  id,
  nombre,
  apellido,
  email,
  role,
  activo,
  estado
) VALUES (
  '00000000-0000-0000-0000-000000000002'::uuid,
  'Test',
  'Coach',
  'coach.test@koach.cl',
  'coach',
  true,
  'activo'
) ON CONFLICT (id) DO UPDATE SET
  nombre = EXCLUDED.nombre,
  activo = EXCLUDED.activo;

-- TEST USER 3: ADMIN
-- Email: admin.test@koach.cl
-- Password: admin1234
-- Role: admin
INSERT INTO public.profiles (
  id,
  nombre,
  apellido,
  email,
  role,
  activo,
  estado
) VALUES (
  '00000000-0000-0000-0000-000000000003'::uuid,
  'Test',
  'Admin',
  'admin.test@koach.cl',
  'admin',
  true,
  'activo'
) ON CONFLICT (id) DO UPDATE SET
  nombre = EXCLUDED.nombre,
  activo = EXCLUDED.activo;

-- Verificación
SELECT id, nombre, email, role, activo FROM public.profiles 
  WHERE id IN (
    '00000000-0000-0000-0000-000000000001'::uuid,
    '00000000-0000-0000-0000-000000000002'::uuid,
    '00000000-0000-0000-0000-000000000003'::uuid
  );
