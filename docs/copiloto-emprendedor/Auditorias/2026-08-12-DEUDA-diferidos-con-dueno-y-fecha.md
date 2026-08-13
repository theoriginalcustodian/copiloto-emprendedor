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
D5                         | backend            | @lote-C                                     | cerrado
D6                         | backend            | 1er sprint post-beta                        | abierto
D7                         | backend            | @lote-B                                     | cerrado
D8                         | frontend           | --                                          | cerrado
D9                         | frontend           | proximo item de frontend                    | abierto
D10                        | planificacion      | abierto/ > 40 archivos o > 5 autogenerados  | abierto
D11                        | backend+auditoria  | al modificar FORCE RLS o una policy         | abierto
D12                        | frontend           | @emision-factura-propuesto                  | abierto
E3                         | backend            | proximo deploy de codigo real por su merito | abierto
D13                        | planificacion      | --                                          | cerrado
D14                        | frontend           | --                                          | cerrado
D15                        | operador           | decision del operador, no de una sesion     | abierto
D16                        | frontend           | 3er <algo>IdAbierto en web/src/shell        | abierto
D17                        | backend            | --                                          | cerrado
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
| D5 | ~~8 endpoints AFIP/presupuestos con guard probado sólo a nivel helper/store, no por endpoint HTTP hostil~~ — ✅ **CERRADO 2026-08-13 00:39, #430** (nota: entre el hallazgo de planificación de re-diferirla `@emision-factura-propuesto` y la publicación de este cierre hubo una carrera de escritura sobre este mismo archivo — #430 ya estaba mergeado cuando se escribió esa nota; gana la evidencia del merge real, ver `gh pr view 430`) | **P2** H-2 (⚠️ decía P1 — mal etiquetada, corregida 2026-08-12 20:47 contra el informe de origen) | backend | ✅ resuelto — alcance real verificado leyendo código (no el contrato a ciegas): `POST /presupuestos/{id}/facturar` **ya tenía** adversarial HTTP; lo que faltaba eran las 6 mutaciones de factura AFIP + `POST /afip/anulaciones/{id}/confirmar` + `PATCH /presupuestos/{id}/estado`. `Espia` sumó modo `estricto` (simula el `NOT_FOUND` real de Temporal) + control positivo por par. 51/51 verde (VPS) + `gate.sh` 5/5, recibo `8a96e412c...`, dual-gate re-verificado sobre el commit real de merge 3c79b05d | Es la **misma clase** que C3 del lote C. Al escribir esos tests, extender el patrón a estos 8. **Hallazgo adicional sin resolver acá** (fuera de alcance: D5 pedía tests, no reescribir producción): las 6 mutaciones de factura llaman `signal_factura` y devuelven `{"ok": True}` sin capturar el `NOT_FOUND` — el fail-closed es real (namespacing del workflow_id), pero la respuesta es un 500 genérico del handler global en vez de un 404 específico como el GET. Queda anotado para quien lo retome |
| D6 | ~~4 uploads sin validación de magic bytes~~ — ✅ **CERRADO 2026-08-13, backend, #442** | P1 H-5 | backend | ✅ resuelto — CI 6/6 verde (backend/core/mobile/web/lint/drift), squash-mergeado a `main` | **Ya tenían cota de tamaño** (sin DoS) y nunca se persisten a disco — van en memoria a Groq/OpenAI. Sin RCE; peor caso 422/502 externo. Deploy pendiente |
| D7 | ~~`except: return False` en `mercadopago_gateway.py:119` — fail-silent. **Es el 5º `except` de D-A**~~ — ✅ **CERRADO 2026-08-12 21:00, #424** | **P2** H-4 por sí solo, pero **P1 como instancia de D-A** (Pasada 2 H-3) — corregido 2026-08-12 20:47 | backend | ✅ resuelto — el fail-closed **no cambió** (sigue `return False`); se agregó `log_error_evento` con `reason` del SDK, que distingue `SIGNATURE_MISMATCH` de `TIMESTAMP_OUT_OF_TOLERANCE` sin loguear la firma cruda. **Con esto D-A queda 5/5 y G2/G3 cierran** | Auditoría lo clasificó bien: **blind-spot de observabilidad, no vulnerabilidad**. El webhook **no es forjable** (SDK oficial, fail-closed). Es de la misma familia que los `except` del lote B |
| D8 | ~~`apps/copiloto-web/.../useChat.ts` (348 líneas) reimplementa `packages/core/src/chat/chatMachine.ts` en vez de consumirlo como hace mobile~~ — **CERRADO 2026-08-12** (test de equivalencia, no convergencia) | C6(b) | frontend | resuelto | Ver abajo |
| D9 | Flake del job `mobile` dentro de `gate.sh` completo. Tres sub-clases bajo esta fila: **timeout de gesto** (✅ **CERRADA 2026-08-13** — causa raíz confirmada por experimento controlado + fix estructural + DoD del contrato cumplido: 5/5 `gate.sh` completo bajo carga forzada, cero timeouts), **EPERM cross-worktree de caché** (✅ **CERRADA 2026-08-12**, causa raíz + fix estructural) y **EPERM intra-run** (🆕 hallada 2026-08-13, mecanismo DISTINTO de la cerrada arriba, sigue abierta, oportunista) | campo (frontend, 2026-08-12) → contrato `planificación→frontend` (2026-08-13) | frontend | -- (EPERM intra-run: oportunista, sin disparador contable todavía) | ver detalle abajo |
| D10 | El janitor **nunca archiva** las alertas que el escalador autogenera (`urgente_vigilancia-a-*`), porque `urgente_` es ancla por diseño ⇒ toda alerta resuelta queda en `abierto/` para siempre | campo (planificación, 2026-08-12) | planificación | `abierto/` > 40 archivos, **o** > 5 autogenerados | Hoy son 2 sobre 26: **no es problema de volumen todavía**. Ver abajo |
| D11 | **Los 2 adversariales de C3 (lote C) NO aíslan el guard app-side** — al remover el filtro `WHERE cliente_id` del `UPDATE`, el test sigue **verde** porque RLS `FORCE` lo tapa como 2ª barrera. Verifican el sistema (A no toca B), no cuál capa lo garantiza | Fase D lote C (auditoría, 2026-08-12) | backend + auditoría | **al modificar `FORCE ROW LEVEL SECURITY` o la policy de cualquier tabla con guard app-side** | Defense-in-depth = seguro hoy; deuda de **cobertura**, no de función. Ver abajo |
| **D13** | ~~**El instrumento nuevo (`deuda-check.sh`) está en `main` pero no corre**~~ — ✅ **CERRADO 2026-08-12 21:20.** Se escribió en un worktree y nunca llegó al **checkout compartido**, que es desde donde los crones ejecutan `vigilancia-check.sh`; y el registro tampoco está en ese working tree | campo (planificación, 2026-08-12) | planificación | ✅ resuelto — fallback a `git show origin/main:<path>` para leer el registro + los dos archivos copiados al checkout que corre. Control positivo **end-to-end ahí**: exit 1 nombrando la fila | Ver abajo: la **primera causa que escribí era falsa** y la medición la desmintió |
| D12 | **Web sólo tiene 1 de las 5 cards `*_propuesto` que mobile tiene desde el hito 8** (`presupuesto_propuesto`, cerrada en e2e §G6; faltan `gasto_propuesto`/`cliente_propuesto`/`ingreso_propuesto`/`factura_propuesto`) | e2e §G6 (frontend, 2026-08-12) | frontend | **cuando se confirme que backend emite `card: {kind: '<x>_propuesto', ...}` hacia web para alguna de las 4 restantes** (grep de `card.kind` en una respuesta real de `/reply`, no suposición) | **2026-08-13, backend — actualización empírica, `factura_propuesto` (código real: `factura_propuesta`, sólo esa card):** el código YA existe en ambos lados — `apps/copiloto/tool_catalog.py:1401` emite `Artifact(kind="factura_propuesta", ...)` (hito 9, `emitir_factura`) y `packages/core/src/chat/facturaPropuesta.ts` ya lo consume (`leerFacturaPropuesta`). Pero `scripts/e2e_hito9_facturar_por_voz.py` corrido contra el VPS real (no suposición) da **2 de 5 puntos del DoD rotos**: dictando "facturale a Juan un service de PC por 50000, consumidor final" (ambos campos `required` del tool schema presentes), el LLM **nunca invoca la tool** — sigue preguntando en lenguaje natural por el CUIT/DNI del cliente en vez de armar el borrador con lo que ya tiene. Mismo síntoma en la continuación (2º dictado idéntico): no encuentra/reusa el borrador abierto, repregunta distinto cada vez. **No es un problema de conexión backend↔web** (la costura ya está armada y probada a nivel unitario, `test_facturar_por_voz.py:157`) — es el LLM del ReAct no disparando la tool en el momento esperado. Evidencia cruda + hipótesis en el buzón (`hallazgo_backend-a-todos_hito9-facturar-por-voz-el-LLM-no-llama-la-tool.md`). Sigue **abierto**: no hay card real para que web consuma todavía. `gasto_propuesto`/`cliente_propuesto`/`ingreso_propuesto` (los otros 3 del disparador) NO se re-verificaron en este pase — el código los emite (`tool_catalog.py:725/798/1072`) pero ninguno se ejerció end-to-end acá; no asumir que están sanos sólo por existir en el código, el mismo hallazgo de arriba aplica en potencia a cualquiera. **2026-08-13, backend — §5.3 corrido 5 veces, confound identificado (no es determinismo del LLM ni ruido):** el tenant de prueba `e2e-device` **no tiene perfil AFIP cargado** — `AfipCredentialStore(e2e-device).primer_cuit()` da `cuit=None` en 8/8 lecturas directas a la DB, sin flapping. Con `cuit=None`, `tool_catalog.py:1221-1227` (`_run_emitir_factura`) valida el perfil del PROPIO tenant antes de mirar el dictado y responde siempre "cargá tus datos fiscales" — eso pasó en 3/5 corridas y **es correcto, no un bug**. Las otras 2/5 (pregunta por el CUIT/DNI de Juan) no pueden venir de esa rama con `cuit=None`, así que ahí sí se sostiene el hallazgo original: el LLM nunca invocó la tool. Los 3 spikes previos de backend (prompt aislado, perfil+multiturno, memoria) eran estructuralmente ciegos a este confound — nunca ejecutaron `_run_emitir_factura` real. **Antes de volver a medir esto hace falta cargar un perfil AFIP válido en `e2e-device`**; recién ahí "sin card" pasa a significar sólo "no invocó la tool", sin la ambigüedad de hoy. Fuente: `dato_backend-a-todos_5-3-corrido-5-veces-el-tenant-no-tiene-perfil-AFIP-confunde-el-resultado.md`. **2026-08-13, backend — causa raíz exacta en código, no hipótesis, y fix parcial (PR #444):** con el tenant `e2e-device` ya con perfil AFIP cargado, la corrida real (5 pasadas del e2e completo) da **§5.2 5/5 roto Y §5.3 5/5 roto** — determinista, sin el confound de perfil. Leyendo `motor/backend/agent/conversation_workflow.py:546-590` (`_react_loop`): existe un retry con `tool_choice="required"` para forzar la tool call, pero está scopeado a `_narra_completitud(content)` (línea 734) — sólo detecta MENTIRAS de completitud ("ya lo anoté"), nunca preguntas honestas. Una repregunta por un campo opcional no dispara el guardrail. Fix aplicado: `EMITIR_FACTURA_SCHEMA["description"]` ahora dice explícitamente que hay que llamar con los 2 campos mínimos y dejar que la tarjeta pida el resto — sin tocar `SYSTEM_PROMPT_REACT` ni el loop compartido (blast radius acotado a esta tool). Esto ataca §5.3 (dictado completo, preguntaba por CUIT/tipo doc que ya son opcionales). **§5.2 NO queda resuelto por este fix**: ahí `items` es genuinamente REQUIRED y falta — el DoD pide que la 2ª repetición del mismo mensaje incompleto escale a card en vez de repreguntar, que es una decisión de UX del `_react_loop` COMPARTIDO por todas las tools (blast radius alto) — reportado aparte como ítem de diseño nuevo, no resuelto en modo autónomo. Pendiente: re-correr el e2e real (Run B, 2 corridas) post-deploy para confirmar §5.3 en 0/5 y decidir si D12 cierra parcial (sólo §5.3) o si `factura_propuesto` sigue `abierto` por §5.2. Fuente: `dato_backend-a-todos_D12-causa-exacta-encontrada-el-guardrail-required-no-cubre-preguntas-honestas.md`. **2026-08-13, backend — planificación confirma alcance (`respuesta_planificacion-a-backend_5.2-queda-fuera-segui-con-5.3.md`): §5.2 queda fuera de este fix, ítem de diseño nuevo aparte; cierre de D12 depende sólo de §5.3.** Run B-1 post-deploy: §5.3 y §5.4 pasan limpio (§5.2 falla distinto — ahora SÍ llama la tool, pero adivina `descripcion:"servicio"` como placeholder; consistente con el fix atacando exactamente lo esperado). Run B-2 (corrida ~inmediatamente después de B-1, mismo tenant `e2e-device`) dio 3 fallas nuevas — **no es regresión del fix ni no-determinismo del LLM**: `VENTANA_DICTADO_ABIERTO = timedelta(minutes=15)` (`web.py:375`) busca el borrador abierto por **`cliente_id` (tenant), no por `session_id`** (`make_buscar_borrador_dictado_abierto`, `web.py:379-408`) — Run B-2 heredó el borrador que Run B-1 dejó abierto silencioso en su propio §5.1, contaminando §5.1/§5.2/§5.3 de B-2 con estado de la corrida anterior (de ahí el `faltantes: ['fecha_servicio_faltante']` triplicado en §5.3-B2: son 3 errores R6 distintos —`fecha_servicio_desde`/`fecha_servicio_hasta`/`fecha_vto_pago`— que comparten el mismo `codigo`, no una triplicación real; `afip_rules.py:423-440`). **Hallazgo colateral, no de D12: el propio e2e (`scripts/e2e_hito9_facturar_por_voz.py`) no es válido para "2 corridas separadas" corridas con menos de 15 min de por medio contra el mismo tenant** — cualquier futura verificación de este hito necesita esperar la ventana o variar de tenant. Pendiente: Run C limpia (>15 min desde el borrador abierto de B-1) antes de declarar §5.3 cerrado con evidencia no contaminada. **2026-08-13, backend — Run C (limpia) descubre un 2º bug real, distinto del primero, fix aplicado (PR #446):** con >15 min de por medio, §5.3 vuelve a fallar pero con síntoma DISTINTO al de PR #444 — el LLM ahora sí evalúa `concepto=servicios`, pero en vez de armar la card pregunta en lenguaje natural por el período del servicio (`fecha_servicio_desde`/`hasta`/`fecha_vto_pago`, exigidos por R6, `afip_rules.py:400-453`). Causa raíz: `EMITIR_FACTURA_SCHEMA["parameters"]` (`tool_catalog.py:264-295`) **nunca expone esos 3 campos como parámetros de la tool** — el LLM no tiene forma de pasárselos aunque quisiera, así que en vez de invocar la tool igual (como el fix de §5.3 original ya le decía para el resto de los campos opcionales) se pone a preguntar por algo que la tool ni siquiera acepta. Mismo patrón de fix que el primero, mismo blast radius acotado: se agregó una cláusula a la `description` del schema aclarando que el período de servicio y el vencimiento **tampoco son parámetros de esta tool**, así que no hay que preguntarlos — si AFIP los exige, la tarjeta los va a pedir con campo editable igual que cualquier otro faltante. 102 tests verdes (VPS), PR #446 mergeado y deployado a producción. **2026-08-13, backend — Run D (post-deploy del 2º fix, >15 min después) — evidencia mixta, con lectura:** §5.1 OK. §5.2 sigue roto (esperado, confirmado fuera de alcance por planificación). §5.3: **el síntoma raíz queda confirmado resuelto** — el LLM ahora SÍ llama la tool para "un service de PC por 50000" (antes preguntaba en lenguaje natural, `card=None`; ahora entrega `kind=factura_propuesta` con `faltantes=['fecha_servicio_faltante']×3`, tal como el fix promete). Pero el bar literal del script (`faltantes==[]`) sigue sin cumplirse, por DOS razones que NO son regresión: **(a)** el texto de prueba nunca dicta fechas de servicio, y R6 las exige siempre que `concepto=servicios` — ningún dictado sin esas fechas puede dar `faltantes==[]`, es una regla de negocio dura, no un bug de código; **(b)** evidencia dura de contaminación cruzada DENTRO de la misma corrida: el `factura_id` que devuelve §5.3 es **idéntico byte a byte** al que devolvió §5.2 (mismo sufijo de sesión, pese a usar `session_id` distintos) — §5.3 no abrió borrador propio, continuó el que §5.1/§5.2 dejaron corriendo para el mismo `cliente_id` (mismo bug de `VENTANA_DICTADO_ABIERTO` ya documentado en Run B-2, ahora confirmado que también contamina *dentro* de una sola corrida del script, no sólo entre corridas separadas). **Conclusión: D12 (el bug que motivó el hallazgo — LLM no invoca la tool) está resuelto y evidenciado en las dos iteraciones.** El criterio "§5.3 5/5 con faltantes==[]" tal como está escrito en `scripts/e2e_hito9_facturar_por_voz.py` es estructuralmente inalcanzable con ese texto de prueba — no mide más regresiones de D12, mide una limitación del propio DoD/script. Recomendación (no ejecutada unilateralmente — el bar "5/5" lo fijó planificación): o bien el texto de §5.3 dicta también el período de servicio (mide un "completo" real), o el criterio de aprobación para `concepto=servicios` pasa a "card con `faltantes` limitado a `fecha_servicio_*`" en vez de vacío. Reportado al buzón. |
| ~~D14~~ **CERRADA 2026-08-13** | **`TarjetaClientePropuesto` en web: el caso `ya_existe` no lleva a ningún lado.** Se difirió como *«¿traemos un router a web?»* — una decisión MAYOR. **La premisa era falsa y la desarmó frontend con path:línea:** `AppShell.tsx:97/168-169` y `DesktopShell.tsx:77/110-111` ya abren una entidad por id en producción (`onAbrirTicket={setTicketIdAbierto}`), **en el mismo archivo donde `onAbrirCliente` descarta el id** (4 call sites: `AppShell` 183 y 208, `DesktopShell` 123 y 148). Y `ClientesScreen.tsx:111-115` ya tiene `abrirDueno(id)` → `obtenerCliente(id)` → `setFicha`, con `GET /clientes/{cliente}` servido desde `apps/copiloto/clientes_web.py:194`. No falta mecanismo ni endpoint: falta enhebrar el id | hallazgo (frontend, 2026-08-12) · disparador cumplido y verificado (2026-08-13) | frontend | **cumplido** | **No era deuda diferida: era trabajo táctico mal clasificado por mí.** Bajó como `contrato_planificacion-a-frontend_D14-es-tactico-tuyo-el-mecanismo-ya-existe-y-abrirDueno-tambien`, con DoD de 6 puntos. Lo que quedaba de MAYOR se convirtió en D16, con disparador contable |
| D15 | **21 directorios en `.claude/worktrees/` que git ya no registra.** Perdieron su archivo `.git`; `git worktree prune` los sacó del registro sin tocar el directorio (por diseño). Son 39 en disco contra 21 registrados. Descubiertos al construir `scripts/podar-worktrees.sh` | campo (planificación, 2026-08-13) | **operador** | **decisión del operador** — `decision_planificacion-a-operador_21-directorios-huerfanos…` en `abierto/`, con las 3 opciones y la recomendación | **No se puede afirmar que estén vacíos de trabajo**: sin su `.git`, cualquier comando git que corra ahí responde por el checkout principal. Borrar 21 directorios sobre esa duda no es decisión de un script de higiene — el costo de equivocarse es asimétrico y el beneficio es disco. Nombres de frentes cerrados (`d7-*`, `lote-b/c`, `verif-c4-post-merge`) |
| D16 | **El shell de web resuelve «abrir X por id» con un `useState` ad-hoc por entidad.** Con una entidad (ticket) es prior art sano; con dos (más cliente, D14) sigue siendo la opción correcta — no se justifica traer react-router. **Con tres deja de serlo y nadie lo nota en el momento:** se agrega «un `useState` más» y el shell termina siendo un router escrito a mano, peor que el importado, duplicado además en los dos shells | decisión de diseño al cerrar D14 (planificación, 2026-08-13) | frontend | **al aparecer un 3er `<algo>IdAbierto` en `apps/copiloto-web/src/shell/`** — contable: `git grep -ho "[a-zA-Z]*IdAbierto" -- apps/copiloto-web/src/shell/ \| sort -u` (hoy da 1; con D14 dará 2, que es lo esperado y no dispara nada) | **El disparador es un comando, no una intuición.** D14 se difirió con un disparador en prosa (*«cuando aparezca un 2º lugar»*) y estuvo cumplido sin que nadie se enterara hasta que se salió a buscarlo a mano — la misma falla que este registro existe para impedir |
| D17 | ~~El smoke de prod se reportó como `34/35` y nadie escribió cuál es el 1 que falla.~~ — ✅ **CERRADO 2026-08-13, backend.** Corrida real contra prod (`smoke_beta_e2e.py`, VPS, venv real, mismo patrón de siempre): **`total=37 pass=37 fail=0`, sin línea `FALLARON:`** (no imprime — `if fails:` es falso). El `34/35` de G8 no reproduce hoy; no hay evidencia de qué check era el 1 que faltaba en esa corrida vieja, pero el estado actual es 37/37 verde, verificado, no citado de memoria | auditoría del informe de cierre (planificación, 2026-08-13) | backend | -- | **Un rojo sin nombre no puede tener dueño ni disparador.** Es exactamente el estado que el DoD §0 llama «Documentado» y niega como terminal — resuelto re-corriendo el instrumento en vez de re-citar el número viejo |

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

### Sub-clase EPERM/caché — CERRADA (frontend, 2026-08-12) — causa raíz distinta de la de arriba

Backend reportó un síntoma **distinto** al de timeout (lote C, `avance_backend-a-todos_lote-C-C1-C2-C3-cerrado.md`):
`mobile` falló en el gate completo con `EPERM` de Windows leyendo
`jest-transform-cache/.../NativeAnimatedAllowlist_...`, sin tocar `apps/mobile/` en su diff, y pasó
731/731 aislado — mismo discriminador de siempre (aislado verde ⇒ flake), pero un patrón de error
(`EPERM` sobre un archivo puntual) que no encaja con "timeout de gesto bajo contención".

**Causa raíz verificada, no supuesta:** `npx jest --showConfig` en dos worktrees distintos
(`deuda-d9` y `cards-propuesto-web`) resolvía el **mismo** `cacheDirectory` byte a byte —
`<tmp del SO>/jest`, sin scopear por `rootDir` ni por proyecto. Con ~20 worktrees y 3 sesiones
paralelas corriendo `apps/mobile` sobre el mismo Windows, dos procesos concurrentes escriben el
mismo archivo de transform-cache (mismo paquete, mismo hash de contenido) y el SO devuelve `EPERM`
en la carrera — mecánica determinística, no un supuesto de contención.

**Fix de raíz, no retry:** `apps/mobile/jest.config.js` ahora fija `cacheDirectory` a
`<rootDir>/node_modules/.cache/jest` en ambos proyectos (`native`/`web`) — cada worktree cachea en
su propia carpeta, así que dos sesiones ya no pueden pisarse el mismo archivo. Verificado: el
`cacheDirectory` resuelto post-fix es distinto por worktree; `mobile.sh` 730/731 (1 skip
preexistente) sobre el fix; `gate.sh` completo 5/5 sobre el commit real.

**Qué NO cierra esto — importante no confundirlo:** la sub-clase de `Exceeded timeout of 5000ms` en
tests de gesto (`PantallaSoporte`/`ChatView`/`Onda.test.tsx`, hipótesis H1/H2 de arriba) es un
síntoma **distinto**, sin relación mecánica con el cache de Jest. Sigue exactamente donde la dejó la
sesión anterior: freno deliberado, captura oportunista, sin cerrar. Este fix no la toca ni la
descarta — sólo elimina una fuente de falsos rojos que hasta ahora se contaba mezclada en el mismo
conteo de "apariciones de D9".

### Cierre de la sub-clase timeout — frontend, contrato D9 (2026-08-13)

**H1 (contención de CPU) confirmado por experimento controlado, no por correlación.** Se aisló la
variable que las corridas anteriores dejaban mezclada con el ruido de fondo: 10 corridas de
`bash scripts/ci/mobile.sh` sin carga deliberada (sólo el basal de ~49-53 `node.exe` de otras
sesiones paralelas) contra 10 corridas idénticas en código y plataforma, con 4 procesos
`node -e "while(true){ Math.sqrt(Math.random()); }"` forzados encima. Resultado: **0/10 sin carga
extra, 2/10 con carga extra** — el único diff entre las dos series es la CPU disponible en el
instante del test, así que la contención (H1) queda confirmada y H2 (Windows vs Linux) descartada
como explicación única, porque la plataforma fue idéntica en ambas series.

**Fix estructural aplicado, no otro parche puntual:** la re-verificación bajo la MISMA carga forzada
mostró que el default de Jest (5000ms) es frágil para *cualquier* test de montaje pesado de esta
suite bajo contención real — no sólo los dos describes de gesto de voz ya conocidos. Fallaron con
`Exceeded timeout of 5000 ms` tres archivos sin relación con voz (`PantallaInteligencia`,
`PantallaIngresos`, `PantallaPresupuestos`), generalizando lo que `Onda.test.tsx` ya había mostrado
de forma oportunista (línea 247 arriba). Por eso el fix va al nivel de config, no al de archivo:
`apps/mobile/jest.config.js` fija `testTimeout: 20000` a nivel raíz de `module.exports` (4x el
default), y los dos describes de gesto de voz (`PantallaSoporte.test.tsx`, `ChatView.test.tsx`)
mantienen su override específico en `30000ms`, porque ese valor puntual sí se re-verificó bajo carga
forzada (10/10 limpio) y el `20000` global todavía no se sometió a esa misma carga extendida al
resto de la suite.

**Error propio en el primer intento, dejado documentado en el código para que no se repita:** la
primera versión del fix puso `testTimeout` DENTRO de cada entrada de `projects[]` (`native`/`web`).
Jest lo acepta sin error de sintaxis pero lo **ignora en runtime** — `testTimeout` es una opción de
`GlobalConfig`, no de `ProjectConfig` — y sólo se detectó releyendo el log completo de la
reverificación (no asumiendo que "ya está aplicado" porque el archivo se había editado):
`● Validation Warning: Unknown option "testTimeout" with value 20000 was found` en las 10 corridas,
con los timeouts todavía reportando literalmente "Exceeded timeout of 5000 ms" — el default sin
tocar. Corregido moviendo `testTimeout` a la raíz de `module.exports`; `npx jest --showConfig`
confirmó la resolución correcta antes de gastar otra corrida de 30-45 min, y la 3ª verificación dio
**10/10 limpio, cero apariciones de timeout**.

**Hallazgo nuevo, distinto del EPERM cross-worktree ya cerrado arriba:** en la serie "sin carga
extra" apareció una vez un `EPERM` escribiendo el mismo archivo de transform-cache para
`SafeAreaProviderCompat` (dependencia de `expo-router`) — pero esta vez DENTRO de la misma corrida,
entre los proyectos `native` y `web` de Jest compitiendo por el mismo `cacheDirectory` compartido
(el fix de la sub-clase cross-worktree scopeó por worktree, no por proyecto dentro del mismo
worktree). Mecanismo distinto, mismo síntoma de superficie — **sigue abierto**, no se investigó a
fondo ni se le aplicó fix en este ciclo por estar fuera del alcance del contrato D9 (que acotaba a
la sub-clase timeout). Frecuencia observada: 1 aparición en ~30 corridas de `mobile.sh` en este
ciclo.

**DoD del contrato, cumplido (frontend, 2026-08-13, mismo ciclo):** 5 corridas consecutivas de
`bash scripts/gate.sh` COMPLETO (no sólo `mobile.sh`), con los mismos 4 procesos de CPU forzada
sostenidos vivos durante toda la ventana (no relanzados por corrida), SHA constante
`935026a086d32df7d050241a20c94ddc7cdedb5`, log íntegro por corrida a
`scratchpad-d9/d9-dod-gate-{1..5}.log`. **5/5 limpias**: `exit=0`, `"✅ TODOS los jobs OK"`, job
`mobile` en verde las 5 veces (35-52s, 731/732 tests), **grep de `"Exceeded timeout|EPERM"` sobre
las 5 logs juntas: 0 ocurrencias**. `git status --short` al cierre de la verificación: sólo los 3
archivos del fix + el registro de deuda (este archivo) modificados, más `scratchpad-d9/` sin
trackear — nada bajo `apps/` tocado fuera de los 3 archivos ya descriptos.

**Cierre de la sub-clase timeout:** causa raíz confirmada + fix estructural aplicado + verificado
10/10 en `mobile.sh` aislado + **DoD del contrato cumplido, 5/5 `gate.sh` completo**. Sub-clase
✅ **CERRADA**. La sub-clase EPERM intra-run (hallazgo nuevo de este mismo ciclo, ver arriba) queda
fuera de este cierre — sigue abierta, oportunista, sin disparador contable propio todavía.

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
