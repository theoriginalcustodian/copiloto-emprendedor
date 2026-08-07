# Hablar con el Copiloto: el chat que ejecuta acciones reales

## Qué es el chat del Copiloto

El chat es el corazón de la app: le escribís (o le hablás) al Copiloto en lenguaje natural y él
entiende qué querés y lo hace. No es un asistente que sólo responde preguntas — cuando le decís
"cargá un gasto de 5000 pesos en nafta", el Copiloto arma el gasto de verdad, con los datos que le
diste, y te lo deja listo para confirmar. Es la diferencia entre un chatbot que te explica cómo cargar
algo y un copiloto que lo carga por vos.

Podés escribirle texto o mandarle un audio (ver [Dictado por voz](dictado-por-voz.md)); el Copiloto
procesa las dos formas exactamente igual, así que da lo mismo si le tipeás "facturame a Juan Pérez
$10.000 por servicios de consultoría" o si se lo decís hablando.

## Qué puede hacer realmente el Copiloto por chat

Esta es la lista completa de lo que el Copiloto puede ejecutar cuando se lo pedís por chat o por voz:

- **Cargar un gasto** con monto, fecha, categoría, proveedor y medio de pago.
- **Cargar un ingreso** que no viene de una factura puntual (por ejemplo, una transferencia que
  recibiste).
- **Completar datos** de un ingreso que acabás de cargar en la misma charla, si te faltó algo.
- **Dar de alta un cliente nuevo**, con sus datos de contacto y fiscales.
- **Armar un presupuesto** con el cliente, los ítems y los montos que le dictes.
- **Marcar un presupuesto** como aprobado o rechazado, según lo que le cuentes.
- **Armar el borrador de una factura** electrónica (AFIP) con los datos del cliente y los conceptos
  que le dictes.
- **Marcar una factura como cobrada**, para que deje de figurar como pendiente de cobro.
- **Agendar un evento** en tu Google Calendar (si tenés esa app conectada).
- **Generar un link de cobro** de Mercado Pago para mandarle a un cliente.
- **Mandar un correo** por Gmail (si tenés esa app conectada).
- **Agregar una fila** a una planilla de Google Sheets (si la tenés conectada).
- **Crear o leer un documento** de Google Docs (si lo tenés conectado).
- **Manejar tarjetas de "Mi día"**: crear una tarjeta de recordatorio, moverla de columna o borrarla.

Para consultar cuánto te compró un cliente o repasar tu actividad pasada (qué facturaste, qué
gastaste, qué pasó en un rango de fechas), esas respuestas hoy viven en pantallas propias —
[Clientes](clientes.md) y [Actividad reciente](actividad.md)— en vez de resolverse por chat.

Todo lo demás —ver tus números, navegar por las distintas secciones, tocar un botón puntual— lo hacés
directamente en la app, no hace falta pasarlo por el chat.

## Cómo se llega al chat

El chat está siempre a mano: es la pantalla que ves apenas abrís la app. Si estás en el Escritorio (la
pantalla con los accesos a Facturación, Gastos, Clientes, etc.), deslizá hacia arriba para volver al
chat. Podés escribirle en cualquier momento, sin importar en qué otra pantalla estés.

## Cómo pedirle algo: ejemplos que funcionan

El Copiloto entiende lenguaje natural, no comandos con una sintaxis fija. Estos son ejemplos reales de
frases que funcionan:

- "Cargá un gasto de 3200 pesos en insumos, lo pagué con la tarjeta"
- "Che, me pagaron 15 mil pesos de una seña, anotalo"
- "Dame de alta un cliente nuevo, se llama María Gómez, su mail es el de siempre"
- "Armame un presupuesto para Kiosco Norte: 10 unidades de producto A a 500 pesos cada una"
- "Facturale a Estudio Contable SRL 25.000 pesos por servicios de asesoría"
- "La factura 0001-00000123 ya me la pagaron"
- "El presupuesto que le mandé a Carla lo aprobó"
- "Mandame un link de cobro por 8000 pesos para Rodríguez"
- "Agendame una reunión con el proveedor el jueves a las 15"

No hace falta que le des todos los datos de una: si te falta algo importante, el Copiloto te lo va a
preguntar o te va a dejar una tarjeta editable para completarlo (ver la próxima sección).

## Las tarjetas: así confirmás lo que el Copiloto armó

Cuando le pedís algo que implica cargar o cambiar información de tu negocio (un gasto, un cliente, un
ingreso, un presupuesto o una factura), el Copiloto **nunca lo guarda solo**. Arma una propuesta con
los datos que entendió y te la muestra como una tarjeta debajo del mensaje, para que la revises,
corrijas si hace falta, y confirmes tocando "Guardar". Esto es así a propósito: si dictás un monto mal
o el Copiloto entiende algo distinto a lo que quisiste decir, tenés la oportunidad de corregirlo antes
de que quede cargado.

Si te faltó un dato realmente imprescindible —por ejemplo, el monto de un gasto, o el nombre de un
cliente nuevo— el Copiloto te lo va a preguntar antes de mostrarte la tarjeta. El resto de los campos
(categoría, fecha, forma de pago, dirección, etc.) los completa con lo que entendió o los deja en
blanco, listos para que vos los edites directamente en la tarjeta — no hace falta que se lo repitas
por chat.

Para acciones que usan aplicaciones externas conectadas —mandar un correo, agendar un evento, generar
un link de cobro, agregar una fila a una planilla— la confirmación es distinta: el Copiloto te muestra
qué va a hacer y vos tocás **Confirmar** o **Cancelar**. Ahí sí, al confirmar, la acción se ejecuta tal
cual quedó planteada.

## Cuando el Copiloto necesita más de un paso

Para pedidos que requieren juntar varios datos (por ejemplo, armar un presupuesto con varios ítems),
el Copiloto puede encadenar varias acciones en la misma respuesta, sin que tengas que ir guiándolo
paso a paso. Si el pedido es muy largo o confuso y el Copiloto no logra resolverlo, te va a avisar que
mejor lo dividan en partes más chicas — es preferible a que se trabe o entienda cualquier cosa.

## Qué NO hace el Copiloto por chat

- **No emite una factura solo con la voz.** El chat arma el borrador con los datos que le diste, pero
  la emisión final (el paso que genera el comprobante fiscal ante AFIP) la confirmás vos desde la
  tarjeta, con un toque explícito — es un paso que no se puede deshacer, así que nunca lo dispara solo.
- **No elige por vos cuando hay dudas.** Si le pedís marcar como cobrada "la factura de Juan" y tenés
  más de una que podría ser, te va a mostrar las opciones para que elijas — no adivina.
- **No borra nada de forma automática.** Si le pedís borrar una tarjeta de "Mi día" y hay más de una
  que podría ser la que te referís, te pregunta cuál.
- **No lee tu correo de Gmail** aunque lo tengas conectado — sólo puede mandar correos, no leerlos.
- **No usa Google Drive, HubSpot ni Instagram desde el chat**, incluso si los ves listados en otras
  partes de la app.
- **No responde por chat cuánto te compró un cliente ni te resume tu actividad pasada** — esas
  consultas hoy se resuelven entrando directo a [Clientes](clientes.md) o a
  [Actividad reciente](actividad.md), no pidiéndoselas al Copiloto.

## Errores y confusiones frecuentes

**"Le pedí que cargue un gasto y no pasó nada, sólo me mostró una tarjeta"**
Es el comportamiento esperado: el Copiloto arma la propuesta pero no la guarda hasta que vos tocás
"Guardar" en la tarjeta. Si cerrás la tarjeta sin confirmar, el gasto no queda cargado.

**"Le dije que facture y no se generó ninguna factura"**
El Copiloto arma el borrador de la factura, pero la emisión final necesita tu confirmación explícita
desde la tarjeta. Buscá la tarjeta de la factura y tocá para emitirla.

**"Le pregunté por un cliente y me tira una lista en vez de responder directo"**
Pasa cuando hay más de un cliente que coincide con lo que dijiste (por ejemplo, dos con el mismo
nombre). Elegí el correcto de la lista y el Copiloto sigue desde ahí.

**"El Copiloto tardó bastante en responder"**
El mensaje se manda y la respuesta llega en cuanto está lista — la app va consultando en segundo
plano, así que si tu pedido implica varios pasos (por ejemplo, buscar un cliente y después armar un
presupuesto con sus datos), puede tardar unos segundos más que un mensaje simple.

**"Le pedí mandar un correo y no encuentra Gmail"**
Revisá que tengas Gmail conectado desde [Apps conectadas](apps-conectadas.md); si no está conectado,
el Copiloto no va a poder ofrecerte esa acción.

**"Quiero que borre una tarjeta de Mi día pero no sé bien cuál"**
Contale con más detalle cuál es (el texto de la tarjeta, en qué columna está) — si sigue siendo
ambiguo, te va a mostrar las candidatas para que elijas vos, nunca borra a ciegas.

## Preguntas frecuentes

**¿Tengo que usar frases exactas para que el Copiloto entienda?**
No, entiende lenguaje natural. Podés escribirle como le hablarías a alguien de tu negocio.

**¿Puedo corregir un dato después de que el Copiloto arma la tarjeta?**
Sí, todos los campos de la tarjeta son editables antes de confirmar.

**¿El Copiloto puede hacer varias cosas en el mismo mensaje?**
Sí, si el pedido lo permite (por ejemplo, armar un presupuesto con varios ítems de una), pero si el
pedido es muy largo puede pedirte dividirlo.

**¿Qué pasa si me equivoco y confirmo una tarjeta con un dato mal?**
Podés corregirlo después desde la función correspondiente (Gastos, Clientes, Presupuestos, etc.), tal
como corregirías cualquier dato cargado a mano.

**¿El chat sirve para preguntas generales sobre mi negocio, o sólo para cargar cosas?**
Hoy es principalmente para ejecutar acciones (cargar, armar, marcar). Para preguntas como "cuánto
facturé este mes" o "cuánto me compró tal cliente", esas respuestas viven en pantallas propias —
[Actividad reciente](actividad.md) y [Clientes](clientes.md)— no se le piden al Copiloto por chat.

**¿Hay un límite de mensajes según mi plan?**
No. El chat no tiene un tope de mensajes ni de acciones por plan contratado. Sí existe una protección
técnica general contra un uso anormalmente intenso en muy poco tiempo, pensada para prevenir abuso y
no para limitar el uso normal de un emprendedor; si alguna vez la alcanzás, la app te pide esperar un
momento antes de seguir.
