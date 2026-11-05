-- NUTRICIÓN · ESCÁNER DE PLATO (5-nov-2026)
-- Cada foto que el socio escanea queda como registro (sin guardar la foto: privacidad). La IA de visión solo
-- identifica alimentos; el veredicto lo da el motor KOACH (domain/koach-escaner.js) según el foco de su pauta.
-- Flujo: /api/escaner RESERVA un cupo (límite diario, antes de gastar IA) → llama a la IA → COMPLETA el registro.

create table if not exists public.escaneos_nutricion (
  id uuid primary key default gen_random_uuid(),
  socio_id uuid not null references public.profiles(id) on delete cascade,
  pauta_id uuid references public.pautas_nutricion(id) on delete set null,
  fecha date not null default ((now() at time zone 'America/Santiago')::date),
  created_at timestamptz not null default now(),
  estado text not null default 'pendiente' check (estado in ('pendiente','listo','error')),
  comida text,
  comida_num integer,
  comidas_total integer,
  foco text,
  veredicto text check (veredicto in ('adecuado','relativo','alerta','no_comida')),
  puntaje integer,
  cheat boolean not null default false,
  plato text,
  kcal integer,
  proteina_g numeric,
  carbohidrato_g numeric,
  grasa_g numeric,
  deteccion jsonb,
  resultado jsonb,
  modelo text,
  ms integer
);
create index if not exists escaneos_nut_socio_idx on public.escaneos_nutricion (socio_id, created_at desc);

alter table public.escaneos_nutricion enable row level security;
drop policy if exists escaneo_socio_lee on public.escaneos_nutricion;
create policy escaneo_socio_lee on public.escaneos_nutricion for select to authenticated
  using (socio_id = (select auth.uid()) or (select koach_rol()) in ('admin','nutricionista','coach'));
-- Sin insert/update directos: solo por las funciones de abajo
revoke insert, update, delete on public.escaneos_nutricion from authenticated, anon;
grant select on public.escaneos_nutricion to authenticated;

-- 1 · Reserva: valida acceso y cupo diario; devuelve id + contexto de la pauta vigente (foco, kcal, comidas)
create or replace function public.koach_escaneo_reservar(p_comida text default null, p_num integer default null)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare v_uid uuid := auth.uid(); v_rol text; v_hoy date := (now() at time zone 'America/Santiago')::date;
  v_n integer; v_lim integer := 20; v_p pautas_nutricion; v_id uuid;
begin
  if v_uid is null then raise exception 'no autenticado'; end if;
  select role::text into v_rol from profiles where id = v_uid and coalesce(activo, true);
  if v_rol is null then raise exception 'sin permiso'; end if;
  if v_rol = 'socio' and not koach_acceso_ok(v_uid) then raise exception 'sin acceso vigente'; end if;
  perform pg_advisory_xact_lock(hashtext('escaneo:' || v_uid::text));
  select count(*) into v_n from escaneos_nutricion where socio_id = v_uid and fecha = v_hoy;
  if v_n >= v_lim then raise exception 'limite diario'; end if;
  select * into v_p from pautas_nutricion where socio_id = v_uid and estado = 'publicada' limit 1;
  insert into escaneos_nutricion (socio_id, pauta_id, fecha, comida, comida_num, comidas_total, foco)
  values (v_uid, v_p.id, v_hoy, left(nullif(trim(p_comida), ''), 40), p_num,
          case when v_p.id is null then null else jsonb_array_length(coalesce(v_p.contenido->'comidas', '[]'::jsonb)) end,
          coalesce(nullif(v_p.intake->>'foco', ''), 'general'))
  returning id into v_id;
  return jsonb_build_object('id', v_id, 'usados', v_n + 1, 'limite', v_lim, 'foco', coalesce(nullif(v_p.intake->>'foco', ''), 'general'),
    'kcal_dia', v_p.kcal, 'comidas_dia', case when v_p.id is null then null else nullif(jsonb_array_length(coalesce(v_p.contenido->'comidas', '[]'::jsonb)), 0) end);
end $$;

-- 2 · Completa el registro reservado (solo el dueño y solo si sigue pendiente)
create or replace function public.koach_escaneo_completar(p_id uuid, p_estado text, p_det jsonb, p_res jsonb, p_modelo text, p_ms integer)
returns void language plpgsql security definer set search_path to 'public' as $$
begin
  update escaneos_nutricion set
    estado = case when p_estado in ('listo','error') then p_estado else 'error' end,
    veredicto = case when p_res->>'veredicto' in ('adecuado','relativo','alerta','no_comida') then p_res->>'veredicto' end,
    puntaje = nullif(p_res->>'puntaje', '')::numeric::integer,
    cheat = coalesce((p_res->>'cheat')::boolean, false),
    plato = left(p_det->>'plato', 80),
    kcal = nullif(p_res#>>'{totales,kcal}', '')::numeric::integer,
    proteina_g = nullif(p_res#>>'{totales,proteina_g}', '')::numeric,
    carbohidrato_g = nullif(p_res#>>'{totales,carbohidrato_g}', '')::numeric,
    grasa_g = nullif(p_res#>>'{totales,grasa_g}', '')::numeric,
    deteccion = p_det, resultado = p_res, modelo = left(p_modelo, 60), ms = p_ms
  where id = p_id and socio_id = auth.uid() and estado = 'pendiente';
end $$;

-- 3 · Lectura: el socio ve los suyos; staff ve los de un socio. Últimos N días.
create or replace function public.koach_escaneos(p_socio uuid default null, p_dias integer default 7)
returns jsonb language plpgsql stable security definer set search_path to 'public' as $$
declare v_uid uuid := auth.uid(); v_rol text; v_sid uuid;
begin
  if v_uid is null then raise exception 'no autenticado'; end if;
  v_sid := coalesce(p_socio, v_uid);
  select role::text into v_rol from profiles where id = v_uid and coalesce(activo, true);
  if v_sid <> v_uid and coalesce(v_rol, '') not in ('admin','coach','nutricionista') then raise exception 'sin permiso'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('id', e.id, 'fecha', e.fecha, 'created_at', e.created_at, 'comida', e.comida,
      'comida_num', e.comida_num, 'comidas_total', e.comidas_total, 'foco', e.foco, 'veredicto', e.veredicto, 'puntaje', e.puntaje,
      'cheat', e.cheat, 'plato', e.plato, 'kcal', e.kcal, 'proteina_g', e.proteina_g, 'carbohidrato_g', e.carbohidrato_g, 'grasa_g', e.grasa_g,
      'resultado', e.resultado) order by e.created_at desc)
    from escaneos_nutricion e where e.socio_id = v_sid and e.estado = 'listo'
      and e.fecha >= (now() at time zone 'America/Santiago')::date - greatest(1, least(coalesce(p_dias, 7), 90))), '[]'::jsonb);
end $$;

revoke all on function public.koach_escaneo_reservar(text, integer) from public, anon;
revoke all on function public.koach_escaneo_completar(uuid, text, jsonb, jsonb, text, integer) from public, anon;
revoke all on function public.koach_escaneos(uuid, integer) from public, anon;
grant execute on function public.koach_escaneo_reservar(text, integer) to authenticated;
grant execute on function public.koach_escaneo_completar(uuid, text, jsonb, jsonb, text, integer) to authenticated;
grant execute on function public.koach_escaneos(uuid, integer) to authenticated;
