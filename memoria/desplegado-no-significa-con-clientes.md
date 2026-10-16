---
name: desplegado-no-significa-con-clientes
description: El copiloto está desplegado y vivo, pero NO tiene clientes ni datos reales — estamos en desarrollo, y confundirlo desvía las recomendaciones hacia riesgos que no existen
metadata:
  type: project
---

**El copiloto está desplegado, multitenant y vivo. NO tiene clientes.** Todos los datos son del
operador probando, o sintéticos. Estamos en **período de desarrollo**, y para probar el sistema hay
que **fabricar** los datos, no esperarlos.

**Por qué se confunde, que es lo que hace que valga escribirlo.** La memoria de este repo dice
*«prod-beta»*, *«DESPLEGADO VIVO»*, *«smoke E2E 10/10 BETA-READY»*
([[copiloto-deploy-multitenant-vivo]]). Todo eso es **cierto** y todo eso se lee como *«hay usuarios
del otro lado»*. **Desplegado ≠ con clientes.** El sistema corre; nadie lo usa todavía.

**Cómo se manifiesta el sesgo (caso real, 2026-07-22).** Diseñando la ontología del grafo apareció que
`copiloto_clientes` se edita in-place y no guarda historial, y planteé el problema como *«se pierde
historia real de clientes»* y pregunté *«¿desde cuándo arranca la historia, hay que hacer backfill?»*.
Con cero clientes, **no hay historia que preservar ni backfill que decidir**: la historia se fabrica
con las fechas que uno quiera. La pregunta correcta era otra —y mejor— pregunta.

**El costo del sesgo no es sonar mal: es recomendar lo equivocado.** Empuja hacia migraciones
cuidadosas, compatibilidad hacia atrás, ventanas de mantenimiento, "no rompamos a los que ya
están" y despliegues conservadores — **todo pagado, nada necesario**. Y en la dirección opuesta,
esconde lo que sí importa ahora: que en desarrollo se **itera**, y lo que hay que optimizar es el
costo de **rehacer**, no el de romper.

**El mismo argumento, girado (así se ve la diferencia).** *¿Log append-only o ingesta inline al
grafo?* Razonando como si hubiera producción: *«sin log, si falla una escritura se pierde historia de
un cliente»* — un riesgo hipotético. Razonando desde desarrollo: **cambiar la ontología no reprocesa
lo ya ingestado**, así que cada iteración del diseño exige tirar el grafo y volver a llenarlo; con un
log append-only eso es re-derivar, sin log es regenerar los datos a mano cada vez. **El log es
primero una herramienta de desarrollo, y de paso una garantía de producción.** Misma conclusión, razón
verdadera, y ahora sí justificada por lo que está pasando hoy.

**Y algo que sólo aparece desde acá:** el dataset sintético tiene que incluir **cambios en el tiempo**
—un cliente que se muda, un precio que sube, un presupuesto que se rechaza—. Un dataset plano (cada
cosa con un solo valor) hace que la bitemporalidad **dé verde sin haber sido ejercitada nunca**: el
instrumento no toca la condición que puede fallar. Hermana de
[[instrumentos-que-confirman-en-vez-de-verificar]].

**How to apply:** antes de recomendar algo que dependa de "los usuarios", preguntarse *¿qué usuarios?*
— hoy, ninguno. (1) Los datos de prueba se **generan**, no se esperan; y se generan **con historia**
si lo que se prueba es temporal. (2) Nada de compatibilidad hacia atrás, migraciones defensivas ni
ventanas de mantenimiento: se puede borrar y rehacer. (3) Optimizar el costo de **iterar**, no el de
romper. (4) Lo que sí sigue valiendo igual: el aislamiento multitenant se diseña y se testea **desde
ahora** —porque cuando haya clientes ya va a ser tarde para agregarlo— y los secretos no se pegan en
el chat. Emparenta con [[no-insistir-rotacion-keys-desarrollo]], que aplica la misma distinción a las
credenciales.

**Cuándo dejar de aplicar esta entrada:** el día que exista el primer emprendedor real usando el
sistema. Ahí se invierte todo lo de arriba — y esta entrada hay que **borrarla**, no matizarla.

---

## Refuerzo 2026-10-15 — el estado VACÍO del tenant se lee como capacidad AUSENTE, y pasó TRES veces en un día

Las tres fabricaron trabajo que no existía, y las tres se cazaban con la misma pregunta:

1. **`soporte` / «Ver tickets anteriores»** — se dio por ausente. El código estaba desde #1115
   (`e3d1efa3`). El canónico no tenía tickets.
2. **`preg` / la card de resultado** — el mapeo decía «NO EXISTE». Existe: lo midió FE2 en device.
3. **`CLIENTESCUIT` / «`clientes` muestra teléfono donde el prototipo pide CUIT»** — medido el
   2026-10-07 sobre el PWA servido, y **cierto como observación**. Pero
   `packages/core/src/api/clientes.ts:258` devuelve el documento **sólo si `docNro` no está vacío**, y
   si no cae a `[telefono, email, domicilio, notas]` a propósito (`TarjetaCliente.tsx:19`: «para no
   dejar homónimos indistinguibles»). El cliente de esa medición **no tenía documento cargado**. No
   había layout que arreglar ni forma que decidir: se vio el fallback diseñado.

**El test que las caza, antes de abrir un hallazgo:** *¿lo que veo vacío es del PRODUCTO o del TENANT?*
Concreto: ¿existe una rama del código que produzca exactamente esto cuando el dato falta? Si existe,
el hallazgo no es «falta la capacidad» sino «falta el dato», y el dueño es otro — con otro disparador y
otro costo.

**Por qué muerde acá en particular:** este repo mide la app contra un prototipo que está **lleno de
datos de ejemplo**. El prototipo siempre tiene el caso poblado; el canónico casi nunca. Así que la
comparación prototipo-vs-app, hecha sobre un tenant vacío, produce DESVÍO sistemático en toda fila
cuya forma dependa del dato — y el DESVÍO se lee como defecto de implementación.

**Y lo que no se arregla con cuidado:** mientras el estado del tenant no se pueda fabricar, la
pregunta vuelve en cada fila. Por eso el `contrato_` del 2026-10-15 convierte
`deploy/copiloto/setup_tenant_pruebas.py` en la salida (una palabra del operador: vincularlo al
canónico o declarar las filas `NO_MEDIBLE`) en lugar de volver a discutir fila por fila.

Relacionadas: [[un-degradado-prudente-hacia-el-caso-benigno-envenena-la-medicion]] ·
[[supuesto-cuya-falla-parece-un-estado-legitimo]] · [[usuario-de-prueba-canonico-uno-solo-a-fuego]] ·
[[un-nombre-con-dos-referentes-prueba-A-y-concluye-B]]
