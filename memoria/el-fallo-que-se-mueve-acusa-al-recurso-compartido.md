---
name: el-fallo-que-se-mueve-acusa-al-recurso-compartido
description: Mi sonda envolvía `goto` + `waitForSelector` en un `try/catch {}` común y contaba fallos sin leer el mensaje. Reporté «timeout esperando #s-apar.on» durante dos turnos; el que fallaba era el `goto` con `waitUntil:networkidle`. El catch no atribuye, pero el humano sí — y nombra el último await que escribió.
metadata:
  type: feedback
---

# 🪤🏷️ El fallo que se MUEVE acusa al recurso compartido — y un `catch` sobre dos `await` no atribuye

**LEER cuando un instrumento cuenta éxitos y fallos de una secuencia de pasos** — sondas, smokes,
healthchecks, cualquier `for` con `try/catch` que acumule una tasa.

## Qué pasó (2026-09-28, criterio 3, prototipo Odobi)

La corrida B1 falló en tres capturas. Mi sonda reportó, y yo repetí a dos sesiones:

> «timeout de 10 s esperando `#s-apar.on` a desktop»

El código que producía ese diagnóstico:

```js
try {
  await page.goto(`${BASE}/?ver=${id}`, { waitUntil: 'networkidle' });
  await page.waitForSelector(`#s-${id}.on`, { timeout: 10000 });
  ok++;
} catch {
  /* cuenta como fallo */      // ← el mensaje se tira acá
}
```

**El que fallaba era el `goto`.** `page.goto: Timeout 8000ms exceeded`, medido en cuanto imprimí el
mensaje en vez de contarlo. El `waitForSelector` de la segunda línea **nunca llegó a ejecutarse** en
las corridas que reporté como «el selector no aparece».

El `catch` no atribuyó nada — no puede, abarca los dos pasos. **La atribución la puse yo**, y elegí
el `await` que tenía en la cabeza: el del selector, porque era el que estaba depurando. El
instrumento fue neutral; el relato no.

## Por qué costó dos turnos, y no uno

Porque la causa falsa **era plausible y medible**. Monté una sonda de tasa, salió 40-60%, y el
patrón «intermitente» encajaba perfecto con «la espera es corta». Dos instrumentos distintos
midiendo la misma métrica equivocada se confirman mutuamente.

Lo que rompió el círculo no fue re-medir: fue mirar **los milisegundos de los éxitos**. Salían a
19-104 ms contra un timeout de 10 s. Un timeout mal elegido produce éxitos *cerca* del límite — si
el más lento entra en el 1% del presupuesto, la espera no es la variable. Ese número estaba en la
salida de la primera sonda, debajo del veredicto que decía lo contrario.

## La regla

1. **Un `catch` por operación falible, o el mensaje se imprime.** Si un `try` abarca varios `await`,
   el mínimo es `errores.push(String(e.message).split('\n')[0])` y mostrarlo: el primer renglón de
   un error de Playwright dice `page.goto:` o `waitForSelector:` y eso *es* la atribución.
2. **Antes de nombrar el paso que falló, preguntá cuál era el ÚLTIMO que corrió.** Si el paso 1 se
   cuelga, el paso 2 no falló: no existió.
3. **Un patrón que encaja con tu hipótesis no la confirma si medís la misma cosa dos veces.** Buscá
   el número que la refutaría — acá, las demoras de los éxitos contra el presupuesto del timeout.

## El par simétrico: quién falla vs. cómo fallan

Las dos mitades salieron del mismo día y se leen juntas, porque la pregunta es la misma —*¿el sujeto
o el instrumento?*— y la respuesta está en **la forma del patrón, no en el contenido del error**:

| Lo que ves | A quién acusa | Por qué |
|---|---|---|
| **TODOS fallan idéntico** | **al instrumento** | Un sistema roto falla distinto en cada punto. 5/5 con el mismo mensaje es la firma de un selector, un path o una credencial mal escritos. |
| **CAMBIA el que falla** entre corridas | **a lo compartido** | El id, el viewport y el sujeto son fijos entre intentos. Si el fallo se mueve, la variable es lo que los tres comparten: un server, un puerto, un lock, una DB de test, el disco. |

La primera mitad la pagué el mismo día: busqué `.card` cuando `abrirCard` monta `#card` por ID, y
salieron **5/5 timeouts idénticos**. La segunda es este archivo.

## Contador: el mismo patrón, CUATRO veces en un día, y el mismo culpable

No es una anécdota que se cita una vez — es la firma del instrumento que tenemos. Las cuatro veces el
**sujeto cambió** y el server no:

| # | Cómo se veía | Sujeto que «fallaba» |
|---|---|---|
| 1 | tres capturas faltantes en B1 | `apar` · `soporte` · `esc` |
| 2 | sonda de tasa al 40-60% | 6 celdas **distintas** |
| 3 | celda abortada por `console.error` | `hitl`, y en la pasada siguiente `ingresos` |
| 4 | activación perdida sin error (reportada por otra sesión) | `desktop` sí, `390` no |

**Cuando el contador llega a dos, dejá de diagnosticar el sujeto y andá al recurso.** Lo que costó
caro no fue ninguno de los cuatro: fue tratarlos como cuatro problemas.

⚠️ **Y el corolario de limpieza, que es parte del patrón:** un server de prueba que queda vivo en un
puerto es el próximo recurso compartido que va a fabricar un falso rojo **para otra sesión**, que no
sabe que existe. Al terminar se baja, cruzando el PID contra el propio comando antes de matarlo
([[el-puerto-que-contesta-puede-ser-de-otra-sesion]]).

## El caso que cerró las dos mitades, contra mi propio instrumento (2026-09-28, tarde)

Probando un guard ajeno, una celda abortó por `console.error: Failed to load resource: 404` **con la
activación intacta**. En la pasada siguiente la celda abortada fue **otra**, y la primera salió
limpia. Apliqué la regla de la tabla: no era de ninguna celda.

Era **el favicon**. El prototipo no declara ninguno (`grep -c favicon index.html` = 0), Chrome lo
pide por su cuenta, y el server devolvía 404. Tasa medida: **1 de cada 10 cargas del mismo id** —
Chrome sólo lo pide a veces. Sobre 14 celdas por corrida eso tumba ~1,4, **cada vez otra**.

Tres cosas que dejó, y ninguna es sobre faviconos:

1. **Un falso positivo INTERMITENTE es peor que uno constante.** El constante se caza en la primera
   corrida; el intermitente fabrica la excusa «es el flake conocido», y con ella se lava la próxima
   regresión real. Ver [[un-instrumento-compartido-intermitente-fabrica-una-excusa-lista]].
2. **`pageerror`, `http>=400` y `console.error` son tres clases de señal y no entran en un
   contador.** `pageerror` (excepción de JS sin atrapar) invalida la captura; un recurso faltante no
   necesariamente; `console.error` mezcla las dos más lo que el sitio decida loguear. Un gate que
   suma las tres tumba celdas buenas. Separadas en `scripts/evidencia/clasificar-senales-browser.mjs`.
   Dato fino: el 404 del favicon **no** aparece como `response` de Playwright (`http>=400` da 0), así
   que no se puede filtrar mirando respuestas — hay que distinguir por clase de evento.
3. **La VENTANA decide qué señal existe.** Con `domcontentloaded` + 1200 ms no vi el 404 en 41 ids;
   con `networkidle` + 400 ms aparece. Las dos mediciones eran ciertas sobre ventanas distintas — así
   que «mi instrumento no lo ve» no refuta al que sí lo ve, y al comparar dos gates hay que comparar
   primero sus ventanas. Emparentada con [[instrumento-que-no-mira-nunca-falla]].

**Y el arreglo va en el origen, no en el gate:** el server responde **204** al favicon, con control
en las dos direcciones — un archivo inexistente **sigue** dando 404, así que el fix no enmascara
faltantes reales. Tasa antes 1/10, después 0/20. Silenciar el gate habría dejado la señal viva para
el próximo que la mirara.

## Y el corolario que costó dos reescrituras: sin LÍNEA BASE no hay delta

El mismo día, el detector de superficie del prototipo se equivocó **dos veces seguidas** por no tener
base, y las dos veces el error se leyó como hallazgo sobre el sujeto:

- **v1** miraba sólo `[id].on` → reportó tres ids como «no monta nada». Los tres montaban, por vías
  que no miraba.
- **v2** agregó esas vías → y clasificó `caida` como «chat desplazado 844px», que es el chat **en
  reposo**. Leía la línea base y se la atribuía al `?ver=`.

**«Lo que hay» no se distingue de «lo que este id hizo» sin medir la página sin el parámetro.** Y un
delta vacío no significa nada hasta que el detector prueba que sabe decir «no cambió nada»: la base
se mide **tres** veces — dos para descontar el ruido de los `setInterval`, una tercera como si fuera
un id, cuyo delta tiene que salir vacío o el script aborta.

Un tercer caso, más fino: `?ver=card` abre la card con «Nuevo gasto», que es **exactamente** el
título que la base ya tiene, así que el delta de texto sale vacío y la card quedaba clasificada como
contenedor. **El valor por defecto enmascara el delta** — cuando el estado esperado coincide con el
default, el diferencial no puede atribuir, y hay que buscar otra señal (acá, que el nodo se monte).
Emparentada con [[dos-causas-suficientes-el-test-no-atribuye]] y con
[[verificar-la-composicion-root-no-el-default]].

## Emparentadas, y en qué se diferencian

- [[dos-causas-distintas-comparten-el-codigo-de-salida-y-el-mensaje-elige-una]] — ahí el wrapper
  **afirma** una causa falsa; acá el instrumento no afirma nada y el hueco lo llena el operador.
- [[el-pipe-se-come-el-exit-code]] · [[pipear-un-proceso-largo-por-tail-borra-la-evidencia-del-fallo]] —
  la misma familia: el veredicto sobrevive y la evidencia que lo contradecía se descarta en el camino.
- [[dos-causas-suficientes-el-test-no-atribuye]] — ahí dos causas reales; acá una sola, mal nombrada.

## Refuerzo 2026-10-06 — el conjunto que falla CRECE con la carga, y todos los fallos traen el MISMO umbral: eso es la firma, y se lee en una línea

Hoy el gate `web.sh` me dio ROJO sobre un diff de tres archivos (dos `.md` de memoria y **comentarios** en
un test de facturación). «Es contención» era la excusa lista, y la excusa lista es justo la que no se
acepta sin medir. Pero la medición no fue «¿pasa si lo corro de nuevo?» — fue **mirar qué conjunto falla**:

```
corrida 1 (web + lint en paralelo):  2 fallos  -> DesktopShell, shellConsolaAdmin
corrida 2 (lint todavía corriendo):  4 fallos  -> + AppShell, + Rail
los 8 fallos, sin excepción:         «Test timed out in 5000ms»
```

Dos señales, y ninguna necesita entender el código: **el conjunto se mueve Y crece con la carga**, y
**todos los fallos comparten el mismo umbral**. Un defecto de código no gana archivos porque arranqués
otro proceso, y no se presenta siempre exactamente en el mismo número redondo. Los cuatro son tests de
`src/shell/` — los más pesados de la suite, los primeros en caerse cuando la máquina se llena. Esa es la
firma de un recurso compartido, y se lee sin abrir un solo test.

**El control que cierra el caso es EXTERNO, y existía todo el tiempo:** el CI corrió el **mismo SHA** en un
runner limpio y dio `web pass` en 1 m 44 s, con `mobile`, `core`, `lint` y `drift` también verdes. Un gate
local y un CI que discrepan sobre el mismo commit no empatan: el que corre aislado gana. Correr los dos
archivos solos (3/3 verde) apuntaba al mismo lado.

**La trampa que esto evita, y es la caritativa:** yo iba a reportar «2 fallos preexistentes en `src/shell/`,
no son míos». Eso habría sido *cierto y tóxico* — habría sembrado un rojo fantasma en un archivo ajeno que
nadie podía reproducir, y el próximo que lo viera lo habría archivado como «el flake conocido de shell»,
que es exactamente el permiso que lava la siguiente regresión real
([[un-instrumento-compartido-intermitente-fabrica-una-excusa-lista]]).

**Regla operativa para esta PC, donde corren varias sesiones a la vez:** un gate local rojo **no se
reporta ni se atribuye** antes de (1) mirar si el conjunto que falla se mueve entre corridas, (2) chequear
si todos los fallos comparten un umbral de timeout, y (3) comparar contra el CI del **mismo SHA**. Y no
lances dos gates pesados en paralelo esperando medir algo: el único resultado garantizado es un rojo que no
significa nada. Yo lo hice, y encima la segunda corrida tampoco estuvo sola.

### Corrección del mismo día, horas después — la carga externa era el AMPLIFICADOR, no la causa

Lo de arriba lo mandé a tres sesiones como «contención por lanzar dos gates pesados a la vez». **FE1
corrió un gate limpio, único, y falló igual**: dos timeouts de 5000 ms en `AppShell` y `DesktopShell`,
el mismo patrón. Mi explicación era insuficiente y la retiro.

La que sobrevive a las dos corridas: **`vitest run` paraleliza la suite entre workers, así que el gate
se hace contención a sí mismo.** Los tests de `src/shell/` montan shells completos, son los más pesados
de la suite, y en esta PC —30 worktrees, Metro, varias sesiones— quedan al borde de los 5 s; en el
runner del CI entran holgados. Mi `lint.sh` en paralelo empujó el conjunto de 2 a 4 archivos, pero
quitarlo no lo lleva a 0: **la carga externa mueve el borde, no lo crea.**

Lo que esto cambia en la práctica, y por qué valía corregirlo: con mi versión, el siguiente lee «no
lances dos gates a la vez» y espera un verde local con uno solo. **No lo va a tener.** Para `src/shell/`
en esta PC el gate local de `web` no es un instrumento utilizable, y el camino es el CI del SHA —que
exige pushear la rama, no basta el commit local— o el archivo aislado, que es la medición que FE1 y yo
hicimos por separado y en direcciones opuestas: el conjunto **crece** al sumar procesos y se **vacía**
al aislar (él: 41/41 verde aislado; yo: 3/3).

Y la lección de método, que es la misma de [[una-asimetria-entre-gemelos-no-prueba-que-uno-este-mal]]
aplicada a mí en el mismo día en que la escribí: tenía la observación bien medida (el conjunto crece) y
le colgué la causa más cercana (mi lint). El control que me faltaba era trivial y lo tenía otro:
**una corrida limpia.** Antes de nombrar una causa, preguntar quién puede correr el caso sin ella.
