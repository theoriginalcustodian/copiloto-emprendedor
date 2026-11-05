---
name: un-mv-que-archiva-un-contrato-silencia-el-gate-no-la-orden
description: Archivar un contrato mueve el archivo y apaga la alarma, pero la orden que su cuerpo da sigue circulando y se ejecuta igual.
metadata:
  type: feedback
---

El gate del buzón mide la **ubicación** del archivo, no si alguien retiró lo que ordena. Archivé un
`contrato_` con la premisa vencida (entrada 20) y dos minutos después **yo mismo** mandé a backend a
medir sus precondiciones citando el cuerpo de ese contrato: estaba por sembrar un tenant para nada.

**Why:** un `mv` es un hecho sobre el filesystem; la orden vive en la cabeza de quien leyó el cuerpo.
El gate que se calla hace creer que el asunto se cerró, y el contenido sigue siendo citable — es la
versión de buzón de [[el-marcador-de-pendencia-sobrevive-a-su-propia-refutacion]].

**How to apply:** archivar por premisa vencida **no es un `mv` solo**: sale con un `dato_` que nombra
**qué quedó refutado y por qué**. Y antes de citar el cuerpo de cualquier contrato, medí el estado y
el dueño de los ids que menciona — el mío ya estaba refutado en el cierre de SM-L4, escrito por mí.
Ver [[el-contrato-que-manda-a-hacer-algo-ya-hecho]].
