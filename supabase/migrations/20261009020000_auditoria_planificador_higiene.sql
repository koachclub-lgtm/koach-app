-- c86 · Auditoría del planificador: higiene de seguridad y rendimiento (sin cambios funcionales)
-- 1) Índice duplicado en sesiones_registro (idx_sesiones_socio ≡ idx_sesreg_socio_fecha): se conserva uno.
--    PENDIENTE DE CONFIRMAR EN PRODUCCIÓN (el DROP exige confirmación manual en el dashboard):
--    drop index if exists public.idx_sesiones_socio;

-- 2) search_path fijo en las dos funciones de trigger que lo tenían mutable (advisor 0011)
alter function public.koach_trg_ciclo_cerrado() set search_path = public;
alter function public.koach_trg_numero_fijo() set search_path = public;

-- 3) Funciones de trigger: no son RPC. Sin EXECUTE para anon/authenticated (advisors 0028/0029)
do $$ declare f record; begin
  for f in select p.oid::regprocedure as fn from pg_proc p join pg_namespace n on n.oid=p.pronamespace
           where n.nspname='public' and p.proname like 'koach_trg_%' loop
    execute format('revoke execute on function %s from public, anon, authenticated', f.fn);
  end loop;
end $$;

-- 4) RPC del planificador que no tienen sentido sin sesión: fuera del alcance de anon
revoke execute on function public.koach_renombrar_sesion(uuid, text) from public, anon;
revoke execute on function public.koach_ciclo_calc(uuid, uuid, date) from public, anon;
revoke execute on function public.koach_control_desde() from public, anon;
