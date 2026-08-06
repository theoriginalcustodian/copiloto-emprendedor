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
