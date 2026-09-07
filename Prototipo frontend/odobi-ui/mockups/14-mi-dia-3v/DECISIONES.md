# DECISIONES — 14 · Mi día: números, agenda y tablero

Creado el 20/08/2026. Dibuja las **tres verticales** que planteó Martin para organizar el día:
resumen de inteligencia, tablero de pendientes y calendario.

Método del 12 y el 13: los teléfonos cargan el **prototipo real** por `iframe`, así no hay dos
fuentes de verdad. El mockup aporta el argumento; la pantalla viene de un solo lugar.

---

## 0 · El hallazgo que reencuadró el problema

Se verificó contra `kb-usuario/` antes de diseñar, y **dos de las tres verticales ya existían**:

| Vertical | Estado real |
|---|---|
| Resumen de inteligencia | ✅ Existe: portada (`query portada`) + los 5 números + el detector de 8 reglas |
| Tablero de pendientes | ✅ **Ya es Mi día.** `midia.md` lo define como kanban con tres pestañas —**Para hoy · Haciendo · Hechas**—, swipe para avanzar, tarjetas automáticas + manuales y control por voz |
| Calendario | ⛔ **No existía.** Google Calendar estaba conectado, pero sólo para que Odobi *agende* por chat |

**No había que inventar un kanban: había que dibujarlo.** El prototipo lo mostraba como lista plana
sin estados, que era deuda con el repo independientemente de esta spec.

## 1 · Las decisiones

| Elemento | Decisión | Fundamento | Alternativa descartada y por qué |
|---|---|---|---|
| **Orden de los bloques** | Números → agenda → tablero | Es el orden en que se decide una mañana: **cuánto tengo** (sin la caja ninguna prioridad se evalúa) → **qué es inamovible** (la hora no se negocia) → **qué debo atender** (lo único que sí se reordena) | Tablero primero: sin saber la caja, ninguna prioridad se puede evaluar |
| **Integración** | Una pantalla, tres bloques en scroll | Una sola respuesta a "¿cómo viene mi día?" sin obligar a elegir dónde mirar | Solapas: obligan a elegir y se pierde el panorama. Línea de tiempo única: las tarjetas del detector no tienen hora |
| **Tamaño del resumen** | **Máx. 3 ítems por bloque**, con contador | Un resumen que muestra todo deja de ser resumen y convierte Mi día en tres listas apiladas | Mostrar todo: la agenda queda enterrada bajo los pendientes |
| **Eje del tablero** | **Estado**, no función | Es lo construido, lo que la voz ya sabe mover, y contesta la pregunta de la mañana: *¿qué hago ahora?* La función se lee por el ícono | Por función (cobros/AFIP): pierde el flujo y hay que redefinir qué significa "terminar" |
| **En mobile** | **Pestañas, no columnas** | A 390 px tres columnas dan 118 px cada una: no cabe el nombre de un cliente. El repo ya lo resolvió así | Kanban de columnas lado a lado: es diseño de escritorio |
| **La tarjeta** | **Expandible in-place** | Es lo que el repo pide: *"tocar una tarjeta la expande… volvés a tocarla para colapsarla"*. Ves **todas** y el detalle de una: el contexto es lo que hace decidir cuál atender primero | **Carrusel**: mostraba una por vez y **gastaba el eje horizontal**, que el swipe necesita. **Sheet**: tapa la pantalla justo cuando hace falta el contexto |
| **Prioridad** | Color **sólo en el texto**, peso escalonado | Con fondo eran 8 manchas por pantalla (4 chips + 4 tiles) sobre el bloque negro y el botón. Sin fondo los cuatro textos pesan igual —rango de luminancia **0,023**—, así que **la jerarquía la da la tipografía**: 600 lo urgente, 400 lo que se hunde. Funciona en blanco y negro (WCAG 1.4.1) | Chips con fondo pastel: la app quedaba demasiado colorida |
| **Orden de la lista** | Odobi ordena; el usuario fija arriba y oculta tipos | El orden manual **envejece**: una factura que vence mañana queda abajo porque se movió la semana pasada | Arrastrar libremente: máximo control, orden desactualizado |
| **Swipe** | Con **rebote** pasado el umbral | Comunica "hasta acá llega" sin cartel. Antes frenaba seco y no daba devolución | Frenar seco: el usuario no sabe si el gesto se registró |
| **Alternativa sin gesto** | **"Borrar" dentro de la tarjeta expandida** | WCAG 2.5.1 exige alternativa de un solo puntero al swipe. Usa el detalle que el repo ya pide al tocar, sin agregar un control a la fila | **Checkbox en la fila**: se probó y se quitó — una anotación cumplida no se archiva, se borra |
| **Bloques del día** | Altura proporcional, **76 px/hora** | Dice cuánto dura sin texto. La escala salió de una restricción real: con 58 px/hora un evento de 30 min mide 25 px y **no hay lugar para padding** — el problema no era el padding, era la unidad de tiempo | Filas de alto fijo: no distinguen una reunión de 2 h de una llamada de 15 min |
| **Línea del ahora** | En **terracota**, no en rojo | Es señal, y el sistema ya tiene un color para eso. **Google usa rojo porque su acento es azul**; copiarlo mete un color fuera de la paleta | Rojo de Google Calendar |
| **Origen del evento** | Borde izquierdo: arena = Calendar · terracota = tablero | Dice de dónde viene sin gastar un ícono ni una fila | Color por calendario (Google): rompería el 60/30/10 |
| **Sin hora** | Bloque aparte, **obligatorio** | La mayoría de las tarjetas del detector no tienen hora: un presupuesto frío no vence a las 14:30, y forzarlo **inventa un dato** — mismo error que mostrar "$0" donde falta el número | Ubicarlas por hora estimada: dato falso presentado como real |
| **Alerta crítica** | Sólo en el tablero, **arriba de las solapas** | El repo llama al certificado *"el aviso más importante de todos"*. Arriba de las solapas porque es **transversal a los tres estados**: no pertenece a "Para hoy", pertenece al negocio. **En Mi día no va**: allá la prioridad ya la dice el texto en color | Como una tarjeta más: el sistema no distinguía **importante** de **crítico** |
| **Estado de carga** | Skeleton | El detector corre en el backend: hay una ventana real entre abrir y tener las tarjetas. Sin esto es una pantalla vacía, **que se lee como "no hay nada"** — el mensaje opuesto | Spinner: no anticipa la forma de lo que viene |
| **Avance del día** | Barra sobre el total del día | **Cerrar cosas ES el trabajo del día**: verlo avanzar es la única devolución que el usuario recibe. ⚠️ Cuenta sobre el total, **no sobre lo visible** — si contara lo visible retrocedería al descartar, y descartar no es fracasar | Contar lo visible: la barra iría para atrás |

## 2 · Qué se tomó de Google Calendar, y qué no

Se adopta **lo que hace reconocible a un calendario**, no su estética.

| Se toma | Por qué |
|---|---|
| Columna de horas con líneas tenues | Es el andamio que vuelve legible la duración |
| Bloques proporcionales al tiempo | La obra de 2 h ocupa el doble que la llamada, **sin decirlo con texto** |
| Línea del ahora con su punto | Es el elemento más identificable de cualquier calendario |
| Los huecos se ven como espacio | Ahí encaja natural la propuesta de Odobi ("tenés libre de 15:30 a 18") |

| No se toma | Por qué |
|---|---|
| Color por calendario | Rompería el 60/30/10: el sistema tiene **un** acento |
| Vista mes | En mobile no contesta "qué hago hoy", que es la pregunta de esta pantalla |
| Rojo para el ahora | Ver arriba: nuestro acento ya es cálido |

## 3 · Contraste (calculado)

| Par | Ratio | Uso |
|---|---|---|
| Crema s/ negro | 16,37:1 ✅ | cifras de la portada |
| Arena s/ negro | 8,46:1 ✅ | labels y la alerta crítica |
| `#A32B47` s/ blanco | 7,01:1 ✅ | prioridad urgente |
| `#8A6410` s/ blanco | 5,37:1 ✅ | prioridad "pronto" |
| `#3C6B52` s/ blanco | 6,15:1 ✅ | prioridad "al día" |
| `#7A716A` s/ blanco | 4,78:1 ✅ | sin fecha |
| `sec` s/ `#FAE9ED` (fila en curso) | 6,42:1 ✅ | tinte de superficie grande |

## 4 · Lo que este mockup NO cierra

- **Agendar una tarjeta y "Odobi propone huecos" son VISIÓN.** El backend no expone duración ni
  huecos, y **las tarjetas del detector no tienen campo de hora** — eso es cambio de modelo de
  datos, no de UI. Confirmar con David antes de darlo por real.
- **El sheet de detalle quedó redundante** desde que la tarjeta expande. Decidir si sobrevive o si
  el tablero también expande.
- **"Fijar arriba" y "ocultar tipos" no existen en el repo.** Son propuesta de diseño.
- **Cuántas tarjetas soporta Mi día** antes de volverse larga: hay que probarlo con contenido real,
  no con cuatro de ejemplo.
- **El solapamiento con Inteligencia:** el bloque negro ya abre esa pantalla, y ahora la agenda y el
  tablero también tienen "ver todo". Mi día pasa a ser un índice de tres pantallas — aceptable
  mientras el resumen **responda solo** la pregunta de la mañana; si obliga a entrar a las tres, falló.
