-- Links de pago Flow creados por Jake / el panel para ofertas personalizadas.
-- 1) flow_link_preparar: busca (o crea) la cuenta del cliente y deja la orden lista con el precio de la oferta.
-- 2) La Edge Function flow-link crea el pago en Flow para esa orden (solo órdenes origen 'jake' recién creadas).
-- 3) Al quedar pagada, flow_procesar registra la venta y un trigger avisa a Jake para confirmar por WhatsApp.

alter table public.flow_ordenes
  add column if not exists origen text not null default 'app',
  add column if not exists telefono text,
  add column if not exists oferta text,
  add column if not exists cuenta_nueva boolean not null default false,
  add column if not exists aviso_jake_at timestamptz;

create or replace function public.flow_link_preparar(
  p_telefono text, p_email text, p_nombre text, p_apellido text, p_oferta jsonb)
returns jsonb
language plpgsql security definer
set search_path to 'public', 'auth', 'extensions'
as $$
declare
  v_tel text := public.normalizar_telefono_cl(p_telefono);
  v_email text := lower(trim(coalesce(p_email, '')));
  v_nombre text := initcap(trim(coalesce(p_nombre, '')));
  v_apellido text := initcap(trim(coalesce(p_apellido, '')));
  v_monto int := (p_oferta->>'monto')::int;
  v_tipo text := coalesce(p_oferta->>'duracion_tipo', 'mes');
  v_val int := (p_oferta->>'duracion_valor')::int;
  v_tc text := coalesce(nullif(p_oferta->>'tipo_comercial', ''), 'promocion');
  v_plan uuid := nullif(p_oferta->>'plan_id', '')::uuid;
  p profiles; v_nueva boolean := false; o flow_ordenes;
begin
  if coalesce(auth.role(), '') <> 'service_role' then raise exception 'no autorizado'; end if;
  if v_monto is null or v_monto < 350 then raise exception 'LINK: monto no válido'; end if;
  if v_val is null or v_val < 1 or v_val > 24 or v_tipo not in ('mes', 'semana', 'dia') then raise exception 'LINK: duración no válida'; end if;
  if v_tc not in ('normal', 'promocion', 'descuento', 'convenio') then raise exception 'LINK: tipo de venta no válido'; end if;

  -- 1) Cuenta existente: por teléfono de WhatsApp, luego por correo.
  if v_tel is not null then
    select * into p from profiles
     where role = 'socio' and coalesce(estado, 'activo') <> 'fusionado'
       and (telefono_wa = v_tel or public.normalizar_telefono_cl(telefono) = v_tel)
     order by created_at limit 1;
  end if;
  if p.id is null and v_email <> '' then
    select * into p from profiles where lower(email) = v_email and coalesce(estado, 'activo') <> 'fusionado' limit 1;
  end if;

  -- 2) Cuenta nueva: se crea con clave aleatoria; tras pagar, Jake le envía el link para crear su clave.
  if p.id is null then
    if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'LINK: falta un correo válido para crear la cuenta'; end if;
    if length(v_nombre) < 2 then raise exception 'LINK: falta el nombre'; end if;
    if length(v_apellido) < 2 then v_apellido := '·'; end if;
    p.id := public._int_crear_cuenta_auth(v_email, encode(gen_random_bytes(18), 'hex'), v_nombre, v_apellido);
    insert into profiles(id, role, nombre, apellido, email, telefono, telefono_wa, activo, estado, registro_origen)
    values (p.id, 'socio', v_nombre, v_apellido, v_email, v_tel, v_tel, true, 'activo', 'jake');
    select * into p from profiles where id = p.id;
    v_nueva := true;
  else
    if p.telefono_wa is null and v_tel is not null then update profiles set telefono_wa = v_tel where id = p.id; end if;
  end if;

  if v_tel is not null then update jake_contactos set socio_id = p.id where telefono = v_tel and socio_id is null; end if;

  insert into flow_ordenes(socio_id, plan_id, plan_nombre, monto, duracion_tipo, duracion_valor, email, tipo_comercial,
                           origen, telefono, oferta, cuenta_nueva)
  values (p.id, v_plan, coalesce(nullif(p_oferta->>'nombre', ''), v_val || ' ' || v_tipo), v_monto, v_tipo, v_val,
          coalesce(nullif(v_email, ''), p.email), v_tc, 'jake', v_tel, nullif(p_oferta->>'clave', ''), v_nueva)
  returning * into o;

  return jsonb_build_object('orden_id', o.id, 'commerce_order', o.commerce_order, 'socio_id', p.id,
                            'cuenta_nueva', v_nueva, 'email', o.email, 'nombre', p.nombre);
end $$;
revoke all on function public.flow_link_preparar(text, text, text, text, jsonb) from public, anon, authenticated;
grant execute on function public.flow_link_preparar(text, text, text, text, jsonb) to service_role;

-- Aviso a Jake cuando una orden creada por Jake queda pagada (confirma por WhatsApp y entrega acceso a la App).
create or replace function public.flow_orden_pagada_aviso()
returns trigger language plpgsql security definer set search_path to 'public' as $$
begin
  if new.estado = 'pagada' and old.estado is distinct from 'pagada' and new.origen = 'jake' then
    perform net.http_post(
      url := 'https://koach-jake.vercel.app/api/recordatorios?clave=koach-jake-c72a6d0f12711a2a31fbce4d&accion=pago_flow',
      body := jsonb_build_object('orden_id', new.id),
      headers := '{"Content-Type":"application/json"}'::jsonb,
      timeout_milliseconds := 30000);
  end if;
  return new;
end $$;
drop trigger if exists trg_flow_orden_pagada_aviso on public.flow_ordenes;
create trigger trg_flow_orden_pagada_aviso after update of estado on public.flow_ordenes
  for each row execute function public.flow_orden_pagada_aviso();
