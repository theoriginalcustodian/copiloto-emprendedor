# Auditoría A4 — Cierre A de la beta Odobi

> ⏱️ **Esta es la foto del día de la auditoría, no el estado de hoy.** La columna «Qué cerraría» de la §6 está en condicional: se escribió antes de que existiera ningún fix. El **estado vigente de las 15 filas**, con la evidencia de cada cierre, está en [`2026-09-22-registro-A4-estado-vigente.md`](2026-09-22-registro-A4-estado-vigente.md). Este informe no se actualiza a propósito: su valor es no moverse.

> **SHA medido:** `b76cb47b`. Es el deploy de prod: el manifiesto dice `origin_main_sha b76cb47b…` y el bundle web es `index-BXDl2uCf.js`, en todas las capturas. `main` avanzó a `643e695c` sólo con #640 (docs, memoria y scripts; 0 archivos de app). · **Fecha:** 2026-09-22 · **Sesión:** auditoría (tríada `aud`).
> **Contrato:** A4 de planificación (§0.1: A los 12 hallazgos de A3 · B los arreglos del barrido BL-Q3 web · C una muestra propia de 8 pantallas · D el smoke contra prod · E el veredicto de los criterios 1–4 del §13).
> **Regla de la sesión:** auditoría no abre trabajo. Cada ❌ y cada hallazgo de §6 es una fila para que planificación la asigne. La entrega al buzón es `dato_auditoria-a-planificacion_A4-cierre-A-veredicto`.
> **Evidencia cruda:** `_evidencia/2026-09-22/A4/` en el worktree del auditor, no versionada: gate, backend `-rA`, smoke, push sintético, recomputes, `hechos-*.json` y `capturas/`. Cada cifra dice de qué archivo sale.
> **Método de captura:** un Chromium propio (Playwright), aislado del MCP compartido, sin service worker (así nunca sirve un bundle viejo), con el tenant `e2e-device@copiloto.test`. Corrí en serie con una pausa por request, porque el front-door limita a 60 req/min por IP (ver H-A4-10), y guardé el `storageState` después de cada contexto para no reusar el refresh token. Cada pantalla se capturó a 390×844 y a 1440×900, más su `?ver=<id>` del prototipo final (`BL-P2`) a 390.

## 0. Veredicto

**El Cierre A NO cierra.** Criterio 1 ✅ · criterio 2 ❌ · criterio 3 ❌ en la mitad web (la mobile es DIFERIDO) · criterio 4 ✅.

- **A:** de los 10 hallazgos accionables de A3, 9 cierran. **H-A3-1 no cierra:** `core.hooksPath` sigue absoluto, y un push con un secreto sintético contra un remoto local fue **aceptado**.
- **B:** 9 de 10 filas ✅. **BL-X10 ❌:** en prod, el reveal del primer ingreso termina con un disco naranja tapando «dobi», y con movimiento reducido la marca se lee «dobi», sin la O.
- **C:** de las 8 pantallas que elegí, 3 dan ✅ y 5 muestran diferencias que el barrido no declaró: 4 de FE1 (`factura`, `bi`, `soporte`, `apar`) y 1 de FE2 (`ingresos`). **Por la regla del contrato, ni el barrido de FE1 ni el de FE2 sirven como evidencia suficiente para la matriz web.**
- **D:** `smoke_beta_e2e.py` contra prod da **37/37, BETA-READY**. La evidencia de BL-B1 coincide con el SHA.

**Gate:** corrí `UC_SESION=aud bash scripts/gate.sh backend` (`a4-gate-backend.log`, recibo `a4-recibo-b76cb47b-backend.json`).
- Backend: **2079 passed, 27 skipped**, con «GoTrue: ON — los tests @necesita_gotrue CORREN».
- El recibo quedó `sucio:true` por un `backlog_tmp.md` suelto que dejó un sub-agente mío (ya lo borré). No afecta el árbol medido.
- Actions sobre el mismo SHA: `tests` success (run 35716865236).
- Backend por test (`-rA`, `a4-backend-rA.log`): 2079 PASSED, 0 FAILED. Las 17 líneas `ERROR` son logs capturados de caminos de error.

## 1. A — los 12 hallazgos de A3 @ `b76cb47b`

| Hallazgo | Arreglo | Veredicto | Comando corrido → salida |
|---|---|---|---|
| **H-A3-1** · BL-B3 | config, sin PR | ❌ **No cierra** | Ver el detalle después de la tabla (→ H-A4-1). |
| **H-A3-2** · BL-J8 | #626 | ✅ | `test_execute_tool.py::test_H_A3_2b_proposal_sin_conexion_devuelve_card_antes_de_pedir_confirmacion` y `…_conectado_sigue_pidiendo_confirmacion_normal` **PASSED** (rA:2724-2725). Salvedad: el test cubre `gmail_send` por la ruta plug-in, no el cobro de MercadoPago (→ H-A4-11). |
| **H-A3-4** · BL-J8 | #626 | ✅ | `test_gate_card_sobrevive_confirm` ×2 PASSED. Fixture de replay de la rama `gate_card` **corrida**: `test_el_replay_no_diverge_del_codigo_actual[…history_gate_card_sobrevive_confirm.json-destino3]` **PASSED** (rA:3787). |
| **H-A3-3** · ADR-003 | #629 | ✅ | ADR-003 l.114-126: «`patched()` se memoiza POR RUN (enmienda 2026-09-22, H-A3-3)». Ya no afirma lo que el spike de A3 desmintió. Cita la memoria `patched-se-memoiza-…`, que está en `main`. |
| **H-A3-5** · BL-X8 | #627 | ✅ (código + tests) | Mobile montado en el Guard: `apps/mobile/app/_layout.tsx:26,97-98` (`<PantallaOnboarding onTerminar…/>`). jest mobile **65/65** (`a4-jest-vitest.log`), con los tests de `PantallaOnboarding` y del Guard. La captura necesita una cuenta nueva, y `e2e-device` tiene `onboarding_completado=true` (no muto prod) → tanda de device (§0.2). |
| **H-A3-6** · BL-X10 | #635 | ❌ en prod (ver B) | Tests verdes: web `EntradaSesion` y mobile `RevealEntrada` (`a4-tests-B.log`). Pero el estado final medido en prod no es el del prototipo (→ H-A4-2). El audio «o-DO-bi» es del operador (§0.2). |
| **H-A3-7** · BL-J7 | #638 | ✅ (código + tests; la captura está diferida por el anexo) | web `Bubble.test.tsx` (con chip y sin chip) + `useChat.test.ts`, y mobile `ListaMensajes` BL-J7: todos corridos verdes (`a4-jest-vitest.log`: web 4 archivos / 39 tests, mobile 65/65). |
| **H-A3-8** · BL-B1 | #628 | ✅ | Mutación del instrumento (`a4-h8-mutacion-instrumento.log`): «callback perdido: con fix → ROJO (lo detecta) \| revertido → VERDE FALSO · **VEREDICTO: DISCRIMINA**». El test de sincronía pasa en rA. |
| **H-A3-9** | — | fuera (§0.2) | — |
| **H-A3-10** · BL-Q4 mobile | #639 | ✅ | Recompute independiente desde los tokens (`a4-h10-recompute.log`): `#de7250` con α 31/255 sobre `#1A1512` da `#32201a`; `#928777` sobre `#32201a` da **4,3873:1**, igual al walker. Controles negativos **corridos** (`a4-h10-negativo.log`): caso 0 13/13 verde · caso 1 (sin la excepción) **rojo**, apunta a `ticket-msj-2-autor: #928777 sobre #32201a = 4.39:1 (SIN registrar)` · caso 2 (`tx` oscuro → `#5A5048`) **rojo**. El árbol quedó restaurado. |
| **H-A3-11** · BL-J11 | #631, #632 | ✅ | El job backend provisiona GoTrue efímera (`gate.sh:104-117`); **8/8 `test_cambiar_cuenta_gotrue_real` PASSED**, incluidos los adversariales «A no cambia la contraseña ni el email de B». Los skipped bajan de 35 a 27. |
| **H-A3-12** | — | informativo | — |

**H-A3-1, detalle** (`a4-hookspath.log`, `a4-h1-push-secreto-sintetico.log`):
- `git config --show-origin --get core.hooksPath` da `file:.git/config	C:\Proyectos\Claude\Claude code\copiloto-emprendedor\.githooks`. Resuelve **igual** desde el checkout compartido, `wt-audit-a1` y `wt-fe1b` (re-verificado a las 08:42:59 local, con el mismo resultado). La config es común a todos los worktrees.
- **Push real contra un remoto bare local** con un commit sembrado con un secreto sintético:
  - Caso 1, config actual: `* [new branch] HEAD -> neg-caso1`, `rc_caso1=0`. Corrió el `pre-push` viejo del checkout compartido, que sólo sincroniza el grafo y no tiene gitleaks. **Push ACEPTADO.**
  - Caso 2, control con `-c core.hooksPath=.githooks`: «leaks found: 1» → «el push se aborta (repo PÚBLICO)», `rc_caso2=1`, ref ausente en el bare.
- El cierre de backend afirmaba la verificación, pero invocó el hook directamente, no con un `git push`. Por eso no vio qué directorio resuelve git.
- **Causa del reescrito: desconocida.** El único script del repo que escribe `core.hooksPath` pone la ruta relativa (`scripts/setup-hooks.sh:19` → `.githooks`). Tampoco la escriben los hooks globales de `~/.claude` ni los repos hermanos (Graphity, fleet-platform). No hay valor global ni de sistema. → H-A4-1.

## 2. B — arreglos del barrido BL-Q3 web, re-medidos en prod contra el prototipo final

| Fila | Veredicto | Evidencia (capturas en `capturas/`) |
|---|---|---|
| **BL-D4** #624 | ✅ web · mobile → device | Chat en escritorio, «Cobrale $80.000 a Rodríguez», Cancelar (`hechos-d4.json`). La burbuja muestra **«Cancelar»** tras cancelar y **también tras recargar**; ninguna burbuja matchea `/^(confirm\|cancel):\d+:\d+$/`. Capturas `d4-cobro-tras-cancelar-desk`, `d4-cobro-tras-recargar-desk`. **Control negativo corrido** (`a4-d4-negativo.log`):
- Con el fix, el test «BL-D4…» pasa en web (vitest) y en mobile (jest).
- Con `text: opts?.displayText ?? trimmed` revertido a `text: trimmed` en los dos `useChat.ts`, los dos dan **rojo** (web: `expected … to match object { role: 'user', text: 'Cancelar' }`).
- El árbol quedó restaurado.

El test de mobile vive en `apps/mobile/src/modules/chat/useChat.test.ts`, no en core: #624 no tocó `chatMachine.ts`. Es equivalente. Efecto lateral → H-A4-9. |
| **BL-D5** #625 | ✅ | `calcularTotalAproximado` / `multiplicarDecimal` viven una sola vez en `packages/core/src/dinero/totalAproximado.ts:19`, y los `FormularioPresupuesto` web y mobile lo consumen. En prod, «1.00» × «30000.00» da **«Total aproximado: $30.000,00»** a 390 y a 1440 (`presu-*`, `hechos-bc.json`), y en la tarjeta **pres-hitl** del chat (`d4-presu-tras-cancelar-desk`). Test del caso y del redondeo verde. Observación de layout → H-A4-8. |
| **BL-D6** #625 | ✅ | `.midia-tarjeta__frase--clamp` con `line-clamp: 2` (`midia.css:173-179`). En prod, clamp 2 con texto visible: alto 34 px a 390 y 17 px a 1440, `scrollH` igual al alto (`midia-*`). |
| **BL-D7** #625 | ✅ | A 390: 4 pestañas (Chat · Mi día · Funciones · Consola), ninguna pisada (`pisado:false` ×4). A 1440, el rail no cambia (`midia-m390`, `midia-desk`). |
| **BL-D8** #633 | ✅ (obs.) | Título «Apps»; el ícono de Docs carga (`docs-B8YGeuST.svg`, `naturalWidth` 73, `ok:true`). La grilla, contra la lista del prototipo, es decisión declarada. Obs.: a 390 las columnas quedan desiguales (~212 vs ~140 px) → H-A4-14. |
| **BL-W11** #630 | ✅ | Fecha «Martes 22 de septiembre» a 390 y a 1440. **Calendar caída, reproducida en prod** (`e2e-device` la tiene caída): «Se cayó la conexión con Google Calendar. Reconectala en Ajustes → Apps…» (`MidiaScreen.tsx:327-328`, igual que mobile `PantallaMiDia.tsx:557-559`). Ofrece reconectar por texto, sin botón directo; el prototipo no dibuja ese estado del panel. El aviso de caja nombra a Mercado Pago (`packages/core/src/midia/caja.ts`, con test). Con MP caído no se reproduce: el DoD lo manda a la tanda de device. |
| **BL-W12** #637 | ✅ | Los 9 tiles salen en el mismo orden a 390 y a 1440 (perfilNegocio · facturacionAfip · apps · miPlan · cuenta · apariencia · comoUsar · soporte · feedback), igual que mobile. «Cómo usar la app» quedó fusionada, con la sección «Lo que le podés pedir». Tests verdes, incluida la agrupación por rótulo. |
| **BL-X10** #635 | ❌ | Ver el detalle después de la tabla (→ H-A4-2). |
| **BL-X8** #627 | ✅ (código + tests) · captura → device | Ver H-A3-5. En prod no se re-mide sin cuenta nueva, y el DoD mismo exige «probado con una cuenta nueva en device». |
| **`gastos`** (verificación de FE2) | ✅ | Septiembre sin gastos: «Gastado en 2026-09 $0,00». Con 0 gastos del mes, `por_categoria` vacío es lo correcto (fila 7 del contrato de FE2), así que no hay desglose que dibujar: coherente con la verificación de FE2. Obs.: el período sale en ISO crudo → H-A4-6. |

**BL-X10, detalle.** Serie temporal sin sesión a 390 (`x10-normal-t01s…t18s-m390`, `x10-reducido-t02s/t06s-m390`), contra el splash y el reveal del prototipo (`proto-x10-splash-t*`, `proto-x10-reveal-t*`):
- **El estado de t=9 s es el final, no un frame intermedio: a t=18 s la captura es idéntica.** Un disco naranja de ~97 px tapa la «d» y parte de la «o» de «dobi»; el wordmark está en otra tipografía y el fondo queda blanco. El prototipo aterriza en el wordmark «Odobi», con la O integrada a la palabra, más «Tu copiloto emprendedor» (t=7 s); el reveal pone el lockup con el isotipo sobre «se dice o-DO-bi».
- **Con movimiento reducido la marca se lee «dobi»:** la O no se dibuja nunca.
- Causa en el código:
  - `Splash.tsx:89-91`: `--ox = −ancho("dobi")/2` ≈ −30 px, con un wordmark de 31 px (`Splash.css:72-76`: `font-family: var(--font-mono)`, `clamp(28px, 8vmin, 56px)`). La O mide 40vmin × 0,62 ≈ 97 px (`Splash.css:28-32` + el keyframe de colapso), así que queda centrada encima de la palabra.
  - `Splash.tsx:107`: `{!reducido && (…formas…)}` saca la O entera con movimiento reducido.
- Los tests de jsdom no miden geometría, por eso quedan verdes.
- DoD incumplido: «reveal con «se dice o-DO-bi»» sobre el aterrizaje del splash del prototipo, y «respeta movimiento reducido»: respetarlo no puede borrar la inicial de la marca.
- La tipografía de marca (`.otf`) cae en BL-X6/DEC-5 (§0.2). El solapamiento y la O ausente **no** dependen de la fuente.
- «Crear una nueva cuenta» falta, como declaró FE1 (BETA-4b), pero no figura en §0.2 → H-A4-15.

## 3. C — muestra independiente de la matriz (mitad web)

Elegí 8 pantallas que el barrido marcó COHERENTE sin diferencia: 5 de FE1 (`…dato_frontend1…BL-Q3-web-barrido-35-pantallas.md`) y 3 de FE2 (`…dato_frontend2…BL-Q3-web-barrido-pwa-vs-prototipo.md`). Criterio: cuenta como diferencia lo que cambia contenido, función o estructura visible y no nombra ni la fila del barrido ni una decisión declarada. El estilo puro (color de tarjeta, radio, peso tipográfico) y lo que el shell ya decidió (tab bar en lugar del compositor por pantalla, «‹ Volver») no cuentan. Tampoco el uso de «copiloto» como descriptor, que el prototipo mismo usa («Tu copiloto emprendedor»).

| Pantalla | Barrido | Veredicto | Diferencia no declarada (archivo:línea) |
|---|---|---|---|
| `ingresar-error` | FE1 | ✅ | El texto del error es idéntico: «Ese mail y esa contraseña no coinciden. Probá de nuevo.» (a 390 y a 1440, con un email inexistente, sin tocar ninguna cuenta). Sólo difiere el estilo. |
| `factura` | FE1 | ❌ | **Estructura del landing.** La app abre con el wizard «Datos de venta» (fecha, concepto, condición, Continuar) **arriba** del resumen, más una sección «Te deben». El prototipo abre con el resumen del mes y la lista de emitidas; crear una factura es una acción, no el contenido fijo del landing. FE1 describió el form, pero lo calificó COHERENTE. `PantallaFacturacion.tsx:380-426` (el wizard siempre montado) y `:428-470`. → H-A4-5 |
| `bi` | FE1 | ❌ | **Rentabilidad.** La app muestra «$0,00». El prototipo muestra «—» con «Falta asignar gastos a trabajos. No es cero: es que todavía no se puede calcular». El backend nunca devuelve `null`: `inteligencia_queries.py:203,219` calcula `rentabilidad = ingresos − gastos`, el mismo número que `caja.saldo`. Así, la rama «sin dato» de `InteligenciaScreen.tsx:243-255` (cuyo comentario dice «nunca `$0`», `:219`) es código muerto en prod. → H-A4-3 |
| `soporte` | FE1 | ❌ | **Ejemplos del chat general en el chat de soporte.** El vacío de soporte muestra el rodillo «Gasté 15 lucas en nafta» · «¿Cuánto facturé este mes?» · «Cobrale $80.000 a Rodríguez» con «Pausar ejemplos». `SoporteScreen.tsx:67` reusa `MessageList` con `emptyHint`, y `MessageList.tsx:167-171` monta `RodilloEjemplos` siempre que hay `emptyHint`. Además falta el título «Soporte técnico» del prototipo: el `h1` es «Soporte de Odobi». → H-A4-4 |
| `apar` | FE1 | ❌ (baja) | **Layout y texto.** La app pone 3 tarjetas apiladas con «Elegí la piel del copiloto.» (`PantallaApariencia.tsx:42`). El prototipo pone Claro y Oscuro como 2 tiles lado a lado, «Como el teléfono» como fila con subtítulo, y una nota explicativa. La función es la misma. FE2 cuenta las diferencias de layout como DIFERENCIA (`ajustes`); FE1, acá, no. → H-A4-7 |
| `ingresos` | FE2 | ❌ (baja) | **Período y fechas en ISO crudo.** El encabezado dice «2026-09» (prototipo: «Agosto») y cada fila «2026-08-12» (prototipo: «12 de agosto»). `IngresosScreen.tsx:129` y `TarjetaIngreso.tsx:30-31` pintan el string del backend. La fila declara «Estructura y datos coinciden» y sólo nombra íconos contra «Borrar». → H-A4-6 |
| `negocio` | FE2 | ✅ | Los 6 campos van en el mismo orden. «Cómo te habla el copiloto · Cercano · Breve ›» existe (es el «Cómo te habla» del prototipo). Obs. menor: el título «Mi negocio» aparece dos veces (`h1` y `h2`). |
| `cuenta` | FE2 | ✅ | Lo que la app agrega está declarado por FE2. Falta «Cambiar el mail», pero está declarado en el código como `[DIFERIDO_CIERRE_B]`, dueño el operador, por la respuesta K-12 opción b (`CambiarCredenciales.tsx:93-96`). |

**Consecuencia (regla del contrato §0.1 C):** el barrido web de **FE1** deja de ser evidencia suficiente: 4 de 5 muestras tienen diferencias no declaradas, 3 de ellas funcionales (`factura`, `bi`, `soporte`). El de **FE2** también (1 de 3, `ingresos`). Las filas COHERENTE de esos barridos no se pueden citar como ✅ de la matriz `BL-Q5` sin re-medirlas.

## 4. D — criterio 4

```
set -a; . /etc/unreal-copilot/copiloto.env; . /etc/unreal-copilot/fusion-pg.env; . /etc/unreal-copilot/fusion-supabase.env; set +a
/opt/uc-copiloto-venv/bin/python deploy/copiloto/smoke_beta_e2e.py
```

- **total=37 · pass=37 · fail=0 · BETA-READY**, `rc_smoke=0` (08:08:32–08:08:48 local, `a4-smoke-beta-prod.log`).
- El `smoke_beta_e2e.py` de prod es byte a byte el de `b76cb47b` sin los CR: `a4-smoke-diff-prod-vs-b76.txt` quedó vacío.
- **BL-B1**, sin repetirlo: el manifiesto `origin_main_sha` da `b76cb47b` y el deploy fue a las 10:47:03Z (`a4-deploy-manifest.log`). En Temporal están las ejecuciones `e2e-g6-durabilidad` y `e2e-g6-durabilidad-hitl` a las 10:44 y 10:48Z, alrededor del restart del deploy, y mi smoke a las 11:08Z.

## 5. E — criterios 1–4 del §13 sobre `b76cb47b`

| # | Criterio | Veredicto | Por qué |
|---|---|---|---|
| 1 | Todos los `DEC-*` con acta | ✅ | Resueltos o pospuestos con su ítem en §12. Los que esperan al operador figuran en §0.2. |
| 2 | Todos los `BL-P/D/C/W/F/J/B/O/Q` cerrados con su DoD | ❌ | Abiertos y fuera de §0.2: **BL-B3** (H-A3-1, §1) · **BL-X10** (§2; está en la beta) · **BL-O5** backups + restore probado · **BL-O6** términos y privacidad reales · **BL-O7** SLA de soporte · **BL-O8** acciones del operador · **BL-P4**, **BL-P6**, **BL-P7**. Ninguno tiene cierre en el backlog @`b76cb47b` ni en el buzón. BL-O1 y BL-O2 son de Cierre B (DEC-12). Si alguno debía estar en §0.2, lo corrige planificación. |
| 3 | Matriz `BL-Q5` ✅ en web y mobile, 54 ids spec | ❌ web · DIFERIDO mobile | **Web:** X10 ❌ en B, y la muestra C invalida los dos barridos: 5 diferencias no declaradas en 8 pantallas. A4 muestrea; no re-midió los 54 ids. **Mobile:** sprint siguiente (§0.2). |
| 4 | Smoke verde contra prod + durabilidad (`BL-B1`) | ✅ | 37/37 BETA-READY, corrido por auditoría. La evidencia de B1 coincide con el SHA (§4). |

## 6. Hallazgos nuevos — filas para planificación

| # | Sev. | Hallazgo | Evidencia | Qué cerraría |
|---|---|---|---|---|
| **H-A4-1** | alta | **H-A3-1 reabierto:** el pre-push con gitleaks no corre en ningún worktree. `core.hooksPath` es absoluto hacia el checkout compartido, y un push con un secreto sintético pasa. Repo público. | §1 · `a4-h1-push-secreto-sintetico.log` | Un control **mecánico y fail-closed** en `scripts/gate.sh` o `no-drift.sh` que falle si `git config core.hooksPath` ≠ `.githooks`; así no depende de que nadie reescriba la config. Cierre verificado con un **push real contra un remoto local**, no invocando el hook. Buscar quién reescribe la ruta. |
| **H-A4-2** | alta | **Reveal del primer ingreso roto en su estado final:** el disco tapa «dobi»; con movimiento reducido, «dobi» sin O. Es la primera pantalla de un tester nuevo (criterio 5). | §2 · `x10-normal-t18s-m390` · `x10-reducido-t02s-m390` | La O con la geometría del prototipo (O integrada al wordmark); con movimiento reducido, la O estática en lugar de ausente; un test que mida la posición de la O contra el wordmark (no jsdom), o una captura en el DoD. |
| **H-A4-3** | media | Rentabilidad = saldo: el estado «no se puede calcular» del prototipo es inalcanzable. | §3 `bi` · `inteligencia_queries.py:203,219` · `InteligenciaScreen.tsx:243-255` | Junta backend↔web: definir cuándo `rentabilidad` es `null` (el prototipo lo ata a «gastos asignados a trabajos») y emitirlo. |
| **H-A4-4** | media | El chat de soporte muestra ejemplos de dictado de gastos y cobros. | §3 `soporte` · `SoporteScreen.tsx:67` · `MessageList.tsx:167-171` | Que `MessageList` no monte `RodilloEjemplos` en soporte (una prop) y el título «Soporte técnico». |
| **H-A4-5** | media | Facturación abre con el wizard de alta arriba, no con el resumen y las emitidas. | §3 `factura` · `PantallaFacturacion.tsx:380-470` | El landing del prototipo; el wizard, detrás de «Nueva factura» / el mic. Mismo patrón en mobile (el comentario de `:428` dice «mismo patrón que mobile»). |
| **H-A4-6** | baja | Período y fechas en ISO crudo («2026-09», «2026-08-12») en Gastos, Ingresos y los gráficos de Inteligencia («2026-04..2026-09»). Facturación y Presupuestos ya dicen «Septiembre». | `IngresosScreen.tsx:129` · `TarjetaIngreso.tsx:30-31` · `GastosScreen.tsx:151` · `ResumenMes.tsx:23` · `TarjetaGasto.tsx:40` · mobile `ResumenMes.tsx:37` | Un formateador de mes y fecha en `packages/core` usado por las dos apps (hay uno local en `PantallaFacturacion.tsx:47`). |
| **H-A4-7** | baja | Apariencia: layout de 3 tarjetas y texto propio, contra 2 tiles + fila + nota. | §3 `apar` · `PantallaApariencia.tsx:42` | Layout y texto del prototipo, o la diferencia declarada. |
| **H-A4-8** | baja | A 390 px, la fila Cantidad/Precio del formulario de presupuesto desborda: el precio va de x=258 a x=475, **104 px recortados** (medido: `hechos-overflow-presu.json`). También pega en la tarjeta pres-hitl del chat, que reusa el form. | `presupuestos.css:390-397`: `.formulario-presupuesto__campo { flex: 1 }` sin `min-width: 0`; `input size=20` | `min-width: 0` en el campo (o `width: 100%` en el input), con captura a 390. |
| **H-A4-9** | media | **Una tarjeta HITL ya respondida sigue accionable**, antes y después de recargar: se rehidrata desde `localStorage` sin estado resuelto. En la corrida, un clic sobre la tarjeta ya cancelada envió otro «Cancelar», y el backend contestó «Listo 👍». El backend es seguro: `conversation_workflow.py:408-409` corta el callback stale, y `test_react_stale_confirm_token_does_not_execute_next_gate` y `…_without_parked_gate_does_not_reach_llm` PASSED (rA:3817,3824). Pero un **«Confirmar» tardío recibe «Listo 👍», que se lee como éxito sin que se ejecute nada**. Además, la rehidratación no sanea los `cancel:`/`confirm:` que haya en historiales guardados antes de #624 (`useChat.ts:76-87`), y el avance de FE1 dice que web «no hidrata», cuando hidrata desde `localStorage`. | `hechos-d4.json` · `d4-cobro-tras-recargar-desk` · `d4-presu-tras-cancelar-desk` | Persistir la elección en el mensaje y deshabilitar la tarjeta respondida (web y mobile); sanear los tokens legados al rehidratar. |
| **H-A4-10** | media | El rate limit del front-door es de 60 req / 60 s por IP e incluye los estáticos; el chat hace polling de `/reply` cada 1,5 s (40 req/min). **Vi 429 reales en prod**, hasta para «/», con dos navegadores de esta PC a la vez. Dos testers detrás del mismo NAT o CGNAT se cortan entre sí. | `rate_limit.py:26-27` · `useChat.ts:25` · `d4-ERROR-desk` | Excluir los estáticos, y límite por usuario autenticado en lugar de por IP (o polling con backoff), antes del tester real (criterio 5). |
| **H-A4-11** | media | Un cobro de MercadoPago pide confirmación HITL aunque MP no esté conectado. El fix de H-A3-2b cubre sólo la ruta plug-in (`gmail_send`). No medí qué pasa al confirmar: crearía un link real. | `test_execute_tool.py:255-278` · `d4-cobro-card-desk` | Test de la ruta MP sin conexión → card `requiere_conexion`, con control negativo. |
| **H-A4-12** | baja | El monto HITL sale sin formato es-AR: «$ 80000». | `hitlMapping.ts:87,93` (regex sobre el texto crudo) · `HitlCard.tsx:83-85` (sin `formatearImporte`) · `hechos-d4.json` | Pasar el monto por `formatearImporte`. |
| **H-A4-13** | baja | Cada corrida del smoke deja 2 `ConversationWorkflow` RUNNING de un tenant `smoke-*` que después se borra. | Temporal (lectura), corrida de las 11:08Z | Terminar las ejecuciones en la limpieza del smoke. |
| **H-A4-14** | info | Apps a 390: columnas desiguales (~212 vs ~140 px). | `apps-m390` | — |
| **H-A4-15** | info | «Crear una nueva cuenta» falta en el reveal (BETA-4b, declarado por FE1) y no figura en §0.2. | `x10-normal-t18s-m390` vs `proto-reveal-m390` | Planificación decide si va a §0.2. |
