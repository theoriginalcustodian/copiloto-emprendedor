# DECISIONES — 13 · Ajustes, la segunda gramática

Creado el 19/08/2026. Dibuja **Ajustes y sus siete opciones**, en el orden exacto que fija
`kb-usuario/ajustes.md`: **Mi negocio · Facturación AFIP · Apps conectadas · Mi plan ·
Mi cuenta · Apariencia · Cómo hablarle**.

Acá vive **lo que la voz necesita saber** para poder operar: sin CUIT cargado y sin ARCA
vinculada no hay factura posible, por más bien que el usuario hable. Las funciones (mockup 12)
son la vía de la mano sobre los datos; Ajustes es la infraestructura de las dos vías.

---

## 0 · El hallazgo que ordenó este mockup

Se venía aplicando **una sola gramática visual** a todo el producto: stack con card blanca +
bloque negro. Eso hacía que "martin@elgalpon.com.ar" y "Tema claro" se vistieran igual que
"$286.000 en caja".

**El problema no era estético sino semántico:** cuando el mismo recurso vale para una cifra del
negocio y para un mail, el recurso deja de significar algo. Se revisó material de Monzo
(`Monzo iOS Screens`) y se confirmó que **usa dos gramáticas y las reparte por tipo de
pantalla**:

| | **Gramática A — operación** | **Gramática B — configuración / proceso** |
|---|---|---|
| Encabezado | card blanca + bloque de color | **título grande suelto sobre el lienzo** + bajada |
| Color pleno | sí, un bloque | **ninguno** |
| Contenido | cifras grandes | **filas agrupadas** con label y estado chico |
| Elección | — | **filas con radio**, no segmentos |
| Acción | pill chico | botón ancho al pie |

**Regla resultante (19/08):** el bloque negro sólo aparece en Mi día, las siete funciones y
Contabilidad. Significa **"una cifra de tu negocio"** y nada más.

## 1 · Las decisiones

| Elemento | Decisión | Fundamento | Alternativa descartada y por qué |
|---|---|---|---|
| Encabezado | **Título display 30 px suelto + bajada** | El nombre de la pantalla es contenido, no chrome. La bajada contesta "¿qué hago acá?" antes de que el usuario lo deduzca de las filas | Título en la barra: obliga a tamaño de etiqueta y no deja lugar a la explicación |
| Bloque de color | **Ninguno** | Ver §0. Usarlo acá vacía el recurso donde sí importa | Mantener el stack por simetría: era lo que hacía que todo se viera igual |
| Estado de la pantalla | **Una línea con punto de color** | Si ARCA está vinculada, si el copiloto pide confirmación, cuántas apps hay: es lo que define si Odobi puede hacer lo que le pidas. Verde `#3F7D5C` con la palabra al lado — WCAG 1.4.1, el color nunca solo | Un bloque de color con el estado: vuelve al problema anterior |
| Elección excluyente | **Filas con radio a la derecha** | En un segmento entran dos palabras. Con filas, "Producción" puede decir *"comprobantes reales, con validez legal"* — y el repo insiste en que esa diferencia se entienda **antes** de facturar en serio | Segmento tipo iOS: no deja explicar la consecuencia de cada opción |
| CUIT | **"Bloqueado", sin acción** | El repo: queda bloqueado una vez guardado. Un dato trabado no se disfraza de editable | "Editá" que después falla: promete lo que no se puede hacer |
| Clave fiscal | **Aclaración al pie, textual del repo** | *"No se guarda. Se usa una sola vez para vincular tu cuenta con ARCA y se descarta."* Es la promesa de seguridad más fuerte del producto | Tooltip o resumen: pierde el detalle, que es lo que la hace creíble |
| Apps | **Nombradas por capacidad, no por marca** | El repo define la conexión por lo que habilita. Es lo que hace entendible el costo de desconectar, que el repo exige mostrar como **lista real, no aviso genérico** | Lista de logos: no dice qué se pierde |
| Google Drive | **Grupo aparte: "Trabaja sola, de fondo"** | El repo aclara que no es una app que el copiloto use por chat: sólo archiva facturas | Mezclarla: promete algo que no hace |
| Gmail | Dice **"No puede leerlos"** | El repo lo documenta como duda frecuente. Mejor en la pantalla que en un FAQ | Omitirlo: el usuario lo descubre fallando |
| Cerrar sesión | **Grupo aparte, `#B04A2E`** (5,43:1 ✅) | Una acción destructiva no comparte contenedor con cambios reversibles | Una fila más: se toca por error |
| Apariencia | **Muestras reales de los dos temas** | Mostrar el fondo, el texto y la terracota decide mejor que dos palabras. El pie fija la regla: cambia fondo y texto, **la marca no** | Dos etiquetas: no muestran lo único que importa |
| "Cómo hablarle" | **El bloque muestra una respuesta de ejemplo** | Los controles son abstractos ("Cercano", "Breve"); ver la frase resultante es lo único que hace evidente qué elegís | Sólo los selectores: elegís a ciegas |
| Puerta de entrada | **El avatar, desde cualquier pantalla** | Decisión A del 26/07: Cuenta vive en el avatar (patrón Gmail/YouTube) | Una tab propia: ya derogada por el modelo de capas |

## 2 · El duplicado "Cómo hablarle", resuelto

El repo lista **"Cómo hablarle"** como séptima opción de Ajustes **y además** describe tono,
largo y nombre dentro de **Mi negocio**. Duplicar los controles sería tener dos dueños del
mismo dato.

**Gana la pantalla propia**, y el argumento lo da el propio repo: *"estos cambios se guardan
aparte del resto del perfil, así que si sólo tocaste el tono no hace falta que reescribas la
descripción de tu negocio"*. En Mi negocio queda una **fila-resumen** ("Cercano · Breve · lo
llamás Odobi") que lleva ahí: se ve el estado desde donde tiene sentido verlo, pero se edita en
un solo lugar.

Es el mismo criterio con el que se derogó el rótulo "Estás en Gastos" (mockup 12): **nada se
dice dos veces en el mismo producto.**

## 3 · Contraste (calculado)

| Par | Ratio | Nota |
|---|---|---|
| Negro s/ lienzo crema | 16,37:1 ✅ | títulos de 30 px |
| `sec` s/ lienzo | 6,44:1 ✅ | bajadas y estados |
| `sec` s/ blanco | 7,51:1 ✅ | labels de fila |
| `#B04A2E` s/ blanco | 5,43:1 ✅ | "Editá", "Cerrar sesión" |
| Verde `#3F7D5C` s/ lienzo | 4,53:1 ✅ | punto de estado (con texto al lado) |
| Separador `arena-30` s/ blanco | — | no lleva texto: es división, no superficie |

## 4 · Lo que este mockup NO resuelve

- **Mi plan es visión.** El backend no expone plan ni consumo (auditoría 13/08). Unidad
  correcta —**acciones/mes**— y el 200 sigue a calibrar. Lo central no es el medidor sino
  **Gasta / No gasta**: preguntar no consume.
- **Los formularios de edición no están dibujados.** Cada "Editá" abre uno.
- **El flujo de vinculación con ARCA tampoco.** El repo lo define en tres pasos, con mensajes
  que se actualizan durante varios minutos y un caso que merece dibujarse: si ya tenías la
  cuenta vinculada y un reintento falla, **la vinculación anterior sigue funcionando** — hay
  que decirlo o el usuario cree que perdió el acceso.
- **Conectar / desconectar una app.** El repo exige que al desconectar se muestre la **lista
  real** de lo que se pierde, no un aviso genérico. Es un lane propio.
