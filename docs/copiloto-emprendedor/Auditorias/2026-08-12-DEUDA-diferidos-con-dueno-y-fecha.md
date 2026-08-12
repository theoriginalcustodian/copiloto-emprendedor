# Deuda diferida de la ronda de auditorías — dueño y fecha

**Abierto:** 2026-08-12 12:29 · **planificación** · **vivo hasta que todas las filas estén cerradas.**

> **Por qué existe este archivo.** El DoD del ciclo (§G2/§G3) exige que **todo hallazgo termine en
> estado terminal**: resuelto y verificado, o **diferido con dueño y fecha**. Un P2 sin dueño y sin
> fecha no es una prioridad baja: es un hallazgo perdido. El canon lo dice más corto — *atajo = TODO +
> memoria + dueño + fecha, nada invisible ni impago*.
>
> Los contratos del buzón se archivan a los 90 minutos. Este archivo no.

---

## Contexto: qué NO está acá

Las pasadas 1 y 2 cerraron con **0 P0**. Lo que está en ejecución, y por lo tanto **no** es deuda:

| Frente | Dónde |
|---|---|
| C4.1 — `/auth/signup` abierto | contrato P0 a backend |
| Lote B — print PHI · D-A · C8 · canario C5 | contrato P1 a backend |
| Lote C — doble cobro · catch-all ReAct · tests adversariales · pool | contrato P1 a backend |
| C6 — cotas de chat y listas | frontend, cota **ya aplicada** en web y mobile |
| Pasada 3 — pulido y eficiencia | contrato a auditoría, en curso |

---

## Las 9 filas de deuda

Fecha por defecto: **primer sprint post-beta**. No es una fecha de calendario porque la beta todavía no
abrió; es un **disparador binario y verificable** — el sprint que arranca después del primer tester
externo. Cuando la beta abra, esa columna se convierte en fechas duras.

| # | Hallazgo | Origen | Dueño | Fecha | Por qué se difiere |
|---|---|---|---|---|---|
| D1 | **C7** — Composio síncrono sin cache, 5 call-sites. `TTLCache` 30-60s per-tenant | P2 H-5 | backend | 1er sprint post-beta | Costo y latencia por request; no rompe nada con pocos usuarios. **Ya está en la lista de continuación de backend** — puede adelantarse si sobra ciclo |
| D2 | **C3** — fallo del Doc de presupuesto se loguea pero no va a la DLQ (no reintentable) | P2 H-6 | backend | 1er sprint post-beta | Ya loguea el `motivo` con fingerprint: hay rastro, falta reintento. **También en la lista de continuación** |
| D3 | `heartbeat_timeout` ausente en las activities del loop ReAct (asimetría vs. AFIP, que sí lo tiene) | P2 H-7 | backend | 1er sprint post-beta | La `RetryPolicy` ya está acotada al 100%, así que no hay cuelgue infinito; el heartbeat mejora la detección, no la evita |
| D4 | `patched()` sin gate de replay en CI | P2 H-7 | backend | 1er sprint post-beta | Riesgo real sobre ejecuciones en vuelo, pero requiere diseñar el gate — no es un fix de línea |
| D5 | 8 endpoints AFIP/presupuestos con guard probado sólo a nivel helper/store, no por endpoint HTTP hostil | P1 H-2 | backend | tras el lote C | Es la **misma clase** que C3 del lote C. Al escribir esos tests, extender el patrón a estos 8 |
| D6 | 4 uploads sin validación de magic bytes | P1 H-5 | backend | 1er sprint post-beta | **Ya tienen cota de tamaño** (sin DoS) y nunca se persisten a disco — van en memoria a Groq/OpenAI. Sin RCE; peor caso 422/502 externo |
| D7 | `except: return False` en `mercadopago_gateway.py:119` — fail-silent | P1 H-4 | backend | junto con D-A del lote B | Auditoría lo clasificó bien: **blind-spot de observabilidad, no vulnerabilidad**. El webhook **no es forjable** (SDK oficial, fail-closed). Es de la misma familia que los `except` del lote B |
| D8 | ~~`apps/copiloto-web/.../useChat.ts` (348 líneas) reimplementa `packages/core/src/chat/chatMachine.ts` en vez de consumirlo como hace mobile~~ — **CERRADO 2026-08-12** (test de equivalencia, no convergencia) | C6(b) | frontend | resuelto | Ver abajo |
| D9 | Flake del job `mobile` dentro de `gate.sh` completo — **REABIERTA 2026-08-12 ~16:50: reapareció CON el fix aplicado** | campo (frontend, 2026-08-12) | frontend | próximo ítem de frontend | `jest.setTimeout(15000)` bajó la frecuencia pero **no eliminó la causa**. Ver abajo: 3ª aparición, discriminada |
| D10 | El janitor **nunca archiva** las alertas que el escalador autogenera (`urgente_vigilancia-a-*`), porque `urgente_` es ancla por diseño ⇒ toda alerta resuelta queda en `abierto/` para siempre | campo (planificación, 2026-08-12) | planificación | `abierto/` > 40 archivos, **o** > 5 autogenerados | Hoy son 2 sobre 26: **no es problema de volumen todavía**. Ver abajo |

**Cierre de D8 (frontend, 2026-08-12):** siguiendo la recomendación de planificación en el `dato_` de
C6(b), la duplicación **no se convergió** — se protegió con un **test de equivalencia**
(`apps/copiloto-web/src/modules/chat/useChat.equivalencia.test.ts`): la MISMA secuencia de eventos
(crecimiento de mensajes de usuario más allá de `MAX_MENSAJES_HISTORIAL`, y un poll de rehidratación
con un id repetido + uno nuevo) corre contra el reducer real de `@copiloto/core`
(`reducirChat`/`hidratarEstado`) y contra el hook real `useChat` (web), y se afirma el mismo
`messages` final en las dos copias. Control negativo: revertir la poda de `acotarMensajes` en
`useChat.ts` hace caer 2/2 tests. Esto compra la misma protección que la convergencia le compraría al
invariante (drift silencioso entre las dos copias), sin el riesgo de reescribir 348 líneas del hook de
chat de producción sin revisor en vivo. La duplicación en sí queda — es deuda de prolijidad, no de
correctitud, y no vuelve a esta tabla salvo que alguien decida converger por otra razón.

**D9 no es de la misma clase que D1–D8.** Las otras ocho son deuda de **producto**: postergarlas
cuesta latencia, observabilidad o duplicación. D9 es deuda de **instrumento**, y su costo es que
**enseña a re-correr hasta verde**. Hoy el DoD hace de *gate 6/6* el criterio de cierre de cada ítem
de la ronda; una vez que "es el flake conocido" queda instalado como explicación disponible, la
próxima regresión real pasa con la misma frase. Es la familia de problemas que ya nos costó un frente
entero (*instrumentos que confirman en vez de verificar*).

Mitigación en vigor mientras la fila siga abierta — **un `mobile` rojo no se atribuye al flake por
parecido, se discrimina**: re-correr `bash scripts/ci/mobile.sh` aislado; si pasa, es el flake y se
anota en el `avance_` (la anotación es lo que permite **contar** las apariciones); si falla aislado
también, es una regresión propia.

Hipótesis y experimento, para que quien la tome no arranque de cero: el job `mobile` corre
inmediatamente después de `web`, que hace build de Vite + precache PWA, así que la contención de
CPU/IO no drenó cuando arranca jest. El experimento más barato **prueba la causa y aplica el fix en el
mismo movimiento**: subir `testTimeout` en ese describe y correr `gate.sh` completo — si 2/2 pasa a
0/2, quedó demostrado. Y el fondo, independientemente de la contención: un test de gesto
*hold-and-wait* con timeout de 5000ms es frágil por diseño en una máquina con 10 worktrees y pushes
que corren sincronización de grafo de 2+ minutos. Subir ese umbral **no es tapar el flake: es
reconocer que 5000ms era el número equivocado**.

**Cierre (frontend, mismo día, mismo ciclo que C6):** la hipótesis de contención web→mobile se
descartó con el experimento más directo — reproducir `web.sh` seguido de `mobile.sh` a mano, y
también `core→web→mobile→lint` replicando el loop local de `gate.sh` entero: **limpio las dos
veces**. Lo que sí reprodujo, 5/5, fue invocar `bash scripts/gate.sh` literal (con o sin
`run_in_background`, con `SOLO=mobile` incluso) — siempre el mismo describe gemelo de gesto de voz
(`PantallaSoporte.test.tsx` / `ChatView.test.tsx`), siempre un `it` distinto, siempre al borde de
los 5000ms. Nunca se aisló una causa mecánica del PORQUÉ sólo dentro de ese wrapper — quedó como
timing marginal bajo carga real, no una carrera de lógica (el único diff de C6 en esos dos archivos
es un cambio de *tipo*, `ScrollView`→`FlatList`, cero efecto en runtime). Aplicado el experimento
propuesto arriba: `jest.setTimeout(15000)` en ambos describes gemelos. Gate completo re-corrido
después del fix: **5/5 verde** (`.ci-recibos/bd25b9b7...json`, PR de C6). No vuelve a aparecer desde
entonces en este ciclo.

### ⚠️ REAPERTURA — 2026-08-12 ~16:50 (planificación, corriendo el gate de C4.1)

**Volvió a aparecer, con el fix ya presente en el HEAD gateado.** Verificado por ancestría, no por
supuesto: `git merge-base --is-ancestor 8d7e8cff HEAD` → sí, `jest.setTimeout(15000)` estaba puesto.

Lo que se midió, en el orden en que ocurrió:

| # | Corrida | Resultado |
|---|---|---|
| 1 | `gate.sh` completo, SHA `1b299a7c` | `mobile` **failed** (recibo con `"mobile":"failed"`) |
| 2 | `scripts/ci/mobile.sh` **aislado** | **80 suites / 730 tests, 0 fallos** |
| 3 | `gate.sh` completo, SHA `9160900f` | `mobile` **ok (32s)** |
| 4 | `gate.sh` completo, SHA `71b5ff9e` (frontend, log íntegro a archivo, no `tail`) | 5/5 **ok** (recibo `.ci-recibos/71b5ff9e...json`, `mobile` sin marca de duración porque no fue el último job — corrida limpia) |

Aplicada la mitigación de esta misma fila: aislado pasa ⇒ **es el flake, no una regresión** — y el
cambio de C4.1 no toca **ningún** archivo de `apps/mobile/`. Lo anoto porque anotarlo es lo que
permite contar: **van 3 apariciones**, y la tercera es la primera *después* del fix.

**Qué cambia el diagnóstico:** el `testTimeout` de 5000ms era un número equivocado y subirlo mejoró
algo real, pero **la conclusión "causa confirmada, resuelto" no se sostiene** — un fix que baja la
frecuencia sin eliminar la causa deja la fila abierta, porque el costo de D9 nunca fue la falla en sí
sino que *enseña a re-correr hasta verde*, y eso lo hace igual apareciendo 1 de cada 3 veces.

**Error de instrumento propio, que se paga acá:** la corrida #1 se lanzó en background con la salida
pipeada a `tail -40`, así que **el texto del fallo se perdió** y no puedo decir qué `it` falló. Un
gate largo se captura entero a archivo, nunca truncado — si el instrumento no guarda la evidencia, la
corrida siguiente en verde borra la anterior en rojo y la deuda desaparece sola. Es la misma familia
de *instrumentos que confirman en vez de verificar*.

**Para quien la tome (frontend):** el próximo `mobile` rojo hay que capturarlo con el log COMPLETO
antes de re-correr nada. Sin el nombre del `it` y su stack, la hipótesis de "timing marginal bajo
carga" sigue siendo la única disponible y no es falsable.

**Corrida #4 (frontend, mismo ciclo):** gate completo con salida íntegra a archivo (no `tail`, para
no repetir el error de instrumento de la corrida #1) — **5/5 limpio, sin fallo que cazar**. No aporta
el `it`+stack todavía, sólo suma al conteo: de las 3 corridas de `gate.sh` completo post-fix (#3, #4
y la de C4.1 que reabrió esta fila), **1 de 3 mostró el flake** — consistente con el "1 de cada 3"
ya estimado.

### Reorientación — planificación, 39/39 verde en GitHub Actions

Barrido de los últimos 40 runs de `tests.yml` en Actions (≈17h, cubre las 3 apariciones): **`mobile`
está 39/39 verde en el runner** (el único rojo de la serie fue `web` en un run ajeno a mobile). Las
**3 apariciones del flake fueron todas en el gate LOCAL** (PC Windows), cero en Linux/Actions. Esto
descarta que el propio test esté mal escrito de forma plataforma-agnóstica y deja dos hipótesis
distintas, no una:

- **H1 — contención de recursos en la PC** (múltiples worktrees/gates/Metro concurrentes): un
  `setTimeout(15000)` que sobra en un runner ocioso puede no alcanzar bajo carga real.
- **H2 — diferencia de plataforma** (Windows vs Linux: fake timers, `fs`, paths, resolución del
  reloj). Se distingue corriendo `mobile` aislado en Windows **sin carga** — si falla igual, es H2.

El plan (log completo, extraer `it`+stack antes de re-correr) sigue siendo el paso 1. Lo que se
agrega: **anotar si la PC estaba cargada** en la corrida que capture el fallo (worktrees/gates/Metro
activos en simultáneo) — es el dato que separa H1 de H2 y se pierde si no se anota en el momento. Si
el `it` que falla es de timing (`waitFor`, timers, animación) sube H1; si es de filesystem/paths,
sube H2.

**Corrida #5 (frontend):** relanzada deliberadamente bajo carga real medida — **26 procesos `node.exe`,
2 `git`, 17 worktrees activos** al momento de arrancar (`Get-Process` + `git worktree list`, 15:15:38).
Log íntegro a archivo (`gate-d9-corrida5-3df508ce.log`). **5/5 limpio de nuevo, `mobile` ok (35s)** —
ni siquiera bajo esta carga reprodujo. No descarta H1 (la contención que importa puede ser un pico de
CPU/IO en el instante exacto del test, no el conteo de procesos en reposo), pero tampoco lo confirma.

**Freno deliberado, no abandono:** van 2 corridas de `gate.sh` completo forzadas por frontend (#4, #5),
ambas limpias — sumado a #3 y al PR #403 de planificación, son **4 limpias consecutivas post-fix**
contra **1 rojo** (la reapertura original). Forzar más corridas completas (3-5 min c/u) para cazar un
flake P2/instrumento tiene retorno decreciente frente al resto de la cola. Se deja de forzar acá: la
próxima captura será **oportunista** — cuando `mobile` salga rojo en un gate real de trabajo (no uno
lanzado sólo para cazarlo), ese es el momento de aplicar la instrucción de arriba (log completo +
carga de PC anotada) antes de re-correr nada.

**Sumado al conteo (planificación, PR #403, SHA `49c2f16e`):** `mobile` verde, 1m20s — otra corrida
limpia en Actions, no cambia el 39/39.

La fila sigue abierta con la misma instrucción: la próxima vez que salga rojo, capturar el log
completo antes de re-correr, y anotar la carga de la PC en ese momento.

---

## D10 — las alertas autogeneradas no tienen quién las limpie

`archivar-buzon.sh` nunca toca `contrato_`/`pedido_`/`urgente_`: son **el ancla**, y esa decisión es
correcta — un janitor que archiva obligaciones las hace desaparecer sin resolver. Pero
`escaladores-buzon.sh` **genera sus propias alertas con prefijo `urgente_`**, así que hereda la
inmunidad: cuando el contrato que la motivó se toma, la alerta queda huérfana en `abierto/`
**permanentemente**.

**Hoy son 2 sobre 26 archivos: no es un problema de volumen y por eso NO se arregla ahora.** Se anota
porque el crecimiento es monótono —una alerta más por cada contrato que tarde >120 min, sin nada que
las reste— y porque el precedente del 2026-07-22 está medido: `abierto/` pasó de 32 a 136 y la regla
de "archivar a mano con disciplina" **empeoró** el problema
([[buzon-se-ordena-por-janitor-no-por-disciplina]]).

**Fix cuando toque, en una línea de criterio:** una alerta `urgente_vigilancia-a-*` se archiva sola
cuando **el contrato que la motivó ya no está en `abierto/`** (fue tomado). Es determinista y
derivable del nombre del archivo, que ya embebe el del contrato — no hace falta estado nuevo.

**Mitigación aplicada hoy, a mano:** archivada la alerta del lote B, cuyo contrato backend ya movió a
`en-curso/`. La del lote C **se deja**: ese contrato sigue en `abierto/` por diseño (no arranca hasta
que B cierre), así que el escalador la regeneraría igual — archivarla sería cosmética.

---

## Lo que se descartó — no vuelve a auditarse

Confirmado **seguro** por la Pasada 1. Está acá para que nadie vuelva a gastar tokens en esto:

- **Path traversal del catch-all SPA** (`web.py:487`) — doble cerrojo `resolve().is_relative_to`.
- **Webhook de MercadoPago** — **no forjable**: SDK oficial, fail-closed.
- **DoS por upload** — los 4 endpoints ya tienen cota de tamaño.
- **BOLA** — 0 fail-open en los 33 endpoints con ID en ruta. El aislamiento multitenant es real y
  estructural, no incidental.

---

## Anexo — huecos del instrumento de verificación e2e (§G6)

Detectado por planificación el 2026-08-12 al cotejar el DoD §4 contra los scripts reales. **No son
hallazgos de auditoría: son huecos de lo que nos permite *comprobar* que la app anda.** Importan porque
§G6 no se cierra con un smoke que no ejercita lo que el DoD declara.

**Lo que el instrumento SÍ cubre hoy** — `deploy/copiloto/smoke_beta_e2e.py`, 58 checks black-box
contra la API viva: alta · login email/password · `/me` · `/catalog` · chat simple · **chat ReAct
multi-paso** · connect URLs · refresh · consola con **adversarial hostil de claim admin** (no-admin →
403, luego se otorga el claim y el mismo path da 200) · ciclo de reintento que muta irreversible ·
artefacto de la web · punta a punta contra el vhost público. Más, por separado:
`e2e_facturacion_http.py` (emitir → PDF → consultar → anular con nota de crédito),
`smoke_afip_http.py`, `e2e_autosanacion_trauma_real.py`.

Es una base **fuerte**, no un smoke de "levanta el server". Los huecos son puntuales:

| # | Hueco vs. DoD §4 | Dueño | Fecha | Nota |
|---|---|---|---|---|
| E1 | **Login por Google no se ejercita.** El DoD §4 lo pide explícitamente como control positivo, y C4.1 mete una allow-list app-side justo en `ensure-tenant` — o sea, tocamos ese camino **sin instrumento que lo pruebe** | backend | con C4.1 | Automatizar un login Google real es caro. Alternativa aceptable: ejercitar `ensure-tenant` con un token OAuth de servicio, o dejarlo como verificación **manual documentada** en el `avance_`. Lo que no vale es no probarlo |
| E2 | **Aislamiento cross-tenant A↔B no se prueba contra prod.** El smoke tiene adversarial de *claim admin*, que es otra cosa: prueba escalada de privilegio, no que el tenant A no vea lo del B | backend | con el lote C | La Pasada 1 confirmó 0 BOLA fail-open **por lectura de código**; falta el hostil vivo. Encaja con C3 del lote C (los tests adversariales), extendido a prod |
| E3 | **Durabilidad no se prueba: ninguna conversación sobrevive a un restart del worker en el smoke.** Es *el moat* del producto | backend | 1er sprint post-beta | La Pasada 2 verificó el moat **por estructura** (0 no-determinismo, `RetryPolicy` acotada al 100%, `continue_as_new` con flush) — que es evidencia real y fuerte. Lo que falta es la prueba de comportamiento: matar el worker a mitad de turno y ver que la conversación sigue |

**Por qué E3 no es P1 pese a ser el moat:** no hay indicio de que esté roto — al contrario, la
evidencia estructural es buena. Es un hueco de *demostración*, no de *función*. Pero queda anotado
porque "nuestro diferencial anda" es exactamente la clase de afirmación que no se sostiene con
autoevaluación.

---

## Regla para cerrar una fila

Una fila sale de esta tabla con el mismo criterio que cualquier hallazgo: **§Fase D del DoD** —
desplegado, probado contra el sistema real, y con un test que **falla sin el fix**. No sale por estar
"considerada" ni por haber sido discutida.

**Si una fila llega a su fecha sin cerrarse**, no se re-difiere en silencio: se re-difiere **con motivo
escrito acá**. Una deuda que se corre de fecha sin dejar rastro es indistinguible de una abandonada.

Índice de la ronda: [README](README.md) ·
[DoD del ciclo](2026-08-12-DoD-cierre-auditorias-y-fixes.md) ·
[Pasada 1 — hallazgos](2026-08-12-pasada-1-seguridad-HALLAZGOS.md) ·
[Pasada 2 — hallazgos](2026-08-12-pasada-2-robustez-HALLAZGOS.md)
