/* KOACH · ESCÁNER DE COMIDAS · interfaz del socio (window.KEU) · v3 · Sistema de diseño KOACH (superficie Operación)
   Flujo: elegir comida → guía de foto (o describir sin foto) → foto → ¿cómo se preparó? + detalle opcional → /api/escaner
   (la IA identifica alimentos, gramos, confianza y zonas; la foto NO se guarda) → resultado: kcal y macros vs la comida del plan,
   veredicto con reglas KOACH, comparación con el plan, alertas inflamatorias → el socio revisa (dudosos marcados, medidas caseras
   con − / +, "igual a mi plan") → CONFIRMAR registra la comida (completada o cheat meal).
   KEU.init({ token, plan: () => ({ pauta, comidas, estado(num) }), confirmar: async (id, num, det, res), onRegistrado }) · KEU.abrir(num?) */
(function(){
'use strict'
const esc = t => String(t == null ? '' : t).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]))
const n0 = v => Math.round(+v || 0).toLocaleString('es-CL')
const cap = s => { s = String(s || ''); return s.charAt(0).toUpperCase() + s.slice(1) }
const low = s => String(s || '').toLowerCase()
const VER = {
  adecuado: { k: 'ADECUADO', ico: '<path d="M5 12.5l4.5 4.5L19 7.5"/>' },
  relativo: { k: 'RELATIVAMENTE ADECUADO', ico: '<path d="M6 12h12"/>' },
  alerta:   { k: 'NO ADECUADO', ico: '<path d="M12 6.5v7"/><path d="M12 17.2v.3"/>' },
  no_comida:{ k: 'SIN COMIDA', ico: '<path d="M8 8l8 8M16 8l-8 8"/>' }
}
const I = {
  back: '<path d="M15 6l-6 6 6 6"/>',
  cam: '<path d="M4 8.5A2.5 2.5 0 0 1 6.5 6h1.7l1.3-2h5l1.3 2h1.7A2.5 2.5 0 0 1 20 8.5v8a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 16.5z"/><circle cx="12" cy="12.3" r="3.4"/>',
  gal: '<rect x="4" y="4" width="16" height="16" rx="3"/><circle cx="9.5" cy="9.5" r="1.6"/><path d="M20 15l-4.5-4.5L6 20"/>',
  txt: '<path d="M5 7h14M5 12h14M5 17h9"/>',
  top: '<path d="M12 3v4M12 3l-2.5 2.5M12 3l2.5 2.5"/><ellipse cx="12" cy="15" rx="8" ry="4.5"/>',
  sol: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4"/>',
  plato: '<path d="M4 8V5.5A1.5 1.5 0 0 1 5.5 4H8M16 4h2.5A1.5 1.5 0 0 1 20 5.5V8M20 16v2.5a1.5 1.5 0 0 1-1.5 1.5H16M8 20H5.5A1.5 1.5 0 0 1 4 18.5V16"/><circle cx="12" cy="12" r="4.5"/>',
  x: '<path d="M7 7l10 10M17 7L7 17"/>'
}
const ico = (p, c) => '<svg viewBox="0 0 24 24" aria-hidden="true"' + (c ? ' class="' + c + '"' : '') + '>' + p + '</svg>'
const CSS = `
.keu{--k-surface:#F4F3F0;--k-raised:#FBFAF8;--k-ink:#121212;--k-muted:#5E5D59;--k-faint:#8E8D88;--k-line:rgba(18,18,18,.08);--k-g1:#E7E6E2;--k-g2:#C9C8C3;--k-ok:#2F7D4F;
  --k-d:var(--font-display,'Inter Display',Inter,Arial,sans-serif);--k-m:var(--font-mono,'IBM Plex Mono','Roboto Mono',monospace);
  position:fixed;inset:0;z-index:9000;display:flex;flex-direction:column;background:var(--k-surface);color:var(--k-ink);font-family:var(--k-d);font-variant-numeric:tabular-nums;overflow:hidden}
.keu[hidden]{display:none}
.keu *{box-sizing:border-box}
.keu svg{fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
.keu__top{position:relative;flex-shrink:0;height:calc(56px + env(safe-area-inset-top,0px));display:flex;align-items:center;justify-content:space-between;padding:env(safe-area-inset-top,0px) 12px 0;background:var(--k-ink);color:#F4F3F0}
.keu__top button{display:flex;align-items:center;gap:6px;height:44px;padding:0 8px;border:0;background:none;color:inherit;font:500 10px var(--k-m);letter-spacing:.16em;cursor:pointer}
.keu__top button svg{width:16px;height:16px}
.keu__logo{position:absolute;left:50%;top:calc(50% + env(safe-area-inset-top,0px)/2);transform:translate(-50%,-50%);width:88px;height:auto;pointer-events:none}
.keu__top span{font:500 10px var(--k-m);letter-spacing:.16em;color:#A7A9AE;max-width:30%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
@media (max-width:400px){.keu__top span{display:none}}
.keu__sc{flex:1;overflow-y:auto;-webkit-overflow-scrolling:touch;padding-bottom:calc(48px + env(safe-area-inset-bottom,0px))}
@media (min-width:640px){.keu__sc>*{max-width:520px;margin-left:auto;margin-right:auto}}
.keu__lbl{display:block;font:500 10px/1.3 var(--k-m);letter-spacing:.16em;text-transform:uppercase;color:var(--k-muted)}
.keu__hd{padding:26px 24px 0}
.keu__hd h2{margin:10px 0 0;font:700 34px/1.02 var(--k-d);letter-spacing:-.03em;text-wrap:balance}
.keu__hd p{margin:10px 0 0;font:400 15px/1.45 var(--k-d);color:var(--k-muted)}
.keu__pad{padding:18px 20px 0;display:flex;flex-direction:column;gap:10px}
.keu__card{background:var(--k-raised);border:1px solid var(--k-line);border-radius:26px;padding:18px}
.keu__cta{width:100%;min-height:56px;border:0;border-radius:18px;background:var(--k-ink);color:#F4F3F0;display:flex;align-items:center;justify-content:center;gap:10px;padding:0 18px;font:700 17px var(--k-d);letter-spacing:-.01em;text-decoration:none;cursor:pointer}
.keu__cta svg{width:20px;height:20px}
.keu__cta[disabled]{opacity:.4;cursor:default}
.keu__sec{width:100%;min-height:50px;border:1px solid var(--k-ink);border-radius:18px;background:transparent;color:var(--k-ink);display:flex;align-items:center;justify-content:center;gap:10px;padding:0 18px;font:500 10px var(--k-m);letter-spacing:.16em;cursor:pointer}
.keu__sec svg{width:17px;height:17px}
.keu__lnk{width:100%;min-height:44px;border:0;background:none;color:var(--k-ink);display:flex;align-items:center;justify-content:center;gap:8px;font:500 10px var(--k-m);letter-spacing:.16em;cursor:pointer}
.keu__lnk svg{width:16px;height:16px}
.keu button:focus-visible,.keu input:focus-visible,.keu textarea:focus-visible{outline:2px solid var(--k-ink);outline-offset:2px}
.keu__pill{display:inline-flex;align-items:center;gap:5px;height:24px;padding:0 10px;border-radius:999px;border:1px solid var(--k-g2);font:500 9px var(--k-m);letter-spacing:.1em;color:var(--k-muted);white-space:nowrap}
.keu__pill svg{width:11px;height:11px;stroke-width:3;stroke:var(--k-ok)}
.keu__pill.done{border-color:transparent;background:var(--k-g1);color:var(--k-ink)}
.keu__pill.fill{border-color:var(--k-ink);background:var(--k-ink);color:#F4F3F0}
.keu__pill.line{border-color:var(--k-ink);color:var(--k-ink)}
.keu__pill.dash{border-style:dashed;border-color:var(--k-ink);color:var(--k-ink)}
/* elegir comida */
.keu__pk{display:flex;flex-direction:column;gap:8px}
.keu__pk button{display:grid;grid-template-columns:44px minmax(0,1fr) auto;align-items:center;gap:12px;min-height:70px;padding:10px 14px 10px 12px;border-radius:18px;border:1px solid var(--k-line);background:var(--k-raised);color:var(--k-ink);text-align:left;cursor:pointer}
.keu__pk em{width:44px;height:44px;border-radius:999px;border:1.5px solid var(--k-ink);display:flex;align-items:center;justify-content:center;font:500 13px var(--k-m);font-style:normal}
.keu__pk button.ok em{background:var(--k-ink);color:#F4F3F0}
.keu__pk b{display:block;font:700 17px/1.2 var(--k-d);letter-spacing:-.01em}
.keu__pk small{display:block;margin-top:2px;font:500 10px var(--k-m);letter-spacing:.1em;color:var(--k-muted)}
/* guía de foto */
.keu__gd{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}
.keu__gd div{display:flex;flex-direction:column;align-items:center;gap:10px;padding:18px 8px 14px;border-radius:18px;background:var(--k-raised);border:1px solid var(--k-line);text-align:center;font:600 13px/1.25 var(--k-d)}
.keu__gd svg{width:30px;height:30px;stroke-width:1.6}
.keu__nota{margin:2px 4px 0;font:500 9px/1.6 var(--k-m);letter-spacing:.1em;color:var(--k-muted);text-transform:uppercase}
/* foto */
.keu__ph{position:relative;margin:16px 20px 0;border-radius:26px;overflow:hidden;background:#1E1F22}
.keu__ph img{display:block;width:100%;max-height:40vh;object-fit:contain;margin:0 auto}
.keu__ph.sm img{max-height:34vh}
.keu__zs{position:absolute;inset:0;margin:0 auto}
.keu__z{position:absolute;border:1.5px dashed rgba(244,243,240,.75);border-radius:14px;background:none;padding:0;cursor:pointer}
.keu__z.on{border:2.5px solid #F4F3F0;background:rgba(244,243,240,.14)}
.keu__z i{position:absolute;left:6px;top:6px;min-width:22px;height:22px;border-radius:999px;background:rgba(18,18,18,.78);color:#F4F3F0;font:500 10px/22px var(--k-m);font-style:normal;text-align:center}
.keu__z.on i{background:#F4F3F0;color:var(--k-ink)}
.keu__z.dud i{background:#F4F3F0;color:var(--k-ink);outline:2px solid var(--k-ink)}
.keu__scan{position:absolute;left:0;right:0;height:3px;background:linear-gradient(90deg,transparent,#F4F3F0,transparent);box-shadow:0 0 18px 4px rgba(244,243,240,.45);animation:keuScan 1.6s ease-in-out infinite alternate}
@keyframes keuScan{from{top:6%}to{top:92%}}
.keu__load{position:absolute;left:50%;bottom:16px;transform:translateX(-50%);padding:9px 14px;border-radius:999px;background:rgba(18,18,18,.82);color:#F4F3F0;font:500 10px var(--k-m);letter-spacing:.14em;white-space:nowrap}
.keu__wait{margin:40px 24px 0;text-align:center;font:500 10px var(--k-m);letter-spacing:.16em;color:var(--k-muted)}
.keu__wait i{display:block;width:44px;height:44px;margin:0 auto 16px;border-radius:999px;border:3px solid var(--k-g1);border-top-color:var(--k-ink);animation:keuSpin .9s linear infinite}
@keyframes keuSpin{to{transform:rotate(360deg)}}
/* cocción y detalle */
.keu__co{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}
.keu__co button{min-height:52px;padding:8px 12px;border-radius:12px;border:1px solid var(--k-line);background:var(--k-raised);color:var(--k-ink);font:600 14px/1.2 var(--k-d);text-align:left;cursor:pointer}
.keu__co button[aria-pressed="true"]{background:var(--k-ink);border-color:var(--k-ink);color:#F4F3F0}
.keu__in{width:100%;min-height:52px;border-radius:12px;border:1px solid var(--k-g2);background:var(--k-raised);padding:14px;font:400 16px/1.4 var(--k-d);color:var(--k-ink);resize:none}
.keu__in::placeholder{color:var(--k-faint)}
.keu__in:focus{outline:2px solid var(--k-ink);outline-offset:0;border-color:var(--k-ink)}
/* resultado */
.keu__ms{display:flex;gap:4px;margin:14px 20px 0;padding:4px;border-radius:999px;background:var(--k-g1);overflow-x:auto;scrollbar-width:none}
.keu__ms::-webkit-scrollbar{display:none}
.keu__ms button{flex:1 0 auto;min-width:64px;height:40px;padding:0 12px;border:0;border-radius:999px;background:transparent;color:var(--k-muted);font:500 9px var(--k-m);letter-spacing:.1em;white-space:nowrap;cursor:pointer}
.keu__ms button[aria-pressed="true"]{background:var(--k-ink);color:#F4F3F0}
.keu__en .r{display:flex;align-items:baseline;gap:8px;margin-top:10px}
.keu__en .r b{font:700 46px/.9 var(--k-d);letter-spacing:-.04em}
.keu__en .r span{font:500 10px var(--k-m);letter-spacing:.12em;color:var(--k-muted)}
.keu__mt{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;margin-top:16px}
.keu__mt b{display:block;font:700 17px var(--k-d);letter-spacing:-.01em}
.keu__mt b small{font:400 12px var(--k-d);color:var(--k-muted)}
.keu__mt i{display:block;position:relative;height:5px;margin:6px 0 5px;border-radius:4px;background:var(--k-g1);overflow:hidden}
.keu__mt i s{display:block;height:100%;border-radius:4px;background:var(--k-ink);text-decoration:none}
.keu__mt span{font:500 9px var(--k-m);letter-spacing:.1em;color:var(--k-muted)}
.keu__mt span.over{color:var(--k-ink)}
.keu__vd{display:grid;grid-template-columns:40px minmax(0,1fr) auto;gap:12px;align-items:start;margin-top:16px;padding-top:16px;border-top:1px solid var(--k-line)}
.keu__vd .ic{width:40px;height:40px;border-radius:999px;border:1.5px solid var(--k-ink);display:flex;align-items:center;justify-content:center}
.keu__vd .ic svg{width:20px;height:20px;stroke-width:2.6}
.keu__vd--adecuado .ic{border-color:var(--k-ok);color:var(--k-ok)}
.keu__vd--alerta .ic{background:var(--k-ink);color:#F4F3F0}
.keu__vd b{display:block;font:700 18px/1.2 var(--k-d);letter-spacing:-.01em}
.keu__vd p{margin:4px 0 0;font:400 14px/1.4 var(--k-d);color:var(--k-muted)}
.keu__vd em{font:500 22px var(--k-m);font-style:normal;letter-spacing:-.03em;text-align:right;line-height:1}
.keu__vd em small{display:block;margin-top:4px;font-size:9px;letter-spacing:.1em;color:var(--k-muted)}
.keu__cm{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:10px;align-items:center;padding:12px 0;border-top:1px solid var(--k-line);font:400 14.5px/1.4 var(--k-d)}
.keu__cm:first-of-type{border-top:0;padding-top:4px}
.keu__cm b{font-weight:700}
.keu__inf{background:var(--k-ink);color:#F4F3F0;border-radius:26px;padding:18px}
.keu__inf .keu__lbl{color:#A7A9AE}
.keu__inf div{display:flex;justify-content:space-between;align-items:baseline;gap:10px;padding:10px 0;border-top:1px solid rgba(244,243,240,.12);font:600 15px var(--k-d)}
.keu__inf div:first-of-type{border-top:0}
.keu__inf div span{font:500 9px var(--k-m);letter-spacing:.1em;color:#C9CDD3;text-align:right}
.keu__rv{display:flex;align-items:center;gap:10px;margin:8px 0 2px;padding:12px 14px;border-radius:12px;border:1.5px dashed var(--k-ink);font:600 14px/1.35 var(--k-d)}
.keu__rv svg{width:18px;height:18px;flex-shrink:0}
.keu__ed{padding:14px 0;border-top:1px solid var(--k-line)}
.keu__ed:first-of-type{border-top:0}
.keu__ed.dud{margin:0 -10px;padding:14px 10px;border-radius:14px;border-top-color:transparent;background:var(--k-g1)}
.keu__ed+.keu__ed.dud,.keu__ed.dud+.keu__ed{border-top-color:transparent}
.keu__eh{display:grid;grid-template-columns:28px minmax(0,1fr) 40px;gap:8px;align-items:center}
.keu__eh>em{width:28px;height:28px;border-radius:999px;border:1.5px solid var(--k-ink);font:500 10px/25px var(--k-m);font-style:normal;text-align:center}
.keu__ed.on .keu__eh>em{background:var(--k-ink);color:#F4F3F0}
.keu__eh input{width:100%;min-width:0;height:44px;border-radius:12px;border:1px solid transparent;background:transparent;padding:0 8px;font:700 16px var(--k-d);color:var(--k-ink)}
.keu__eh input:hover{border-color:var(--k-g2)}
.keu__eh input:focus{outline:none;border-color:var(--k-ink);background:var(--k-raised)}
.keu__eh button{width:40px;height:40px;border-radius:999px;border:0;background:transparent;color:var(--k-muted);display:flex;align-items:center;justify-content:center;cursor:pointer}
.keu__eh button svg{width:16px;height:16px}
.keu__tg{display:flex;flex-wrap:wrap;gap:6px;margin:6px 0 0 36px}
.keu__st2{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin:10px 0 0 36px}
.keu__stp{display:inline-flex;align-items:center;border:1px solid var(--k-g2);border-radius:12px;background:var(--k-raised);overflow:hidden}
.keu__stp button{width:44px;height:44px;border:0;background:transparent;color:var(--k-ink);font:500 20px var(--k-m);cursor:pointer}
.keu__stp label{display:flex;align-items:baseline;gap:2px;padding:0 2px}
.keu__stp input{width:52px;height:44px;border:0;background:transparent;text-align:right;font:500 15px var(--k-m);color:var(--k-ink);-moz-appearance:textfield}
.keu__stp input::-webkit-outer-spin-button,.keu__stp input::-webkit-inner-spin-button{-webkit-appearance:none;margin:0}
.keu__stp label span{font:500 11px var(--k-m);color:var(--k-muted);padding-right:4px}
.keu__md{font:600 15px var(--k-d)}
.keu__eq{height:32px;padding:0 10px;border-radius:999px;border:1px solid var(--k-ink);background:transparent;font:500 9px var(--k-m);letter-spacing:.1em;color:var(--k-ink);cursor:pointer}
.keu__mac{margin:8px 0 0 36px;font:500 10px var(--k-m);letter-spacing:.04em;color:var(--k-muted)}
.keu__add{margin-top:10px;width:100%;height:48px;border-radius:12px;border:1px dashed var(--k-g2);background:transparent;font:500 10px var(--k-m);letter-spacing:.14em;color:var(--k-ink);cursor:pointer}
.keu__txt{margin:10px 0 0;font:400 13px/1.45 var(--k-d);color:var(--k-muted)}
.keu__bt{display:flex;flex-direction:column;gap:8px;padding:20px 20px 0}
.keu__err{padding:26px 24px 0;text-align:center}
.keu__err b{display:block;font:700 22px/1.2 var(--k-d);letter-spacing:-.02em}
.keu__err p{margin:8px 0 0;font:400 15px/1.45 var(--k-d);color:var(--k-muted)}
.keu__sts{min-height:16px;margin:12px 20px 0;text-align:center;font:500 10px var(--k-m);letter-spacing:.1em;color:var(--k-muted)}
.keu__ok{padding:48px 24px 0;text-align:center}
.keu__ok .ic{width:76px;height:76px;margin:0 auto 20px;border-radius:999px;border:2px solid var(--k-ok);color:var(--k-ok);display:flex;align-items:center;justify-content:center}
.keu__ok .ic.ch{border-color:var(--k-ink);background:var(--k-ink);color:#F4F3F0}
.keu__ok .ic svg{width:38px;height:38px;stroke-width:2.6}
.keu__ok b{display:block;font:700 30px/1.05 var(--k-d);letter-spacing:-.03em}
.keu__ok p{margin:10px 0 0;font:400 15px/1.45 var(--k-d);color:var(--k-muted)}
.keu__ok .keu__lbl{margin-top:14px}
.keu__sug{display:block;margin-top:8px;font:600 14px/1.4 var(--k-d);color:var(--k-ink)}
.keu__mm{border:1.5px dashed var(--k-ink);border-radius:18px;padding:14px 16px;display:flex;flex-direction:column;gap:10px}
.keu__mm b{font:700 16px/1.3 var(--k-d)}
.keu__mm div{display:flex;gap:8px;flex-wrap:wrap}
.keu__mm button{min-height:40px;padding:0 14px;border-radius:12px;border:1px solid var(--k-ink);background:transparent;color:var(--k-ink);font:500 9.5px var(--k-m);letter-spacing:.1em;cursor:pointer}
.keu__mm button:first-child{background:var(--k-ink);color:#F4F3F0}
.keu__pc{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:4px;margin-top:10px;padding:4px;border-radius:999px;background:var(--k-g1)}
.keu__pc button{height:38px;border:0;border-radius:999px;background:transparent;color:var(--k-muted);font:500 11px var(--k-m);letter-spacing:.06em;cursor:pointer}
.keu__pc button[aria-pressed="true"]{background:var(--k-ink);color:#F4F3F0}
.keu__err .ic{width:64px;height:64px;margin:0 auto 18px;border-radius:999px;border:1.5px solid var(--k-ink);display:flex;align-items:center;justify-content:center}
.keu__err .ic svg{width:28px;height:28px}
.keu__err .keu__gd{margin-top:20px;text-align:center}
@media (prefers-reduced-motion:reduce){.keu__scan{animation:none;top:50%}.keu__wait i{animation:none}}
/* Superficie de marca (metal gris) para registro y avisos */
.keu.keu--tex .keu__sc{background:#9A9A9A url('/img/bg/nutri-plan.webp') center/cover no-repeat}
.keu__win,.keu__av{padding:16px 16px 0}
.keu__wt,.keu__avc{position:relative;background:linear-gradient(180deg,#FFFFFF 0%,#F4F4F2 60%,#ECECEA 100%);border-radius:24px 24px 8px 8px;padding:18px 18px 26px;box-shadow:0 20px 44px rgba(18,18,18,.22);
  -webkit-mask:conic-gradient(from -45deg at bottom,#0000,#000 1deg 89deg,#0000 90deg) 50% / 18px 100%;mask:conic-gradient(from -45deg at bottom,#0000,#000 1deg 89deg,#0000 90deg) 50% / 18px 100%;animation:keuPop .5s cubic-bezier(.2,.8,.2,1) both}
@keyframes keuPop{from{opacity:0;transform:translateY(18px) scale(.98)}}
.keu__wh{display:flex;justify-content:space-between;align-items:center;gap:10px;padding-bottom:12px;border-bottom:1.5px solid #121212;font:700 10px var(--k-m);letter-spacing:.14em}
.keu__wok{display:inline-flex;align-items:center;gap:6px;padding:6px 10px;border-radius:999px;background:#3EC6B0;color:#04363B}.keu__wok svg{width:14px;height:14px;stroke-width:3}
.keu__wok.ch{background:#121212;color:#F4F3F0}
.keu__wp{position:relative;margin-top:14px;height:150px;border-radius:14px;overflow:hidden;background:#1E1F22}.keu__wp img{width:100%;height:100%;object-fit:cover;display:block}
.keu__wp span{position:absolute;left:10px;bottom:10px;padding:6px 10px;border-radius:999px;background:rgba(18,18,18,.85);color:#F4F3F0;font:700 9.5px var(--k-m);letter-spacing:.14em}
.keu__wn{margin-top:16px;font:900 44px/.9 var(--k-d);font-stretch:118%;text-transform:uppercase;letter-spacing:-.02em}.keu__wn small{display:block;margin-top:4px;font:700 10px var(--k-m);letter-spacing:.16em;color:var(--k-muted)}
.keu__wl{display:block;margin-top:16px;font:700 9.5px var(--k-m);letter-spacing:.16em;color:var(--k-muted)}
.keu__wk{display:flex;align-items:flex-end;gap:10px;margin-top:4px}.keu__wk b{font:700 clamp(64px,21vw,88px)/.82 var(--k-m);letter-spacing:-.07em}.keu__wk span{padding-bottom:6px;font:700 11px/1.3 var(--k-m);letter-spacing:.08em;color:var(--k-muted)}
.keu__wb{height:12px;margin-top:14px;border-radius:4px;background:rgba(18,18,18,.08);overflow:hidden}.keu__wb s{display:block;height:100%;background:linear-gradient(90deg,#1E8F9A,#3EC6B0);text-decoration:none;box-shadow:0 0 10px rgba(43,179,192,.55);animation:keuW 1.3s cubic-bezier(.2,.8,.2,1) .2s both}
@keyframes keuW{from{width:0}}
.keu__wbp{display:flex;justify-content:space-between;gap:10px;margin-top:8px;font:700 9.5px var(--k-m);letter-spacing:.1em;color:var(--k-muted)}.keu__wbp span:last-child{color:#121212}.keu__wbp i{font-style:normal}
.keu__wm{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;margin-top:18px;padding-top:16px;border-top:2px dashed var(--k-g2)}
.keu__wm span{display:block;font:700 9px var(--k-m);letter-spacing:.12em;color:var(--k-muted)}
.keu__wm b{display:block;margin-top:6px;font:700 30px/1 var(--k-m);letter-spacing:-.05em}.keu__wm b i{font-style:normal}.keu__wm b small{font-size:11px;margin-left:2px;letter-spacing:0;color:var(--k-muted)}
.keu__wm em{display:block;height:6px;margin-top:8px;border-radius:3px;background:rgba(18,18,18,.1);overflow:hidden}.keu__wm em s{display:block;height:100%;background:#121212;text-decoration:none;animation:keuW 1.2s cubic-bezier(.2,.8,.2,1) .4s both}
.keu__wm>div>small{display:block;margin-top:5px;font:400 8.5px var(--k-m);letter-spacing:.08em;color:var(--k-faint)}
.keu__wx{margin:16px 0 0;font:400 14px/1.45 var(--k-d);color:#3F3F3C}
.keu__wf,.keu__avb{display:flex;flex-direction:column;align-items:center;gap:6px;margin-top:16px;padding-top:14px;border-top:1.5px solid #121212}
.keu__wf svg,.keu__avb svg{width:100%;height:34px;fill:#121212}.keu__wf span,.keu__avb span{font:700 9px var(--k-m);letter-spacing:.16em}
.keu--tex .keu__bt{padding-top:14px}
.keu--tex .keu__sec{background:rgba(251,250,248,.85)}
/* aviso */
.keu__avc{text-align:center}
.keu__avf{position:relative;height:220px;margin:-2px -2px 16px;border-radius:16px;overflow:hidden;background:#1E1F22}
.keu__avf img{width:100%;height:100%;object-fit:cover;filter:grayscale(.6) contrast(1.05) brightness(.8)}
.keu__avf i{position:absolute;width:22px;height:22px;border:2.5px solid #F4F3F0}.keu__avf .tl{left:10px;top:10px;border-right:0;border-bottom:0}.keu__avf .tr{right:10px;top:10px;border-left:0;border-bottom:0}.keu__avf .bl{left:10px;bottom:10px;border-right:0;border-top:0}.keu__avf .br{right:10px;bottom:10px;border-left:0;border-top:0}
.keu__avs{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%) rotate(-6deg);padding:10px 16px;border:3px solid #F4F3F0;border-radius:8px;background:rgba(18,18,18,.55);color:#F4F3F0;font:900 20px/1 var(--k-d);font-stretch:118%;letter-spacing:.02em;white-space:nowrap}
.keu__avk{display:block;font:700 9px var(--k-m);letter-spacing:.16em;color:var(--k-muted)}
.keu__avc>b{display:block;margin-top:8px;font:900 24px/1.05 var(--k-d);letter-spacing:-.01em;text-wrap:balance}
.keu__avc>p{margin:10px 0 0;font:400 14.5px/1.45 var(--k-d);color:#3F3F3C}
.keu__avc .ic{width:64px;height:64px;margin:6px auto 14px;border-radius:50%;background:#121212;color:#F4F3F0;display:flex;align-items:center;justify-content:center}.keu__avc .ic svg{width:28px;height:28px}
@media (prefers-reduced-motion:reduce){.keu__wt,.keu__avc,.keu__wb s,.keu__wm em s{animation:none}}
.keu__pkx{border-style:dashed!important;background:transparent!important}.keu__pkx em{border-style:dashed!important}
.keu__nq{margin:0 0 4px;padding:14px;border-radius:18px;background:#121212;color:#F4F3F0}
.keu__nqh{display:grid;grid-template-columns:40px 1fr;gap:12px;align-items:start}
.keu__nqh i{width:40px;height:40px;border-radius:50%;background:#FF4200;display:flex;align-items:center;justify-content:center}.keu__nqh i svg{width:20px;height:20px;stroke:#FFFFFF;stroke-width:3}
.keu__nqh b{display:block;font:700 16px/1.2 var(--k-d)}.keu__nqh span{display:block;margin-top:4px;font:400 13.5px/1.4 var(--k-d);color:#C9C8C3}
.keu__nqt{display:flex;flex-wrap:wrap;gap:6px;margin-top:12px}.keu__nqt span{padding:6px 10px;border-radius:999px;background:#262626;font:700 10px var(--k-m);letter-spacing:.08em}
.keu__nqt span:first-child{background:#F4F3F0;color:#121212}
.keu__wb--x s{background:linear-gradient(90deg,#C23300,#FF4200)!important;box-shadow:0 0 10px rgba(255,66,0,.5)!important}
.keu__cta--x{background:#FF4200!important;color:#FFFFFF!important}
.keu__wok.ch{background:#FF4200!important;color:#FFFFFF!important}
/* Lectura (resultado del escáner) en el mismo lenguaje del ticket de registro */
.keu__pad--r{padding-top:16px}
.keu__wt--r{margin-bottom:14px}
.keu__wt--r:not(.keu__wt--a),.keu__wt--r:not(.keu__wt--a) .keu__wb s,.keu__wt--r:not(.keu__wt--a) .keu__wm em s{animation:none}
.keu__wph{margin-top:14px}.keu__wph .keu__ph{margin:0;border-radius:14px;background:transparent}   /* c250 · bordes sobrantes de la foto en el tono del ticket, sin franjas negras */
.keu__wm em s.ov{background:#FF4200}
.keu__wv{margin-top:16px;padding:12px 14px;border-radius:14px;background:#121212;color:#F4F3F0}
.keu__wv b{display:block;font:700 15px/1.25 var(--k-d)}.keu__wv p{margin:4px 0 0;font:400 13.5px/1.45 var(--k-d);color:#C9C8C3}
.keu__wv .keu__sug{display:block;margin-top:8px;color:#7FD6DD;font:700 10px/1.4 var(--k-m);letter-spacing:.06em}
.keu__wv.x{border-left:4px solid #FF4200}
.keu--tex .keu__card{box-shadow:0 10px 26px rgba(18,18,18,.12)}
.keu--tex .keu__ms button{background:rgba(251,250,248,.9)}
/* macros con color propio: proteína calipso · carbos carbón · grasas naranjo */
.keu__wm span u{display:inline-block;width:8px;height:8px;margin-right:6px;border-radius:2px;vertical-align:0}
.keu__mp span u,.keu__mp em s,.keu__kp{background:#3EC6B0!important}
.keu__mc span u,.keu__mc em s,.keu__kc{background:#121212!important}
.keu__mg span u,.keu__mg em s,.keu__kg{background:#E07A3F!important}
.keu__wb--3{position:relative;display:flex;gap:2px;overflow:visible;background:rgba(18,18,18,.08)}
.keu__wb--3 s{display:block;height:100%;border-radius:3px;text-decoration:none;box-shadow:none!important;animation:keuW 1.2s cubic-bezier(.2,.8,.2,1) .2s both}
.keu__wb--3 s:nth-child(2){animation-delay:.35s}.keu__wb--3 s:nth-child(3){animation-delay:.5s}
.keu__wbo{position:absolute;top:-4px;bottom:-4px;width:2px;background:#FF4200;border-radius:1px}
.keu__wt--r:not(.keu__wt--a) .keu__wb--3 s{animation:none}
.keu__bt--top{padding:0 0 12px}
.keu__pad--r .keu__sts:empty{display:none}
/* Lectura en curso · pantalla negra tipo escáner */
.keu.keu--hud{background:#050505}
.keu--hud .keu__sc{background:#050505}
.keu__hud{min-height:100%;padding:12px 16px 28px;background:#050505 radial-gradient(120% 70% at 50% 0%,#1A1A1A 0%,#050505 60%);color:#E9E8E4;font-family:var(--k-m);position:relative;overflow:hidden}
.keu__hud::before{content:'';position:absolute;inset:0;background:repeating-linear-gradient(0deg,rgba(255,255,255,.025) 0 1px,transparent 1px 3px);pointer-events:none}
.keu__hh{display:flex;justify-content:space-between;align-items:center;font:700 9.5px var(--k-m);letter-spacing:.16em;color:#A7A9AE;margin:2px 2px 10px}
.keu__hh span:first-child{display:flex;align-items:center;gap:8px}
.keu__rec{width:7px;height:7px;border-radius:50%;background:#E9E8E4;box-shadow:0 0 8px #E9E8E4;animation:keuBl 1s steps(2) infinite}
@keyframes keuBl{50%{opacity:.15}}
.keu__hv{position:relative;aspect-ratio:1/1;max-height:46vh;width:100%;margin:0 auto;border-radius:6px;overflow:hidden;background:#111}
.keu__hv img{width:100%;height:100%;object-fit:cover;display:block;filter:grayscale(.55) contrast(1.15) brightness(.78)}
.keu__hv--t{aspect-ratio:auto;min-height:140px;display:flex;align-items:center;padding:20px;border:1px solid rgba(233,232,228,.18)}
.keu__hv--t b{font:400 15px/1.5 var(--k-m);color:#E9E8E4}
.keu__grid{position:absolute;inset:0;background-image:linear-gradient(rgba(233,232,228,.09) 1px,transparent 1px),linear-gradient(90deg,rgba(233,232,228,.09) 1px,transparent 1px);background-size:24px 24px}
.keu__bx{position:absolute;border:1.5px solid rgba(233,232,228,.9);opacity:0;animation:keuBx 2.8s ease-in-out infinite}
.keu__bx em{position:absolute;left:-1.5px;top:-17px;padding:2px 5px;background:#E9E8E4;color:#050505;font:700 8px var(--k-m);letter-spacing:.1em;font-style:normal}
@keyframes keuBx{0%{opacity:0;transform:scale(1.08)}15%,70%{opacity:1;transform:none}100%{opacity:0}}
.keu__cr{position:absolute;width:26px;height:26px;border:2.5px solid #E9E8E4}
.keu__cr.tl{left:10px;top:10px;border-right:0;border-bottom:0}.keu__cr.tr{right:10px;top:10px;border-left:0;border-bottom:0}
.keu__cr.bl{left:10px;bottom:10px;border-right:0;border-top:0}.keu__cr.br{right:10px;bottom:10px;border-left:0;border-top:0}
.keu__hv .keu__scan{height:2px;background:linear-gradient(90deg,transparent,#FFFFFF,transparent);box-shadow:0 0 24px 6px rgba(255,255,255,.35)}
.keu__ret{position:absolute;left:50%;top:50%;width:46px;height:46px;transform:translate(-50%,-50%);border:1px solid rgba(233,232,228,.6);border-radius:50%}
.keu__ret::before,.keu__ret::after{content:'';position:absolute;background:rgba(233,232,228,.6)}.keu__ret::before{left:50%;top:-10px;bottom:-10px;width:1px}.keu__ret::after{top:50%;left:-10px;right:-10px;height:1px}
.keu__hm{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:6px;margin-top:14px}
.keu__hm div{padding:10px 8px;border:1px solid rgba(233,232,228,.16);border-radius:6px;background:rgba(255,255,255,.03)}
.keu__hm span{display:block;font:700 8.5px var(--k-m);letter-spacing:.16em;color:#8E8D88}
.keu__hm b{display:block;margin-top:4px;font:700 22px/1 var(--k-m);letter-spacing:-.02em;color:#F4F3F0}
.keu__hb{height:3px;margin-top:14px;background:rgba(233,232,228,.12);border-radius:2px;overflow:hidden}.keu__hb i{display:block;height:100%;width:0;background:#E9E8E4;transition:width .2s linear}
.keu__hp{list-style:none;margin:14px 0 0;padding:0}
.keu__hp li{display:grid;grid-template-columns:28px 1fr auto;align-items:center;gap:8px;padding:7px 0;border-bottom:1px solid rgba(233,232,228,.07);font:700 10px var(--k-m);letter-spacing:.12em;color:#5E5D59}
.keu__hp li span{color:inherit}
.keu__hp li.on{color:#F4F3F0}.keu__hp li.on em::after{content:'▌';animation:keuBl .6s steps(2) infinite}
.keu__hp li.ok{color:#A7A9AE}.keu__hp li.ok em::after{content:'OK';font-style:normal;color:#E9E8E4}
.keu__hp em{font-style:normal}
.keu__hl{margin-top:12px;height:126px;overflow:hidden;font:400 9.5px/14px var(--k-m);letter-spacing:.04em;color:#6E6D69;white-space:nowrap;-webkit-mask:linear-gradient(transparent,#000 40%);mask:linear-gradient(transparent,#000 40%)}
.keu__hl div:last-child{color:#E9E8E4}
.keu__sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)}
@media (prefers-reduced-motion:reduce){.keu__bx,.keu__rec{animation:none;opacity:1}}

/* c249 · GUÍA DE CAPTURA en capa HUD (misma gramática que la lectura): texto dominante + escena animada en loop de 9 s
   01 DESDE ARRIBA (el teléfono baja y encuadra) · 02 CON BUENA LUZ (sol + cono de luz) · 03 TODO EL PLATO (esquinas cierran + barrido) */
.keu__gx{position:relative;min-height:100%;padding:18px 20px 28px;background:#050505 radial-gradient(120% 60% at 50% 0%,#1C1D20 0%,#050505 62%);color:#E9E8E4;overflow:clip}
.keu__gx::before{content:'';position:absolute;inset:0;background:repeating-linear-gradient(0deg,rgba(255,255,255,.025) 0 1px,transparent 1px 3px);pointer-events:none}
.keu__gx>*{position:relative}
.keu__gh{display:flex;justify-content:space-between;align-items:center;font:700 9.5px var(--k-m);letter-spacing:.16em;color:#A7A9AE}
.keu__gh span:first-child{display:flex;align-items:center;gap:8px}
.keu__gx h2{margin:14px 0 0;font:800 clamp(34px,10vw,44px)/.95 var(--k-d);letter-spacing:-.035em;color:#FFFFFF;text-wrap:balance}
.keu__gx>p{margin:10px 0 0;font:400 14.5px/1.45 var(--k-d);color:#A7A9AE;max-width:36ch}
.keu__pp{display:flex;align-items:center;gap:6px;margin-top:14px;font:700 8.5px var(--k-m);letter-spacing:.14em;color:#8E8D88;flex-wrap:wrap}
.keu__pp b{color:#E9E8E4;font-weight:700}.keu__pp i{font-style:normal;color:#5E5D59}
.keu__st{position:relative;margin:16px auto 0;width:min(100%,330px);aspect-ratio:1/1;border:1px solid rgba(233,232,228,.14);border-radius:8px;overflow:hidden;
  background:#080809;background-image:linear-gradient(rgba(233,232,228,.07) 1px,transparent 1px),linear-gradient(90deg,rgba(233,232,228,.07) 1px,transparent 1px);background-size:22px 22px}
.keu__st svg{position:absolute;inset:0;width:100%;height:100%;overflow:visible}
.keu__st .ln{fill:none;stroke:#E9E8E4;stroke-linecap:round;stroke-linejoin:round}
.keu__st *{transform-box:fill-box;transform-origin:center}
.kg-ring{animation:kgRot 14s linear infinite}
.kg-ring2{animation:kgRot 22s linear infinite reverse}
.kg-food{animation:kgFood 9s ease-in-out infinite}
.kg-ph{animation:kgPh 9s cubic-bezier(.3,.8,.3,1) infinite}
.kg-ar{animation:kgAr 9s ease-in-out infinite}
.kg-sun{animation:kgSun 9s ease-in-out infinite}
.kg-sun .ry{animation:kgRot 6s linear infinite}
.kg-cone{animation:kgCone 9s ease-in-out infinite}
.kg-cr{animation:kgCr 9s cubic-bezier(.2,.8,.2,1) infinite}
.kg-sc{animation:kgSc 9s linear infinite}
.kg-ok{animation:kgOk 9s ease-out infinite}
@keyframes kgRot{to{transform:rotate(360deg)}}
@keyframes kgFood{0%,33%{opacity:.55}40%,63%{opacity:1}70%,100%{opacity:.9}}
@keyframes kgPh{0%{opacity:0;transform:translateY(-70px) scale(.92)}10%,28%{opacity:1;transform:none}36%,100%{opacity:.18;transform:none}}
@keyframes kgAr{0%,3%{opacity:0;transform:translateY(-10px)}10%,26%{opacity:1;transform:translateY(6px)}33%,100%{opacity:0}}
@keyframes kgSun{0%,33%{opacity:0;transform:scale(.6)}40%,62%{opacity:1;transform:scale(1)}70%,100%{opacity:.25;transform:scale(.9)}}
@keyframes kgCone{0%,33%{opacity:0}42%,62%{opacity:.5}70%,100%{opacity:.12}}
@keyframes kgCr{0%,64%{opacity:0;transform:scale(1.35)}72%,100%{opacity:1;transform:scale(1)}}
@keyframes kgSc{0%,70%{opacity:0;transform:translateY(-120px)}73%{opacity:1}92%{opacity:1;transform:translateY(120px)}95%,100%{opacity:0;transform:translateY(120px)}}
@keyframes kgOk{0%,88%{opacity:0;transform:translateY(6px)}92%,100%{opacity:1;transform:none}}
.keu__cap{position:absolute;left:12px;right:12px;bottom:10px;height:16px;font:700 9.5px var(--k-m);letter-spacing:.18em;color:#F4F3F0}
.keu__cap span{position:absolute;left:0;right:0;opacity:0;animation:kgCap 9s steps(1) infinite}
.keu__cap span:nth-child(2){animation-delay:-6s}.keu__cap span:nth-child(3){animation-delay:-3s}
@keyframes kgCap{0%{opacity:1}33.33%,100%{opacity:0}}
.keu__tp{list-style:none;margin:14px 0 0;padding:0;display:grid;gap:2px}
.keu__tp li{display:grid;grid-template-columns:34px 1fr;gap:10px;align-items:start;padding:10px 12px;border-radius:10px;border:1px solid transparent;color:#6E6D69;animation:kgTip 9s steps(1) infinite}
.keu__tp li:nth-child(2){animation-delay:-6s}.keu__tp li:nth-child(3){animation-delay:-3s}
.keu__tp em{font:700 11px var(--k-m);letter-spacing:.08em;font-style:normal;padding-top:3px}
.keu__tp b{display:block;font:800 18px/1.1 var(--k-d);letter-spacing:-.02em}
.keu__tp small{display:block;margin-top:3px;font:400 12.5px/1.35 var(--k-d)}
@keyframes kgTip{0%{color:#F4F3F0;border-color:rgba(233,232,228,.22);background:rgba(255,255,255,.04)}33.33%,100%{color:#6E6D69;border-color:transparent;background:transparent}}
.keu__gx .keu__nota{margin:12px 2px 0;color:#8E8D88}
.keu__gx .keu__bt{position:sticky;bottom:calc(-48px - env(safe-area-inset-bottom,0px));z-index:2;margin:0 -20px -28px;padding:26px 20px calc(16px + 48px + env(safe-area-inset-bottom,0px));background:linear-gradient(rgba(5,5,5,0),#050505 22%)}
.keu__gx .keu__cta{background:#F4F3F0;color:#050505}
.keu__gx .keu__sec{border-color:rgba(233,232,228,.5);color:#F4F3F0}
.keu__gx .keu__lnk{color:#C9C8C3}
.keu__gx button:focus-visible{outline-color:#F4F3F0}
@media (prefers-reduced-motion:reduce){.keu__st *,.keu__tp li,.keu__cap span{animation:none!important}.kg-ph,.kg-cr,.kg-sun,.kg-cone{opacity:1;transform:none}.keu__cap span:first-child{opacity:1}}
/* c251 · RESULTADO TECH: barra de sistema, telemetría y botón de registro futurista (solo grises) */
.keu__sys{display:flex;align-items:center;gap:10px;margin:0 0 14px;padding:8px 12px;border-radius:12px;background:linear-gradient(180deg,#1B1C1F,#0E0F11);color:#C9CBD0;font:700 8.5px var(--k-m);letter-spacing:.14em;box-shadow:inset 0 1px 0 rgba(255,255,255,.08)}
.keu__sys img{height:12px;width:auto;display:block}
.keu__sys span{flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.keu__sys i{width:6px;height:6px;border-radius:50%;background:#E6E8EC;box-shadow:0 0 8px 2px rgba(230,232,236,.6);animation:keuPulse 1.6s ease-in-out infinite}
@keyframes keuPulse{50%{opacity:.25;box-shadow:none}}
.keu__tel{display:flex;flex-wrap:wrap;gap:6px 14px;margin-top:12px;padding-top:10px;border-top:1px dashed rgba(18,18,18,.18);font:600 8.5px var(--k-m);letter-spacing:.16em;color:#6B6E74;text-transform:uppercase}
.keu__tel b{color:#121212;font-weight:700}
.keu__cta.keu__cta--tech{position:relative;overflow:hidden;min-height:60px;border-radius:14px;background:linear-gradient(180deg,#2A2C30 0%,#0D0E10 100%);color:#F2F3F5;font:700 11.5px var(--k-m);letter-spacing:.18em;text-transform:uppercase;white-space:nowrap;border:1px solid #3A3D42;box-shadow:inset 0 1px 0 rgba(255,255,255,.14),0 14px 30px -14px rgba(0,0,0,.6);justify-content:space-between;padding:0 18px}
.keu__cta--tech::before{content:'';position:absolute;inset:0;background:linear-gradient(100deg,transparent 30%,rgba(255,255,255,.16) 50%,transparent 70%);transform:translateX(-120%);animation:keuSweep 2.8s cubic-bezier(.4,0,.2,1) infinite}
@keyframes keuSweep{60%,100%{transform:translateX(120%)}}
.keu__cta--tech .tk{display:flex;align-items:center;gap:10px}
.keu__cta--tech .tk i{width:8px;height:8px;border:1.5px solid #F2F3F5;border-radius:2px;transform:rotate(45deg)}
.keu__cta--tech .ar{display:flex;align-items:center;gap:8px;font-size:9px;letter-spacing:.2em;color:#9EA1A7}
.keu__cta--tech .ar svg{width:18px;height:18px;color:#F2F3F5}
.keu__cta--tech .cr{position:absolute;width:10px;height:10px;border-color:#BFC2C8;border-style:solid;opacity:.7}
.keu__cta--tech .cr.a{top:5px;left:5px;border-width:1.5px 0 0 1.5px}.keu__cta--tech .cr.b{bottom:5px;right:5px;border-width:0 1.5px 1.5px 0}
.keu__cta--tech:active{transform:scale(.985)}
@media (prefers-reduced-motion:reduce){.keu__cta--tech::before,.keu__sys i{animation:none}}
/* c252 · VÁLIDO / NO VÁLIDO con la paleta oficial: turquesa #3EC6B0 · rojo naranjo #FF4200 · negro #131313 · aluminio #ACACAC · off-white #E3E3E3 */
.keu .keu__sc.valido{background:linear-gradient(180deg,rgba(62,198,176,.92) 0,rgba(62,198,176,.55) 190px,rgba(62,198,176,0) 520px),#9A9A9A url('/img/bg/nutri-plan.webp') center/cover no-repeat}
.keu .keu__sc.alerta{background:linear-gradient(180deg,rgba(255,66,0,.95) 0,rgba(255,66,0,.6) 190px,rgba(255,66,0,0) 560px),#9A9A9A url('/img/bg/nutri-plan.webp') center/cover no-repeat}
.keu__al{display:flex;align-items:center;gap:10px;margin:0 0 12px;padding:10px 12px;border-radius:12px;color:#FFFFFF;font:700 9.5px var(--k-m);letter-spacing:.2em;background:repeating-linear-gradient(135deg,#FF4200 0 14px,#E63B00 14px 28px);box-shadow:0 8px 20px -10px rgba(255,66,0,.8)}
.keu__al svg{width:18px;height:18px;flex:none}
.keu__al b{white-space:nowrap}
.keu__al b{font-weight:700}.keu__al span{margin-left:auto;opacity:.85}
.alerta .keu__sys i{background:#FF4200;box-shadow:0 0 10px 2px rgba(255,66,0,.75)}
.valido .keu__sys i{background:#3EC6B0;box-shadow:0 0 10px 2px rgba(62,198,176,.75)}
.keu__dock{position:sticky;bottom:0;z-index:5;margin-top:18px;padding:12px 16px calc(12px + env(safe-area-inset-bottom,0px));background:linear-gradient(180deg,rgba(19,19,19,0),rgba(19,19,19,.88) 30%);display:flex;gap:10px;align-items:stretch}
.keu__dock button{flex:1;min-height:56px;border:0;border-radius:14px;display:flex;align-items:center;justify-content:center;gap:10px;font:700 11.5px var(--k-m);letter-spacing:.16em;text-transform:uppercase;cursor:pointer;color:#FFFFFF}
.keu__dock .ok{background:#131313;border:1px solid #3EC6B0;box-shadow:0 0 0 1px rgba(62,198,176,.25),0 12px 28px -12px rgba(62,198,176,.6)}
.keu__dock .ok u{background:#3EC6B0;color:#131313}
.keu__dock .ch{background:#FF4200;box-shadow:0 12px 28px -12px rgba(255,66,0,.9)}
.keu__dock .ch u{background:#FFFFFF;color:#FF4200}
.keu__dock u{display:flex;align-items:center;justify-content:center;width:26px;height:26px;border-radius:50%;text-decoration:none}
.keu__dock u svg{width:15px;height:15px;stroke-width:3}
.keu__dock button[disabled]{opacity:.45;cursor:default}
.keu__etb{margin-top:10px;display:inline-flex;align-items:center;gap:6px;padding:7px 11px;border-radius:999px;border:1px dashed #131313;background:transparent;font:700 9.5px var(--k-m);letter-spacing:.14em;color:#131313;cursor:pointer}
.keu__etb.on{background:#131313;color:#E3E3E3;border-style:solid}
.keu__et{margin-top:10px;padding:12px;border-radius:12px;background:#131313;color:#E3E3E3}
.keu__et p{margin:0 0 10px;font:600 9.5px/1.5 var(--k-m);letter-spacing:.1em;color:#ACACAC}
.keu__et .g{display:grid;grid-template-columns:repeat(2,1fr);gap:8px}
.keu__et label{display:flex;flex-direction:column;gap:4px;font:700 8.5px var(--k-m);letter-spacing:.14em;color:#ACACAC}
.keu__et input{width:100%;box-sizing:border-box;padding:10px;border-radius:10px;border:1px solid #3A3D42;background:#1E1F22;color:#FFFFFF;font:700 16px var(--k-m)}
.keu__et .b{margin-top:10px;width:100%;min-height:44px;border:0;border-radius:10px;background:#3EC6B0;color:#131313;font:700 10.5px var(--k-m);letter-spacing:.16em;cursor:pointer}
.keu__pill.etq{background:#131313;color:#3EC6B0}
.keu__sc:has(.keu__dock) .keu__bt .keu__cta{display:none}
/* c253 · CRISTAL: fondos de luz por estado, ticket translúcido, veredicto blanco con contorno de color, botones con contorno */
.keu .keu__sc.valido{background:radial-gradient(120% 55% at 15% 0%,rgba(62,198,176,.95) 0,rgba(62,198,176,.45) 45%,rgba(62,198,176,0) 75%),radial-gradient(70% 40% at 95% 8%,rgba(255,255,255,.75),rgba(255,255,255,0) 70%),radial-gradient(90% 50% at 60% 55%,rgba(62,198,176,.28),rgba(62,198,176,0) 70%),linear-gradient(160deg,rgba(227,227,227,.35),rgba(172,172,172,.15)),#9A9A9A url('/img/bg/nutri-plan.webp') center/cover no-repeat}
.keu .keu__sc.alerta{background:radial-gradient(120% 55% at 15% 0%,rgba(255,66,0,.95) 0,rgba(255,66,0,.5) 45%,rgba(255,66,0,0) 75%),radial-gradient(70% 40% at 95% 8%,rgba(255,255,255,.6),rgba(255,255,255,0) 70%),radial-gradient(90% 50% at 60% 55%,rgba(255,66,0,.25),rgba(255,66,0,0) 70%),linear-gradient(160deg,rgba(227,227,227,.35),rgba(172,172,172,.15)),#9A9A9A url('/img/bg/nutri-plan.webp') center/cover no-repeat}
.keu__sc.valido .keu__wt--r,.keu__sc.alerta .keu__wt--r{background:linear-gradient(180deg,rgba(255,255,255,.82) 0%,rgba(244,244,242,.7) 60%,rgba(236,236,234,.66) 100%);-webkit-backdrop-filter:blur(22px) saturate(1.5);backdrop-filter:blur(22px) saturate(1.5);box-shadow:inset 0 1px 0 rgba(255,255,255,.9),0 20px 44px rgba(19,19,19,.22)}
.keu__al{background:linear-gradient(135deg,rgba(255,66,0,.92),rgba(255,106,51,.78)),repeating-linear-gradient(135deg,rgba(255,255,255,.12) 0 12px,transparent 12px 24px);background-blend-mode:normal;border:1px solid rgba(255,255,255,.45);-webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px)}
.keu__wv{background:rgba(255,255,255,.78)!important;color:#131313!important;border:1.5px solid #ACACAC;border-left-width:5px;-webkit-backdrop-filter:blur(12px);backdrop-filter:blur(12px)}
.keu__wv b{color:#131313}.keu__wv p{color:#3D3E42!important}
.keu__wv.ok{border-color:#3EC6B0;box-shadow:0 0 0 3px rgba(62,198,176,.14),0 10px 24px -14px rgba(62,198,176,.7)}
.keu__wv.x{border-color:#FF4200;box-shadow:0 0 0 3px rgba(255,66,0,.12),0 10px 24px -14px rgba(255,66,0,.7)}
.keu__wv .keu__sug{color:#0E8F7C!important}
.keu__wv .keu__wq{margin-top:10px;padding-top:10px;border-top:1px dashed rgba(255,66,0,.45);font:600 13px/1.4 var(--k-d);color:#131313!important}
.keu__dock{background:linear-gradient(180deg,rgba(19,19,19,0),rgba(19,19,19,.55) 35%)}
.keu__dock button{-webkit-backdrop-filter:blur(16px) saturate(1.4);backdrop-filter:blur(16px) saturate(1.4)}
.keu__dock .ok{background:rgba(19,19,19,.72);border:1.5px solid #3EC6B0;box-shadow:inset 0 1px 0 rgba(255,255,255,.12),0 0 18px -4px rgba(62,198,176,.7)}
.keu__dock .ch{background:rgba(19,19,19,.72);border:1.5px solid #FF4200;box-shadow:inset 0 1px 0 rgba(255,255,255,.12),0 0 18px -4px rgba(255,66,0,.75)}
.keu__dock .ch u{background:#FF4200;color:#FFFFFF}
/* c254 · veredicto único arriba */
.keu__wt--r .keu__wv{margin-top:14px}
.keu__vs{display:flex;align-items:center;gap:7px;margin-bottom:6px;font:700 9.5px var(--k-m);letter-spacing:.2em}
.keu__vs svg{width:15px;height:15px;stroke-width:2.6}
.keu__wv.ok .keu__vs{color:#0E8F7C}.keu__wv.x .keu__vs{color:#FF4200}
.keu__wt--r .keu__wph{margin-top:14px}
.keu__wh span+span{color:#6B6E74;font-weight:600}
/* c255 · número + foto lado a lado */
.keu__wkr{display:grid;grid-template-columns:1fr 46%;gap:12px;align-items:end;margin-top:6px}
.keu__wkr.nf{grid-template-columns:1fr}
.keu__wkr .keu__wk{flex-direction:column;align-items:flex-start;gap:8px;margin:0}
.keu__wkr .keu__wk span{padding:0}
.keu__wph.keu__wph--s{margin:0}
.keu__wph--s .keu__ph{border-radius:14px}
.keu__wph--s .keu__ph img,.keu__wph--s .keu__ph.sm img{max-height:200px;width:100%;object-fit:contain}
/* c256 · HERO: foto central + calorías verticales */
.keu__det{display:flex;justify-content:space-between;align-items:baseline;gap:10px;margin-top:14px;font:700 9.5px var(--k-m);letter-spacing:.18em;color:#6B6E74}
.keu__det b{font:700 18px var(--k-m);letter-spacing:-.02em;color:#131313;white-space:nowrap}
.keu__det em{font-style:normal;font-size:11px;letter-spacing:.06em;color:#6B6E74}
.keu__dif{margin-top:8px;padding:8px 10px;border-radius:10px;font:700 9.5px var(--k-m);letter-spacing:.16em;border:1px solid #ACACAC;color:#131313;background:rgba(255,255,255,.6)}
.keu__dif.ok{border-color:#3EC6B0;color:#0E8F7C;background:rgba(62,198,176,.1)}
.keu__dif.x{border-color:#FF4200;color:#D93800;background:rgba(255,66,0,.08)}
.keu__hero{position:relative;margin-top:14px;padding-left:58px;min-height:220px}
.keu__hn{position:absolute;left:-4px;top:0;bottom:0;z-index:3;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;gap:8px;pointer-events:none}
.keu__hn b{writing-mode:vertical-rl;transform:rotate(180deg);font:700 clamp(96px,30vw,128px)/.78 var(--k-m);letter-spacing:-.07em;color:#131313;text-shadow:0 0 18px rgba(255,255,255,.65),0 0 2px rgba(255,255,255,.9)}
.keu__hn span{writing-mode:vertical-rl;transform:rotate(180deg);font:700 10px var(--k-m);letter-spacing:.3em;color:#131313;order:2}
.keu__wph.keu__wph--h{position:relative;margin:0;border-radius:16px;overflow:hidden;box-shadow:0 16px 34px -18px rgba(19,19,19,.55)}
.keu__wph--h .keu__ph{border-radius:16px;background:transparent}
.keu__wph--h .keu__ph img,.keu__wph--h .keu__ph.sm img{max-height:46vh;width:100%;object-fit:contain}
.keu__hs{position:absolute;left:0;right:0;top:0;height:3px;z-index:2;background:linear-gradient(90deg,transparent,#FFFFFF,transparent);box-shadow:0 0 18px 5px rgba(255,255,255,.55);animation:keuHs 1.2s cubic-bezier(.4,0,.2,1) .15s both;pointer-events:none}
.valido .keu__hs{background:linear-gradient(90deg,transparent,#3EC6B0,transparent);box-shadow:0 0 18px 5px rgba(62,198,176,.6)}
.alerta .keu__hs{background:linear-gradient(90deg,transparent,#FF4200,transparent);box-shadow:0 0 18px 5px rgba(255,66,0,.6)}
@keyframes keuHs{0%{top:0;opacity:1}85%{top:calc(100% - 3px);opacity:1}100%{top:calc(100% - 3px);opacity:0}}
@media (prefers-reduced-motion:reduce){.keu__hs{display:none}}
/* c257 · PALETA GRIS como base (#000000 · #434649 · #6F7377 · #979C9F); turquesa/rojo naranjo solo en contornos, check e información puntual */
.keu .keu__sc.valido,.keu .keu__sc.alerta{background:radial-gradient(110% 50% at 15% 0%,rgba(151,156,159,.95) 0,rgba(151,156,159,.4) 45%,rgba(151,156,159,0) 75%),radial-gradient(70% 40% at 95% 6%,rgba(255,255,255,.55),rgba(255,255,255,0) 70%),radial-gradient(90% 55% at 55% 60%,rgba(67,70,73,.35),rgba(67,70,73,0) 70%),linear-gradient(170deg,#979C9F 0%,#6F7377 55%,#434649 100%)}
.keu__wok{background:transparent!important;border:1.5px solid #3EC6B0;color:#0E8F7C!important}
.keu__wok.ch{background:transparent!important;border-color:#FF4200;color:#FF4200!important}
.keu__hs,.valido .keu__hs,.alerta .keu__hs{background:linear-gradient(90deg,transparent,#FFFFFF,transparent);box-shadow:0 0 18px 5px rgba(255,255,255,.55)}
/* foto sin marco: el contenedor no dibuja borde ni sombra, la esquina redondeada va en la imagen */
.keu__wph.keu__wph--h{border-radius:0;overflow:visible;box-shadow:none;background:transparent}
.keu__wph--h .keu__ph{border-radius:0;background:transparent;box-shadow:none;border:0;overflow:visible}
.keu__wph--h .keu__ph img,.keu__wph--h .keu__ph.sm img{border-radius:14px;box-shadow:0 14px 30px -18px rgba(0,0,0,.55)}
/* 310 KCAL: el número domina y KCAL crece y sube */
.keu__hn{justify-content:flex-end;gap:2px}
.keu__hn span{order:-1;font:700 clamp(24px,7.5vw,30px)/1 var(--k-m);letter-spacing:.04em;color:#131313;text-shadow:0 0 14px rgba(255,255,255,.6)}
`
// c249 · escena de la guía (viewBox 300): plato cenital con comida, anillos girando, teléfono que encuadra, sol + cono de luz, esquinas y barrido
const GSCENA = '<svg viewBox="0 0 300 300">' +
  '<defs><radialGradient id="kgL" cx="50%" cy="0%" r="100%"><stop offset="0" stop-color="#FFFFFF" stop-opacity=".9"/><stop offset="1" stop-color="#FFFFFF" stop-opacity="0"/></radialGradient></defs>' +
  '<path class="kg-cone" d="M236 40 L92 250 L250 250 Z" fill="url(#kgL)"/>' +
  '<circle class="kg-ring ln" cx="150" cy="150" r="104" stroke-width="1" stroke-dasharray="2 7" opacity=".55"/>' +
  '<circle class="kg-ring2 ln" cx="150" cy="150" r="116" stroke-width="1" stroke-dasharray="26 10 4 10" opacity=".3"/>' +
  '<g class="kg-food"><circle cx="150" cy="150" r="78" fill="#121214" stroke="#E9E8E4" stroke-width="1.6"/><circle class="ln" cx="150" cy="150" r="62" stroke-width="1" opacity=".5"/>' +
    '<path d="M118 128c10-14 34-14 40 2 6 15-10 26-26 24-14-2-22-14-14-26z" fill="#C9C8C3"/>' +
    '<g fill="#F4F3F0">' + [[160,170],[168,163],[175,172],[165,180],[178,182],[157,186],[171,190],[184,175]].map(p => '<ellipse cx="' + p[0] + '" cy="' + p[1] + '" rx="4.2" ry="2.6"/>').join('') + '</g>' +
    '<path d="M122 170c8-10 22-8 24 4-6 10-20 12-24-4z" fill="#8E8D88"/><path class="ln" d="M124 172c6 2 12 1 20-2" stroke-width="1" opacity=".7"/>' +
    '<circle cx="182" cy="128" r="9" fill="#A7A9AE"/><circle cx="176" cy="122" r="6" fill="#E9E8E4"/></g>' +
  '<g class="kg-ph"><rect x="88" y="62" width="124" height="176" rx="18" fill="none" stroke="#F4F3F0" stroke-width="2.5"/><rect x="132" y="70" width="36" height="6" rx="3" fill="#F4F3F0"/>' +
    '<path class="ln" d="M100 92v-12h12M188 80h12v12M200 208v12h-12M112 220h-12v-12" stroke-width="2"/></g>' +
  '<g class="kg-ar"><path class="ln" d="M150 14v26M140 30l10 10 10-10" stroke-width="2.2"/><text x="166" y="28" fill="#A7A9AE" font-family="IBM Plex Mono,monospace" font-size="10" letter-spacing="1.5">90°</text></g>' +
  '<g class="kg-sun"><circle cx="248" cy="44" r="12" fill="#F4F3F0"/><g class="ry"><path class="ln" d="M248 18v8M248 62v8M222 44h8M266 44h8M230 26l5 5M261 57l5 5M230 62l5-5M261 31l5-5" stroke-width="2"/></g></g>' +
  '<g class="kg-cr"><path class="ln" d="M62 96V66h30M208 66h30v30M238 204v30h-30M92 234H62v-30" stroke-width="3"/></g>' +
  '<rect class="kg-sc" x="66" y="148" width="168" height="2" fill="#FFFFFF" style="filter:drop-shadow(0 0 8px #FFFFFF)"/>' +
  '<g class="kg-ok"><rect x="102" y="10" width="96" height="20" rx="3" fill="#F4F3F0"/><text x="150" y="24" text-anchor="middle" fill="#050505" font-family="IBM Plex Mono,monospace" font-size="9" font-weight="700" letter-spacing="1.5">PLATO OK ✓</text></g>' +
  '</svg>'
const COC = [['plancha', 'Plancha, horno o vapor'], ['aceite', 'Con aceite'], ['frito', 'Frito'], ['salsa', 'Con salsa o aderezo']]
const ROLX = { proteina: 'PROTEÍNA', legumbre: 'PROTEÍNA', lacteo: 'PROTEÍNA', carbohidrato: 'CARBOHIDRATO', fruta: 'CARBOHIDRATO', verdura: 'VERDURA', grasa: 'GRASA', dulce: 'DULCE', bebida: 'BEBIDA', otro: 'OTRO' }
const DUDA = 0.6
const S = { cfg: {}, num: null, modo: 'foto', fuente: null, porc: 1, noSug: false, img: null, url: null, coc: null, nota: '', texto: '', r: null, al: [], res: null, cmp: null, sel: 0, busy: false, sucio: false }
const $ = id => document.getElementById(id)
function css(){ if ($('keuCss')) return; const s = document.createElement('style'); s.id = 'keuCss'; s.textContent = CSS; document.head.appendChild(s) }
function el(){
  let o = $('keuO'); if (o) return o
  css(); o = document.createElement('div'); o.id = 'keuO'; o.className = 'keu'; o.hidden = true; o.setAttribute('role', 'dialog'); o.setAttribute('aria-modal', 'true'); o.setAttribute('aria-label', 'Escáner de comidas')
  o.innerHTML = '<div class="keu__top"><button type="button" id="keuAtras" onclick="KEU.atras()">' + ico(I.back) + '<b id="keuAtrasT" style="font:inherit">CERRAR</b></button><img class="keu__logo" src="/img/brand/logotipo-koach.png" alt="KOACH"><span id="keuT"></span></div><div class="keu__sc" id="keuSc"></div>'
  document.body.appendChild(o)
  ;[['keuF', true], ['keuG', false]].forEach(([id, cam]) => {
    const f = document.createElement('input'); f.type = 'file'; f.accept = 'image/*'; f.id = id; f.hidden = true; if (cam) f.setAttribute('capture', 'environment')
    f.addEventListener('change', () => { const x = f.files && f.files[0]; f.value = ''; if (x) { S.fuente = cam ? 'camara' : 'galeria'; foto(x) } })
    document.body.appendChild(f) })
  return o
}
// Plan del socio (lo entrega la app): { pauta, comidas:[{nombre,hora,opciones}], estado(num) → 'cumplida'|'cheat'|null }
const plan = () => (S.cfg.plan && S.cfg.plan()) || { pauta: null, comidas: [] }
const comidaN = n => plan().comidas[n - 1] || null
const esExtra = () => !!S.num && S.num > plan().comidas.length
const nomC = () => esExtra() ? 'comida fuera del plan' : S.num ? 'comida ' + S.num : 'comida'
function mostrar(){ el().hidden = false; document.documentElement.style.overflow = 'hidden' }
function cab(t, atras){ const e = $('keuT'); if (e) e.textContent = t || ''; const a = $('keuAtrasT'); if (a) a.textContent = atras || 'CERRAR'; S.atras = atras ? S.atrasFn : null }
function pantalla(h, t, atras, fn){ hudFin(); S.atrasFn = fn || null; cab(t, atras); const sc = $('keuSc'); sc.classList.remove('alerta', 'valido'); sc.innerHTML = h; sc.scrollTop = 0 }
function atras(){ if (S.busy) return; if (S.atras) S.atras(); else cerrar() }
const etiqueta = () => { const c = comidaN(S.num), n = plan().comidas.length; return esExtra() ? 'FUERA DEL PLAN' : c ? 'COMIDA ' + S.num + ' DE ' + n : 'ESCÁNER' }
// siguiente número libre para una comida fuera del plan (después de las del plan, hasta 12)
function extra(){ const p = plan(), n = p.comidas.length; let k = n + 1; while (k <= 12 && p.estado && p.estado(k)) k++; if (k > 12) return; guia(k) }

/** Abre el escáner. Con num: guía de foto para esa comida. Sin num: primero elige la comida. */
function abrir(num){
  if (S.busy) return
  try { if (window.KSFX) KSFX.preload() } catch (_) {} SND('datos', 0, .7); S._silG = Date.now()   // c249 · entrar al escáner: carga de datos
  el(); mostrar(); reset()
  if (num) return guia(+num)
  S.num = null
  const p = plan()
  pantalla('<div class="keu__hd"><span class="keu__lbl">ESCÁNER DE COMIDAS</span><h2>¿Qué comida vas a registrar?</h2></div><div class="keu__pad"><div class="keu__pk">' +
    p.comidas.map((c, i) => { const e = p.estado ? p.estado(i + 1) : null
      const pill = e === 'cumplida' ? '<span class="keu__pill done">' + ico(VER.adecuado.ico) + 'COMPLETADA</span>' : e === 'cheat' ? '<span class="keu__pill fill">CHEAT MEAL</span>' : '<span class="keu__pill">PENDIENTE</span>'
      return '<button type="button" class="' + (e ? 'ok' : '') + '" onclick="KEU.guia(' + (i + 1) + ')"><em>' + (i + 1) + '</em><span><b>Comida ' + (i + 1) + '</b><small>' + esc(c.hora || '') + '</small></span>' + pill + '</button>' }).join('') +
    '<button type="button" class="keu__pkx" onclick="KEU.extra()"><em>+</em><span><b>Fuera del plan</b><small>UN ANTOJO, UN TRAGO · SUMA A TU DÍA COMO CHEAT MEAL</small></span><span class="keu__pill fill">CHEAT</span></button>' +
    '</div></div>', 'ELIGE TU COMIDA')
}
function reset(){ S.porc = 1; S.noSug = false; S.fuente = null; S.r = null; S.al = []; S.res = null; S.cmp = null; S.sucio = false; S.coc = null; S.nota = ''; S.texto = ''; S.modo = 'foto'; S.sel = 0 }
/** Guía de captura: cómo sacar la foto + tomar foto / galería / describir sin foto */
function guia(num){
  if (num) S.num = +num
  if (Date.now() - (S._silG || 0) > 400) SND('scan-lock', 0, .65)   // comida elegida: fijación
  const c = comidaN(S.num), hora = c && c.hora ? ' · ' + esc(c.hora) : ''
  const tit = esExtra() ? 'Escanea lo que comiste' : S.num ? 'Escanea tu comida ' + S.num : 'Escanea tu comida'
  pantalla('<div class="keu__gx"><div class="keu__gh"><span><i class="keu__rec"></i>SCAN · ' + esc(etiqueta()) + hora + '</span><span>IA · KOACH</span></div>' +
    '<h2>' + tit + '</h2>' +
    '<p>Saca una foto de tu plato: reconocemos los alimentos, los comparamos con tu plan y registras tu comida.</p>' +
    '<div class="keu__pp"><b>01 FOTO</b><i>→</i><b>02 LECTURA</b><i>→</i><b>03 VS TU PLAN</b><i>→</i><b>04 REGISTRO</b></div>' +
    '<div class="keu__st" aria-hidden="true">' + GSCENA + '<div class="keu__cap"><span>01 · DESDE ARRIBA</span><span>02 · CON BUENA LUZ</span><span>03 · TODO EL PLATO</span></div></div>' +
    '<ol class="keu__tp" aria-label="Cómo sacar la foto">' +
      '<li><em>01</em><span><b>Desde arriba</b><small>El teléfono paralelo a la mesa, sobre el centro del plato.</small></span></li>' +
      '<li><em>02</em><span><b>Con buena luz</b><small>Luz de día o una lámpara encima. Sin flash ni sombras fuertes.</small></span></li>' +
      '<li><em>03</em><span><b>Todo el plato</b><small>Que entre completo, con un poco de mesa alrededor.</small></span></li></ol>' +
    '<p class="keu__nota">La foto no se guarda: solo se usa para reconocer tu comida.</p>' +
    '<div class="keu__bt"><button type="button" class="keu__cta" onclick="KEU.camara()">' + ico(I.cam) + 'Tomar foto</button>' +
    '<button type="button" class="keu__sec" onclick="KEU.galeria()">' + ico(I.gal) + 'ELEGIR DE LA GALERÍA</button>' +
    '<button type="button" class="keu__lnk" onclick="KEU.describir()">' + ico(I.txt) + 'DESCRIBIR SIN FOTO</button></div></div>',
    etiqueta(), plan().comidas.length > 1 ? 'COMIDAS' : null, () => abrir())
  el().classList.add('keu--hud')
}
function camara(){ if (!S.busy) { SND('scan-paso', 0, .8); $('keuF').click() } }
function galeria(){ if (!S.busy) { SND('scan-paso', 0, .8); $('keuG').click() } }
function cerrar(){ const o = $('keuO'); if (!o) return; hudFin(); o.hidden = true; document.documentElement.style.overflow = ''; if (S.url) { URL.revokeObjectURL(S.url); S.url = null } }

async function comprimir(file){
  let bmp
  try { bmp = await createImageBitmap(file, { imageOrientation: 'from-image' }) } catch (_) {
    try { bmp = await createImageBitmap(file) } catch (__) { bmp = new Image(); bmp.src = URL.createObjectURL(file); await bmp.decode() } }
  const w = bmp.width || bmp.naturalWidth, h = bmp.height || bmp.naturalHeight, k = Math.min(1, 1024 / Math.max(w, h))
  const cv = document.createElement('canvas'); cv.width = Math.round(w * k); cv.height = Math.round(h * k)
  cv.getContext('2d').drawImage(bmp, 0, 0, cv.width, cv.height)
  const blob = await new Promise(ok => cv.toBlob(ok, 'image/jpeg', .82))
  // copia grande solo en memoria para la historia de Instagram (no se envía ni se guarda)
  const kg = Math.min(1, 2160 / Math.max(w, h)), big = document.createElement('canvas'); big.width = Math.round(w * kg); big.height = Math.round(h * kg)
  big.getContext('2d').drawImage(bmp, 0, 0, big.width, big.height)
  return { data: cv.toDataURL('image/jpeg', .82), blob, w: cv.width, h: cv.height, big }
}
async function api(body){
  const tok = S.cfg.token ? await S.cfg.token() : null
  if (!tok) throw Object.assign(new Error('sesion'), { msg: 'Tu sesión expiró. Vuelve a entrar.' })
  const ctl = new AbortController(), to = setTimeout(() => ctl.abort(), 60000)
  let r; try { r = await fetch(S.cfg.api || '/api/escaner', { method: 'POST', signal: ctl.signal, headers: { 'content-type': 'application/json', Authorization: 'Bearer ' + tok }, body: JSON.stringify(body) }) } finally { clearTimeout(to) }
  const j = await r.json().catch(() => ({}))
  if (!r.ok) throw Object.assign(new Error('api'), { msg: j.error || 'El escáner no respondió (' + r.status + ')', status: r.status })
  return j
}
// Cómo se preparó: un toque (opcional) · la grasa que no se ve en la foto
const cocBotones = () => '<span class="keu__lbl">¿CÓMO SE PREPARÓ?</span><div class="keu__co" role="group" aria-label="¿Cómo se preparó?">' +
  COC.map(([k, t]) => '<button type="button" aria-pressed="' + (S.coc === k) + '" onclick="KEU.coc(\'' + k + '\')">' + t + '</button>').join('') + '</div>'
function coc(k){ SND('scan-paso', 0, .6); S.coc = S.coc === k ? null : k; document.querySelectorAll('#keuSc .keu__co button').forEach((b, i) => b.setAttribute('aria-pressed', String(COC[i][0] === S.coc))) }
const SND = (n, d, g, r) => { try { if (window.KSFX) KSFX.play(n, d, g, r) } catch (_) {} }   // c245 · línea sonora del escáner (familia KOACH)
async function foto(file){
  mostrar(); S.modo = 'foto'; SND('scan-captura')
  try { S.img = await comprimir(file); if (S.url) URL.revokeObjectURL(S.url); S.url = URL.createObjectURL(S.img.blob) }
  catch (e) { return error('No pudimos leer la foto', 'Prueba con otra foto o con la cámara.') }
  // foto de la galería con fecha de otro día: se pregunta (el escáner registra las comidas de hoy)
  const d = file.lastModified ? new Date(file.lastModified) : null
  if (S.fuente === 'galeria' && d && d.toDateString() !== new Date().toDateString()) return deHoy(d)
  preparar()
}
function deHoy(d){
  pantalla('<div class="keu__ph sm"><img src="' + S.url + '" alt="Tu plato"></div><div class="keu__hd"><span class="keu__lbl">FOTO DEL ' + esc(d.toLocaleDateString('es-CL', { day: 'numeric', month: 'long' }).toUpperCase()) + '</span><h2>¿Esta comida es de hoy?</h2><p>El escáner registra las comidas de hoy. Para un día anterior, márcala desde tu día.</p></div>' +
    '<div class="keu__bt"><button type="button" class="keu__cta" onclick="KEU.preparar()">Sí, es de hoy</button><button type="button" class="keu__sec" onclick="KEU.cerrar()">NO, VOLVER A MI DÍA</button></div>', etiqueta(), 'ATRÁS', () => guia())
}
/** Antes de analizar: cómo se preparó + un detalle opcional (foto + texto) */
function preparar(){
  pantalla('<div class="keu__ph sm"><img src="' + S.url + '" alt="Tu plato"></div>' +
    '<div class="keu__pad">' + cocBotones() +
    '<label class="keu__lbl" for="keuNota" style="margin-top:8px">AGREGA UN DETALLE · OPCIONAL</label><input id="keuNota" class="keu__in" type="text" maxlength="160" autocomplete="off" placeholder="Ej: lleva quesillo, la carne es de cerdo" value="' + esc(S.nota) + '" oninput="KEU._S.nota=this.value"></div>' +
    '<div class="keu__bt"><button type="button" class="keu__cta" onclick="KEU.analizar()">Analizar mi ' + esc(nomC()) + '</button>' +
    '<button type="button" class="keu__lnk" onclick="KEU.camara()">' + ico(I.cam) + 'CAMBIAR FOTO</button></div>', etiqueta(), 'ATRÁS', () => guia())
}
/** Sin foto: el socio escribe lo que comió */
function describir(){ SND('scan-paso', 0, .8)
  S.modo = 'texto'
  pantalla('<div class="keu__hd"><span class="keu__lbl">' + esc(etiqueta()) + '</span><h2>¿Qué comiste?</h2><p>Escríbelo como se lo contarías a tu nutricionista. Si sabes las cantidades, inclúyelas.</p></div>' +
    '<div class="keu__pad"><label class="keu__lbl" for="keuTxt">TU ' + esc(nomC().toUpperCase()) + '</label><textarea id="keuTxt" class="keu__in" rows="4" maxlength="300" placeholder="Ej: 1 pechuga de pollo, 1 taza de arroz y ensalada de tomate" oninput="KEU._S.texto=this.value">' + esc(S.texto) + '</textarea>' +
    cocBotones() + '</div>' +
    '<div class="keu__bt"><button type="button" class="keu__cta" onclick="KEU.analizar()">Calcular mi ' + esc(nomC()) + '</button></div><div class="keu__sts" id="keuSt" role="status"></div>', etiqueta(), 'ATRÁS', () => guia())
}
// ── Lectura en curso: pantalla negra tipo escáner. Los dígitos que corren son lectura en proceso, no el resultado.
const HUD_PASOS = ['SEGMENTANDO EL PLATO', 'IDENTIFICANDO ALIMENTOS', 'ESTIMANDO PORCIONES · G', 'CALCULANDO MACROS', 'COMPARANDO CON TU PLAN']
const HUD_M = [['KCAL', 180, 980], ['PROT', 8, 90], ['CARB', 10, 140], ['GRAS', 4, 60]]
function hud(txt){
  const cajas = [[14, 22, 34, 30], [52, 18, 36, 26], [30, 52, 44, 28]].map((b, i) => '<i class="keu__bx" style="left:' + b[0] + '%;top:' + b[1] + '%;width:' + b[2] + '%;height:' + b[3] + '%;animation-delay:' + (0.5 + i * 0.7) + 's"><em>OBJ_0' + (i + 1) + '</em></i>').join('')
  const vis = txt ? '<div class="keu__hv keu__hv--t"><b>' + esc(String(S.texto).slice(0, 140)) + '</b></div>'
    : '<div class="keu__hv"><img src="' + S.url + '" alt="Tu plato"><div class="keu__grid"></div>' + cajas + '<span class="keu__cr tl"></span><span class="keu__cr tr"></span><span class="keu__cr bl"></span><span class="keu__cr br"></span><div class="keu__scan"></div><div class="keu__ret"></div></div>'
  return '<div class="keu__hud"><div class="keu__hh"><span><i class="keu__rec"></i>KOACH VISION · ' + (txt ? 'LEYENDO TU DESCRIPCIÓN' : 'ESCANEANDO') + '</span><span id="keuHt">00:00.0</span></div>' + vis +
    '<div class="keu__hm">' + HUD_M.map(([l, a, z]) => '<div><span>' + l + '</span><b data-a="' + a + '" data-z="' + z + '">000</b></div>').join('') + '</div>' +
    '<div class="keu__hb"><i id="keuHb"></i></div>' +
    '<ol class="keu__hp" id="keuHp">' + HUD_PASOS.map((p, i) => '<li' + (i ? '' : ' class="on"') + '><span>' + String(i + 1).padStart(2, '0') + '</span>' + p + '<em></em></li>').join('') + '</ol>' +
    '<div class="keu__hl" id="keuHl" aria-hidden="true"></div><div class="keu__sr" role="status">Analizando tu comida</div></div>'
}
function hudIni(){
  try { if (S.sndOff) S.sndOff(); S.sndOff = window.KSFX ? KSFX.loop('scan-datos', .75)   /* c248 · procesamiento de datos (TheAudioHorizonSFX, licencia abierta según Matías) */ : null } catch (_) {}
  S.hudK = -1; S.hudB = 0
  el().classList.add('keu--hud'); const t0 = Date.now(), hx = n => Math.floor(Math.random() * 16 ** n).toString(16).toUpperCase().padStart(n, '0')
  const TAG = ['SEG', 'CLS', 'VOL', 'DEN', 'MAC', 'REF', 'ISO', 'NRM']
  S.hudT = setInterval(() => {
    const sc = $('keuSc'); if (!sc || !sc.querySelector('.keu__hud')) return hudFin()
    const ms = Date.now() - t0, tt = $('keuHt'); if (tt) tt.textContent = String(Math.floor(ms / 60000)).padStart(2, '0') + ':' + String(Math.floor(ms / 1000) % 60).padStart(2, '0') + '.' + Math.floor(ms / 100) % 10
    sc.querySelectorAll('.keu__hm b').forEach(b => { b.textContent = String(+b.dataset.a + Math.floor(Math.random() * (b.dataset.z - b.dataset.a))).padStart(3, '0') })
    const k = Math.min(HUD_PASOS.length - 1, Math.floor(ms / 1600)), lis = sc.querySelectorAll('#keuHp li')
    lis.forEach((li, i) => { li.className = i < k ? 'ok' : i === k ? 'on' : '' })
    if (k !== S.hudK) { S.hudK = k; SND('scan-paso', 0, .8) }   // c246 · tick seco por paso (sin melodía)
    if (!sc.querySelector('.keu__hv--t')) { while (S.hudB < 3 && ms > 500 + S.hudB * 700) { S.hudB++; SND('scan-lock', 0, .8) } }   // OBJ_01-03: fijación del objeto detectado
    const bar = $('keuHb'); if (bar) bar.style.width = Math.min(96, 100 * (1 - Math.exp(-ms / 5200))).toFixed(1) + '%'
    const lg = $('keuHl'); if (lg){ const ln = document.createElement('div')
      ln.textContent = '0x' + hx(4) + '  ' + TAG[Math.floor(Math.random() * TAG.length)] + '  ' + hx(6) + ' ' + hx(2) + '.' + hx(2) + '  ' + (Math.random() * 0.4 + 0.6).toFixed(3) + '  ' + HUD_PASOS[k].split(' ')[0].slice(0, 6)
      lg.appendChild(ln); while (lg.children.length > 9) lg.firstChild.remove() }
  }, 90)
}
function hudFin(){ if (S.sndOff){ try { S.sndOff() } catch (_) {} S.sndOff = null } if (S.hudT){ clearInterval(S.hudT); S.hudT = null } const r = document.getElementById('keuO'); if (r) r.classList.remove('keu--hud', 'keu--tex') }
const bc = (t, h) => typeof window.barcodeSVG === 'function' ? window.barcodeSVG(String(t).toUpperCase().replace(/[^A-Z0-9 \-.$/+%]/g, ''), h || 34) : ''
const tex = () => { const r = $('keuO'); if (r) r.classList.add('keu--tex') }
function cuenta(){ const xs = [...($('keuSc') || document).querySelectorAll('[data-kc]')], t0 = performance.now()
  const f = now => { const q = Math.min(1, Math.max(0, (now - t0 - 200) / 1300)), e = 1 - Math.pow(1 - q, 3); xs.forEach(x => { x.textContent = n0(+x.dataset.kc * e) }); if (q < 1 && xs[0] && xs[0].isConnected) requestAnimationFrame(f) }; if (xs.length) requestAnimationFrame(f) }
async function analizar(){
  if (S.busy) return
  const c = comidaN(S.num), txt = S.modo === 'texto'
  if (txt && String(S.texto).trim().length < 3) { st('Cuéntanos qué comiste.'); const t = $('keuTxt'); if (t) t.focus(); return }
  S.busy = true; SND('appear', 0, .55)   // inicia la lectura: el encendido tech antes del fondo de datos
  pantalla(hud(txt), etiqueta()); hudIni()
  try {
    const base = { comida: c ? c.nombre : null, comida_num: S.num, coccion: S.coc, fuente: S.fuente }
    S.tAn0 = Date.now()
    S.r = await api(txt ? Object.assign(base, { modo: 'describir', texto: S.texto }) : Object.assign(base, { imagen: S.img.data, nota: S.nota || null }))
    S.tAn = (Date.now() - S.tAn0) / 1000
    S.al = ((S.r.resultado && S.r.resultado.alimentos) || []).map(a => Object.assign({}, a)); S.sel = 0; S.sucio = false; S.porc = 1; S.noSug = false
    const dt = S.r.deteccion || {}
    if (!S.al.length || (S.r.resultado && S.r.resultado.veredicto === 'no_comida')) return sinComida()
    if (!txt && dt.origen && dt.origen !== 'plato_real') return noReal()
    if (!txt && (dt.calidad && dt.calidad !== 'buena' || (dt.confianza != null && dt.confianza < 0.45))) return pocoClara(dt.calidad)
    recalc(); pintar(true); SND('scan-lista')
  } catch (e) {
    console.error('escaner', e)
    SND('scan-error'); fallo(e)
  } finally { S.busy = false }
}
// ── Errores: cada uno dice qué pasó y siempre deja un camino (otra foto · describir sin foto · volver)
const IC_X = '<circle cx="12" cy="12" r="8.5"/><path d="M9 9l6 6M15 9l-6 6"/>', IC_I = '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5v5.5M12 16.4v.3"/>'
function aviso(o){
  const foto = o.foto !== false && S.url && S.modo === 'foto', cod = 'KO-' + (o.cod || 'REV') + '-' + String(Date.now()).slice(-6)
  pantalla('<div class="keu__av"><div class="keu__avc">' +
    (foto ? '<div class="keu__avf"><img src="' + S.url + '" alt="Tu foto"><span class="keu__avs">' + esc(o.sello || 'REVISAR') + '</span><i class="tl"></i><i class="tr"></i><i class="bl"></i><i class="br"></i></div>' : '<div class="ic">' + ico(o.ico || IC_I) + '</div>') +
    '<span class="keu__avk">' + esc(etiqueta()) + ' · ESCÁNER KOACH</span><b>' + esc(o.t) + '</b>' + (o.p ? '<p>' + esc(o.p) + '</p>' : '') + (o.extra || '') +
    '<div class="keu__avb">' + bc(cod, 30) + '<span>' + cod + ' · NO DESCUENTA</span></div></div></div>' +
    '<div class="keu__bt">' + o.bt.map((b, i) => '<button type="button" class="keu__' + (i === 0 ? 'cta' : i === 1 ? 'sec' : 'lnk') + '" onclick="' + b[1] + '">' + (i === 0 ? b[0] : b[0].toUpperCase()) + '</button>').join('') + '</div>', etiqueta(), o.atras || null, o.atrasFn)
  tex()
}
const B_FOTO = ['Tomar otra foto', 'KEU.camara()'], B_TXT = ['Describir sin foto', 'KEU.describir()'], B_VOLVER = ['Volver', 'KEU.cerrar()']
const GUIA = () => '<div class="keu__gd"><div>' + ico(I.top) + 'Desde arriba</div><div>' + ico(I.sol) + 'Con buena luz</div><div>' + ico(I.plato) + 'Todo el plato</div></div>'
function sinComida(){ SND('scan-error');
  if (S.modo === 'texto') return aviso({ ico: IC_X, t: 'No entendimos tu comida', p: 'Escribe cada alimento y, si puedes, su cantidad. Este intento no descuenta de tus escaneos del día.', bt: [['Escribir de nuevo', 'KEU.describir()'], B_VOLVER] })
  aviso({ sello: 'SIN COMIDA', cod: 'NOFOOD', t: 'En la foto no vemos comida', p: 'Este intento no descuenta de tus escaneos del día.', extra: GUIA(), bt: [B_FOTO, B_TXT, B_VOLVER] })
}
function noReal(){ SND('scan-error');
  aviso({ sello: 'FOTO NO VÁLIDA', cod: 'ORIG', t: 'Esta foto parece de una pantalla o de internet', p: 'Para registrar tu comida necesitamos una foto de tu plato. Si no la tienes, descríbela.', bt: [B_FOTO, B_TXT, B_VOLVER] })
}
function pocoClara(c){ SND('scan-error');
  const T = { oscura: 'La foto está muy oscura', borrosa: 'La foto salió borrosa', incompleta: 'El plato no se ve completo' }
  aviso({ sello: 'FOTO POCO CLARA', cod: 'QLTY', t: T[c] || 'No vemos bien tu plato', p: 'Con otra foto el cálculo sale más exacto. También puedes seguir con esta y revisar los alimentos.', extra: GUIA(), bt: [B_FOTO, ['Seguir con esta foto', 'KEU.seguir()'], B_TXT] })
}
function seguir(){ recalc(); pintar(true) }
function fallo(e){
  const st = e && e.status, msg = e && e.msg
  if (st === 429 || st === 401 || st === 403) return aviso({ foto: false, t: msg || 'No pudimos analizar tu comida', bt: [B_VOLVER] })
  aviso({ t: e && e.name === 'AbortError' ? 'El análisis tardó demasiado' : 'No pudimos analizar tu comida', p: (S.modo === 'foto' ? 'Tu foto sigue aquí. ' : '') + 'Revisa tu conexión y vuelve a intentar.', bt: [['Reintentar', 'KEU.analizar()'], S.modo === 'foto' ? B_TXT : ['Escribir de nuevo', 'KEU.describir()'], B_VOLVER] })
}
function error(t, p){ aviso({ t, p, bt: [B_FOTO, B_TXT, B_VOLVER] }) }
function otra(){ if (!S.busy) { reset(); guia() } }

// Veredicto (reglas KOACH) + comparación con la comida del plan, siempre sobre los alimentos ya corregidos
function recalc(){
  const p = plan(), pa = p.pauta || {}, n = p.comidas.length || null, c = comidaN(S.num)
  S.res = KE.evaluar({ es_comida: true, alimentos: S.al }, { foco: (pa.intake && pa.intake.foco) || (S.r && S.r.contexto && S.r.contexto.foco) || 'general',
    comida: c ? { nombre: c.nombre } : null, kcal_dia: pa.kcal || null, comidas_dia: n })
  S.cmp = c ? KE.comparar(S.res.alimentos, c, KE.metasComida(pa)) : null
}
const dudoso = a => a && a.confianza != null && a.confianza < DUDA
function zonas(){
  return S.res.alimentos.map((a, i) => {
    if (!a.zona) return ''
    const [y0, x0, y1, x1] = a.zona, t = Math.min(y0, y1) / 10, l = Math.min(x0, x1) / 10, h = Math.abs(y1 - y0) / 10, w = Math.abs(x1 - x0) / 10
    if (w < 2 || h < 2) return ''
    return '<button type="button" class="keu__z' + (i === S.sel ? ' on' : '') + (dudoso(a) ? ' dud' : '') + '" data-i="' + i + '" style="top:' + t + '%;left:' + l + '%;width:' + w + '%;height:' + h + '%" onclick="KEU.sel(' + i + ')" aria-label="' + esc(a.nombre) + '"><i>' + (i + 1) + '</i></button>'
  }).join('')
}
function ajustarZonas(){
  const img = document.querySelector('#keuSc .keu__ph img'), zs = $('keuZs'); if (!img || !zs || !S.img) return
  const W = img.clientWidth, H = img.clientHeight, k = Math.min(W / S.img.w, H / S.img.h), w = S.img.w * k, h = S.img.h * k
  zs.style.width = w + 'px'; zs.style.height = h + 'px'; zs.style.left = (W - w) / 2 + 'px'; zs.style.top = (H - h) / 2 + 'px'; zs.style.right = 'auto'; zs.style.bottom = 'auto'
}
function pintar(arriba){
  const sc = $('keuSc'), y = sc.scrollTop, r = S.res, v = VER[r.veredicto] || VER.relativo, p = plan(), c = comidaN(S.num)
  S.atrasFn = null; cab(etiqueta())
  let h = ''
  const fotoT = S.modo === 'foto' && S.url ? '<div class="keu__ph sm"><img src="' + S.url + '" alt="Tu comida"><div class="keu__zs" id="keuZs">' + zonas() + '</div></div>' : ''
  // a qué comida corresponde (cambia la comparación al instante)
  const msH = '<div class="keu__ms" role="group" aria-label="¿Qué comida de tu plan es?">' + p.comidas.map((x, i) => '<button type="button" aria-pressed="' + (S.num === i + 1) + '" onclick="KEU.comida(' + (i + 1) + ')">COMIDA ' + (i + 1) + '</button>').join('') + '</div>'
  // ¿calza mejor con otra comida del plan? (lo decide la comparación con el plan, no la IA)
  const sug = !S.noSug && c ? KE.comidaProbable(S.res.alimentos, p.comidas, S.num) : null
  if (sug) h += '<div class="keu__mm" role="status"><b>Esto se parece más a tu comida ' + sug.num + '.</b><div><button type="button" onclick="KEU.comida(' + sug.num + ')">SÍ, ES MI COMIDA ' + sug.num + '</button><button type="button" onclick="KEU.noSug()">NO, ES MI COMIDA ' + S.num + '</button></div></div>'
  // 1 · lo que trae tu comida vs lo que te toca en esta comida del plan
  const t = r.totales, m = S.cmp && S.cmp.metas
  const mac = (lbl, val, meta) => { const pct = meta ? val / meta * 100 : 0
    return '<div><b>' + n0(val) + '<small> ' + (meta ? '/ ' + n0(meta) + ' g' : 'g') + '</small></b>' + (meta ? '<i><s style="width:' + Math.min(100, pct) + '%"></s></i>' : '<i></i>') + '<span class="' + (pct > 125 ? 'over' : '') + '">' + lbl + (pct > 125 ? ' · SOBRE' : '') + '</span></div>' }
  // TICKET DE LECTURA: lo primero que ves tras escanear (mismo lenguaje que la comida registrada)
  const kp = m && m.kcal ? Math.round(t.kcal / m.kcal * 100) : null, mala = r.cheat || r.veredicto === 'alerta' || esExtra()
  const macW = (l, val, meta, k) => '<div class="keu__m' + k + '"><span><u></u>' + l + '</span><b><i data-kc="' + Math.round(+val || 0) + '">' + n0(val) + '</i><small>G</small></b><em><s style="width:' + (meta ? Math.min(100, val / meta * 100) : 0) + '%"></s></em><small>' + (meta ? (val / meta > 1.25 ? 'SOBRE · ' : '') + 'TU PLAN ' + n0(meta) + ' G' : '—') + '</small></div>'
  // barra de calorías partida por macro: de dónde vienen tus kcal (P·4, C·4, G·9) contra la meta de la comida
  const kP = (+t.proteina_g || 0) * 4, kC = (+t.carbohidrato_g || 0) * 4, kG = (+t.grasa_g || 0) * 9, kT = kP + kC + kG || 1
  const barK = m && m.kcal ? [['p', kP], ['c', kC], ['g', kG]].map(([k, v]) => '<s class="keu__k' + k + '" style="width:' + (v / kT * Math.min(100, t.kcal / m.kcal * 100)).toFixed(1) + '%"></s>').join('') : ''
  const sugH = h
  h = '<div class="keu__pad keu__pad--r"><div class="keu__wt keu__wt--r' + (arriba ? ' keu__wt--a' : '') + '"><div class="keu__sys"><img src="/img/brand/logotipo-koach.png" alt="KOACH"><span>SYSTEM · NUTRITIONAL ANALYTICS AI</span><i></i></div>' +
    '<div class="keu__wh"><span>DATA ANALYTIC RESULT</span><span class="keu__wok' + (mala ? ' ch' : '') + '">' + ico(mala ? '<path d="M7 7l10 10M17 7L7 17"/>' : '<path d="M5 12.5l4.5 4.5L19 7.5"/>') + (r.cheat || esExtra() ? 'CHEAT MEAL' : v.k) + '</span></div>' +
    detK(t, m) +
    // c256 · foto protagonista al centro y las calorías en vertical, dominantes, montadas sobre su borde
    (fotoT ? '<div class="keu__hero"><div class="keu__hn" aria-label="' + n0(t.kcal) + ' kilocalorías"><span>KCAL</span><b data-kc="' + Math.round(t.kcal) + '">' + n0(t.kcal) + '</b></div><div class="keu__wph keu__wph--h">' + fotoT + '<i class="keu__hs" aria-hidden="true"></i></div></div>'
      : '<span class="keu__wl">INGESTA ESTIMADA · ' + esc(etiqueta()) + '</span><div class="keu__wk"><b data-kc="' + Math.round(t.kcal) + '">' + n0(t.kcal) + '</b><span>KCAL' + (m && m.kcal ? '<br>TU PLAN ' + n0(m.kcal) : '') + '</span></div>') +
    (kp != null ? '<div class="keu__wb keu__wb--3">' + barK + (kp > 100 ? '<i class="keu__wbo" style="left:' + (100 / kp * 100).toFixed(1) + '%"></i>' : '') + '</div><div class="keu__wbp"><span><i data-kc="' + kp + '">' + kp + '</i> % DE TU PLAN</span><span>' + (r.puntaje != null && !r.cheat ? 'PUNTAJE <i data-kc="' + r.puntaje + '">' + r.puntaje + '</i>/100' : esc(etiqueta())) + '</span></div>' : '') +
    tele() +
    '<div class="keu__wm">' + macW('PROTEÍNA', t.proteina_g, m && m.proteina_g, 'p') + macW('CARBOS', t.carbohidrato_g, m && m.carbohidrato_g, 'c') + macW('GRASAS', t.grasa_g, m && m.grasa_g, 'g') + '</div>' +
    '<div class="keu__wv' + (mala ? ' x' : ' ok') + '"><b>' + esc(esExtra() ? 'Comida fuera de tu plan' : r.titulo) + '</b><p>' + esc(r.mensaje) + '</p>' + (mala && (comidaN(S.num) || esExtra()) ? '<p class="keu__wq">¿Deseas registrarla igual para sumar sus calorías a tu día? Quedará como cheat meal.</p>' : '') + (r.veredicto !== 'adecuado' && KE.proxima(r, S.cmp) ? '<span class="keu__sug">→ ' + esc(KE.proxima(r, S.cmp)) + '</span>' : '') + '</div></div>' + '<div class="keu__bt keu__bt--top" id="keuBt">' + botones() + '</div><div class="keu__sts" id="keuSt" role="status"></div>' + msH + sugH
  // 2 · cómo va con tu plan
  if (S.cmp) {
    const E = { plan: ['done', 'EN TU PLAN'], reemplazo: ['line', 'REEMPLAZO'], fuera: ['fill', 'NO ADECUADO'], extra: ['', 'FUERA DEL PLAN'] }
    let rows = S.cmp.items.map(it => { const a = r.alimentos[it.idx], e = E[it.estado]
      return '<div class="keu__cm"><span><b>' + esc(cap(a.nombre)) + '</b>' + (it.estado === 'reemplazo' && it.ref ? ' en vez de ' + esc(low(it.ref)) : '') + '</span><span class="keu__pill ' + e[0] + '">' + (it.estado === 'plan' ? ico(VER.adecuado.ico) : '') + e[1] + '</span></div>' }).join('')
    rows += S.cmp.faltan.map(f => '<div class="keu__cm"><span>Tu plan incluye ' + esc(f.ej.join(' o ').toLowerCase() || f.rol.toLowerCase()) + '.</span><span class="keu__pill dash">FALTA ' + f.rol + '</span></div>').join('')
    rows += S.cmp.ajustes.map(a => '<div class="keu__cm"><span>' + esc(a.texto) + '</span><span class="keu__pill">PORCIÓN</span></div>').join('')
    h += '<div class="keu__card"><span class="keu__lbl" style="margin-bottom:8px">CÓMO VA CON TU PLAN · COMIDA ' + S.num + '</span>' + rows + '</div>'
  }
  // 3 · alimentos inflamatorios / contra tu perfil
  const inf = KE.inflamatorios(r)
  if (inf.length) h += '<div class="keu__inf"><span class="keu__lbl" style="margin-bottom:6px">ALERTA · ALIMENTOS INFLAMATORIOS</span>' + inf.map(x => '<div>' + esc(cap(x.nombre)) + '<span>' + esc(x.motivos.join(' · ').toUpperCase()) + '</span></div>').join('') + '</div>'
  // 4 · revisión: dudosos marcados, medidas caseras con − / +, igual a mi plan
  const nd = S.al.filter(dudoso).length, porIdx = {}
  if (S.cmp) S.cmp.items.forEach(it => { porIdx[it.idx] = it })
  h += '<div class="keu__card"><span class="keu__lbl">¿CUÁNTO COMISTE?</span><div class="keu__pc" role="group" aria-label="¿Cuánto comiste?">' +
    [[1, 'TODO'], [0.75, '¾'], [0.5, '½'], [0.25, '¼']].map(([f, t]) => '<button type="button" aria-pressed="' + (S.porc === f) + '" onclick="KEU.porcion(' + f + ')">' + t + '</button>').join('') + '</div></div>'
  h += '<div class="keu__card"><span class="keu__lbl">REVISA LO QUE ' + (S.modo === 'texto' ? 'CALCULAMOS' : 'DETECTAMOS') + ' · ' + S.al.length + '</span>' +
    (nd ? '<div class="keu__rv">' + ico('<circle cx="12" cy="12" r="9"/><path d="M12 7.5v5.5M12 16.4v.3"/>') + (nd === 1 ? 'Revisa el alimento marcado: no estamos seguros.' : 'Revisa los ' + nd + ' alimentos marcados: no estamos seguros.') + '</div>' : '') +
    S.al.map((a, i) => { const ra = r.alimentos[i] || a, g = Math.round(a.gramos) || 0, md = KE.medida(a.nombre, g), it = porIdx[i], gp = it && it.g_plan
      const eq = gp && Math.abs(gp - g) > Math.max(5, gp * 0.05)
      return '<div class="keu__ed' + (i === S.sel ? ' on' : '') + (dudoso(a) ? ' dud' : '') + '"><div class="keu__eh"><em>' + (i + 1) + '</em><input type="text" value="' + esc(a.nombre) + '" aria-label="Alimento ' + (i + 1) + '" placeholder="Nombre del alimento" oninput="KEU.nombre(' + i + ',this.value)" onfocus="KEU.sel(' + i + ',1)">' +
        '<button type="button" aria-label="Quitar ' + esc(a.nombre || 'alimento') + '" onclick="KEU.quitar(' + i + ')">' + ico(I.x) + '</button></div>' +
        '<div class="keu__tg"><span class="keu__pill">' + (ROLX[ra.grupo] || 'OTRO') + '</span>' + (dudoso(a) ? '<span class="keu__pill dash">REVISA</span>' : '') + (a.auto === 'coccion' ? '<span class="keu__pill line">POR LA PREPARACIÓN</span>' : '') + '</div>' +
        '<div class="keu__st2"><div class="keu__stp"><button type="button" aria-label="Menos ' + esc(a.nombre) + '" onclick="KEU.mas(' + i + ',-1)">−</button><label><input type="number" inputmode="numeric" min="0" max="2000" value="' + g + '" aria-label="Gramos de ' + esc(a.nombre) + '" onchange="KEU.gramos(' + i + ',this.value)"><span>g</span></label><button type="button" aria-label="Más ' + esc(a.nombre) + '" onclick="KEU.mas(' + i + ',1)">+</button></div>' +
        (md ? '<span class="keu__md">' + esc(md) + '</span>' : '') +
        (eq ? '<button type="button" class="keu__eq" onclick="KEU.igualPlan(' + i + ')">= MI PLAN · ' + gp + ' G</button>' : '') + '</div>' +
        '<div class="keu__mac">' + n0(ra.kcal) + ' KCAL · P ' + n0(ra.proteina_g) + ' · C ' + n0(ra.carbohidrato_g) + ' · G ' + n0(ra.grasa_g) + '</div>' +
        '<button type="button" class="keu__etb' + (S.etq === i ? ' on' : '') + '" onclick="KEU.etq(' + i + ')">' + (a.etiqueta ? '✓ SEGÚN ETIQUETA · EDITAR' : '+ CORREGIR CON ETIQUETA NUTRICIONAL') + '</button>' + (S.etq === i ? etqForm(i, a) : '') + '</div>' }).join('') +
    '<button type="button" class="keu__add" onclick="KEU.agregar()">+ AGREGAR UN ALIMENTO</button>' +
    '<p class="keu__txt">' + (S.modo === 'texto' ? 'Las cantidades se calcularon desde tu descripción.' : 'Los gramos son una lectura aproximada de la foto.') + ' Si pesaste tu comida, corrígelos: así tu registro queda exacto.</p></div></div>'
  h += '<div class="keu__bt" id="keuBt2">' + botones() + '</div>'
  sc.classList.toggle('alerta', !!mala); sc.classList.toggle('valido', !mala)
  sc.innerHTML = h + dock(mala); sc.scrollTop = arriba ? 0 : y
  const R = $('keuO'); if (R){ R.classList.remove('keu--hud'); R.classList.add('keu--tex') } if (arriba) cuenta()
  const img = sc.querySelector('.keu__ph img'); if (img) { if (img.complete) ajustarZonas(); else img.onload = ajustarZonas }
}
function st(m){ const s = $('keuSt'); if (s) s.textContent = m || '' }
function sel(i, sinPintar){
  S.sel = i
  document.querySelectorAll('#keuSc .keu__z').forEach(z => z.classList.toggle('on', +z.dataset.i === i))
  document.querySelectorAll('#keuSc .keu__ed').forEach((z, k) => z.classList.toggle('on', k === i))
  if (!sinPintar) { const row = document.querySelectorAll('#keuSc .keu__ed')[i]; if (row) row.scrollIntoView({ behavior: 'smooth', block: 'center' }) }
}
function comida(n){ SND('scan-paso', 0, .6); S.num = +n; S.noSug = true; recalc(); pintar() }
function noSug(){ S.noSug = true; pintar() }
// "¿Cuánto comiste?": escala todos los alimentos de una vez (plato compartido, lo que sobró)
function porcion(f){ f = +f; if (!f || f === S.porc) return; const k = f / S.porc
  S.al = S.al.map(a => a.gramos > 0 ? Object.assign(KE.regramar(a, a.gramos * k), { _n: a._n, auto: a.auto, confianza: a.confianza, zona: a.zona }) : a); S.porc = f; recalc(); pintar() }
function nombre(i, v){ if (!S.al[i]) return; S.al[i].nombre = String(v).slice(0, 60); S.al[i]._n = 1; S.al[i].confianza = null; if (!S.sucio) { S.sucio = true; pintarBotones() } }
function gramos(i, v){ if (!S.al[i]) return; const a = S.al[i]
  if (a.gramos > 0) S.al[i] = Object.assign(KE.regramar(a, v), { _n: a._n, auto: a.auto, confianza: a.confianza == null ? null : Math.max(a.confianza, DUDA) })
  else { S.al[i] = Object.assign({}, a, { gramos: Math.max(0, Math.round(+v || 0)) }); S.sucio = true }
  recalc(); pintar() }
function mas(i, d){ const a = S.al[i]; if (!a) return; const pa = KE.paso(a.nombre); gramos(i, Math.max(pa, Math.round(((+a.gramos || 0) + d * pa) / pa) * pa)) }
function igualPlan(i){ const it = S.cmp && S.cmp.items.find(x => x.idx === i); if (it && it.g_plan) gramos(i, it.g_plan) }
const vacio = () => ({ nombre: '', gramos: 100, kcal: 0, proteina_g: 0, carbohidrato_g: 0, grasa_g: 0, grupo: 'otro', preparacion: 'otro', nova: 1, zona: null, confianza: null, _n: 1 })
function quitar(i){ S.al.splice(i, 1); if (S.sel >= S.al.length) S.sel = 0; if (!S.al.length) { S.al.push(vacio()); S.sucio = true } recalc(); pintar() }
function agregar(){ S.al.push(vacio()); S.sucio = true; S.sel = S.al.length - 1; recalc(); pintar()
  const ins = document.querySelectorAll('#keuSc .keu__eh input'); const x = ins[ins.length - 1]; if (x) x.focus() }
/** c251 · telemetría real de la lectura: código, confianza del modelo, objetos y tiempo de análisis */
/** c256 · detalle arriba: calorías analizadas contra la meta de esta comida y cuánto falta o sobra */
function detK(t, m){
  const k = Math.round(t.kcal || 0), M = m && m.kcal ? Math.round(m.kcal) : null
  let h = '<div class="keu__det"><span>CALORÍAS ANALIZADAS</span><b><i data-kc="' + k + '">' + n0(k) + '</i>' + (M ? '<em> / ' + n0(M) + ' KCAL</em>' : '<em> KCAL</em>') + '</b></div>'
  if (M) { const d = M - k, tol = Math.max(40, M * 0.06)
    h += '<div class="keu__dif ' + (d < -tol ? 'x' : Math.abs(d) <= tol ? 'ok' : 'n') + '">' + (Math.abs(d) <= tol ? 'EN LA META DE ESTA COMIDA' : d > 0 ? 'FALTAN ' + n0(d) + ' KCAL PARA ESTA COMIDA' : 'SOBRAN ' + n0(-d) + ' KCAL PARA ESTA COMIDA') + '</div>' }
  return h
}
function tele(){
  const d = (S.r && S.r.deteccion) || {}, n = (S.res && S.res.alimentos || []).length
  const hh = new Date().toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: 'America/Santiago' }).replace(':', '')
  const id = new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Santiago' }).slice(2).replace(/-/g, '') + '-' + hh + '-C' + (S.num || 'X')
  const it = [['ID', id]]
  if (n) it.push(['OBJETOS', String(n)])
  if (S.tAn) it.push(['ANÁLISIS', S.tAn.toFixed(1).replace('.', ',') + ' S'])
  return '<div class="keu__tel">' + it.map(([k, v]) => '<span>' + k + ' <b>' + esc(v) + '</b></span>').join('') + '</div>'
}
/** c252 · barra fija con el check: registrar siempre a mano, aunque no sea adecuado */
function dock(mala){
  const c = comidaN(S.num) || (esExtra() ? { extra: true } : null); if (!c) return ''
  const chk = '<u>' + ico('<path d="M5 12.5l4.5 4.5L19 7.5"/>') + '</u>'
  if (S.sucio) return '<div class="keu__dock"><button type="button" class="ok" onclick="KEU.recalcular()">RECALCULAR CON MIS CAMBIOS</button></div>'
  return '<div class="keu__dock">' + (mala ? '<button type="button" class="ch" onclick="KEU.confirmar(true)">' + chk + 'REGISTRAR COMO CHEAT MEAL</button>'
    : '<button type="button" class="ok" onclick="KEU.confirmar()">' + chk + 'CONFIRMAR Y REGISTRAR</button>') + '</div>'
}
/** c252 · corregir con la etiqueta nutricional (valores por 100 g/ml × cantidad consumida) */
function etq(i){ S.etq = S.etq === i ? null : i; pintar() }
function etqAplicar(i){
  const a = S.al[i]; if (!a) return
  const v = k => { const e = document.getElementById('keuEt' + k + i); return e ? Math.max(0, +String(e.value).replace(',', '.') || 0) : 0 }
  const g = Math.max(1, Math.round(v('g') || +a.gramos || 100)), f = g / 100, kc = v('k')
  if (!kc) { st('Ingresa al menos las calorías de la etiqueta.'); return }
  S.al[i] = Object.assign({}, a, { gramos: g, kcal: Math.round(kc * f), proteina_g: Math.round(v('p') * f * 10) / 10, carbohidrato_g: Math.round(v('c') * f * 10) / 10, grasa_g: Math.round(v('x') * f * 10) / 10, confianza: null, _n: 1, etiqueta: { k: kc, p: v('p'), c: v('c'), g: v('x') } })
  S.etq = null; SND('scan-lista', 0, .6); recalc(); pintar(); st('Corregido con la etiqueta nutricional.')
}
function etqForm(i, a){
  const e = a.etiqueta || {}, g = Math.round(a.gramos) || ''
  const f = (k, l, v) => '<label>' + l + '<input id="keuEt' + k + i + '" type="number" inputmode="decimal" min="0" step="any" value="' + (v || v === 0 ? v : '') + '"></label>'
  return '<div class="keu__et"><p>VALORES DE LA ETIQUETA · POR 100 G O 100 ML</p><div class="g">' + f('k', 'KCAL', e.k) + f('g', 'CANTIDAD QUE CONSUMISTE (G/ML)', g) + f('p', 'PROTEÍNA G', e.p) + f('c', 'CARBOS G', e.c) + f('x', 'GRASAS G', e.g) + '</div>' +
    '<button type="button" class="b" onclick="KEU.etqAplicar(' + i + ')">APLICAR ETIQUETA</button></div>'
}
function botones(){ const c = comidaN(S.num) || (esExtra() ? { extra: true } : null)
  const no = S.res && (S.res.veredicto === 'alerta' || esExtra())
  if (no && !S.sucio && c) return '<button type="button" class="keu__sec" onclick="KEU.cerrar()">NO, NO REGISTRAR</button><button type="button" class="keu__lnk" onclick="KEU.otra()">' + ico(I.cam) + 'EMPEZAR DE NUEVO</button>'   // c253 · la pregunta vive en el ticket y el check en la barra fija
  return (S.sucio ? '<button type="button" class="keu__cta" onclick="KEU.recalcular()">Recalcular con mis cambios</button>' : '') +
    '<button type="button" class="keu__' + (S.sucio ? 'sec' : 'cta keu__cta--tech') + '"' + (S.sucio || !c ? ' disabled' : '') + ' onclick="KEU.confirmar()">' + (c ? (S.sucio ? 'CONFIRMAR Y REGISTRAR' : '<i class="cr a"></i><i class="cr b"></i><span class="tk"><i></i>Confirmar y registrar</span><span class="ar">' + (esExtra() ? 'EXTRA' : 'C' + S.num) + '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M5 12h14M13 6l6 6-6 6"/></svg></span>') : 'Elige la comida') + '</button>' +
    '<button type="button" class="keu__lnk" onclick="KEU.otra()">' + ico(I.cam) + 'EMPEZAR DE NUEVO</button><button type="button" class="keu__lnk" onclick="KEU.cerrar()">DESCARTAR</button>' }
// escribir un nombre no repinta la pantalla (no se pierde el foco): solo cambian los botones
function pintarBotones(){ ['keuBt', 'keuBt2'].forEach(id => { const b = $(id); if (b) b.innerHTML = botones() }) }
async function recalcular(){
  if (S.busy) return
  const lista = S.al.filter(a => String(a.nombre).trim()).map(a => ({ nombre: String(a.nombre).trim(), gramos: Math.round(a.gramos) || 100 }))
  if (!lista.length) { st('Escribe al menos un alimento.'); return }
  S.busy = true; st('Recalculando…')
  try {
    const j = await api({ modo: 'recalcular', alimentos: lista })
    const prev = S.al.filter(a => String(a.nombre).trim())
    S.al = (j.alimentos || []).map((x, i) => Object.assign({}, x, { zona: (prev[i] && prev[i].zona) || null, confianza: null, auto: prev[i] && prev[i].auto, _n: prev[i] && prev[i]._n }))
    S.sucio = false; recalc(); pintar(); st('Listo: calorías y macros actualizados.')
  } catch (e) { st((e && e.msg) || 'No pudimos recalcular. Prueba de nuevo.') }
  finally { S.busy = false }
}
async function confirmar(forzar){
  if (S.busy || S.sucio || !S.r || !S.num) return
  if (forzar === true || esExtra()) S.res = Object.assign({}, S.res, { cheat: true })
  S.busy = true; st('Registrando…')
  try {
    const d0 = S.r.deteccion || {}
    const det = { plato: d0.plato || '', confianza: d0.confianza, modo: S.modo, coccion: S.coc, fuente: S.fuente, calidad: d0.calidad, porcion: S.porc, editado: S.al.some(a => a._n), detectado: (S.r.resultado && S.r.resultado.alimentos || []).map(a => ({ nombre: a.nombre, gramos: a.gramos })) }
    const res = Object.assign({}, S.res, { comparacion: S.cmp && { items: S.cmp.items, faltan: S.cmp.faltan.map(f => f.rol), ajustes: S.cmp.ajustes.map(a => a.tipo) } })
    await S.cfg.confirmar(S.r.id, S.num, det, res)
    const c = comidaN(S.num), t = S.res.totales
    const p = plan(), M = KE.metasComida(p.pauta || {}) || {}, ch = S.res.cheat, ver = VER[S.res.veredicto] || VER.adecuado
    const hora = new Date().toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: 'America/Santiago' })
    const fch = new Date().toLocaleDateString('es-CL', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'America/Santiago' }).replace(/\./g, '').toUpperCase()
    const pc = (v, m) => m ? Math.min(100, Math.round(v / m * 100)) : 0, kp = pc(t.kcal, M.kcal)
    const mac = (l, v, m, k) => '<div class="keu__m' + k + '"><span><u></u>' + l + '</span><b><i data-kc="' + Math.round(+v || 0) + '">0</i><small>G</small></b><em><s style="width:' + pc(v, m) + '%"></s></em><small>META ' + n0(m) + ' G</small></div>'
    const cod = new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Santiago' }).slice(2).replace(/-/g, '') + '-' + hora.replace(':', '') + '-C' + S.num
    pantalla('<div class="keu__win"><div class="keu__wt">' +
      '<div class="keu__wh"><span>' + fch + ' · ' + hora + '</span><span class="keu__wok' + (ch ? ' ch' : '') + '">' + ico(ch ? '<path d="M7 7l10 10M17 7L7 17"/>' : '<path d="M5 12.5l4.5 4.5L19 7.5"/>') + (ch ? 'CHEAT MEAL' : 'REGISTRADA') + '</span></div>' +
      (S.modo === 'foto' && S.url ? '<div class="keu__wp"><img src="' + S.url + '" alt="Tu plato"><span>' + esc(etiqueta()) + '</span></div>' : '<div class="keu__wn">' + (esExtra() ? 'FUERA DEL PLAN' : 'COMIDA ' + S.num + '<small>DE ' + (p.comidas.length || '—') + '</small>') + '</div>') +
      '<span class="keu__wl">INGESTA DE ESTA COMIDA</span><div class="keu__wk"><b data-kc="' + Math.round(t.kcal) + '">0</b><span>KCAL' + (M.kcal ? '<br>META ' + n0(M.kcal) : '') + '</span></div>' +
      (M.kcal ? '<div class="keu__wb keu__wb--3">' + (() => { const a = (+t.proteina_g || 0) * 4, b = (+t.carbohidrato_g || 0) * 4, c = (+t.grasa_g || 0) * 9, T = a + b + c || 1, W = Math.min(100, t.kcal / M.kcal * 100); return [['p', a], ['c', b], ['g', c]].map(([k, v]) => '<s class="keu__k' + k + '" style="width:' + (v / T * W).toFixed(1) + '%"></s>').join('') + (t.kcal > M.kcal ? '<i class="keu__wbo" style="left:' + (M.kcal / t.kcal * 100).toFixed(1) + '%"></i>' : '') })() + '</div><div class="keu__wbp"><span><i data-kc="' + (M.kcal ? Math.round(t.kcal / M.kcal * 100) : 0) + '">0</i> % DE TU META</span><span>' + esc(ver.k) + (S.res.puntaje != null && !ch ? ' · ' + S.res.puntaje + '/100' : '') + '</span></div>' : '') +
      '<div class="keu__wm">' + mac('PROTEÍNA', t.proteina_g, M.proteina_g, 'p') + mac('CARBOS', t.carbohidrato_g, M.carbohidrato_g, 'c') + mac('GRASAS', t.grasa_g, M.grasa_g, 'g') + '</div>' +
      '<p class="keu__wx">' + (ch ? 'Quedó registrada como cheat meal: suma ' + n0(t.kcal) + ' kcal a tu día y aparece en tu reporte semanal. ' + esc(KE.proxima(S.res, S.cmp) || 'Vuelve a tu plan en la próxima comida.') : S.res.veredicto === 'alerta' && KE.proxima(S.res, S.cmp) ? esc(KE.proxima(S.res, S.cmp)) : 'Quedó sumada a tu ingesta de hoy.') + '</p>' +
      '<div class="keu__wf">' + bc(cod, 34) + '<span>Nº ' + cod + '</span></div></div></div>' +
      '<div class="keu__bt">' + (puedeCompartir() ? '<button type="button" class="keu__cta" onclick="KEU.compartir()">' + ico('<path d="M12 15V4M12 4l-4 4M12 4l4 4"/><path d="M5 13v5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-5"/>') + 'Compartir mi comida</button><button type="button" class="keu__sec" onclick="KEU.cerrar()">VOLVER A MI DÍA</button>' : '<button type="button" class="keu__cta" onclick="KEU.cerrar()">Volver a mi día</button>') + '</div>', 'REGISTRADO')
    tex(); cuenta(); SND('set'); SND('datos', .32, .7)   // registrada: confirmación + los números que corren
    if (S.cfg.onRegistrado) S.cfg.onRegistrado({ num: S.num, estado: S.res.cheat ? 'cheat' : 'cumplida' })
  } catch (e) { console.error('confirmar', e); st((e && (e.msg || e.message)) || 'No pudimos registrar. Prueba de nuevo.') }
  finally { S.busy = false }
}
// La historia solo existe para un registro válido hecho con una foto real del plato
function puedeCompartir(){ const d = S.r && S.r.deteccion || {}; return typeof KESH !== 'undefined' && S.modo === 'foto' && S.img && S.img.big && (!d.origen || d.origen === 'plato_real') }
function compartir(){
  if (!puedeCompartir()) return
  const p = plan(), c = comidaN(S.num), r = S.res
  KESH.abrir({ foto: S.img.big, al: r.alimentos, tot: r.totales, num: S.num, n: p.comidas.length, comida: 'Comida ' + S.num,
    estado: r.cheat || r.veredicto === 'alerta' ? 'registrada' : r.veredicto === 'adecuado' ? 'plan' : 'completada', fecha: new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Santiago' }) })
}
function init(cfg){ S.cfg = Object.assign(S.cfg, cfg || {}); if (!S._rz) { S._rz = 1; window.addEventListener('resize', () => { if ($('keuO') && !$('keuO').hidden) ajustarZonas() }) } }
window.KEU = { etq, etqAplicar, init, compartir, abrir, guia, extra, elegir: guia, camara, galeria, describir, coc, analizar, preparar, seguir, noSug, porcion, atras, cerrar, otra, sel, comida, nombre, gramos, mas, igualPlan, quitar, agregar, recalcular, confirmar, _S: S }
})()
