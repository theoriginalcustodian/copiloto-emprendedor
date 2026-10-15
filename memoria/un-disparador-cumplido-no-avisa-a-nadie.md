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

## 🔁 REFUERZO 2026-10-13 — la decisión vivía en el canal que el MEDIDOR NO LEE, y eso no es olvido: es estructura

Dos de las 7 filas pendientes del sprint (`factura`, `card-factura`) estaban pendientes por **una
sola** dependencia, `mic-facturacion`, **cuya enmienda yo ya había concedido** — con la cita del
código y todo (`dictado_destinos.py:43-44`: «`factura` NO está, y no es casualidad: emitir es
irreversible ante ARCA»). La concedí en un `contrato_` del buzón. El doc de veredicto, que es **lo que
el medidor lee**, siguió diciendo ⛓️. Resultado: el medidor contaba dos filas como «no cumplen» cuando
ya cumplían por la vía de la enmienda, que el DoD admite igual que el código. **La cifra del sprint
decía 68% y era 72%.**

Lo que esto agrega a la lección de arriba: ahí el disparador cumplido no avisaba porque **vivía en dos
lugares y uno no se miraba**. Acá es peor y más barato de reincidir: el buzón **no está versionado** y
el medidor del sprint hace glob sobre `docs/`. O sea **ninguna decisión del buzón puede llegar nunca a
la cifra**, por diseño, por fuerte que esté fundada. No es que nadie la miró: es que el canal donde la
escribí **no es un input del instrumento**.

Y el mismo día, la cara simétrica: un doc de veredicto de FE2 sí estaba en `docs/`, pero su nombre no
tenía el brazo (`chat`/`cascara`/`device`) y el parser asigna el brazo por substring del nombre
(`medir-mapeo-implementacion.py:138`) ⇒ `morir()`, exit 2, **cifra del sprint entera bloqueada por un
nombre de archivo**. Dos filas invisibles por el canal, un sprint sin cifra por el nombre.

**Cómo aplicarlo:**
- Cuando concedas una enmienda o tomes una decisión que cambia el estado de una fila, el acto no
  termina con el contrato: **nombrá el artefacto que el medidor lee y quién lo anota ahí.** Si no
  podés nombrarlo, la decisión no va a existir para la cifra.
- Antes de reportar un porcentaje, preguntá **qué corpus glob-ea ese medidor** y si lo que decidiste
  hoy cae dentro. «Lo escribí» y «lo puede leer» son dos cosas.
- Un instrumento que se **niega** a medir (exit≠0 por un documento ilegible) está haciendo lo
  correcto: no inventa 0% ni 100%. La respuesta no es saltearlo, es hacer legible el documento — y si
  el documento es de otro, **pedírselo**, porque renombrarle o reformatearle su veredicto borra la
  procedencia.

Ver también: [[el-watchdog-que-solo-ve-al-que-llega-tarde-nunca-al-que-no-vino]] — misma familia, la
señal que no existe se cuela por el camino feliz.


---

## Refuerzo 2026-10-15 — el disparador vivía en el contrato y en `/healthz`, y nadie miraba el segundo

Un contrato del sprint mobile (H12/`DETALLEKV`) declaraba en su cuerpo:

> **DISPARADOR: pendiente.** Falta sólo la medición en device del DoD 6, y no es medible hoy: el
> backend desplegado (`/healthz` sha `47c09040`) NO contiene `mi_dia_presentacion.py` (commit
> `083f5055`, 48 commits detrás de main).

**Era cierto el día que se escribió, y dejó de serlo ~13 horas antes de que alguien lo mirara.**
Medido: prod corría `f037307e` desde las 21:34 del día anterior, `083f5055` **es** su ancestro, y
`apps/copiloto/mi_dia_presentacion.py` **está** en el árbol de ese sha. Mientras tanto la sesión
dueña de la medición esperaba, y el frente figuraba como bloqueado por backend — que no tenía nada
pendiente.

**Lo nuevo frente al caso de 2026-08-12:** ahí el disparador vivía en dos **registros** (la memoria y
el buzón) y ninguno gritaba. Acá uno de los dos lados **no es un documento**: es el **estado del
sistema vivo** (`/healthz`). Un `NO_MEDIBLE` fundado contra un estado externo **envejece solo**, sin
que nadie edite nada, y se sigue citando como vigente porque el documento no cambió. Es el mismo
mecanismo que [[una-cifra-sin-unidad-se-deja-citar-para-cualquier-pregunta]], pero en el eje del
tiempo: lo que falta no es la unidad, es la **fecha de vencimiento**.

**El control, y es barato:** un `NO_MEDIBLE` cuyo motivo cite un estado externo se escribe con el
**comando que lo refuta**, pegado al motivo — acá, `curl /healthz` + `merge-base --is-ancestor`. Dos
controles y no uno, a propósito: que el commit sea ancestro dice que *debería* estar desplegado; que
el **archivo esté en el árbol de ese sha** dice que está. El primero solo habría bastado para
equivocarse si el deploy hubiera sido parcial.

Y el corolario operativo: **ninguna sesión es dueña de un disparador que vive en producción.** La que
espera no lo mira porque está esperando, y la que desplegó no sabe a quién destrabó. Lo cazó un
barrido de coordinación, no el dueño de ninguno de los dos lados.

## Refuerzo 2026-10-15 (segundo del día, otra sesión escribió el de arriba) — SEIS veces: el ⛓ cruzado no tiene dueño que lo cierre

El caso raíz de esta entrada era un disparador que vive en dos lugares y uno no se mira. Acá la
misma forma, medida seis veces **en una sola jornada**:

1. `consent` — el ⛓ pedía `capacidades[]`; lo cumplía `alcance_items` (`catalog.py:145`), mergeado.
2. el `total` del listado — existía en `presupuestos_web.py:325-327` (#1219). **Yo** bajé un
   contrato declarándolo inexistente; backend lo refutó con la medición.
3. `soporte` backend — `GET /soporte/tickets` existía desde #1111.
4. el helper de presupuestos — ya estaba en main (#1210).
5. `soporte` código de app — el clip y «Ver tickets anteriores (N) ›» desde #1115.
6. las 4 filas que midió frontend1 — de **11** divergencias declaradas, **8 existían** (#1093).

**La mecánica, idéntica en los seis:** el símbolo lo escribe la dueña del doc; la dependencia la
cumple otra sesión, que mergea y avisa en el buzón; **nadie cierra el símbolo**, porque quien podría
no es quien lo escribió. El aviso de cumplimiento existe y llega — y muere ahí, porque cerrar el ⛓
no es tarea de nadie en particular.

Efecto sobre la cifra: las pendientes quedan **sobreestimadas** y las cumplidas **subestimadas**, y
no se ve desde ningún lado: cada sesión verificó su mitad.

**El cierre fue un instrumento, no una costumbre:** `scripts/evidencia/existe-en-main.py` mide, por
cada fila pendiente, si los identificadores que nombra existen en `origin/main`. Primera corrida:
**5 de 7 candidatas**. No marca nada —el símbolo lo escribe su dueña, [[DEC-18]]— y su veredicto es
`CANDIDATA-A-REVISAR`, nunca `CERRADA`: `soporte` tenía todo en main y **seguía** necesitando
device, así que existir no es cumplir.
