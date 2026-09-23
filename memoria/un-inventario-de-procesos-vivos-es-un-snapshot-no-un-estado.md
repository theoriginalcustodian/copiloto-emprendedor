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
