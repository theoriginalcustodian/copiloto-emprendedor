---
name: el-tipo-de-mensaje-decide-si-alguien-lo-persigue
description: Un pedido de trabajo enviado como `dato_` no lo escala ningún instrumento — el prefijo no es etiqueta, es a qué cola entra
metadata:
  type: feedback
---

# El TIPO de mensaje decide si alguien lo persigue — `dato_` no escala nunca

Le pedí a backend un paso concreto de trabajo (correr el ciclo del reintento para cerrar CONS8) y lo
mandé como **`dato_`**. Backend quedó **43 minutos girando en vacío** —transcript fresco, sin mutar
nada— esperando mi `cierre_`, mientras yo esperaba su corrida. Espera mutua de manual, con los dos
lados actuando correctamente.

**La causa no fue el contenido: fue el prefijo.** `escaladores-buzon.sh:11` sólo persigue
`contrato_`, `pedido_` y `urgente_`. Un `dato_` viejo y sin responder **no dispara nada, nunca** — ni
alarma, ni `urgente_` derivado, ni deudor nombrado. Le pedí trabajo con el único tipo de mensaje que
ningún instrumento reclama.

**Por qué rinde.** El prefijo se siente como una **etiqueta descriptiva** —"esto es un dato, esto es
un pedido"— y por eso se elige por el tono del contenido. Pero no describe: **decide a qué cola entra
el archivo**. Un mismo texto, con dos prefijos, tiene dos destinos distintos: uno se persigue hasta
que alguien lo tome, el otro se archiva por TTL sin que nadie note que pedía algo. Y el fallo es
**silencioso en las dos puntas**: el emisor ve su mensaje entregado, el receptor no ve ninguna
alarma, y ningún gate protesta. Sólo aparece como ocio en la otra sesión — atribuido a ella, no al
mensaje.

**Peor todavía:** el error se cubre a sí mismo. Como el destinatario está *esperando algo mío*, su
quietud parece obediencia al protocolo, no un mensaje perdido. Fue `no-ocio-check` (🌀 GIRA EN VACÍO)
el que lo delató, no el buzón.

**La regla, corta:** *si querés que alguien HAGA algo, va como `pedido_` o `contrato_`. `dato_` es
para informar, y el buzón no lo persigue.* Antes de mandar, la pregunta no es "¿qué es esto?" sino
**"¿quiero que un instrumento le reclame esto a alguien si no lo toma?"**. Si la respuesta es sí, el
prefijo ya está decidido.

Hermana de [[mensaje-entregado-donde-nadie-mira]]: aquélla es el mensaje que llega a un lugar que
nadie lee; ésta es el que llega al lugar correcto **con la etiqueta que lo excluye de la cola**.
Y de [[trabajar-en-un-pedido-lo-silencia]], que también vive en la costura entre el mensaje y el
instrumento que lo vigila.
## Refuerzo 2026-10-08 — medido: un `dato_` con 12 filas entregó 3

Auditoría consolidó 12 hallazgos en un artefacto pegable de una sola pasada de `cat`, justamente para
eliminar la fricción de copiado, y lo emitió como **`dato_`**. Resultado medido unas horas después, en
el bloque `HALLAZGOS-DIFERIDOS` del doc de cierre: **3 de 12** (25%). Las otras 9 no estaban en ningún
archivo de `origin/main` — control positivo sobre las 3 que sí llegaron (1 archivo cada una).

**La entrega se confirmó a sí misma:** el tipo de mensaje que elegí **predijo el resultado**. Bajar la
fricción de copiado no sirve si nadie tiene la obligación de copiar: un `dato_` no lo persigue nadie.

**Qué hacer en vez de reemitir el `dato_`:** si el contenido es una fila que otro tiene que pegar,
**no se pide pegar — se baja al repo uno mismo** (es anotación, no trabajo nuevo) y recién entonces se
avisa con un `pedido_`, cuya respuesta es «no la pegues de nuevo». Lo que se versiona es lo que
sobrevive. Ver [[de-dos-artefactos-con-distinta-precision-gana-el-que-circula]].

## Refuerzo 2026-10-08 (b) — el `dato_` no evitó que **yo mismo** volviera a pagarlo, dos horas después

El caso más limpio posible, porque el emisor y la víctima son la misma sesión.

**14:24** — escribí un `dato_auditoria-a-todos` avisando que `MSYS_NO_PATHCONV=1` delante de `git
push` **aborta el gate de secretos** (gitleaks es nativo, no carga su config, y el hook es
fail-closed). Con síntoma, causa y remedio.

**~16:17** — exporté esa misma variable en un script desde otro worktree y el push abortó con el
**mismo FTL**. Dos horas, mismo día, misma sesión, mismo error.

**Por qué el aviso no sirvió:**
1. un `dato_` **no se persigue** — por diseño no escala a nadie;
2. **nadie lee el buzón antes de escribir un script** — se lee al arrancar la sesión y al cerrar un
   trabajo, no en el momento en que la trampa muerde;
3. el buzón **no está versionado**, así que el aviso no sobrevive al archivado ni llega a un clon.

**La regla que queda:** un hallazgo que es una **trampa de herramienta** (algo que vas a volver a
hacer) no se publica como `dato_`: va a **memoria versionada**, donde la busca la próxima sesión sin
saber que existe. El buzón sirve para coordinar **trabajo**; no sirve para que no repitas un error.
**Test rápido:** «¿esto me lo puedo volver a hacer **yo**?» — si sí, no es un mensaje, es memoria.

## Refuerzo 2026-11-06 (b) - y el caso mas silencioso: la pregunta que vive DENTRO de una ficha

El eje de esta entrada era el TIPO de mensaje. Falta el escalon de abajo: una pregunta que no
es un mensaje de ningun tipo, porque vive dentro de un ARTEFACTO.

El 2026-11-06 baje a backend el supuesto critico de la mitad B de `SM-P19` (¿existe via para
insertar un turno en el hilo desde una escritura de negocio?) como un `[ASSUMED_PENDING_VERIFY]`
**dentro de la ficha del backlog**, y mencione a backend en el contrato de la orden nueva, que
iba dirigido a tres destinatarios a la vez. Las dos cosas quedaron escritas y correctas. Ninguna
interpela a nadie:

| donde puse la pregunta | ¿alguien la persigue? | por que |
|---|---|---|
| `[ASSUMED_PENDING_VERIFY]` en la ficha | **no** | una ficha es un REGISTRO; el escalador del buzon no la mira |
| mencion dentro de un `contrato_` a 3 destinatarios | **no** | el contrato se persigue como UNO; nadie es dueño de un parrafo |
| `pedido_` dirigido SOLO a backend | **si** | el escalador lo cuenta y lo grita por antiguedad |

**La regla, extendida:** antes de dar por bajado un supuesto que BLOQUEA a otro, preguntate no
«¿esta escrito?» sino **«¿quien lo persigue si nadie lo lee?»**. Si la respuesta es ningun
mecanismo, no esta bajado: esta guardado. Un supuesto critico tiene UN dueño nombrado y su
propio archivo del tipo que escala, aunque el texto ya exista en otros dos lugares.

**Como se detecto, y es lo incomodo:** no lo cazo ningun gate. Lo pregunto el operador, literal
-- «le enviaste mensaje a backend por peer?». Mi reporte decia «backend debe contestar», que es
una descripcion del estado deseado, no de una accion hecha: es el mismo modo de falla de
[[prometer-no-es-ejecutar-el-gate-media-la-palabra]], en su forma mas facil de no ver, porque
ahi yo creia haberlo hecho. Escribir el requisito se SIENTE como despacharlo.

**Y el refuerzo del refuerzo:** con varias sesiones vivas, el buzon es el canal canonico pero su
latencia es el proximo cron del destinatario. Cuando el mensaje destraba a un tercero, va por
las DOS vias -- archivo del tipo que escala + peer directo. Y si no se puede saber que sesion es
cual (los ids de `ListAgents` no mapean al rol, y las firmas del buzon son de sesiones ya
cerradas), el peer se manda a todas con una PRIMERA LINEA autofiltrante («si sos backend...»),
que cuesta menos que una sesion parada esperando.
