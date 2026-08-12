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
| D8 | `apps/copiloto-web/.../useChat.ts` (348 líneas) reimplementa `packages/core/src/chat/chatMachine.ts` en vez de consumirlo como hace mobile | C6(b) | frontend | **próximo ítem de frontend al cerrar C6(c)/(d)** | El defecto real de C6 (crecimiento sin techo) **ya está cerrado en las dos copias**. Lo que queda es duplicación, y converger 348 líneas del hook de chat de producción sin revisor en vivo tiene peor relación riesgo/beneficio que diferirlo |
| D9 | ~~Flake del job `mobile` dentro de `gate.sh` completo~~ — **CERRADO 2026-08-12, mismo ciclo que C6** | campo (frontend, 2026-08-12) | frontend | resuelto | Ver abajo: quedó en 5/5 falla completa antes del fix, causa confirmada, fix aplicado y verificado |

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
