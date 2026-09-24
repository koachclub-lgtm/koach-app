# KOACH DESIGN SYSTEM V2 — piloto: HOME SOCIO V2

Estado: piloto aislado en `app.html` (v8.3). Se activa con `?home=v2` (queda guardado en el dispositivo) y se desactiva con `?home=v1`.
El Home v1 sigue calculándose debajo: V2 consume las mismas fuentes (`S.sem`, `estadoSemana()`, `mensajeHome()`, `objetivosSesion()`, CTA de v1).
Regla de aprobación funcional: cualquier diferencia de datos entre V1 y V2 = FAIL (verificado en 5 estados: A–E).

## Principios
- Una pantalla = una idea principal. Home responde: qué hago hoy · cómo voy · qué fortalezco · qué sigue.
- Sistema dual de superficies: **operación diaria** clara (blanco roto, negro, grises) · **momentos inmersivos** oscuros (grafito, plata, tipografía grande).
- Plata = acento premium. Verde solo funcional. Sin rojo/amarillo/morado/azul saturado.
- El motor habla en datos, la interfaz habla en objetivos. No se inventan métricas.

## Tokens (`--k2-*`)
| Grupo | Tokens |
|---|---|
| Color | `carbon #121212` · `graphite #1E1F22` · `off #F4F3F0` · `paper #FBFAF8` · grises `g1 #E7E6E2` `g2 #C9C8C3` `g3 #8E8D88` `g4 #5E5D59` · `silver` (gradiente) · `ok #2F7D4F` (solo funcional) |
| Radios | `r-sm 12` · `r-md 18` · `r-lg 26` · `r-hero 30` |
| Espaciado | `s1 8` · `s2 12` · `s3 16` · `s4 24` · `s5 32` · `s6 48` |
| Borde | `line rgba(18,18,18,.08)` — plata solo cuando importa |
| Sombra | `shadow` muy suave (solo bottom nav) |
| Movimiento | `ease cubic-bezier(.2,.7,.2,1)` · respeta `prefers-reduced-motion` |

## Tipografía
| Rol | Uso | Estilo |
|---|---|---|
| LABEL | `k2Label()` | IBM Plex Mono 10px · uppercase · tracking .16em · gris |
| TÍTULO | h1/h2 | Inter Display 700 · tracking negativo |
| DISPLAY | % del anillo, nombre de sesión en hero | Inter Display 700, 40–56px |
| BODY | frases | Inter Display 400 16px, sin tracking |

## Componentes
| Nombre conceptual | Implementación | Propósito | Variantes |
|---|---|---|---|
| KoachWeeklyRing | `k2Ring(pct,size)` | objetivo semanal, anima al cargar | tamaño |
| KoachMetric | `k2Metric(valor,label)` | dato secundario (sesiones, objetivos) | — |
| KoachSessionHero | bloque `.k2-hero` | sesión protagonista (momento inmersivo) | próxima · en curso · completada hoy · semana completa · con foto (`K2.foto`) |
| KoachCycleTimeline | `.k2-tl` | sesiones de la semana en orden real | done · next · pend |
| KoachStatusPill | `k2Pill(estado)` | vocabulario único de estado | COMPLETADA · EN PROGRESO · PRÓXIMA · BLOQUEADA · PENDIENTE · OBJETIVO CUMPLIDO |
| KoachProgressBar | `k2Bar(pct)` | avance por grupo, anima al cargar | — |
| KoachMuscleTarget | `muscleIcon(grupo,size,state)` | anatomía del grupo (plata) | compact 34 · standard 58 · featured 96 · state `done` |
| KoachBottomNav | `.k2 .tabbar` | navegación, pill negra activa, safe-area | — |

## Reglas de contenido (Home V2)
- Sesión protagonista: en curso › completada hoy › próxima.
- Grupos visibles (máx 5): objetivos de la sesión protagonista → en progreso → resto; orden anatómico estable.
- Insight solo por regla real: "HOY DESCANSA" (entrenó hoy y hay próxima) · "VAS POR BUEN CAMINO" (≥ mitad de sesiones).

## Pendiente
- Dirección fotográfica: el hero acepta foto (`K2.foto`, se desatura automáticamente). Falta el set de fotos reales del gimnasio KOACH.

## KoachStimulusWheel — `stimulusWheel(datos, opts)`
Visualización estándar del estímulo muscular semanal. Reemplaza anillo + líneas.
- **Datos por grupo:** `grupo` · `objetivo` (meta) · `mav` (techo/límite) · `series` (ejecutado o programado según vista).
- **Lectura por forma:** pétalo lleno = meta cumplida · relleno radial = avance hacia la meta · corona exterior = trabajo sobre la meta (crece hacia el límite) · corona rayada + punto = sobre el límite · pétalo vacío = sin estímulo.
- **Orden fijo (9 segmentos):** pecho, hombros, bíceps, tríceps, core, cuádriceps, isquios, glúteos, espalda (tren superior arriba, inferior abajo).
- **Variantes:** `compact` (Home: etiquetas afuera, centro = % objetivo semanal) · `detailed` (Plan/Coach: valor y nombre dentro del pétalo, centro = metas).
- **Temas:** `light` (operación diaria) · `dark` (momento inmersivo, relleno plata).
- **Interacción:** `onTap` → hoja con meta, programado, hecho, límite, estado y próximo estímulo.
- **Estados (texto):** SIN ESTÍMULO · EN PROGRESO · OBJETIVO CUMPLIDO · CERCA DEL LÍMITE · SOBRE EL LÍMITE.
- **Dónde:** Home V2 (compacta) · Plan › detalle semanal (detallada, oscura) · Coach › planificador semana (detallada, programado). Avances: evolución histórica, pendiente.

## KoachSessionPill — `sessionPill({nombre, sub, estado, onClick, variant})`
Lenguaje visual EXCLUSIVO de sesiones: qué sesión es · dónde está en la secuencia · puedo entrar. No calcula nada: recibe estado y acción ya resueltos.
- **Forma:** círculo con foto (78px) + cuello orgánico vectorial (filete r10 tangente a círculo y barra) + barra 60px + botón circular →. Solo la foto es asset.
- **Estados:** `available` (→) · `active` (punto + EN CURSO) · `completed` (✓ en la foto, abre historial) · `locked` / `future` (candado, baja opacidad, no clickeable) · `pending` (SOLICITADA). Variante `history` (foto más apagada).
- **Fotos:** `SESSION_VISUAL` (upper/lower/total/metabolic × male/female) en `/img/session/`; tipo por nombre de sesión (`sessionTipo`), variante por sexo del protocolo; sin foto → monograma.
- **Dónde:** Home V2 (tu semana) · Plan (sesiones de la semana, próxima semana, lo último) · Avances (historial). No en coach, ejercicios, bloques, admin ni solicitudes.
