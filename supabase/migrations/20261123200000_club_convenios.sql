-- 1% CLUB · CONVENIOS: descuentos y beneficios de marcas aliadas para socios. Aplicada 23-nov-2026.
-- Se cargan desde el panel/SQL; la app solo lee los activos y vigentes.
create table if not exists public.club_convenios(
  id uuid primary key default gen_random_uuid(),
  marca text not null,
  rubro text,
  beneficio text not null,          -- ej. "20% DE DESCUENTO"
  detalle text,                     -- qué incluye
  condiciones text,                 -- letra chica
  como_usar text,                   -- ej. "Muestra esta pantalla en recepción"
  codigo text,
  logo_url text,
  web_url text,
  orden int not null default 100,
  activo boolean not null default true,
  vigente_hasta date,
  created_at timestamptz not null default now()
);
alter table public.club_convenios enable row level security;
drop policy if exists club_conv_leer on public.club_convenios;
create policy club_conv_leer on public.club_convenios for select to authenticated
  using (activo and (vigente_hasta is null or vigente_hasta >= (now() at time zone 'America/Santiago')::date));
drop policy if exists club_conv_staff on public.club_convenios;
create policy club_conv_staff on public.club_convenios for all to authenticated
  using (public.koach_rol() = 'admin') with check (public.koach_rol() = 'admin');
