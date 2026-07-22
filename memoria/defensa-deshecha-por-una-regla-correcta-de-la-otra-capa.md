---
name: defensa-deshecha-por-una-regla-correcta-de-la-otra-capa
description: Una defensa deliberada de una capa puede quedar anulada por una regla de la otra que es correcta en su propio contexto — nadie se equivocó, y el dato se pierde igual
metadata:
  type: project
---

**LEER cuando la otra capa te avisa que preserva algo A PROPÓSITO, o cuando una capa tuya tiene una
regla del tipo "si falta X, tirá Y".**

El 2026-07-22, hito 6 de Clientes. Backend decidió deliberadamente: si el dictado da un documento que
no es CUIT (11) ni DNI (7-8), **el número viaja igual** con `doc_tipo: null`, para que el emprendedor
lo corrija. Lo escribió en el `dato_`, lo justificó, y tenía razón: borrarlo haría desaparecer **el
error junto con el dato**.

Mi formulario tenía su propia regla, también correcta: *«sin tipo de documento no hay número —
mandar uno suelto sería un dato que nadie puede leer»*. Por eso el campo del número **se pintaba sólo
si había tipo elegido**.

Compuestas, en el caso exacto que backend quiso proteger:

- el número **no se veía** → no había nada que corregir;
- y el body lo mandaba en `null` → **el dato tampoco viajaba**.

El alta salía «bien», con un cliente sin documento que el emprendedor creyó haber cargado. **La
defensa de backend murió dos capas después, sin un solo síntoma.**

## Por qué esto NO es "un supuesto equivocado"

Es lo que lo hace distinto de [[supuesto-cuya-falla-parece-un-estado-legitimo]]: **acá nadie asumió
nada mal**. Leí el `dato_`, entendí el porqué, lo respeté en el lector (`clientePropuesto.ts` conserva
el número, y hay un test 🔴 que lo prueba) y hasta lo escribí en el docstring. La regla del formulario
también era correcta — **para el alta a mano**, que es el contexto donde se escribió, y donde el
número sin tipo sólo puede existir si el usuario se arrepintió a medias.

El defecto no vive en ninguna de las dos reglas. Vive en que **una capa nueva las puso en contacto**
en un caso que ninguna de las dos contemplaba. Y el test de la primera mitad pasaba en verde: probaba
que el lector conserva el número, no que **alguien lo pueda ver**.

## La regla

Cuando la otra capa declara que **preserva algo a propósito**, no alcanza con preservarlo en tu
frontera. Hay que seguirlo hasta donde el humano lo ve o hasta el body que sale, y preguntar en cada
salto:

> **¿Hay alguna regla mía, correcta en su contexto, que lo descarte acá?**

Las candidatas son siempre del mismo molde: *«si falta X, no muestro Y»*, *«si falta X, mando Y en
null»*, *«si no es válido, lo omito»*. Cada una es razonable donde nació. Ninguna sabe que ahora entra
un dato que llega **incompleto a propósito**.

Y el corolario para los tests: un test que verifica que el dato **entra** no verifica que el dato
**sobreviva**. El caso 🔴 tiene que ser de punta a punta — *«se ve en pantalla»* y *«sale en el body»*,
no *«el parser lo devolvió»*.

## Cómo quedó

El campo se muestra si hay número, con o sin tipo, más un aviso que **no bloquea** (*«elegí si ese
número es DNI o CUIT»*) y que **no replica el 400 de backend** — cubre un hueco que el servicio no
puede ver, porque con el tipo vacío el número nunca le llega. Se le declaró a backend en el `listo_`
del hito 6, con la pregunta abierta de si prefieren que el número viaje igual y el 400 sea de ellos.

Hermana de [[verificar-que-el-camino-recomendado-existe]] (cada lado verificó su mitad y la junta no
era de nadie) y de [[validacion-de-mas-en-la-ui-enmascara-bugs]] (una regla de más en la UI tapando lo
que la otra capa quería mostrar). Commit `fd93d5a`.
