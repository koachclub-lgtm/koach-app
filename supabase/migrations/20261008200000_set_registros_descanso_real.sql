-- Smart Rest Timer · descanso prescrito / ajustado / real por set (aplicada en producción 8-oct-2026)
alter table public.set_registros
  add column if not exists descanso_prescrito_seg integer,
  add column if not exists descanso_ajuste_seg integer,
  add column if not exists descanso_real_seg integer;
comment on column public.set_registros.descanso_prescrito_seg is 'bloques.descanso_seg vigente cuando empezó el descanso previo a este set';
comment on column public.set_registros.descanso_ajuste_seg is 'suma de −15/+15 que el socio aplicó a ese descanso (no modifica la planificación)';
comment on column public.set_registros.descanso_real_seg is 'segundos reales entre el inicio del descanso previo y completar este set (incluye saltos y exceso)';
