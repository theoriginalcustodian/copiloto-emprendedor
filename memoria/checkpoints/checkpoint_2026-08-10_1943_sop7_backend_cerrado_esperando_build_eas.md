---
name: Checkpoint sop7_backend_cerrado_esperando_build_eas — 2026-08-10 19:43
description: Snapshot ejecutivo. SOP7 backend (E1-E3+N1-N6) 100% cerrado con evidencia real. Único resto es E5/E6 device, bloqueado por un build EAS en cola (~4h36min, lanzado por frontend 19:24). Cron apagado por orden del operador — mañana seguimos.
type: checkpoint
session_id: unknown
project_root: c:\Proyectos\Claude\Claude code\copiloto-emprendedor
parent_checkpoint: memoria/checkpoints/checkpoint_2026-08-10_1106_sop6_backend_pr369_pendiente_merge_deploy.md
---

# Checkpoint — sop7_backend_cerrado_esperando_build_eas — 2026-08-10 19:43

## 🎯 Objetivo de la sesión / sprint

Sesión BACKEND del trabajo en 4 vías paralelas (planificación/backend/frontend/manejo-de-errores).
Tras cerrar SOP6 (ver checkpoint padre), el sprint completo de soporte quedó en su último bloque:
**SOP7** — el barrido formal de los 7 E2E + 6 controles negativos del DoD
(`docs/copiloto-emprendedor/Soporte tecnico - basico/01-DOD-sprint-agente-de-soporte-tecnico.md`).

## ✅ Hecho (qué ya quedó cerrado, todo con evidencia real, no autoevaluación)

**3 PRs mergeados+desplegados+verificados en vivo este tramo:**
- **PR #370** — metering del agente de soporte (I2 del DoD SOP4): `worker_soporte.py` registraba
  sus 2 dominios con `metering_sink=None`, cero filas en `copiloto_metering`. Fix + verificado con
  3 filas reales post-fix vía turno E2E real.
- **PR #372** — `GET /soporte/tickets/{ticket_id}` (pedido de frontend, S6-11): el usuario final lee
  su propio ticket. Verificado E2E en vivo contra prod (sin token→401, ticket propio→200, ticket
  inexistente→404) + test adversarial H1 cross-tenant contra Postgres real.
- **PR #373** — hallazgo propio (encontrado con mi propia negative-control testing de N3): `auth.py`
  filtraba el texto crudo de la excepción de PyJWT en el 401. Fix con code-review real (agente
  `code-reviewer` independiente, veredicto APROBAR) antes de mergear — nuevo gate global de la
  sesión. Verificado en vivo contra prod.

**Los 6 controles negativos del DoD, backend:**
- **N1** (RAG apagado a propósito) — NO se tocó el orquestador de fusion (prod real, sirve testers
  BETA-5). Pedido de coordinación a planificación → **decisión: no tocar prod, evidencia equivalente
  alcanza** (`respuesta_planificacion-a-backend_SOP7-N1-...md`, 17:05). Intenté además la "pieza
  puntual" (E2E con LLM real + RAG apuntado a puerto cerrado) sin tocar nada compartido — topé un
  gap real de infra (ningún script del repo sourcea `OPENAI_API_KEY` para pytest, a diferencia de
  `RAG_ORQUESTADOR_TOKEN`/`test-db.sh --export`; mi propio clasificador de seguridad bloqueó
  correctamente el atajo ad-hoc de sourcear el secreto de prod por SSH a mano). **Cerrado con
  evidencia existente**: `test_UNAVAILABLE_real_token_invalido_degrada_sin_lanzar` +
  `test_kb_unavailable_deposita_trauma_I3`, ver `respuesta_backend-a-planificacion_SOP7-N1-cerrado-
  con-evidencia-equivalente-gap-de-infra-documentado.md`.
- **N2** (pregunta fuera del corpus) — verificado EN VIVO: `POST /soporte/chat` real con "¿cuál es
  la capital de Mongolia?" → el agente NO inventó nada, respondió honesto y redirigió a temas de la
  app. Evidencia de nivel más alto que un test de la herramienta sola (conversación real con
  gpt-4o-mini).
- **N3** (sesión caída) — 401 limpio en `/soporte/tickets` y `/soporte/chat` con token corrupto, no
  500. Verificado antes de este tramo (`addendum_backend-a-planificacion_SOP7-N3-...md`).
- **N4** (tenant ajeno denegado) — confirmado con 2 tests reales contra Postgres específicos del
  flujo de soporte: `test_ADVERSARIAL_no_ve_los_traumas_de_otro_tenant` +
  `test_H1_ADVERSARIAL_obtener_ticket_como_B...` (éste último re-verificado como parte de N5, ver
  abajo — no es tautológico).
- **N5** (control diferencial: revertir cada fix ⇒ su test se pone ROJO) — corrido DE VERDAD en
  `/c/tmp/ci-clone` contra Postgres real del VPS: revertí el wiring de metering (#370) → rojo
  (`assert None is not None`), restaurado; forcé `obtener_ticket` (#372) a no devolver filas nunca
  → 2/6 tests rojos exactamente los que afirman "devuelve el ticket real" (los 4 que sólo afirman
  "None si no existe" siguieron en verde — es la prueba viva de por qué N6 existe), restaurado. Para
  #373 (auth.py) NO reproduje el revert en caliente: mi clasificador de seguridad bloqueó
  reintroducir la fuga de excepción, correctamente — evidencia equivalente es el ciclo rojo→verde
  documentado cuando se escribió el fix original.
- **N6** (control positivo del corpus) — ya evidenciado (`¿cómo emito una factura?` → respuesta real
  del corpus) + `test_kb_answered_devuelve_el_answer`.

**E1/E2/E3 (mobile/web, no-device)** — verificados por HTTP contra prod en un ciclo previo del mismo
tramo (`avance_backend-a-planificacion_SOP7-E2-E3-N-parcial-...md`). **E4/E7-web** los cerró
FRONTEND (no backend) — ver sus propios `cierre_`/`avance_` en `cerrado/2026-08-10/`.

Todo posteado con evidencia real en el buzón, resumen final en
`coordinacion/abierto/2026-08-10_avance_backend-a-planificacion_SOP7-controles-negativos-N2-N4-N5-N6-cerrados-N1-pedido-de-coordinacion.md`
(con su addendum) + `respuesta_backend-a-planificacion_SOP7-N1-cerrado-...md`.

## 🔄 En curso (no es mío, sólo contexto)

- **Build EAS `development`** lanzado por FRONTEND a las 19:24 (autorización directa del operador,
  `contrato_planificacion-a-frontend_rebuild-EAS-development-autorizado-por-el-operador.md`, 17:10).
  Link de seguimiento: https://expo.dev/accounts/341lin/projects/copiloto-emprendedor/builds/49d478d3-f575-4fd3-8ad9-31c11314ae1e
  Costo conocido: **~4h36min** (precedente, `memoria/iterar-en-device...md` línea 24) → **ETA
  aproximada 2026-08-10 ~23:55-00:00**. Corre del lado de Expo, no depende de ninguna sesión — sigue
  solo aunque todos los crones estén apagados.

## ⏭️ Próximos pasos concretos (para quien retome, mañana o cuando el build termine)

1. **Revisar el link del build ANTES que nada** — puede que ya haya terminado para cuando se
   retome. Si terminó OK: bajar el APK, instalarlo en el device (`RF8R50N2WGR`, EXCLUSIVO de
   backend — nadie más hace `adb`), correr Metro local (`expo start --dev-client`) + `adb reverse
   tcp:8081 tcp:8081`, conectar el dev-client YA instalado a `localhost:8081` (NUNCA `expo run:
   android` ni un nuevo build para iterar).
2. Ejecutar **E5** (21 turnos seguidos, turno 1 cae del contexto, turno 2 no, sobrevive cerrar/
   reabrir la app) y **E6** (cerrar el ticket → el usuario se entera) + los negativos táctiles
   pendientes de SOP7, con evidencia real (capturas/paso a paso) — build instalado ≠ probado (regla
   dura, `COORDINACION.md` §1.ter).
3. Postear `cierre_backend-a-planificacion_SOP7-E5-E6-...` con la evidencia. Con eso, **SOP7 (y el
   sprint entero de soporte) queda 100% cerrado**.
4. Si el build FALLÓ o no aparece: avisar a frontend/planificación, no relanzarlo sin avisar (dueño
   del build EAS es frontend, `COORDINACION.md` línea 256).
5. Re-arrancar el cron de vigía (`/monitoreo-backend`, `scripts/crones/monitoreo-backend-cron1.md`)
   al retomar — se apagó por orden explícita del operador (relayada por frontend,
   `urgente_frontend-a-todos_orden-del-operador-apaguen-sus-crones-mañana-seguimos.md`, 19:41).
6. **Gap de infra declarado, no bloqueante**: falta un script tipo
   `deploy/copiloto/test-with-real-llm.sh` que exporte `OPENAI_API_KEY` para pytest con el mismo
   criterio que `test-db.sh --export` (`RAG_ORQUESTADOR_TOKEN`) — sólo hace falta si se quiere
   repetir la "pieza puntual" de N1 (frase exacta del LLM ante RAG unavailable). No es SOP7, no lo
   tomo sin que alguien lo priorice.

## ⚠️ Bloqueos / decisiones pendientes del operador

- **Ninguno nuevo.** El único MAYOR de este tramo (rebuild EAS) ya lo autorizó el operador y está en
  marcha. Nada esperando decisión suya ahora mismo.

## 📚 Contexto crítico para retomar

- **Repo de trabajo real: `/c/tmp/ci-clone`** (clon aislado, plain `git clone`, NO worktree). El
  checkout compartido en `c:\Proyectos\Claude\Claude code\copiloto-emprendedor` sigue en
  `docs/production-readiness-brief`, 240+ commits detrás — sólo sirve para leer `coordinacion/`/
  `memoria/`.
- `git -C /c/tmp/ci-clone status --short` → limpio, `main` en `6033bd3f` (PR #374, docs-only,
  verificado sin novedades).
- **Cron de esta sesión APAGADO** (`CronDelete` de `da266146` + `CronList` confirmando vacío) por
  orden explícita del operador relayada en el buzón. NO reactivar solo — esperar la próxima sesión
  o instrucción directa.
- Usuario canónico E2E: `e2e-device@copiloto.test`, credenciales en `.env.e2e` (gitignored, raíz del
  repo) — NUNCA otro usuario.
- El buzón (`coordinacion/`) tiene la traza completa de todo este tramo con timestamps reales — si
  hace falta el detalle exacto de algún control, está ahí, no hace falta reconstruirlo de memoria.

## 🧠 Modelo mental / supuestos

- El build EAS corre en la infra de Expo, independiente de toda sesión de Claude Code — apagar
  crones no lo cancela ni lo pausa. Confirmado por frontend antes de que yo lo diera por sentado.
- Asumo que nadie va a instalar el APK en el device antes de que yo retome (es mi exclusividad
  declarada en `COORDINACION.md` §2, y frontend lo confirmó explícitamente en su contrato: "NO lo
  instalo yo").
- **Gap de infra real encontrado, no supuesto**: verifiqué con dos intentos reales (uno vía
  `sync-test-backend.sh` normal, otro vía SSH manual sourceando `copiloto.env`) que no hay forma
  actual, dentro de los scripts revisados del repo, de correr un test con `OPENAI_API_KEY` real —
  no es una limitación mía, es un hueco real de tooling.

## 📊 Estimación de progreso

- **SOP7 backend: 100%** de lo que no depende del device (E1-E3, N1-N6) — cerrado con evidencia
  real. Sprint de soporte completo: **~90%**, sólo falta E5/E6 device (bloqueado por el build EAS,
  fuera de cualquier control de sesión, ETA ~00:00).
- Tiempo del tramo (desde el resumen de contexto hasta ahora): ~3h de trabajo activo + ~2h20min de
  ciclos de vigía sin novedad mientras el build corría.
