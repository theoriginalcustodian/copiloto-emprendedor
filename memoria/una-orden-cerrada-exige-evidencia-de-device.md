---
name: una-orden-cerrada-exige-evidencia-de-device
description: "Terminar" una orden del operador tiene UNA definición — implementado + desplegado + probado funcionando en el DEVICE + evidencia adjunta. Planificación tiene PROHIBIDO reportar "terminado/listo/N-N" sin un `cierre_` con evidencia de device, y ese reporte se construye LEYENDO la evidencia, nunca git ni el buzón. "Mergeado" no es "terminado".
metadata:
  type: feedback
---

**Caso raíz (2026-07-23).** Sprint IN + mobile-first: 11 PRs mergeados a `main` entre 01:45 y 03:24.
Reporté al operador *"sprint cerrado, 10/10"* leyendo **git y el buzón**. En su teléfono no había
**nada**: IN vacío, el freeze seguía, cero de lo nuevo instalado. Medido después: la rama compartida
quedó congelada 13h atrás y su device estaba **47 commits detrás de main**. El código estaba
mergeado; **terminado no estaba**, porque terminado lo dice el aparato y yo nunca lo miré. Voz y
freeze tuvieron chequeos de device **sueltos, por-PR, sobre builds de rama**; IN, **cero**; el
conjunto sobre `main` final en el teléfono del operador, **nunca**. Su palabra: *"cuando te doy una
orden es terminar — probado, funcionando, desplegado y con evidencia. ¿Queda claro?"*.

## La definición, y es la única
**Terminado = implementado + desplegado + probado FUNCIONANDO en el device + evidencia adjunta.** Las
cuatro, en orden, ninguna salteable. Y para la app, **"desplegado" = el device corre el ref
declarado**, jamás "mergeado a main". Git dice *mergeado*; el buzón dice *alguien avisó*; **solo el
teléfono, con una captura, dice terminado**.

## La compuerta que mata esta clase de bug (mi prohibición dura)
**Antes de decirte "terminado / listo / hecho / N-N", planificación verifica que exista el `cierre_`
de esa orden con evidencia de device fechada contra el deploy ACTUAL — y arma el reporte leyendo esa
evidencia, NO git ni el buzón.** Si no existe → el estado es *"NO terminada, falta la compuerta X"*,
dicho con el nombre de la compuerta que falta. Reportar desde un proxy (commit, mensaje, exit code) es
exactamente el error de 2026-07-23. *(Es [[verificar-la-composicion-root-no-el-default]] aplicado al
cierre: no le creas al proxy, mirá la cosa real. Y [[instrumentos-que-confirman-en-vez-de-verificar]]:
git SIEMPRE confirma "mergeado" — no puede delatar un device viejo.)*

## El puente mergeado→device NO ocurre solo (fue el hueco exacto)
Al mergearse la última pieza de una orden, el **siguiente ítem obligatorio y BLOQUEANTE** es: poner el
deploy en el device + correr el **E2E acumulativo** (backend, §1.ter de COORDINACION) + adjuntar
evidencia en `_evidencia/`. La orden queda en `en-curso/` (visible como NO cerrada) hasta que ese ítem
produce el `cierre_`. No se difiere, no es opcional: **es lo único que separa mergeado de terminado.**

## Acumulativo, no por-PR
Una orden con N PRs se cierra con **UN** E2E sobre el deploy final que ejercita todo junto como lo usa
el emprendedor — no con N chequeos sueltos de rama. Los chequeos por-PR sobre builds de rama dan
falsos verdes que no cubren el conjunto ni el teléfono real.

## Test *¿puede volver?*
No, por construcción: el reporte de "terminado" se **construye desde la evidencia de device**, y sin
`cierre_` con esa evidencia la orden **no cambia de carpeta**. Un estado que es una ubicación de
archivo con una captura adentro no puede mentir como mintió leer git.

Mecanismo operativo completo: **COORDINACION.md §6** (perilla de device fijada por el operador en
§6.6: backend prueba en tenant de prueba con evidencia + el teléfono del operador se pone al día en el
mismo cierre). Hermanas:
[[atar-la-accion-a-un-momento-no-a-un-estado]] (la verificación colgada del momento del merge, no de
un estado que hay que acordarse de chequear), [[mensaje-entregado-donde-nadie-mira]],
[[entrega-progresiva-y-e2e-en-device]], [[ejecutar-autonomo-no-esperar-si-dale]] (el cierre que no
conduje por estar ocioso).
