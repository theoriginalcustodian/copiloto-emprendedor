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

---

## Refuerzo 2026-09-30 — el falso positivo que CRECE con el uso, y el reportador que se listó a sí mismo

El día que estrené la convención `CIERRA:` (un `cierre_` declara qué `a-todos` mata), el reportador que
la lee salió a medir el corpus real y **se listó a sí mismo**: el `cierre_planificacion-a-todos_CONSMP…`
—el archivo que *contiene la declaración*— apareció como «SIN CIERRE (nadie lo declaró muerto)».

La causa es de una línea: `medir()` filtraba por **destinatario** (`dest == "todos"`) y no por **tipo**.
Pero lo que importa es la forma del error, no la línea:

**El falso positivo crecía con el uso.** Cada `cierre_`/`dato_`/`avance_` dirigido a todos —o sea cada
vez que el mecanismo funcionaba— agregaba un ítem que no pedía acción. Un guard que grita de más en el
caso normal se desarma solo; uno cuyo ruido **es proporcional a su propio éxito** se desarma más rápido,
y encima justo cuando empieza a servir. La lista habría quedado inservible por la vía de usarla bien.

El arreglo no fue inventar un criterio: fue **copiar el conjunto que el janitor ya usaba** —
`archivar-buzon.sh:66`, `^[0-9-]+_(contrato|pedido|urgente|hallazgo)_` — porque esa distinción ya estaba
decidida y probada en otro consumidor. Una obligación pide cerrador; un informativo informa.

**La pregunta que no me había hecho, y va con las otras dos de arriba:**
3. *Cuando esto grita de más, ¿el ruido crece con el uso del sistema que protege?* Si sí, el guard tiene
   fecha de vencimiento aunque hoy dé pocos falsos — y la va a alcanzar sin que nadie toque nada.

Y el dato de método: lo cazó **la primera corrida real**, no el test. El control positivo horneado pasó
igual, porque su fixture tenía un a-todos declarado y otro sin declarar, no un `cierre_` a-todos. Ver
[[el-control-positivo-cubre-la-mitad-que-sospechas-y-la-otra-queda-muda]].

## Refuerzo 2026-10-06 — el gate que depende de un artefacto GITIGNORED mide distinto segun la maquina

`test_ratchet_endpoint_tenant_scope.py::test_A2` fallaba en mi PC y estaba **verde en el CI** (job
`backend` de `main`: `success`). Lo medi en tres celdas -- el ratchet solo, con mis archivos nuevos, sin
ellos -- y fallaba igual en las tres: no era de mi rama ni de `main`.

La causa: la asercion rompe con `{'/{full_path:path}'}`, el catch-all del SPA (`web.py:526`), que se
registra **solo si existe `apps/copiloto-web/dist`**. Ese directorio esta **gitignored**: el CI clona sin
el y el ratchet pasa; una PC con un build local lo tiene, el catch-all captura la ruta sintetica del
**propio control negativo** del ratchet, y da falso rojo.

**Por que no es anecdota:** un gate que grita en el caso **normal** de una PC con build es el que ensena
a saltearlo con `--no-verify`, y en un repo **publico** `--no-verify` apaga **gitleaks**. El falso rojo no
cuesta un minuto de confusion: cuesta el habito que despues deja salir un secreto.

**La pregunta al escribir cualquier gate:** *¿su resultado depende de algun archivo que `.gitignore`
excluye?* Si si, el DoD del fix exige verificarlo en **las dos** condiciones -- con el artefacto y sin el
-- porque el CI solo te muestra una.

---

## Faz nueva (2026-10-13): el guard transversal grita en los tests de OTROS sujetos, y la salida fácil es debilitarlos

Le cablée a `scripts/cola-check.sh` el guard de versión (avisa cuando el archivo divergió de
`origin/main`). Correcto y necesario: ese mismo día una copia 4 commits atrás me inventó 13 renglones
inválidos. Pero el barrido de coordinación se puso en **1 de 74 rojo**, y el test que cayó
—`test-cola-check-ciego.sh`, caso 2— **no tiene nada que ver con versiones**: su sujeto es que
`cola-check.sh` no se quede mudo ante un PLAN faltante, y para que el rojo del caso 1 sea atribuible
el caso 2 exige que **con un PLAN sano calle** (`[ -z "$out" ]`, capturando `2>&1`).

El guard hablaba porque **tenía razón**: mientras se desarrolla `cola-check.sh`, el archivo ESTÁ
divergente de `origin/main`. O sea el aviso era verdadero y el test, correcto, y aun así se tocaban.

**Las dos salidas malas, y por qué lo son.** (1) **Debilitar el caso 2** a «no exige silencio, sólo
`rc=0`»: mata el control que hace atribuible al caso 1 — el test completo pasaría con un script roto
que imprime basura. Debilitar un test para que pase tu cambio es la forma más barata de perder un
control y la más difícil de notar después. (2) **Quitar el guard**: devuelve el defecto que acababa de
costar 13 renglones falsos.

**La salida correcta: desacoplar por SUJETO, no por conveniencia.** El test declara
`VERSION_YA_VERIFICADA=1` en sus dos invocaciones, con el motivo escrito arriba. No tapa nada, porque
el versionado tiene **sus propios** casos 7/8/9 en `test-cola-check-estado.sh` —con control positivo
(árbol limpio ⇒ silencio) y mutante matado—. Si en cambio lo dejaba acoplado, **cualquier rama que
toque `cola-check.sh` rompería un test de otro sujeto**, y el equipo aprendería a ignorar ese rojo:
exactamente el mecanismo de esta entrada, con el falso positivo del lado del CI en vez del humano.

**La regla que queda:** un guard transversal que se cablea a un componente compartido necesita, el
mismo día, **un modo de supresión nombrado** (acá `VERSION_YA_VERIFICADA=1`) y la respuesta escrita a
*¿qué tests de OTROS sujetos capturan su salida?* Si no la tenés medida, el guard no está terminado:
lo vas a descubrir cuando el rojo ajeno le llegue a alguien que no sabe que es tuyo
(`el-primer-test-rojo-mata-la-suite-y-el-rojo-ajeno-se-vuelve-escudo-del-propio`).
