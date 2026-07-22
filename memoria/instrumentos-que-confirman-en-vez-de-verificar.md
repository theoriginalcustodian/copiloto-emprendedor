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

[[no-codificar-la-esperanza-principio-raiz]] [[copiloto-facturacion-afip]]
