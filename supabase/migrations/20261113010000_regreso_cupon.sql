-- Reactivación de ex socios (campaña "regreso App KOACH"):
--  · cupón de descuento en el PRIMER cobro del pago automático (Flow coupon, duración 1 período)
--  · regreso_preparar: crea/ubica la cuenta y deja su tarifa automática lista, desde Jake (service_role)
alter table tarifas_auto_socio add column if not exists cupon_monto integer check (cupon_monto is null or cupon_monto > 0);
alter table tarifas_auto_socio add column if not exists vence_at timestamptz;
alter table flow_suscripciones add column if not exists cupon_monto integer;
alter table flow_suscripciones add column if not exists flow_coupon_id text;

create or replace function public.tarifa_auto_de(p_socio uuid)
 returns jsonb language sql stable security definer set search_path to 'public'
as $function$
  select coalesce(
    (select jsonb_build_object('monto',monto,'tipo_comercial',tipo_comercial,'personalizada',true,'nota',nota,
                               'permanencia_meses',permanencia_meses,'periodo_meses',periodo_meses,
                               'cupon_monto',cupon_monto,'vence_at',vence_at)
       from tarifas_auto_socio where socio_id=p_socio and (vence_at is null or vence_at > now())),
    (select jsonb_build_object('monto',(valor->>'monto')::int,'tipo_comercial',coalesce(valor->>'tipo_comercial','promocion'),'personalizada',false,
                               'permanencia_meses',coalesce((valor->>'permanencia_meses')::int,0),'periodo_meses',1)
       from config_pagos where clave='mensual_auto_default'),
    jsonb_build_object('monto',70000,'tipo_comercial','promocion','personalizada',false,'permanencia_meses',12,'periodo_meses',1))
  || jsonb_build_object('precio_lista', coalesce((select (valor->>'monto')::int from config_pagos where clave='precio_lista_mensual'),80000))
$function$;

-- Cobro automático: el primer cobro de una suscripción con cupón llega por (monto − cupón)
create or replace function public.flow_cobro_procesar(p_token text, p_status jsonb)
 returns jsonb language plpgsql security definer set search_path to 'public'
as $function$
declare v_fo bigint := nullif(p_status->>'flowOrder','')::bigint; v_st int := (p_status->>'status')::int;
  v_amt int := round((p_status->>'amount')::numeric)::int; v_payer text := lower(coalesce(p_status->>'payer',''));
  c flow_cobros; s flow_suscripciones; r jsonb; n int; v_previos int;
begin
  perform pg_advisory_xact_lock(hashtext('flow_cobro:'||coalesce(v_fo::text,p_token)));
  select * into c from flow_cobros where flow_token=p_token or (v_fo is not null and flow_order=v_fo) limit 1;
  if c.id is not null and c.estado='acreditado' then return jsonb_build_object('estado','acreditado','ya_procesado',true); end if;

  select count(*) into n from flow_suscripciones where lower(email)=v_payer and estado in ('activa','cancelada_fin_periodo') and flow_subscription_id is not null;
  if n = 1 then select * into s from flow_suscripciones where lower(email)=v_payer and estado in ('activa','cancelada_fin_periodo') and flow_subscription_id is not null; end if;

  if c.id is null then
    insert into flow_cobros(flow_token, flow_order, suscripcion_id, socio_id, monto, flow_estado, estado, flow_status)
    values (p_token, v_fo, s.id, s.socio_id, v_amt, v_st, 'pendiente', p_status) returning * into c;
  else
    update flow_cobros set flow_status=p_status, flow_estado=v_st, monto=v_amt, suscripcion_id=coalesce(suscripcion_id,s.id), socio_id=coalesce(socio_id,s.socio_id), updated_at=now() where id=c.id returning * into c;
  end if;

  if v_st = 1 then return jsonb_build_object('estado','pendiente'); end if;
  if v_st <> 2 then update flow_cobros set estado='rechazado', updated_at=now() where id=c.id; return jsonb_build_object('estado','rechazado'); end if;
  if s.id is null then
    update flow_cobros set estado='sin_match', error='no se identificó una única suscripción para '||v_payer, updated_at=now() where id=c.id;
    return jsonb_build_object('estado','sin_match');
  end if;
  select count(*) into v_previos from flow_cobros where suscripcion_id=s.id and estado='acreditado' and id<>c.id;
  if v_amt <> s.monto and not (v_previos = 0 and coalesce(s.cupon_monto,0) > 0 and v_amt = s.monto - s.cupon_monto) then
    update flow_cobros set estado='error', error='monto '||v_amt||' distinto al plan '||s.monto, updated_at=now() where id=c.id;
    return jsonb_build_object('estado','error');
  end if;
  r := public._int_venta_registrar(s.socio_id, jsonb_build_object(
        'plan_id', s.plan_id, 'duracion_tipo','mes', 'duracion_valor', s.duracion_valor,
        'monto', v_amt, 'estado','pagado', 'metodo','flow', 'tipo_comercial', coalesce(s.tipo_comercial,'normal'),
        'fecha', (now() at time zone 'America/Santiago')::date,
        'referencia', 'FLOW AUTO '||coalesce(v_fo::text,'')||' · '||coalesce(s.flow_subscription_id,''),
        'observacion', 'Pago automático Flow (CONFIRMO: cobro recurrente verificado por Flow)'
                       || case when v_amt <> s.monto then ' · primer mes con cupón de '||s.cupon_monto else '' end),
       null, 'FLOW · pago automático');
  update flow_cobros set estado='acreditado', venta=r, error=null, updated_at=now() where id=c.id;
  return jsonb_build_object('estado','acreditado','venta',r);
end $function$;

-- Ubica o crea la cuenta (misma lógica que flow_link_preparar) y deja la tarifa automática de la oferta
create or replace function public.regreso_preparar(p_telefono text, p_email text, p_nombre text, p_apellido text, p_oferta jsonb)
 returns jsonb language plpgsql security definer set search_path to 'public', 'auth', 'extensions'
as $function$
declare
  v_tel text := public.normalizar_telefono_cl(p_telefono);
  v_email text := lower(trim(coalesce(p_email, '')));
  v_nombre text := initcap(trim(coalesce(p_nombre, '')));
  v_apellido text := initcap(trim(coalesce(p_apellido, '')));
  v_monto int := (p_oferta->>'monto')::int;
  v_cupon int := nullif(p_oferta->>'cupon_monto','')::int;
  v_perm int := coalesce((p_oferta->>'permanencia_meses')::int, 12);
  v_vence timestamptz := nullif(p_oferta->>'hasta','')::timestamptz;
  p profiles; v_nueva boolean := false; v_fin date;
begin
  if coalesce(auth.role(), '') <> 'service_role' then raise exception 'no autorizado'; end if;
  if v_monto is null or v_monto < 350 then raise exception 'REGRESO: monto no válido'; end if;
  if v_cupon is not null and v_cupon >= v_monto then raise exception 'REGRESO: cupón no válido'; end if;

  if v_tel is not null then
    select * into p from profiles where role = 'socio' and coalesce(estado, 'activo') <> 'fusionado'
       and (telefono_wa = v_tel or public.normalizar_telefono_cl(telefono) = v_tel) order by created_at limit 1;
  end if;
  if p.id is null and v_email <> '' then
    select * into p from profiles where lower(email) = v_email and coalesce(estado, 'activo') <> 'fusionado' limit 1;
  end if;
  if p.id is not null and p.role <> 'socio' then raise exception 'REGRESO: ese correo pertenece al equipo'; end if;

  if p.id is null then
    if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'REGRESO: falta un correo válido para crear la cuenta'; end if;
    if length(v_nombre) < 2 then raise exception 'REGRESO: falta el nombre'; end if;
    if length(v_apellido) < 2 then v_apellido := '·'; end if;
    p.id := public._int_crear_cuenta_auth(v_email, encode(gen_random_bytes(18), 'hex'), v_nombre, v_apellido);
    insert into profiles(id, role, nombre, apellido, email, telefono, telefono_wa, activo, estado, registro_origen)
    values (p.id, 'socio', v_nombre, v_apellido, v_email, v_tel, v_tel, true, 'activo', 'jake');
    select * into p from profiles where id = p.id;
    v_nueva := true;
  else
    -- la oferta es para quien NO tiene membresía vigente
    select max(fecha_fin) into v_fin from membresias where socio_id = p.id and estado <> 'cancelada';
    if v_fin is not null and v_fin >= (now() at time zone 'America/Santiago')::date then
      raise exception 'REGRESO: ya tienes una membresía vigente hasta el %', to_char(v_fin, 'DD-MM-YYYY');
    end if;
    if p.telefono_wa is null and v_tel is not null then update profiles set telefono_wa = v_tel where id = p.id; end if;
  end if;
  if v_tel is not null then update jake_contactos set socio_id = p.id where telefono = v_tel and socio_id is null; end if;

  insert into tarifas_auto_socio(socio_id, monto, tipo_comercial, nota, permanencia_meses, periodo_meses, cupon_monto, vence_at, actualizado_por_nombre, updated_at)
  values (p.id, v_monto, 'promocion', coalesce(p_oferta->>'nota', 'Regreso App KOACH'), v_perm, 1, v_cupon, v_vence, 'JAKE · campaña regreso', now())
  on conflict (socio_id) do update set monto = excluded.monto, tipo_comercial = excluded.tipo_comercial, nota = excluded.nota,
    permanencia_meses = excluded.permanencia_meses, periodo_meses = 1, cupon_monto = excluded.cupon_monto, vence_at = excluded.vence_at,
    actualizado_por_nombre = excluded.actualizado_por_nombre, updated_at = now();

  return jsonb_build_object('socio_id', p.id, 'cuenta_nueva', v_nueva, 'email', coalesce(p.email, v_email), 'nombre', p.nombre);
end $function$;
revoke all on function public.regreso_preparar(text, text, text, text, jsonb) from public, anon, authenticated;
