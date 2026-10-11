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

const MASTER = `The attached image shows the SAME athlete twice, only as an identity and style reference (face, hair, body, outfit, grey backdrop, lighting). Ignore the poses and the two-panel layout.
Create ONE single square photograph (1:1) with ONE person performing ONE exercise, described below.
Hyperrealistic commercial studio sports photography for a premium strength-training app. It will be shown as a tiny 56 px thumbnail, so frame it tightly: the athlete and the equipment he touches fill about 85% of the frame, with a strong, clear silhouette. Never cut off hands, bars, dumbbells, handles or feet. Crop away unnecessary machine structure.
Athlete: man in his early 30s, short dark hair, light stubble, athletic but attainable physique (not a bodybuilder), NO tattoos, fitted plain black short-sleeve t-shirt and plain black shorts above the knee, both with NO logos or text, black shoes with grey soles. Calm focused expression, not looking at the camera.
Seamless plain light grey backdrop (#C4C4C4), no horizon line. Soft key light from the front-side, subtle rim light separating the black clothes from the background, near-monochrome color.
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

let REF = null;
function refImage() {
  if (!REF) REF = fs.readFileSync(path.join(__dirname, '..', 'seed', 'ref_atleta_m.jpg')).toString('base64');
  return REF;
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

async function gemini(prompt) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error('Falta GEMINI_API_KEY en Vercel.');
  let lastErr;
  for (const model of MODELS) {
    for (const imageConfig of [{ aspectRatio: '1:1', imageSize: '1K' }, { aspectRatio: '1:1' }, null]) {
      const body = {
        contents: [{ role: 'user', parts: [{ text: prompt }, { inline_data: { mime_type: 'image/jpeg', data: refImage() } }] }],
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


// Control anatómico automático: un modelo de visión revisa la foto antes de guardarla.
async function qa(imgBuf, desc) {
  const key = process.env.GEMINI_API_KEY;
  const prompt = `You are a quality inspector for exercise photos in a fitness app. Inspect the image carefully and classify each problem by severity.
Expected exercise: ${desc}
CRITICAL problems (the photo must be redone): more or fewer than one person; an extra, duplicated or merged limb, hand or foot; a limb that should be clearly visible but is missing or detached; a deformed limb, hand or forearm; head or neck bent in a clearly unnatural way; a joint at an impossible angle; floating or physically impossible equipment; a different exercise than expected (wrong body position, e.g. lying instead of standing, wrong implement type such as dumbbells instead of barbell, one hand instead of two hands, or vice versa); visible text.
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
    description: 'Resumen de la biblioteca de fotos por grupo muscular: total de ejercicios y cuántos están aprobados, provisionales, pendientes, por corregir o sin foto.',
    inputSchema: { type: 'object', properties: {} },
    async run() {
      const ej = await rest('ejercicios?select=grupo_muscular,visual_key,recursos_visuales(estado)&activo=eq.true');
      const g = {};
      for (const e of ej) {
        const k = e.grupo_muscular || 'SIN GRUPO';
        g[k] = g[k] || { grupo: k, total: 0, aprobada: 0, provisional: 0, pendiente: 0, corregir: 0, sin_foto: 0 };
        g[k].total++; g[k][e.recursos_visuales?.estado || 'sin_foto']++;
      }
      return Object.values(g).sort((a, b) => a.grupo.localeCompare(b.grupo));
    }
  },
  listar_ejercicios: {
    description: 'Ejercicios de un grupo muscular con su visual_key, estado de foto, descripción visual y miniatura (data URI webp de 192 px) si existe.',
    inputSchema: { type: 'object', properties: { grupo: { type: 'string', description: 'Grupo muscular, ej. PECHO' }, con_miniaturas: { type: 'boolean', default: true } }, required: ['grupo'] },
    async run({ grupo, con_miniaturas = true }) {
      const ej = await rest(`ejercicios?select=id,nombre,grupo_muscular,implemento,visual_key,recursos_visuales(estado,version,ruta_m,descripcion,nota)&activo=eq.true&grupo_muscular=eq.${encodeURIComponent(grupo)}&order=nombre`);
      return Promise.all(ej.map(async e => ({
        id: e.id, nombre: e.nombre, implemento: e.implemento, visual_key: e.visual_key,
        estado: e.recursos_visuales?.estado || 'sin_foto', version: e.recursos_visuales?.version || 0,
        descripcion: e.recursos_visuales?.descripcion || null, nota: e.recursos_visuales?.nota || null,
        miniatura: con_miniaturas ? await thumbData(e.recursos_visuales?.ruta_m) : null
      })));
    }
  },
  guardar_descripcion: {
    description: 'Guarda la descripción visual (en inglés: posición, agarre, fase y ángulo de cámara) de un visual_key. Se usa como instrucción para Gemini.',
    inputSchema: { type: 'object', properties: { visual_key: { type: 'string' }, descripcion: { type: 'string' } }, required: ['visual_key', 'descripcion'] },
    async run({ visual_key, descripcion }) { await patchRecurso(visual_key, { descripcion }); return { ok: true, visual_key }; }
  },
  generar_imagen: {
    description: 'Genera con Gemini una foto nueva para un visual_key, pasa un control anatómico automático (reintenta 1 vez solo ante errores críticos), la guarda como nueva versión y devuelve su miniatura y el resultado del control. Tarda 20-90 segundos.',
    inputSchema: { type: 'object', properties: { visual_key: { type: 'string' }, descripcion: { type: 'string', description: 'Descripción del ejercicio; si se omite se usa la guardada' }, correccion: { type: 'string', description: 'Ajuste puntual pedido por el revisor' } }, required: ['visual_key'] },
    async run({ visual_key, descripcion, correccion }) {
      const [rec] = await rest(`recursos_visuales?visual_key=eq.${encodeURIComponent(visual_key)}&select=*`);
      if (!rec) throw new Error(`visual_key desconocido: ${visual_key}`);
      const desc = descripcion || rec.descripcion;
      if (!desc) throw new Error('Este ejercicio no tiene descripción visual todavía.');
      let extra = correccion ? `\nIMPORTANT CORRECTION: ${correccion}` : '';
      let model, data, check, intentos = 0;
      for (intentos = 1; intentos <= 2; intentos++) {
        ({ model, data } = await gemini(`${MASTER}\n${desc}${extra}`));
        const jpg = await sharp(data).resize(768, 768, { fit: 'cover' }).jpeg({ quality: 85 }).toBuffer();
        check = await qa(jpg, desc);
        if (check.ok !== false) break;
        extra = `${correccion ? `\nIMPORTANT CORRECTION: ${correccion}` : ''}\nA previous attempt had these defects, avoid them: ${check.issues.join('; ')}.`;
      }
      const v = (rec.version || 0) + 1;
      const square = sharp(data).resize(1024, 1024, { fit: 'cover', position: 'centre' });
      const full = await square.clone().webp({ quality: 82 }).toBuffer();
      const thumb = await sharp(data).resize(192, 192, { fit: 'cover', position: 'centre', kernel: 'lanczos3' }).sharpen({ sigma: 0.5 }).webp({ quality: 80 }).toBuffer();
      const ruta = `ex/${visual_key}_m_v${v}.webp`, rutaFull = `ex/full/${visual_key}_m_v${v}.webp`;
      await upload(ruta, thumb); await upload(rutaFull, full);
      const estado = check.ok === false ? 'corregir' : 'pendiente';
      const nota = check.ok === false ? `Control automático: ${check.issues.join('; ')}` : (check.minor && check.minor.length ? `Observaciones: ${check.minor.join('; ')}` : (correccion || null));
      await patchRecurso(visual_key, { version: v, ruta_m: ruta, ruta_full_m: rutaFull, estado, descripcion: desc, nota, origen: `gemini-api:${model}` });
      return { visual_key, version: v, estado, nota, control: { ok: check.ok, problemas: check.issues, observaciones: check.minor || [], intentos: Math.min(intentos, 2) }, modelo: model, kb: Math.round(thumb.length / 1024), miniatura: 'data:image/webp;base64,' + thumb.toString('base64') };
    }
  },
  reevaluar: {
    description: 'Vuelve a pasar el control anatómico sobre la foto ya guardada (sin regenerar ni costo de imagen) y actualiza su estado.',
    inputSchema: { type: 'object', properties: { visual_key: { type: 'string' } }, required: ['visual_key'] },
    async run({ visual_key }) {
      const [rec] = await rest(`recursos_visuales?visual_key=eq.${encodeURIComponent(visual_key)}&select=*`);
      if (!rec || !(rec.ruta_full_m || rec.ruta_m)) throw new Error('Este ejercicio no tiene foto guardada.');
      const r = await fetch(publicUrl(rec.ruta_full_m || rec.ruta_m));
      if (!r.ok) throw new Error(`No se pudo leer la foto (${r.status})`);
      const jpg = await sharp(Buffer.from(await r.arrayBuffer())).resize(768, 768, { fit: 'cover' }).jpeg({ quality: 85 }).toBuffer();
      const check = await qa(jpg, rec.descripcion || visual_key);
      if (check.ok === null) return { visual_key, estado: rec.estado, control: check };
      const estado = check.ok ? (rec.estado === 'corregir' ? 'pendiente' : rec.estado) : 'corregir';
      const nota = check.ok ? (check.minor.length ? `Observaciones: ${check.minor.join('; ')}` : null) : `Control automático: ${check.issues.join('; ')}`;
      await patchRecurso(visual_key, { estado, nota });
      return { visual_key, estado, nota, control: { ok: check.ok, problemas: check.issues, observaciones: check.minor, intentos: 0 } };
    }
  },
  revisar: {
    description: 'Marca una foto como aprobada, provisional o para corregir (con nota).',
    inputSchema: { type: 'object', properties: { visual_key: { type: 'string' }, estado: { type: 'string', enum: ['aprobada', 'provisional', 'corregir'] }, nota: { type: 'string' } }, required: ['visual_key', 'estado'] },
    async run({ visual_key, estado, nota }) {
      const body = { estado, nota: nota || null };
      if (estado === 'aprobada') body.aprobada_at = new Date().toISOString();
      const r = await patchRecurso(visual_key, body);
      return { ok: true, visual_key, estado: r?.[0]?.estado };
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
