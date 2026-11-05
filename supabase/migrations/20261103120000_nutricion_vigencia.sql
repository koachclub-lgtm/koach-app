-- NUTRICIÓN · período de la pauta (3-nov-2026)
-- Cada plan tiene un período de aplicación (semanas) desde su inicio; al terminar toca reevaluar composición corporal.
-- Por defecto 6 semanas (ventana habitual de reevaluación antropométrica: 4–8 semanas). Lo fija nutrición.
alter table public.pautas_nutricion add column if not exists semanas integer not null default 6;
alter table public.pautas_nutricion add column if not exists inicio date;
do $$ begin
  alter table public.pautas_nutricion add constraint pautas_nut_semanas_chk check (semanas between 1 and 26);
exception when duplicate_object then null; end $$;

-- Al publicar sin inicio definido, el período parte el día de la publicación
create or replace function public.koach_trg_pauta()
returns trigger language plpgsql set search_path to 'public' as $$
begin
  new.updated_at := now();
  if new.estado = 'publicada' and (tg_op = 'INSERT' or old.estado is distinct from 'publicada') then
    update pautas_nutricion set estado = 'archivada', updated_at = now()
     where socio_id = new.socio_id and estado = 'publicada' and id <> new.id;
    new.publicada_at := now();
    if new.inicio is null then new.inicio := (now() at time zone 'America/Santiago')::date; end if;
  end if;
  return new;
end $$;
