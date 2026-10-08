---
name: un-inventario-de-procesos-vivos-es-un-snapshot-no-un-estado
description: Medí las sesiones vivas, pasaron 12 minutos de trabajo, y afirmé el resultado viejo como si fuera el presente — "las otras tres no existen". Existían desde hacía 9. Para un sujeto volátil, la medición caduca entre que la tomás y que la decís; el momento de re-medir es el de AFIRMAR, no el de planificar.
metadata:
  type: feedback
---

# 📸⌛ Un inventario de procesos vivos es un SNAPSHOT, no un estado

**LEER antes de afirmarle al operador que algo no está corriendo, no existe, o no se puede.**

## Qué pasó (2026-09-22)

El operador reinició la PC y ordenó retomar. Corrí `ListAgents`: **una sola** sesión viva. Seguí
trabajando —crones, cabecera del plan, registro A4, un gate en background— y doce minutos después le
contesté: *«no les di la orden, y no podía: sólo existe una sesión»*.

Existían las cuatro. Las otras tres habían arrancado **tres minutos después** de mi medición. Él lo
sabía porque las había abierto él: *«si existen....revisa»*.

La medición no fue incorrecta. **Fue correcta y caducó.** Y la afirmación no llevaba marca de tiempo,
así que se leyó como presente.

## Por qué no da síntoma

Un inventario de procesos **no se invalida solo**: no hay error, no hay vacío, no hay rojo. El
resultado sigue ahí, en el transcript, con la misma cara que tenía cuando era cierto. Peor: cuanto
más trabajo hacés entre medir y hablar —que es exactamente lo que pide «cero ocio»— **más viejo es el
dato con el que hablás**. La diligencia y la frescura del dato tiran para lados opuestos.

Y la clase de sujeto importa. `ListAgents`, `ps`, `gh pr list`, `df`, «¿está el servicio arriba?»
miden algo que **cambia por su cuenta, sin que vos lo toques**. Un `grep` sobre un archivo del repo
no: ese sí sobrevive al turno.

## La regla

1. **Re-medí en el instante de AFIRMAR, no en el de planificar.** Si entre la medición y la frase hubo
   trabajo, la frase necesita su propia medición. Cuesta una tool call.
2. **«No existe» / «no se puede» / «está caído» son las afirmaciones más caras de errar**, porque el
   operador deja de esperar el resultado y empieza a resolverlo él. Ésas se re-miden **siempre**.
3. **Si no vas a re-medir, fechá la afirmación**: «hace 12 minutos había una sola». Un dato con hora es
   verificable; sin hora se lee como presente y miente sin decir nada falso.
4. **El corolario operativo:** cuando el disparador de una orden es «arrancá a las sesiones», el
   inventario de sesiones es **parte de la ejecución**, no del diagnóstico previo — se toma al
   momento de ejecutar.

## El diseño que lo evita

No mandé la orden «a las tres que faltan»: escribí la cola en `coordinacion/REANUDAR-post-reboot.md`
con una sección por rol y mandé a **todas** el mismo mensaje auto-ruteado — *leé el archivo y tomá la
tuya*. Cada sesión sabe su rol mejor que mi mapeo, que el reboot había borrado. Un reparto que no
depende de que yo sepa quién es quién **no puede repartir mal por un inventario viejo**.

Hermanas: [[el-instrumento-respondio-sobre-otro-sujeto]] ·
[[una-sesion-en-worktree-es-invisible-para-el-monitor-el-slug-sale-del-cwd]] ·
[[mudo-no-es-parado-el-silencio-mide-reporte-no-trabajo]] ·
[[el-vigilante-muere-con-la-sesion-y-nadie-lo-vigila-a-el]]

---

## El caso más difícil de ver: el dato del ARRANQUE de la sesión (2026-09-23)

Una sesión avisó que el índice de memoria estaba **truncado en 207 líneas**. Medido en los cuatro
checkouts: **ninguno pasaba de 196**. La acción que proponía —bajar entradas a `HISTORIA.md` para
hacer lugar— **habría borrado índice sin necesidad**, y un gancho fuera del índice no lo lee ninguna
sesión nueva: el remedio causaba el daño que quería evitar.

**Pero el 207 no era falso: era viejo.** Salía del warning que el harness le inyectó **al arrancar su
sesión**. Entre ese arranque y el momento de citarlo entraron dos commits que arreglaron el índice.
El warning midió bien y **no se actualiza nunca**.

> **Todo lo que llega al arrancar la sesión es una foto: el `git status` inicial, la lista de
> worktrees, los warnings del harness, el estado del buzón.** Se lee como si fuera de ahora, y en una
> sesión larga puede tener horas.

Lo traicionero es que **no se parece a una medición**: no lo corriste vos, no tiene timestamp a la
vista, y aparece arriba de todo como si fuera contexto permanente. Un `ls` viejo se nota; un warning
de arranque, no.

**Antes de actuar sobre un dato del arranque, re-medilo.** Cuesta un comando. En este caso, medirlo
costó un `python -c` y evitó borrar entradas del índice — que es de las pocas pérdidas que **no dejan
rastro**: nada falla cuando un gancho desaparece, simplemente nadie vuelve a encontrar esa entrada.

Ver [[el-guard-se-vuelve-el-cuello-de-botella-de-lo-que-protege]] ·
[[el-indice-truncado-fabrica-duplicados]] · [[la-evidencia-vence-y-el-documento-no-lo-dice]].

---

## Segunda faz (2026-09-30): el instrumento dio el resultado INESPERADO, y eso era el mundo cambiando

La regla de arriba dice «re-medilo antes de actuar». Falta el caso en que la re-medición **contradice** lo
que sabías, porque ahí el reflejo apunta al lugar equivocado: **«mi instrumento se rompió»** en vez de
**«el sistema se movió»**.

**Caso.** Escribí un `cierre_` de cola afirmando «#742 **sin mergear** → mientras no se mergee, `main`
mide 53 de 54», más una tabla de cuatro hallazgos abiertos (H-1..H-4). Todo era verdad **cuando lo medí**.
Después, por disciplina propia —re-medir al AFIRMAR, no al planear— volví a correr mi canario del
alfabeto esperando `exit 1` con `(home)` ilegible. Dio **`exit 0`, 54 de 54 legibles**.

**El primer impulso fue dudar del canario.** Lo que lo descartó fue su control positivo horneado: con el
lector ciego inyectado, los 54 salían ilegibles. El instrumento medía bien. Entonces la única explicación
era la otra, y era la correcta: **#742 se había mergeado mientras yo escribía** (`1f347b50`, 03:37Z), y mi
rama lo contenía sin que yo lo supiera. Medido después: también **#743** (`a07f715a`) y **#744**
(`94768da2`). De los cuatro hallazgos de mi tabla, **tres estaban cerrados** y el cuarto había que
partirlo en dos (#744 arregló el *instrumento*; el *estado* —`MEMORY.md` en 24000 chars exactos— sigue en
el borde).

**Y la trampa espejo, en el mismo turno:** corrí el medidor de índice de **mi rama** y dijo `[OK]` con el
presupuesto agotado — el bug exacto que #744 arregla. Casi lo reporté como hallazgo vivo. Lo frenó
preguntar **qué commits contiene mi HEAD**: `git merge-base --is-ancestor 94768da2 HEAD` → **NO**. Estaba
midiendo con el instrumento viejo — [[un-rebuild-desde-otra-base-revierte-un-fix-ya-cerrado]] y
[[el-instrumento-respondio-sobre-otro-sujeto]].

**Cómo aplicarlo:** cuando un instrumento con control positivo verde da un resultado que no esperabas, el
orden es (1) confirmar que el control positivo sigue pasando, (2) preguntar **qué cambió en el sujeto**, y
sólo entonces (3) dudar del instrumento. Y en un repo con varias sesiones trabajando, «qué cambió» incluye
**qué commits contiene tu HEAD ahora**, que no es lo mismo que qué contenía cuando abriste la rama. Un
`cierre_` que lista trabajo ajeno como pendiente envejece en **minutos**, no en días:
[[el-dod-que-escribi-estaba-mal-y-la-evidencia-lo-corrigio]].

## Refuerzo 2026-10-08 — un criterio de cierre medido contra un objeto MÓVIL es inalcanzable por forma

El criterio del cierre del ALCANCE pedía *«las 7 filas mergeadas, con su DoD y el recibo de
`gate.sh` citado **por su SHA**»*, y la tabla de estado lo marcaba `✅ CUMPLIDO Y VERIFICADO` **sin
nombrar ningún SHA**. Leído sobre «el `main` del momento de declarar», ese ✅ era falso:
`recibo-cubre.sh 50c81351` → *ningún recibo cubre*. Había recibo, y cubría — de `92fd8a06`,
**12 commits atrás**.

> **El recibo es un snapshot de un ÁRBOL. `main` no es un árbol: es un puntero móvil.** Un criterio
> que compara un snapshot contra un puntero móvil no se puede cumplir mientras el puntero se mueva.

Y la carrera es aritmética, no descuido: `gate.sh` tarda **1398 s** (~23 min). En esos 23 minutos otra
sesión mergea, el `main` que se quería declarar ya no es el del recibo, y se vuelve al paso 1. **Hoy
ocurrió 12 veces.** Es [[idempotencia-con-un-if-tiene-ventana]] aplicada al cierre: la ventana entre
**medir** y **declarar** se llena de merges.

**La salida no baja la vara, la precisa — y es la forma general:** cuando el criterio compara contra
algo móvil, se declara contra un **punto congelado** más la prueba de que lo atestiguado **no cambió**.
Acá fueron dos comandos con control positivo: `git rev-list --count <sha>..main -- <los 7 paths>`
(**0** en los 6 archivos de código ⇒ intactos por construcción; **1** en el séptimo) y, para ese
séptimo, verificar su DoD en **ambos** SHAs (`P1` 1 y 1 · `P3` 6 columnas y 6 columnas, con el cambio
siendo +24/−1 en otra sección). Así el cierre **deja de envejecer** aunque `main` avance, que es lo
único que un cierre tiene que lograr.

**La pregunta que lo caza, antes de escribir cualquier criterio de cierre:** *¿contra qué objeto se
mide, y ese objeto se mueve mientras lo mido?* Si se mueve, el criterio necesita **un ancla**, no más
rigor. Hermana de [[el-contrato-que-manda-a-hacer-algo-ya-hecho]] (ahí caducaba la **causa** citada;
acá caduca el **sujeto** medido) y de
[[el-testigo-del-deploy-se-sobreescribe-y-borra-la-prueba-justo-cuando-dos-mediciones-difieren]].
