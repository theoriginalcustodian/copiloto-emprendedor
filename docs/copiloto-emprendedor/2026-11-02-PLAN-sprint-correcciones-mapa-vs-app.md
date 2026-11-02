# Plan del sprint: dejar la app acorde al mapa de pantallas

> **Fecha:** 2026-11-02 · **Sesión:** frontend1 · **Estado:** decisiones cerradas; falta bajar las fichas.
> **Para quién es:** planificación (baja las fichas `SM-*` y los `contrato_`) y las sesiones que implementan.
> **Fuente:** [mapa vs app](2026-10-16-relevamiento-mapa-de-pantallas-vs-app.md) y [pendientes de device](2026-10-16-relevamiento-PENDIENTES-device-plan-para-completarlo.md) @`3c439cb4`. El artefacto del relevamiento solo actualizó los conteos: sus fichas tienen el veredicto viejo y no se usan como fuente.

**Objetivo.** Corregir de una vez lo que el relevamiento encontró, con las decisiones tomadas al principio para que el sprint no se frene a preguntar.

**Cierre binario.** El sprint termina cuando las 51 entradas del mapa están en CONFORME o en DIFERENTE·B con cita, cada una con evidencia de device, y sus fichas marcadas con `scripts/sprint-estado.py`.

## 1. Decisiones del operador (2026-11-02)

| # | Tema | Decisión |
|---|---|---|
| D1 | Solapas con el escritorio abierto (R02) | **La tira del chat se oculta**: una sola solapa, como el mapa. Antes de tocarla, leer por qué #1084 la dejó a propósito. |
| D2 | Zona de entrada (preguntas 2 y 5, R01, F12) | **Campo + mic chico al pie** de Mi día y de las 6 funciones. Sale el botón de voz grande, también en Soporte. Queda la píldora de alta manual del mockup 12. |
| D3 | «Tu día» | **Conserva los filtros por categoría y «Anotar algo para hoy»**; se agregan al mapa. |
| D4 | Lo que la app tiene y el mapa no | **Si sirve, se queda y se documenta en el mapa** (BUSCAR en Gastos, «Te deben» en Facturación). |
| D5 | Card de presupuesto (`pres-hitl`) | **Formulario editable**. Se corrige el mapa y se iguala el rótulo del botón. |
| D6 | Homologación | **Solo `copiloto_admin`**, con rechazo del backend para el resto y test adversarial. Las pruebas sin emisión real usan un usuario admin. |
| D7 | Cancelar y editar la factura | **Las dos vías.** El agente cancela de verdad cuando se lo piden por chat o por voz, y la card trae los botones **Editar · Cancelar · Emitir la factura** para hacerlo a mano. |
| D8 | «Mandale un mail a Lucía para mañana» | **Propone un mail que sale al confirmar**, y la card lo aclara. No se construye envío programado. |
| D9 | Agenda | **Mixta**: línea de tiempo con línea del ahora para hoy; lista para Mañana y Esta semana. |
| D10 | Facturas reales N° 10 y N° 11 | **Se anulan al final del sprint**, como prueba de que la anulación funciona. El botón final lo toca el operador. |

Decisiones anteriores que siguen vigentes: Pregunta 4 (el tablero es pantalla propia «Tu día»), decisión 7 («Volver» a la izquierda), decisión 8 (la frase de la card de gasto es la del código), DEC-8 (`plan` y `limite` son VISIÓN post-beta), segundo aviso de Calendar agregado al mapa, voz y build release medidos después de las correcciones.

### Criterios tácticos aplicados

- «Cambiar el mail» sigue afuera (pregunta 6): depende del SMTP de SM-C5, que está diferido.
- «Crear una nueva cuenta» sale del mapa (decisión #3).
- El paso de perfil del onboarding se agrega al mapa (N4), sin los errores prematuros.
- La clave fiscal conserva la frase del código, con el criterio de la decisión 8.
- Con «consumidor final» explícito, el agente no pide CUIT. Antes hay que verificar el tope de ARCA para vender sin identificar.
- Google Sheets: si no hay conector, sale del mapa.
- R03: si el experimento muestra que es solo demora, se corrige igual.

## 2. Por qué por piezas compartidas

Ir pantalla por pantalla repite el dock 6 veces y deja lo grave para cuando toque. Este plan arregla primero el riesgo real, después cada pieza compartida una sola vez, y las pantallas la heredan.

| Wave | Contenido | Dueño propuesto | Estimado (sin medir) |
|---|---|---|---|
| 0 | Preparación | frontend1 y frontend2 | 1 h |
| 1 | Confirmaciones | backend y frontend1 | 4-5 h |
| 2 | Cáscara | frontend1 | 5-6 h |
| 3 | Funciones | frontend2 y backend | 4-5 h |
| 4 | Ajustes y ARCA | frontend2 | 3-4 h |
| 5 | Cierre con el operador | frontend2 y operador | 2 h |

Son unas 20 h en secuencia, o 10-12 h con tres sesiones. Las waves 1 y 2 van primero; la 3 y la 4 pueden correr en paralelo. `PantallaMiDia.tsx` (1067 líneas) tiene un solo dueño a la vez. El teléfono tiene un solo dueño a la vez.

## 3. Contenido por wave

### Wave 0: preparación

- Mergear los arreglos de enlaces de `mapa-pantallas/index.html`, `prototipo/mapa.html` y mockups. Están sin commitear en el checkout compartido, que va atrasado: se reaplican sobre `origin/main`, no se copian.
- Corregir el mapa: N5 (`?ver=vacio` y `?ver=vacio-visto`), N7 («30 pantallas» contra 51), sheet de `detalle`, «Crear una nueva cuenta» en `splash`, `reveal` y `volver`.
- Borrar el usuario descartable del relevamiento y volver el teléfono al usuario canónico (`avance_` de frontend2, 2026-11-02).
- Correr el experimento R03: capturas a +0,3 s, +0,8 s y +3 s de soltar (`cierre_` de frontend1, 2026-10-16). Con eso se baja la ficha.

### Wave 1: confirmaciones

Va primero porque hoy una factura «cancelada» por chat sigue emitible en Producción.

| Entrada | Trabajo |
|---|---|
| `fact-hitl` | Botones Editar · Cancelar · Emitir en `TarjetaFacturaPropuesta.tsx` (D7). Editar cubre todos los datos dentro de la card, sobre el mismo workflow, y emite solo por `confirmarConTokenFresco`. Revierte el docstring de la card: lleva ADR. |
| Cancelar | Herramienta del agente y botón sobre la señal `cancelar` existente (`afip_factura_workflow.py:224`, `afip_web.py:353`). Hoy `tool_catalog.py` no tiene herramienta de cancelar. |
| `hitl` | El pedido de mail produce la card de Gmail (D8). Una card cancelada no puede pasar a «Confirmado». |
| Consumidor final | Si se dice explícito, no se pide CUIT (criterio de §1). |
| `pres-hitl`, `pres-ciclo` | Rótulo del botón y del chip, «Pendiente» en la card, importe `$50.000` y no `$50,000.00`. |
| `fact-cae` | Cliente y número formateado en «Factura emitida.»; opción de mail. |

**Causa candidata del falso «Confirmado» (leída, sin correr):** `sanitizarHitlRespondido` guarda como `value` el texto «Cancelar» (`packages/core/src/chat/hitl.ts`), y `ListaMensajes.tsx:213` lo compara con `cancelValue`. No coinciden, así que al recargar muestra «Confirmado».

**DoD específico:**
- Test adversarial: cancelar por botón y por chat, luego `confirmar` → denegado; un toque repetido o un remount no emiten.
- Test adversarial de tenant: A no cancela ni edita la propuesta de B.
- Evidencia de device de Editar → cambiar un dato → volver a la card, en Homologación y sin emitir real.

Antes de tocar el workflow: skills `temporal-developer` y `temporal-ai-patterns`. La junta backend↔app baja como `contrato_`.

### Wave 2: cáscara

Skills antes de escribir: `swmansion-react-native-best-practices`, `swmansion-rn-gestures`, `swmansion-rn-animations`. Consultar primero documed.

| Entrada | Trabajo |
|---|---|
| `base`, `tablero` | Mi día con tarjeta de cabecera, lista «Ahora» y «Para hoy · Ver tablero ›»; pantalla «Tu día» con «Volver» (D3). Revisar los `testID` `midia-*` y los E2E que dependan de la estructura actual. |
| `chat`, `base`, R01 | Componente de dock compartido: campo + mic chico (D2). No existe hoy: se extrae de lo que ya hacen `ChatView.tsx` y `PantallaSoporte.tsx`. La función de grabar, fijar y cancelar de N8 se reubica, no se reescribe. |
| Botones del chat | Contraste legible en reposo y estado deshabilitado distinguible. |
| `esc`, R02, R04 | Título, orden y tiles; ícono de Ajustes en Funciones; una sola solapa (D1); colores de tiles y cards. «Presupuestos» no se parte. |
| Avatar | Dibuja la inicial (`AvatarCuenta.tsx`). |
| R03 | Según el experimento de la wave 0. |
| `consent` | Íconos por capacidad y banner de continuación. |

### Wave 3: funciones

| Entrada | Trabajo |
|---|---|
| `gastos`, `ingresos`, `factura`, `presu`, `clientes`, `bi` | El dock de la wave 2 en las 6, más sus rótulos («ÚLTIMOS», «Ticket», «N facturas · N impaga»). |
| `factura`, `presu` | Chips por fila y de antigüedad. |
| `bi`, `bi-vacio` | Cabecera en card blanca con período, etiqueta de mes, mosaicos y «Sin ventas todavía». |
| `clientes` | Monto, comprobantes y chips. Hoy la app no los recibe: baja como `contrato_` a backend. |
| `agenda` | Vista mixta (D9), «+ Nuevo evento» y punto de estado. Verificar si el evento repetido en «Esta semana» es dato o defecto. |

### Wave 4: ajustes y ARCA

| Entrada | Trabajo |
|---|---|
| `afip`: visibilidad | Homologación solo para admin (D6), con test adversarial. |
| `afip`: vincular | El recuadro completo es tocable y se ve igual en ambos estados. Tocar «Vincular» lleva al formulario, que dice a qué ambiente vincula. |
| `afip`: estado | La pantalla se refresca sola al terminar. Los botones apagados dicen por qué. El error distingue falla del servicio de dato mal cargado. Subtítulo y «Necesito cambiarlo ›». |
| `apps` | «No puede leerlos» en Gmail, estado como etiqueta, Sheets según §1. |
| `ajustes`, `cuenta` | Subtítulos y encabezado, «desde …», chevrons, fondo blanco que sobresale de las tiles, «Sí, cerrar sesión» cortado, copy «usuario y contraseña» con Google. |
| `ingresar` | Estructura del formulario y aviso de sesión cerrada. |
| `negocio`, `comousar`, `soporte`, `feedback`, `apar`, `hablar` | Estructura según cada entrada del relevamiento. `soporte` suma el clip. |
| Onboarding | Sin errores antes de escribir (N4). |
| Máscara de fecha | Repetir con teclado real antes de llamarlo defecto. |

### Wave 5: cierre con el operador

Es la única parte que no es autónoma. Se junta todo en una ventana:

1. Build release: mide `entrada` y si el chat sube solo.
2. Voz real: `vozchat`, `fact-voz`, `pres-voz` y el cancelar deslizando en su nuevo lugar.
3. Anulación de las facturas N° 10 y N° 11 (D10), botón final del operador, con captura y estado en servidor.
4. Re-medición de las 51 entradas con `collections.Counter`. `onb-cumplida` y `vacio-visto` necesitan datos y días de uso reales: si no se pueden producir, quedan declaradas con su motivo.

Hasta esa ventana, las fichas que dependan de ella quedan `DOD-PARCIAL` con su `Falta:`.

## 4. Pedido a planificación

1. Bajar las fichas `SM-*` con DoD binario, una por fila de §3, y citar el id en cada commit (`CLAUDE.md` §3.quater.bis).
2. Bajar los `contrato_` de la wave 1 (cancelar, editar, mail) y de `clientes`.
3. Confirmar dueños y orden, y declarar la orden con `/goal`.
