-- c91 · SESSION Nº del socio (aplicado en producción el 10-10-2026)
-- Total de sesiones realizadas en el club = historial previo a la app (carga manual) + sesiones completadas en la app.
alter table public.profiles add column if not exists sesiones_previas integer not null default 0;
comment on column public.profiles.sesiones_previas is 'Sesiones realizadas en el club antes del registro en la app (carga manual). Se suman al contador SESSION Nº.';
create or replace function public.mi_contador_sesiones()
returns integer language sql stable security definer set search_path=public as $$
  select coalesce((select sesiones_previas from profiles where id=auth.uid()),0)
       + (select count(*)::int from sesiones_registro where socio_id=auth.uid() and estado='completada')
$$;
revoke execute on function public.mi_contador_sesiones() from public, anon;
grant execute on function public.mi_contador_sesiones() to authenticated;
