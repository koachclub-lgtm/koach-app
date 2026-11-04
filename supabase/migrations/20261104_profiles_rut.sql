-- RUT del socio (sin puntos, con guión). En clase de prueba se usa como clave de su cuenta.
alter table public.profiles add column if not exists rut text;
create unique index if not exists uq_profiles_rut on public.profiles (rut) where rut is not null;
