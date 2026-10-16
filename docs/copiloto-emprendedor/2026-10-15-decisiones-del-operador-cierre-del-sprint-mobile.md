# Decisiones del operador — cierre del sprint mobile (2026-10-15)

> **Qué es esto.** El registro **versionado** de las decisiones que el operador tomó el 2026-10-15
> sobre el cierre del sprint mobile. Existe porque `scripts/sprint-estado.py` exige, para los estados
> `CERRADO-POR-DECISION` y `DIFERIDO`, un `Decision:` con **quién + cuándo + dónde**, y el «dónde»
> tiene que ser un doc **del repo que existe**: `coordinacion/` no está versionada (un gate con corpus
> fuera del repo mide al equipo y en CI da vacío) y «lo dijo en el chat» no es citable por quien clona
> el repo.
>
> **Audiencia:** las tres sesiones (planificación / backend / frontend) y quien lea este repo después.
> **Decisor:** el operador (David Lin). **Fecha de todas las decisiones de abajo: 2026-10-15.**

---

## 1. Por qué hacía falta un estado nuevo

El registro tenía cuatro estados —`PENDIENTE`, `EN-CURSO`, `DOD-PARCIAL`, `TERMINADO`— y ninguno
servía para una ficha cuyo DoD **no se va a cumplir y eso ES la resolución**. Medido el 2026-10-15:
cinco fichas quedaban `DOD-PARCIAL` para siempre aunque el operador ya las había resuelto, así que el
techo **mecánico** del sprint era 23/27 = 85,2% — un criterio que no se puede alcanzar.

El operador eligió **«Sí, con evidencia obligatoria»**: el estado entra, pero el gate exige la
evidencia de la decisión igual que exige el sha para un `TERMINADO`. Implementado en
`scripts/sprint-estado.py` (`validar_decision()`), con 17 casos de `--autotest` — 9 negativos y 3
controles positivos.

**Un defecto que cazó ese control negativo, y vale anotarlo:** la primera versión del gate aceptaba la
fecha del **nombre del doc citado** como el «cuándo». En este repo todo doc se llama
`2026-10-11-...md`, así que cualquier cita satisfacía el chequeo sola y el gate era decorativo **en el
caso normal**, el único que importa. Hoy la fecha se busca con los paths borrados.

---

## 2. Las fichas que cierran por decisión (`CERRADO-POR-DECISION`)

El hueco **no se borra: se declara** en el `Falta:` de cada ficha, que queda como texto terminal.

| Ficha | Qué quedó sin cumplir | Por qué cierra igual |
|---|---|---|
| `SM-C4` | evidencia de device del botón de aceptar los términos y de la versión guardada tras aceptar | exige **una cuenta con la aceptación legal pendiente**, y el canónico `e2e-device@copiloto.test` ya aceptó la versión vigente (2026-09-22) y no se toca. La mitad hostil (canario invertido, los dos lados) está en main (#1183 `c8cbc21b`) |
| `SM-D2` | `portada.mes.facturado == detalle` **con filas en el mes en curso**, en vivo | el canónico tiene 0 filas en 2026-10: la igualdad no se puede ejercitar sin fabricar datos. Verificada en 2026-08 y 2026-09, y entre las 4 superficies por `test_facturado_predicado_unico.py` (B-3, Postgres del VPS) |
| `SM-E3` | `POST /auth/cambiar-email` sigue sin camino de usuario | su DoD es **«cada una clasificada explícitamente»**, y las 5 lo están: 4 cableadas con dueño y pantalla, y ésta clasificada como «espera SMTP» — que es `SM-C5`, diferido en §3. Código completo y device 7/7 medido el 15-10 sobre prod `72b85cba` |
| `SM-F2` | 14 ids sin comparar en mobile | 6 fiscales + `onb-cumplida` son `NO_MEDIBLE` con el canónico (perfil fiscal, MP+Google); el resto no tiene frente propio. El operador declaró que **las no medibles cierran declarando el hueco** |
| `SM-F3` | `onb-cumplida` | exige Mercado Pago **y** Google conectados en la cuenta, y el canónico no los tiene. Cambiar el usuario canónico es MAYOR y el operador lo dejó a fuego |
| `SM-D1` | evidencia de device de las 2 `choices` de confirmación elegidas y del artefacto post-confirmación con su enlace | **se agregó el 2026-10-15 a las 23:4x, después de que la medición existiera** (§2 la daba por medible y §5 la listaba como «no depende del operador»). Medida en device por frontend2 — `RF8T318RN9T`, prod `2e7d2af5`, bundle de `origin/main` `9123bf52`—: **`NO_MEDIBLE`**, y la causa es la **misma de `SM-F3`**: el canónico no tiene **ninguna** app externa conectada (Gmail contesta «no está conectado» en el chat; MP y Google Calendar caídos en Mi día), y las acciones que piden confirmación con `choices` son justamente las de herramientas externas, así que el agente responde «conectá X» antes de proponer nada. Recorrido el hilo completo del canónico (15:34→16:40): **cero** filas con el par Confirmar/Cancelar. Cierra por la regla **§4.1**, sin fabricar el sustrato. Las otras 2 piezas del DoD enmendado (componente 3+ y canario invertido) ya están en main (`39818828`) |

**Lectura que hice yo y que el operador puede refutar:** `SM-E3` la clasifiqué como cerrada por
decisión y no como diferida, porque su DoD escrito pide *clasificar*, no *cablear todo*, y las cinco
están clasificadas. Si el criterio era «hasta que cambiar-email tenga camino», entonces va a
`DIFERIDO` junto con `SM-C5` y el alcance vivo baja a 24.

**Segunda lectura mía, del mismo tipo y también refutable — `SM-D1`.** La decisión que la cierra es la **§4.1** («las casillas que no son medibles con el usuario canónico cierran declarando el hueco, no fabricando datos ni cambiando el canónico»), que el operador tomó el 2026-10-15 como **regla**, no como lista de fichas; la tabla de §2 era la asignación de los ids que ese día ya estaban medidos, y el `NO_MEDIBLE` de `SM-D1` llegó a las 22:20. Quien la aplicó a esta ficha fui yo, planificación, y lo escribo acá para que no se lea como una sexta decisión del operador: **la autoridad es suya, la subsunción es mía.** Las dos vías de refutación están abiertas y son las del `pedido_` que sigue vivo en el buzón: (a) conectar Gmail a una cuenta de prueba vía OAuth de Composio —lo único que vuelve medible la pieza— y la ficha **se reabre** con su DoD intacto; o (b) confirmar este cierre. Lo que **no** era una opción es sembrar el gate o conectar apps al canónico: eso es lo que §1 prohíbe y por lo que frontend2 paró en vez de forzarlo.


---

## 3. Las fichas que salen del sprint (`DIFERIDO`)

Diferir **no es cerrar**: el DoD queda intacto y la ficha sale del denominador, por eso `--pct`
reporta el alcance vivo aparte en vez de sumarla al avance.

| Ficha | Destino | Decisión |
|---|---|---|
| `SM-C5` | próximo sprint | *«lo de smtp y dominio queda diferido al proximo sprint»*. Era el único ítem del sprint **bloqueado en el operador**: SMTP espera dominio/DNS desde el 2026-07-25 |
| `SM-F5` | próximo sprint | tester externo con video. Depende de conseguir una persona ajena al equipo; el operador eligió **diferirla** antes que cerrarla por declaración |

También quedó diferido el **DNS (SPF/MX/DKIM)**, que es la precondición de `SM-C5` y no tiene ficha
propia.

---

## 4. Las otras decisiones del día

1. **`DECLARAR`** — las casillas que no son medibles con el usuario canónico cierran **declarando el
   hueco**, no fabricando datos ni cambiando el canónico.
2. **`CLIENTESCUIT` completo en la fila** — el CUIT entero se muestra; el operador asumió el riesgo de
   PII. (Backend tiene las tres preguntas binarias para revisar el alcance de la exposición.)
3. **`soporte` sin SLA** — el texto no promete plazo de respuesta: cierra como **enmienda fundada**,
   no como desvío.
4. **Checkout compartido** — el operador **autorizó a planificación** (y sólo a planificación) a
   commitear lo que vive únicamente en el working tree desde una rama propia y después poner el
   checkout compartido al día con `origin/main`, reportando **por efecto**. Es la única excepción a
   CANON 9; las otras dos sesiones siguen con la regla dura.
5. **Dictado en el hilo del chat: SÍ** — el operador eligió que el dictado **aparezca en el chat**.
   Esto **revierte** la decisión que hoy está fijada en código por
   `useDictadoPorFuncion.test.tsx:55` («no toca el hilo del chat: sesión nueva por dictado y NADA en
   el almacén»), así que no es un ajuste: es trabajo nuevo —cambiar ese test, rutear el dictado por el
   hilo durable y re-medir en device— y entra como **fila propia del próximo sprint**, no de éste.

---

## 5. Cómo quedó el sprint con esto aplicado

Medido con `python -I -X utf8 scripts/sprint-estado.py --pct --hoy 2026-10-15` sobre las 27 fichas:

| Cifra | Valor | Qué pregunta responde |
|---|---|---|
| DoD completo | **17/27 = 63,0%** | cuántas tienen la evidencia del DoD entero |
| + cerradas por decisión | **22/27 = 81,5%** | cuántas están **resueltas** (17 con DoD + 5 declaradas) |
| Alcance vivo | **22/25 = 88,0%** | cuánto queda del sprint después de sacar las 2 diferidas |

**Lo que falta para el 100% del alcance vivo son tres fichas, y ninguna depende del operador:**
`SM-C2` (el formulario web no manda `invite_token`), `SM-D1` (device; el código ya está en main) y
`SM-D8` (la capacidad existe, falta el test).

### Re-medición del mismo día, 23:5x — qué pasó con esas tres

Las tres cifras de arriba quedan **como fueron medidas** (`--hoy 2026-10-15`, 22/27): una cifra fechada no se reescribe, se vuelve a medir al lado. Al cierre del día, con los tres frentes de esa lista resueltos:

| Cifra | Valor | Qué cambió |
|---|---|---|
| DoD completo | **19/27 = 70,4%** | entraron `SM-C2` (#1275/#1278 — el test del DoD ya existía y **el CI lo salteaba** por un `skipif` sin GoTrue de test; corrido en el VPS, 4/4) y `SM-D8` (#1276, el gemelo mobile del desglose con canario de 3 mutantes) |
| + cerradas por decisión | **24/27 = 88,9%** | las 5 de §2 más `SM-D1`, que cierra por §4.1 con la medición de device de frontend2 |
| Alcance vivo | **24/25 = 96,0%** | el denominador no se movió: siguen fuera las 2 `DIFERIDO` de §3 |

**Por qué no es 25/25.** `SM-E3` quedó `CERRADO-POR-DECISION` y la propia §2 avisa que, si el criterio del operador era «hasta que cambiar-email tenga camino», va a `DIFERIDO` con `SM-C5` y el alcance vivo baja a 24 — o sea que el 96,0% es el techo **con la lectura conservadora**, no un hueco de trabajo sin hacer. Medido con `scripts/sprint-estado.py --pct` desde un pin de `origin/main`; el estado de cada ficha lo escribió el script, no una persona.


---

*Procedencia: las cinco decisiones de §2 y §3 las tomó el operador en la sesión de chat del
2026-10-15 respondiendo cuatro cards de decisión; este doc es su registro versionado y es el que
citan los campos `Decision:` del backlog.*
