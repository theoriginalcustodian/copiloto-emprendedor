# Pasada 0 — Triaje de la deuda abierta + capas de CI

> **Estado:** PLAN, sin ejecutar. **Índice:** [ESTRATEGIA](2026-08-12-ESTRATEGIA-tres-pasadas-de-auditoria.md)
> **Bloqueante:** sí. Las pasadas 1 y 2 no arrancan hasta que ésta cierre.
> **Costo estimado:** bajo (horas, no días). **Muta código:** sí, mínimo y acotado.

---

## ⚠️ Parte A — YA HECHA por el PR #386 (`4ecd699d`, 2026-08-12 10:20)

Este documento se escribió proponiendo un triaje de los hallazgos abiertos. **Mientras se redactaba,
otra sesión hizo exactamente ese triaje** y lo mergeó: `2026-08-12-reverificacion-beta.md` — los 11
ítems verificados contra `main @ debe5623` con 4 sub-agentes headless paralelos y evidencia
`path:línea`, mismo método que se iba a usar acá.

**No se repite.** La Parte A de esta pasada se sustituye por: *leer ese documento y usarlo como
insumo*. Lo que sigue vigente de esta pasada es la **Parte B (capas de CI)**, que nadie hizo.

**Resultado del triaje ajeno, que este plan adopta:** 3 resueltos · 3 parciales · 6 vivos · 1 bajo.
El sprint de beta **no cerró ningún ítem**. Detalle y asignación a pasadas, en la
[ESTRATEGIA §H2](2026-08-12-ESTRATEGIA-tres-pasadas-de-auditoria.md).

### Lo único que se rescata de la Parte A original: el destino de cada vivo

| ID | Estado | Destino |
|---|---|---|
| **C4.1** `/auth/signup` abierto | 🔴 VIVO, **bloqueante de beta** | **P0 fuera de banda** — no espera a ninguna pasada |
| C8 firma **de función** que descarta `payload` | 🔴 VIVO | **Pasada 2 / F3** — es *corrección*, no seguridad (ver corrección abajo) |
| Print PHI (`agent_activities.py`) | 🔴 VIVO | **Pasada 1** — fuga de datos personales a logs |
| C1 pool / N+1 | 🔴 VIVO | Pasada 2 |
| C2 idempotencia · C7 cache Composio · D-B timeout | 🔴/⚠️/🟢 | Pasada 2 |
| C3 DLQ del presupuesto · D-A 4 errores tragados | ⚠️/🔴 | Pasada 2 |
| C6 listas sin cota | 🔴 VIVO | Pasada 3 |
| C5 acople por string (FK) | ⚠️ PARCIAL | **MAYOR — se escala al operador**, no se decide acá |

---

## Por qué sigue existiendo esta pasada: la Parte B

**El CI no tiene ninguna capa de seguridad automática.** Es la parte del plan con mejor relación
impacto/costo, y la única que no depende de un modelo: son gates deterministas que corren en cada
push, para siempre. **Una auditoría es una foto; un gate es una garantía.**

Que el sprint de beta haya cerrado 0 de 11 hallazgos en ~325 commits es, justamente, el argumento:
sin un gate que lo fuerce, la deuda no se paga sola.

---

## Parte B — Capas de CI que hoy no existen

### Estado verificado

| Capa | Hoy | Evidencia |
|---|---|---|
| Escaneo de dependencias | ❌ **desactivado a propósito** | `npm install --no-audit --no-fund` en `ci/lint.sh`, `ci/core.sh`, `ci/web.sh`, `ci/mobile.sh` |
| Secret scanning | ❌ ninguno | sin `gitleaks`/`trufflehog` en ningún script ni en `tests.yml` |
| SAST | ❌ ninguno | sin `bandit`/`semgrep` |
| Typecheck Python | ❌ ninguno | sin `mypy`/`pyright` (el backend son 109 módulos `.py`) |
| Lint JS/TS | ✅ existe | `eslint packages/core/src apps/mobile/src apps/copiloto-web/src` |
| Tests backend contra Postgres real | ✅ existe | `ci/backend.sh` en el VPS |

### Qué se agrega, en orden de impacto/costo

1. **Secret scanning** — máxima prioridad. El repo es **público desde 2026-08-06**: un `.env` mal
   commiteado es público al instante y hay que asumirlo comprometido, no sólo borrarlo. La auditoría
   histórica dio 0 secretos, pero **no hay nada que impida el próximo**. Debe correr sobre el commit
   entrante *y* fallar el push (encaja con el `.githooks/pre-push` que ya existe).

2. **Escaneo de dependencias** — quitar `--no-audit` es literalmente borrar un flag. Requiere decidir
   el umbral de severidad que rompe el build (propuesta: `high`) y qué hacer con los hallazgos
   preexistentes (propuesta: snapshot inicial como baseline, romper sólo ante regresión). Sumar
   `pip-audit` para las deps de Python de `requirements.txt`.

3. **SAST Python (`bandit`)** — barato, ruidoso al principio. Mismo patrón de baseline.

4. **Typecheck Python** — el de mayor esfuerzo de los cuatro (109 módulos sin anotar del todo). Va
   **último** y probablemente en modo incremental. No bloquea esta pasada.

> **Restricción de diseño:** cada capa nueva entra al **gate propio** (`scripts/ci/`), no sólo a
> GitHub Actions. ADR-001 fijó que la definición de la suite vive en `scripts/ci/*.sh` y Actions es
> respaldo; `scripts/ci/no-drift.sh` bloquea que se desincronicen.

### Entregable B

- Scripts nuevos en `scripts/ci/` integrados a `scripts/gate.sh`, con su baseline inicial.
- El `tests.yml` espejado (o el drift-check lo va a rechazar).
- Un recibo `.ci-recibos/<sha>.json` con las capas nuevas corriendo en verde.

---

## Definition of Done — Pasada 0

- [x] ~~Hallazgos re-verificados contra `origin/main` con `path:línea`~~ — **hecho por el PR #386**
      (`2026-08-12-reverificacion-beta.md`).
- [x] ~~Todo hallazgo vivo tiene pasada destino~~ — tabla de destinos arriba.
- [ ] **C4.1 cerrado** (P0 fuera de banda): invite-token fail-closed + allow-list app-side en
      `ensure-tenant`, **con test adversarial** que ejercite el caso hostil (alguien sin invite intenta
      registrarse → denegado). Sin ese test el control queda `[UNVERIFIED]` y no cierra.
> ### ⚠️ Corrección de este documento (2026-08-12, planificación)
>
> La primera versión clasificó **C8** como *seguridad* (verificación de firma criptográfica en
> `POST /mp/webhook`) y lo mandó a la Pasada 1. **Era un error mío de lectura.** Verificado contra
> `origin/main`, C8 es una **firma de función** Python en `apps/copiloto/web.py`:
>
> ```python
> def make_signal_anulacion(temporal_client):
>     async def signal_anulacion(cliente_id, anulacion_id, nombre, payload) -> None:
>         handle = temporal_client.get_workflow_handle(_wf_id_anulacion(cliente_id, anulacion_id))
>         await handle.signal(nombre)          # ← acepta `payload` y LO DESCARTA
> ```
>
> Su gemelo sano `make_signal_factura` **sí** reenvía el `payload`. O sea: **pérdida silenciosa de
> datos en una señal de Temporal**, no una vulnerabilidad criptográfica. Reasignado a
> **Pasada 2 / F3 (durabilidad de Temporal)**. La verificación de firma HMAC del webhook de
> MercadoPago **sigue siendo objetivo legítimo de la Pasada 1**, pero es un asunto distinto y aún
> no verificado — no arrastra la etiqueta "confirmado VIVO" de C8.
>
> *Por qué queda escrito en vez de borrado:* un plan corregido en silencio no enseña nada, y las
> otras sesiones ya leyeron la versión vieja.
- [ ] Secret scanning corriendo en el gate y fallando ante un secreto plantado (**control positivo
      obligatorio**: probar que el gate rompe con un secreto de prueba; un scanner que nunca falló es
      un scanner no verificado).
- [ ] Escaneo de dependencias activo con umbral y baseline definidos.
- [ ] Gate completo en verde con las capas nuevas.

## Lo que esta pasada NO hace

- No busca vulnerabilidades nuevas (eso es Pasada 1).
- No busca bugs nuevos (eso es Pasada 2).
- No refactoriza (eso es Pasada 3).
- No decide C5 (FK, MAYOR) ni C4.1 (invite-token): **los escala al operador**.
