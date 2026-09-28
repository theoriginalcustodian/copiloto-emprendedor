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

---

## Dos casos más de la misma clase, medidos el 2026-09-28 — y los dos dejan pasar **lo vecino**

**Caso 2 · el guard de path que bloquea lo lejano y sirve al hermano.** Los dos servers de
evidencia (`scripts/evidencia/server-proto.mjs:37`, `server-canario.mjs:46`) tenían
`if (!abs.startsWith(normalize(RAIZ))) 403` — **sin separador**. Medido con
`scripts/evidencia/probar-traversal.sh` (monta un RAIZ de juguete y un hermano con el mismo
prefijo, sin tocar el proto real):

| pedido | esperado | **medido antes del fix** |
|---|---|---|
| `/prototipo/` (legítimo) | 200 | 200 |
| `/../<raiz>-secreto/secreto.txt` | 403 | 🔴 **200 — sirvió el archivo de afuera** |
| `/%2e%2e/<raiz>-secreto/secreto.txt` | 403 | 🔴 **200** |
| `/../../fuera.txt` | 403 | ✅ 403 |

**La fila que engaña es la última.** El caso obvio —salir dos niveles— **sí** daba 403, y es el
único que uno prueba a mano; el que pasaba era el vecino de al lado, que es justo el caso de
activación del guard. Encima el comentario de `server-proto.mjs` decía *«se normaliza y se exige
que quede dentro de la raíz»*: la propiedad **afirmada**, no tenida ([[el-guard-se-satisface-con-su-propio-comentario]]).
Fix: `resolve(join(RAIZ_ABS, rel))` y comparar contra `RAIZ_ABS + sep`. Vivía **dos veces** y el
fix fue a los dos ([[el-mismo-defecto-vivia-dos-veces-el-fix-en-la-capa-compartida-no-alcanzo]]).

**Caso 3 · el hook cuya rama DEGRADADA es la que deja pasar.** El `pre-push` del repo reconcilia
el grafo antes de empujar. Mismo hook, mismo contenido, veredictos opuestos según un recurso
compartido:

| estado del lock del grafo | qué hace | push |
|---|---|---|
| **libre** | reconcilia → `abortado: el diff borraría 436 objetos (tope 200)` | ⛔ frenado |
| **ocupado por otra sesión** | `otro sync está corriendo (pid=…) — salgo sin tocar el árbol` | ✅ **pasa** |

**La rama que autoriza es la que no pudo hacer su trabajo.** ⚠️ **Matiz medido después, y hay que
ser exacto: acá la degradación está DECLARADA, no es un fail-open accidental.** `.githooks/pre-push`
abre con `set -euo pipefail` (`:4`), así que un sync que **falla** mata el hook y aborta el push —
fail-closed real—; el `exit 0` de `:80` se alcanza **sólo** cuando `graph-sync.sh` sale 0, y el
comentario de `:70-73` dice por qué: *«es contención, no fallo: el marcador queda viejo y el próximo
push reintenta»*. El escáner de secretos además corre **antes** de todo el bloque del grafo (`:15-16`),
así que un push que pasa por contención **no** se salta el control del repo público. El patrón sigue
siendo el que hay que vigilar —preguntar qué rama autoriza—, pero **este diseño lo resolvió bien**:
el defecto era mío, no suyo.

Consecuencia propia y peor que el bug: lo medí **una sola vez**, con el lock libre, y escalé como bloqueo permanente —«esa línea es
del operador»— algo intermitente, en tres documentos. Un `pre-push` que sale sin reconciliar no
dice «todo bien», dice «no miré» ([[instrumento-que-no-mira-nunca-falla]],
[[un-inventario-de-procesos-vivos-es-un-snapshot-no-un-estado]]).

**How to apply, agregado a lo de arriba:** (3) probá el guard con **el caso VECINO**, no con el
lejano: el hermano cuyo nombre comparte prefijo, el registro del tenant de al lado, el número
inmediatamente anterior. El lejano es el que el guard sí ataja y el que fabrica la confianza.
(4) Enumerá las ramas de salida del guard y preguntá **cuál autoriza**: si la rama de «no pude
medir / otro tiene el lock / timeout» comparte salida con «está todo bien», es fail-open aunque
el log lo cuente. (5) Antes de escalar un bloqueo a alguien, **re-medilo** — un bloqueo que
depende de un recurso compartido se mueve, y declararlo permanente le pasa a otro una deuda que
no existe.
