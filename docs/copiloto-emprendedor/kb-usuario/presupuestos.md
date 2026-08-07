# Presupuestos

## Qué es y para qué sirve

Un presupuesto es la cotización que le mandás a un cliente antes de que el trabajo se concrete: cuánto le vas a cobrar por tal servicio o tal producto, antes de facturarlo. A diferencia de la factura, el presupuesto **no es un documento fiscal** — no lo autoriza AFIP, es solamente tuyo y de tu cliente. Sirve para dejar por escrito una propuesta, hacerle seguimiento, y —si el cliente lo acepta— convertirlo directamente en factura sin tener que volver a cargar todo de cero.

Cada presupuesto que hacés queda clasificado en una de tres categorías, para que sepas de un vistazo en qué está cada uno:

- **Pendiente** — todavía no tuviste respuesta.
- **Aprobado** — el cliente te lo aprobó.
- **Desestimado** — no te lo tomaron.

## Diferencia entre un presupuesto y una factura

Es una confusión común al empezar a usar la app, así que conviene aclararla desde el principio. Una factura es un comprobante fiscal: una vez que la emitís, queda registrada ante AFIP con un CAE y no se puede deshacer, solo anular con una nota de crédito. Un presupuesto no tiene ninguna de esas dos características: podés crear tantas versiones corregidas como necesites, y mientras no lo factures, no genera ningún movimiento fiscal. Pensalo como el paso previo y opcional a la factura: podés facturar directamente sin pasar por un presupuesto, y podés hacer presupuestos que nunca termines facturando.

## Cómo se crea un presupuesto

Desde la pantalla de Presupuestos, tocás **Nuevo presupuesto** y completás:

- **Concepto**: una descripción de qué es el trabajo (por ejemplo, "Instalación eléctrica"). Es obligatorio.
- **Cliente**: el nombre de a quién se lo estás presupuestando. Es obligatorio.
- **Tipo y número de documento**: opcional. Podés dejarlo "Sin identificar" si todavía no tenés el CUIT o DNI del cliente.
- **Contacto**: mail o teléfono, opcional, por si querés tenerlo a mano.
- **Ítems**: al menos uno, cada uno con descripción, cantidad y precio unitario. Si en Ajustes ya tenés cargados conceptos que usás seguido, te van a aparecer como chips para agregarlos con un toque, sin tener que volver a escribirlos.

El total se calcula automáticamente a partir de los ítems que cargaste — es la suma de cantidad por precio unitario de cada línea, mostrada como "Total aproximado" mientras estás completando el formulario.

Al guardar, el presupuesto queda con estado **Pendiente**.

## Cómo corregir un presupuesto

Los presupuestos no se editan sobre el original: si necesitás corregir algo (un precio, un ítem, un dato del cliente), lo que hacés es crear una **versión nueva** del presupuesto. El anterior queda guardado en tu historial pero deja de aparecer en el listado activo — así siempre tenés a mano cuál es la versión vigente que le mandaste al cliente, sin ambigüedad.

## Qué es exactamente el documento de Google que se genera

El documento que se crea automáticamente en Google Docs no lo redacta ninguna inteligencia artificial de manera libre: se arma siempre a partir de los datos concretos que cargaste en el presupuesto —concepto, cliente, ítems y total—. Esto es a propósito, para que el documento nunca diga algo distinto de lo que realmente tenés guardado en la app: si corregís el presupuesto, el documento refleja exactamente esos datos, sin margen para que un texto generado quede desactualizado respecto a la fila real.

## Marcar el resultado

Desde el detalle del presupuesto tenés un botón para marcarlo como **"No me lo tomaron"**, que lo pasa a Desestimado. No hace falta que marques manualmente cuándo te lo aprueban: eso pasa automáticamente en el momento en que facturás ese presupuesto (ver más abajo).

Una vez que un presupuesto queda Desestimado, no se puede reactivar — si el cliente cambia de opinión más adelante, se hace un presupuesto nuevo.

## Convertir un presupuesto en factura

Cuando el cliente te aprueba el trabajo, desde el detalle del presupuesto tocás **Facturar**. Esto arma automáticamente un borrador de factura con el mismo cliente y los mismos ítems que cargaste en el presupuesto, y te lleva directo a la pantalla de Facturación con todo precargado para que lo revises.

Es importante que entiendas que **este botón no emite la factura por sí solo** — te lleva al mismo paso de revisión y confirmación que cuando facturás manualmente. Recién cuando confirmás ahí es que se emite de verdad ante AFIP. El presupuesto pasa a estar **Aprobado** automáticamente en cuanto generás ese borrador.

Si volvés a tocar "Facturar" sobre un presupuesto que ya tiene un borrador sin confirmar, el Copiloto no te crea uno nuevo: te lleva al mismo borrador donde lo dejaste, con el botón mostrando **"Continuar la factura"**.

Para poder facturar un presupuesto necesitás tener cargado tu CUIT en Ajustes → Facturación AFIP; si todavía no lo hiciste, te lo va a pedir antes de dejarte avanzar. Tampoco vas a poder facturar un presupuesto que ya marcaste como Desestimado, ni uno que ya facturaste antes.

## Cómo se calcula el total

El total del presupuesto sale siempre de sumar cada ítem (cantidad multiplicada por precio unitario). No es un número que vos escribís aparte: si cambiás la cantidad o el precio de un ítem, el total se recalcula solo. Esto es a propósito, para que el total que le mostrás a tu cliente coincida siempre con el detalle de ítems que tiene debajo, sin margen para que queden desincronizados.

## Qué información concreta guarda cada presupuesto

Además del concepto y el cliente, cada presupuesto queda con un número correlativo propio (independiente del de tus facturas), la fecha en que lo creaste, y su historial de versiones si lo corregiste alguna vez. Cuando facturás un presupuesto, ese vínculo también queda guardado: desde la ficha del cliente vas a poder ver tanto sus presupuestos como sus facturas relacionadas.

## Compartir el presupuesto con tu cliente

Si tenés Google Docs conectado desde Apps, cada presupuesto que crees genera automáticamente un documento de Google con toda la información, listo para compartir. Desde el detalle vas a ver dos opciones:

- **Ver en Google Docs**: abre el documento.
- **Compartir**: abre el menú para compartir de tu celular, para que se lo mandes por la app que uses con tu cliente (WhatsApp, mail, lo que tengas instalado).

Si todavía no conectaste Google Docs, el presupuesto se guarda y funciona exactamente igual — simplemente no vas a tener un documento para compartir hasta que conectes esa app desde Apps. No es un requisito para usar Presupuestos, es un plus.

## Hacer un presupuesto por voz o por chat

Podés pedirle al Copiloto que arme un presupuesto hablando o escribiendo, con frases como *"hacele un presupuesto a Juan por dos sillas a 8000 cada una"* o *"presupuestale a la panadería el service por 15000"*.

Igual que con las facturas, el Copiloto **no lo guarda directo**: te muestra una tarjeta con la propuesta armada a partir de lo que dijiste, para que la revises línea por línea antes de guardarla — esto es a propósito, porque el error más caro en un presupuesto suele estar justo en el monto de algún ítem, y conviene mirarlo con tus propios ojos antes de mandárselo a un cliente.

También podés avisarle al Copiloto por chat cuando te confirman o te rechazan un presupuesto, con algo como *"me aprobaron el de la panadería"* o *"ese no va, lo rechazaron"* — el asistente lo marca en el estado correspondiente, con las mismas reglas que si lo hicieras a mano desde la app.

## Presupuestar por partes: los conceptos guardados

Si notás que siempre presupuestás cosas parecidas —los mismos servicios, los mismos productos con el mismo precio—, conviene cargarlos una vez como conceptos en Ajustes. A partir de ahí, cada vez que hagas un presupuesto nuevo te van a aparecer como chips tocables dentro del formulario, y agregarlos como ítem es un solo toque en lugar de tipear descripción, cantidad y precio cada vez. Es un atajo pensado para el emprendedor que cotiza trabajos similares seguido, no un paso obligatorio del flujo.

## Errores y confusiones frecuentes

### "Quiero editar un presupuesto viejo y no encuentro cómo"

Los presupuestos no se editan: se corrigen creando una versión nueva. Buscá la opción de corregir desde el detalle; el original va a quedar en tu historial.

### "Toqué Facturar y no pasó nada visible"

Sí pasó algo: se armó el borrador de la factura y te llevó a la pantalla de revisión. Ahí tenés que confirmar para que se emita de verdad — nada se emite automáticamente al tocar "Facturar" desde el presupuesto.

### "Me dice que el presupuesto está desestimado y no puedo facturarlo"

Un presupuesto que marcaste como "no me lo tomaron" no se puede facturar directamente. Si el cliente cambió de opinión, hacé un presupuesto nuevo.

### "Me dice que falta el CUIT antes de facturar"

Necesitás cargar tus datos fiscales en Ajustes → Facturación AFIP antes de poder convertir cualquier presupuesto en factura.

### "No tengo botón para compartir el presupuesto"

Puede ser que todavía no conectaste Google Docs desde Apps. El presupuesto existe y funciona igual, pero el documento para compartir se genera solo cuando esa app está conectada.

### "Volví a tocar Facturar y sigue en el mismo borrador de antes"

Es esperado: si ya habías empezado a facturar ese presupuesto y no confirmaste, el Copiloto te lleva de nuevo a ese mismo borrador en lugar de duplicarlo.

### "Hice un presupuesto por chat y los montos de los ítems no me cierran"

Cuando el Copiloto arma un presupuesto por voz, siempre te lo muestra en una tarjeta editable antes de guardarlo, línea por línea, justamente porque el monto es lo que más fácil se transcribe mal al dictarlo. Revisalo ahí antes de confirmar.

### "El cliente me aprobó el presupuesto mucho después, ¿lo tengo que buscar en algún lado especial?"

No, sigue estando en tu lista de Presupuestos en estado "Pendiente" hasta que vos lo marques o lo factures; no hay un tiempo límite que lo cambie de estado solo.

## Preguntas frecuentes

### ¿Un presupuesto tiene algún valor fiscal?

No, ninguno. Es un documento comercial entre vos y tu cliente; el único paso que genera un comprobante ante AFIP es facturarlo.

### ¿Puedo hacer un presupuesto sin saber el documento del cliente?

Sí, el tipo de documento puede quedar como "Sin identificar" — no es un dato obligatorio para crear el presupuesto, solo para facturarlo si en algún momento se requiere identificar al cliente.

### ¿Qué pasa con los presupuestos que corregí, quedan guardados en algún lado?

Sí, las versiones anteriores no se borran: quedan en tu historial, aunque el listado activo solo te muestre la versión vigente para no confundirte con cuál es la última.

### ¿Puedo tener varios presupuestos pendientes para el mismo cliente al mismo tiempo?

Sí, no hay límite. Cada presupuesto es independiente, aunque compartan el mismo nombre de cliente.

### ¿El presupuesto reserva stock o compromete algo automáticamente?

No, es solo una cotización. No mueve ítems de ningún inventario ni genera ninguna obligación hasta que decidas facturarlo.

### ¿Puedo usar el catálogo de conceptos guardados en cualquier presupuesto?

Sí, los chips de conceptos frecuentes que cargaste en Ajustes están disponibles para agregar con un toque en cualquier presupuesto nuevo que hagas, para no tener que volver a tipear los mismos ítems de siempre.

### ¿Qué pasa si el cliente pide cambios después de que le mandé el presupuesto?

Corregí el presupuesto —lo que crea una versión nueva, como vimos— y volvé a compartir el documento actualizado. El cliente va a recibir el link con los datos corregidos.

## Cómo saber en qué estado está cada presupuesto de un vistazo

En el listado de Presupuestos, cada uno se muestra con su categoría bien visible —Pendiente, Aprobado o Desestimado— así podés hacer seguimiento sin tener que entrar al detalle de cada uno. Es útil, por ejemplo, para repasar rápido cuáles todavía están esperando respuesta del cliente y darles seguimiento.
