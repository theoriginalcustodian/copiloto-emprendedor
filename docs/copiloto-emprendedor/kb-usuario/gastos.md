# Gastos

## Qué es y para qué sirve

Gastos es donde anotás la plata que sale de tu negocio: lo que pagás de mercadería, servicios, alquiler, sueldos, impuestos, o cualquier otro costo del día a día. Te sirve para tener un control real de en qué se te va la plata, con un resumen mensual por categoría, y para poder mirar más adelante el margen de tus trabajos con los gastos que le corresponden a cada uno.

## Por qué es distinto de anotar un ingreso

Ingresos y Gastos son dos caras opuestas de lo mismo: uno registra lo que entra, el otro lo que sale. La diferencia importante a tener en cuenta es que los gastos, a diferencia de los ingresos, **no se pueden editar ni borrar después de guardados** —así que conviene prestarle un poco más de atención antes de confirmar uno.

## Los tres orígenes de un gasto

Cada gasto queda etiquetado según cómo lo cargaste: a mano desde el formulario, dictado por voz al Copiloto, o extraído de la foto de un ticket. Esta distinción es más que un detalle interno — te permite, por ejemplo, mirar más adelante qué tan seguido usás cada forma de carga, y le sirve al Copiloto para saber cuándo mostrarte la sugerencia de monto leído del ticket en vez de esperar que lo tipees vos.

## Cómo cargar un gasto

Desde la pantalla de Gastos, tocás **Nuevo gasto** y completás:

- **Monto**: es el único dato obligatorio.
- **Fecha**: opcional; si no la tocás, se guarda con la fecha de hoy.
- **Categoría**: elegís entre las categorías disponibles (ver más abajo); si no elegís ninguna, queda como "Otros".
- **Proveedor**: opcional, a quién le pagaste.
- **Medio de pago**: opcional.
- **Descripción**: opcional, para anotar cualquier detalle.

Con solo el monto ya podés guardar el gasto — el resto lo completás si querés, cuando quieras.

## La fecha cuando no la especificás

Igual que con los ingresos, si cargás un gasto sin tocar la fecha, el Copiloto lo guarda automáticamente con la fecha de hoy calculada según el huso horario de Argentina, para evitar que un gasto cargado tarde a la noche quede registrado por error con la fecha del día siguiente.

## Categorías disponibles

Las categorías son una lista fija de ocho opciones:

1. Mercadería
2. Servicios
3. Alquiler
4. Sueldos
5. Impuestos
6. Transporte
7. Herramientas
8. Otros

Si no elegís ninguna categoría al cargar el gasto, queda clasificado automáticamente como "Otros".

## Un gasto guardado no se puede editar ni borrar

Es una decisión a propósito, no una limitación técnica: una vez que guardás un gasto, queda así. Si te equivocaste, la corrección se hace **antes** de guardarlo —en la tarjeta editable, cuando lo dictás por voz o lo sacás de una foto— nunca después. Tenelo en cuenta al cargar un gasto manual: revisá bien los datos antes de tocar guardar.

Lo único que sí podés hacer sobre un gasto ya guardado es asignarlo a un trabajo específico, para que el Copiloto pueda calcularte el margen de ese trabajo con sus gastos correspondientes.

## Asignar un gasto a un trabajo

Si querés saber cuánto te dejó ganando un trabajo puntual, podés asignarle los gastos que le correspondan desde el detalle de ese gasto. Esto no cambia ningún dato del gasto en sí (monto, categoría, etc.) — solo lo vincula a ese trabajo para que el cálculo de margen lo tenga en cuenta. Es la única acción disponible sobre un gasto después de guardado.

## El resumen mensual

Desde Gastos podés ver un resumen del mes: el total gastado, el desglose por categoría con el porcentaje que representa cada una sobre el total, y cuánto habías gastado el mes anterior para comparar.

## Registrar un gasto por voz o por chat

Podés decirle al Copiloto algo como *"pagué 12 mil de mercadería"* y te va a armar una propuesta con lo que entendió: monto, categoría (si la mencionaste o la puede inferir), proveedor, medio de pago y descripción.

Igual que en el resto de la app, **no se guarda directo**: te va a mostrar una tarjeta editable para que revises y ajustes cualquier dato antes de confirmar con "Guardar". Como después no vas a poder editarlo, este es el momento de corregir cualquier cosa que el Copiloto haya entendido mal.

## Registrar un gasto sacándole una foto al ticket

También podés sacarle o subir una foto a un ticket o comprobante de gasto, y el Copiloto va a leerlo automáticamente para sugerirte los datos: monto, fecha, proveedor y categoría.

Hay un detalle importante en cómo funciona esto, pensado para cuidarte de un error caro: **el monto que lee de la foto nunca se carga solo en el campo del monto.** Te lo muestra aparte, como una sugerencia tocable ("Del ticket leímos: $X — tocá para usarlo"), y tenés que tocarlo vos para que se copie al campo definitivo. Esto es a propósito: la lectura automática de una foto puede fallar sin que se note a simple vista, así que el Copiloto prefiere que confirmes vos el número final en lugar de darlo por bueno automáticamente.

El medio de pago nunca se completa solo desde una foto —una imagen de ticket no dice cómo pagaste, así que ese campo lo tenés que cargar vos si querés dejarlo asentado. Si la categoría que detecta no es ninguna de las ocho disponibles, se guarda como "Otros" sin que falle nada.

## Por qué la corrección se hace antes de guardar, y no después

Puede parecer una limitación incómoda al principio, pero tiene una razón concreta: un gasto es, para el Copiloto, un registro cerrado apenas lo confirmás —como si fuera un recibo que ya extendiste—, no un borrador que se pueda seguir tocando. Por eso todo el cuidado está puesto en el momento previo a guardar: la tarjeta editable cuando lo dictás por voz, y la sugerencia tocable (nunca automática) cuando lo sacás de una foto. Una vez que decidís confirmarlo, ese gasto queda como parte fija de tu historial.

## Errores y confusiones frecuentes

### "No me deja guardar el gasto"

Revisá que hayas puesto un monto mayor a cero; es el único dato realmente obligatorio.

### "Me equivoqué al cargar un gasto y no encuentro cómo corregirlo"

Los gastos ya guardados no se pueden editar ni borrar. Si necesitás corregir algo, revisá bien la tarjeta antes de confirmarla la próxima vez —esa es la única instancia donde se puede ajustar.

### "Le saqué una foto al ticket pero el monto salió en blanco"

Es el comportamiento esperado: el monto leído de la foto nunca se carga solo, aparece como sugerencia aparte para que la confirmes tocándola. Si el ticket estaba borroso o el número no se lee bien, puede que directamente no haya sugerencia y tengas que cargarlo a mano.

### "La categoría no coincide con lo que esperaba"

Solo existen ocho categorías fijas. Si tu gasto no encaja claramente en ninguna, va a quedar (o lo podés dejar vos) en "Otros".

### "¿Puedo asignar un gasto viejo a un trabajo?"

Sí, esa es la única acción que se puede hacer sobre un gasto después de guardado: asignarlo a un trabajo para calcular su margen. Sus datos (monto, categoría, etc.) no se pueden tocar.

### "El porcentaje del resumen mensual no suma exactamente 100%"

Puede pasar por redondeo cuando hay varias categorías con montos chicos; no es un error de cálculo, es una diferencia mínima de presentación.

### "Le dicté un gasto por chat y no aparece en mi lista todavía"

Fijate si te quedó pendiente la tarjeta de confirmación: hasta que no la revisás y tocás "Guardar", el gasto no está anotado de verdad.

### "Saqué la foto de un ticket arrugado o borroso"

El Copiloto va a intentar leerlo igual, pero si no logra identificar el monto con claridad, es posible que no te muestre ninguna sugerencia tocable. En ese caso, cargá el monto vos mismo a mano, mirando el ticket.

### "¿Por qué el medio de pago nunca se completa solo con la foto?"

Porque una foto de ticket no incluye esa información —no hay forma de que el Copiloto la infiera de la imagen—, así que ese campo siempre queda para que lo completes vos si te interesa dejarlo registrado.

## Preguntas frecuentes

**¿Puedo cargar un gasto de un mes anterior?** Sí, podés elegir cualquier fecha al cargarlo; a diferencia de las facturas, no hay una restricción de rango de días para los gastos.

**¿Los gastos afectan mis facturas o mis impuestos de alguna forma automática?** No directamente: Gastos es un registro interno tuyo, separado del circuito fiscal de Facturación. Te sirve para tu propio control, no genera ningún movimiento ante AFIP.

**¿Qué pasa si cargo dos veces el mismo gasto por error?** No hay una detección automática de gastos duplicados como sí existe para los ingresos. Prestá atención antes de guardar, sobre todo si cargás el mismo ticket dos veces por accidente.

**¿Puedo ver todos mis gastos de una categoría en particular?** El resumen mensual te muestra el desglose por categoría con sus montos y porcentajes; para el detalle de cada gasto individual, revisá el listado completo de Gastos.

**¿Los gastos que registro afectan el cálculo de mi monotributo o mis impuestos?** No. Gastos alimenta el resumen de tu caja (cuánto entró y cuánto salió) y el desglose por categoría, pero no hace ningún cálculo impositivo automático — ni de categoría de monotributo, ni de ningún otro impuesto.

**¿Puedo cargar un gasto sin saber todavía a qué trabajo corresponde?** Sí, no hace falta asignarlo a un trabajo en el momento de cargarlo — podés hacerlo después, cuando quieras calcular el margen de ese trabajo puntual.

**¿Qué pasa si le saco una foto a un ticket que no es de un gasto de mi negocio?** El Copiloto va a intentar leerlo igual y sugerirte los datos, pero como el monto nunca se carga solo, tenés la oportunidad de darte cuenta y no confirmarlo si no corresponde.
