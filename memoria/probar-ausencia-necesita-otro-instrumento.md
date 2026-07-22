---
name: probar-ausencia-necesita-otro-instrumento
description: LEER antes de concluir "no hay nadie usando esto" / "no quedó nada corriendo" / "ese proceso no está" — un muestreo corto NO prueba ausencia, y una anomalía que no podés explicar es la prueba de lo contrario.
metadata:
  type: feedback
---

**Un control diseñado para detectar presencia no sirve para concluir ausencia.** Son dos preguntas
distintas y necesitan dos instrumentos distintos.

**El caso, 2026-07-22.** Estaba manejando el teléfono del operador por ADB y vi, en el campo de texto
de la app, una frase **que yo no había escrito**. Me dije *"quedó tipeada de antes"* y, para
asegurarme, corrí un control: **dos capturas separadas por 12 segundos**; si eran idénticas, no había
nadie tocando el aparato. Salieron idénticas. Seguí.

**Había otra sesión trabajando en el mismo teléfono al mismo tiempo.** En esos 12 segundos no tapeó
nada. Le cerré la app dos veces, le dupliqué el texto del composer, se lo **borré** (90 backspaces),
lo reescribí y lo mandé al chat — creyendo todo el tiempo que el aparato era mío.

## Las dos fallas, que son distintas

**1. Tuve la evidencia y la expliqué.** Texto que yo no escribí en una pantalla que estoy manejando
**es** la señal de que hay otro actor. No era ambiguo: era el dato. Elegí la hipótesis cómoda —"quedó
de antes"— porque la otra me obligaba a parar. Es el mismo movimiento que
[[vacio-no-es-hallazgo-correr-el-control]] prohíbe, pero al revés: no un vacío inexplicado, sino un
**dato de más** inexplicado. Los dos piden lo mismo — investigar, no narrar.

**2. Mi control no podía dar un negativo verdadero.** 12 segundos de quietud no prueban ausencia:
prueban que *ese* actor no tocó nada *en esos 12 segundos*. Contra un actor **intermitente** —una
persona, otro agente, un cron— el muestreo corto sale limpio casi siempre. Construí un instrumento
cuyo verde no significaba lo que yo necesitaba que significara, que es
[[instrumentos-que-confirman-en-vez-de-verificar]] cometido mientras escribía sobre él.

## Qué hacer en vez

**Para "¿hay alguien más usando esto?", el muestreo es el instrumento equivocado.** Buscar el
**registro de actividad**, no la quietud:

- Un recurso compartido casi siempre tiene log, lock, lista de conexiones o dueño declarado. Eso
  responde la pregunta; una foto quieta, no. *(Acá: planificación resolvió en un minuto lo que yo no
  pude en veinte — contó los comandos ADB en los transcripts de las dos sesiones. 268 vs 1424.)*
- Si no hay registro, **preguntar** es más barato y más confiable que inferir.
- Y si igual se va a muestrear: el control tiene que poder **fallar**. *¿Qué vería si hubiera alguien?*
  Si la respuesta es "posiblemente lo mismo", el control no sirve.

## La regla que sale, y es la que generaliza

**Medir que un recurso está disponible no es medir que me toca.** Verifiqué correctamente que el
teléfono estaba conectado, y de ahí salté a usarlo sin preguntarme de quién era. Disponibilidad y
propiedad son dos preguntas, y sólo respondí una.

Para un recurso **físico y único** —un teléfono, un puerto, un dispositivo— no existe el equivalente
de "rutas explícitas" que hace convivir a dos sesiones sobre el mismo repo: hay **una sola pantalla,
un solo foco, un solo estado**. La única disciplina que funciona ahí es **dueño único**, como el
deploy y las migraciones. Ver [[coordinacion-tres-sesiones-buzon]].

Y el daño no es "se estorban": dos actores sobre la misma pantalla **se fabrican evidencia falsa
mutuamente**. El tap de uno cambia la captura del otro, y el caso peligroso es el que **sale bien** —
un verde que nadie cuestiona. Toda prueba corrida en esas condiciones vale cero, la que dio bien
también.
