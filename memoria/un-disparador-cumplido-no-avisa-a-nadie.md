---
name: un-disparador-cumplido-no-avisa-a-nadie
description: Un registro de deuda guarda qué falta, de quién es y cuándo arranca — y no tiene nada que grite cuando el "cuándo" ocurre. Dos filas con el disparador cumplido el mismo día no se movieron, y la sesión dueña declaró cola vacía de buena fe porque su cola vive en dos lugares y sólo uno se mira solo.
metadata:
  type: feedback
---

# ⏰🔕 Un disparador cumplido no avisa a nadie

El 2026-08-12, cerrando la ronda de auditorías, dos filas del registro de deuda tenían el disparador
cumplido y nadie se enteró:

```
D7 | «junto con D-A del lote B»  → lote B mergeó 15:40   → no se movió
   | re-diferida «a lote C» en el propio commit de #407
   |                            → lote C cerró  18:12   → tampoco
D5 | «tras el lote C»            → lote C cerró  18:12   → tampoco
```

D7 era el 5º `except` mudo de D-A. **Mantuvo G2, G3 y G8 abiertos** —la ronda entera— por un fix de
dos líneas. Cuando finalmente se lo nombraron, backend lo cerró en **21 minutos** (#424).

## Lo que hace a esto interesante: nadie falló

Backend cerró su ciclo declarando cola vacía **y era cierto**. Miró `abierto/` y `en-curso/`: vacíos.
La trampa es que **la cola vive en dos lugares** —el buzón y el registro de deuda versionado— y sólo
uno se mira solo. El registro es bueno guardando *qué* falta, *de quién* es y *cuándo* arranca; no
tiene ningún mecanismo que grite cuando el "cuándo" ocurre. Hay que ir a buscarlo, y nadie va.

No es un problema de disciplina. Es que **un disparador escrito en prosa es información, no señal**.

## Cómo se cerró: instrumento, no lección

La reacción fácil era escribir «al cerrar un lote, releer el registro» en el DoD. Eso habría sido otra
regla dependiente de buena voluntad — exactamente [[la-excepcion-documentada-que-nunca-disparo]].

En vez de eso se reusó un idioma que ya existía: el bloque `COLA-VIVA` de `PLAN.md` +
`scripts/cola-check.sh`, que resolvió **este mismo problema** para los hitos el 2026-07-23 (4 h de
fábrica parada, «disparador cumplido y nadie lo arrancó»). El registro tiene ahora un bloque
`DEUDA-VIVA` legible por máquina y `scripts/deuda-check.sh` lo evalúa dentro de `vigilancia-check.sh`.

Cuatro decisiones de diseño que valen más que el script:

- **Sólo se evalúan disparadores con forma `@<id>`.** La prosa («1er sprint post-beta») se muestra y
  **jamás** se da por cumplida: interpretarla sería un
  [[instrumentos-que-confirman-en-vez-de-verificar]] de manual.
- **Sólo el estado `abierto` puede alarmar.** Una fila `en-curso` ya tiene dueño mirándola; gritarle
  cada 3 min es la alarma-que-suena-siempre que ya se corrigió en el watchdog (#394/#400), y una
  alarma que suena siempre enseña a saltearla.
- **Fail-loud:** registro o bloque ausente ⇒ alarma, nunca «sin deuda». Referencia `@` colgada ⇒ se
  reporta rota, porque se cumpliría nunca.
- **Modo de falla elegido: sobre-reportar, jamás sub-reportar.**

## El detalle que casi lo vuelve decorativo

La primera versión gateaba el chequeo con `-f $BUZON/PLAN.md`, copiando al chequeo de COLA. Eso **lo
saltea solo en cualquier worktree**, porque `coordinacion/` está gitignoreada y existe una sola vez —
o sea que se autosilenciaba **justo donde se lo estaba verificando**, y el control positivo daba verde
**por ausencia**. Se cazó porque el control positivo era «poné D7 en `abierto` y mirá si suena», no
«corré el script y mirá si sale limpio».

Moraleja aparte, y es la más portable de todo esto: **un control positivo que consiste en "sale
verde" no es un control positivo.** El control es forzar la condición que debe disparar la alarma y
verificar que la alarma suena.

Ver también: [[el-watchdog-que-solo-ve-al-que-llega-tarde-nunca-al-que-no-vino]] — misma familia, la
señal que no existe se cuela por el camino feliz.
