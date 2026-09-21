# Auditoría A1 — Ola 1 de la beta Odobi @ `fc583792` (2026-09-21)

> Sesión AUDITORÍA (Fable), contrato A1 de planificación. Alcance: `main` @ `fc583792`, 36 PR (#514–#552), 21 filas entregadas.
> Método: gate y tests adversariales **corridos** en un worktree detached con triada propia; DoD medido criterio por criterio (sub-agentes sonnet para el barrido, citas `ruta:línea` verificadas mecánicamente, juicio y correcciones en el hilo principal). Auditoría no abre trabajo: cada hallazgo es una fila para que planificación la asigne.

## 0. Veredicto

**La Ola 1 NO cierra en `fc583792`.** De las 21 filas entregadas: **7 NO CIERRA**, **14 CIERRA_SALVO_DEVICE**, **0 CIERRA** (ninguna fila táctil trae evidencia de device; el móvil está retenido por el operador). El SHA pasa el gate 5/5 y los controles de aislamiento de la ventana están verificados por test **corrido** (§1). Las 7 costuras miradas cierran (§2).

## 1. Gate y adversariales en `fc583792` — corridos, no leídos

### 1.1 Dos tandas, mismo SHA, mismo worktree

| Tanda | Hora local | Condición | Resultado |
|---|---|---|---|
| 1 (`a1-gate-full.log`) | 15:12–15:15 | 10 sub-agentes `claude -p` corriendo en paralelo en esta PC | **core ok** (38 archivos), **web ok** (101 archivos), **mobile failed** (`EPERM` en la cache de jest, líneas 1971 y 3587; 846 passed), **lint failed** (fallo de `fork` de Cygwin, línea 3780; eslint 0 errores / 30 warnings), **backend failed** (fallo de `fork` antes del ssh, líneas 3787–3789) |
| 2 (`a1-gate-backend.log`, `-mobile.log`, `-lint.log`) | 15:27–15:30 | Nada más corriendo | **backend ok** (`1957 passed, 26 skipped` en 56,5 s), **mobile ok** (`857 passed, 1 skipped`), **lint ok** (0 errores / 30 warnings) |

Los cinco jobs verdes sobre `fc583792` → el SHA de la ola pasa el gate. Los tres fallos de la tanda 1 no son del código: son del instrumento bajo carga (§4.3).

### 1.2 Controles de aislamiento de la ventana — todos `VERIFICADO_POR_TEST` y con `PASSED` en el log

| PR | Control | Test adversarial (nuevo en la ventana) | Línea del log del backend con PASSED |
|---|---|---|---|
| #522 K-01 | `idem_key` no cruza tenants | `apps/copiloto/tests/test_presupuesto_store.py:134` `test_K01_la_misma_clave_en_otro_tenant_NO_colisiona_ni_devuelve_lo_ajeno` | 1579 |
| #538 K-02 | A no fija el CUIT vinculado de B (Postgres real, RLS FORCE) | `apps/copiloto/tests/test_afip_cuit_vinculado_pg.py:44` `test_ADVERSARIAL_A_no_toma_prestado_el_CUIT_vinculado_de_B` | 219 |
| #540 K-03 | variación de A no usa el mes anterior de B | `apps/copiloto/tests/test_inteligencia_queries.py` `test_K03_la_variacion_de_A_no_usa_el_mes_anterior_de_B` (+ preexistente `:272` `test_aislamiento_A_no_ve_los_ingresos_de_B`) | 1225, 1231 |
| #542 K-04 | `agregados_este_mes` no cuenta los de B | `apps/copiloto/tests/test_cliente_store.py:104` `test_K04_aislamiento_A_no_cuenta_los_derivados_de_B` | 657 |
| #552 K-09 | la caída de B no se ve desde A | `apps/copiloto/tests/test_conexion_caida.py:122` `test_la_caida_de_B_no_se_ve_desde_A` | 813 |
| #546 K-05, #547 K-06 | no agregan control de acceso (validación de formato / función pura) | n/a — aislamiento del store preexistente `test_perfil_negocio_store.py:78` | — |

#520 no toca datos (`git show 89373be2 --stat`: sólo `deploy/copiloto/*`, `scripts/ci/*`, `scripts/gate.sh`, `scripts/test-guard-deploy.sh`).

## 2. Costuras — todas OK (campo por campo, sub-agente sonnet + citas re-verificadas)

| Costura | Backend emite | FE consume | Fixture del test FE | Veredicto |
|---|---|---|---|---|
| J6 ↔ K-04 (#541/#542) | `clientes_web.py:154` → `{"clientes","total","agregados_este_mes": int}` (`cliente_store.py:258`) | `packages/core/src/api/clientes.ts:142` `agregadosEsteMes: number \| null`; `ClientesScreen.tsx:59`, `PantallaClientes.tsx:88`; `esDeEsteMes` borrada en ambas | `clientes.test.ts:102` usa `agregados_este_mes: 7`; `:98` backend viejo → `null` | **OK** |
| J10 ↔ K-05 (#545/#546) | `perfil_negocio_store.py:54` `CAMPOS` con `telefono`, `email`; `presupuestos_web.py:56-57,92` | `packages/core/src/api/perfilNegocio.ts:46-47`; web `PantallaPerfilNegocio.tsx:297,315`; mobile `:382,391` | `perfilNegocio.test.ts:37` mismo snake_case que emite el backend | **OK** |
| J5 ↔ K-06 (#548/#547) | `mi_dia_clasificacion.py:26` tabla (categoría/criticidad/verbo, 8 reglas) | `packages/core/src/midia/filtroTablero.ts:16` `CATEGORIAS`; `miDia.ts:71`; `MidiaScreen.test.tsx:171` | `miDia.test.ts:86-108` literales idénticos (`arca`/`critico`/`Renovarlo`) | **OK** |
| J2/J3 ↔ K-03 (#539/#540) | `inteligencia_queries.py:203-215` `fecha_corte`, `variacion_pct` (string decimal o `null`) | `inteligencia.ts` → `fechaCorte`/`variacionPct`; `PortadaNegocio.tsx` web y mobile | `PortadaNegocio.test.tsx:17-32` (web), `:17-39` (mobile) | **OK** |
| D1 ↔ K-01 (#543/#522) | `presupuestos_web.py:148` `idem_key`, respuesta `{presupuesto, repetido}` | `presupuestos.ts:387` `idemKey`→`idem_key`; `TarjetaPresupuestoPropuesto.test.tsx:169-229` | sí | **OK** |
| C6 ↔ K-02 (#530/#538) | `afip_web.py:204-212` 409 `{codigo:"cuit_no_vinculado", mensaje}` | `packages/core/src/api/afip.ts:577-580` → `campo:'cuit'`; web `PantallaAfipSetup.tsx:395` `erroresPerfil.cuit` | mobile `PantallaAfipSetup.test.tsx:244-247`; **web sin test** (§7) | **OK** (costura) |
| F2 ↔ `payment_link` (#535) | `tool_catalog.py:613-615,630-632` `data={url, amount, concept}` | `packages/core/src/chat/linkDeCobro.ts` lee `url/amount/concept` | sí | **OK** — el backend **no emite vencimiento** (§6) |

## 3. Veredicto por fila (21 entregadas) @ `fc583792`

Vocabulario: **CIERRA** · **CIERRA_SALVO_DEVICE** (todo lo verificable en código cumple; falta sólo la evidencia de device/PWA, estado por defecto mientras el móvil esté retenido) · **NO CIERRA (causa: código | DoD | tests | mitad faltante)**.

### 3.1 NO CIERRA — 7 filas

| Fila | PR | Causa | Qué se esperaba (DoD) | Qué hay en `fc583792` | Prueba |
|---|---|---|---|---|---|
| **BL-B6** | #520 | DoD | «cada sesión con su triada» demostrado con **dos gates simultáneos verdes** | El código está: `scripts/ci/sesion-env.sh:32-47` (triada por `UC_SESION`), `scripts/gate.sh:19-21`; triada documentada en `coordinacion/COORDINACION.md:254`. Pero el **propio PR deja el control marcado `[~]` pendiente** («el contenedor legacy ocupa 55432 … el control de dos gates simultáneos verdes queda pendiente»). Evidencia parcial a favor, mía: el gate fe1 `d52229e7` (18:25:15–18:29:34Z, 5/5 ok) y el mío `-aud` (18:27:08–18:30:30Z) se solaparon con triadas distintas y ambos backend ok — pero el recibo guarda sólo la hora de fin, así que el solapamiento del job backend no queda probado. Observación menor: `scripts/ci/nativo-freeze.sh` (invocado en `scripts/ci/mobile.sh:7`) no tiene test propio (`grep -rl nativo-freeze scripts/tests` = 0; control positivo: B7 sí tiene `scripts/test-guard-deploy.sh`). | `wt-fe1b/.ci-recibos/d52229e7….json`; `_evidencia/…/a1-recibo-backend.json` |
| **BL-B7** | #520 | DoD (evidencia) | «verificación de hash post-deploy ejercida en un deploy real» (criterio del DoD del propio PR, el único que dejó sin marcar) | Código completo: `deploy/copiloto/guard-deploy.sh:9,25-36` (HEAD==origin/main, árbol limpio), `deploy/copiloto/sync-web.sh:88-101` (`ABORT` si bundle servido ≠ buildeado); `wt-deploy` existe detached (`C:/gfw-src/wt-deploy`). **No hay log de un deploy real que muestre la línea `[verif] hash`**: `C:/gfw-src/_ctl/deploy-k01.txt`, `deploy-k02.txt`, `deploy-k03-5.txt`, `deploy-k06-k09.txt` son resúmenes de durabilidad de BL-B1, no salidas de `sync-web.sh`. Cierra con una línea: quien deployó hoy desde `wt-deploy` (backend) pega esa salida. | `ls C:/gfw-src/_ctl/` |
| **BL-C4** | #521 | DoD | backlog l.190: «el formulario muestra el origen para los **cuatro** valores» (voz / foto / mail / manual) | El sistema tiene **tres**: `apps/copiloto/gasto_store.py:20` `ORIGENES = ("voz","manual","foto")`; `packages/core/src/api/gastos.ts:66`; `apps/copiloto-web/src/modules/gastos/FormularioGasto.test.tsx:9` prueba 3. `mail` nunca existió en el backend. El PR lo declara. **Decisión de planificación:** corregir el DoD o abrir fila backend `origen=mail`. | `grep -n ORIGENES apps/copiloto/gasto_store.py` |
| **BL-X5** | #521 | mitad faltante (backend) | backlog l.485: grep de `AFIP` en strings visibles de web **y en respuestas del agente** → 0 | **Web cierra:** gate `apps/copiloto-web/src/arcaNoAfipVisible.test.ts:1-12` (palabra suelta, identificadores exentos). **Backend no entregado:** 15 strings de código (no docstrings) con `AFIP` en 9 archivos, varios visibles al usuario: `apps/copiloto/mi_dia_orquestador.py:30,34,36` (tarjetas de Mi día: «Tu certificado de AFIP vence en…»), `apps/copiloto/afip_onboarding_workflow.py:48`, `apps/copiloto/afip_rules.py:414,438,800`, `apps/copiloto/afip_anulacion_workflow.py:168`, `apps/copiloto/afip_factura_activities.py:56,118`, `apps/copiloto/tool_catalog.py:266` (prompt), `apps/copiloto/afip_web.py:159`. Y 10 archivos de `docs/copiloto-emprendedor/kb-usuario/` (p. ej. `mi-negocio-y-afip.md` 19 hits, `facturacion.md` 15). El inventario la da por entregada por el título de #521 (§9). | `_evidencia/…/a1_afip_backend.py` (AST, sin docstrings) → `a1-afip-backend.txt` |
| **BL-D3** | #523 | código (+ DoD en `preview`) | backlog l.151: «paridad de campos con web: **ícono** + label del servicio, PARA, MONTO, badge, **preview**, aviso irreversible» | Mobile pinta un **punto genérico** en lugar del ícono del servicio: `apps/mobile/src/modules/chat/ListaMensajes.tsx:89` (`View` 8×8 color acento) vs web `apps/copiloto-web/src/modules/chat/HitlCard.tsx:67` `<ServiceIcon serviceKey=…>`; no existe componente de ícono de servicio en mobile (grep `ServiceIcon` en `apps/mobile/src` = 0). Lo demás (label, PARA, MONTO, badge, aviso + test l.152) cumple. `preview`: web lo declara (`HitlCard.tsx:26`) pero **ningún archivo web fuera de `HitlCard.tsx` asigna `preview:`**; el motor manda el preview como **texto** del mensaje (`motor/backend/agent/conversation_workflow.py:608-615`; `packages/core/src/chat/hitl.ts:77`) → ese sub-criterio es DoD desactualizado, no defecto. | `sed -n 85,93p apps/mobile/src/modules/chat/ListaMensajes.tsx` |
| **BL-C6** | #530 + #538 | tests (mitad web) | K-02 §Web l.105: «Test de componente: submit con CUIT no vinculado → error visible, formulario sigue editable» | Backend + adversarial **cumplen** (§1.2). Mobile tiene el test: `apps/mobile/src/modules/ajustes/afip/PantallaAfipSetup.test.tsx:244-263`. **Web no tiene ninguno**: `grep -rl cuit_no_vinculado apps/copiloto-web/src --include=*.test.*` = 0; no hay test bajo `apps/copiloto-web/src/modules/ajustes/afip/` (sólo `PantallaAfipSetup.tsx`). El código web sí maneja el 409 vía core (`afip.ts:577-580` → `PantallaAfipSetup.tsx:395`), pero #530 tocó sólo mobile + core (`PantallaAfipSetup.test.tsx` mobile, `afip.test.ts`, `afip.ts`, `errors.ts`). | archivos de #530 en `_evidencia/…/a1-prs.json` |
| **BL-F2** | #535 | DoD (+ mitad backend) | backlog l.320: «monto, **vencimiento** y acciones **Copiar** / Compartir» | `apps/mobile/src/modules/chat/TarjetaLinkDeCobro.tsx:34-47` monto y concepto; `:52` Compartir, `:58` Abrir; **sin Copiar** (necesita `expo-clipboard`, dependencia nativa congelada por `nativo-freeze`); **sin vencimiento porque el backend no lo emite** (`apps/copiloto/tool_catalog.py:613-615,630-632`: `data={url, amount, concept}`). El PR lo documenta. **Decisión de planificación:** corregir el DoD (Compartir cubre Copiar; vencimiento no existe en MP link) o abrir fila backend. | `sed -n 612,616p apps/copiloto/tool_catalog.py` |

### 3.2 CIERRA_SALVO_DEVICE — 14 filas (todo lo verificable en código cumple; ninguna trae evidencia de device/PWA)

| Fila | PR | Evidencia clave en `fc583792` | Nota |
|---|---|---|---|
| BL-C1 | #521 | `useConnections.ts:103-115` relee el catálogo tras el DELETE; `ConnectionsScreen.test.tsx:149-173` | — |
| BL-W2 | #521 | `ServiceCard.tsx:122-126` pinta `service.description` | clamp de 3 líneas en CSS no verificado línea a línea |
| BL-D2 | #523 | web `MicButton.tsx:246-253` (umbral 80 px, feedback antes de soltar), test `MicButton.test.tsx:186-235`; mobile `BotonVoz.tsx:39,179-186`, test `BotonVoz.test.tsx:236-244` (borde 349/350 ms) | — |
| BL-W5 | #524 | Calma N = 3 vigente (`EstadoVacio.tsx:27`); tests `calma.test.ts` | — |
| BL-W7 | #524 | chips + contador `ChipsCategoria.tsx:64`; **el test del mapeo regla→categoría ya no vive en el FE**: K-06 lo movió al backend (`apps/copiloto/tests/test_mi_dia_clasificacion.py:27`), #548 borró `categoriaTarjeta.test.ts` | DoD l.276 desactualizado (§6) |
| BL-W8 | #524 | **test aislado existe** en ambas apps: `apps/copiloto-web/src/modules/midia/PortadaNegocio.test.tsx:17-32`, `apps/mobile/src/modules/midia/PortadaNegocio.test.tsx:17-39` (los agregó #539 = `1fb38509`) | el sub-agente lo dio por ausente; corregido a mano |
| BL-C3 | #526 | `packages/core/src/chat/separadoresFecha.ts` + `separadoresFecha.test.ts` (medianoche BA); web `MessageList.test.tsx`; mobile `ListaMensajes.tsx:277-294` | el PR afirma test de «componente web y mobile»: **mobile no tiene** (`ListaMensajes.test.tsx` 0 hits de `separador`; #526 no tocó ningún test mobile) — §8 |
| BL-C2 | #527 | `TarjetaFacturaPropuesta.test.tsx`; `afip.ts:742+` normaliza `terminado` | — |
| BL-X11 | #528 | acta en el PR; logos con fuente/licencia | «avatar de Soporte» e «íconos» del backlog l.522 marcados N/A en web por acta — §6 |
| BL-W1 | #529 | `RecordingOverlay.test.tsx`, `MicButton.test.tsx` | recibo citado `61358a27` es **pre-rebase**; el head `03d578b8` no tiene recibo — §5 |
| BL-W4 | #532 | web `RodilloEjemplos.tsx:8` 4000 ms + pausa + reduce-motion; mobile `:37` 2600 ms (preexistente, 2026-09-18) + pausa + `isReduceMotionEnabled`; tests 3 web / 5 mobile (coincide con el PR) | DoD l.247 pide ~4 s **sólo en web**; la nota del sub-agente sobre mobile no aplica. Recibo citado `1df3547d` **no existe** en ningún worktree — §5 |
| BL-W9 | #537 | `packages/core/src/chat/mensajePendiente.ts` + test; `ChatScreen.test.tsx:62-67` | — |
| BL-D1 | #543 + #522 | costura OK (§2); adversarial K-01 PASSED (§1.2); mobile `TarjetaPresupuestoPropuesto.test.tsx:169-229` | el PR dice «8 tests mobile nuevos»: `git show 9048d883` agrega **7** `it(` ahí y 2 en `presupuestos.test.ts` — §8. DoD l.133 (consulta con claims anotada en el cierre) queda para el `cierre_` de la fila |
| BL-W3 | #551 | `PantallaFeedback.test.tsx` (8 tests de comportamiento); consume `/feedback` preexistente (`feedback.ts:6-7`) | «aparece en el panel admin» depende de `AdminScreen.tsx:686`, preexistente y no tocado |

**Filas fuera de las 21 pero medidas por el punto 1 del contrato:** BL-J6, BL-J10, BL-J5, BL-J2 → **CIERRA_SALVO_DEVICE** (costura OK, §2). BL-J3 → **CIERRA_SALVO_DEVICE según K-03** (`…K-03…md:49`: «`variacion_pct: null` → la portada omite el chip entero»); el backlog l.350 todavía dice «—» → DoD desactualizado (§6). Ninguna de las cinco figura en §2 del inventario (§9).

### 3.3 Las 9 fuera de alcance — ¿se entregaron igual?

| Fila | Chequeo | Resultado |
|---|---|---|
| BL-B1 | ningún PR la cita; `C:/gfw-src/_ctl/deploy-k02.txt` y `deploy-k03-5.txt` registran corridas de durabilidad con `rc=0` (`_evidencia/2026-09-21/BL-B1/durabilidad.txt` en `wt-deploy`) | **evidencia producida sin fila que la cierre** — planificación decide si eso cierra BL-B1 |
| BL-B2 | grep `workflow.patched` en la ventana: 0 nuevos (los hits son tests preexistentes) | no entregada |
| BL-B3 | `gitleaks` en `scripts/` = 0 (control positivo: `scripts/ci/no-drift.sh` sí aparece); `.githooks/pre-push` preexistente | no entregada |
| BL-B5 | ADR nuevas: 0 (`ADR-001..003` preexistentes) | no entregada |
| BL-Q2 | sólo nombrada en el cuerpo de #522 | no entregada |
| BL-O9 / BL-C5 | sin build (`_ctl/install-dev-client.txt`: 404) | no entregadas |
| BL-W6 | **entregada en #556** (`97c2653`, 18:09Z) — **después** de `fc583792` | fuera de este SHA → A2 o re-medición |
| BL-W10 | **entregada en #553** (18:03Z) — después de `fc583792` | ídem |

## 4. Clase 1 — el instrumento (gate/recibo) miente o se pisa

**4.1 `bash scripts/gate.sh --solo backend` (comando exacto del inventario, l.169) es un falso verde.** `scripts/gate.sh:23` toma el job de `$1` (`SOLO="${1:-}"`); `:38` saltea todo job ≠ `$SOLO`; `:42` corre backend sólo si `$SOLO` es vacío o `backend`. Con `--solo` no coincide ningún job → **corre 0 jobs, imprime `✅ TODOS los jobs OK` (`:72`) y sale 0**, y escribe un recibo con `"jobs":{}`. Demostrado: `_evidencia/…/a1-gate-solo-demo.log` y `a1-recibo-solo-demo.json` (18:11:09Z, `"jobs":{}`, `duracion_seg":0`). Quien siga el inventario al pie de la letra «corre los adversariales» sin correr nada. **Severidad alta.** Forma correcta: `bash scripts/gate.sh backend` (con la triada de la sesión exportada).

**4.2 El recibo se pisa en cada corrida (`scripts/gate.sh:65` `cat > "$RECIBO_DIR/$SHA.json"`).** Una corrida parcial borra el recibo completo del mismo SHA. Demostrado: corrí `backend`, `mobile`, `lint` en serie sobre `fc583792`; el recibo final dice sólo `{"jobs":{"lint":"ok"}}` (`.ci-recibos/fc5837922aa3….json`, 18:30:30Z) aunque backend y mobile habían quedado ok minutos antes (copias por job en `_evidencia/…/a1-recibo-{backend,mobile,lint}.json`). Mismo defecto visto en `wt-a16`: el recibo de `41b681eb` (#520, sesión backend) contiene sólo `{"lint":"ok"}`. Consecuencia: un recibo «5/5» que se pisa con uno parcial deja de existir, y un recibo `failed` pisado por un `ok` no deja rastro (ver 4.3). **Sospecha, no hallazgo:** creo haber visto `wt-fe1b/.ci-recibos/d52229e7….json` con `web` y `backend` en `failed` cerca de las 18:24Z; no conservé copia y hoy el archivo dice 5/5 ok a las 18:29:34Z. Lo digo como sospecha.

**4.3 En esta PC, el gate falla por el sistema, no por el código, cuando hay carga.** `_evidencia/…/a1-gate-full.log:3780` (`child_copy: cygheap read copy failed … Win32 error 299`), `:3787-3789` (`fork: retry: Resource temporarily unavailable` en `scripts/gate.sh`) → **lint failed y backend failed** con eslint 0 errores y sin llegar al ssh; `:1971` (`EPERM` en `node_modules/.cache/jest`) → **mobile failed** con 846 passed. Mismo SHA, sin carga: 5/5 ok (§1.1). Un recibo `failed` por esto es indistinguible de una regresión real (el recibo no guarda motivo), y por 4.2 la re-corrida verde lo borra. Regla que adopté: jobs del gate sólo sin sub-agentes vivos, en serie, en segundo plano.

**4.4 Cosmético:** `scripts/ci/sesion-env.sh:47` imprime `<sin sesión: defaults históricos>` cuando la triada viene exportada explícita sin `UC_SESION` (mi caso), aunque use la DB explícita (`db=copiloto-test-db-aud:55436` en la misma línea); el recibo queda con `"sesion":""`.

## 5. Clase 2 — recibos ADR-001: 7 de 27 PR de código citan un recibo del SHA que mergearon

Cruce completo (script `_evidencia/…/a1_recibos_final.py`, tabla en `a1-recibos-final.md`) de los 36 PR dentro de `fc583792` contra los `.ci-recibos/` de los 16 worktrees de esta máquina (32 recibos hallados, en `b6-ctl-fe1`, `wt-a16`, `wt-audit-a1`, `wt-fe1`, `wt-fe1b`). Con squash-merge el recibo válido es el del **head de la rama** (`headRefOid`), no el commit de merge.

| Situación | PR |
|---|---|
| Recibo del head, 5/5 ok (todos FRONTEND-1, `wt-fe1b`) | #523, #526, #527, #535, #537, #543, #551 (**7**) |
| Recibo de un commit anterior de la rama, no del head | #520 (`41b681eb`, y sólo `lint`) |
| Cita en el cuerpo un recibo que **no es el head** | #529 cita `61358a27`; head `03d578b8` |
| Cita en el cuerpo un recibo que **no existe en ninguna máquina/worktree** | #532 cita `1df3547d` (= head) |
| **Sin recibo en ningún commit de la rama** — todos los de BACKEND y FRONTEND-2 | #521, #522, #524, #525, #528, #530, #533, #538, #539, #540, #541, #542, #545, #546, #547, #548, #552 (+ #529, #532 por lo de arriba) → **20 de 27** |
| GitHub Actions | **27/27 verdes (6/6 checks)** — la «segunda confirmación» fue la única |

Afirmaciones de gate en cuerpos de PR sin artefacto cruzable: #520 («recibo verde», sin archivo), #524 y #539 («gates verdes, logs en /tmp/…»), #530 («logs completos», sin ruta), #538 («VPS: 52 passed, log `_ctl/k02-tests.txt`») y #540 («53 passed, `_ctl/k03-tests.txt`»): **esos dos archivos no existen** en `C:/gfw-src/_ctl/` (hay `checksNNN.txt`, `deploy-*.txt`, `ci559-fail.txt`, `install-dev-client.txt`). No digo que no corrieron: digo que no se puede cruzar.

## 6. Clase 3 — DoD desactualizado (el código sigue una decisión posterior al backlog)

| Fila | Backlog dice | Manda hoy | Qué hacer (planificación) |
|---|---|---|---|
| BL-C4 (l.190) | 4 orígenes | 3 en todo el sistema (`gasto_store.py:20`) | corregir DoD o abrir fila backend |
| BL-F2 (l.320) | vencimiento + Copiar | el backend no emite vencimiento (`tool_catalog.py:613-615`); Copiar requiere dependencia nativa congelada | corregir DoD o abrir fila backend |
| BL-J3 (l.350) | «—» si falta | K-03 l.49: omitir el chip entero | actualizar backlog |
| BL-W7 (l.276) | test del mapeo regla→categoría en FE | el mapeo vive en backend por K-06 (`test_mi_dia_clasificacion.py:27`) | actualizar backlog |
| BL-D3 (l.151) | `preview` en paridad con web | web no tiene productor de `preview` (`conversation_workflow.py:608-615`, `hitl.ts:77`) | quitar `preview` del DoD; el ícono sí es defecto (§3.1) |
| BL-X11 (l.522) | avatar de Soporte + 5 íconos | N/A en web por acta del PR (no hay Soporte en `apps/copiloto-web`) | aceptar el acta o abrir fila |

## 7. Clase 4 — filas a medias (una mitad entregada, la otra no)

BL-X5 (backend + kb-usuario, §3.1) · BL-D3 (ícono de servicio en mobile) · BL-C6 (test de componente web, K-02 l.105) · BL-B6 (control de dos gates simultáneos) · BL-B7 (evidencia del hash post-deploy). Detalle y prueba en §3.1.

## 8. Clase 5 — afirmaciones de PR que el código no respalda

| PR | Afirma | Encontrado |
|---|---|---|
| #526 (BL-C3) | tests de «componente web **y mobile**» | mobile sin test del separador (`apps/mobile/src/modules/chat/ListaMensajes.test.tsx`: 0 hits; #526 no tocó tests mobile) |
| #543 (BL-D1) | «8 tests mobile nuevos» | 7 en `TarjetaPresupuestoPropuesto.test.tsx` + 2 en `packages/core/src/api/presupuestos.test.ts` (`git show 9048d883`) |
| #529 (BL-W1) | recibo `61358a27` 5/5 | es el commit pre-rebase; el head `03d578b8` no tiene recibo |
| #532 (BL-W4) | recibo `1df3547d` en `wt-fe1b` | archivo inexistente en todos los worktrees |
| #538, #540 | logs `_ctl/k02-tests.txt`, `_ctl/k03-tests.txt` | no existen (§5) |
| #520 (BL-B6/B7) | «recibo verde» | sin archivo del head; `41b681eb` sólo `lint` |
| #524 (BL-W7) | «contador sin N crítico (K-06)» | cierto al momento del PR; en `fc583792` ya lo muestra (`ChipsCategoria.tsx:64`, por #548) — no es falso, es histórico |

Ningún PR afirma evidencia de device que no tenga: **todos la declaran pendiente**. Eso está bien dicho.

## 9. Errores del inventario (`dato_…inventario-de-la-ola-1.md`) — para el `pedido_`

1. **§2 (l.55-86) no lista BL-J2, BL-J3, BL-J5, BL-J6, BL-J10** aunque §1 los cita (#539, #548, #541, #545) y el contrato los pone primero; tampoco BL-X1 (#533), BL-X12w (#528), BL-P8 (#519) ni K-01..K-09. El «21 de 30» no cuenta las J.
2. **l.86 BL-X5 «✅ sí» como BACKEND + FRONTEND-2** con un solo PR (#521, web). La mitad backend no existe (§3.1). Contar por título del PR da por entregada una fila a medias.
3. **l.169 el comando `bash scripts/gate.sh --solo backend` no corre nada y sale verde** (§4.1). Debe ser `bash scripts/gate.sh backend` con la triada exportada (`scripts/ci/sesion-env.sh`).
4. **§3 (l.91-164) es «tests tocados por la ventana» (64 archivos), no la lista de adversariales.** Los adversariales nuevos son 4 (§1.2); los derivé yo.
5. Tabla «fuera de alcance»: **BL-W6 (#556) y BL-W10 (#553) se entregaron después de `fc583792`**; BL-B1 tiene corridas de durabilidad en `_ctl/` sin PR que la cite (§3.3).
6. Menor: #536 (cerrado sin mergear) está correctamente ausente; el título de #521 en l.19 cita 4 filas pero §2 cuenta BL-X5 sin mirar la mitad.

## 10. Device

Ninguna de las 14 filas de §3.2, ni las 5 J, ni las 7 de §3.1, trae evidencia de device/PWA. La tanda está en pausa por el operador. Al reanudarla: BL-D1 se verifica contra `/presupuestos` **con claims** (DoD l.133), no con un `count` ciego bajo `FORCE`.
