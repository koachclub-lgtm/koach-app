-- Anamnesis de la clase de prueba: la persona la responde en su app al entrar con el QR (antes de su demo).
-- El Dashboard arma con ella la ficha del koach (estado de conciencia, dolores, puntos críticos, clasificación)
-- y recomienda 3 protocolos base según el volumen real de cada base.

create table if not exists public.anamnesis_prueba (
  socio_id uuid primary key references public.profiles(id) on delete cascade,
  respuestas jsonb not null default '{}'::jsonb,
  protocolo_propuesto uuid references public.protocolos(id) on delete set null,
  propuesto_por uuid,
  propuesto_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.anamnesis_prueba enable row level security;
create policy an_leer on public.anamnesis_prueba for select using ((select public.es_staff()) or socio_id = (select auth.uid()));
-- escrituras solo por RPC (security definer)

-- La persona guarda sus respuestas (una fila por persona; se puede rehacer mientras sea clase de prueba).
create or replace function public.mi_anamnesis_guardar(p_respuestas jsonb)
returns jsonb language plpgsql security definer set search_path = public as $f$
declare v_uid uuid := auth.uid(); v_est text;
begin
  if v_uid is null then raise exception 'Sin sesión'; end if;
  select estado into v_est from profiles where id = v_uid;
  if v_est is distinct from 'clase_prueba' and exists (select 1 from anamnesis_prueba where socio_id = v_uid) then
    raise exception 'ANAMNESIS: ya registrada';
  end if;
  if jsonb_typeof(p_respuestas) <> 'object' or length(p_respuestas::text) > 20000 then raise exception 'ANAMNESIS: formato inválido'; end if;
  insert into anamnesis_prueba(socio_id, respuestas) values (v_uid, p_respuestas)
  on conflict (socio_id) do update set respuestas = excluded.respuestas, updated_at = now();
  return jsonb_build_object('ok', true);
end $f$;
revoke all on function public.mi_anamnesis_guardar(jsonb) from public, anon;
grant execute on function public.mi_anamnesis_guardar(jsonb) to authenticated;

-- Volumen semanal (sets por estímulo, semana 1) de cada protocolo base: insumo del recomendador.
create or replace function public.koach_bases_volumen()
returns jsonb language sql stable security definer set search_path = public as $f$
  select coalesce(jsonb_agg(jsonb_build_object('id', p.id, 'p', p.programa, 'n', p.nivel, 's', p.sexo, 'v', p.variante, 'nombre', p.nombre,
    'ses', (select string_agg(regexp_replace(s.nombre, '^S\d+ — ', ''), ' / ' order by s.numero) from sesiones_protocolo s where s.protocolo_id = p.id and coalesce(s.semana,1) = 1),
    'nses', (select count(*) from sesiones_protocolo s where s.protocolo_id = p.id and coalesce(s.semana,1) = 1),
    'e', coalesce((select jsonb_object_agg(x.est, x.n) from (
            select e.estimulo::text est, sum(b.sets) n from sesiones_protocolo s join bloques b on b.sesion_id = s.id
              join bloque_ejercicios be on be.bloque_id = b.id join ejercicios e on e.id = be.ejercicio_id
             where s.protocolo_id = p.id and coalesce(s.semana,1) = 1 and e.estimulo::text <> 'MOB' group by 1) x), '{}'::jsonb)
  ) order by p.programa, p.nivel, p.sexo, p.variante), '[]'::jsonb)
  from protocolos p where p.estado = 'base' and p.socio_id is null and public.es_staff()
$f$;
revoke all on function public.koach_bases_volumen() from public, anon;
grant execute on function public.koach_bases_volumen() to authenticated;

-- El koach deja propuesto el protocolo (se aplica al asignar programa cuando compra).
create or replace function public.koach_anamnesis_proponer(p_socio uuid, p_protocolo uuid)
returns jsonb language plpgsql security definer set search_path = public as $f$
begin
  if not public.es_entrenador() and coalesce(public.koach_rol() = 'recepcion', false) is not true then raise exception 'Sin permiso'; end if;
  if p_protocolo is not null and not exists (select 1 from protocolos where id = p_protocolo and estado = 'base' and socio_id is null) then
    raise exception 'ANAMNESIS: protocolo base inválido';
  end if;
  insert into anamnesis_prueba(socio_id, protocolo_propuesto, propuesto_por, propuesto_at)
    values (p_socio, p_protocolo, auth.uid(), now())
  on conflict (socio_id) do update set protocolo_propuesto = excluded.protocolo_propuesto, propuesto_por = excluded.propuesto_por,
    propuesto_at = excluded.propuesto_at, updated_at = now();
  return jsonb_build_object('ok', true);
end $f$;
revoke all on function public.koach_anamnesis_proponer(uuid, uuid) from public, anon;
grant execute on function public.koach_anamnesis_proponer(uuid, uuid) to authenticated;

-- La preselección de la CLASE DEMO usa primero la anamnesis; si no hay, la conversación con Jake.
create or replace function public.koach_demo_sugerencia(p_socio uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $f$
declare v_p profiles; c record; v_cita record; v_an jsonb; v_prog text; v_niv text; v_sx text; v_zona text; v_exp text; v_obj text; v_act record;
begin
  if not public.es_staff() then raise exception 'Sin permiso'; end if;
  select * into v_p from profiles where id = p_socio;
  if not found then raise exception 'DEMO: perfil no encontrado'; end if;
  select respuestas into v_an from anamnesis_prueba where socio_id = p_socio and respuestas <> '{}'::jsonb;
  select objetivo, experiencia, dolor, preferencia, programa_interes into c from jake_contactos
   where socio_id = p_socio or (v_p.telefono is not null and telefono = v_p.telefono)
   order by (socio_id = p_socio) desc nulls last, updated_at desc limit 1;
  select formato, inicio into v_cita from agenda_citas
   where servicio = 'clase_prueba' and estado <> 'cancelada' and (socio_id = p_socio or (v_p.telefono is not null and telefono = v_p.telefono))
   order by abs(extract(epoch from inicio - now())) limit 1;
  v_sx := case when v_p.sex::text in ('hombre','mujer') then v_p.sex::text end;
  if v_an is not null then
    v_prog := case v_an->>'objetivo' when 'grasa' then 'BURN' when 'salud' then 'HEALTHY' else 'STRONG' end;
    v_niv := case when v_prog = 'HEALTHY' or v_an->>'experiencia' in ('cero','antes') then 'BASICO' else 'INTERMEDIO' end;
    v_zona := case v_an->'zona'->>'z' when 'superior' then 'UPPER' when 'inferior' then 'LOWER' when 'completo' then 'FULL'
                else case when v_sx = 'mujer' then 'LOWER' else 'UPPER' end end;
  else
    v_exp := lower(coalesce(c.experiencia, ''));
    v_obj := lower(coalesce(c.objetivo, '') || ' ' || coalesce(c.dolor, '') || ' ' || coalesce(c.preferencia, ''));
    v_prog := upper(coalesce(nullif(v_cita.formato, ''), nullif(c.programa_interes, ''), 'STRONG'));
    if v_prog not in ('STRONG','BURN','HEALTHY') then v_prog := 'STRONG'; end if;
    v_niv := case
      when v_prog = 'HEALTHY' then 'BASICO'
      when v_exp ~ '(parte de cero|nunca|no entrena|no está entrenando|sin entrenar|retoma|dejó|pausa)' then 'BASICO'
      when v_exp ~ '(entrena hoy|entrena actualmente|entrenando|entrena hace|entreno|entrena \d)' then 'INTERMEDIO'
      else 'BASICO' end;
    v_zona := case
      when v_obj ~ '(glúte|glute|gluteo|pierna|cola|trasero|tren inferior)' then 'LOWER'
      when v_obj ~ '(pecho|brazo|espalda|hombro|tren superior)' then 'UPPER'
      when v_prog = 'STRONG' and v_sx = 'mujer' then 'LOWER'
      when v_prog = 'STRONG' and v_sx = 'hombre' then 'UPPER'
      else 'FULL' end;
  end if;
  select pr.programa::text programa, pr.nivel::text nivel, pr.sexo::text sexo, sp.objetivo zona, sp.nombre,
         exists (select 1 from sesiones_registro sr where sr.sesion_protocolo_id = sp.id and sr.socio_id = p_socio) entrenada
    into v_act
    from protocolos pr join sesiones_protocolo sp on sp.protocolo_id = pr.id
   where pr.socio_id = p_socio and pr.estado = 'demo' limit 1;
  return jsonb_build_object(
    'programa', v_prog, 'nivel', v_niv, 'sexo', v_sx, 'zona', v_zona,
    'origen', case when v_an is not null then 'anamnesis' else 'jake' end,
    'anamnesis', v_an,
    'fuentes', jsonb_build_object('objetivo', c.objetivo, 'experiencia', c.experiencia, 'dolor', c.dolor, 'preferencia', c.preferencia,
      'programa_interes', c.programa_interes, 'cita_formato', v_cita.formato, 'cita_inicio', v_cita.inicio),
    'activa', case when v_act.programa is null then null else to_jsonb(v_act) end);
end $f$;
revoke all on function public.koach_demo_sugerencia(uuid) from public, anon;
grant execute on function public.koach_demo_sugerencia(uuid) to authenticated;
