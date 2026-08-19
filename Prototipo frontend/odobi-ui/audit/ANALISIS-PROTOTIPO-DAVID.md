# Análisis de usabilidad y experiencia — build de David (13/08/2026)

Piezas analizadas: 4 capturas en Android (login · Funciones · Chat · Inteligencia de Negocio), tema **oscuro**, **contrastadas contra el código fuente** del repo (`copiloto-emprendedor-main (4).zip`, 13/08).

**Qué es este documento.** Un diagnóstico, no una opinión. Cada observación va con: qué se ve, por qué es un problema (o un acierto) con fundamento citable, y qué proponemos. Lo que se puede medir, está medido.

**Método.** (1) Colores extraídos píxel a píxel de las capturas (ffmpeg → RGB crudo) y contrastes calculados con la fórmula de WCAG 2.2. (2) Después, los mismos valores verificados contra `apps/mobile/src/theme/tokens.ts` y el DoD del sprint. El fondo medido en la captura dio `#1D1610` y el token real es `#1E1610` — la desviación por compresión JPG es de un punto por canal, así que las mediciones sirven. Donde el código estaba disponible, gana el código.

---

## 0 · Lo primero: buena parte de esto ya está decidido en el repo

Antes de criticar nada hay que decir lo que el código dice, porque cambia el diagnóstico:

| Hallazgo en el repo | Consecuencia |
|---|---|
| **El rebrand Odobi ya se implementó** (`docs/copiloto-emprendedor/2026-08-05-DoD-sprint-odobi.md`, aprobado 05/08): 3 pieles —**claro (default)**, oscuro, nocturno— con **un solo acento terracota**. Se borraron los 5 skins heredados. | Las capturas son de la piel **oscura, que no es el default**. Juzgar el producto por ella es juzgarlo por su tema secundario. |
| **"Sin glass: color pleno + relieve"** ya es decisión tomada (§1.3 del DoD), con justificación medida: el `BlurView` **nunca desenfocó en Android**, y en el diseño web el `backdrop-filter` no tenía nada que desenfocar. | El glassmorphism de las capturas **no es una postura de diseño: es deuda declarada** — `CristalVidrio.tsx` sigue montado porque retirarlo es un hito posterior. No hay que discutirlo, hay que terminarlo. |
| **La app NO abre en el lanzador.** `PantallaPrincipal.tsx`: la conversación es la **Capa 1 (adelante)** y el escritorio la **Capa 0 (detrás)**; el panel arranca arriba. | Mi lectura inicial de las capturas era equivocada y la corrijo: el chat es la pantalla de arranque. El problema real es otro, y está abajo (C1). |
| **Tocar el handle ya alterna el panel** (`PanelDeslizable.tsx`, `|Δ|<5px` → toggle). | Existe alternativa de un toque al gesto (WCAG 2.5.1). No está anunciada: el hint dice "Deslizá", nunca "Tocá". |
| **El texto secundario fue ajustado con la fórmula, no a ojo** (`tokens.ts`: subieron el alfa de .55 a .69 en claro porque 3,23:1 no pasaba, y lo documentaron con el ratio). | La disciplina de contraste existe en el equipo. Las fallas de abajo no son desidia: son un nivel que se les escapó (el terciario) y un componente que rompe un token que sí pasaba. |

**Consecuencia de método:** este análisis ya no es "diseño vs. implementación". Es una lista corta de cosas que faltan cerrar, dos divergencias de sistema que hay que reconciliar, y un problema de producto que sí es de fondo.

---

## 1 · Lo que está bien (y hay que conservar)

1. **El chat adelante y el escritorio detrás.** La metáfora es correcta y está bien argumentada en el código: *lo que tenés entre manos está al frente; al deslizarlo aparece lo archivado*. Corresponde al *standard bottom sheet* de Material 3 (superficie que convive con el contenido, no lo bloquea).
2. **El estado inicial del chat explica el contrato, no la función.** "Antes de ejecutar algo importante, siempre te lo muestro para que lo confirmes" pone el HITL —la tesis del producto— en el primer texto que se lee.
3. **La ingeniería de interacción está resuelta con criterio medible.** El snap del panel usa `withSpring` con la velocidad del dedo (y está documentado por qué `withTiming` producía el "amaga a volver"); el flick decide por dirección arriba de 500 px/s; los `ScrollView` salen de Gesture Handler para que tap y scroll no compitan. Eso es trabajo fino y bien fundado.
4. **Los estados vacíos no mienten.** Si el backend no responde, la lista queda vacía con texto honesto — el comentario del código es explícito: *"nunca un fallback con datos inventados"*.
5. **El login es mínimo y con jerarquía correcta.**
6. **El acento único y las 3 pieles** son la decisión correcta frente a los 5 skins heredados.

---

## 2 · Críticos

### C1 · La app arranca preguntando, no informando

**Qué se ve.** Al abrir, la conversación tapa la pantalla con "¿En qué te ayudo?" y un texto de bienvenida. Mi día es un tile del escritorio de atrás.

**Por qué es un problema.** El propio glosario del repo (`CONTEXT.md`) define Mi Día como *"el tablero donde el copiloto **habla primero**: cada mañana arma tarjetas de trabajo según reglas fijas y verificables"*. Esa es la capacidad que ningún competidor de planilla tiene, ya está implementada (detector determinista, 6 reglas) — y el arranque no la usa. La primera pantalla le devuelve la pelota al usuario: *decime vos*.

Un asistente que pregunta primero traslada la carga de saber qué pedir (*gulf of execution*, Norman). Un copiloto que abre con "Lucía no te contestó hace 31 días" demuestra su valor antes de que el usuario haga nada. Es la diferencia entre una herramienta y un socio — y es literalmente la promesa de la marca ("no emprendas solo").

**Qué proponemos.** Que el arranque muestre **Mi día**, y que la conversación esté a un gesto/tap de distancia. Es una inversión de capas, no una arquitectura nueva: el mecanismo del panel ya existe y funciona. La discusión concreta (qué capa va adelante) está en §5.

---

### C2 · Nueve funciones en dos filas con scroll horizontal

**Qué se ve.** 9 tiles (`ANCHO_TILE = 104` dp, máximo 2 filas) → 5 columnas, de las que entran 3 y media. La cuarta queda cortada, con un fade y una solapa con flecha pegada al borde.

**Por qué es un problema.** El mecanismo está clonado de DocuMed, y su racional está escrito: *"preparate para más funciones, esto no puede ser 3×2 fijo"*. Es una decisión defendible **para una lista que crece sin techo**; el problema es que acá produce tres efectos que se suman:

- **El scroll horizontal es la affordance más débil que existe** en mobile. El fade + solapa ayudan (y están bien resueltos: sólo aparecen si hay overflow, medidos con `onLayout` y no con `Dimensions`), pero una solapa cortada al borde se lee antes como error de recorte que como invitación.
- **Compite con el gesto vertical del panel** en la misma superficie, y en Android el swipe desde el borde ya pertenece al sistema ("atrás").
- **Los labels se parten**: "Facturació/n", "Presupues/tos". El tile reserva 2 líneas de alto (bien pensado), pero 104 dp no alcanzan para las palabras reales del dominio.

Y hay un problema de contenido antes que de layout: **9 destinos equiprobables** en la misma grilla (Hick-Hyman), con "Ajustes" duplicado como tile *y* como engranaje del header.

**Qué proponemos.** Que la grilla entre completa: 3 columnas × 3 filas para 9 funciones, o —mejor— separar lo que no es una función de negocio (Ajustes sale de la grilla; Mi día se va al arranque) y quedan 7 en 2 filas sin scroll. Si en el futuro pasan de 8, ahí sí una tercera fila o un "Ver todas".

---

### C3 · Contrastes: el nivel terciario y un componente que rompe su propio token

Medidos sobre el fondo real (`#1E1610`):

| Elemento | Color | Ratio | Mínimo | Estado |
|---|---|---|---|---|
| Label "FACTURACIÓN" (BI) | `#4C251A` | **1,35:1** | 4,5:1 | ✗ |
| Label "MES A MES" | `#642D24` | **1,65:1** | 4,5:1 | ✗ |
| Label "EN CAJA" | `#5B3A32` | **1,78:1** | 4,5:1 | ✗ |
| Label "ESTE MES" | `#653D32` | **1,93:1** | 4,5:1 | ✗ |
| Texto de las tabs Resumen/Preguntar | `#7C4137` | **2,27:1** | 4,5:1 | ✗ |
| Hint del panel ("Deslizá…" / "Subir…") | `#69605X` | **2,90:1** | 4,5:1 | ✗ |
| Números de meses del gráfico | `#6E685E` | **3,24:1** | 4,5:1 | ✗ |
| Estado vacío de Actividad | `#7B7066` | **3,71:1** | 4,5:1 | ✗ |
| Label "Entrar" sobre el botón | `#DABAAA` s/`#903725` | **4,20:1** | 4,5:1 | ✗ |

**Las dos causas, encontradas en el código:**

1. **El "texto terciario" nunca se auditó.** El DoD lo declara como `rgba(241,228,204,.42)` para *"mono, placeholders"*. Aplanado sobre el fondo oscuro da **3,51:1**; en la piel clara, `rgba(46,42,32,.42)` da **2,34:1**. El equipo sí auditó el secundario (.55 → lo subieron a .69 en claro y lo documentaron con el ratio), pero el terciario quedó afuera — y es justo el que pinta todos los labels de sección.
2. **`opacity` encima de un token que ya estaba al límite.** El hint del panel usa `color: textoTenue` (que pasa AA: 5,06:1) y le aplica `opacity: 0.65` en el estilo. El resultado efectivo es 2,90:1. **El token pasa, el componente lo rompe.** Es el patrón a buscar en toda la app: cualquier `opacity` sobre texto invalida la validación del token.

**Nota justa:** el ojo no detecta esto — por eso la regla es calcular, no mirar. Nosotros nos comimos exactamente la misma trampa el 08/08 auditando el árbol: revisamos los pares llamativos y se nos escaparon los aburridos.

---

### C4 · Verde y rosa: colores de otra app, y el color trabajando solo

**Qué se ve.** Ingresos en verde menta `#34e5a0`, gastos en rosa `#ff8fa0`.

**Por qué es un problema.** No hace falta discutirlo: **lo dice el propio código**. `tokens.ts` declara `SEMANTICOS_OSCURO` con el comentario *"no están en el DoD de ODOBI; no hay WCAG gate en mobile que los ejercite, así que reusar el par ya validado es preferible a inventar uno nuevo"*. Son los semánticos heredados de **DocuMed** (la app clínica hermana). Contrastan bien (10,9:1 y 8,2:1) pero son de otra marca: verde-menta y rosa neón vienen del vocabulario fintech/salud del que Odobi se quiere diferenciar.

Se suma un problema de accesibilidad propio: la diferencia ingreso/gasto está codificada **sólo en el tono** (SC 1.4.1 *Use of Color*). Y en la misma pantalla conviven cuatro codificaciones para seis cifras: verde, rosa, terracota (rentabilidad) y crema (facturado), sin regla declarada.

**Qué proponemos.** Positivo/negativo por **signo y jerarquía tipográfica**, no por semáforo; y si hace falta color, que salga del sistema Odobi (el DoD ya declara `exito: #3C8069` para la piel clara — falta el par oscuro).

---

## 3 · Mayores

**M1 · Glass: terminar el hito, no discutirlo.** Bordes de tile a ~1,4:1 contra el fondo, por debajo del 3:1 que pide SC 1.4.11 para identificar un control. La decisión de aplanar ya está tomada y justificada; lo que falta es retirar `CristalVidrio` y aplicar `superficie: #251B11` + relieve. Dato incómodo: `#251B11` contra el fondo `#1E1610` da **1,06:1** — aplanar sin subir ese escalón deja las superficies invisibles igual. La superficie necesita más separación del lienzo.

**M2 · La terracota dejó de ser señal.** En Inteligencia hay terracota en cifras, labels de sección, tab activa, ícono y borde: **más terracota no tocable que tocable**. Nuestra Decisión B ("si es terracota, pasa algo al tocarlo") existe porque un acento omnipresente deja de informar.

**M3 · Colisión en el header de Inteligencia.** El engranaje se superpone al título y tapa parcialmente "Volver". Dos affordances de retroceso, una ilegible.

**M4 · Dos puertas al mismo motor.** La tab "Preguntar" dentro de Inteligencia hace lo mismo que el chat global. Con el chip de contexto ("↩ Desde Inteligencia") alcanza una sola puerta.

**M5 · El engranaje mide 42 dp y está en la peor esquina.** 77 px de captura ≈ **42 dp**: por debajo de los 44 pt de Apple HIG y los 48 dp de Material. Y es la única entrada a Ajustes/Cuenta, en el vértice de menor alcance del pulgar (Hoober).

**M6 · El hint enseña el gesto difícil y esconde el fácil.** Tocar el handle ya alterna el panel, pero el texto dice "Deslizá para ver funciones". Cambiarlo a un verbo que cubra las dos vías —o hacer el handle visiblemente un botón— convierte una función oculta en una descubrible, sin escribir lógica nueva.

**M7 · No se sabe dónde estás.** Sin tabbar ni indicador persistente: escritorio, chat y cada función abierta son contextos sin marca de posición (Nielsen #1). El panel tiene además dos estados y ninguno rotulado más que por el hint.

**M8 · Mono como tipografía de UI.** Labels de sección y estados vacíos en monoespaciada. Es ~33% más ancha por carácter (medido el 08/08) y contribuye al truncamiento; además, en nuestro sistema la mono es la capa de **anotación**, no de producto.

**M9 · Siete "$0,00" en la portada de Inteligencia.** Una cuenta sin datos mostrando ceros formateados se lee como error de carga, no como "todavía no hay nada". El estado vacío explícito comunica mejor y es coherente con la regla del propio repo de no inventar datos.

---

## 4 · Las dos divergencias de sistema (hay que reconciliarlas, no ganarlas)

### 4.1 · El acento: `#C2452E` (repo) vs `#DE7250` + `#B04A2E` (marca)

El DoD §1.4 lo decide así: *"Gana la paleta de Mariposas, no la del brief. El brief marcó su propia terracota `#DE7250` como ❌ 2.86:1 sobre crema; Mariposas ya lo corrigió con `#C2452E`."*

**El diagnóstico es correcto y la solución es una de dos posibles.** Los números:

| | s/crema `#F7F3EC` | blanco encima | s/negro `#1A1512` |
|---|---|---|---|
| `#C2452E` (repo) | **4,54:1** ✓ | 5,02:1 ✓ | 3,61:1 |
| `#DE7250` (marca, fill) | 2,86:1 ✗ | 3,17:1 (AA grande) | **5,71:1** ✓ |
| `#B04A2E` (marca, texto) | **4,91:1** ✓ | 5,43:1 ✓ | 3,33:1 |

David resolvió con **un color que sirve para las dos cosas**; nosotros resolvimos con **un par** (fill vivo + versión profunda para texto sobre claro). Las dos son legítimas. Lo que no puede pasar es que convivan tres terracotas en el mismo producto.

**Nuestra posición, con fundamento:** el par conserva más energía de marca en la piel oscura (5,71:1 vs 3,61:1 — el acento del repo se apaga justo en el tema de las capturas) y ya está propagado en todo el sistema visual. Pero es una decisión de Martin y David, no una falla que corregir. ⚠️ Además: la tabla de contraste del doc de rebrand del repo (`2026-08-03`) todavía usa la **regla vieja** ("negro sobre terracota ✅ / blanco ❌"), derogada el 28/07 v2. Ese documento hay que sincronizarlo antes de cualquier discusión, o se decide sobre datos viejos.

### 4.2 · Estructura: qué capa va adelante

Es la de §5.

---

## 5 · Sheet o portada: la pregunta de fondo

No es "David vs. lo decidido". Las dos propuestas quieren lo mismo —**que hablarle a Odobi no cueste navegación**— y cada una acierta en una mitad:

| | Build de David | Decisión A (3 tabs, 26/07) |
|---|---|---|
| Chat siempre a mano | ✅ ya está adelante | ⚠️ un tap, pero cambia de pantalla |
| Qué ves al abrir | ✗ un chat vacío que pregunta | ✅ lo que el negocio necesita hoy |
| Saber dónde estás | ✗ sin indicador | ✅ tab activa |
| Funciones | ✗ 9 con scroll horizontal | ✅ grilla completa en Apps |

**Síntesis propuesta:**

- **Adelante: Mi día.** Lo proactivo primero — el copiloto habla, después escucha.
- **El chat, a un gesto y a un tap:** el input+mic anclado abajo **es** el borde visible del panel. Arrastrarlo o tocarlo lo expande. El mecanismo ya existe (`PanelDeslizable` + toggle por tap); cambia qué capa va al frente y que el peek muestre el composer en vez de una tira de texto.
- **Funciones = destino**, con la grilla entera visible.
- **Cuenta/Ajustes en el avatar del header**, con punto de estado, ≥48 dp.

Esto conserva lo mejor del build de David (la conversación como capa, no como destino) y recupera lo que hoy falta (la portada proactiva y la orientación). El costo de implementación es bajo: **es la misma máquina, invertida**.

---

## 6 · Qué sigue

1. Acordar §5 (qué capa adelante) y §4.1 (un solo acento). Son las dos decisiones que ordenan el resto.
2. **Auditar el nivel terciario y todo `opacity` sobre texto** — es mecánico y arregla 7 de las 9 fallas de contraste.
3. Cerrar el hito de aplanado (retirar glass) **subiendo la separación superficie/fondo**, hoy 1,06:1.
4. Grilla sin scroll horizontal + labels que no se parten + engranaje a 48 dp.
5. Reemplazar los semánticos heredados de DocuMed por el par de Odobi, con signo además de color.
6. Sincronizar el doc de rebrand del repo con la regla de contraste v2 (28/07).

---

## 7 · Las dos vías (voz y pantalla): por qué van las dos, y cómo ordenarlas

> Sección agregada el 15/08 a partir de la pregunta de Martin: *"si la pantalla principal es la de voz y me lista las funciones, ¿para qué existe la pantalla de abajo con las mismas funciones?"*. La respuesta obligó a corregir un error mío y produjo el rediseño concreto de la grilla.

### 7.1 · Corrección: la card, no la pantalla, es donde se corrige

En §2 afirmé que la pantalla era la vía de corrección de un dictado mal transcripto. **Es falso.** `DetalleGasto.tsx:28`, literal:

> *"**Sin editar ni borrar, y es decisión escrita del contrato (§12), no un olvido.** Un gasto se corrige **antes** de guardarlo, en la card editable de la voz. No hay `PATCH` ni `DELETE` en Fase 1."*

Lo único mutable después de guardar son tres cosas puntuales: la imputación de un gasto (`PUT /gastos/{id}/imputacion`), el estado de un presupuesto y un concepto del catálogo. Monto, fecha y detalle, no.

**Lo que ese dato sí demuestra, y es más importante:**

- **La card es el único control de calidad del dato de todo el producto.** Es la pantalla más crítica que existe en la app y merece más diseño que ninguna otra.
- Todo lo que se construye encima —margen, Mi día, Inteligencia— hereda ese dato sin salida. Es deuda declarada de Fase 1, pero conviene tenerla a la vista: **un dato mal guardado hoy no tiene reparación por ninguna vía.**

### 7.2 · Entonces, ¿para qué existen las pantallas de función?

El argumento se sostiene, pero es otro. Cuatro roles que la voz no puede cubrir:

| Rol | Por qué la voz no llega |
|---|---|
| **Escaneo visual** (listas, buscador, "Me deben", resumen del mes) | La voz es **serial y efímera**: para saber si la factura 37 está impaga hay que oír las 37. Los ojos lo resuelven en dos segundos. Es la diferencia entre lenguaje y manipulación directa. |
| **Alta manual con todos los campos** | Lo dice el propio `FormularioGasto`: *"repetir un dictado es más tedioso que haber tipeado"*. A partir del segundo intento fallido, tipear gana. |
| **Detalle de un objeto** (comprobante, CAE, PDF) | No hay forma de escuchar un comprobante. |
| **Configuración** (AFIP, perfil del negocio, plan) | Cobertura cero: ninguna de las 15 herramientas del chat configura nada. |

Y hay un principio detrás: **el costo de dictar crece con la cantidad de campos interdependientes.** "Gasté 15 lucas en nafta" es una frase; una factura son cliente + CUIT + condición de IVA + ítems + precios + tipo de venta. El propio glosario ya lo reconoce al definir la **card** como *"el formulario real precargado… nunca un sí/no ciego, porque un error de transcripción sólo se corrige editando"*: **el sistema ya admite que el formulario es imprescindible — la card es el formulario metido adentro del chat.**

**Conclusión para David: las dos vías van, y su decisión de fondo es correcta.** Lo que no funciona es cómo están presentadas.

### 7.3 · Mi Día tal como está implementado (`PantallaMiDia.tsx` + `mi_dia_detector.py`)

- **3 solapas: Para hoy · Haciendo · Hechas.** Reemplazó a un Kanban de 4 columnas el 23/07: *"el pipeline de facturación NO es Mi Día — son conceptos distintos que compartían por error la misma URL"*.
- **Lista vertical, nunca columnas ni drag libre** (el arrastre lateral competía con el Pan del panel).
- **Tap expande**: colapsada, el texto ya redactado en 2 líneas; expandida, el dato crudo (cliente/monto/fecha).
- **Swipe corto** revela "Empezar"/"Terminé"/"Borrar"; tras mutar **relee el tablero entero** — la tarjeta se va porque el backend confirmó, no porque la UI lo asumió.
- **Panel de calendario** aparte, independiente del tablero.
- **8 reglas** (el dato que teníamos, de 6, estaba viejo): presupuestos enfriándose · facturas impagas viejas · trabajo con margen negativo · trabajo con gastos y sin ingreso · gasto del mes alto · CAE por vencer · **certificado AFIP por vencer**.
- **4 de las 8 se cierran solas por el HECHO, no por el gesto**, con un razonamiento de primer nivel: *"una tarjeta de certificado por vencer cerrada a mano sin haber renovado nada dejaría al emprendedor creyendo que lo resolvió"*.

**Comparado con nuestro mockup 09:** el de David es **más rico** (solapas, calendario, swipe, auto-cierre) y le falta una sola cosa: la portada Entró/Salió/Te queda, que hoy vive en Inteligencia. **No compiten: son las dos mitades de la misma pantalla.**

### 7.4 · El estado vacío del chat: ejemplos que giran, no un párrafo

**El problema no es el largo del texto: es que es una constante estática** (`ListaMensajes.tsx:29`) — el mismo el día 1 y el día 300. Y mezcla dos taxonomías (Apps y Funciones) en la misma frase.

**Diseño acordado (decisión de Martin, 15/08):**

1. **Un ejemplo por vez, rotando** — no chips tocables. *Fundamento de la decisión: un atajo tocable compite con el gesto que la app quiere enseñar (hablar). El ejemplo rotativo hace además un trabajo que el tocable no hace: muestra la **variedad** de lo que se le puede decir, en vez de ofrecer una acción puntual.* Se escriben **como los diría el usuario**, no como los nombra el sistema:
   > *"Gasté 15 lucas en nafta"* · *"¿Cuánto facturé este mes?"* · *"Cobrale $80.000 a Rodríguez"*
   
   Enseñan el registro del habla por imitación: leer "podés registrar gastos" no le dice a nadie que puede decir *"15 lucas"*; ver la frase, sí.

2. **Los ejemplos salen del detector, no de una lista fija.** Las mismas 8 reglas que alimentan Mi día saben qué le falta a ese negocio: sin gastos cargados → *"Cargá tu primer gasto"*; presupuesto frío → *"Preguntale a Lucía si lo va a tomar"*. **Cero infraestructura nueva.**

3. **El andamio se retira solo.** Después de N interacciones exitosas queda **solo el título**. Un andamio que no se retira deja de ser ayuda: se vuelve ruido permanente y ocupa el lugar de la conversación real.

4. **La línea del contrato no se apaga nunca:** *"Antes de ejecutar algo importante, te lo muestro para que lo confirmes."* No es relleno — es la promesa central del producto.

**Jerarquía visual propuesta** (tres niveles, no tres párrafos del mismo peso):

```
              ( ( o ) )              ← monograma, sec, 40px

         ¿En qué te ayudo?           ← DISPLAY 24 Bold, texto principal
                                        (jerarquía 1: la pregunta)

    ┌ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┐
      "Gasté 15 lucas en nafta"      ← Inter 16 · cursiva o comillas
    └ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┘        (jerarquía 2: el ejemplo que gira)
              ● ○ ○                  ← 3 puntos, indican que hay más

  Antes de ejecutar algo importante,  ← Inter 13 · sec · centrado
   te lo muestro para que confirmes      (jerarquía 3: el contrato, fijo)
```

- **Lo que gira está entrecomillado y en un registro distinto** (cursiva o comillas): marca que es *habla de ejemplo*, no una instrucción de la app. Sin esa marca, "Gasté 15 lucas en nafta" se puede leer como un dato ya cargado.
- **Los 3 puntos** hacen dos trabajos: avisan que hay más ejemplos (si no, el usuario cree que el único caso de uso es el que está viendo) y dan el control de pausa que exige el punto siguiente.
- **El contrato baja de peso pero no de contraste**: `sec` a 13px sigue arriba de 4,5:1. Es información permanente, no decorativa.

⚠️ **Salvaguarda obligatoria — WCAG 2.2.2 (*Pause, Stop, Hide*, nivel A).** Todo contenido que se mueve o cambia automáticamente, dura más de 5 segundos y convive con otro contenido, necesita un mecanismo para pausarlo o detenerlo. La rotación lo dispara. Se cumple sin agregar UI:

- **~4 s por ejemplo** (menos, y no se alcanza a leer una frase de 6 palabras; más, y se siente estancado).
- **Se detiene al tocar el input o al empezar a grabar** — que es justo cuando el usuario ya no lo necesita.
- **Se detiene sola después de un ciclo completo** y queda en el último ejemplo. Así el movimiento tiene principio y fin: nunca es un loop infinito.
- **`prefers-reduced-motion`: sin rotación** — un ejemplo fijo, o los tres apilados en una línea.
- La transición es **fade + desplazamiento corto (8-12 px)**, nunca un carrusel deslizante: el movimiento lateral sugiere que se puede swipear, y ahí volveríamos a competir con los gestos del panel.

*Nota de copy:* si se prefiere la variante con "hoy" (*"¿En qué te ayudo hoy?"*), gana un ancla temporal que rima con Mi día — pero conviene elegir una sola forma y no alternarlas.

### 7.5 · La grilla: dos bandas, no nueve destinos planos

**El criterio de orden no puede ser la categoría contable, sino frecuencia × urgencia:**

| Función | Frecuencia real | Nota |
|---|---|---|
| Gastos | varias veces por día | Lo que más se olvida — y **sin gastos el margen miente** |
| Ingresos | diario | |
| Facturación | semanal | Baja frecuencia, **máxima consecuencia**: irreversible y fiscal |
| Presupuestos | semanal | |
| Inteligencia | semanal/mensual | Revisión, no operación |
| Contabilidad | mensual | O cuando lo pide el contador |
| Clientes | casi nunca solo | *La cartera se **deriva** de lo que emitiste* (`CONTEXT.md`): se entra desde un comprobante |
| Ajustes | rarísimo | **Fuera de la grilla** → engranaje del header |
| Mi día | primera cosa del día | **Portada** |

```
┌────────────────────────────────────────┐
│  REGISTRAR                             │  ← lo diario
│  ┌────┐ ┌────┐ ┌────┐ ┌────┐           │
│  │Gas-│ │Ingr│ │Fac-│ │Pre-│           │
│  │tos │ │esos│ │tura│ │sup.│           │
│  └────┘ └────┘ └────┘ └────┘           │
│                                        │
│  MIRAR                                 │  ← lo periódico
│  ┌────┐ ┌────┐ ┌────┐                  │
│  │Inte│ │Con-│ │Cli-│                  │
│  │lig.│ │tab.│ │ent.│                  │
│  └────┘ └────┘ └────┘                  │
└────────────────────────────────────────┘
```

**Por qué agrupar y no sólo reordenar.** Hick-Hyman castiga los conjuntos **equiprobables**: nueve tiles iguales son una decisión entre nueve; dos bandas rotuladas son una decisión entre dos y después entre tres o cuatro — mucho más barata. Y la agrupación por **tarea** (registrar / mirar) coincide con la pregunta que el usuario realmente se hace, que nunca es "¿qué módulo?" sino "¿vengo a cargar algo o a ver cómo voy?".

Visualmente alcanza con proximidad + un eyebrow chico (ley de proximidad de Gestalt): no hacen falta títulos grandes. **7 tiles en dos filas, sin scroll horizontal, sin labels truncados.**

*Opción más ambiciosa, no incluida en esta propuesta:* que la banda "Registrar" muestre el dato adentro ("Gastos · $124.500 este mes"). Convierte el escritorio en tablero y elimina la pregunta "¿para qué entro acá?"; el backend ya tiene los números (`obtenerResumenGastos`, query `portada`).

### 7.6 · La regla de vocabulario: verbos abajo, sustantivos atrás

La intención de David —hablarle al usuario nuevo en **acciones**— es correcta. El problema es que las dos taxonomías se pisan sin regla. Propuesta:

> **Verbo = lo que Odobi hace por vos (la conversación). Sustantivo = dónde está tu información (el escritorio).**

- El chat sigue hablando en acciones ("Cobrar con MercadoPago", "Mandar un mail"), y **ahí sí pueden convivir Apps y Funciones**: al usuario no le importa de qué lado del sistema viene la capacidad. Se conserva tal cual.
- El escritorio habla en sustantivos: Gastos, Facturación, Clientes. Son **lugares**.
- **"Apps" sale de la grilla.** Gmail o Drive no se "usan" dentro de Odobi: se **conectan una vez**. Van a Ajustes/Conexiones con consentimiento just-in-time, patrón que el repo ya aplica en otros lados.
- **Unificar el nombre**: mobile dice "Apps", web dice "Conexiones" (divergencia que `CONTEXT.md` ya registra). Nuestro mockup 01 usa **"Tus servicios"**, el más claro de los tres.

Resultado: la diferencia deja de ser confusión y pasa a ser señal — **si lo decís, es verbo; si lo mirás, es sustantivo.**

### 7.7 · Que la interfaz diga el rol de cada capa

1. **Que el peek muestre contenido real, no un cartel.** Hoy el borde entre capas es una tira con "DESLIZÁ PARA VER FUNCIONES" a 2,90:1. Si en su lugar asoma **un pedazo de la primera tarjeta o del primer tile**, la oclusión parcial comunica "hay más acá abajo" mejor que cualquier instrucción, no depende de que alguien lea, y **elimina de paso la falla de contraste**.
2. **Instrucción just-in-time, no tutorial.** En el formulario de Gastos, un hint junto al primer campo: *"También podés decírmelo"* con el mic al lado. Y a la inversa, el receipt del chat lleva *"Ver en Gastos"*. El usuario descubre la otra vía **en el momento en que le sirve**.
3. **Nombrar la card una vez:** *"Esto es lo que entendí. Corregí lo que haga falta antes de guardar."* Es la pantalla más crítica del producto (§7.1) y hoy no se presenta.
4. **Voz contextual dentro de cada función:** dictar el gasto **estando en Gastos**. Convierte dos apps pegadas en una sola con dos modos de entrada.

### 7.8 · Orden de ejecución y costo

| Paso | Costo | Qué desbloquea |
|---|---|---|
| 1 · Mi día a la portada | mover una capa | Resuelve §5 y libera un slot |
| 2 · Ajustes al engranaje | mover un tile | Libera otro slot; el engranaje ya existe |
| 3 · Grilla en 2 bandas (7 tiles) | rehacer un componente | Mata el scroll horizontal y el truncamiento |
| 4 · Estado vacío con ejemplos que giran | componente nuevo, chico | Resuelve el descubrimiento del día 1 |
| 5 · Voz contextual por función | trabajo real, varias pantallas | Une las dos vías |

**1 y 2 son gratis y resuelven la mitad de los críticos.** No dependen de la decisión del acento (§4.1), así que pueden arrancar antes de esa conversación.

---

## 8 · La escucha: existe, está bien resuelta, y su decisión de fondo es la contraria a la nuestra

> Agregado el 16/08 al buscar en el repo si la pantalla de escucha estaba implementada. Está — y el hallazgo es que **el modelo es el opuesto al que dibujamos**. Conviene llevarlo decidido a la reunión, no descubrirlo ahí.

### 8.1 · Qué hay construido

| Pieza | Qué hace |
|---|---|
| `useVozComando.ts` | Máquina de 4 fases: `inactivo` · `grabando` · `pausado` · `listo`. Expone `capturaViva()` — *"¿hay micrófono realmente abierto ahora?"* (solo `grabando` lo está), para que nada interrumpa una captura sin que el usuario se entere |
| `BotonVoz.tsx` | El botón usa **el isotipo de Odobi**, no un ícono de micrófono. Y trae **gesto de fijar deslizando hacia arriba**, umbral 80 px: *"un temblor sosteniendo el teléfono no fija por accidente, pero un deslizamiento franco sí"* |
| `ControlesFlotantes.tsx` | Pausar / Reanudar · Enviar · Eliminar |
| `Onda.tsx` | Dibuja el **nivel real del micrófono** (~10 fps) |

Es trabajo fino, con los mismos fundamentos medidos que el resto del shell.

### 8.2 · La divergencia

**El componente que hacía la escucha a pantalla completa —`GlassGrabacionCopiloto`— fue eliminado.** Lo reemplazó `ControlesFlotantes`, citando un contrato llamado literalmente `dictado-por-voz-sin-glass`:

> *"controles de la grabación fijada … **flotantes, sin glass** … SIN el `MarcoGlass`/`HudGrabacion` que los envolvía, y **SIN cronómetro** (el contrato lo saca explícitamente: **el único feedback es la onda**)."*

La pantalla completa que sí sobrevive (`HudGrabacion.tsx`, con marco y cronómetro) es la de **DocuMed**, la app clínica hermana, y el propio archivo explica por qué la diferencia es correcta: *"perder 40 minutos de consulta es perder algo irrepetible"* frente a *"un comando de voz que se pierde se repite"*.

**Del lado nuestro**, la escucha terracota a pantalla completa es **el único momento display declarado de todo el sistema** — sale del veredicto del experimento Wise A/B y es lo que justifica la excepción a la proporción 60/30/10.

Los dos razonamientos son buenos y apuntan a cosas distintas: **él optimiza la tarea** (no tapar lo que estabas mirando por un dictado de seis segundos), **nosotros la marca** (el único instante donde Odobi se muestra entero).

### 8.3 · Propuesta: display por sustracción, no por saturación

**La escucha no tapa: silencia.** Sobre el contenido se baja un velo del color de la piel activa, el resto de la UI se apaga, y quedan la onda a gran escala, el monograma y el botón de cortar. El contexto sigue ahí —se adivina detrás— pero nada compite con la voz.

Gana las dos cosas: es un momento distinto de todos los demás (lo que pedía el veredicto Wise) y no te saca de donde estabas (lo que pedía el contrato de David).

| Parámetro | Valor | Fundamento |
|---|---|---|
| **Velo** | El color del **lienzo de la piel activa** al **96%**: crema `#F7F3EC` en claro, negro tostado `#1A1512` en oscuro | El velo toma el color del tema, así que **no hay isla oscura sobre lienzo claro** — la regla del 08/08 queda respetada sin pedir excepción |
| **Opacidad 96%, no 90%** | Calculado en el **peor caso** (el contenido de máximo contraste justo detrás) | A 94% la terracota profunda da 4,37:1 ✗. A **96% da 4,53:1** ✅ en claro y **5,21:1** en oscuro. Ese 4% que queda es lo que hace que se **insinúe** el contenido: se ve que hay algo detrás, no se lee |
| **Sin desenfoque** | Velo plano, nada de blur | **Su propia medición:** el `BlurView` *nunca desenfocó en Android* (`CristalVidrio.tsx:8`, citado en el DoD del 05/08). Pedir blur sería pedir un no-op caro |
| **La onda** | Terracota, a gran escala, centrada | Es el único feedback que el contrato de David considera necesario — y tiene razón: es lo único que confirma que el micrófono oye. Como gráfico le alcanza 3:1 (WCAG 1.4.11); acá sobra |
| **Botón de cortar** | Fill `#DE7250` + label **display 20 Bold blanco** | Regla 28/07 v2. Blanco sobre `#DE7250` = 3,17:1 ≥ 3:1 (AA texto grande) ✅ |
| **Los controles** | Se conservan los de David: Pausar/Reanudar · Enviar · Eliminar | No se reinventa lo que ya está resuelto y probado en device |

**Lo que se cede de cada lado:** nosotros dejamos la terracota plena a pantalla completa (el momento display pasa a construirse **apagando** lo demás en vez de **inundar** de color); David deja el "sin superficie" estricto, a cambio de no perder el contexto igual.

⚠️ **Pendiente de dibujo:** el lane 3 del mockup `03-home-conversacional` todavía muestra la escucha a pantalla completa terracota. Hay que rehacerlo con este modelo — y con él, revisar si el veredicto del Wise A/B (Tarea 1) queda modificado en su punto de "único momento display".

---

## Fuentes citadas

- **WCAG 2.2**: SC 1.4.1 (Use of Color) · 1.4.3 (Contrast Minimum, AA) · 1.4.11 (Non-text Contrast) · **2.2.2 (Pause, Stop, Hide)** · 2.5.1 (Pointer Gestures) · 2.5.8 (Target Size).
- **Nielsen**: #1 visibilidad del estado del sistema · #2 correspondencia con el mundo real · #6 reconocer antes que recordar.
- **Gestalt**: ley de proximidad (agrupar sin cajas ni títulos grandes).
- **Norman**: gulf of execution · affordances y signifiers.
- **Hick-Hyman**: el tiempo de decisión crece con el número de opciones equiprobables.
- **Material Design 3**: bottom sheets (standard vs modal), target 48 dp. **Apple HIG**: target 44 pt.
- **Hoober, *Design for Fingers, Touch and People***: zonas de alcance del pulgar.
- **Del propio repo**: `CONTEXT.md` (glosario) · `docs/copiloto-emprendedor/2026-08-05-DoD-sprint-odobi.md` · `2026-08-03-odobi-rebrand-marca-y-skin-estado.md` · `apps/mobile/src/theme/tokens.ts` · `src/shell/PanelDeslizable.tsx` · `src/shell/PantallaPrincipal.tsx` · `src/modules/escritorio/EscritorioFunciones.tsx` · `src/modules/inteligencia/PantallaInteligencia.tsx` · `src/modules/gastos/DetalleGasto.tsx` · `src/modules/midia/PantallaMiDia.tsx` · `apps/copiloto/mi_dia_detector.py` · `apps/copiloto/tool_catalog.py` · **§8:** `src/modules/chat/useVozComando.ts` · `chat/ControlesFlotantes.tsx` · `chat/BotonVoz.tsx` · `modules/captura/HudGrabacion.tsx` · `theme/glass/CristalVidrio.tsx`.
- Reglas internas: `odobi-ui/CLAUDE.md` (paleta, Decisiones A/B/C, regla de contraste 28/07 v2, regla del 08/08 sobre terracota en tema oscuro) · veredicto del experimento Wise A/B (Tarea 1) para el "único momento display".
