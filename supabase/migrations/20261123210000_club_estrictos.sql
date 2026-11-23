-- 1% CLUB · ESTRICTOS: socios con asistencia al 100% cada semana (todas las sesiones programadas por su koach completadas).
-- Regla = koach_gamif_calc ("semana cumplida"). Ranking cacheado y refrescado cada hora por pg_cron (el cálculo de todos toma ~2,5 s);
-- la fila propia se recalcula en vivo al abrir. GTA CHALLENGE pasa a 90 segundos. Aplicada 23-nov-2026.
update public.club_challenges set duracion_seg = 90,
  descripcion = 'Máxima cantidad de burpees en 90 segundos.',
  bajada = 'Ponle play al GTA Challenge: máxima cantidad de burpees en 90 segundos. Marca tu récord personal y compite por el primer lugar en el Club del 1%.'
 where slug = 'gta-challenge';

create table if not exists public.club_estrictos(
  socio_id uuid primary key references public.profiles(id) on delete cascade,
  racha int not null default 0, racha_max int not null default 0, cumplidas int not null default 0,
  planif int, hechas int, updated_at timestamptz not null default now()
);
alter table public.club_estrictos enable row level security;

create or replace function public.club_estrictos_refrescar() returns int
language plpgsql security definer set search_path=public as $$
declare n int;
begin
  delete from club_estrictos;
  insert into club_estrictos(socio_id, racha, racha_max, cumplidas, planif, hechas)
  select x.socio_id, coalesce((g->>'racha_semanas')::int,0), coalesce((g->>'racha_max')::int,0), coalesce((g->>'semanas_cumplidas')::int,0),
         (g->'semana_actual'->>'planif')::int, (g->'semana_actual'->>'hechas')::int
    from (select distinct a.socio_id from asignaciones a join profiles p on p.id=a.socio_id where a.activo) x,
         lateral (select public.koach_gamif_calc(x.socio_id) g) c
   where coalesce((g->>'con_plan')::boolean,false);
  get diagnostics n = row_count; return n;
end $$;

create or replace function public.club_estrictos_estado() returns jsonb
language plpgsql security definer set search_path=public as $$
declare yo uuid := auth.uid(); g jsonb;
begin
  if yo is null then return null; end if;
  g := public.koach_gamif_calc(yo);
  if coalesce((g->>'con_plan')::boolean,false) then
    insert into club_estrictos(socio_id, racha, racha_max, cumplidas, planif, hechas, updated_at)
    values (yo, coalesce((g->>'racha_semanas')::int,0), coalesce((g->>'racha_max')::int,0), coalesce((g->>'semanas_cumplidas')::int,0),
            (g->'semana_actual'->>'planif')::int, (g->'semana_actual'->>'hechas')::int, now())
    on conflict (socio_id) do update set racha=excluded.racha, racha_max=excluded.racha_max, cumplidas=excluded.cumplidas,
      planif=excluded.planif, hechas=excluded.hechas, updated_at=now();
  end if;
  return jsonb_build_object(
    'con_plan', coalesce((g->>'con_plan')::boolean,false),
    'racha', coalesce((g->>'racha_semanas')::int,0), 'racha_max', coalesce((g->>'racha_max')::int,0),
    'cumplidas', coalesce((g->>'semanas_cumplidas')::int,0),
    'semana', g->'semana_actual',
    'semanas', (select coalesce(jsonb_agg(e),'[]'::jsonb) from (select e from jsonb_array_elements(coalesce(g->'semanas','[]'::jsonb)) with ordinality t(e,i) order by i desc limit 8) z),
    'estrictos', (select count(*) from club_estrictos where racha >= 1),
    'ranking', (select coalesce(jsonb_agg(x order by (x->>'pos')::int),'[]'::jsonb) from (
       select jsonb_build_object('pos', pos, 'nombre', public._club_nombre(r.socio_id), 'avatar', p.avatar_path, 'racha', r.racha, 'cumplidas', r.cumplidas, 'yo', r.socio_id=yo) x
       from (select *, row_number() over (order by racha desc, cumplidas desc, socio_id) pos from club_estrictos where racha >= 1) r
       join profiles p on p.id=r.socio_id where r.pos <= 10 or r.socio_id=yo) t));
end $$;

revoke all on function public.club_estrictos_refrescar(), public.club_estrictos_estado() from public, anon;
grant execute on function public.club_estrictos_estado() to authenticated;
select cron.schedule('club-estrictos-hora', '7 * * * *', $$select public.club_estrictos_refrescar()$$);
select public.club_estrictos_refrescar();
