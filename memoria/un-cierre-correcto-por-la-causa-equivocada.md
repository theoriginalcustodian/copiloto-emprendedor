---
name: un-cierre-correcto-por-la-causa-equivocada
description: Una fila puede cerrar con el veredicto correcto y la causa falsa; el veredicto tapa la causa y la causa es lo que se hereda. Sólo se ve midiendo, no releyendo el cierre.
metadata:
  node_type: memory
  type: feedback
---

FE2 cerró la fila `afip` de la matriz web como **«difiere, pero no cuenta como defecto»**. El veredicto
era **correcto**. Su causa —«no es verificable porque el tenant no está vinculado con ARCA»— era
**falsa**: el tenant `e2e-device@copiloto.test` **sí** está vinculado, y prod lo renderiza
observable («Tu cuenta ya está vinculada con ARCA en Homologación», CUIT bloqueado, botón presente).

La causa real es otra y ya estaba escrita hacía días, en otro archivo:
`Prototipo frontend/odobi-ui/specs/mobile-coherencia.md:198` (A-3) dice que **el prototipo se
contradice consigo mismo** —sus reglas piden «bloqueado, sin acción» y su render muestra «Necesito
cambiarlo ›»— y que la decisión **tiene implicancia fiscal y no la toma frontend**. Nadie tenía que
reimplementar nada, que era la conclusión; el motivo era completamente distinto.

**Why:** un cierre se audita releyendo el veredicto, y el veredicto estaba bien. La causa viaja
distinto: se cita, se hereda y se reutiliza para decidir qué **no** hay que mirar. «No es verificable»
es una causa que **clausura la medición** — quien la lee no vuelve a medir, y la fila queda inmune a la
corrección. Una causa falsa con veredicto correcto es más difícil de cazar que un veredicto errado,
porque nada en el resultado se ve mal. Acá se destapó sólo porque una medición independiente fue a
mirar el DOM de prod en vez de releer el cierre.

Es el mismo mecanismo que [[una-cifra-en-un-comentario-es-un-cache-sin-invalidacion]] y que
[[martin-disena-y-la-meta-es-su-prototipo-final]]: una afirmación de estado que fue verdadera o
plausible, que nadie vuelve a chequear porque su conclusión sigue funcionando.

**How to apply:** cuando un cierre diga **«no verificable»**, «no aplica», «no se puede observar» o
«el tenant no tiene X», tratalo como **hipótesis, no como hecho** — es la única familia de causas cuyo
efecto es que nadie vuelva a medir. Pedí una observación cruda (DOM, JSON de prod, captura) antes de
heredarla. Y al cerrar una fila propia, escribí la causa con el mismo rigor que el veredicto: si no la
verificaste, decilo con `[ASSUMED_PENDING_VERIFY]` en vez de darle forma de hecho.

Caso raíz: matriz web 16/16, medición M-2 de auditoría, 2026-09-22
(`dato_auditoria-a-planificacion_BIS-mediciones.md`). La fila cierra igual — ahora citando A-3.
