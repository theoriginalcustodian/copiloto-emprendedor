---
name: mensaje-entregado-donde-nadie-mira
description: "Un aviso escrito en el lugar correcto pero que el destinatario no vigila NO fue entregado. Declare un `avance_` como disparador en el §9 de un contrato sin probar el cable: nacia en `cerrado/` y los vigias miraban `abierto/`. FRONTEND estuvo horas esperando algo ya hecho. LEER antes de declarar un mecanismo de coordinacion en un contrato."
metadata:
  node_type: memory
  type: feedback
---

**Escribir el mensaje no es entregarlo. Entregarlo es que aparezca donde el destinatario mira.**

**El caso (2026-07-21, noche).** El §9 del contrato de Gastos declaraba: *«backend emite un `avance_`
cuando los endpoints estén vivos; es el disparador para que la app arranque»*. Backend lo emitió a
tiempo. **FRONTEND estuvo horas repitiendo «espero el `avance_` para arrancar» con el `avance_` ya
escrito.** El formato dice que los `avance_` nacen en `cerrado/` —para que ningún acuse les pise el
`mtime` que mide el silencio— y **los tres vigías miraban `abierto/`**.

Nada estaba roto. El mensaje existía, era correcto, estaba en la carpeta que el formato manda. Y el
trabajo quedó parado igual.

**Por qué no lo cazó nadie, y es lo que hace la lección:** el modo de falla es que **el buzón no
protesta**. `abierto/` decía la verdad —no había nada pendiente de respuesta— y cada sesión concluyó
«no hay novedades» cuando lo correcto era «no hay novedades **en la mitad del buzón que estoy
mirando**». Es un vacío que no duele, hermano de [[vacio-no-es-hallazgo-correr-el-control]]: ningún
error, ningún timeout, ninguna excepción. Sólo silencio, que se parece muchísimo a que todo va bien.

**El error es de quien escribe el contrato, y era mío.** Diseñé la junta y **no probé el cable**:
declaré un disparador sin verificar que el transporte pasara por donde el destinatario efectivamente
mira. Es exactamente lo que el puesto de planificación existe para no hacer — la costura entre dos
sesiones no es de ninguna de las dos, es de quien la declaró.

**Regla dura, para todo `contrato_` futuro.** Si un contrato declara un mecanismo de coordinación
—disparador, aviso, punto de encuentro, «te avisa cuando esté»— hay que **probar el mecanismo, no sólo
escribirlo**: emitir uno de prueba y confirmar que el otro lado lo ve. Un disparador no probado es un
supuesto crítico sin validar, o sea [[spike-first-central-proyecto]] aplicado al proceso en vez de al
código.

**Y el corolario que evita el arreglo equivocado:** la reacción fácil era mover los `avance_` a
`abierto/`. Habría ensuciado la única carpeta cuyo valor es que un `ls` diga qué está pendiente, y
roto el `mtime` limpio que mide el silencio. **El problema no era dónde nace el mensaje: era que el
vigía miraba media casa.** Cuando un mecanismo falla, corregir el que está roto — no el que está bien
y es más fácil de tocar.

Hermana de [[verificar-que-el-camino-recomendado-existe]] (aquella: el camino no existía; ésta: existe
donde nadie mira) y de [[instrumentos-que-confirman-en-vez-de-verificar]] §10, que es el instrumento
parcialmente ciego que lo permitió.

[[coordinacion-tres-sesiones-buzon]] [[no-codificar-la-esperanza-principio-raiz]]
---

## Refuerzo 2026-10-07 — **appendear «al final» escribe en la sección más VIEJA del archivo**

Aquella vez el mensaje nacía archivado y el vigía miraba media casa. Esta vez lo escribí **yo**, y el
lugar lo eligió el orden del archivo, no el significado.

Durante un turno entero bajé filas nuevas al tablero (`coordinacion/PLAN.md`) con scripts que insertaban
**«después de la última fila con id del archivo»**. Sonaba seguro: respeta el formato, no pisa nada, es
idempotente. Medido al final del turno:

```
filas-id en el archivo .......... 80
dentro del bloque COLA-VIVA ..... 15      <- lo único que lee cola-check.sh
afuera .......................... 65
filas VIVAS que yo cree hoy, afuera ... 8
```

Las ocho habían aterrizado dentro de la sección **`## ✅ Cerrado` → `### COLA VIVA anterior …, todos ✅
— archivada el 2026-09-21`**. O sea: **doblemente invisibles.** El instrumento sólo parsea entre
`COLA-VIVA:INICIO` y `FIN`, así que reportaba **3 frentes activos** cuando había 6; y un humano que
escanea por encabezados saltea esa sección entera porque su título afirma que está todo cerrado.
Después del rescate, el mismo instrumento, sin tocarle una línea: **6 frentes** y la fila que ofrece
como siguiente pasó a ser una de las mías.

**Por qué el apuntador se va solo hacia el archivo, y por qué empeora con el tiempo:** la última fila
de un documento histórico es, por construcción, la **más vieja** en significado. Cuanto más archivo
acumulás, más seguro es que «el final del archivo» caiga adentro. No fue mala suerte: era el
comportamiento garantizado del criterio que elegí.

**Y lo que lo mantuvo mudo un turno completo: yo despachaba cada fila por buzón, a mano.** Backend y
FE2 trabajaron lo que les asigné, en orden, sin fricción — porque el mensaje directo funcionaba. El
tablero estaba ciego y **el trabajo fluía igual**, que es exactamente la forma de
[[un-mecanismo-roto-hacia-el-no-no-da-sintoma]]: la redundancia humana tapó el canal roto. El síntoma
sólo habría aparecido el día que una sesión preguntara «¿qué sigue?» al instrumento en vez de a mí —
y ese día la respuesta habría sido «nada» o la fila equivocada.

**Cómo se destapó, y no fue leyendo el tablero:** barriendo si cada fila viva tenía **dueño nombrado**
—otra cosa— noté que la lista no incluía ninguna de las que acababa de crear. El hallazgo salió del
**denominador** otra vez: no de releer, de contar y ver que el conjunto estaba incompleto
([[un-enum-al-final-del-renglon-lo-borra-el-que-appendea]]).

**How to apply:** (1) un escritor automático no se ancla al **final del archivo**, se ancla al
**delimitador de la sección semántica** (`COLA-VIVA:FIN`, el cierre del fence) — si el formato no tiene
delimitador, ése es el primer arreglo; (2) después de escribir, **preguntale al lector de producción
qué ve** (`cola-check.sh`), no al archivo: la escritura exitosa y la lectura exitosa son dos hechos
distintos; (3) cuando un canal redundante humano existe, el canal roto **no da síntoma** — medí el
automático a propósito, porque el trabajo que fluye no lo acredita; (4) el control que vale es el
**delta del instrumento**: antes 3, después 6. Un «quedó bien» sin las dos cifras no distingue el
rescate de no haber hecho nada.
