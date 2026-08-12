# Pasada 1 — Seguridad

> **Estado:** PLAN, sin ejecutar. **Índice:** [ESTRATEGIA](2026-08-12-ESTRATEGIA-tres-pasadas-de-auditoria.md)
> **Precondición:** Pasada 0 cerrada. **Paralela con:** Pasada 2 (worktrees separados).
> **Muta código:** NO. Es read-only; los fixes salen como patches que se aplican después del triaje conjunto.

---

## Pregunta que responde esta pasada

> ¿Puede un usuario ver, modificar o destruir datos que no son suyos — o escalar a admin — en
> cualquiera de los 100 endpoints?

No es "¿el código es inseguro en abstracto?". Es esa pregunta concreta, porque es la que define si la
app puede recibir un segundo cliente real.

---

## Instrumento

`/claude-security` → job **"Scan codebase"**.

**No** `/claude-security:scan` (es el workflow interno; invocado suelto deriva al menú).
**No** `/security-review` (es diff-scoped, va en el cierre del plan completo).

### Cómo se comporta

- Corre **dentro de la sesión**, bajo sus permisos, sin capa de aislamiento. Es adecuado porque el
  repo es propio: la pregunta es *qué bugs tiene el código*, no *si el código es hostil*.
- Orquesta vía la tool `Workflow` → **encaja con el gate headless del harness** (la orquestación por
  Workflow es una de sus tres excepciones declaradas; los sub-agentes inline sueltos están bloqueados).
- Cada hallazgo pasa por un panel de verificadores independientes cuyo trabajo es **refutarlo**; lo que
  no sobrevive no se reporta. Por eso los reportes son cortos.
- Escribe `CLAUDE-SECURITY-<timestamp>/` con `RESULTS.md`, `RESULTS.jsonl` y un sello de revisión con
  el sha auditado (marcado `-dirty` si había cambios sin commitear).
- **Es no determinista:** dos corridas sobre el mismo código pueden dar hallazgos distintos.
  No sirve como gate binario; sirve como investigación.

### Configuración

| Parámetro | Valor | Por qué |
|---|---|---|
| Scope | `apps/copiloto/` + `motor/` + `deploy/` | Ahí viven los 100 endpoints, el borde de tenant, las credenciales y el RLS. El frontend va en un barrido aparte y más barato (abajo). |
| Effort | **alto** | Es la pasada de mayor consecuencia del plan. |
| Worktree | fresco desde `origin/main` | El checkout compartido está 325 commits atrás. |
| Árbol limpio | sí, antes de arrancar | Para que el sello de revisión no salga `-dirty` y el reporte quede atado a un sha real. |

---

## Objetivos dirigidos (además del barrido genérico)

Un scan genérico encuentra lo genérico. Estos cuatro objetivos salen del inventario real de este repo
y **se exigen explícitamente**, porque son donde este sistema puede fallar peor.

### O1 — Mapa BOLA: endpoint con ID en ruta → test adversarial

**El entregable más importante de la pasada.** ~30 de los 100 endpoints llevan un identificador en la
ruta:

```
{factura_id} {comprobante_id} {cobro_id} {ingreso_id} {anulacion_id} {presupuesto_id}
{concepto_id} {gasto_id} {tarjeta_id} {ticket_id} {trauma_id} {cliente}
```

Para **cada uno**: ¿existe un test que ejercite *actor A pide el recurso de B → espera denegación*?

Esto no es celo excesivo: el `CLAUDE.md` global registra el caso raíz exacto de esta clase — ADR-013
§3.3.4 especificó el guard cross-tenant, el código nunca lo codificó, y el drift vivió **~2 meses en
producción** (BOLA / OWASP API1:2023) porque ningún test probaba "A pide lo de B". Lo cazó un spike
externo, no el gate propio. El happy-path verde pasa igual si el aislamiento no existe.

**Salida exigida:** una tabla `endpoint | tiene test hostil | archivo:línea | veredicto`. Todo endpoint
sin test hostil se marca **`[UNVERIFIED]`** — y por la regla dura del `CLAUDE.md`, un control sin test
adversarial es indistinguible de un control ausente.

> Ya existe un cuerpo real de tests adversariales (`test_adversarial_multitenant.py`,
> `test_afip_stores_integracion.py`, `test_admin_*.py`, `test_auth.py`, `test_auditoria_store.py`).
> **No se re-deriva lo cubierto**: el valor está en encontrar los huecos.

### O2 — Borde de privilegio de `/admin/*`

11 endpoints admin, incluidos tres mutantes:
`POST /admin/tenants/{cliente_id}/estado` (suspende tenants),
`POST /admin/errores/{trauma_id}/reintentar`,
`POST /admin/soporte/tickets/{ticket_id}/responder`.

Hay tests de `403 usuario normal`. Lo que se audita: **cómo se otorga el rol admin**, si el claim se
puede falsificar o auto-asignar, y si algún endpoint admin usa una conexión con `BYPASSRLS` que
después alcanza datos por fuera de su alcance previsto (el frente de autohealing usa `BYPASSRLS`).

### O3 — Autenticación y frontera de sesión

Concentrado en `web.py` y `auth.py`.

> 🔴 **C4.1 ya no es objetivo de esta pasada: es un hallazgo CONFIRMADO y bloqueante.** La
> re-verificación del 2026-08-12 lo probó vivo con evidencia: `signup_and_provision()`
> (`onboarding.py:256`) usa `gotrue.admin_create_user`, que **bypassa el `disable_signup:true`**;
> `SignupIn` (`web.py:543`) no tiene invite-token; `/auth/oauth/ensure-tenant` (`web.py:1061`) no
> compara el email contra ninguna allow-list; `git grep INVITE_TOKEN|SIGNUP_TOKEN|ALLOWED_` → 0.
> **Se arregla como P0 fuera de banda, antes de esta pasada.** Acá sólo se **verifica el fix** y se
> busca si hay otras vías de auto-provisión que el fix no tape.

Lo que sí investiga esta pasada:

- `POST /auth/google/id-token` — **verificación de la firma del ID token**, `aud`/`iss`, expiración,
  y replay. Sign-in nativo agregado hace poco (commit `22a78992`).
- `POST /auth/oauth/ensure-tenant` — más allá de la allow-list de C4.1: ¿puede un usuario **atarse a
  un tenant ajeno** por esta vía? Es la pregunta de mayor consecuencia de todo O3.
- `POST /auth/refresh` — rotación e invalidación de refresh tokens.
- Rate-limit: existe (60req/60s por IP, #229). Verificar que cubre las rutas nuevas de auth.
- **Nota del fix de C4.1:** la allow-list va **app-side**, NO vía "Test users" de Google Console —
  ese camino expira los refresh tokens a 7 días (ya documentado en la re-verificación).

### O5 — Fuga de datos personales a logs (hallazgo confirmado)

El **print de PHI en `agent_activities.py`** está 🔴 VIVO desde el 2026-08-04 y sobrevivió el sprint.
Se cierra en esta pasada, y se barre la clase completa: qué otros `print`/`log` emiten contenido de
usuario, credenciales o payloads completos. Con logging JSON estructurado obligatorio por norma del
proyecto, un `print` crudo con datos de cliente es doblemente un defecto.

### O4 — Webhooks, callbacks y uploads

- `POST /mp/webhook` — **verificación de firma**. **C8 está confirmado VIVO** (2026-08-12): la firma
  ignora el `payload`. Hoy no tiene efecto observable *sólo* porque el caller pasa `None` — es una
  verificación inerte esperando el primer caller que sí mande datos. Se cierra en P0/Pasada 0; acá se
  verifica el fix y se busca la clase (¿otras firmas/HMAC que no cubran todo lo que autentican?).
- `GET /mp/callback` y `GET /composio/connect` — OAuth: validación de `state` (CSRF), `redirect_uri`,
  y fijación de sesión.
- Uploads: `POST /chat/audio`, `/chat/foto`, `/feedback/audio`, `/soporte/chat/audio` — límite de
  tamaño, validación de tipo real (no sólo extensión/`Content-Type`), y dónde aterriza el archivo.
- `GET /{full_path:path}` — catch-all de `web.py` (fallback SPA). Path traversal y qué puede servir.

### Extra barato — barrido de frontend

Fuera del scope caro, un pase corto sobre `apps/copiloto-web/` + `apps/mobile/`:
dónde se guarda el token (¿`localStorage`?), si algún secreto quedó en el bundle (los
`EXPO_PUBLIC_*`/`VITE_*` son públicos **por diseño** — el punto es confirmar que nada sensible viaja
ahí), y XSS vía `dangerouslySetInnerHTML`.

---

## Riesgos operativos de esta pasada

| Riesgo | Mitigación |
|---|---|
| **El reporte queda público con hallazgos vivos.** Decisión D1 del operador: se commitea todo a `Auditorias/`, y el repo es público. | Riesgo **asumido y explícito** por el operador (ver ESTRATEGIA §3). Mitigación práctica: minimizar la ventana entre publicar y arreglar — priorizar el fix de todo hallazgo crítico/alto **antes** del commit del reporte, para no publicar un exploit accionable contra prod viva. |
| Falsos positivos que consumen el triaje | El panel verificador ya descarta lo no confirmado. Además: todo hallazgo se re-prueba **contra el sistema real** antes de aceptarlo (canon 1). |
| No determinismo: una corrida no es cobertura | El reporte trae sección de **Coverage** (qué se miró y qué se dejó afuera, con motivo). Se exige leerla: "sin hallazgos" sin coverage no es un resultado. |
| Costo en tokens | Scope acotado al backend + `motor` + `deploy`; el frontend va en el barrido barato. |

---

## Definition of Done — Pasada 1

- [ ] Scan completo con árbol limpio; sello de revisión **sin** `-dirty`, atado a un sha de `main`.
- [ ] `CLAUDE-SECURITY-RESULTS.md` leído entero, **incluida la sección Coverage**.
- [ ] **O1 entregado**: tabla endpoint-con-ID → test hostil → veredicto, con los `[UNVERIFIED]` listados.
- [ ] O2, O3, O4 respondidos explícitamente (aunque la respuesta sea "sin hallazgos", con evidencia).
- [ ] Cada hallazgo confirmado re-probado contra el sistema real, no aceptado por el reporte solo.
- [ ] Cada hallazgo tiene severidad, dueño y destino: fix inmediato, contrato, o deuda con fecha.
- [ ] Los `[UNVERIFIED]` de O1 convertidos en **tests adversariales reales** (esto no es opcional: la
      regla dura del `CLAUDE.md` los deja bloqueando el cierre mientras no existan).

## Lo que esta pasada NO hace

- No aplica patches automáticamente (el plugin nunca commitea ni pushea; los patches se revisan).
- No busca bugs de lógica de negocio ni de performance (Pasada 2).
- No refactoriza (Pasada 3).
- No reemplaza el gate: es investigación, no un check binario reproducible.
