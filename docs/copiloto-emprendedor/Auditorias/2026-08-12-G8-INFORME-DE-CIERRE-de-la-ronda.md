# G8 · Informe de cierre de la ronda de auditorías — 2026-08-12

> **Qué es esto.** El **G8** del [DoD del ciclo](2026-08-12-DoD-cierre-auditorias-y-fixes.md): informe
> único que consolida las 3 pasadas, el estado final de los 11 hallazgos del backlog histórico y los
> hallazgos nuevos. Sustituye a leer 19 archivos sueltos.
>
> **Estado (2026-08-12 21:05):** ✅ **CERRADO — los 8 gates.** Los lotes B (#407) y C (#412 · #415)
> mergearon y Fase D los verificó. La reconciliación de las 20:45 encontró una sola fila viva —el
> **5º `except` mudo de D-A** (`mercadopago_gateway.py:119`), difierido dos veces a disparadores que
> **ambos se cumplieron sin que nadie lo mirara**— y backend la cerró a las **21:00 (#424)**.
>
> Este informe **no se declaró cerrado por anticipado en ningún momento**: a las 20:45 decía 🔴 con
> nombre y línea del ítem que faltaba, y cambió a ✅ recién cuando ese ítem mergeó. Redondear 4/5 a
> "hecho" habría sido el "aprobar por ritual" que el canon prohíbe, sólo que con menos ruido.

---

## 0. Titular

**La ronda no encontró ningún P0 nuevo.** Tres pasadas independientes con modelo caro sobre
seguridad, robustez y eficiencia devolvieron **0 P0** cada una. Lo más grave del ciclo —el alta
abierta, C4.1— **no era un hallazgo nuevo: era una fila del backlog histórico marcada ⚠️ PARCIAL
desde el 2026-08-04**, esperando una decisión del operador que ya estaba tomada.

Esa es la conclusión que importa y no es cómoda: **el riesgo real no estaba escondido, estaba
registrado y sin dueño.** La auditoría no lo descubrió; lo que faltaba era ejecución.

**La reconciliación final (20:45) repitió el patrón, más chico y más rápido.** Con los lotes B y C
mergeados y verificados, quedó una sola fila roja: un `except` de dos líneas que se difirió a dos
disparadores distintos y **los dos se cumplieron el mismo día** sin que nadie lo notara. Backend lo
cerró **21 minutos** después de que se lo nombraran (#424). Otra vez: no estaba escondido, estaba
escrito.

El ciclo encontró **cero P0 nuevos** y **dos veces** el mismo modo de falla organizativo — que es,
medido en horas, el hallazgo más caro de la ronda. La diferencia entre las dos veces es que la
segunda **quedó cerrada con un instrumento** (`scripts/deuda-check.sh`, §5.4) y no con una lección.

---

## 1. Las tres pasadas (G1 ✅)

| Pasada | Informe | Balance | Titular |
|---|---|---|---|
| **1 — Seguridad** | [`pasada-1-seguridad-HALLAZGOS.md`](2026-08-12-pasada-1-seguridad-HALLAZGOS.md) | **0 P0 · 1 P1 · 4 P2** | El aislamiento multitenant es **real y estructural**: 0 fail-open en los 33 endpoints con ID en ruta |
| **2 — Robustez** | [`pasada-2-robustez-HALLAZGOS.md`](2026-08-12-pasada-2-robustez-HALLAZGOS.md) | **0 P0 · 4 P1 · 3 P2** | El **moat de durabilidad Temporal está bien construido**; los P1 son de escala/idempotencia, no rompen la beta |
| **3 — Pulido y eficiencia** | [`pasada-3-pulido-y-eficiencia-HALLAZGOS.md`](2026-08-12-pasada-3-pulido-y-eficiencia-HALLAZGOS.md) | **0 P0 · 0 P1 · 3 P2 · 1 P3** | Casi todo **control positivo**. Un solo costo por turno real (`perfil_provider`) |

**Total nuevo: 0 P0 · 5 P1 · 10 P2 · 1 P3.**

### Lo que las pasadas descartaron — no vuelve a auditarse

Esto vale tanto como los hallazgos: son **cuatro sospechas caras confirmadas seguras**, con control
positivo. Está acá para que nadie vuelva a gastar tokens en ellas.

- **Path traversal del catch-all SPA** (`web.py:487`) — doble cerrojo `resolve().is_relative_to`.
- **Webhook de MercadoPago** — **no forjable**: SDK oficial, fail-closed real.
- **DoS por upload** — los 4 endpoints ya tienen cota de tamaño (verificado con un upload gigante).
- **BOLA / OWASP API1** — 0 fail-open en 33 endpoints. Mapa completo en la Pasada 1.

---

## 2. Los 11 del backlog histórico (G2 — ✅)

Estado consolidado contra la [tabla maestra del 2026-08-04](2026-08-04-listado-problemas-fixes-reverificado.md).
**Ningún ⚠️ PARCIAL puede sobrevivir**: parcial no es terminal, es un pendiente disfrazado.

| # | Problema | Estado 2026-08-04 | **Estado al cierre** | Dónde |
|---|---|---|---|---|
| C9 | Secretos/PII en el árbol | ✅ RESUELTO | ✅ **RESUELTO** | — |
| C4.2 | `/auth/*` sin rate-limit | ✅ RESUELTO | ✅ **RESUELTO** | #229 |
| D-E | Logging / fingerprint / DLQ / autohealing | ✅ núcleo | ✅ **CERRADO** — B1 mergeado: `print()` con PHI → `log_evento()`, gate `COPILOTO_LOG_STT_TEXT` (default OFF), barrido de clase 44 sitios | **#407** |
| **C4.1** | **`/auth/signup` abierto** | ⚠️ PARCIAL | ✅ **CERRADO Y VERIFICADO EN PROD** | **#399** — §3 |
| **C6** | Chat/listas sin cota (frontend) | 🔴 VIVO | ✅ **CERRADO Y VERIFICADO EN `main`** | #393 |
| C5 | Acoplamiento por string (no FK) | ⚠️ PARCIAL | ✅ **CERRADO como canario** — B4 llevó `trabajo_store.py` a 5/5 sitios cubiertos. La FK real sigue **MAYOR, escalada al operador** (no es deuda silenciosa: es una decisión pendiente) | **#407** |
| C3 | Doc de presupuesto fuera de Temporal | ⚠️ PARCIAL | 🟡 **D2** — diferido con dueño y fecha | deuda |
| C8 | Firma que ignora `payload` | 🔴 VIVO | ✅ **CERRADO** — B3: `make_signal_anulacion` alineado con su gemelo; barrido de clase confirmó 2 sitios no-test, ambos sanos | **#407** |
| **D-A** | **4 errores tragados sin log** | 🔴 1/5 | ✅ **CERRADO 5/5** — 4 en #407 con fingerprint (`tool_catalog.py:1599` además deposita en `copiloto_traumas`, cerró de paso C2 del lote C) + el 5º en **#424** → §2.bis | **#407 + #424** |
| C1 | Postgres sin pool / N+1 | 🔴 VIVO | ✅ **CERRADO** — C4: pool detrás de `conn_factory`; Fase D lo re-verificó **sin matices** | **#415** |
| C2 | Writes externos no idempotentes | 🔴 VIVO | ✅ **CERRADO** — C1 del lote: `idem_key` en la ruta de cobro MP, con control negativo (`gw.calls == 1`); 16 tests | **#412** |
| C7 | Composio síncrono sin cache | 🔴 VIVO | 🟡 **D1** — diferido con dueño y fecha | deuda |
| D-B | Timeout Composio | 🟢 BAJO | 🟢 **BAJO** — SDK ya trae 60s | — |

**Movimiento del ciclo: de 11 filas, 9 quedan cerradas-y-verificadas** (7 con PR + evidencia, C9 y
C4.2 ya lo estaban), **2 son deuda con dueño y fecha** (C3→D2, C7→D1) y **1 sigue roja: D-A.**

### 2.bis · La última fila, y por qué importa mucho más que su tamaño

A las 20:39, verificado leyendo el archivo en `origin/main` —no el registro—,
`motor/clients/agent/providers/mercadopago_gateway.py:119` seguía así:

```python
except Exception:  # noqa: BLE001 (InvalidWebhookSignatureError u otra → inválida)
    return False
```

**El fix era de líneas.** Lo que vale es cómo sobrevivió: el registro de deuda le puso como disparador
*«junto con D-A del lote B»*, y el mensaje de commit de #407 lo re-difirió *«a lote C»*. **Los dos
disparadores se cumplieron** —lote B mergeó a las 15:40, lote C cerró a las 18:12— y el ítem no se
movió, porque un disparador cumplido **no avisa**: hay que ir a buscarlo. Backend cerró su ciclo §G6
declarando la cola vacía **de buena fe**; la cola de `abierto/`+`en-curso/` estaba vacía, la del
registro versionado no.

Se detectó al reconciliar este informe, bajó como contrato a backend a las 20:39, y **backend la cerró
a las 21:00 en #424** — 21 minutos. Ese contraste es el dato: el trabajo costaba minutos, la
*detección* costó dos deferimientos y una reconciliación manual.

**Cómo quedó cerrada** (importa, porque un log mal puesto acá sería peor que el silencio): el
fail-closed **no se tocó** —sigue `return False`, que es lo correcto y lo que la Pasada 1 confirmó
seguro—; sólo se agregó `log_error_evento` con el `reason` del SDK, que distingue
`SIGNATURE_MISMATCH` de `TIMESTAMP_OUT_OF_TOLERANCE` **sin** meter la firma cruda en el log. Una
firma inválida por secret rotado y una por ataque ya no producen el mismo silencio.

**Y la causa organizativa quedó cerrada como instrumento, no como lección** — ver §5.4: el registro
tiene ahora un bloque `DEUDA-VIVA` legible por máquina y `scripts/deuda-check.sh` lo evalúa dentro del
gate de vigilancia que corre cada 3 minutos. Con D7 en `abierto` esa alarma habría sonado a las 15:40.

⚠️ **Corrección de etiqueta detectada en la misma reconciliación.** El registro de deuda anota a **D5**
(8 endpoints AFIP sin caso hostil HTTP) y a **D7** (este `except`) como **P1**; los informes de origen
los clasifican a ambos como **P2** de la Pasada 1 (H-2 y H-4). El registro está mal etiquetado. La
consecuencia práctica: **D5 es P2 con dueño ⇒ NO bloquea G3**; D7 sí lo bloquea, pero **no por su
etiqueta propia (P2), sino porque es una instancia de D-A, que es P1 (Pasada 2, H-3)**. Vale
distinguirlo: es exactamente el error de
[[clasificar-un-hallazgo-por-su-etiqueta-y-no-por-su-codigo]], y esta vez se cazó antes de propagarse.

---

## 3. C4.1 en detalle — el P0 del ciclo

Es el único ítem que bloqueaba la beta por sí solo (G4), y el que más enseñó.

**El agujero era doble, no simple.** Además de `/auth/signup` sin barrera, `POST /auth/oauth/ensure-tenant`
autoprovisionaba un tenant para **cualquier** cuenta de Google del planeta. El chequeo de "provider
OAuth externo" que ya existía **no era una barrera de alta**: decía *por dónde entró* la persona, no
*si estaba invitada*. Y `disable_signup:true` de GoTrue no tapaba nada, porque `signup_and_provision`
entra por la admin API y lo bypassa por diseño.

**Ambas vías quedaron fail-closed** — sin la env, no entra nadie. Es deliberado: un gate que "no
aplica si falta la variable" reintroduce el agujero entero en el primer deploy que la olvide, y falla
**abierto**, que es el modo en que nadie se entera.

| Gate | Evidencia |
|---|---|
| Gate propio 5/5 | recibo `.ci-recibos/9160900f…json` · backend **1853 passed / 26 skipped** en el VPS |
| Test adversarial de integración | **7 nuevos** (4 signup + 3 ensure-tenant) — precondición dura de `CLAUDE.md` §Seguridad |
| **Control negativo** | desarmando ambos gates, **6 de los 7 se ponen en rojo**: verifican, no confirman |
| Adversarial contra **prod viva** | alta sin token → **403** · token equivocado → **403** |
| Control positivo | smoke E2E **34/35 BETA-READY**: alta con token → 200 + tenant, login, `/me`, chat y ReAct verdes |
| Sin regresión | verificado en **ambos** clientes que ningún tenant ya provisionado pasa por la allow-list |

**Ejecutado por planificación, no por backend**, con la ruptura de roles declarada en el buzón — el
P0 llevaba ~105 min sin dueño. Backend leyó el aviso y respetó la toma.

⚠️ **Consecuencia operativa viva:** la allow-list de prod tiene **un solo email**
(`e2e-device@copiloto.test`). **Ningún tester nuevo puede darse de alta hasta que el operador agregue
emails** a `COPILOTO_SIGNUP_ALLOWLIST`. Está declarado en la salida del paso 3.6 de `deploy.sh`.

---

## 4. Gates del DoD

| Gate | Estado | Evidencia |
|---|---|---|
| **G1** — 3 pasadas con informe | ✅ | §1 |
| **G2** — los 11 en estado terminal | ✅ | §2 — **10 cerradas y verificadas · 2 deuda con dueño y disparador** (C3→D2, C7→D1). Ningún ⚠️ PARCIAL sobrevivió |
| **G3** — hallazgos nuevos P0/P1 arreglados, P2 con dueño | ✅ | **Los 5 P1, cerrados con evidencia**: H-1 adversariales concepto/trabajo #412 · C1 pool #415 · C2 idempotencia MP #412 · F-C8 #407 · **D-A 5/5** #407+#424. Los 10 P2 + 1 P3 con dueño y disparador en el [registro](2026-08-12-DEUDA-diferidos-con-dueno-y-fecha.md), ahora también en su bloque `DEUDA-VIVA` |
| **G4** — C4.1 cerrado | ✅ | §3 |
| **G5** — gate propio verde con recibo | ✅ | `9160900f…json` (C4.1) · `c54ae83d` en `main` · lote C con gate 5/5 **dos veces** (rama + worktree limpio post-merge) y Actions 6/6 |
| **G6** — desplegado + smoke e2e contra prod | ✅ | 34/35 BETA-READY con el usuario canónico · e2e §G6 del ciclo cerrado **5/6**, el 6º (durabilidad, E3) anclado en el registro con disparador ejecutable |
| **G7** — cero regresión funcional | ✅ | smoke completo verde: login, `/me`, chat, ReAct, MP, Composio, refresh |
| **G8** — este informe | ✅ | completo: §2 y §3 reconciliados contra `origin/main`, no contra el registro |

**8 de 8.** El camino importa tanto como el número: a las 20:45 esto decía **5 de 8**, y los 3
abiertos ya no dependían de "los lotes B y C" sino de **un `except` de dos líneas, en un archivo, de
un dueño**. Ese es el rendimiento de reconciliar — y por qué el paso de 🔴 a ✅ tardó 21 minutos en
vez de un sprint.

---

## 5. Lo que la ronda enseñó sobre sí misma

Tres lecciones de **instrumento**, no de producto. Valen más que los hallazgos porque afectan a todas
las rondas siguientes.

**1. El watchdog veía al que llega tarde, nunca al que no vino.** El monitor de parálisis medía
*antigüedad de transcript*, así que un rol **sin sesión abierta** —sin transcript que envejecer— se
colaba por un `continue` y el gate reportaba "sin novedades" mientras el P0 pasaba 105 min sin dueño.
Se arregló con un criterio **relacional** (contrato emitido después de la última señal del rol) más
una **ventana de gracia** de 15 min, porque la primera versión disparaba sobre cada mensaje recién
escrito — y una alarma que suena siempre enseña a saltearla. PRs #394 y #400, 9/9 con controles
positivos y negativos, corriendo dentro del gate.

**2. Un instrumento intermitente fabrica una excusa lista.** El flake del job `mobile` (**D9**) se
declaró cerrado y **volvió con el fix ya aplicado**. Su costo nunca fue la falla en sí: es que
*enseña a re-correr hasta verde*, y una vez instalado "es el flake conocido" como explicación
disponible, la próxima regresión real pasa con la misma frase. **D9 quedó reabierta**, con la regla
de que un `mobile` rojo se **discrimina** (re-correr aislado), no se atribuye por parecido.

**3. Un proceso largo pipeado por `tail` borra la evidencia del fallo.** Pasó tres veces en el mismo
ciclo: el gate y el deploy se lanzaron en background con la salida truncada, y el texto del fallo de
`mobile` se perdió — la corrida verde siguiente borró a la roja. Un gate largo va a **archivo
completo**.

**4. Un disparador que se cumple no avisa a nadie.** (Añadida al reconciliar, 20:45.) El registro de
deuda es bueno guardando *qué* falta, *de quién* es y *cuándo* arranca — y no tiene **ningún**
mecanismo que grite cuando el "cuándo" ocurre. D-A quedó 4/5 con su resto difiriéndose dos veces a
disparadores que **ambos se cumplieron el mismo día**; D5 igual (*«tras el lote C»*, cumplido a las
18:12). Nadie falló: backend miró su cola —`abierto/` + `en-curso/`— y estaba vacía. **La cola vive en
dos lugares y sólo uno se mira solo.** Es la misma familia que las tres de arriba, en su versión más
silenciosa: acá el instrumento **ni siquiera confirma**, directamente no se ejecuta.

> **Cerrada como instrumento, no como lección** (2026-08-12 21:01). Escribir «acordate de releer el
> registro al cerrar un lote» habría sido otra regla que depende de buena voluntad — exactamente
> [[la-excepcion-documentada-que-nunca-disparo]]. En vez de eso el registro tiene ahora un bloque
> `DEUDA-VIVA` legible por máquina y `scripts/deuda-check.sh` lo evalúa dentro de
> `vigilancia-check.sh`, que ya corre cada 3 minutos. Reusa el idioma de `COLA-VIVA`/`cola-check.sh`,
> que resolvió este mismo problema para los hitos el 2026-07-23. **Control positivo:** con D7 puesta
> en `abierto` el gate devuelve exit 1 nombrándola; con D7 en `en-curso` vuelve a silencio. 9/9 en
> `test-deuda-disparador-cumplido.sh`, dentro del job `lint` del gate.

Las cuatro son la misma familia: **instrumentos que confirman en vez de verificar**, que ya costó un
frente entero en este repo.

---

## 6. Qué falta, con dueño y disparador

Actualizada 2026-08-12 20:45. Lo tachado cerró en el ciclo.

| Qué | Dueño | Disparador | Estado |
|---|---|---|---|
| ~~**Lote B** (B1 · B2 · B3 · B4)~~ | backend | — | ✅ **#407**, Fase D verificada |
| ~~**Lote C** (doble cobro · catch-all ReAct · adversariales · pool)~~ | backend | — | ✅ **#412 + #415**, Fase D verificada (C4 «sin matices») |
| ~~**Fase D** — re-verificar con control negativo~~ | auditoría | — | ✅ corrida sobre B y C; produjo **D11** (RLS `FORCE` enmascara el control negativo de C3) |
| ~~**D-A, el 5º `except`**~~ | backend | — | ✅ **#424, 21:00** — cerró G2, G3 y G8 |
| **D5** — 8 endpoints AFIP/presupuestos sin caso hostil HTTP | **backend** | ✅ cumplido (cierre de lote C, 18:12) | 🟡 P2 con dueño — no bloquea G3 |
| **ADR-002** — `idem_key` en `composio_gateway.execute` | **operador** → backend | aprobación del ADR (**MAYOR**) | ⏸️ spike hecho (#418), decisión pendiente |
| **E3** — durabilidad ante restart del worker | **backend** | próximo deploy de código real, por su propio mérito | ⏸️ anclada, sin atajo |
| **Las 3 cards `*_propuesto` de web** (gasto · cliente · ingreso) | **frontend** | ✅ cumplido — emisión confirmada en `tool_catalog.py:725/798/1072` | 🟡 en curso |
| **D9** — flake del `mobile` | frontend | próximo ítem suyo | 🟡 reabierta |
| **Agregar testers a la allow-list** | **operador** | cuando quiera abrir la beta | ⏸️ 1 solo email hoy |
| ~~**Cerrar este informe**~~ | planificación | — | ✅ **cerrado 21:05** — este documento |

---

*Informe generado por la sesión de planificación. Toda afirmación de estado de este documento tiene
evidencia citada: recibo de gate, PR, o comando contra el sistema vivo. Ninguna es autoevaluación.*
