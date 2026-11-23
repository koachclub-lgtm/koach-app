-- RUN CLUB · compromiso por nivel. Aplicada 23-nov-2026.
-- BÁSICO 1×/semana desde 1 km · INTERMEDIO 2× desde 3 km · AVANZADO 3× desde 7 km.
-- Score igual para todos: semanas seguidas cumpliendo el compromiso (desempate por km).
create table if not exists public.club_run_niveles(
  id bigserial primary key,
  socio_id uuid not null references public.profiles(id) on delete cascade,
  nivel text not null check (nivel in ('basico','intermedio','avanzado')),
  desde timestamptz not null default now()
);
create index if not exists club_run_niveles_socio on public.club_run_niveles(socio_id, desde desc);
alter table public.club_run_niveles enable row level security;

create or replace function public._run_sem(t timestamptz) returns date language sql immutable as $$
  select date_trunc('week', t at time zone 'America/Santiago')::date $$;
create or replace function public._run_freq(n text) returns int language sql immutable as $$
  select case n when 'basico' then 1 when 'intermedio' then 2 when 'avanzado' then 3 end $$;
create or replace function public._run_min(n text) returns int language sql immutable as $$
  select case n when 'basico' then 1000 when 'intermedio' then 3000 when 'avanzado' then 7000 end $$;
create or replace function public._run_nivel_en(u uuid, sem date) returns text language sql stable security definer set search_path=public as $$
  select nivel from club_run_niveles where socio_id=u and public._run_sem(desde) <= sem order by desde desc limit 1 $$;
create or replace function public._run_hechas(u uuid, sem date, n text) returns int language sql stable security definer set search_path=public as $$
  select count(*)::int from carreras where perfil_id=u and valida and distancia_m >= public._run_min(n) and public._run_sem(inicio)=sem $$;
create or replace function public._run_semana_ok(u uuid, sem date) returns boolean language plpgsql stable security definer set search_path=public as $$
declare n text := public._run_nivel_en(u, sem);
begin
  if n is null then return false; end if;
  return public._run_hechas(u, sem, n) >= public._run_freq(n);
end $$;
create or replace function public._run_racha(u uuid) returns int language plpgsql stable security definer set search_path=public as $$
declare sem date := public._run_sem(now()); w date; r int := 0;
begin
  w := case when public._run_semana_ok(u, sem) then sem else sem - 7 end;
  while public._run_semana_ok(u, w) loop r := r + 1; w := w - 7; end loop;
  return r;
end $$;

create or replace function public.club_run_estado() returns jsonb
language plpgsql stable security definer set search_path=public as $$
declare yo uuid := auth.uid(); sem date := public._run_sem(now()); n text; d timestamptz; v_racha int;
  mes date := date_trunc('month', (now() at time zone 'America/Santiago'))::date;
begin
  if yo is null then return null; end if;
  select nivel, desde into n, d from club_run_niveles where socio_id=yo order by desde desc limit 1;
  v_racha := public._run_racha(yo);
  return jsonb_build_object(
    'inscrito', n is not null, 'nivel', n,
    'meta', public._run_freq(n), 'min_km', public._run_min(n)/1000.0,
    'hechas', case when n is null then 0 else public._run_hechas(yo, sem, n) end,
    'racha_semanas', v_racha,
    'puede_subir', n is not null and n <> 'avanzado' and v_racha >= 4 and (sem - public._run_sem(d)) >= 21,
    'carreras', (select count(*) from carreras where perfil_id=yo and valida),
    'km_total', (select round(coalesce(sum(distancia_m),0)/1000.0,1) from carreras where perfil_id=yo and valida),
    'km_mes', (select round(coalesce(sum(distancia_m),0)/1000.0,1) from carreras where perfil_id=yo and valida and (inicio at time zone 'America/Santiago')::date >= mes),
    'inscritos', (select jsonb_build_object('basico', count(*) filter (where nivel='basico'), 'intermedio', count(*) filter (where nivel='intermedio'), 'avanzado', count(*) filter (where nivel='avanzado'))
       from (select distinct on (socio_id) socio_id, nivel from club_run_niveles order by socio_id, desde desc) x),
    'ranking', (with base as (select distinct on (socio_id) socio_id, nivel from club_run_niveles order by socio_id, desde desc),
       calc as (select b.socio_id, b.nivel, public._run_racha(b.socio_id) racha,
         (select coalesce(sum(distancia_m),0) from carreras c where c.perfil_id=b.socio_id and c.valida) m from base b),
       rk as (select *, row_number() over (order by calc.racha desc, calc.m desc) pos from calc)
       select coalesce(jsonb_agg(jsonb_build_object('pos',rk.pos,'nombre',public._club_nombre(rk.socio_id),'avatar',p.avatar_path,'nivel',rk.nivel,
         'racha',rk.racha,'km',round(rk.m/1000.0,1),'yo',rk.socio_id=yo) order by rk.pos),'[]'::jsonb)
       from rk join profiles p on p.id=rk.socio_id where rk.pos <= 10 or rk.socio_id=yo));
end $$;

create or replace function public.club_run_inscribir(p_nivel text) returns jsonb
language plpgsql security definer set search_path=public as $$
declare yo uuid := auth.uid(); act text;
begin
  if yo is null then raise exception 'sin sesión'; end if;
  if p_nivel not in ('basico','intermedio','avanzado') then raise exception 'nivel inválido'; end if;
  select nivel into act from club_run_niveles where socio_id=yo order by desde desc limit 1;
  if act is distinct from p_nivel then insert into club_run_niveles(socio_id, nivel) values (yo, p_nivel); end if;
  insert into club_miembros(socio_id) values (yo) on conflict do nothing;
  return public.club_run_estado();
end $$;

revoke all on function public.club_run_inscribir(text) from public, anon;
grant execute on function public.club_run_inscribir(text) to authenticated;
revoke all on function public._run_nivel_en(uuid,date), public._run_hechas(uuid,date,text), public._run_semana_ok(uuid,date), public._run_racha(uuid) from public, anon, authenticated;
