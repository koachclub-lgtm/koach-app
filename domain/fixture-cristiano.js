/* FIXTURE DE REGRESIÓN · Caso real Cristiano (STRONG, sem 1) · 2026-09-13
   El motor DEBE reproducir por siempre: A=56% · A+B=94% · A+B+C=100% (WeekComplete)
   Raíz del 94%: prescripción entrega 2-3x los targets (no es bug de motor). */
const KD=require('./koach-domain.js')
const nrm=(g,s)=>Object.assign(g&&g!=='MOVILIDAD'?{[g]:1.0}:{},s||{})
const B=(sets,ejs)=>({sets,ejercicios:ejs.map(([g,s,cd])=>({grupo:g,sinergistas:nrm(g,s),cuenta_dosis:cd!==false}))})
const A=[B(4,[['GLÚTEOS',{'ISQUIOS':.25}],['GLÚTEOS',{'ISQUIOS':.25}],['CORE',{}],['MOVILIDAD',{},false]]),
 B(5,[['GLÚTEOS',{'ISQUIOS':.25}],['ISQUIOS',{'ESPALDA':.25,'GLÚTEOS':.5}]]),
 B(4,[['CUÁDRICEPS',{}],['ISQUIOS',{'ESPALDA':.25,'GLÚTEOS':.5}],['BÍCEPS',{}],['HOMBROS',{}]]),
 B(3,[['GLOBAL',{}],['BÍCEPS',{}],['BÍCEPS',{}],['BÍCEPS',{}]])]
const Bses=[B(4,[['ESPALDA',{'BÍCEPS':.5,'HOMBROS':.25}],['PECHO',{'HOMBROS':.5,'TRÍCEPS':.25}],['CORE',{}],['MOVILIDAD',{},false]]),
 B(4,[['ESPALDA',{'BÍCEPS':.5,'HOMBROS':.25}],['PECHO',{'HOMBROS':.25,'TRÍCEPS':.5}]]),
 B(3,[['TRÍCEPS',{}],['HOMBROS',{'ESPALDA':.25}],['BÍCEPS',{}]])]
const C=[B(4,[['GLÚTEOS',{'ISQUIOS':.25}],['ESPALDA',{'TRÍCEPS':.25}],['CORE',{}],['MOVILIDAD',{},false]]),
 B(5,[['CUÁDRICEPS',{'GLÚTEOS':.25}],['ESPALDA',{'BÍCEPS':.5}]])]
const OBJ={"GLÚTEOS":10,"ISQUIOS":8,"CUÁDRICEPS":8,"ESPALDA":10,"PECHO":6,"HOMBROS":8,"BÍCEPS":6,"TRÍCEPS":6,"CORE":6}
const suma=(d,s)=>Object.entries(s).forEach(([k,v])=>d[k]=(d[k]||0)+v)
const svcDe=ac=>Math.floor(KD.strengthVolumeCompletion(Object.keys(OBJ).map(m=>({aligned:ac[m]||0,target:OBJ[m]}))).value*100)
const acA={}; suma(acA,KD.aporteSesionDOC3({bloques:A}).aporte)
const acAB=JSON.parse(JSON.stringify(acA)); suma(acAB,KD.aporteSesionDOC3({bloques:Bses}).aporte)
const acABC=JSON.parse(JSON.stringify(acAB)); suma(acABC,KD.aporteSesionDOC3({bloques:C}).aporte)
let fail=0
const ok=(nom,c)=>{ if(!c){fail++;console.log('✗',nom)} else console.log('✓',nom) }
ok('A = 56%', svcDe(acA)===56)
ok('A+B = 94% (el caso real)', svcDe(acAB)===94)
ok('A+B+C = 100%', svcDe(acABC)===100)
ok('BÍCEPS ejecutado A+B = 20', Math.abs((acAB['BÍCEPS']||0)-20)<1e-9)
ok('ISQUIOS ejecutado A+B = 12.25', Math.abs((acAB['ISQUIOS']||0)-12.25)<1e-9)
ok('ESPALDA ejecutado A+B = 11', Math.abs((acAB['ESPALDA']||0)-11)<1e-9)
const s3=KD.strengthVolumeCompletion(Object.keys(OBJ).map(m=>({aligned:acABC[m]||0,target:OBJ[m]})))
ok('WeekComplete tras A+B+C (9/9 metas)', s3.completedGoals===9)
console.log(fail?('ROJO '+fail):'FIXTURE CRISTIANO · VERDE 7/7')
process.exit(fail?1:0)
