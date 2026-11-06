---
name: un-mecanismo-correcto-queda-inerte-por-un-cambio-de-entorno
description: Dos veces el mismo dia: un guard y un candado, ambos correctos, apagados por un cambio de entorno que nadie conecto con ellos. El disparador vive donde nadie lee el codigo.
metadata:
  type: project
---

**El 2026-11-06 este repo pago el mismo defecto dos veces en horas, en dos capas sin relacion.** No
es coincidencia: es un modo de falla con forma propia.

| | El guard del STT | El candado de los gates |
|---|---|---|
| El codigo | correcto, umbral bien elegido | correcto, `mkdir` dentro del `if`, TTL exigido, owner verificado |
| Lo que lo apago | `GROQ_STT_MODEL` paso a `turbo`, que devuelve `no_speech_prob = 0` siempre | el binario `mkdir` del runner (Ubuntu 26.04, sospecha: uutils) no serializa bajo carrera |
| Sintoma | **ninguno**: un guard roto hacia el «no» nunca dispara | **ninguno en prod**; en CI un flake que se lee como ruido |
| Quien lo rompio | quien cambio el modelo por costo y cupo | quien eligio la imagen del runner |
| Quien podia verlo | nadie que leyera `stt.py` | nadie que leyera `candado-stage.sh` |

## Lo que comparten, y es la leccion

**El disparador del fallo vive en una capa que no contiene el mecanismo**, y la persona que lo
acciona no tiene motivo para abrir el archivo que depende de el. El comentario en el codigo —la
mitigacion refleja— **no alcanza**: lo lee quien toca ese archivo, y el que va a romperlo es quien
cambia el env, la imagen o el sistema operativo.

Medido: el guard del STT estuvo inerte desde el cambio de modelo con **su test en verde todo el
tiempo**, porque la fixture era de otro modelo
([[el-test-que-no-usa-el-camino-de-produccion-no-puede-verlo-fallar]]). Y el candado real corre
`mkdir` por ssh en el VPS: hoy 24.04 con GNU coreutils 9.4, sano. **Si el VPS se actualiza a 26.04,
la exclusion mutua de los gates se rompe en silencio.**

## 🔴 Deuda abierta con disparador, no con fecha

**Dueno:** backend · **Disparador:** cualquier actualizacion del VPS de Ubuntu 24.04 a 26.04, o un
cambio de imagen de los runners. **No tiene fecha de vencimiento porque no la gobierna el calendario
sino un evento**, y por eso un TODO fechado no servia.

Lo que hay que haber hecho antes de ese evento: que el candado **no dependa del binario `mkdir`**.

## El detalle que casi arruina el fix

La lista de reemplazos candidatos incluia `ln -s`. **`ln` tambien es coreutils**: si la causa es
uutils, cambiar `mkdir` por `ln -s` mueve el problema de un binario roto a otro del mismo paquete
reimplementado por el mismo proyecto, y no da sintoma hasta la proxima carrera. Quedan:

- **`flock`** — es **util-linux**, otra cadena de suministro, que es justo la propiedad buscada. Y
  semanticamente mejor: un lock de kernel se libera si el proceso muere, asi que **borra la necesidad
  del TTL de 1800 s** que existe solo porque un directorio huerfano no se auto-libera.
- **`python3 -c os.mkdir`** — syscall directa, sin binario intermedio.

**«Cambiar de primitiva» no es el fix completo.** Si se cambia y se vuelve a confiar en que la nueva
es atomica *en el entorno donde corre*, se repite el error: hay que dejar **un control que falle si
no lo es** —unos pares simultaneos al arrancar, o un test en el entorno real—. La propiedad que
importaba nunca estuvo medida; eso es lo que la hizo invisible durante semanas en los dos casos.

## Como se cazaron los dos

Ninguno por un test. El del STT, porque alguien noto que **el 0,7 de un comentario no coincidia con
el 0 de un spike**. El del candado, porque un flake con tasa alta (3 verdes / 3 rojos en 8 corridas
de main) se instrumento en vez de reintentarse. **Las dos veces el sintoma fue una discrepancia entre
dos mediciones, no un fallo.** Y la del candado casi se perdio: a esa tasa el reflejo es «reintenta»,
y ahi es donde un rojo real se cuela sin que nadie lo mire
([[un-instrumento-compartido-intermitente-fabrica-una-excusa-lista]]).
