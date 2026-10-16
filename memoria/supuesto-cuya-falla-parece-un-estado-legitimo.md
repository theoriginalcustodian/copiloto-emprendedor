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

## Refuerzo 2026-10-16 — el fail-closed de RLS: `0 filas` se lee como «no tiene»

El operador preguntó si su usuario ya tenía ARCA vinculado. La consulta natural es
`select count(*) from uc_factory.afip_credentials where cliente_id = '<uuid>'`, y **habría devuelto
0 estando vinculado**.

Motivo: la tabla tiene `FORCE ROW LEVEL SECURITY` y su policy es
`cliente_id = uc_factory.current_cliente_id()`, que lee la GUC `request.jwt.claims`
(`deploy/worker/provision_tables.py:49`). Sin declarar el tenant la función devuelve **NULL**,
ninguna fila matchea, y el resultado es 0 filas. Eso es **fail-closed** y es el comportamiento
correcto del control de seguridad — el problema es cómo se lee: el `0` de «no tengo permiso de
verlo» es **el mismo byte** que el `0` de «no existe». Y la conclusión que invita es la peor de las
dos: «no está vinculado» manda a revisar el onboarding en vez de la conexión.

Lo notable es que el repo **ya lo había pagado y documentado**: `e2e_facturacion_http.py:63` tiene la
nota exacta («sin declarar el tenant esta consulta devuelve 0 filas y el script aborta con "no tiene
certificado activo" — un diagnóstico falso»). Y su gemelo `_precheck_midia_readonly.py:45` hace la
**misma pregunta sobre la misma tabla sin declarar el tenant**: dos lecturas del mismo dato, una con
la salvaguarda y otra sin ella. Cuál de las dos tiene razón no se decide por simetría, se decide por
cuál pregunta hacen — y hacen la misma. (Pendiente de medir: si el rol del DSN tiene `BYPASSRLS`,
`_precheck` acierta por accidente. Esa es la pregunta, no el veredicto.)

**Lo que hice, y es el patrón reutilizable:** el reporte **abre con un control** que cuenta la tabla
**sin** declarar tenant. Tiene que dar 0. Si da más, RLS no está aplicando a ese rol y el resto hay
que leerlo distinto. Así el riesgo de falso negativo queda **visible en la salida** en vez de
implícito en un número; y además el reporte filtra por `current_cliente_id()` de forma explícita
aunque RLS ya lo haría, para ser correcto en las dos ramas.

**La regla:** antes de leer un `0` como ausencia, preguntá qué mecanismo podría estar devolviéndolo
como negativa. Si existe uno —RLS, un filtro de scope, un permiso, un `graph_id`—, el instrumento
necesita un control que distinga «no hay» de «no veo». Sin ese control, los dos casos se reportan
igual y el más alarmante de los dos es el que no da síntoma.
