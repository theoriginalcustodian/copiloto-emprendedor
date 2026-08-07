# Facturación electrónica AFIP

## Qué es y para qué sirve

Facturación es la función del Copiloto que te deja emitir comprobantes fiscales electrónicos —factura, nota de crédito— directamente autorizados por AFIP, sin salir de la app. Cargás los datos de la venta, revisás un resumen y confirmás: el Copiloto arma el comprobante, lo manda a AFIP, obtiene el CAE (el número que certifica que tu factura es válida) y te entrega el PDF listo para guardar o compartir con tu cliente.

Hoy la función está pensada sobre todo para monotributistas y para quienes facturan sin discriminar IVA: es el circuito más común entre emprendedores y el que está más pulido. La Factura A o B con IVA discriminado, para cuando tu condición frente al IVA es Responsable Inscripto, todavía no está disponible: por ahora el Copiloto solo emite Factura C.

## Antes de facturar: cargar tus datos fiscales

La primera vez que entrás a Facturación, si todavía no vinculaste tu CUIT, vas a ver un aviso para **Configurar facturación**. Ese paso te lleva a Ajustes → Facturación AFIP, donde cargás:

- Tu CUIT
- Razón social
- Domicilio comercial
- Tu condición frente al IVA (monotributo, responsable inscripto o exento)
- Ingresos brutos
- Fecha de inicio de actividades
- El punto de venta que vas a usar para facturar

Todos estos datos son obligatorios una sola vez: no se te vuelven a pedir en cada factura. Sin ellos, el botón de facturar no te deja avanzar.

## El flujo paso a paso

Facturar es una sola pantalla que te va guiando en cuatro pasos. No hace falta completar todo de una sentada: podés ir y volver mientras no confirmes.

### Paso 1 — Datos de la venta

Elegís la fecha (tiene que estar dentro de los diez días antes o después de hoy, porque es el margen que permite AFIP), qué vendiste —productos, servicios, o ambos— y la condición de venta (por ejemplo "contado"). Si marcaste que vendiste un servicio, te va a pedir además el período que cubrió ese servicio (desde/hasta) y la fecha de vencimiento de pago: son datos que AFIP exige específicamente para servicios.

### Paso 2 — Ítems

Cargás lo que vendiste: descripción, cantidad y precio unitario, uno por línea. Podés agregar tantos ítems como necesites y borrar los que te hayas equivocado de cargar. El subtotal y el total los calcula siempre el Copiloto — vos no tenés que sumar nada a mano, y así te asegurás de que coincida con lo que después manda a AFIP.

### Paso 3 — Datos del cliente

Acá elegís la condición frente al IVA de tu cliente y su documento. Este paso tiene una regla importante que te conviene conocer: **si tu cliente es consumidor final, no necesitás cargar ni su nombre, ni domicilio, ni documento** — podés dejarlo así y facturar igual. Solo te va a pedir identificarlo con CUIT, CUIL o DNI si el total de la venta supera un monto muy alto (varios millones de pesos), porque ahí sí lo exige la normativa vigente. Si tu cliente tiene CUIT y es Responsable Inscripto o Monotributista, ahí sí conviene cargar el documento para que la factura quede a su nombre.

### Paso 4 — Resumen y confirmación

Ves todo lo que cargaste de un vistazo: venta, ítems, cliente y el total. Desde acá podés:

- **Confirmar y emitir** (en el ambiente de pruebas) o **Emitir factura real** (si ya estás facturando en serio) — manda el comprobante a AFIP.
- **Editar y confirmar** — si necesitás corregir algo antes de mandarlo.
- **Cancelar** — si te arrepentiste.

Es importante que prestes atención a si el botón dice "Emitir factura real": eso significa que estás en el ambiente de producción y la factura que vas a generar es fiscalmente real — anularla después requiere emitir una nota de crédito, no es un botón de deshacer.

## Qué pasa después de emitir

Cuando confirmás, el Copiloto reserva el número de comprobante y se lo manda a AFIP. Si AFIP lo autoriza, te devuelve el **CAE**, que es el código que certifica que la factura es válida, y el Copiloto genera el PDF con el diseño del tipo de comprobante correspondiente (la Factura C incluye el código QR de AFIP).

Ese PDF queda disponible para descargar por 24 horas desde el link directo. Pero no te tenés que preocupar por eso: el Copiloto guarda automáticamente una copia permanente en tu Google Drive (si lo tenés conectado), así que la factura sigue estando disponible después de que ese link venza.

Si por algún motivo el PDF no se pudo generar en el momento, no te preocupes: la factura ya quedó emitida y con CAE válido — el PDF se puede volver a generar más tarde, la parte fiscal ya está resuelta.

### Guardar y compartir el comprobante

Desde el detalle de cada comprobante emitido tenés dos botones:

- **Guardar** — abre el PDF (prioriza siempre el que está guardado en tu Drive, para que no dependas del link de 24 horas).
- **Compartir** — abre el menú para compartir de tu celular, así podés mandarlo por la app que uses habitualmente con tus clientes (WhatsApp, mail, etc.), la que tengas instalada.

## Qué tipo de comprobante te va a armar el Copiloto

No elegís vos directamente la letra del comprobante: el Copiloto la calcula según tu condición frente al IVA y la de tu cliente. Si sos monotributista o exento, te arma una **Factura C** — es la única letra que corresponde a esas condiciones fiscales, y es la que hoy está disponible de punta a punta. Si sos Responsable Inscripto y tu operación requeriría Factura A o B con IVA discriminado, esa opción todavía no está disponible (ver más arriba).

Lo mismo aplica a la nota de crédito: cuando anulás una factura, la nota sigue la misma letra que la factura original, y hoy también está resuelta solo para Factura C.

## Los datos que pide cada ítem

Cada línea que cargás en el paso de ítems necesita tres cosas para poder guardarse: una descripción (no puede quedar vacía), una cantidad mayor a cero, y un precio unitario mayor a cero. Si dejás alguno de esos tres campos incompleto o en cero, el Copiloto no te va a dejar avanzar hasta que lo corrijas — es una validación pensada para que no termines mandando a AFIP una factura con un ítem a $0 por error de tipeo.

## Cómo anular una factura

Una factura ya autorizada por AFIP no se puede borrar —fiscalmente no existe el "deshacer"—. Si te equivocaste o el cliente te devolvió la compra, tenés que emitir una **nota de crédito** desde el mismo comprobante. El sistema no te va a dejar anular:

- Un comprobante que ya fue anulado antes.
- Un comprobante sin CAE (porque nunca llegó a autorizarse, así que no hay nada que anular).
- Una nota de crédito con otra nota de crédito.

## Ambiente de pruebas y ambiente real

El Copiloto puede trabajar en dos ambientes distintos: uno de pruebas (homologación), donde podés practicar el flujo completo de facturación sin que nada tenga validez fiscal real, y el ambiente de producción, donde cada factura que emitís es un comprobante fiscal real a tu nombre. Vas a reconocer en qué ambiente estás por el texto del botón de confirmación en el resumen: "Confirmar y emitir" en pruebas, "Emitir factura real" en producción. Si no tenés ninguno de los dos ambientes vinculado todavía, el Copiloto te lo va a decir explícitamente en vez de asumir cuál usar — es una decisión que no te conviene dejar en manos de un supuesto.

## Facturar por voz o por chat

Podés pedirle al Copiloto que te arme una factura hablando o escribiendo, con frases como *"facturale 50 mil a Juan por el service"* o *"facturale a la panadería dos tortas a 8000 cada una"*.

Es importante que sepas cómo funciona esto: **el Copiloto nunca emite la factura directo por chat.** Lo que hace es armar un borrador con lo que entendió y mostrártelo en una tarjeta para que lo revises. Si dictaste todos los datos necesarios, la tarjeta te va a ofrecer emitirla ahí mismo; si te faltó algo, te va a preguntar antes de mostrarte cualquier tarjeta. Desde esa tarjeta podés **Emitir** directamente (si está completa) o **Completar a mano**, que te lleva al mismo formulario de facturación con lo ya dictado precargado, para que termines de revisarlo vos.

Si no dijiste el documento del cliente, el Copiloto asume que es venta a consumidor final —que, como vimos, no necesita documento salvo montos muy altos.

### Avisar un cobro por chat

También podés avisarle por chat cuando te pagan una factura ya emitida, con algo como *"me pagaron la factura de la panadería"* o *"cobré la 42"* — eso queda anotado como cobro (ver la sección de Ingresos para más detalle).

## Errores y confusiones frecuentes

### "No me deja facturar, dice que faltan datos fiscales"

Todavía no cargaste tu CUIT y el resto de los datos en Ajustes → Facturación AFIP. Es el primer paso obligatorio.

### "Me dice que la fecha está fuera de rango"

AFIP solo permite facturar con una fecha dentro de los diez días corridos antes o después de hoy. Si necesitás facturar algo más viejo, no vas a poder hacerlo con esa fecha exacta.

### "Cargué el CUIT de mi cliente pero me marca la condición de IVA como sospechosa"

Es un aviso preventivo: pusiste un CUIT válido pero dejaste la condición del cliente en "Consumidor Final", que normalmente no lleva CUIT. Revisá si el cliente es en realidad Responsable Inscripto o Monotributista.

### "Emití la factura pero no puedo descargar el PDF, dice que expiró"

El link directo de AFIP vence a las 24 horas. Buscá el comprobante en el detalle: ahí el botón "Guardar" te lleva a la copia que quedó archivada en tu Google Drive, que no vence.

### "¿Puedo hacer una Factura A o B con IVA discriminado?"

Todavía no. Hoy el Copiloto solo emite Factura C (sin discriminar IVA), pensada para monotributistas y exentos; si sos Responsable Inscripto y necesitás facturar con IVA discriminado, esa opción no está disponible por el momento.

"¿Qué letra de factura me corresponde?" — No la elegís vos: el Copiloto la calcula solo a partir de tu condición frente al IVA y la de tu cliente. Si sos monotributista o exento, siempre va a ser Factura C.

### "¿Por qué el botón dice 'Emitir factura real' y no 'Confirmar y emitir'?"

Estás en el ambiente de producción: la próxima factura que emitas es fiscalmente válida de verdad, no una prueba. Revisá bien el resumen antes de confirmar.

### "Facturé desde un presupuesto y no pasó nada"

Al tocar "Facturar" desde un presupuesto, el Copiloto arma el borrador con los datos de ese presupuesto y te lleva directo al resumen para que lo revises y confirmes vos — todavía no se emitió nada, es el mismo paso de revisión que si facturás manualmente.

### "Me rechazó la factura AFIP con un código de error"

Cuando AFIP rechaza un comprobante, el motivo que te muestra el Copiloto es el mismo texto que devuelve AFIP, tal cual. No siempre es fácil de entender a simple vista; si no lográs interpretarlo, pegale una consulta al Copiloto por chat con el código que te apareció.

### "Le pedí por chat que facture y no me confirmó que la mandó"

Es el comportamiento esperado: el Copiloto nunca te va a decir "listo, la emití" desde el chat, porque hasta que vos no confirmás desde la tarjeta o la pantalla de resumen, la factura no se mandó. Buscá la tarjeta de la propuesta para terminar el paso.

## Preguntas frecuentes

**¿Puedo facturar un servicio prestado hace más de diez días?** No con esa fecha exacta: AFIP solo acepta comprobantes con fecha dentro del margen de diez días corridos antes o después de hoy. Fuera de ese rango, la fecha del comprobante no va a coincidir con la fecha real del trabajo.

**¿Necesito el CUIT de mi cliente para facturarle?** Solo si tu cliente es Responsable Inscripto o Monotributista y querés identificarlo, o si el monto de la venta supera el tope que exige identificación obligatoria. Para una venta común a consumidor final, no.

**¿Qué pasa si me equivoco en un ítem después de confirmar?** Una vez que la factura tiene CAE, no se puede editar ni deshacer. La corrección se hace emitiendo una nota de crédito por el comprobante equivocado.

**¿El Copiloto guarda una copia de mis facturas aunque borre la app o cambie de celular?** Sí, mientras tengas Google Drive conectado: cada factura emitida se archiva ahí automáticamente, así que no depende de tu dispositivo.
