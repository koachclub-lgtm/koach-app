-- Ofertas exclusivas por socio (Dashboard · PERFIL · OFERTA DE PLANES SUGERIDOS)
--  · fidelidad 12 meses = tarifas_auto_socio (siempre)
--  · ofertas opcionales = cobros_socio pendientes: pago único (ej. 12 meses $420.000) o recurrente cada N meses (ej. 3 meses $150.000)
--  · varias ofertas pendientes a la vez (antes se anulaban entre sí)
--  · solo la cuenta admin matias@koachclub.cl puede crearlas o anularlas
alter table cobros_socio add column if not exists permanencia_meses integer not null default 0 check (permanencia_meses between 0 and 24);
alter table flow_suscripciones add column if not exists cobro_id uuid references cobros_socio(id);

create or replace function public._es_admin_tarifas() returns boolean language sql stable security definer set search_path to 'public' as $$
  select lower(coalesce(auth.jwt()->>'email','')) = 'matias@koachclub.cl' and public.es_comercial()
$$;

drop function if exists public.admin_cobro_crear(uuid, integer, text, integer, text, boolean, text, text);
create or replace function public.admin_cobro_crear(p_socio uuid, p_monto integer, p_dur_tipo text, p_dur_valor integer, p_tc text default 'promocion',
  p_recurrente boolean default false, p_concepto text default null, p_actor_nombre text default null, p_permanencia integer default 0)
returns cobros_socio language plpgsql security definer set search_path to 'public' as $function$
declare r cobros_socio; v_tc text := coalesce(nullif(p_tc,''),'promocion'); n int;
begin
  if not public._es_admin_tarifas() then raise exception 'PERMISO_DENEGADO: solo la cuenta admin de Matías puede asignar ofertas' using errcode='42501'; end if;
  if p_monto is null or p_monto < 350 then raise exception 'COBRO: el monto mínimo en línea es $350'; end if;
  if p_recurrente and p_dur_tipo <> 'mes' then raise exception 'COBRO: el pago automático solo funciona con duración en meses'; end if;
  if p_recurrente and p_dur_valor not in (1,2,3,4,6,12) then raise exception 'COBRO: periodicidad no válida para pago automático'; end if;
  if coalesce(p_permanencia,0) not between 0 and 24 then raise exception 'COBRO: permanencia no válida'; end if;
  if v_tc not in ('normal','promocion','descuento','convenio','otro') then raise exception 'COBRO: tipo comercial no válido'; end if;
  select count(*) into n from cobros_socio where socio_id=p_socio and estado='pendiente';
  if n >= 4 then raise exception 'COBRO: máximo 4 ofertas pendientes por socio'; end if;
  insert into cobros_socio(socio_id, monto, duracion_tipo, duracion_valor, tipo_comercial, recurrente, concepto, permanencia_meses, creado_por, creado_por_nombre)
  values (p_socio, p_monto, p_dur_tipo, p_dur_valor, v_tc, coalesce(p_recurrente,false), nullif(trim(p_concepto),''), case when p_recurrente then coalesce(p_permanencia,0) else 0 end, auth.uid(), p_actor_nombre)
  returning * into r;
  insert into admin_eventos(socio_id, entidad, entidad_id, accion, despues, actor_id, actor_nombre, motivo)
  values (p_socio, 'oferta', r.id, 'crear', to_jsonb(r), auth.uid(), p_actor_nombre, r.concepto);
  return r;
end $function$;
revoke all on function public.admin_cobro_crear(uuid, integer, text, integer, text, boolean, text, text, integer) from public, anon;
grant execute on function public.admin_cobro_crear(uuid, integer, text, integer, text, boolean, text, text, integer) to authenticated;

create or replace function public.admin_cobro_anular(p_id uuid)
returns void language plpgsql security definer set search_path to 'public' as $function$
begin
  if not public._es_admin_tarifas() then raise exception 'PERMISO_DENEGADO: solo la cuenta admin de Matías puede anular ofertas' using errcode='42501'; end if;
  update cobros_socio set estado='anulado', resuelto_at=now() where id=p_id and estado='pendiente';
end $function$;

-- una oferta recurrente queda "activada" cuando su pago automático se activa en Flow
create or replace function public._cobro_activado() returns trigger language plpgsql security definer set search_path to 'public' as $$
begin
  if new.cobro_id is not null and new.estado='activa' and (tg_op='INSERT' or old.estado is distinct from 'activa') then
    update cobros_socio set estado='activado', resuelto_at=now() where id=new.cobro_id and estado='pendiente';
  end if;
  return new;
end $$;
drop trigger if exists trg_cobro_activado on flow_suscripciones;
create trigger trg_cobro_activado after insert or update of estado on flow_suscripciones for each row execute function public._cobro_activado();

-- el staff ve las ofertas pendientes del socio en la ficha
grant select on cobros_socio to authenticated;
