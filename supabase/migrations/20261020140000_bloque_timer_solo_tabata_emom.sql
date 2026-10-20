-- c190 · el bloque temporizador queda en TABATA y EMOM: ambos cierran registrando los sets (kg/reps) del bloque
alter table public.bloques drop constraint if exists bloques_timer_obj;
alter table public.bloques add constraint bloques_timer_obj
  check (timer is null or (jsonb_typeof(timer)='object' and timer->>'modo' in ('tabata','emom')));
