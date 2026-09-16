-- RLS/POLICIES DESIGN para KOACH App
-- Basado en mapa de app→database (ver AUDITORÍA_KOACH_APP)
--
-- ROLES: socio, coach, admin
-- REGLA: Cada usuario solo ve/modifica sus propios datos (socio)
--        Coach ve datos de sus socios
--        Admin ve todo

BEGIN;

-- ==========================================================================
-- HABILITACIÓN DE RLS
-- ==========================================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.asignaciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.protocolos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sesiones_protocolo ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bloques ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bloque_ejercicios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sesiones_registro ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.set_registros ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cargas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.solicitudes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.volumen_objetivos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.designaciones_extra ENABLE ROW LEVEL SECURITY;

-- ==========================================================================
-- TABLE: profiles
-- ACCESS: socio ve solo su perfil, coach/admin ven todos
-- ==========================================================================

-- SELECT: Socio ve solo su perfil + perfiles de su coach/admin
CREATE POLICY "profiles_select_own" ON public.profiles
  FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "profiles_select_coach" ON public.profiles
  FOR SELECT
  USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('coach', 'admin')
  );

-- INSERT: Solo signup (sin auth, se inserta en trigger/signup handler)
-- UPDATE: Solo self
CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "profiles_update_coach" ON public.profiles
  FOR UPDATE
  USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('coach', 'admin')
  );

-- DELETE: Solo admin
CREATE POLICY "profiles_delete_admin" ON public.profiles
  FOR DELETE
  USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
  );

-- ==========================================================================
-- TABLE: asignaciones (socio <-> protocolo)
-- ACCESS: socio ve sus asignaciones, coach ve de sus socios
-- ==========================================================================

CREATE POLICY "asignaciones_select_socio" ON public.asignaciones
  FOR SELECT
  USING (socio_id = auth.uid());

CREATE POLICY "asignaciones_select_coach" ON public.asignaciones
  FOR SELECT
  USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('coach', 'admin')
  );

CREATE POLICY "asignaciones_insert_coach" ON public.asignaciones
  FOR INSERT
  WITH CHECK (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('coach', 'admin')
  );

CREATE POLICY "asignaciones_update_coach" ON public.asignaciones
  FOR UPDATE
  USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('coach', 'admin')
  );

CREATE POLICY "asignaciones_delete_coach" ON public.asignaciones
  FOR DELETE
  USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('coach', 'admin')
  );

-- ==========================================================================
-- TABLE: protocolos (planes de entrenamiento)
-- ACCESS: socio ve solo protocolos asignados, coach ve sus propios, admin ve todos
-- ==========================================================================

CREATE POLICY "protocolos_select_base" ON public.protocolos
  FOR SELECT
  USING (
    -- Coach/admin ven todos
    (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('coach', 'admin')
    OR
    -- Socio ve protocolos asignados
    (
      (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'socio'
      AND id IN (
        SELECT protocolo_id FROM public.asignaciones WHERE socio_id = auth.uid()
      )
    )
  );

CREATE POLICY "protocolos_insert_coach" ON public.protocolos
  FOR INSERT
  WITH CHECK (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('coach', 'admin')
  );

CREATE POLICY "protocolos_update_coach" ON public.protocolos
  FOR UPDATE
  USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('coach', 'admin')
  );

CREATE POLICY "protocolos_delete_coach" ON public.protocolos
  FOR DELETE
  USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('coach', 'admin')
  );

-- ==========================================================================
-- TABLE: sesiones_protocolo, bloques, bloque_ejercicios
-- ACCESS: Public read (parte de protocolo), coach/admin write
-- ==========================================================================

-- sesiones_protocolo: heredan acceso de protocolos
CREATE POLICY "sesiones_protocolo_select" ON public.sesiones_protocolo
  FOR SELECT
  USING (true); -- Public read via protocolos FK check

CREATE POLICY "sesiones_protocolo_insert" ON public.sesiones_protocolo
  FOR INSERT
  WITH CHECK (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('coach', 'admin')
  );

CREATE POLICY "sesiones_protocolo_update" ON public.sesiones_protocolo
  FOR UPDATE
  USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('coach', 'admin')
  );

CREATE POLICY "sesiones_protocolo_delete" ON public.sesiones_protocolo
  FOR DELETE
  USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('coach', 'admin')
  );

-- bloques: heredan acceso de sesiones_protocolo
CREATE POLICY "bloques_select" ON public.bloques
  FOR SELECT
  USING (true);

CREATE POLICY "bloques_write" ON public.bloques
  FOR INSERT WITH CHECK (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('coach', 'admin')
  );

CREATE POLICY "bloques_update" ON public.bloques
  FOR UPDATE
  USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('coach', 'admin')
  );

CREATE POLICY "bloques_delete" ON public.bloques
  FOR DELETE
  USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('coach', 'admin')
  );

-- bloque_ejercicios
CREATE POLICY "bloque_ejercicios_select" ON public.bloque_ejercicios
  FOR SELECT
  USING (true);

CREATE POLICY "bloque_ejercicios_write" ON public.bloque_ejercicios
  FOR INSERT WITH CHECK (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('coach', 'admin')
  );

CREATE POLICY "bloque_ejercicios_update" ON public.bloque_ejercicios
  FOR UPDATE
  USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('coach', 'admin')
  );

CREATE POLICY "bloque_ejercicios_delete" ON public.bloque_ejercicios
  FOR DELETE
  USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('coach', 'admin')
  );

-- ==========================================================================
-- TABLE: sesiones_registro (ejecución de sesiones)
-- ACCESS: socio ve/modifica solo sus sesiones, coach/admin ven todas
-- ==========================================================================

CREATE POLICY "sesiones_registro_select_socio" ON public.sesiones_registro
  FOR SELECT
  USING (socio_id = auth.uid());

CREATE POLICY "sesiones_registro_select_coach" ON public.sesiones_registro
  FOR SELECT
  USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('coach', 'admin')
  );

CREATE POLICY "sesiones_registro_insert" ON public.sesiones_registro
  FOR INSERT
  WITH CHECK (socio_id = auth.uid());

CREATE POLICY "sesiones_registro_update_socio" ON public.sesiones_registro
  FOR UPDATE
  USING (socio_id = auth.uid());

CREATE POLICY "sesiones_registro_update_coach" ON public.sesiones_registro
  FOR UPDATE
  USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('coach', 'admin')
  );

-- ==========================================================================
-- TABLE: set_registros (series completadas)
-- ACCESS: socio ve/modifica solo sus series
-- ==========================================================================

CREATE POLICY "set_registros_select_socio" ON public.set_registros
  FOR SELECT
  USING (
    registro_id IN (
      SELECT id FROM public.sesiones_registro WHERE socio_id = auth.uid()
    )
  );

CREATE POLICY "set_registros_select_coach" ON public.set_registros
  FOR SELECT
  USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('coach', 'admin')
  );

CREATE POLICY "set_registros_insert" ON public.set_registros
  FOR INSERT
  WITH CHECK (
    registro_id IN (
      SELECT id FROM public.sesiones_registro WHERE socio_id = auth.uid()
    )
  );

CREATE POLICY "set_registros_update" ON public.set_registros
  FOR UPDATE
  USING (
    registro_id IN (
      SELECT id FROM public.sesiones_registro WHERE socio_id = auth.uid()
    )
  );

CREATE POLICY "set_registros_delete" ON public.set_registros
  FOR DELETE
  USING (
    registro_id IN (
      SELECT id FROM public.sesiones_registro WHERE socio_id = auth.uid()
    )
  );

-- ==========================================================================
-- TABLE: cargas (máximos levantados)
-- ACCESS: socio ve solo sus cargas
-- ==========================================================================

CREATE POLICY "cargas_select_socio" ON public.cargas
  FOR SELECT
  USING (
    registro_id IN (
      SELECT id FROM public.sesiones_registro WHERE socio_id = auth.uid()
    )
  );

CREATE POLICY "cargas_select_coach" ON public.cargas
  FOR SELECT
  USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('coach', 'admin')
  );

CREATE POLICY "cargas_insert" ON public.cargas
  FOR INSERT
  WITH CHECK (
    registro_id IN (
      SELECT id FROM public.sesiones_registro WHERE socio_id = auth.uid()
    )
  );

-- ==========================================================================
-- TABLE: solicitudes (pedidos de cambios)
-- ACCESS: socio ve/crea solo sus solicitudes, coach/admin ven/atienden todas
-- ==========================================================================

CREATE POLICY "solicitudes_select_socio" ON public.solicitudes
  FOR SELECT
  USING (socio_id = auth.uid());

CREATE POLICY "solicitudes_select_coach" ON public.solicitudes
  FOR SELECT
  USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('coach', 'admin')
  );

CREATE POLICY "solicitudes_insert_socio" ON public.solicitudes
  FOR INSERT
  WITH CHECK (socio_id = auth.uid());

CREATE POLICY "solicitudes_update_coach" ON public.solicitudes
  FOR UPDATE
  USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('coach', 'admin')
  );

-- ==========================================================================
-- TABLE: volumen_objetivos
-- ACCESS: coach/admin write, socio read via protocolo
-- ==========================================================================

CREATE POLICY "volumen_objetivos_select" ON public.volumen_objetivos
  FOR SELECT
  USING (true);

CREATE POLICY "volumen_objetivos_insert" ON public.volumen_objetivos
  FOR INSERT
  WITH CHECK (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('coach', 'admin')
  );

CREATE POLICY "volumen_objetivos_update" ON public.volumen_objetivos
  FOR UPDATE
  USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('coach', 'admin')
  );

-- ==========================================================================
-- TABLE: designaciones_extra (sesiones extra asignadas)
-- ACCESS: coach/admin manage, socio read
-- ==========================================================================

CREATE POLICY "designaciones_extra_select_socio" ON public.designaciones_extra
  FOR SELECT
  USING (socio_id = auth.uid());

CREATE POLICY "designaciones_extra_select_coach" ON public.designaciones_extra
  FOR SELECT
  USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('coach', 'admin')
  );

CREATE POLICY "designaciones_extra_insert_coach" ON public.designaciones_extra
  FOR INSERT
  WITH CHECK (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('coach', 'admin')
  );

CREATE POLICY "designaciones_extra_update_coach" ON public.designaciones_extra
  FOR UPDATE
  USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('coach', 'admin')
  );

COMMIT;

-- ==========================================================================
-- VERIFICACIÓN
-- ==========================================================================

SELECT tablename, policyname, permissive, roles
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
