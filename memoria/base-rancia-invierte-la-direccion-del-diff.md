# Contra una base rancia el diff INVIERTE la dirección: lo que `main` borró parece tu aporte

**2026-10-07.** Una sesión midió el checkout compartido con `git diff <su-HEAD-rancio> -- .` y reportó
un `urgente_`: «5 archivos con trabajo real sin commitear, que no existe en ningún lado más que en
este disco — paren todos antes de tocar esto». Medido contra `origin/main` **fresco**: los 5 eran
atraso, 3 con **cero diff**. Y lo que lo vuelve grave es el sentido inverso: **preservarlos metía tres
regresiones.**

## El mecanismo del falso positivo

Contra una base vieja el diff no se equivoca de *cantidad*, se equivoca de **dirección**:

| en el diff vs base rancia aparece como | lo que realmente es |
|---|---|
| `-` (línea que el disco «borró») | línea que **`main` agregó después** |
| `+` (línea que el disco «aporta») | línea que **`main` quitó después** |

Así, cada mejora posterior de `main` se lee como una pérdida del disco, y cada cosa que `main`
**eliminó a propósito** se lee como trabajo propio pendiente. El reporte sale alarmado y coherente, y
no hay nada falso adentro: el defecto está en el **punto de comparación**, no en los datos.

## El paso que faltaba: ¿y si un commit lo BORRÓ a propósito?

Ya tenía el criterio por FUNCIÓN —*¿existe el mecanismo en `main`, aunque con otro texto?*—
([[restar-el-merge-base-no-distingue-que-main-lo-reescribio-mejor]]). **No alcanza.** Cuando la
respuesta es «no existe en `main`», quedan dos mundos distintos que el grep no separa:

1. nadie lo escribió todavía ⇒ **puede** ser trabajo pendiente;
2. **alguien lo borró a propósito** ⇒ rescatarlo es una **regresión**.

El discriminante es una sola línea: **`git log origin/main -S'<token>' -- <archivo>`**. Si devuelve un
commit, leé su mensaje antes de rescatar nada. Los tres casos de este turno:

- el texto fijo de un endpoint: **lo borró el PR que arreglaba ese mismo frente** — el fix consistió en
  **mudar el mensaje al front**, así que su ausencia en el backend *era* el arreglo. Rescatarlo deshace
  el PR y duplica el mensaje en dos capas.
- una rama `if name.startswith("instagram_")`: la quitó un `refactor(...): quitar la rama instagram_
  muerta`, y hay un **test que lo prohíbe** (`test_instagram_no_tiene_tool_viva`).
- un guard: el disco tenía `if not creds:` y `main` tiene `if not creds or store.salud() == "caido":`
  más siete líneas que explican por qué. **«Preservar el disco» era borrar el fix de `main`.**

## Y la trampa de la prosa, otra vez, en su forma más fuerte

El candidato que más parecía trabajo vivo traía **un comentario que explicaba su propio por qué**
(`SOP4/C7: texto FIJO, literal del DoD…`). Esa prosa es justo lo que el PR eliminó junto al código, y
viajando con la versión vieja la hacía parecer **autoritativa**: razón escrita, referencia a un DoD,
nombre de hallazgo. **Un comentario que justifica una línea no acredita que la línea siga vigente** —
acredita que alguna vez lo estuvo.

## Cómo aplicarlo

Antes de rescatar cualquier cosa de un disco o de una rama vieja, en este orden:
`--numstat` contra **`origin/main` recién fetcheado** (sin fila ⇒ cero diff ⇒ listo) → ¿existe el
**mecanismo** en `main`? → **si no existe, `git log -S` para ver si lo borraron** → recién ahí, ¿cuál
es el **efecto** de su ausencia? Y nunca midas contra tu propio `HEAD` si no verificaste que esté al
día: `rev-list --count @{u}..HEAD` da `0` y suena tranquilizador, pero **el que importa es
`HEAD..origin/main`**.

Relacionado: [[restar-el-merge-base-no-distingue-que-main-lo-reescribio-mejor]] ·
[[el-medidor-corrido-en-el-arbol-mezclado-acusa-al-repo]] ·
[[un-rebuild-desde-otra-base-revierte-un-fix-ya-cerrado]] ·
[[probar-que-el-instrumento-miente-no-te-exime-de-leer-lo-que-senala]]

## Refuerzo 2026-10-12 — en un checkout compartido la base rancia NO se arregla, se EVITA al crear el worktree

La entrada enseña a **detectar** la base rancia. Falta el movimiento de salida, porque el obvio está
prohibido: con checkout compartido, `pull` / `checkout` / `reset` están vetados por CANON 9 — pisan
el trabajo de otra sesión. Así que el que detecta que su base está vieja queda sin herramienta y
termina midiendo contra ella «porque es lo que hay».

**El movimiento correcto es anterior: la rama se crea desde el ref remoto, en un worktree nuevo.**

```bash
git worktree add -b <rama-nueva> /c/gfw-src/wt-<slug> origin/main
# → "branch '<rama-nueva>' set up to track 'origin/main'"
# → HEAD queda en el commit de origin/main, no en el de tu checkout
```

Eso no toca ningún checkout existente y la base nace fresca, así que no hay nada que diagnosticar
después. Medido el 2026-10-12: dos worktrees míos (`wt-mapeo`, `wt-ceguera`) habían quedado sobre
ramas **ya mergeadas**; corregir un doc desde cualquiera de los dos habría medido el diff contra una
base de dos merges atrás, que es exactamente la inversión que describe esta entrada. Crear
`wt-mapfix` desde `origin/main` costó un comando.

**Y el corolario que vale aparte:** un worktree sobre una rama ya mergeada **no es reutilizable** —
es una base rancia esperando ser usada. Cuando su PR se mergea, el worktree deja de ser un lugar
donde trabajar y pasa a ser sólo un lugar donde leer. Para el próximo trabajo, uno nuevo desde
`origin/main`; no le busques la vuelta al que ya tenés abierto.

---

## Refuerzo 2026-11-03 â€” reincidÃ­, y con ESTE archivo abierto para reforzarlo

El mismo defecto, en el mismo checkout compartido, 27 dÃ­as despuÃ©s. Esta vez con un medidor
**mejor** y por eso mÃ¡s convincente: comparÃ© el **nÃºcleo de prosa sin markup** de cada lÃ­nea
agregada contra el archivo de `main`, declarÃ© Â«6 lÃ­neas Ãºnicas que no viven en ningÃºn commitÂ»,
**las commiteÃ© como rescate** (`01d42aab`) y despachÃ© a una sesiÃ³n a portarlas. Las 6 eran
redacciÃ³n vieja que `main` habÃ­a reemplazado o derogado por decisiÃ³n firmada del operador
(`fffc3be8`/#1293 Â· `e791cf5e`/#1346 Â· `dc8d2ffa`/#1438). Lo cazÃ³ frontend2 con shas, y la
verificaciÃ³n contra la historia de `main` le dio razÃ³n entera.

**Lo nuevo que este caso agrega, y es lo que lo vuelve caro:** cuando llegÃ³ la refutaciÃ³n yo estaba
**abriendo este archivo para escribirle un refuerzo**. La secciÃ³n Â«Â¿y si un commit lo BORRÃ“ a
propÃ³sito?Â» ya decÃ­a, con esas palabras, que el discriminante es `git log origin/main -S'<token>'`.
No lo corrÃ­. No por olvido: **leÃ­ la entrada como "ya cubierto"**. Una regla escrita se cita como
cumplida; lo Ãºnico que la cumple es el comando.

**Y el modo de falla de segundo orden:** antes de equivocarme resolvÃ­ bien una disputa real â€”dos
medidores propios se contradecÃ­an (`grep` de la frase decÃ­a Â«main la tieneÂ», la lÃ­nea completa decÃ­a
Â«ausenteÂ») y el nÃºcleo de prosa **era** el sujeto correcto *para la pregunta de la envoltura*.
Haber ganado esa discusiÃ³n me hizo dar por respondida **otra**: Â«Â¿estÃ¡ en main?Â» no es Â«Â¿lo
borraron?Â». **Un medidor mÃ¡s fino sobre el eje equivocado no da una respuesta mÃ¡s verdadera, da una
mÃ¡s difÃ­cil de dudar** â€” y el acierto previo funciona como aval.

Chequeo que queda, antes de rescatar **cualquier cosa** de una base rancia:

1. Â¿la prosa estÃ¡ en `main`? â†’ si no, **no concluyas**: son dos mundos.
2. `git log origin/main -S'<token>' -- <archivo>` â†’ si devuelve commit, **leÃ© su mensaje**.
3. si el mensaje dice que lo quitÃ³ a propÃ³sito (decisiÃ³n, derogaciÃ³n, refutaciÃ³n en device),
   rescatarlo es una regresiÃ³n y el veredicto es **descartable**, no Â«sin respaldoÂ».

El caso completo, con las 6 lÃ­neas y sus commits:
`docs/copiloto-emprendedor/Auditorias/2026-11-03-rescate-checkout-compartido-seis-lineas-que-no-estan-en-ningun-commit.md`
(titular reescrito, no appendeado: de dos artefactos gana el que circula).


---

## Refuerzo 2026-11-03 — el daño no es equivocarse: es que el `Falta:` MANDA trabajo

La entrada de arriba mide la base rancia en un **diff**, donde el síntoma es que la dirección se
invierte. Hay una segunda forma, y es peor, porque no produce una lectura confusa sino una **orden**.

Medí en código los tres puntos de `SM-N34` —el «+ Nuevo evento», el punto de estado y la línea del
ahora— y escribí en el `Falta:` de la ficha: **«medido en código: no existe»**. Las tres estaban
mergeadas en `64e9f29a` (#1462): `PantallaAgenda.tsx:126`, `posicionLineaAhora` en
`packages/core/src/api/agenda.ts`, tests en `lineaAhora.test.ts` y `PantallaAgenda.test.tsx:153`.
Mi medición corrió contra una base anterior a ese PR. Control negativo: antes de `64e9f29a`, 0 hits.

**Y el DoD 1 de esa misma ficha ordenaba literalmente lo contrario:** *«decir si existen hoy con
`path:línea`; si existen, la ficha cierra con la cita y NO se implementa de nuevo»*. Así que mi
`Falta:` mandaba a reimplementar justo lo que el DoD prohíbe reimplementar — y lo hubiera pagado la
otra sesión, no yo.

**Un `Falta:` medido contra una base rancia no describe un hueco: FABRICA trabajo.** Un diff mal
leído se corrige cuando alguien lo mira; un `Falta:` escrito en el registro **se ejecuta**, porque
para eso existe. Por eso un campo que ORDENA tiene un umbral más alto que uno que informa.

**La regla:** antes de escribir «no existe» en un `Falta:` o un `Cierre:`, `git fetch` y medir contra
`origin/main`, con el control negativo del commit que lo habría agregado (`merge-base --is-ancestor`).
Y si la ficha tiene un punto del tipo «primero decí si ya existe», ese punto **es** la medición: si tu
hallazgo lo contradice, el sospechoso es tu base, no el código.

### La mitad simétrica, el mismo día: el resultado de otra sesión se hereda, el MECANISMO no

`SM-N28` cerró sus puntos 4 y 5 con una medición de otra sesión que citaba
`modules/principal/` y `modules/agenda/`. **Esos paths no existen** — son `src/shell/` y
`modules/midia/`. Mi grep contra *sus* paths dio **vacío en todo**, y por un momento pareció que nada
de lo que afirmaba estaba ahí. El contenido era correcto; la cita de path, no.

Las dos caras del mismo día: en N34 tenía razón el peer y la base vieja era mía; en N28 tenía razón
el peer en el **resultado** y se equivocaba en el **mecanismo**. Lo que sobrevive de una medición
ajena es **qué** se midió; **dónde** y **cómo** se re-verifica siempre, y por eso un vacío contra un
path citado de segunda mano es [[medir-contra-un-ref-que-no-existe-da-vacio-y-vacio-se-parsea-como-cero]]
y no un hallazgo. Ver también [[la-cita-de-procedencia-muere-en-el-merge]] y
[[el-contrato-que-manda-a-hacer-algo-ya-hecho]].
