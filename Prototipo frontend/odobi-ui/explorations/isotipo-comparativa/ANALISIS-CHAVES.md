# Los dos isotipos evaluados contra Chaves & Belluccia

Preparado 07/08/2026 para la reunión con David. Pieza visual: `comparativa.png` (2560×1440) · `index.html` regenerable.

**A** = propuesta de David (`docs/Imagen de marca/isotipo-odobi/` del repo): 4 arcos, todo trazo, sin glifo.
**B** = «la o que habla» (decisión Martin 29/07): el glifo real de la O + 2 arcos afuera.

---

## 0 · Advertencia de método (importante para no perder la discusión)

Los 14 parámetros de *La marca corporativa* **no son un puntaje absoluto**. Chaves y Belluccia son explícitos: el rendimiento se mide **contra los condicionantes del caso** — el mismo signo puede ser excelente para una entidad y pésimo para otra. Una tabla de tildes no gana una discusión de diseño; lo que la gana es demostrar que un parámetro **falla contra un requisito que el propio brief fijó**.

Por eso este análisis se apoya en tres hechos verificables, no en preferencias. Si en la reunión la charla se vuelve «a mí me gusta más», perdimos el marco.

---

## 1 · Los tres hechos que no son opinión

### 1.1 · El trazo de A cae a 0,87 px justo en el tamaño que el brief declaró condición de aprobación

A está dibujado con `stroke-width: 1.3` sobre `viewBox="0 0 24 24"`. El trazo **escala con el símbolo**:

```
16 px de render → 1,3 × (16/24) = 0,87 px
```

Los cuatro trazos quedan **por debajo del píxel** y su peso pasa a depender del antialias del dispositivo. El brief dice, textual: *«anillos con grosor suficiente para sobrevivir a 16px — la prueba de escala en favicon es condición de aprobación»* (§3). Es la propia vara que el brief puso.

B no tiene el problema porque **está especificado en píxeles finales**: 1,6 y 1,1 px *a 16px*, y el cuerpo del signo es la O **rellena**. Un relleno no adelgaza al bajar de escala; un trazo sí. Mirá la columna de 16px en `comparativa.png`: A es una mancha gris, B todavía se lee.

### 1.2 · La documentación de A admite que el símbolo no sobrevive, y lo resuelve con OTRO símbolo

De `resguardo-y-minimo.md`, textual:

> *«Por debajo de 16px […] el símbolo puede perder el arco más interno por aliasing — por eso el favicon usa la **variante 10** ("geométrica", círculo + 2 ondas, trazos más separados), **no el símbolo de 4 arcos**»*

Esto es lo más grave del expediente, y no lo decimos nosotros: lo dice la documentación de A. Una marca que **necesita ser reemplazada por otra marca** en el tamaño más frecuente de todos (favicon, ícono de app, avatar) no es un sistema — son dos signos. Rompe cuatro parámetros a la vez: **suficiencia**, **versatilidad**, **declinabilidad** y **legibilidad**.

Y hay un problema de entrega encima: **la «variante 10» no está en el repo.** El único lugar donde aparece esa cadena es ese párrafo. El sistema se declara incompleto y además falta la pieza que lo completaría.

### 1.3 · «4 arcos concéntricos» no son concéntricos

La documentación de A los describe así. Calculando los centros desde los propios paths:

| Arco | Path | Centro |
|---|---|---|
| 1 | `M11 3.5 a8.5 8.5 0 1 0 0 17` | (11, 12) |
| 2 | `M11 7.5 a4.5 4.5 0 1 0 0 9` | (11, 12) |
| 3 | `M16.5 8.8 a4.8 4.8 0 0 1 0 6.4` | (**12,92**, 12) |
| 4 | `M19.5 6.5 a9 9 0 0 1 0 11` | (**12,38**, 12) |

Tres centros distintos. No es fatal en sí —se puede defender como ajuste óptico— pero **no está declarado como ajuste óptico: está declarado como concentricidad**. Es un problema de *calidad gráfica genérica* (parámetro 1): la pieza no hace lo que su propia memoria dice que hace.

**Nota de rigor:** el doc justifica los 16px citando `coordinacion/cerrado/2026-08-05/…legibilidad-16px.png`. **Esa carpeta no existe en el repo entregado.** No digo que la prueba no se haya hecho — digo que no se puede verificar con lo que hay, y que la conclusión que sostiene está contradicha por la aritmética del punto 1.1.

---

## 2 · Evaluación contra los 14 parámetros

| # | Parámetro | A · David | B · nuestra |
|---|---|---|---|
| 1 | Calidad gráfica genérica | ⚠️ concentricidad declarada que no se cumple | ✅ geometría verificada, centro óptico medido |
| 2 | Ajuste tipológico | ✅ símbolo abstracto, como pide el brief | ⚠️ **es un monograma, no un símbolo abstracto** — ver §4 |
| 3 | Corrección estilística | ✅ line-art sobrio, coherente con Iconoir | ✅ ídem, y comparte trazo con la ilustración |
| 4 | Compatibilidad semántica | ❌ dice «voz», no dice «Odobi». El signo no contiene una O: contiene una **C** | ✅ dice las dos cosas: es la inicial + las ondas |
| 5 | Suficiencia | ❌ necesita un segundo símbolo para tamaños chicos | ✅ un solo signo en todas las escalas |
| 6 | Versatilidad | ❌ no cubre el rango declarado sin cambiar de signo | ✅ de 16 px al splash |
| 7 | Vigencia | ✅ geometría neutra, envejece poco | ✅ el glifo es tipográfico, no una moda gráfica |
| 8 | Reproducibilidad | ⚠️ una tinta ✅, pero a trazo fino sufre en sello/bordado | ✅ masa + trazo aguanta mejor una tinta |
| 9 | Legibilidad | ❌ 0,87 px a 16 px | ✅ 1,6/1,1 px reales + masa |
| 10 | Inteligibilidad | ⚠️ el ritmo no cierra por los 3 centros | ✅ forma reconocible de inmediato |
| 11 | Pregnancia | ❌ 4 arcos parecidos, sin forma ancla: difícil de recordar y de redibujar de memoria | ✅ la O es el ancla; se redibuja de memoria |
| 12 | Vocatividad | ⚠️ discreto, no llama | ✅ la masa de la O tiene peso visual |
| 13 | Singularidad | ❌ arcos concéntricos = iconografía genérica de señal/audio/wifi. Es justo la «estética IA genérica» que el brief prohíbe (§8) | ✅ la O de Odobi no la tiene nadie más |
| 14 | Declinabilidad | ❌ el sistema se parte en dos símbolos | ⚠️ **depende de la tipografía** — ver §4 |

---

## 3 · Dónde A gana de verdad (hay que reconocerlo)

Si entrás a la reunión diciendo que A no sirve para nada, perdés credibilidad. A tiene dos ventajas reales:

1. **Es independiente de la tipografía.** Hoy cambiamos de NeueEinstellung a Plus Jakarta Sans y **nuestro símbolo cambió con ella**. El de David no se movió. Es una fortaleza estructural genuina.
2. **Sigue el brief más literalmente.** El §3 pedía «símbolo **abstracto**» y proponía como punto de partida «O concéntrica partida que irradia ondas». A ejecuta eso; B se fue a un monograma. En *ajuste tipológico*, A cumple la letra del encargo y B no.

---

## 4 · Dónde B es vulnerable, y cómo blindarla antes de mañana

**Objeción 1 — «es un monograma, no un símbolo abstracto; el brief pedía otra cosa».**
Es la objeción más fuerte y hay que contestarla de frente, no esquivarla. Respuesta: el brief define el **territorio** («la O de Odobi fusionada con la voz») y aclara que *«la ejecución formal es territorio tuyo»*. B cumple el territorio con más precisión que A, porque A perdió la O en el camino. Y Chaves es explícito en que el ajuste tipológico se juzga por **adecuación al caso**, no por respetar una etiqueta elegida de antemano: para una marca cuyo nombre es corto y cuya inicial es una forma cerrada perfecta, el monograma es tipología de alto rendimiento, no un atajo.

**Objeción 2 — «tu símbolo depende de la fuente».**
Es cierta hoy y es la vulnerabilidad real. **Se neutraliza en un paso:** una vez elegida Plus Jakarta Sans, se **outlinea el glifo y se congela como path** — a partir de ahí el símbolo es geometría propia y ya no depende de que la fuente exista, se licencie o cambie. Es exactamente lo que ya hace el Rive. Conviene llegar a la reunión con ese path congelado y el archivo de marca armado: convierte la objeción en un punto resuelto.

**Dato que conviene tener a mano:** el cambio de tipografía movió los arcos **0,019 unidades**. La O de Plus Jakarta Sans mide 16,208 contra 16,246 de NeueEinstellung a la misma altura de caja. La dependencia tipográfica, medida, resultó ser mucho menos frágil de lo que suena.

---

## 5 · Recomendación

**B, con la corrección del §4 aplicada antes de mostrarla.**

El argumento decisivo no es estético: es que **A no cumple el requisito que el propio brief declaró condición de aprobación** (sobrevivir a 16px), y su documentación lo admite al derivar el favicon a otro símbolo que además no está entregado. Eso hace caer suficiencia, versatilidad, declinabilidad y legibilidad de un saque. La debilidad de B —la dependencia tipográfica— se resuelve outlineando el glifo; la de A —que el signo no dice «Odobi» y no sobrevive a escala chica— es estructural.

**Cómo conducir la reunión:** empezar por los hechos verificables (§1), no por los parámetros. La tabla de 14 sirve para ordenar la conversación después de que los tres hechos estén sobre la mesa, no para abrirla. Y reconocer las dos fortalezas de A (§3) antes de que las diga David.

**Lo que no hay que hacer:** presentar esto como «mi diseño contra el tuyo». El material a evaluar es el brief y sus requisitos; los dos signos son candidatos.
