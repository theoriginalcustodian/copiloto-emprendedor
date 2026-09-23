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

---

## Agravante 2026-09-23 — el falso positivo que NO SE PUEDE aceptar, y el guard que acusa sin señalar

La entrada de arriba dice que un guard que grita en el caso normal enseña a saltearlo. Este caso
suma dos vueltas de tuerca, y la segunda es la que lo hizo inevitable.

`secretos-check.sh --arbol` corre `gitleaks detect --no-git`, que escanea el filesystem crudo. Desde
el checkout compartido empezó a dar `leaks found: 12`. Cuatro de esos doce eran **los mismos dos
archivos ya aceptados** en `.gitleaksignore`, re-reportados con el prefijo
`.claude/worktrees/agent-a74fba7c1503928d3/…` porque el harness deja checkouts de agente adentro del
árbol.

**El fingerprint de gitleaks incluye la ruta. El nombre del worktree es aleatorio por agente.** O sea:
cada agente nuevo fabrica hallazgos con una huella que nunca existió antes y que nunca se va a
repetir. **No hay excepción que se pueda pre-escribir.** El mecanismo legítimo para decir «esto ya lo
miré y está bien» simplemente no alcanza a este caso.

Eso es peor que ruido. Un falso positivo que se puede aceptar es una molestia con salida. Un falso
positivo **incobrable** deja una sola salida: saltear el guard. Y se saltó — FE2 metió los 12
fingerprints en un `.gitleaksignore` temporal para poder sacar su PR. Hizo lo razonable (verificó
que su diff no aportaba nada, revirtió el archivo, lo reportó). El guard igual quedó desarmado por
un rato, en un repo público, y eso es exactamente cómo se pierde: nadie lo apaga de una.

**La segunda vuelta: el guard acusaba sin señalar.** Sin `-v`, gitleaks sólo dice `leaks found: 12`
— no dice qué archivos. Quien corre el gate queda con una acusación y ningún lugar donde mirar, y
desde ahí la única acción posible es genérica: silenciar todo. Con `-v` imprime File/Line/**Fingerprint**,
y el fingerprint es justo lo que hace falta para aceptar una excepción *de a una* en vez de barrer
las doce. Un guard que no señala no deja hacer lo correcto aunque quieras.

**La pregunta que faltaba hacerle al guard, antes de que alguien lo saltee:**
1. *Cuando esto grita de más, ¿se puede callar de forma legítima?* Si la excepción no se puede
   escribir —huella que cambia sola, ruta con azar adentro, un id por corrida— el guard está
   condenado, no molesto.
2. *Cuando grita, ¿dice dónde?* Si sólo dice cuántos, la única acción disponible es la más gruesa.

Verificado que `-v` no empeora el remedio: con `--redact` sale `Secret: REDACTED`. El primer control
que escribí para eso **no servía** — el canario era un string inventado que ninguna regla matcheaba,
gitleaks dijo «no leaks found» y el «0 ocurrencias en claro» no medía nada. Ver
[[el-canario-el-control-positivo-de-lo-que-falla-callado]]: el control positivo va **primero**, si no
el veredicto lo firma un instrumento que no vio nada.

Y la exclusión que apaga el ruido se probó por sus dos mitades en la misma corrida, porque un
allowlist de paths es un guard al revés —cada patrón es un lugar donde se deja de mirar—: el secreto
dentro de `.claude/worktrees/` se calla **y** el mismo secreto en `docs/` sigue dando rc=1. Sin esa
segunda mitad, un `.*` habría pasado el test igual.
