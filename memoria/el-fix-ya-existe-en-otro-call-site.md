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
