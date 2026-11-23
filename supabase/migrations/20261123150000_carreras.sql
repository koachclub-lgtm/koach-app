-- KOACH · Run Club: carreras registradas con GPS desde la app.
create table if not exists public.carreras (
  id            uuid primary key default gen_random_uuid(),
  perfil_id     uuid not null references public.profiles(id) on delete cascade,
  inicio        timestamptz not null,
  fin           timestamptz not null,
  distancia_m   integer not null check (distancia_m >= 0),
  duracion_s    integer not null check (duracion_s >= 0),
  movimiento_s  integer not null check (movimiento_s >= 0),
  ritmo_min_km  numeric(5,2),
  ruta          text,                       -- polyline comprimida (precisión 1e-5)
  valida        boolean not null default false,
  origen        text not null default 'app' check (origen in ('app','health_connect','healthkit','strava')),
  motor_version text,
  creada_at     timestamptz not null default now()
);
create index if not exists carreras_perfil_inicio on public.carreras (perfil_id, inicio desc);
alter table public.carreras enable row level security;
create policy carreras_propias_select on public.carreras for select using (perfil_id = auth.uid());
create policy carreras_propias_insert on public.carreras for insert with check (perfil_id = auth.uid());
create policy carreras_propias_delete on public.carreras for delete using (perfil_id = auth.uid());

-- Aplicada 23-nov-2026 junto con RUN CLUB (racha de frecuencia semanal + distancia).
create policy carreras_staff_select on public.carreras for select using (public._club_es_validador());

-- Guarda una carrera del socio. La validez se recalcula en servidor (no se confía en el cliente).
create or replace function public.club_run_guardar(p_inicio timestamptz, p_fin timestamptz, p_distancia_m int, p_duracion_s int,
  p_movimiento_s int, p_ruta text default null, p_motor text default null) returns jsonb
language plpgsql security definer set search_path=public as $$
declare yo uuid := auth.uid(); v boolean; rit numeric;
begin
  if yo is null then raise exception 'sin sesión'; end if;
  if p_fin <= p_inicio or p_fin > now() + interval '5 min' or p_duracion_s < 0 or p_distancia_m < 0 or p_movimiento_s < 0 then raise exception 'carrera inválida'; end if;
  if p_distancia_m > 100000 then raise exception 'distancia fuera de rango'; end if;
  rit := case when p_distancia_m > 0 then round((p_movimiento_s/60.0)/(p_distancia_m/1000.0),2) end;
  -- válida: ≥300 m, ≥3 min y ritmo humano a pie (≥2:30 /KM)
  v := p_distancia_m >= 300 and p_duracion_s >= 180 and coalesce(rit,0) >= 2.5;
  insert into carreras(perfil_id, inicio, fin, distancia_m, duracion_s, movimiento_s, ritmo_min_km, ruta, valida, motor_version)
    values (yo, p_inicio, p_fin, p_distancia_m, p_duracion_s, p_movimiento_s, least(rit,999.99), left(p_ruta,200000), v, p_motor);
  insert into club_miembros(socio_id) values (yo) on conflict do nothing;
  return public.club_run_estado() || jsonb_build_object('guardada', jsonb_build_object('valida', v, 'distancia_m', p_distancia_m, 'ritmo_min_km', rit));
end $$;

-- Estado RUN CLUB: racha de semanas consecutivas con ≥1 carrera válida, km totales/mes y ranking de km del mes.
create or replace function public.club_run_estado() returns jsonb
language plpgsql stable security definer set search_path=public as $$
declare yo uuid := auth.uid(); sem date := date_trunc('week', (now() at time zone 'America/Santiago'))::date;
  racha int := 0; w date; mes date := date_trunc('month', (now() at time zone 'America/Santiago'))::date;
begin
  if yo is null then return null; end if;
  -- la racha sigue viva si esta semana aún no corre pero la anterior sí
  w := case when exists(select 1 from carreras where perfil_id=yo and valida and date_trunc('week', inicio at time zone 'America/Santiago')::date = sem)
            then sem else sem - 7 end;
  while exists(select 1 from carreras where perfil_id=yo and valida and date_trunc('week', inicio at time zone 'America/Santiago')::date = w) loop
    racha := racha + 1; w := w - 7;
  end loop;
  return jsonb_build_object(
    'racha_semanas', racha,
    'semana_ok', exists(select 1 from carreras where perfil_id=yo and valida and date_trunc('week', inicio at time zone 'America/Santiago')::date = sem),
    'carreras', (select count(*) from carreras where perfil_id=yo and valida),
    'km_total', (select round(coalesce(sum(distancia_m),0)/1000.0,1) from carreras where perfil_id=yo and valida),
    'km_mes', (select round(coalesce(sum(distancia_m),0)/1000.0,1) from carreras where perfil_id=yo and valida and (inicio at time zone 'America/Santiago')::date >= mes),
    'ultima', (select jsonb_build_object('at',inicio,'km',round(distancia_m/1000.0,2),'ritmo',ritmo_min_km,'valida',valida)
               from carreras where perfil_id=yo order by inicio desc limit 1),
    'ranking', (select coalesce(jsonb_agg(x order by (x->>'pos')::int),'[]'::jsonb) from (
       select jsonb_build_object('pos', row_number() over (order by sum(c.distancia_m) desc), 'nombre', public._club_nombre(c.perfil_id),
         'avatar', p.avatar_path, 'km', round(sum(c.distancia_m)/1000.0,1), 'n', count(*), 'yo', c.perfil_id=yo) x
       from carreras c join profiles p on p.id=c.perfil_id
       where c.valida and (c.inicio at time zone 'America/Santiago')::date >= mes
       group by c.perfil_id, p.avatar_path order by sum(c.distancia_m) desc limit 10) t));
end $$;

revoke all on function public.club_run_guardar(timestamptz,timestamptz,int,int,int,text,text), public.club_run_estado() from public, anon;
grant execute on function public.club_run_guardar(timestamptz,timestamptz,int,int,int,text,text), public.club_run_estado() to authenticated;
