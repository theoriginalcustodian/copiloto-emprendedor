# Reporte: por dónde mejoraría Odobi

**Para:** Martin y David · **Fecha:** 25/07/2026
**Disparador:** análisis comparativo con Biyuya (biyuya.com) + revisión del estado actual del producto.

---

## 1. El diagnóstico en una frase

Odobi no tiene un problema de features. Tiene un problema de **relato interno**: el usuario usa funciones sueltas (facturar, cobrar, presupuestar) unidas por la voz, pero nunca ve el sistema que esas funciones forman. La sensación de "app suelta" no se arregla agregando cosas — se arregla **mostrando lo que ya existe y hoy es invisible**.

## 2. Qué logra Biyuya que nosotros no (y no es lo obvio)

Biyuya no es mejor app. Es más **entendible**. ¿Por qué?

Porque tiene **una sola cosa en el centro: el libro de movimientos**. Todo lo demás es una puerta para meterle datos (fotos de tickets, gastos recurrentes, cuentas) o para sacarle respuestas (reportes, el chat de IA). El usuario entiende el sistema en 10 segundos: "acá vive mi plata, todo entra ahí, todo se consulta ahí".

Odobi está armado al revés: el centro es la conversación (la acción), y los datos son un efecto secundario que el usuario **no ve nunca**. Facturás, cobrás, presupuestás… ¿y después? Nada se acumula ante tus ojos. Por eso se siente como comandos sueltos.

**La ironía:** Odobi ya tiene su "libro" por dentro. Cada factura, cobro, gasto y presupuesto queda registrado, y el producto ya sabe calcular cuánto entró, cuánto salió y qué margen dejó cada trabajo. También ya sabe detectar solo cosas para avisarte ("Mi Día": presupuestos que se enfrían, facturas impagas, márgenes en rojo). **El sistema existe. Lo que no existe es la pantalla que lo cuenta.**

## 3. El sistema de Odobi (el relato que falta contar)

Odobi ya es un ciclo completo, no una caja de herramientas:

> **Hablás → Odobi ejecuta (vos confirmás) → queda anotado solo → Odobi lo vigila por vos → le preguntás lo que quieras.**

Comparado con Biyuya, esto es estructuralmente superior para nuestro público:

- En Biyuya, **vos cargás y vos mirás**. La app es pasiva: te muestra el problema.
- En Odobi, **se carga solo** (porque las cosas las hacés a través de él) **y te avisa solo**. Y cuando te avisa, no te muestra un gráfico: te ofrece **arreglarlo** ("¿lo mando?", "¿la emito?").

Ese es el pitch real: *"En Odobi, la consecuencia de hablar es que tu negocio queda contabilizado y vigilado."* Hoy ese pitch es verdad a medias porque nada de eso se ve.

## 4. Por dónde empezaría (en orden)

### Paso 1 — Hacer visible el negocio: la "portada"
Una vista simple y permanente: **cuánto entró, cuánto salió, qué margen, qué hay para hoy**. No es un dashboard de gráficos — es el "estado de tu negocio" en 4 números + las tarjetas de Mi Día (lo que Odobi detectó que merece tu atención).

- **Por qué primero:** es lo que convierte "funciones sueltas" en "sistema", y el motor ya está construido. Falta solo la pantalla.
- **Costo:** bajo (es interfaz, no producto nuevo).

### Paso 2 — Cerrar el agujero de los gastos: foto de ticket → gasto
Hoy Odobi ve bien lo que **entra** (facturas, Mercado Pago) pero lo que **sale** hay que dictarlo a mano. Resultado: el margen que muestra es incompleto, y un número incompleto es peor que ninguno — destruye confianza.

La solución es la puerta de entrada más natural para un emprendedor: **sacale una foto al ticket** (o dictalo en 5 segundos) y Odobi lo registra y lo categoriza. Biyuya ya lo hace; para nosotros no es "copiar una feature", es la condición para que el Paso 1 diga la verdad.

- **Por qué segundo:** sin gastos completos, la portada y los avisos de margen mienten.
- **Costo:** medio.

### Paso 3 — La inflación como aviso accionable (acá le ganamos a Biyuya)
Biyuya te muestra que tu plata perdió valor. Odobi puede **detectarlo y arreglarlo**:

> *"Este precio no lo tocás desde marzo. Con la inflación acumulada estás cobrando un 14% menos en términos reales. ¿Lo actualizo en tus presupuestos?"*

Dato + consecuencia + acción con tu confirmación. Es una regla más para el detector de Mi Día (que ya existe y está hecho justamente para sumar reglas), y para el emprendedor argentino es oro: sus **precios** envejecen todos los meses, no solo sus gastos.

- **Por qué tercero:** necesita que los pasos 1 y 2 existan para tener dónde mostrarse y datos completos.
- **Costo:** medio-bajo (una regla nueva + un índice de inflación).

### Paso 4 — El contador como destinatario
El "socio" real de todo emprendedor argentino es su contador, y ninguna app lo atiende. Primera versión, baratísima con lo que ya tenemos conectado (Gmail, Drive, Sheets):

> *"Mandale a Marcela los comprobantes de julio"* → Odobi arma la planilla y la manda. Vos confirmás.

Además cubre la promesa de "tu información es tuya" (que Biyuya usa como argumento de venta) sin construir nada nuevo: exportar a Sheets ya es posible.

- **Costo:** bajo. **Valor percibido:** enorme — es un dolor mensual real.

## 5. Qué NO haría

- **No competir con Biyuya en finanzas personales.** Ellos van a la plata de la persona; nosotros al negocio de la persona. Mezclarlo diluye a los dos.
- **No armar dashboards con gráficos.** La portada son 4 números y avisos con acción. Si un dato no viene con un "¿querés que haga algo?", no suma — es decoración.
- **No sumar integraciones nuevas** hasta que el ciclo (hacer → anotar → vigilar → preguntar) se vea completo con las 6 que ya hay.
- **No modo multi-usuario todavía.** El acceso del socio/contador con su propio usuario es deseable, pero el Paso 4 captura el 80% del valor con el 5% del esfuerzo.

## 6. Resumen para el pitch

| | Biyuya | Odobi (con estos 4 pasos) |
|---|---|---|
| Centro | Tu libro de plata personal | Tu negocio, contabilizado solo |
| Cómo entra la data | La cargás vos (con ayudas) | Entra sola cuando ejecutás |
| Qué hace la IA | Responde preguntas | Ejecuta, vigila y propone — vos confirmás |
| Frente a un problema | Te lo muestra | Te lo muestra **y te ofrece resolverlo** |

La voz no es el producto. La voz es la puerta. **El producto es un negocio que se anota solo y un socio que lo mira cuando vos no podés.** Eso es lo que estos 4 pasos hacen visible.
