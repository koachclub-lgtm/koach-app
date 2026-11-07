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
`
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
const nomC = () => { const c = comidaN(S.num); return c ? low(c.nombre) : 'comida' }
function mostrar(){ el().hidden = false; document.documentElement.style.overflow = 'hidden' }
function cab(t, atras){ const e = $('keuT'); if (e) e.textContent = t || ''; const a = $('keuAtrasT'); if (a) a.textContent = atras || 'CERRAR'; S.atras = atras ? S.atrasFn : null }
function pantalla(h, t, atras, fn){ S.atrasFn = fn || null; cab(t, atras); const sc = $('keuSc'); sc.innerHTML = h; sc.scrollTop = 0 }
function atras(){ if (S.busy) return; if (S.atras) S.atras(); else cerrar() }
const etiqueta = () => { const c = comidaN(S.num), n = plan().comidas.length; return c ? 'COMIDA ' + S.num + ' DE ' + n + ' · ' + c.nombre : 'ESCÁNER' }

/** Abre el escáner. Con num: guía de foto para esa comida. Sin num: primero elige la comida. */
function abrir(num){
  if (S.busy) return
  el(); mostrar(); reset()
  if (num) return guia(+num)
  S.num = null
  const p = plan()
  pantalla('<div class="keu__hd"><span class="keu__lbl">ESCÁNER DE COMIDAS</span><h2>¿Qué comida vas a registrar?</h2></div><div class="keu__pad"><div class="keu__pk">' +
    p.comidas.map((c, i) => { const e = p.estado ? p.estado(i + 1) : null
      const pill = e === 'cumplida' ? '<span class="keu__pill done">' + ico(VER.adecuado.ico) + 'COMPLETADA</span>' : e === 'cheat' ? '<span class="keu__pill fill">CHEAT MEAL</span>' : '<span class="keu__pill">PENDIENTE</span>'
      return '<button type="button" class="' + (e ? 'ok' : '') + '" onclick="KEU.guia(' + (i + 1) + ')"><em>' + (i + 1) + '</em><span><b>' + esc(cap(low(c.nombre))) + '</b><small>' + esc(c.hora || '') + '</small></span>' + pill + '</button>' }).join('') +
    '</div></div>', 'ELIGE TU COMIDA')
}
function reset(){ S.porc = 1; S.noSug = false; S.fuente = null; S.r = null; S.al = []; S.res = null; S.cmp = null; S.sucio = false; S.coc = null; S.nota = ''; S.texto = ''; S.modo = 'foto'; S.sel = 0 }
/** Guía de captura: cómo sacar la foto + tomar foto / galería / describir sin foto */
function guia(num){
  if (num) S.num = +num
  pantalla('<div class="keu__hd"><span class="keu__lbl">' + esc(etiqueta()) + '</span><h2>Saca la foto de tu ' + esc(nomC()) + '</h2></div>' +
    '<div class="keu__pad"><div class="keu__gd"><div>' + ico(I.top) + 'Desde arriba</div><div>' + ico(I.sol) + 'Con buena luz</div><div>' + ico(I.plato) + 'Todo el plato</div></div>' +
    '<p class="keu__nota">La foto no se guarda: solo se usa para reconocer tu comida.</p></div>' +
    '<div class="keu__bt"><button type="button" class="keu__cta" onclick="KEU.camara()">' + ico(I.cam) + 'Tomar foto</button>' +
    '<button type="button" class="keu__sec" onclick="KEU.galeria()">' + ico(I.gal) + 'ELEGIR DE LA GALERÍA</button>' +
    '<button type="button" class="keu__lnk" onclick="KEU.describir()">' + ico(I.txt) + 'DESCRIBIR SIN FOTO</button></div>',
    etiqueta(), plan().comidas.length > 1 ? 'COMIDAS' : null, () => abrir())
}
function camara(){ if (!S.busy) $('keuF').click() }
function galeria(){ if (!S.busy) $('keuG').click() }
function cerrar(){ const o = $('keuO'); if (!o) return; o.hidden = true; document.documentElement.style.overflow = ''; if (S.url) { URL.revokeObjectURL(S.url); S.url = null } }

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
function coc(k){ S.coc = S.coc === k ? null : k; document.querySelectorAll('#keuSc .keu__co button').forEach((b, i) => b.setAttribute('aria-pressed', String(COC[i][0] === S.coc))) }
async function foto(file){
  mostrar(); S.modo = 'foto'
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
function describir(){
  S.modo = 'texto'
  pantalla('<div class="keu__hd"><span class="keu__lbl">' + esc(etiqueta()) + '</span><h2>¿Qué comiste?</h2><p>Escríbelo como se lo contarías a tu nutricionista. Si sabes las cantidades, inclúyelas.</p></div>' +
    '<div class="keu__pad"><label class="keu__lbl" for="keuTxt">TU ' + esc(nomC().toUpperCase()) + '</label><textarea id="keuTxt" class="keu__in" rows="4" maxlength="300" placeholder="Ej: 1 pechuga de pollo, 1 taza de arroz y ensalada de tomate" oninput="KEU._S.texto=this.value">' + esc(S.texto) + '</textarea>' +
    cocBotones() + '</div>' +
    '<div class="keu__bt"><button type="button" class="keu__cta" onclick="KEU.analizar()">Calcular mi ' + esc(nomC()) + '</button></div><div class="keu__sts" id="keuSt" role="status"></div>', etiqueta(), 'ATRÁS', () => guia())
}
async function analizar(){
  if (S.busy) return
  const c = comidaN(S.num), txt = S.modo === 'texto'
  if (txt && String(S.texto).trim().length < 3) { st('Cuéntanos qué comiste.'); const t = $('keuTxt'); if (t) t.focus(); return }
  S.busy = true
  pantalla(txt ? '<div class="keu__wait"><i></i>CALCULANDO TU ' + esc(nomC().toUpperCase()) + '…</div>'
    : '<div class="keu__ph"><img src="' + S.url + '" alt="Tu plato"><div class="keu__scan"></div><div class="keu__load">ANALIZANDO TU COMIDA…</div></div>', etiqueta())
  try {
    const base = { comida: c ? c.nombre : null, comida_num: S.num, coccion: S.coc, fuente: S.fuente }
    S.r = await api(txt ? Object.assign(base, { modo: 'describir', texto: S.texto }) : Object.assign(base, { imagen: S.img.data, nota: S.nota || null }))
    S.al = ((S.r.resultado && S.r.resultado.alimentos) || []).map(a => Object.assign({}, a)); S.sel = 0; S.sucio = false; S.porc = 1; S.noSug = false
    const dt = S.r.deteccion || {}
    if (!S.al.length || (S.r.resultado && S.r.resultado.veredicto === 'no_comida')) return sinComida()
    if (!txt && dt.origen && dt.origen !== 'plato_real') return noReal()
    if (!txt && (dt.calidad && dt.calidad !== 'buena' || (dt.confianza != null && dt.confianza < 0.45))) return pocoClara(dt.calidad)
    recalc(); pintar(true)
  } catch (e) {
    console.error('escaner', e)
    fallo(e)
  } finally { S.busy = false }
}
// ── Errores: cada uno dice qué pasó y siempre deja un camino (otra foto · describir sin foto · volver)
const IC_X = '<circle cx="12" cy="12" r="8.5"/><path d="M9 9l6 6M15 9l-6 6"/>', IC_I = '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5v5.5M12 16.4v.3"/>'
function aviso(o){
  const foto = o.foto !== false && S.url && S.modo === 'foto'
  pantalla((foto ? '<div class="keu__ph sm"><img src="' + S.url + '" alt="Tu foto"></div>' : '') +
    '<div class="keu__err">' + (foto ? '' : '<div class="ic">' + ico(o.ico || IC_I) + '</div>') + '<b>' + esc(o.t) + '</b>' + (o.p ? '<p>' + esc(o.p) + '</p>' : '') + (o.extra || '') + '</div>' +
    '<div class="keu__bt">' + o.bt.map((b, i) => '<button type="button" class="keu__' + (i === 0 ? 'cta' : i === 1 ? 'sec' : 'lnk') + '" onclick="' + b[1] + '">' + (i === 0 ? b[0] : b[0].toUpperCase()) + '</button>').join('') + '</div>', etiqueta(), o.atras || null, o.atrasFn)
}
const B_FOTO = ['Tomar otra foto', 'KEU.camara()'], B_TXT = ['Describir sin foto', 'KEU.describir()'], B_VOLVER = ['Volver', 'KEU.cerrar()']
const GUIA = () => '<div class="keu__gd"><div>' + ico(I.top) + 'Desde arriba</div><div>' + ico(I.sol) + 'Con buena luz</div><div>' + ico(I.plato) + 'Todo el plato</div></div>'
function sinComida(){
  if (S.modo === 'texto') return aviso({ ico: IC_X, t: 'No entendimos tu comida', p: 'Escribe cada alimento y, si puedes, su cantidad. Este intento no descuenta de tus escaneos del día.', bt: [['Escribir de nuevo', 'KEU.describir()'], B_VOLVER] })
  aviso({ t: 'En la foto no vemos comida', p: 'Este intento no descuenta de tus escaneos del día.', extra: GUIA(), bt: [B_FOTO, B_TXT, B_VOLVER] })
}
function noReal(){
  aviso({ t: 'Esta foto parece de una pantalla o de internet', p: 'Para registrar tu comida necesitamos una foto de tu plato. Si no la tienes, descríbela.', bt: [B_FOTO, B_TXT, B_VOLVER] })
}
function pocoClara(c){
  const T = { oscura: 'La foto está muy oscura', borrosa: 'La foto salió borrosa', incompleta: 'El plato no se ve completo' }
  aviso({ t: T[c] || 'No vemos bien tu plato', p: 'Con otra foto el cálculo sale más exacto. También puedes seguir con esta y revisar los alimentos.', extra: GUIA(), bt: [B_FOTO, ['Seguir con esta foto', 'KEU.seguir()'], B_TXT] })
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
  let h = S.modo === 'foto' && S.url ? '<div class="keu__ph sm"><img src="' + S.url + '" alt="Tu comida"><div class="keu__zs" id="keuZs">' + zonas() + '</div></div>' : ''
  // a qué comida corresponde (cambia la comparación al instante)
  h += '<div class="keu__ms" role="group" aria-label="¿Qué comida de tu plan es?">' + p.comidas.map((x, i) => '<button type="button" aria-pressed="' + (S.num === i + 1) + '" onclick="KEU.comida(' + (i + 1) + ')">' + (i + 1) + ' · ' + esc(String(x.nombre).slice(0, 12)) + '</button>').join('') + '</div>'
  h += '<div class="keu__pad">'
  // ¿calza mejor con otra comida del plan? (lo decide la comparación con el plan, no la IA)
  const sug = !S.noSug && c ? KE.comidaProbable(S.res.alimentos, p.comidas, S.num) : null
  if (sug) h += '<div class="keu__mm" role="status"><b>Esto se parece más a tu ' + esc(low(sug.nombre)) + '.</b><div><button type="button" onclick="KEU.comida(' + sug.num + ')">SÍ, ES MI ' + esc(String(sug.nombre).toUpperCase()) + '</button><button type="button" onclick="KEU.noSug()">NO, ES MI ' + esc(String(c.nombre).toUpperCase()) + '</button></div></div>'
  // 1 · lo que trae tu comida vs lo que te toca en esta comida del plan
  const t = r.totales, m = S.cmp && S.cmp.metas
  const mac = (lbl, val, meta) => { const pct = meta ? val / meta * 100 : 0
    return '<div><b>' + n0(val) + '<small> ' + (meta ? '/ ' + n0(meta) + ' g' : 'g') + '</small></b>' + (meta ? '<i><s style="width:' + Math.min(100, pct) + '%"></s></i>' : '<i></i>') + '<span class="' + (pct > 125 ? 'over' : '') + '">' + lbl + (pct > 125 ? ' · SOBRE' : '') + '</span></div>' }
  h += '<div class="keu__card keu__en"><span class="keu__lbl">' + (S.modo === 'texto' ? 'CALCULADO DE TU DESCRIPCIÓN' : 'ESTIMADO DE TU FOTO') + '</span>' +
    '<div class="r"><b>≈ ' + n0(t.kcal) + '</b><span>KCAL' + (m && m.kcal ? ' · TU PLAN ' + n0(m.kcal) : '') + '</span></div>' +
    '<div class="keu__mt">' + mac('PROTEÍNA', t.proteina_g, m && m.proteina_g) + mac('CARBOS', t.carbohidrato_g, m && m.carbohidrato_g) + mac('GRASAS', t.grasa_g, m && m.grasa_g) + '</div>' +
    '<div class="keu__vd keu__vd--' + (r.cheat ? 'alerta' : r.veredicto) + '"><span class="ic">' + ico(v.ico) + '</span><div><span class="keu__pill ' + (r.veredicto === 'adecuado' ? 'done' : r.cheat || r.veredicto === 'alerta' ? 'fill' : 'line') + '">' + (r.cheat ? 'CHEAT MEAL' : v.k) + '</span><b style="margin-top:8px">' + esc(r.titulo) + '</b><p>' + esc(r.mensaje) + '</p>' + (r.veredicto !== 'adecuado' && KE.proxima(r, S.cmp) ? '<span class="keu__sug">→ ' + esc(KE.proxima(r, S.cmp)) + '</span>' : '') + '</div>' +
    (r.puntaje != null && !r.cheat ? '<em role="img" aria-label="Puntaje ' + r.puntaje + ' de 100">' + r.puntaje + '<small>/100</small></em>' : '') + '</div></div>'
  // 2 · cómo va con tu plan
  if (S.cmp) {
    const E = { plan: ['done', 'EN TU PLAN'], reemplazo: ['line', 'REEMPLAZO'], fuera: ['fill', 'NO ADECUADO'], extra: ['', 'FUERA DEL PLAN'] }
    let rows = S.cmp.items.map(it => { const a = r.alimentos[it.idx], e = E[it.estado]
      return '<div class="keu__cm"><span><b>' + esc(cap(a.nombre)) + '</b>' + (it.estado === 'reemplazo' && it.ref ? ' en vez de ' + esc(low(it.ref)) : '') + '</span><span class="keu__pill ' + e[0] + '">' + (it.estado === 'plan' ? ico(VER.adecuado.ico) : '') + e[1] + '</span></div>' }).join('')
    rows += S.cmp.faltan.map(f => '<div class="keu__cm"><span>Tu plan incluye ' + esc(f.ej.join(' o ').toLowerCase() || f.rol.toLowerCase()) + '.</span><span class="keu__pill dash">FALTA ' + f.rol + '</span></div>').join('')
    rows += S.cmp.ajustes.map(a => '<div class="keu__cm"><span>' + esc(a.texto) + '</span><span class="keu__pill">PORCIÓN</span></div>').join('')
    h += '<div class="keu__card"><span class="keu__lbl" style="margin-bottom:8px">CÓMO VA CON TU PLAN · ' + esc(c.nombre) + '</span>' + rows + '</div>'
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
        '<div class="keu__mac">' + n0(ra.kcal) + ' KCAL · P ' + n0(ra.proteina_g) + ' · C ' + n0(ra.carbohidrato_g) + ' · G ' + n0(ra.grasa_g) + '</div></div>' }).join('') +
    '<button type="button" class="keu__add" onclick="KEU.agregar()">+ AGREGAR UN ALIMENTO</button>' +
    '<p class="keu__txt">' + (S.modo === 'texto' ? 'Las cantidades se calcularon desde tu descripción.' : 'Los gramos son una lectura aproximada de la foto.') + ' Si pesaste tu comida, corrígelos: así tu registro queda exacto.</p></div></div>'
  h += '<div class="keu__bt" id="keuBt">' + botones() + '</div><div class="keu__sts" id="keuSt" role="status"></div>'
  sc.innerHTML = h; sc.scrollTop = arriba ? 0 : y
  const img = sc.querySelector('.keu__ph img'); if (img) { if (img.complete) ajustarZonas(); else img.onload = ajustarZonas }
}
function st(m){ const s = $('keuSt'); if (s) s.textContent = m || '' }
function sel(i, sinPintar){
  S.sel = i
  document.querySelectorAll('#keuSc .keu__z').forEach(z => z.classList.toggle('on', +z.dataset.i === i))
  document.querySelectorAll('#keuSc .keu__ed').forEach((z, k) => z.classList.toggle('on', k === i))
  if (!sinPintar) { const row = document.querySelectorAll('#keuSc .keu__ed')[i]; if (row) row.scrollIntoView({ behavior: 'smooth', block: 'center' }) }
}
function comida(n){ S.num = +n; S.noSug = true; recalc(); pintar() }
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
function botones(){ const c = comidaN(S.num)
  return (S.sucio ? '<button type="button" class="keu__cta" onclick="KEU.recalcular()">Recalcular con mis cambios</button>' : '') +
    '<button type="button" class="keu__' + (S.sucio ? 'sec' : 'cta') + '"' + (S.sucio || !c ? ' disabled' : '') + ' onclick="KEU.confirmar()">' + (c ? (S.sucio ? 'CONFIRMAR Y REGISTRAR' : 'Confirmar y registrar') : 'Elige la comida') + '</button>' +
    '<button type="button" class="keu__lnk" onclick="KEU.otra()">' + ico(I.cam) + 'EMPEZAR DE NUEVO</button><button type="button" class="keu__lnk" onclick="KEU.cerrar()">DESCARTAR</button>' }
// escribir un nombre no repinta la pantalla (no se pierde el foco): solo cambian los botones
function pintarBotones(){ const b = $('keuBt'); if (b) b.innerHTML = botones() }
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
async function confirmar(){
  if (S.busy || S.sucio || !S.r || !S.num) return
  S.busy = true; st('Registrando…')
  try {
    const d0 = S.r.deteccion || {}
    const det = { plato: d0.plato || '', confianza: d0.confianza, modo: S.modo, coccion: S.coc, fuente: S.fuente, calidad: d0.calidad, porcion: S.porc, editado: S.al.some(a => a._n), detectado: (S.r.resultado && S.r.resultado.alimentos || []).map(a => ({ nombre: a.nombre, gramos: a.gramos })) }
    const res = Object.assign({}, S.res, { comparacion: S.cmp && { items: S.cmp.items, faltan: S.cmp.faltan.map(f => f.rol), ajustes: S.cmp.ajustes.map(a => a.tipo) } })
    await S.cfg.confirmar(S.r.id, S.num, det, res)
    const c = comidaN(S.num), t = S.res.totales
    pantalla('<div class="keu__ok"><div class="ic' + (S.res.cheat ? ' ch' : '') + '">' + ico(S.res.cheat ? VER.alerta.ico : VER.adecuado.ico) + '</div>' +
      '<b>' + esc(c ? cap(low(c.nombre)) : 'Comida') + (S.res.cheat ? ' registrado como cheat meal' : ' completado') + '</b><p>' + (S.res.cheat ? 'Registrarlo también es cumplir. ' + esc(KE.proxima(S.res, S.cmp) || 'Sigue tu plan en la próxima comida.') : S.res.veredicto === 'alerta' && KE.proxima(S.res, S.cmp) ? 'Quedó registrado en tu día. ' + esc(KE.proxima(S.res, S.cmp)) : 'Quedó registrado en tu día.') + '</p>' +
      '<span class="keu__lbl">≈ ' + n0(t.kcal) + ' KCAL · P ' + n0(t.proteina_g) + ' · C ' + n0(t.carbohidrato_g) + ' · G ' + n0(t.grasa_g) + '</span></div>' +
      '<div class="keu__bt">' + (puedeCompartir() ? '<button type="button" class="keu__cta" onclick="KEU.compartir()">' + ico('<path d="M12 15V4M12 4l-4 4M12 4l4 4"/><path d="M5 13v5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-5"/>') + 'Compartir mi comida</button><button type="button" class="keu__sec" onclick="KEU.cerrar()">VOLVER A MI DÍA</button>' : '<button type="button" class="keu__cta" onclick="KEU.cerrar()">Volver a mi día</button>') + '</div>', 'REGISTRADO')
    if (S.cfg.onRegistrado) S.cfg.onRegistrado({ num: S.num, estado: S.res.cheat ? 'cheat' : 'cumplida' })
  } catch (e) { console.error('confirmar', e); st((e && (e.msg || e.message)) || 'No pudimos registrar. Prueba de nuevo.') }
  finally { S.busy = false }
}
// La historia solo existe para un registro válido hecho con una foto real del plato
function puedeCompartir(){ const d = S.r && S.r.deteccion || {}; return typeof KESH !== 'undefined' && S.modo === 'foto' && S.img && S.img.big && (!d.origen || d.origen === 'plato_real') }
function compartir(){
  if (!puedeCompartir()) return
  const p = plan(), c = comidaN(S.num), r = S.res
  KESH.abrir({ foto: S.img.big, al: r.alimentos, tot: r.totales, num: S.num, n: p.comidas.length, comida: c ? c.nombre : 'Comida',
    estado: r.cheat || r.veredicto === 'alerta' ? 'registrada' : r.veredicto === 'adecuado' ? 'plan' : 'completada', fecha: new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Santiago' }) })
}
function init(cfg){ S.cfg = Object.assign(S.cfg, cfg || {}); if (!S._rz) { S._rz = 1; window.addEventListener('resize', () => { if ($('keuO') && !$('keuO').hidden) ajustarZonas() }) } }
window.KEU = { init, compartir, abrir, guia, elegir: guia, camara, galeria, describir, coc, analizar, preparar, seguir, noSug, porcion, atras, cerrar, otra, sel, comida, nombre, gramos, mas, igualPlan, quitar, agregar, recalcular, confirmar, _S: S }
})()
