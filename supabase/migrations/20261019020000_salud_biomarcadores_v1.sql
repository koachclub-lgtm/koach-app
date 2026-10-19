-- SALUD · exámenes de laboratorio y biomarcadores (19-oct-2026)
-- Capa clínica del ecosistema KOACH: el socio (o nutrición) sube la foto/PDF de su examen, la IA lee los valores,
-- una persona los confirma y la app los compara contra el rango del laboratorio y contra su propio punto de partida.
-- KOACH no diagnostica: incorpora los datos, educa y deriva al médico lo que está fuera de rango.
-- Acceso: el socio a lo suyo · nutrición y admin a todo · coach y recepción sin acceso (minimización, Ley 21.719).

-- ── Consentimientos (Ley 21.719: datos de salud = sensibles → consentimiento explícito, específico y registrado)
create table if not exists public.consentimientos (
  id uuid primary key default gen_random_uuid(),
  socio_id uuid not null references public.profiles(id) on delete cascade,
  tipo text not null check (tipo in ('antropometria','almacenamiento_salud','ia_pauta','examenes_ia','estadistica')),
  version text not null,
  otorgado boolean not null,
  texto text,
  registrado_por uuid default auth.uid(),
  created_at timestamptz not null default now()
);
create index if not exists consent_socio_idx on public.consentimientos (socio_id, tipo, created_at desc);
alter table public.consentimientos enable row level security;
drop policy if exists consent_socio on public.consentimientos;
create policy consent_socio on public.consentimientos for select to authenticated using (socio_id = (select auth.uid()));
drop policy if exists consent_socio_ins on public.consentimientos;
create policy consent_socio_ins on public.consentimientos for insert to authenticated with check (socio_id = (select auth.uid()));
drop policy if exists consent_staff on public.consentimientos;
create policy consent_staff on public.consentimientos for all to authenticated
  using ((select koach_rol()) in ('admin','nutricionista')) with check ((select koach_rol()) in ('admin','nutricionista'));
grant select, insert on public.consentimientos to authenticated;   -- sin update/delete: el historial es la evidencia

-- Vigente = último registro de ese tipo (otorgar o revocar es siempre un registro nuevo)
create or replace function public.koach_consiente(p_socio uuid, p_tipo text)
returns boolean language sql stable security definer set search_path to 'public' as $$
  select coalesce((select otorgado from consentimientos where socio_id = p_socio and tipo = p_tipo order by created_at desc limit 1), false)
$$;
create or replace function public.koach_es_menor(p_socio uuid)
returns boolean language sql stable security definer set search_path to 'public' as $$
  select coalesce((select fecha_nacimiento > (current_date - interval '18 years')::date from profiles where id = p_socio), false)
$$;

-- ── Exámenes
create table if not exists public.examenes (
  id uuid primary key default gen_random_uuid(),
  socio_id uuid not null references public.profiles(id) on delete cascade,
  fecha_examen date not null,
  laboratorio text,
  estado text not null default 'confirmado' check (estado in ('confirmado','validado')),
  origen text not null default 'socio' check (origen in ('socio','staff')),
  archivos text[] not null default '{}',
  extraccion jsonb,
  modelo text,
  nota_nutricion text,
  anulado boolean not null default false,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  validado_por uuid,
  validado_at timestamptz
);
create index if not exists examenes_socio_idx on public.examenes (socio_id, fecha_examen);

create table if not exists public.biomarcadores (
  id uuid primary key default gen_random_uuid(),
  examen_id uuid not null references public.examenes(id) on delete cascade,
  socio_id uuid not null references public.profiles(id) on delete cascade,
  codigo text not null,
  valor numeric not null,
  unidad text not null,
  operador text check (operador in ('<','>')),
  nombre_original text,
  valor_texto text,
  unidad_original text,
  rango_min numeric,
  rango_max numeric,
  rango_texto text,
  rango_origen text check (rango_origen in ('laboratorio','koach')),
  editado boolean not null default false,
  created_at timestamptz not null default now(),
  unique (examen_id, codigo)
);
create index if not exists biomarcadores_socio_idx on public.biomarcadores (socio_id, codigo);

create or replace function public.koach_trg_examen()
returns trigger language plpgsql set search_path to 'public' as $$
begin
  new.updated_at := now();
  if new.estado = 'validado' and (tg_op = 'INSERT' or old.estado is distinct from 'validado') then
    new.validado_por := auth.uid(); new.validado_at := now();
  end if;
  -- solo nutrición/admin pueden validar
  if new.estado = 'validado' and coalesce(koach_rol(), '') not in ('admin','nutricionista') and (tg_op = 'INSERT' or old.estado is distinct from 'validado') then
    raise exception 'solo nutrición puede validar un examen';
  end if;
  return new;
end $$;
drop trigger if exists trg_examen on public.examenes;
create trigger trg_examen before insert or update on public.examenes for each row execute function public.koach_trg_examen();

alter table public.examenes enable row level security;
alter table public.biomarcadores enable row level security;

-- Socio: ve lo suyo; sube solo con consentimiento vigente y siendo mayor de edad; edita mientras nutrición no lo valide
drop policy if exists exa_socio_sel on public.examenes;
create policy exa_socio_sel on public.examenes for select to authenticated using (socio_id = (select auth.uid()));
drop policy if exists exa_socio_ins on public.examenes;
create policy exa_socio_ins on public.examenes for insert to authenticated
  with check (socio_id = (select auth.uid()) and origen = 'socio' and estado = 'confirmado'
              and koach_consiente((select auth.uid()), 'examenes_ia') and not koach_es_menor((select auth.uid())));
drop policy if exists exa_socio_upd on public.examenes;
create policy exa_socio_upd on public.examenes for update to authenticated
  using (socio_id = (select auth.uid()) and estado = 'confirmado') with check (socio_id = (select auth.uid()) and estado = 'confirmado');
drop policy if exists exa_staff on public.examenes;
create policy exa_staff on public.examenes for all to authenticated
  using ((select koach_rol()) in ('admin','nutricionista')) with check ((select koach_rol()) in ('admin','nutricionista'));

drop policy if exists bio_socio_sel on public.biomarcadores;
create policy bio_socio_sel on public.biomarcadores for select to authenticated using (socio_id = (select auth.uid()));
drop policy if exists bio_socio_ins on public.biomarcadores;
create policy bio_socio_ins on public.biomarcadores for insert to authenticated
  with check (socio_id = (select auth.uid()) and exists (select 1 from examenes e where e.id = examen_id and e.socio_id = (select auth.uid()) and e.estado = 'confirmado'));
drop policy if exists bio_socio_upd on public.biomarcadores;
create policy bio_socio_upd on public.biomarcadores for update to authenticated
  using (socio_id = (select auth.uid()) and exists (select 1 from examenes e where e.id = examen_id and e.estado = 'confirmado'))
  with check (socio_id = (select auth.uid()));
drop policy if exists bio_socio_del on public.biomarcadores;
create policy bio_socio_del on public.biomarcadores for delete to authenticated
  using (socio_id = (select auth.uid()) and exists (select 1 from examenes e where e.id = examen_id and e.estado = 'confirmado'));
drop policy if exists bio_staff on public.biomarcadores;
create policy bio_staff on public.biomarcadores for all to authenticated
  using ((select koach_rol()) in ('admin','nutricionista')) with check ((select koach_rol()) in ('admin','nutricionista'));

grant select, insert, update on public.examenes to authenticated;
grant select, insert, update, delete on public.biomarcadores to authenticated;

-- ── Lectura única de la capa clínica + contexto de entrenamiento entre exámenes
-- socio: lo suyo (con membresía al día) · nutrición/admin: cualquiera · coach/recepción: sin acceso
create or replace function public.koach_salud(p_socio uuid default null)
returns jsonb language plpgsql stable security definer set search_path to 'public' as $$
declare v_uid uuid := auth.uid(); v_rol text; v_sid uuid; v_full boolean;
begin
  if v_uid is null then raise exception 'no autenticado'; end if;
  v_sid := coalesce(p_socio, v_uid);
  select role::text into v_rol from profiles where id = v_uid and coalesce(activo, true);
  v_full := coalesce(v_rol, '') in ('admin','nutricionista');
  if v_sid <> v_uid and not v_full then raise exception 'sin permiso'; end if;
  if v_sid = v_uid and coalesce(v_rol, 'socio') = 'socio' and not koach_acceso_ok(v_uid) then
    return jsonb_build_object('bloqueado', true);
  end if;
  return jsonb_build_object(
    'consiente', koach_consiente(v_sid, 'examenes_ia'),
    'menor', koach_es_menor(v_sid),
    'puede_validar', v_full,
    'examenes', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', e.id, 'fecha', e.fecha_examen, 'laboratorio', e.laboratorio, 'estado', e.estado, 'origen', e.origen,
        'archivos', e.archivos, 'nota_nutricion', e.nota_nutricion, 'validado_at', e.validado_at, 'created_at', e.created_at,
        'valores', coalesce((select jsonb_agg(jsonb_strip_nulls(jsonb_build_object('codigo', b.codigo, 'valor', b.valor, 'unidad', b.unidad,
             'operador', b.operador, 'rango_min', b.rango_min, 'rango_max', b.rango_max, 'rango_texto', b.rango_texto, 'rango_origen', b.rango_origen,
             'nombre_original', b.nombre_original, 'editado', b.editado)) order by b.codigo)
           from biomarcadores b where b.examen_id = e.id), '[]'::jsonb),
        -- lo que hizo entre el examen anterior (o 90 días antes del primero) y este
        'entreno', (with w as (
            select coalesce((select max(e2.fecha_examen) from examenes e2 where e2.socio_id = v_sid and not e2.anulado and e2.fecha_examen < e.fecha_examen), e.fecha_examen - 90) as desde),
          ses as (select r.id from sesiones_registro r, w where r.socio_id = v_sid and r.estado::text is distinct from 'anulada' and r.fecha > w.desde and r.fecha <= e.fecha_examen)
          select jsonb_build_object('desde', (select desde from w), 'sesiones', (select count(*) from ses),
            'kg', round(coalesce((select sum(s.peso::numeric * coalesce(nullif(substring(coalesce(s.reps::text,'') from '\d+'),'')::numeric,0))
                   from set_registros s where s.registro_id in (select id from ses) and s.completado and s.peso > 0 and s.peso <= 500), 0))))
      ) order by e.fecha_examen)
      from examenes e where e.socio_id = v_sid and not e.anulado), '[]'::jsonb)
  );
end $$;
revoke all on function public.koach_salud(uuid) from public, anon;
grant execute on function public.koach_salud(uuid) to authenticated;

-- ── Archivos originales (foto/PDF): bucket privado, carpeta por socio
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('examenes', 'examenes', false, 10485760, array['image/jpeg','image/png','image/webp','image/heic','application/pdf'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists examenes_leer on storage.objects;
create policy examenes_leer on storage.objects for select to authenticated
  using (bucket_id = 'examenes' and ((storage.foldername(name))[1] = (select auth.uid())::text or (select koach_rol()) in ('admin','nutricionista')));
drop policy if exists examenes_subir on storage.objects;
create policy examenes_subir on storage.objects for insert to authenticated
  with check (bucket_id = 'examenes' and (((storage.foldername(name))[1] = (select auth.uid())::text and koach_consiente((select auth.uid()), 'examenes_ia'))
              or (select koach_rol()) in ('admin','nutricionista')));
drop policy if exists examenes_borrar on storage.objects;
create policy examenes_borrar on storage.objects for delete to authenticated
  using (bucket_id = 'examenes' and ((storage.foldername(name))[1] = (select auth.uid())::text or (select koach_rol()) in ('admin','nutricionista')));
