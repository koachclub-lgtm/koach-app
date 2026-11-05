-- NUTRICIÓN en la app del socio (17-oct-2026)
-- Reemplaza el PDF de Nutrición Pro: el plan nutricional se guarda ESTRUCTURADO (jsonb) y la app lo pinta como página.
-- Los números (kcal, macros, TDEE) los pone el motor/nutrición; la IA solo redacta comidas e indicaciones.
-- Estados: borrador → publicada (una sola vigente por socio; la anterior pasa a archivada, nunca se borra).

create table if not exists public.pautas_nutricion (
  id uuid primary key default gen_random_uuid(),
  socio_id uuid not null references public.profiles(id) on delete cascade,
  evaluacion_id uuid references public.evaluaciones_nutricion(id) on delete set null,
  fecha date not null default current_date,
  estado text not null default 'borrador' check (estado in ('borrador','publicada','archivada')),
  programa text,
  actividad text,
  tmb integer,
  tdee integer,
  kcal integer,
  proteina_g numeric,
  carbohidrato_g numeric,
  grasa_g numeric,
  contenido jsonb not null default '{}'::jsonb,
  intake jsonb not null default '{}'::jsonb,
  generado_ia boolean not null default false,
  modelo text,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  publicada_at timestamptz
);
alter table public.pautas_nutricion add column if not exists intake jsonb not null default '{}'::jsonb;
create index if not exists pautas_nut_socio_idx on public.pautas_nutricion (socio_id, fecha desc);
create unique index if not exists pautas_nut_una_vigente on public.pautas_nutricion (socio_id) where estado = 'publicada';

create or replace function public.koach_trg_pauta()
returns trigger language plpgsql set search_path to 'public' as $$
begin
  new.updated_at := now();
  if new.estado = 'publicada' and (tg_op = 'INSERT' or old.estado is distinct from 'publicada') then
    update pautas_nutricion set estado = 'archivada', updated_at = now()
     where socio_id = new.socio_id and estado = 'publicada' and id <> new.id;
    new.publicada_at := now();
  end if;
  return new;
end $$;
drop trigger if exists trg_pauta on public.pautas_nutricion;
create trigger trg_pauta before insert or update on public.pautas_nutricion
  for each row execute function public.koach_trg_pauta();

alter table public.pautas_nutricion enable row level security;
drop policy if exists pauta_staff on public.pautas_nutricion;
create policy pauta_staff on public.pautas_nutricion for all to authenticated
  using ((select koach_rol()) in ('admin','nutricionista'))
  with check ((select koach_rol()) in ('admin','nutricionista'));
drop policy if exists pauta_coach_lee on public.pautas_nutricion;
create policy pauta_coach_lee on public.pautas_nutricion for select to authenticated
  using ((select koach_rol()) = 'coach' and estado = 'publicada');
grant select, insert, update on public.pautas_nutricion to authenticated;

-- Lectura del plan: socio = solo la vigente (y solo con acceso al día) · coach = vigente · nutrición/admin = todas
create or replace function public.koach_pauta(p_socio uuid default null)
returns jsonb language plpgsql stable security definer set search_path to 'public' as $$
declare v_uid uuid := auth.uid(); v_rol text; v_sid uuid; v_full boolean;
begin
  if v_uid is null then raise exception 'no autenticado'; end if;
  v_sid := coalesce(p_socio, v_uid);
  select role::text into v_rol from profiles where id = v_uid and coalesce(activo, true);
  if v_sid <> v_uid and coalesce(v_rol, '') not in ('admin','coach','nutricionista') then raise exception 'sin permiso'; end if;
  v_full := coalesce(v_rol, '') in ('admin','nutricionista');
  if v_sid = v_uid and coalesce(v_rol, 'socio') = 'socio' and not koach_acceso_ok(v_uid) then
    return jsonb_build_object('bloqueado', true);
  end if;
  return jsonb_build_object(
    'vigente', (select to_jsonb(p) - 'created_by' from pautas_nutricion p where p.socio_id = v_sid and p.estado = 'publicada' limit 1),
    'todas', case when v_full then coalesce((select jsonb_agg(to_jsonb(p) order by p.fecha desc, p.created_at desc) from pautas_nutricion p where p.socio_id = v_sid), '[]'::jsonb) end,
    'puede_editar', v_full);
end $$;
revoke all on function public.koach_pauta(uuid) from public, anon;
grant execute on function public.koach_pauta(uuid) to authenticated;

-- Composición: el socio también recibe sus pliegues (los ve en su informe, igual que en el PDF) y queda bajo el control de acceso.
create or replace function public.koach_composicion(p_socio uuid default null)
returns jsonb language plpgsql stable security definer set search_path to 'public' as $$
declare v_uid uuid := auth.uid(); v_rol text; v_sid uuid; v_full boolean; v_res jsonb;
begin
  if v_uid is null then raise exception 'no autenticado'; end if;
  v_sid := coalesce(p_socio, v_uid);
  select role::text into v_rol from profiles where id = v_uid and coalesce(activo, true);
  if v_sid <> v_uid and coalesce(v_rol, '') not in ('admin', 'coach', 'nutricionista') then raise exception 'sin permiso'; end if;
  v_full := coalesce(v_rol, '') in ('admin', 'nutricionista');
  if v_sid = v_uid and coalesce(v_rol, 'socio') = 'socio' and not koach_acceso_ok(v_uid) then
    return jsonb_build_object('evaluaciones', '[]'::jsonb, 'bloqueado', true, 'puede_editar', false);
  end if;
  with ev as (
    select e.*, lag(e.fecha) over (order by e.fecha, e.created_at) as fecha_prev
    from evaluaciones_nutricion e
    where e.socio_id = v_sid and (v_full or e.estado = 'publicada')
  )
  select coalesce(jsonb_agg(
    jsonb_strip_nulls(jsonb_build_object(
      'id', ev.id, 'fecha', ev.fecha, 'estado', ev.estado,
      'peso_kg', ev.peso_kg, 'talla_cm', ev.talla_cm, 'sexo_eval', ev.sexo_eval, 'edad_eval', ev.edad_eval,
      'porcentaje_grasa', case when ev.grasa_medida then ev.porcentaje_grasa end,
      'masa_grasa_kg', case when ev.grasa_medida then ev.masa_grasa_kg end,
      'masa_muscular_kg', case when ev.musculo_medido then ev.masa_muscular_kg end,
      'masa_osea_kg', ev.masa_osea_kg, 'masa_residual_kg', ev.masa_residual_kg,
      'cintura_cm', ev.cintura_cm, 'cadera_cm', ev.cadera_cm, 'brazo_cm', ev.brazo_relajado_cm,
      'muslo_cm', ev.muslo_cm, 'pantorrilla_cm', ev.pantorrilla_cm,
      'triceps_mm', ev.triceps_mm, 'biceps_mm', ev.biceps_mm, 'subescapular_mm', ev.subescapular_mm,
      'cresta_iliaca_mm', ev.cresta_iliaca_mm, 'supraespinal_mm', ev.supraespinal_mm, 'abdominal_mm', ev.abdominal_mm,
      'muslo_mm', ev.muslo_mm, 'pantorrilla_mm', ev.pantorrilla_mm,
      'suma6_mm', ev.suma6_mm, 'suma8_mm', ev.suma8_mm, 'ffmi_norm', ev.ffmi_norm, 'icc', ev.icc, 'ict', ev.ict,
      'edad_biologica', ev.edad_biologica,
      'kcal_objetivo', ev.kcal_objetivo, 'proteina_g', ev.proteina_g, 'carbohidrato_g', ev.carbohidrato_g, 'grasa_g', ev.grasa_g,
      'nota_socio', ev.nota_socio,
      'sesiones_periodo', case when ev.fecha_prev is not null then
         (select count(*) from sesiones_registro r where r.socio_id = v_sid and r.estado::text is distinct from 'anulada'
            and r.fecha > ev.fecha_prev and r.fecha <= ev.fecha) end,
      'dias_periodo', case when ev.fecha_prev is not null then ev.fecha - ev.fecha_prev end
    )) || case when v_full then jsonb_strip_nulls(jsonb_build_object(
      'notas', ev.notas, 'ffmi', ev.ffmi, 'motor_version', ev.motor_version, 'grasa_medida', ev.grasa_medida,
      'musculo_medido', ev.musculo_medido, 'publicada_at', ev.publicada_at)) else '{}'::jsonb end
    order by ev.fecha, ev.created_at), '[]'::jsonb)
  into v_res from ev;
  return jsonb_build_object('evaluaciones', v_res, 'puede_editar', v_full);
end $$;
revoke all on function public.koach_composicion(uuid) from public, anon;
grant execute on function public.koach_composicion(uuid) to authenticated;
