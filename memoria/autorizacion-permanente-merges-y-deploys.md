---
name: autorizacion-permanente-merges-y-deploys
description: El operador autorizó (2026-07-23) merges a main y deploys de forma PERMANENTE en copiloto-emprendedor — no se escala cada uno. Planificación los ejecuta bajo la cadencia progresiva; solo se escala lo MAYOR
metadata:
  type: project
---

El operador dio **autorización permanente de merges a `main` y deploys** en `copiloto-emprendedor`
(2026-07-23, textual: *"autorizo merges y deploys para siempre en este repositorio... no necesito
estar autorizándolo a cada rato"*). Cansado de que se le pidiera caso por caso.

**Cómo aplica:** la sesión PLANIFICACIÓN (dueña del buzón) ejecuta los merges y coordina los deploys
bajo la **cadencia progresiva** ([[entrega-progresiva-y-e2e-en-device]]) — PR chico → merge → deploy →
verificación en device (`e2e-device`) → `listo_`. NO se escala cada merge/deploy.

**Lo que SÍ se sigue escalando (MAYOR, [[trabajo-por-fases-no-anticipar]]):** cambio de contrato
externo, algo irreversible/destructivo, un PR que toca >5 archivos cross-cutting, cambio de stack/ADR,
o scope/dirección de sprint. Ahí sigue decidiendo el humano.

**Mecánica del harness:** el clasificador de auto-mode bloqueó `gh pr merge` hasta que el operador
autorizó en el hilo; después habilitó. Si en una sesión nueva el clasificador vuelve a bloquear
`gh pr merge`/deploy, el operador puede agregar una **regla de permiso de Bash** en su settings para
no depender de autorizarlo en el chat. La intención declarada es permanente — no re-preguntar la
decisión, solo resolver el permiso técnico si reaparece.

**No es solo merges — es toda decisión TÁCTICA (corrección del operador, 2026-07-23).** Escalé
narra-sin-hacer como *"¿le doy el visto para que backend implemente el fix?"* y el operador respondió:
*"¿de verdad es necesario que diga si implementalo... para una nimiedad como esa? Para esto estás vos
coordinando."* La lección: **relayar un go-ahead táctico de implementación entre sesiones ES trabajo
del coordinador, no algo que se rebota al humano.** Cuando el fix ya está diseñado/de-riskeado y es
reversible, planificación **decide y lo baja al buzón** — no re-pregunta. El valor del coordinador no
está en pedir permiso: está en **acotar el cómo** (invocar `temporal-developer`, versionar por replay,
señalar la evidencia a re-testear). Lo único que sube al humano sigue siendo lo MAYOR (irreversible,
contrato externo, >5 archivos, stack/ADR, scope de sprint) — el fix del motor de narra, aunque toca
estado durable, ya tenía el "dale" y el de-risk hecho: era acote, no sign-off. Hermana de
[[ejecutar-autonomo-no-esperar-si-dale]].

Las tres sesiones siguen sin poder auto-mergear (clasificador). El merge lo hace planificación.
[[coordinacion-tres-sesiones-buzon]] · [[orden-de-merge-por-el-estado-intermedio]]
