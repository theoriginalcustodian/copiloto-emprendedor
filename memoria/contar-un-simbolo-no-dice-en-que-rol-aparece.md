---
name: contar-un-simbolo-no-dice-en-que-rol-aparece
description: Conté 4 keys "eliminadas" en el bundle y declaré que prod corría el rail viejo — estaban en el TIPO, no en el registro; cometí el mismo error tres veces en una hora porque un conteo devuelve un número igual de convincente esté bien o mal formulada la pregunta
metadata:
  type: feedback
---

**LEER antes de afirmar "X está / no está en el sistema" a partir de un `grep -c`.**

2026-08-06. El PR #289 sacó cuatro entradas de la barra de navegación (`apps`, `connections`,
`recientes`, `account`). Para verificar si prod tenía esa barra, conté esas keys en el bundle servido:

```
"recientes" 4 · "connections" 6 · "apps" 4 · "account" 3
```

Concluí: **"prod corre el rail viejo, el #289 nunca se desplegó"**. Era falso. Esas keys estaban en el
**tipo** `TabKey` y en otros módulos que navegan a esas pantallas —que siguen existiendo, sólo salieron
de la *barra*—, no en el registro `TABS`.

El control que sí discrimina fue contar el registro entero, con su forma:

```bash
grep -oE 'key:"[a-z]+",label:"[^"]*"' bundle.js   # 24 entradas, IDÉNTICAS en el bundle viejo y el nuevo
```

## Lo que hace a este error distinto de un descuido

**Lo cometí tres veces seguidas en la misma hora, sobre la misma pregunta:**

1. Conté el label `"Escritorio"` → **0**, y lo leí como "no está". El label real es **"Funciones"**.
2. Grepée las keys en `TabBar.tsx` → **4 hits**. Los miré: eran las líneas del tipo `TabKey`. Corregido.
3. Grepée **las mismas keys** en el bundle → 4 hits → volví a concluir mal.

El paso 2 me había mostrado la trampa exacta. Volví a caer en el 3 porque el bundle está minificado:
no podía "mirar las líneas", y el conteo se sintió suficiente **justo donde era menos confiable**.

**Por qué no protesta.** Un conteo devuelve un número con la misma cara esté bien o mal formulada la
pregunta. El `0` del paso 1 y el `4` del paso 3 son igual de firmes que un conteo correcto: no hay
excepción, no hay vacío que dispare [[vacio-no-es-hallazgo-correr-el-control]], no hay error de
sintaxis. Es [[instrumentos-que-confirman-en-vez-de-verificar]] con la variante de que el instrumento
está bien y **la pregunta** está mal — y una pregunta mal formulada no se puede auditar leyendo su
resultado.

Peor en artefactos **agregados** (bundles, binarios, dumps, logs concatenados, un `git grep` sobre el
repo entero): ahí un identificador aparece en muchos roles a la vez —tipo, registro, string de test,
comentario, dato de otro módulo— y el conteo los suma todos sin decirlo.

## La regla

- **Contá la FORMA, no el nombre.** No `"recientes"`, sino `key:"recientes",label:"…"`. La forma
  codifica el rol; el nombre solo, no.
- **Ante un conteo que decide algo, mirá al menos un hit.** Si el artefacto no deja mirarlos
  (minificado, binario), ese es el momento de subir la exigencia, no de bajarla.
- **Diferencial > absoluto.** "24 entradas idénticas en el bundle viejo y en el nuevo" prueba algo que
  ningún conteo suelto prueba. Guardá el artefacto previo antes de reemplazarlo: sin el bundle viejo
  no habría podido cerrar esto.
- Si ya te equivocaste una vez con este símbolo, **el próximo conteo sobre él es sospechoso por
  defecto**, aunque cambies de archivo.

Hermana de [[el-default-de-la-herramienta-devuelve-mas-de-lo-que-asumis]] (allá el dato venía inflado
por el default de la herramienta; acá por el rol del símbolo) y de
[[el-control-corrido-contra-la-base-equivocada]].
