/* ════════════════════════════════════════════════════════════════════
   KOACH TIMER · bloque temporizador (Tabata · EMOM)
   Inspirado en la lógica de SmartWOD Timer: cuenta previa, intervalos programados,
   cuenta 3·2·1 con tono, GO de salida, descanso, pausa entre series y cierre.
   · Configuración (bloques.timer jsonb):
     { modo, trabajo, descanso, rondas, series, pausa, prep }   (segundos / conteos)
   · KTIMER.timeline(cfg) → segmentos [{k:'prep'|'work'|'rest'|'pause', d, r, R, s, S, ex, up}]
   · KTIMER.play(cfg, opts)  → reproductor a pantalla completa (socio y coach)
   · KTIMER.editor(cfg, opts) → editor de formatos para el planificador del coach
   Reloj de pared (Date.now): sigue exacto aunque la pantalla se bloquee o la pestaña pase a segundo plano.
   ════════════════════════════════════════════════════════════════════ */
(function(root){
'use strict'
const MODOS = {
  tabata:     { lab:'TABATA',     d:'Trabajo / descanso fijos por rondas. El clásico: 20″ / 10″ × 8.' },
  emom:       { lab:'EMOM',       d:'Cada minuto (o intervalo) arranca una ronda; lo que sobra es descanso.' }
}
// Formatos propuestos (presets): un toque y queda programado; luego se ajusta fino.
const PRESETS = [
  { id:'tab20',  modo:'tabata', n:'TABATA CLÁSICO',  s:'20″ / 10″ × 8',            c:{trabajo:20, descanso:10, rondas:8,  series:1, pausa:60} },
  { id:'tab2x',  modo:'tabata', n:'DOBLE TABATA',    s:'2 × (20″ / 10″ × 8) · 1′', c:{trabajo:20, descanso:10, rondas:8,  series:2, pausa:60} },
  { id:'tab30',  modo:'tabata', n:'TABATA 30/15',    s:'30″ / 15″ × 8',            c:{trabajo:30, descanso:15, rondas:8,  series:1, pausa:60} },
  { id:'tab40',  modo:'tabata', n:'TABATA 40/20',    s:'40″ / 20″ × 6',            c:{trabajo:40, descanso:20, rondas:6,  series:1, pausa:60} },
  { id:'emom10', modo:'emom',   n:'EMOM 10′',        s:'cada 1′ × 10',             c:{trabajo:60, descanso:0,  rondas:10, series:1, pausa:60} },
  { id:'e2mom',  modo:'emom',   n:'E2MOM 12′',       s:'cada 2′ × 6',              c:{trabajo:120,descanso:0,  rondas:6,  series:1, pausa:60} },
  { id:'emom30', modo:'emom',   n:'EMOM 30″',        s:'cada 30″ × 12',            c:{trabajo:30, descanso:0,  rondas:12, series:1, pausa:60} }
]
const clamp=(v,a,b,d)=>{ v=parseInt(v,10); if(!isFinite(v)) v=d; return Math.max(a,Math.min(b,v)) }
function norm(c){ c=c||{}; const modo = MODOS[c.modo] ? c.modo : 'tabata'
  const o = { modo,
    trabajo: clamp(c.trabajo,5,3600, modo==='emom'?60:20),
    descanso: clamp(c.descanso,0,600, modo==='tabata'?10:0),
    rondas: clamp(c.rondas,1,99, modo==='tabata'?8:modo==='emom'?10:1),
    series: clamp(c.series,1,10,1),
    pausa: clamp(c.pausa,0,600,60),
    prep: clamp(c.prep,0,60,10) }
  if (modo==='emom') o.descanso=0
  return o }
function timeline(c){ c=norm(c); const out=[]; let ex=0
  if (c.prep) out.push({k:'prep', d:c.prep})
  for (let s=1;s<=c.series;s++){
    for (let r=1;r<=c.rondas;r++){
      out.push({k:'work', d:c.trabajo, r, R:c.rondas, s, S:c.series, ex:ex++})
      if (c.descanso && (r<c.rondas || (c.modo==='tabata' && s===c.series))) out.push({k:'rest', d:c.descanso, r, R:c.rondas, s, S:c.series, ex})
    }
    if (s<c.series && c.pausa) out.push({k:'pause', d:c.pausa, s, S:c.series, ex})
  }
  return out }
const total = c => timeline(c).reduce((a,x)=>a+(x.k==='prep'?0:x.d),0)
const mmss = s => { s=Math.max(0,Math.round(s)); return String(Math.floor(s/60)).padStart(2,'0')+':'+String(s%60).padStart(2,'0') }
const corto = s => s%60===0 && s>=60 ? (s/60)+'′' : s>=60 ? Math.floor(s/60)+'′'+String(s%60).padStart(2,'0')+'″' : s+'″'
function resumen(c){ if(!c) return ''; c=norm(c); const L=MODOS[c.modo].lab, sx=c.series>1?c.series+' × ':''
  if (c.modo==='tabata') return L+' · '+sx+corto(c.trabajo)+'/'+corto(c.descanso)+' × '+c.rondas
  if (c.modo==='emom') return (c.trabajo===60?'EMOM':c.trabajo===120?'E2MOM':'EMOM '+corto(c.trabajo))+' · '+sx+c.rondas+' RONDAS'
  return '' }

/* ── sonido (Web Audio, sin archivos) ── */
const AU={ ctx:null }
function unlock(){ try{ const AC=root.AudioContext||root.webkitAudioContext; if(!AC) return; if(!AU.ctx) AU.ctx=new AC(); if(AU.ctx.state!=='running') AU.ctx.resume() }catch(_){} }
function beep(f,dur,gain,at,type){ const c=AU.ctx; if(!c||c.state!=='running'||!P.sonido()) return
  try{ const t=c.currentTime+(at||0), o=c.createOscillator(), g=c.createGain(); o.type=type||'sine'; o.frequency.value=f
    g.gain.setValueAtTime(0,t); g.gain.linearRampToValueAtTime(gain,t+.008); g.gain.exponentialRampToValueAtTime(.0001,t+dur)
    o.connect(g); g.connect(c.destination); o.start(t); o.stop(t+dur+.03) }catch(_){} }
const SND = {
  tick(){ beep(1100,.08,.2) },                                             // 3 · 2 · 1
  go(){ beep(1760,.32,.32,0,'square'); beep(880,.32,.18,0) },                // inicio de TRABAJO (largo y agudo)
  rest(){ beep(660,.18,.22); beep(440,.3,.22,.2) },                          // inicio de DESCANSO (dos tonos bajando)
  half(){ beep(990,.1,.14); beep(990,.1,.14,.16) },                          // mitad del intervalo largo
  fin(){ [0,.3,.6].forEach(a=>beep(1320,.22,.3,a,'square')); beep(660,.9,.25,.9) } // final
}

/* ── reloj de siete segmentos (mismo dibujo que la app) ── */
const D7={'0':'abcdef','1':'bc','2':'abged','3':'abgcd','4':'fgbc','5':'afgcd','6':'afgedc','7':'abc','8':'abcdefg','9':'abcdfg','-':'g'}
function dig(ch,x){ const t=20,g=4
  const H=(y,x1,x2)=>x1+g+','+y+' '+(x1+t/2+g)+','+(y-t/2)+' '+(x2-t/2-g)+','+(y-t/2)+' '+(x2-g)+','+y+' '+(x2-t/2-g)+','+(y+t/2)+' '+(x1+t/2+g)+','+(y+t/2)
  const V=(xx,y1,y2)=>xx+','+(y1+g)+' '+(xx+t/2)+','+(y1+t/2+g)+' '+(xx+t/2)+','+(y2-t/2-g)+' '+xx+','+(y2-g)+' '+(xx-t/2)+','+(y2-t/2-g)+' '+(xx-t/2)+','+(y1+t/2+g)
  const S={a:H(10,10,90),g:H(90,10,90),d:H(170,10,90),f:V(10,10,90),b:V(90,10,90),e:V(10,90,170),c:V(90,90,170)}, on=D7[ch]||''
  return Object.keys(S).map(k=>'<polygon points="'+S[k]+'" transform="translate('+x+' 0)" fill="currentColor" opacity="'+(on.includes(k)?1:.09)+'"/>').join('') }
function seg7(txt){ let x=0, out=''
  for (const ch of String(txt)){ if(ch===':'){ out+='<rect x="'+(x+10)+'" y="52" width="20" height="20" fill="currentColor"/><rect x="'+(x+10)+'" y="108" width="20" height="20" fill="currentColor"/>'; x+=40 } else { out+=dig(ch,x); x+=112 } }
  return '<svg viewBox="-14 0 '+(x+14)+' 180" aria-hidden="true"><g transform="skewX(-7)">'+out+'</g></svg>' }

const esc = t => String(t==null?'':t).replace(/[&<>"']/g, m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]))
const P = { sonido:()=>true }

/* ── estilos (una vez) ── */
function css(){ if (document.getElementById('ktCss')) return
  const s=document.createElement('style'); s.id='ktCss'; s.textContent=`
.kt{position:fixed;inset:0;z-index:9000;display:flex;flex-direction:column;padding:max(10px,env(safe-area-inset-top)) 18px max(14px,env(safe-area-inset-bottom));
  --D:'KOACH Display','Archivo','Inter Display',Inter,Arial,sans-serif;--M:'Space Mono','IBM Plex Mono',ui-monospace,monospace;
  --bg:#6E6F72;--ink:#F4F3F0;--ink2:rgba(244,243,240,.66);--ink3:rgba(244,243,240,.28);--card:rgba(255,255,255,.1);
  background:var(--bg);color:var(--ink);transition:background-color .35s ease,color .35s ease;font-variant-numeric:tabular-nums;-webkit-user-select:none;user-select:none;overflow:hidden}
.kt[data-k=work]{--bg:#E6E5E1;--ink:#141414;--ink2:rgba(20,20,20,.62);--ink3:rgba(20,20,20,.18);--card:rgba(20,20,20,.06)}
.kt[data-k=rest],.kt[data-k=pause]{--bg:#1C1D1F;--ink:#F4F3F0;--ink2:rgba(244,243,240,.62);--ink3:rgba(244,243,240,.2);--card:rgba(255,255,255,.07)}
.kt[data-k=fin]{--bg:#B3B3B3;--ink:#141414;--ink2:rgba(20,20,20,.62);--ink3:rgba(20,20,20,.2);--card:rgba(20,20,20,.07)}
.kt *{box-sizing:border-box}
.kt__top{display:flex;align-items:center;justify-content:space-between;gap:10px;min-height:48px}
.kt__x{width:42px;height:42px;border-radius:50%;border:0;background:var(--card);color:var(--ink);font-size:16px;cursor:pointer}
.kt__x.arm{width:auto;padding:0 14px;font:700 9px var(--M);letter-spacing:.12em;border-radius:999px}
.kt__md{font:700 9.5px var(--M);letter-spacing:.16em;color:var(--ink2);text-align:right;line-height:1.5}
.kt__md b{display:block;color:var(--ink);font-size:11px}
.kt__ph{margin-top:2vh;font-family:var(--D);font-weight:900;font-stretch:112%;font-size:clamp(40px,13vw,92px);line-height:.86;letter-spacing:-.02em;text-transform:uppercase}
.kt__rd{display:flex;gap:16px;margin-top:10px;font:700 11px var(--M);letter-spacing:.14em;color:var(--ink2)}
.kt__rd b{color:var(--ink);font-size:15px}
.kt__clk{flex:1;min-height:0;display:flex;align-items:center;justify-content:center;line-height:0;padding:1vh 0}
.kt__clk svg{width:100%;max-height:100%;height:auto;max-width:720px}
.kt__clk.tk svg{animation:ktTk .25s ease-out}
@keyframes ktTk{from{opacity:.5;transform:scale(.985)}to{opacity:1;transform:none}}
.kt__bar{display:flex;gap:3px;height:6px;margin-bottom:12px}
.kt__bar i{flex:1;border-radius:2px;background:var(--ink3);position:relative;overflow:hidden}
.kt__bar i.on{background:var(--ink)}
.kt__bar i u{position:absolute;inset:0 auto 0 0;background:var(--ink)}
.kt__ex{display:flex;gap:12px;align-items:center;padding:12px;border-radius:10px;background:var(--card);min-height:76px}
.kt__ex img{width:64px;height:64px;border-radius:8px;object-fit:cover;flex:none;background:var(--ink3)}
.kt__ex small{display:block;font:700 8.5px var(--M);letter-spacing:.16em;color:var(--ink2)}
.kt__ex b{display:block;font-family:var(--D);font-weight:800;font-stretch:106%;font-size:clamp(17px,5vw,24px);line-height:1.05;text-transform:uppercase;margin-top:4px}
.kt__ex em{display:block;font:700 9px var(--M);font-style:normal;letter-spacing:.12em;color:var(--ink2);margin-top:6px}
.kt__ls{display:flex;flex-direction:column;gap:6px;flex:1;min-width:0}
.kt__ls span{font-family:var(--D);font-weight:800;font-size:15px;text-transform:uppercase;line-height:1.1}
.kt__ls span i{font:700 9px var(--M);font-style:normal;letter-spacing:.1em;color:var(--ink2);margin-right:8px}
.kt__ft{display:flex;justify-content:space-between;align-items:center;margin:10px 0 12px;font:700 9px var(--M);letter-spacing:.14em;color:var(--ink2)}
.kt__ft b{color:var(--ink);font-size:12px}
.kt__ctl{display:grid;grid-template-columns:1fr 1.5fr 1fr;gap:8px}
.kt__ctl button,.kt__big{height:58px;border:0;border-radius:10px;background:var(--card);color:var(--ink);font:700 10px var(--M);letter-spacing:.14em;cursor:pointer}
.kt__ctl .pri{background:var(--ink);color:var(--bg);font-size:12px}
.kt__big{width:100%;height:76px;margin-bottom:8px;background:var(--ink);color:var(--bg);font-size:15px}
.kt__big small{display:block;font-size:9px;opacity:.7;margin-top:3px}
.kt__fin{flex:1;display:flex;flex-direction:column;justify-content:center;gap:14px}
.kt__fin h2{margin:0;font-family:var(--D);font-weight:900;font-stretch:112%;font-size:clamp(40px,12vw,80px);line-height:.88;text-transform:uppercase}
.kt__fin p{margin:0;font:700 11px var(--M);letter-spacing:.14em;color:var(--ink2)}
.kt__stats{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.kt__stats div{background:var(--card);border-radius:10px;padding:14px}
.kt__stats small{display:block;font:700 8.5px var(--M);letter-spacing:.16em;color:var(--ink2)}
.kt__stats b{display:block;font:700 28px var(--M);margin-top:6px;letter-spacing:-.03em}
.kt__pz{position:absolute;inset:0;display:none;align-items:center;justify-content:center;background:rgba(0,0,0,.55);color:#F4F3F0;font:700 12px var(--M);letter-spacing:.2em;pointer-events:none}
.kt.paused .kt__pz{display:flex}
@media (min-width:820px){.kt{padding-left:6vw;padding-right:6vw}.kt__ex img{width:96px;height:96px}}
@media (prefers-reduced-motion:reduce){.kt,.kt *{transition:none!important;animation:none!important}}
/* editor */
.kte{position:fixed;inset:0;z-index:8000;background:rgba(18,18,16,.55);display:flex;align-items:flex-end;justify-content:center;
  --D:'KOACH Display','Archivo','Inter Display',Inter,Arial,sans-serif;--M:'Space Mono','IBM Plex Mono',ui-monospace,monospace}
.kte__in{font-family:'Archivo','Inter Display',Inter,Arial,sans-serif;background:#F3F2EF;color:#121210;width:100%;max-width:560px;max-height:92vh;overflow:auto;border-radius:14px 14px 0 0;padding:18px 18px max(18px,env(safe-area-inset-bottom))}
@media (min-width:700px){.kte{align-items:center}.kte__in{border-radius:14px}}
.kte h3{margin:0;font-family:var(--D);font-weight:900;font-stretch:110%;font-size:24px;letter-spacing:-.01em;text-transform:uppercase}
.kte__k{font:700 9px var(--M);letter-spacing:.16em;color:#6B6A66;margin:16px 0 8px}
.kte__md{display:flex;gap:6px;flex-wrap:wrap}
.kte__md button{border:1.5px solid rgba(18,18,16,.16);background:none;color:#121210;border-radius:999px;padding:9px 13px;font:700 9.5px var(--M);letter-spacing:.1em;cursor:pointer}
.kte__md button.on{background:#121210;color:#F3F2EF;border-color:#121210}
.kte__d{font-size:12px;color:#5E5D59;margin:8px 0 0;line-height:1.4}
.kte__ps{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:6px}
.kte__ps button{text-align:left;border:1.5px solid rgba(18,18,16,.12);background:#fff;border-radius:10px;padding:10px 11px;cursor:pointer;color:#121210}
.kte__ps button.on{border-color:#121210;box-shadow:inset 0 0 0 1px #121210}
.kte__ps b{display:block;font-family:var(--D);font-weight:800;font-size:13px;text-transform:uppercase}
.kte__ps span{display:block;font:700 9px var(--M);letter-spacing:.06em;color:#6B6A66;margin-top:3px}
.kte__g{display:grid;grid-template-columns:1fr 1fr;gap:6px}
.kte__st{display:flex;flex-direction:column;gap:6px;border:1.5px solid rgba(18,18,16,.12);background:#fff;border-radius:10px;padding:9px 8px 8px;min-width:0}
.kte__st small{font:700 8.5px var(--M);letter-spacing:.14em;color:#6B6A66}
.kte__st div{display:flex;align-items:center;justify-content:space-between;gap:4px}
.kte__st b{font:700 16px var(--M);flex:1;text-align:center;white-space:nowrap}
.kte__st button{flex:none;width:38px;height:38px;border-radius:8px;border:0;background:rgba(18,18,16,.07);font-size:16px;cursor:pointer;color:#121210}
.kte__st.off{opacity:.35;pointer-events:none}
.kte__tot{display:flex;justify-content:space-between;align-items:center;margin-top:14px;padding:14px;border-radius:10px;background:#121210;color:#F3F2EF}
.kte__tot small{font:700 9px var(--M);letter-spacing:.14em;opacity:.7}
.kte__tot b{font:700 22px var(--M);letter-spacing:-.02em}
.kte__btns{display:flex;gap:8px;margin-top:12px;flex-wrap:wrap}
.kte__btns button{flex:1;min-width:120px;height:48px;border-radius:10px;border:1.5px solid rgba(18,18,16,.16);background:none;font:700 10px var(--M);letter-spacing:.12em;cursor:pointer;color:#121210}
.kte__btns .ink{background:#121210;color:#F3F2EF;border-color:#121210}
.kte__btns .dng{color:#9A2A1F}
`; document.head.appendChild(s) }

/* ══════════ REPRODUCTOR ══════════ */
const ACT={ cur:null }
function play(cfg, opts){
  opts=opts||{}; css(); if (ACT.cur) ACT.cur.close(true)
  if (opts.sonido) P.sonido=opts.sonido
  unlock()
  const c=norm(cfg), segs=timeline(c), exs=(opts.ejercicios||[]).filter(Boolean)
  const T={ i:0, t0:Date.now(), pausa:null, cerrar:false, last:null, half:false, done:false, wl:null }
  const el=document.createElement('div'); el.className='kt'; el.setAttribute('role','dialog'); el.setAttribute('aria-modal','true'); el.setAttribute('aria-label','Temporizador '+MODOS[c.modo].lab)
  document.body.appendChild(el); document.documentElement.style.overflow='hidden'
  const wake=async on=>{ try{ if(on && !T.wl && navigator.wakeLock){ T.wl=await navigator.wakeLock.request('screen') } else if(!on && T.wl){ await T.wl.release(); T.wl=null } }catch(_){ T.wl=null } }
  wake(true)
  const onVis=()=>{ if(document.visibilityState==='visible' && !T.done) wake(true) }
  document.addEventListener('visibilitychange', onVis)
  const ahora=()=> T.pausa!=null ? T.pausa : Date.now()
  const restante=()=>{ const s=segs[T.i]; return s ? s.d - (ahora()-T.t0)/1000 : 0 }
  const exDe = s => exs.length ? exs[(s.ex||0)%exs.length] : null
  const quedaTotal=()=>{ let q=Math.max(0,restante()); for(let j=T.i+1;j<segs.length;j++) q+=segs[j].d; return q }
  function etiqueta(s){ return s.k==='prep'?'PREPÁRATE':s.k==='rest'?'DESCANSO':s.k==='pause'?'PAUSA':
    c.modo==='emom'?'MINUTO '+s.r:'TRABAJO' }
  function pintar(){
    const s=segs[T.i]; if(!s){ return fin() }
    el.dataset.k=s.k; el.classList.toggle('paused', T.pausa!=null)
    const rest=Math.max(0,restante()), shown = Math.ceil(rest-1e-6)
    const works=segs.filter(x=>x.k==='work'), doneW=segs.slice(0,T.i).filter(x=>x.k==='work').length
    const bar=works.map((w,j)=>{ const cur=w===s; const pct=cur?Math.min(100,(1-rest/w.d)*100):0
      return '<i class="'+(j<doneW?'on':'')+'">'+(cur?'<u style="width:'+pct+'%"></u>':'')+'</i>' }).join('')
    const exA = s.k==='work' ? exDe(s) : exDe({ex:(s.ex||0)}), exN = s.k==='work' && c.rondas>1 ? exDe({ex:(s.ex||0)+1}) : null
    let cuerpo=''
    if (exA){
      cuerpo='<div class="kt__ex">'+(exA.foto?'<img src="'+esc(exA.foto)+'" alt="" onerror="this.remove()">':'')+'<div style="min-width:0"><small>'+(s.k==='work'?'AHORA':'SIGUE')+'</small><b>'+esc(exA.nombre)+'</b>'+
        (exA.reps&&s.k==='work'?'<em>'+esc(exA.reps)+'</em>':'')+(exN&&exN!==exA?'<em>DESPUÉS · '+esc(exN.nombre)+'</em>':'')+'</div></div>'
    }
    const rd = s.k==='prep' ? '<span>EMPIEZA EN</span>' :
      (c.rondas>1&&s.r?'<span>RONDA <b>'+String(s.r).padStart(2,'0')+'</b>/'+String(c.rondas).padStart(2,'0')+'</span>':'')+
      (c.series>1&&s.s?'<span>SERIE <b>'+s.s+'</b>/'+c.series+'</span>':'')
    const ctl = ''
    el.innerHTML='<div class="kt__top"><button class="kt__x'+(T.cerrar?' arm':'')+'" data-a="x" aria-label="Salir del temporizador">'+(T.cerrar?'TOCA PARA SALIR':'✕')+'</button>'+
      '<div class="kt__md"><b>'+esc(opts.titulo||MODOS[c.modo].lab)+'</b>'+esc(resumen(c))+'</div></div>'+
      '<div class="kt__ph">'+etiqueta(s)+'</div><div class="kt__rd">'+rd+'</div>'+
      '<div class="kt__clk" id="ktClk">'+seg7(mmss(shown))+'</div>'+
      '<div class="kt__bar">'+bar+'</div>'+cuerpo+
      '<div class="kt__ft"><span>'+'TOTAL RESTANTE'+'</span><b id="ktRest">'+mmss(quedaTotal())+'</b></div>'+ctl+
      '<div class="kt__ctl"><button data-a="prev" aria-label="Intervalo anterior">◀ ATRÁS</button><button class="pri" data-a="pp">'+(T.pausa!=null?'▶ REANUDAR':'❚❚ PAUSA')+'</button><button data-a="next" aria-label="Saltar intervalo">SALTAR ▶</button></div>'+
      '<div class="kt__pz">EN PAUSA</div>'
    T.last=null }
  function irA(i){ T.i=Math.max(0,Math.min(segs.length,i)); T.t0=Date.now(); if(T.pausa!=null) T.pausa=T.t0; T.half=false; T._cd=null
    const s=segs[T.i]; if(!s){ fin(); return }
    if (s.k==='work') SND.go(); else if (s.k==='rest'||s.k==='pause') SND.rest()
    try{ if(navigator.vibrate) navigator.vibrate(s.k==='work'?[60,40,60]:40) }catch(_){}
    pintar() }
  function tick(){ if(T.done) return
    const s=segs[T.i]; if(!s) return fin()
    const r=restante()
    if (r<=0){ irA(T.i+1); return }
    const shown = Math.ceil(r-1e-6)
    if (T.pausa==null){
      const ent=Math.ceil(r-1e-6)
      if (ent<=3 && ent>=1 && T._cd!==ent){ T._cd=ent; SND.tick() }
      if (s.k==='work' && s.d>=60 && !T.half && r<=s.d/2){ T.half=true; SND.half() } }
    const k=document.getElementById('ktClk'), t=mmss(shown)
    if (k && k.dataset.t!==t){ k.dataset.t=t; k.innerHTML=seg7(t); k.classList.remove('tk'); void k.offsetWidth; k.classList.add('tk')
      const q=document.getElementById('ktRest'); if(q) q.textContent=mmss(quedaTotal())
      const u=el.querySelector('.kt__bar u'); if(u) u.style.width=Math.min(100,(1-Math.max(0,r)/s.d)*100)+'%' } }
  function fin(){ if(T.done) return; T.done=true; clearInterval(T.iv); SND.fin(); wake(false)
    try{ if(navigator.vibrate) navigator.vibrate([200,80,200,80,400]) }catch(_){}
    el.dataset.k='fin'; el.classList.remove('paused')
    const tot=total(c), st=[['TIEMPO', mmss(tot)], ['RONDAS', String(c.rondas*c.series)]]
    const res={ modo:c.modo, rondas:c.rondas*c.series, total:tot }
    el.innerHTML='<div class="kt__top"><span></span><div class="kt__md"><b>'+esc(opts.titulo||MODOS[c.modo].lab)+'</b>'+esc(resumen(c))+'</div></div>'+
      '<div class="kt__fin"><p>'+esc(MODOS[c.modo].lab)+' COMPLETADO</p><h2>Trabajo<br>hecho.</h2><div class="kt__stats">'+st.map(x=>'<div><small>'+x[0]+'</small><b>'+x[1]+'</b></div>').join('')+'</div></div>'+
      (opts.onFinish?'<button class="kt__big" data-a="reg">'+esc(opts.finLabel||'REGISTRAR BLOQUE')+'<small>'+esc(opts.finSub||'SE GUARDA CON LO PRESCRITO · PUEDES AJUSTAR DESPUÉS')+'</small></button>':'')+
      '<div class="kt__ctl" style="grid-template-columns:1fr 1fr"><button data-a="again">REPETIR</button><button data-a="cerrar">CERRAR</button></div>'
    T.res=res; if (opts.onEnd) try{ opts.onEnd(res) }catch(_){} }
  function close(silencio){ clearInterval(T.iv); T.done=true; wake(false); document.removeEventListener('visibilitychange', onVis)
    el.remove(); document.documentElement.style.overflow=''; if(ACT.cur===api) ACT.cur=null; if(!silencio && opts.onClose) opts.onClose(T.res||null) }
  el.addEventListener('click', e=>{ const b=e.target.closest('[data-a]'); if(!b) return; unlock(); const a=b.dataset.a, s=segs[T.i]
    if (a!=='x' && T.cerrar){ T.cerrar=false; clearTimeout(T._x) }
    if (a==='x'){ if(T.cerrar){ close(); return } T.cerrar=true; clearTimeout(T._x); T._x=setTimeout(()=>{ T.cerrar=false; if(!T.done) pintar() },2600); pintar(); return }
    if (a==='pp'){ if(T.pausa!=null){ T.t0+=Date.now()-T.pausa; T.pausa=null } else T.pausa=Date.now(); pintar(); return }
    if (a==='next'){ irA(T.i+1); return }
    if (a==='prev'){ const el2=(ahora()-T.t0)/1000; irA(el2>3||T.i===0?T.i:T.i-1); return }
    if (a==='reg'){ const r=T.res; close(true); opts.onFinish(r); return }
    if (a==='again'){ close(true); play(cfg, opts); return }
    if (a==='cerrar'){ close(); return } })
  const api={ close, el }
  ACT.cur=api
  T.iv=setInterval(tick, 200)
  if (segs[0] && segs[0].k==='prep'){ T.t0=Date.now(); pintar() } else irA(0)
  return api }

/* ══════════ EDITOR (planificador del coach) ══════════ */
function editor(cfg, opts){
  opts=opts||{}; css()
  let c=norm(cfg||PRESETS[0].c&&Object.assign({modo:'tabata'},PRESETS[0].c)), pre=cfg?null:'tab20'
  const ov=document.createElement('div'); ov.className='kte'; ov.setAttribute('role','dialog'); ov.setAttribute('aria-modal','true')
  document.body.appendChild(ov)
  const fmt = (k,v) => (k==='rondas'||k==='series') ? String(v) : (v>=60? mmss(v) : v+'″')
  const pasos = { trabajo:v=>v>=120?30:v>=60?15:5, descanso:v=>v>=60?15:5, pausa:v=>15, prep:v=>5, rondas:()=>1, series:()=>1 }
  const lim = { trabajo:[5,3600], descanso:[0,600], rondas:[1,99], series:[1,10], pausa:[0,600], prep:[0,60] }
  function pintar(){
    const usa = { trabajo:true, descanso:c.modo==='tabata', rondas:true, series:true, pausa:c.series>1, prep:true }
    const lab = { trabajo:c.modo==='emom'?'CADA':'TRABAJO', descanso:'DESCANSO', rondas:'RONDAS', series:'SERIES', pausa:'PAUSA ENTRE SERIES', prep:'CUENTA PREVIA' }
    const nEx=(opts.ejercicios||[]).length
    ov.innerHTML='<div class="kte__in"><h3>Bloque temporizador</h3><p class="kte__d">'+esc(opts.bloque||'')+(nEx?' · '+nEx+' ejercicio'+(nEx>1?'s':'')+' rotan por ronda':'')+'</p>'+
      '<div class="kte__k">FORMATO</div><div class="kte__md">'+Object.keys(MODOS).map(m=>'<button data-m="'+m+'" class="'+(c.modo===m?'on':'')+'">'+MODOS[m].lab+'</button>').join('')+'</div>'+
      '<p class="kte__d">'+MODOS[c.modo].d+'</p>'+
      '<div class="kte__k">PROPUESTAS</div><div class="kte__ps">'+PRESETS.filter(p=>p.modo===c.modo).map(p=>'<button data-p="'+p.id+'" class="'+(pre===p.id?'on':'')+'"><b>'+p.n+'</b><span>'+p.s+'</span></button>').join('')+'</div>'+
      '<div class="kte__k">AJUSTE FINO</div><div class="kte__g">'+['trabajo','descanso','rondas','series','pausa','prep'].map(k=>
        '<div class="kte__st'+(usa[k]?'':' off')+'"><small>'+lab[k]+'</small><div><button data-s="'+k+'" data-d="-1" aria-label="Menos '+lab[k]+'">−</button><b>'+fmt(k,c[k])+'</b><button data-s="'+k+'" data-d="1" aria-label="Más '+lab[k]+'">+</button></div></div>').join('')+'</div>'+
      '<div class="kte__tot"><div><small>DURACIÓN TOTAL</small><br><b>'+mmss(total(c))+'</b></div><div style="text-align:right"><small>RESUMEN</small><br><span style="font:700 11px var(--M)">'+esc(resumen(c))+'</span></div></div>'+
      '<div class="kte__btns"><button data-a="probar">▶ PROBAR</button>'+(opts.onRemove&&cfg?'<button class="dng" data-a="quitar">QUITAR TIMER</button>':'')+'</div>'+
      '<div class="kte__btns"><button data-a="cancelar">CANCELAR</button><button class="ink" data-a="ok">APLICAR AL BLOQUE</button></div></div>' }
  function cerrar(){ ov.remove() }
  ov.addEventListener('click', e=>{ if(e.target===ov){ cerrar(); return }
    const b=e.target.closest('button'); if(!b) return
    if (b.dataset.m){ const p=PRESETS.find(x=>x.modo===b.dataset.m); c=norm(Object.assign({modo:b.dataset.m, prep:c.prep}, p?p.c:{})); pre=p?p.id:null; pintar(); return }
    if (b.dataset.p){ const p=PRESETS.find(x=>x.id===b.dataset.p); c=norm(Object.assign({modo:p.modo, prep:c.prep}, p.c)); pre=p.id; pintar(); return }
    if (b.dataset.s){ const k=b.dataset.s, d=+b.dataset.d, st=pasos[k](d<0?c[k]-1:c[k]); c[k]=Math.max(lim[k][0],Math.min(lim[k][1],c[k]+d*st)); c=norm(c); pre=null; pintar(); return }
    const a=b.dataset.a
    if (a==='cancelar') cerrar()
    else if (a==='probar') play(c,{ ejercicios:opts.ejercicios, titulo:'PRUEBA · '+(opts.bloque||''), sonido:opts.sonido })
    else if (a==='quitar'){ cerrar(); opts.onRemove() }
    else if (a==='ok'){ cerrar(); if(opts.onSave) opts.onSave(norm(c)) } })
  pintar()
  return { close:cerrar } }

root.KTIMER = { MODOS, PRESETS, norm, timeline, total, resumen, mmss, play, editor, seg7, VERSION:'koach-timer@1.2.0' }
})(typeof window!=='undefined'?window:globalThis);
