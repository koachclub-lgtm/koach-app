-- Clases de prueba (DEMO): plantillas estado 'demo' (programa × nivel × sexo) con sesiones LOWER/UPPER/FULL BODY
-- de 2 bloques × 3 sets. Al activar una demo se clona SOLO la sesión elegida a un protocolo personal (estado 'demo'),
-- se asigna y se habilita hoy. Si la persona compra (deja de ser clase de prueba), su demo se archiva sola.

drop index if exists public.uq_protocolos_base_variante;
create unique index uq_protocolos_base_variante on public.protocolos (programa, nivel, sexo, variante)
  where socio_id is null and estado is distinct from 'demo';
create unique index if not exists uq_protocolos_demo on public.protocolos (programa, nivel, sexo)
  where socio_id is null and estado = 'demo';

-- Cierra la demo de una persona: la borra si nunca se entrenó (p_borrar); si se entrenó, la archiva (queda el historial).
create or replace function public._koach_demo_cerrar(p_socio uuid, p_borrar boolean default false)
returns int language plpgsql security definer set search_path = public as $f$
declare r record; n int := 0; v_prev text := coalesce(current_setting('koach.sync', true),'');
begin
  perform set_config('koach.sync','1',true);
  for r in select id from protocolos where socio_id = p_socio and estado = 'demo' loop
    if p_borrar and not exists (select 1 from sesiones_registro sr join sesiones_protocolo sp on sp.id = sr.sesion_protocolo_id where sp.protocolo_id = r.id) then
      delete from sesion_habilitada where asignacion_id in (select id from asignaciones where protocolo_id = r.id)
        or sesion_protocolo_id in (select id from sesiones_protocolo where protocolo_id = r.id);
      delete from asignaciones where protocolo_id = r.id;
      delete from bloque_ejercicios where bloque_id in (select b.id from bloques b join sesiones_protocolo sp on sp.id = b.sesion_id where sp.protocolo_id = r.id);
      delete from bloques where sesion_id in (select id from sesiones_protocolo where protocolo_id = r.id);
      delete from sesiones_protocolo where protocolo_id = r.id;
      delete from protocolos where id = r.id;
    else
      update sesion_habilitada set estado = 'retirada' where estado = 'activa' and sesion_protocolo_id in (select id from sesiones_protocolo where protocolo_id = r.id);
      update asignaciones set activo = false where protocolo_id = r.id and activo;
      update protocolos set estado = 'archivado' where id = r.id;
    end if;
    n := n + 1;
  end loop;
  perform set_config('koach.sync', v_prev, true);
  return n;
end $f$;
revoke all on function public._koach_demo_cerrar(uuid, boolean) from public, anon, authenticated;

-- Dashboard: antes de asignar su programa real a quien venía de clase de prueba.
create or replace function public.koach_demo_cerrar(p_socio uuid)
returns int language plpgsql security definer set search_path = public as $f$
begin
  if not public.es_staff() then raise exception 'Sin permiso'; end if;
  return public._koach_demo_cerrar(p_socio, false);
end $f$;
revoke all on function public.koach_demo_cerrar(uuid) from public, anon;
grant execute on function public.koach_demo_cerrar(uuid) to authenticated;

-- Preselección con lo que ya se sabe de la persona (conversación con Jake + cita + perfil).
create or replace function public.koach_demo_sugerencia(p_socio uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $f$
declare v_p profiles; c record; v_cita record; v_prog text; v_niv text; v_sx text; v_zona text; v_exp text; v_obj text; v_act record;
begin
  if not public.es_staff() then raise exception 'Sin permiso'; end if;
  select * into v_p from profiles where id = p_socio;
  if not found then raise exception 'DEMO: perfil no encontrado'; end if;
  select objetivo, experiencia, dolor, preferencia, programa_interes into c from jake_contactos
   where socio_id = p_socio or (v_p.telefono is not null and telefono = v_p.telefono)
   order by (socio_id = p_socio) desc nulls last, updated_at desc limit 1;
  select formato, inicio into v_cita from agenda_citas
   where servicio = 'clase_prueba' and estado <> 'cancelada' and (socio_id = p_socio or (v_p.telefono is not null and telefono = v_p.telefono))
   order by abs(extract(epoch from inicio - now())) limit 1;
  v_exp := lower(coalesce(c.experiencia, ''));
  v_obj := lower(coalesce(c.objetivo, '') || ' ' || coalesce(c.dolor, '') || ' ' || coalesce(c.preferencia, ''));
  v_prog := upper(coalesce(nullif(v_cita.formato, ''), nullif(c.programa_interes, ''), 'STRONG'));
  if v_prog not in ('STRONG','BURN','HEALTHY') then v_prog := 'STRONG'; end if;
  v_sx := case when v_p.sex::text in ('hombre','mujer') then v_p.sex::text end;
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
  select pr.programa::text programa, pr.nivel::text nivel, pr.sexo::text sexo, sp.objetivo zona, sp.nombre,
         exists (select 1 from sesiones_registro sr where sr.sesion_protocolo_id = sp.id and sr.socio_id = p_socio) entrenada
    into v_act
    from protocolos pr join sesiones_protocolo sp on sp.protocolo_id = pr.id
   where pr.socio_id = p_socio and pr.estado = 'demo' limit 1;
  return jsonb_build_object(
    'programa', v_prog, 'nivel', v_niv, 'sexo', v_sx, 'zona', v_zona,
    'fuentes', jsonb_build_object('objetivo', c.objetivo, 'experiencia', c.experiencia, 'dolor', c.dolor, 'preferencia', c.preferencia,
      'programa_interes', c.programa_interes, 'cita_formato', v_cita.formato, 'cita_inicio', v_cita.inicio),
    'activa', case when v_act.programa is null then null else to_jsonb(v_act) end);
end $f$;
revoke all on function public.koach_demo_sugerencia(uuid) from public, anon;
grant execute on function public.koach_demo_sugerencia(uuid) to authenticated;

-- Activa la demo elegida: clona la sesión a un protocolo personal, la asigna y la habilita hoy.
create or replace function public.koach_demo_activar(p_socio uuid, p_programa text, p_nivel text, p_sexo text, p_zona text)
returns jsonb language plpgsql security definer set search_path = public as $f$
declare
  v_p profiles; v_tpl record; v_pid uuid; v_sid uuid; v_bid uuid; v_asig uuid; b record;
  v_hoy date := (now() at time zone 'America/Santiago')::date;
  v_prev text := coalesce(current_setting('koach.sync', true),'');
begin
  if coalesce(public.koach_rol() in ('admin','coach','recepcion'), false) is not true then raise exception 'Sin permiso'; end if;
  p_programa := upper(p_programa); p_nivel := upper(p_nivel); p_sexo := lower(p_sexo); p_zona := upper(p_zona);
  if p_programa not in ('STRONG','BURN','HEALTHY') or p_nivel not in ('BASICO','INTERMEDIO','AVANZADO')
     or p_sexo not in ('hombre','mujer') or p_zona not in ('LOWER','UPPER','FULL') then
    raise exception 'DEMO: combinación inválida';
  end if;
  select * into v_p from profiles where id = p_socio;
  if not found then raise exception 'DEMO: perfil no encontrado'; end if;
  if v_p.estado <> 'clase_prueba' then raise exception 'DEMO: la demo es solo para personas en clase de prueba'; end if;
  if exists (select 1 from sesiones_registro sr join sesiones_protocolo sp on sp.id = sr.sesion_protocolo_id join protocolos pr on pr.id = sp.protocolo_id
             where pr.socio_id = p_socio and pr.estado = 'demo') then
    raise exception 'DEMO: ya empezó a entrenar su demo; no se puede cambiar';
  end if;
  select pr.id pid, sp.id sid, sp.nombre, sp.objetivo into v_tpl
    from protocolos pr join sesiones_protocolo sp on sp.protocolo_id = pr.id
   where pr.estado = 'demo' and pr.socio_id is null and pr.programa::text = p_programa and pr.nivel::text = p_nivel
     and pr.sexo::text = p_sexo and upper(sp.objetivo) = p_zona;
  if v_tpl.sid is null then raise exception 'DEMO: no existe la plantilla % · % · % · %', p_programa, p_nivel, p_sexo, p_zona; end if;

  perform public._koach_demo_cerrar(p_socio, true);
  if exists (select 1 from asignaciones where socio_id = p_socio and activo) then
    raise exception 'DEMO: la persona ya tiene un programa asignado';
  end if;

  perform set_config('koach.sync','1',true);
  insert into protocolos(programa, nivel, sexo, nombre, ciclo_semanas, socio_id, estado, variante, activo, fecha_inicio_ciclo)
    values (p_programa::programa_tipo, p_nivel::nivel_tipo, p_sexo::user_sex, 'DEMO ' || p_programa || ' · ' || replace(v_tpl.nombre,'DEMO ',''), 1, p_socio, 'demo', 1, true, v_hoy)
    returning id into v_pid;
  insert into sesiones_protocolo(protocolo_id, numero, nombre, objetivo, semana, publicado)
    values (v_pid, 1, v_tpl.nombre, v_tpl.objetivo, 1, true) returning id into v_sid;
  for b in select * from bloques where sesion_id = v_tpl.sid order by bloque loop
    insert into bloques(sesion_id, bloque, rol, sets, descanso_segundos, descanso_seg, etiqueta, timer)
      values (v_sid, b.bloque, b.rol, b.sets, b.descanso_segundos, b.descanso_seg, b.etiqueta, b.timer) returning id into v_bid;
    insert into bloque_ejercicios(bloque_id, ejercicio_id, orden, reps, reps_txt, duracion_seg, es_ancla, kg_objetivo, modo_registro, rir_objetivo)
      select v_bid, ejercicio_id, orden, reps, reps_txt, duracion_seg, false, kg_objetivo, modo_registro, rir_objetivo
        from bloque_ejercicios where bloque_id = b.id order by orden;
  end loop;
  perform set_config('koach.sync', v_prev, true);

  insert into asignaciones(socio_id, protocolo_id, coach_id, fecha_inicio, activo, semana_actual, ciclo_actual)
    values (p_socio, v_pid, auth.uid(), v_hoy, true, 1, 1) returning id into v_asig;
  update sesion_habilitada set estado = 'retirada' where socio_id = p_socio and estado = 'activa';
  insert into sesion_habilitada(socio_id, asignacion_id, sesion_protocolo_id, permite_hoy, fecha, estado, creado_por)
    values (p_socio, v_asig, v_sid, true, v_hoy, 'activa', auth.uid());

  if v_p.sex is null or v_p.sex::text <> p_sexo then update profiles set sex = p_sexo::user_sex where id = p_socio; end if;
  update agenda_citas set formato = p_programa
   where servicio = 'clase_prueba' and estado <> 'cancelada' and (socio_id = p_socio or telefono = v_p.telefono)
     and (inicio at time zone 'America/Santiago')::date = v_hoy;
  return jsonb_build_object('ok', true, 'protocolo_id', v_pid, 'sesion_id', v_sid, 'asignacion_id', v_asig, 'nombre', v_tpl.nombre);
end $f$;
revoke all on function public.koach_demo_activar(uuid, text, text, text, text) from public, anon;
grant execute on function public.koach_demo_activar(uuid, text, text, text, text) to authenticated;

-- Si compra (deja de ser clase de prueba), su demo se archiva y libera la asignación.
create or replace function public.koach_trg_demo_conversion()
returns trigger language plpgsql security definer set search_path = public as $f$
begin
  if old.estado = 'clase_prueba' and new.estado is distinct from 'clase_prueba' then
    perform public._koach_demo_cerrar(new.id, false);
  end if;
  return new;
end $f$;
drop trigger if exists trg_demo_conversion on public.profiles;
create trigger trg_demo_conversion after update of estado on public.profiles for each row execute function public.koach_trg_demo_conversion();
