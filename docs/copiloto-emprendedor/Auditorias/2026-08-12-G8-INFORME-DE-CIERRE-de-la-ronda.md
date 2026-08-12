# G8 · Informe de cierre de la ronda de auditorías — 2026-08-12

> **Qué es esto.** El **G8** del [DoD del ciclo](2026-08-12-DoD-cierre-auditorias-y-fixes.md): informe
> único que consolida las 3 pasadas, el estado final de los 11 hallazgos del backlog histórico y los
> hallazgos nuevos. Sustituye a leer 19 archivos sueltos.
>
> **Estado:** 🟡 **PARCIAL — G2/G3 abiertos.** Este documento se completa cuando backend mergee los
> lotes B y C; sus filas están marcadas y **no se declaran cerradas por anticipado**. Un informe de
> cierre que se escribe antes de que el trabajo termine es exactamente el "aprobar por ritual" que el
> canon prohíbe.

---

## 0. Titular

**La ronda no encontró ningún P0 nuevo.** Tres pasadas independientes con modelo caro sobre
seguridad, robustez y eficiencia devolvieron **0 P0** cada una. Lo más grave del ciclo —el alta
abierta, C4.1— **no era un hallazgo nuevo: era una fila del backlog histórico marcada ⚠️ PARCIAL
desde el 2026-08-04**, esperando una decisión del operador que ya estaba tomada.

Esa es la conclusión que importa y no es cómoda: **el riesgo real no estaba escondido, estaba
registrado y sin dueño.** La auditoría no lo descubrió; lo que faltaba era ejecución.

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

## 2. Los 11 del backlog histórico (G2 — 🟡 parcial)

Estado consolidado contra la [tabla maestra del 2026-08-04](2026-08-04-listado-problemas-fixes-reverificado.md).
**Ningún ⚠️ PARCIAL puede sobrevivir**: parcial no es terminal, es un pendiente disfrazado.

| # | Problema | Estado 2026-08-04 | **Estado al cierre** | Dónde |
|---|---|---|---|---|
| C9 | Secretos/PII en el árbol | ✅ RESUELTO | ✅ **RESUELTO** | — |
| C4.2 | `/auth/*` sin rate-limit | ✅ RESUELTO | ✅ **RESUELTO** | #229 |
| D-E | Logging / fingerprint / DLQ / autohealing | ✅ núcleo | ✅ **núcleo en prod**; el resto "print PHI" → B1 | lote B |
| **C4.1** | **`/auth/signup` abierto** | ⚠️ PARCIAL | ✅ **CERRADO Y VERIFICADO EN PROD** | **#399** — §3 |
| **C6** | Chat/listas sin cota (frontend) | 🔴 VIVO | ✅ **CERRADO Y VERIFICADO EN `main`** | #393 |
| C5 | Acoplamiento por string (no FK) | ⚠️ PARCIAL | 🟡 **B4** (canario a `trabajo_store.py`); la FK real es **MAYOR**, escalada | lote B |
| C3 | Doc de presupuesto fuera de Temporal | ⚠️ PARCIAL | 🟡 **D2** — diferido con dueño y fecha | deuda |
| C8 | Firma que ignora `payload` | 🔴 VIVO | 🟡 **B3** (~1 línea, clase CERRADA: 1 instancia) | lote B |
| D-A | 4 errores tragados sin log | 🔴 1/5 | 🟡 **B2** | lote B |
| C1 | Postgres sin pool / N+1 | 🔴 VIVO | 🟡 **C4** — va último, es el más grande | lote C |
| C2 | Writes externos no idempotentes | 🔴 VIVO | 🟡 **C1 del lote** — va primero: **es plata** | lote C |
| C7 | Composio síncrono sin cache | 🔴 VIVO | 🟡 **D1** — diferido con dueño y fecha | deuda |
| D-B | Timeout Composio | 🟢 BAJO | 🟢 **BAJO** — SDK ya trae 60s | — |

**Movimiento del ciclo: 2 filas pasaron a cerradas-y-verificadas (C4.1 y C6), y ningún ⚠️ PARCIAL
quedó como tal** — cada uno se convirtió en ítem de lote con dueño o en fila de deuda con fecha.
**G2 cierra cuando los lotes B y C mergeen.**

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
| **G2** — los 11 en estado terminal | 🟡 | §2 — cierra con lotes B/C |
| **G3** — hallazgos nuevos P0/P1 arreglados, P2 con dueño | 🟡 | los 10 P2 + 1 P3 **ya tienen dueño y fecha** en el [registro de deuda](2026-08-12-DEUDA-diferidos-con-dueno-y-fecha.md); los 5 P1 están en lotes B/C |
| **G4** — C4.1 cerrado | ✅ | §3 |
| **G5** — gate propio verde con recibo | ✅ | `9160900f…json` (C4.1) · `c54ae83d` en `main` |
| **G6** — desplegado + smoke e2e contra prod | ✅ | 34/35 BETA-READY con el usuario canónico |
| **G7** — cero regresión funcional | ✅ | smoke completo verde: login, `/me`, chat, ReAct, MP, Composio, refresh |
| **G8** — este informe | 🟡 | se completa con G2/G3 |

**5 de 8 cerrados. Los 3 abiertos dependen del mismo disparador: que backend mergee los lotes B y C.**

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

Las tres son la misma familia: **instrumentos que confirman en vez de verificar**, que ya costó un
frente entero en este repo.

---

## 6. Qué falta, con dueño y disparador

| Qué | Dueño | Disparador |
|---|---|---|
| **Lote B** (B1 print PHI · B2 D-A · B3 C8 · B4 canario C5) | **backend** | ✅ desbloqueado — C4.1 en prod |
| **Lote C** (doble cobro · catch-all ReAct · tests adversariales · pool) | **backend** | lote B mergeado |
| **Fase D** — re-verificar los fixes con control negativo | **auditoría** | lote B mergeado (ya está armada, esperando) |
| **D9** — flake del `mobile` | **frontend** | próximo ítem suyo |
| **Agregar testers a la allow-list** | **operador** | cuando quiera abrir la beta |
| **Completar este informe (G2/G3/G8)** | **planificación** | lotes B y C mergeados |

---

*Informe generado por la sesión de planificación. Toda afirmación de estado de este documento tiene
evidencia citada: recibo de gate, PR, o comando contra el sistema vivo. Ninguna es autoevaluación.*
