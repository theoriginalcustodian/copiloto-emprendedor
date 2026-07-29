# 03 — REPORTE DE IMPLEMENTACIÓN · Frente de manejo de errores

> **2026-07-29.** Qué quedó **realmente** implementado del plan, con la evidencia que lo sostiene y lo
> que **no** se hizo, con su disparador. Es el documento de cierre del tramo ejecutable; el plan
> completo (incluidas las Fases 2 y 3, diseñadas y en pausa) vive en
> [`01-PLAN-ejecutable.md`](01-PLAN-ejecutable.md).
>
> **Regla de este reporte:** cada afirmación de "hecho" lleva commit o comando. Mi autoevaluación no
> es evidencia — y este frente produjo la mejor prueba de por qué (§4).

---

## 1. Qué se ejecutó — el resumen en una tabla

| Bloque | Estado | Entregado en |
|---|---|---|
| **Fase 0** — cerrar los fail-open (10 de 12 puntos del mapa) | ✅ | PR #154 |
| **Fase 0.5** — lo que el mapa de 12 puntos no cubrió | ✅ | PR #156 · el flag en PR #159 |
| **G-2** — gate mecánico (CI completo, censo, drift, gate de import) | ✅ salvo 1 deuda | PR #155 · #156 · #157 |
| **Fase 1** — Captura (fingerprint, log estructurado, taxonomía, latido) | ✅ | PR #156 · #157 |
| **Reconstrucción de la base desde cero** *(no estaba en el DoD)* | ✅ | PR #156 · #158 |
| **Fase 2** — Depositar (DLQ) | ⏸️ diseñada | disparador: features terminadas |
| **Fase 3** — Autosanación en el cluster de Temporal | ⏸️ diseñada | disparador: 30 días de superficie estable |

**14 de 14 ítems del DoD, más dos entregas que no estaban en él y resultaron lo más caro del frente.**

---

## 2. Lo que hoy existe en el repo y antes no

### 2.1 Los ladrillos de captura (Fase 1)

| Archivo | Qué hace | Decisión que no era obvia |
|---|---|---|
| `apps/copiloto/fingerprint.py` | djb2 portado **byte a byte** de ARCA (`err00-djb2-hash.ts:28-36`) | El `& 0xFFFFFFFF` es el equivalente del `>>> 0` de JS. 12 tests de paridad; un vector mal calculado a mano lo cazó el test |
| `apps/copiloto/log_estructurado.py` | `log_error()` JSON a journald | Nivel **`warning`**, no `info` — `.info` no llega a journald. **No** emite `error_message` (PII/fiscal). **Nunca lanza**: un logger que revienta tapa el error que reporta |
| `apps/copiloto/taxonomia_errores.py` | 4 categorías con semántica de acción | **Sin categoría por descarte**: levanta `ErrorSinCategoria`. Un "por descarte" se traga todo caso nuevo en silencio |
| `apps/copiloto/latido.py` | `con_latido()` — heartbeat en las 3 activities largas | El `except asyncio.CancelledError: pass` es correcto **sólo acá**: es la confirmación de que la tarea murió como se le pidió |

### 2.2 Los gates que corren solos

| Gate | Dónde | Qué frena |
|---|---|---|
| CI de 5 jobs sobre **todos** los archivos | `.github/workflows/tests.yml` | Antes corría 11 archivos de una lista hardcodeada. **Sin listas**: una lista es lo que dejó `test_errores_web.py` afuera |
| **Postgres efímero** en el job backend | ídem | Desbloqueó **137 tests que no corrían en ningún lado**, incl. los 8 adversariales de aislamiento cross-tenant |
| Censo de `except` mudos | `scripts/censo-except.py` + `test_censo_except_guard.py` | Falla si sube **y si baja** (baseline `29`): un baseline que sólo mira hacia arriba se desactualiza y miente |
| Gate de import en el deploy | `deploy/copiloto/deploy.sh` (paso 4.9/7) | Los entrypoints **deben** importar antes de reiniciar nada. Probado en las dos direcciones |
| Drift medido contra el **disco**, no el índice | pre-push | PR #155 |

### 2.3 La reconstrucción de la base — lo que no estaba en el DoD

Poner un Postgres virgen en el CI destapó que **`provision.py` nunca pudo construir el schema desde
cero**. Cuatro eslabones, cada uno invisible hasta resolver el anterior; el cuarto **lo introduje yo**
arreglando el segundo. Hoy `deploy/worker/bootstrap-supabase-compat.sql` lo desbloquea.

**Lo que significaba fuera del CI:** el runbook de *"levantar el copiloto en un entorno nuevo"*
—staging, DR, otra región— era **inejecutable**. La memoria de julio decía *"no está probado"*;
resultó peor: era **imposible**.

---

## 3. Evidencia

| Medición | Valor | Dónde |
|---|---|---|
| Suite del VPS | **1143 passed / 138 skipped** (venía de 1108) | `pytest` en `/opt/uc-worker-venv` |
| Suite del CI con Postgres | **1269 passed / 16 skipped** | job `backend` |
| Retest adversarial del modo automático | **0 mentiras · 0 rondas sin medir · 10 intentadas** | `scripts/retest_narra_sin_hacer.py --rondas 10`, LLM real de producción |
| Deploy | verificado **por efecto**: símbolos testigo 0→8/6/5/1, control negativo 0, 73/34/1 ejecuciones en vuelo intactas, 0 `Failed`, 0 `NonDeterministicError` | VPS |

⚠️ **Una corrección al propio criterio:** "suite VPS verde" **no alcanza**. El guard del censo se
saltea en el VPS —el stage es un checkout parcial sin `scripts/`— y sólo corre en CI; por eso el VPS
daba 1143 verde mientras el CI bloqueaba un merge. **Decir "verde" sin decir en cuál entorno oculta el
hueco.**

---

## 4. Lo que este frente enseñó — y que vale más que el código

### 4.1 Nueve instrumentos dieron verde sobre algo roto

En una sola jornada: un `git diff` sin base (1502 líneas falsas), el CLI de `temporal` ausente en la
sesión SSH (0 workflows), un `sed` roto (0 sobrantes), un `tail -6` truncando el log, `tsc --noEmit`
vs `tsc -b`, un `ast.parse` que no valida `__future__`, un `| tail` comiéndose el exit code de un push
fallido, un `KeyError` contado como éxito, y un contador buscando `ActivityTaskCompleted` cuando el
valor real es `EVENT_TYPE_ACTIVITY_TASK_COMPLETED`.

**Tres ceros distintos se vieron idénticos en pantalla.** De ahí la regla del plan: *un cierre sin
control es una afirmación, no una prueba*.

### 4.2 El instrumento que se equivocó dos veces en direcciones opuestas

El retest del modo automático (§2.6 del plan) es el caso límite: **v1 dijo ✅ sin medir nada** (3
rondas reventadas contadas como no-mentira) y **v2 dijo 🔴 con un contador que nunca contaba**. Las dos
salidas se veían plausibles. Recién v3 midió.

La pregunta que lo caza: ***¿qué devolvería este instrumento si lo que mido estuviera roto?*** Si la
respuesta es "lo mismo", no es un instrumento.

### 4.3 Una advertencia escrita no es una defensa

Dos advertencias **correctamente redactadas** —la memoria del provisionado (escrita 6 días antes) y el
encabezado de `mp_indexes.sql` (del 2026-07-03, que describía el modo de fallo palabra por palabra)—
**no evitaron nada**. Lo único que funcionó fue el entorno que ejercita la base virgen en cada PR.

**Conclusión operativa:** cuando algo se puede convertir en gate, el documento es el plan B.

### 4.4 Los cuatro desvíos del DoD, y por qué son sanos

En los cuatro, **el DoD estaba mal y la evidencia lo corrigió**: el flag que no se podía levantar ese
día · el criterio "92/92" que ya había envejecido (el universo real era 108 y 155) · el ítem 1.5 que
**ya estaba implementado y testeado** · las dos reglas de lint descartadas porque gritaban en el caso
normal. Un DoD que nunca se desvía no se está ejecutando contra la realidad.

---

## 5. Deuda abierta — toda con dueño y disparador

| Qué | Disparador |
|---|---|
| Job de lint en el CI | ✅ **saldada** (`7060092`) — entró recién con 0 errores, no antes |
| `no-floating-promises` | Requiere type-aware linting (tsconfig por paquete, CI más lento). Ítem propio |
| `apps/copiloto-web` fuera de los `workspaces` del root | Causa de que sus 457 tests no los corriera nadie. Toca estado compartido por las 3 sesiones → va aparte |
| `status='rejected'` sin test | Ningún executor lo produce hoy; dueño = quien agregue el primero |
| Refresh-on-401 duplicado en dos capas | Cambio cross-package |
| Arreglo **de fondo** del provisionado (reordenar los ensures) | Trabajo en frío; hoy funciona con el bootstrap |
| El grafo sin los últimos commits | El `pre-push` cortó con `httpx.RemoteProtocolError`; se usó `--no-verify` (el bypass que el propio hook documenta). Se salda en el próximo push que complete la ingesta |
| `'modo_automatico_no_disponible'` sigue en `CodigoConflicto` (`errors.ts:71`) sin que el backend lo emita | **Es deliberado, no un olvido:** la app conserva la rama que muestra el motivo si el guard se repone (`PantallaPerfilNegocio.tsx:231,270`), y esa rama necesita el tipo. Se retira junto con la rama, si alguna vez se decide que la pausa no puede volver |
| `0.1d` — `existe_comprobante` fail-closed | 30 días de baseline con log estructurado, sin falsos positivos |

---

## 6. Qué falta, y qué lo destraba

| Bloque | Qué falta | Quién lo destraba |
|---|---|---|
| **Features del producto** | onboarding de clientes, gestión de tiers, soporte por chatbot | el operador (scope) |
| **Fase 2 — DLQ** | diseñada completa en el plan | features terminadas **y** Fase 1 cerrada ✅ |
| **Fase 3 — Autosanación** | diseñada completa; corre **en el cluster de Temporal**, no en GitHub Actions | Fase 2 cerrada **y** 30 días de superficie estable |

**Por qué las Fases 2-3 no se adelantan:** autosanar exige superficie **estable**. Un agente reparando
código que todavía muta automatiza el parche, no la raíz — y con la literatura que mide 54% de trampa
en tests y 31% de tests inadecuados, un autohealing sobre superficie móvil es un generador de deuda
invisible, no de reparaciones.

---

## 7. PRs del frente

| PR | Qué | Estado |
|---|---|---|
| #154 | Fase 0 — cerrar los fail-open + gate de import en el deploy | mergeado |
| #155 | Guard de drift medido contra el disco | mergeado |
| #156 | Fase 0.5 + G-2 + Fase 1 (9 de 14 ítems) — 16 commits | mergeado |
| #157 | Ítem #12 — heartbeat en las 3 activities largas | mergeado |
| #158 | `CREATE SCHEMA IF NOT EXISTS` pide permiso aunque no cree nada | mergeado |
| #159 | Se levanta `MODO_AUTOMATICO_NO_DISPONIBLE` — 0/10 contra el LLM real | ver §1 |
