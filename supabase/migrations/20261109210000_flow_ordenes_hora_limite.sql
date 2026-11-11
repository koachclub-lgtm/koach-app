-- Ofertas con horario (estudiante: ingreso hasta las 16:00): el horario viaja en la orden y se aplica a la membresía al pagar.
-- Aplicada en producción el 09-11-2026 parchando flow_procesar (update membresias set hora_limite) y flow_link_preparar (guarda p_oferta->>'hora_limite').
alter table public.flow_ordenes add column if not exists hora_limite time;
