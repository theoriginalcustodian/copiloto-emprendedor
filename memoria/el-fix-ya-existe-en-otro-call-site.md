---
name: el-fix-ya-existe-en-otro-call-site
description: Los bugs de este repo no vienen de no saber cómo arreglarlos — vienen de que el fix se construyó, se documentó, y no llegó a los otros call-sites; antes de diseñar, buscá el fix del MISMO bug en el propio repo
metadata:
  type: feedback
---

**Ante un bug, la primera pregunta no es "¿cómo se arregla?" sino "¿ya está arreglado en otro lado de
este repo, y por qué no llegó acá?".**

La auditoría de manejo de errores del 2026-07-28 encontró **siete instancias del mismo patrón** y
ninguna era ignorancia:

- `errores_web.conflicto()` resolvió el "409 que aterriza en la rama de otro" con catálogo cerrado y
  guard de test → cubre **12 de ~90** emisiones de error (sólo los 409).
- `ApiError.body` se creó explícitamente *"para que nadie más pague ese precio"* → `afip.ts:483`
  sigue bypasseando el cliente **citando como razón justo lo que `ApiError.body` ya resolvió**.
- El refresh-on-401 de `request()` → los **dos** frontends, por separado, dejaron el camino de voz sin él.
- PR#114 ("una activity que lanza no puede matar el workflow en silencio") → el patrón sigue vivo en
  los sitios agregados **después** del fix.
- `memory_provider.py` es el molde de log-antes-de-degradar → 3 sitios hacen la misma degradación sin log.
- `llm.py` pone timeout de red **bajo** el `start_to_close` → 2 de 6 gateways lo hacen.
- `afip_anulacion_workflow.py`: el criterio correcto está escrito **tres líneas más abajo**, en el
  mismo archivo, en un bloque de deuda gestionada — y no se aplicó al sitio de al lado.

**Qué hacer con esto:**

1. Al diagnosticar, grepeá el patrón del fix (no del bug) en todo el repo. Si aparece: el trabajo es
   **propagar**, no diseñar — y eso cambia la estimación por un orden de magnitud.
2. Al arreglar, preguntá *¿cuántos otros sitios tienen esta forma?* y arreglalos en el mismo PR, o
   dejá el TODO visible. Un fix que no se propaga garantiza que el bug vuelva con otro nombre.
3. **Un comentario que explica el fix no propaga el fix.** Los docstrings de este repo son
   excelentes y aun así el sitio de al lado no los aplicó. Sólo un gate mecánico propaga.

**La causa medida, no supuesta:** no hay nada que fuerce la propagación — **cero ESLint/ruff en el
repo**, el CI corre **11 de 92** tests de Python y **0 de 96** de TypeScript, y `test_errores_web.py`
—el único guard mecánico del contrato de error— **no está en la lista del CI**. Es
[[cero-deuda-no-gestionada]] en su forma más barata de pagar: el conocimiento ya está escrito, falta
el gancho que lo obligue. Relacionado: [[la-deuda-vencida-no-siempre-se-paga-en-un-paso]] ·
[[un-fix-de-razonamiento-no-viaja-con-el-codigo-copiado]].

---

## Refuerzo (2026-09-30): la herramienta la produjo el incidente ANTERIOR del mismo guard, y la urgencia fue justo lo que impidió buscarla

El `reconcile` del grafo abortó con *«el diff borraría 1406 objetos (tope absoluto 200)»* y frenó el
`push` de las 4 sesiones. Dos sesiones plantearon la decisión como binaria, y la escribieron así:
*«el CLI del bridge solo ofrece `--force`»* → o **borrar a ciegas** 1406 objetos, o **no limpiar nunca**
(y con el `pre-push` fail-closed sobre el sync, no limpiar = nadie pushea).

**Había una tercera salida, escrita el 2026-07-31, por este mismo guard**, cuando fueron 221 objetos
contra el mismo tope de 200:

```
scripts/graphity_dry_run_reconcile.py — """Dry-run del reconcile: enumera QUE borraria el sync, sin borrar nada."""
  "El guard estaba bien; lo que faltaba era poder mirar."   <- su propio docstring
```

Correrla tardó un minuto y contestó la pregunta entera: **FALTANTES 0** (la ingesta completó),
**1403 de 1404 aristas** eran las `co_change` de `min_support=2` que la re-poda a 3 dejó fuera
(2190 − 786 = 1404, cuadra), y los 2 nodos eran un archivo **movido** de `scripts/evidencia/` a
`scripts/tests/`. Veredicto por el criterio que el propio script declara: **el `--force` era seguro**.

**Why:** porque la frase que bloquea no es «no sé cómo arreglarlo», es «**sólo hay estas dos opciones**»
— y suena a diagnóstico, no a búsqueda incompleta. El patrón se agrava con la urgencia: cuando el
bloqueo afecta a todos, nadie se detiene a buscar, y **el incidente anterior del mismo mecanismo es
precisamente el lugar donde alguien ya dejó la herramienta**. La tenía escrita la misma flota, para
este mismo tope, dos meses antes.

**How to apply:** (1) ante un guard que aborta, antes de discutir si forzar, preguntá **si existe un
dry-run** — un guard que aborta sin poder mirar es un incidente que alguien ya vivió; (2) buscá por el
mecanismo, no por el síntoma (`grep -rl dry.run\|reconcile` en `scripts/`, no «error 1406»); (3) cuando
enunciés una decisión como binaria, escribí **qué buscaste** para descartar la tercera opción — si no
buscaste, no es binaria, es desconocida; (4) el momento de mayor urgencia es el de mayor riesgo de
reinventar: el bloqueo compartido presiona a actuar, no a inventariar.

---

## Refuerzo 2026-10-05 · «el fix ya existe» exige verificar que la pieza existente EJERCITE el camino del consumidor, no que comparta el nombre del problema

Diagnostiqué bien un falso rojo del gate —un test comparaba dos lecturas de un recurso que otras
sesiones mutan— y prescribí el fix con esta frase: *«El fix ya existe y es tuyo, no hay que diseñar
nada: `fabricar-corpus-fixture.py`, que está en #770»*. La dueña del archivo lo arregló y **corrigió
la prescripción**: ese fixture fabrica **tablas con veredictos** para el contador, y el test roto no
lee tablas — lee **nombres de archivo** y busca un marcador en los `cierre_`. Un corpus de veredictos
no ejercita nada de lo que ese test mira. Lo que sí servía ya estaba **dentro del propio test**
(`nuevo_buzon()`, usado por sus otros casos) más una env var que el script ya acepta.

**Por qué la recomendación se sentía sólida:** las dos piezas resuelven el mismo *enunciado* —«probá
idempotencia sobre corpus congelado en vez del buzón vivo»— y comparten el vocabulario entero
(corpus, congelado, buzón, fixture). La coincidencia de enunciado hizo de puente, y nunca verifiqué la
pregunta que importaba: **¿qué LEE el consumidor?** Un fixture es intercambiable sólo si produce la
forma que el consumidor consume; acá un lado produce filas de tabla y el otro consume nombres de
archivo.

**Y el arreglo de raíz tampoco era mover el corpus:** era **separar dos preguntas fundidas en un
caso** — el `rc` sobre el buzón real es un dato de **estado** (estable ante archivos nuevos, porque el
script los reporta en vez de fallar), mientras la **idempotencia es una propiedad del código** y por
eso se prueba sobre corpus congelado. Dos aserciones, dos casos. Mi prescripción mantenía la fusión y
sólo cambiaba el insumo.

**El test antes de recomendar reutilizar algo ajeno:** nombrar el **formato** que la pieza existente
produce y el **formato** que el consumidor lee, y exigir que coincidan — en el archivo, no de memoria.
Si no puedo nombrar los dos, lo que tengo es una analogía de vocabulario. **Reutilizar sigue siendo la
regla** ([[reutilizacion-es-regla-el-inventario-va-antes-del-diseno]]); lo que no es gratis es
**afirmar que una pieza encaja** — eso es alcance, y alcance se valida contra el sistema
([[no-codificar-la-esperanza-principio-raiz]]).

Corolario para un hallazgo entregado a otra sesión: **el diagnóstico y la prescripción se verifican
por separado.** Acá el diagnóstico era exacto (mtime incluido) y la prescripción falsa, y venían en el
mismo documento con el mismo tono — quien lo recibe no tiene cómo saber que una mitad está medida y la
otra no, salvo que se lo diga. Marcá cuál es cuál.

**REFUERZO 2026-10-05 — el fix estaba 30 líneas más abajo, en el mismo archivo.** `ci-verde.sh` daba
**ROJO** en cualquier PR con **dos pushes**: `statusCheckRollup` trae cada job **una vez por run**
(medido: 12 entradas para 6 jobs), así que `jq '.[]|select(.name==$n)|.conclusion'` devolvía dos
líneas y la comparación recibía `"SUCCESS\nSUCCESS"` → `❌ backend: SUCCESS`, condenando un job que
pasó.

La rama de `/check-runs` del **mismo script** —el fallback, 30 líneas más abajo— ya desempataba el
mismo nombre repetido tomando el `started_at` máximo, **con su comentario explicando por qué**. El
defecto vivía en el otro call-site, que nadie había tocado. No había nada que diseñar: había que
propagar.

**El agravante que vuelve esto urgente y no cosmético:** dos pushes a un PR es el caso **normal**, así
que el gate se ponía rojo casi siempre. Un guard que grita en el caso normal se saltea con `--admin`
([[el-guard-que-grita-en-el-caso-normal-se-desarma-solo]]), y fallaba hacia el NO, que parece
prudencia ([[el-instrumento-tambien-CONDENA-no-solo-absuelve]]).

## Refuerzo 2026-10-06 — antes de propagar: contar apariciones DETECTA el patron, pero no ATRIBUYE. Y el call-site que difiere puede ser un GUARD

Esta entrada dice «el fix ya existe en otro call-site: propagar, no disenar». Hoy casi la aplico sobre
un caso donde propagar **rompia un control de autorizacion**, y el error estaba en el instrumento con
el que decidi que habia algo que propagar.

Acababa de colapsar los dos campos legales de `/me` en un helper (`_campos_legales`, una expresion para
las dos ramas). Conte apariciones de los demas campos en `web.py` para ver cuales quedaban con el
patron viejo:

| campo | veces | lo que lei |
|---|---|---|
| `legal_aceptado`, `legal_version_aceptada` | 1 | ya colapsados |
| `mp_connected`, `composio_connected`, `es_admin` | **2** | «siguen duplicados, propaga el helper» |

**«2 veces» es exactamente el mismo numero para «duplicado» y para «deliberadamente distinto por
rama».** Fui a leer las dos ramas antes de recomendar nada:

- `mp_connected` y `composio_connected`: **misma expresion** en las dos ⇒ duplicacion real.
- `es_admin`: rama con token → `es_admin(claims)`. Rama sin token → **`False`**, con el comentario
  `web.py:1104` *«Sin `require_claims` no hay token que leer: `es_admin=False` es fail-closed»*.
- `cuenta_google`: igual, `False` en la rama sin token.

**Colapsar `es_admin` en un helper habria borrado ese fail-closed.** Y el refactor se ve impecable: los
tests de legal siguen verdes, el diff es «3 expresiones a una funcion», y nada grita. El guard no tiene
test propio que lo defienda — su unica defensa es el comentario de una linea que el refactor pisa.

**La regla, que es una precondicion de esta entrada, no una excepcion:** el conteo de apariciones sirve
para **encontrar candidatos**, nunca para decidir. Antes de propagar un fix a N call-sites, **leer los N
y comparar las expresiones**: si alguno difiere, la pregunta no es «como lo unifico» sino **«por que
difiere, y que se pierde si dejan de diferir»**. Un call-site que difiere es, con sorprendente
frecuencia, el unico lugar donde vive un guard.

Y el sesgo que lo hace peligroso: yo venia de **cerrar** una duplicacion real: tenia el fix fresco, el
patron en la cabeza y ganas de propagarlo. El momento de maxima confianza en un patron es el momento de
menor atencion a los casos que no encajan.
