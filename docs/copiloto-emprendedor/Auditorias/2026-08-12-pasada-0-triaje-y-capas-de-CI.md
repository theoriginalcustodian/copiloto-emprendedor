# Pasada 0 — Triaje de la deuda abierta + capas de CI

> **Estado:** PLAN, sin ejecutar. **Índice:** [ESTRATEGIA](2026-08-12-ESTRATEGIA-tres-pasadas-de-auditoria.md)
> **Bloqueante:** sí. Las pasadas 1 y 2 no arrancan hasta que ésta cierre.
> **Costo estimado:** bajo (horas, no días). **Muta código:** sí, mínimo y acotado.

---

## Por qué existe esta pasada

Dos razones, ambas verificadas contra `origin/main` @ `debe5623`:

1. **Hay 9 hallazgos abiertos de la auditoría del 2026-08-04** cuyo estado real hoy nadie conoce.
   Entre esa fecha y hoy pasaron ~35 PRs (frente de manejo de errores, SOP, ODOBI8, CTXW1, CAL1).
   Algunos de esos 9 pueden haber muerto solos. Otros pueden haber empeorado. **Ninguno fue
   re-verificado.** Si las pasadas 1 y 2 arrancan sin este triaje, van a reportar deuda de agosto
   mezclada con hallazgos nuevos, sin forma de distinguirlos.

2. **El CI no tiene ninguna capa de seguridad automática.** Es la parte del plan con mejor relación
   impacto/costo, y la única que no depende de un modelo: son gates deterministas que corren en cada
   push, para siempre. Una auditoría es una foto; un gate es una garantía.

---

## Parte A — Triaje de los 9 hallazgos abiertos

### Método (no negociable)

Para cada hallazgo: **verificar contra el código pusheado en `origin/main`**, no contra el working
tree, no contra el recuerdo, no contra el documento de agosto. El documento del 2026-08-04 ya usó este
método (`git grep` sobre código pusheado) — se repite igual.

Estado resultante, **binario y con evidencia** (`path:línea`):

- ✅ **CERRADO** — el fix está en `main`. Se cita el commit o el `path:línea` que lo prueba.
- 🔴 **VIVO** — sigue reproducible. Se cita el `path:línea` actual.
- ⚠️ **MUTADO** — cambió de forma o de lugar. Se describe la forma nueva.

### Los 9 a verificar

| ID | Problema | Dónde mirar | Fix declarado en 2026-08-04 |
|---|---|---|---|
| **C8** | Firma que ignora `payload` | `mp_web.py` — `POST /mp/webhook` es el candidato natural | 1 línea, copiar de la gemela |
| **C1** | Postgres sin pool / N+1 | las 2 raíces de conexión | Pool en 2 raíces o PgBouncer |
| **C2** | Writes externos no idempotentes | Composio + MercadoPago | Propagar patrón `cobro_store` + `ext_ref` derivado |
| **C6** | Chat/listas sin cota | `apps/copiloto-web/` + `apps/mobile/` | Cap `slice(-N)` + FlatList |
| **C7** | Composio síncrono sin cache | cliente Composio | TTL-cache 30-60s per-tenant |
| **D-B** | Timeout Composio | cliente Composio | Tunear explícito o documentar |
| **C4.1** | `/auth/signup` abierto | `web.py` — `POST /auth/signup` | Gate real backend (invite-token) — decisión operador #3 |
| **C5** | Acoplamiento por string (no FK) | schema | Canario cubre 2/5 sitios; FK real es MAYOR |
| **C3** | Presupuesto fuera de Temporal | `presupuestos_web.py` | Loguear + depositar el `motivo` en la DLQ |

### Qué se arregla YA en esta pasada, y qué no

**Se arregla acá** (barato, sin diseño, sin decisión pendiente):

- **C8** — fix de 1 línea ya identificado. Es una **verificación de firma de webhook**: si sigue vivo,
  es una vulnerabilidad de seguridad real y no espera a la Pasada 1.
- **D-B** — timeout explícito o una línea de documentación.

**No se arregla acá** (requiere diseño, o es MAYOR, o depende de decisión del operador):

- C1 (pool/PgBouncer) → insumo de la **Pasada 2**, es un problema de robustez bajo carga.
- C2, C7 → insumo de la **Pasada 2** (idempotencia y latencia de integraciones).
- C6 → insumo de la **Pasada 3** (cota de listas en frontend).
- C5 → es **MAYOR** (migración de schema a FK). Se escala al operador, no se decide acá.
- C4.1 → hay una decisión de operador pendiente (invite-token). Se escala, no se asume.

> **Regla que aplica:** todo hallazgo que quede vivo y no se arregle en esta pasada sale con **dueño +
> fecha + entrada de deuda**. Nada invisible ni impago (canon 6).

### Entregable A

Un documento `2026-08-12-triaje-hallazgos-2026-08-04.md` con la tabla de los 9, su estado binario, la
evidencia `path:línea` de cada uno, y el destino de cada vivo (pasada que lo toma, o dueño+fecha).

Además: **arreglar el `README.md` de esta carpeta**, que hoy referencia como "plan accionable vigente"
un archivo (`2026-08-06-plan-de-implementacion.md`) que no existe en `main`.

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

- [ ] Los 9 hallazgos tienen estado binario re-verificado contra `origin/main`, con `path:línea`.
- [ ] C8 arreglado y con test, **o** documentado como ya cerrado con evidencia del commit.
- [ ] Todo hallazgo vivo no arreglado tiene pasada destino, o dueño + fecha.
- [ ] Secret scanning corriendo en el gate y fallando ante un secreto plantado (**control positivo
      obligatorio**: probar que el gate rompe con un secreto de prueba; un scanner que nunca falló es
      un scanner no verificado).
- [ ] Escaneo de dependencias activo con umbral y baseline definidos.
- [ ] `README.md` de `Auditorias/` corregido (ya no apunta a un archivo inexistente).
- [ ] Gate completo en verde con las capas nuevas.

## Lo que esta pasada NO hace

- No busca vulnerabilidades nuevas (eso es Pasada 1).
- No busca bugs nuevos (eso es Pasada 2).
- No refactoriza (eso es Pasada 3).
- No decide C5 (FK, MAYOR) ni C4.1 (invite-token): **los escala al operador**.
