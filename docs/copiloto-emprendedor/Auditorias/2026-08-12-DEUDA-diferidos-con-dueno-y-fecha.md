# Deuda diferida de la ronda de auditorías — dueño y fecha

**Abierto:** 2026-08-12 12:29 · **planificación** · **vivo hasta que todas las filas estén cerradas.**

> **Por qué existe este archivo.** El DoD del ciclo (§G2/§G3) exige que **todo hallazgo termine en
> estado terminal**: resuelto y verificado, o **diferido con dueño y fecha**. Un P2 sin dueño y sin
> fecha no es una prioridad baja: es un hallazgo perdido. El canon lo dice más corto — *atajo = TODO +
> memoria + dueño + fecha, nada invisible ni impago*.
>
> Los contratos del buzón se archivan a los 90 minutos. Este archivo no.

---

## Bloque máquina — DEUDA-VIVA

**Esto no es un resumen de la tabla de abajo: es la parte que un script puede leer.** Existe porque
el 2026-08-12 la tabla en prosa falló en su único trabajo: **D5 y D7 tenían el disparador cumplido y
nadie se enteró**, porque un disparador escrito en lenguaje natural no avisa cuando se cumple — hay
que ir a buscarlo, y nadie va. Backend cerró su ciclo declarando cola vacía de buena fe: `abierto/` y
`en-curso/` **estaban** vacíos; esta tabla no.

Mismo mecanismo que el bloque `COLA-VIVA` de `coordinacion/PLAN.md`, que ya resolvió este problema
para los hitos (`scripts/cola-check.sh`, causa raíz: 4 h de fábrica parada el 2026-07-23). Se reusa
el idioma, no se inventa uno nuevo.

**Formato:** `id | dueño | disparador | estado`

- `disparador` con la forma `@<otro-id>` se evalúa **solo**: se cumple cuando ese id está `cerrado`.
  Cualquier otro texto es informativo — el script no lo interpreta y **nunca** lo da por cumplido.
  Un `@` que apunte a un id inexistente **se reporta como roto**, no se ignora: se cumpliría nunca.
- `estado` ∈ `abierto` · `en-curso` · `bloqueado` · `cerrado`.
  - **Sólo `abierto` puede alarmar.** Una fila ya tomada (`en-curso`) tiene dueño mirándola;
    gritarle cada 3 min sería la alarma-que-suena-siempre que ya se corrigió en el watchdog
    (#394/#400). Lo que se caza es el hueco exacto: **disparador cumplido y nadie la tomó**.
  - Sólo `cerrado` satisface el disparador de otra fila.
- Los `lote-*` y `emision-*` están acá **porque son disparadores de otras filas**, no porque sean
  deuda: son condiciones observables a las que otra fila se cuelga.

Control: `scripts/deuda-check.sh` (lo compone `scripts/vigilancia-check.sh`, que corre cada 3 min).

<!-- DEUDA-VIVA:INICIO -->
```
lote-B                     | backend            | --                                          | cerrado
lote-C                     | backend            | @lote-B                                     | cerrado
emision-factura-propuesto  | backend            | que el agente emita esa card hacia web      | abierto
D1                         | backend            | 1er sprint post-beta                        | abierto
D2                         | backend            | 1er sprint post-beta                        | abierto
D3                         | backend            | 1er sprint post-beta                        | abierto
D4                         | backend            | 1er sprint post-beta                        | abierto
D5                         | backend            | @emision-factura-propuesto                  | abierto
D6                         | backend            | 1er sprint post-beta                        | abierto
D7                         | backend            | @lote-B                                     | cerrado
D8                         | frontend           | --                                          | cerrado
D9                         | frontend           | proximo item de frontend                    | abierto
D10                        | planificacion      | abierto/ > 40 archivos o > 5 autogenerados  | abierto
D11                        | backend+auditoria  | al modificar FORCE RLS o una policy         | abierto
D12                        | frontend           | @emision-factura-propuesto                  | abierto
E3                         | backend            | proximo deploy de codigo real por su merito | abierto
D13                        | planificacion      | --                                          | cerrado
D14                        | frontend           | 2do lugar en web que quiera abrir X por id  | abierto
```
<!-- DEUDA-VIVA:FIN -->

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

## Las 10 filas de deuda

Fecha por defecto: **primer sprint post-beta**. No es una fecha de calendario porque la beta todavía no
abrió; es un **disparador binario y verificable** — el sprint que arranca después del primer tester
externo. Cuando la beta abra, esa columna se convierte en fechas duras.

| # | Hallazgo | Origen | Dueño | Fecha | Por qué se difiere |
|---|---|---|---|---|---|
| D1 | **C7** — Composio síncrono sin cache, 5 call-sites. `TTLCache` 30-60s per-tenant | P2 H-5 | backend | 1er sprint post-beta | Costo y latencia por request; no rompe nada con pocos usuarios. **Ya está en la lista de continuación de backend** — puede adelantarse si sobra ciclo |
| D2 | **C3** — fallo del Doc de presupuesto se loguea pero no va a la DLQ (no reintentable) | P2 H-6 | backend | 1er sprint post-beta | Ya loguea el `motivo` con fingerprint: hay rastro, falta reintento. **También en la lista de continuación** |
| D3 | `heartbeat_timeout` ausente en las activities del loop ReAct (asimetría vs. AFIP, que sí lo tiene) | P2 H-7 | backend | 1er sprint post-beta | La `RetryPolicy` ya está acotada al 100%, así que no hay cuelgue infinito; el heartbeat mejora la detección, no la evita |
| D4 | `patched()` sin gate de replay en CI | P2 H-7 | backend | 1er sprint post-beta | Riesgo real sobre ejecuciones en vuelo, pero requiere diseñar el gate — no es un fix de línea |
| D5 | 8 endpoints AFIP/presupuestos con guard probado sólo a nivel helper/store, no por endpoint HTTP hostil | **P2** H-2 (⚠️ decía P1 — mal etiquetada, corregida 2026-08-12 20:47 contra el informe de origen) | backend | **re-diferida 2026-08-13 00:45 a `@emision-factura-propuesto`** — backend la difirió "a un PR propio cuando corresponda", que es una intención, no un disparador: es la forma exacta en que D7 se perdió dos veces. Se le pone un `@` que el instrumento evalúa solo | Es la **misma clase** que C3 del lote C. Al escribir esos tests, extender el patrón a estos 8 |
| D6 | 4 uploads sin validación de magic bytes | P1 H-5 | backend | 1er sprint post-beta | **Ya tienen cota de tamaño** (sin DoS) y nunca se persisten a disco — van en memoria a Groq/OpenAI. Sin RCE; peor caso 422/502 externo |
| D7 | ~~`except: return False` en `mercadopago_gateway.py:119` — fail-silent. **Es el 5º `except` de D-A**~~ — ✅ **CERRADO 2026-08-12 21:00, #424** | **P2** H-4 por sí solo, pero **P1 como instancia de D-A** (Pasada 2 H-3) — corregido 2026-08-12 20:47 | backend | ✅ resuelto — el fail-closed **no cambió** (sigue `return False`); se agregó `log_error_evento` con `reason` del SDK, que distingue `SIGNATURE_MISMATCH` de `TIMESTAMP_OUT_OF_TOLERANCE` sin loguear la firma cruda. **Con esto D-A queda 5/5 y G2/G3 cierran** | Auditoría lo clasificó bien: **blind-spot de observabilidad, no vulnerabilidad**. El webhook **no es forjable** (SDK oficial, fail-closed). Es de la misma familia que los `except` del lote B |
| D8 | ~~`apps/copiloto-web/.../useChat.ts` (348 líneas) reimplementa `packages/core/src/chat/chatMachine.ts` en vez de consumirlo como hace mobile~~ — **CERRADO 2026-08-12** (test de equivalencia, no convergencia) | C6(b) | frontend | resuelto | Ver abajo |
| D9 | Flake del job `mobile` dentro de `gate.sh` completo — **REABIERTA 2026-08-12 ~16:50: reapareció CON el fix aplicado** | campo (frontend, 2026-08-12) | frontend | próximo ítem de frontend | `jest.setTimeout(15000)` bajó la frecuencia pero **no eliminó la causa**. Ver abajo: 3ª aparición, discriminada |
| D10 | El janitor **nunca archiva** las alertas que el escalador autogenera (`urgente_vigilancia-a-*`), porque `urgente_` es ancla por diseño ⇒ toda alerta resuelta queda en `abierto/` para siempre | campo (planificación, 2026-08-12) | planificación | `abierto/` > 40 archivos, **o** > 5 autogenerados | Hoy son 2 sobre 26: **no es problema de volumen todavía**. Ver abajo |
| D11 | **Los 2 adversariales de C3 (lote C) NO aíslan el guard app-side** — al remover el filtro `WHERE cliente_id` del `UPDATE`, el test sigue **verde** porque RLS `FORCE` lo tapa como 2ª barrera. Verifican el sistema (A no toca B), no cuál capa lo garantiza | Fase D lote C (auditoría, 2026-08-12) | backend + auditoría | **al modificar `FORCE ROW LEVEL SECURITY` o la policy de cualquier tabla con guard app-side** | Defense-in-depth = seguro hoy; deuda de **cobertura**, no de función. Ver abajo |
| **D13** | ~~**El instrumento nuevo (`deuda-check.sh`) está en `main` pero no corre**~~ — ✅ **CERRADO 2026-08-12 21:20.** Se escribió en un worktree y nunca llegó al **checkout compartido**, que es desde donde los crones ejecutan `vigilancia-check.sh`; y el registro tampoco está en ese working tree | campo (planificación, 2026-08-12) | planificación | ✅ resuelto — fallback a `git show origin/main:<path>` para leer el registro + los dos archivos copiados al checkout que corre. Control positivo **end-to-end ahí**: exit 1 nombrando la fila | Ver abajo: la **primera causa que escribí era falsa** y la medición la desmintió |
| D12 | **Web sólo tiene 1 de las 5 cards `*_propuesto` que mobile tiene desde el hito 8** (`presupuesto_propuesto`, cerrada en e2e §G6; faltan `gasto_propuesto`/`cliente_propuesto`/`ingreso_propuesto`/`factura_propuesto`) | e2e §G6 (frontend, 2026-08-12) | frontend | **cuando se confirme que backend emite `card: {kind: '<x>_propuesto', ...}` hacia web para alguna de las 4 restantes** (grep de `card.kind` en una respuesta real de `/reply`, no suposición) | No hay evidencia de que backend ya mande esas 4 a web — expandir sin esa confirmación es trabajo especulativo. `presupuesto_propuesto` sólo se supo roto porque el smoke lo ejercitó; el mismo método (no inspección de código) decide si esto es deuda real o no aplica |
| D14 | **`TarjetaClientePropuesto` en web: el caso `ya_existe` no lleva a ningún lado.** Mobile navega a la ficha; web no puede, porque `apps/copiloto-web` **no tiene ruteo ni ningún mecanismo de "abrir X por id"** (verificado por frontend leyendo `AppShell`, `DesktopShell`, `destinoActividad.ts`, `FilaActividad.tsx`) | hallazgo (frontend, 2026-08-12) | frontend | **cuando aparezca un 2º lugar en web que quiera "abrir X por id"** | Traer un router entero por un solo caso de borde es infraestructura, y es MAYOR. Con dos casos la decisión se toma con datos en vez de por incomodidad. La card **no promete** hoy lo que no puede cumplir (no hay botón muerto), así que la deuda es de UX, no de corrección |

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

### Captura oportunista — backend, gate de Lote B (commit `9b58ab36`), archivo distinto

La primera captura real llegó, y **no es el mismo archivo**: `Onda.test.tsx` (no
`PantallaSoporte.test.tsx`/`ChatView.test.tsx`), `it` = *"sin ninguna muestra, monta la cantidad fija
de barras"*, mismo `Exceeded timeout of 5000 ms`. Backend discriminó igual que las veces anteriores
— `mobile.sh` aislado sobre el mismo commit: **730 passed, 0 failed** — y Lote B no toca
`apps/mobile/`, cero superposición con el fix. Backend dejó dos lecturas abiertas sin arbitrar
(misma familia de contención vs. `Onda.tsx` con problema propio) y me lo pasó por ser la dueña de D9.

**Decisión: la sumo a D9 como evidencia de la misma familia (H1), no abro fila aparte.** Dos motivos,
ambos en el propio reporte de backend: el `it` que falló usa `niveles={[]}` — el caso más liviano,
sin tocar `amplitudObjetivo` ni el path de animación donde `Onda.tsx` sí tiene un antecedente real de
fragilidad en device (`Animated.loop` legacy) — así que el timeout no coincide con esa causa conocida;
y en la misma corrida `ChatView.test.tsx` tardó 130.9s (vs. su tiempo normal), señal de que la máquina
entera estaba bajo presión, no un componente puntual. Esto **generaliza el hallazgo**: el timeout de
5000ms es frágil bajo contención para cualquier test de montaje pesado, no sólo el describe de voz.
No cierra la fila ni cambia la instrucción — sigue siendo oportunista, mismo dueño (frontend).

---

## D11 — RLS `FORCE` enmascara el control negativo de los adversariales C3

**Qué es.** En la Fase D de lote C (PR #412 → `28c33f56`) los dos tests adversariales nuevos
—`test_ADVERSARIAL_A_no_puede_editar_ni_desactivar_el_concepto_de_B` (`test_cobros_y_catalogo.py`) y
`test_ADVERSARIAL_A_no_imputa_el_gasto_de_B_asignandolo_a_su_propio_trabajo`
(`test_trabajo_store.py`)— **verifican la propiedad de seguridad** (el actor A no puede tocar el
recurso de B, probado contra Postgres real, cumple la regla dura del repo). Pero **no aíslan el guard
app-side**: backend lo declaró honestamente en el commit — al remover el filtro `WHERE cliente_id` del
`UPDATE`, el test **siguió verde** porque **RLS `FORCE` es una 2ª barrera independiente** que sostiene
el aislamiento sola. Es defense-in-depth (dos candados) = estrictamente más seguro, pero el test pasa
**con y sin** el filtro app-side ⇒ ese filtro queda cubierto por lectura de código + RLS, no por un
test que caiga sin él. Si algún día se desactivara RLS `FORCE`, estos tests serían el único guard y no
tenemos prueba de que funcionen aislados. Detalle y lección:
[[defense-in-depth-enmascara-el-control-negativo-de-la-capa-interna]].

**Por qué se difiere (no bloquea).** La propiedad de seguridad **sí** está verificada adversarialmente.
Esto es menor poder diagnóstico de un test sobre un sistema con doble candado, no un fail-open. Sólo se
vuelve relevante **el día que se toque la capa externa** (RLS).

**Callejón sin salida ya descartado — no gastar tiempo acá.** El mecanismo obvio para aislar el guard
app-side sería correr el adversarial con un rol `BYPASSRLS`. **Ese rol existe y NO sirve:**
`copiloto_consola` es `BYPASSRLS` pero **`SELECT`-only** (verificado: `admin_errores.py:34`,
`admin_tenants.py:24`, `auditoria_store.py:26`) — no puede ejercitar un `UPDATE`. Quien tome esta deuda
necesita un **rol de test propio con `BYPASSRLS` + write**, y eso es **infra**
(`deploy/worker/provision_tables.py`): es parte del costo del ítem, no un detalle.

**Qué prueba la cierra (§Fase D).** Con RLS `FORCE` temporalmente en `NO FORCE`/bypass (vía ese rol de
test dedicado), revertir el filtro `WHERE cliente_id` de cada `UPDATE` hace **caer** los 2 adversariales
(rojo sin el guard app-side) y restaurarlo los pone verde de nuevo — recién ahí el control negativo
aísla la capa interna. Dueño: **backend** (infra del rol) **+ auditoría** (re-corre el control negativo).

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
| E1 | ~~Login por Google no se ejercita~~ — **gate app-side de `ensure-tenant` CERRADO 2026-08-12**; el tramo browser (login Google real de punta a punta) sigue abierto, dueño operador/frontend | backend (gate) | resuelto (gate) | Ver abajo |
| E2 | ~~Aislamiento cross-tenant A↔B no se prueba contra prod~~ — **CERRADO 2026-08-12** | backend | resuelto | Ver abajo |
| E3 | **Durabilidad no se prueba: ninguna conversación sobrevive a un restart del worker en el smoke.** Es *el moat* del producto | backend | **el próximo deploy propio de backend que reinicie `uc-copiloto-worker.service`** (no "1er sprint post-beta": ya ANCLADO a un disparador concreto, ver abajo) | La Pasada 2 verificó el moat **por estructura** (0 no-determinismo, `RetryPolicy` acotada al 100%, `continue_as_new` con flush) — que es evidencia real y fuerte. Lo que falta es la prueba de comportamiento: matar el worker a mitad de turno y ver que la conversación sigue |

**Cierre de E2 (backend, 2026-08-12):** script `scripts/e2e_g6_adversarial_multitenant.py`, ataque real
contra prod (`https://copilotoemprendedor.duckdns.org`) — no unitario, no simulado. `GET /reply` deja
`session_id` como string libre del cliente sin validar pertenencia a nivel de ruta; la barrera real
depende 100% de que el store filtre por el `cliente_id` del token del atacante. Un segundo tenant
(`e2e-adversary-g6@copiloto.test`, provisionado por el propio `/auth/signup` con el invite-token de
C4.1 — sin bypassear ese gate) pidió el `session_id` EXACTO del canónico con SU PROPIO token: `200
{'replies': [], 'next_id': 0}`. Control positivo de que B no está simplemente roto: B recibió su propia
reply en su propia sesión, `1 fila`. Evidencia completa:
`coordinacion/cerrado/2026-08-12/…avance_backend-a-todos_e2e-G6-item1-verde-item2-bloqueado-por-clasificador.md`.

**E3 — bloqueado por el clasificador de seguridad del harness, no rojo, no abandonado.** Script listo
y no destructivo hasta el punto del restart: `scripts/e2e_g6_durabilidad_worker_restart.py` (turno 1 →
restart real de `uc-copiloto-worker.service` con el mensaje potencialmente en vuelo → poll del reply →
turno 2 en la misma sesión, para probar continuidad y no sólo recuperación de un mensaje huérfano). El
clasificador bloqueó el restart standalone **2 veces** (una con `description` explícito del propósito)
— mismo guardarraíl que ya frenó una lectura de Temporal history en el spike de idem_key (`ADR-002`),
ahora sobre una escritura: el MISMO comando corre sin bloqueo dentro de `deploy/copiloto/deploy.sh`
(usado varias veces esta sesión), así que lo que discrimina no parece ser el comando sino el contexto
standalone/experimental. No se buscó un rodeo (SSH directo, sub-agente) — ver
`memoria/clasificador-de-seguridad-bloquea-mutar-prod-standalone-en-autonomo.md` (harness) y el
`decision_backend-a-operador_…` en `coordinacion/abierto/`. **Disparador de cierre:** el próximo deploy
que reinicie `uc-copiloto-worker.service` **por mérito propio** — código real de `apps/copiloto`/`motor`
que se despliegue porque ese es su motivo, no un deploy fabricado para conseguir el restart (esa
fabricación sería el mismo rodeo que el clasificador ya frenó, con otro nombre — corrección preventiva
de planificación, `dato_…un-deploy-fabricado-para-conseguir-el-restart-es-el-rodeo-con-otro-nombre.md`).
**E1 (#420, #421) NO califica:** ambos son docs/tests-only, cero cambios en `apps/copiloto` o `motor`,
sin razón propia de deploy. El mismo script queda listo para montarse sobre el próximo deploy que sí
la tenga.

**Por qué E3 no es P1 pese a ser el moat:** no hay indicio de que esté roto — al contrario, la
evidencia estructural es buena. Es un hueco de *demostración*, no de *función*. Pero queda anotado
porque "nuestro diferencial anda" es exactamente la clase de afirmación que no se sostiene con
autoevaluación.

**Confirmación independiente de E1 (frontend, e2e §G6, 2026-08-12):** el mismo hueco aparece del lado
del browser, no sólo del lado de `ensure-tenant`. El link `Entrar con Google` de
`apps/copiloto-web/src/auth/LoginScreen.tsx` se verificó **sólo estructuralmente** contra prod
(`https://copilotoemprendedor.duckdns.org/auth/v1/authorize?provider=google&redirect_to=...` — GoTrue
real, redirect correcto) — un browser headless no tiene forma limpia de pasar el challenge/2FA de una
cuenta Google real. Cerrar esto de punta a punta exige una **cuenta Google de prueba dedicada** +
correrlo con un browser no-headless a mano; ninguna de las dos cosas la puede decidir una sesión sola.
`decision_` pidiéndola: `coordinacion/…decision_frontend-a-todos_pedido-cuenta-google-de-prueba-para-e2e-oauth.md`.

**Cierre de E1 — lado backend/app-side (2026-08-12):** el DoD pedía positivo **y** hostil sobre el
gate de allowlist de `ensure-tenant`. Inventario primero (canon 3): `apps/copiloto/tests/test_web_app.py`
ya traía el bloque completo desde C4.1 (header propio: `# --- /auth/oauth/ensure-tenant (Fase 5:
first-login Google, self-provisioning del tenant) ------`) — no hacía falta escribir nada nuevo, sólo
confirmar que corre contra el código real. Rigor: `TestClient` de FastAPI contra la app real
(`create_web_app`), con sólo 2 mocks — el decode/`iss` del JWT (cubierto aparte en `test_auth.py`) y
una DB in-memory —; la lógica del gate (`_email_en_allowlist`, fail-closed sin env var) corre real.

- **Positivo:** `test_oauth_ensure_tenant_google_provisions_and_returns_cliente_id` — email en la
  allow-list, token Google válido → 200 + tenant provisionado.
- **Hostil (el que C4.1 dejó pendiente de confirmar):** `test_oauth_ensure_tenant_email_fuera_de_allowlist_rechaza`
  — MISMO token Google válido, email no invitado → 403 + `db.tenants == {}`. El propio comentario del
  test es la prueba de que discrimina el control de su ausencia: *"El test de arriba (`google_provisions`)
  pasa igual con o sin allow-list; sólo éste distingue el control de su ausencia."*
- **Fail-closed reforzado:** `test_oauth_ensure_tenant_sin_allowlist_rechaza_incluso_al_invitado` — sin
  la env var seteada, ni el email que estaría en la lista entra.

Evidencia empírica, no lectura sola: gate completo corrido contra el commit mergeado de PR #420
(`02e49c4e`), 6/6 `ok` (`.ci-recibos/02e49c4efc44f3e8851024682946f10d68ae1559.json`), los 8 tests del
bloque `test_oauth_ensure_tenant_*` ejecutados, `0 FAILED` en el log completo (`1875 passed, 26
skipped`).

**Lo que esto NO cierra:** el login Google real de punta a punta vía browser sigue abierto — es el
hueco que confirmó frontend arriba, y su cierre depende de una cuenta Google de prueba dedicada
(`decision_` de frontend), no de nada que backend controle. El gate app-side es lo que backend puede
cerrar, y queda cerrado con esta evidencia.

---

## D13 en detalle — el instrumento no vivía donde se ejecuta (y la primera causa que escribí era falsa)

**Qué es.** El 2026-08-12 21:05 se mergeó `scripts/deuda-check.sh` (#426): el chequeo que hace que un
disparador cumplido en este mismo registro **grite solo**, compuesto dentro de `vigilancia-check.sh`,
que los tres crones corren cada 3 minutos. Probado 9/9 con control positivo del cableado — **en el
worktree donde se lo escribió**.

**El síntoma.** Los crones no lo ejecutan desde ese worktree: corren con el cwd de la sesión, que es el
**checkout compartido**. Ahí:

```
$ ls scripts/deuda-check.sh                          → No such file or directory
$ grep -c 'deuda-check' scripts/vigilancia-check.sh  → 0
```

### La causa que escribí primero, y por qué era falsa

Escribí que la causa era que el checkout compartido está **364 commits detrás de `main`**, y de ahí
deduje tres cosas: que el dueño era el **operador** (avanzar ese checkout con ~100 archivos sin
commitear no es táctico), que era un **bloqueante**, y que los fixes de vigilancia #394, #400, #409 y
#414 tenían la misma pregunta abierta.

Las tres eran falsas, y la medición que faltaba era una sola línea:

```
$ diff <(git show origin/main:scripts/vigilancia-check.sh) scripts/vigilancia-check.sh
  → sólo faltan las 23 líneas de mi propio bloque
```

`git rev-list --count HEAD..origin/main` mide el **HEAD** del checkout compartido (que está parado en
`docs/production-readiness-brief`), **no los archivos del working tree**. Y las sesiones escriben los
scripts *directamente en ese working tree*: por eso `vigilancia-check.sh` en disco estaba al día salvo
mi bloque. **#394, #400, #409 y #414 sí están corriendo.** Inferí el estado de un archivo desde un
contador de commits en vez de diffear el archivo.

### La causa real

Dos huecos míos, ninguno del operador:

1. Escribí `deuda-check.sh` y el bloque de `vigilancia-check.sh` en un worktree y **nunca los copié al
   checkout que corre**. Es el paso que las otras sesiones sí venían haciendo.
2. El **documento del registro** tampoco está en ese working tree, así que aun copiando el script el
   chequeo habría fail-loudeado «no encuentro el registro» cada 3 minutos.

### Cómo quedó cerrado

- `leer_registro()` en `deuda-check.sh`: si el documento no está en el working tree, lo lee de
  `git show origin/main:<path>`. No es un parche de conveniencia — la **autoridad del registro es
  `origin/main`**, no el checkout que casualmente corra el script.
- Los dos archivos copiados al checkout compartido (escritura de archivos nuevos, sin tocar el índice
  git ni el trabajo sin commitear de nadie: no requiere ninguna de las operaciones que el canon 9
  prohíbe ahí).
- **Control positivo end-to-end en el checkout que efectivamente corre**, no en el worktree:

```
$ DEUDA_FILE=<fixture con un disparador cumplido> bash scripts/vigilancia-check.sh --quiet
DEUDA:
⚠️  DEUDA: 1 fila(s) con el DISPARADOR CUMPLIDO y sin cerrar
    · D7 · dueño backend · disparador @lote-B ya está CERRADO
EXIT=1
```

### Lo que sobrevive de todo esto

Dos cosas, y ninguna es «el checkout compartido es un problema»:

- **Un control positivo que consiste en "sale verde" no es un control positivo.** El control es forzar
  la condición que debe disparar la alarma y verificar que la alarma suena — y hacerlo *en el lugar
  donde tiene que sonar*, no donde se escribió el código. Memoria:
  [[un-disparador-cumplido-no-avisa-a-nadie]].
  **Y volvió a pasar en el mismo PR:** el test que agregué para el fallback se salteaba en Actions
  (`fetch-depth=1`, sin ref `origin/main`) y el job igual imprimía «todo verde» — el caso no corrió ni
  una vez en CI. Se cerró parametrizando `DEUDA_REF` para ejercitar el mismo mecanismo contra `HEAD`
  donde no hay `origin/main`, más un control negativo (`8b`, ref que no resuelve → grita) para que el
  positivo no pueda pasar por casualidad. **El salteo nunca es una salida:** si el caso no puede
  correr, el test tiene que estar rojo, no verde con una advertencia.
- **Un contador de commits no dice nada sobre un archivo del working tree.** Diffeá el archivo. Yo
  inferí, y la inferencia me hizo escribir en un registro versionado un bloqueante con dueño ajeno que
  no existía — que es peor que no haberlo registrado.

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
