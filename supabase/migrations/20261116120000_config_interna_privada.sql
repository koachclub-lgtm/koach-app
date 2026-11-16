-- Configuración interna sin acceso público (solo service_role): claves de operaciones de staff
create table if not exists public.config_interna (clave text primary key, valor text not null, created_at timestamptz default now());
alter table public.config_interna enable row level security;
revoke all on public.config_interna from anon, authenticated;
insert into public.config_interna(clave, valor) values ('flow_staff', encode(gen_random_bytes(24),'hex')) on conflict (clave) do nothing;
