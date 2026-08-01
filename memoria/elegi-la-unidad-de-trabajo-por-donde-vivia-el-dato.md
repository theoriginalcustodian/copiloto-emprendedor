---
name: elegi-la-unidad-de-trabajo-por-donde-vivia-el-dato
description: El ciclo de auto-reparación nació con un Schedule POR TENANT porque la DLQ tiene RLS y hacía falta un tenant para leerla. La restricción de acceso eligió la arquitectura, y era la unidad equivocada — el bug está en nuestro código, no en los datos del emprendedor. Además fue una decisión MAYOR que tomé sin escalar.
metadata:
  type: feedback
---

# 🧭🪣 Elegí la unidad de trabajo por dónde vivía el DATO, no por qué era el TRABAJO

El ciclo de auto-reparación se construyó con **un Temporal Schedule por tenant**: 19 disparos a las
04:00, uno por emprendedor activo. El operador lo cazó de una:

> *"acá hay un error grave de diseño... el autohealing es para todo el copiloto entero, no por
> usuario... el día que haya 5000, a las 4am habrá 5000 procesos... nunca me lo consultaste"*

Tenía razón en las dos cosas, y la segunda es la más importante.

## La falla de razonamiento

La DLQ (`copiloto_traumas`) tiene `FORCE ROW LEVEL SECURITY`. Para leerla hay que declarar un tenant.
De ahí salió, sin que nadie lo decidiera explícitamente, *"entonces el ciclo es por tenant"*.

**La restricción de ACCESO eligió la unidad de TRABAJO.** Y son cosas distintas:

| | |
|---|---|
| Dónde vive el dato | en filas con dueño, protegidas por RLS |
| Qué es el trabajo | reparar un bug de **nuestro** código |

Un `KeyError` en `fingerprint.py` es el mismo defecto lo haya pegado el tenant A o el Z. **El tenant
es un atributo de la *ocurrencia*; la unidad de reparación es el *bug*.** Partir el ciclo por tenant
era partirlo por un eje que no es el del problema — y una vez partido así, todo lo de encima hereda
el eje equivocado: el Schedule, el workflow, el tope diario, el E2E.

El síntoma que lo delata: el índice único de la DLQ es `(cliente_id, fingerprint)`, o sea que **un
solo bug que toca N tenants deja N filas idénticas salvo el dueño**. El diseño por tenant proponía N
parches iguales y N PRs iguales. Eso estaba a la vista en el DDL desde el día 1 y no lo leí como lo
que era: la prueba de que la unidad estaba mal elegida.

## La pregunta que lo hubiera evitado

Antes de fijar la unidad de trabajo de cualquier proceso batch/periódico:

> **¿Estoy particionando por el eje del PROBLEMA, o por el eje del CONTROL DE ACCESO que me tocó
> atravesar para llegar al dato?**

Si la respuesta es la segunda, el diseño va a escalar con la cantidad de *tenants* en vez de con la
cantidad de *trabajo real* — y eso no se nota mientras haya pocos, porque **con un solo tenant las
dos arquitecturas se ven idénticas**. De ahí que el control del rediseño tenga que ser
específicamente cross-tenant: dos ocurrencias del mismo fingerprint con dueños distintos → **una**
reparación. Con un tenant, cualquiera de los dos diseños da verde.

## Y la falla de proceso, que es la que el operador nombró primero

*"nunca me lo consultaste"*. **La topología de orquestación de un proceso que corre en producción
es MAYOR**, no táctica: define cómo escala el sistema y es cara de revertir una vez que hay
Schedules vivos, código y tests apoyados encima. Entraba de lleno en el protocolo de decisión
(escalar con Plan v1 + v2 + recomendación) y no lo escalé — la resolví como si fuera un detalle de
implementación porque *se sentía* como una consecuencia técnica del RLS.

Ese es el mecanismo: **una decisión MAYOR disfrazada de consecuencia inevitable de una restricción
técnica no se siente como una decisión**. No hay momento en que uno diga "elijo esto": hay un
momento en que uno dice "bueno, con RLS tiene que ser así". Y ahí ya se decidió, sin escalarlo y sin
registrarlo.

Señal de alarma concreta, para la próxima: **si estoy diseñando algo alrededor de un mecanismo de
seguridad (RLS, permisos, aislamiento) y la forma del diseño la está dictando ese mecanismo, eso es
MAYOR.** Cualquiera de las dos salidas —adaptar la arquitectura al control, o darle al proceso un
rol que lo saltee— es una decisión de arquitectura y de postura de seguridad. No es táctica.

## Lo que la solución NO es

El operador dijo *"se le da rol de superusuario y listo"*. Lo implementado es un rol dedicado con
**`BYPASSRLS`, no superusuario**: misma capacidad para esta función, radio de daño mucho menor.
`BYPASSRLS` saltea las policies **pero no otorga un solo permiso** — lo que el rol puede tocar sale
de sus `GRANT`, y son exactamente una tabla. Eso es lo que hace verificable la respuesta a *"¿no
perjudica la seguridad?"*: `deploy/copiloto/provision-rol-autosanacion.sh` imprime al final la lista
de tablas alcanzables, medida contra `information_schema`, en vez de afirmarlo.

Y el provisionado termina con un **control diferencial**, no con un "conectó OK": inserta una fila
sonda de un tenant ajeno y exige que el rol nuevo la vea **y que la conexión normal no**. Sin el
control negativo, un verde no distinguiría "el rol saltea RLS" de "RLS no está aplicando" — y sin el
control positivo, un rol que ni llega a conectar devolvería *"0 traumas"*, o sea *"no hay nada que
reparar"*: [[un-mecanismo-roto-hacia-el-no-no-da-sintoma]] otra vez.

## Hermanas

- [[un-mecanismo-roto-hacia-el-no-no-da-sintoma]] — por qué el verde del provisionado tiene que ser
  diferencial y no un "conectó OK".
- [[el-test-que-no-usa-el-camino-de-produccion-no-puede-verlo-fallar]] — por eso el rol se replica en
  la base de tests en vez de usar el superuser.
- [[reutilizacion-es-regla-el-inventario-va-antes-del-diseno]] — cómo se enuncia el problema decide
  la solución; acá *"la DLQ tiene RLS"* enunciado como restricción produjo la partición equivocada.
- [[desplegado-no-significa-con-clientes]] — con 19 tenants sintéticos y 0 traumas reales, el
  diseño por tenant no daba ningún síntoma.
