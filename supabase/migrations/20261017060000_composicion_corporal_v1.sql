-- Composición corporal unificada (17-oct-2026)
-- Las evaluaciones ISAK que hacía Nutrición Pro (proyecto aparte) pasan a vivir en el ecosistema KOACH:
-- nutrición/admin registran en el dashboard (ficha del socio → COMPOSICIÓN) y el socio ve sus informes y su
-- progreso en AVANCES → COMPOSICIÓN CORPORAL. Motor: domain/koach-composicion.js (versionado y con tests).

alter table public.evaluaciones_nutricion
  add column if not exists biceps_mm numeric,
  add column if not exists cresta_iliaca_mm numeric,
  add column if not exists pantorrilla_cm numeric,
  add column if not exists sexo_eval text,
  add column if not exists edad_eval integer,
  add column if not exists suma6_mm numeric,
  add column if not exists suma8_mm numeric,
  add column if not exists ffmi numeric,
  add column if not exists ffmi_norm numeric,
  add column if not exists icc numeric,
  add column if not exists ict numeric,
  add column if not exists edad_biologica numeric,
  add column if not exists grasa_medida boolean not null default false,
  add column if not exists musculo_medido boolean not null default false,
  add column if not exists motor_version text,
  add column if not exists estado text not null default 'borrador',
  add column if not exists publicada_at timestamptz,
  add column if not exists nota_socio text,
  add column if not exists updated_at timestamptz default now();

do $$ begin
  alter table public.evaluaciones_nutricion add constraint evn_estado_chk check (estado in ('borrador','publicada'));
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.evaluaciones_nutricion add constraint evn_socio_fk foreign key (socio_id) references public.profiles(id) on delete cascade;
exception when duplicate_object then null; end $$;

create index if not exists evn_socio_fecha_idx on public.evaluaciones_nutricion (socio_id, fecha);

create or replace function public.koach_trg_evn()
returns trigger language plpgsql set search_path to 'public' as $$
begin
  new.updated_at := now();
  if new.estado = 'publicada' and (tg_op = 'INSERT' or old.estado is distinct from 'publicada') then new.publicada_at := now(); end if;
  if new.estado = 'borrador' then new.publicada_at := null; end if;
  if tg_op = 'INSERT' and new.nutricionista_id is null then new.nutricionista_id := auth.uid(); end if;
  return new;
end $$;
drop trigger if exists trg_evn on public.evaluaciones_nutricion;
create trigger trg_evn before insert or update on public.evaluaciones_nutricion
  for each row execute function public.koach_trg_evn();

-- El socio deja de leer la tabla directo (exponía notas internas y borradores): lee por RPC.
drop policy if exists nut_socio on public.evaluaciones_nutricion;
drop policy if exists nut_coach_lee on public.evaluaciones_nutricion;
create policy nut_coach_lee on public.evaluaciones_nutricion for select to authenticated
  using ((select koach_rol()) = 'coach' and estado = 'publicada');

-- Lectura única: socio = solo publicadas y sin datos internos · coach = publicadas · nutrición/admin = todo
create or replace function public.koach_composicion(p_socio uuid default null)
returns jsonb language plpgsql stable security definer set search_path to 'public' as $$
declare v_uid uuid := auth.uid(); v_rol text; v_sid uuid; v_full boolean; v_res jsonb;
begin
  if v_uid is null then raise exception 'no autenticado'; end if;
  v_sid := coalesce(p_socio, v_uid);
  select role::text into v_rol from profiles where id = v_uid and coalesce(activo, true);
  if v_sid <> v_uid and coalesce(v_rol, '') not in ('admin', 'coach', 'nutricionista') then raise exception 'sin permiso'; end if;
  v_full := coalesce(v_rol, '') in ('admin', 'nutricionista');
  with ev as (
    select e.*, lag(e.fecha) over (order by e.fecha, e.created_at) as fecha_prev
    from evaluaciones_nutricion e
    where e.socio_id = v_sid and (v_full or e.estado = 'publicada')
  )
  select coalesce(jsonb_agg(
    jsonb_strip_nulls(jsonb_build_object(
      'id', ev.id, 'fecha', ev.fecha, 'estado', ev.estado,
      'peso_kg', ev.peso_kg, 'talla_cm', ev.talla_cm,
      'porcentaje_grasa', case when ev.grasa_medida then ev.porcentaje_grasa end,
      'masa_grasa_kg', case when ev.grasa_medida then ev.masa_grasa_kg end,
      'masa_muscular_kg', case when ev.musculo_medido then ev.masa_muscular_kg end,
      'masa_osea_kg', ev.masa_osea_kg, 'masa_residual_kg', ev.masa_residual_kg,
      'cintura_cm', ev.cintura_cm, 'cadera_cm', ev.cadera_cm, 'brazo_cm', ev.brazo_relajado_cm,
      'muslo_cm', ev.muslo_cm, 'pantorrilla_cm', ev.pantorrilla_cm,
      'suma6_mm', ev.suma6_mm, 'suma8_mm', ev.suma8_mm, 'ffmi_norm', ev.ffmi_norm, 'icc', ev.icc, 'ict', ev.ict,
      'edad_eval', ev.edad_eval, 'edad_biologica', ev.edad_biologica,
      'kcal_objetivo', ev.kcal_objetivo, 'proteina_g', ev.proteina_g, 'carbohidrato_g', ev.carbohidrato_g, 'grasa_g', ev.grasa_g,
      'nota_socio', ev.nota_socio,
      'sesiones_periodo', case when ev.fecha_prev is not null then
         (select count(*) from sesiones_registro r where r.socio_id = v_sid and coalesce(r.estado, '') <> 'anulada'
            and r.fecha > ev.fecha_prev and r.fecha <= ev.fecha) end,
      'dias_periodo', case when ev.fecha_prev is not null then ev.fecha - ev.fecha_prev end
    )) || case when v_full then jsonb_strip_nulls(jsonb_build_object(
      'notas', ev.notas, 'sexo_eval', ev.sexo_eval,
      'triceps_mm', ev.triceps_mm, 'biceps_mm', ev.biceps_mm, 'subescapular_mm', ev.subescapular_mm,
      'cresta_iliaca_mm', ev.cresta_iliaca_mm, 'supraespinal_mm', ev.supraespinal_mm, 'abdominal_mm', ev.abdominal_mm,
      'muslo_mm', ev.muslo_mm, 'pantorrilla_mm', ev.pantorrilla_mm,
      'ffmi', ev.ffmi, 'motor_version', ev.motor_version, 'grasa_medida', ev.grasa_medida,
      'musculo_medido', ev.musculo_medido, 'publicada_at', ev.publicada_at)) else '{}'::jsonb end
    order by ev.fecha, ev.created_at), '[]'::jsonb)
  into v_res from ev;
  return jsonb_build_object('evaluaciones', v_res, 'puede_editar', v_full);
end $$;
revoke all on function public.koach_composicion(uuid) from public, anon;
grant execute on function public.koach_composicion(uuid) to authenticated;
