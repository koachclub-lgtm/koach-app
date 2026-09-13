const KD = require('./koach-domain.js')
const rows = [
[1,4,"ESPALDA",{"BÍCEPS":0.5,"HOMBROS":0.25}],[1,3,"HOMBROS",{}],[1,3,"CORE",{}],[1,3,"ESPALDA",{"BÍCEPS":0.5}],[1,3,"GLÚTEOS",{}],[1,5,"CUÁDRICEPS",{}],[1,5,"ESPALDA",{}],[1,5,"ESPALDA",{"BÍCEPS":0.5,"HOMBROS":0.25}],[1,5,"ISQUIOS",{}],[1,4,"MOVILIDAD",{}],[1,4,"CORE",{}],[1,4,"CORE",{}],
[2,4,"ISQUIOS",{"ESPALDA":0.25,"GLÚTEOS":0.5}],[2,4,"CUÁDRICEPS",{}],[2,4,"CUÁDRICEPS",{"GLÚTEOS":0.25}],[2,4,"CUÁDRICEPS",{"GLÚTEOS":0.25}],[2,4,"GLÚTEOS",{"ISQUIOS":0.25}],[2,4,"ESPALDA",{"BÍCEPS":0.5,"HOMBROS":0.25}],[2,4,"CUÁDRICEPS",{}],[2,4,"BÍCEPS",{}],[2,3,"GLOBAL",{}],[2,3,"BÍCEPS",{}],[2,3,"CORE",{}],[2,3,"CARDIO",{}],
[3,4,"HOMBROS",{}],[3,4,"GLÚTEOS",{}],[3,3,"PECHO",{"HOMBROS":0.25,"TRÍCEPS":0.5}],[3,3,"ISQUIOS",{}],[3,3,"GLÚTEOS",{"ISQUIOS":0.25}],[3,3,"ESPALDA",{"BÍCEPS":0.5,"HOMBROS":0.25}],[3,4,"MOVILIDAD",{}],[3,4,"CARDIO",{}],
[4,3,"BÍCEPS",{}],[4,3,"PECHO",{}],[4,3,"CARDIO",{}],[4,3,"BÍCEPS",{}],[4,3,"CUÁDRICEPS",{"GLÚTEOS":0.25}],[4,3,"CORE",{}],
[5,3,"CARDIO",{"HOMBROS":0.25,"CUÁDRICEPS":0.25}],[5,3,"CARDIO",{}],[5,3,"GLÚTEOS",{"ISQUIOS":0.25}],[5,3,"GLÚTEOS",{}],[5,3,"ISQUIOS",{}],[5,3,"CARDIO",{}]]
const objetivos = {"BÍCEPS":6,"CORE":6,"CUÁDRICEPS":8,"ESPALDA":10,"GLÚTEOS":10,"HOMBROS":8,"ISQUIOS":8,"PECHO":6,"TRÍCEPS":6}
const porSesion = {}
rows.forEach(([n,sets,grupo,sin])=>{ (porSesion[n]=porSesion[n]||[]).push({sets,grupo,sinergistas:sin}) })
const sesion = n => ({ bloques: (porSesion[n]||[]).map(e=>({sets:e.sets, ejercicios:[e]})) })
// Perfil normalizado interino (RECOMENDACIÓN, no aplicado a base): primario 1.0 + secundarios curados
const norm = e => Object.assign({[e.grupo]:1.0}, e.sinergistas||{})
const sesionNorm = n => ({ bloques:(porSesion[n]||[]).map(e=>({sets:e.sets, ejercicios:[{grupo:e.grupo, sinergistas:norm(e)}]})) })

function suma(dst, src){ Object.entries(src).forEach(([k,v])=>dst[k]=(dst[k]||0)+v) }
const nums = [1,2,3,4,5]
const L={}, D={}, N={}
let noEvalProy=0
nums.forEach(n=>{
  suma(L, KD.legacyAporteSesion(sesion(n)))
  const d=KD.aporteSesionDOC3(sesion(n)); suma(D,d.aporte); noEvalProy+=d.noEvaluable.length
  suma(N, KD.aporteSesionDOC3(sesionNorm(n)).aporte)
})
// REAL: sesión 1 completada, bloques [0,1,2] → con estructura 1-ej-por-bloque = primeros 3 ejercicios
const LR={},DR={},NR={}
suma(LR, KD.legacyAporteSesion(sesion(1),[0,1,2]))
suma(DR, KD.aporteSesionDOC3(sesion(1),[0,1,2]).aporte)
suma(NR, KD.aporteSesionDOC3(sesionNorm(1),[0,1,2]).aporte)
const gs=[...new Set([...Object.keys(objetivos),'CARDIO','GLOBAL'])]
console.log('PROYECCIÓN SEMANAL (semana completa) — LEGACY vs DOC3-puro vs DOC3-normalizado')
console.log('GRUPO'.padEnd(12),'LEGACY','DOC3','NORM','TARGET')
gs.forEach(g=>{
  console.log(g.padEnd(12), String(+(L[g]||0).toFixed(2)).padEnd(6), String(+(D[g]||0).toFixed(2)).padEnd(5), String(+(N[g]||0).toFixed(2)).padEnd(5), objetivos[g]??'—')
})
console.log('Ejercicios NO_EVALUABLE (perfil {}) en la semana:', noEvalProy, 'de', rows.length)
console.log('\nREAL sesión 1 (bloques 0-2):')
gs.forEach(g=>{ if((LR[g]||DR[g]||NR[g])) console.log(g.padEnd(12), +(LR[g]||0).toFixed(2), +(DR[g]||0).toFixed(2), +(NR[g]||0).toFixed(2)) })
// SVC bajo NORM (única forma DOC3-válida con targets actuales)
const items = Object.entries(objetivos).map(([m,t])=>({muscle:m, aligned:N[m]||0, target:t}))
const svc = KD.strengthVolumeCompletion(items)
console.log('\nStrengthVolumeCompletion (PROY, perfiles normalizados):', (svc.value*100).toFixed(1)+'%', '· metas completas:', svc.completedGoals+'/'+svc.totalGoals)
