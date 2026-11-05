---
name: dos-causas-suficientes-el-test-no-atribuye
description: Cuando dos mecanismos independientes producen el MISMO efecto observable, un test sobre ese efecto da verde aunque el mecanismo que querías probar no exista — no mide lo que creés, mide el otro
metadata:
  type: feedback
---

# 🎭🎭 Dos causas suficientes: el test verde que no puede ATRIBUIR

**Medido el 2026-08-07 (CTA5).** Escribí un test para probar que el aviso «tu sesión expiró» **se
borra** al reintentar el login: notificar → el aviso aparece → tocar «Entrar» → el aviso ya no está.
Verde. Y no probaba nada.

El aviso se renderiza con `avisoSesion !== undefined && estadoEfectivo === 'idle'`. Al tocar «Entrar»,
`estadoEfectivo` pasa a `'enviando'` — así que **el aviso desaparece de la pantalla aunque
`setAvisoSesion(undefined)` no exista**. Dos mecanismos suficientes para el mismo píxel: la limpieza
del estado (lo que quería probar) y la condición de render (que no tiene nada que ver). El test
observaba el efecto y no podía decir cuál de los dos lo causó.

## Por qué se cuela, y por qué el control diferencial NO lo caza

Esta es la parte que la hace peligrosa: **el control diferencial la deja pasar.** Revertís
`setAvisoSesion(undefined)`, corrés el test… y sigue **verde**, porque la otra causa lo sostiene. Y
como el control diferencial es justamente el instrumento que usamos para no confiar en un verde, un
verde que sobrevive a la reversión se lee como *«el fix no hacía falta»* o, peor, como que el test
está bien y el código también. La redundancia de causas rompe **la herramienta de última instancia**.

El olor a distancia: la aserción mira **un efecto lejano** (un píxel, un HTTP 200, una fila que
desaparece) y entre el mecanismo y ese efecto hay más de un camino. Cuantas más capas atraviesa la
aserción, más chances de que alguna de ellas produzca el mismo resultado por su cuenta.

## How to apply

1. **Antes de escribir la aserción, preguntá: *¿qué OTRA cosa podría producir este mismo resultado?***
   Si hay una segunda causa suficiente, la aserción no discrimina — y es un problema del test, no del
   código.
2. **Bajá la aserción al nivel donde la causa es única.** Acá: en vez de `queryByTestId(...)` sobre la
   pantalla, `expect(result.current.avisoSesion).toBeUndefined()` sobre el estado. Ahí sólo
   `setAvisoSesion(undefined)` puede producirlo, y el control diferencial vuelve a morder (lo
   comprobé: rojo).
3. **Un control diferencial que sale VERDE es un hallazgo, no un alivio.** Significa una de dos: el
   fix era innecesario, o hay una segunda causa que no viste. Investigá cuál antes de seguir — es
   exactamente el momento en que el instrumento te está avisando y suena a buena noticia.
4. Escribí en el test **por qué** está al nivel que está. Sin esa línea, el próximo lo "mejora"
   subiéndolo a la UI —parece más end-to-end— y lo devuelve a no medir nada.

## No es sólo de tests: la misma trampa en una verificación de device (mismo día, CTA7)

Dos horas después, verificando en el teléfono que la sesión sobrevive a la expiración del token: la
app abre en frío y aparece **adentro**, con el historial del chat. Captura sacada, tentación de dar
por cerrado.

Pero «la app muestra su última pantalla» es compatible con **dos** causas: *renovó el token contra el
servidor*, o *pintó estado local sin hablar con nadie*. La captura no distingue — y la que importa es
la primera. Lo que sí distingue es una línea en los logs de GoTrue del mismo minuto:
`token_refreshed · grant_type: refresh_token · POST /token → 200`.

**El patrón general:** cuando la evidencia es un efecto observable, preguntate qué otra causa lo
produciría, y buscá el rastro que **sólo** existe si pasó lo que creés. En un test eso es bajar la
aserción; en una verificación viva es ir al log del sistema que hizo el trabajo, no a la pantalla del
que lo muestra.

Y ojo con la asimetría: acá la causa alternativa era **benigna** (la app funciona igual), así que no
había ningún síntoma que empujara a mirar más. Las trampas de atribución con final feliz son las que
más viven, porque nadie vuelve sobre una evidencia que salió bien.

Hermana de [[instrumento-que-no-mira-nunca-falla]] y
[[un-mecanismo-roto-hacia-el-no-no-da-sintoma]]: aquellas son instrumentos que **no observan**; ésta
observa perfectamente y **no puede atribuir**. Y de
[[el-test-que-no-usa-el-camino-de-produccion-no-puede-verlo-fallar]], que es su espejo: allá el
camino era el equivocado, acá hay **dos** caminos correctos y el test no sabe por cuál llegó.

## Refuerzo 2026-11-05 — el canario corrido en una pantalla cuyo CONTEXTO ya determina la respuesta

Mandé a correr un canario de silencio (control positivo del STT) **en el dock de Facturación**. La
app contestó «¿Qué producto o servicio querés facturar?» y la lectura fue «el STT alucina, el
instrumento no discrimina». **Ese veredicto no atribuía nada.** Medido en el código:
`PantallaFacturacion.tsx:596` dicta sin guard de texto vacío y `useDictadoFactura.ts:76-78` pinta la
pregunta del agente ante `sin_propuesta / respuesta_sin_card`. Entonces **transcripción vacía** y
**transcripción alucinada** producen la misma pantalla — y «¿Qué producto querés facturar?» es
exactamente lo que el sistema contesta ante un dictado incompleto **legítimo**.

El error no fue del que lo corrió: fue **elegir la pantalla**. Un dock de formulario tiene un flujo
que *rescata* cualquier entrada degradada y la convierte en la misma pregunta. En el chat general
no hay nada que la rescate, y el texto dictado se ve en pantalla.

**La pregunta que lo caza, antes de correr un canario:** ¿esta pantalla puede **distinguir** las dos
cosas que quiero separar, o su flujo normal produce la misma salida para las dos? Si el contexto ya
determina la respuesta, el canario no puede fallar de forma informativa.

**Y el remate, que es la parte útil:** cuando backend midió el control que sí aislaba (WAV de
silencio a `POST /transcribir`, sin device), resultó que el STT **sí** alucinaba — devolvió
`«Gracias.»` en **6 de 6** corridas. O sea que la conclusión era correcta **y el test seguía sin
acreditarla**. Un veredicto que acierta por casualidad es indistinguible de uno medido, y éste casi
bloqueó la pasada entera: con la firma estable ya identificada, el canario volvió a servir sin
arreglar nada.

---

## Refuerzo 2026-11-05 — el CONTADOR del janitor no atribuye, y le puse la causa que quería

El caso original es un test con dos causas suficientes. La variante que me agarró hoy es más barata y
más fácil de no ver: **un contador de salida**.

El janitor del buzón imprime `archivados 6`. Archiva por **dos** caminos suficientes: el TTL de 90 min
(tráfico viejo) y —desde ayer— el campo `CIERRE:` auto-declarado de una obligación. Acababa de
arreglar el reconocimiento del campo, corrí el janitor, leí `archivados 6` y escribí en el cuerpo del
PR: *«6 obligaciones cerradas archivadas»*. **El número no dice cuál de los dos caminos lo produjo**,
y yo le puse el que estaba probando.

**Lo que medía de verdad:** conté cuántas obligaciones de `cerrado/` tienen el campo → **0 de 998**.
Los 6 eran tráfico (`dato_`/`avance_`/`cierre_`), archivado por TTL como cualquier día. Mi fix no
había archivado nada todavía, y por una razón que el propio test ya documentaba: los 14 cierres que
escribí estaban **dentro del TTL**, así que el janitor por diseño no los toca aún.

**Por qué el error es fácil:** el contador salió **justo después** de mi cambio y en la dirección que
yo esperaba. Un número que confirma lo que acabás de hacer no pide atribución — la regala. Y el PR ya
estaba escrito, así que la frase falsa viajó en el mismo PR que arregla este tipo de defecto.

**La pregunta:** *¿cuántos caminos producen este número, y cuál discriminaría entre ellos?* Si el
contador agrega dos causas, la medición que atribuye no es el contador: es **la propiedad del sujeto**
— acá, «¿los archivos movidos tienen el campo?» ([[el-control-que-mide-la-propiedad-destapa-el-defecto-ajeno-el-que-mide-mi-accion-no]]).

**Y lo que sí sostenía el fix** era el test con su control negativo (patrón viejo → 3 fallos; nuevo →
8/8). Cuando el efecto en producción **no se puede** medir todavía, lo correcto es decir eso —
«verificado por el test, el efecto llega en la próxima pasada» — y no rellenar el hueco con un número
cercano ([[sin-evidencia-no-esta-listo]] · [[una-observacion-no-reproducida-se-degrada-a-observacion-no-se-retira]]).
