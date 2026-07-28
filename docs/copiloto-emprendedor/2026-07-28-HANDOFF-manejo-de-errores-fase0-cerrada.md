# HANDOFF — frente Manejo de Errores · Fase 0 CERRADA

> **2026-07-28.** Estado para retomar sin releer la sesión. Lo que sigue está **ya tomado**, no a decidir.
>
> **Docs hermanos:** [plan §0.bis](2026-07-28-plan-implementacion-manejo-de-errores.md) (tabla de cierre punto por punto con shas) · [mapa de puntos de fallo](2026-07-28-mapa-puntos-de-fallo-del-sistema.md) (los 12, con evidencia `archivo:línea`).

---

## 1. Dónde está el código

**Cadena local sobre `origin/main` (`7f4d851`). NO hay PR abierto — decisión del operador: se trabaja de corrido y se abre un PR al cerrar el frente.**

```
544f734  docs(plan): fase 0 cerrada — 10 de 12 puntos del mapa   ← HEAD de la cadena
85a1170  fix(errores): punto #9  — RTBF que no ocurría y no avisaba
0dda5cd  fix(errores): punto #5  — certificado huérfano en AFIP
a82699e  fix(errores): punto #10 — dos escrituras sin transacción
7c1e92a  fix(errores): items 0.7 y 0.8 — botón mudo + fetch que colgaba
aba5152  fix(errores): item 0.6  — un turno roto mataba la sesión permanente
1790c1b  fix(errores): item 0.5  — reintento que escribía dos veces
9541079  fix(errores): items 0.2-0.4 — anulación colgada, 404 que miente, ok que miente
cfc9d4f  fix(afip): el número lo reserva el WORKFLOW
e40e9f3  fix(afip): respuesta válida de AFIP leída como "no existe"
15baa49  docs(plan): v2 — portar ARCA, no diseñar de cero
8fe35da  docs: el check-before-act interroga el número que nunca se emitió
5f114db  docs: el mapa de puntos de fallo
```

⚠️ **La cadena existe como objetos git, no como rama chequeada.** El working tree sigue en
`feat/hito9-emitir-factura-por-voz`. Los commits se armaron con `GIT_INDEX_FILE` temporal +
`git commit-tree` (checkout compartido: nunca `-A`, `--amend`, `rebase`, `reset`, `checkout`, `pull`,
`stash`). Para no perderlos: `git branch <nombre> 544f734` antes de cualquier limpieza.

**Total:** 61 archivos, +3375 / −152.

---

## 2. Evidencia vigente (fecha de medición: 2026-07-28)

| Suite | Resultado |
|---|---|
| Backend + motor, venv del VPS | **1108 passed / 135 skipped** |
| `packages/core` (vitest) | **409 passed** · `tsc --noEmit` exit 0 |
| `apps/mobile` (jest) | **645 passed / 1 skipped** · `tsc --noEmit` exit 0 |

Comandos: `bash deploy/copiloto/sync-test-backend.sh tests ../../motor/backend/agent -q` ·
`cd packages/core && npx vitest run` · `cd apps/mobile && npx jest`.

**Medido contra el sistema vivo** (⏳ [[medicion-de-estado-volatil-vence]] — re-medir antes de
desplegar):

- Temporal del VPS: **1.29.7**, Workflow Update **habilitado**, y el rechazo del validador llega al
  cliente. Verificado con spike propio (tipo de workflow y cola propios, cero contacto con datos reales).
- Un signal y un update **pueden compartir nombre de wire** — por eso el signal `confirmar` QUEDA.
- `FacturaWorkflow` **34** Running · `ConversationWorkflow` **78** Running ·
  `AnulacionWorkflow` **0** en la ventana de retención (con **control positivo** del contador:
  namespace total = 432).
- `ON CONFLICT (a,b) WHERE pred DO NOTHING` con inferencia de índice parcial: verificado contra el
  **Postgres real** con `TEMP TABLE` + `ROLLBACK`.

---

## 3. Lo que quedó SIN hacer, y por qué (no es olvido)

| Qué | Por qué se difirió | Disparador para retomarlo |
|---|---|---|
| **#12 `heartbeat_timeout`** | No es una línea: ponerlo sin que la activity llame a `activity.heartbeat()` **hace fallar** a las largas — el RPA de AfipSDK tarda ~2 min por llamada. Necesita decidir activity por activity cuáles son largas y pueden latir | Va **dentro de Fase 1** (observabilidad), no antes |
| **0.1d `existe_comprobante` fail-closed** | Lección documentada de ARCA: un falso positivo **bloquea comprobantes legítimos**. Observar primero, bloquear después de ≥30 días de baseline sin falsos positivos | Baseline de 30 días con el log estructurado de Fase 1 ya puesto |

La deuda de 0.1d está anotada **en el código**, sobre el test que hoy CONFIRMA el fail-open en vez de
vigilarlo (`test_afip_gateway.py::test_existe_comprobante_no_explota_si_el_ws_falla`), con propietario.

---

## 4. Lo siguiente, ya tomado: Fase 1 — Trauma Empaquetado (A-4)

**Objetivo binario:** que ningún error se evapore. Hoy el repo tiene 99 `try` en backend y **cero**
captura estructurada — censo medido: `dlq=0 fingerprint=0 structlog=0 sentry=0 heartbeat=0`.

Es la **precondición de la autosanación**: sin DLQ poblada con fingerprint, los agentes del cluster de
Temporal no tienen sobre qué operar.

**Primer paso concreto:** censo de los `except` que devuelven `None` / loguean y siguen **sin
depositar nada**. Script-first (un barrido idempotente, no N tool calls), y el resultado se cruza con
el mapa para separar los que **deben** degradar (`recall`, `warm_fn`, `grafo_writer` — son
best-effort por diseño y está bien) de los que **evaporan** un fallo que alguien necesita saber.

**Referencias que ya existen y hay que reusar, no reinventar** (regla 3 del canon):

- `grafo_writer` — el mejor ciudadano del repo: `Idempotency-Key` real, fail-open **con
  trazabilidad** (`chequeos_fallidos`) y `invalidaciones_pendientes`, que es lo más parecido a una DLQ
  que existe hoy. **El diseño de la DLQ sale de acá, extendiéndolo.**
- `evento_store.registrar_evento` — log de eventos de negocio append-only ya vivo.
- `errores_web.CODIGOS` + `conflicto()` — el catálogo de errores con código estable, con guard
  mecánico (`test_ningun_409_escrito_a_mano`).
- `provision.py::_ensure_*` — el mecanismo idempotente para la tabla de la DLQ (no inventar otro).

**Y la advertencia que ordena todo el frente** (plan §0): toda la carpeta `docs/12_Error_Handling_System/`
de ARCA describe el **motor n8n muerto** (migración a Temporal el 2026-06-15, ADR-050). Se porta desde
el **código** (`.ts` de las activities, `.yml` de las automatizaciones), nunca desde esos docs.

**Fase 3 — autosanación: NO va en GitHub Actions.** Instrucción explícita del operador: vive en el
**cluster de Temporal propio**. De ARCA se porta el *diseño del ciclo* (clasificar → contextualizar
con código+grafo → forjar parche → auditoría adversarial → proponer) y sus guards, **no el
transporte**. HITL = el merge a main.

---

## 5. Cuatro cosas que esta sesión aprendió a los golpes

Están en `memoria/` con detalle; acá el titular, porque las cuatro vuelven a aparecer en Fase 1:

1. [[anotar-adentro-el-efecto-externo-en-el-instante]] — apareció **dos veces el mismo día**.
2. [[un-test-sin-cota-cuelga-en-vez-de-decirte-que-falta]] — un `while` sin cota se comió un turno.
3. [[el-test-que-canoniza-el-bug-como-si-fuera-el-contrato]] — dos tests afirmaban el fallo.
4. [[derivar-la-clave-dentro-de-la-activity-no-tocar-el-payload]] — idempotencia sin tocar 78 workflows vivos.

Y una del harness que ya estaba: el guard `test_ningun_409_escrito_a_mano` **me frenó** un
`HTTPException(409)` a mano y me mandó a la maquinaria que ya existía. Los gates del repo funcionan;
leer el rechazo antes de aflojarlo ([[guard-caza-algo-distinto-de-lo-que-vigilaba]]).
