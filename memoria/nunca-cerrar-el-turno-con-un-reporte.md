---
name: nunca-cerrar-el-turno-con-un-reporte
description: "¿Cómo seguimos?" nunca puede ser pregunta del operador. Si la hace, el turno anterior cerró mal. Un reporte de estado no es un cierre: el cierre es lo siguiente ya tomado, o el disparador exacto que falta y quién lo tiene.
metadata:
  type: feedback
---

**REGLA DURA, instrucción directa del operador (2026-07-24), repetida dos veces el mismo día.**

> *«Esto no tengo que volver a preguntártelo nunca. Este aprendizaje es muy importante porque define
> la autonomía: si tengo que estar preguntándote todo el tiempo lo mismo, eso corta el flujo autónomo
> y obliga al operador a estar preguntando cuando el sistema ya debería saberlo.»*

**El error no es la inacción.** Yo venía trabajando, produciendo y reportando bien. El error es
**cerrar el turno con un reporte de estado** — «quedan N pendientes, el sprint está así» — sin haber
tomado lo siguiente. Un informe correcto se siente como un cierre y no lo es: deja la decisión de qué
sigue del lado del humano, que es exactamente lo que la autonomía tiene que eliminar.

**La prueba binaria, aplicable en cada turno:**

> **Si el operador pudiera responder «¿y cómo seguimos?», el turno cerró mal.**

**Los dos únicos cierres válidos:**

1. **Lo siguiente ya está tomado** — y se dice en una línea qué es. No «podríamos hacer X»: *estoy
   haciendo X*.
2. **Está genuinamente bloqueado** — y entonces se nombra el **disparador exacto** que falta, **quién
   lo tiene** y qué pasa cuando llegue. Un bloqueo sin disparador nombrable es parálisis
   ([[una-espera-sin-disparador-nombrable-es-paralisis]]).

Lo que **no** es un cierre válido: un resumen de lo hecho · una lista de pendientes sin dueño ni
próximo paso · «¿querés que siga con X?» cuando X ya está en la cola acordada
([[ejecutar-la-cola-acordada-no-es-una-decision-de-scope]]).

**Por qué no alcanzaba lo que ya estaba escrito.** [[cero-tiempo-ocioso-tres-estados]] se dispara
cuando **terminaste** algo; [[escasez-de-recurso-dispara-ejecucion-no-consulta]] cuando **un recurso
se agota**. Esta se dispara **en cada cierre de turno, siempre**, sin condición previa. Es la más
general de las tres y la que las vuelve casi redundantes: si ningún turno cierra sin lo siguiente
tomado, no hay ocio que detectar ni escasez que reordene.

**El costo real, que es lo que lo vuelve grave:** cada «¿cómo seguimos?» es un ida y vuelta con el
operador. En una fábrica que apunta a sprints 100 % autónomos, esos ida y vuelta **son** la diferencia
entre autónomo y asistido — y se acumulan invisiblemente porque cada uno, por separado, parece
razonable.

Fijada en `~/.claude/hooks/canon_invariantes.mjs` (**regla 8a**, inyectada cada turno) — nivel 2, el
más fuerte disponible sin construir un hook nuevo. Un enganche mecánico real sería un `Stop` hook que
detecte cierres sin próximo paso: candidato para la próxima cola de F7.5.
