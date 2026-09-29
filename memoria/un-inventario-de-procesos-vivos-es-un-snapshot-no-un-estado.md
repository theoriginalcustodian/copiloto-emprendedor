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
