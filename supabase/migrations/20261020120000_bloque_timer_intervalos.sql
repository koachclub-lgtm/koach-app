-- c188 · BLOQUE TEMPORIZADOR (Tabata / EMOM / AMRAP / FOR TIME / Intervalos)
-- Un bloque normal tiene timer = null. Un bloque especial guarda su programación de tiempos en jsonb:
--   { "modo":"tabata|emom|amrap|fortime|intervalos",
--     "trabajo":20, "descanso":10, "rondas":8,      -- segundos / rondas por serie
--     "series":1, "pausa":60,                        -- series (tabatas encadenados) y pausa entre series
--     "prep":10, "cap":null }                        -- cuenta previa y tope (AMRAP/FOR TIME)
-- Todas las funciones que copian bloques (re-proyección, duplicar, extras, plantillas) arrastran timer.

alter table public.bloques add column if not exists timer jsonb;
alter table public.bloques drop constraint if exists bloques_timer_obj;
alter table public.bloques add constraint bloques_timer_obj
  check (timer is null or (jsonb_typeof(timer)='object' and timer->>'modo' in ('tabata','emom','amrap','fortime','intervalos')));

do $mig$
declare f text; d text; n text;
begin
  -- 1 · guardar sesión (planificador → PUBLICAR)
  d := pg_get_functiondef('public.koach_guardar_sesion'::regproc);
  n := replace(d, 'insert into bloques(id, sesion_id, bloque, etiqueta, rol, sets, descanso_segundos, descanso_seg)',
                  'insert into bloques(id, sesion_id, bloque, etiqueta, rol, sets, descanso_segundos, descanso_seg, timer)');
  n := replace(n, 'coalesce((blk->>''desc'')::int,60), coalesce((blk->>''desc'')::int,60))',
                  'coalesce((blk->>''desc'')::int,60), coalesce((blk->>''desc'')::int,60), case when jsonb_typeof(blk->''timer'')=''object'' then blk->''timer'' else null end)');
  n := replace(n, 'descanso_seg=excluded.descanso_seg;', 'descanso_seg=excluded.descanso_seg, timer=excluded.timer;');
  if n = d or n not like '%excluded.timer%' then raise exception 'koach_guardar_sesion: patrón no encontrado'; end if;
  execute n;

  -- 2 · copias por fila de bloque (b.*)
  foreach f in array array['_int_koach_reproyectar','koach_sesion_duplicar','koach_extra_personalizar'] loop
    d := pg_get_functiondef(('public.'||f)::regproc);
    n := replace(d, 'insert into bloques(sesion_id, bloque, rol, sets, descanso_segundos, descanso_seg, etiqueta)',
                    'insert into bloques(sesion_id, bloque, rol, sets, descanso_segundos, descanso_seg, etiqueta, timer)');
    n := replace(n, 'b.descanso_seg, b.etiqueta)', 'b.descanso_seg, b.etiqueta, b.timer)');
    if n not like '%b.timer)%' then raise exception '%: patrón no encontrado', f; end if;
    execute n;
  end loop;

  -- 3 · plantillas de bloque
  d := pg_get_functiondef('public.koach_guardar_bloque_tpl'::regproc);
  n := replace(d, 'insert into bloques(sesion_id, bloque, etiqueta, rol, sets, descanso_segundos, descanso_seg)',
                  'insert into bloques(sesion_id, bloque, etiqueta, rol, sets, descanso_segundos, descanso_seg, timer)');
  n := replace(n, 'src.descanso_segundos, src.descanso_seg)', 'src.descanso_segundos, src.descanso_seg, src.timer)');
  if n not like '%src.timer)%' then raise exception 'koach_guardar_bloque_tpl: patrón no encontrado'; end if;
  execute n;

  d := pg_get_functiondef('public.koach_usar_bloque_tpl'::regproc);
  n := replace(d, 'insert into bloques(sesion_id, bloque, etiqueta, rol, sets, descanso_segundos, descanso_seg)',
                  'insert into bloques(sesion_id, bloque, etiqueta, rol, sets, descanso_segundos, descanso_seg, timer)');
  n := replace(n, 't.descanso_segundos, t.descanso_seg)', 't.descanso_segundos, t.descanso_seg, t.timer)');
  if n not like '%t.timer)%' then raise exception 'koach_usar_bloque_tpl: patrón no encontrado'; end if;
  execute n;
end $mig$;
