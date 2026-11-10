-- Dashboard: la tarifa automática por socio también fija la periodicidad (cobro cada 1, 2, 3, 4, 6 o 12 meses).
drop function if exists public.admin_tarifa_auto_set(uuid, integer, text, text, text, integer);
create or replace function public.admin_tarifa_auto_set(p_socio uuid, p_monto integer, p_tc text default null, p_nota text default null,
  p_actor_nombre text default null, p_permanencia integer default 12, p_periodo integer default 1)
returns jsonb language plpgsql security definer set search_path to 'public' as $function$
declare v_tc text; v_cat int; v_per int := coalesce(p_periodo,1);
begin
  if not public.es_comercial() then raise exception 'PERMISO_DENEGADO: tu rol no permite esta acción' using errcode='42501'; end if;
  if p_monto is null then delete from tarifas_auto_socio where socio_id=p_socio; return public.tarifa_auto_de(p_socio); end if;
  if p_monto < 350 then raise exception 'TARIFA: el monto mínimo es $350'; end if;
  if coalesce(p_permanencia,0) not between 0 and 24 then raise exception 'TARIFA: permanencia no válida'; end if;
  if v_per not in (1,2,3,4,6,12) then raise exception 'TARIFA: periodicidad no válida'; end if;
  select precio into v_cat from planes where activo and hora_limite is null and duracion_tipo='mes' and duracion_valor=1 limit 1;
  v_cat := v_cat * v_per;
  v_tc := case when p_monto = v_cat then 'normal' else coalesce(nullif(nullif(p_tc,''),'normal'), case when p_monto < v_cat then 'descuento' else 'otro' end) end;
  insert into tarifas_auto_socio(socio_id, monto, tipo_comercial, nota, permanencia_meses, periodo_meses, actualizado_por, actualizado_por_nombre, updated_at)
  values (p_socio, p_monto, v_tc, nullif(trim(p_nota),''), coalesce(p_permanencia,0), v_per, auth.uid(), p_actor_nombre, now())
  on conflict (socio_id) do update set monto=excluded.monto, tipo_comercial=excluded.tipo_comercial, nota=excluded.nota, permanencia_meses=excluded.permanencia_meses,
    periodo_meses=excluded.periodo_meses, actualizado_por=excluded.actualizado_por, actualizado_por_nombre=excluded.actualizado_por_nombre, updated_at=now();
  insert into admin_eventos(socio_id, entidad, entidad_id, accion, despues, actor_id, actor_nombre, motivo)
  values (p_socio, 'tarifa_auto', p_socio, 'asignar', jsonb_build_object('monto',p_monto,'tipo_comercial',v_tc,'permanencia_meses',coalesce(p_permanencia,0),'periodo_meses',v_per), auth.uid(), p_actor_nombre, nullif(trim(p_nota),''));
  return public.tarifa_auto_de(p_socio);
end $function$;
revoke all on function public.admin_tarifa_auto_set(uuid, integer, text, text, text, integer, integer) from public, anon;
grant execute on function public.admin_tarifa_auto_set(uuid, integer, text, text, text, integer, integer) to authenticated;
