/* ═══════════════════════════════════════════════════════════════
   KOACH DOMAIN · Motor autoritativo de cálculo · F1
   Implementa DOC3 · Parte II v1.0 (Modelo Matemático)
   UNA VERDAD DERIVADA → UNA IMPLEMENTACIÓN → MÚLTIPLES CONSUMIDORES
   Sin dependencias. Funciones puras. Vanilla JS (ley de stack).
   ═══════════════════════════════════════════════════════════════ */
(function(root){
'use strict'
const KD = {
  DOMAIN_VERSION: 'koach-domain@1.0.0-F1',
  VOLUME_ALGORITHM_VERSION: 'vol-doc3-v1',
  COMPLETION_ALGORITHM_VERSION: 'compl-doc3-v1',
  // Músculos evaluables por el motor muscular (DOC3 §4.5: CARDIO/MOB fuera; GLOBAL no es músculo; CORE modelable)
  MUSCLE_KEYS: ['PECHO','ESPALDA','HOMBROS','TRÍCEPS','BÍCEPS','CORE','GLÚTEOS','CUÁDRICEPS','ISQUIOS','PANTORRILLAS',
                'PECS','LATS','DELTS','TRIS','BIS','GLUTS','QUADS','HAMS','CALFS'],
  NON_MUSCLE_KEYS: ['CARDIO','MOVILIDAD','MOB','GLOBAL'],
  NA: 'N/A'
}
const isNum = v => typeof v==='number' && isFinite(v)
const esMusculo = k => KD.NON_MUSCLE_KEYS.indexOf(String(k).toUpperCase())===-1

/* ── §2 ELEGIBILIDAD ─────────────────────────────────────────── */
/* set: { role:'WORK'|'WARMUP'|undefined, status:'COMPLETED'|..., completado:bool,
          eligibility_override:'EXCLUDE'|undefined, legacy:bool } */
KD.eligible = function(set){
  if (!set) return 0
  if (set.eligibility_override==='EXCLUDE') return 0
  if (set.legacy===true){
    // LEGACY_V0 (Resolución B3/B7): sin SetRole registrado → comportamiento histórico conservado
    return (set.completado===true || set.status==='COMPLETED') ? 1 : 0
  }
  const role = set.role || 'WORK'           // default prescriptivo declarado, no inferencia
  const status = set.status || (set.completado===true ? 'COMPLETED' : 'PLANNED')
  if (role!=='WORK') return 0               // WARMUP jamás contribuye (§17)
  return status==='COMPLETED' ? 1 : 0       // PARTIAL/ABORTED/SKIPPED → 0 en v1
}

/* ── §4 CONTRIBUCIÓN MUSCULAR (MVC) ──────────────────────────── */
/* profile: objeto stimulus_profile {GRUPO:coef} · vacío/null ⇒ NO EVALUABLE (Resolución C10/B6):
   contribución computable 0 PERO estado distinto de "coeficiente realmente 0". */
KD.mvc = function(set, profile){
  const out = { contrib:{}, evaluable:true, provenance: set&&set.profile_version || 'LEGACY_V0' }
  const el = KD.eligible(set)
  const keys = profile ? Object.keys(profile) : []
  if (!profile || keys.length===0){ out.evaluable=false; return out }  // NO_EVALUABLE ≠ 0 fisiológico
  if (el===0) return out
  keys.forEach(k=>{
    const K = String(k).toUpperCase()
    if (!esMusculo(K)) return                        // CARDIO/MOB/GLOBAL no alimentan motor muscular
    const c = parseFloat(profile[k])
    if (isNum(c) && c>0) out.contrib[K] = (out.contrib[K]||0) + c
  })
  return out
}

/* ── §4.3 ACUMULADORES ───────────────────────────────────────── */
/* sets: [{...set, exercise_id, prescription_relation}] · profiles: {exercise_id: profile} */
const ALIGNED = ['AS_PLANNED','COACH_ADJUSTED','EXTRA_AUTHORIZED']
KD.accumulate = function(sets, profiles){
  const total={}, aligned={}, noEvaluable=[]
  ;(sets||[]).forEach(s=>{
    const r = KD.mvc(s, profiles ? profiles[s.exercise_id] : null)
    if (!r.evaluable){ if(KD.eligible(s)===1) noEvaluable.push(s.exercise_id); return }
    const rel = s.prescription_relation || (s.legacy ? 'LEGACY_UNKNOWN' : 'AS_PLANNED')
    // Resolución B7/C12: legacy sin relación registrada = UNKNOWN. LEGACY_V0 conserva comportamiento
    // histórico: contribuye a ambos acumuladores (así operaba el sistema); lo NUEVO exige relación explícita.
    const esAlineado = (rel==='LEGACY_UNKNOWN') ? true : ALIGNED.indexOf(rel)>-1
    Object.entries(r.contrib).forEach(([m,v])=>{
      total[m]=(total[m]||0)+v
      if (esAlineado) aligned[m]=(aligned[m]||0)+v
    })
  })
  return { total, aligned, noEvaluable, provenance:{domain:KD.DOMAIN_VERSION, algo:KD.VOLUME_ALGORITHM_VERSION} }
}

/* ── §5-§6 TARGET Y CUMPLIMIENTO MUSCULAR ────────────────────── */
KD.muscleCompletion = function(alignedActual, target){
  const A = isNum(alignedActual) ? alignedActual : 0
  if (!isNum(target) || target<=0)
    return { completion:KD.NA, covered:KD.NA, deficit:KD.NA, excess:isNum(target)&&target===0?Math.max(A,0):KD.NA, actual:A }
  return {
    completion: Math.min(A/target, 1),
    covered: Math.min(A, target),
    deficit: Math.max(target-A, 0),
    excess: Math.max(A-target, 0),        // la ejecución real jamás se borra
    actual: A
  }
}

/* ── §7 AGREGACIÓN DE FUERZA ─────────────────────────────────── */
/* items: [{muscle, aligned, target, evaluable?:bool}] · evaluable=exigible!==false */
KD.strengthVolumeCompletion = function(items){
  const M = (items||[]).filter(x=>x && x.evaluable!==false && isNum(x.target) && x.target>0)
  if (M.length===0) return { value:KD.NA, completedGoals:0, totalGoals:0 }
  let cov=0, tot=0, done=0
  M.forEach(x=>{ const A=isNum(x.aligned)?x.aligned:0
    cov += Math.min(A, x.target); tot += x.target; if (A>=x.target) done++ })
  return { value: cov/tot, completedGoals:done, totalGoals:M.length }
}

/* ── §8 RING (recibe configuración del Método; JAMÁS la inventa) ─ */
/* components: [{type, role:'REQUIRED'|'OPTIONAL', completion:number|'N/A', weight}] */
KD.weeklyCompletion = function(components){
  const R = (components||[]).filter(c=>c && c.role==='REQUIRED' && isNum(c.weight) && c.weight>0 && c.completion!==undefined)
  const evaluables = R.filter(c=>isNum(c.completion))
  if (R.length===0 || evaluables.length===0 || evaluables.length!==R.length)
    return { value:KD.NA, weekComplete:false }   // B1 BLOCKED-BY-METHOD ⇒ sin config: N/A, nunca 0
  let num=0, den=0, all1=true
  R.forEach(c=>{ const ck=Math.min(c.completion,1); num+=c.weight*ck; den+=c.weight; if(ck<1) all1=false })
  return { value:num/den, weekComplete:all1 }
}

/* ── §8.3 DISPLAY ────────────────────────────────────────────── */
KD.displayPercent = function(W, weekComplete){
  if (!isNum(W)) return KD.NA
  if (weekComplete===true) return 100
  return Math.min(Math.floor(100*W), 99)   // jamás 100 antes de WeekComplete
}

/* ── §9 PROYECTADO ───────────────────────────────────────────── */
KD.projectedMuscleCompletion = function(alignedActual, remainingProjected, target){
  if (!isNum(target) || target<=0) return KD.NA
  const A=(isNum(alignedActual)?alignedActual:0)+(isNum(remainingProjected)?remainingProjected:0)
  return Math.min(A/target, 1)
}

/* ── COMPAT · LEGACY_V0 (réplica exacta del cálculo histórico) ── */
/* Solo para reconstrucción/diff de datos LEGACY. NO usar para verdades nuevas.
   Reproduce: primario += sets×1.0 SIEMPRE + sinergistas (sin filtrar CARDIO/GLOBAL; excluye MOVILIDAD). */
KD.legacyAporteSesion = function(sesion, bloquesCompletados){
  const a={}; const suma=(g,v)=>{a[g]=(a[g]||0)+v}
  ;(sesion.bloques||[]).forEach((b,idx)=>{
    if (bloquesCompletados!=null && bloquesCompletados.indexOf(idx)===-1) return
    const sets=b.sets||0
    ;(b.ejercicios||[]).forEach(ej=>{
      const g=(ej.grupo||'').toUpperCase()
      if(!g||g==='MOVILIDAD')return
      suma(g, sets*1.0)
      Object.entries(ej.sinergistas||{}).forEach(([sg,p])=>{
        const s2=sg.toUpperCase()
        if(s2!=='MOVILIDAD') suma(s2, sets*(parseFloat(p)||0))
      })
    })
  }); return a
}

/* ── DOC3: aporte de sesión (prescripción → proyección) ──────── */
KD.aporteSesionDOC3 = function(sesion, bloquesCompletados){
  const a={}, noEval=[]
  ;(sesion.bloques||[]).forEach((b,idx)=>{
    if (bloquesCompletados!=null && bloquesCompletados.indexOf(idx)===-1) return
    const sets=b.sets||0
    ;(b.ejercicios||[]).forEach(ej=>{
      const prof = ej.sinergistas
      if (!prof || Object.keys(prof).length===0){ noEval.push(ej.nombre||ej.id||'?'); return }
      Object.entries(prof).forEach(([k,c])=>{
        const K=String(k).toUpperCase()
        if (!esMusculo(K)) return
        const v=parseFloat(c); if(isNum(v)&&v>0) a[K]=(a[K]||0)+sets*v
      })
    })
  }); return { aporte:a, noEvaluable:noEval }
}

if (typeof module!=='undefined' && module.exports) module.exports = KD
else root.KD = KD
})(typeof self!=='undefined'?self:this)
