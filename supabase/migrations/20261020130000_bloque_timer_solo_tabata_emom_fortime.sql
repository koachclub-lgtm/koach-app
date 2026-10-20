-- c189 · el bloque temporizador queda en 3 formatos: TABATA, EMOM y FOR TIME (sin AMRAP ni Intervalos)
alter table public.bloques drop constraint if exists bloques_timer_obj;
alter table public.bloques add constraint bloques_timer_obj
  check (timer is null or (jsonb_typeof(timer)='object' and timer->>'modo' in ('tabata','emom','fortime')));
