---
name: patched-se-memoiza-por-run-un-fix-con-patch-no-llega-a-sesiones-vivas
description: temporalio 1.28.0 memoiza `workflow.patched()` por run — si un turno viejo consultó el patch en replay sin marker, queda en False hasta el continue-as-new; el argumento «ninguna ejecución vieja pudo tomar la rama» es falso.
metadata:
  type: feedback
---

**LEER antes de razonar sobre qué sesiones vivas alcanza un fix protegido con `workflow.patched()`**
(ADRs de determinismo, «¿el fix ya rige para todos?»).

`temporalio` 1.28.0 cachea el resultado de `patched(id)` **por run**
(`_workflow_instance.py:1355-1369`). Si una sesión viva tuvo un turno que ejecutó ese código **antes**
de que existiera el patch, el replay de ese turno consulta `patched(id)`, no encuentra marker y
devuelve False. Ese False **se pega** para todos los turnos siguientes del mismo run, incluidos los
nuevos, hasta el continue-as-new (en el copiloto: `MAX_TURNS_PER_RUN=200` o
`is_continue_as_new_suggested`, `conversation_workflow.py:57,190,203`).

**Consecuencia:** «el fix está desplegado» no significa «el fix corre en cada sesión». Las sesiones que
pasaron por la rama en la ventana entre el deploy viejo y el nuevo siguen con el comportamiento viejo
hasta rotar de run. Caso A3 (2026-09-22): #607 (`gate-card-precedencia-bloquea`) anidado bajo #570
(`gate-card-requiere-conexion`). ADR-003 afirmaba que ninguna ejecución vieja podía tomar la rama. Un
spike con el SDK real, con dos controles en verde, mostró lo contrario. El impacto medido en prod fue
de 0/69 sesiones vivas, así que no era un bug vivo, pero el argumento era falso.

**Cómo aplicarlo:**
- El impacto se mide, no se argumenta. El SDK upsertea `TemporalChangeVersion` con cada marker, así
  que una consulta de visibility (sólo lectura) cuenta las sesiones afectadas:
  `ExecutionStatus='Running' AND TemporalChangeVersion='<patch viejo>'` menos las que ya tienen el
  nuevo. El control positivo es un patch viejo conocido, que tiene que dar > 0. El auditor lo
  midió con un script de scratchpad (no versionado, descrito en el doc de A3 §5); la versión
  idempotente en `scripts/` es la fila 4 del contrato de backend de A3.
- Para simular un deploy en el test server de time-skipping, usar `max_cached_workflows=0` en el
  worker «viejo». Si no, el turno siguiente va a la sticky queue del worker apagado, que ese server
  nunca vence, y el test cuelga con «el turno no respondió» (el control también falla).

Evidencia: `docs/copiloto-emprendedor/Auditorias/2026-09-22-auditoria-A3-ola-3.md` (H-A3-3, §B).
Relacionado: [[instrumentos-que-confirman-en-vez-de-verificar]].
