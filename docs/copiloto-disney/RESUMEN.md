# Copiloto Disney — resumen en 2 minutos

> Todo lo que hay que saber para decidir. El resto de los documentos es respaldo.

---

## 1. El negocio de un agente Disney

| Dato | Valor |
|---|---|
| Comisión | 10-16% de la venta |
| Cuándo la cobra | **Después** de que el cliente viajó |
| Anticipación con que se reserva | 6 a 12 meses |
| Tiempo de trabajo por reserva | 8 a 10 horas |

**Consecuencia:** trabaja hoy y cobra el año que viene.

## 2. El dolor: las fechas

Entre que el cliente compra y viaja, hay deadlines que el agente **tiene que** vigilar:

| Hito | Cuándo |
|---|---|
| Pago final — Disney World | 30 días antes del check-in |
| Pago final — Disney Cruise Line | 90 días (viajes cortos) / 120 días (largos) |
| Pago final — Universal | 45 días antes |
| Reservas de restaurantes (ADR) | 60 días antes, 6:00 AM |
| Lightning Lane | 7 días antes si el cliente está en hotel Disney, 3 si no |

Si se le pasa una: el cliente se queda afuera, o le cancelan la reserva.

> **Disney no le avisa nada de esto al agente.** No existe ningún sistema que le diga "hoy es el día 60 de
> tu cliente". Lo lleva a mano, en una planilla o en la cabeza.

## 3. La competencia

Hay ~10 programas para agentes de viajes, varios específicos de Disney. Cuestan **US$10-40/mes**.

Del más viejo (1987) al más nuevo (2025), **todos tienen el mismo problema:**

- Hay que **cargar todo a mano**.
- Ninguno se conecta con Disney — porque Disney no lo permite. No hay forma de conectarse, y al que lo
  intentó por las malas, se lo bloqueó.

Todos hacen lo mismo: vos cargás los datos, ellos te recuerdan las fechas.

## 4. Nuestra idea — dos cosas que nadie hace

### a) Que no cargues nada

Cuando Disney confirma una reserva, le manda **un mail** al agente. Ese mail ya trae el cliente, las
fechas y el monto.

- El copiloto lee ese mail solo y arma la venta.
- Y como los mails viejos siguen en la casilla, puede leer **los últimos 2 años** y reconstruir el negocio
  entero — sin cargar una sola fila.

### b) Que no avise nomás, sino que haga

| La competencia | Nosotros |
|---|---|
| "Vence el pago final de Luciana" | "Vence el pago final de Luciana en 5 días — ¿le mando el recordatorio y le armo el link de cobro?" |

El cobro por MercadoPago **ya lo tenemos funcionando**.

## 5. El riesgo — y es uno solo

Toda la idea (a) depende de algo que **todavía no sabemos**:

> ### ¿Los mails que recibe el agente traen realmente los datos?

- ✅ **A favor:** los mails que Disney manda **al viajero** sí sirven — hay otra empresa (TripIt) que los
  viene leyendo hace años.
- ❓ **En contra:** los mails que le llegan **al agente** son otros, y nadie los revisó nunca. Puede que
  traigan todo, puede que traigan la mitad, puede que ni lleguen.

## 6. Cómo lo probamos

**Pedirle a tu hermana 20-30 mails de confirmación** que ya tenga, de reservas viejas.

- Los corro por el sistema.
- En **una sesión** sabemos si se pueden leer bien.

| Resultado | Qué pasa |
|---|---|
| ✅ Los mails sirven | Seguimos con la idea completa. Es un producto que no tiene nadie. |
| ❌ No sirven | El copiloto le pregunta los datos por chat en 30 segundos. Sigue siendo mejor que un formulario de 15 campos, pero es **un producto más chico** y lo hablamos de nuevo. |

---

## Por qué todavía no hay diseño

No tiene sentido diseñar el sistema entero sin saber si la pieza principal existe.

**Son 30 mails y una sesión de trabajo.** Ese es el único paso pendiente.
