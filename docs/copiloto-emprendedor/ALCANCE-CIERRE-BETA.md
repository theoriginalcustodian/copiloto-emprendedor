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
2026-10-08 | planificación | el smoke de prod NO ARRANCA por el camino con que prod lo corre: `smoke_beta_e2e.py:19` importa `meclaves_check` y `run-smoke-prod.sh` lo pipea por stdin al venv del VPS, así que el import no resuelve. **BLOQUEA el punto 4 del criterio de cierre §13 del backlog** («smoke en verde contra prod»). Dueño: backend. ⇒ **RESUELTO el 2026-10-08**: la causa citada acá (import por stdin) estaba vencida desde el #908 (07/10); lo que faltaba era el export de `UC_LOGIN_CONTRATO_PATH` y lo cerró el #932. Prod vivo `92fd8a06` contiene `c5727e5d` (ancestría verificada por auditoría) + smoke 39/39 de backend. Ver la fila **4** de §13. | deploy/copiloto/smoke_beta_e2e.py:19 + deploy/copiloto/run-smoke-prod.sh
2026-10-08 | auditoría | `H-FOCORC1` 🟠 **`foco-check.sh` devuelve rc=1 con 0 DESVÍOS.** El `exit 1` cuelga de `hay=$((desvio+autoref))`, y hoy lo dispara un auto-referencial ya mergeado e inmutable (`d030c359`, #924). Corrida de prod: 7 en alcance · 1 auto-referencial · **0 desvíos** · **rc=1**. Si rc=1 es el estado permanente, el primer DESVÍO real será indistinguible del ruido — `el-guard-que-grita-en-el-caso-normal-se-desarma-solo`. El gate clasifica bien: es el umbral del `exit` el que mezcla dos clases. 🔴 **CONFIRMADO EN LA PRÁCTICA el mismo día, 2026-10-08:** apareció el **primer DESVÍO real** que el gate detectó — `c5727e5d` (#932) toca producto sin citar un id de la lista — y **no produjo ninguna señal nueva**, porque `rc` ya era 1 por los 2 auto-referenciales. La corrida fue: 14 en alcance · 2 auto-referenciales · **1 desvío** · rc=1 — el mismo rc que con 0 desvíos. La predicción de auditoría se cumplió en horas: el umbral del `exit` mezcla dos clases y el desvío queda indistinguible del ruido de fondo. Sigue **anotado y no arreglado**: es fila de instrumento y el sprint cierra sin cablear instrumentos nuevos. Dueño: planificación. | scripts/foco-check.sh:143-158
2026-10-08 | auditoría | `H-DRIVEDISPATCH` 🟠 **la poda de A7 vive sólo en la capa que lee `react`.** El `PROMPT_FRAGMENT` de Drive sigue anunciando `create_file` y `find` al LLM, y en el camino `dispatch` el `op` **sí** sale del LLM sin pasar por `TOOLS` (`mod.build(ent.get("op"), …)`). Hoy inerte porque prod corre `react`; vuelve a estar vivo si `COPILOTO_ENGINE_MODE` cambia. No se pudo cerrar: el valor real de esa env no está en ningún archivo versionado. `[REQUIRES_LIVE_VALIDATION]`. Dueño: backend. | apps/copiloto/services/drive.py:35-39 + apps/copiloto/dispatcher_emprendedor.py:258
2026-10-08 | auditoría | `H-A7SINTEST` 🟠 **el control que de verdad sostiene A7 no tiene test.** `test_catalog_route.py:125` (`assert "googledrive" not in keys`) prueba que Drive no aparezca en el **catálogo de la UI** (`TestClient(app).get("/catalog")`), nunca `mod.build()`. El control real es `TOOL_INDEX` (`tool_catalog.py:413,425,1577-1580`) y **nada lo ejercita**: si mañana alguien le agrega un `TOOLS` a Drive, ningún test lo caza — `un-mecanismo-roto-hacia-el-no-no-da-sintoma`. Dueño: backend. | apps/copiloto/tool_catalog.py:413
2026-10-08 | auditoría | 🔴 `H-DOSCIERRES` — «cierre» nombra DOS criterios distintos y el corto se puede declarar como el largo: el alcance pide 7 filas mergeadas, §13 pide 5 puntos simultáneos. Medido: puntos 3, 4 y 5 NO cumplidos. Decisión del operador. | `ALCANCE-CIERRE-BETA.md:96` + `2026-09-21-backlog-beta-odobi-con-dod.md:1051-1058`
2026-10-08 | auditoría | 🔴 `H-13DEPENDEDEDEVICE` — los puntos 3, 4 y 5 de §13 convergen en device y en una corrida del día; **2 de los 3 están bloqueados por la orden del 22/09 de diferir device**, y 39 de 77 filas dependen de captura device/PWA ⇒ §13 no es alcanzable este sprint por decisión ya tomada. O se redefine §13, o se cierra contra otro criterio. ⚠️ **CORREGIDO por su autor el 2026-10-08 (misma tarde):** el **punto 4 nunca fue device** y pasó a ✅ con el #932 — lo metí en el mismo bulto por el color, no por el mecanismo. **La conclusión no cambia, el denominador sí:** hoy el único punto bloqueado por la orden del 22/09 es el **3** (mitad mobile de la matriz), más el **1**, que espera una firma del operador. Una conclusión que sobrevive a una premisa corregida vale más que la que se cae. | `2026-10-06-plan-y-backlog-de-cierre-lo-que-falta.md:52-58,191,193`
2026-10-08 | auditoría | 🔴 `H-DODNOSEMIDE` — el punto 2 de §13 pide «cerrados con su DoD» y **ningún artefacto mide eso**: el backlog mide DoD tildado (6/66, con su propio estado declarado inválido) y el plan vigente mide «código en main» (56/77), criterio más laxo, con captura device/PWA pendiente en casi todos. | `backlog:6,14` + `2026-10-06-plan-y-backlog-de-cierre-lo-que-falta.md:52-58`
2026-10-08 | auditoría | 🟠 `H-BACKLOG11CORRUPTOS` — 11 de los 77 ítems del backlog tienen el encabezado reducido a un único byte `0x01`, así que un barrido por patrón obtiene 66 y lo toma por el total. Incluye `P1`, `P3`, `C5`, `X9`, `B4`, `O1`, `O2`, `O3`, `O5`, `O7`. Viene de `b313627a`/`2d4b3113`. | `2026-09-21-backlog-beta-odobi-con-dod.md:144,159,177,333,760,825,850,860,870,888,906`
2026-10-08 | auditoría | 🟠 `H-PLANVIGENTE2CORRUPTAS` — 2 filas del Apéndice A del plan vigente traen residuo de script (`","stderr":"`) y pierden su evidencia: `BL-J5` y `BL-W3` (éste queda sin evidencia ni «qué falta»). `:313` reconoce la recuperación por script. Veredicto legible, evidencia no verificable. | `2026-10-06-plan-y-backlog-de-cierre-lo-que-falta.md:313,371,402`
2026-10-08 | auditoría | 🟠 `H-MATRIZ3CUENTAS` — la misma matriz tiene tres denominadores: 54 (`:1057`), 48 (`:997`) y 29 filas web medidas (`:1000`), y **mobile sin medir**. Un ✅ sobre cualquiera de los tres no dice lo mismo. | `2026-09-21-backlog-beta-odobi-con-dod.md:997,1000,1057`
2026-10-08 | auditoría | 🟠 `H-V31DOSSENTIDOS` — `BL-V31` nombra el guard A en el backlog (`:1042`) y el guard B en el alcance (`:33`); `a9bd6cae` cerró el B. El A está cubierto en los 5 lugares de `origin/main` con dos patrones, pero nadie lo midió *como* `BL-V31`, así que el backlog lo muestra 🔴 — mismo patrón que `BL-Q5` (`:1000`), invertido. | `backlog:1042` + `ALCANCE-CIERRE-BETA.md:33`
2026-10-08 | auditoría | 🟠 `H-POSPUESTOSSIN12` — `BL-O1` y `BL-O2` se posponen a Cierre B por `DEC-12` y **no están en §12**, la sección titulada «para que no se pierda». La cláusula del punto 1 de §13 no se cumple para ellos. (`BL-O3`: NO_CONCLUYENTE a propósito — `DEC-13` lo mantiene con alcance Android.) | `2026-09-21-acta-decisiones-beta-odobi.md:22` + `backlog:1005`
2026-10-08 | auditoría | 🟢 `H-A3MITADA` — la mitad (a) de A3 quedó sin registrar al cerrar el id: `BL-V31` se cerró con DoD = (b) «no EJECUTAR dos veces» (`a9bd6cae`, testeado con control positivo). «No MOSTRAR «Anular» sobre una anulación en curso» sigue vivo: cosmético, sin riesgo para el dato. Su fix correcto es que el item de `GET /afip/comprobantes` traiga el estado ⇒ requiere backend, post-beta. Consultar en el `useEffect` de carga NO es el fix: son N requests y pone rojo el test de «una consulta, no N». | `apps/copiloto/afip_web.py:363-365,576-582` + `apps/copiloto-web/src/modules/facturacion/SeccionMisComprobantes.test.tsx:90-91`
2026-10-08 | auditoría | `H-DEC11ACTAVIEJA` 🟠 **el ✅ del punto 1 de §13 no se puede leer del acta: el acta dice lo contrario.** `acta:98` es un bloque titulado literal «⚠️ ACTUALIZACIÓN 2026-09-29 — `DEC-11` NO está cerrado» y `acta:44` dice «está **abierto** … no es deuda de documentación, es una decisión de diseño sin tomar»; la **fila 1 de §13 de este doc** afirmaba «13 DEC en la tabla, ninguno marcado abierto» citando la fila del **21/09** (`acta:21`) — corregida en este mismo PR. Mismo sujeto, misma vara, y la del acta es 8 días más nueva. **Hoy el código desmiente al acta en UNA de las dos mitades:** `DEC-11` Pieza A está HECHA — `BotonVoz.tsx:318-332` usa el radial `glass.ub1 → glass.ub2` con el comentario `DEC-11/DEC11FILL, Pieza A`, y tiene guard de regresión en `paresPintadosContraste.test.tsx:905`. La otra mitad, el **sello de acción** (isotipo blanco sobre acento sólido), sigue en la lista de pares como **excepción clase `logotipo`, `min: 3.16`** (`:836`, `:849`). WCAG 1.4.3 exime el texto que es parte de un logotipo, así que la clasificación es defendible por norma — **pero `DEC-11` dice textual «se corrigen, sin excepción firmada»** ⇒ pregunta ABIERTA, y sólo el operador la contesta: **¿firmó la clasificación `logotipo` del sello?** Si no, `DEC-11` está incumplido en sus propios términos por una excepción que nadie firmó. Dueños: **planificación** (retirar o fechar el bloque viejo del acta, que hoy contradice al doc de cierre) + **operador** (la firma). | docs/copiloto-emprendedor/2026-09-21-acta-decisiones-beta-odobi.md:98 + apps/mobile/src/theme/paresPintadosContraste.test.tsx:836
<!-- HALLAZGOS-DIFERIDOS:FIN -->

## El criterio §13, punto por punto — medido 2026-10-08 sobre `92fd8a06`

La lista cerrada de 7 filas **no es** el criterio de cierre de la beta. El criterio es §13 del
backlog y tiene **cinco** puntos que deben ser verdad **a la vez, sobre un mismo SHA**. Esto es lo
que mide cada uno hoy, para que la decisión de cerrar o no sea del operador con números, no con
sensación.

| # | qué pide | medido | dueño de lo que falta |
|---|---|---|---|
| **1** | Todos los `DEC-*` con acta | ⚠️ **13 DEC en la tabla, ninguno marcado abierto** — pero el ✅ no se puede leer del acta: el acta dice lo contrario en `:44` y `:98` (29/09, más nuevos que la fila del 21/09 que se cita acá), y el sello de acción sobrevive como **excepción clase `logotipo` sin firma** contra el «sin excepción firmada» de `DEC-11`. Ver `H-DEC11ACTAVIEJA` y `Auditorias/2026-10-08-punto-1-del-criterio-13-…md` | **operador** (la firma) + planificación (retirar el bloque vencido del acta) |
| **2** | Todos los `BL-*` de las familias de la beta cerrados con su DoD | ⚠️ **inmedible desde los checkboxes, medido con el instrumento.** El backlog tiene **212 checkboxes sin tildar**, y hoy quedó probado que **miente por atraso** (`A7` hecho desde julio con su fila diciendo lo contrario). `inventario-ola.sh` sobre las 4 olas da **10 filas problemáticas**, y al clasificarlas el residuo real son **4** (ver abajo) | ver la tabla del residuo |
| **3** | La matriz de pantallas re-medida (`BL-Q5`) ✅ en web y mobile para los **54 ids spec** | 🔴 **NO HECHO.** La matriz sólo existe en su versión del **16/09** (`Auditorias/2026-09-16-mapa-de-pantallas-vs-codigo-web-y-mobile.md`), nunca republicada con veredictos nuevos. Ningún PR cita `BL-Q5` (400 títulos, con límite de palabra) | **contrato bajado el 08/10**; lo tomó FRONTEND-2 al terminar la sesión de AUDITORÍA |
| **4** | `smoke_beta_e2e.py` en verde contra prod + durabilidad (`BL-B1`) | ✅ **CUMPLIDO 2026-10-08.** La causa que esta fila citaba (import por stdin) estaba **vencida**: se arregló el 07/10 (#908). Lo que seguía roto era que `run-smoke-prod.sh` no exportaba `UC_LOGIN_CONTRATO_PATH` (contrato nuevo del #926) ⇒ lo cerró el **#932** (`c5727e5d`, 13:04Z). **Verificado por auditoría:** prod vivo = `92fd8a06` (`GET /healthz`, arrancado 13:15Z) y `c5727e5d` **es ancestro** de `92fd8a06` ⇒ el proceso vivo **contiene** el fix. Smoke **39/39 · 7/7 críticos · 0 `[FAIL]`** + durabilidad post-restart **8/8**: evidencia de **backend** (su `cierre_` de hoy, log completo en el VPS) | — |
| **5** | Un tester **externo** completa el flujo en su propio teléfono, con video | 🔴 **no depende de ninguna sesión** | **operador** |

### El residuo del punto 2 — 4 filas «citadas, pero con una mitad sin diff»

`inventario-ola.sh` distingue «no citada» de «citada con una mitad sin diff», y es la segunda la que
importa: un PR nombra el id pero un lado no tiene cambios, que es la firma de un ítem entregado a
medias.

| fila | la mitad sin diff | PR que la cita |
|---|---|---|
| `BL-B3` | BACKEND | #601 |
| `BL-B5` | BACKEND | #600 |
| `BL-Q1` | FRONTEND | #612 |
| `BL-Q3` | BACKEND + FRONTEND | #692, #623 |

De las **10** que el instrumento marca, las otras 6 están explicadas y **no son deuda**:
`BL-O3` · `BL-O4` · `BL-O9` son **familia O, excluida de la beta por el Cierre B del acta** ·
`BL-Q2` **es** el smoke del punto 4, ya contado ahí · `BL-C5` tiene **DoD invertido** (el código
declara la decisión contraria, fechada) ⇒ su mitad sin diff es correcta.

> 🚨 **Estas 4 filas NO se asignan sin verificarlas una por una, y esto no es cautela: es la
> lección que este mismo doc pagó hoy.** «Una mitad sin diff» **no prueba** que el trabajo falte: el
> instrumento cruza los PR **que citan el id**, y por orden del operador **los PR se batchean sin
> citar ids** — el #521 cerró cuatro filas sin nombrar ninguna. El control obligatorio, antes de
> escribir cualquier contrato sobre ellas:
>
> ```bash
> git log --oneline -3 origin/main -- <el archivo de la mitad que figura sin diff>
> ```
>
> Hoy omití exactamente ese control con `A3` y frontend-1 reimplementó trabajo de julio. Dos
> señales erróneas apuntaban al mismo lado — el tablero decía «sin commit» (era falso) y mi
> medición miró el hook equivocado — así que **ninguna contradicción me avisó**.
> Ver `el-contrato-que-manda-a-hacer-algo-ya-hecho` y `dos-causas-suficientes-el-test-no-atribuye`.

### Qué se sigue de esto, sin adornos

**La beta no cierra hoy, y la razón no es código.** Dos de los cinco puntos **se cerraron hoy** —el
**2** (auditoría, #937: el residuo de 4 filas da 0 asignables) y el **4** (backend, #932 + smoke
39/39 contra el prod vivo)—. De los tres que quedan, **ninguno espera una línea de código de
producto**: el **5** es del operador; el **3** es la mitad **mobile** de la matriz, que es tanda de
**device** y está diferida por su orden del 22/09 (`:91` de este mismo doc); y el **1** espera una
**firma** suya sobre la excepción del sello. El punto 2 pasó de «inmedible» a **4 filas nombradas** y
de ahí a **cero asignables**, que es la primera vez que ese punto tiene un número cerrado.

⚠️ **Los puntos 2 y 4 llegaron a ✅ el mismo día en que este doc los declaraba 🔴, y sus filas rojas
citaban causas ya vencidas.** Un doc de cierre no envejece en semanas: envejece en **horas**. El
estado de cada punto se re-mide **al declarar**, no al planear.

## Cuándo está cerrado

Las 6 filas de arriba mergeadas, con su DoD cumplido y el recibo de `scripts/gate.sh` citado por su
SHA. **Un PR por sesión, no uno por fila**: el costo dominante de la noche del 06/10 no fue escribir
el código, fue pagar el gate ocho veces y desviarse entre corridas.
