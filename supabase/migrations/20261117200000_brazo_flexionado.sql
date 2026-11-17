-- c291 · ISAK: perímetro de brazo flexionado y contraído (lo pidió nutrición)
alter table public.evaluaciones_nutricion add column if not exists brazo_flexionado_cm numeric(5,1)
  check (brazo_flexionado_cm is null or brazo_flexionado_cm between 10 and 80);

CREATE OR REPLACE FUNCTION public.koach_composicion(p_socio uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
      'cintura_cm', ev.cintura_cm, 'cadera_cm', ev.cadera_cm, 'brazo_cm', ev.brazo_relajado_cm, 'brazo_flex_cm', ev.brazo_flexionado_cm,
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
end $function$;
