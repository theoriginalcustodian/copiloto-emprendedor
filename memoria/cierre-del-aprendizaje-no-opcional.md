---
name: cierre-del-aprendizaje-no-opcional
description: "El entregable de un sprint no es \"sin errores\" sino el cierre del aprendizaje — cada fallo termina en \"no puede volver por construcción\""
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 12059cb1-332d-4821-a3ba-e04ea45ababe
---

El operador (2026-06-25, cierre del sprint billing): *"lo importante no son los errores que encontramos sino cómo los corregimos y cómo evitamos que vuelvan a ocurrir; por eso es importante el cierre del aprendizaje en todos los sprints."*

**Why:** en una fábrica autónoma y recursiva el error **aislado** cuesta poco; el error que **vuelve** compone (cada agente futuro lo redescubre y paga el interés). El valor no está en no equivocarse — los errores son parte del desarrollo — sino en que cada fallo quede **cerrado de raíz**. Es la cara operativa de *cero deuda no-gestionada* + *raíz no parche* + *no codificar la esperanza*, elevada a **criterio de cierre de TODO sprint**, no opcional.

**How to apply:**
- **Test binario del cierre:** por cada error encontrado, preguntar *"¿puede volver a ocurrir?"*. Si la respuesta no es **"no, por construcción"**, el cierre NO terminó.
- "Por construcción" = (1) fix en el **mecanismo de la fábrica** (no en mi scratchpad ni en un paso manual que el próximo desarrollo deba recordar) + (2) **test de regresión** que falla sin el fix + (3) entrada en el **catálogo de errores** (`docs/2026-06-24-catalogo-errores-fabrica-remediacion-raiz.md`) movida a ✅ Raíz.
- Un parche en scratchpad que funciona es *codificar la esperanza a nivel de proceso*: espera que el futuro lo recuerde. El cierre real es cuando el aprendizaje deja de ser un script que yo corro y pasa a ser una activity/guard que el sistema corre solo.
- **El cierre del aprendizaje es un entregable del sprint**, junto al código: reporte + catálogo de errores actualizado + memoria. Sin eso, el sprint no está cerrado aunque el feature funcione.

Ejemplo canónico: sprint billing (2026-06-25) — 6 raíces (J25–J30) todas a ✅ con test de regresión + absorción a la fábrica (patcher, detección de deps, guard de provision, push robusto). Ver [[billing-system-sistema-compuesto]].

[[cero-deuda-no-gestionada]] [[no-codificar-la-esperanza-principio-raiz]] [[raiz-no-parche]] [[spike-first-central-proyecto]]

---

## 🔻 Refuerzo 2026-10-07 — el espejo: no un error que vuelve, una **observación que no puede volver**

El enunciado de arriba mira **errores**: *¿puede volver a ocurrir?* El caso de hoy es la cara que falta,
y es más difícil de ver porque **nada falla** cuando la respuesta es mala: **una observación que
acreditó un contrato y después no puede volver a correr.**

Medí los 5 terceros del copiloto (`origin/main` = `85435592`) preguntando *¿quedó un instrumento
repetible contra el sistema real?*:

```
GoTrue    : spike -> PROMOVIDO a deploy/copiloto/test-gotrue.sh + docker-compose.test-override.yml ✅
Composio  : 6 tests gateados por env var, salteables sin ella ✅
Graphity  : gateado por env var ✅     LLM: 12 archivos, varios con skipif ✅
ARCA/AFIP : 4 spikes, 4 facturas C emitidas en homologación real (CAE=86290616997729, 2026-07-21),
            93 tests... y CERO instrumento repetible. test-afip*.sh -> 0 (control positivo: gotrue -> 1)
```

**Lo que hace al caso ARCA distinto de una preferencia de cobertura:** los 93 tests son **buenos**
—validan reglas de fecha, condición del emisor, idempotencia— y están **verdes**. Y el propio repo
documenta la delegación, en `apps/copiloto/tests/test_afip_gateway.py:3`:

> *«El objetivo **no es probar que AfipSDK funciona** (eso lo probó **el spike** contra homologación
> real): es…»*

El test **sabe** que no mira el contrato y apunta a un artefacto de hace 2½ meses que no puede volver
a correr. **Cobertura alta y contrato sin observar se ven idénticos desde el gate.**

Y el contra-caso prueba que el patrón es ejecutable: con GoTrue el spike **se promovió** —su compose
quedó como override de test y un `skipif` por `UC_TEST_GOTRUE_URL` lo gatea—, así que la observación
**vuelve** cada corrida. La diferencia entre los dos no es técnica: es si alguien hizo el paso de
promoción.

**Y la forma honesta de la deuda, que también medí:** `spikes/mp-salud-conexion/RESULT.md` abre con
*«no se revocó una credencial MP real en vivo — no hay sandbox de vendedor MP en este entorno;
**declarado, no asumido**»* y cierra con «Sin verificar en vivo». **Eso es correcto** — es deuda
deliberada y visible ([[cero-deuda-no-gestionada]]). Lo que falla no es no poder observar: es
**observar una vez y no dejar cómo repetirlo**.

**How to apply:**
1. Cuando un **spike** valida un supuesto crítico contra un sistema externo, el cierre tiene **dos**
   entregables: el veredicto **y** la promoción a algo repetible (un harness gateado por env var,
   salteable sin ella). Sin el segundo, el veredicto es una **foto con fecha**
   ([[un-umbral-calibrado-es-una-foto-del-sistema-de-ese-dia]]).
2. **El instrumento de esta clase de deuda es contable:** por cada tercero, contar los archivos
   `deploy/**/test-<tercero>.sh` y las env vars que gateen un test. Un `0` nombra al tercero cuyo
   contrato nadie observa, **aunque tenga 93 tests verdes**.
3. Si no se puede observar (no hay sandbox), **declararlo donde se lea** — una fila o una entrada de
   memoria, no sólo el `RESULT.md` de un spike. Un límite que vive en un spike no lo encuentra el que
   escribe el próximo test.
4. ⚠️ Al medir esto, *«¿cuántos tests mencionan X?»* y *«¿cuántos están gateados por X?»* son **dos
   poblaciones con el mismo nombre corto**: 7 archivos mencionaban `AFIP_ACCESS_TOKEN` y **6 eran
   `monkeypatch.setenv`**, que es lo contrario de hablar con el real. El grep de menciones casi me hizo
   retirar un hallazgo verdadero ([[una-asimetria-entre-gemelos-no-prueba-que-uno-este-mal]]).
