// KOACH Visual Bridge — servidor MCP (Streamable HTTP, sin estado) para la biblioteca de fotos de ejercicios.
// Genera con Gemini, guarda en Supabase Storage y registra en public.recursos_visuales.
// Variables de entorno: GEMINI_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, BRIDGE_TOKEN, (opcional) GEMINI_IMAGE_MODEL
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const SB = (process.env.SUPABASE_URL || 'https://siecbdatfgmqbpxqtvsl.supabase.co').replace(/\/$/, '');
const SK = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BUCKET = 'ejercicios-media';
const QA_MODELS = [process.env.GEMINI_QA_MODEL, 'gemini-3-flash', 'gemini-2.5-flash', 'gemini-flash-latest'].filter(Boolean);
const MODELS = [process.env.GEMINI_IMAGE_MODEL, 'gemini-nano-banana-2.1', 'gemini-3.1-flash-image', 'gemini-2.5-flash-image'].filter(Boolean);

const ATLETA = {
  m: { ref: 'ref_atleta_m.jpg', vistas: 'twice', panel: 'two-panel',
    desc: 'Athlete: man in his early 30s, short dark hair, light stubble, athletic but attainable physique (not a bodybuilder), NO tattoos, fitted plain black short-sleeve t-shirt and plain black shorts above the knee, both with NO logos or text, black shoes with grey soles. Calm focused expression, not looking at the camera.' },
  f: { ref: 'ref_atleta_f.jpg', vistas: 'four times', panel: 'four-panel',
    desc: 'Athlete: woman around 30, medium brown hair tied in a low ponytail, warm light-olive skin, slim toned athletic physique (fit but not exaggerated), black racerback sports bra and black fitted biker shorts to mid-thigh, both plain with NO logos or text, black training shoes with grey soles and short black socks. ONE single fine-line floral tattoo on the outer side of the LEFT lower leg (shin/calf), exactly as in the reference; no other tattoos, no jewelry, no accessories. Calm focused expression, not looking at the camera.' }
};
const MASTER_FOR = (g) => `The attached image shows the SAME athlete ${ATLETA[g].vistas}, only as an identity and style reference (face, hair, body, outfit, grey backdrop, lighting). Ignore the poses and the ${ATLETA[g].panel} layout.
Create ONE single square photograph (1:1) with ONE person performing ONE exercise, described below.
Hyperrealistic commercial studio sports photography for a premium strength-training app. It will be shown as a tiny 56 px thumbnail, so frame it tightly: the athlete and the equipment they touch fill about 85% of the frame, with a strong, clear silhouette. Never cut off hands, bars, dumbbells, handles or feet. Crop away unnecessary machine structure.
${ATLETA[g].desc}
Seamless plain light grey backdrop (#C4C4C4), no horizon line. Soft key light from the front-side, subtle rim light separating the black clothes from the background. Natural true color: real skin tone, deep blacks, neutral grey; neutral white balance, no color cast, no desaturated or black-and-white look.
Equipment: matte graphite and black with brushed steel, no brands, mechanically plausible.
STRICT ANATOMY (most important):
- Exactly one person with exactly two arms, two hands, two legs and two feet. No extra, missing, merged or duplicated limbs.
- Every limb visibly connects to the torso; each foot connects to its own leg; follow each leg from hip to foot without ambiguity.
- Neck neutral and in line with the spine, head in a natural position (when lying on a bench, the back of the head rests on the bench; never bent sharply backward, forward or sideways).
- Natural joint angles only: no hyperextended elbows or knees, no twisted wrists, shoulders level and symmetric unless the exercise is single-arm.
- Five fingers per hand wrapped around handles, thumbs closed around bars. Cables taut and anchored.
- For two-handed exercises both hands must be visibly on the implement; choose a camera angle where both arms are readable instead of hiding one.
No text, numbers, logos, mirrors or other people.
EXERCISE:`;
const G = (g) => (g === 'f' ? 'f' : 'm');
// columnas por género en recursos_visuales
const COLS = {
  m: { ruta: 'ruta_m', full: 'ruta_full_m', estado: 'estado', version: 'version', nota: 'nota', origen: 'origen', aprob: 'aprobada_at', lote: 'lote_intentos' },
  f: { ruta: 'ruta_f', full: 'ruta_full_f', estado: 'estado_f', version: 'version_f', nota: 'nota_f', origen: 'origen_f', aprob: 'aprobada_f_at', lote: 'lote_intentos_f' }
};

const REF = {};
function refImage(g = 'm') {
  if (!REF[g]) REF[g] = fs.readFileSync(path.join(__dirname, '..', 'seed', ATLETA[g].ref)).toString('base64');
  return REF[g];
}

async function sb(pathq, opts = {}) {
  const r = await fetch(`${SB}${pathq}`, {
    ...opts,
    headers: { apikey: SK, ...(SK && SK.startsWith('sb_') ? {} : { Authorization: `Bearer ${SK}` }), ...(opts.headers || {}) }
  });
  const txt = await r.text();
  if (!r.ok) throw new Error(`Supabase ${r.status}: ${txt.slice(0, 300)}`);
  try { return JSON.parse(txt); } catch { return txt; }
}
const rest = (q, opts) => sb(`/rest/v1/${q}`, opts);
const publicUrl = (p) => `${SB}/storage/v1/object/public/${BUCKET}/${p}`;

async function upload(p, buf, type = 'image/webp') {
  await sb(`/storage/v1/object/${BUCKET}/${p}`, {
    method: 'POST', body: buf,
    headers: { 'Content-Type': type, 'x-upsert': 'true', 'cache-control': 'max-age=31536000' }
  });
  return p;
}

async function thumbData(ruta) {
  if (!ruta) return null;
  try {
    const r = await fetch(publicUrl(ruta));
    if (!r.ok) return null;
    return 'data:image/webp;base64,' + Buffer.from(await r.arrayBuffer()).toString('base64');
  } catch { return null; }
}

async function patchRecurso(key, body) {
  return rest(`recursos_visuales?visual_key=eq.${encodeURIComponent(key)}`, {
    method: 'PATCH', body: JSON.stringify({ ...body, updated_at: new Date().toISOString() }),
    headers: { 'Content-Type': 'application/json', Prefer: 'return=representation' }
  });
}

async function gemini(prompt, extra = [], g = 'm') {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error('Falta GEMINI_API_KEY en Vercel.');
  let lastErr;
  for (const model of MODELS) {
    for (const imageConfig of [{ aspectRatio: '1:1', imageSize: '1K' }, { aspectRatio: '1:1' }, null]) {
      const body = {
        contents: [{ role: 'user', parts: [{ text: prompt }, { inline_data: { mime_type: 'image/jpeg', data: refImage(g) } }, ...extra.map(d => ({ inline_data: { mime_type: 'image/jpeg', data: d } }))] }],
        generationConfig: { responseModalities: ['IMAGE'], ...(imageConfig ? { imageConfig } : {}) }
      };
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key }, body: JSON.stringify(body)
      });
      const j = await r.json().catch(() => ({}));
      if (r.status === 404) { lastErr = `modelo ${model} no disponible`; break; }
      if (!r.ok) { lastErr = `Gemini ${r.status}: ${JSON.stringify(j).slice(0, 300)}`; if (r.status === 400 && imageConfig) continue; throw new Error(lastErr); }
      const parts = j?.candidates?.[0]?.content?.parts || [];
      const img = parts.find(p => p.inlineData || p.inline_data);
      if (!img) { lastErr = 'Gemini no devolvió imagen: ' + (parts.find(p => p.text)?.text || j?.candidates?.[0]?.finishReason || 'sin detalle'); throw new Error(lastErr); }
      return { model, data: Buffer.from((img.inlineData || img.inline_data).data, 'base64') };
    }
  }
  throw new Error(lastErr || 'Sin modelo de imagen disponible');
}



// Diccionario de terminología KOACH: reglas deterministas derivadas del nombre (visual_key).
// Tienen prioridad sobre la descripción porque los modelos tienden a ignorar el agarre.
function koachRules(key) {
  const k = '-' + key + '-', has = (re) => re.test(k), R = [];
  // implemento
  if (has(/-bb-/) && !has(/ez-bar/)) R.push('Implement: one straight Olympic barbell with plates (not dumbbells, not an EZ-bar).');
  if (has(/ez-bar/)) R.push('Implement: an EZ curl bar with the zig-zag angled grip section.');
  if (has(/-db-/)) R.push('Implement: dumbbells (not a barbell).');
  if (has(/-kb-/)) R.push('Implement: kettlebell.');
  if (has(/-mb-/)) R.push('Implement: a small loop mini band around the legs.');
  if (has(/hex-bar/)) R.push('Implement: a hexagonal trap bar with the athlete standing inside it, neutral handles.');
  if (has(/-cable-/) && !has(/-rope-/)) R.push('Implement: cable machine; the cable runs straight and taut from the handle to the pulley.');
  if (has(/-rope-/)) R.push('Attachment: a rope attachment with two separate rope ends, one in each hand.');
  // agarre: en KOACH prone/supine/neutral describen la mano, NUNCA la posición del cuerpo
  if (has(/-(prone|pronated)-/)) R.push('GRIP = PRONATED (overhand): palms facing down/away from the body, knuckles up. In KOACH names "prone" refers ONLY to the grip, NOT to lying face down; keep the normal body position of the exercise.');
  if (has(/-(supine|supinated)-/)) R.push('GRIP = SUPINATED (underhand): palms facing up/toward the body. In KOACH names "supine" refers ONLY to the grip, NOT to lying on the back; keep the normal body position of the exercise.');
  if (has(/-neutral-/)) R.push('GRIP = NEUTRAL: palms facing each other, using parallel handles or a V-handle; never an overhand or underhand bar grip.');
  if (has(/-close-grip-/)) R.push('GRIP = CLOSE: hands only about shoulder-width apart or narrower, clearly much narrower than a standard grip, with a long section of bar visible between each hand and the plates.');
  if (has(/-wide-/)) R.push('GRIP = WIDE: hands well outside shoulder width.');
  if (has(/-(single|single-arm|one-arm)-/)) R.push('ONE ARM ONLY: exactly one hand holds the handle/dumbbell; the other hand rests on the hip, thigh or a support and holds nothing.');
  if (has(/-alternating-/)) R.push('ALTERNATING: one side at the end of the movement and the other side at the start, clearly asymmetric.');
  if (has(/-hammer-/)) R.push('GRIP = HAMMER: neutral grip, palms facing each other, thumbs up.');
  // aditamentos típicos
  if (has(/seated-row/) && !has(/-(prone|supine|single)-/)) R.push('Attachment: a close-grip V-handle (two parallel handles 15 cm apart), neutral grip.');
  if (has(/lat-pulldown|pulldown/) && !has(/-(neutral|single)-/)) R.push('Attachment: a straight lat pulldown bar held with both hands.');
  if (has(/-iso-|-iso$|hold/)) R.push('Static hold: show the held position, no motion.');
  return R;
}

// Control anatómico automático: un modelo de visión revisa la foto antes de guardarla.
async function qa(imgBuf, desc, rules = []) {
  const key = process.env.GEMINI_API_KEY;
  const prompt = `You are a quality inspector for exercise photos in a fitness app. Inspect the image carefully and classify each problem by severity.
Expected exercise: ${desc}${rules.length ? `\nMandatory rules (a violation of any of these is CRITICAL): ${rules.join(' ')}` : ''}
CRITICAL problems (the photo must be redone): more or fewer than one person; an extra, duplicated or merged limb, hand or foot; a limb that should be clearly visible but is missing or detached; a deformed limb, hand or forearm; head or neck bent in a clearly unnatural way; a joint at an impossible angle; floating or physically impossible equipment; a different exercise than expected (wrong body position, e.g. lying instead of standing, wrong implement type such as dumbbells instead of barbell, one hand instead of two hands, or vice versa); visible text.
Note: a small fine-line tattoo on the athlete's lower leg is part of the character design, not text.
MINOR observations (do not redo): camera angle slightly different from requested; joint angles a bit off; grip or handle variant slightly different; small logos on clothing; equipment details or cropping preferences.
IMPORTANT: a limb hidden behind the torso or the equipment because of the camera angle is NOT missing; only report it if the visible parts look wrong.
Answer ONLY JSON: {"critical": [short English strings], "minor": [short English strings]}. Empty arrays if none.`;
  for (const model of QA_MODELS) {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: prompt }, { inline_data: { mime_type: 'image/jpeg', data: imgBuf.toString('base64') } }] }],
        generationConfig: { responseMimeType: 'application/json', temperature: 0 } })
    });
    if (r.status === 404) continue;
    const j = await r.json().catch(() => ({}));
    if (!r.ok) return { ok: null, issues: [`QA no disponible (${r.status})`], minor: [], model };
    const txt = (j?.candidates?.[0]?.content?.parts || []).map(p => p.text || '').join('');
    try {
      const o = JSON.parse(txt.replace(/^```json|```$/g, '').trim());
      const crit = Array.isArray(o.critical) ? o.critical : [], minor = Array.isArray(o.minor) ? o.minor : [];
      return { ok: crit.length === 0, issues: crit, minor, model };
    } catch { return { ok: null, issues: ['QA sin respuesta legible'], minor: [], model }; }
  }
  return { ok: null, issues: ['QA sin modelo disponible'], minor: [] };
}

// ---------- herramientas ----------
const TOOLS = {
  listar_grupos: {
    description: 'Resumen de la biblioteca de fotos por grupo muscular: total de ejercicios y cuántos están aprobados, provisionales, pendientes, por corregir o sin foto. genero: m (hombre, por defecto) o f (mujer).',
    inputSchema: { type: 'object', properties: { genero: { type: 'string', enum: ['m', 'f'] } } },
    async run({ genero } = {}) {
      const ej = await rest('ejercicios?select=grupo_muscular,visual_key,recursos_visuales(estado,estado_f)&activo=eq.true');
      const g = {}, C = COLS[G(genero)];
      for (const e of ej) {
        const k = e.grupo_muscular || 'SIN GRUPO';
        g[k] = g[k] || { grupo: k, total: 0, aprobada: 0, provisional: 0, pendiente: 0, corregir: 0, sin_foto: 0 };
        g[k].total++; g[k][e.recursos_visuales?.[C.estado] || 'sin_foto']++;
      }
      return Object.values(g).sort((a, b) => a.grupo.localeCompare(b.grupo));
    }
  },
  listar_ejercicios: {
    description: 'Ejercicios de un grupo muscular con su visual_key, estado de foto, descripción visual y miniatura (data URI webp de 192 px) si existe.',
    inputSchema: { type: 'object', properties: { grupo: { type: 'string', description: 'Grupo muscular, ej. PECHO' }, con_miniaturas: { type: 'boolean', default: true }, genero: { type: 'string', enum: ['m', 'f'] } }, required: ['grupo'] },
    async run({ grupo, con_miniaturas = true, genero }) {
      const C = COLS[G(genero)];
      const ej = await rest(`ejercicios?select=id,nombre,grupo_muscular,implemento,visual_key,recursos_visuales(*)&activo=eq.true&grupo_muscular=eq.${encodeURIComponent(grupo)}&order=nombre`);
      return Promise.all(ej.map(async e => { const r = e.recursos_visuales || {}; return {
        id: e.id, nombre: e.nombre, implemento: e.implemento, visual_key: e.visual_key, genero: G(genero),
        estado: r[C.estado] || 'sin_foto', version: r[C.version] || 0,
        referencia: !!r.ref_ruta, descripcion: r.descripcion || null, nota: r[C.nota] || null,
        miniatura: con_miniaturas ? await thumbData(r[C.ruta]) : null
      }; }));
    }
  },
  guardar_descripcion: {
    description: 'Guarda la descripción visual (en inglés: posición, agarre, fase y ángulo de cámara) de un visual_key. Se usa como instrucción para Gemini.',
    inputSchema: { type: 'object', properties: { visual_key: { type: 'string' }, descripcion: { type: 'string' } }, required: ['visual_key', 'descripcion'] },
    async run({ visual_key, descripcion }) { await patchRecurso(visual_key, { descripcion }); return { ok: true, visual_key }; }
  },
  generar_imagen: {
    description: 'Genera con Gemini una foto nueva para un visual_key, pasa un control anatómico automático (reintenta 1 vez solo ante errores críticos), la guarda como nueva versión y devuelve su miniatura y el resultado del control. Tarda 20-90 segundos.',
    inputSchema: { type: 'object', properties: { visual_key: { type: 'string' }, descripcion: { type: 'string', description: 'Descripción del ejercicio; si se omite se usa la guardada' }, correccion: { type: 'string', description: 'Ajuste puntual pedido por el revisor' }, sin_miniatura: { type: 'boolean', description: 'true en procesos por lote: no devuelve la imagen' }, genero: { type: 'string', enum: ['m', 'f'], description: 'm = avatar hombre (defecto), f = avatar mujer' } }, required: ['visual_key'] },
    async run({ visual_key, descripcion, correccion, sin_miniatura, genero }) {
      const g = G(genero), C = COLS[g];
      const [rec] = await rest(`recursos_visuales?visual_key=eq.${encodeURIComponent(visual_key)}&select=*`);
      if (!rec) throw new Error(`visual_key desconocido: ${visual_key}`);
      const desc = descripcion || rec.descripcion;
      if (!desc) throw new Error('Este ejercicio no tiene descripción visual todavía.');
      let extra = correccion ? `\nIMPORTANT CORRECTION: ${correccion}` : '';
      const rules = koachRules(visual_key);
      let refs = [], refNote = '';
      // c85 · versión femenina = la MISMA foto aprobada del hombre con el avatar reemplazado (image-to-image), no una foto nueva
      let espejo = false;
      if (g === 'f' && (rec.estado === 'aprobada' || rec.estado === 'provisional') && (rec.ruta_full_m || rec.ruta_m)) {
        const rm = await fetch(publicUrl(rec.ruta_full_m || rec.ruta_m));
        if (rm.ok) { refs.push(Buffer.from(await rm.arrayBuffer()).toString('base64')); espejo = true;
          refNote += '\nCOMPOSITION REFERENCE (most important): the SECOND attached image is our approved photo of this exact exercise performed by the male athlete. Recreate it as faithfully as possible: identical camera angle, framing and crop, identical equipment and its placement, identical body position, limb angles, grip and movement phase, identical lighting and backdrop. The ONLY change is the person: replace the male athlete with the female athlete from the FIRST image (her face, hair, body, sports bra, biker shorts, shoes and her leg tattoo), adapting proportions naturally. Do not add, remove or move anything else.'; }
      }
      if (rec.ref_ruta) {
        const rr = await fetch(publicUrl(rec.ref_ruta));
        if (rr.ok) { refs = [Buffer.from(await rr.arrayBuffer()).toString('base64')];
          refNote += `\nEQUIPMENT REFERENCE: the ${espejo ? 'THIRD' : 'SECOND'} attached image shows the exact machine/equipment and body position to use. Reproduce its geometry, handles, pads, seat and the athlete position faithfully, restyled as matte graphite equipment in our photographic studio style. Ignore that image\'s drawing style, colors, muscle highlighting, numbers, text and background.`; }
      }
      let model, data, check, intentos = 0;
      for (intentos = 1; intentos <= 2; intentos++) {
        ({ model, data } = await gemini(`${MASTER_FOR(g)}\n${desc}${refNote}${rules.length ? `\nMANDATORY KOACH RULES (override the description if they conflict):\n- ${rules.join('\n- ')}` : ''}${extra}`, refs, g));
        const jpg = await sharp(data).resize(768, 768, { fit: 'cover' }).jpeg({ quality: 85 }).toBuffer();
        check = await qa(jpg, desc, rules);
        if (check.ok !== false) break;
        extra = `${correccion ? `\nIMPORTANT CORRECTION: ${correccion}` : ''}\nA previous attempt had these defects, avoid them: ${check.issues.join('; ')}.`;
      }
      const v = (rec[C.version] || 0) + 1;
      const square = sharp(data).resize(1024, 1024, { fit: 'cover', position: 'centre' });
      const full = await square.clone().webp({ quality: 82 }).toBuffer();
      const thumb = await sharp(data).resize(192, 192, { fit: 'cover', position: 'centre', kernel: 'lanczos3' }).sharpen({ sigma: 0.5 }).webp({ quality: 80 }).toBuffer();
      const ruta = `ex/${visual_key}_${g}_v${v}.webp`, rutaFull = `ex/full/${visual_key}_${g}_v${v}.webp`;
      await upload(ruta, thumb); await upload(rutaFull, full);
      const estado = check.ok === false ? 'corregir' : 'pendiente';
      const nota = check.ok === false ? `Control automático: ${check.issues.join('; ')}` : (check.minor && check.minor.length ? `Observaciones: ${check.minor.join('; ')}` : (correccion || null));
      await patchRecurso(visual_key, { [C.version]: v, [C.ruta]: ruta, [C.full]: rutaFull, [C.estado]: estado, descripcion: desc, [C.nota]: nota, [C.origen]: `gemini-api:${model}` });
      return { visual_key, genero: g, version: v, estado, nota, espejo, control: { ok: check.ok, problemas: check.issues, observaciones: check.minor || [], intentos: Math.min(intentos, 2) }, modelo: model, kb: Math.round(thumb.length / 1024), miniatura: sin_miniatura ? null : 'data:image/webp;base64,' + thumb.toString('base64') };
    }
  },
  guardar_referencia: {
    description: 'Guarda una imagen de referencia del equipamiento o la postura para un visual_key (base64 JPEG/PNG). Las siguientes generaciones la usan.',
    inputSchema: { type: 'object', properties: { visual_key: { type: 'string' }, imagen_base64: { type: 'string', description: 'Imagen en base64, sin prefijo data:' } }, required: ['visual_key', 'imagen_base64'] },
    async run({ visual_key, imagen_base64 }) {
      const raw = Buffer.from(String(imagen_base64).replace(/^data:[^,]+,/, ''), 'base64');
      const jpg = await sharp(raw).flatten({ background: '#ffffff' }).resize(1024, 1024, { fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 85 }).toBuffer();
      const ruta = `ref/${visual_key}.jpg`;
      await upload(ruta, jpg, 'image/jpeg');
      await patchRecurso(visual_key, { ref_ruta: ruta });
      return { ok: true, visual_key, kb: Math.round(jpg.length / 1024) };
    }
  },
  usar_foto: {
    description: 'Usa una imagen subida por el revisor como foto definitiva del visual_key (nueva versión, estado pendiente), sin pasar por Gemini.',
    inputSchema: { type: 'object', properties: { visual_key: { type: 'string' }, imagen_base64: { type: 'string', description: 'Imagen en base64, sin prefijo data:' }, genero: { type: 'string', enum: ['m', 'f'] } }, required: ['visual_key', 'imagen_base64'] },
    async run({ visual_key, imagen_base64, genero }) {
      const g = G(genero), C = COLS[g];
      const [rec] = await rest(`recursos_visuales?visual_key=eq.${encodeURIComponent(visual_key)}&select=version,version_f`);
      if (!rec) throw new Error(`visual_key desconocido: ${visual_key}`);
      const raw = Buffer.from(String(imagen_base64).replace(/^data:[^,]+,/, ''), 'base64');
      const v = (rec[C.version] || 0) + 1;
      // Fotos no cuadradas: se encajan completas y se rellena con el gris del fondo (muestreado en una esquina)
      const base = sharp(raw).rotate();
      const meta = await base.metadata();
      const { data: px } = await base.clone().extract({ left: 0, top: 0, width: 4, height: 4 }).raw().toBuffer({ resolveWithObject: true });
      const bg = { r: px[0], g: px[1], b: px[2] };
      const lado = Math.max(meta.width || 1024, meta.height || 1024);
      const cuadrada = await base.clone().resize(lado, lado, { fit: 'contain', background: bg }).png().toBuffer();
      const full = await sharp(cuadrada).resize(1024, 1024, { fit: 'cover' }).webp({ quality: 82 }).toBuffer();
      const thumb = await sharp(cuadrada).resize(192, 192, { fit: 'cover', kernel: 'lanczos3' }).sharpen({ sigma: 0.5 }).webp({ quality: 80 }).toBuffer();
      const ruta = `ex/${visual_key}_${g}_v${v}.webp`, rutaFull = `ex/full/${visual_key}_${g}_v${v}.webp`;
      await upload(ruta, thumb); await upload(rutaFull, full);
      await patchRecurso(visual_key, { [C.version]: v, [C.ruta]: ruta, [C.full]: rutaFull, [C.estado]: 'pendiente', [C.nota]: null, [C.origen]: 'subida-manual' });
      return { visual_key, genero: g, version: v, estado: 'pendiente', kb: Math.round(thumb.length / 1024), miniatura: 'data:image/webp;base64,' + thumb.toString('base64') };
    }
  },
  reevaluar: {
    description: 'Vuelve a pasar el control anatómico sobre la foto ya guardada (sin regenerar ni costo de imagen) y actualiza su estado.',
    inputSchema: { type: 'object', properties: { visual_key: { type: 'string' }, genero: { type: 'string', enum: ['m', 'f'] } }, required: ['visual_key'] },
    async run({ visual_key, genero }) {
      const g = G(genero), C = COLS[g];
      const [rec] = await rest(`recursos_visuales?visual_key=eq.${encodeURIComponent(visual_key)}&select=*`);
      if (!rec || !(rec[C.full] || rec[C.ruta])) throw new Error('Este ejercicio no tiene foto guardada.');
      const r = await fetch(publicUrl(rec[C.full] || rec[C.ruta]));
      if (!r.ok) throw new Error(`No se pudo leer la foto (${r.status})`);
      const jpg = await sharp(Buffer.from(await r.arrayBuffer())).resize(768, 768, { fit: 'cover' }).jpeg({ quality: 85 }).toBuffer();
      const check = await qa(jpg, rec.descripcion || visual_key, koachRules(visual_key));
      if (check.ok === null) return { visual_key, estado: rec[C.estado], control: check };
      const estado = check.ok ? (rec[C.estado] === 'corregir' ? 'pendiente' : rec[C.estado]) : 'corregir';
      const nota = check.ok ? (check.minor.length ? `Observaciones: ${check.minor.join('; ')}` : null) : `Control automático: ${check.issues.join('; ')}`;
      await patchRecurso(visual_key, { [C.estado]: estado, [C.nota]: nota });
      return { visual_key, genero: g, estado, nota, control: { ok: check.ok, problemas: check.issues, observaciones: check.minor, intentos: 0 } };
    }
  },
  revisar: {
    description: 'Marca una foto como aprobada, provisional o para corregir (con nota).',
    inputSchema: { type: 'object', properties: { visual_key: { type: 'string' }, estado: { type: 'string', enum: ['aprobada', 'provisional', 'corregir'] }, nota: { type: 'string' }, genero: { type: 'string', enum: ['m', 'f'] } }, required: ['visual_key', 'estado'] },
    async run({ visual_key, estado, nota, genero }) {
      const C = COLS[G(genero)];
      const body = { [C.estado]: estado, [C.nota]: nota || null };
      if (estado === 'aprobada') body[C.aprob] = new Date().toISOString();
      const r = await patchRecurso(visual_key, body);
      return { ok: true, visual_key, genero: G(genero), estado: r?.[0]?.[C.estado] };
    }
  },
  vincular: {
    description: 'Asigna un visual_key existente a uno o más ejercicios (por id), para que compartan foto.',
    inputSchema: { type: 'object', properties: { visual_key: { type: 'string' }, ejercicio_ids: { type: 'array', items: { type: 'string' } } }, required: ['visual_key', 'ejercicio_ids'] },
    async run({ visual_key, ejercicio_ids }) {
      await rest(`ejercicios?id=in.(${ejercicio_ids.map(encodeURIComponent).join(',')})`, {
        method: 'PATCH', body: JSON.stringify({ visual_key }), headers: { 'Content-Type': 'application/json' }
      });
      return { ok: true, visual_key, ejercicios: ejercicio_ids.length };
    }
  },
  sembrar_iniciales: {
    description: 'Sube las fotos de PECHO ya aprobadas en la prueba con Gemini (una sola vez).',
    inputSchema: { type: 'object', properties: {} },
    async run() {
      const man = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'seed', 'manifest.json'), 'utf8'));
      const out = [];
      for (const m of man) {
        const buf = fs.readFileSync(path.join(__dirname, '..', 'seed', m.archivo));
        const ruta = `ex/${m.visual_key}_m_v1.webp`;
        await upload(ruta, buf);
        await patchRecurso(m.visual_key, { version: 1, ruta_m: ruta, estado: m.estado, origen: 'gemini-app', aprobada_at: m.estado === 'aprobada' ? new Date().toISOString() : null });
        out.push(m.visual_key);
      }
      return { subidas: out.length, visual_keys: out };
    }
  }
};


// ---------- modo lote (cola nocturna disparada por pg_cron + pg_net) ----------
const ORDEN_GRUPOS = ['CUÁDRICEPS','GLÚTEOS','ESPALDA','ISQUIOS','HOMBROS','BÍCEPS','TRÍCEPS','GEMELOS','CORE','GLOBAL','CARDIO','MOVILIDAD','PECHO'];
async function redactar(nombre, implemento, rules) {
  const key = process.env.GEMINI_API_KEY;
  const prompt = `Write precise image-generation instructions for ONE exercise photo in a strength-training app. Describe the body configuration unambiguously because image models make anatomical mistakes. ONE paragraph in English, 60 to 110 words, in this order: (1) exercise name and exact equipment (implement, how many, bench or machine and its angle); (2) body support: what touches the bench/floor/seat and where each foot is; (3) head and neck neutral, in line with the spine; (4) each arm and hand: grip type, hand width, what each hand holds; (5) the most recognizable movement phase with joint angles (press: elbows at 90 degrees; rows and pulldowns: peak contraction; flys: controlled stretch; squats/lunges/hinges: bottom position; jumps: highest point; isometrics and mobility: held position); (6) camera: one of "pure side view", "three-quarter view from the feet slightly above", "three-quarter front view", "low side view". No style, lighting or clothing words. KOACH conventions: BB = barbell, DB = dumbbells, KB = kettlebell, MB = mini band, CABLE = cable pulley; "prone" = PRONATED overhand grip and "supine" = SUPINATED underhand grip (never a lying position); "neutral" = palms facing each other; "close-grip" = hands shoulder-width or narrower; "single" = one arm or leg works; "alternating" = asymmetric; "ISO" = held position; "pulse" = short range at the bottom; "1 1/2" = show the bottom position.
${rules.length ? 'Mandatory rules: ' + rules.join(' ') : ''}
Exercise name: "${nombre}". Implement: ${implemento || 'unknown'}. Answer with the paragraph only.`;
  for (const model of QA_MODELS) {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: prompt }] }], generationConfig: { temperature: 0.2 } }) });
    if (r.status === 404) continue;
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(`Gemini texto ${r.status}: ${JSON.stringify(j).slice(0, 200)}`);
    const txt = (j?.candidates?.[0]?.content?.parts || []).map(p => p.text || '').join('').trim();
    if (txt) return txt;
  }
  throw new Error('Sin modelo de texto disponible');
}
async function loteSiguiente(genero) {
  const g = G(genero), C = COLS[g];
  const filas0 = await rest('ejercicios?select=nombre,implemento,grupo_muscular,visual_key,recursos_visuales(*)&activo=eq.true');
  // vista normalizada por género: estado/origen/nota/lote_intentos apuntan a las columnas del género pedido
  const filas = filas0.map(e => { const r = e.recursos_visuales; return r ? { ...e, recursos_visuales: { ...r, estado_m: r.estado, estado: r[C.estado], origen: r[C.origen], nota: r[C.nota], lote_intentos: r[C.lote], updated_at: r.updated_at } } : e; });
  const ahora = Date.now(), vistos = new Set();
  const prio = (e) => (ORDEN_GRUPOS.indexOf(e.grupo_muscular) + 99) % 99;
  const cand = filas.filter(e => {
    const r = e.recursos_visuales; if (!r || vistos.has(e.visual_key)) return false; vistos.add(e.visual_key);
    if (r.origen === 'procesando' && ahora - Date.parse(r.updated_at) < 6 * 60 * 1000) return false;   // otro worker lo tiene
    if (r.origen === 'omitido') return false;
    if (r.estado === 'sin_foto') return true;
    // segunda pasada: las que el control dejó en "corregir" por error automático, un reintento más
    if (r.estado === 'corregir' && (r.lote_intentos || 0) < 2 && /^(Control automático|Instrucción corregida por auditoría)/.test(r.nota || '')) return true;
    return false;
  }).sort((a, b) => (a.recursos_visuales.estado === 'sin_foto' ? 0 : 1) - (b.recursos_visuales.estado === 'sin_foto' ? 0 : 1)
    // versión femenina: primero los que tienen foto masculina aprobada (se generan como espejo de esa foto)
    || (g === 'f' ? (/^(aprobada|provisional)$/.test(a.recursos_visuales.estado_m) ? 0 : 1) - (/^(aprobada|provisional)$/.test(b.recursos_visuales.estado_m) ? 0 : 1) : 0)
    || prio(a) - prio(b) || a.nombre.localeCompare(b.nombre));
  if (!cand.length) return { listo: true, mensaje: 'No quedan ejercicios pendientes de generar.' };
  const e = cand[0], key = e.visual_key, r = e.recursos_visuales;
  if (/-machine-\d+$/.test(key) && !r.ref_ruta) {
    await patchRecurso(key, { [C.origen]: 'omitido', [C.nota]: 'Necesita foto de referencia de la máquina real del club.' });
    return { visual_key: key, genero: g, omitido: true };
  }
  const intento = (r.lote_intentos || 0) + 1;
  await patchRecurso(key, { [C.origen]: 'procesando', [C.lote]: intento });
  try {
    let desc = r.descripcion;
    if (!desc) { desc = await redactar(e.nombre, e.implemento, koachRules(key)); await patchRecurso(key, { descripcion: desc }); }
    // en el reintento, los problemas detectados pasan como corrección explícita
    const correccion = (r.estado === 'corregir' && r.nota) ? 'Avoid these defects from the previous attempt: ' + r.nota.replace(/^Control automático:\s*/, '') : undefined;
    const out = await TOOLS.generar_imagen.run({ visual_key: key, descripcion: desc, correccion, sin_miniatura: true, genero: g });
    return { visual_key: key, genero: g, grupo: e.grupo_muscular, intento, estado: out.estado, control: out.control };
  } catch (err) {
    await patchRecurso(key, { [C.origen]: 'error-lote', [C.nota]: `Error en lote: ${String(err.message || err).slice(0, 300)}` });
    throw err;
  }
}

// ---------- protocolo MCP (JSON-RPC sobre HTTP, sin estado) ----------
async function handle(msg) {
  const { id, method, params } = msg;
  if (id === undefined) return null; // notificación
  try {
    if (method === 'initialize') {
      return { jsonrpc: '2.0', id, result: {
        protocolVersion: params?.protocolVersion || '2025-06-18',
        capabilities: { tools: {} },
        serverInfo: { name: 'koach-visual', version: '1.0.0' },
        instructions: 'Biblioteca de fotos de ejercicios KOACH. Generar con generar_imagen, revisar con revisar.'
      } };
    }
    if (method === 'ping') return { jsonrpc: '2.0', id, result: {} };
    if (method === 'tools/list') {
      return { jsonrpc: '2.0', id, result: { tools: Object.entries(TOOLS).map(([name, t]) => ({ name, description: t.description, inputSchema: t.inputSchema })) } };
    }
    if (method === 'tools/call') {
      const t = TOOLS[params?.name];
      if (!t) return { jsonrpc: '2.0', id, error: { code: -32602, message: `Herramienta desconocida: ${params?.name}` } };
      try {
        if (!SK) throw new Error('Falta SUPABASE_SERVICE_ROLE_KEY en Vercel (proyecto koach-visual-bridge).');
        const out = await t.run(params.arguments || {});
        return { jsonrpc: '2.0', id, result: { content: [{ type: 'text', text: JSON.stringify(out) }], structuredContent: Array.isArray(out) ? { items: out } : out } };
      } catch (e) {
        return { jsonrpc: '2.0', id, result: { isError: true, content: [{ type: 'text', text: String(e.message || e) }] } };
      }
    }
    return { jsonrpc: '2.0', id, error: { code: -32601, message: `Método no soportado: ${method}` } };
  } catch (e) {
    return { jsonrpc: '2.0', id, error: { code: -32603, message: String(e.message || e) } };
  }
}

module.exports = async (req, res) => {
  const token = process.env.BRIDGE_TOKEN;
  if (!token || req.query.t !== token) { res.status(404).end(); return; }
  if (req.query.lote) {
    if (!SK) { res.status(500).json({ error: 'Falta SUPABASE_SERVICE_ROLE_KEY' }); return; }
    try { res.status(200).json(await loteSiguiente(req.query.g)); } catch (e) { res.status(200).json({ error: String(e.message || e) }); }
    return;
  }
  if (req.method === 'GET') { res.status(405).setHeader('Allow', 'POST').end(); return; }
  if (req.method === 'DELETE') { res.status(200).end(); return; }
  if (req.method !== 'POST') { res.status(405).end(); return; }
  let body = req.body;
  try { if (typeof body === 'string') body = JSON.parse(body); } catch { res.status(400).json({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'JSON inválido' } }); return; }
  if (!body) { res.status(400).json({ jsonrpc: '2.0', id: null, error: { code: -32600, message: 'Solicitud vacía' } }); return; }
  if (Array.isArray(body)) {
    const out = (await Promise.all(body.map(handle))).filter(Boolean);
    if (!out.length) { res.status(202).end(); return; }
    res.status(200).json(out); return;
  }
  const out = await handle(body);
  if (!out) { res.status(202).end(); return; }
  res.status(200).json(out);
};
