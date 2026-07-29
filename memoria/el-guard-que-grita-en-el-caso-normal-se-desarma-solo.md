---
name: el-guard-que-grita-en-el-caso-normal-se-desarma-solo
description: Un guard que da falso positivo en el flujo habitual no es "ruidoso": enseña a saltearlo por reflejo, y a las dos semanas nadie lo lee. El falso positivo no degrada el guard — lo desarma.
metadata:
  type: feedback
---

**LEER al escribir cualquier gate/guard/check que pueda abortar un flujo, y al toparte con uno que
frena algo legítimo.**

2026-07-28. El guard de `deploy.sh` que impide desplegar desde un checkout desactualizado —puesto
después de que un deploy desde rama vieja rompiera `/actividad` e `/inteligencia/*` el 23-jul— abortó
un deploy **legítimo**: reportó *"1502 líneas de drift"* con el disco **byte a byte idéntico** a
`origin/main` (210 archivos verificados uno por uno, con control positivo de que el matcheo andaba).

La causa: medía con `git diff origin/main`, que compara **pasando por el índice de la rama
chequeada**. Con checkout compartido —tres sesiones, cada una en su rama— lo que `main` tiene y ese
índice no, cuenta como borrado. El guard era correcto en su intención y **estructuralmente incapaz**
de dar verde en el flujo normal del repo.

**Por qué eso es peor que un guard ausente.** Un guard que falla en el caso raro se corrige cuando
aparece. Uno que falla en el caso **normal** entrena la respuesta: la primera vez se investiga, la
segunda se sospecha, la tercera se escribe `UC_SKIP_DRIFT_CHECK=1` sin leer. A partir de ahí el guard
está **desarmado en la práctica** aunque el código siga ahí — y encima con la ilusión de protección,
que es lo que impide que alguien lo arregle. El escape hatch, pensado para el caso excepcional, se
vuelve el camino por defecto.

**La regla:** antes de dar por bueno un guard, correrlo en el **flujo habitual del equipo**, no sólo
contra el fallo que viene a cazar. Si grita ahí, el guard está roto aunque detecte bien el caso malo.
Dos preguntas que lo cazan en el momento de escribirlo:

1. *¿Qué mide exactamente, y de qué estado del entorno depende esa medida?* (Acá: del índice de git,
   que en este repo pertenece a otra sesión.)
2. *¿Cuántas veces va a dispararse por semana sin que haya un problema real?* Si la respuesta no es
   ~0, no está listo.

**Y cuando un guard te frena: leer el rechazo antes de saltearlo** ([[guard-caza-algo-distinto-de-lo-que-vigilaba]]).
Acá el skip resultó legítimo, pero **sólo después** de verificar con otro instrumento que el drift no
existía. Saltear primero y verificar después es exactamente el hábito que desarma el guard.

**El arreglo, cuando la medición depende de estado ajeno:** medir contra un índice **temporal**
(`GIT_INDEX_FILE` + `read-tree` + `add`), el mismo mecanismo que este repo ya usa para commitear en
checkout compartido — así la comparación es disco-vs-main sin que el índice real participe. Verificado
en las **dos** direcciones antes de instalarlo: disco==main → 0 y el deploy avanza; una línea agregada
→ 9 y aborta. Un guard nuevo sin control negativo es [[instrumentos-que-confirman-en-vez-de-verificar]].

Hermana de [[el-control-corrido-contra-la-base-equivocada]]: **el mismo error de medición**, primero en
mi control manual y después encontrado en un guard del repo. Cuando un modo de fallo aparece dos veces
en un día en lugares sin relación, no es casualidad: es la herramienta invitando al error
(`git diff` sin base explícita hereda la base del contexto).
