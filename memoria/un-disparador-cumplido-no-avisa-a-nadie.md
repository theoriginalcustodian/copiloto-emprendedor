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

Y tiene una segunda mitad que costó otra media hora: **hay que forzarla donde la alarma tiene que
sonar.** El script se probó 9/9 en el worktree donde se lo escribió, y los crones corren desde el
checkout compartido — donde el archivo no estaba, y donde el registro tampoco (se resolvió con un
fallback a `git show origin/main:<path>`, que además es la autoridad correcta). Verde en el banco de
pruebas no es verde en producción.

Ver también: [[el-watchdog-que-solo-ve-al-que-llega-tarde-nunca-al-que-no-vino]] — misma familia, la
señal que no existe se cuela por el camino feliz.

---

## Refuerzo 2026-09-30 — CINCO en un día, y el sesgo que explica por qué nadie los corrige

En una sola jornada encontré **cinco** ítems declarados pendientes cuyo trabajo ya estaba en `main`:

| ítem | decía | estaba |
|---|---|---|
| CONDIVA | «push abortado por GRAFO, decisión pendiente» | `afip_rules.py:245` en `main` |
| CONSMP (2ª guarda) | «pregunta de producto pendiente» | `tool_catalog.py:602` en `main` |
| `factura` | «BLOQUEADO, no es mío resolverlo» | desbloqueado por #702, **2 días** antes |
| ACTID | «los 4 shells TIRAN el id» + «DIFERIDO» | cableado completo, PR #690, **el mismo día** del hallazgo |
| CIERRE A #2 y #6 | «0 ocurrencias» · «dueño FE2, pendiente» | descargo en `main` con tests · PR #694 mergeado |

Cinco veces el mismo defecto, y ninguna era del trabajo: **lo que faltaba era el camino de vuelta al
tablero.**

**El sesgo, que es la parte que no había nombrado:** un tablero desactualizado **no miente al azar —
miente en la dirección que frena el cierre**. Un falso «✅ cerrado» molesta a alguien enseguida (el que
va a usar la cosa y no está), así que se corrige solo. Un falso «⏳ pendiente» **no molesta a nadie**: el
que lo hizo cree que terminó, el que lee el tablero cree que hay trabajo, y los dos tienen razón desde
donde están. Por eso los falsos pendientes se acumulan y los falsos cerrados no. No es entropía
simétrica: es un sesgo con una sola dirección, y la dirección es «no cerrar».

**Consecuencia práctica, y es lo que voy a hacer distinto:** al leer una fila que dice «pendiente» **sin
fecha de medición al lado**, el primer paso no es planificar el trabajo — es medir si el trabajo existe.
Costó un `ls` en un caso y un `git grep` en los otros cuatro. Y al revés, cuando yo declaro algo
pendiente: la fila lleva **la fecha de la medición**, porque «pendiente» sin fecha es una afirmación
sobre el pasado disfrazada de estado presente.

⚠️ Y el corolario para los `a-todos`: el hallazgo de ACTID sobrevivió **dos días** a su propio fix porque
un broadcast **no tiene quién lo mueva**. Ver [[el-tipo-de-mensaje-decide-si-alguien-lo-persigue]] y la
convención `CIERRA:`, que existe justo para eso.

---

**Refuerzo 2026-10-06 (auditoría) — el disparador se cumplió, el margen que liberaba **ya lo había consumido otro**, y la deuda que custodiaba estaba pagada hace horas.**

Un cron me dejó una deuda gestionada con disparador nombrado, escrito con todo el cuidado del caso: «el
archivo de memoria y su línea de índice son **atómicos**; no entran porque `MEMORY.md` mide 23.985/24.000
(margen 15 = 0 líneas). **Disparador: #805 mergeado** → ahí el margen pasa a ~322 y entran juntos». Medí las
tres afirmaciones:

1. **#805 mergeó e hizo exactamente lo prometido**: `4f675376` bajó entradas a `HISTORIA.md` y dejó el índice
   en **23.678** = margen 322. El disparador no falló.
2. **El margen ya no estaba.** Entre ese merge y mi turno, **siete commits** tocaron `MEMORY.md` y lo llevaron
   a **23.943** = margen 57: otra vez cero líneas.
3. **Y la deuda estaba pagada.** El archivo entró a `main` en `0d9bee8d` (#811), **atómico con su línea de
   índice** (verificado: `MEMORY=1`). El custodio seguía describiéndola como pendiente.

**Why:** un disparador sobre un **evento** espera a que ocurra, y ocurre una vez. Un disparador sobre un
**recurso compartido y consumible** —bytes de un presupuesto, un slot, una cuota, un lock— no es un evento:
es una **ventana que terceros cierran**, y se cumple y caduca sin que nada cambie de estado. El texto queda
diciendo «ya se puede» justo cuando ya no se puede, que es peor que decir «bloqueado»: el bloqueo invita a
medir, el permiso invita a ejecutar. Y el segundo filo es independiente del primero: **el documento que
custodia una deuda no se entera de que la deuda se pagó por otro camino**, así que hereda la forma de
[[el-contrato-que-manda-a-hacer-algo-ya-hecho]].

**How to apply:** (1) si el disparador es «cuando X libere Y», el disparador real es **medir Y**, no ver X:
dejá escrito el **comando** (acá `python scripts/medir-indice-memoria.py`) y nunca la cifra que esperás, que
envejece sola. (2) Cuando el recurso es compartido entre sesiones que escriben en paralelo, asumí que **el que
llega último no tiene margen**; la salida no es esperar otra ventana sino la vía que **no consume el recurso**
—acá, un refuerzo adentro de una entrada existente, que cuesta 0 líneas de índice
([[el-refuerzo-va-adentro-no-pide-linea]]). (3) Antes de ejecutar lo que un custodio manda, medí si **ya está
hecho**: cuesta un `git ls-tree` y es la mitad de las veces.
