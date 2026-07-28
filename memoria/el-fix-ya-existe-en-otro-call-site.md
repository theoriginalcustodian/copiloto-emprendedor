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
