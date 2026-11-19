-- 1% CLUB · funciones vigentes de marca y reacciones
create or replace function public.club_reaccionar(p_evento bigint, p_clave text) returns jsonb language plpgsql security definer set search_path=public as $$
declare yo uuid := auth.uid();
begin
  if yo is null then raise exception 'sin sesión'; end if;
  if not exists(select 1 from club_eventos where id=p_evento) then raise exception 'evento no encontrado'; end if;
  if not exists(select 1 from club_miembros where socio_id=yo) and not public._club_es_validador() then raise exception 'Únete al club para reaccionar'; end if;
  delete from club_reacciones where evento_id=p_evento and socio_id=yo and clave=p_clave;
  if not found then insert into club_reacciones(evento_id, socio_id, clave) values (p_evento, yo, p_clave); end if;
  return (select coalesce(jsonb_object_agg(clave,n),'{}'::jsonb) from (select clave,count(*) n from club_reacciones where evento_id=p_evento group by clave) q);
end $$;
revoke all on function public.club_reaccionar(bigint,text) from public, anon;
grant execute on function public.club_reaccionar(bigint,text) to authenticated;

create or replace function public._club_marca(p_ch uuid, p_socio uuid, p_score int, p_actor uuid, p_validada boolean) returns jsonb
language plpgsql security definer set search_path=public as $$
declare c club_challenges; lider uuid; prev int; rk jsonb; pos int;
begin
  select * into c from club_challenges where id=p_ch and activo;
  if c.id is null then raise exception 'challenge no encontrado'; end if;
  if not p_validada and now() not between c.inicio and c.fin then raise exception 'El challenge no está abierto'; end if;
  if p_score is null or p_score < 1 or p_score > 150 then raise exception 'Marca fuera de rango'; end if;
  select socio_id into lider from club_challenge_entradas where challenge_id=p_ch and estado<>'rechazado' order by score desc, updated_at asc limit 1;
  select score into prev from club_challenge_entradas where challenge_id=p_ch and socio_id=p_socio;
  insert into club_miembros(socio_id) values (p_socio) on conflict do nothing;
  insert into club_challenge_entradas(challenge_id, socio_id, score, estado, registrado_por, validado_por, validado_at)
    values (p_ch, p_socio, p_score, case when p_validada then 'validado' else 'pendiente' end, p_actor,
            case when p_validada then p_actor end, case when p_validada then now() end)
  on conflict (challenge_id, socio_id) do update set score=excluded.score, estado=excluded.estado, registrado_por=excluded.registrado_por,
    validado_por=excluded.validado_por, validado_at=excluded.validado_at, updated_at=now();
  rk := public._club_ranking(p_ch);
  select (x->>'pos')::int into pos from jsonb_array_elements(rk) x where (x->>'socio_id')::uuid=p_socio;
  if prev is distinct from p_score then
    insert into club_eventos(challenge_id, socio_id, tipo, payload) values (p_ch, p_socio, 'marca', jsonb_build_object('score',p_score,'pos',pos));
    if pos=1 and lider is not null and lider <> p_socio then
      insert into club_eventos(challenge_id, socio_id, tipo, payload) values (p_ch, p_socio, 'lider', jsonb_build_object('score',p_score));
    end if;
  end if;
  return jsonb_build_object('pos',pos,'total',jsonb_array_length(rk),'score',p_score);
end $$;
revoke all on function public._club_marca(uuid,uuid,int,uuid,boolean) from public, anon, authenticated;
