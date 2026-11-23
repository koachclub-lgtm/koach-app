/* KOACH · RUN CLUB — challenge permanente del 1% CLUB.
   Registra la ruta de carrera con el GPS del teléfono (app abierta y pantalla encendida), la limpia con KRuta
   y la guarda en Supabase (club_run_guardar). Racha = semanas seguidas con ≥1 carrera válida; distancia acumulada.
   Se monta dentro de la vista 1% CLUB (KCLUB llama a KRUN.montar). */
(function () {
  'use strict'
  var R = { st: null, pts: [], watch: null, t0: null, tick: null, wl: null, ult: 0, guardadoAt: 0, res: null, acc: null, err: null }
  var LS = 'kr_run_v1'
  function $(id) { return document.getElementById(id) }
  function esc(t) { return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] }) }
  function cli() { try { return sb } catch (_) { return null } }
  function perfil() { try { return S && S.perfil } catch (_) { return null } }
  function snd(n, g) { try { kAudioUnlock(); window.KSFX && KSFX.play(n, 0, g == null ? .8 : g) } catch (_) {} }
  function aviso(m) { try { toast(m) } catch (_) { alert(m) } }
  function nombre() { return String((perfil() && perfil().nombre) || '').trim().split(/\s+/)[0].toUpperCase() }
  function reloj(s) { s = Math.max(0, Math.floor(s)); var h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), x = s % 60
    return (h ? h + ':' + String(m).padStart(2, '0') : String(m).padStart(2, '0')) + ':' + String(x).padStart(2, '0') }
  function ritmo(min) { if (min == null || !isFinite(min)) return '--:--'; var s = Math.round(min * 60); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0') }
  function km(n) { return (Math.round((n || 0) * 10) / 10).toLocaleString('es-CL', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) }
  var MES = ['ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO', 'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE']
  var LOGO = '<img class="krLogo" src="/img/brand/logotipo-koach.png" alt="KOACH">'
  var CHECK = '<svg viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="29" fill="none" stroke="#3EC6B0" stroke-width="3"/><path d="M19 33l9 9 17-19" fill="none" stroke="#3EC6B0" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg>'

  var css = `
.krCard{position:relative;margin:16px 0 4px;padding:18px 16px 16px;border-radius:16px;background:linear-gradient(180deg,#1C1E21 0%,#141518 100%);border:1px solid rgba(255,255,255,.12);overflow:hidden}
.krCard:before{content:'';position:absolute;inset:0;background:repeating-linear-gradient(90deg,rgba(255,255,255,.035) 0 1px,transparent 1px 22px);pointer-events:none}
.krHd{position:relative;display:flex;justify-content:space-between;font:700 9px/1 'Space Mono','Space Mono Fallback',monospace;letter-spacing:.18em;color:#979C9F}
.krHd span:first-child{color:#3EC6B0}
.krT{position:relative;margin:12px 0 0;font:900 44px/.9 'KOACH Display','KOACH Display Fallback',sans-serif;font-stretch:115%;letter-spacing:-.01em;color:#F2F2F2;transform:skewX(-8deg);transform-origin:left}
.krD{position:relative;margin:10px 0 0;font:600 13.5px/1.45 'KOACH Display',sans-serif;color:#D5D7D9;max-width:330px}
.krSt{position:relative;display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:14px}
.krSt div{border:1px solid rgba(255,255,255,.14);border-radius:10px;padding:10px 8px;background:rgba(0,0,0,.25)}
.krSt b{display:block;font:900 24px/1 'KOACH Display',sans-serif;color:#F2F2F2}
.krSt b small{font:700 10px/1 'Space Mono',monospace;color:#979C9F;margin-left:3px}
.krSt span{display:block;margin-top:6px;font:700 8px/1.3 'Space Mono',monospace;letter-spacing:.12em;color:#979C9F}
.krSem{position:relative;margin-top:12px;font:700 9px/1.5 'Space Mono',monospace;letter-spacing:.12em;color:#B9BCBF}
.krSem.ok{color:#3EC6B0}
.krTag{position:relative;margin:10px 0 0;font:700 9px/1.4 'Space Mono',monospace;letter-spacing:.14em;color:#3EC6B0}
.krNv{position:relative;display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:14px}
.krNv div{border:1px solid rgba(255,255,255,.14);border-radius:10px;padding:10px 8px;background:rgba(0,0,0,.25)}
.krNv b{display:block;font:900 14px/1 'KOACH Display',sans-serif;letter-spacing:.02em}
.krNv span{display:block;margin-top:7px;font:700 7.5px/1.5 'Space Mono',monospace;letter-spacing:.1em;color:#979C9F}
.krMk{display:flex;gap:4px;margin:7px 0 0}.krMk i{flex:1;height:4px;border-radius:2px;background:#434649}.krMk i.on{background:#3EC6B0}
.krCard .krSub{margin-top:10px}.krCard .krCam{margin-top:6px;height:36px}
.krIns{margin:-2px 0 10px;font:700 8.5px/1.4 'Space Mono',monospace;letter-spacing:.12em;color:#6F7377}
.krU{font:700 9px/1 'Space Mono',monospace;color:#979C9F;margin-left:3px}
.krOp{display:flex;flex-direction:column;gap:10px;width:100%;max-width:400px;margin-top:22px}
.krOp button{appearance:none;text-align:left;border:1px solid rgba(255,255,255,.2);border-radius:12px;background:rgba(255,255,255,.04);color:#F2F2F2;padding:16px;cursor:pointer;position:relative}
.krOp button.on{border-color:#3EC6B0;background:rgba(62,198,176,.08)}
.krOp b{display:block;font:900 22px/1 'KOACH Display',sans-serif;letter-spacing:.01em}
.krOp span{display:block;margin-top:6px;font:700 9.5px/1.3 'Space Mono',monospace;letter-spacing:.12em;color:#B9BCBF}
.krOp em{position:absolute;top:16px;right:16px;font:700 8px/1 'Space Mono',monospace;letter-spacing:.12em;color:#3EC6B0;font-style:normal}
.krCard .kcB{position:relative;margin-top:14px}
.krCard .kcRow{position:relative}
.krRk{position:relative;margin-top:16px}
.krRk .kcSec{margin:0 0 8px}
.krCard .kcRow.t1 .p{color:#F2F2F2}
.krO{position:fixed;inset:0;z-index:97;display:none;flex-direction:column;overflow:auto;color:#F2F2F2;background:linear-gradient(180deg,#0B0C0E 0%,#1A1C1F 60%,#26292D 100%);font-family:'KOACH Display','KOACH Display Fallback',system-ui,sans-serif}
.krO.on{display:flex}
.krIn{flex:1;display:flex;flex-direction:column;align-items:center;text-align:center;padding:calc(18px + env(safe-area-inset-top,0px)) 22px calc(22px + env(safe-area-inset-bottom,0px));box-sizing:border-box}
.krLogo{height:18px;width:auto;opacity:.95}
.krK{margin:22px 0 0;font:700 10px/1 'Space Mono',monospace;letter-spacing:.24em;color:#3EC6B0}
.krBig{margin:18px 0 0;font:900 clamp(96px,32vw,160px)/.85 'KOACH Display',sans-serif;letter-spacing:-.03em;font-variant-numeric:tabular-nums}
.krBig small{display:block;margin-top:10px;font:700 13px/1 'Space Mono',monospace;letter-spacing:.3em;color:#979C9F}
.krGr{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;width:100%;max-width:400px;margin-top:26px}
.krGr div{border:1px solid rgba(255,255,255,.14);border-radius:10px;padding:12px 6px;background:rgba(255,255,255,.04)}
.krGr b{display:block;font:900 24px/1 'KOACH Display',sans-serif;font-variant-numeric:tabular-nums}
.krGr span{display:block;margin-top:6px;font:700 8px/1 'Space Mono',monospace;letter-spacing:.14em;color:#979C9F}
.krGps{margin-top:16px;font:700 9px/1.6 'Space Mono',monospace;letter-spacing:.12em;color:#979C9F;text-transform:uppercase}
.krGps i{display:inline-block;width:8px;height:8px;border-radius:50%;background:#6F7377;margin-right:6px;vertical-align:0}
.krGps.ok i{background:#3EC6B0;box-shadow:0 0 8px #3EC6B0}.krGps.mal i{background:#FF4200}
.krTx{margin:14px 0 0;max-width:330px;font:700 10px/1.7 'Space Mono',monospace;letter-spacing:.08em;color:#B9BCBF;text-transform:uppercase}
.krH1{margin:18px 0 0;font:900 30px/1.02 'KOACH Display',sans-serif;font-stretch:115%;text-transform:uppercase}
.krFirma{margin:10px 0 0;font:600 16px/1.4 'KOACH Display',sans-serif;color:#D5D7D9}
.krChk{width:76px;height:76px;margin-top:26px}
.krChk svg{width:100%;height:100%}
@media (prefers-reduced-motion:no-preference){.krChk svg path{stroke-dasharray:40;stroke-dashoffset:40;animation:krDraw .5s ease-out .2s forwards}.krChk svg circle{transform-origin:32px 32px;animation:krPop .45s cubic-bezier(.2,1.4,.4,1)}}
@keyframes krDraw{to{stroke-dashoffset:0}}@keyframes krPop{from{transform:scale(.6)}to{transform:none}}
.krAct{width:100%;max-width:400px;margin-top:auto;padding-top:24px;display:flex;flex-direction:column;gap:10px}
.krO .kcB{appearance:none;border:0;border-radius:10px;height:54px;width:100%;font:700 13px/1 'Space Mono','Space Mono Fallback',monospace;letter-spacing:.16em;cursor:pointer}
.krO .kcB--p{background:#F2F2F2;color:#0B0C0E;box-shadow:0 0 0 1px #3EC6B0}
.krO .kcB--s{background:transparent;color:#F2F2F2;border:1px solid rgba(255,255,255,.28)}
.krO .kcB--f{background:transparent;color:#FF4200;border:1px solid #FF4200}
.krO .kcB--t{background:transparent;color:#979C9F;height:40px;font-size:11px}
/* ── sub-branding RUN CLUB: asfalto nocturno + pista + acento VOLT (solo decorativo; estados siguen en turquesa/#FF4200) ── */
.krCard,.krO,.bmCard.run{--rc:#FF4200;--ra:#FFB21A}
.krCard{background:linear-gradient(180deg,#17181A 0%,#0E0F11 100%)}
.krCard:before{display:none}
.krRoad{position:absolute;left:0;right:0;top:0;height:230px;overflow:hidden;pointer-events:none;-webkit-mask:linear-gradient(180deg,transparent 0%,#000 30%,#000 60%,transparent 100%);mask:linear-gradient(180deg,transparent 0%,#000 30%,#000 60%,transparent 100%)}
.krRoad i{position:absolute;left:-40%;right:-40%;bottom:0;height:100%;transform:perspective(260px) rotateX(58deg);transform-origin:50% 100%;opacity:.55;
  background:repeating-linear-gradient(90deg,transparent 0 58px,rgba(255,255,255,.14) 58px 60px)}
.krRoad i:after{content:'';position:absolute;left:calc(50% - 3px);top:0;bottom:0;width:6px;background:repeating-linear-gradient(180deg,var(--ra) 0 26px,transparent 26px 52px);opacity:.8;box-shadow:0 0 12px rgba(255,178,26,.45)}
@media (prefers-reduced-motion:no-preference){.krRoad i:after{animation:krLane .9s linear infinite}}
@keyframes krLane{to{background-position:0 52px}}
.krMini{--rc:#FF4200;--ra:#FFB21A;background:linear-gradient(180deg,#141517,#0C0D0F)}
.krMini .krRoad{height:100%;-webkit-mask:linear-gradient(270deg,#000 0%,transparent 75%);mask:linear-gradient(270deg,#000 0%,transparent 75%)}
.krMini .krRoad i{left:20%;right:-60%}
.krMiniT{margin-top:16px;font-size:40px;margin-left:14px}
.krCard .krT{margin-left:14px}
.krO .krRun{margin-left:14px}
.bmCard .krT,.krCard .krT,.krO .krRun{color:#F2F2F2;font-style:normal;text-shadow:-6px 0 0 rgba(255,178,26,.55),-12px 0 0 rgba(255,120,20,.35),-18px 0 0 rgba(255,66,0,.18)}
.krCard .krHd span:first-child,.krO .krK{color:var(--rc)}
.krCard .krTag{color:var(--rc)}
.krCard .krMk i.on{background:var(--rc)}
.krCard .kcRow.yo{border-color:var(--rc);background:rgba(255,66,0,.08)}
.krCard .kcRow.t2 .p,.krCard .kcRow.t3 .p{color:var(--rc)}
.krCard .kcB--p,.krO .kcB--p{background:var(--rc);color:#0B0C0E;box-shadow:0 0 24px rgba(255,66,0,.35)}
.krO .krRoad{height:46%;top:auto;bottom:0;-webkit-mask:linear-gradient(0deg,#000 20%,transparent 100%);mask:linear-gradient(0deg,#000 20%,transparent 100%)}
.krO .krIn{position:relative;z-index:1}
@media (prefers-reduced-motion:no-preference){
.krCard.krAnim .krT{animation:krDash .7s cubic-bezier(.15,.9,.25,1) both}
.krCard.krAnim .krRoad{animation:krFade 1s ease-out both}
.krO .krRun{animation:krDash .7s cubic-bezier(.15,.9,.25,1) both}}
/* corredor animado (original): silueta rojo anaranjado + estelas de velocidad */
.krRunr{display:block;width:100%;height:100%;overflow:visible}
.krRunr .cerca{fill:#FF3B12}.krRunr .lejos{fill:#C2300E}
.krRunr .gl{filter:drop-shadow(0 0 10px rgba(255,59,18,.75)) drop-shadow(0 0 28px rgba(255,66,0,.35))}
.krRunr g{transform-box:view-box}
.krRunr .st g{transform-box:fill-box;transform-origin:100% 50%}
.krRunr .cuerpo{transform-origin:100px 130px}
.krRunr .mi.a{transform:rotate(-38deg)}.krRunr .mi.b{transform:rotate(30deg)}.krRunr .rd.b{transform:rotate(95deg)}.krRunr .br.a{transform:rotate(40deg)}.krRunr .br.b{transform:rotate(-45deg)}
.krRunr .mi,.krRunr .rd,.krRunr .br{transform-origin:0 0}
@media (prefers-reduced-motion:no-preference){
.krRunr .cuerpo{animation:krBob .36s ease-in-out infinite}
.krRunr .mi.a{animation:krThigh .72s linear infinite}.krRunr .mi.b{animation:krThigh .72s linear -.36s infinite}
.krRunr .rd.a{animation:krShin .72s linear infinite}.krRunr .rd.b{animation:krShin .72s linear -.36s infinite}
.krRunr .br.a{animation:krArm .72s ease-in-out infinite}.krRunr .br.b{animation:krArm .72s ease-in-out -.36s infinite}
.krRunr .st g{animation:krStreak .72s linear infinite}}
@keyframes krBob{0%,50%,100%{transform:translateY(0)}25%,75%{transform:translateY(-5px)}}
@keyframes krThigh{0%{transform:rotate(-38deg)}15%{transform:rotate(-24deg)}40%{transform:rotate(24deg)}50%{transform:rotate(32deg)}65%{transform:rotate(4deg)}82%{transform:rotate(-48deg)}100%{transform:rotate(-38deg)}}
@keyframes krShin{0%{transform:rotate(8deg)}15%{transform:rotate(20deg)}40%{transform:rotate(24deg)}55%{transform:rotate(78deg)}70%{transform:rotate(118deg)}82%{transform:rotate(84deg)}92%{transform:rotate(32deg)}100%{transform:rotate(8deg)}}
@keyframes krArm{0%{transform:rotate(42deg)}50%{transform:rotate(-48deg)}100%{transform:rotate(42deg)}}
@keyframes krStreak{0%{transform:translateX(18px) scaleX(.25);opacity:0}25%{opacity:1}100%{transform:translateX(-46px) scaleX(1);opacity:0}}
.krFig{width:min(64vw,250px);aspect-ratio:200/270;margin:18px auto 0}
.krFigL{width:min(40vw,150px);aspect-ratio:200/270;margin:12px auto 0;opacity:.9}
.krMini .krFigM{position:absolute;right:12px;top:24px;width:76px;height:103px}
.bmCard.run .bmDat{max-width:calc(100% - 100px)}
.bmDet .krCard .krFigD{position:relative;z-index:1;display:block;width:150px;height:203px;margin:-6px auto 8px;pointer-events:none}
.bmDet .krCard>*:not(.krFigD):not(.krRoad){position:relative;z-index:1}
@keyframes krDash{0%{opacity:0;transform:translateX(-70px) skewX(-8deg);filter:blur(6px)}70%{opacity:1;filter:blur(0)}100%{opacity:1;transform:skewX(-8deg)}}
@keyframes krFade{from{opacity:0}to{opacity:1}}
`
  // corredor: piernas/brazos articulados (cadera 100,128 · rodilla 100,178 · hombro 107,78 · codo 107,108)
  // corredor (silueta original): segmentos anatómicos articulados — cadera (100,128), hombro (108,78)
  function corredor(cls) {
    var st = ''
    for (var i = 0; i < 22; i++) {
      var y = 40 + i * 9, fin = 90 + Math.round(Math.sin(i * 0.9) * 6) - (i > 15 ? (i - 15) * 3 : 0), w = 44 + (i * 11) % 30, d = -((i * 0.173) % 0.72).toFixed(3)
      st += '<g style="animation-delay:' + d + 's"><rect x="' + (fin - w) + '" y="' + y + '" width="' + w + '" height="2.2" rx="1.1" fill="url(#krSg)"/><rect x="' + (fin - 16) + '" y="' + (y - 1.6) + '" width="16" height="5.4" rx="2.7" fill="#FF8A1F"/></g>'
    }
    var MUSLO = '<path d="M-14,-6 C-17,14 -12,36 -9,52 L8,52 C13,38 18,16 14,-8 C6,-13 -6,-12 -14,-6Z"/><circle cx="0" cy="52" r="9"/>'
    var PANT = '<path d="M-9,0 C-15,12 -12,30 -5,47 L4,47 C6,30 7,14 9,0Z"/>'
    var ZAP = '<path d="M-6,43 C-9,51 -6,57 2,57 L21,57 C27,57 27,50 21,47 L8,43Z"/>'
    var BRAZO = '<path d="M-8,-3 C-10,10 -7,24 -5,31 L5,31 C7,22 9,9 8,-4 C3,-7 -3,-7 -8,-3Z"/><circle cx="0" cy="31" r="5.6"/>'
    var ANTE = '<path d="M-5,0 C-5,9 -4,19 -3,25 L3,25 C4,17 5,8 5,0Z"/><ellipse cx="0" cy="28" rx="5.4" ry="6"/>'
    var pierna = function (k) { return '<g transform="translate(100 128)"><g class="mi ' + k + '">' + MUSLO + '<g transform="translate(0 52)"><g class="rd ' + k + '">' + PANT + ZAP + '</g></g></g></g>' }
    var brazo = function (k) { return '<g transform="translate(108 80)"><g class="br ' + k + '">' + BRAZO + '<g transform="translate(0 31) rotate(-100)">' + ANTE + '</g></g></g>' }
    return '<svg class="krRunr ' + (cls || '') + '" viewBox="0 0 200 270" aria-hidden="true"><defs><linearGradient id="krSg" x1="0" x2="1"><stop offset="0" stop-color="#FFE14D" stop-opacity="0"/><stop offset=".55" stop-color="#FFD23F"/><stop offset="1" stop-color="#FFB21A"/></linearGradient></defs>' +
      '<g class="st">' + st + '</g><g class="cuerpo gl"><g class="lejos">' + pierna('b') + brazo('b') + '</g><g class="cerca">' +
      '<path d="M90,134 C86,114 88,94 95,78 C99,69 113,66 120,73 C127,82 126,97 118,111 C114,119 114,127 113,135 C106,140 96,140 90,134Z"/>' +
      '<path d="M109,72 L111,60 L119,61 L118,73Z"/><path d="M104,47 C104,36 113,31 121,34 C129,37 132,46 130,54 C129,58 131,60 129,62 C126,65 120,66 115,64 C108,62 104,56 104,47Z"/>' +
      pierna('a') + brazo('a') + '</g></g></svg>'
  }
  function estilos() { if ($('krCss')) return; var s = document.createElement('style'); s.id = 'krCss'; s.textContent = css; document.head.appendChild(s) }

  async function rpc(n, a) { var r = await cli().rpc(n, a || {}); if (r.error) throw r.error; return r.data }
  async function cargar() { try { R.st = await rpc('club_run_estado') } catch (e) { console.error('club_run_estado', e) } return R.st }

  /* ── niveles: mismo score para todos (semanas seguidas cumpliendo el compromiso) ── */
  var NIV = { basico: { t: 'BÁSICO', f: 1, km: 1 }, intermedio: { t: 'INTERMEDIO', f: 2, km: 3 }, avanzado: { t: 'AVANZADO', f: 3, km: 7 } }
  var ORDEN = ['basico', 'intermedio', 'avanzado']
  function vez(f) { return f === 1 ? '1 VEZ POR SEMANA' : f + ' VECES POR SEMANA' }
  function sig(n) { return ORDEN[ORDEN.indexOf(n) + 1] }

  /* ── tarjeta dentro de la vista 1% CLUB ── */
  function cardHTML() {
    var s = R.st || {}, racha = s.racha_semanas || 0, nv = NIV[s.nivel], ins = s.inscritos || {}
    var tot = (ins.basico || 0) + (ins.intermedio || 0) + (ins.avanzado || 0)
    var h = '<div class="krRoad" aria-hidden="true"><i></i></div><div class="krFigD">' + corredor() + '</div>' + '<div class="krHd"><span>CHALLENGE PERMANENTE</span><span>' + tot + (tot === 1 ? ' INSCRITO' : ' INSCRITOS') + '</span></div><h2 class="krT">RUN CLUB</h2>'
    if (!nv) {
      h += '<p class="krD">Elige tu compromiso semanal y corre con la app abierta: registramos tu ruta y tu distancia. Cada semana cumplida suma a tu racha.</p>' +
        '<div class="krNv">' + ORDEN.map(function (k) { var n = NIV[k]; return '<div><b>' + n.t + '</b><span>' + vez(n.f) + '<br>DESDE ' + n.km + ' KM</span></div>' }).join('') + '</div>' +
        '<button class="kcB kcB--p" type="button" onclick="KRUN.niveles()">ELEGIR MI COMPROMISO</button>'
    } else {
      var hechas = Math.min(s.hechas || 0, nv.f), ok = (s.hechas || 0) >= nv.f
      var marcas = ''; for (var i = 0; i < nv.f; i++) marcas += '<i class="' + (i < hechas ? 'on' : '') + '"></i>'
      h += '<p class="krTag">' + nv.t + ' · ' + vez(nv.f) + ' · DESDE ' + nv.km + ' KM</p>' +
        '<div class="krSt"><div><b>' + racha + '<small>SEM</small></b><span>RACHA</span></div><div><b>' + hechas + '/' + nv.f + '</b><span>ESTA SEMANA</span><p class="krMk">' + marcas + '</p></div><div><b>' + km(s.km_total) + '<small>KM</small></b><span>DISTANCIA TOTAL</span></div></div>' +
        (ok ? '<p class="krSem ok">✓ COMPROMISO DE ESTA SEMANA CUMPLIDO</p>'
          : '<p class="krSem">' + (nv.f - hechas === 1 ? 'TE FALTA 1 CARRERA' : 'TE FALTAN ' + (nv.f - hechas) + ' CARRERAS') + ' DE ' + nv.km + ' KM O MÁS ESTA SEMANA' + (racha ? ' PARA LLEVAR TU RACHA A ' + (racha + 1) : '') + '</p>') +
        '<button class="kcB kcB--p" type="button" onclick="KRUN.abrir()">INICIAR CARRERA</button>' +
        (s.puede_subir && sig(s.nivel) ? '<button class="kcB kcB--s krSub" type="button" onclick="KRUN._nivel(\'' + sig(s.nivel) + '\')">SUBIR A ' + NIV[sig(s.nivel)].t + '</button>' : '') +
        '<button class="kcB kcB--t krCam" type="button" onclick="KRUN.niveles()">CAMBIAR NIVEL</button>'
    }
    var rk = s.ranking || [], top = rk.slice(0, 5), yo = rk.filter(function (x) { return x.yo && x.pos > 5 })[0]
    var filas = top.concat(yo ? [yo] : []).map(function (x) {
      return '<div class="kcRow' + (x.yo ? ' yo' : '') + (x.pos <= 3 ? ' t' + x.pos : '') + '"><span class="p">' + String(x.pos).padStart(2, '0') + '</span>' + av(x.avatar, x.nombre) +
        '<span class="n">' + esc(x.nombre) + '<small>' + (NIV[x.nivel] ? NIV[x.nivel].t : '') + ' · ' + km(x.km) + ' KM</small></span><span class="s">' + x.racha + '<small class="krU">SEM</small></span></div>' }).join('')
    h += '<div class="krRk"><div class="kcSec"><span>RANKING · RACHA</span><span>SEMANAS CUMPLIDAS</span></div><p class="krIns">' + ORDEN.map(function (k) { return (ins[k] || 0) + ' ' + NIV[k].t }).join(' · ') + '</p>' +
      (filas || '<div class="kcVac">TODAVÍA NADIE SE INSCRIBE. EL PRIMER COMPROMISO PUEDE SER EL TUYO.</div>') + '</div>'
    return h
  }
  function miniHTML(n) {
    estilos(); var s = R.st || {}, nv = NIV[s.nivel], ins = s.inscritos || {}
    var tot = (ins.basico || 0) + (ins.intermedio || 0) + (ins.avanzado || 0)
    return '<div class="bmArt krMini" aria-hidden="true"><div class="krRoad"><i></i></div><div class="krFigM">' + corredor() + '</div></div><div class="bmIn">' +
      '<div class="bmMeta"><span><b>' + String(n).padStart(2, '0') + '</b> · PERMANENTE</span><span>' + (nv ? nv.t : tot + (tot === 1 ? ' INSCRITO' : ' INSCRITOS')) + '</span></div>' +
      '<p class="krT krMiniT">RUN CLUB</p>' +
      '<div class="bmDat">' + (nv ? '<div>' + (s.racha_semanas || 0) + '<span>SEM DE RACHA</span></div><div>' + Math.min(s.hechas || 0, nv.f) + '/' + nv.f + '<span>ESTA SEMANA</span></div>'
        : '<div>' + tot + '<span>INSCRITOS</span></div>') + '<div>' + km(s.km_total) + '<span>KM</span></div></div></div>'
  }
  function niveles() {
    var s = R.st || {}
    pintar('<p class="krK">RUN CLUB · TU COMPROMISO</p><h2 class="krH1">¿Cuántas veces por semana vas a correr?</h2>' +
      '<p class="krTx">TODOS LOS NIVELES SUMAN IGUAL: CADA SEMANA CUMPLIDA ES +1 A TU RACHA. LAS CARRERAS MÁS CORTAS QUE EL MÍNIMO SUMAN KM, PERO NO CUENTAN PARA EL COMPROMISO.</p>' +
      '<div class="krOp">' + ORDEN.map(function (k) { var n = NIV[k], act = s.nivel === k
        return '<button type="button" class="' + (act ? 'on' : '') + '" onclick="KRUN._nivel(\'' + k + '\')"><b>' + n.t + '</b><span>' + vez(n.f) + '</span><span>CADA CARRERA DESDE ' + n.km + ' KM</span>' + (act ? '<em>TU NIVEL ACTUAL</em>' : '') + '</button>' }).join('') + '</div>',
      '<button class="kcB kcB--t" type="button" onclick="KRUN.cerrar()">AHORA NO</button>')
  }
  async function elegirNivel(k) {
    var s = R.st || {}
    if (s.nivel === k) { cerrar(); repintar(); return }
    if (s.nivel && !confirm('¿Cambiar tu compromiso a ' + NIV[k].t + '? Desde esta semana se mide con el nuevo nivel.')) return
    try { R.st = await rpc('club_run_inscribir', { p_nivel: k }); snd('logro', .7); try { KCLUB._confeti && KCLUB._confeti() } catch (_) {} aviso('Compromiso ' + NIV[k].t + ': ' + vez(NIV[k].f).toLowerCase() + '.') }
    catch (e) { aviso(e.message || 'No se pudo guardar el nivel.'); return }
    cerrar(); repintar()
  }
  function av(path, n) { try { if (window.KAvatar) return KAvatar.html(path, n, 'kcAv') } catch (_) {} return '<span class="kcAv">' + esc(String(n || 'K')[0]) + '</span>' }
  function montar(v) {
    estilos(); if (!v) return
    var c = v.querySelector('#krCard'); if (!c) { c = document.createElement('section'); c.id = 'krCard'; c.className = 'krCard' }
    var body = v.querySelector('.kcBody')
    if (body) { // después del ranking del challenge activo y antes del feed EN VIVO
      var secs = [].filter.call(body.children, function (x) { return x.classList.contains('kcSec') }), ref = secs[1] || null
      if (c.parentNode !== body || c.nextSibling !== ref) body.insertBefore(c, ref) } else { var w = document.createElement('div'); w.className = 'kcBody'; w.appendChild(c); v.appendChild(w) }
    var h = cardHTML(); if (c._h !== h) { c.innerHTML = h; c._h = h }
    if (!R.anim) { R.anim = true; c.classList.add('krAnim') }
    if (!R.st && !R.cargando) { R.cargando = true; cargar().then(function () { R.cargando = false; if (R.st) montar(v) }) }
  }
  function repintar() { var v = $('vClub'); if (v && v.classList.contains('on')) montar(v) }

  /* ── grabador ── */
  function el() { estilos(); var o = $('krO'); if (!o) { o = document.createElement('div'); o.id = 'krO'; o.className = 'krO'; o.setAttribute('role', 'dialog'); o.setAttribute('aria-modal', 'true'); document.body.appendChild(o) } return o }
  function pintar(cuerpo, acciones) { var o = el(); o.innerHTML = '<div class="krRoad" aria-hidden="true"><i></i></div>' + '<div class="krIn">' + LOGO + cuerpo + '<div class="krAct">' + acciones + '</div></div>'; o.classList.add('on') }
  function cerrar() { var o = $('krO'); if (o) o.classList.remove('on') }
  async function wake(on) { try { if (on && navigator.wakeLock) R.wl = await navigator.wakeLock.request('screen'); else if (!on && R.wl) { R.wl.release(); R.wl = null } } catch (_) {} }
  document.addEventListener('visibilitychange', function () { if (!document.hidden && R.watch != null) wake(true) })

  function pendiente() { try { var x = JSON.parse(localStorage.getItem(LS) || 'null'); if (x && x.t0 && Date.now() - x.t0 < 6 * 3600e3 && Array.isArray(x.p)) return x } catch (_) {} return null }
  function persistir(force) { if (!force && Date.now() - R.guardadoAt < 10000) return; R.guardadoAt = Date.now()
    try { localStorage.setItem(LS, JSON.stringify({ t0: R.t0, p: R.pts.map(function (p) { return [+p.lat.toFixed(6), +p.lng.toFixed(6), p.t, Math.round(p.acc || 0)] }) })) } catch (_) {} }
  function limpiarLS() { try { localStorage.removeItem(LS) } catch (_) {} }

  function abrir() {
    if (R.watch != null) { pintarVivo(); return }
    if (R.st && !R.st.inscrito && !pendiente()) { niveles(); return }
    var p = pendiente()
    if (p) {
      pintar('<p class="krK">RUN CLUB</p><h2 class="krH1">Tienes una carrera sin terminar</h2><p class="krTx">EMPEZÓ HACE ' + reloj((Date.now() - p.t0) / 1000) + '. PUEDES RETOMARLA O DESCARTARLA.</p>',
        '<button class="kcB kcB--p" type="button" onclick="KRUN._retomar()">RETOMAR CARRERA</button><button class="kcB kcB--s" type="button" onclick="KRUN._terminarPend()">TERMINAR Y REVISAR</button><button class="kcB kcB--t" type="button" onclick="KRUN._descartar()">DESCARTAR</button>')
      return
    }
    if (!('geolocation' in navigator)) { aviso('Este teléfono no permite usar el GPS desde el navegador.'); return }
    pintar('<p class="krK">1% CLUB · CHALLENGE</p><h2 class="krH1 krRun" style="font-size:52px;transform:skewX(-8deg)">RUN CLUB</h2>' +
      '<div class="krFig">' + corredor() + '</div><p class="krFirma">Registramos tu ruta con el GPS y guardamos la distancia.</p>' +
      '<p class="krTx">MANTÉN LA APP ABIERTA Y LA PANTALLA ENCENDIDA MIENTRAS CORRES. CUENTA DESDE 300 M Y 3 MINUTOS.</p>',
      '<button class="kcB kcB--p" type="button" onclick="KRUN._iniciar()">INICIAR CARRERA</button><button class="kcB kcB--t" type="button" onclick="KRUN.cerrar()">AHORA NO</button>')
  }
  function iniciar(retomar) {
    var p = retomar ? pendiente() : null
    R.pts = p ? p.p.map(function (a) { return { lat: a[0], lng: a[1], t: a[2], acc: a[3] } }) : []
    R.t0 = p ? p.t0 : Date.now(); R.acc = null; R.err = null; R.ult = 0; R.res = null
    try { R.watch = navigator.geolocation.watchPosition(punto, errorGps, { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 }) }
    catch (e) { aviso('No se pudo iniciar el GPS.'); return }
    wake(true); snd('go'); try { navigator.vibrate && navigator.vibrate(60) } catch (_) {}
    persistir(true); pintarVivo()
    clearInterval(R.tick); R.tick = setInterval(actualizar, 1000)
  }
  function punto(pos) {
    var c = pos.coords, t = pos.timestamp || Date.now(); R.acc = c.accuracy; R.err = null
    var u = R.pts[R.pts.length - 1]; if (u && t - u.t < 1000) return
    R.pts.push({ lat: c.latitude, lng: c.longitude, t: t, acc: c.accuracy })
    persistir(false)
  }
  function errorGps(e) {
    R.err = e && e.code === 1 ? 'PERMISO' : 'SEÑAL'
    if (R.err === 'PERMISO') { parar(); pintar('<p class="krK">RUN CLUB</p><h2 class="krH1">Activa la ubicación</h2><p class="krTx">PERMITE EL ACCESO A LA UBICACIÓN PARA KOACH EN TU NAVEGADOR Y VUELVE A INTENTARLO.</p>',
      '<button class="kcB kcB--p" type="button" onclick="KRUN.abrir()">REINTENTAR</button><button class="kcB kcB--t" type="button" onclick="KRUN.cerrar()">CERRAR</button>') }
    actualizar()
  }
  function parar() { if (R.watch != null) try { navigator.geolocation.clearWatch(R.watch) } catch (_) {} R.watch = null; clearInterval(R.tick); R.tick = null; wake(false) }

  function pintarVivo() {
    pintar('<p class="krK">RUN CLUB · EN CURSO</p><div class="krBig"><span id="krKm">0,00</span><small>KILÓMETROS</small></div>' +
      '<div class="krGr"><div><b id="krTi">00:00</b><span>TIEMPO</span></div><div><b id="krRi">--:--</b><span>RITMO /KM</span></div><div><b id="krPu">0</b><span>PUNTOS GPS</span></div></div>' +
      '<p class="krGps" id="krGps"><i></i>BUSCANDO SEÑAL GPS…</p><div class="krFigL">' + corredor() + '</div><p class="krTx">MANTÉN LA APP ABIERTA Y LA PANTALLA ENCENDIDA.</p>',
      '<button class="kcB kcB--p" type="button" onclick="KRUN._terminar()">TERMINAR CARRERA</button><button class="kcB kcB--t" type="button" onclick="KRUN._cancelar()">CANCELAR</button>')
    actualizar()
  }
  function actualizar() {
    var r = window.KRuta ? KRuta.resumen(R.pts) : null
    var ti = $('krTi'); if (!ti) return
    ti.textContent = reloj((Date.now() - R.t0) / 1000)
    if (r) { $('krKm').textContent = (r.distancia_m / 1000).toFixed(2).replace('.', ','); $('krRi').textContent = ritmo(r.ritmo_min_km); $('krPu').textContent = r.puntos }
    var g = $('krGps'), a = R.acc
    if (g) {
      if (R.err) { g.className = 'krGps mal'; g.innerHTML = '<i></i>SIN SEÑAL GPS · SAL A CIELO ABIERTO' }
      else if (a == null) { g.className = 'krGps'; g.innerHTML = '<i></i>BUSCANDO SEÑAL GPS…' }
      else if (a <= 35) { g.className = 'krGps ok'; g.innerHTML = '<i></i>GPS ACTIVO · ±' + Math.round(a) + ' M' }
      else { g.className = 'krGps mal'; g.innerHTML = '<i></i>SEÑAL DÉBIL · ±' + Math.round(a) + ' M' }
    }
  }

  function terminar() {
    parar(); persistir(true)
    var r = R.res = window.KRuta.resumen(R.pts)
    var dur = Math.round((Date.now() - R.t0) / 1000)
    R.dur = Math.max(dur, r.duracion_s)
    var dato = '<div class="krBig">' + (r.distancia_m / 1000).toFixed(2).replace('.', ',') + '<small>KILÓMETROS</small></div>' +
      '<div class="krGr"><div><b>' + reloj(R.dur) + '</b><span>TIEMPO</span></div><div><b>' + ritmo(r.ritmo_min_km) + '</b><span>RITMO /KM</span></div><div><b>' + reloj(r.movimiento_s) + '</b><span>EN MOVIMIENTO</span></div></div>'
    if (!r.valida) {
      var falta = r.motivo === 'DISTANCIA_CORTA' ? 'LA CARRERA CUENTA DESDE 300 M.' : 'LA CARRERA CUENTA DESDE 3 MINUTOS.'
      pintar('<p class="krK">RUN CLUB</p><h2 class="krH1">Todavía no cuenta</h2>' + dato + '<p class="krTx">' + falta + (r.puntos < 3 ? ' EL GPS CASI NO REGISTRÓ PUNTOS: REVISA LA UBICACIÓN Y CORRE A CIELO ABIERTO.' : '') + '</p>',
        '<button class="kcB kcB--p" type="button" onclick="KRUN._retomar()">SEGUIR CORRIENDO</button><button class="kcB kcB--t" type="button" onclick="KRUN._descartar()">DESCARTAR</button>')
      return
    }
    snd('block', .7)
    pintar('<p class="krK">RUN CLUB · CARRERA TERMINADA</p>' + dato + '<p class="krTx">REVISA TU CARRERA Y GUÁRDALA PARA SUMAR A TU RACHA Y A TU DISTANCIA.</p>',
      '<button class="kcB kcB--p" type="button" id="krGuardar" onclick="KRUN._guardar()">✓ GUARDAR CARRERA</button><button class="kcB kcB--t" type="button" onclick="KRUN._descartar()">DESCARTAR</button>')
  }
  async function guardar() {
    var r = R.res, b = $('krGuardar'); if (!r) return; if (b) b.disabled = true
    var pts = R.pts, ini = new Date(Math.min(R.t0, pts.length ? pts[0].t : R.t0)), fin = new Date(Math.max(Date.now(), ini.getTime() + 1000))
    try {
      var s = await rpc('club_run_guardar', { p_inicio: ini.toISOString(), p_fin: fin.toISOString(), p_distancia_m: r.distancia_m, p_duracion_s: R.dur || r.duracion_s,
        p_movimiento_s: r.movimiento_s, p_ruta: r.ruta, p_motor: r.version })
      limpiarLS(); R.st = s; repintar()
      var g = s.guardada || {}
      if (!g.valida) {
        pintar('<p class="krK">RUN CLUB</p><h2 class="krH1">Carrera guardada</h2><p class="krTx">NO SUMA A LA RACHA: EL RITMO REGISTRADO NO CORRESPONDE A UNA CARRERA A PIE.</p>', '<button class="kcB kcB--p" type="button" onclick="KRUN.cerrar()">VOLVER AL CLUB</button>')
        return
      }
      snd('logro'); try { KCLUB._confeti && KCLUB._confeti() } catch (_) {} try { navigator.vibrate && navigator.vibrate([120, 60, 120]) } catch (_) {}
      var n = nombre(), nv = NIV[s.nivel], nota = ''
      if (nv && r.distancia_m < nv.km * 1000) nota = '<p class="krTx">ESTA CARRERA SUMA KM. PARA TU COMPROMISO ' + nv.t + ' CADA CARRERA CUENTA DESDE ' + nv.km + ' KM.</p>'
      else if (nv && (s.hechas || 0) >= nv.f) nota = '<p class="krSem ok" style="margin-top:16px">✓ COMPROMISO DE ESTA SEMANA CUMPLIDO</p>'
      pintar('<div class="krChk">' + CHECK + '</div><p class="krK">RUN CLUB · ' + (r.distancia_m / 1000).toFixed(2).replace('.', ',') + ' KM</p>' +
        '<h2 class="krH1">Felicitaciones' + (n ? ', ' + esc(n) : '') + '.</h2><p class="krFirma">Ya eres 1% más fuerte que ayer.</p>' +
        '<div class="krGr"><div><b>' + (s.racha_semanas || 0) + '</b><span>' + ((s.racha_semanas || 0) === 1 ? 'SEMANA' : 'SEMANAS') + ' DE RACHA</span></div>' +
        (nv ? '<div><b>' + Math.min(s.hechas || 0, nv.f) + '/' + nv.f + '</b><span>ESTA SEMANA</span></div>' : '<div><b>' + (s.carreras || 0) + '</b><span>CARRERAS</span></div>') +
        '<div><b>' + km(s.km_total) + '</b><span>KM TOTALES</span></div></div>' + nota,
        '<button class="kcB kcB--p" type="button" onclick="KRUN.cerrar()">VOLVER AL CLUB</button>')
    } catch (e) {
      console.error(e); if (b) b.disabled = false
      aviso('No se pudo guardar. Tu carrera sigue en el teléfono: vuelve a intentarlo con conexión.')
    }
  }
  function descartar() { if (!confirm('¿Descartar esta carrera? No se guarda.')) return; parar(); limpiarLS(); R.pts = []; R.res = null; cerrar() }
  function cancelar() { if (!confirm('¿Cancelar la carrera? Se pierde el recorrido.')) return; parar(); limpiarLS(); R.pts = []; cerrar() }
  function terminarPend() { var p = pendiente(); if (!p) { abrir(); return } R.t0 = p.t0; R.pts = p.p.map(function (a) { return { lat: a[0], lng: a[1], t: a[2], acc: a[3] } }); terminar() }

  window.KRUN = { montar: montar, miniHTML: miniHTML, cargar: cargar, abrir: abrir, niveles: niveles, _nivel: elegirNivel, cerrar: function () { cerrar(); repintar() },
    _iniciar: function () { iniciar(false) }, _retomar: function () { iniciar(true) }, _terminar: function () { if (confirm('¿Terminar la carrera?')) terminar() },
    _cancelar: cancelar, _descartar: descartar, _guardar: guardar, _terminarPend: terminarPend, _estado: function () { return R } }
})()
