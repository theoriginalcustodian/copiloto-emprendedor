---
name: anotar-adentro-el-efecto-externo-en-el-instante
description: Un efecto externo e irreversible (certificado creado en AFIP, CAE emitido, NC autorizada) tiene que quedar anotado en la base ANTES del paso siguiente. Si se guarda "al final", el paso intermedio que falla borra la única prueba de que ocurrió.
metadata:
  type: project
---

**LEER antes de escribir cualquier secuencia `efecto externo → paso intermedio → guardar`.**

Apareció **dos veces el mismo día** (2026-07-28), en dos módulos sin relación, con la misma forma:

| Dónde | La secuencia | Lo que quedaba tras el fallo |
|---|---|---|
| `afip_onboarding_activities.py` | consumir clave fiscal (**one-shot**) → crear certificado **en AFIP** → autorizar wsfe → `save` | Certificado **huérfano** en AFIP que el sistema no conocía. La clave ya gastada. El próximo intento choca con el mismo alias, ya tomado. El usuario tiene que pedir OTRA clave fiscal |
| `afip_anulacion_workflow.py` | emitir NC (**CAE real**) → marcar la factura original como anulada | La NC existe ante el fisco, la factura figura vigente, y el guard R10 —que mira ese flag— deja pasar una **segunda nota de crédito** |

**La forma.** El efecto externo ya es irreversible en el instante en que ocurre. Guardarlo "al final,
cuando todo salió bien" hace que cualquier fallo posterior —un timeout del RPA que tarda ~2 min, una
base que no responde— borre la **única prueba** de que ocurrió. Y como el sistema no lo sabe, el
camino de recuperación es el peor posible: reintentar desde cero sobre un mundo que ya cambió.

**La regla.** Lo que ya pasó afuera se anota adentro **en el instante en que pasa**, aunque el
registro quede incompleto. Un `ws_autorizados=[]` dice la verdad —tengo el certificado, todavía no la
autorización— y eso vale infinitamente más que no decir nada. Después se completa.

**El corolario que muerde.** Un guard cuya evidencia la escribe un paso POSTERIOR al efecto no es un
guard: es un guard **condicional a que ese paso haya funcionado**. Si el flag `estado='anulada'` lo
pone un UPDATE que puede fallar solo, entonces la protección contra la doble anulación desaparece
exactamente en el caso que la necesita. La evidencia tiene que salir de la MISMA escritura que
registra el efecto — por eso la NC ahora guarda `cbte_asoc_nro` junto con su CAE, y el guard pregunta
por esa asociación en vez de por el flag.

**Test que lo caza:** el que mide el DAÑO (¿nos quedamos con el certificado? ¿se emitió una segunda
NC?), no el que verifica que se llamó a `save`. Ver `test_afip_onboarding.py::
test_el_certificado_se_guarda_ANTES_de_autorizar_el_web_service` y `test_afip_anulacion_workflow.py`.

Hermana de [[el-mensaje-niega-el-efecto-que-ya-ocurrio]] (aquella es el mismo error en la CAPA DE
RESPUESTA: negarle al usuario algo que ya pasó) y de [[idempotencia-con-un-if-tiene-ventana]].
