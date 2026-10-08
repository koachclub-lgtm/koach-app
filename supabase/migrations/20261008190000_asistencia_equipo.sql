-- ═══════════════════════════════════════════════════════════════════════════════════════
-- c65 · ASISTENCIA DEL EQUIPO (control de personal con QR rotativo)
-- Modelo "banco":
--   · El QR lleva un código aleatorio de UN SOLO USO con VENCIMIENTO. En la base solo vive su hash (sha256).
--   · La marca la decide el servidor (no el celular): valida y quema el código en una sola transacción.
--   · El libro de marcas es APPEND-ONLY: no se edita ni se borra. Cada marca encadena el hash de la anterior
--     (cualquier alteración posterior rompe la cadena → asist_verificar_cadena()).
--   · Las correcciones son movimientos nuevos (marca manual o anulación) con motivo y autor.
--   · Cada persona marca solo desde su dispositivo registrado (el primero que usa queda enrolado; admin lo libera).
-- Quién marca: todo el staff (admin, coach, recepción, nutrición). Quién muestra el QR: admin o recepción.
-- ═══════════════════════════════════════════════════════════════════════════════════════

-- ─── Códigos QR (efímeros) ───
create table if not exists public.staff_qr_tokens (
  id          uuid primary key default gen_random_uuid(),
  token_hash  text not null unique,
  terminal    text not null default 'PC CENTRAL',
  emitido_por uuid not null references public.profiles(id),
  emitido_at  timestamptz not null default now(),
  expira_at   timestamptz not null,
  usado_at    timestamptz,
  usado_por   uuid references public.profiles(id),
  estado      text not null default 'activo' check (estado in ('activo','usado','reemplazado'))
);
create index if not exists staff_qr_tokens_emisor_idx on public.staff_qr_tokens (emitido_por, terminal) where estado='activo';
create index if not exists staff_qr_tokens_emitido_idx on public.staff_qr_tokens (emitido_at);

-- ─── Dispositivos enrolados (1 activo por persona) ───
create table if not exists public.staff_dispositivos (
  id           uuid primary key default gen_random_uuid(),
  staff_id     uuid not null references public.profiles(id),
  device_hash  text not null,
  user_agent   text,
  enrolado_at  timestamptz not null default now(),
  revocado_at  timestamptz,
  revocado_por uuid references public.profiles(id)
);
create unique index if not exists staff_dispositivos_activo_uq on public.staff_dispositivos (staff_id) where revocado_at is null;

-- ─── Libro de marcas (append-only) ───
create table if not exists public.staff_marcas (
  id              uuid primary key default gen_random_uuid(),
  seq             bigserial unique,
  staff_id        uuid not null references public.profiles(id) on delete restrict,
  tipo            text not null check (tipo in ('entrada','salida')),
  marcada_at      timestamptz not null default now(),
  fecha           date not null,
  origen          text not null check (origen in ('qr','manual')),
  token_id        uuid,
  terminal        text,
  dispositivo_id  uuid references public.staff_dispositivos(id),
  registrada_por  uuid references public.profiles(id),
  motivo          text,
  metadata        jsonb not null default '{}'::jsonb,
  checksum_prev   text,
  checksum        text not null,
  created_at      timestamptz not null default now(),
  constraint staff_marcas_manual_motivo check (origen <> 'manual' or (motivo is not null and length(trim(motivo)) >= 4 and registrada_por is not null))
);
create index if not exists staff_marcas_staff_fecha_idx on public.staff_marcas (staff_id, fecha, marcada_at);
create index if not exists staff_marcas_fecha_idx on public.staff_marcas (fecha);

-- ─── Anulaciones (append-only; una por marca) ───
create table if not exists public.staff_marca_anulaciones (
  marca_id     uuid primary key references public.staff_marcas(id) on delete restrict,
  motivo       text not null check (length(trim(motivo)) >= 4),
  actor_id     uuid not null references public.profiles(id),
  actor_nombre text,
  created_at   timestamptz not null default now()
);

-- ─── Turnos planificados (versionados por vigencia: cambiar un turno no reescribe el pasado) ───
create table if not exists public.staff_turnos (
  id             uuid primary key default gen_random_uuid(),
  staff_id       uuid not null references public.profiles(id) on delete cascade,
  dia            smallint not null check (dia between 1 and 7),   -- ISO: 1 = lunes … 7 = domingo
  inicio         time not null,
  fin            time not null,
  vigente_desde  date not null default public.koach_hoy(),
  vigente_hasta  date,                                              -- exclusivo; null = vigente
  creado_por     uuid references public.profiles(id),
  created_at     timestamptz not null default now(),
  constraint staff_turnos_rango check (fin > inicio)
);
create index if not exists staff_turnos_staff_idx on public.staff_turnos (staff_id, dia) where vigente_hasta is null;

-- ─── Inmutabilidad del libro ───
create or replace function public.asist_trg_inmutable() returns trigger
language plpgsql set search_path = public as $$
begin
  raise exception 'KA:LIBRO_INMUTABLE' using hint = 'Las marcas no se editan ni se borran: se anulan o se agrega una marca manual con motivo.';
end $$;
drop trigger if exists staff_marcas_inmutable on public.staff_marcas;
create trigger staff_marcas_inmutable before update or delete on public.staff_marcas
  for each row execute function public.asist_trg_inmutable();
drop trigger if exists staff_anulaciones_inmutable on public.staff_marca_anulaciones;
create trigger staff_anulaciones_inmutable before update or delete on public.staff_marca_anulaciones
  for each row execute function public.asist_trg_inmutable();

-- ─── RLS: lectura propia o admin; escritura SOLO por RPC (security definer) ───
alter table public.staff_qr_tokens enable row level security;         -- sin políticas: invisible para clientes
alter table public.staff_dispositivos enable row level security;
alter table public.staff_marcas enable row level security;
alter table public.staff_marca_anulaciones enable row level security;
alter table public.staff_turnos enable row level security;

drop policy if exists sm_leer on public.staff_marcas;
create policy sm_leer on public.staff_marcas for select to authenticated
  using (staff_id = (select auth.uid()) or (select public.es_admin()));
drop policy if exists sma_leer on public.staff_marca_anulaciones;
create policy sma_leer on public.staff_marca_anulaciones for select to authenticated
  using ((select public.es_admin()) or exists (select 1 from public.staff_marcas m where m.id = marca_id and m.staff_id = (select auth.uid())));
drop policy if exists st_leer on public.staff_turnos;
create policy st_leer on public.staff_turnos for select to authenticated
  using (staff_id = (select auth.uid()) or (select public.es_admin()));
drop policy if exists sd_leer on public.staff_dispositivos;
create policy sd_leer on public.staff_dispositivos for select to authenticated
  using (staff_id = (select auth.uid()) or (select public.es_admin()));

-- ─── Helpers internos ───
create or replace function public._asist_sha(p text) returns text
language sql immutable set search_path = public, extensions as $$ select encode(extensions.digest(p, 'sha256'), 'hex') $$;

create or replace function public._asist_nombre(p uuid) returns text
language sql stable security definer set search_path = public as $$
  select trim(coalesce(nombre,'') || ' ' || coalesce(apellido,'')) from profiles where id = p $$;

create or replace function public._asist_req() returns jsonb
language sql stable set search_path = public as $$
  select jsonb_strip_nulls(jsonb_build_object(
    'ua', left(coalesce(current_setting('request.headers', true), '{}')::jsonb ->> 'user-agent', 300),
    'ip', split_part(coalesce(current_setting('request.headers', true), '{}')::jsonb ->> 'x-forwarded-for', ',', 1))) $$;

-- Inserta una marca encadenada. Serializa la cadena con un lock transaccional.
create or replace function public._asist_insertar_marca(
  p_staff uuid, p_tipo text, p_at timestamptz, p_origen text, p_token uuid, p_terminal text,
  p_dispositivo uuid, p_registrada_por uuid, p_motivo text, p_meta jsonb
) returns public.staff_marcas
language plpgsql security definer set search_path = public as $$
declare v_prev text; v_seq bigint; v_id uuid := gen_random_uuid(); v_row public.staff_marcas;
begin
  perform pg_advisory_xact_lock(hashtext('koach_staff_marcas_cadena'));
  select checksum into v_prev from staff_marcas order by seq desc limit 1;
  v_seq := nextval(pg_get_serial_sequence('public.staff_marcas', 'seq'));
  insert into staff_marcas (id, seq, staff_id, tipo, marcada_at, fecha, origen, token_id, terminal, dispositivo_id,
                            registrada_por, motivo, metadata, checksum_prev, checksum)
  values (v_id, v_seq, p_staff, p_tipo, p_at, (p_at at time zone 'America/Santiago')::date, p_origen, p_token, p_terminal,
          p_dispositivo, p_registrada_por, p_motivo, coalesce(p_meta,'{}'::jsonb), v_prev,
          public._asist_sha(concat_ws('|', coalesce(v_prev,'GENESIS'), v_seq, v_id, p_staff, p_tipo,
                                      to_char(p_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US'), p_origen,
                                      coalesce(p_registrada_por::text,''), coalesce(p_motivo,''))))
  returning * into v_row;
  return v_row;
end $$;

-- Tipo que corresponde: alterna entrada/salida según la última marca válida del día.
create or replace function public._asist_siguiente_tipo(p_staff uuid, p_fecha date) returns text
language sql stable security definer set search_path = public as $$
  select case when (select m.tipo from staff_marcas m
                     where m.staff_id = p_staff and m.fecha = p_fecha
                       and not exists (select 1 from staff_marca_anulaciones a where a.marca_id = m.id)
                     order by m.marcada_at desc, m.seq desc limit 1) = 'entrada' then 'salida' else 'entrada' end $$;

-- ═══ KIOSKO (admin / recepción) ═══
create or replace function public.asist_kiosko_emitir(p_terminal text default 'PC CENTRAL', p_ttl_seg int default 90)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare v_tok text; v_id uuid; v_exp timestamptz; v_term text := upper(left(coalesce(nullif(trim(p_terminal),''),'PC CENTRAL'), 40));
begin
  if not public.es_comercial() then raise exception 'KA:SIN_PERMISO'; end if;
  -- el anterior de este terminal queda inválido de inmediato (el QR en pantalla es siempre uno solo)
  update staff_qr_tokens set estado = 'reemplazado', expira_at = least(expira_at, now())
   where emitido_por = auth.uid() and terminal = v_term and estado = 'activo';
  v_tok := encode(extensions.gen_random_bytes(24), 'hex');
  v_exp := now() + make_interval(secs => greatest(30, least(coalesce(p_ttl_seg, 90), 300)));
  insert into staff_qr_tokens (token_hash, terminal, emitido_por, expira_at)
  values (public._asist_sha(v_tok), v_term, auth.uid(), v_exp) returning id into v_id;
  return jsonb_build_object('id', v_id, 'token', v_tok, 'expira_at', v_exp, 'terminal', v_term, 'server_now', now());
end $$;

create or replace function public.asist_kiosko_estado(p_token_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare t staff_qr_tokens; v_hoy date := public.koach_hoy();
begin
  if not public.es_comercial() then raise exception 'KA:SIN_PERMISO'; end if;
  select * into t from staff_qr_tokens where id = p_token_id and emitido_por = auth.uid();
  return jsonb_build_object(
    'server_now', now(),
    'token', case when t.id is null then null else jsonb_build_object('estado', t.estado, 'expira_at', t.expira_at, 'usado_at', t.usado_at,
               'usado_por', case when t.usado_por is null then null else public._asist_nombre(t.usado_por) end) end,
    'hoy', coalesce((select jsonb_agg(x order by x->>'at' desc) from (
              select jsonb_build_object('nombre', public._asist_nombre(m.staff_id), 'tipo', m.tipo, 'at', m.marcada_at, 'origen', m.origen) x
                from staff_marcas m
               where m.fecha = v_hoy and not exists (select 1 from staff_marca_anulaciones a where a.marca_id = m.id)
               order by m.marcada_at desc limit 12) s), '[]'::jsonb),
    'adentro', (select count(*) from (select distinct on (m.staff_id) m.tipo from staff_marcas m
                  where m.fecha = v_hoy and not exists (select 1 from staff_marca_anulaciones a where a.marca_id = m.id)
                  order by m.staff_id, m.marcada_at desc, m.seq desc) u where u.tipo = 'entrada'));
end $$;

-- ═══ MARCAR (cualquier miembro del staff, desde su celular) ═══
create or replace function public.asist_marcar(p_token text, p_dispositivo text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid(); t staff_qr_tokens; d staff_dispositivos; v_dev text; v_nuevo boolean := false;
  v_tipo text; v_ult timestamptz; v_m staff_marcas; v_hoy date := public.koach_hoy(); v_req jsonb := public._asist_req();
begin
  if v_uid is null then raise exception 'KA:SIN_SESION'; end if;
  if not public.es_staff() then raise exception 'KA:NO_ES_STAFF'; end if;
  if coalesce(length(p_token),0) <> 48 or p_token !~ '^[0-9a-f]+$' then raise exception 'KA:QR_INVALIDO'; end if;
  if coalesce(length(p_dispositivo),0) < 16 then raise exception 'KA:DISPOSITIVO_INVALIDO'; end if;

  select * into t from staff_qr_tokens where token_hash = public._asist_sha(p_token) for update;
  if t.id is null then raise exception 'KA:QR_INVALIDO'; end if;
  if t.estado = 'usado' then raise exception 'KA:QR_USADO'; end if;
  if t.estado = 'reemplazado' or t.expira_at <= now() then raise exception 'KA:QR_VENCIDO'; end if;

  -- dispositivo: el primero queda enrolado; después solo ese
  v_dev := public._asist_sha('koach-dev|' || p_dispositivo);
  select * into d from staff_dispositivos where staff_id = v_uid and revocado_at is null;
  if d.id is null then
    insert into staff_dispositivos (staff_id, device_hash, user_agent) values (v_uid, v_dev, v_req->>'ua') returning * into d;
    v_nuevo := true;
  elsif d.device_hash <> v_dev then
    raise exception 'KA:DISPOSITIVO_NO_AUTORIZADO';
  end if;

  -- anti doble toque: una marca por persona por minuto (no quema el QR: sigue sirviendo al siguiente)
  select max(m.marcada_at) into v_ult from staff_marcas m
   where m.staff_id = v_uid and not exists (select 1 from staff_marca_anulaciones a where a.marca_id = m.id);
  if v_ult is not null and v_ult > now() - interval '60 seconds' then raise exception 'KA:MARCA_RECIENTE'; end if;

  v_tipo := public._asist_siguiente_tipo(v_uid, v_hoy);
  v_m := public._asist_insertar_marca(v_uid, v_tipo, now(), 'qr', t.id, t.terminal, d.id, null, null,
                                      v_req || jsonb_build_object('qr_emitido_at', t.emitido_at, 'qr_edad_seg', round(extract(epoch from now() - t.emitido_at))));
  update staff_qr_tokens set estado = 'usado', usado_at = now(), usado_por = v_uid where id = t.id;

  return jsonb_build_object('ok', true, 'id', v_m.id, 'tipo', v_tipo, 'at', v_m.marcada_at, 'nombre', public._asist_nombre(v_uid),
                            'terminal', t.terminal, 'dispositivo_nuevo', v_nuevo, 'checksum', left(v_m.checksum, 12));
end $$;

-- ═══ RESUMEN (motor único: lo usan "mi asistencia" y el panel admin) ═══
create or replace function public._asist_resumen(p_staff uuid, p_desde date, p_hasta date, p_tol int default 5)
returns jsonb language sql stable security definer set search_path = public as $$
  with st as (
    select p.id, trim(coalesce(p.nombre,'') || ' ' || coalesce(p.apellido,'')) nombre, p.role::text rol
      from profiles p where p.role <> 'socio' and coalesce(p.activo, true) and (p_staff is null or p.id = p_staff)),
  dias as (select d::date fecha from generate_series(p_desde, least(p_hasta, public.koach_hoy() + 6), interval '1 day') d),
  mk as (
    select m.*, a.marca_id is not null anulada, a.motivo motivo_anul
      from staff_marcas m left join staff_marca_anulaciones a on a.marca_id = m.id
     where m.fecha between p_desde and p_hasta and (p_staff is null or m.staff_id = p_staff)),
  grid as (
    select s.id, s.nombre, s.rol, d.fecha,
           (select min(t.inicio) from staff_turnos t where t.staff_id = s.id and t.dia = extract(isodow from d.fecha)
               and t.vigente_desde <= d.fecha and (t.vigente_hasta is null or t.vigente_hasta > d.fecha)) t_ini,
           (select max(t.fin) from staff_turnos t where t.staff_id = s.id and t.dia = extract(isodow from d.fecha)
               and t.vigente_desde <= d.fecha and (t.vigente_hasta is null or t.vigente_hasta > d.fecha)) t_fin,
           (select coalesce(sum(extract(epoch from t.fin - t.inicio) / 60), 0)::int from staff_turnos t where t.staff_id = s.id and t.dia = extract(isodow from d.fecha)
               and t.vigente_desde <= d.fecha and (t.vigente_hasta is null or t.vigente_hasta > d.fecha)) t_min
      from st s cross join dias d),
  fil as (
    select g.*, x.marcas, x.n_validas, x.entrada, x.salida, y.minutos, y.abierta
      from grid g
      cross join lateral (
        select jsonb_agg(jsonb_build_object('id', m.id, 'tipo', m.tipo, 'at', m.marcada_at, 'origen', m.origen, 'terminal', m.terminal,
                                            'motivo', m.motivo, 'anulada', m.anulada, 'motivo_anul', m.motivo_anul) order by m.marcada_at) marcas,
               count(*) filter (where not m.anulada) n_validas,
               min(m.marcada_at) filter (where m.tipo = 'entrada' and not m.anulada) entrada,
               max(m.marcada_at) filter (where m.tipo = 'salida' and not m.anulada) salida
          from mk m where m.staff_id = g.id and m.fecha = g.fecha) x
      cross join lateral (
        select coalesce(sum(extract(epoch from q.sig - q.marcada_at) / 60) filter (where q.tipo = 'entrada' and q.sig_tipo = 'salida'), 0)::int minutos,
               coalesce(bool_or(q.tipo = 'entrada' and q.sig_tipo is null), false) abierta
          from (select m.tipo, m.marcada_at, lead(m.marcada_at) over w sig, lead(m.tipo) over w sig_tipo
                  from mk m where m.staff_id = g.id and m.fecha = g.fecha and not m.anulada
                window w as (order by m.marcada_at, m.seq)) q) y
     where x.marcas is not null or g.t_ini is not null)
  select coalesce(jsonb_agg(jsonb_build_object(
           'staff_id', f.id, 'nombre', f.nombre, 'rol', f.rol, 'fecha', f.fecha, 'marcas', coalesce(f.marcas, '[]'::jsonb),
           'entrada', f.entrada, 'salida', f.salida, 'minutos', f.minutos, 'abierta', f.abierta,
           'turno_inicio', f.t_ini, 'turno_fin', f.t_fin, 'minutos_turno', f.t_min,
           'atraso_min', case when f.t_ini is not null and f.entrada is not null
                              then greatest(0, floor(extract(epoch from (f.entrada at time zone 'America/Santiago')::time - f.t_ini) / 60))::int end,
           'estado', case
              when f.n_validas = 0 or f.n_validas is null then
                case when f.t_ini is null then 'anulado'
                     when f.fecha > public.koach_hoy() then 'programado'
                     when f.fecha < public.koach_hoy() or (now() at time zone 'America/Santiago')::time > f.t_ini + make_interval(mins => p_tol) then 'ausente'
                     else 'pendiente' end
              when f.abierta and f.fecha < public.koach_hoy() then 'sin_salida'
              when f.t_ini is not null and f.entrada is not null
                   and (f.entrada at time zone 'America/Santiago')::time > f.t_ini + make_interval(mins => p_tol) then 'atraso'
              when f.abierta then 'en_turno'
              else 'ok' end
         ) order by f.fecha desc, f.nombre), '[]'::jsonb)
    from fil f $$;

create or replace function public.asist_mi_resumen(p_desde date, p_hasta date)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not public.es_staff() then raise exception 'KA:NO_ES_STAFF'; end if;
  if p_hasta - p_desde > 93 then raise exception 'KA:RANGO_MAX_93'; end if;
  return jsonb_build_object(
    'dias', public._asist_resumen(auth.uid(), p_desde, p_hasta),
    'dispositivo', (select jsonb_build_object('enrolado_at', enrolado_at, 'ua', user_agent) from staff_dispositivos where staff_id = auth.uid() and revocado_at is null),
    'turnos', coalesce((select jsonb_agg(jsonb_build_object('dia', dia, 'inicio', inicio, 'fin', fin) order by dia, inicio)
                          from staff_turnos where staff_id = auth.uid() and vigente_hasta is null), '[]'::jsonb),
    'siguiente', public._asist_siguiente_tipo(auth.uid(), public.koach_hoy()));
end $$;

-- ═══ ADMIN ═══
create or replace function public.asist_admin_resumen(p_desde date, p_hasta date, p_staff uuid default null)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not public.es_admin() then raise exception 'KA:SIN_PERMISO'; end if;
  if p_hasta - p_desde > 93 then raise exception 'KA:RANGO_MAX_93'; end if;
  return public._asist_resumen(p_staff, p_desde, p_hasta);
end $$;

create or replace function public.asist_admin_equipo()
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not public.es_admin() then raise exception 'KA:SIN_PERMISO'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object(
      'id', p.id, 'nombre', trim(coalesce(p.nombre,'') || ' ' || coalesce(p.apellido,'')), 'email', p.email, 'rol', p.role,
      'dispositivo', (select jsonb_build_object('enrolado_at', d.enrolado_at, 'ua', d.user_agent) from staff_dispositivos d where d.staff_id = p.id and d.revocado_at is null),
      'turnos', coalesce((select jsonb_agg(jsonb_build_object('dia', t.dia, 'inicio', t.inicio, 'fin', t.fin) order by t.dia, t.inicio)
                            from staff_turnos t where t.staff_id = p.id and t.vigente_hasta is null), '[]'::jsonb),
      'ultima', (select jsonb_build_object('tipo', m.tipo, 'at', m.marcada_at) from staff_marcas m
                  where m.staff_id = p.id and not exists (select 1 from staff_marca_anulaciones a where a.marca_id = m.id)
                  order by m.marcada_at desc, m.seq desc limit 1)
    ) order by p.nombre) from profiles p where p.role <> 'socio' and coalesce(p.activo, true)), '[]'::jsonb);
end $$;

create or replace function public.asist_admin_marca_manual(p_staff uuid, p_tipo text, p_at timestamptz, p_motivo text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_m staff_marcas;
begin
  if not public.es_admin() then raise exception 'KA:SIN_PERMISO'; end if;
  if p_tipo not in ('entrada','salida') then raise exception 'KA:TIPO_INVALIDO'; end if;
  if p_at is null or p_at > now() + interval '1 minute' then raise exception 'KA:FECHA_FUTURA'; end if;
  if p_at < now() - interval '62 days' then raise exception 'KA:FECHA_MUY_ANTIGUA'; end if;
  if coalesce(length(trim(p_motivo)),0) < 4 then raise exception 'KA:MOTIVO_REQUERIDO'; end if;
  if not exists (select 1 from profiles where id = p_staff and role <> 'socio') then raise exception 'KA:NO_ES_STAFF'; end if;
  v_m := public._asist_insertar_marca(p_staff, p_tipo, p_at, 'manual', null, null, null, auth.uid(), trim(p_motivo),
                                      public._asist_req() || jsonb_build_object('actor_nombre', public._asist_nombre(auth.uid())));
  return jsonb_build_object('ok', true, 'id', v_m.id);
end $$;

create or replace function public.asist_admin_anular(p_marca uuid, p_motivo text)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not public.es_admin() then raise exception 'KA:SIN_PERMISO'; end if;
  if coalesce(length(trim(p_motivo)),0) < 4 then raise exception 'KA:MOTIVO_REQUERIDO'; end if;
  if not exists (select 1 from staff_marcas where id = p_marca) then raise exception 'KA:NO_EXISTE'; end if;
  if exists (select 1 from staff_marca_anulaciones where marca_id = p_marca) then raise exception 'KA:YA_ANULADA'; end if;
  insert into staff_marca_anulaciones (marca_id, motivo, actor_id, actor_nombre) values (p_marca, trim(p_motivo), auth.uid(), public._asist_nombre(auth.uid()));
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.asist_admin_dispositivo_liberar(p_staff uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_n int;
begin
  if not public.es_admin() then raise exception 'KA:SIN_PERMISO'; end if;
  update staff_dispositivos set revocado_at = now(), revocado_por = auth.uid() where staff_id = p_staff and revocado_at is null;
  get diagnostics v_n = row_count;
  insert into admin_eventos (socio_id, entidad, entidad_id, accion, motivo, actor_id, actor_nombre)
  values (p_staff, 'staff_dispositivo', p_staff, 'liberar', 'Liberar dispositivo de marcación', auth.uid(), public._asist_nombre(auth.uid()));
  return jsonb_build_object('ok', true, 'liberados', v_n);
end $$;

-- p_turnos: [{"dia":1,"inicio":"07:00","fin":"13:00"}, …]  · reemplaza el horario vigente desde hoy
create or replace function public.asist_admin_turnos_guardar(p_staff uuid, p_turnos jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_hoy date := public.koach_hoy(); v_antes jsonb; e jsonb; v_n int := 0;
begin
  if not public.es_admin() then raise exception 'KA:SIN_PERMISO'; end if;
  if not exists (select 1 from profiles where id = p_staff and role <> 'socio') then raise exception 'KA:NO_ES_STAFF'; end if;
  if jsonb_typeof(coalesce(p_turnos,'[]'::jsonb)) <> 'array' then raise exception 'KA:FORMATO'; end if;
  select coalesce(jsonb_agg(jsonb_build_object('dia', dia, 'inicio', inicio, 'fin', fin)), '[]'::jsonb) into v_antes
    from staff_turnos where staff_id = p_staff and vigente_hasta is null;
  delete from staff_turnos where staff_id = p_staff and vigente_hasta is null and vigente_desde >= v_hoy;
  update staff_turnos set vigente_hasta = v_hoy where staff_id = p_staff and vigente_hasta is null;
  for e in select * from jsonb_array_elements(coalesce(p_turnos,'[]'::jsonb)) loop
    if (e->>'dia')::int not between 1 and 7 or (e->>'fin')::time <= (e->>'inicio')::time then raise exception 'KA:TURNO_INVALIDO'; end if;
    insert into staff_turnos (staff_id, dia, inicio, fin, vigente_desde, creado_por)
    values (p_staff, (e->>'dia')::smallint, (e->>'inicio')::time, (e->>'fin')::time, v_hoy, auth.uid());
    v_n := v_n + 1;
  end loop;
  insert into admin_eventos (socio_id, entidad, entidad_id, accion, antes, despues, motivo, actor_id, actor_nombre)
  values (p_staff, 'staff_turnos', p_staff, 'guardar', v_antes, coalesce(p_turnos,'[]'::jsonb), 'Horario del equipo', auth.uid(), public._asist_nombre(auth.uid()));
  return jsonb_build_object('ok', true, 'turnos', v_n);
end $$;

-- Auditoría: recalcula la cadena y devuelve las marcas cuyo hash no cuadra (vacío = libro íntegro)
create or replace function public.asist_verificar_cadena()
returns jsonb language plpgsql security definer set search_path = public as $$
declare r record; v_prev text; v_calc text; v_mal jsonb := '[]'::jsonb; v_n int := 0;
begin
  if not public.es_admin() then raise exception 'KA:SIN_PERMISO'; end if;
  for r in select * from staff_marcas order by seq loop
    v_calc := public._asist_sha(concat_ws('|', coalesce(v_prev,'GENESIS'), r.seq, r.id, r.staff_id, r.tipo,
                                to_char(r.marcada_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US'), r.origen,
                                coalesce(r.registrada_por::text,''), coalesce(r.motivo,'')));
    if v_calc <> r.checksum or coalesce(r.checksum_prev,'') <> coalesce(v_prev,'') then
      v_mal := v_mal || jsonb_build_object('seq', r.seq, 'id', r.id);
    end if;
    v_prev := r.checksum; v_n := v_n + 1;
  end loop;
  return jsonb_build_object('marcas', v_n, 'integro', jsonb_array_length(v_mal) = 0, 'alteradas', v_mal);
end $$;

-- ─── Permisos de ejecución ───
revoke all on function public._asist_sha(text) from public, anon, authenticated;
revoke all on function public._asist_nombre(uuid) from public, anon, authenticated;
revoke all on function public._asist_req() from public, anon, authenticated;
revoke all on function public._asist_insertar_marca(uuid,text,timestamptz,text,uuid,text,uuid,uuid,text,jsonb) from public, anon, authenticated;
revoke all on function public._asist_siguiente_tipo(uuid,date) from public, anon, authenticated;
revoke all on function public._asist_resumen(uuid,date,date,int) from public, anon, authenticated;
revoke all on function public.asist_trg_inmutable() from public, anon, authenticated;
do $$ declare f text; begin
  foreach f in array array[
    'public.asist_kiosko_emitir(text,int)', 'public.asist_kiosko_estado(uuid)', 'public.asist_marcar(text,text)',
    'public.asist_mi_resumen(date,date)', 'public.asist_admin_resumen(date,date,uuid)', 'public.asist_admin_equipo()',
    'public.asist_admin_marca_manual(uuid,text,timestamptz,text)', 'public.asist_admin_anular(uuid,text)',
    'public.asist_admin_dispositivo_liberar(uuid)', 'public.asist_admin_turnos_guardar(uuid,jsonb)', 'public.asist_verificar_cadena()']
  loop
    execute format('revoke all on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;

-- ─── Limpieza: los códigos QR se guardan 30 días para auditoría y luego se purgan ───
do $$ begin
  if exists (select 1 from cron.job where jobname = 'koach_asist_purga_qr') then perform cron.unschedule('koach_asist_purga_qr'); end if;
  perform cron.schedule('koach_asist_purga_qr', '17 4 * * *', $c$ delete from public.staff_qr_tokens where emitido_at < now() - interval '30 days' $c$);
end $$;
