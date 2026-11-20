-- 1% CLUB · lema/bajada editables, cierre 28-nov y una sola oportunidad por socio (aplicadas el 19-nov-2026)
alter table public.club_challenges add column if not exists lema text, add column if not exists bajada text;
update public.club_challenges set
  lema = 'Sé el personaje principal.',
  bajada = 'Ponle play al GTA Challenge: máxima cantidad de burpees en 3 minutos. Marca tu récord personal y compite por el primer lugar en el Club del 1%.',
  estandar = 'Pecho al suelo · extensión completa con salto',
  fin = '2026-11-28 23:59:59-03', visible_hasta = '2026-11-30 23:59:59-03'
where slug = 'gta-challenge';
-- club_estado devuelve lema y bajada (ver definición vigente en la base)
create or replace function public.club_registrar(p_challenge uuid, p_score int) returns jsonb language plpgsql security definer set search_path=public as $$
begin
  if auth.uid() is null then raise exception 'sin sesión'; end if;
  if exists(select 1 from club_challenge_entradas where challenge_id=p_challenge and socio_id=auth.uid()) then
    raise exception 'Ya registraste tu marca. El challenge tiene una sola oportunidad.';
  end if;
  return public._club_marca(p_challenge, auth.uid(), p_score, auth.uid(), false);
end $$;
