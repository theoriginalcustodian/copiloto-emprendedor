---
name: el-guard-se-satisface-con-su-propio-comentario
description: Escribí un guard que exigía `min-height: 0` en el CSS y pasaba con la declaración BORRADA — el comentario que explicaba por qué hacía falta contenía la misma cadena que el regex buscaba
metadata:
  type: feedback
---

**LEER al escribir cualquier guard que matchee TEXTO de un archivo** (regex sobre CSS, YAML, SQL,
Dockerfile, config) — que es la forma más barata y más común de guard, y por eso la que más se escribe
sin control.

2026-08-06, fix del scroll del rail. Agregué a `desktop.css` dos declaraciones —`overflow-y: auto` y
`min-height: 0`— y un guard (`railScroll.test.ts`) para que nadie las borre "limpiando", porque su
ausencia **no da síntoma** mientras los ítems entren en la ventana.

El guard:

```ts
const bloque = desktopCss.match(/\.rail__items\s*\{([^}]*)\}/)?.[1] ?? '';
expect(bloque).toMatch(/min-height:\s*0/);
```

Corrí el control diferencial —borrar la línea y exigir rojo— y **el test pasó igual**. La causa está
en el mismo bloque que el guard inspecciona:

```css
.rail__items {
  /* El `min-height:0` NO es opcional: un hijo flex no se encoge bajo su contenido sin esto. */
  overflow-y: auto;
  min-height: 0;      /* ← borrá esta línea: el comentario de arriba sigue matcheando */
}
```

**El comentario que explica por qué la declaración es imprescindible contiene la declaración.** Y no
es casualidad: un buen comentario **cita** aquello que documenta. Cuanto mejor escrito está el
comentario, más seguro es que el guard se vuelva mudo — el incentivo va exactamente al revés del que
uno esperaría.

## Por qué no lo caza la lectura

Releí ese test antes de correr el diferencial y lo di por bueno. El regex es correcto, el bloque
extraído es correcto, el mensaje de error es correcto. Todo lo que se puede auditar *mirando* estaba
bien. Lo único que fallaba era **el conjunto sobre el que buscaba**, y eso no se ve: se mide.

Y el fallo es en la dirección silenciosa — [[un-mecanismo-roto-hacia-el-no-no-da-sintoma]]. Un guard
que nunca puede fallar convive para siempre con el código: pasa en cada CI, aparece en la lista de
tests verdes, y su nombre en el reporte **afirma** que la propiedad está vigilada. Es
[[instrumentos-que-confirman-en-vez-de-verificar]] en el caso más incómodo: un instrumento que yo
mismo acababa de escribir *sabiendo* de esa clase de trampa.

## La regla

1. **Todo guard de texto descarta comentarios antes de matchear.** Una línea:
   `css.replace(/\/\*[\s\S]*?\*\//g, '')` (o `#…` / `//…` según el lenguaje).
2. **El diferencial es parte de escribir el guard, no un paso posterior opcional.** Borrá lo que
   vigila y exigí rojo — en *cada* dirección que el guard dice cubrir, no en una de muestra. Acá
   fueron tres: sin `min-height` → rojo · sin `overflow-y` → rojo · intacto → verde.
3. La pregunta que lo destapa antes de correrlo: **¿de qué otro lugar del archivo podría salir este
   match?** Docstrings, comentarios, strings, el nombre del propio test, fixtures.

Hermana de [[vacio-no-es-hallazgo-correr-el-control]] (allá el control positivo prueba que el
instrumento *ve*; acá el diferencial prueba que además *discrimina*) y de
[[el-instrumento-tambien-CONDENA-no-solo-absuelve]].

## Reincidencia del 2026-09-29: tres veces en un día, y la forma generalizada

Tener esta entrada escrita **no alcanzó**. Reincidí tres veces el mismo día, y las tres con un disfraz
distinto — por eso vale generalizar la regla en vez de sumar casos:

1. Un control negativo buscaba `docs = {"lote_A"` en el texto para probar que el patrón ya no estaba…
   y **el comentario que documentaba el cambio contenía la cadena**. Verde por su propia prosa.
2. Un check de idempotencia preguntaba `if REAL in t` — y el basename **ya vivía en otra lista del
   mismo archivo**, por un motivo legítimo y distinto. Dio «ya aplicado» sin haber aplicado nada.
3. Una clave de excepción la escribí **adivinando el basename de una tabla que lo mostraba truncado
   a 66 chars**. Ésa la cazó el gate nuevo en su primera corrida (ver
   [[el-guard-que-caza-a-su-propio-autor]]).

**La forma generalizada:** preguntar «¿aparece esta cadena?» casi nunca es la pregunta. La pregunta es
**«¿aparece en el ROL que me importa?»** — como código y no como comentario, dentro de *este* dict y no
de otro, escrito y no citado. El match por presencia contesta sí por el motivo equivocado, y contesta
rápido, que es lo que lo hace pasar.

Operativamente: acotá el sujeto **antes** de buscar (partir el archivo por el bloque que te interesa,
descartar comentarios, exigir el indent del contexto), y el ancla llevá el salto de línea y la sangría
de su rol (`'\n    docs = {'`, no `'docs = {'`). Ídem
[[contar-un-simbolo-no-dice-en-que-rol-aparece]] y [[el-instrumento-respondio-sobre-otro-sujeto]].

---

## (2026-09-30) El parser leyó **su propia salida**, transcrita en el documento, como declaración de entrada

El registro de vigencia lleva adentro, en prosa, **el reporte que el script imprime** (para que un humano
vea qué mide). Una de esas líneas transcritas es `ALCANCE: 3 de 4 relaciones son PARCIALES…`. El bloque de
datos no tenía delimitador de cierre, así que el último quedaba abierto hasta EOF y **absorbía esa línea
como si fuera su campo**: el `ALCANCE: total` real se perdió y el control «toda relación declara ALCANCE»
**pasó igual, satisfecho con basura**. Fail-open perfecto: el campo existía, con el valor de otra cosa.

Con 4 bloques no daba síntoma —a cada uno lo seguía otro encabezado, que lo cerraba por accidente—. Lo
destapó el quinto ([[un-mecanismo-roto-hacia-el-no-no-da-sintoma]]).

**Y su gemelo, por el lado opuesto:** la **plantilla del propio documento** mostraba el encabezado *dentro*
del fence. Escribí el bloque nuevo copiando mi plantilla, y el parser **no leyó sus campos: la relación
desapareció del reporte sin un solo error**. Un instrumento que pierde una declaración verdadera en
silencio es peor que uno que acepta basura: la basura se ve en la salida.

**Cómo aplicar:** si el documento que tu instrumento lee **contiene ejemplos o salidas del instrumento**
—docs autodescriptivos, READMEs con su propio output, plantillas—, (1) delimitá explícitamente la zona de
datos y **cerrala** (acá: los campos sólo cuentan dentro del fence, y el fence cierra el bloque); (2) exigí
que **todo encabezado produzca un registro** (control de mudez, `exit 9`); (3) revisá que la plantilla que
publicás sea **aceptada por tu propio parser** — la mía no lo era.

## (2026-10-06) El control positivo buscó la frase que mi propia RETRACCIÓN tiene que citar

Parcheé una fila del tablero para retirar un anti-patrón: decía «falta que el operador lo mergee» y
había que sacarlo. Horneé el control positivo en el script: *la frase vieja debe quedar en **0**
apariciones*. Dio **1**, y lo leí como parche incompleto: busqué una segunda fila, medí duplicados,
revisé si había parcheado una copia fuera de la cola viva.

**No había nada que arreglar.** La aparición que quedaba estaba **dentro de mi propio texto nuevo**:
*«Acá decía «falta que el operador lo mergee», y eso es exactamente el anti-patrón…»*. Una retracción
bien escrita **tiene que citar lo que retracta** — si no, nadie puede verificar qué se retiró. O sea el
esperado `0` era **imposible por construcción**: el parche correcto garantiza ≥1.

Es el espejo en prosa de esta entrada: no es que el guard se satisfaga con su comentario, es que **se
acusa a sí mismo por su propia cita**. Y el esperado lo **escribí yo**, no lo midió nadie
([[un-control-positivo-con-esperado-falso-acusa-al-script]]).

**La pregunta que lo separa, antes de hornear el número:** *¿el fix correcto puede hacer que esta
cuenta llegue a 0?* Si el fix **documenta** lo que quita —retracciones, deprecaciones, changelogs,
comentarios que explican por qué algo ya no se hace—, la respuesta es no.

**Cómo escribirlo bien:** el control no cuenta la frase, cuenta la frase **en rol de afirmación
vigente**: exigir el marcador nuevo presente (eso sí es 0→1 y sólo existe después del parche) y acotar
la cuenta de la vieja a las apariciones **fuera** del contexto de cita. El costo de equivocarse acá no
es un parche mal hecho: es gastar la verificación persiguiendo un fantasma, con la mitad del riesgo de
«arreglar» un archivo que estaba bien.
