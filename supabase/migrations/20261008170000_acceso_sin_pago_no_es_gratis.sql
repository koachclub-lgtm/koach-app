-- Una membresía de $0 ya no se considera pagada por sí sola.
-- Acceso "ok" solo si: UGC/cortesía, o tiene un pago registrado como pagado.
-- Antes, cualquier membresía con valor 0 daba acceso aunque su pago estuviera pendiente
-- (7 socios afectados el 8-oct-2026). Aplicada en producción el 8-oct-2026.
do $$ begin
  execute replace(pg_get_functiondef('public.koach_acceso_socio(uuid)'::regprocedure), ' or coalesce(m.valor,0)=0', '');
end $$;
