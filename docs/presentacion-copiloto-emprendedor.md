# Copiloto del Emprendedor

**Le hablás. Las cosas pasan.**

---

## 1. A quién le habla

Al que trabaja y además tiene que administrar. El electricista que sale de una instalación y tiene que
facturar antes de arrancar la siguiente. La que vende por Instagram y anota los gastos en un cuaderno
que después no encuentra. El que presupuesta desde el auto porque es el único momento del día en que
está quieto.

Gente que **no tiene un administrativo**, no va a aprender a usar un ERP, y cuyo sistema real hoy son
notas en el celular, capturas de pantalla y una carpeta de WhatsApp con fotos de tickets.

No le habla al que ya tiene un contador full-time y un sistema de gestión andando. Ese no tiene este
problema.

---

## 2. La idea, en una frase

**Le decís lo que necesitás, en voz alta, como se lo dirías a un empleado.** Y queda hecho: la factura
emitida con validez fiscal, el gasto anotado, el cliente cargado, el presupuesto escrito.

Sin formularios que llenar. Sin aprender a usar nada. Sin abrir la computadora.

---

## 3. Un día

**7:40, tomando el café.** Abre la app. Antes de que pregunte nada, ya hay una lista esperándolo:

> *Tres presupuestos que mandaste hace más de un mes y nadie contestó — $340.000 en juego.*
> *La panadería te debe dos facturas de marzo.*
> *Gastaste 40% más en combustible que el mes pasado.*

No son notificaciones sueltas: son **tarjetas de trabajo**. Las que va resolviendo desaparecen solas.
La de la panadería se va a borrar sin que la toque, en el momento en que cobre esa factura.

**10:15, en la ferretería.** Paga materiales. Saca el celular, aprieta el micrófono:

> — *«Pagué 12 mil de herramientas en la ferretería, con tarjeta»*

El copiloto le muestra una tarjeta con lo que entendió —monto, categoría, proveedor, medio de pago,
fecha—. **Y ahí mismo puede corregir cualquier campo antes de guardar**: si escuchó *«doce»* donde él
dijo *«dos»*, lo toca y lo arregla en el momento. Ése es el sentido de la tarjeta — no es un cartel de
*«¿confirmás?»*, es el lugar donde el error se caza. Confirma. Anotado.

**11:00, camino al próximo trabajo.** Se acuerda de algo que pagó el fin de semana:

> — *«Cargá 8 mil de nafta, fue el sábado»*

La tarjeta sale con la fecha del sábado, no la de hoy. **Lo que se anota es cuándo pasó, no cuándo se
acordó** — si no fuera así, todos los números del mes estarían corridos. Y si el copiloto no logra
ubicar una fecha dicha de una forma rara, la pone en hoy, lo dice, y le deja el campo para tocarlo.

**13:30, terminando un trabajo.** El cliente le pide la factura:

> — *«Facturale 85 mil a Panadería Los Tilos»*

Cuarenta segundos después tiene el PDF, con **CAE real de ARCA**. Lo comparte por WhatsApp desde el
mismo teléfono, sin pasar por la computadora.

**15:00, saliendo del trabajo.** El cliente le paga en efectivo:

> — *«Me pagaron 85 mil en efectivo, de la panadería»*

> — *«Anotado. No me dijiste si es del trabajo del tablero, ¿lo imputo ahí?»*

Un toque. Ese cobro entró a la caja **y** quedó pegado al trabajo, así que ahora ese trabajo sabe
cuánto dejó.

**17:00, esperando en el auto.** Le pidieron un presupuesto:

> — *«Armá un presupuesto para Distribuidora Sur: instalación de tablero, 180 mil»*

Sale un documento con el logo y los datos de su negocio, listo para mandar.

**21:00, en el sillón.** Se le cruza una duda:

> — *«¿Cuánto me compró la panadería este año?»*
> — *«¿Cuánto cobraba antes por instalar un tablero?»*
> — *«¿En qué se me está yendo la plata?»*

Contesta con números que salen de sus operaciones reales. No de un promedio ni de una estimación: de
las facturas que emitió.

**Ninguno de esos momentos tuvo un formulario.** Y ninguno requirió más de un minuto.

---

## 4. Las funciones

### 🧾 Facturación

Emite **facturas electrónicas con validez fiscal** contra ARCA (ex AFIP), desde el teléfono.

- Se dicta o se completa a mano: *«facturale 85 mil a la panadería»*.
- Devuelve el **CAE real** y su vencimiento — el comprobante es válido, no un borrador.
- **PDF listo para compartir** por WhatsApp, mail o lo que use.
- **Anular es emitir una nota de crédito**, como corresponde: el comprobante original no se borra
  nunca, se compensa.
- Guarda todo: qué facturaste, a quién, cuándo, por cuánto.

**Hoy cubre monotributo — Factura C.** Es el caso de la enorme mayoría de los emprendedores a los que
apunta. Factura A y B (con IVA discriminado) no están implementadas.

**La facturación no depende del criterio de un modelo de lenguaje.** El número, el punto de venta, la
fecha y el cálculo los arma código determinista con las reglas de ARCA escritas y probadas. La voz
sirve para *pedirlo*; lo que se manda a ARCA no lo improvisa nadie.

### 📄 Presupuestos

- Se dictan igual que una factura.
- Salen como **documento de Google** con el formato del negocio, listo para mandar.
- Numerados, y con historial: un presupuesto corregido **reemplaza** al anterior sin borrarlo.
- **Se marcan aprobados o desestimados** — y desde uno aprobado se factura o se manda un link de
  cobro, sin volver a cargar nada.

### 💰 Ingresos

Todo lo que entra, no sólo lo que se factura.

- Se dicta: *«me pagaron 85 mil en efectivo de la panadería»*.
- **Lo único obligatorio es el monto.** El resto es opcional — si falta algo, el copiloto te lo dice y
  lo completás ahí mismo, pero **ya quedó anotado**.
- Los cobros de MercadoPago y las facturas cobradas aparecen acá también, **distinguibles**: se ve
  cuál registró el sistema y cuál cargaste vos.
- Si un ingreso se parece mucho a uno ya registrado, **pregunta antes de guardar** — cobrar dos veces
  el mismo trabajo en los números es un error que después nadie encuentra.

**Por qué importa:** el efectivo y las transferencias no dejan rastro en ningún sistema. Si no entran
acá, la caja da un número prolijo y equivocado.

### 💸 Gastos

- Se dictan en la calle: *«pagué 12 mil de herramientas»*.
- **Ocho categorías**: mercadería, servicios, alquiler, sueldos, impuestos, transporte, herramientas y
  otros.
- Guarda proveedor, medio de pago y la frase original —*tal como la dijiste*— para que después puedas
  contrastar si algo quedó raro.
- Se pueden cargar por **voz, a mano, o desde la foto del ticket**.
- **Se imputan a un trabajo**: *«pagué 12 mil de herramientas para el trabajo de la panadería»*. Y si
  no lo decís, el copiloto te ofrece el trabajo más probable — un toque.

### 👥 Clientes

- Se cargan **dictando** —*«anotá un cliente, Panadería Los Tilos, CUIT 30-71234567-8»*— o a mano.
- **Avisa si ya existe** antes de duplicar, y muestra cuál es el que ya tenías. Si son dos clientes
  distintos con el mismo nombre, lo entiende: no te obliga a inventar un nombre falso.
- Los datos que se repiten en cada factura y cada presupuesto dejan de re-tipearse.

### 🧮 Contabilidad

La caja del mes: **entró, salió, queda.** Sin partida doble, sin plan de cuentas, sin aprender
contabilidad.

Entra **todo** lo que entró —facturado, cobrado por MercadoPago, y el efectivo que dictaste— y sale
todo lo que salió.

Y una distinción que la mayoría de las apps se saltea: **facturar no es cobrar.** Una factura emitida
no entró a la caja hasta que el cliente pagó. Sumar las dos cosas es contar el mismo peso dos veces —
acá no pasa.

### 📐 Rentabilidad por trabajo

**Lo que entró por un trabajo, menos lo que gastaste en él.**

Un trabajo puede tener presupuesto, factura y cobro, o sólo alguno de los tres — el copiloto entiende
que son el mismo trabajo. Los gastos se le imputan dictando, y entonces cada trabajo sabe cuánto dejó.

> *«El tablero de la panadería: facturaste $85.000, gastaste $73.000. Te dejó $12.000.»*

Y la versión que cambia decisiones: **qué tipo de trabajo te deja más.** Es la única información del
sistema que puede hacerte subir un precio.

*(Y siempre se ve **cuántos gastos tiene imputados** ese trabajo. Un margen calculado con la mitad de
los gastos se ve excelente y es falso — así que el número nunca viene solo.)*

### 📊 Inteligencia de Negocio

Dos formas de mirar el negocio, con los mismos números:

**La portada** — cuatro cifras y el aviso del día. Lo que hay que saber en cinco segundos.

**Los gráficos** — facturación por mes, entró contra salió, en qué se va la plata. Se tocan y se
abren: cada barra muestra de qué está hecha. *(Un número que no se puede desarmar en sus filas es un
número que nadie tiene por qué creer.)*

**Y el chat**, para lo que no está en ningún gráfico:

> *«¿Qué le vendí a este cliente la última vez?»*
> *«¿Cuánto cobraba antes por esto?»*
> *«¿Quién me dejó de comprar?»*

Los montos salen siempre de las operaciones reales, con una consulta a la base — nunca de un modelo
de lenguaje calculando de memoria.

### ☀️ Mi día

Las sugerencias de la mañana convertidas en **tarjetas de trabajo**: se mueven, se descartan, se
completan.

Y la parte que hace que no se convierta en otra lista abandonada: **la mayoría de las tarjetas se
cierra sola.** *«Cobrá la factura 0001-00042»* desaparece cuando esa factura se marca cobrada. El
emprendedor mantiene su negocio y el tablero se mantiene solo.

### 🔗 Sus aplicaciones

El copiloto trabaja con las herramientas que ya usa:

| | |
|---|---|
| **Gmail** | manda mails por él |
| **Google Docs** | escribe los presupuestos |
| **Google Sheets** | vuelca datos a sus planillas |
| **Google Calendar** | agenda turnos y visitas |
| **MercadoPago** | genera links de cobro para mandar |

### ⚙️ Ajustes

Los datos del negocio, las credenciales de ARCA, las aplicaciones conectadas, el plan, y la
apariencia: la app viene con **varios temas visuales** para elegir.

Y algo que casi ninguna herramienta ofrece: **se le puede poner nombre al copiloto**, y decidir si te
habla formal o de vos, si responde corto o explica. Es tu empleado, no el de la app.

---

## 5. Lo que sabe de tu negocio

Cada operación —una factura, un gasto, un presupuesto, un cobro— **queda registrada como un hecho con
su fecha**. No como un renglón en una tabla, sino como algo que pasó en un momento y que se relaciona
con otras cosas que pasaron.

Eso permite responder preguntas que una planilla no puede:

> *«¿Cuánto cobraba antes por instalar un tablero?»* — porque el precio de cada cosa **tiene historia**:
> lo que vale hoy y lo que valía en marzo son dos hechos distintos, los dos ciertos, cada uno en su
> momento.

> *«¿Cuánto me dejó este trabajo?»* — porque el presupuesto, la factura, el cobro y los gastos que le
> imputaste están **enlazados entre sí**, no sueltos en cinco tablas.

Es la diferencia entre un sistema que sabe **cómo están las cosas** y uno que sabe **cómo llegaron a
estar así**.

---

## 6. De responder a avisar

Casi todo el software espera que le preguntes. Este **habla primero**.

Cada mañana revisa el negocio y arma la lista: presupuestos que se enfriaron, facturas que nadie pagó,
un gasto que se disparó, un cliente que hace meses no aparece, un vencimiento que se viene, **un
trabajo cuyo margen se está comiendo antes de terminarlo**.

**Las reglas son fijas y verificables** — no es un modelo decidiendo cada día qué le parece
interesante. Si un presupuesto lleva más de treinta días sin respuesta, aparece. Siempre. Con los
mismos datos, el mismo aviso.

El modelo de lenguaje sólo se encarga de **cómo decirlo**, con el tono que el emprendedor eligió. Si
ese modelo no está disponible, el aviso sale igual.

Y no satura: **un aviso por día**, priorizado por la plata que hay en juego, sin repetir lo que ya
dijo.

---

## 6.bis Cuánto te pregunta, lo elegís vos

Hay dos formas de que el copiloto trabaje, y el emprendedor elige cuál:

| | **Pedir confirmación** | **Automático** |
|---|---|---|
| Anotar un gasto, un cobro, un cliente | te muestra la tarjeta y vos confirmás | lo anota directo |
| Facturar, cobrar por MercadoPago, mandar un mail | te pregunta | **te pregunta igual** |

**Esa segunda fila no se puede apagar, y es a propósito.** Lo que sale del teléfono —una factura con
CAE, un mail a un cliente, un cobro— no tiene vuelta atrás: una factura no se borra, se anula, y queda
en ARCA. Anotar un gasto sí se deshace con un toque. Por eso el modo cambia la ceremonia de lo
reversible, nunca la de lo definitivo.

**Se empieza pidiendo confirmación**, y no por desconfianza: **la tarjeta es donde uno aprende a
dictar**. Cada vez que aparece mostrando lo que faltó, el emprendedor ve exactamente qué decir la
próxima vez — sin leer un manual.

**Y el modo automático no se elige de una lista: te lo ofrece el copiloto** cuando ya vio que venís
dictando completo:

> *«Tus últimos registros vienen entrando completos, así que puedo dejar de pedirte confirmación cada
> vez. ¿Querés probarlo? Podés volver atrás cuando quieras.»*

Tiene sentido: en automático no hay tarjeta que corrija nada, así que sólo conviene a quien ya no la
necesita. Volver es un toque.

### Una cosa por vez

Si el copiloto no llegó a entender algo, **pregunta una sola vez**. Si con eso todavía falta, muestra
la tarjeta para completarla a mano — y **espera a que se resuelva o se descarte antes de aceptar otra
cosa**.

Suena estricto y es lo contrario: **evita que queden cosas a medio anotar**, que es como se arruina un
número de fin de mes. Lo que quedó abierto se resuelve o se descarta, pero no se olvida. *(Consultar
Inteligencia de Negocio sigue disponible: eso no toca nada.)*

### Cómo te habla

Cuando algo no sale, **el copiloto se hace cargo — no te corrige a vos**:

| En vez de | Dice |
|---|---|
| *«Te faltó el medio de pago»* | *«¿Cómo te pagaron? Si querés lo agregamos.»* |
| *«No dijiste la fecha»* | *«Lo anoté con fecha de hoy — si fue otro día, tocá acá.»* |

Y **nunca te traba por un dato que falta**: si dijiste el monto, ya quedó anotado. Lo demás se pide,
no se exige. Un sistema que no deja anotar hasta tener todo completo es un sistema en el que se deja
de anotar.

---

## 7. Por qué no se pierde nada

Un emprendedor factura desde el celular, en la calle, con la señal que haya.

Todo lo que hace el copiloto corre sobre un motor de **ejecución durable**. En criollo: **si el
proceso se interrumpe, retoma exactamente donde estaba.** Se cortó internet en medio de una factura,
se reinició el servidor, ARCA tardó veinte segundos en contestar — la operación sigue viva y termina.

Esto no es un detalle de infraestructura: es la diferencia entre *«se colgó, fijate si salió o
tenés que hacerla de nuevo»* y que simplemente salga. Cuando lo que está a mitad de camino es un
comprobante fiscal, esa diferencia se nota.

Vale también para lo chico: **si estabas completando una tarjeta y se cerró la app, al volver está
ahí**, con lo que ya habías puesto. No hay que dictar de nuevo.

Y por diseño **nada se factura dos veces**: pedir la misma factura dos veces produce una factura, no
dos comprobantes con CAE que después hay que anular.

---

## 8. Lo que no hace

Vale más ser claro acá que prometer de más:

- **No es un ERP.** No hay stock, ni órdenes de compra, ni producción.
- **No lleva los libros contables.** Lleva la caja del negocio. El balance y las declaraciones siguen
  siendo del contador.
- **No reemplaza al contador.** Le da datos ordenados para que su trabajo sea más barato.
- **Hoy factura monotributo (Factura C).** Responsable inscripto con IVA discriminado no está.
- **No hace la declaración de IVA ni de ganancias.**
- **No maneja empleados ni sueldos** más allá de anotarlos como gasto.
- **No cobra por vos**: genera el link de MercadoPago, el cliente paga donde siempre.

Lo que sí hace, lo hace completo. Lo que no está en esta lista, no está.

---

## 9. Cómo empezás

**Cinco minutos, una sola vez:**

1. **Entrás con tu cuenta de Google.**
2. **Contás qué vendés** — en una frase. Eso es lo que el copiloto usa para entenderte después.
3. **Conectás ARCA** con tu clave fiscal, para poder facturar. *(La clave no queda guardada en ningún
   lado: se usa en el momento del trámite y se descarta.)*

Listo. Ya podés facturar.

Lo demás —clientes, gastos, presupuestos— **se va llenando solo a medida que trabajás**. No hay una
carga inicial de datos: el primer cliente se crea la primera vez que le facturás.

**¿Y cómo hay que hablarle?** Como le hablarías a alguien que te ayuda. Igual, dentro de la app hay
una pantalla con ejemplos reales —*«pagué 15 mil de mercadería»*, *«me pagaron 85 mil»*, *«facturale 80
mil a la panadería»*— por si querés verlos. **No es una lista de comandos que haya que memorizar:** si
te falta un dato, el copiloto te lo pide; si entendió mal, lo corregís en la tarjeta.

---

## 10. Qué viene

Lo que falta es chico y es de nuestro lado, no del producto:

- **Conexión propia con Google.** Hoy autorizar Gmail o Docs pasa por la pantalla de un proveedor
  intermedio. Funciona, pero para un producto que se vende no se sostiene: tiene que ser Google
  pidiendo el permiso, y nadie más en el medio.
- **Notificaciones al teléfono.** El aviso de la mañana ya existe y espera dentro de la app; falta que
  suene sin abrirla.
- **Factura A y B**, para cuando el emprendedor deje de ser monotributista. Que es, después de todo,
  el objetivo.

---

*Copiloto del Emprendedor · 2026*
