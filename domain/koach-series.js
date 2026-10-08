/* ════════════════════════════════════════════════════════════════════
   KOACH SERIES · gramática única de una serie (socio + coach)
   TRAINING PRESCRIPTION INPUT ORDER (design/KOACH_DESIGN_SYSTEM_V2.md §Series):
     1. REPS / TIEMPO   2. CARGA
   · Prescripción, referencia, edición  → "10 REPS · 12,5 KG"
   · Peso corporal                       → "40 REPS · PESO CORPORAL"
   · Tiempo                              → "60 SEG"  (con lastre: "60 SEG · 10 KG")
   · Resultado / PR (la carga es el logro) → "45 KG · 6 REPS"
   Nunca "12,5 × 10": "×" queda reservado para SETS × REPS.
   Solo presentación: los valores internos (peso, reps, seg) no se tocan.
   ════════════════════════════════════════════════════════════════════ */
(function(root){
'use strict'
const vacio = v => v==null || v==='' || (typeof v==='number' && !isFinite(v))
// 12.5 → "12,5" · 100 → "100" · 102.25 → "102,25" (es-CL, sin ceros de relleno)
function kg(v){ if (vacio(v)) return '—'; const n=+v; if (!isFinite(n)) return String(v)
  return String(Math.round(n*100)/100).replace('.',',') }
function reps(v){ if (vacio(v)) return '—'; return String(v).replace(/\//g,'·').trim().toUpperCase() }
// x: { tipo:'WEIGHT_REPS'|'BODYWEIGHT_REPS'|'TIME', reps, kg|peso, seg, bw:bool }
function txt(x){ x=x||{}; const p = x.kg!=null ? x.kg : x.peso
  const t = x.tipo || (x.seg!=null && vacio(x.reps) ? 'TIME' : x.bw ? 'BODYWEIGHT_REPS' : 'WEIGHT_REPS')
  if (t==='TIME') return (vacio(x.seg)?'—':x.seg)+' SEG'+(vacio(p)?'':' · '+kg(p)+' KG')
  if (t==='BODYWEIGHT_REPS') return reps(x.reps)+' REPS · PESO CORPORAL'
  return reps(x.reps)+' REPS'+(vacio(p)?'':' · '+kg(p)+' KG') }
const pres = x => 'PRESCRITO · '+txt(x)
const ref  = (x, fecha) => 'REF · '+txt(x)+(fecha?' · '+fecha:'')
// Resultado / marca: la carga es protagonista
function resultado(x){ x=x||{}; const p = x.kg!=null ? x.kg : x.peso
  if (vacio(p)) return x.seg!=null ? x.seg+' SEG' : reps(x.reps)+' REPS'
  return kg(p)+' KG'+(vacio(x.reps)?'':' · '+reps(x.reps)+' REPS') }
// largo visible para el ajuste tipográfico del número (CSS --len)
// la coma/punto pesa ~media cifra en Inter Display Black
const len = v => { const t=String(vacio(v)?'':v); return Math.max(2, t.length - 0.5*(t.match(/[.,]/g)||[]).length) }
root.KSET = { kg, reps, txt, pres, ref, resultado, len, VERSION:'koach-series@1.0.0' }
})(typeof window!=='undefined'?window:globalThis);
