-- 1% CLUB · challenges comunitarios (primer caso: GTA CHALLENGE, burpees 3:00)
-- Aplicada en koach-club-brasil (siecbdatfgmqbpxqtvsl) el 19-nov-2026. Ajustes en 20261119211909_club_1_ajustes.sql.
create table if not exists public.club_challenges(
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  titulo text not null,
  descripcion text,
  metrica text not null default 'REPS',
  duracion_seg int,
  estandar text,
  inicio timestamptz not null,
  fin timestamptz not null,
  visible_hasta timestamptz not null,
  tema text not null default 'base',
  activo boolean not null default true,
  created_at timestamptz not null default now()
);
create table if not exists public.club_miembros(
  socio_id uuid primary key references public.profiles(id) on delete cascade,
  unido_at timestamptz not null default now()
);
create table if not exists public.club_challenge_entradas(
  id uuid primary key default gen_random_uuid(),
  challenge_id uuid not null references public.club_challenges(id) on delete cascade,
  socio_id uuid not null references public.profiles(id) on delete cascade,
  score int not null check (score between 0 and 150),
  estado text not null default 'pendiente' check (estado in ('pendiente','validado','rechazado')),
  registrado_por uuid,
  validado_por uuid,
  validado_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(challenge_id, socio_id)
);
create table if not exists public.club_eventos(
  id bigserial primary key,
  challenge_id uuid references public.club_challenges(id) on delete cascade,
  socio_id uuid references public.profiles(id) on delete cascade,
  tipo text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists club_eventos_ch_idx on public.club_eventos(challenge_id, id desc);
create table if not exists public.club_reacciones(
  evento_id bigint not null references public.club_eventos(id) on delete cascade,
  socio_id uuid not null references public.profiles(id) on delete cascade,
  clave text not null check (clave in ('implacable','subid','fuego')),
  created_at timestamptz not null default now(),
  primary key(evento_id, socio_id, clave)
);
create index if not exists club_reac_socio_idx on public.club_reacciones(socio_id);
create index if not exists club_ent_socio_idx on public.club_challenge_entradas(socio_id);
create index if not exists club_ev_socio_idx on public.club_eventos(socio_id);

-- Todo el acceso pasa por funciones (los nombres de otros socios no se exponen vía profiles)
alter table public.club_challenges enable row level security;
alter table public.club_miembros enable row level security;
alter table public.club_challenge_entradas enable row level security;
alter table public.club_eventos enable row level security;
alter table public.club_reacciones enable row level security;
drop policy if exists club_ch_leer on public.club_challenges;
create policy club_ch_leer on public.club_challenges for select to authenticated using (true);

create or replace function public._club_nombre(p uuid) returns text language sql stable security definer set search_path=public as $$
  select upper(coalesce(nullif(trim(nombre),''),'SOCIO') || coalesce(' '||left(nullif(trim(apellido),''),1)||'.','')) from profiles where id=p $$;

create or replace function public._club_es_validador() returns boolean language sql stable security definer set search_path=public as $$
  select coalesce(public.koach_rol() in ('admin','coach','recepcion'), false) $$;

create or replace function public._club_ranking(p_ch uuid) returns jsonb language sql stable security definer set search_path=public as $$
  select coalesce(jsonb_agg(x order by x->>'pos' is null, (x->>'pos')::int), '[]'::jsonb) from (
    select jsonb_build_object('pos', row_number() over (order by e.score desc, e.updated_at asc),
      'socio_id', e.socio_id, 'nombre', public._club_nombre(e.socio_id), 'sexo', p.sex::text,
      'score', e.score, 'estado', e.estado, 'avatar', p.avatar_path, 'yo', e.socio_id = auth.uid()) x
    from club_challenge_entradas e join profiles p on p.id=e.socio_id
    where e.challenge_id=p_ch and e.estado<>'rechazado') t $$;

create or replace function public.club_estado() returns jsonb language plpgsql stable security definer set search_path=public as $$
declare c club_challenges; yo uuid := auth.uid(); r jsonb;
begin
  if yo is null then return null; end if;
  select * into c from club_challenges where activo and now() < visible_hasta and now() >= inicio - interval '1 day' order by inicio desc limit 1;
  r := jsonb_build_object('miembro', exists(select 1 from club_miembros where socio_id=yo),
    'miembros', (select count(*) from club_miembros));
  if c.id is null then return r || jsonb_build_object('challenge', null); end if;
  return r || jsonb_build_object('challenge', jsonb_build_object('id',c.id,'slug',c.slug,'titulo',c.titulo,'descripcion',c.descripcion,
      'metrica',c.metrica,'duracion_seg',c.duracion_seg,'estandar',c.estandar,'inicio',c.inicio,'fin',c.fin,'tema',c.tema,
      'abierto', now() between c.inicio and c.fin),
    'mia', (select jsonb_build_object('score',score,'estado',estado) from club_challenge_entradas where challenge_id=c.id and socio_id=yo),
    'participantes', (select count(*) from club_challenge_entradas where challenge_id=c.id and estado<>'rechazado'));
end $$;

create or replace function public.club_unirse() returns jsonb language plpgsql security definer set search_path=public as $$
declare yo uuid := auth.uid(); c uuid;
begin
  if yo is null then raise exception 'sin sesión'; end if;
  insert into club_miembros(socio_id) values (yo) on conflict do nothing;
  if found then
    select id into c from club_challenges where activo and now() between inicio and fin order by inicio desc limit 1;
    insert into club_eventos(challenge_id, socio_id, tipo) values (c, yo, 'unido');
  end if;
  return public.club_estado();
end $$;

-- _club_marca: versión vigente en 20261119211909_club_1_ajustes.sql

create or replace function public.club_registrar(p_challenge uuid, p_score int) returns jsonb language plpgsql security definer set search_path=public as $$
begin
  if auth.uid() is null then raise exception 'sin sesión'; end if;
  return public._club_marca(p_challenge, auth.uid(), p_score, auth.uid(), false);
end $$;

create or replace function public.club_registrar_staff(p_challenge uuid, p_socio uuid, p_score int) returns jsonb language plpgsql security definer set search_path=public as $$
begin
  if not public._club_es_validador() then raise exception 'sin permiso'; end if;
  return public._club_marca(p_challenge, p_socio, p_score, auth.uid(), true);
end $$;

create or replace function public.club_validar(p_entrada uuid, p_ok boolean) returns void language plpgsql security definer set search_path=public as $$
begin
  if not public._club_es_validador() then raise exception 'sin permiso'; end if;
  update club_challenge_entradas set estado=case when p_ok then 'validado' else 'rechazado' end, validado_por=auth.uid(), validado_at=now(), updated_at=updated_at
   where id=p_entrada;
end $$;

create or replace function public.club_ranking(p_challenge uuid) returns jsonb language sql stable security definer set search_path=public as $$
  select case when auth.uid() is null then '[]'::jsonb else public._club_ranking(p_challenge) end $$;

create or replace function public.club_feed(p_challenge uuid, p_limit int default 40) returns jsonb language sql stable security definer set search_path=public as $$
  select case when auth.uid() is null then '[]'::jsonb else coalesce((select jsonb_agg(j order by (j->>'id')::bigint desc) from (
    select jsonb_build_object('id',e.id,'tipo',e.tipo,'payload',e.payload,'at',e.created_at,'socio_id',e.socio_id,
      'nombre',public._club_nombre(e.socio_id),'avatar',p.avatar_path,
      'reac',(select coalesce(jsonb_object_agg(clave,n),'{}'::jsonb) from (select clave,count(*) n from club_reacciones where evento_id=e.id group by clave) q),
      'mias',(select coalesce(jsonb_agg(clave),'[]'::jsonb) from club_reacciones where evento_id=e.id and socio_id=auth.uid())) j
    from club_eventos e left join profiles p on p.id=e.socio_id
    where e.challenge_id=p_challenge order by e.id desc limit least(greatest(p_limit,1),100)) t),'[]'::jsonb) end $$;

create or replace function public.club_entradas_staff(p_challenge uuid) returns jsonb language plpgsql stable security definer set search_path=public as $$
begin
  if not public._club_es_validador() then raise exception 'sin permiso'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('id',e.id,'socio_id',e.socio_id,'nombre',public._club_nombre(e.socio_id),'score',e.score,'estado',e.estado,'at',e.updated_at)
    order by (e.estado='pendiente') desc, e.score desc) from club_challenge_entradas e where e.challenge_id=p_challenge),'[]'::jsonb);
end $$;

-- club_reaccionar: versión vigente en 20261119211909_club_1_ajustes.sql

revoke all on function public._club_nombre(uuid), public._club_es_validador(), public._club_ranking(uuid) from public, anon, authenticated;
revoke all on function public.club_estado(), public.club_unirse(), public.club_registrar(uuid,int), public.club_registrar_staff(uuid,uuid,int), public.club_validar(uuid,boolean),
  public.club_ranking(uuid), public.club_feed(uuid,int), public.club_entradas_staff(uuid) from public, anon;
grant execute on function public.club_estado(), public.club_unirse(), public.club_registrar(uuid,int), public.club_registrar_staff(uuid,uuid,int), public.club_validar(uuid,boolean),
  public.club_ranking(uuid), public.club_feed(uuid,int), public.club_entradas_staff(uuid) to authenticated;

insert into public.club_challenges(slug, titulo, descripcion, metrica, duracion_seg, estandar, inicio, fin, visible_hasta, tema)
values ('gta-challenge','GTA CHALLENGE','Máxima cantidad de burpees en 3 minutos.','BURPEES',180,
  'Pecho al suelo · extensión completa con salto · tu pareja cuenta.',
  now(), '2026-11-21 23:59:59-03', '2026-11-23 23:59:59-03', 'gta')
on conflict (slug) do nothing;
