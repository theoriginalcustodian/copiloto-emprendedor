# Estrategia — tres pasadas de auditoría hacia "listo para producción"

> **Estado:** PLAN APROBADO, sin ejecutar. **Fecha:** 2026-08-12. **Autor:** sesión planificación.
> **Alcance:** deja la app sólida para pruebas y casi lista para producción.
> **Este documento es el índice.** Cada pasada tiene su propio archivo con DoD propio.

---

## 0. Por qué este plan no arranca por "escanear"

El pedido original era "3 auditorías con los 3 plugins de seguridad". El inventario previo
(hecho contra `origin/main` @ `debe5623`, **no** contra el working tree) refutó tres supuestos de esa
formulación. Los cuatro hallazgos que fundamentan el orden de abajo:

### H1 — Los tres comandos no son tres auditorías

| Comando | Qué es realmente |
|---|---|
| `/claude-security:claude-security` | **Único entry point real.** Menú de 3 jobs: *scan codebase* · *scan changes* · *suggest patches* |
| `/claude-security:scan` | Workflow **interno** del anterior. Su propia definición ordena: si un usuario lo tipea suelto, no ejecutar y derivarlo al menú |
| `/security-review` | Built-in **acotado al diff de la rama**. No audita la app; audita cambios pendientes |

Los tres cubren **seguridad**. Para *pulido/eficiencia* y *errores no descubiertos* no hay instrumento
en esa lista: van con `/simplify`, `/code-review`, el loop Fable ya documentado en este repo, y
agentes headless por subsistema.

**Consecuencia de diseño:** `/security-review` no es la pasada 1 — es el **gate de cierre** sobre el
diff acumulado de las tres pasadas.

### H2 — Hay deuda abierta re-verificada, y el sprint de beta no cerró nada de ella

> **Corregido 2026-08-12 ~10:40.** Al escribir la primera versión de este plan, el triaje que se
> proponía como Pasada 0 **no existía**, y `2026-08-06-plan-de-implementacion.md` no estaba en `main`.
> Mientras se redactaba, otra sesión mergeó el **PR #386** (`4ecd699d`) que hizo exactamente ese
> triaje y subió el plan faltante. **La Parte A de la Pasada 0 quedó cubierta por ese trabajo** y este
> plan la toma como insumo en vez de repetirla. La lección de coordinación queda registrada abajo.

El diagnóstico vigente es **`2026-08-12-reverificacion-beta.md`**: los 11 ítems re-verificados contra
`main @ debe5623` con sub-agentes headless y evidencia `path:línea`. **Titular: el sprint de beta no
cerró ningún ítem del backlog de auditoría.**

| ID | Problema | 2026-08-04 | **2026-08-12** |
|---|---|---|---|
| **C4.1** | **`/auth/signup` abierto** | ⚠️ PARCIAL | 🔴 **VIVO — BLOQUEANTE DE BETA** |
| C1 | Postgres sin pool / N+1 | 🔴 VIVO | 🔴 VIVO (propagado a 5 stores nuevos) |
| C6 | Chat/listas sin cota (frontend) | 🔴 VIVO | 🔴 VIVO (reducer duplicado en web) |
| C7 | Composio síncrono sin cache | 🔴 VIVO | 🔴 VIVO |
| C8 | Firma **de función** que descarta `payload` (señal de Temporal, **no** cripto — corregido) | 🔴 VIVO | 🔴 VIVO (caller pasa `None`, sin efecto observable **aún**) → **Pasada 2/F-C8** |
| D-A | 4 errores tragados | 🔴 VIVO | 🔴 VIVO (+ comentarios que justifican el mutismo) |
| Print PHI | `agent_activities.py` | 🔴 VIVO | 🔴 VIVO |
| C2 | Writes externos no idempotentes | 🔴 VIVO | ⚠️ PARCIAL ↑ (`mp_dedup_store` tapa 1 de 2 rutas) |
| C3 | Doc de presupuesto fuera de la DLQ | ⚠️ PARCIAL | ⚠️ PARCIAL ↑ (ya loguea `motivo`; falta DLQ real) |
| C5 | Acoplamiento por string (no FK) | ⚠️ PARCIAL | ⚠️ PARCIAL |
| D-B | Timeout Composio | 🟢 BAJO | 🟢 BAJO |
| C4.2 · C9 · D-E | rate-limit · secretos/PII · núcleo de errores | ✅ | ✅ RESUELTOS |

**Balance: 3 resueltos · 3 parciales · 6 vivos · 1 bajo.**

#### 🔴 C4.1 es lo más urgente de todo este plan

`signup_and_provision()` (`onboarding.py:256`) usa `gotrue.admin_create_user` — la **admin API**, que
**bypassa el `disable_signup:true`** de GoTrue. `SignupIn` (`web.py:543`) no tiene campo de
invite-token, y `/auth/oauth/ensure-tenant` (`web.py:1061`) sólo valida que el provider sea OAuth
externo: **no compara el email contra ninguna allow-list**. `git grep INVITE_TOKEN|SIGNUP_TOKEN|ALLOWED_`
sobre `origin/main` → **0 resultados**.

**Consecuencia, con el repo público:** cualquiera con `curl` crea un tenant facturable, y cualquier
cuenta de Google se autoprovisiona. Es incompatible con la orden de "un solo usuario de prueba
canónico a fuego".

**Por eso no espera a ninguna pasada:** es un hallazgo de seguridad vivo, con fix ya decidido
(decisión de operador #3) y consecuencia económica directa. Se trata como **P0 fuera de banda**.

#### Lección de coordinación (no repetir)

Dos sesiones trabajaron el mismo frente sin saberlo: una re-verificando los 11 hallazgos, otra
planificando una pasada para re-verificar los 11 hallazgos. Se detectó por un conflicto de merge en el
README, no por el buzón. **Regla:** antes de abrir un frente de auditoría, revisar `git log origin/main`
y los PRs abiertos, no sólo el buzón — el buzón refleja lo que alguien anunció, `main` refleja lo que
alguien hizo.

### H3 — El CI no tiene ninguna capa de seguridad automática

Verificado sobre los 5 scripts del gate (`scripts/ci/*.sh`) y `.github/workflows/tests.yml`:

- `npm install --no-audit --no-fund` en **los 4** scripts de node → escaneo de vulnerabilidades de
  dependencias **explícitamente desactivado**.
- Cero secret-scanning (sin `gitleaks`/`trufflehog`).
- Cero SAST (sin `bandit`/`semgrep`).
- Cero typecheck de Python (sin `mypy`/`pyright`).

Con el repo **público** desde 2026-08-06, esto es lo más barato y de mayor impacto del plan entero, y
es la única parte que **ningún LLM reemplaza**: son gates deterministas y permanentes, no una foto.

### H4 — Auditar en el checkout compartido audita código muerto

El checkout principal está **325 commits detrás** de `origin/main`. Toda pasada corre en un **worktree
fresco desde `origin/main`**. Este plan mismo se escribió así, precisamente por H2.

---

## 1. Superficie real a auditar (medida, no estimada)

Medido sobre `origin/main` @ `debe5623`:

| Área | Archivos | Nota |
|---|---:|---|
| `apps/copiloto/` (backend FastAPI + Temporal) | 293 | 109 módulos `.py` en la raíz · **100 endpoints HTTP** |
| `apps/copiloto-web/` (PWA) | 258 | |
| `apps/mobile/` (React Native) | 254 | |
| `packages/` | 91 | core compartido |
| `scripts/` | 45 | CI propio (ADR-001) |
| `deploy/` | 39 | scripts de deploy + provisión de tablas/RLS |
| `motor/` | 30 | plataforma vendorizada (fork duro) |

**Los 100 endpoints, por módulo:** `web.py` 26 · `afip_web.py` 27 · `presupuestos_web.py` 11 ·
`admin_web.py` 11 · `inteligencia_web.py` 6 · `gastos_web.py` 6 · `mi_dia_web.py` 5 ·
`clientes_web.py` 4 · `mp_web.py` 2 · `contabilidad_web.py` 1 · `actividad_web.py` 1.

**Superficie BOLA (la de mayor consecuencia):** ~30 endpoints llevan un identificador en la ruta —
`{factura_id}`, `{comprobante_id}`, `{cobro_id}`, `{ingreso_id}`, `{anulacion_id}`,
`{presupuesto_id}`, `{concepto_id}`, `{gasto_id}`, `{tarjeta_id}`, `{ticket_id}`, `{trauma_id}`,
`{cliente}`. Es exactamente la clase del caso raíz registrado en el `CLAUDE.md` global (ADR-013 §3.3.4:
guard cross-tenant especificado, nunca codificado, ~2 meses vivo en prod, detectado por un spike
externo y no por el gate propio).

**Lo que YA está cubierto y no se re-deriva:** existe un cuerpo real de tests adversariales
(`test_adversarial_multitenant.py`, `test_afip_stores_integracion.py`, `test_admin_*.py`,
`test_auth.py`, `test_auditoria_store.py`, `test_actividad_store.py`) sobre 173 archivos de test, y el
gate corre backend contra **Postgres real** en el VPS. Lo que **nadie midió** es la cobertura
endpoint-por-endpoint: cuáles de esos ~30 IDs en ruta tienen un test hostil y cuáles no. Ese mapa es
un entregable exigido de la Pasada 1, no un supuesto.

---

## 2. Las pasadas

| # | Pasada | Muta código | Instrumento principal | Archivo |
|---|---|---|---|---|
| **P0** | **C4.1 — cerrar `/auth/signup`** | Sí | fix + test adversarial | fuera de banda, ver H2 |
| 0 | ~~Triaje~~ (hecho, PR #386) + capas de CI | Sí (mínimo) | Gates deterministas | [pasada-0](2026-08-12-pasada-0-triaje-y-capas-de-CI.md) |
| 1 | **Seguridad** | No (read-only) | `/claude-security` → *Scan codebase* | [pasada-1](2026-08-12-pasada-1-seguridad.md) |
| 2 | **Robustez** (errores no descubiertos) | No (read-only) | Loop Fable + agentes headless | [pasada-2](2026-08-12-pasada-2-robustez.md) |
| 3 | **Pulido y eficiencia** | Sí (mucho) | `/simplify`, `/code-review` | [pasada-3](2026-08-12-pasada-3-pulido-y-eficiencia.md) |

### Orden y por qué

```
P0: cerrar C4.1 (/auth/signup)   ← fuera de banda, no espera a nadie: hueco vivo en repo público
              │
Pasada 0  ────┴─────────►  capas de CI  (el triaje ya lo hizo el PR #386)
                              │
              ┌───────────────┴───────────────┐
              ▼                               ▼
      Pasada 1 (seguridad)          Pasada 2 (robustez)     ← PARALELO, read-only
              └───────────────┬───────────────┘
                              ▼
                      TRIAJE CONJUNTO              ← decide qué se arregla y en qué orden
                              ▼
                        FIXES (1 y 2)
                              ▼
                      Pasada 3 (pulido)            ← última: es la que más muta
                              ▼
                CIERRE: /security-review + gate + E2E device
```

Tres principios detrás del orden:

1. **Descubrimiento read-only primero, mutación después.** Refactorizar antes de auditar invalida los
   resultados de la auditoría: el reporte describiría código que ya no existe.
2. **Pulido va último** porque es el que más código toca y el de menor consecuencia si se posterga.
   Un `/simplify` corrido antes de la Pasada 1 obligaría a re-escanear todo.
3. **1 y 2 en paralelo** (decisión del operador): ambas son read-only, no comparten estado y no se
   pisan. Corren en **worktrees separados** desde `origin/main`. Ahorra ~50% de wall-clock a cambio de
   consumo simultáneo de cuota.

---

## 3. Decisiones del operador (fijadas 2026-08-12)

| # | Decisión | Valor | Nota |
|---|---|---|---|
| D1 | Dónde viven los reportes | **Commitear todo a `Auditorias/`, como siempre** | Se mantiene la regla de carpeta canónica única sin excepción. Riesgo asumido y explícito: el repo es público, así que un hallazgo VIVO queda descrito públicamente hasta que se cierre. Registrado acá para que sea una decisión trazable y no un descuido. |
| D2 | Alcance de esta sesión | **Sólo planificar** | Se documenta un plan por pasada. Ninguna pasada se ejecuta hasta orden explícita. |
| D3 | Paralelismo | **Pasadas 1 y 2 en paralelo, worktrees separados** | |

---

## 4. Qué significa "listo" para este plan

El plan entero cierra cuando, y sólo cuando:

1. Los 9 hallazgos de `2026-08-04` tienen estado binario re-verificado contra `main` (Pasada 0).
2. El gate corre secret-scan + escaneo de dependencias en cada push (Pasada 0).
3. Existe el mapa endpoint→test-adversarial, y **todo endpoint con ID en ruta que no tenga test hostil
   está listado como `[UNVERIFIED]`** (Pasada 1).
4. Todo hallazgo confirmado de las pasadas 1 y 2 está cerrado o tiene dueño + fecha + entrada de deuda
   (nada invisible ni impago — regla 6 del canon).
5. `/security-review` sobre el diff acumulado sale limpio, gate 6/6, y el E2E de device pasa.

**No cuenta como cierre:** la autoevaluación de ningún agente, ni un reporte "sin hallazgos" sin la
sección de cobertura que diga qué se miró y qué se dejó afuera.

---

## 5. Punteros

- Auditoría previa vigente: `2026-08-04-listado-problemas-fixes-reverificado.md`
- Loop de auditoría del repo: `memoria/loop-auditoria-fable-analisis-opus-contratos-e2e.md`
- Regla dura de control adversarial: `CLAUDE.md` global, §Seguridad
- Gate propio (ADR-001): `scripts/gate.sh` + `scripts/ci/*.sh`
