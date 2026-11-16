-- KOACH · solicitudes de eliminación de cuenta (App Store 5.1.1(v), Google Play, Ley 21.719).
-- NO APLICADA. Solo la service role escribe (función eliminar-cuenta); staff admin lee y procesa.
create table if not exists public.solicitudes_eliminacion (
  id            uuid primary key default gen_random_uuid(),
  auth_user_id  uuid not null unique,
  email         text,
  origen        text,
  estado        text not null default 'PENDIENTE' check (estado in ('PENDIENTE','PROCESADA','RECHAZADA')),
  creada_at     timestamptz not null default now(),
  limite_at     timestamptz not null default now() + interval '30 days',
  procesada_at  timestamptz,
  nota          text
);
alter table public.solicitudes_eliminacion enable row level security;
-- sin políticas para anon/authenticated: el socio no lee ni escribe directo; la función usa service role.
