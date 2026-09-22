# Auditoría A2 — Ola 2 de la beta Odobi

> **SHA medido:** `6b410923` · **Fecha:** 2026-09-21 · **Sesión:** auditoría (triada `aud`: `copiloto-test-db-aud:55436`, stage `/opt/uc-copiloto-cliente-stage-aud`).
> **Contrato:** A2 de planificación (18 filas: BL-F1, J2, J3, J5, J6, J9, J10, J11, J12, Q4, X1, X2, X3, X4, X6, X7, X12m, X12w).
> **Regla de la sesión:** auditoría no abre trabajo. Cada ❌ es una fila para que planificación la asigne; el detalle y la prueba de cada clase viven en su `hallazgo_…A2-*` del buzón.
> **Evidencia cruda:** worktree del auditor, `_evidencia/2026-09-21/A2/` (logs completos del gate, del backend por test, del control negativo de contraste, del recomputo y del test de precedencia). No se versiona; cada cifra de acá dice con qué comando se reproduce.

## 0. Resultado

| | Filas |
|---|---|
| ✅ | BL-X12w |
| `[ASSUMED_PENDING_VERIFY]` | BL-X12m (lockup de `ingresar` congelado hasta que Martín entregue: no es fallo) |
| `[PENDIENTE_DEVICE]` (código y tests cumplen; falta lo táctil o la captura) | BL-F1, J2, J3, J5, J6, J10, J12, X1, X2, X3, X4, X7 |
| ❌ | **BL-J9** (K-07-B: la precedencia de cards no está implementada) · **BL-J11** (integración contra GoTrue sustituida por un simulador) · **BL-Q4** (cobertura incompleta + 34 pares bajo AA exentos sin acta) · **BL-X6** (DEC-5 sin acta; `.otf` en la historia pública) |

Seis clases de hallazgo, severidad máxima **media** salvo X6, que queda **indeterminada hasta DEC-5**
(alta si la licencia no permite redistribuir). Ninguna es un fallo de aislamiento: los 14 tests
de aislamiento corridos pasan (6 de la Ola 2, 2 de J10, 6 de A1).

## 1. Gate e instrumentos

### 1.1 Gate completo

`UC_SESION=aud bash scripts/gate.sh` en `6b410923`, en segundo plano con salida completa a archivo:
**5/5 ok** — core 579 · web 1088 (118 archivos) · mobile 909 passed + 1 skipped · lint ok · backend
`2045 passed, 27 skipped` (Postgres real, RLS FORCE). El recibo acumula por job con `historial` y
`sesion:"aud"`: los arreglos de A1 §4.2 (recibo pisado) y §4.4 funcionan.

### 1.2 Backend por test

El log del job backend **no dice qué test pasó**: `scripts/ci/backend.sh:29` corre la colección
(`pytest --co -q`, nombres sin estado) y `:30` la suite con `-q` (puntos y resumen). `grep -c PASSED` en
el log del gate = **0** con la suite entera verde. Para auditar adversariales se re-corrió con resultado
por test:

```bash
export UC_SESION=aud; source scripts/ci/sesion-env.sh
eval "$(bash deploy/copiloto/test-db.sh --export 2>&1 | grep '^export ')"
bash deploy/copiloto/sync-test-backend.sh tests ../../motor/backend/agent ../../motor/clients/agent -q -rA > a2-backend-rA.log 2>&1
```

Resultado: **2045 `PASSED`, 0 `FAILED`**, 27 `SKIPPED`. Las 17 líneas `ERROR` del log son logs capturados
de tests que ejercitan caminos de error, no resultados.

| Costura | Test adversarial | Línea en `a2-backend-rA.log` |
|---|---|---|
| K-12 | `test_cambiar_cuenta.py::test_ADVERSARIAL_el_token_de_A_no_cambia_la_contrasena_de_B` | 2320 PASSED |
| K-12 | `test_cambiar_cuenta.py::test_ADVERSARIAL_el_token_de_A_no_cambia_el_mail_de_B` | 2327 PASSED |
| K-08 | `test_adversarial_multitenant.py::test_K08_el_feedback_de_A_no_aparece_en_la_lista_de_B` | 1910 PASSED |
| K-08 | `test_feedback_escuchado.py::test_ADVERSARIAL_el_store_de_A_no_marca_el_feedback_de_B` | 2741 PASSED |
| K-08 | `test_feedback_escuchado.py::test_ADVERSARIAL_sin_token_es_401_y_usuario_normal_es_403` | 2744 PASSED |
| K-07-B | `test_plata_por_voz.py::test_K07B_la_card_de_A_apunta_al_presupuesto_de_A_y_B_no_puede_aprobarlo` | 3298 PASSED |
| J10 | `test_perfil_negocio_store.py::test_aislamiento_A_no_ve_el_perfil_de_B` y `…upsert_de_A_no_toca_el_perfil_de_B` | PASSED (ambos) |

**Saltados:** los 27 por credencial o servicio vivo ausente en el stage (OpenAI, Composio, Graphity,
RAG). Ninguno de estas filas. Uno es de aislamiento y queda anotado fuera de alcance:
`test_memory_isolation_live.py:73` (requiere Graphity vivo) — el aislamiento de la memoria de grafo no
se ejerce en el gate.

### 1.3 Fe de erratas de A1 §1.2

`2026-09-21-auditoria-A1-ola-1.md` §1.2 tituló «con `PASSED` en el log» y citó números de línea del log
del backend. **Esas líneas eran de la colección (`--co`), no resultados.** El veredicto se sostiene:
re-corridos con `-rA` en `6b410923` (superconjunto de `fc583792`), los 6 tests de aquella tabla dan
PASSED:

| A1 §1.2 | Test | Línea real en `a2-backend-rA.log` |
|---|---|---|
| K-01 | `test_K01_la_misma_clave_en_otro_tenant_NO_colisiona_ni_devuelve_lo_ajeno` | 3342 |
| K-02 | `test_ADVERSARIAL_A_no_toma_prestado_el_CUIT_vinculado_de_B` | 1947 |
| K-03 | `test_K03_la_variacion_de_A_no_usa_el_mes_anterior_de_B` | 2973 |
| K-03 (preexistente) | `test_aislamiento_A_no_ve_los_ingresos_de_B` | 2979 |
| K-04 | `test_K04_aislamiento_A_no_cuenta_los_derivados_de_B` | 2398 |
| K-09 | `test_la_caida_de_B_no_se_ve_desde_A` | 2554 |

El mismo error estaba en el inventario de la Ola 2 (§3, l.339-343: `grep -c PASSED` como chequeo anti
falso verde, que da 0 siempre). Va como `pedido_` a planificación.

## 2. Costuras backend ↔ app

### 2.1 K-12 · cambiar contraseña y mail (BL-J11)

- **Campos casan** backend ↔ core: `apps/copiloto/web.py:622-628,1181-1230` ↔ `packages/core/src/api/auth.ts:28-55`.
- Reautenticación con la contraseña actual antes de cambiar (`web.py:1192`). Cuenta Google oculta la fila
  de contraseña en las dos apps (web `account/CambiarCredenciales.tsx:100`, mobile `ajustes/CambiarCredenciales.tsx:76`).
  Cerrar sesión en su propio grupo.
- «Cambiar email» **no está montado** en ninguna app (sólo existe en core, `auth.ts:53-55`, más comentarios
  `[DIFERIDO_CIERRE_B]`): correcto según el contrato, no es fallo. El PR backend #559 explica por qué: en
  prod el link de confirmación no enruta y no hay SMTP.
- **❌ DoD:** el contrato pide un test de integración contra una **GoTrue de test** con cuentas efímeras;
  `test_cambiar_cuenta.py:3-5,26` usa una GoTrue **simulada** (`httpx.MockTransport`). La GoTrue real
  (v2.186.0) se ejerció una vez, en `spikes/gotrue-cambiar-mail-contrasena/`. El PR lo declara. Además el
  backlog (l.420) todavía dice «contra `copiloto-auth`», que el contrato posterior prohíbe.
- Menor: el backend emite 400 `cuenta_sin_email` y 502 `no_se_pudo_cambiar` que core no intercepta
  (`auth.ts:39`: sólo 401/409/422); la UI muestra «Probá de nuevo en un rato», engañoso para el 400.

### 2.2 K-15 · editor de tono con ejemplo (BL-X7)

- Campos casan: `apps/copiloto/presupuestos_web.py:232-242` ↔ `packages/core/src/api/perfilNegocio.ts:321-333`.
- El ejemplo refleja lo que el agente usa: `test_perfil_negocio_ejemplo.py:21` arma el prompt con el
  `bloque_de_contexto` real (cadena `worker_b.py:107-119,281`).
- Sin adversarial por exención explícita del contrato (no agrega superficie de acceso).
- Mi negocio muestra sólo la fila-resumen (DoD l.500).

### 2.3 K-08 · «Lo pediste vos» (BL-J12)

- Campos casan (`web.py:876-880`); `GET /feedback` con `require_tenant` y filtro explícito
  (`feedback_store.py:41`); admin con `require_admin` vía `app_metadata.copiloto_admin`
  (`admin_web.py:179-196`, `auth.py:179-209`). Escritura con el `conn_factory` del tenant dueño, como
  pide el contrato.
- Menor: la consola admin guarda «escuchado» **sólo en memoria** (`AdminScreen.tsx:148-149`) porque el
  listado (`admin_soporte.py` `resumen_soporte()`) no trae la columna. Al recargar, todo aparece sin
  marcar. El contrato no lo pedía.

### 2.4 K-07 + K-07-B · sugerencias y card de armar factura (BL-J9)

- Campos casan: `catalog.py:127-134`, `presupuesto_sugerencias.py:11-21`, `tool_catalog.py:1257,1264-1270`,
  `reply_store.py:44,53-56` ↔ core `sugerenciaArmarFactura.ts:20-29`.
- `kind` desconocido no pinta nada: probado en core (`sugerenciaArmarFactura.test.ts:17-22`), web
  (`chat/ChipArmarFactura.test.tsx:44`) y mobile (`chat/ChipArmarFactura.test.tsx:60`, `ChatView.test.tsx:235`,
  `ListaMensajes.test.tsx:357`).
- El chip llama `POST /presupuestos/{id}/facturar` sin cuerpo; los ítems se leen del lado del servidor
  (`presupuestos_web.py:394-414`).
- **❌ «Si el mismo turno también deja una `requiere_conexion`, gana la `requiere_conexion`»** (contrato
  K-07-B l.27): **no implementado.** `motor/backend/agent/conversation_workflow.py:621-632` guarda una
  sola `gate_card` por turno y la última la pisa. Demostrado en runtime con un test descartable (mismo
  arnés que `test_gate_card_requiere_conexion.py`, Temporal time-skipping, corrido en el VPS):

  ```
  PASSED  test_control_solo_sugerencia_llega_como_card
  PASSED  test_control_sugerencia_primero_conexion_despues_gana_conexion
  FAILED  test_CONTRATO_conexion_primero_sugerencia_despues_gana_conexion
          AssertionError: card final = {'kind': 'sugerencia_armar_factura', 'presupuesto_id': 7, ...}
  ```

  Causa de fondo: la regla estaba en la forma del contrato (§2), no en su DoD (§3). Ninguna línea la
  pedía, así que nadie la implementó ni la testeó.

### 2.5 K-03 · portada de Inteligencia (BL-J2, BL-J3)

Único cambio posterior a `fc583792` en esa costura: `caja.incompleta` (K-09, #550), aditivo, emitido por
`inteligencia_queries.py:210-215` y `inteligencia_web.py:53`. La costura sigue casando; se mantienen los
veredictos de A1.

## 3. Filas de frontend contra su DoD

| Fila | PR | Cumple | Falta | Veredicto |
|---|---|---|---|---|
| BL-F1 | #562 | `Recibo` con región viva (web `design-system/Recibo.tsx:45-77`, mobile `chat/Recibo.tsx:26-49`); lo usan las 5 cards; aviso de NC antes de emitir (`core chat/avisosCard.ts:7-8`); tests de lector de pantalla (`Recibo.test.tsx` en las dos) | capturas | `[PENDIENTE_DEVICE]` |
| BL-X1 | #533 | abre en Mi día (`DEFAULT_TAB='midia'`); Ajustes sólo por avatar, sin tab ni tile (`TabBar.tsx:62-74`, assert negativo `AppShell.test.tsx:105`); traducción DEC-2 (`DesktopShell.tsx:32-47`) | capturas contra el prototipo | `[PENDIENTE_DEVICE]` |
| BL-X2 | #587 | 6 funciones (`EscritorioScreen.tsx:23-29`, `seisFunciones.test.ts:9-23`); Contabilidad retirada (0 archivos); semáforo y fail-soft iguales a mobile (`AcumuladoAnual.tsx`) | captura PWA | `[PENDIENTE_DEVICE]` |
| BL-X3 | #586 | mini-chat borrado en las dos (commit `2c247335`); «Preguntar» abre el chat durable (`PreguntarInteligencia.tsx` web y mobile) | device | `[PENDIENTE_DEVICE]` |
| BL-X4 | #568 | 2 pieles (`ThemeProvider.tsx:21`); «Como el teléfono» en vivo (`:64-68`); `nocturno` → `oscuro` con test; `themesContrast.test.ts` 75/75 | captura; residuo cosmético `--skin-preview-nocturno` sin uso (`themes.css:198`) | `[PENDIENTE_DEVICE]` |
| BL-X6 | #578 | 0 `.otf` en el árbol; fuente nueva cargada en las dos | DEC-5 sin acta; **11 `.otf` en la historia** (9 `docs/Imagen de marca/Neue_Einstellung/`, 1 prototipo, 1 mobile); `fontsResuelven.test.ts:36` compara contra el script, no contra el disco | ❌ |
| BL-X12m | #597 | reveal post-logout (`RevealEntrada.tsx:27-65`); `cierreVoluntario` sólo en `anon` (`SessionProvider.tsx:175`); control negativo (`EntradaSesion.test.tsx:54-58`) | lockup de `ingresar` (congelado hasta Martín) | `[ASSUMED_PENDING_VERIFY]` |
| BL-X12w | #528 + #572 | lockup único, sin «Escribinos» (`LoginScreen.tsx:60-65`, ausencia asertada en `LoginScreen.test.tsx:147`); isotipo 1,3 (`Marca.tsx:16`); wordmark en acento (`login.css:34`); error con `aria-invalid` (`LoginScreen.test.tsx:78-98`) | — | ✅ |
| BL-Q4 | #581 + #582 | ver §3.1 | ver §3.1 | ❌ |

### 3.1 BL-Q4 · contrastes

**El gate discrimina.** Control negativo en las dos apps: `--label` claro → `#CFC6B2` en web → ROJO
(1,37:1 / 1,43:1); `dim` claro → `#CFC6B2` en mobile → 3 pares ROJOS (1,53 / 1,58 / 1,63); restaurado →
verde; árbol sin diff.

**Las dos excepciones de DEC-11 están corregidas** (sello de acción y botón de grabar, #582): el gate
mobile las computa desde los tokens con piso 5,4 y pasa. Esa línea del DoD cumple («con acta **o
corregidas**»).

**Lo que no cumple** (DoD: todos los pares pintados, declarados − cubiertos = 0):

1. Mobile enumera los pares a mano (`temaContraste.test.ts:103-263`) y el propio archivo deja
   `PantallaTicket.tsx` «documentado, no cubierto» (`:97-99`).
2. Web barre sólo `.css`: 12 asignaciones de color en `style` de `.tsx` quedan afuera (sospecha, no
   medida: varias son series de gráfico).
3. **34 pares de texto bajo AA pasan por exención**, recomputados desde los tokens (vaciando la lista de
   exentos en web; exigiendo 4,5 en mobile):

| App | Par (piel claro) | Ratio | Cómo pasa |
|---|---|---|---|
| web | `--ok-fg` sobre la página — 20 pares (toast ok, «entra», recibo del chat, card de éxito, …) | 3,77 / 3,95 | `DEUDA_CONOCIDA` |
| web | `--core` sobre la página — 8 reglas | 4,38 | `DEUDA_CONOCIDA` |
| web | `--danger-btn-fg` sobre `--danger-btn-bg` — 1 regla | 4,00 | `DEUDA_CONOCIDA` |
| mobile | peligro sobre lienzo / superficieAlta / peligroFondo | 4,29 / 4,42 / 3,77 | piso por par |
| mobile | éxito sobre lienzo / superficieAlta | 4,23 / 4,37 | piso por par |

La exención web cita DEC-11, pero DEC-11 nombra otras dos excepciones, ya corregidas: estas tres no
tienen decisión que las cubra. Los isotipos de `BotonVoz` y `Marca` (3,17:1) son gráfico, no texto: el
umbral es 3:1 (WCAG 1.4.11) y cumplen.

## 4. Clases de hallazgo

| # | Clase | Filas | Severidad | Quién destraba |
|---|---|---|---|---|
| 1 | Regla del contrato sin línea de DoD, no implementada (precedencia de cards) | J9 | media | backend (motor) |
| 2 | Instrumento: el log del backend no muestra resultados por test (+ fe de erratas A1) | — | media | planificación / dueño de `backend.sh` |
| 3 | La prueba verifica un sustituto de lo que el DoD nombra | J11, X6, J9 | media / baja | planificación: aceptar el sustituto o pedir la prueba literal |
| 4 | Gate de contraste: cobertura incompleta y deuda bajo AA sin acta | Q4 | media | frontend (+ Operador y Martín si alguna queda como excepción) |
| 5 | Fila bloqueada por decisión MAYOR sin acta | X6 | indeterminada hasta DEC-5 | Operador + Martín |
| 6 | Costuras menores: los campos casan, el borde no | J12, J11 | baja | frontend + core |

## 5. Método y límites

- Todo por script, en segundo plano, con salida completa a archivo; nunca el gate con sub-agentes vivos.
- Tres sub-agentes Sonnet leyeron costuras y filas; **cada afirmación que cambiaba un veredicto se
  re-verificó a mano**. Una no sobrevivió: «el `kind` desconocido no tiene test de pantalla» era falsa
  (hay tests en web y mobile, §2.4).
- **Qué no se miró:** lo táctil (device retenido por el operador → `[PENDIENTE_DEVICE]` por defecto) ·
  las filas de la Ola 3 adelantadas y los arreglos de las reaperturas de A1 · J5 y J6 (no re-auditadas por
  contrato) · la cuenta Google real de K-12 · los 12 colores inline de web.
