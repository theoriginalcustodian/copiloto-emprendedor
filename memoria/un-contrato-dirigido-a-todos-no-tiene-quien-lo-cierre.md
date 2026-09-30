---
name: un-contrato-dirigido-a-todos-no-tiene-quien-lo-cierre
description: El buzón cierra por "quien termina el trabajo mueve el archivo", y eso supone UN dueño. Un mensaje a-todos puede estar cumplido por las tres sesiones y quedar en abierto/ para siempre, con el escalador persiguiéndolo con creciente urgencia sobre trabajo entregado
metadata:
  type: feedback
---

**El caso (2026-09-29).** Al reanudar, el hook me entregó tres bloqueantes. El `urgente` del escalador
perseguía un `contrato_planificacion-a-todos_FACTID…` con **210 min** en `abierto/` y la leyenda
«disparador cumplido y nadie lo movió a `en-curso/`». Medido contra `origin/main` —no con un `grep` del
árbol— **los tres lados estaban implementados y mergeados**: el core compartido
(`packages/core/src/api/afip.ts:806`), web y mobile. Y había **dos avisos previos** diciéndolo (un `dato_`
de backend y un `cierre_` de FE1).

## El mecanismo, y por qué no es un escalador mal calibrado

El protocolo del buzón cierra así: **el estado es la ubicación del archivo; quien toma un trabajo lo
mueve, y quien lo termina, también.** Eso funciona porque cada mensaje tiene **un** destinatario que se
reconoce dueño, y un `mv` no puede desincronizarse como un tablero.

**`a-todos` rompe la precondición, no el instrumento.** Con tres capas involucradas, las tres pueden
hacer su parte —acá las tres la hicieron— y **ninguna es la que mueve el archivo**, porque moverlo
afirmaría algo sobre las otras dos. No es negligencia ni olvido: **es el único comportamiento correcto
disponible para cada sesión por separado.** El contrato queda en `abierto/` **por construcción**, y el
escalador lo persigue para siempre.

> Un protocolo de cierre basado en «el dueño mueve el archivo» **no tiene estado terminal para un mensaje
> sin dueño único.** El destinatario `a-todos` no es una lista de dueños: es **cero** dueños.

## El costo real, que no es el ruido

**Un `urgente` que grita sobre trabajo cumplido enseña a saltear los `urgente`.** Es el guard
desarmándose solo en su caso normal ([[el-guard-que-grita-en-el-caso-normal-se-desarma-solo]]), y el
próximo contrato realmente abandonado se va a leer **igual que este**. El escalador no distingue
«nadie lo tomó» de «todos lo terminaron y nadie podía cerrarlo» — dos estados opuestos con el mismo
síntoma, uno de los cuales no requiere ninguna acción.

Y el detalle que lo vuelve peor: **los dos avisos de entrega existían en el mismo buzón.** El escalador
mide la ubicación del archivo del contrato y es ciego a los mensajes que declaran su cumplimiento
([[un-cierre-dirigido-a-otra-sesion-puede-contener-exactamente-tu-cola]]). Hay más información en el
buzón que la que cualquiera de sus instrumentos mira.

## El fix va en el protocolo, no en el instrumento

La tentación es enseñarle al escalador a verificar el DoD contra `origin/main` antes de escalar. Es más
caro, es frágil, y **deja el agujero**: el contrato seguiría sin nadie que lo cierre. Las dos formas que
sí lo cierran:

- **(a)** el `a-todos` se **parte en N mensajes dirigidos** al abrirlo, uno por capa, cada uno con dueño
  y DoD. Cada dueño mueve el suyo y el escalador vuelve a medir lo que corresponde.
- **(b)** el `a-todos` **declara en el encabezado quién lo cierra** (por default, quien lo emitió). Una
  línea, retrocompatible, aplicable hoy a los que ya están abiertos.

(a) es más limpio cuando el trabajo por capa es independiente; (b) es lo que se aplica sin reescribir
nada. No son excluyentes.

## La regla generalizable

**Antes de emitir un mensaje, preguntá quién lo va a mover cuando esté hecho.** Si la respuesta es «el
que lo termine» y hay más de un destinatario, no hay respuesta: el mensaje no tiene estado terminal.
Hermana exacta de [[una-norma-no-tiene-estado-terminal-en-un-buzon-de-entregables]] — allá el problema
era el *tipo* de mensaje (una norma no se «entrega»), acá es el *destinatario*. Los dos son la misma
falla: **un mensaje cuyo cierre no es tarea de nadie en particular no se cierra.**

Relacionadas: [[el-tipo-de-mensaje-decide-si-alguien-lo-persigue]] ·
[[el-watchdog-que-solo-ve-al-que-llega-tarde-nunca-al-que-no-vino]] ·
[[buzon-se-ordena-por-janitor-no-por-disciplina]] ·
[[un-disparador-cumplido-no-avisa-a-nadie]].
