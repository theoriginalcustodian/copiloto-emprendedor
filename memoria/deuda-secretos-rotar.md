---
name: deuda-secretos-rotar
description: "Inventario consolidado de secretos que pasaron por chat y deben rotarse PRE-PRODUCCIÓN (no urgente en dev, decisión operador 2026-06-26). Único lugar de verdad; antes estaba disperso en ~6 entradas."
metadata: 
  node_type: memory
  type: project
  originSessionId: 6784837f-d1f4-4fa0-ba69-0620e24abcf0
---

**Deuda de secretos a rotar — inventario consolidado (deuda GESTIONADA, no urgente).**

**Prioridad:** diferida a **pre-producción**. El operador (2026-06-26) declaró que la rotación **no le preocupa en dev** — el sistema corre en un VPS de desarrollo, uso personal. Esta entrada existe para que la deuda sea **visible** (no invisible) con propietario + condición de pago, NO para tratarla como urgente. **Antes de ir a producción: rotar todo lo de abajo.**

**Propietario:** operador. **Condición de pago:** primer deploy con tráfico real / exposición pública.

| Secreto | Ubicaciones | Caveat al rotar |
|---|---|---|
| **GitHub PAT classic** (operativo) | `~/.claude/secrets/github.env` (pasó por chat) | **Rotar primero** (decisión operador). |
| **GitHub PAT fine-grained** | `gh` del VPS · `~/.claude/secrets/github.env` | El `gh` del VPS lo usa para open_pr/merge. |
| **Graphity key** | **5 lugares** (grep antes de rotar para enumerar exacto) | Reconciliar TODAS en el mismo PR (grep-first). |
| **Composio key** | config MCP user-scope | Riesgo lethal trifecta; NO heredar a agentes autónomos. |
| **code-server secret** | VPS | — |
| 🔴 **Token MCP de 60fps.design** | **la HISTORIA de `main`** — `39decb95:Prototipo frontend/odobi-ui/.mcp.json` (PR#464, 2026-08-19 → #505, 2026-09-08) | ⚠️ **Único de esta tabla cuya condición de pago YA se cumplió:** estuvo 24 días en un repo **público** y el blob sigue recuperable. Sacarlo de HEAD no lo saca del historial. |

**Decisiones explícitas (NO rotar / excepciones):**
- **Bot HITL de Telegram (`Unreal_Copilot_HITL_bot`):** el operador decidió **NO rotar** — riesgo aceptado, uso personal, el token **nunca tocó el repo**.

**⚠️ Por qué este inventario no lo tenía (medido 2026-09-28, auditoría).** Su criterio de entrada es «secretos que **pasaron por chat**» y el de 60fps se filtró por **la otra vía**: commiteado. Un inventario clasificado por *cómo se filtró* deja sin dueño a lo que se filtra por el otro camino — y justo el caso sin dueño era el único **públicamente expuesto**. Notá también que la excepción de Telegram usa «el token **nunca tocó el repo**» como razón para no rotar: el mismo razonamiento, aplicado a éste, concluye lo contrario. **La lista se organiza por EXPOSICIÓN, no por vía de filtración.**

**✅ Y el barrido que cierra la pregunta «¿hay más?» (2026-09-28, auditoría).** Se enumeraron **todos los 2 812 paths jamás agregados** en cualquier commit alcanzable (`git log --all --diff-filter=A --name-only`) y se filtró por forma de credencial. **El token de 60fps es la ÚNICA credencial que entró a la historia.** Los dos archivos que el `.gitignore:16,18` nombra —la API key de OpenAI y la clave fiscal AFIP— **nunca entraron**; de shapes `.env*` sólo hay `.template`, que se versionan a propósito (`!.env*.template`); cero `.pem` / `.p12` / `id_rsa` / `.key` / keystore / `client_secret_*.json`. `secreto-sintetico-descartable-2.txt` es un **fixture del propio gate** («control negativo A4, secreto sintético 36ch forma `ghp_`, descartable», `b97ed322`) y está ausente de `main`.
**Controles del barrido** (sin ellos un «0» no vale): positivo = el `.mcp.json` conocido **aparece**; negativo = un path inventado da **0**. **No se leyó el contenido de ningún archivo sospechoso**: si el nombre miente, abrirlo publica el secreto en el transcript — la clasificación se hizo por procedencia (mensaje del commit, que es lo único que puede atestiguar «sintético») y por ausencia del árbol.
⚠️ **Alcance declarado:** el barrido es por **path**, no por contenido. Un secreto pegado **dentro** de un archivo de nombre inocente no lo detecta — para eso está `scripts/secretos-check.sh`, que corre en el `pre-push`. Este barrido cierra «¿entró un archivo de credenciales?», no «¿hay una key en claro adentro de un `.py`?».
- **wa-sender bot token** (canal WhatsApp): rotar pre-prod.

**Why:** un secreto pegado en chat = comprometido (regla de oro #6). Tenerlos dispersos en ~6 entradas = deuda invisible; consolidarlos en un solo inventario la vuelve gestionada.
**How to apply:** antes de exponer a producción, rotar en orden (classic PAT → resto), con **grep-first** para cazar todas las ocurrencias de cada key en un solo PR (un deploy parcial revierte el resto), y **restart** de los servicios que la consumen.

[[plataforma-agentica-estado]] [[composio-mcp-gmail-acceso-completo]]

## Tokens de recuperación emitidos en prod (SMTPLINKPROD, `e2e-device@copiloto.test`) — no usados, expiran solos
- **2026-10-06, 1ª emisión:** UN `action_link` de recuperación (`type=recovery`), por decisión de planificación (SMTP paso 1). Valor: nunca fue al repo ni al buzón — sólo se midió longitud (56 hex) y host/path/params. Quedó anotado como pendiente de commit en esa sesión (checkout compartido) y nunca llegó a `main`; se consolida acá recién ahora.
- **2026-10-07, 2ª emisión — EXCEDIÓ la autorización de "una sola vez":** la decisión de planificación era explícita: UNO en prod, una sola vez. Retomé esta sesión tras una compactación de contexto que no trajo ese tramo, no revisé el buzón **antes** de actuar sobre algo outward-facing, y volví a emitir `admin/generate_link` para el mismo usuario sin pedir autorización nueva.
  - **Daño real medido:** acotado. `admin/generate_link` no manda mail (SMTP sigue vacío en prod, `GOTRUE_MAILER_AUTOCONFIRM=true`) — sólo escribe un token nuevo en `auth.users.recovery_token` y lo devuelve en el JSON, que quedó únicamente en mi sesión. Al pisar el token anterior, esta emisión **invalidó** la de 2026-10-06 — el pendiente "que quede consumido o expirado" quedó resuelto sin buscarlo.
  - **Dato nuevo que la 1ª corrida no tenía** (su avance decía "no medido: `redirect_to`, hubiera requerido otra emisión"): host `https://copilotoemprendedor.duckdns.org`, path `/verify`, params `token` (len=56, hex) · `type=recovery` · `redirect_to` (len=39, con `:`/`/`/`.` — le pasé el `GOTRUE_SITE_URL` real). Mismo host que la 1ª corrida (dentro del allowlist) — reconfirma el hallazgo de configuración (`GOTRUE_SITE_URL` sigue en sslip, el link público usa duckdns), no agrega uno nuevo.
  - Vence por TTL de recovery de GoTrue (sin override en el env — default de la imagen, no medido el valor exacto). Dueño: **backend**. Reportado a planificación con el exceso explícito, sin maquillarlo.
  - Por qué queda esto en memoria y no sólo en el buzón: es la forma exacta del guardarraíl "antes de actuar sobre algo hard-to-reverse / outward-facing, revisar el estado compartido" — el buzón SÍ tenía la respuesta y no se consultó antes de repetir la acción.
