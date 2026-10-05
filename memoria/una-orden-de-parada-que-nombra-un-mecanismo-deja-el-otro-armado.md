---
name: una-orden-de-parada-que-nombra-un-mecanismo-deja-el-otro-armado
description: El checklist de parada decía «apagá tus crones»; un MONITOR armado sobrevive al turno y ACTÚA — casi disparó solo el merge que la orden prohibía
metadata:
  type: feedback
---

Bajé una orden de detener las cuatro sesiones con un checklist de 5 pasos. El paso 5 decía **«apagá
tus crones»**. Auditoría lo cumplió y además me avisó que eso **no alcanzaba**: tenía armado un
**monitor** (`b7avs6hza`) vigilando `origin/main` para mergear `#771` en cuanto entrara `#770`.

**Un monitor no es un cron y no es pasivo.** Sobrevive al turno de la sesión y **actúa**: habría
disparado solo el merge que la orden prohibía explícitamente, **sin que ninguna sesión estuviera
«trabajando»**. Una sesión «detenida» con un watcher activo no está detenida: está armada.

**Why:** un checklist que enumera mecanismos sólo apaga los que nombra. El que no nombrás queda
armado, y el silencio de la sesión se lee como cumplimiento. Es peor que un cron olvidado: un cron
despierta a alguien que puede decidir; un monitor **ejecuta la acción prohibida por su cuenta**. La
diferencia que importa no es «cron vs monitor» sino **¿avisa o ACTÚA?** — el que sólo notifica es
inocuo; el que mergea, pushea o deploya es la orden violándose sola.

**How to apply:** toda orden de parada (o de congelamiento, o de freeze antes de un release) enumera
**los dos ejes**: (1) lo que despierta — `CronList`/`CronDelete`, y (2) lo que **actúa** — `Monitor`
armados, `Bash` con `run_in_background` vivos, watchers de CI, cualquier cosa suscrita a un evento
externo. Y la pregunta que ordena la revisión no es «¿qué tengo corriendo?» sino **«¿algo mío puede
ejecutar una acción sin que yo esté en el turno?»**. Si la respuesta es sí, `TaskStop` antes de
declarar la parada. Agregué esto como **paso 6** del checklist, *dentro* de la lista y no appendeado
al final, porque un `>>` al pie no lo lee nadie ([[de-dos-artefactos-con-distinta-precision-gana-el-que-circula]]).

Corolario del mismo día, del lado del instrumento: quise medir mis propias tareas de fondo con
`find <tasks-dir> -mmin -5` y me devolvió un archivo «vivo». Era **el output de mi propio comando** —
cada invocación crea el suyo. La pista fue que **el nombre cambió entre dos mediciones consecutivas**.
Un instrumento que se mide a sí mismo reporta actividad que es la suya
([[instrumento-que-no-mira-nunca-falla]] es su espejo: acá mira, pero se mira).

Relacionado: [[el-vigilante-muere-con-la-sesion-y-nadie-lo-vigila-a-el]] es el caso inverso y por eso
no cubría éste — ahí el vigilante **muere** y nadie lo nota; acá **sobrevive y obra**. Los dos salen
de la misma pregunta sin hacer: *¿qué pasa con mis mecanismos cuando la sesión cambia de estado?*
