-- 1% CLUB: rankings y feed muestran nombre y apellido (primer apellido). Aplicada 23-nov-2026.
create or replace function public._club_nombre(p uuid) returns text language sql stable security definer set search_path=public as $$
  select upper(coalesce(nullif(trim(nombre),''),'SOCIO') || coalesce(' '||split_part(nullif(trim(apellido),''),' ',1),'')) from profiles where id=p $$;
