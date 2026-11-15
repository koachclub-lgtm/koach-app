-- NUTRICIÓN · REGISTRO SIN PLAN (15-nov-2026)
-- Los socios sin pauta publicada pueden escanear y registrar sus comidas (calorías y macros del día) mientras agendan con nutrición.
create or replace function public.koach_escaneo_confirmar(p_id uuid, p_num integer, p_det jsonb, p_res jsonb)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare v_uid uuid := auth.uid(); v_e escaneos_nutricion; v_p pautas_nutricion; v_est text; v_nom text; v_n integer; v_cheat boolean;
begin
  if v_uid is null then raise exception 'no autenticado'; end if;
  select * into v_e from escaneos_nutricion where id = p_id and socio_id = v_uid and estado = 'listo';
  if v_e.id is null then raise exception 'escaneo no encontrado'; end if;
  if p_num is null or p_num < 1 or p_num > 12 then raise exception 'comida inválida'; end if;
  select * into v_p from pautas_nutricion where socio_id = v_uid and estado = 'publicada' limit 1;
  -- sin plan publicado también se registra: las comidas se numeran libres (1..12) y suman calorías y macros del día
  v_n := case when v_p.id is null then 0 else jsonb_array_length(coalesce(v_p.contenido->'comidas', '[]'::jsonb)) end;
  if p_res->>'veredicto' not in ('adecuado','relativo','alerta') then raise exception 'resultado inválido'; end if;
  v_cheat := coalesce((p_res->>'cheat')::boolean, false);
  if v_n > 0 and p_num > v_n and not v_cheat then raise exception 'tu plan no tiene esa comida'; end if;   -- extra: solo como cheat meal
  v_est := case when v_cheat then 'cheat' else 'cumplida' end;
  v_nom := case when v_n = 0 then left(coalesce(nullif(p_det->>'plato', ''), 'Comida ' || p_num), 40) when p_num > v_n then left(coalesce(nullif(p_det->>'plato', ''), 'Fuera del plan'), 40) else koach_comida_nombre(v_p, p_num) end;
  update escaneos_nutricion set confirmado = true, comida_num = p_num, comida = v_nom, comidas_total = v_n,
    veredicto = p_res->>'veredicto', puntaje = nullif(p_res->>'puntaje', '')::numeric::integer,
    cheat = v_cheat, plato = left(coalesce(p_det->>'plato', plato), 80),
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
  return jsonb_build_object('ok', true, 'estado', v_est, 'fecha', v_e.fecha, 'comida_num', p_num, 'extra', v_n > 0 and p_num > v_n, 'sin_plan', v_n = 0);
end $$;

