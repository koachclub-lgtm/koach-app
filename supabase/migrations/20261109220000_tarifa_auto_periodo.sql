-- Pago automático con periodicidad personalizada (cada 1, 2, 3… meses) por socio.
-- tarifas_auto_socio.periodo_meses: el monto se cobra cada N meses y cada cobro activa N meses de membresía.
alter table public.tarifas_auto_socio add column if not exists periodo_meses int not null default 1
  check (periodo_meses between 1 and 12);

create or replace function public.tarifa_auto_de(p_socio uuid)
returns jsonb language sql stable security definer set search_path to 'public' as $function$
  select coalesce(
    (select jsonb_build_object('monto',monto,'tipo_comercial',tipo_comercial,'personalizada',true,'nota',nota,
                               'permanencia_meses',permanencia_meses,'periodo_meses',periodo_meses)
       from tarifas_auto_socio where socio_id=p_socio),
    (select jsonb_build_object('monto',(valor->>'monto')::int,'tipo_comercial',coalesce(valor->>'tipo_comercial','promocion'),'personalizada',false,
                               'permanencia_meses',coalesce((valor->>'permanencia_meses')::int,0),'periodo_meses',1)
       from config_pagos where clave='mensual_auto_default'),
    jsonb_build_object('monto',70000,'tipo_comercial','promocion','personalizada',false,'permanencia_meses',12,'periodo_meses',1))
  || jsonb_build_object('precio_lista', coalesce((select (valor->>'monto')::int from config_pagos where clave='precio_lista_mensual'),80000))
$function$;
