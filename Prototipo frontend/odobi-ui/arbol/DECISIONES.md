# DECISIONES — Árbol de producto

Pieza: `index.html`. Creado 07/08/2026 para la reunión con David. Es el **mapa navegable de las 9 pantallas madre y sus 27 estados**, en orden narrativo, con el fundamento de cada una y las flechas de navegación real.

## 1 · Qué es y qué no es

| Elemento | Decisión | Fundamento | Alternativa descartada y por qué |
|---|---|---|---|
| Formato | **Una sola página navegable**, no un deck ni un prototipo clickeable | Se proyecta y se recorre en vivo, y cada tarjeta es una puerta al mockup completo con sus anotaciones. El deck obliga a un orden fijo; el prototipo puro esconde las justificaciones, que son la mitad del trabajo | Deck de PNG: no deja entrar al detalle sin cambiar de archivo. Prototipo clickeable solo: se pierde el «por qué», que es lo que se va a discutir |
| Miniaturas | **Frames de teléfono limpios** (`deck-assets/frames/`, 780×1688), sin la capa de anotación | En el árbol la pantalla tiene que leerse como producto. La anotación aparece recién al abrir el mockup, que es donde se argumenta | Usar los PNG del deck como miniatura: son 2560×1440 apaisados con anotaciones — dentro de una tarjeta vertical quedan ilegibles |
| Los 4 esquemas del `00-mapa` | Van con la **lámina del deck**, en tarjeta apaisada | No son pantallas: son esquemas de decisión. Forzarlos a un marco de teléfono mentiría sobre lo que son | — |
| Orden | **6 bloques**: el sistema → la entrada → el día a día → *el puente* → ejecutar → lo que lo sostiene | Va de «qué es» a «qué lo sostiene». El bloque 0 primero porque sin las 3 decisiones las pantallas parecen elecciones de gusto | Orden por número de mockup: es el orden en que se hicieron, no el orden en que se entienden |
| El puente, aparte | **Banda propia sobre negro**, con los 4 pasos numerados | Es lo único del sistema que **no se entiende explicándolo**: hay que recorrerlo. Sacarlo de la grilla lo marca como demo, no como inventario | Dejarlo como una fila más: se pierde entre 27 pantallas justo lo que hay que mostrar en vivo |
| Anclas | Cada `canvas-wrap` de los 9 mockups lleva `id="laneN"` | Permite que una tarjeta abra el mockup **en el lane exacto**, no arriba de todo | Linkear al archivo y que el otro scrollee: en una reunión se pierde el hilo |

## 2 · Qué se tocó de los mockups

- **Tipografía: NeueEinstellung → Plus Jakarta Sans Bold** en los 9 (`@font-face` + 24 paths del monograma + los 2 arcos recentrados). Ver `../explorations/tipografia-libre/DECISIONES.md`.
- **Anclas `id="laneN"`** en los 27 lanes.
- Nada más: ni copy, ni layout, ni cifras.

## 3 · Los dos scripts

`deck-assets/regenerar.py` (27 láminas anotadas 2560×1440) y `deck-assets/frames.py` (23 frames limpios). Reemplazan la receta a mano que estaba en `INDICE.md`.

**Tres trampas, las tres aprendidas rompiendo cosas el 07/08:**

1. **No elegir el lane con `:nth-of-type(N)`.** Cuenta entre hermanos del mismo tag y `<body>` abre con un `div.page-head` antes de los wraps: el índice se corre uno y el lane 1 no matchea nada. Se marca el wrap por posición en el string.
2. **No dar por bueno un PNG porque el archivo existe.** Chrome lo escribe igual aunque la página renderice vacía. Así se sobreescribieron los 27 PNG del deck con láminas en blanco y el script reportó `OK` en las 27. Ahora hay un gate por peso (una lámina plana pesa ~19 KB; una real, 180–350 KB).
3. **No buscar `class="phone"` como cadena exacta.** Hay frames con clase compuesta (`class="phone splash"`, `class="phone listen"`) y quedaban sin miniatura **en silencio** — justo el splash y la escucha, dos de las pantallas más importantes.

## 4 · El puente recorrible (16/08) — resuelto

Era el pendiente declarado acá: *"el árbol muestra el prototipo, no el prototipado"*. Ahora el puente **se recorre**.

| Elemento | Decisión | Fundamento | Alternativa descartada |
|---|---|---|---|
| Formato | **Visor sobre la misma página**, no navegación a otra pestaña | El puente es lo único que no se entiende explicándolo: hay que recorrerlo **sin perder el hilo de la reunión**. Cada tarjeta abría el mockup en otra pestaña y había que volver | Un prototipo clickeable aparte: otra pieza que mantener, y saca a todos del árbol |
| Entrada | Un CTA («▶ Recorrer el puente paso a paso») **y** cada tarjeta entra en su propio paso | El que quiere el recorrido completo arranca del principio; el que pregunta por un paso puntual entra ahí | Sólo el CTA: obliga a avanzar hasta el paso del que se está hablando |
| Navegación | ← → , teclado, contador `n / 4`, Esc para salir, clic afuera cierra | Se maneja de memoria mientras se habla: en una demo no se puede estar buscando el botón | Sólo botones: obliga a mirar la pantalla en vez de a la audiencia |
| «Abrir el mockup completo →» | Dentro del visor, en cada paso | Las anclas `#laneN` siguen siendo la puerta al detalle con anotaciones. El visor no las reemplaza: las ordena | — |
| Texto de cada paso | Descripción + una línea **«MIRÁ:»** | Dice *dónde poner el ojo*, que es lo que uno diría en voz alta al mostrarlo. Sin eso, la pantalla grande no señala nada | Sólo el título: la pantalla se mira entera y se pierde el punto |
| Fill del CTA | `#B04A2E`, no `#DE7250` | El label va en 15 px (texto normal): blanco sobre la terracota viva da 3,17:1 — alcanza para texto grande, no para este tamaño. Sobre `#B04A2E` da **5,43:1** ✅ (regla 28/07 v2) | — |

**Los frames se regeneraron primero** (`frames.py`): 03, 04 y 09 habían cambiado al migrar al modelo de capas, y el puente los mostraba con tabbar. **Se migró también el 04** al verlo: era el paso 3 del recorrido y la demo enseñaba dos sistemas distintos en cuatro pantallas.

## 5 · El artefacto autocontenido volvió a ser regenerable (16/08)

`construir-artifact.py` leía sus tres insumos (`notas.json`, frames reducidos y los esquemas del mapa) de un **scratchpad de sesión**. Esa carpeta muere con la sesión: el artefacto quedó **no regenerable**, y la única copia existente ya estaba desactualizada — mostraba una tabbar que los mockups ya no tienen.

Ahora los insumos se generan con **`deck-assets/preparar-artifact.py`** y viven en `deck-assets/_artifact/`, dentro del repo. El generador extrae las anotaciones **de los propios mockups** (recorriendo el HTML por posición, nunca con `nth-of-type`), reduce los frames y renderiza los esquemas del 00-mapa con gate por peso.

```bash
python3 deck-assets/frames.py             # 1 · frames limpios, si cambiaron los mockups
python3 deck-assets/preparar-artifact.py  # 2 · insumos (notas + reducidos + mapa)
python3 deck-assets/construir-artifact.py # 3 · arbol/arbol-web.html
```

**Lección:** un artefacto cuyo generador depende de una carpeta temporal no es un artefacto regenerable, es una copia con suerte.

## 5 · Auditoría de contraste (08/08/2026)

Martin preguntó si no había una regla contra usar terracota sobre negro tostado. **No la hay — es al revés:** `CLAUDE.md` lista *terracota sobre negro tostado 5,71:1 ✅* como par válido, y el wordmark en terracota está explícitamente permitido por la Decisión B. Lo prohibido es **negro sobre terracota** (regla 28/07 v2) y **terracota como texto sobre crema/blanco** (2,86:1 → `#B04A2E`).

Pero la pregunta destapó **4 fallas reales** que la inspección a ojo no había visto. Se auditaron los 22 pares de la página con la fórmula WCAG:

| Elemento | Estaba | Ratio | Ahora | Por qué |
|---|---|---|---|---|
| Número de paso del puente | blanco 12px s/`#DE7250` | **3,17:1** ✗ | fill `#B04A2E` → 5,43:1 ✅ | Texto chico sobre terracota. Es exactamente el caso que la regla v2 cubre: *"si un botón necesitara texto chico, el fill baja a `#B04A2E`"* |
| Glifos de la leyenda | terracota s/negro | 5,71:1 (pasaba) | arena | No es contraste sino **Decisión B**: son decorativos, no tocables. Terracota es promesa de que algo pasa al tocar |
| Número de bloque | arena s/fondo | **1,85:1** ✗ | `sec` → 6,49:1 ✅ | Arena es color de apoyo **sobre oscuro** (8,46:1); sobre fondo claro no llega ni al 3:1 de texto grande |
| Referencia de tarjeta | lápiz 11px s/fondo | **3,39:1** ✗ | `sec` → 6,49:1 ✅ | A 11px hace falta 4,5:1. La etiqueta se distingue por caja alta + tracking, no por ser más clara |
| Fondo de página | `#E9E6E0` | link 4,36:1 ✗ | **`#F2EEE7`** → 4,70:1 ✅ | Causa de fondo: los ratios de la paleta están calculados contra crema y blanco, y yo había usado el backdrop `#E9E6E0` de los mockups. `#F2EEE7` es el fondo de las láminas del deck: pasa y mantiene la meta-capa distinta del lienzo de la app |

**Lección de método:** el criterio de aprobación dice «¿todos los pares pasan WCAG AA **calculado**?». Yo había mirado los pares llamativos (terracota sobre oscuro) y me había salteado los aburridos (gris sobre gris claro), que eran los que fallaban. La auditoría ahora está scriptada en el historial de esta sesión: 22 pares, 0 fallas.
