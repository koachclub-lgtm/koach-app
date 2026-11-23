-- RUN CLUB · importar carreras desde Apple Salud / Health Connect (app nativa). Aplicada 23-nov-2026.
-- ext_id evita importar dos veces la misma actividad; se descarta si se cruza en el tiempo con otra carrera del socio
-- (p. ej. la grabó con la app KOACH y además con el reloj).
alter table public.carreras add column if not exists ext_id text;
alter table public.carreras add column if not exists fuente text;
create unique index if not exists carreras_ext_unica on public.carreras(perfil_id, origen, ext_id) where ext_id is not null;

create or replace function public.club_run_importar(p_carreras jsonb) returns jsonb
language plpgsql security definer set search_path=public as $$
declare yo uuid := auth.uid(); c jsonb; v_ini timestamptz; v_fin timestamptz; d int; dur int; rit numeric; org text; n_ok int := 0; n_dup int := 0;
begin
  if yo is null then raise exception 'sin sesión'; end if;
  if jsonb_typeof(p_carreras) <> 'array' or jsonb_array_length(p_carreras) > 200 then raise exception 'lote inválido'; end if;
  for c in select * from jsonb_array_elements(p_carreras) loop
    org := c->>'origen'; v_ini := (c->>'inicio')::timestamptz; v_fin := (c->>'fin')::timestamptz;
    d := greatest(0, least(100000, coalesce((c->>'distancia_m')::int, 0))); dur := greatest(0, coalesce((c->>'duracion_s')::int, 0));
    if org not in ('healthkit','health_connect') or v_ini is null or v_fin is null or v_fin <= v_ini or v_fin > now() + interval '5 min' or coalesce(c->>'ext_id','') = '' then continue; end if;
    if exists (select 1 from carreras where perfil_id = yo and ((origen = org and ext_id = c->>'ext_id') or (carreras.inicio < v_fin and carreras.fin > v_ini))) then n_dup := n_dup + 1; continue; end if;
    rit := case when d > 0 then round((dur/60.0)/(d/1000.0), 2) end;
    insert into carreras(perfil_id, inicio, fin, distancia_m, duracion_s, movimiento_s, ritmo_min_km, ruta, valida, origen, motor_version, ext_id, fuente)
    values (yo, v_ini, v_fin, d, dur, dur, least(rit, 999.99), left(c->>'ruta', 200000), d >= 300 and dur >= 180 and coalesce(rit,0) >= 2.5, org, 'import', c->>'ext_id', left(c->>'fuente', 80));
    n_ok := n_ok + 1;
  end loop;
  if n_ok > 0 then insert into club_miembros(socio_id) values (yo) on conflict do nothing; end if;
  return public.club_run_estado() || jsonb_build_object('importadas', n_ok, 'repetidas', n_dup);
end $$;
revoke all on function public.club_run_importar(jsonb) from public, anon;
grant execute on function public.club_run_importar(jsonb) to authenticated;
