---
name: un-dano-afirmado-desde-un-solo-lado-no-es-hallazgo
description: Tres veces en un día un sub-agente afirmó «esto duplica» leyendo sólo el cliente; dos veces el backend ya lo impedía. Refutarlo bien es lo que destapó los dos casos donde NO había defensa. Al ir a buscar la defensa del acusado, preguntá por todos sus hermanos.
metadata:
  type: feedback
---

# 🔗🎭 Un daño afirmado desde UN SOLO lado de la costura no es un hallazgo

**LEER cuando alguien —vos, un sub-agente, un informe— afirma «esto duplica / filtra / borra» citando
sólo el código del cliente, o sólo el del servidor.**

## Qué pasó (2026-09-22, barrido de estado efímero)

Tres veces en la misma jornada un sub-agente entregó un daño afirmado desde una sola capa:

1. **Anulación de factura**: «riesgo fiscal no descartado, el POST va sin `idemKey`». Falso — el
   servidor usa un workflow id determinístico y `USE_EXISTING`: dos toques se enganchan a la misma
   anulación (`web.py:423-429`).
2. **Ingreso duplicado en mobile**: «duplicación de datos financieros reales, la clave se regenera al
   remontar». Falso en el caso normal — el backend corre `posible_duplicado` **antes** de insertar, en
   dos puntos distintos, y la app muestra la pregunta en vez de reintentar sola.
3. **Cliente duplicado en mobile**: «el resultado práctico es el mismo que en gasto». Falso — el alta
   choca contra un **índice único** por nombre normalizado, y forzarlo es un gesto explícito del
   usuario.

Los tres razonamientos eran correctos **dentro de su mitad**. Lo que faltaba no era rigor: era la
otra capa.

## El giro, que es lo que hay que aprender

Lo valioso no fue descartar los falsos positivos. Fue que, **para poder descartarlos, tuve que ir a
preguntarle al backend "¿vos qué hacés si esto llega dos veces?" — y esa pregunta, hecha a las cinco
tarjetas en vez de sólo a la acusada, encontró las dos donde la respuesta era "nada"**: gasto (sin
clave de idempotencia en ninguna capa, sin índice, sin detector) y presupuesto («sin `idem_key`, una
fila nueva cada vez»). Ésos sí duplican plata en silencio, y nadie los había señalado.

Si me hubiera limitado a responder «el sub-agente se equivocó», cerraba el frente con un falso
negativo del tamaño exacto del hallazgo real.

## Por qué el error se repite y no da síntoma

Leer una capa es barato y **se siente completo**: el código del cliente dice qué manda, con qué
valores, en qué orden. La conclusión sale redonda. Nada en esa lectura señala que falta la mitad —
la costura no está escrita en ninguno de los dos archivos. Y el veredicto llega con forma de hallazgo
grave, que es justo la forma que menos se cuestiona.

El espejo también existe: descartar un daño porque *el servidor lo maneja* sin verificar que el
cliente no lo desarme (reintentando solo, forzando, ignorando el 409).

## La regla

1. **Un «duplica / filtra / rompe» que cita una sola capa está `[INCOMPLETO]`, no confirmado ni
   refutado.** Falta leer la otra punta: índice único, detector previo, id determinístico, saldo,
   fail-closed — o la ausencia de todos ellos, que también hay que **probar** (verificá que el archivo
   donde buscás exista antes de creerle al cero).
2. **Al ir a buscar la defensa del acusado, preguntá por todos sus hermanos en la misma corrida.** Ya
   estás leyendo esa capa; el costo marginal es casi nulo y ahí es donde aparece el caso sin defensa.
   Preguntar por uno solo convierte una auditoría en un juicio.
3. **Encargá la pregunta explícita.** Al delegar, pedir «seguí la cadena hasta el POST y decime qué
   hace el servidor si llega dos veces» cambia el resultado. La tercera vez lo pedí así y el reporte
   volvió con la mitad correcta y la mitad todavía sin verificar — mejor, pero igual hay que cerrarlo.

Relacionado: [[la-costura-leia-un-campo-que-nadie-escribe]] ·
[[defensa-deshecha-por-una-regla-correcta-de-la-otra-capa]] ·
[[clasificar-un-hallazgo-por-su-etiqueta-y-no-por-su-codigo]] ·
[[vacio-no-es-hallazgo-correr-el-control]] · [[el-instrumento-tambien-CONDENA-no-solo-absuelve]]
