---
name: el-guard-falla-abierto-en-su-caso-de-activacion
description: El check-before-act contra la doble emisión fiscal interroga el número SIGUIENTE, que por construcción nunca fue emitido — verifica una condición que no puede ser verdadera
metadata:
  type: project
---

`_emitir_sync` (`apps/copiloto/afip_factura_activities.py:74-129`) tiene dos capas declaradas
contra la **doble emisión fiscal**. Su docstring dice qué cubre la capa 2 (`:81-83`):

> *"antes de emitir se pregunta si el número siguiente ya fue autorizado. Cubre la ventana fea:
> AFIP autorizó, el proceso se cayó antes de registrar, y el reintento estaría por emitir una
> SEGUNDA factura."*

**Es exactamente el caso que NO cubre.** El código (`:94-95`) hace
`siguiente = ultimo_comprobante(...) + 1` y pregunta si **ese** existe. Pero
`ultimo_comprobante` es `getLastVoucher` (`afip_gateway.py:132-136`) — el último **autorizado
por AFIP**:

| | `getLastVoucher` | `siguiente` | `existe(siguiente)` | resultado |
|---|---|---|---|---|
| intento 1 | 10 | **11** | `False` | emite → **AFIP autoriza el 11** → se corta la red → `store.registrar` no corre → lanza |
| retry | **11** ← AFIP ya lo cuenta | **12** | `False` ← correcto | **emite el 12** |

**Facturas 11 y 12, ambas con CAE, por un solo pedido.** El guard interroga un número que
**por construcción** nunca fue emitido: sólo daría `True` si el contador de AFIP estuviera
atrasado respecto de su propia autorización. El código de adopción (`:95-109`, *"se adopta en
vez de reemitir"*) está bien escrito — **se aplica al número equivocado**. Tendría que consultar
el **último** y comparar su contenido contra el payload.

En ese escenario **ninguna capa protege**: la capa 1 (`por_idem_key`) consulta una fila que
nunca se escribió; la capa 2 consulta un número que nunca se emitió. Con `maximum_attempts=3`.

Y el `ON CONFLICT` de `afip_comprobante_store.py:52` no salva: su clave incluye `nro`, y dos
emisiones reciben **números distintos** — no hay conflicto que detectar.

**Segunda debilidad, independiente:** `existe_comprobante` (`afip_gateway.py:155-158`) además
hace `except ErrorAfip: return False` — y `ErrorAfip` es, por su docstring (`:20-21`), el error
**REINTENTABLE**. Convierte *"no pude preguntar"* en *"no existe, emití"*. Es una segunda vía al
mismo daño, más estrecha (exige que `getLastVoucher` funcione y `getVoucherInfo` falle).

**Why:** un guard que **verifica la condición equivocada** es indistinguible de uno correcto
mientras nada falle — y su docstring, que nombra bien el riesgo, actúa como certificado. Yo
mismo leí primero el `except ErrorAfip: return False` y di el caso por cerrado: encontrar **una**
falla en un guard hace dejar de buscar la siguiente, y la que había encontrado era la menor.
El error de fondo es aceptar que un guard cubre lo que dice cubrir sin **simular la secuencia
concreta paso por paso** — acá alcanzó con escribir la tabla de dos filas (intento y retry) para
que el hueco fuera obvio; razonando en prosa se pasa por alto. Hermana de
[[instrumentos-que-confirman-en-vez-de-verificar]] (allá el instrumento confirma, acá el guard
autoriza) y de [[disenar-contra-el-riesgo-temido-ciega-al-caso-normal]]: acá el riesgo temido
está bien identificado en el comentario y aun así la mitigación no lo toca.

**How to apply:** ante cualquier guard, check-before-act, circuit breaker o validación, hacer
**dos** cosas, no una: (1) **simular la secuencia real en una tabla** —estado antes, valor que
lee el guard, decisión, estado después— para el intento 1 **y** el reintento; si el guard nunca
puede dar `True` en el escenario que dice cubrir, es decorativo. (2) Leer **la rama de error**:
si el valor de "no pude averiguar" es el mismo que el de "no hay problema", es fail-open, y hay
que invertirlo — *si no puedo confirmar que es seguro, no procedo*, y el caso va a reconciliación.
Relacionado: [[idempotencia-con-un-if-tiene-ventana]] (la capa 1 de este mismo caso),
[[cero-que-no-se-puede-afirmar]], [[guard-caza-algo-distinto-de-lo-que-vigilaba]].
