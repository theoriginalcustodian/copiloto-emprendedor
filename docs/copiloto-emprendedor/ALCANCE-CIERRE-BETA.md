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

Medido contra `origin/main` `d030c359`, no contra el plan del 06/10. **Tres de las ocho filas ya
estaban resueltas cuando se escribió la lista**, y una de ellas lo estaba desde julio. Esto se
registra acá y no borrando la fila, porque el gate lee los ids del bloque de arriba: una fila
borrada invalidaría los commits que la citan.

| id | veredicto | evidencia |
|---|---|---|
| `A3` | 🔴 **FALTA** — es lo único de código que queda | `SeccionMisComprobantes.tsx:50` ya tiene `anulacionEnCursoDe()`, que **es** el guard B (id derivado `anulacionIdDe`, misma fórmula que `web.py::make_iniciar_anulacion`; 404 = «no hay»). Pero el `useEffect` de carga (`:135`) sólo llama `cargar()` y **nunca lo consulta**: al recargar, `objetivoAnulacion` vuelve a `null`, `esAnulable(c) && !esteEsElObjetivo` da `true` y **«Anular» reaparece** sobre una anulación en curso. El fix **reutiliza** esa función; no se diseña nada. |
| `A5` | ✅ **HECHO** | Commit `36e3d906` (06/10, #801) «la card HITL resuelta se muestra como Recibo (BL-F1, mobile)». Mobile: `ListaMensajes.tsx:28` importa `Recibo` y lo renderiza en `:107`; `:331` cita «(A5)». Web: `HitlCard.tsx`. **Las dos apps cableadas.** |
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
<!-- HALLAZGOS-DIFERIDOS:FIN -->

## Cuándo está cerrado

Las 6 filas de arriba mergeadas, con su DoD cumplido y el recibo de `scripts/gate.sh` citado por su
SHA. **Un PR por sesión, no uno por fila**: el costo dominante de la noche del 06/10 no fue escribir
el código, fue pagar el gate ocho veces y desviarse entre corridas.
