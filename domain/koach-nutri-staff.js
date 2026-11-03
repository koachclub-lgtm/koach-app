// KOACH · motor de trabajo de NUTRICIÓN para el equipo: evaluación ISAK (composición) y plan nutricional.
// Compartido por coach.html (ficha del socio → NUTRICIÓN) y nutricion.html (panel de la nutricionista).
// Script clásico: usa los globales de la página anfitriona — sb, F (socio abierto), C.asig, toast, kConfirm, adEsc, nomDe, kLd —
// y pinta en #fTabCmp. Motor de cálculo: domain/koach-composicion.js (KC); vista del socio: domain/koach-nutricion-vista.js (KN).
// ═══ c147 · COMPOSICIÓN CORPORAL · nutrición registra la evaluación ISAK en la ficha del socio ═══
// Motor: domain/koach-composicion.js (KC). Lectura: RPC koach_composicion (borradores solo para nutrición/admin).
// Escritura: tabla evaluaciones_nutricion (RLS: admin + nutricionista). El socio ve SOLO lo publicado, en AVANCES.
const CMP={ data:null, socio:null, edit:null, form:null }
const cmpNum=v=>{ if(v==null||v==='') return null; const n=parseFloat(String(v).replace(',','.')); return Number.isFinite(n)?n:null }
const cmpF1=v=>v==null?'—':(Math.round(+v*10)/10).toFixed(1).replace('.',',')
const cmpFecha=iso=>{ const M=['ENE','FEB','MAR','ABR','MAY','JUN','JUL','AGO','SEP','OCT','NOV','DIC']; const d=new Date(String(iso).slice(0,10)+'T12:00:00'); return d.getDate()+' '+M[d.getMonth()]+' '+String(d.getFullYear()).slice(2) }
function cmpEdad(nac, fecha){ if(!nac) return null; const a=new Date(nac+'T12:00:00'), b=new Date((fecha||new Date().toISOString().slice(0,10))+'T12:00:00')
  let e=b.getFullYear()-a.getFullYear(); if(b.getMonth()<a.getMonth()||(b.getMonth()===a.getMonth()&&b.getDate()<a.getDate())) e--; return e }
function cmpProg(){ const a=F&&C.asig&&C.asig[F.id]; return String((a&&a.protocolos&&a.protocolos.programa)||'').toUpperCase() }
async function fCmpCargar(){
  const box=document.getElementById('fTabCmp'); if(!box||!F) return
  CMP.socio=F.id; CMP.edit=null; box.innerHTML=kLd('Cargando composición')
  try{ const { data, error } = await sb.rpc('koach_composicion', { p_socio: F.id }); if(error) throw error
    if (CMP.socio!==F.id) return; CMP.data=data||{evaluaciones:[]}; fCmpPintar() }
  catch(e){ console.error('composicion', e)
    box.innerHTML='<div class="cmp"><div class="avErr"><b>NO PUDIMOS CARGAR LA COMPOSICIÓN</b><span>'+adEsc((e&&e.message)||'Revisa tu conexión.')+'</span><button type="button" onclick="fCmpCargar()">REINTENTAR</button></div></div>' }
}
function cmpDelta(c, lado){ if(!c) return ''
  const v= lado==='ini'? c.vsInicio : c.vsAnterior, t= lado==='ini'? c.tonoInicio : c.tonoAnterior, f= lado==='ini'? c.fechaInicio : c.fechaAnterior
  if (v==null) return ''
  return '<span class="cmp__d '+t+'">'+(v>0?'+':v<0?'−':'±')+cmpF1(Math.abs(v))+' VS '+(lado==='ini'?'INICIO':'ANTERIOR')+' · '+cmpFecha(f)+'</span>' }
function fCmpPintar(){
  const box=document.getElementById('fTabCmp'), d=CMP.data||{}, evs=d.evaluaciones||[], ed=!!d.puede_editar
  const pub=evs.filter(e=>e.estado==='publicada'), base= ed ? evs : pub
  const hd=nuSegHtml('cmp')+'<div class="cmp__hd"><div><span class="cmp__k">COMPOSICIÓN CORPORAL · ISAK</span><h2 class="cmp__t">'+(evs.length?evs.length+' evaluaci'+(evs.length===1?'ón':'ones'):'Sin evaluaciones')+'</h2></div>'+
    (ed?'<button type="button" class="cmp__b" onclick="fCmpNueva()">+ NUEVA EVALUACIÓN</button>':'')+'</div>'
  if (!evs.length){ box.innerHTML='<div class="cmp">'+hd+'<div class="cmp__vac">'+(ed?'Registra la primera evaluación ISAK. Cuando la publiques, el socio la verá en AVANCES → COMPOSICIÓN CORPORAL junto a su progreso de entrenamiento.':'Aún no hay evaluaciones publicadas por nutrición.')+'</div></div>'; return }
  const ks=[['PESO','peso_kg','kg',0],['% GRASA','porcentaje_grasa','%',-1],['MASA MUSCULAR','masa_muscular_kg','kg',1],['CINTURA','cintura_cm','cm',-1]]
  const tiles=ks.map(([l,k,u,m])=>{ const c=KC.cambio(base,k,m); return '<div class="cmp__tile"><span class="cmp__k">'+l+'</span><b>'+(c?cmpF1(c.actual)+'<i>'+u+'</i>':'—')+'</b>'+cmpDelta(c,'ant')+cmpDelta(c,'ini')+'</div>' }).join('')
  const filas=evs.slice().reverse().map(e=>'<div class="cmp__row"><div><small>FECHA</small>'+cmpFecha(e.fecha)+'</div>'+
    '<span class="cmp__pill'+(e.estado==='publicada'?' pub':'')+'">'+(e.estado==='publicada'?'PUBLICADA':'BORRADOR')+'</span>'+
    '<div><small>PESO</small>'+cmpF1(e.peso_kg)+' kg</div><div><small>% GRASA</small>'+(e.porcentaje_grasa!=null?cmpF1(e.porcentaje_grasa)+' %':'—')+'</div>'+
    '<div><small>MÚSCULO</small>'+(e.masa_muscular_kg!=null?cmpF1(e.masa_muscular_kg)+' kg':'—')+'</div>'+
    (ed?'<div class="cmp__acts"><button type="button" onclick="fCmpEditar(\''+e.id+'\')">EDITAR</button>'+
      '<button type="button" onclick="fCmpEstado(\''+e.id+'\',\''+(e.estado==='publicada'?'borrador':'publicada')+'\')">'+(e.estado==='publicada'?'RETIRAR':'PUBLICAR')+'</button></div>':'<div></div>')+'</div>').join('')
  box.innerHTML='<div class="cmp">'+hd+'<div class="cmp__kp">'+tiles+'</div>'+cmpChart(base)+
    '<span class="cmp__k" style="margin:16px 0 8px">HISTORIAL'+(ed?' · EL SOCIO VE SOLO LAS PUBLICADAS':'')+'</span>'+filas+'</div>'
}
// Tendencia: % grasa y masa muscular normalizados a su propio rango (líneas rectas, sin curvas)
function cmpChart(evs){
  const g=evs.filter(e=>e.porcentaje_grasa!=null), m=evs.filter(e=>e.masa_muscular_kg!=null)
  if (Math.max(g.length,m.length)<2) return ''
  const fechas=[...new Set(evs.map(e=>e.fecha))].sort(), W=640,H=170,L=12,R=12,T=18,B=40
  const X=f=>L+(fechas.length<2?0:fechas.indexOf(f)*(W-L-R)/(fechas.length-1))
  const anc=f=>{ const i=fechas.indexOf(f); return fechas.length>1&&i===0?'start':fechas.length>1&&i===fechas.length-1?'end':'middle' }
  const linea=(arr,k,col,abajo)=>{ if(arr.length<2) return ''; const vs=arr.map(e=>+e[k]), mn=Math.min(...vs), mx=Math.max(...vs), rg=Math.max(.5,mx-mn)
    const Y=v=>T+(H-T-B)*(1-(v-mn+rg*.15)/(rg*1.3))
    return '<polyline class="cmp__ln" stroke="'+col+'" points="'+arr.map(e=>X(e.fecha)+','+Y(+e[k])).join(' ')+'"/>'+
      arr.map(e=>'<rect x="'+(X(e.fecha)-3.5)+'" y="'+(Y(+e[k])-3.5)+'" width="7" height="7" fill="'+col+'"/><text class="cmp__tx" x="'+X(e.fecha)+'" y="'+(Y(+e[k])+(abajo?17:-8))+'" text-anchor="'+anc(e.fecha)+'">'+cmpF1(e[k])+'</text>').join('') }
  let ax=''; fechas.forEach(f=>{ ax+='<text class="cmp__tx" x="'+X(f)+'" y="'+(H-6)+'" text-anchor="'+anc(f)+'">'+cmpFecha(f)+'</text>' })
  return '<div class="cmp__ch"><div class="cmp__lg"><span style="color:#121212">% GRASA</span><span style="color:#2BB3C0">MASA MUSCULAR (KG)</span></div>'+
    '<svg viewBox="0 0 '+W+' '+H+'" role="img" aria-label="Tendencia de grasa y masa muscular entre evaluaciones"><line class="cmp__gl" x1="'+L+'" x2="'+(W-R)+'" y1="'+(H-B)+'" y2="'+(H-B)+'"/>'+ax+linea(g,'porcentaje_grasa','#121212')+linea(m,'masa_muscular_kg','#2BB3C0',true)+'</svg></div>'
}
const CMP_PL=[['triceps','TRÍCEPS',1],['biceps','BÍCEPS',1],['subescapular','SUBESCAPULAR',1],['crestaIliaca','CRESTA ILÍACA',1],['supraespinal','SUPRAESPINAL',0],['abdominal','ABDOMINAL',0],['muslo','MUSLO ANTERIOR',0],['pantorrilla','PANTORRILLA MEDIAL',0]]
const CMP_PE=[['brazo','BRAZO RELAJADO'],['muslo','MUSLO MEDIO'],['pantorrilla','PANTORRILLA MÁX.'],['cintura','CINTURA'],['cadera','CADERA']]
function fCmpNueva(){ CMP.edit={ id:null, estado:'borrador', inicio:null }; fCmpForm({}) }
function fCmpEditar(id){ const e=(CMP.data.evaluaciones||[]).find(x=>x.id===id); if(!e) return; CMP.edit={ id, estado:e.estado }; fCmpForm(e) }
function fCmpForm(e){
  const box=document.getElementById('fTabCmp'), inp=KC.deFila(e||{}), hoy=new Date().toISOString().slice(0,10)
  const fecha=(e&&e.fecha)||hoy, sexo=(e&&e.sexo_eval)||F.sex||'', edad=(e&&e.edad_eval)||cmpEdad(F.fecha_nacimiento, fecha)
  const ultima=(CMP.data.evaluaciones||[]).slice(-1)[0], talla=inp.talla||(ultima&&ultima.talla_cm)||''
  const v=x=>x==null?'':String(x).replace('.',',')
  const campo=(id,lab,val,cls)=>'<label class="'+(cls||'')+'">'+lab+'<input inputmode="decimal" id="'+id+'" value="'+adEsc(v(val))+'" oninput="fCmpCalc()"></label>'
  box.innerHTML='<div class="cmp"><div class="cmp__hd"><div><span class="cmp__k">'+(CMP.edit.id?'EDITAR EVALUACIÓN':'NUEVA EVALUACIÓN')+' · PERFIL RESTRINGIDO ISAK</span><h2 class="cmp__t">'+adEsc(nomDe(F.id))+'</h2></div>'+
    '<button type="button" class="cmp__b cmp__b--l" onclick="fCmpPintar()">← VOLVER</button></div>'+
    '<div class="cmpF"><div>'+
    '<div class="cmpF__g"><h4>DATOS BASE</h4><div class="cmpF__f"><label>FECHA<input type="date" id="cmFecha" value="'+fecha+'" onchange="fCmpCalc()"></label>'+
      campo('cmPeso','PESO (KG)',inp.peso,'dw')+campo('cmTalla','TALLA (CM)',talla,'dw')+campo('cmEdad','EDAD',edad,'dw')+
      '<label class="dw">SEXO<select id="cmSexo" onchange="fCmpCalc()"><option value="">—</option><option value="hombre"'+(sexo==='hombre'?' selected':'')+'>HOMBRE</option><option value="mujer"'+(sexo==='mujer'?' selected':'')+'>MUJER</option></select></label></div></div>'+
    '<div class="cmpF__g"><h4>PLIEGUES (MM) · <em>EN NEGRO: OBLIGATORIOS PARA % GRASA</em></h4><div class="cmpF__f">'+CMP_PL.map(([k,l,r])=>campo('cmPl_'+k,l,inp.pliegues[k],r?'dw':'')).join('')+'</div></div>'+
    '<div class="cmpF__g"><h4>PERÍMETROS (CM) · <em>BRAZO, MUSLO Y PANTORRILLA PARA MASA MUSCULAR</em></h4><div class="cmpF__f">'+CMP_PE.map(([k,l],i)=>campo('cmPe_'+k,l,inp.perimetros[k],i<3?'dw':'')).join('')+'</div></div>'+
    '<div class="cmpF__g"><h4>MENSAJES</h4><div class="cmpF__f" style="grid-template-columns:1fr">'+
      '<label>NOTA PARA EL SOCIO (LA VE EN SU APP)<textarea id="cmNotaS" maxlength="400">'+adEsc((e&&e.nota_socio)||'')+'</textarea></label>'+
      '<label>NOTAS INTERNAS (SOLO NUTRICIÓN Y ADMIN)<textarea id="cmNotas">'+adEsc((e&&e.notas)||'')+'</textarea></label></div></div>'+
    '<div class="cmpF__acts"><button type="button" class="cmp__b cmp__b--l" id="cmGuardar" onclick="fCmpGuardar(\'borrador\')">GUARDAR BORRADOR</button>'+
      '<button type="button" class="cmp__b" id="cmPublicar" onclick="fCmpGuardar(\'publicada\')">PUBLICAR AL SOCIO</button></div>'+
    '</div><aside class="cmpR" id="cmRes" aria-live="polite"></aside></div></div>'
  fCmpCalc()
}
function fCmpLeer(){ const g=id=>{ const el=document.getElementById(id); return el?el.value:'' }
  const pl={}, pe={}; CMP_PL.forEach(([k])=>pl[k]=g('cmPl_'+k)); CMP_PE.forEach(([k])=>pe[k]=g('cmPe_'+k))
  return { fecha:g('cmFecha'), peso:g('cmPeso'), talla:g('cmTalla'), edad:g('cmEdad'), sexo:g('cmSexo'), pliegues:pl, perimetros:pe } }
function fCmpCalc(){
  const el=document.getElementById('cmRes'); if(!el) return
  const inp=fCmpLeer(), r=KC.calcular(inp); CMP.form={ inp, r }
  const p=cmpNum(inp.peso)
  const bar = r.completo ? '<div class="cmpR__bar" role="img" aria-label="Fraccionamiento en cuatro componentes">'+
      [[r.grasa.kg,'#F4F3F0'],[r.muscular.kg,'#2BB3C0'],[r.osea.kg,'#8A8984'],[r.residual.kg,'#4A4945']].map(([k,c])=>'<i style="width:'+(k/p*100)+'%;background:'+c+'"></i>').join('')+'</div>' : ''
  const fila=(l,v)=>'<tr><td>'+l+'</td><td>'+v+'</td></tr>'
  el.innerHTML='<span class="cmp__k">RESULTADO · '+KC.VERSION.toUpperCase()+'</span>'+
    '<div class="cmpR__big"><div><b>'+(r.grasa.pct!=null?cmpF1(r.grasa.pct)+'<i>%</i>':'—')+'</b><small>GRASA'+(r.grasa.clase?' · '+r.grasa.clase:'')+'</small></div>'+
    '<div><b>'+(r.muscular.kg!=null?cmpF1(r.muscular.kg)+'<i>kg</i>':'—')+'</b><small>MASA MUSCULAR'+(r.muscular.pct!=null?' · '+cmpF1(r.muscular.pct)+'%':'')+'</small></div></div>'+bar+
    '<table class="cmpR__tb">'+fila('Masa grasa',r.grasa.kg!=null?cmpF1(r.grasa.kg)+' kg':'—')+fila('Masa ósea (referencial)',r.osea.kg!=null?cmpF1(r.osea.kg)+' kg':'—')+
      fila('Masa residual',r.residual.kg!=null?cmpF1(r.residual.kg)+' kg':'—')+fila('Σ4 D&W · Σ6 · Σ8',[r.grasa.sum4,r.suma6,r.suma8].map(cmpF1).join(' · ')+' mm')+
      fila('FFMI (norm. 1,80 m)',r.ffmiNorm!=null?cmpF1(r.ffmiNorm)+(r.ffmiClase?' · '+r.ffmiClase:''):'—')+
      fila('Índice cintura/talla',r.ict!=null?String(r.ict).replace('.',','):'—')+fila('Índice cintura/cadera',r.icc!=null?String(r.icc).replace('.',','):'—')+
      fila('Edad biológica',r.edadBiologica!=null?r.edadBiologica+' años':'—')+'</table>'+
    (r.avisos.length||r.calidad?'<div class="cmpR__av">'+r.avisos.concat(r.calidad?[r.calidad]:[]).map(adEsc).join('<br>')+'</div>':'')
  const pubOk = p && cmpNum(inp.talla) && (r.grasa.medida || r.muscular.medida)
  const b=document.getElementById('cmPublicar'); if(b) b.disabled=!pubOk
  const g=document.getElementById('cmGuardar'); if(g) g.disabled=!p
}
async function fCmpGuardar(estado){
  if(!CMP.form) fCmpCalc(); const { inp, r } = CMP.form
  if(!cmpNum(inp.peso)){ toast('Falta el peso'); return }
  if(estado==='publicada' && !(await kConfirm('¿Publicar esta evaluación? '+nomDe(F.id).split(' ')[0]+' la verá en su app, en AVANCES → COMPOSICIÓN CORPORAL.'))) return
  const g=id=>document.getElementById(id).value.trim()
  const fila=Object.assign(KC.aFila(inp, r), { socio_id:F.id, fecha:inp.fecha||new Date().toISOString().slice(0,10), estado,
    nota_socio: g('cmNotaS')||null, notas: g('cmNotas')||null })
  ;['cmGuardar','cmPublicar'].forEach(id=>{ const b=document.getElementById(id); if(b) b.disabled=true })
  const q = CMP.edit&&CMP.edit.id ? sb.from('evaluaciones_nutricion').update(fila).eq('id',CMP.edit.id) : sb.from('evaluaciones_nutricion').insert(fila)
  const { error } = await q
  if(error){ console.error('cmp guardar', error); toast('No se pudo guardar: '+(error.message||'error')); fCmpCalc(); return }
  toast(estado==='publicada'?'Evaluación publicada al socio':'Borrador guardado'); fCmpCargar()
}
async function fCmpEstado(id, estado){
  if(estado==='borrador' && !(await kConfirm('¿Retirar esta evaluación? El socio dejará de verla en su app.'))) return
  if(estado==='publicada' && !(await kConfirm('¿Publicar esta evaluación al socio?'))) return
  const { error } = await sb.from('evaluaciones_nutricion').update({ estado }).eq('id', id)
  if(error){ toast('No se pudo actualizar: '+(error.message||'error')); return }
  toast(estado==='publicada'?'Publicada':'Retirada del socio'); fCmpCargar()
}
// ═══ c148 · PLAN NUTRICIONAL · nutrición arma el plan (con o sin IA) y lo publica a la app del socio. Reemplaza el PDF.
// Vista previa = KN.plan (el mismo renderizador de la app del socio). Números: motor/nutrición. IA: solo redacción (/api/pauta-ia).
const NPL={ data:null, edit:null, cont:null, gen:false }
function nuSegHtml(on){ return '<div class="nuSegC" role="group" aria-label="Nutrición del socio"><button type="button" aria-pressed="'+(on==='cmp')+'" onclick="fCmpPintar()">COMPOSICIÓN</button><button type="button" aria-pressed="'+(on==='plan')+'" onclick="fPlanCargar()">PLAN NUTRICIONAL</button></div>' }
function plUltEval(){ const e=(CMP.data&&CMP.data.evaluaciones)||[]; return e.filter(x=>x.estado==='publicada').slice(-1)[0] || e.slice(-1)[0] || null }
async function fPlanCargar(){
  const box=document.getElementById('fTabCmp'); if(!box||!F) return
  if (typeof KN!=='undefined') KN.ensureCss()
  box.innerHTML='<div class="cmp">'+nuSegHtml('plan')+kLd('Cargando plan')+'</div>'
  try{ const { data, error } = await sb.rpc('koach_pauta', { p_socio:F.id }); if(error) throw error; NPL.data=data||{}; fPlanPintar() }
  catch(e){ console.error('pauta', e); box.innerHTML='<div class="cmp">'+nuSegHtml('plan')+'<div class="avErr"><b>NO PUDIMOS CARGAR EL PLAN</b><span>'+adEsc((e&&e.message)||'Revisa tu conexión.')+'</span><button type="button" onclick="fPlanCargar()">REINTENTAR</button></div></div>' }
}
function fPlanPintar(){
  const box=document.getElementById('fTabCmp'), d=NPL.data||{}, ed=!!d.puede_editar, vig=d.vigente, todas=d.todas||(vig?[vig]:[])
  const ev=plUltEval()
  const hd='<div class="cmp__hd"><div><span class="cmp__k">PLAN NUTRICIONAL · LO QUE EL SOCIO VE EN SU APP</span><h2 class="cmp__t">'+(vig?(()=>{ const pe=KN.periodo(vig); return !pe?'Vigente desde '+cmpFecha(vig.publicada_at||vig.fecha):pe.terminado?'Período cumplido · reevaluar':'Semana '+pe.semana+' de '+pe.semanas+' · reevaluación '+pe.finTxt })():'Sin plan publicado')+'</h2></div>'+
    (ed?'<button type="button" class="cmp__b" onclick="fPlanNuevo()">+ NUEVO PLAN</button>':'')+'</div>'
  const filas=todas.map(p=>'<div class="cmp__row"><div><small>FECHA</small>'+cmpFecha(p.fecha)+'</div><span class="cmp__pill'+(p.estado==='publicada'?' pub':'')+'">'+String(p.estado).toUpperCase()+'</span>'+
    '<div><small>KCAL</small>'+(p.kcal||'—')+'</div><div><small>PROTEÍNA</small>'+(p.proteina_g!=null?Math.round(p.proteina_g)+' g':'—')+'</div><div><small>ORIGEN</small>'+(p.generado_ia?'IA + NUTRICIÓN':'NUTRICIÓN')+'</div>'+
    (ed?'<div class="cmp__acts"><button type="button" onclick="fPlanEditar(\''+p.id+'\')">'+(p.estado==='borrador'?'EDITAR':'NUEVA VERSIÓN')+'</button>'+(p.estado==='borrador'?'<button type="button" onclick="fPlanPublicar(\''+p.id+'\')">PUBLICAR</button>':'')+'</div>':'<div></div>')+'</div>').join('')
  box.innerHTML='<div class="cmp">'+nuSegHtml('plan')+hd+
    (vig?'<div class="plPrevWrap"><div class="plPhone">'+KN.plan(vig,{ peso: ev&&ev.peso_kg })+'</div></div>':'<div class="cmp__vac">'+(ed?'Arma el primer plan: fija los números (o usa los sugeridos por el motor), completa preferencias y redáctalo con IA o a mano. El socio lo verá en NUTRICIÓN → MI PLAN apenas lo publiques.':'Nutrición aún no publica un plan para este socio.')+'</div>')+
    (filas?'<span class="cmp__k" style="margin:18px 0 8px">VERSIONES · NADA SE BORRA</span>'+filas:'')+'</div>'
}
function fPlanNuevo(){ const vig=NPL.data&&NPL.data.vigente; NPL.edit={ id:null }; fPlanForm(vig?Object.assign({},vig,{ id:null, estado:'borrador', inicio:null }):null) }
function fPlanEditar(id){ const p=((NPL.data&&NPL.data.todas)||[]).find(x=>x.id===id); if(!p) return
  NPL.edit={ id: p.estado==='borrador'?p.id:null }; fPlanForm(p.estado==='borrador'?p:Object.assign({},p,{ id:null, estado:'borrador', inicio:null })) }
const PL_ACT=[['ligero','LIGERA'],['moderado','MODERADA'],['activo','ALTA'],['muyActivo','MUY ALTA']]
function fPlanForm(p){
  const box=document.getElementById('fTabCmp'), ev=plUltEval(), ix=(p&&p.intake)||{}, c=KC.normPlan(p&&p.contenido)
  NPL.cont=c
  const v=x=>x==null?'':adEsc(String(x))
  const inp=(id,l,val,ext)=>'<label>'+l+'<input id="'+id+'" value="'+v(val)+'" '+(ext||'inputmode="decimal"')+' oninput="fPlanSync()"></label>'
  const ta=(id,l,val,rows)=>'<label>'+l+'<textarea id="'+id+'" rows="'+(rows||2)+'" oninput="fPlanSync()">'+v(val)+'</textarea></label>'
  const metas=['30 DÍAS','60 DÍAS','90 DÍAS'].map((pl,i)=>{ const m=c.metas.find(x=>x.plazo===pl); return ta('plMeta'+i,'META '+pl,m&&m.meta,2) }).join('')
  box.innerHTML='<div class="cmp">'+nuSegHtml('plan')+'<div class="cmp__hd"><div><span class="cmp__k">'+(NPL.edit.id?'EDITAR BORRADOR':'NUEVO PLAN')+' · '+adEsc(nomDe(F.id))+'</span><h2 class="cmp__t">Plan nutricional</h2></div>'+
    '<button type="button" class="cmp__b cmp__b--l" onclick="fPlanPintar()">← VOLVER</button></div>'+
    '<div class="plF"><div class="cmpF">'+
    '<div class="cmpF__g"><h4>NÚMEROS DEL DÍA · <em>LOS FIJA NUTRICIÓN, LA IA NO LOS CAMBIA</em></h4><div class="cmpF__f">'+
      '<label>ACTIVIDAD<select id="plAct" onchange="fPlanSync()">'+PL_ACT.map(([k,l])=>'<option value="'+k+'"'+(((p&&p.actividad)||'moderado')===k?' selected':'')+'>'+l+'</option>').join('')+'</select></label>'+
      inp('plKcal','KCAL / DÍA',p&&p.kcal)+inp('plP','PROTEÍNA (G)',p&&p.proteina_g)+inp('plC','CARBOHIDRATOS (G)',p&&p.carbohidrato_g)+inp('plG','GRASAS (G)',p&&p.grasa_g)+
      '<label>&nbsp;<button type="button" class="cmp__b cmp__b--l" onclick="fPlanSugerir()">SUGERIR DEL MOTOR</button></label></div><div class="plRep" id="plRep"></div></div>'+
    '<div class="cmpF__g"><h4>PERÍODO DEL PLAN · <em>AL TERMINAR TOCA REEVALUAR</em></h4><div class="cmpF__f">'+
      '<label>DURACIÓN<select id="plSem" onchange="fPlanSync()">'+[4,5,6,8,10,12].map(n=>'<option value="'+n+'"'+((+((p&&p.semanas)||6))===n?' selected':'')+'>'+n+' SEMANAS</option>').join('')+'</select></label>'+
      '<label>INICIO<input type="date" id="plIni" value="'+v((p&&p.estado==='borrador'&&p.inicio)||new Date().toISOString().slice(0,10))+'" onchange="fPlanSync()"></label>'+
      '<label>REEVALUACIÓN<input id="plFin" disabled></label></div><p class="cmp__k" style="margin-top:6px">Ventana habitual de reevaluación ISAK: 4 a 8 semanas.</p></div>'+
    '<div class="cmpF__g"><h4>PREFERENCIAS E INTAKE</h4><div class="cmpF__f">'+
      '<label>COMIDAS AL DÍA<select id="plComD" onchange="fPlanSync()">'+['3','4','5','6'].map(n=>'<option'+((ix.comidas_dia||'4')===n?' selected':'')+'>'+n+'</option>').join('')+'</select></label>'+
      inp('plHor','HORARIO ENTRENO',ix.horario_entreno,'placeholder="ej. 19:00"')+'</div><div class="cmpF__f" style="grid-template-columns:1fr 1fr;margin-top:8px">'+
      ta('plRes','RESTRICCIONES / ALERGIAS',ix.restricciones)+ta('plNoC','NO CONSUME',ix.no_consume)+ta('plPref','PREFERENCIAS',ix.preferencias)+ta('plSupA','SUPLEMENTOS ACTUALES',ix.suplementos)+'</div>'+
      '<div class="cmpF__f" style="grid-template-columns:1fr;margin-top:8px">'+ta('plCtx','CONTEXTO (TRABAJO, HORARIOS, COCINA)',ix.contexto)+'</div>'+
      '<div class="cmpF__acts" style="justify-content:flex-start"><button type="button" class="cmp__b" id="plIA" onclick="fPlanIA()">REDACTAR CON IA →</button><span class="cmp__k" id="plIAst" style="align-self:center"></span></div></div>'+
    '<div class="cmpF__g"><h4>CONTENIDO DEL PLAN · <em>UNA LÍNEA POR ALIMENTO: ALIMENTO | CANTIDAD</em></h4>'+
      '<div class="cmpF__f" style="grid-template-columns:1fr">'+ta('plRes2','RESUMEN PARA EL SOCIO',c.resumen,3)+'</div><div id="plComidas"></div>'+
      '<button type="button" class="cmp__b cmp__b--l" style="margin-top:8px" onclick="fPlanComida()">+ COMIDA</button></div>'+
    '<div class="cmpF__g"><h4>INDICACIONES</h4><div class="cmpF__f" style="grid-template-columns:1fr 1fr">'+
      ta('plSup','SUPLEMENTACIÓN · PRODUCTO | DOSIS | HORARIO',c.suplementos.map(x=>[x.producto,x.dosis,x.horario].join(' | ')).join('\n'),4)+ta('plHid','HIDRATACIÓN',c.hidratacion,4)+
      ta('plInd','INDICACIONES · UNA POR LÍNEA',c.indicaciones.join('\n'),4)+ta('plEv','EVITAR · UNO POR LÍNEA',c.evitar.join('\n'),4)+'</div>'+
      '<div class="cmpF__f" style="grid-template-columns:repeat(3,1fr);margin-top:8px">'+metas+'</div></div>'+
    '<div class="cmpF__acts"><button type="button" class="cmp__b cmp__b--l" id="plGuardar" onclick="fPlanGuardar(\'borrador\')">GUARDAR BORRADOR</button><button type="button" class="cmp__b" id="plPublicar" onclick="fPlanGuardar(\'publicada\')">PUBLICAR AL SOCIO</button></div>'+
    '</div><aside class="plPrevWrap plPrevWrap--st"><span class="cmp__k" style="margin-bottom:8px">VISTA DEL SOCIO · EN VIVO</span><div class="plPhone" id="plPrev"></div></aside></div></div>'
  NPL.ia = !!(p&&p.generado_ia); NPL.modelo=(p&&p.modelo)||null
  fPlanComidasPintar(); fPlanSync()
}
function fPlanComidasPintar(){
  const el=document.getElementById('plComidas'); if(!el) return
  const lin=o=>o?o.alimentos.map(a=>a.alimento+(a.cantidad?' | '+a.cantidad:'')).join('\n'):''
  el.innerHTML=NPL.cont.comidas.map((m,i)=>'<div class="plCom"><div class="cmpF__f" style="grid-template-columns:2fr 1fr 3fr auto">'+
    '<label>COMIDA<input id="plcN'+i+'" value="'+adEsc(m.nombre)+'" oninput="fPlanSync()"></label><label>HORA<input id="plcH'+i+'" value="'+adEsc(m.hora)+'" placeholder="08:00" oninput="fPlanSync()"></label>'+
    '<label>QUÉ APORTA<input id="plcA'+i+'" value="'+adEsc(m.aporte)+'" oninput="fPlanSync()"></label><label>&nbsp;<button type="button" class="cmp__b cmp__b--l" onclick="fPlanQuitar('+i+')" aria-label="Quitar comida">✕</button></label></div>'+
    '<div class="cmpF__f" style="grid-template-columns:1fr 1fr;margin-top:6px"><label>OPCIÓN A<textarea id="plcOA'+i+'" rows="4" oninput="fPlanSync()">'+adEsc(lin(m.opciones[0]))+'</textarea></label>'+
    '<label>OPCIÓN B (OPCIONAL)<textarea id="plcOB'+i+'" rows="4" oninput="fPlanSync()">'+adEsc(lin(m.opciones[1]))+'</textarea></label></div></div>').join('')||'<div class="cmp__vac" style="padding:14px">Sin comidas todavía: redáctalas con IA o agrégalas a mano.</div>'
}
function fPlanLeer(){
  const g=id=>{ const e=document.getElementById(id); return e?e.value.trim():'' }, lines=t=>t.split('\n').map(x=>x.trim()).filter(Boolean)
  const ali=t=>lines(t).map(l=>{ const [a,...r]=l.split('|'); return { alimento:a.trim(), cantidad:r.join('|').trim() } })
  const comidas=NPL.cont.comidas.map((_,i)=>({ nombre:g('plcN'+i), hora:g('plcH'+i), aporte:g('plcA'+i),
    opciones:[{ etiqueta:'A', alimentos:ali(g('plcOA'+i)) },{ etiqueta:'B', alimentos:ali(g('plcOB'+i)) }] }))
  const cont=KC.normPlan({ resumen:g('plRes2'), comidas, hidratacion:g('plHid'), indicaciones:lines(g('plInd')), evitar:lines(g('plEv')),
    suplementos:lines(g('plSup')).map(l=>{ const [a,b,c]=l.split('|'); return { producto:(a||'').trim(), dosis:(b||'').trim(), horario:(c||'').trim() } }),
    metas:['30 DÍAS','60 DÍAS','90 DÍAS'].map((pl,i)=>({ plazo:pl, meta:g('plMeta'+i) })) })
  return { semanas:+(g('plSem')||6), inicio:g('plIni')||null, actividad:g('plAct'), kcal:cmpNum(g('plKcal')), proteina_g:cmpNum(g('plP')), carbohidrato_g:cmpNum(g('plC')), grasa_g:cmpNum(g('plG')),
    intake:{ comidas_dia:g('plComD'), horario_entreno:g('plHor'), restricciones:g('plRes'), no_consume:g('plNoC'), preferencias:g('plPref'), suplementos:g('plSupA'), contexto:g('plCtx') }, contenido:cont }
}
function fPlanSync(){
  const f=fPlanLeer(), ev=plUltEval(), r=KC.reparto(f.kcal,f.proteina_g,f.carbohidrato_g,f.grasa_g,ev&&ev.peso_kg)
  const rep=document.getElementById('plRep')
  if(rep) rep.innerHTML = r ? 'MACROS SUMAN '+r.kcalMacros.toLocaleString('es-CL')+' KCAL'+(f.kcal?' · '+(Math.abs(r.kcalMacros-f.kcal)<=f.kcal*.05?'✓ CUADRA CON LA META':'⚠ NO CUADRA CON '+Math.round(f.kcal)+' KCAL'):'')+' · P '+r.proteina.pct+'% · C '+r.carbohidrato.pct+'% · G '+r.grasa.pct+'%'+(r.proteina.gkg!=null?' · '+String(r.proteina.gkg).replace('.',',')+' G/KG PROTEÍNA':'') : ''
  const fin=document.getElementById('plFin'); if(fin){ const pe=KN.periodo(f); fin.value=pe?pe.finTxt:'' }
  const pv=document.getElementById('plPrev'); if(pv) pv.innerHTML=KN.plan(Object.assign({ programa:cmpProg(), estado:'borrador', fecha:new Date().toISOString().slice(0,10) }, f), { peso: ev&&ev.peso_kg })
  const pub=document.getElementById('plPublicar'); if(pub) pub.disabled=!(f.kcal && f.proteina_g && f.contenido.comidas.length)
}
function fPlanComida(){ fPlanCapturar(); NPL.cont.comidas.push({ nombre:'', hora:'', aporte:'', opciones:[{ etiqueta:'A', alimentos:[] }] }); fPlanComidasPintar(); fPlanSync() }
function fPlanQuitar(i){ fPlanCapturar(); NPL.cont.comidas.splice(i,1); fPlanComidasPintar(); fPlanSync() }
// guarda lo escrito antes de re-pintar la lista de comidas (incluye comidas aún vacías)
function fPlanCapturar(){ const g=id=>{ const e=document.getElementById(id); return e?e.value:'' }
  NPL.cont.comidas=NPL.cont.comidas.map((m,i)=>{ const al=t=>t.split('\n').filter(x=>x.trim()).map(l=>{ const [a,...r]=l.split('|'); return { alimento:a.trim(), cantidad:r.join('|').trim() } })
    const ops=[{ etiqueta:'A', alimentos:al(g('plcOA'+i)) }]; const b=al(g('plcOB'+i)); if(b.length) ops.push({ etiqueta:'B', alimentos:b })
    return { nombre:g('plcN'+i), hora:g('plcH'+i), aporte:g('plcA'+i), opciones:ops } }) }
function fPlanSugerir(){
  const ev=plUltEval(); if(!ev){ toast('Registra primero una evaluación con peso y talla'); return }
  const s=KC.sugerirPauta({ peso:ev.peso_kg, talla:ev.talla_cm, edad:ev.edad_eval||cmpEdad(F.fecha_nacimiento), sexo:ev.sexo_eval||F.sex, actividad:document.getElementById('plAct').value, programa:cmpProg() })
  if(!s){ toast('Faltan peso, talla o edad para sugerir'); return }
  NPL.tdee=s.tdee; NPL.tmb=s.tmb
  ;[['plKcal',s.kcal],['plP',s.proteina_g],['plC',s.carbohidrato_g],['plG',s.grasa_g]].forEach(([id,v])=>document.getElementById(id).value=v)
  fPlanSync(); toast('Sugerido por el motor · gasto estimado '+s.tdee.toLocaleString('es-CL')+' kcal. Ajusta si corresponde.')
}
async function fPlanIA(){
  if (NPL.gen) return
  const f=fPlanLeer(); if(!f.kcal||!f.proteina_g){ toast('Fija primero kcal y proteína (o usa SUGERIR DEL MOTOR)'); return }
  const ev=plUltEval(), a=C.asig&&C.asig[F.id], meta=ev?KC.metaSeisMeses(ev.peso_kg, cmpProg(), a&&a.protocolos&&a.protocolos.nivel, { pctGrasa:ev.porcentaje_grasa, sexo:ev.sexo_eval||F.sex }):null
  const b=document.getElementById('plIA'), st=document.getElementById('plIAst'); NPL.gen=true; b.disabled=true; st.textContent='REDACTANDO… 20–40 S'
  try{
    const { data:{ session } } = await sb.auth.getSession()
    const r=await fetch('/api/pauta-ia', { method:'POST', headers:{ 'content-type':'application/json', authorization:'Bearer '+(session&&session.access_token) },
      body:JSON.stringify({ metas_numericas:{ kcal:f.kcal, proteina_g:f.proteina_g, carbohidrato_g:f.carbohidrato_g, grasa_g:f.grasa_g }, programa:cmpProg(), intake:f.intake, meta:meta&&meta.texto,
        composicion: ev?{ sexo:ev.sexo_eval||F.sex, edad:ev.edad_eval, peso:ev.peso_kg, talla:ev.talla_cm, pct_grasa:ev.porcentaje_grasa, masa_muscular:ev.masa_muscular_kg }:{} }) })
    const j=await r.json().catch(()=>({}))
    if(!r.ok) throw new Error(j.error||('Error '+r.status))
    const actual=fPlanLeer().contenido
    if ((actual.comidas.length||actual.resumen) && !(await kConfirm('La IA reemplazará el contenido actual del plan (los números no cambian). ¿Continuar?'))) { st.textContent=''; return }
    NPL.cont=KC.normPlan(j.plan); NPL.ia=true; NPL.modelo=j.modelo
    document.getElementById('plRes2').value=NPL.cont.resumen; document.getElementById('plHid').value=NPL.cont.hidratacion
    document.getElementById('plInd').value=NPL.cont.indicaciones.join('\n'); document.getElementById('plEv').value=NPL.cont.evitar.join('\n')
    document.getElementById('plSup').value=NPL.cont.suplementos.map(x=>[x.producto,x.dosis,x.horario].join(' | ')).join('\n')
    ;['30 DÍAS','60 DÍAS','90 DÍAS'].forEach((pl,i)=>{ const m=NPL.cont.metas.find(x=>x.plazo===pl); document.getElementById('plMeta'+i).value=m?m.meta:'' })
    fPlanComidasPintar(); fPlanSync(); st.textContent='LISTO · REVISA Y AJUSTA ANTES DE PUBLICAR'
  }catch(e){ console.error('pauta ia', e); st.textContent=''; toast('No se pudo redactar: '+((e&&e.message)||'error')) }
  finally{ NPL.gen=false; b.disabled=false }
}
async function fPlanGuardar(estado){
  fPlanCapturar(); const f=fPlanLeer()
  if (estado==='publicada' && !(await kConfirm('¿Publicar este plan? Reemplaza al vigente y '+nomDe(F.id).split(' ')[0]+' lo verá en NUTRICIÓN → MI PLAN.'))) return
  const ev=plUltEval()
  const fila={ socio_id:F.id, estado, semanas:f.semanas, inicio:f.inicio, programa:cmpProg()||null, actividad:f.actividad, kcal:f.kcal!=null?Math.round(f.kcal):null, proteina_g:f.proteina_g, carbohidrato_g:f.carbohidrato_g, grasa_g:f.grasa_g,
    tdee:NPL.tdee||null, tmb:NPL.tmb||null, intake:f.intake, contenido:f.contenido, generado_ia:!!NPL.ia, modelo:NPL.modelo, evaluacion_id:(ev&&ev.id)||null }
  if (!fila.tdee && ev){ const s=KC.sugerirPauta({ peso:ev.peso_kg, talla:ev.talla_cm, edad:ev.edad_eval, sexo:ev.sexo_eval||F.sex, actividad:f.actividad, programa:cmpProg() }); if(s){ fila.tdee=s.tdee; fila.tmb=s.tmb } }
  ;['plGuardar','plPublicar'].forEach(id=>{ const b=document.getElementById(id); if(b) b.disabled=true })
  const q = NPL.edit&&NPL.edit.id ? sb.from('pautas_nutricion').update(fila).eq('id',NPL.edit.id) : sb.from('pautas_nutricion').insert(fila)
  const { error } = await q
  if (error){ console.error('pauta guardar', error); toast('No se pudo guardar: '+(error.message||'error')); fPlanSync(); const g=document.getElementById('plGuardar'); if(g) g.disabled=false; return }
  toast(estado==='publicada'?'Plan publicado al socio':'Borrador guardado'); fPlanCargar()
}
async function fPlanPublicar(id){
  if (!(await kConfirm('¿Publicar este borrador? Reemplaza al plan vigente del socio.'))) return
  const { error } = await sb.from('pautas_nutricion').update({ estado:'publicada' }).eq('id', id)
  if (error){ toast('No se pudo publicar: '+(error.message||'error')); return }
  toast('Plan publicado al socio'); fPlanCargar()
}
