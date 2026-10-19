/* ═══════════════════════════════════════════════════════════════
   KOACH BIOMARCADORES · motor de exámenes de laboratorio
   · Catálogo de marcadores con nombres como aparecen en laboratorios chilenos
   · Conversión a unidad canónica · plausibilidad (atrapa errores de lectura)
   · Estado: rango del propio laboratorio (manda) → corte clínico publicado → crítico
   · Índices: HOMA-IR, TG/HDL, colesterol no-HDL, eGFR CKD-EPI 2021, PhenoAge (Levine 2018)
   · Tendencia contra el punto de partida del socio con variación mínima relevante
   No diagnostica: ordena datos, compara contra rangos publicados y educa. Lo fuera de rango
   siempre se deriva a conversación con su médico. Sin dependencias. Vanilla JS.
   ═══════════════════════════════════════════════════════════════ */
(function(root){
'use strict'
const VERSION = 'koach-biomarcadores@1.0.0'
const r = (v, d) => v == null || !isFinite(v) ? null : Math.round(v * Math.pow(10, d == null ? 1 : d)) / Math.pow(10, d == null ? 1 : d)
const norm = s => String(s == null ? '' : s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/µ|μ/g, 'u').replace(/[^a-z0-9%/.,\-+ ]/g, ' ').replace(/\s+/g, ' ').trim()
const nu = s => norm(s).replace(/\s/g, '').replace(/,/g, '.').replace(/x10\^?/g, 'x10').replace(/10\^?3/g, '10e3').replace(/10\^?9/g, '10e9').replace(/10\^?6/g, '10e6')
const esH = s => /^h|^m(asc|ale)/i.test(String(s || '')) && !/^muj/i.test(String(s || ''))

// ── Catálogo ──────────────────────────────────────────────────────
// u: unidad canónica · ref: rango por defecto si el laboratorio no imprime uno (adulto; {h,m} si difiere)
// opt: rango óptimo con respaldo de guías (solo donde existe) · crit: valores que piden consulta médica pronta
// mejor: -1 bajar es mejor · +1 subir es mejor · 0 lo mejor es estar dentro del rango
// vmr: variación mínima relevante (pct o abs) · plaus: rango físicamente plausible (fuera = error de lectura)
// conv: [regex de unidad normalizada, factor o función hacia la unidad canónica]
const MK = [
  // METABOLISMO
  { c:'glucosa', n:'Glucosa en ayunas', cat:'METABOLISMO', u:'mg/dL', ref:[70,99], crit:[54,250], mejor:0, vmr:{ pct:8 }, plaus:[20,700],
    al:[/^glu(c|ce|co)?(sa|emia|cemia)?( en)?( (basal|ayunas?|plasmatica|sangre|venosa))*$/, /^glicemia( (basal|en ayunas|ayunas))?$/, /^glucemia( basal| en ayunas)?$/, /^glucosa (basal|en ayunas|ayunas|plasmatica)/],
    conv:[[/^mmol\/?l$/, 18.016]],
    cortes:[[100,'EN RANGO'],[126,'GLUCOSA ALTERADA EN AYUNAS'],[Infinity,'RANGO DE DIABETES · CONFIRMAR CON TU MÉDICO']] },
  { c:'glucosa_post', n:'Glucosa 2 h post carga', cat:'METABOLISMO', u:'mg/dL', ref:[70,139], crit:[54,300], mejor:-1, vmr:{ pct:12 }, plaus:[20,700],
    al:[/^(glucosa|glicemia|glucemia).*(post|120|2 ?h|carga|ptgo)/, /^ptgo.*(120|2 ?h)/], conv:[[/^mmol\/?l$/, 18.016]],
    cortes:[[140,'EN RANGO'],[200,'TOLERANCIA ALTERADA'],[Infinity,'RANGO DE DIABETES · CONFIRMAR CON TU MÉDICO']] },
  { c:'insulina', n:'Insulina en ayunas', cat:'METABOLISMO', u:'µUI/mL', ref:[2.6,24.9], mejor:-1, vmr:{ pct:25 }, plaus:[0.2,400],
    al:[/^insulin(a|emia)( (basal|en ayunas|ayunas))?$/, /^insulina (basal|ayunas|en ayunas)/], conv:[[/^pmol\/?l$/, 1/6]] },
  { c:'hba1c', n:'Hemoglobina glicosilada (HbA1c)', cat:'METABOLISMO', u:'%', ref:[4,5.6], crit:[null,10], mejor:-1, vmr:{ abs:0.3 }, plaus:[3,20],
    al:[/hemoglobina glic(osilada|ada)/, /hba1c|^a1c$|hb a1c|glicohemoglobina/], conv:[[/^mmol\/?mol$/, x => x / 10.929 + 2.15]],
    cortes:[[5.7,'EN RANGO'],[6.5,'RANGO DE PREDIABETES'],[Infinity,'RANGO DE DIABETES · CONFIRMAR CON TU MÉDICO']] },
  // LÍPIDOS
  { c:'col_total', n:'Colesterol total', cat:'LÍPIDOS', u:'mg/dL', ref:[null,199], mejor:-1, vmr:{ pct:10 }, plaus:[50,600],
    al:[/^colesterol( total)?$/, /^colesterol total/], conv:[[/^mmol\/?l$/, 38.67]] },
  { c:'hdl', n:'Colesterol HDL', cat:'LÍPIDOS', u:'mg/dL', ref:{ h:[40,null], m:[50,null] }, mejor:1, vmr:{ pct:10 }, plaus:[5,200],
    al:[/hdl/], conv:[[/^mmol\/?l$/, 38.67]] },
  { c:'ldl', n:'Colesterol LDL', cat:'LÍPIDOS', u:'mg/dL', ref:[null,129], opt:[null,99], crit:[null,300], mejor:-1, vmr:{ pct:12 }, plaus:[5,500],
    al:[/ldl/], conv:[[/^mmol\/?l$/, 38.67]] },
  { c:'tg', n:'Triglicéridos', cat:'LÍPIDOS', u:'mg/dL', ref:[null,149], crit:[null,1000], mejor:-1, vmr:{ pct:25 }, plaus:[10,5000],
    al:[/^triglic[ei]ridos?/, /^trigliceridemia/, /^tg$/], conv:[[/^mmol\/?l$/, 88.57]] },
  { c:'vldl', n:'Colesterol VLDL', cat:'LÍPIDOS', u:'mg/dL', ref:[null,30], mejor:-1, vmr:{ pct:25 }, plaus:[1,500], al:[/vldl/], conv:[[/^mmol\/?l$/, 38.67]] },
  // INFLAMACIÓN
  { c:'pcr', n:'Proteína C reactiva', cat:'INFLAMACIÓN', u:'mg/L', ref:[null,5], opt:[null,1], mejor:-1, vmr:{ pct:40, abs:0.5 }, plaus:[0,500],
    al:[/prote[ií]na c reactiva/, /^pcr( (us|hs|ultrasensible|alta sensibilidad))?$/, /^(hs|us)[ -]?pcr$|^hs ?crp$|^crp$/], conv:[[/^mg\/?dl$/, 10]] },
  // HÍGADO
  { c:'got', n:'GOT / AST', cat:'HÍGADO', u:'U/L', ref:[null,40], crit:[null,500], mejor:-1, vmr:{ pct:25 }, plaus:[1,5000],
    al:[/^(got|ast|tgo|sgot)\b/, /aspartato/, /transaminasa (glutamico )?oxal/], conv:[[/^ukat\/?l$/, 60]] },
  { c:'gpt', n:'GPT / ALT', cat:'HÍGADO', u:'U/L', ref:[null,41], crit:[null,500], mejor:-1, vmr:{ pct:25 }, plaus:[1,5000],
    al:[/^(gpt|alt|tgp|sgpt)\b/, /alanin/, /transaminasa (glutamico )?piruv/], conv:[[/^ukat\/?l$/, 60]] },
  { c:'ggt', n:'GGT', cat:'HÍGADO', u:'U/L', ref:{ h:[null,60], m:[null,40] }, mejor:-1, vmr:{ pct:20 }, plaus:[1,3000],
    al:[/^ggt$|gama ?glutamil|gamma ?glutamil|^gamma gt/], conv:[[/^ukat\/?l$/, 60]] },
  { c:'fa', n:'Fosfatasa alcalina', cat:'HÍGADO', u:'U/L', ref:[40,129], mejor:0, vmr:{ pct:15 }, plaus:[5,3000],
    al:[/fosfatasas? alcalinas?/, /^(fa|falc|alp)$/], conv:[[/^ukat\/?l$/, 60]] },
  { c:'albumina', n:'Albúmina', cat:'HÍGADO', u:'g/dL', ref:[3.5,5.2], mejor:0, vmr:{ pct:6 }, plaus:[1,7],
    al:[/^albumina( (serica|plasmatica))?$/, /^albumina/], conv:[[/^g\/?l$/, 0.1]] },
  { c:'bili_total', n:'Bilirrubina total', cat:'HÍGADO', u:'mg/dL', ref:[0.2,1.2], mejor:0, vmr:{ pct:25 }, plaus:[0,40],
    al:[/^bilirrubina total/], conv:[[/^umol\/?l$/, 1/17.1]] },
  // RIÑÓN
  { c:'creatinina', n:'Creatinina', cat:'RIÑÓN', u:'mg/dL', ref:{ h:[0.7,1.3], m:[0.5,1.1] }, crit:[null,4], mejor:0, vmr:{ pct:12 }, plaus:[0.1,20],
    al:[/^creatinin(a|emia)( (serica|plasmatica|en sangre))?$/], conv:[[/^umol\/?l$/, 1/88.4]] },
  { c:'bun', n:'Nitrógeno ureico (BUN)', cat:'RIÑÓN', u:'mg/dL', ref:[7,20], mejor:0, vmr:{ pct:20 }, plaus:[1,200],
    al:[/nitrogeno ureico|^bun$/], conv:[[/^mmol\/?l$/, 2.8]] },
  { c:'urea', n:'Urea', cat:'RIÑÓN', u:'mg/dL', ref:[15,45], mejor:0, vmr:{ pct:20 }, plaus:[2,400],
    al:[/^urea( (serica|plasmatica))?$|^uremia$/], conv:[[/^mmol\/?l$/, 6.006]] },
  { c:'ac_urico', n:'Ácido úrico', cat:'RIÑÓN', u:'mg/dL', ref:{ h:[3.4,7], m:[2.4,5.7] }, mejor:-1, vmr:{ pct:12 }, plaus:[0.5,20],
    al:[/acido urico|^uricemia$/], conv:[[/^umol\/?l$/, 1/59.48]] },
  // SANGRE
  { c:'hemoglobina', n:'Hemoglobina', cat:'SANGRE', u:'g/dL', ref:{ h:[13.5,17.5], m:[12,15.5] }, crit:[7,20], mejor:0, vmr:{ pct:6 }, plaus:[3,25],
    al:[/^hemoglobina$|^hb$|^hgb$/], conv:[[/^g\/?l$/, 0.1],[/^mmol\/?l$/, 1.611]] },
  { c:'hematocrito', n:'Hematocrito', cat:'SANGRE', u:'%', ref:{ h:[40,52], m:[36,46] }, mejor:0, vmr:{ pct:6 }, plaus:[10,75],
    al:[/^hematocrito$|^hto$|^hct$/], conv:[[/^l\/?l$/, 100]] },
  { c:'leucocitos', n:'Leucocitos', cat:'SANGRE', u:'mil/µL', ref:[4,10.5], crit:[2,30], mejor:0, vmr:{ pct:25 }, plaus:[0.5,100],
    al:[/^(recuento de )?leucocitos( totales)?$|^glob(ulos)? blancos$|^wbc$/], conv:[[/^(\/ul|\/mm3|cel\/ul|cel\/mm3)$/, x => x / 1000]] },
  { c:'linfocitos_pct', n:'Linfocitos (%)', cat:'SANGRE', u:'%', ref:[20,45], mejor:0, vmr:{ pct:20 }, plaus:[1,95], al:[/^linfocitos?( %| porcentaje| relativos)?$/] },
  { c:'linfocitos_abs', n:'Linfocitos (recuento)', cat:'SANGRE', u:'mil/µL', ref:[1,4.8], mejor:0, vmr:{ pct:20 }, plaus:[0.1,50], al:[/^linfocitos? (absolutos?|recuento|#)$/], conv:[[/^(\/ul|\/mm3|cel\/ul|cel\/mm3)$/, x => x / 1000]] },
  { c:'vcm', n:'Volumen corpuscular medio (VCM)', cat:'SANGRE', u:'fL', ref:[80,100], mejor:0, vmr:{ pct:3 }, plaus:[50,140],
    al:[/^vcm$|volumen corpuscular medio|^mcv$/], conv:[[/^(u3|um3)$/, 1]] },
  { c:'rdw', n:'Ancho de distribución eritrocitaria (RDW)', cat:'SANGRE', u:'%', ref:[11.5,14.5], mejor:-1, vmr:{ pct:7 }, plaus:[8,35],
    al:[/^rdw([ -]?(cv|sd))?$|ancho de distribucion|^ade$/] },
  { c:'plaquetas', n:'Plaquetas', cat:'SANGRE', u:'mil/µL', ref:[150,400], crit:[50,1000], mejor:0, vmr:{ pct:20 }, plaus:[5,2500],
    al:[/^(recuento de )?plaquetas$|^plt$/], conv:[[/^(\/ul|\/mm3|cel\/ul|cel\/mm3)$/, x => x / 1000]] },
  { c:'ferritina', n:'Ferritina', cat:'SANGRE', u:'ng/mL', ref:{ h:[30,400], m:[15,150] }, mejor:0, vmr:{ pct:25 }, plaus:[1,5000],
    al:[/^ferritina/], conv:[[/^ug\/?l$/, 1]] },
  { c:'hierro', n:'Hierro sérico', cat:'SANGRE', u:'µg/dL', ref:[60,170], mejor:0, vmr:{ pct:30 }, plaus:[5,500],
    al:[/^(hierro|fierro|ferremia)( serico)?$/], conv:[[/^umol\/?l$/, 5.585]] },
  // TIROIDES
  { c:'tsh', n:'TSH', cat:'TIROIDES', u:'µUI/mL', ref:[0.4,4.0], crit:[0.01,20], mejor:0, vmr:{ pct:30 }, plaus:[0.001,200],
    al:[/^tsh|tirotropina|hormona estimulante (de la )?tiroides/], conv:[[/^mui\/?l$/, 1]] },
  { c:'t4l', n:'T4 libre', cat:'TIROIDES', u:'ng/dL', ref:[0.9,1.7], mejor:0, vmr:{ pct:12 }, plaus:[0.1,10],
    al:[/^t4 ?libre|^t4l$|^ft4$|tiroxina libre/], conv:[[/^pmol\/?l$/, 1/12.87]] },
  // VITAMINAS Y MINERALES
  { c:'vit_d', n:'Vitamina D (25-OH)', cat:'VITAMINAS Y MINERALES', u:'ng/mL', ref:[30,100], mejor:1, vmr:{ pct:15 }, plaus:[2,250],
    al:[/vitamina d|25.?oh|25 hidroxi|calcidiol/], conv:[[/^nmol\/?l$/, 1/2.496]] },
  { c:'b12', n:'Vitamina B12', cat:'VITAMINAS Y MINERALES', u:'pg/mL', ref:[200,900], mejor:0, vmr:{ pct:20 }, plaus:[50,5000],
    al:[/vitamina b ?12|cobalamina|^b12$/], conv:[[/^pmol\/?l$/, 1.355]] },
  { c:'sodio', n:'Sodio', cat:'VITAMINAS Y MINERALES', u:'mEq/L', ref:[135,145], crit:[120,160], mejor:0, vmr:{ pct:2 }, plaus:[100,200],
    al:[/^sodio( (serico|plasmatico))?$|^na\+?$/], conv:[[/^mmol\/?l$/, 1]] },
  { c:'potasio', n:'Potasio', cat:'VITAMINAS Y MINERALES', u:'mEq/L', ref:[3.5,5.1], crit:[2.8,6.2], mejor:0, vmr:{ pct:8 }, plaus:[1,10],
    al:[/^potasio( (serico|plasmatico))?$|^k\+?$/], conv:[[/^mmol\/?l$/, 1]] },
  // HORMONAS
  { c:'testosterona', n:'Testosterona total', cat:'HORMONAS', u:'ng/dL', ref:{ h:[264,916], m:[15,70] }, mejor:0, vmr:{ pct:20 }, plaus:[1,3000],
    al:[/^testosterona( total)?$/], conv:[[/^nmol\/?l$/, 28.84],[/^ng\/?ml$/, 100]] }
]
// Índices calculados (no se leen del examen)
const DERIV = [
  { c:'homa_ir', n:'Resistencia a la insulina (HOMA-IR)', cat:'METABOLISMO', u:'', ref:[null,2.5], mejor:-1, vmr:{ pct:30 }, calc:true, nota:'Glucosa × insulina / 405. El corte 2,5 es referencial: no hay un valor universal.' },
  { c:'tg_hdl', n:'Relación triglicéridos / HDL', cat:'LÍPIDOS', u:'', ref:[null,3], opt:[null,2], mejor:-1, vmr:{ pct:25 }, calc:true, nota:'Indicador indirecto de sensibilidad a la insulina. Corte referencial.' },
  { c:'no_hdl', n:'Colesterol no-HDL', cat:'LÍPIDOS', u:'mg/dL', ref:[null,159], opt:[null,129], mejor:-1, vmr:{ pct:12 }, calc:true, nota:'Colesterol total − HDL: todo el colesterol que puede depositarse en arterias.' },
  { c:'egfr', n:'Filtración renal estimada (eGFR)', cat:'RIÑÓN', u:'mL/min/1,73m²', ref:[60,null], crit:[30,null], mejor:0, vmr:{ pct:10 }, calc:true, nota:'CKD-EPI 2021 desde creatinina, edad y sexo. Sobre 60 se considera normal salvo que tu médico indique otra cosa (KDIGO). Con mucha masa muscular o creatina suplementada puede subestimar la función renal.' },
  { c:'phenoage', n:'Edad biológica (PhenoAge)', cat:'EDAD BIOLÓGICA', u:'años', mejor:-1, vmr:{ abs:2 }, calc:true, nota:'Levine et al. 2018: 9 marcadores de sangre y la edad. Validada en población de EE.UU. (NHANES) contra mortalidad y enfermedad.' }
]
const ALL = MK.concat(DERIV), BY = {}; ALL.forEach(m => { BY[m.c] = m })
const CATS = ['EDAD BIOLÓGICA','METABOLISMO','LÍPIDOS','INFLAMACIÓN','HÍGADO','RIÑÓN','SANGRE','TIROIDES','VITAMINAS Y MINERALES','HORMONAS']

// ── Educación (lo que ve el socio). Conservador: describe, explica la relación con el entrenamiento y deriva al médico.
const EDU = {
  glucosa:{ que:'El azúcar en tu sangre después de 8 a 12 horas sin comer.', importa:'Mantenerla en rango protege vasos sanguíneos, nervios y riñones a largo plazo.',
    entreno:'Tus músculos son el principal lugar donde se guarda la glucosa. Cada sesión de fuerza abre una "puerta" extra para que el músculo la capte, y ese efecto dura hasta 24–48 horas. Más músculo significa más espacio para guardarla.',
    habitos:['Entrenar fuerza 3 o más veces por semana, sin cortar la constancia','Bajar grasa abdominal si está elevada','Priorizar proteína y fibra en cada comida; carbohidratos alrededor del entrenamiento','Dormir 7 horas o más'] },
  glucosa_post:{ que:'Tu glucosa 2 horas después de tomar una carga de azúcar en el laboratorio.', importa:'Muestra qué tan bien tu cuerpo maneja una comida con carbohidratos.', entreno:'El músculo entrenado retira más rápido la glucosa de la sangre después de comer.', habitos:['Entrenar fuerza con regularidad','Caminar 10–15 minutos después de las comidas principales','Combinar carbohidratos con proteína y fibra'] },
  insulina:{ que:'La hormona que permite que la glucosa entre a tus células.', importa:'Si tu cuerpo necesita mucha insulina para mantener la glucosa normal, es una señal temprana de resistencia a la insulina, años antes de que suba la glucosa.',
    entreno:'El entrenamiento de fuerza y la ganancia de masa muscular mejoran la sensibilidad a la insulina: el cuerpo necesita menos insulina para hacer el mismo trabajo.',
    habitos:['Constancia en el entrenamiento de fuerza','Reducir grasa corporal si está elevada','Evitar bebidas azucaradas y ultraprocesados','Dormir bien: una mala noche baja la sensibilidad a la insulina al día siguiente'] },
  hba1c:{ que:'El promedio de tu glucosa de los últimos 2 a 3 meses.', importa:'Es el marcador más estable para seguir el control de la glucosa en el tiempo.', entreno:'Por ser un promedio de meses, refleja la constancia: semanas completas de entrenamiento se notan aquí.', habitos:['Mantener la frecuencia de entrenamiento semana a semana','Seguir tu pauta con regularidad más que con perfección'] },
  col_total:{ que:'Todo el colesterol que circula en tu sangre.', importa:'Por sí solo dice poco: importa cómo se reparte entre HDL y LDL.', entreno:'El ejercicio regular mejora el perfil de colesterol, sobre todo el HDL y los triglicéridos.', habitos:['Entrenar con constancia','Más fibra (legumbres, avena, verduras) y grasas de buena calidad (palta, oliva, frutos secos)'] },
  hdl:{ que:'El colesterol "que limpia": retira colesterol de las arterias.', importa:'Más alto se asocia a menor riesgo cardiovascular.', entreno:'Es de los marcadores que mejor responde al ejercicio regular.', habitos:['Ejercicio constante, fuerza y cardio','No fumar','Grasas de buena calidad en vez de grasas trans y frituras'] },
  ldl:{ que:'El colesterol que puede depositarse en las paredes de las arterias.', importa:'Es el principal objetivo para cuidar el corazón a largo plazo.', entreno:'El ejercicio ayuda, pero el LDL depende más de la alimentación y de la genética que del entrenamiento.', habitos:['Más fibra soluble (avena, legumbres)','Menos grasas saturadas y embutidos','Si está alto, conversarlo con tu médico: a veces requiere tratamiento'] },
  tg:{ que:'La grasa que circula en tu sangre, muy ligada a lo que comiste los días anteriores.', importa:'Altos se asocian a resistencia a la insulina y riesgo cardiovascular.', entreno:'Bajan rápido con ejercicio regular y pérdida de grasa: suelen ser de los primeros en mejorar.', habitos:['Reducir azúcar, alcohol y harinas refinadas','Entrenar con constancia','Llegar a tu examen en ayuno real de 12 horas'] },
  vldl:{ que:'Partículas que transportan triglicéridos.', importa:'Se mueve junto con los triglicéridos.', entreno:'Mejora cuando bajan los triglicéridos.', habitos:['Las mismas acciones que para triglicéridos'] },
  pcr:{ que:'Un marcador de inflamación en el cuerpo.', importa:'Valores bajos y sostenidos se asocian a menor riesgo cardiovascular.', entreno:'Una sesión intensa la sube por 1 a 2 días; el entrenamiento regular y la pérdida de grasa la bajan en el tiempo.',
    habitos:['No hacerte el examen el día después de una sesión muy dura ni estando resfriado','Bajar grasa corporal si está elevada','Dormir bien y manejar el estrés'] },
  got:{ que:'Una enzima del hígado y también del músculo.', importa:'Puede subir por el hígado o simplemente por el músculo.', entreno:'Ojo: después de entrenar fuerte sube de forma normal por el trabajo muscular. Si está alta, repite el examen con 48–72 horas sin entrenamiento intenso.', habitos:['Evitar entrenar fuerte 2–3 días antes del examen','Moderar el alcohol'] },
  gpt:{ que:'Una enzima más específica del hígado.', importa:'Elevada sugiere que el hígado está trabajando de más (por ejemplo, hígado graso).', entreno:'La pérdida de grasa corporal y el ejercicio regular reducen la grasa del hígado y suelen bajarla.', habitos:['Bajar grasa abdominal','Reducir alcohol, azúcar y bebidas','Si sigue alta, conversarlo con tu médico'] },
  ggt:{ que:'Una enzima del hígado sensible al alcohol y al hígado graso.', importa:'Alta se asocia a riesgo metabólico.', entreno:'Mejora con pérdida de grasa y menos alcohol.', habitos:['Reducir alcohol','Bajar grasa corporal'] },
  fa:{ que:'Una enzima del hígado y del hueso.', importa:'Fuera de rango requiere mirarla junto a otros marcadores.', entreno:'No cambia mucho con el entrenamiento.', habitos:['Si está fuera de rango, conversarlo con tu médico'] },
  albumina:{ que:'La proteína más abundante de la sangre.', importa:'Refleja el estado nutricional y la función del hígado.', entreno:'Se mantiene bien con una ingesta adecuada de proteína.', habitos:['Cumplir la proteína diaria de tu pauta'] },
  bili_total:{ que:'Un pigmento que el hígado procesa al reciclar glóbulos rojos.', importa:'Levemente alta suele ser benigna (síndrome de Gilbert), pero se evalúa con el médico.', entreno:'No depende del entrenamiento.', habitos:['Si está fuera de rango, conversarlo con tu médico'] },
  creatinina:{ que:'Un desecho que produce el músculo y que eliminan los riñones.', importa:'Se usa para estimar la función de los riñones.', entreno:'Importante para ti: más masa muscular y suplementar creatina suben la creatinina sin que haya daño renal. Avísale siempre a tu médico que entrenas fuerza.', habitos:['Hidratarte bien antes del examen','Informar si tomas creatina'] },
  bun:{ que:'Un desecho del metabolismo de las proteínas.', importa:'Junto a la creatinina, ayuda a evaluar los riñones y la hidratación.', entreno:'Una dieta alta en proteína lo sube levemente: es esperable.', habitos:['Buena hidratación'] },
  urea:{ que:'Un desecho del metabolismo de las proteínas.', importa:'Junto a la creatinina, ayuda a evaluar los riñones y la hidratación.', entreno:'Una dieta alta en proteína la sube levemente: es esperable.', habitos:['Buena hidratación'] },
  ac_urico:{ que:'Un desecho del metabolismo de las purinas.', importa:'Alto se asocia a gota y a riesgo metabólico.', entreno:'Mejora con pérdida de grasa y menos alcohol y bebidas azucaradas.', habitos:['Reducir alcohol (sobre todo cerveza) y bebidas con fructosa','Buena hidratación'] },
  hemoglobina:{ que:'La proteína que transporta el oxígeno en tus glóbulos rojos.', importa:'Baja (anemia) reduce tu energía y tu rendimiento.', entreno:'Con hemoglobina baja cuesta más recuperarse y rendir en series largas.', habitos:['Hierro de buena absorción (carnes, legumbres con vitamina C)','Si está baja, conversarlo con tu médico'] },
  hematocrito:{ que:'El porcentaje de tu sangre que corresponde a glóbulos rojos.', importa:'Se interpreta junto con la hemoglobina.', entreno:'La deshidratación lo sube artificialmente.', habitos:['Llegar hidratado al examen'] },
  leucocitos:{ que:'Tus glóbulos blancos, las defensas.', importa:'Fuera de rango puede indicar una infección o inflamación.', entreno:'Una sesión intensa los sube transitoriamente.', habitos:['Evitar entrenar fuerte justo antes del examen'] },
  linfocitos_pct:{ que:'Un tipo de glóbulo blanco.', importa:'Forma parte del cálculo de tu edad biológica.', entreno:'El entrenamiento regular y moderado favorece un sistema inmune equilibrado.', habitos:['Dormir bien y recuperarte entre sesiones'] },
  linfocitos_abs:{ que:'Un tipo de glóbulo blanco.', importa:'Forma parte de tus defensas.', entreno:'El entrenamiento regular favorece un sistema inmune equilibrado.', habitos:['Dormir bien'] },
  vcm:{ que:'El tamaño promedio de tus glóbulos rojos.', importa:'Ayuda a entender el tipo de anemia si la hubiera, y forma parte de tu edad biológica.', entreno:'No depende directamente del entrenamiento.', habitos:['Si está fuera de rango, revisar hierro, B12 y folato con tu médico'] },
  rdw:{ que:'Qué tan parecidos en tamaño son tus glóbulos rojos.', importa:'Más alto se asocia a peor salud general; es uno de los marcadores con más peso en tu edad biológica.', entreno:'Mejora con buena nutrición (hierro, B12, folato) y un estilo de vida activo.', habitos:['Cumplir tu pauta, con variedad de alimentos','Revisar hierro y B12 si está alto'] },
  plaquetas:{ que:'Las células que ayudan a coagular.', importa:'Fuera de rango se evalúa con el médico.', entreno:'No dependen del entrenamiento.', habitos:['Si están fuera de rango, conversarlo con tu médico'] },
  ferritina:{ que:'Tu reserva de hierro.', importa:'Baja reduce energía y rendimiento antes de que aparezca la anemia.', entreno:'Quienes entrenan mucho, sobre todo mujeres, tienen más riesgo de reservas bajas.', habitos:['Hierro en la alimentación','Si está baja, tu médico puede indicar suplemento'] },
  hierro:{ que:'El hierro circulando en tu sangre.', importa:'Varía mucho día a día: se interpreta junto con la ferritina.', entreno:'Ver ferritina.', habitos:['Hierro en la alimentación'] },
  tsh:{ que:'La hormona que regula tu tiroides.', importa:'Fuera de rango afecta energía, peso y recuperación.', entreno:'No se corrige con entrenamiento: si está fuera de rango, es tema médico.', habitos:['Conversarlo con tu médico si está fuera de rango'] },
  t4l:{ que:'La hormona tiroidea activa disponible.', importa:'Se interpreta junto con la TSH.', entreno:'No se corrige con entrenamiento.', habitos:['Conversarlo con tu médico si está fuera de rango'] },
  vit_d:{ que:'Una vitamina-hormona que se produce con el sol.', importa:'Participa en hueso, músculo e inmunidad. En Chile es muy común tenerla baja, sobre todo en invierno.', entreno:'Niveles adecuados se asocian a mejor función muscular.', habitos:['Exposición al sol de 15 minutos en brazos y cara','Pescados grasos y huevos','Tu médico puede indicar suplemento'] },
  b12:{ que:'Una vitamina clave para la sangre y el sistema nervioso.', importa:'Baja produce cansancio; es más frecuente en dietas sin carne.', entreno:'No depende del entrenamiento.', habitos:['Carnes, huevos, lácteos','Si comes poco de origen animal, conversar suplemento con tu nutricionista'] },
  sodio:{ que:'Un mineral que regula el agua del cuerpo.', importa:'Fuera de rango puede ser importante: se evalúa con el médico.', entreno:'Sudar mucho sin reponer puede alterarlo.', habitos:['Hidratarte bien en sesiones largas'] },
  potasio:{ que:'Un mineral clave para músculos y corazón.', importa:'Fuera de rango puede ser importante: se evalúa con el médico.', entreno:'Se mantiene con frutas y verduras.', habitos:['Frutas, verduras y legumbres a diario'] },
  testosterona:{ que:'La principal hormona sexual masculina, también presente en mujeres.', importa:'Influye en energía, masa muscular y ánimo.', entreno:'El entrenamiento de fuerza, dormir bien y bajar grasa corporal ayudan a mantenerla en rango.', habitos:['Dormir 7 horas o más','Bajar grasa corporal si está elevada','Si está baja, conversarlo con tu médico'] },
  homa_ir:{ que:'Una estimación de tu resistencia a la insulina, calculada con tu glucosa y tu insulina.', importa:'Detecta problemas metabólicos antes de que suba la glucosa.', entreno:'Es probablemente el marcador donde más se nota el impacto del entrenamiento de fuerza y la ganancia muscular.', habitos:['Constancia en el entrenamiento de fuerza','Bajar grasa corporal','Dormir bien'] },
  tg_hdl:{ que:'La relación entre tus triglicéridos y tu colesterol HDL.', importa:'Más alta sugiere resistencia a la insulina.', entreno:'Mejora con ejercicio regular y pérdida de grasa.', habitos:['Reducir azúcar y alcohol','Entrenar con constancia'] },
  no_hdl:{ que:'Todo el colesterol que puede depositarse en las arterias.', importa:'Es un buen resumen del riesgo cardiovascular por colesterol.', entreno:'Mejora con ejercicio y alimentación, y a veces requiere tratamiento médico.', habitos:['Más fibra soluble','Menos grasas saturadas'] },
  egfr:{ que:'Una estimación de qué tan bien filtran tus riñones.', importa:'Bajo 60 por más de 3 meses requiere evaluación médica.', entreno:'Si tienes mucha masa muscular o tomas creatina, este cálculo puede marcar más bajo de lo real.', habitos:['Hidratación','Informar a tu médico que entrenas fuerza'] },
  phenoage:{ que:'Una estimación de la edad de tu cuerpo a partir de 9 marcadores de tu sangre y tu edad.', importa:'Si es menor que tu edad real, tu cuerpo está funcionando como el de alguien más joven.', entreno:'Varios de sus componentes (glucosa, inflamación, RDW) mejoran con entrenamiento constante, buena nutrición y descanso.', habitos:['Constancia en el entrenamiento','Cumplir tu pauta','Dormir bien','Medirla con los mismos 9 marcadores cada 6–12 meses'] }
}

// ── Mapeo de un analito leído al catálogo ────────────────────────
function identificar(nombre, unidad){
  const n = norm(nombre).replace(/\b(en )?(suero|plasma|sangre)\b/g, '').replace(/\s+/g, ' ').trim()
  const u = nu(unidad)
  if (/linfocit/.test(n)){ if (u === '%' || /%|porc|relat/.test(n)) return 'linfocitos_pct'; if (/abs|recuento|#/.test(n) || /ul|mm3|10e/.test(u)) return 'linfocitos_abs'; return 'linfocitos_pct' }
  if (/rdw|ancho de distribucion/.test(n) && (/sd/.test(n) || u === 'fl')) return null   // RDW-SD (fL) no es el RDW % del modelo
  if (/hdl/.test(n) && !/no ?hdl|vldl|ldl ?\/|\/ ?hdl|indice|razon|relacion/.test(n)) return 'hdl'
  if (/vldl/.test(n)) return 'vldl'
  if (/ldl/.test(n) && !/indice|razon|relacion|\//.test(n)) return 'ldl'
  for (const m of MK){ if (m.c === 'hdl' || m.c === 'ldl' || m.c === 'vldl' || /^linfocitos/.test(m.c)) continue
    if (m.al.some(re => re.test(n))) return m.c }
  return null
}
function aNumero(v){
  if (v == null) return null
  if (typeof v === 'number') return isFinite(v) ? { v, op:null } : null
  const s = String(v).trim().replace(/\s/g, ''), op = /^[<≤]/.test(s) ? '<' : /^[>≥]/.test(s) ? '>' : null
  let t = s.replace(/^[<>≤≥=]+/, '')
  if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(t)) t = t.replace(/\./g, '').replace(',', '.')   // 1.234,5
  else t = t.replace(',', '.')
  const n = parseFloat(t); return isFinite(n) ? { v:n, op } : null
}
function convertir(m, valor, unidad){
  const u = nu(unidad), can = nu(m.u)
  if (!u || u === can || u.replace('ui', 'u') === can.replace('ui', 'u')) return { v:valor, ok:true }
  // equivalentes triviales de notación
  const triv = [[/^(mil\/ul|10e3\/ul|x10e3\/ul|10e3\/mm3|x10e3\/mm3|10e9\/l|x10e9\/l|k\/ul|miles\/mm3|mil\/mm3)$/, 'mil/ul'], [/^(meq\/l|mmol\/l)$/, 'meq/l'], [/^(uui\/ml|uu\/ml|miu\/l|mui\/l|uiu\/ml|mu\/l)$/, 'uui/ml'], [/^(ng\/ml|ug\/l)$/, 'ng/ml'], [/^(u\/l|ui\/l|iu\/l)$/, 'u/l'], [/^(ug\/dl|mcg\/dl)$/, 'ug/dl'], [/^(fl|um3|u3)$/, 'fl']]
  const can2 = triv.reduce((a, [re, x]) => re.test(a) ? x : a, can), u2 = triv.reduce((a, [re, x]) => re.test(a) ? x : a, u)
  if (u2 === can2) return { v:valor, ok:true }
  for (const [re, f] of (m.conv || [])) if (re.test(u) || re.test(u2)) return { v: typeof f === 'function' ? f(valor) : valor * f, ok:true }
  return { v:valor, ok:false }
}
const refDe = (m, sexo) => { const R = m.ref; if (!R) return [null, null]; return Array.isArray(R) ? R : (esH(sexo) ? R.h : R.m) }

/** Normaliza un analito extraído. a = { nombre, valor, unidad, ref_min, ref_max, ref_texto } */
function normalizar(a, sexo){
  const c = identificar(a.nombre, a.unidad), m = c && BY[c], av = []
  const num = aNumero(a.valor)
  if (!m) return { codigo:null, nombre_original:a.nombre, valor_texto:a.valor == null ? '' : String(a.valor), unidad_original:a.unidad || '', reconocido:false }
  if (!num) return { codigo:c, nombre_original:a.nombre, valor_texto:String(a.valor), unidad_original:a.unidad || '', reconocido:true, valido:false, avisos:['Valor no numérico'] }
  let cv = convertir(m, num.v, a.unidad)
  if (!cv.ok){
    // unidad desconocida: se acepta solo si el valor es plausible en la unidad canónica
    if (num.v >= m.plaus[0] && num.v <= m.plaus[1]) av.push('Unidad "' + (a.unidad || '—') + '" no reconocida: se asumió ' + m.u)
    else return { codigo:c, nombre_original:a.nombre, valor_texto:String(a.valor), unidad_original:a.unidad || '', reconocido:true, valido:false, avisos:['Unidad no reconocida y valor fuera de lo esperable: revisar'] }
  }
  // recuentos expresados como /µL completos (ej. 6200) sin unidad clara
  if (/^(leucocitos|plaquetas|linfocitos_abs)$/.test(c) && cv.v > m.plaus[1] && cv.v / 1000 <= m.plaus[1]) { cv = { v: cv.v / 1000, ok:true }; av.push('Recuento convertido a miles/µL') }
  const v = cv.v
  const plaus = v >= m.plaus[0] && v <= m.plaus[1]
  if (!plaus) av.push('Valor fuera de lo físicamente esperable: probable error de lectura')
  const lmin = aNumero(a.ref_min), lmax = aNumero(a.ref_max)
  let rmin = lmin ? convertir(m, lmin.v, a.unidad).v : null, rmax = lmax ? convertir(m, lmax.v, a.unidad).v : null
  if (rmin != null && rmax != null && rmin > rmax) { const t = rmin; rmin = rmax; rmax = t }
  return { codigo:c, nombre:m.n, nombre_original:a.nombre, valor_texto:String(a.valor), unidad_original:a.unidad || '', reconocido:true, valido:plaus,
    valor:r(v, 3), unidad:m.u, operador:num.op, rango_min: rmin != null ? r(rmin, 3) : null, rango_max: rmax != null ? r(rmax, 3) : null,
    rango_texto:a.ref_texto || null, rango_origen: (rmin != null || rmax != null) ? 'laboratorio' : 'koach', avisos:av }
}

// ── Estado de un valor ────────────────────────────────────────────
// nivel: 'ok' en rango · 'mejorable' en rango pero fuera del óptimo · 'fuera' fuera de rango · 'critico' pide consulta pronta
function estado(codigo, valor, o){
  o = o || {}; const m = BY[codigo]; if (!m || valor == null) return null
  let [mn, mx] = (o.rango_min != null || o.rango_max != null) ? [o.rango_min, o.rango_max] : refDe(m, o.sexo)
  const crit = m.crit || [null, null]
  if ((crit[0] != null && valor < crit[0]) || (crit[1] != null && valor > crit[1]))
    return { nivel:'critico', lado: crit[0] != null && valor < crit[0] ? 'bajo' : 'alto', etiqueta:'CONVERSAR CON TU MÉDICO PRONTO', min:mn, max:mx }
  let et = null
  if (m.cortes){ const k = m.cortes.find(x => valor < x[0]); et = k ? k[1] : null }
  if (mn != null && valor < mn) return { nivel:'fuera', lado:'bajo', etiqueta: et && !/EN RANGO/.test(et) ? et : 'BAJO EL RANGO', min:mn, max:mx }
  if (mx != null && valor > mx) return { nivel:'fuera', lado:'alto', etiqueta: et && !/EN RANGO/.test(et) ? et : 'SOBRE EL RANGO', min:mn, max:mx }
  if (m.cortes && et && !/EN RANGO/.test(et)) return { nivel:'fuera', lado:'alto', etiqueta:et, min:mn, max:mx }
  if (m.opt){ const [a, b] = m.opt; if ((a != null && valor < a) || (b != null && valor > b)) return { nivel:'mejorable', lado: a != null && valor < a ? 'bajo' : 'alto', etiqueta:'EN RANGO · CON MARGEN DE MEJORA', min:mn, max:mx } }
  return { nivel:'ok', lado:null, etiqueta:'EN RANGO', min:mn, max:mx }
}

// ── Índices calculados ────────────────────────────────────────────
function eGFR(creat, edad, sexo){
  if (!creat || !edad) return null
  const F = !esH(sexo), k = F ? 0.7 : 0.9, a = F ? -0.241 : -0.302, s = creat / k
  return 142 * Math.pow(Math.min(s, 1), a) * Math.pow(Math.max(s, 1), -1.2) * Math.pow(0.9938, edad) * (F ? 1.012 : 1)
}
// PhenoAge (Levine et al. 2018, Aging 10:573). Unidades del modelo: albúmina g/L, creatinina µmol/L, glucosa mmol/L,
// PCR ln(mg/dL), linfocitos %, VCM fL, RDW %, fosfatasa alcalina U/L, leucocitos 10³/µL, edad años.
function phenoAge(v, edad){
  const req = ['albumina','creatinina','glucosa','pcr','linfocitos_pct','vcm','rdw','fa','leucocitos']
  const faltan = req.filter(k => v[k] == null)
  if (faltan.length || !edad) return { valor:null, faltan }
  const crp = Math.max(v.pcr / 10, 0.01)   // mg/L → mg/dL; piso para PCR indetectable
  const xb = -19.907 - 0.0336 * (v.albumina * 10) + 0.0095 * (v.creatinina * 88.4) + 0.1953 * (v.glucosa / 18.016) + 0.0954 * Math.log(crp)
    - 0.0120 * v.linfocitos_pct + 0.0268 * v.vcm + 0.3306 * v.rdw + 0.00188 * v.fa + 0.0554 * v.leucocitos + 0.0804 * edad
  const g = 0.0076927, M = 1 - Math.exp(-Math.exp(xb) * (Math.exp(120 * g) - 1) / g)
  if (!(M > 0 && M < 1)) return { valor:null, faltan:[] }
  return { valor: 141.50225 + Math.log(-0.00553 * Math.log(1 - M)) / 0.090165, faltan:[] }
}
/** valores: { codigo: valor canónico } de UN examen → índices */
function derivar(valores, ctx){
  ctx = ctx || {}; const v = Object.assign({}, valores), out = {}
  if (v.linfocitos_pct == null && v.linfocitos_abs != null && v.leucocitos) v.linfocitos_pct = v.linfocitos_abs / v.leucocitos * 100
  if (v.glucosa != null && v.insulina != null) out.homa_ir = r(v.glucosa * v.insulina / 405, 2)
  if (v.tg != null && v.hdl) out.tg_hdl = r(v.tg / v.hdl, 2)
  if (v.col_total != null && v.hdl != null) out.no_hdl = r(v.col_total - v.hdl, 0)
  if (v.creatinina != null && ctx.edad) out.egfr = r(eGFR(v.creatinina, ctx.edad, ctx.sexo), 0)
  const pa = phenoAge(v, ctx.edad); out.phenoage = pa.valor != null ? r(pa.valor, 1) : null; out._phenoFaltan = pa.faltan
  return out
}

// ── Tendencia contra el punto de partida ─────────────────────────
function distancia(m, v, mn, mx){ if (mn != null && v < mn) return mn - v; if (mx != null && v > mx) return v - mx; return 0 }
function relevante(m, a, b){ const d = Math.abs(b - a), q = m.vmr || {}
  const pct = q.pct != null ? Math.abs(a) * q.pct / 100 : Infinity, ab = q.abs != null ? q.abs : Infinity
  return d >= Math.min(pct, ab) - 1e-9 }
/** Compara dos valores del mismo marcador: 'mejora' | 'empeora' | 'estable' */
function comparar(codigo, a, b, o){
  const m = BY[codigo]; if (!m || a == null || b == null) return null
  if (!relevante(m, a, b)) return 'estable'
  o = o || {}; const [mn, mx] = (o.rango_min != null || o.rango_max != null) ? [o.rango_min, o.rango_max] : refDe(m, o.sexo)
  const da = distancia(m, a, mn, mx), db = distancia(m, b, mn, mx)
  if (da !== db) return db < da ? 'mejora' : 'empeora'
  if (m.mejor) return (b - a) * m.mejor > 0 ? 'mejora' : 'empeora'
  return 'estable'
}

/** Arma la vista completa desde los exámenes del socio.
 *  examenes: [{ id, fecha, valores:[{ codigo, valor, rango_min, rango_max }] }] ordenados o no · ctx: { sexo, fechaNac } */
function resumen(examenes, ctx){
  ctx = ctx || {}
  const ex = (examenes || []).slice().sort((a, b) => String(a.fecha).localeCompare(String(b.fecha)))
  const edadEn = f => { if (!ctx.fechaNac || !f) return ctx.edad || null; const a = new Date(ctx.fechaNac + 'T12:00:00'), b = new Date(f + 'T12:00:00'); let e = b.getFullYear() - a.getFullYear(); if (b < new Date(b.getFullYear(), a.getMonth(), a.getDate())) e--; return e }
  const series = {}   // codigo → [{ fecha, valor, rango_min, rango_max, examen_id }]
  const push = (c, p) => { (series[c] = series[c] || []).push(p) }
  ex.forEach(e => {
    const vals = {}
    ;(e.valores || []).forEach(x => { if (x.codigo && BY[x.codigo] && x.valor != null) { vals[x.codigo] = +x.valor; push(x.codigo, { fecha:e.fecha, valor:+x.valor, rango_min:x.rango_min, rango_max:x.rango_max, examen_id:e.id }) } })
    const d = derivar(vals, { sexo:ctx.sexo, edad:edadEn(e.fecha) })
    Object.keys(d).forEach(k => { if (k[0] !== '_' && d[k] != null) push(k, { fecha:e.fecha, valor:d[k], examen_id:e.id }) })
    e._phenoFaltan = d._phenoFaltan; e._edad = edadEn(e.fecha)
  })
  const marcadores = Object.keys(series).map(c => {
    const s = series[c], m = BY[c], u = s[s.length - 1], p = s[0], ant = s.length > 1 ? s[s.length - 2] : null
    const o = { rango_min:u.rango_min, rango_max:u.rango_max, sexo:ctx.sexo }
    return { codigo:c, nombre:m.n, cat:m.cat, unidad:m.u, calc:!!m.calc, nota:m.nota || null, actual:u.valor, fecha:u.fecha, estado: c === 'phenoage' ? null : estado(c, u.valor, o),
      inicio: s.length > 1 ? { valor:p.valor, fecha:p.fecha, delta:r(u.valor - p.valor, 2), tendencia: comparar(c, p.valor, u.valor, o) } : null,
      anterior: ant ? { valor:ant.valor, fecha:ant.fecha, delta:r(u.valor - ant.valor, 2), tendencia: comparar(c, ant.valor, u.valor, o) } : null,
      serie:s, edu: EDU[c] || null }
  }).sort((a, b) => CATS.indexOf(a.cat) - CATS.indexOf(b.cat) || ALL.findIndex(x => x.c === a.codigo) - ALL.findIndex(x => x.c === b.codigo))
  const eval_ = marcadores.filter(x => x.estado)
  const ult = ex[ex.length - 1], pa = series.phenoage
  return {
    version: VERSION, examenes: ex.length, ultimo: ult ? ult.fecha : null, primero: ex[0] ? ex[0].fecha : null,
    enRango: eval_.filter(x => x.estado.nivel === 'ok' || x.estado.nivel === 'mejorable').length, evaluados: eval_.length,
    criticos: eval_.filter(x => x.estado.nivel === 'critico'),
    trabajar: eval_.filter(x => x.estado.nivel === 'fuera' || x.estado.nivel === 'critico' || x.estado.nivel === 'mejorable')
      .sort((a, b) => ({ critico:0, fuera:1, mejorable:2 }[a.estado.nivel] - { critico:0, fuera:1, mejorable:2 }[b.estado.nivel])),
    mejoras: marcadores.filter(x => x.inicio && x.inicio.tendencia === 'mejora'),
    empeoran: marcadores.filter(x => x.inicio && x.inicio.tendencia === 'empeora'),
    edadBiologica: pa ? { actual: pa[pa.length - 1].valor, edad: (ex.find(e => e.id === pa[pa.length - 1].examen_id) || {})._edad, inicio: pa.length > 1 ? pa[0].valor : null, edadInicio: pa.length > 1 ? (ex.find(e => e.id === pa[0].examen_id) || {})._edad : null }
      : { actual:null, faltan: ult ? (ult._phenoFaltan || []).map(k => BY[k] ? BY[k].n : k) : [] },
    marcadores, porCategoria: CATS.map(cat => ({ cat, items: marcadores.filter(x => x.cat === cat) })).filter(g => g.items.length)
  }
}

const KB = { VERSION, CATALOGO: MK, DERIVADOS: DERIV, CATEGORIAS: CATS, EDU, porCodigo: c => BY[c] || null,
  identificar, aNumero, normalizar, estado, derivar, eGFR, phenoAge, comparar, resumen }
if (typeof module !== 'undefined' && module.exports) module.exports = KB
else root.KB = KB
})(typeof self !== 'undefined' ? self : this)
