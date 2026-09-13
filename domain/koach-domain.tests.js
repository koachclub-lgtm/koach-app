/* PROPERTY TESTS · DOC3 §17 · ejecutar: node koach-domain.tests.js */
const KD = require('./koach-domain.js')
let n=0, fail=0
const ok = (nombre, cond) => { n++; if(!cond){fail++; console.log('✗', nombre)} else console.log('✓', nombre) }
const S = (o={}) => Object.assign({exercise_id:'e1', completado:true, status:'COMPLETED', role:'WORK'}, o)
const P1 = {'GLÚTEOS':1.0}, Pmix = {'GLÚTEOS':1.0,'ISQUIOS':0.5}

/* 1 · Monotonicidad: A sube (target/version constantes) → completion no baja */
ok('monotonicidad', KD.muscleCompletion(8,12).completion <= KD.muscleCompletion(9,12).completion)
/* 2 · A>=T → completion=1 */
ok('A>=T ⇒ 1', KD.muscleCompletion(15,12).completion===1)
/* 3 · T=0 → N/A */
ok('T=0 ⇒ N/A', KD.muscleCompletion(5,0).completion===KD.NA)
ok('T=null ⇒ N/A', KD.muscleCompletion(5,null).completion===KD.NA)
/* 4 · Exceso de m no cambia otro músculo (independencia por construcción) */
{ const a=KD.strengthVolumeCompletion([{muscle:'G',aligned:120,target:10},{muscle:'Q',aligned:5,target:10}])
  const b=KD.strengthVolumeCompletion([{muscle:'G',aligned:10,target:10},{muscle:'Q',aligned:5,target:10}])
  ok('exceso no compensa', Math.abs(a.value-b.value)<1e-12 && a.value===0.75) }
/* 5 · SVC=1 ⇔ todos completos */
{ const t=KD.strengthVolumeCompletion([{aligned:12,target:12},{aligned:9,target:8}])
  ok('SVC=1 ⇔ todos', t.value===1 && t.completedGoals===2) }
{ const t=KD.strengthVolumeCompletion([{aligned:12,target:12},{aligned:7,target:8}])
  ok('uno incompleto ⇒ SVC<1', t.value<1) }
/* 6 · Sin músculos activos → N/A */
ok('sin activos ⇒ N/A', KD.strengthVolumeCompletion([{aligned:5,target:0},{aligned:3,target:null}]).value===KD.NA)
/* 7 · OPTIONAL no modifica W */
{ const base=[{role:'REQUIRED',completion:0.5,weight:1}]
  const conOpt=[...base,{role:'OPTIONAL',completion:1,weight:1}]
  ok('OPTIONAL no cambia W', KD.weeklyCompletion(base).value===KD.weeklyCompletion(conOpt).value) }
/* 8-10 · WeekComplete ⇔ W=1 ⇔ todos REQUIRED completos */
{ const w=KD.weeklyCompletion([{role:'REQUIRED',completion:1,weight:2},{role:'REQUIRED',completion:1,weight:1}])
  ok('todos REQUIRED=1 ⇒ W=1 & complete', w.value===1 && w.weekComplete===true) }
{ const w=KD.weeklyCompletion([{role:'REQUIRED',completion:1,weight:2},{role:'REQUIRED',completion:0.99,weight:1}])
  ok('uno<1 ⇒ no complete', w.weekComplete===false && w.value<1) }
/* 11 · Sin REQUIRED evaluables → N/A */
ok('sin REQUIRED ⇒ N/A', KD.weeklyCompletion([]).value===KD.NA)
ok('REQUIRED con C=N/A ⇒ W=N/A', KD.weeklyCompletion([{role:'REQUIRED',completion:KD.NA,weight:1}]).value===KD.NA)
/* 12 · Exceso capado no eleva W>1 */
{ const w=KD.weeklyCompletion([{role:'REQUIRED',completion:1.8,weight:1}])
  ok('cap ⇒ W<=1', w.value===1) }
/* 13 · Idempotencia por client_event_id (dedupe antes de acumular) */
{ const sets=[S({client_event_id:'a'}),S({client_event_id:'a'})]
  const dedup = sets.filter((s,i)=>sets.findIndex(x=>x.client_event_id===s.client_event_id)===i)
  const r1=KD.accumulate(dedup,{e1:P1}), r2=KD.accumulate([S({client_event_id:'a'})],{e1:P1})
  ok('idempotencia', r1.aligned['GLÚTEOS']===r2.aligned['GLÚTEOS']) }
/* 14 · WARMUP nunca contribuye */
{ const r=KD.accumulate([S({role:'WARMUP'})],{e1:P1})
  ok('WARMUP=0', !r.aligned['GLÚTEOS'] && !r.total['GLÚTEOS']) }
/* 15 · PARTIAL no contribuye en v1 */
{ const r=KD.accumulate([S({status:'PARTIAL'})],{e1:P1})
  ok('PARTIAL=0', !r.aligned['GLÚTEOS']) }
/* 16 · Legacy sin role → elegible (LEGACY_V0, resolución B3) */
{ const r=KD.accumulate([{exercise_id:'e1', legacy:true, completado:true}],{e1:P1})
  ok('legacy contribuye', r.aligned['GLÚTEOS']===1) }
/* 17 · EXTRA_UNPLANNED: total sí, aligned no */
{ const r=KD.accumulate([S({prescription_relation:'EXTRA_UNPLANNED'})],{e1:P1})
  ok('extra no fabrica cumplimiento', r.total['GLÚTEOS']===1 && !r.aligned['GLÚTEOS']) }
/* 18 · NO_EVALUABLE ≠ 0 fisiológico (GLOBAL perfil vacío) */
{ const r=KD.accumulate([S({exercise_id:'g1'})],{g1:{}})
  ok('NO_EVALUABLE trazado', r.noEvaluable.length===1 && Object.keys(r.total).length===0) }
/* 19 · CARDIO/MOB/GLOBAL no alimentan motor muscular */
{ const r=KD.mvc(S(),{'CARDIO':1.0,'GLOBAL':1.0,'GLÚTEOS':0.5})
  ok('no-músculos filtrados', r.contrib['GLÚTEOS']===0.5 && !r.contrib['CARDIO'] && !r.contrib['GLOBAL']) }
/* 20 · Display: jamás 100 antes de WeekComplete */
ok('99.6% ⇒ 99', KD.displayPercent(0.996,false)===99)
ok('complete ⇒ 100', KD.displayPercent(1,true)===100)
ok('W=N/A ⇒ N/A', KD.displayPercent(KD.NA,false)===KD.NA)
/* 21 · Ejecución real conservada bajo cap */
{ const m=KD.muscleCompletion(15,12); ok('actual=15 conservado', m.actual===15 && m.excess===3 && m.completion===1) }
/* Projected */
ok('projected cap', KD.projectedMuscleCompletion(8,10,12)===1)
ok('projected T=0 ⇒ N/A', KD.projectedMuscleCompletion(8,10,0)===KD.NA)

/* 22 · cuenta_dosis=false excluye el ejercicio completo de la dosis */
{ const r=KD.aporteSesionDOC3({bloques:[{sets:4, ejercicios:[{grupo:'CARDIO', cuenta_dosis:false, sinergistas:{'CARDIO':1.0,'HOMBROS':0.25}}]}]})
  ok('cuenta_dosis=false ⇒ 0 total', Object.keys(r.aporte).length===0) }
{ const r=KD.aporteSesionDOC3({bloques:[{sets:4, ejercicios:[{grupo:'GLÚTEOS', cuenta_dosis:true, sinergistas:{'GLÚTEOS':1.0}}]}]})
  ok('cuenta_dosis=true ⇒ cuenta', r.aporte['GLÚTEOS']===4) }
console.log('════════════════════════════')
console.log(fail===0 ? 'VERDE · '+n+'/'+n+' tests' : 'ROJO · '+fail+' fallos de '+n)
process.exit(fail?1:0)
