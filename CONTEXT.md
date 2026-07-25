# Copiloto del Emprendedor

Copiloto conversacional y de voz para emprendedores argentinos: le hablás como a un socio y te
contesta con tus números reales, factura ante ARCA, y te avisa lo que se te está pasando.

Este archivo es un **glosario y nada más** — el lenguaje con el que hablamos del negocio. No es una
spec ni un registro de decisiones de implementación: eso vive en `docs/` y en `memoria/`. El
vocabulario del **proceso de trabajo** (`contrato_`, buzón, F7.5, A1/A2) tampoco está acá: vive en
[`docs/BUCLE-CANONICO.md`](docs/BUCLE-CANONICO.md) y `coordinacion/COORDINACION.md`.

> Construido el 2026-07-24 barriendo el repo entero (backend · app · docs). Cada término se verificó
> contra el código, no contra la memoria. Los `_Avoid_` no son sinónimos prohibidos por estética: son
> colisiones reales que ya causaron ambigüedad, con la decisión de cuál gana.

---

## Language

### El ciclo del dinero

**Concepto**:
Una entrada del catálogo de lo que el negocio vende, con su precio. Es lo que permite preguntar
"¿cuánto cobraba antes por esto?".
_Avoid_: producto, ítem, servicio. Y ojo — **no** es el enum fiscal de tipo de venta (eso es
`tipo_venta`) ni el texto libre de un ingreso (eso es `detalle`).

**Presupuesto**:
Lo que el emprendedor ofreció: un documento con ítems y precios, dirigido a un cliente, antes de que
haya venta. Tiene estado propio (ver **Estado del presupuesto**).
_Avoid_: cotización, propuesta.

**Factura** (o **Comprobante**):
Lo que se vendió, ante ARCA: un documento fiscal con CAE, identificado por `cuit|tipo_cbte|punto_venta|nro`
— la clave que ARCA considera única, no un id nuestro.
_Avoid_: boleta, comprobante fiscal.

**Ingreso**:
Todo lo que entró: lo dictado o tipeado a mano, lo que vio MercadoPago, y las facturas cobradas.
Es el concepto **amplio**, y el que ve el emprendedor.
_Avoid_: **cobro** cuando se habla en general, **pago**, entrada, venta. (`cobro` y `ingreso` son hoy
la misma fila de `copiloto_cobros`; `pago` vive aparte en `mp_payments` y va a fusionarse.)

**Cobro**:
El caso **estrecho** de un ingreso: la declaración de que un comprobante puntual se pagó, total o
parcialmente. Todo cobro produce un ingreso; no todo ingreso viene de un cobro.
_Avoid_: usarlo como sinónimo de ingreso.

**Gasto**:
Lo que salió. Se imputa a cualquier eslabón de un trabajo que exista, y tiene categoría y proveedor.
_Avoid_: egreso, salida, compra.

**Proveedor**:
A quién le compra el emprendedor. Hoy es texto libre, no una entidad con ficha.

**Caja**:
Entró, salió, queda. Sin partida doble ni plan de cuentas. **Facturar no es cobrar**: una factura
emitida no entró a la caja hasta que la pagaron — por eso caja y facturado nunca se suman.

**Trabajo**:
No es una entidad: es la **cadena** presupuesto → factura → cobro. Puede tener los tres eslabones o
sólo alguno; el gasto se imputa a cualquiera de ellos y el margen agrupa por cadena.
_Avoid_: proyecto, obra, job.

**Margen**:
Lo que entró por un trabajo menos lo que se gastó en él. Siempre se muestra junto a cuántos gastos
tiene imputados, porque un margen al que le faltan gastos es falso y se ve excelente.
_Avoid_: rentabilidad, ganancia.

---

### Fiscal (ARCA)

**ARCA**:
El organismo fiscal argentino. El código usa el prefijo `afip_` por herencia histórica, pero el texto
que lee el emprendedor dice ARCA. Son el mismo organismo, no dos sistemas.

**CAE**:
El código de autorización que ARCA devuelve al emitir. Sin CAE no hay factura: hay borrador.

**Punto de venta**:
El número de bocacaja habilitado ante ARCA con el que se emite. Parte de la identidad del comprobante.

**Anular**:
Neutralizar un comprobante **ya emitido**, emitiendo una nota de crédito. Es irreversible y deja
rastro fiscal.
_Avoid_: cancelar (ver abajo).

**Cancelar**:
Abortar un **borrador** antes de emitirlo. No hay acto fiscal: no pasó nada ante ARCA.
_Avoid_: anular.

**Tipo de venta**:
El enum fiscal de qué se vendió — productos, servicios, o ambos — que viaja en el payload a ARCA.
_Avoid_: **concepto** (nombre que usa la API de ARCA, pero acá `Concepto` es el catálogo).

**Perfil fiscal**:
Los datos del emprendedor ante ARCA: CUIT, condición de IVA, punto de venta.
_Avoid_: "el perfil" a secas — existe también el perfil del negocio, que es otra cosa.

**Perfil del negocio**:
Cuatro campos que describen el negocio para que el copiloto sepa de qué habla: qué vende, a quién,
nombre comercial, horario. Se inyecta en el prompt de cada turno.
_Avoid_: "el perfil" a secas.

---

### Clientes

**Cliente**:
A quien el emprendedor le vende. Su cartera se **deriva** de lo que emitió, no se carga aparte.
_Avoid_: comprador, receptor, cuenta. Y **nunca** para nombrar al emprendedor dueño de la cuenta —
ése es el **tenant**.

**Tenant**:
El emprendedor dueño de una cuenta del copiloto, y la frontera de aislamiento de todos sus datos.
_Avoid_: **cliente**. (Deuda gestionada: hoy el campo se llama `cliente_id` en ambos sentidos y hay
que leer el contexto; el fix declarado es renombrar el del tenant a `tenant_id`.)

**Cartera**:
El conjunto de clientes del emprendedor.

---

### La conversación y las cards

**Card**:
La propuesta que el copiloto muestra cuando entendió una orden dictada: el **formulario real**
precargado con lo que entendió, para revisar y corregir antes de guardar. Nunca un sí/no ciego,
porque un error de transcripción sólo se corrige editando.
_Avoid_: **tarjeta** al hablar del concepto (los componentes sí se llaman `Tarjeta*`), modal, popup.

**Card en pantalla ≠ dato guardado**:
Regla dura del producto: mientras la card está visible, nada se persistió — y el copiloto no dice
"listo" ni "lo anoté".

**Gate**:
El par confirmar/cancelar que precede a una acción de negocio. Lo reversible puede no tenerlo; **lo
irreversible (factura, mail, cobro) siempre lo tiene**.
_Avoid_: confirmación, diálogo. (Ojo: "gate" también nombra los controles binarios del proceso de
trabajo — ahí es otro sentido, documentado aparte.)

**Tarjeta de trabajo**:
Un ítem del tablero de Mi Día: algo que el emprendedor tiene que atender, ya redactado por el
backend. Distinta de la **card**: aquélla propone guardar un dato, ésta señala algo pendiente.

**Modo de ceremonia**:
Cuánta confirmación pide el copiloto antes de guardar: `confirmación` (muestra la card y espera) o
`automático` (guarda y avisa). El automático se gana, no se elige de una lista, y **lo irreversible
se confirma siempre**, en los dos modos.
_Avoid_: "el modo" a secas.

**Modo del copiloto**:
Con qué cabeza responde: `copiloto` (general, puede escribir) o `negocio` (razona sobre el registro
del cliente activo y **sólo lee**).
_Avoid_: "el modo" a secas.

**Actividad**:
El feed de operaciones **de negocio** reales — facturas, notas de crédito, presupuestos, gastos,
ingresos, clientes— unidas de sus tablas. El chat **no** es actividad.
_Avoid_: usarlo para la memoria conversacional. Eso es el **recuerdo**, otro sistema entero
(Graphity), y hoy comparten la palabra sin ninguna relación.

**Recuerdo**:
Lo que el copiloto retiene de las conversaciones y puede evocar ("¿qué hice ayer?"). Vive en
Graphity, no en las tablas de negocio.
_Avoid_: actividad, historial.

---

### La cáscara (app móvil)

**Escritorio**:
La capa de fondo: el grid de las funciones del copiloto. Se revela deslizando la conversación hacia
abajo.
_Avoid_: home, dashboard, menú.

**Función**:
Cada uno de los módulos de negocio del escritorio (Facturación, Ingresos, Gastos, Presupuestos,
Clientes, Mi Día, Inteligencia, Contabilidad, Ajustes). Su orden es por frecuencia de uso esperada.
_Avoid_: sección, módulo, app. Y no confundir con "function" de código.

**Apps**:
Las integraciones externas conectables (Gmail, Drive, Sheets, HubSpot, Instagram, MercadoPago).
Distinto de las **funciones**, que son los módulos propios.
_Avoid_: conexiones, servicios, integraciones. (La web llama "Conexiones" a esta misma pantalla —
divergencia conocida.)

**Glass**:
La superficie de vidrio semitransparente sobre la que vive toda la interfaz: opacidad + tinte + luz,
no blur real. Tiene cinco niveles según el contexto.
_Avoid_: modal, overlay, blur.

**Skin**:
Cada uno de los cinco temas visuales completos (cian, violeta, ámbar, medicalWhite, black). No es un
color de acento: es la paleta entera del vidrio.
_Avoid_: tema, color.

**Mi Día**:
El tablero donde el copiloto **habla primero**: cada mañana arma tarjetas de trabajo según reglas
fijas y verificables, no un LLM decidiendo. La mayoría se cierra sola.
_Avoid_: agenda, to-do, Kanban.

**Inteligencia de Negocio**:
La función que **explica** el negocio con métricas y gráficos, y responde preguntas sobre él. Los
montos salen siempre de una consulta a la base, nunca de un LLM calculando de memoria.
_Avoid_: métricas, analytics, reportes.

**Contabilidad**:
Caja y facturación mostradas como dos preguntas separadas, nunca sumadas.

---

### Estados

`Estado` a secas es ambiguo: conviven cuatro máquinas independientes, sin valores compartidos.
Nombralas siempre completas.

**Estado del presupuesto** — `pendiente` · `aprobado` · `desestimado`:
Ganado, perdido, o **no sé**. El "no sé" explícito es la decisión de producto: si los no-marcados
contaran como rechazos, la tasa de conversión diría que se pierde el 80% cuando en realidad no se
sabe. No se puede volver a `pendiente` — borra información que alguien declaró.

**Estado de la factura**:
Dónde está el trámite de emisión ante ARCA, desde `borrador` hasta `emitida` o `rechazada`.

**Estado del comprobante** — `emitida` · `anulada` · `nota_credito`:
Qué pasó con un documento fiscal después de existir.

**Estado de cobro** — `impaga` · `parcial` · `cobrada`:
Cuánto se pagó de un comprobante. Es **derivado**, no se guarda.

---

### Origen

**Origen**:
De dónde salió un registro: `voz`, `manual`, `foto`, `derivado`, `mercadopago`, `factura`. En los
ingresos carga además un matiz de confianza — "lo vio el sistema" pesa distinto que "lo tipeó alguien".
