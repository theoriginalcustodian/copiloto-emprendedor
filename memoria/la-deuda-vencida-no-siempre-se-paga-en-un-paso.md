---
name: la-deuda-vencida-no-siempre-se-paga-en-un-paso
description: Una deuda con la condición de pago cumplida puede no ser pagable de una — el código que la mantiene viva la sostiene; ir a mirar antes de tirarla
metadata:
  type: feedback
---

**Antes de cobrar una deuda vencida, buscá quién la está sosteniendo.** No alcanza con que se cumpla
la condición de pago: hay que ver qué código toca todavía eso que vas a borrar.

**El caso (2026-07-22, columna `contacto` de `copiloto_clientes`).** La deuda tenía condición de pago
explícita —*el primer deploy posterior a que FRONTEND cierre su hito 9*— y se cumplió, verificada en
device. Fui a tirar la columna y encontré que `provision.py::_ensure_clientes_email_telefono` corre
en **cada** deploy y nombra `contacto` en el `WHERE` de un `SELECT` y de un `UPDATE`. Para eso **no
existe** un `IF EXISTS` que valga: contra una columna borrada tira `UndefinedColumn`, y dentro de una
transacción eso aborta **el deploy entero**, no sólo esa migración. El pago se partió en dos: (1) que
la migración se saltee sola cuando la columna no está, (2) el `DROP`.

**Por qué rinde.** La condición de pago se escribe cuando se contrae la deuda, mirando el *dominio*
("cuando la UI use los dos campos"). Lo que impide cobrarla suele estar en otro lado — en el andamio
que se construyó **para** migrar. Ese andamio es invisible desde la condición de pago: nadie lo
anota, porque en el momento de escribirla todavía no existía. Y falla en el peor momento: no al
borrar, sino en el deploy **siguiente**, lejos del cambio que lo causó.

**El guard tiene su propia trampa.** Preguntarle al catálogo (`information_schema.columns`) es la
solución, pero una consulta mal escrita —schema o nombre equivocado— devuelve `None` **siempre**: la
migración se saltearía en silencio **con la columna presente**. Un guard que confirma en vez de
verificar. Por eso el test contra la base real no prueba que se saltee, prueba que la consulta
**encuentra** la columna hoy. Ver [[instrumentos-que-confirman-en-vez-de-verificar]].

**Cómo aplicarlo.** Al vencer una deuda: `grep` del nombre de lo que vas a borrar **en todo el
repo**, no sólo en la capa que la contrajo — mirando en particular el código de deploy/migración, que
corre siempre y no aparece en ningún test de feature. Si algo lo sostiene, el pago son dos pasos y el
primero es retirar el sostén. Y si el segundo es irreversible sobre una base viva, es del operador,
aunque midas 0 filas afectadas. Ver [[cero-deuda-no-gestionada]].
