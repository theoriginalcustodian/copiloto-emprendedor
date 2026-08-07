# Clientes

## Qué es y para qué sirve

La sección Clientes es tu cartera: la lista de personas y negocios a los que les vendés, con sus datos de contacto y, cuando corresponde, su documento. Te sirve para no tener que volver a escribir los datos de un cliente cada vez, y para tener a mano un resumen de lo que le facturaste o presupuestaste hasta ahora.

Es importante que sepas algo antes de usarla: **hoy la cartera de Clientes y la Facturación funcionan por separado.** Cuando facturás, cargás los datos del cliente directamente en esa factura (nombre, documento, condición de IVA), sin elegirlo de tu lista de Clientes. La cartera se arma en el sentido inverso: a medida que facturás o presupuestás, el Copiloto detecta esos clientes nuevos y los agrega solo a tu lista, para que después tengas su historial a mano.

## Para qué te sirve tener la cartera al día

Aunque la cartera no interviene en el momento de facturar, sigue siendo útil tenerla completa: te deja ver de un vistazo cuánto le vendiste a cada cliente a lo largo del tiempo, guardar sus datos de contacto para no andar buscándolos en otro lado, y hacer preguntas rápidas por chat como "cuánto le facturé a tal cliente este año" sin tener que revisar factura por factura.

## Qué datos se guardan de un cliente

El único dato obligatorio es el **nombre**. Todo lo demás es opcional y lo cargás si lo tenés:

- Tipo y número de documento (CUIT, CUIL o DNI)
- Condición frente al IVA
- Domicilio
- Email
- Teléfono
- Notas libres, para lo que quieras recordar de ese cliente

Un cliente en tu cartera nunca puede quedar cargado como "Consumidor Final" — esa categoría es específicamente para ventas sin identificar al comprador, no tiene sentido asociarla a un cliente con nombre propio en tu lista.

## Cómo dar de alta un cliente

Desde Clientes, tocás **Nuevo cliente**, completás el nombre (lo único obligatorio) y lo que quieras del resto, y guardás. Así de simple: no te va a pedir más datos de los que realmente necesita para crear el registro.

## Cómo corregir un dato sin perder el resto

Cuando editás un cliente, solo se actualiza lo que tocás en ese momento — el resto de sus datos queda exactamente igual que antes. Esto significa que podés entrar solamente a agregar un teléfono que te faltaba, sin riesgo de que se te borre el email o el domicilio que ya tenías cargado. Si en algún campo específico querés borrar un dato (por ejemplo, sacar una nota que ya no aplica), tenés que dejarlo explícitamente vacío al editar — no alcanza con no tocarlo.

## Editar un cliente

Podés entrar a la ficha de cualquier cliente y editar sus datos cuando quieras. La edición es parcial: si tocás solo el teléfono, el resto de los datos queda como estaba.

## Por qué no hay botón de borrar

Hoy no existe una opción para eliminar un cliente de la cartera. Si un cliente ya no te interesa mantener, simplemente dejá de usarlo — sus datos van a quedar guardados, pero no afecta nada que sigan ahí.

## Qué ves en la ficha de un cliente

Además de sus datos de contacto, la ficha te muestra un resumen de lo que le facturaste: cuántas facturas y notas de crédito tiene, el monto neto facturado (las notas de crédito se restan del total), sus presupuestos, y sus últimas operaciones. Este historial se completa solo, a medida que facturás o presupuestás a nombre de ese cliente.

Si le preguntás al Copiloto por chat cuánto le facturaste a un cliente que no tiene CUIT ni DNI cargado, te va a avisar que no tiene forma de saberlo con certeza, en lugar de decirte que es cero — porque sin documento no hay manera confiable de vincular sus facturas.

## Dar de alta un cliente por voz o por chat

Podés pedirle al Copiloto que guarde un cliente nuevo con solo decirle el nombre — por ejemplo, *"anotame de cliente a Juan Pérez"*. No hace falta que le des más datos si no los tenés a mano en ese momento.

Igual que con facturas y presupuestos, **el Copiloto no lo guarda directo**: te muestra una tarjeta con lo que entendió para que la revises y confirmes vos tocando "Dar de alta". Hasta que no la confirmás, el cliente no quedó agregado a tu cartera.

Si le dictás un documento que no tiene sentido para el tipo que dijiste —por ejemplo, decís "CUIT" pero el número que diste tiene el largo de un DNI— el Copiloto no lo adivina ni lo guarda igual: te avisa de la contradicción para que lo corrijas.

## Cuándo conviene cargar el documento de un cliente

Aunque el documento no es obligatorio, cargarlo tiene un beneficio concreto: te habilita a ver en la ficha ese cliente cuánto le facturaste en total, con notas de crédito ya descontadas. Sin documento, esa parte del historial va a quedar vacía —no porque no le hayas vendido nada, sino porque el Copiloto no tiene con qué vincular sus facturas de forma confiable a esa ficha en particular.

## Buscar un cliente en tu cartera

Desde la lista de Clientes podés buscar por nombre, y la búsqueda no distingue mayúsculas ni acentos, así que no hace falta que escribas el nombre exactamente como lo cargaste. Si todavía no tenés ningún cliente cargado, la lista simplemente aparece vacía —no es un error, es que todavía no facturaste ni presupuestaste a nadie, o no diste de alta ninguno manualmente.

## Qué pasa si el cliente ya existe

El Copiloto no te deja duplicar un cliente por error:

- Si el **documento** que cargaste (CUIT, CUIL o DNI) ya pertenece a otro cliente de tu cartera, no te deja crear uno nuevo — te ofrece ir directamente a la ficha del que ya existe, porque es indudablemente la misma persona o negocio.
- Si el **nombre** coincide con uno que ya tenés pero sin documento cargado, te avisa por si es la misma persona, pero te deja la opción de crearlo igual —puede tratarse de otro cliente con el mismo nombre.

## De dónde sale un cliente que vos nunca cargaste

Es normal abrir la cartera y encontrar clientes que no diste de alta a mano. El Copiloto los detecta solo a partir de tus facturas y presupuestos ya hechos: cada vez que facturás o presupuestás a un cliente nuevo, ese nombre y (si lo tenía) su documento quedan agregados automáticamente a tu lista, para que no tengas que cargarlo dos veces. Esos clientes quedan marcados internamente como "derivados" para diferenciarlos de los que cargaste vos mismo, aunque en la práctica los ves y editás igual que a cualquier otro.

## Errores y confusiones frecuentes

### "No me deja guardar el cliente"

Revisá que hayas puesto un nombre; es el único dato obligatorio, pero sin él no se puede guardar.

### "Me dice que ese documento ya es de otro cliente"

Ya tenés un cliente cargado con ese mismo CUIT, CUIL o DNI. El Copiloto asume que es la misma persona o negocio y te lleva a su ficha en vez de crear un duplicado.

### "Cargué un cliente por voz y no aparece en mi lista"

Puede ser que la tarjeta con la propuesta todavía esté esperando que la confirmes. Fijate si tenés que tocar "Dar de alta" para que quede guardado de verdad.

### "¿Por qué no puedo elegir un cliente de mi lista al facturar?"

Hoy la facturación pide los datos del cliente directamente en el formulario de la factura, sin conectarse con tu cartera de Clientes. La cartera se completa después, con lo que ya facturaste.

### "No encuentro cómo borrar un cliente que cargué mal"

Por ahora no hay opción de eliminar clientes. Podés editarlo y corregir los datos, pero no borrarlo del todo.

### "Le pregunté al Copiloto cuánto le facturé a un cliente y me dice que no lo sabe"

Pasa cuando ese cliente no tiene documento cargado: sin CUIT, CUIL o DNI, el Copiloto no puede vincular con certeza sus facturas, así que prefiere avisarte en vez de arriesgar un número que puede estar mal.

### "Cargué mal un dato del cliente, ¿lo puedo corregir?"

Sí, a diferencia de los gastos o las facturas, los datos de un cliente sí se pueden editar en cualquier momento desde su ficha, las veces que necesites.

### "Busco un cliente y no aparece en la lista"

Puede ser que todavía no lo hayas dado de alta ni facturado a su nombre. Recordá que la cartera se completa tanto con lo que cargás vos como con lo que el Copiloto detecta de tus facturas y presupuestos.

### "¿Puedo cargar un cliente que es una empresa, no una persona?"

Sí, el campo nombre acepta tanto el nombre de una persona como una razón social; no hay distinción de tipo de cliente en la carga.

## Preguntas frecuentes

**¿Necesito cargar el documento de un cliente para poder facturarle después?** No para la cartera en sí —podés guardarlo solo con el nombre—, pero si después vas a facturarle con CUIT identificado, vas a tener que cargar ese documento en el formulario de la factura (que es independiente de esta ficha, como vimos).

**¿Qué diferencia hay entre un cliente "manual" y uno "derivado"?** Un cliente manual es el que diste de alta vos mismo, a mano o por voz. Uno derivado es el que el Copiloto agregó solo a partir de una factura o presupuesto que hiciste, sin que vos lo cargaras antes explícitamente.

**¿Se pierden los datos de un cliente si dejo de usarlo?** No, quedan guardados indefinidamente aunque no vuelvas a operar con ese cliente.

**¿Puedo tener dos clientes distintos con el mismo nombre?** Sí, si ninguno de los dos tiene documento cargado, el sistema te va a avisar por si es un duplicado pero te va a dejar crearlo igual —puede ser, por ejemplo, dos personas distintas que se llaman igual.

**¿El Copiloto me avisa si me olvidé de cargar el documento de un cliente importante?** No de forma proactiva; es una buena práctica cargar el documento cuando lo tengas, sobre todo si es un cliente al que le facturás seguido, porque así vas a poder ver su historial completo en la ficha.

**¿La cartera de Clientes se comparte con otras funciones, como Presupuestos?** El nombre que escribís al hacer un presupuesto es un campo de texto libre, independiente de tu lista de Clientes —no hay un selector que los conecte directamente hoy.
