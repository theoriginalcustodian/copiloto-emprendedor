---
name: dos-implementaciones-del-mismo-cliente-el-fix-llega-a-una
description: Web y mobile tenían DOS clientes HTTP (uno copia del otro). El fix fue al core, la web usaba el suyo, y tres suites verdes no lo vieron — porque nadie preguntó qué capa ejecuta la pantalla.
metadata:
  type: feedback
---

# 🔀🧬 Dos implementaciones del mismo cliente — el fix llega a UNA, y los tests no protestan

**Caso (2026-08-07, CTA7).** Se arregló la renovación de sesión en `packages/core`. PR #342: 6/6
checks verdes, mergeado, web desplegada. Al **abrir el navegador** —no a mirar el semáforo— el
defecto seguía vivo: borrar sólo el access token y recargar seguía borrando el refresh y mandando al
login.

**La causa:** hay **dos clientes HTTP**. Chat, conexiones y cuenta de la web no usan el del core:
usan `apps/copiloto-web/src/lib/api/client.ts`, una **copia** con la lógica vieja — hasta el
comentario del single-flight es el mismo texto palabra por palabra. El fix llegó a una de las dos.

## Tres instrumentos en verde sobre un defecto vivo, y ninguno roto

| Instrumento | Dijo | Por qué no vio nada |
|---|---|---|
| 28 test files del core | ✅ | probaban el código correcto… que la web no ejecuta |
| 65 test files de la web | ✅ | no existía test para ese caso |
| deploy | ✅ | subió el bundle nuevo, con el defecto adentro |

Esto es lo que lo vuelve peligroso: **no hubo ningún instrumento defectuoso.** Los tres contestaban
bien la pregunta que se les hacía. La pregunta que **nadie** hacía es *«¿esta capa es la que la
pantalla realmente usa?»*.

## El matiz que esta entrada agrega a sus hermanas

El repo **ya lo decía**. El docstring de `almacenTokens.ts` declara «MISMAS claves que
`lib/api/client.ts` (el cliente propio de web, usado hoy por chat/connections/account)». Se leyó, y
no se entendió como lo que era: **la declaración de que hay dos clientes**.

Por eso no alcanza con [[el-test-que-no-usa-el-camino-de-produccion-no-puede-verlo-fallar]] ni con
[[verificar-la-composicion-root-no-el-default]]: aquéllas asumen que el dato hay que ir a buscarlo.
Acá el dato **estaba disponible y era correcto**, y no protegió — porque un dato sólo se vuelve
relevante cuando alguien le hace la pregunta que lo activa. Leer no es entender; el docstring era una
advertencia y se procesó como una nota de mantenimiento.

## Qué hacer, concretamente

**Antes de dar por cerrado un fix en una capa compartida (`core`, `packages/*`, un cliente, un
helper), contá las IMPLEMENTACIONES, no los llamadores.**

```bash
# ¿cuántos archivos definen esta responsabilidad, no cuántos la usan?
grep -rln "Authorization.*Bearer\|refreshSession" --include=*.ts apps/ packages/
```

Dos archivos que definen lo mismo = **dos lugares donde aplicar el fix**, hasta que uno se elimine.

Y la verificación que sí discrimina: **ejercitar el defecto desde la pantalla real** (navegador,
device), no desde el test de la capa que arreglaste. Un fix en `core` verificado por los tests de
`core` es un tautología si la pantalla no ejecuta `core`.

## La señal barata de que estás en este caso

- Un comentario o docstring que menciona «mismas claves que…», «igual que…», «espejo de…».
- Dos archivos con el mismo nombre en carpetas distintas (`client.ts` en `packages/core/src/api/` y
  en `apps/*/src/lib/api/`).
- Un fix que pasa todos los gates y **no cambia el síntoma**. Eso no es «el fix era chico»: es que
  llegó al lugar equivocado.

## Cierre honesto

Lo detectó y lo corrigió por escrito quien lo había dado por cerrado una hora antes, **antes de que
lo descubriera un usuario**. Ese es el comportamiento correcto y hay que decirlo: la deuda que se
vuelve visible cuesta una fracción de la que se descubre en producción
([[cero-deuda-no-gestionada]]).

---

## Refuerzo 2026-10-05 · el inventario estaba COMPLETO y el fix llegó a 4 de 5

Yo había medido el radio: **5 stubs de `gh` wildcard**, y el header del fix lo cita textual — «5 stubs
wildcard, 4 de ellos en `test-ci-verde-veredicto-monotono.sh`». El fix migró esos 4 al stub compartido.
**El quinto dejó un PR rojo cinco días.**

Vivía en `scripts/tests/test-mergear-pr-veredicto-en-el-remoto.sh`, el test **de otro frente**: el PR
no lo tocaba, así que no apareció en su propio diff ni en su revisión. Y el modo de fallar es el peor
disponible: `mergear-pr.sh` delega el gate a `ci-verde.sh`, el campo nuevo cae en el `*)` del fake, el
fake devuelve el array del rollup, y **el rojo se le atribuye al cambio del PR** en vez de al
call-site que faltaba migrar.

**Lo que agrega:** contar bien el radio no alcanza. El inventario dijo 5 y el fix tocó 4 porque el
criterio de «qué archivos revisar» fue *los que este PR cambia*, no *los que el inventario nombró*.
Son dos listas distintas y la segunda es la que manda.

**El control:** al cerrar un fix de N call-sites, **contá los que tocaste contra los que listaste** —
no contra los que fallaban. Un call-site que todavía no fallaba es exactamente el que va a fallar
cuando el consumidor pida el campo siguiente.
