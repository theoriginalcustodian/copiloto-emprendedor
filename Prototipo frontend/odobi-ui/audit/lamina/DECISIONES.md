# DECISIONES — Lámina del análisis del build de David

Pieza: `index.html` (autocontenida, 753 KB), generada por `construir.py` desde `lamina.template.html` + `capturas/`. Creada el 15/08/2026 para que Martin le presente el análisis a David: se proyecta en la reunión **y** se manda como archivo único.

## 1 · Qué es y qué no es

| Elemento | Decisión | Fundamento | Alternativa descartada y por qué |
|---|---|---|---|
| Formato | **Una página con las capturas reales de David anotadas**, no un deck de slides | El material de discusión son sus pantallas. Una lámina por pantalla, con el hallazgo al lado del píxel que lo produce, permite recorrer la reunión sin cambiar de archivo ni pedirle a nadie que recuerde cuál era la captura | Mandar el `.md`: obliga a mapear cada punto a su pantalla mentalmente. Deck de slides: fija un orden y no deja saltar |
| Autocontenida | Capturas y fuente **embebidas como data-URI** | Se manda por link/archivo suelto sin carpeta de assets. Es la misma decisión del árbol, por el mismo motivo | Referenciar `capturas/`: el HTML solo no sirve para lo segundo |
| Marcadores numerados + tarjetas al lado | **Reemplazan a las flechas SVG curvas** del estándar de anotación | Con 6-7 hallazgos por pantalla, las flechas se cruzan entre sí y sobre el frame. El *callout numbering* (numerito sobre la imagen + leyenda ordenada al costado) es el patrón de manual técnico, y a esta densidad es más legible | Flechas curvas al elemento (estándar 26/07): funcionan con 3-4 anotaciones por lámina, no con 7 |
| Coordenadas de los pines | **En porcentaje**, no en píxeles | Las cuatro capturas no tienen la misma resolución: tres son 720×1600 y la de Inteligencia 576×1280 | Píxeles: obligaría a una tabla de conversión por captura |
| Orden de las láminas | **Arranque → escritorio → Inteligencia → login**, no el orden en que se usan | Va de lo estructural a lo cosmético: la discusión importante (qué capa va adelante) tiene que pasar cuando todos están frescos. El login va último porque es la pantalla más sana | Orden de uso real (login primero): abre la reunión con el detalle más chico |
| Tono | Cada lámina abre con un **veredicto** que dice primero lo que está bien | Es un análisis para trabajar con David, no un informe de fallas. Y varias de las observaciones **ya son decisiones suyas** esperando su hito: presentarlas como hallazgos ajenos sería falso | Lista de defectos ordenada por severidad y nada más |
| Aciertos con marcador propio (✓ verde) | Van **en la misma lista** que los problemas, no en una sección aparte | Un acierto separado se lee como cortesía; puesto entre los hallazgos, se lee como parte del mismo juicio | Sección "lo bueno" al principio: se saltea |

## 2 · Color y contraste (todos los pares calculados, `python3`)

Meta-capa de presentación, **no** UI de la app — misma excepción declarada que el árbol (`arbol/DECISIONES.md` §5).

| Par | Ratio | Uso |
|---|---|---|
| Negro `#1A1512` s/ fondo `#F2EEE7` | 15,66:1 ✅ | Texto principal |
| `sec #5C5449` s/ fondo | 6,44:1 ✅ | Texto secundario, eyebrows |
| Terracota `#B04A2E` s/ fondo | 4,70:1 ✅ | Datos medidos, severidad crítica |
| Blanco s/ `#B04A2E` | 5,43:1 ✅ | Número del marcador crítico |
| Crema `#F7F3EC` s/ negro | 16,37:1 ✅ | Marcador mayor y bloque de método |
| Arena `#E8A088` s/ negro | 8,46:1 ✅ | Eyebrow sobre oscuro |
| Negro s/ tarjeta `#FBF9F5` | 17,22:1 ✅ | Título del hallazgo |
| `sec` s/ tarjeta | 7,08:1 ✅ | Cuerpo del hallazgo |
| **Lápiz `#8A7F73` s/ fondo** | **3,39:1 ✗** | **Solo trazos y filetes — nunca texto.** Es el borde del marcador "menor" y los divisores punteados |

**La terracota acá no marca lo tocable** (Decisión B): marca **severidad crítica**. Es legítimo porque la lámina no es UI de la app —no hay nada que tocar— y el rojo-tierra como código de alarma es la convención que el lector ya trae. Queda declarado para que no se copie a un mockup por analogía.

## 3 · El fondo `#F2EEE7`, no `#E9E6E0`

Mismo valor que las láminas del deck y el árbol. Con `#E9E6E0` los links quedaban en 4,36:1 (falla). Ver `arbol/DECISIONES.md` §5, donde se encontró el problema.

## 4 · La maqueta del rodillo

La propuesta del estado vacío se muestra **funcionando**, no descripta: un `<ul>` de 4 ítems (el primero repetido al final) desplazado por `@keyframes` dentro de una máscara de 26 px de alto — exactamente la altura de una línea.

- **La máscara de una línea exacta es la decisión, no un detalle de implementación.** Si asomaran las líneas vecinas, el bloque parecería arrastrable y competiría con el gesto vertical del panel del chat, que es el gesto principal de la app.
- **Sin `overshoot`**: un rebote lo haría parecer un control manipulable.
- `@media (prefers-reduced-motion: reduce)` **detiene la animación** — la maqueta cumple la misma regla que le pide a la app.
- El ejemplo va **entrecomillado y en cursiva**: marca que es *habla del usuario*. Sin esa marca, «Gasté 15 lucas en nafta» se puede leer como un dato ya cargado.
- ⚠️ En la lámina el loop es infinito porque es una demo que se mira; **en la app tiene que detenerse tras un ciclo** (WCAG 2.2.2). La diferencia está escrita en la tarjeta 4 de esa misma sección para que nadie copie el loop.

## 5 · El bloque "Medido, no mirado" sobre negro

Es la única banda oscura de la pieza y va **antes** de los hallazgos: si el método no se acepta, ningún número convence. Dice explícitamente que **dos conclusiones de la primera lectura se cayeron al abrir el repo** — la app no abre en el lanzador, y la corrección no vive en la pantalla sino en la card.

Eso no es humildad decorativa: es lo que hace creíble el resto. Un análisis que sólo acumula cargos se lee como acusación; uno que muestra sus propias correcciones se lee como trabajo.

## 6 · Regeneración

```bash
python3 audit/lamina/construir.py     # → audit/lamina/index.html
```

El script tiene un **gate por peso**: si el HTML pesa menos que la suma de las capturas, aborta — el data-URI no se embebió. Es la lección del deck, donde 27 PNG en blanco se reportaron `OK`.

**Trampa ya pagada (15/08):** un pase de corrección de acentos hecho con `replace` global sobre el script rompió `03-funciones.jpg` → `03-funciónes.jpg` y el título "El escritorio de funciónes". Si se corrige ortografía por lote, hay que **excluir los nombres de archivo** y releer el resultado — el build falla ruidosamente con el path, pero el título rompido pasa silencioso.

## 7 · Los frames de la propuesta (agregado 15/08)

La sección de cierre —"Es la misma máquina, invertida"— muestra los tres frames del mockup `10-arranque` **recortados limpios, sin la capa de anotación**: al lado de las capturas de David tienen que leerse como producto, no como otra lámina anotada.

**Cómo se generan** (queda escrito porque costó tres intentos):

1. Se copia el mockup a un temporal inyectando `.overlay{display:none}` + `.hand{display:none}` + se ocultan `page-head`/`lane-tag`/`lane-sub` y se saca el padding del `body`. **Sin ese paso se cuelan las puntas de las flechas** dentro del recorte, porque terminan justo sobre el borde del frame.
2. Chrome headless a `1100×3200`. Con la altura por defecto **el tercer canvas queda cortado** y el recorte sale corrido — el síntoma es un frame que empieza en "MIRAR" en vez de en la barra de estado.
3. Con las cabeceras ocultas los canvas quedan apilados de a 1000 px exactos: los frames arrancan en **48, 1048 y 2048**, y se recortan `392×846` desde `x=354`.

**Lección de método:** detectar el borde del frame por color falla —el borde es redondeado y el contenido interno tiene zonas blancas— y da tops plausibles pero equivocados. Con el layout normalizado (sin cabeceras), la aritmética del canvas es exacta y no hace falta detectar nada.

## 8 · La voz contextual entra a la lámina (17/08)

Sección nueva **«Dictar sin salir de la función»**, entre la propuesta y el plan. Cierra el recorrido: el diagnóstico muestra que las dos vías compiten, la propuesta las ordena, y esta sección las **une**.

| Decisión | Fundamento |
|---|---|
| Va **sobre lienzo claro**, no en otra banda oscura | La banda negra abre (método) y cierra (la propuesta). Una tercera diluiría el recurso: el negro dejaría de significar «acá pasa algo distinto» |
| Los frames salen de **`deck-assets/frames/`**, sólo reducidos | Son frames limpios **por construcción** (los genera `frames.py` sin la capa de anotación): no hay que recortarlos a mano como los tres de la propuesta, ni repetir la aritmética de canvas |
| Cierra con un **remate sobre el contrato**, no con un resumen | El dato que vuelve importante a esta pieza no es de diseño sino de producto: **no hay editar ni borrar después de guardar** (§12). Eso convierte a la card en el único control de calidad del dato — y hace que *dónde aparece* deje de ser comodidad |
| El paso 5 del plan ahora dice **«Ya está dibujado»** | El plan y las secciones tienen que coincidir: un plan que promete algo que la propia pieza ya muestra se lee como desactualizado |
