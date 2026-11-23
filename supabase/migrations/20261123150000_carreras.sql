-- KOACH · Run Club: carreras registradas con GPS desde la app. NO APLICADA.
create table if not exists public.carreras (
  id            uuid primary key default gen_random_uuid(),
  perfil_id     uuid not null references public.profiles(id) on delete cascade,
  inicio        timestamptz not null,
  fin           timestamptz not null,
  distancia_m   integer not null check (distancia_m >= 0),
  duracion_s    integer not null check (duracion_s >= 0),
  movimiento_s  integer not null check (movimiento_s >= 0),
  ritmo_min_km  numeric(5,2),
  ruta          text,                       -- polyline comprimida (precisión 1e-5)
  valida        boolean not null default false,
  origen        text not null default 'app' check (origen in ('app','health_connect','healthkit','strava')),
  motor_version text,
  creada_at     timestamptz not null default now()
);
create index if not exists carreras_perfil_inicio on public.carreras (perfil_id, inicio desc);
alter table public.carreras enable row level security;
create policy carreras_propias_select on public.carreras for select using (perfil_id = auth.uid());
create policy carreras_propias_insert on public.carreras for insert with check (perfil_id = auth.uid());
create policy carreras_propias_delete on public.carreras for delete using (perfil_id = auth.uid());
-- staff (koach/admin) lee vía funciones existentes de rol; se agrega política al aplicar según el esquema de roles vigente.
