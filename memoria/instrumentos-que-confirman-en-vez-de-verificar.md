---
name: instrumentos-que-confirman-en-vez-de-verificar
description: "Un instrumento mal construido no falla: confirma. Nueve casos en una sesion (exit code pipeado, 200 del SPA, espera laxa, muestreo contaminado, catalogo paginado, y un control horneado que tampoco controlaba). LEER antes de declarar algo verde por lo que dijo una herramienta."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: cbc14bc5-aae4-430e-9c3d-4df2449cbd57
  modified: 2026-07-21T19:51:15.135Z
---

**Un instrumento mal construido no falla ruidosamente: devuelve verde.** Por eso es más peligroso que un bug — el bug protesta, el instrumento defectuoso confirma lo que uno espera y cierra la investigación.

**Cinco casos en la sesión del 2026-07-21 (mañana), todos el mismo patrón:**

1. **`deploy.sh | tail -60` → `exit 0`** con el deploy MUERTO a mitad. El exit code de un pipeline es el del ÚLTIMO comando. El deploy había copiado archivos y no reiniciado nada. → Nunca pipear un script cuyo exit code importa; usar `${PIPESTATUS[0]}` o redirigir a archivo.
2. **`GET /afip/estado` → `200`** con el endpoint INEXISTENTE: el backend sirve el SPA como fallback de toda ruta desconocida. El control (`/ruta-que-no-existe-jamas` → también 200) lo destapó en un comando.
3. **Espera laxa, 4 veces**: `esperar(lambda e: e.get("resultado"))` sale apenas hay CAE, ANTES de que exista el PDF → reporta "PDF ausente" sobre algo que estaba por llegar. Y al revés: salir del bucle en la primera vuelta hizo que reportara *"converge a borrador en <1s"* sobre un tenant sin certificado, tapando el bug que frontend después encontró. **Una condición de espera que sale antes de tiempo no falla: miente.**
4. **Muestreo contaminado**: `SELECT ... LIMIT 3` sobre `mp_credentials` devolvió 3 filas de TEST (llaves efímeras de `monkeypatch`) → "0/3 descifradas" → casi diagnostico un bug de cifrado inexistente. Lo salvó **correr el control**: probar la llave VIEJA, que tampoco descifraba → el problema no era el cambio.
5. **`tar --exclude` después de los argumentos** → warning, exit≠0, y el `&&` siguiente evaluó contra el `ssh` → imprimió "sync OK" sin haber sincronizado.

**Cuatro más, misma sesión, tarde (archivado en Drive) — y uno es el control mismo:**

6. **Catálogo paginado leído como catálogo completo.** `get_raw_composio_tools(toolkits=["GOOGLEDRIVE"])` devolvió **20** tools (default del servidor) y estuve por reportar *"el slug no existe, el diseño no se sostiene"*. Con `limit=500`: **90**. Lo cazó tener un **caso positivo obligatorio** en el chequeo — `FIND_FILE`, que este repo usa en PRODUCCIÓN, figuraba como inexistente: un catálogo que niega algo que estoy usando hoy no está describiendo el catálogo. **Un número redondo (20, 50, 100) en un listado es sospecha de página, no de total.**
7. **El control que no controlaba.** Mi replay-verify traía horneado un control: mutilar un history y exigir que FALLE. **Pasó** → el instrumento aceptaba cualquier cosa. Un history truncado es "incompleto pero consistente" y el replayer no tiene nada que contradecir. Lo reemplazó un **control diferencial**: correr el mismo replay con el código ANTERIOR. La única ejecución que fallaba ya fallaba antes → mi cambio no rompía nada. **Un control negativo sintético puede ser tan defectuoso como el instrumento; el diferencial contra el estado previo no.**
8. **Filtro mal escrito → `0` con el dato impreso arriba.** Un ternario sin paréntesis dentro de un generador reportó "conexiones googledrive: 0" mientras la línea de arriba mostraba `googledrive ... ACTIVE`. El resumen mentía y el detalle no.
9. **`psql: command not found` → `EXIT_REAL=0`.** El binario no existía, el comando no hizo nada, y el exit code salió limpio por la forma del encadenado.

**Décimo, y el más difícil de matar: el instrumento PARCIALMENTE ciego (2026-07-21, noche).** El vigía del buzón de PLANIFICACIÓN miraba `cerrado/` para una cosa (buscar el `avance_` del dueño de un ítem en curso) y **no** para la otra (mensajes nuevos dirigidos a mí). Reportaba cosas archivadas — así que uno concluía que miraba lo archivado. El de FRONTEND, ciego del todo, le costó **horas** de bloqueo con el trabajo ajeno ya hecho desde hacía rato.

**La ceguera parcial dura más que la total, precisamente porque duele menos:** un instrumento que no reporta nada nunca se gana la confianza; uno que acierta en la mitad de los casos la gana entera, y la mitad muda no se descubre hasta que cuesta algo. **No alcanza con preguntar "¿este instrumento mira X?" — hay que preguntar "¿lo mira en TODOS sus caminos, o sólo en el que probé?".**

**Undécimo — el autocontrol que cubre UNA parte y sella el TODO (2026-07-22).** Reescribí el vigía del
buzón con un control de arranque horneado: cuatro nombres de archivo ficticios contra su filtro de
destinatarios, exigiendo que dos pasen y dos no. **Dio 4/4 con el script completamente roto** — no
emitía absolutamente nada. La ruta del repo tiene un espacio (`Claude code`) y `for f in $(listar)` la
partía en dos, así que la enumeración devolvía basura y ningún archivo llegaba nunca al filtro.

El control probaba **el filtro**; lo roto era **la enumeración**. Y el 4/4 no era falso: era cierto e
irrelevante. **Un autocontrol sólo cubre lo que a uno se le ocurrió que podía fallar, y lo demás pasa
con el sello puesto** — peor que sin control, porque ahora hay un número verde respaldándolo.

Lo tapó un control de la otra mitad, escrito preguntándose *¿qué devolvería si la enumeración estuviera
rota?*: **si hay decenas de `.md` en disco y la enumeración devuelve menos de 5 candidatos, abortar a
los gritos** — cero no es silencio, es el instrumento roto. Es [[vacio-no-es-hallazgo-correr-el-control]]
aplicado al propio instrumento.

**La regla que sale de esto:** antes de creerle a un instrumento propio, preguntarse *¿qué devolvería si lo que mido estuviera roto?* Si la respuesta es "lo mismo", el instrumento no sirve. Hornear el control adentro: el smoke ahora sabe QUÉ esperar según haya credencial o no, en vez de dar por bueno cualquier 200.

**Y el corolario del caso 7:** el control horneado también hay que verificarlo. Un control que nunca vio fallar el instrumento es fe, no evidencia. Cuando se pueda, preferir **control diferencial** (mismo instrumento, estado anterior vs actual) sobre control sintético — el diferencial no depende de que uno haya imaginado bien la forma del fallo.

**Hermana de [[vacio-no-es-hallazgo-correr-el-control]]:** aquella cubre el vacío inesperado; ésta el **verde** inesperadamente fácil. El verde no se cuestiona nunca — por eso hay que construir el instrumento para que no pueda darlo sin merecerlo.

Y el corolario que cerró el sprint: **el E2E que hablaba con Temporal directamente pasaba aunque el router HTTP no estuviera montado.** Verificar la capa equivocada es la versión arquitectónica del mismo error. Dos bugs (emisión clavada a homologación, PDF que desanulaba) sólo aparecieron cuando el E2E usó la superficie que usa la app.

## Caso 8 (2026-07-22) — el doble levantó una excepción que el código real no puede levantar

Un test del `except TransicionInvalida` usaba un fake que hacía `raise TransicionInvalida("ya no está
pendiente")`. La firma real es `(desde, hacia)`: lo que viajó fue un **`TypeError`**, que el
`except Exception` del executor atrapa igual. El test dio **rojo por el motivo equivocado**.

Y ése fue el golpe de suerte. Si el assert hubiera sido un poco más laxo —`res.status in (...)`, o
mirar sólo que no explotara— habría dado **verde sin ejercitar ni una vez la rama que dice probar**,
y el `except` específico podría no haber existido nunca.

**Un doble de test no es libre: tiene que poder fallar exactamente como falla el original.** Un fake
que levanta la excepción con otra firma, devuelve otra forma o rompe un contrato que el real respeta,
prueba un camino que en producción no ocurre. Barato de verificar: leer la firma real antes de
escribir el `raise`, o construir la excepción con los mismos argumentos que usa el código.

[[no-codificar-la-esperanza-principio-raiz]] [[copiloto-facturacion-afip]]

## Caso 9 (2026-07-22) — el control comparó dos archivos que no existían y dio el tilde verde

Para probar que correr los tests contra la base nueva **no tocaba producción**, conté las filas antes
y después y comparé:

```bash
diff prod_antes.json prod_despues.json && echo "✅ producción IDÉNTICA"
```

Los dos archivos **no existían** (el redirect no había escrito nada). `diff` no encontró diferencias
entre dos nadas, devolvió 0, y el `&&` imprimió el tilde. **El control más importante de la sesión
—el que planificación había pedido explícitamente— reportó verde sin haber medido nada.**

Y no fue por descuido de un principiante: era el control de un riesgo que ya nos había costado 552
filas huérfanas en producción, escrito por alguien que llevaba todo el día cazando exactamente esto.

**Lo que lo hace tan traicionero:** un `diff` sin diferencias y un `diff` sin datos se ven **idénticos
en pantalla**. La ausencia de salida es la señal de éxito Y la señal de que no había nada que comparar.

**El arreglo, y es el patrón general:** el control tiene que **abortar ruidoso** ante su propia
ausencia de insumos —archivo que falta, archivo vacío, cero tablas medidas— y **publicar cuánto
midió** (`tablas medidas: antes=74 despues=74`) para que el número sea auditable en vez de creíble.
Un "0 diferencias" sin un "sobre N cosas" al lado no dice nada.

**Corolario que generaliza los 9 casos:** casi todos son la misma forma — *el instrumento no distingue
entre «medí y no había nada» y «no medí»*. Exit code pipeado, 200 del SPA, espera laxa, muestreo
contaminado, `tail -12` sobre una lista de 15, y ahora `diff` de dos vacíos. **Cuando un instrumento
puede devolver el mismo resultado por éxito o por no-haber-corrido, no es un instrumento.**

## Caso 10 (2026-07-22) — el guard traía la explicación adentro, y me la devolvió como hallazgo

Un script de E2E en device abortaba con:

```python
raise SystemExit("ABORTA: 0 etiquetas — el dump no sirve para navegar (RN suele no exponer texto)")
```

Salió el mensaje, y **reporté al equipo que la app no exponía `accessibilityLabel`**. Otra sesión midió
y encontró que sí los exponía. El control que me devolvió —guardar el XML crudo— reveló **dos** causas,
y ninguna era ésa:

1. **Git Bash traducía `/sdcard/x.xml` a una ruta de Windows.** El dump se escribía en
   `C:/Files/Git/sdcard/` y el `cat` leía otro lugar. (`MSYS_NO_PATHCONV=1` lo arregla.)
2. **`uiautomator` exige que la UI quede quieta**, y la app anima de forma continua → aborta con
   `could not get idle state`. Apagar las animaciones del *sistema* no alcanza: son de la app.

## La regla nueva, y es la que faltaba en los nueve casos anteriores

**El mensaje de un guard no puede contener la causa probable.** Sólo puede decir **qué se midió y qué
se esperaba**:

```python
# MAL  — el guard opina, y su opinión sale con la autoridad de una medición
raise SystemExit("0 etiquetas — RN suele no exponer texto")
# BIEN — el guard mide; explicar es un acto separado, que exige otro control
raise SystemExit("0 etiquetas de 0 nodos leídos en ui.xml (0 bytes). NO explicar sin: "
                 "(a) el archivo crudo, (b) el mismo dump sobre otra app")
```

**Por qué importa más que los otros nueve:** un guard que trae la hipótesis adentro no falla — te
**confirma**. Y como el texto salió de un `raise` y no de tu cabeza, se lee como resultado de medir.
Es la forma más difícil de detectar del error de esta familia, porque el instrumento que debía
protegerte es el que te entrega la conclusión falsa, ya redactada y con autoridad prestada.

**Y el agravante que lo vuelve doctrina:** escribí el caso 9 —*«un cero del propio instrumento no es un
hallazgo»*— **cincuenta y cinco minutos antes** de cometer el caso 10, con más confianza que la primera
vez, porque venía de una racha de diagnósticos correctos. **Saber la regla no protege: protege el
control.** Por eso la regla operativa no es *«acordate»* sino *«el guard no opina»* — algo que queda
escrito en el código y no depende de la memoria de nadie.

## Caso 11 (2026-07-24) — el sensor identificaba a los sujetos por cómo se LLAMAN, no por lo que HACEN

`no-ocio-check.sh` mide la vida de cada sesión por el mtime de su transcript. Para saber **cuál**
transcript es de cuál sesión, contaba apariciones de `sesión BACKEND` / `sesión FRONTEND`. Falla por
una razón que sólo se ve en un sistema de varios actores: **todas CITAN el buzón, así que el nombre de
todas aparece en el transcript de todas.** El conteo empató, las dos vivas quedaron rotuladas
FRONTEND, y a backend lo nombró **por descarte**.

Un rótulo por descarte **no falla: confirma**. Con backend muerto habría reportado backend vivo igual —
el número que el operador lee («backend 0min») es idéntico en los dos mundos. Y encima el operador
**había renombrado las sesiones ese mismo día**: cualquier instrumento anclado a nombres iba a mentir.

Bug apilado debajo, invisible mientras el rótulo estaba mal: se quedaba con el **primer** transcript de
cada rótulo, no con el **más fresco**. Una sesión deja transcripts viejos al reiniciarse → reportó
*«backend 66min»* con backend tecleando.

**La regla:** para identificar a un actor, usá **evidencia de conducta ajena a su voluntad**, no su
autodeclaración. Acá: los **paths que toca** (`apps/copiloto`+`motor` = backend ·
`apps/mobile`+`packages/core` = frontend). Nadie edita `apps/mobile` desde la sesión de backend, y
ningún rename lo cambia. Y **si no se puede rotular, decilo fuerte** (`⚠️ transcript vivo SIN rotular`)
en vez de asignar por descarte: un actor sin identificar puede ser justo el que creés muerto.

Lo destapó el operador diciendo *«están paradas»* contra un instrumento que decía lo contrario. El
control que lo resolvió no fue mirar el sensor: fue **leer las tool calls de cada transcript** — backend
grepeando `continue_as_new` en `conversation_workflow.py`, frontend editando `chat/index.ts`.
Conducta observada, no rótulo.
