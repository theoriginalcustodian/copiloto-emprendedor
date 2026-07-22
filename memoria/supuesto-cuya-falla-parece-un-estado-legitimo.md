---
name: supuesto-cuya-falla-parece-un-estado-legitimo
description: Aislar un supuesto con ASSUMED_PENDING_VERIFY no alcanza — hay que preguntarse cómo se vería si fuera falso, porque si la falla es indistinguible de un estado legítimo nadie va a ir a mirar
metadata:
  type: feedback
---

**LEER al escribir un `[ASSUMED_PENDING_VERIFY]`, o al construir contra un contrato que todavía no se
pudo medir.**

El 2026-07-22, implementando el alta de clientes con `POST /clientes` todavía en 405, marqué dos
supuestos y los aislé cada uno en una función. Uno se cumplió. El otro —la clave del id del dueño en
el `409`— **estaba mal**: yo probaba `cliente_id`/`id`/`duplicado_id`; venía la ficha entera bajo
`cliente`.

Aislarlo estuvo bien. **El problema es que lo aislé y seguí.**

## Lo que hace peligroso a este error en particular

Mi degradación era prolija: si no encontraba el id, mostraba el aviso **sin el botón para abrirlo**.
Elegante, honesta, y **catastrófica como señal**, porque ese síntoma tiene una lectura natural:

> *"el backend no manda el id"*

Es decir: **mi suposición equivocada producía un estado que se explica solo, con la explicación
equivocada, y señalando a otro.** Nadie iba a leer el body. El sistema no se veía roto — se veía como
un backend con una carencia. Y es un tipo de falla que sobrevive indefinidamente, porque cada vez que
alguien la mire va a confirmar la misma conclusión falsa.

## La regla

Escribir `[ASSUMED_PENDING_VERIFY]` **no es el final del trabajo, es la mitad**. Después va la
pregunta:

> **¿Cómo se vería el sistema si este supuesto fuera falso?**

Y según la respuesta:

| Si la falla se vería… | Entonces |
|---|---|
| **Como un error ruidoso** (excepción, 4xx, test rojo) | tolerar y seguir. La realidad va a avisar. |
| **Como un estado legítimo** (una carencia del otro lado, un dato vacío, una función "que todavía no está") | ⛔ **no alcanza con marcar: hay que PREGUNTAR.** Emitir el `pedido_`, o medirlo, antes de construir encima. |

**Un supuesto cuya falla es indistinguible de un estado legítimo no es una marca: es una pregunta que
no hiciste.**

## Por qué se escapa

Es la misma pregunta que ya se aplica a los instrumentos —*¿qué devolvería si lo que mido estuviera
roto?* ([[instrumentos-que-confirman-en-vez-de-verificar]])— pero **aplicada al propio diseño**, no a
una herramienta. Y ahí no salta sola: marcar el supuesto **se siente** como haber hecho lo correcto.
La marca da la sensación de rigor cumplido y **cierra el tema**, que es exactamente lo que no debería
hacer.

Nota del caso: el contrato decía *«con su id en el body»* y la otra sesión hizo algo mejor —la ficha
entera— porque el propósito era **poder nombrar al dueño**. Las dos capas siguieron el contrato y no
se habrían encontrado. La lección espejo, del lado de quien escribe contratos, es **fijar el propósito
en vez del mecanismo**: un contrato que fija el mecanismo invita a mejorarlo.

Hermana de [[no-codificar-la-esperanza-principio-raiz]] (una hipótesis marcada sigue siendo hipótesis)
y de [[vacio-no-es-hallazgo-correr-el-control]] (el caso donde el vacío no protesta). Caso completo en
`coordinacion/.../dato_..._clientes-el-409-NO-trae-el-id`, commits `e8681f8` → `702fa1a`.
