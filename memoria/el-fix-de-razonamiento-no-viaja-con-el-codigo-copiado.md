---
name: el-fix-de-razonamiento-no-viaja-con-el-codigo-copiado
description: Arreglar un fallo de razonamiento en UN script no lo arregla en el próximo que copie la técnica. El matiz que hacía correcta la corrección no viaja con el código reusado — hay que ponerlo donde el próximo constructor tropiece con él.
metadata:
  type: feedback
---

El 2026-07-24 a la mañana se arregló `no-ocio-check.sh`: rotulaba sesiones **contando menciones del
rol en el texto**, y eso falló seis veces seguidas. La corrección fue precisa — **la identidad la
asigna el prompt del cron que la ventana RECIBE**, no lo que la ventana dice.

Esa misma tarde, un agente construyó `vigilancia-check.sh` reusando explícitamente *«sólo la mitad
validada»* de aquel script. Y **reintrodujo el mismo fallo**: contó `grep -oc 'sesión BACKEND'` sobre
todo el texto del transcript.

Resultado, medido contra el estado real: la ventana de PLANIFICACIÓN que estaba **escribiendo en ese
instante** (`mtime` 0 min) tenía en su cola `sesión BACKEND` ×4, `FRONTEND` ×2, `PLANIFICACIÓN` ×2 —
porque estaba redactando contratos **para** backend. Se rotuló a sí misma como BACKEND, y el script
alarmó *«PLANIFICACION muda hace 63 min»* sobre una sesión viva.

**Una sesión que le escribe a otra la nombra más que a sí misma.** Ese es el matiz. Y no estaba en el
código que se copió: estaba en el razonamiento de por qué la corrección era correcta.

**La regla:**

> **Un fix de razonamiento no viaja con el código.** Si la corrección vive sólo en el diff, el próximo
> que reuse la técnica copia el mecanismo sin el matiz y reintroduce el fallo — con la agravante de
> que lo hace citando la corrección como aval.

**Dónde ponerlo para que sí viaje**, en orden de fuerza:
1. **Un comentario en el punto exacto del código** donde se toma la decisión, con el número medido.
   Es lo único que el que copia-pega se lleva puesto.
2. Un test que falle si se vuelve a la técnica vieja.
3. La entrada de memoria (la que estás leyendo) — la más débil: sólo sirve si alguien la busca.

**La señal de alarma:** un agente que dice *«reusé la parte validada de X»*. Preguntá **qué** parte y
**por qué** esa era la correcta. Reusar la conclusión sin el razonamiento es la forma más elegante de
repetir un error.

Relacionadas: [[la-regla-que-te-obliga-a-mirar-el-instrumento-equivocado]] (la corrección original) ·
[[instrumento-que-no-mira-nunca-falla]] · [[localizacion-estructurada-feedback-agentes]] ·
[[bucle-canonico-dos-auditorias-y-el-enganche]] (§11: el enganche mecánico > el documental).
