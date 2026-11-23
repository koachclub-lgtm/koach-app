/* ═══ 1% CLUB · comunidad y challenges (c300) ═══
   Pestaña "1% CLUB" en la barra inferior + challenge temático (primer caso: GTA CHALLENGE · burpees 3:00).
   - Pantalla especial al tocar START de la sesión mientras el challenge está abierto (una vez al día si se omite).
   - Unirse al club → temporizador 3:00 (reloj de siete segmentos) → registrar marca → koach valida en el Dashboard.
   - Ranking (todos / mujeres / hombres) + feed automático con reacciones predeterminadas.
   - Historia 9:16 para compartir, generada en el teléfono (sin IA, sin costo).
   Datos: RPC club_* (Supabase). Sin realtime: el feed se actualiza cada 25 s solo mientras la pestaña está abierta. */
(function () {
  'use strict'
  var K = { st: null, ch: null, rank: [], feed: [], filtro: 'todos', poll: null, run: null, desde: null, cargando: false }
  var MEDIA = { gta: { v: 'https://siecbdatfgmqbpxqtvsl.supabase.co/storage/v1/object/public/club-media/gta-burpee.mp4', p: 'https://siecbdatfgmqbpxqtvsl.supabase.co/storage/v1/object/public/club-media/gta-burpee.png' } }
  function clip(ch, cls) { var m = MEDIA[ch && ch.tema]; if (!m) return ''
    return '<div class="kcClip ' + (cls || '') + '"><video src="' + m.v + '" autoplay muted loop playsinline preload="auto" disablepictureinpicture aria-hidden="true"></video></div>' }
  var REAC = [['implacable', 'IMPLACABLE'], ['subid', 'SUBID JUNTOS'], ['fuego', '1% MEJOR CADA DÍA']]
  function $(id) { return document.getElementById(id) }
  function esc(t) { return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] }) }
  function perfil() { try { return S && S.perfil } catch (_) { return null } }
  function cli() { try { return sb } catch (_) { return null } }
  function snd(n, g) { try { kAudioUnlock(); window.KSFX && KSFX.play(n, 0, g == null ? .8 : g) } catch (_) {} }
  function aviso(m) { try { toast(m) } catch (_) { alert(m) } }
  function hoy() { var d = new Date(); return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate() }
  function seg(t) { try { return bkSeg(t) } catch (_) { return esc(t) } }
  function mmss(s) { s = Math.max(0, Math.ceil(s)); return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0') }

  /* ── estilos (tema gta: grafito + neón turquesa de la marca + magenta solo de esta edición) ── */
  var css = `
.kcG,.kcR{position:fixed;inset:0;z-index:95;display:none;flex-direction:column;overflow:auto;color:#F2F2F2;
  background:linear-gradient(180deg,#0B0C0E 0%,#17191C 46%,#26292D 100%);font-family:'KOACH Display','KOACH Display Fallback',system-ui,sans-serif}
.kcG.on,.kcR.on{display:flex}
.kcBg{position:absolute;inset:0;overflow:hidden;pointer-events:none}
.kcSun{position:absolute;left:50%;top:30%;width:min(78vw,380px);aspect-ratio:1;transform:translate(-50%,-50%);border-radius:50%;
  background:repeating-linear-gradient(180deg,rgba(255,61,154,.55) 0 7px,transparent 7px 13px);
  -webkit-mask:linear-gradient(180deg,#000 0%,#000 55%,transparent 82%);mask:linear-gradient(180deg,#000 0%,#000 55%,transparent 82%);
  box-shadow:0 0 90px rgba(255,61,154,.18)}
.kcGrid{position:absolute;left:-50%;right:-50%;bottom:-6%;height:46%;transform:perspective(320px) rotateX(62deg);transform-origin:50% 100%;
  background-image:linear-gradient(rgba(62,198,176,.55) 1px,transparent 1px),linear-gradient(90deg,rgba(62,198,176,.55) 1px,transparent 1px);
  background-size:44px 44px;-webkit-mask:linear-gradient(0deg,#000 30%,transparent 100%);mask:linear-gradient(0deg,#000 30%,transparent 100%)}
@media (prefers-reduced-motion:no-preference){.kcGrid{animation:kcRoad 1.6s linear infinite}}
@keyframes kcRoad{to{background-position:0 44px,0 0}}
.kcIn{position:relative;z-index:1;display:flex;flex-direction:column;align-items:center;min-height:100%;padding:calc(18px + env(safe-area-inset-top,0px)) 22px calc(22px + env(safe-area-inset-bottom,0px));text-align:center;box-sizing:border-box}
.kcLogo{height:20px;width:auto;opacity:.95;margin-bottom:auto}
.kcK{font:700 10px/1 'Space Mono','Space Mono Fallback',monospace;letter-spacing:.24em;color:#3EC6B0;margin:0 0 14px}
.kcT{margin:0;line-height:.86;font-weight:900;font-stretch:115%;text-transform:uppercase;transform:skewX(-9deg)}
.kcT b{display:block;font-size:clamp(84px,30vw,150px);color:#fff;letter-spacing:-.02em;text-shadow:0 0 18px rgba(255,61,154,.75),0 0 2px #fff,4px 4px 0 #FF3D9A}
.kcT span{display:block;font:700 clamp(15px,5vw,22px)/1 'Space Mono','Space Mono Fallback',monospace;letter-spacing:.42em;color:#3EC6B0;margin-top:12px;text-shadow:0 0 12px rgba(62,198,176,.6);transform:skewX(9deg)}
.kcD{font-size:17px;font-weight:700;line-height:1.35;margin:22px 0 6px;max-width:330px}
.kcS{font:400 11px/1.6 'Space Mono','Space Mono Fallback',monospace;color:#B9BCBF;max-width:320px;margin:0}
.kcStats{display:flex;gap:10px;margin:18px 0 0}
.kcStats div{border:1px solid rgba(255,255,255,.16);border-radius:8px;padding:9px 12px;min-width:96px;background:rgba(255,255,255,.04)}
.kcStats b{display:block;font-size:22px;font-weight:900}.kcStats small{font:700 8.5px/1 'Space Mono',monospace;letter-spacing:.14em;color:#979C9F}
.kcAct{width:100%;max-width:400px;margin-top:auto;padding-top:22px;display:flex;flex-direction:column;gap:10px}
.kcB{appearance:none;border:0;border-radius:10px;height:54px;width:100%;font:700 13px/1 'Space Mono','Space Mono Fallback',monospace;letter-spacing:.16em;cursor:pointer}
.kcB--p{background:#F2F2F2;color:#0B0C0E;box-shadow:0 0 0 1px #3EC6B0,0 0 22px rgba(62,198,176,.35)}
.kcB--s{background:transparent;color:#F2F2F2;border:1px solid rgba(255,255,255,.28)}
.kcB--t{background:transparent;color:#979C9F;height:40px;font-size:11px}
.kcB:disabled{opacity:.5}
.kcClk{color:#3EC6B0;filter:drop-shadow(0 0 10px rgba(62,198,176,.5));margin:16px 0 6px}
.kcClk svg{height:min(26vw,120px);width:auto;display:block;margin:0 auto}
.kcClk.fin{color:#FF3D9A;filter:drop-shadow(0 0 10px rgba(255,61,154,.6))}
.kcBig{font-size:clamp(110px,40vw,190px);font-weight:900;line-height:.9;letter-spacing:-.03em;margin:8px 0}
.kcStep{display:flex;align-items:center;gap:14px;margin:6px 0 2px}
.kcStep button{width:58px;height:58px;border-radius:50%;border:1px solid rgba(255,255,255,.3);background:rgba(255,255,255,.05);color:#fff;font-size:28px;font-weight:700;cursor:pointer}
.kcStep input{width:150px;background:transparent;border:0;border-bottom:2px solid #3EC6B0;color:#fff;text-align:center;font:900 72px/1 'KOACH Display',sans-serif;outline:none;-moz-appearance:textfield}
.kcStep input::-webkit-outer-spin-button,.kcStep input::-webkit-inner-spin-button{-webkit-appearance:none;margin:0}
.kcX{position:absolute;top:calc(12px + env(safe-area-inset-top,0px));right:12px;z-index:2;width:40px;height:40px;border-radius:50%;border:1px solid rgba(255,255,255,.2);background:rgba(0,0,0,.3);color:#fff;font-size:16px;cursor:pointer}
/* pestaña */
.tabbar.vis.kcTab6{grid-template-columns:.76fr 1.34fr 1.02fr .94fr .84fr .8fr}
.kcTab6 .tb .tl{font-size:8px!important;letter-spacing:.02em!important;white-space:nowrap}
#tb-vClub{position:relative}
#tb-vClub .kcDot{position:absolute;top:5px;right:22%;width:7px;height:7px;border-radius:50%;background:#3EC6B0;box-shadow:0 0 6px #3EC6B0}
/* vista 1% CLUB */
html.en-club,html.en-club body{background:#111215!important}
html.en-club .wrap{padding:0!important}
#vClub{min-height:100dvh;background:#111215;color:#F2F2F2;padding:0 0 calc(118px + env(safe-area-inset-bottom,0px));box-sizing:border-box}
.kcHero{position:relative;overflow:hidden;padding:calc(14px + env(safe-area-inset-top,0px)) 18px 22px;background:linear-gradient(180deg,#0B0C0E 0%,#15171A 70%,#111215 100%);text-align:center}
.kcHero .kcSun{top:178px;width:250px}.kcHero .kcGrid{height:34%;bottom:-2%}
.kcHero .kcIn{padding:0;min-height:0}
.kcHero .kcTop{display:flex;justify-content:center;width:100%;margin-bottom:26px}
.kcHero .kcTop img{height:17px}
.kcHero .kcTop span{font:700 9px/1 'Space Mono',monospace;letter-spacing:.16em;color:#979C9F}
.kcHero .kcTop span b{color:#F2F2F2}
.kcHero .kcT b{font-size:clamp(92px,30vw,128px)}.kcHero .kcT span{font-size:15px;margin-top:10px}
.kcHero .kcD{margin:22px 0 4px;font-size:16px}
.kcHero .kcS{text-transform:uppercase;font-size:9.5px;letter-spacing:.08em}
.kcHero .kcStats{width:100%;max-width:400px;display:grid;grid-template-columns:repeat(3,1fr);gap:8px}
.kcHero .kcStats div{min-width:0;padding:10px 6px;background:rgba(17,18,21,.72);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px)}
.kcHero .kcStats b{font-size:20px}
.kcHero .kcAct{margin-top:14px;padding-top:0}
.kcBody{padding:6px 16px 0}
.kcMia{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-top:10px;width:100%;max-width:400px;box-sizing:border-box;text-align:left;padding:12px 14px;border-radius:10px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12)}
.kcMia b{font-size:30px;font-weight:900}.kcMia small{display:block;font:700 8.5px/1.4 'Space Mono',monospace;letter-spacing:.14em;color:#979C9F}
.kcEst{font:700 8.5px/1 'Space Mono',monospace;letter-spacing:.12em;padding:6px 8px;border-radius:999px;border:1px solid}
.kcEst--ok{color:#3EC6B0;border-color:#3EC6B0}.kcEst--pend{color:#C9CCCF;border-color:#6F7377}
.kcSec{font:700 10px/1 'Space Mono',monospace;letter-spacing:.2em;color:#979C9F;margin:20px 0 10px;display:flex;justify-content:space-between;align-items:center}
.kcSeg{display:flex;gap:6px}.kcSeg button{border:1px solid rgba(255,255,255,.2);background:transparent;color:#C9CCCF;border-radius:999px;padding:7px 11px;font:700 9px/1 'Space Mono',monospace;letter-spacing:.1em;cursor:pointer}
.kcSeg button[aria-pressed=true]{background:#F2F2F2;color:#0B0C0E;border-color:#F2F2F2}
.kcRow{display:grid;grid-template-columns:34px 36px 1fr auto;align-items:center;gap:10px;padding:10px 12px;border-radius:10px;background:rgba(255,255,255,.04);margin-bottom:6px;border:1px solid transparent}
.kcRow.yo{border-color:#3EC6B0;background:rgba(62,198,176,.08)}
.kcRow .p{font:900 18px/1 'KOACH Display',sans-serif;color:#979C9F}.kcRow.t1 .p{color:#FF3D9A}.kcRow.t2 .p,.kcRow.t3 .p{color:#3EC6B0}
.kcRow .n{font-weight:800;font-size:13px;letter-spacing:.02em;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.kcRow .n small{display:block;font:700 8px/1.4 'Space Mono',monospace;letter-spacing:.12em;color:#6F7377}
.kcRow .s{font:900 22px/1 'KOACH Display',sans-serif}
.kcAv{width:36px;height:36px;border-radius:50%;overflow:hidden;display:flex;align-items:center;justify-content:center;background:#434649;font-weight:900;font-size:14px;color:#E3E3E3}
.kcAv img{width:100%;height:100%;object-fit:cover}
.kcEv{padding:12px 0;border-bottom:1px solid rgba(255,255,255,.08)}
.kcEv .h{display:flex;gap:10px;align-items:center}.kcEv .h p{margin:0;font-size:13px;line-height:1.35}.kcEv .h p b{font-weight:900}
.kcEv .h time{display:block;font:700 8px/1.4 'Space Mono',monospace;letter-spacing:.12em;color:#6F7377}
.kcEv.lider .h p b:first-child{color:#FF3D9A}
.kcRe{display:flex;gap:6px;margin-top:9px;padding-left:46px;overflow-x:auto;scrollbar-width:none}.kcRe::-webkit-scrollbar{display:none}
.kcRe button{flex:0 0 auto;border:1px solid rgba(255,255,255,.16);background:transparent;color:#C9CCCF;border-radius:999px;padding:6px 9px;font:700 8px/1 'Space Mono',monospace;letter-spacing:.06em;cursor:pointer;white-space:nowrap}
.kcRe button[aria-pressed=true]{border-color:#3EC6B0;color:#3EC6B0;background:rgba(62,198,176,.1)}
.kcVac{font:700 9.5px/1.7 'Space Mono',monospace;letter-spacing:.08em;color:#979C9F;padding:14px;text-align:center;border:1px dashed rgba(255,255,255,.15);border-radius:10px}
.kcConf{position:fixed;inset:0;pointer-events:none;z-index:96}
.kcHero .kcLema{font:900 24px/1.05 'KOACH Display',sans-serif;font-stretch:115%;text-transform:uppercase;letter-spacing:-.01em;margin:22px 0 8px}
.kcBaj{margin:0 auto 10px;max-width:340px;font:600 14px/1.45 'KOACH Display',sans-serif;color:#D5D7D9}
.kcHero.kcAnim .kcBaj{animation:kcUp .5s ease-out 1.1s both}

@media (prefers-reduced-motion:no-preference){
.kcHero.kcAnim .kcT b i{display:inline-block;font-style:normal;animation:kcSlam .6s cubic-bezier(.2,1.5,.4,1) both;animation-delay:calc(.2s + var(--i) * .14s)}
.kcHero.kcAnim .kcT b{animation:kcFlick 1.1s linear .95s both}
.kcHero.kcAnim .kcT span{animation:kcSpread .9s cubic-bezier(.2,.8,.2,1) .75s both}
.kcHero.kcAnim .kcSun{animation:kcRise 1.2s cubic-bezier(.2,.8,.2,1) both}
.kcHero.kcAnim .kcGrid{animation:kcRoad 1.6s linear infinite,kcFade .9s ease-out .3s both}
.kcHero.kcAnim .kcK{animation:kcUp .5s ease-out .05s both}
.kcHero.kcAnim .kcD,.kcHero.kcAnim .kcS{animation:kcUp .5s ease-out 1.05s both}
.kcHero.kcAnim .kcStats{animation:kcUp .5s ease-out 1.2s both}
.kcHero.kcAnim .kcMia,.kcHero.kcAnim .kcAct{animation:kcUp .5s ease-out 1.35s both}
.kcHero.kcAnim .kcFlash{position:absolute;inset:0;z-index:2;pointer-events:none;background:radial-gradient(circle at 50% 34%,rgba(255,61,154,.55),transparent 60%);animation:kcFlashA .7s ease-out .55s both}
}
.kcFlash{display:none}.kcHero.kcAnim .kcFlash{display:block}
@keyframes kcSlam{0%{opacity:0;transform:translateY(-60px) scale(2.4);filter:blur(8px)}55%{opacity:1;filter:blur(0)}75%{transform:translateY(4px) scale(.96)}100%{opacity:1;transform:none;filter:none}}
@keyframes kcFlick{0%,100%{opacity:1}8%{opacity:.35}12%{opacity:1}20%{opacity:.5}24%,60%{opacity:1}64%{opacity:.7}68%{opacity:1}}
@keyframes kcSpread{0%{opacity:0;letter-spacing:1.4em}100%{opacity:1;letter-spacing:.42em}}
@keyframes kcRise{0%{opacity:0;transform:translate(-50%,-10%) scale(.85)}100%{opacity:1;transform:translate(-50%,-50%) scale(1)}}
@keyframes kcFade{from{opacity:0}to{opacity:1}}
@keyframes kcUp{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}
@keyframes kcFlashA{0%{opacity:0}30%{opacity:1}100%{opacity:0}}

.kcClip{width:min(78vw,330px);aspect-ratio:1;border-radius:16px;overflow:hidden;margin:0 auto 14px;box-shadow:0 0 0 1px rgba(62,198,176,.45),0 0 40px rgba(255,61,154,.25);background:#0B0C0E;position:relative;z-index:1}
.kcClip video{width:100%;height:100%;object-fit:cover;display:block}
.kcClip.mini{width:min(46vw,190px);margin-bottom:6px}

.kcHm{position:relative;overflow:hidden;border-radius:22px;margin:0 0 var(--k2-s4,14px);padding:18px 20px;background:linear-gradient(180deg,#0B0C0E 0%,#1A1C20 100%);color:#F2F2F2;cursor:pointer;text-align:left;display:block;width:100%;border:0;box-sizing:border-box}
.kcHm .kcSun{left:auto;right:-46px;top:50%;width:170px;transform:translateY(-50%);opacity:.75}
.kcHm .kcGrid{height:46%;opacity:.6}
.kcHm__in{position:relative;z-index:1}
.kcHm__hd{display:flex;justify-content:space-between;align-items:center;font:700 10px/1 'Space Mono',monospace;letter-spacing:.18em;color:#3EC6B0}
.kcHm__hd span:last-child{color:#979C9F}
.kcHm__t{margin:12px 0 0;font:900 34px/.9 'KOACH Display',sans-serif;font-stretch:115%;transform:skewX(-8deg);transform-origin:left;color:#fff;text-shadow:0 0 12px rgba(255,61,154,.6),3px 3px 0 #FF3D9A}
.kcHm__t small{display:block;font:700 11px/1 'Space Mono',monospace;letter-spacing:.38em;color:#3EC6B0;text-shadow:none;margin-top:8px}
.kcHm__d{margin:12px 0 0;font:700 13px/1.35 'KOACH Display',sans-serif;max-width:250px}
.kcHm__ft{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-top:16px}
.kcHm__st{font:700 9px/1.5 'Space Mono',monospace;letter-spacing:.14em;color:#979C9F;text-transform:uppercase}
.kcHm__st b{color:#F2F2F2}
.kcHm__rk{list-style:none;margin:14px 0 0;padding:0;max-width:260px;position:relative;z-index:1}
.kcHm__rk li{display:grid;grid-template-columns:26px 1fr auto;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid rgba(255,255,255,.1);font:700 12px/1 'KOACH Display',sans-serif}
.kcHm__rk li i{font:700 10px/1 'Space Mono',monospace;color:#979C9F;font-style:normal}
.kcHm__rk li:first-child i{color:#FF3D9A}
.kcHm__rk li span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.kcHm__rk li b{font:900 15px/1 'KOACH Display',sans-serif}
.kcHm__rk li.yo span,.kcHm__rk li.yo b{color:#3EC6B0}
.kcHm2{cursor:pointer;text-align:left}.kcHm2 .nuHm__esc span{letter-spacing:.14em}.kcHm2 .kcHm__go2{gap:12px;padding:0 18px 0 22px}.kcHm2 .kcHm__go2 svg{width:18px;height:18px}
.kcHm__go{display:inline-flex;align-items:center;min-height:42px;padding:0 18px;border-radius:999px;background:#F2F2F2;color:#0B0C0E;font:700 11px/1 'Space Mono',monospace;letter-spacing:.14em;box-shadow:0 0 0 1px #3EC6B0}

.kcR .kcSun{opacity:.32;top:24%}
`
  function estilos() { if ($('kcCss')) return; var s = document.createElement('style'); s.id = 'kcCss'; s.textContent = css; document.head.appendChild(s) }
  function fondo() { return '<div class="kcBg" aria-hidden="true"><div class="kcSun"></div><div class="kcGrid"></div></div>' }
  function titulo(ch, letras) { var t = String(ch.titulo || '').split(' '), a = t.shift() || '', b = t.join(' ')
    var A = letras ? a.split('').map(function (c, i) { return '<i style="--i:' + i + '">' + esc(c) + '</i>' }).join('') : esc(a)
    return '<h1 class="kcT" aria-label="' + esc(ch.titulo) + '"><b>' + A + '</b><span>' + esc(b) + '</span></h1>' }

  /* ── datos ── */
  async function rpc(n, a) { var r = await cli().rpc(n, a || {}); if (r.error) throw r.error; return r.data }
  async function cargarEstado() { try { K.st = await rpc('club_estado'); K.ch = K.st && K.st.challenge || null } catch (e) { console.error('club_estado', e); K.st = K.st || null }
    if (K.ch) try { K.rank = await rpc('club_ranking', { p_challenge: K.ch.id }) || [] } catch (_) {}
    marcarTab(); try { pintarHome() } catch (_) {} return K.st }
  async function cargarListas() {
    if (!K.ch) { K.rank = []; K.feed = []; return }
    var r = await Promise.all([rpc('club_ranking', { p_challenge: K.ch.id }).catch(function () { return [] }), rpc('club_feed', { p_challenge: K.ch.id, p_limit: 40 }).catch(function () { return [] })])
    K.rank = r[0] || []; K.feed = r[1] || []
    var paths = K.rank.map(function (x) { return x.avatar }).concat(K.feed.map(function (x) { return x.avatar })).filter(Boolean)
    if (paths.length && window.KAvatar) try { await KAvatar.urls(cli(), Array.from(new Set(paths))) } catch (_) {}
  }
  function av(path, nombre) { try { if (window.KAvatar) return KAvatar.html(path, nombre, 'kcAv') } catch (_) {} return '<span class="kcAv">' + esc(String(nombre || '?').charAt(0)) + '</span>' }

  /* ── pestaña en la barra inferior ── */
  function montarTab() {
    var tb = $('tabbar'); if (!tb || $('tb-vClub')) return
    var b = document.createElement('button'); b.className = 'tb'; b.id = 'tb-vClub'; b.type = 'button'
    b.innerHTML = '<span class="ti"><svg class="tic" viewBox="0 0 24 24" aria-hidden="true"><circle class="ts" cx="7.5" cy="7.5" r="2.6"/><circle class="ts" cx="16.5" cy="16.5" r="2.6"/><path class="ts" d="M18 6L6 18"/></svg></span><span class="tl">1% CLUB</span>'
    b.onclick = function () { tab('vClub') }
    var pf = $('tb-vPerfil'); tb.insertBefore(b, pf || null); tb.classList.add('kcTab6')
    if (!$('vClub')) { var v = document.createElement('div'); v.className = 'vista conTab'; v.id = 'vClub'; var ref = $('vPerfil'); (ref && ref.parentNode || document.body).insertBefore(v, ref ? ref.nextSibling : null) }
    marcarTab()
  }
  function marcarTab() {
    var b = $('tb-vClub'); if (!b) return
    var dot = b.querySelector('.kcDot'), pend = false
    if (pend && !dot) { dot = document.createElement('i'); dot.className = 'kcDot'; b.appendChild(dot) } else if (!pend && dot) dot.remove()
  }

  /* ── vista 1% CLUB ── */
  async function abrirVista() {
    var v = $('vClub'); if (!v) return
    K.animar = true
    if (!K.st) v.innerHTML = '<div class="kcTop"><img src="/img/brand/logotipo-koach.png" alt="KOACH"></div><p class="kcHs">CARGANDO EL CLUB…</p>'
    var kr = window.KRUN ? KRUN.cargar() : null
    await cargarEstado(); await cargarListas(); if (kr) await kr; pintarVista()
    clearInterval(K.poll); K.poll = setInterval(function () { if (!v.classList.contains('on')) { clearInterval(K.poll); return } refrescar() }, 25000)
  }
  async function refrescar() { await cargarEstado(); await cargarListas(); if ($('vClub') && $('vClub').classList.contains('on')) pintarVista() }
  function cierre(ch) { var d = new Date(ch.fin); return d.getDate() + ' ' + ['ENE','FEB','MAR','ABR','MAY','JUN','JUL','AGO','SEP','OCT','NOV','DIC'][d.getMonth()] }
  function pintarVista() {
    var v = $('vClub'); if (!v) return
    var st = K.st || {}, ch = K.ch, mia = st.mia
    var top = '<div class="kcTop"><img src="/img/brand/logotipo-koach.png" alt="KOACH"></div>'
    if (!ch) {
      v.innerHTML = '<section class="kcHero">' + fondo() + '<div class="kcIn">' + top + '<h1 class="kcT"><b>1%</b><span>CLUB</span></h1><p class="kcD">Desafíos, comunidad y actividades del club.</p><p class="kcS">Pronto se abre el próximo challenge.</p>' +
        (st.miembro ? '' : '<div class="kcAct"><button class="kcB kcB--p" type="button" onclick="KCLUB.unirse()">ÚNETE AL CLUB DEL 1%</button></div>') + '</div></section>'
      run(v); return
    }
    var abierto = ch.abierto
    var anim = !!K.animar; K.animar = false
    if (anim) { setTimeout(function () { snd('riser', .5) }, 150); setTimeout(function () { snd('block', .7); try { navigator.vibrate && navigator.vibrate(30) } catch (_) {} }, 620) }
    var h = '<section class="kcHero' + (anim ? ' kcAnim' : '') + '">' + fondo() + (anim ? '<i class="kcFlash" aria-hidden="true"></i>' : '') + '<div class="kcIn">' + top +
      '<p class="kcK">CHALLENGE 01 · ' + (abierto ? 'ABIERTO' : 'RESULTADOS') + '</p>' + titulo(ch, true) +
      '<p class="kcD kcLema">' + esc(ch.lema || ch.descripcion || '') + '</p>' + (ch.bajada ? '<p class="kcBaj">' + esc(ch.bajada) + '</p>' : '') + '<p class="kcS">' + esc(ch.estandar || '') + '</p>' +
      '<div class="kcStats"><div><b>' + (st.miembros || 0) + '</b><small>EN EL CLUB</small></div><div><b>' + (st.participantes || 0) + '</b><small>MARCAS</small></div><div><b>' + (abierto ? cierre(ch) : 'FIN') + '</b><small>' + (abierto ? 'CIERRA' : 'CERRADO') + '</small></div></div>' +
      (mia ? '<div class="kcMia"><div><small>TU MARCA</small><b>' + mia.score + '</b></div><div style="text-align:right"><small>' + (posNum() ? 'POSICIÓN #' + posNum() + ' DE ' + K.rank.length : '') + '</small>' + estTag(mia.estado) + '</div></div>' : '') +
      '<div class="kcAct">' + (abierto ? (!st.miembro ? '<button class="kcB kcB--p" type="button" onclick="KCLUB.unirse(true)">ÚNETE AL CLUB DEL 1%</button>'
        : (mia ? '' : '<button class="kcB kcB--p" type="button" onclick="KCLUB.challenge()">ENTRAR AL CHALLENGE</button>')) : '') +
      (mia ? '<button class="kcB kcB--s" type="button" onclick="KCLUB.compartir()">COMPARTIR HISTORIA</button>' : '') + '</div></div></section><div class="kcBody">'
    h += '<div class="kcSec"><span>RANKING · ' + (st.participantes || 0) + '</span><span class="kcSeg">' + ['todos', 'mujeres', 'hombres'].map(function (f) { return '<button type="button" aria-pressed="' + (K.filtro === f) + '" onclick="KCLUB.filtro(\'' + f + '\')">' + f.toUpperCase() + '</button>' }).join('') + '</span></div>'
    var lista = K.rank.filter(function (x) { return K.filtro === 'todos' || (K.filtro === 'mujeres' ? x.sexo === 'mujer' : x.sexo === 'hombre') })
    h += lista.length ? lista.map(function (x, i) { var p = K.filtro === 'todos' ? x.pos : i + 1
      return '<div class="kcRow' + (x.yo ? ' yo' : '') + (p <= 3 ? ' t' + p : '') + '"><span class="p">' + String(p).padStart(2, '0') + '</span>' + av(x.avatar, x.nombre) +
        '<span class="n">' + esc(x.nombre) + '<small>' + (x.estado === 'validado' ? 'VALIDADO POR KOACH' : 'POR VALIDAR') + '</small></span><span class="s">' + x.score + '</span></div>' }).join('')
      : '<div class="kcVac">TODAVÍA NO HAY MARCAS. LA PRIMERA PUEDE SER LA TUYA.</div>'
    h += '<div class="kcSec"><span>EN VIVO · CHALLENGE</span></div>'
    h += K.feed.length ? K.feed.map(evento).join('') : '<div class="kcVac">AQUÍ APARECE QUIÉN ENTRA AL CHALLENGE Y CADA MARCA.</div>'
    v.innerHTML = h + '</div>'
    run(v)
    if (K.irRanking) { K.irRanking = false; var r = v.querySelector('.kcSec'); if (r) setTimeout(function () { r.scrollIntoView({ behavior: 'smooth', block: 'start' }) }, 120) }
  }
  function run(v) { try { window.KRUN && KRUN.montar(v) } catch (e) { console.error('KRUN', e) } }
  function posNum() { var y = K.rank.filter(function (x) { return x.yo })[0]; return y ? y.pos : null }
  function posTxt() { var y = K.rank.filter(function (x) { return x.yo })[0]; return y ? 'POSICIÓN #' + y.pos + ' DE ' + K.rank.length : '' }
  function estTag(e) { return e === 'validado' ? '<span class="kcEst kcEst--ok">✓ VALIDADA</span>' : e === 'rechazado' ? '<span class="kcEst kcEst--pend">REVISAR CON TU KOACH</span>' : '<span class="kcEst kcEst--pend">POR VALIDAR</span>' }
  function hace(at) { var m = Math.round((Date.now() - new Date(at).getTime()) / 60000); return m < 1 ? 'AHORA' : m < 60 ? 'HACE ' + m + ' MIN' : m < 1440 ? 'HACE ' + Math.round(m / 60) + ' H' : 'HACE ' + Math.round(m / 1440) + ' D' }
  function evento(e) {
    var n = '<b>' + esc(e.nombre) + '</b>', p = e.payload || {}, t =
      e.tipo === 'unido' ? n + ' se unió al Club del 1%.' :
      e.tipo === 'marca' ? n + ' marcó <b>' + p.score + ' burpees</b>' + (p.pos ? ' · #' + p.pos + ' del ranking.' : '.') :
      e.tipo === 'lider' ? n + ' toma el primer lugar con <b>' + p.score + '</b>.' : n
    var mias = e.mias || [], cnt = e.reac || {}
    return '<div class="kcEv' + (e.tipo === 'lider' ? ' lider' : '') + '" data-ev="' + e.id + '"><div class="h">' + av(e.avatar, e.nombre) + '<p>' + t + '<time>' + hace(e.at) + '</time></p></div>' +
      '<div class="kcRe">' + REAC.map(function (r) { var on = mias.indexOf(r[0]) >= 0
        return '<button type="button" aria-pressed="' + on + '" onclick="KCLUB.reaccionar(' + e.id + ',\'' + r[0] + '\',this)">' + r[1] + (cnt[r[0]] ? ' · ' + cnt[r[0]] : '') + '</button>' }).join('') + '</div></div>'
  }
  async function reaccionar(id, clave, btn) {
    if (!(K.st && K.st.miembro)) { aviso('Únete al Club del 1% para reaccionar.'); return }
    var ev = K.feed.filter(function (x) { return x.id === id })[0]; if (!ev) return
    try { snd('set', .6); var c = await rpc('club_reaccionar', { p_evento: id, p_clave: clave }); ev.reac = c || {}
      var i = (ev.mias || []).indexOf(clave); if (i >= 0) ev.mias.splice(i, 1); else (ev.mias = ev.mias || []).push(clave)
      var box = document.querySelector('.kcEv[data-ev="' + id + '"]'); if (box) box.outerHTML = evento(ev)
    } catch (e) { aviso(e.message || 'No se pudo reaccionar.') }
  }
  async function unirse(irChallenge) {
    try { K.st = await rpc('club_unirse'); K.ch = K.st.challenge || K.ch; snd('logro', .7); confeti(); aviso('Bienvenido al Club del 1%.') }
    catch (e) { aviso(e.message || 'No se pudo unir.'); return false }
    marcarTab(); if (irChallenge) { abrirRun() } else if ($('vClub') && $('vClub').classList.contains('on')) refrescar()
    return true
  }


  /* ── tarjeta en el Home (debajo de TU NUTRICIÓN DEL DÍA): entrada al 1% CLUB, sin avisos ── */
  function homeHTML() {
    var st = K.st || {}, ch = K.ch, mia = st.mia
    var cierre = ch ? (['DOM', 'LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB'][new Date(ch.fin).getDay()] + ' ' + new Date(ch.fin).getDate()) : ''
    var sig = ch && ch.abierto ? '<b>1 CHALLENGE ACTIVO</b>' + (mia ? 'TU MARCA · ' + mia.score : 'CIERRA EL ' + cierre)
      : ch ? '<b>CHALLENGE CERRADO</b>VER RESULTADOS' : '<b>PRÓXIMO CHALLENGE</b>MUY PRONTO'
    return '<div class="nuHm__hd"><span>COMUNIDAD</span><span><b>' + (st.miembros || 0) + '</b> EN EL CLUB</span></div>' +
      '<div class="nuHm__big"><div class="nuHm__num"><b>1%</b><span>CLUB</span></div></div>' +
      '<div class="nuHm__esc"><span>DESAFÍOS · COMUNIDAD · ACTIVIDADES</span></div>' +
      '<div class="nuHm__ft"><span class="nuHm__scan kcHm__go2">ENTRAR<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg></span>' +
      '<div class="nuHm__sig">' + sig + '</div></div>'
  }
  function top3() {
    var t = K.rank.slice(0, 3); if (!t.length) return ''
    var y = K.rank.filter(function (x) { return x.yo })[0]
    return '<ol class="kcHm__rk">' + t.map(function (x) { return '<li' + (x.yo ? ' class="yo"' : '') + '><i>' + String(x.pos).padStart(2, '0') + '</i><span>' + esc(x.nombre) + '</span><b>' + x.score + '</b></li>' }).join('') +
      (y && y.pos > 3 ? '<li class="yo"><i>' + String(y.pos).padStart(2, '0') + '</i><span>TÚ</span><b>' + y.score + '</b></li>' : '') + '</ol>'
  }
  function pintarHome() {
    var nu = $('nuHm'), card = $('kcHm'), html = homeHTML()
    if (!K.st || !nu) return
    if (!card) { card = document.createElement('section'); card.id = 'kcHm'; card.className = 'nuHm kcHm2'; card.setAttribute('role', 'button'); card.setAttribute('tabindex', '0'); card.setAttribute('aria-label', 'Entrar al 1% Club'); card.onclick = function () { tab('vClub') } }
    if (nu.nextSibling !== card) nu.parentNode.insertBefore(card, nu.nextSibling)
    if (card._h !== html) { card.innerHTML = html; card._h = html }
  }
  function vigilarHome() {
    var h = $('vHome'); if (!h || K.obs) return
    var pend = false
    K.obs = new MutationObserver(function () { if (pend) return; pend = true; requestAnimationFrame(function () { pend = false; pintarHome() }) })
    K.obs.observe(h, { childList: true, subtree: true })
    pintarHome()
  }

  /* ── pantalla especial al iniciar la sesión ── */
  var GATE_ON = false   // 19-nov: no abrir el challenge solo al tocar START; se entra desde la tarjeta del Home o la pestaña 1% CLUB
  function gateAplica() {
    if (!GATE_ON) return false
    var p = perfil(); if (!p || !K.ch || !K.ch.abierto || (K.st && K.st.mia)) return false
    try { if (localStorage.getItem('kc_gate_' + K.ch.slug) === hoy()) return false } catch (_) {}
    return true
  }
  function gate(cont) {
    estilos(); K.desde = cont
    var g = $('kcGate'); if (!g) { g = document.createElement('div'); g.className = 'kcG'; g.id = 'kcGate'; g.setAttribute('role', 'dialog'); g.setAttribute('aria-modal', 'true'); document.body.appendChild(g) }
    var st = K.st || {}, ch = K.ch
    g.innerHTML = fondo() + '<div class="kcIn"><img class="kcLogo" src="/img/brand/logotipo-koach.png" alt="KOACH">' +
      '<p class="kcK">1% CLUB · CHALLENGE 01</p>' + titulo(ch) + '<p class="kcD">' + esc(ch.descripcion) + '</p>' +
      '<p class="kcS">' + (st.miembro ? 'Tu marca entra al ranking de todo el club.' : 'Hoy únete a la comunidad del Club del 1%: un canal interno de desafíos, comunidad y actividades.') + '</p>' +
      '<div class="kcStats"><div><b>' + (st.miembros || 0) + '</b><small>EN EL CLUB</small></div><div><b>' + (st.participantes || 0) + '</b><small>MARCAS</small></div></div>' +
      '<div class="kcAct">' + (st.miembro ? '<button class="kcB kcB--p" type="button" onclick="KCLUB._gateRun()">ENTRAR AL CHALLENGE</button>'
        : '<button class="kcB kcB--p" type="button" onclick="KCLUB._gateUnir()">ÚNETE AL CLUB DEL 1%</button>') +
      '<button class="kcB kcB--t" type="button" onclick="KCLUB._gateSalir()">AHORA NO · IR A MI SESIÓN</button></div></div>'
    g.classList.add('on'); try { kAudioUnlock(); KSFX.play('appear', 0, .7) } catch (_) {}
  }
  function cerrarGate() { var g = $('kcGate'); if (g) g.classList.remove('on') }
  function continuar() { var c = K.desde; K.desde = null; cerrarGate(); cerrarRun(); if (c) try { c() } catch (e) { console.error(e) } }

  /* ── challenge: instrucciones → 3·2·1 → 3:00 → marca → resultado ── */
  function runEl() { estilos(); var r = $('kcRun'); if (!r) { r = document.createElement('div'); r.className = 'kcR'; r.id = 'kcRun'; r.setAttribute('role', 'dialog'); r.setAttribute('aria-modal', 'true'); document.body.appendChild(r) } return r }
  function runPintar(cuerpo, acciones) {
    var r = runEl()
    r.innerHTML = fondo() + '<button class="kcX" type="button" aria-label="Cerrar" onclick="KCLUB._runCerrar()">✕</button><div class="kcIn"><img class="kcLogo" src="/img/brand/logotipo-koach.png" alt="KOACH">' + cuerpo + '<div class="kcAct">' + acciones + '</div></div>'
    r.classList.add('on')
  }
  function abrirRun() {
    cerrarGate(); var ch = K.ch; if (!ch) return
    if (K.st && K.st.mia) { aviso('Ya registraste tu marca: ' + K.st.mia.score + '. El challenge tiene una sola oportunidad.'); return }
    runPintar(clip(ch) + '<p class="kcK">' + esc(ch.titulo) + '</p><div class="kcClk">' + seg(mmss(ch.duracion_seg || 180)) + '</div>' +
      '<p class="kcD">' + esc(ch.descripcion) + '</p><p class="kcS">' + esc(ch.estandar || '') + '<br><br>Hazlo en pareja: uno hace, el otro cuenta. Después cambian.<br><br><b style="color:#3EC6B0">TIENES UNA SOLA OPORTUNIDAD.</b></p>',
      '<button class="kcB kcB--p" type="button" onclick="KCLUB._runStart()">START ' + mmss(ch.duracion_seg || 180) + '</button>' +
      '<button class="kcB kcB--t" type="button" onclick="KCLUB._runMarca()">YA LO HICE · REGISTRAR MI MARCA</button>')
  }
  async function wake(on) { try { if (on && navigator.wakeLock) K.wl = await navigator.wakeLock.request('screen'); else if (!on && K.wl) { K.wl.release(); K.wl = null } } catch (_) {} }
  function runStart() {
    var ch = K.ch, dur = ch.duracion_seg || 180, n = 3; wake(true)
    var paso = function () {
      if (n > 0) { runPintar('<p class="kcK">PREPÁRATE</p><div class="kcClk">' + seg('0' + n) + '</div>', '<button class="kcB kcB--t" type="button" onclick="KCLUB._runParar()">CANCELAR</button>'); snd('tick' + (4 - n)); if (n === 3) snd('riser', .5); n--; K.run = setTimeout(paso, 1000); return }
      snd('go'); var fin = Date.now() + dur * 1000, ult = -1
      runPintar(clip(ch, 'mini') + '<p class="kcK">' + esc(ch.metrica) + ' · MÁXIMO</p><div class="kcClk" id="kcClk">' + seg(mmss(dur)) + '</div><p class="kcS">Pecho al suelo. Extensión completa. No pares.</p>', '<button class="kcB kcB--t" type="button" onclick="KCLUB._runParar()">DETENER</button>')
      var tick = function () {
        var r = (fin - Date.now()) / 1000, s = Math.max(0, Math.ceil(r)), el = $('kcClk'); if (!el) return
        if (s !== ult) { ult = s; el.innerHTML = seg(mmss(s)); if (s <= 10) el.classList.add('fin'); if (s > 0 && s <= 3) snd('tick' + (4 - s)) }
        if (r <= 0) { K.run = null; snd('block'); try { navigator.vibrate && navigator.vibrate([200, 80, 200]) } catch (_) {} wake(false); pedirMarca(true); return }
        K.run = setTimeout(tick, 200)
      }
      tick()
    }
    paso()
  }
  function runParar() { clearTimeout(K.run); K.run = null; wake(false); abrirRun() }
  function pedirMarca(tiempo) {
    var prev = (K.st && K.st.mia && K.st.mia.score) || ''
    runPintar('<p class="kcK">' + (tiempo ? 'TIEMPO' : 'REGISTRA TU MARCA') + '</p><p class="kcD" style="margin-top:6px">¿Cuántos burpees completaste?</p>' +
      '<div class="kcStep"><button type="button" aria-label="Restar" onclick="KCLUB._paso(-1)">−</button><input id="kcNum" type="number" inputmode="numeric" min="1" max="150" value="' + esc(prev) + '" placeholder="0"><button type="button" aria-label="Sumar" onclick="KCLUB._paso(1)">+</button></div>' +
      '<p class="kcS" style="margin-top:14px">Tu koach valida la marca en la sala.</p>',
      '<button class="kcB kcB--p" type="button" id="kcReg" onclick="KCLUB._registrar()">REGISTRAR MARCA</button>')
  }
  function pasoNum(d) { var i = $('kcNum'); if (!i) return; i.value = Math.max(1, Math.min(150, (parseInt(i.value) || 0) + d)) }
  async function registrar() {
    var i = $('kcNum'), v = parseInt(i && i.value), b = $('kcReg')
    if (!v || v < 1 || v > 150) { aviso('Ingresa una marca entre 1 y 150.'); return }
    if (!confirm('¿Registrar ' + v + ' burpees? Tienes una sola oportunidad y no se puede cambiar.')) return
    b.disabled = true
    try {
      var r = await rpc('club_registrar', { p_challenge: K.ch.id, p_score: v })
      snd('logro'); confeti(); await cargarEstado(); cargarListas().then(function () { if ($('vClub') && $('vClub').classList.contains('on')) pintarVista() })
      runPintar('<p class="kcK">MARCA REGISTRADA</p><div class="kcBig">' + r.score + '</div><p class="kcD" style="margin-top:0">' + esc(K.ch.metrica) + ' EN ' + mmss(K.ch.duracion_seg || 180) + '</p>' +
        '<div class="kcStats"><div><b>#' + r.pos + '</b><small>DE ' + r.total + '</small></div><div><b style="font-size:13px;line-height:1.9">POR VALIDAR</b><small>TU KOACH</small></div></div>',
        '<button class="kcB kcB--p" type="button" onclick="KCLUB.compartir()">COMPARTIR HISTORIA</button>' +
        (K.desde ? '<button class="kcB kcB--s" type="button" onclick="KCLUB._continuar()">IR A MI SESIÓN</button>' : '<button class="kcB kcB--s" type="button" onclick="KCLUB._verRanking()">VER RANKING</button>'))
    } catch (e) { b.disabled = false; aviso(e.message || 'No se pudo registrar la marca.') }
  }
  function cerrarRun() { clearTimeout(K.run); K.run = null; wake(false); var r = $('kcRun'); if (r) r.classList.remove('on') }
  function runCerrar() { if (K.desde) { continuar(); return } cerrarRun(); if ($('vClub') && $('vClub').classList.contains('on')) refrescar() }

  /* ── confeti (serpentina) ── */
  function confeti() {
    try { if (matchMedia('(prefers-reduced-motion: reduce)').matches) return } catch (_) {}
    var c = document.createElement('canvas'); c.className = 'kcConf'; c.width = innerWidth; c.height = innerHeight; document.body.appendChild(c)
    var x = c.getContext('2d'), col = ['#3EC6B0', '#FF3D9A', '#F2F2F2', '#979C9F'], P = []
    for (var i = 0; i < 90; i++) P.push({ x: innerWidth / 2, y: innerHeight * .45, vx: (Math.random() - .5) * 14, vy: -Math.random() * 14 - 4, r: Math.random() * 6.28, w: 4 + Math.random() * 6, h: 8 + Math.random() * 10, c: col[i % 4] })
    var t0 = performance.now()
    ;(function f(t) { var dt = t - t0; x.clearRect(0, 0, c.width, c.height)
      P.forEach(function (p) { p.vy += .42; p.x += p.vx; p.y += p.vy; p.r += .2; x.save(); x.translate(p.x, p.y); x.rotate(p.r); x.fillStyle = p.c; x.fillRect(-p.w / 2, -p.h / 2, p.w, p.h); x.restore() })
      if (dt < 1800) requestAnimationFrame(f); else c.remove() })(t0)
  }

  /* ── historia 9:16 ── */
  function img(src) { return new Promise(function (ok) { var i = new Image(); i.onload = function () { ok(i) }; i.onerror = function () { ok(null) }; i.src = src }) }
  async function historia() {
    var mia = K.st && K.st.mia; if (!mia || !K.ch) return null
    try { await Promise.all([document.fonts.load('900 200px "KOACH Display"'), document.fonts.load('700 40px "Space Mono"')]) } catch (_) {}
    var W = 1080, H = 1920, c = document.createElement('canvas'); c.width = W; c.height = H; var x = c.getContext('2d')
    var g = x.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#0B0C0E'); g.addColorStop(.5, '#17191C'); g.addColorStop(1, '#2A2D31'); x.fillStyle = g; x.fillRect(0, 0, W, H)
    // sol rayado
    x.save(); x.beginPath(); x.arc(W / 2, 640, 330, 0, Math.PI * 2); x.clip()
    for (var y = 310; y < 900; y += 30) { x.fillStyle = 'rgba(255,61,154,' + Math.max(0, .62 - (y - 310) / 900) + ')'; x.fillRect(0, y, W, 16) }
    x.restore()
    // grilla en perspectiva
    x.strokeStyle = 'rgba(62,198,176,.5)'; x.lineWidth = 2; var hz = 1180
    for (var k = -14; k <= 14; k++) { x.beginPath(); x.moveTo(W / 2 + k * 40, hz); x.lineTo(W / 2 + k * 260, H); x.stroke() }
    for (var j = 0; j < 14; j++) { var yy = hz + Math.pow(j / 13, 2.1) * (H - hz); x.beginPath(); x.moveTo(0, yy); x.lineTo(W, yy); x.stroke() }
    var lg = await img('/img/brand/logotipo-koach.png'); if (lg) { var lw = 300, lh = lw * lg.height / lg.width; x.drawImage(lg, (W - lw) / 2, 120, lw, lh) }
    x.textAlign = 'center'
    x.font = '700 34px "Space Mono", monospace'; x.fillStyle = '#3EC6B0'; x.fillText('1% CLUB · CHALLENGE 01', W / 2, 300)
    var partes = String(K.ch.titulo || '').split(' '), a = partes.shift(), b = partes.join(' ')
    x.save(); x.translate(W / 2, 640); x.transform(1, 0, -.16, 1, 0, 0)
    x.font = '900 300px "KOACH Display", sans-serif'; x.fillStyle = '#FF3D9A'; x.fillText(a, 12, 12)
    x.shadowColor = 'rgba(255,61,154,.8)'; x.shadowBlur = 40; x.fillStyle = '#FFFFFF'; x.fillText(a, 0, 0); x.restore()
    x.font = '700 58px "Space Mono", monospace'; x.fillStyle = '#3EC6B0'; x.fillText(b.split('').join(' '), W / 2, 760)
    x.shadowColor = 'rgba(0,0,0,.6)'; x.shadowBlur = 30
    x.font = '900 400px "KOACH Display", sans-serif'; x.fillStyle = '#FFFFFF'; x.fillText(String(mia.score), W / 2, 1230)
    x.shadowBlur = 0
    x.font = '700 44px "Space Mono", monospace'; x.fillStyle = '#E3E3E3'; x.fillText(String(K.ch.metrica || '') + ' EN ' + mmss(K.ch.duracion_seg || 180), W / 2, 1320)
    var y0 = K.rank.filter(function (r) { return r.yo })[0]
    if (y0) { x.font = '900 120px "KOACH Display", sans-serif'; x.fillStyle = '#3EC6B0'; x.fillText('#' + y0.pos, W / 2, 1520); x.font = '700 34px "Space Mono", monospace'; x.fillStyle = '#979C9F'; x.fillText('DE ' + K.rank.length + ' EN EL RANKING DEL CLUB', W / 2, 1580) }
    var p = perfil(); x.font = '900 64px "KOACH Display", sans-serif'; x.fillStyle = '#FFFFFF'; x.fillText(String((p && p.nombre) || '').toUpperCase(), W / 2, 1720)
    x.font = '700 30px "Space Mono", monospace'; x.fillStyle = '#979C9F'; x.fillText('KOACHCLUB.CL', W / 2, 1810)
    return await new Promise(function (ok) { c.toBlob(function (bl) { ok(bl ? new File([bl], 'koach-' + K.ch.slug + '.jpg', { type: 'image/jpeg' }) : null) }, 'image/jpeg', .9) })
  }
  async function compartir() {
    if (!(K.st && K.st.mia)) { aviso('Registra tu marca primero.'); return }
    if (!K.rank.length) await cargarListas()
    var f = K.file && K.fileScore === K.st.mia.score ? K.file : null
    if (!f) { f = await historia(); K.file = f; K.fileScore = K.st.mia.score }
    if (!f) { aviso('No se pudo crear la imagen.'); return }
    var puede = false; try { puede = !!(navigator.canShare && navigator.share && navigator.canShare({ files: [f] })) } catch (_) {}
    if (puede) { try { await navigator.share({ files: [f] }); return } catch (e) { if (e && e.name === 'AbortError') return } }
    var a = document.createElement('a'); a.href = URL.createObjectURL(f); a.download = f.name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(function () { URL.revokeObjectURL(a.href) }, 4000)
    aviso('La imagen se descargó.')
  }

  /* ── enganches con la app (después de que cargó el script principal) ── */
  function enganchar() {
    if (typeof window.abrirSesion !== 'function' || typeof window.tab !== 'function' || typeof window.vista !== 'function') return false
    var _abrir = window.abrirSesion
    window.abrirSesion = function (num) {
      var args = arguments
      if (gateAplica() && !(S && S.memBloqueo)) { gate(function () { _abrir.apply(window, args) }); return Promise.resolve() }
      return _abrir.apply(window, args)
    }
    var _vista = window.vista
    window.vista = function (id) {
      var r = _vista.apply(window, arguments)
      var en = id === 'vClub'; document.documentElement.classList.toggle('en-club', en)
      try { var m = document.querySelector('meta[name=theme-color]'); if (m) { if (en && !m.dataset.kc) m.dataset.kc = m.content; m.content = en ? '#0B0C0E' : (m.dataset.kc || m.content) } } catch (_) {}
      if (en) { var tb = $('tabbar'); if (tb && perfil()) tb.classList.add('vis') }
      return r
    }
    var _tab = window.tab
    window.tab = function (id) {
      if (id !== 'vClub') return _tab.apply(window, arguments)
      try { var on = (document.querySelector('.vista.on') || {}).id; if (on !== 'vClub') { kAudioUnlock(); KSFX.play('set') } } catch (_) {}
      window.vista('vClub'); document.querySelectorAll('.tb').forEach(function (b) { b.classList.toggle('on', b.id === 'tb-vClub') })
      abrirVista()
    }
    return true
  }
  function iniciar() {
    estilos()
    var n = 0, t = setInterval(function () {
      n++; if (n > 600) { clearInterval(t); return }
      if (!cli() || !perfil() || !$('tabbar')) return
      clearInterval(t)
      if (!enganchar()) return
      montarTab(); vigilarHome(); cargarEstado()
      setInterval(function () { if (!document.hidden && perfil()) cargarEstado() }, 300000)
    }, 500)
  }

  window.KCLUB = {
    unirse: unirse, challenge: abrirRun, compartir: compartir, reaccionar: reaccionar,
    filtro: function (f) { K.filtro = f; pintarVista() },
    _gateUnir: async function () { if (await unirse(false)) abrirRun() },
    _gateRun: function () { abrirRun() },
    _gateSalir: function () { try { localStorage.setItem('kc_gate_' + K.ch.slug, hoy()) } catch (_) {} continuar() },
    _runStart: runStart, _runParar: runParar, _runMarca: function () { pedirMarca(false) }, _paso: pasoNum, _registrar: registrar,
    _runCerrar: runCerrar, _continuar: continuar,
    _verRanking: function () { cerrarRun(); tab('vClub') },
    _confeti: confeti,
    _estado: function () { return K }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar); else iniciar()
})()
