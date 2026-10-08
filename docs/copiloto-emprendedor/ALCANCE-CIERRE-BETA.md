# Alcance CERRADO del cierre de la beta — la lista contra la que se mide el foco

> **Orden del operador, 2026-10-08:** *«cuando te he dejado trabajo de larga duración has terminado
> haciendo cosas que nunca te pedí… si auditamos algo siempre vamos a encontrar algo que corregir
> pero nos desenfoca del objetivo de terminar»*.
>
> **Este archivo es la lista CERRADA.** Todo trabajo del cierre cita uno de estos ids. Lo que no
> cita un id **es un desvío**, por legítimo que parezca el hallazgo.
>
> **Por qué existe, medido:** la noche del 2026-10-06/07 produjo **111 commits**; **48 % fueron
> auto-referenciales** (arreglar los propios instrumentos: gate, medidor, dup-índice, smoke) y
> **109 de 111 no citaron ningún id de DoD**. Hubo una cadena visible de cinco PRs arreglando al
> que arregla: #897 → #900 → #919 → #921 → #925. Ningún cron lo frenó, porque los crones medían
> *silencio* y *cola*, no *foco* — y una sesión desviada no está en silencio: está muy ocupada.
>
> **Por qué la lista es cerrada y no una cola:** auditar siempre produce hallazgos. Una cola
> alimentada por auditorías no se vacía nunca, y cada ítem nuevo trae su propia justificación. El
> único mecanismo que termina es una lista que **no se puede ampliar sin la firma del operador**.

## Instrumento

`scripts/foco-check.sh` lee el bloque de abajo y clasifica cada commit desde el SHA base. No
pregunta si el trabajo es correcto —eso sería autoevaluación, y la autoevaluación del agente no
cuenta (CANON 7)— sino si **cita un id de esta lista**. Es mecánico: no se puede argumentar con él.

**SHA base del cierre:** `9f2448ac` · **INICIO DEL CIERRE:** `2026-10-08 07:00`

El instante importa tanto como el SHA. Sin él, `^<base>` arrastra todo commit de las ramas de worktrees viejos que no sea ancestro del base —92 commits de septiembre, en la primera corrida— y el gate grita por trabajo de hace tres semanas. **Un guard que grita en el caso normal se desarma solo**, así que el instrumento mide sólo de acá en adelante. Lo histórico ya está medido y no se re-litiga: 111 commits, 48 % auto-referenciales.

## Lo que ENTRA (y nada más)

<!-- ALCANCE-CERRADO:INICIO -->
A3 | BL-V31 | frontend1 | guard B en la 5a tarjeta: no ofrecer dos veces la accion ya resuelta | apps/mobile/src/modules/facturacion/SeccionMisComprobantes.tsx
A5 | BL-F1 | frontend1 | cablear el Recibo terminal en el HITL generico (el componente YA existe en ambas apps) | apps/copiloto-web/src/modules/chat/HitlCard.tsx + apps/mobile/src/modules/chat/ListaMensajes.tsx
A7 | DRIVECERO | backend | Drive: una accion ejecutable, o retirarlo de la UI con test que lo prohiba | apps/copiloto/services/drive.py
A8 | SHEETSSOLOAPPEND | backend | declarar en la UI que de Sheets solo se escriben filas | apps/copiloto/services/sheets.py + la UI que ofrece Sheets
P1 | BL-P1 | planificacion | el acta debe decir que libera la Parte 2 del contrato del 16/09 y si la reunion ocurrio | docs/copiloto-emprendedor/2026-09-21-acta-decisiones-beta-odobi.md
P3 | BL-P3 | planificacion | la tabla §2 del acta necesita dueno, fecha y plataformas por DA | docs/copiloto-emprendedor/2026-09-21-acta-decisiones-beta-odobi.md
C1 | CONTROLFOCO | planificacion | el mecanismo de control de foco que el operador ordeno el 2026-10-08 («armalo e implementa») — se registra para que el gate no grite por su propia instalacion, no para auto-absolverse | scripts/foco-check.sh + scripts/tests/test-foco-check.sh
<!-- ALCANCE-CERRADO:FIN -->

## Estado medido de esas filas — 2026-10-08

Medido contra `origin/main` (`d030c359`, re-medido en `a68345f4`), no contra el plan del 06/10.
**Las siete filas estaban resueltas antes de hoy** — las cuatro que el plan daba por pendientes y
las tres que ya se habían cerrado en la jornada. Dos de ellas lo estaban desde julio. La lista
cerrada queda **7/7**: no hay fila de código pendiente. Esto se
registra acá y no borrando la fila, porque el gate lee los ids del bloque de arriba: una fila
borrada invalidaría los commits que la citan.

| id | veredicto | evidencia |
|---|---|---|
| `A3` | ✅ **HECHO — ya estaba mergeado desde el PR #803** | `a9bd6cae` «retomar la anulación en curso al abrir el flujo (BL-V31, mobile)», con su test; el test se arregló después en #819 (`06a0ae3f`, «main verde por el fix, no por la moneda»). El guard B **no vive en el `useEffect` de carga (`:135`) sino en el handler que abre el flujo** (`SeccionMisComprobantes.tsx:180`): `const enCurso = await anulacionEnCursoDe(cuit, c)`, línea y comentario idénticos a su gemelo web (`:203`). Cubierto por cuatro `it(` en `SeccionMisComprobantes.test.tsx`, incluido «recargar entre «Sí, anular» y «Confirmar» retoma en «Confirmar»», que es exactamente el DoD; `AsyncStorage|localStorage` = **0**, como pedía el contrato. |
| `A5` | ✅ **HECHO** | Commit `36e3d906` (06/10, #801) «la card HITL resuelta se muestra como Recibo (BL-F1, mobile)». Mobile: `ListaMensajes.tsx:28` importa `Recibo` y lo renderiza en `:107`; `:331` cita «(A5)». Web: `HitlCard.tsx:1` importa `Recibo` **del design-system** (`from '../../design-system'`), `:36` y `:66` lo documentan como `BL-F1` y `:76` lo renderiza. **Las dos apps cableadas.** Las líneas de web las exigió AUDITORÍA: el renglón citaba el archivo sin línea y el commit dice «(BL-F1, **mobile**)», que es la forma del patrón `dos-implementaciones-del-mismo-cliente-el-fix-llega-a-una`. Acá el fix llegó a las dos, pero el renglón no lo probaba. Dato de instrumento: el primer control positivo buscó `from './Recibo'` y dio **0** — en web el componente vive en el design-system, así que un control positivo mal elegido lo habría dado por no cableado. |
| `A7` | ✅ **HECHO, y el código lo nombra** | `web.py:486` dice literalmente «Drive, **poda A7**». El catálogo lo excluye **por derivación** de la policy real (`_composio_valid_toolkits()`, `web.py:474-480`: «un servicio sin `TOOLS` no aparece ni acepta `/composio/connect`»), sin lista literal que pueda driftear, y `test_catalog_route.py:125` tiene el `assert "googledrive" not in keys` — **el test que lo prohíbe**, que es lo que pedía el DoD. La poda es de `800a56a0` (**2026-07-22**, #41). `_composio_known_toolkits()` lo mantiene revocable a propósito, para que un tenant ya conectado pueda desconectarse. |
| `A8` | ✅ **HECHO por la primera salida de su DoD** («o se amplía») | En el camino de producción Sheets tiene **tres** ops, no una: `sheets.py:77` `append_row` → `Proposal`, `:88` `update_range` → `Proposal`, `:101` `read_range` → `Read`, y `POLICY.write = {APPEND, UPDATE}`. No hay que declarar ningún límite en la UI porque el límite no existe. |
| `P1` `P3` | ✅ **HECHO** | PR #929: el acta trae §1.bis (qué libera la Parte 2 + la reunión no ocurrió) y su tabla §2 pasó a 6 columnas. |
| `C1` | ✅ **HECHO** | #927 (mecanismo) + #928 (lee la lista de `origin/main`). |

> ### ⚠️ Por qué el plan del 06/10 contaba como deuda cosas resueltas
>
> `A7` y `A8` se midieron por el **catálogo `TOOLS`**, que es real pero **no es el camino que atiende
> el chat**. Producción corre `worker_b.py` (`uc-copiloto-worker.service:14`), que consume
> `PROMPT_FRAGMENT` y rutea por `dispatcher_emprendedor.py:253-255` → `mod.build(op, …)`. Por ese
> camino Drive tiene `create_file` y `find`, y Sheets tiene las tres ops. `TOOLS = {}` en
> `drive.py:75` **no es un olvido: es la poda deliberada del hito 2**, y es justamente el mecanismo
> por el que la UI dejó de ofrecer Drive.
>
> Los dos mecanismos conviven y miden cosas distintas. Medir el que no corre en prod da un número
> correcto sobre el sujeto equivocado — la misma familia que
> `el-instrumento-respondio-sobre-otro-sujeto` y `el-test-que-no-usa-el-camino-de-produccion-no-puede-verlo-fallar`.
> **Antes de abrir trabajo sobre un servicio, preguntar cuál de los dos caminos lo expone.**
>
> **Y `A3` fue el mismo error, cometido por mí un día después de escribir este párrafo.** Medí el
> `useEffect` de carga (`:135`) y concluí «nunca consulta `anulacionEnCursoDe`». Era cierto de ese
> hook y falso del componente: el guard vivía en el handler que abre el flujo (`:180`) desde el PR
> #803, en julio. Sobre esa medición bajé un contrato a frontend-1, que **reimplementó A3 entero**
> — mismo mensaje de commit, mismos cuatro `it(`, blob `.tsx` idéntico al de `main`. Trabajo
> duplicado por mi medición, no por su ejecución. El control que lo habría evitado cuesta una
> línea: `git log origin/main -- <el archivo>` **antes** de escribir el contrato, que es
> `el-contrato-que-manda-a-hacer-algo-ya-hecho` — su tercera ocurrencia desde el 29/09.
> La pregunta que lo caza: *¿miré el hook, o miré el componente?*


## Lo que NO entra — y por qué, para no re-litigarlo cada vez

| bloque | por qué está fuera |
|---|---|
| Los 7 `FALTA` de familia `O` | **Cierre B por acta** (`2026-09-21-acta-decisiones-beta-odobi.md:22-24`): testers, consent de OAuth, APK instalado, observabilidad, backups, SLA |
| `BL-O8` rotar token + `DATABASE_URL` | diferido a pre-prod por decisión del operador |
| Toda la tanda de **device** | diferida al sprint siguiente por orden del operador del 2026-09-22 |
| `BL-X10` audio «o-DO-bi» · `BL-X6` los `.otf` en la historia · `BL-P6` prototipo de Martín | **son del operador**, no del agente |
| `BL-C5` migrar a `expo-web-browser` | **DoD invertido**: el código ya declara la decisión contraria, fechada, en `apps/mobile/src/modules/apps/PantallaApps.tsx:172-173` |
| `BL-O7` SLA en horas | **DoD invertido**: dos tests prohíben prometer horas (`SoporteScreen.test.tsx:27-29`, `PantallaSoporte.test.tsx:294-300`) |

## Hallazgos nuevos: se ANOTAN, no se arreglan

Aparecerán. Es la naturaleza de auditar. **Un hallazgo nuevo no abre trabajo**: se agrega una línea
acá y se sigue con el id en curso. Sólo el operador puede moverlo arriba.

<!-- HALLAZGOS-DIFERIDOS:INICIO -->
<!-- una línea por hallazgo: fecha | quién lo vio | qué es | path:línea -->
2026-10-08 | planificación | el smoke de prod NO ARRANCA por el camino con que prod lo corre: `smoke_beta_e2e.py:19` importa `meclaves_check` y `run-smoke-prod.sh` lo pipea por stdin al venv del VPS, así que el import no resuelve. **BLOQUEA el punto 4 del criterio de cierre §13 del backlog** («smoke en verde contra prod»). Dueño: backend. Levantado por auditoría el 2026-10-07, sigue abierto en el buzón. NO se arregla sin firma del operador: ampliar esta lista es decisión suya. | deploy/copiloto/smoke_beta_e2e.py:19 + deploy/copiloto/run-smoke-prod.sh
2026-10-08 | auditoría | `H-FOCORC1` 🟠 **`foco-check.sh` devuelve rc=1 con 0 DESVÍOS.** El `exit 1` cuelga de `hay=$((desvio+autoref))`, y hoy lo dispara un auto-referencial ya mergeado e inmutable (`d030c359`, #924). Corrida de prod: 7 en alcance · 1 auto-referencial · **0 desvíos** · **rc=1**. Si rc=1 es el estado permanente, el primer DESVÍO real será indistinguible del ruido — `el-guard-que-grita-en-el-caso-normal-se-desarma-solo`. El gate clasifica bien: es el umbral del `exit` el que mezcla dos clases. Dueño: planificación. | scripts/foco-check.sh:143-158
2026-10-08 | auditoría | `H-DRIVEDISPATCH` 🟠 **la poda de A7 vive sólo en la capa que lee `react`.** El `PROMPT_FRAGMENT` de Drive sigue anunciando `create_file` y `find` al LLM, y en el camino `dispatch` el `op` **sí** sale del LLM sin pasar por `TOOLS` (`mod.build(ent.get("op"), …)`). Hoy inerte porque prod corre `react`; vuelve a estar vivo si `COPILOTO_ENGINE_MODE` cambia. No se pudo cerrar: el valor real de esa env no está en ningún archivo versionado. `[REQUIRES_LIVE_VALIDATION]`. Dueño: backend. | apps/copiloto/services/drive.py:35-39 + apps/copiloto/dispatcher_emprendedor.py:258
2026-10-08 | auditoría | `H-A7SINTEST` 🟠 **el control que de verdad sostiene A7 no tiene test.** `test_catalog_route.py:125` (`assert "googledrive" not in keys`) prueba que Drive no aparezca en el **catálogo de la UI** (`TestClient(app).get("/catalog")`), nunca `mod.build()`. El control real es `TOOL_INDEX` (`tool_catalog.py:413,425,1577-1580`) y **nada lo ejercita**: si mañana alguien le agrega un `TOOLS` a Drive, ningún test lo caza — `un-mecanismo-roto-hacia-el-no-no-da-sintoma`. Dueño: backend. | apps/copiloto/tool_catalog.py:413
<!-- HALLAZGOS-DIFERIDOS:FIN -->

## Cuándo está cerrado

Las 6 filas de arriba mergeadas, con su DoD cumplido y el recibo de `scripts/gate.sh` citado por su
SHA. **Un PR por sesión, no uno por fila**: el costo dominante de la noche del 06/10 no fue escribir
el código, fue pagar el gate ocho veces y desviarse entre corridas.
