-- SALUD · contrato y consentimiento v2 (19-oct-2026)
-- Ley 21.719 art. 16 bis: los datos de salud no pueden recolectarse "en el ámbito deportivo". Por eso el responsable
-- de los exámenes es un PRESTADOR DE SALUD (nutricionista o centro médico) y Programas de Entrenamiento COACH SpA
-- solo opera la plataforma como encargado. El socio acepta un contrato separado de su membresía, con casillas por
-- finalidad (arts. 12 y 16), y cada aceptación queda con versión, hash SHA-256 del texto mostrado, RUT del responsable,
-- fecha y dispositivo. Otorgar y retirar es siempre un registro nuevo (sin update/delete): el historial es la prueba.
-- La versión v2 nace INACTIVA: se activa con koach_activar_consentimiento() cuando el prestador y su RUT estén definidos.

-- ── Textos versionados (lo que el socio lee y acepta)
create table if not exists public.consentimiento_textos (
  version text primary key,
  responsable_nombre text not null,
  responsable_rut text not null,
  responsable_registro text,
  documento text not null,              -- contrato + política, markdown simple (##, **, listas)
  casillas jsonb not null,              -- [{codigo, obligatoria, texto}]
  declaracion text not null,
  sha256 text,
  activo boolean not null default false,
  activado_at timestamptz,
  created_at timestamptz not null default now()
);
create unique index if not exists consent_txt_un_activo on public.consentimiento_textos (activo) where activo;

create or replace function public.koach_trg_consent_txt() returns trigger language plpgsql set search_path to 'public' as $$
begin
  if tg_op = 'UPDATE' and (new.documento, new.casillas, new.declaracion, new.responsable_rut) is distinct from (old.documento, old.casillas, old.declaracion, old.responsable_rut)
     and exists (select 1 from consentimientos c where c.version = old.version) then
    raise exception 'La versión % ya fue aceptada por socios: crea una versión nueva', old.version;
  end if;
  new.sha256 := encode(sha256(convert_to(new.documento || E'\n--\n' || new.casillas::text || E'\n--\n' || new.declaracion || E'\n--\n' || new.responsable_rut, 'UTF8')), 'hex');
  if new.activo and (tg_op = 'INSERT' or not old.activo) then new.activado_at := now(); end if;
  return new;
end $$;
drop trigger if exists trg_consent_txt on public.consentimiento_textos;
create trigger trg_consent_txt before insert or update on public.consentimiento_textos for each row execute function public.koach_trg_consent_txt();

alter table public.consentimiento_textos enable row level security;
drop policy if exists consent_txt_leer on public.consentimiento_textos;
create policy consent_txt_leer on public.consentimiento_textos for select to authenticated using (true);
drop policy if exists consent_txt_admin on public.consentimiento_textos;
create policy consent_txt_admin on public.consentimiento_textos for all to authenticated
  using ((select koach_rol()) = 'admin') with check ((select koach_rol()) = 'admin');
grant select on public.consentimiento_textos to authenticated;

-- ── Registro de consentimientos: nuevos códigos y evidencia
alter table public.consentimientos drop constraint if exists consentimientos_tipo_check;
alter table public.consentimientos add constraint consentimientos_tipo_check check (tipo in
  ('antropometria','almacenamiento_salud','ia_pauta','examenes_ia','estadistica',
   'salud_contrato','salud_datos','salud_ia','salud_contexto','salud_estadistica'));
alter table public.consentimientos add column if not exists texto_sha256 text;
alter table public.consentimientos add column if not exists responsable_rut text;
alter table public.consentimientos add column if not exists dispositivo text;
-- el socio ya no inserta directo: lo hace koach_consentir (verifica versión vigente y deja el hash)
drop policy if exists consent_socio_ins on public.consentimientos;

create or replace function public.koach_consent_version() returns text language sql stable security definer set search_path to 'public' as $$
  select version from consentimiento_textos where activo limit 1
$$;

-- Vigente = último registro de ese código, otorgado y de la versión activa. Sin contrato vigente no vale ninguna casilla.
-- 'examenes_ia' se mantiene como alias (v1) = contrato + datos + IA.
create or replace function public.koach_consiente(p_socio uuid, p_tipo text)
returns boolean language plpgsql stable security definer set search_path to 'public' as $$
declare v text := koach_consent_version();
begin
  if v is null or p_socio is null then return false; end if;
  if p_tipo = 'examenes_ia' then
    return koach_consiente(p_socio, 'salud_datos') and koach_consiente(p_socio, 'salud_ia');
  end if;
  if p_tipo <> 'salud_contrato' and not koach_consiente(p_socio, 'salud_contrato') then return false; end if;
  return coalesce((select c.otorgado and c.version = v from consentimientos c
                   where c.socio_id = p_socio and c.tipo = p_tipo order by c.created_at desc, c.otorgado limit 1), false);
end $$;

create or replace function public.koach_consentimientos(p_socio uuid)
returns jsonb language sql stable security definer set search_path to 'public' as $$
  select jsonb_build_object(
    'version', koach_consent_version(),
    'disponible', koach_consent_version() is not null,
    'vigentes', (select coalesce(jsonb_object_agg(t, koach_consiente(p_socio, t)), '{}'::jsonb)
                 from unnest(array['salud_contrato','salud_datos','salud_ia','salud_contexto','salud_estadistica']) t),
    'aceptado_at', (select max(created_at) from consentimientos where socio_id = p_socio and tipo = 'salud_contrato' and otorgado
                    and version = koach_consent_version()))
$$;

-- Texto activo para mostrar al socio (con el hash que quedará en su aceptación)
create or replace function public.koach_consentimiento_texto()
returns jsonb language sql stable security definer set search_path to 'public' as $$
  select jsonb_build_object('version', version, 'responsable', responsable_nombre, 'rut', responsable_rut, 'registro', responsable_registro,
    'documento', documento, 'casillas', casillas, 'declaracion', declaracion, 'sha256', sha256)
  from consentimiento_textos where activo limit 1
$$;

-- Otorgar / retirar (solo el propio socio). p_sha = hash del texto que se le mostró: debe ser el de la versión activa.
create or replace function public.koach_consentir(p_version text, p_sha text, p_otorgar text[] default '{}', p_retirar text[] default '{}', p_dispositivo text default null)
returns jsonb language plpgsql volatile security definer set search_path to 'public' as $$
declare v_uid uuid := auth.uid(); t consentimiento_textos; c text; v_ret text[] := coalesce(p_retirar, '{}'); v_otg text[] := coalesce(p_otorgar, '{}');
  v_cod text[]; v_obl text[];
begin
  if v_uid is null then raise exception 'no autenticado'; end if;
  select * into t from consentimiento_textos where activo;
  if not found then raise exception 'El servicio de salud aún no está disponible'; end if;
  select array_agg(x->>'codigo'), array_agg(x->>'codigo') filter (where (x->>'obligatoria')::boolean)
    into v_cod, v_obl from jsonb_array_elements(t.casillas) x;

  if cardinality(v_otg) > 0 then
    if p_version is distinct from t.version or p_sha is distinct from t.sha256 then
      raise exception 'El contrato cambió mientras lo leías: vuelve a abrirlo';
    end if;
    if koach_es_menor(v_uid) then raise exception 'Los menores de edad se inscriben con su apoderado ante nutrición'; end if;
    if exists (select 1 from unnest(v_otg) x where x <> all(v_cod)) then raise exception 'Casilla desconocida'; end if;
    -- las obligatorias deben venir marcadas o estar ya vigentes
    if exists (select 1 from unnest(v_obl) o where o <> all(v_otg) and not koach_consiente(v_uid, o)) then
      raise exception 'Faltan autorizaciones obligatorias';
    end if;
    -- primero el contrato, para que las demás casillas queden después en el tiempo
    foreach c in array (select array_agg(x order by x <> 'salud_contrato', x) from unnest(v_otg) x) loop
      if c = any(v_ret) then continue; end if;
      insert into consentimientos (socio_id, tipo, version, otorgado, texto, texto_sha256, responsable_rut, dispositivo)
      values (v_uid, c, t.version, true,
              (select x->>'texto' from jsonb_array_elements(t.casillas) x where x->>'codigo' = c), t.sha256, t.responsable_rut, left(p_dispositivo, 300));
    end loop;
  end if;

  -- retirar el contrato (o los datos) termina el servicio: retira todo
  if 'salud_contrato' = any(v_ret) or 'salud_datos' = any(v_ret) then v_ret := v_cod; end if;
  foreach c in array v_ret loop
    if c <> all(v_cod) then raise exception 'Casilla desconocida'; end if;
    if c = 'salud_contrato' or coalesce((select x.otorgado from consentimientos x where x.socio_id = v_uid and x.tipo = c order by x.created_at desc, x.otorgado limit 1), false) then
      insert into consentimientos (socio_id, tipo, version, otorgado, texto, texto_sha256, responsable_rut, dispositivo)
      values (v_uid, c, t.version, false, 'Retiro desde la app', t.sha256, t.responsable_rut, left(p_dispositivo, 300));
    end if;
  end loop;
  return koach_consentimientos(v_uid);
end $$;
revoke all on function public.koach_consentir(text, text, text[], text[], text) from public, anon;
grant execute on function public.koach_consentir(text, text, text[], text[], text) to authenticated;
revoke all on function public.koach_consentimiento_texto() from public, anon;
grant execute on function public.koach_consentimiento_texto() to authenticated;
revoke all on function public.koach_consentimientos(uuid) from public, anon;

-- Activar una versión (admin): reemplaza los marcadores del prestador y la deja como única activa.
create or replace function public.koach_activar_consentimiento(p_version text, p_nombre text, p_rut text, p_registro text, p_medico text, p_correo text, p_domicilio text, p_precio text default 'sin costo adicional')
returns text language plpgsql volatile security definer set search_path to 'public' as $$
declare r text;
begin
  if koach_rol() is distinct from 'admin' then raise exception 'sin permiso'; end if;
  if coalesce(trim(p_nombre), '') = '' or coalesce(trim(p_rut), '') = '' or coalesce(trim(p_correo), '') = '' then raise exception 'Faltan nombre, RUT o correo del prestador'; end if;
  update consentimiento_textos set activo = false where activo and version <> p_version;
  update consentimiento_textos set
    responsable_nombre = p_nombre, responsable_rut = p_rut, responsable_registro = p_registro,
    documento = replace(replace(replace(replace(replace(replace(replace(documento,
      '[NOMBRE PRESTADOR]', p_nombre), '[RUT PRESTADOR]', p_rut), '[N° REGISTRO]', coalesce(p_registro, '—')),
      '[MÉDICO SUPERVISOR]', coalesce(p_medico, 'el médico supervisor del Prestador')), '[CORREO DPD]', p_correo),
      '[DOMICILIO]', coalesce(p_domicilio, 'Concepción')), '[PRECIO]', coalesce(p_precio, 'sin costo adicional')),
    casillas = replace(casillas::text, '[NOMBRE PRESTADOR]', p_nombre)::jsonb,
    declaracion = replace(declaracion, '[NOMBRE PRESTADOR]', p_nombre),
    activo = true
  where version = p_version returning sha256 into r;
  if r is null then raise exception 'Versión % no existe', p_version; end if;
  return r;
end $$;
revoke all on function public.koach_activar_consentimiento(text, text, text, text, text, text, text, text) from public, anon;
grant execute on function public.koach_activar_consentimiento(text, text, text, text, text, text, text, text) to authenticated;

-- ── Permisos que dependen del consentimiento: guardar exige 'salud_datos'; leer con IA exige además 'salud_ia' (en /api/examen-ia)
drop policy if exists exa_socio_ins on public.examenes;
create policy exa_socio_ins on public.examenes for insert to authenticated
  with check (socio_id = (select auth.uid()) and origen = 'socio' and estado = 'confirmado'
              and koach_consiente((select auth.uid()), 'salud_datos') and not koach_es_menor((select auth.uid())));
drop policy if exists examenes_subir on storage.objects;
create policy examenes_subir on storage.objects for insert to authenticated
  with check (bucket_id = 'examenes' and (((storage.foldername(name))[1] = (select auth.uid())::text and koach_consiente((select auth.uid()), 'salud_datos'))
              or (select koach_rol()) in ('admin','nutricionista')));

-- ── koach_salud v2: el servicio de salud es independiente de la membresía (el socio siempre ve sus datos:
-- derecho de acceso) y devuelve el estado de cada consentimiento.
create or replace function public.koach_salud(p_socio uuid default null)
returns jsonb language plpgsql stable security definer set search_path to 'public' as $$
declare v_uid uuid := auth.uid(); v_rol text; v_sid uuid; v_full boolean;
begin
  if v_uid is null then raise exception 'no autenticado'; end if;
  v_sid := coalesce(p_socio, v_uid);
  select role::text into v_rol from profiles where id = v_uid and coalesce(activo, true);
  v_full := coalesce(v_rol, '') in ('admin','nutricionista');
  if v_sid <> v_uid and not v_full then raise exception 'sin permiso'; end if;
  return jsonb_build_object(
    'consiente', koach_consiente(v_sid, 'salud_datos'),
    'consiente_ia', koach_consiente(v_sid, 'salud_ia'),
    'consentimiento', koach_consentimientos(v_sid),
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
        -- contexto de entrenamiento solo con la casilla 'salud_contexto'
        'entreno', case when koach_consiente(v_sid, 'salud_contexto') then (with w as (
            select coalesce((select max(e2.fecha_examen) from examenes e2 where e2.socio_id = v_sid and not e2.anulado and e2.fecha_examen < e.fecha_examen), e.fecha_examen - 90) as desde),
          ses as (select r.id from sesiones_registro r, w where r.socio_id = v_sid and r.estado::text is distinct from 'anulada' and r.fecha > w.desde and r.fecha <= e.fecha_examen)
          select jsonb_build_object('desde', (select desde from w), 'sesiones', (select count(*) from ses),
            'kg', round(coalesce((select sum(s.peso::numeric * coalesce(nullif(substring(coalesce(s.reps::text,'') from '\d+'),'')::numeric,0))
                   from set_registros s where s.registro_id in (select id from ses) and s.completado and s.peso > 0 and s.peso <= 500), 0)))) end
      ) order by e.fecha_examen)
      from examenes e where e.socio_id = v_sid and not e.anulado), '[]'::jsonb)
  );
end $$;
revoke all on function public.koach_salud(uuid) from public, anon;
grant execute on function public.koach_salud(uuid) to authenticated;

-- ── Texto v2 (borrador para abogado; nace inactivo)
insert into public.consentimiento_textos (version, responsable_nombre, responsable_rut, documento, casillas, declaracion, activo)
values ('examenes-salud-v2-2026-10', '[NOMBRE PRESTADOR]', '[RUT PRESTADOR]',
$doc$## Contrato de prestación del servicio de salud

Entre [NOMBRE PRESTADOR], RUT [RUT PRESTADOR], registro Superintendencia de Salud N° [N° REGISTRO], domiciliado en [DOMICILIO] ("el Prestador"), y el socio que acepta este contrato en la app KOACH ("el Socio").

**1. Objeto.** El Prestador te entrega un servicio de seguimiento nutricional y de salud: registro y lectura asistida de tus exámenes de laboratorio, comparación con el rango de tu laboratorio y con tus propios resultados anteriores, material educativo y revisión por un profesional de salud.

**2. Voluntario y separado de tu membresía.** Este servicio es distinto de tu membresía de entrenamiento con Programas de Entrenamiento COACH SpA. No aceptarlo, o retirarte, no afecta tu acceso al gimnasio, tus entrenamientos ni ningún otro beneficio.

**3. Lo que no es.** No es diagnóstico, pronóstico ni tratamiento médico. La app muestra tu valor, el rango de referencia de tu laboratorio y su tendencia, y explica qué mide cada marcador. Las conclusiones clínicas y cualquier derivación las emite y firma [MÉDICO SUPERVISOR]. No reemplaza una urgencia: ante síntomas, consulta a tu médico o llama al 131.

**4. Compromisos del Prestador.**
- Revisar cada examen que cargues y validar tu informe.
- Contactarte por un medio directo si un valor está en un nivel que conviene revisar pronto con un médico.
- Mantener tu ficha clínica conforme a la Ley 20.584.
- Usar tus datos solo para las finalidades que aceptes y no cederlos a nadie: ni a coaches, ni a empleadores, aseguradoras, laboratorios o marcas.

**5. Tus compromisos.**
- Subir solo tus propios exámenes, completos y sin alterar.
- Revisar los valores leídos antes de confirmarlos.
- Avisar al Prestador cambios relevantes de salud, embarazo o medicamentos.

**6. Precio.** [PRECIO], cobrado por el Prestador en documento propio, separado de tu membresía. El Prestador no paga ni recibe comisiones de laboratorios.

**7. Duración y término.** Indefinido. Puedes terminarlo cuando quieras desde MI SALUD → Privacidad o escribiendo a [CORREO DPD], gratis y sin dar motivos.

## Política de tratamiento de tus datos de salud

**Quién es quién.** Responsable: [NOMBRE PRESTADOR] (RUT [RUT PRESTADOR]), decide para qué se usan tus datos y responde ante ti. Encargado: Programas de Entrenamiento COACH SpA (RUT 77.133.627-2), opera la app solo por instrucción del Responsable. Proveedores: Supabase (almacenamiento cifrado), Vercel (servidor) y Anthropic, EE. UU. (solo transcribe los valores de la imagen; no la guarda ni entrena modelos con ella). Contacto: [CORREO DPD].

**Qué datos.** Foto o PDF del examen; valores, unidades y rangos; fecha y laboratorio; notas del profesional; sexo, edad, peso y composición corporal; y, si lo autorizas, tu registro de entrenamiento.

**Quién los ve.** Tú y los profesionales de salud del Responsable. Tu coach, recepción y la administración del gimnasio no tienen acceso: el sistema lo bloquea y cada acceso queda registrado.

**Lectura con IA y decisiones automáticas.** Tú revisas los valores leídos antes de guardarlos. Si un valor está dentro o fuera del rango de tu laboratorio lo indica una regla fija, solo como información. Puedes pedir explicación, oponerte y pedir revisión humana.

**Fuera de Chile.** Anthropic, Supabase y Vercel procesan datos fuera de Chile bajo cláusulas contractuales con garantías.

**Cuánto tiempo.** Foto o PDF original: 90 días desde que confirmas los valores. Valores confirmados e informe validado (ficha clínica): 15 años desde la última atención, como exige la Ley 20.584. Registro de autorizaciones: mientras dure el servicio y 5 años después.

**Tus derechos.** Acceso, rectificación, supresión, oposición, portabilidad y bloqueo, gratis, desde la app o en [CORREO DPD]. La supresión no alcanza la ficha clínica mientras la ley obligue a conservarla: en ese caso se bloquea. Puedes reclamar ante la Agencia de Protección de Datos Personales.

**Seguridad.** Cifrado en tránsito y en reposo, acceso con autenticación y registro de accesos. Si una vulneración afecta tus datos te avisaremos en lenguaje claro y la reportaremos a la Agencia.

**Lo que nunca hacemos.** Vender tus datos, usarlos para publicidad, cederlos a empleadores, aseguradoras, marcas o laboratorios, usarlos para entrenar modelos de IA o mostrárselos a tu coach.$doc$,
'[{"codigo":"salud_contrato","obligatoria":true,"texto":"Leí y acepto el Contrato de prestación y la Política de tratamiento de datos de salud de [NOMBRE PRESTADOR]. Entiendo que este servicio es distinto de mi membresía y que no es un diagnóstico médico."},
  {"codigo":"salud_datos","obligatoria":true,"texto":"Autorizo de forma expresa a [NOMBRE PRESTADOR] a guardar mis exámenes de laboratorio y los valores que confirmo, para mostrarme su evolución y que un profesional de salud los revise."},
  {"codigo":"salud_ia","obligatoria":false,"texto":"Autorizo que la foto o PDF de mi examen se envíe a Anthropic PBC (EE. UU.) solo para transcribir los valores. No se usa para entrenar modelos y la foto se borra a los 90 días. Sin esta casilla puedo ingresar los valores a mano."},
  {"codigo":"salud_contexto","obligatoria":false,"texto":"Autorizo relacionar mis resultados con mi entrenamiento y composición corporal registrados en KOACH dentro de mi informe. Mi coach no verá mis exámenes."},
  {"codigo":"salud_estadistica","obligatoria":false,"texto":"Autorizo usar mis datos de forma anonimizada, sin que nadie pueda identificarme, para estadísticas que mejoren el servicio."}]'::jsonb,
'Declaro ser mayor de 18 años, ser el titular de los exámenes que subiré y haber leído este contrato. No compartiré mi cuenta. Sé que puedo retirar cada autorización cuando quiera, gratis y sin afectar mi membresía, y que el retiro no tiene efecto retroactivo.',
false)
on conflict (version) do nothing;
