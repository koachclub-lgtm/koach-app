-- c87 · Higiene del registro por set (aplicado en producción el 09-10-2026)
-- 1) Duplicados históricos (17 sets con mismo registro·bloque·ejercicio·set): se conservó el más reciente.
--    with d as (select id, row_number() over (partition by registro_id,bloque_id,bloque_ejercicio_id,set_numero
--               order by coalesce(updated_at,created_at) desc, id desc) rn from set_registros)
--    delete from set_registros s using d where d.id=s.id and d.rn>1;
-- 2) Llave única: un set por registro·bloque·ejercicio·número (rondas de circuito llevan ejercicio null → NULLS NOT DISTINCT).
--    La app inserta con UPSERT sobre esta llave: doble toque o reintento actualizan la misma fila, nunca duplican.
create unique index if not exists uq_setreg_registro_bloque_be_set
  on public.set_registros (registro_id, bloque_id, bloque_ejercicio_id, set_numero) nulls not distinct;
-- 3) `cargas` deja de escribirse desde la app (era un resumen redundante de set_registros). La tabla queda como historial
--    legado anterior al registro por set; koach_historial_cargas la sigue leyendo solo para ejercicios sin sets.
-- 4) Limpieza nocturna (pg_cron 07:10 UTC = 04:10 Chile): inicios abandonados → anulada (misma acción que ANULAR INICIO del coach).
create or replace function public.koach_higiene_registros()
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_anuladas int; v_huerfanos int;
begin
  with x as (
    update sesiones_registro r set estado='anulada'
     where r.estado='en_curso' and r.fecha < public.koach_hoy() - 2
       and not exists (select 1 from set_registros s where s.registro_id=r.id)
    returning r.id)
  select count(*) into v_anuladas from x;
  select count(*) into v_huerfanos from set_registros s where not exists (select 1 from sesiones_registro r where r.id=s.registro_id);
  return jsonb_build_object('anuladas', v_anuladas, 'sets_huerfanos', v_huerfanos, 'corrida', now());
end $$;
revoke execute on function public.koach_higiene_registros() from public, anon, authenticated;
select cron.schedule('koach_higiene_registros', '10 7 * * *', $$select public.koach_higiene_registros()$$);
