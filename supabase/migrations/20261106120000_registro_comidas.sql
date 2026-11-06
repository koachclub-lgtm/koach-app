-- NUTRICIÓN · REGISTRO DIARIO DE COMIDAS (6-nov-2026)
-- Cada comida del plan del día queda CUMPLIDA (con o sin foto) o como CHEAT MEAL. Una fila por socio + fecha + número de comida.
-- Alimenta: % del día, adherencia semanal y cheat meals (app del socio y ficha de nutrición).
-- El escaneo se CONFIRMA cuando el socio revisa/corrige alimentos y gramos: recién ahí cuenta para su registro.

create table if not exists public.registro_comidas (
  id uuid primary key default gen_random_uuid(),
  socio_id uuid not null references public.profiles(id) on delete cascade,
  pauta_id uuid references public.pautas_nutricion(id) on delete set null,
  fecha date not null default ((now() at time zone 'America/Santiago')::date),
  comida_num integer not null check (comida_num between 1 and 12),
  comida text,
  estado text not null check (estado in ('cumplida','cheat')),
  origen text not null default 'manual' check (origen in ('manual','escaneo')),
  escaneo_id uuid references public.escaneos_nutricion(id) on delete set null,
  kcal integer,
  proteina_g numeric,
  carbohidrato_g numeric,
  grasa_g numeric,
  alertas jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (socio_id, fecha, comida_num)
);
create index if not exists registro_comidas_socio_idx on public.registro_comidas (socio_id, fecha desc);
alter table public.registro_comidas enable row level security;
drop policy if exists registro_comidas_lee on public.registro_comidas;
create policy registro_comidas_lee on public.registro_comidas for select to authenticated
  using (socio_id = (select auth.uid()) or (select koach_rol()) in ('admin','nutricionista','coach'));
revoke insert, update, delete on public.registro_comidas from authenticated, anon;
grant select on public.registro_comidas to authenticated;

alter table public.escaneos_nutricion add column if not exists confirmado boolean not null default false;

-- Nombre de la comida N en la pauta publicada del socio
create or replace function public.koach_comida_nombre(p_pauta pautas_nutricion, p_num integer)
returns text language sql immutable as $$
  select left(nullif(p_pauta.contenido->'comidas'->(p_num - 1)->>'nombre', ''), 40)
$$;

-- Marcar a mano (sin foto): 'cumplida' | 'cheat' | 'pendiente' (borra el registro del día)
create or replace function public.koach_comida_marcar(p_num integer, p_estado text, p_fecha date default null)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare v_uid uuid := auth.uid(); v_hoy date := (now() at time zone 'America/Santiago')::date; v_f date; v_p pautas_nutricion;
begin
  if v_uid is null then raise exception 'no autenticado'; end if;
  v_f := coalesce(p_fecha, v_hoy);
  if v_f > v_hoy or v_f < v_hoy - 2 then raise exception 'solo puedes registrar hoy o los 2 días anteriores'; end if;
  if p_num is null or p_num < 1 or p_num > 12 then raise exception 'comida inválida'; end if;
  if p_estado = 'pendiente' then
    delete from registro_comidas where socio_id = v_uid and fecha = v_f and comida_num = p_num;
    return jsonb_build_object('ok', true, 'estado', 'pendiente');
  end if;
  if p_estado not in ('cumplida','cheat') then raise exception 'estado inválido'; end if;
  select * into v_p from pautas_nutricion where socio_id = v_uid and estado = 'publicada' limit 1;
  if v_p.id is null then raise exception 'sin pauta publicada'; end if;
  if p_num > jsonb_array_length(coalesce(v_p.contenido->'comidas', '[]'::jsonb)) then raise exception 'tu plan no tiene esa comida'; end if;
  insert into registro_comidas (socio_id, pauta_id, fecha, comida_num, comida, estado, origen)
  values (v_uid, v_p.id, v_f, p_num, koach_comida_nombre(v_p, p_num), p_estado, 'manual')
  on conflict (socio_id, fecha, comida_num) do update set estado = excluded.estado, updated_at = now(),
    -- un registro con foto conserva sus datos si solo se cambia el estado
    origen = case when registro_comidas.escaneo_id is null then 'manual' else registro_comidas.origen end;
  return jsonb_build_object('ok', true, 'estado', p_estado);
end $$;

-- Confirmar un escaneo (alimentos y gramos ya revisados por el socio) y registrarlo como su comida N de hoy
create or replace function public.koach_escaneo_confirmar(p_id uuid, p_num integer, p_det jsonb, p_res jsonb)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare v_uid uuid := auth.uid(); v_e escaneos_nutricion; v_p pautas_nutricion; v_est text; v_nom text;
begin
  if v_uid is null then raise exception 'no autenticado'; end if;
  select * into v_e from escaneos_nutricion where id = p_id and socio_id = v_uid and estado = 'listo';
  if v_e.id is null then raise exception 'escaneo no encontrado'; end if;
  if p_num is null or p_num < 1 or p_num > 12 then raise exception 'comida inválida'; end if;
  select * into v_p from pautas_nutricion where socio_id = v_uid and estado = 'publicada' limit 1;
  if v_p.id is null then raise exception 'sin pauta publicada'; end if;
  if p_num > jsonb_array_length(coalesce(v_p.contenido->'comidas', '[]'::jsonb)) then raise exception 'tu plan no tiene esa comida'; end if;
  if p_res->>'veredicto' not in ('adecuado','relativo','alerta') then raise exception 'resultado inválido'; end if;
  v_est := case when coalesce((p_res->>'cheat')::boolean, false) then 'cheat' else 'cumplida' end;
  v_nom := koach_comida_nombre(v_p, p_num);
  update escaneos_nutricion set confirmado = true, comida_num = p_num, comida = v_nom,
    comidas_total = jsonb_array_length(coalesce(v_p.contenido->'comidas', '[]'::jsonb)),
    veredicto = p_res->>'veredicto', puntaje = nullif(p_res->>'puntaje', '')::numeric::integer,
    cheat = coalesce((p_res->>'cheat')::boolean, false), plato = left(coalesce(p_det->>'plato', plato), 80),
    kcal = nullif(p_res#>>'{totales,kcal}', '')::numeric::integer,
    proteina_g = nullif(p_res#>>'{totales,proteina_g}', '')::numeric,
    carbohidrato_g = nullif(p_res#>>'{totales,carbohidrato_g}', '')::numeric,
    grasa_g = nullif(p_res#>>'{totales,grasa_g}', '')::numeric,
    deteccion = coalesce(p_det, deteccion), resultado = p_res
  where id = p_id;
  insert into registro_comidas (socio_id, pauta_id, fecha, comida_num, comida, estado, origen, escaneo_id, kcal, proteina_g, carbohidrato_g, grasa_g, alertas)
  values (v_uid, v_p.id, v_e.fecha, p_num, v_nom, v_est, 'escaneo', p_id,
    nullif(p_res#>>'{totales,kcal}', '')::numeric::integer, nullif(p_res#>>'{totales,proteina_g}', '')::numeric,
    nullif(p_res#>>'{totales,carbohidrato_g}', '')::numeric, nullif(p_res#>>'{totales,grasa_g}', '')::numeric,
    (select coalesce(jsonb_agg(b->>'tipo'), '[]'::jsonb) from jsonb_array_elements(coalesce(p_res->'banderas', '[]'::jsonb)) b))
  on conflict (socio_id, fecha, comida_num) do update set estado = excluded.estado, origen = 'escaneo', escaneo_id = excluded.escaneo_id,
    comida = excluded.comida, kcal = excluded.kcal, proteina_g = excluded.proteina_g, carbohidrato_g = excluded.carbohidrato_g,
    grasa_g = excluded.grasa_g, alertas = excluded.alertas, updated_at = now();
  return jsonb_build_object('ok', true, 'estado', v_est, 'fecha', v_e.fecha, 'comida_num', p_num);
end $$;

-- Lectura del registro: el socio el suyo; staff el de un socio. Últimos N días.
create or replace function public.koach_registro_comidas(p_socio uuid default null, p_dias integer default 14)
returns jsonb language plpgsql stable security definer set search_path to 'public' as $$
declare v_uid uuid := auth.uid(); v_rol text; v_sid uuid;
begin
  if v_uid is null then raise exception 'no autenticado'; end if;
  v_sid := coalesce(p_socio, v_uid);
  select role::text into v_rol from profiles where id = v_uid and coalesce(activo, true);
  if v_sid <> v_uid and coalesce(v_rol, '') not in ('admin','coach','nutricionista') then raise exception 'sin permiso'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('fecha', r.fecha, 'comida_num', r.comida_num, 'comida', r.comida, 'estado', r.estado,
      'origen', r.origen, 'escaneo_id', r.escaneo_id, 'kcal', r.kcal, 'proteina_g', r.proteina_g, 'carbohidrato_g', r.carbohidrato_g,
      'grasa_g', r.grasa_g, 'alertas', r.alertas) order by r.fecha desc, r.comida_num)
    from registro_comidas r where r.socio_id = v_sid
      and r.fecha >= (now() at time zone 'America/Santiago')::date - greatest(1, least(coalesce(p_dias, 14), 120))), '[]'::jsonb);
end $$;

revoke all on function public.koach_comida_marcar(integer, text, date) from public, anon;
revoke all on function public.koach_escaneo_confirmar(uuid, integer, jsonb, jsonb) from public, anon;
revoke all on function public.koach_registro_comidas(uuid, integer) from public, anon;
grant execute on function public.koach_comida_marcar(integer, text, date) to authenticated;
grant execute on function public.koach_escaneo_confirmar(uuid, integer, jsonb, jsonb) to authenticated;
grant execute on function public.koach_registro_comidas(uuid, integer) to authenticated;
