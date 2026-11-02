# Coordinación del sprint CORRECCIONES — las tres sesiones

> **Fecha:** 2026-11-02 · **Sesión que lo baja:** planificación
> **Plan:** [`2026-11-02-PLAN-sprint-correcciones-mapa-vs-app.md`](2026-11-02-PLAN-sprint-correcciones-mapa-vs-app.md) (las 10 decisiones del operador)
> **Registro único:** [`2026-11-02-BACKLOG-sprint-correcciones-mapa.md`](2026-11-02-BACKLOG-sprint-correcciones-mapa.md) — **36 fichas `SM-G1`…`SM-L4`**
> **Para quién es:** las sesiones **backend**, **frontend1** y **frontend2**, y planificación.

**Cierre binario del sprint.** Las **51** entradas del mapa en CONFORME o DIFERENTE·B **con cita**,
cada una con evidencia de device, y las 36 fichas marcadas con `scripts/sprint-estado.py`. Lo que no
se pueda producir (datos reales, días de uso) queda **declarado con su motivo** y se cuenta como
declarado, no como conforme.

---

## 0. Lo que hay que saber antes de tomar una ficha

1. **El id circula o la ficha no existe.** Citá `SM-H2` en el **asunto** del commit y en el cuerpo
   del PR. Medido el 2026-10-14: 18 de 26 fichas del sprint anterior nunca fueron nombradas porque
   cada sesión citaba ids propios, y el mismo sprint se leía con tres porcentajes incompatibles.
2. **El estado lo escribe el script**, en tu propio worktree:
   `python -I -X utf8 scripts/sprint-estado.py --marcar SM-H2 --estado TERMINADO --cierre "…"`.
   Rechaza lo que no cumple su regla y **no escribe** en ese caso. La tabla-índice es generada:
   editarla a mano la desincroniza y el gate la rechaza.
3. **`TERMINADO` es el DoD completo**, punto por punto, no el merge commit. Código en `main` con DoD
   incompleto es **`DOD-PARCIAL` con su `Falta:`** — un `DOD-PARCIAL` sin `Falta:` es un
   `TERMINADO` disfrazado y el gate lo rechaza.
4. **Checkout compartido:** `git add` con rutas explícitas. **Nunca** `-A`, `--amend`, `rebase`,
   `reset`, `checkout`, `pull`, `stash`, `clean`. Cada sesión trabaja en **su** worktree.
5. **Merge y deploy están autorizados de forma permanente.** No se pregunta. Cada sesión mergea
   **sólo sus propios PR**, con CI verde. Un gate mecánico que te frene es **tu** problema, no una
   tarea del operador.

---

## 0.bis El reporte por peer: los cuatro momentos

**Orden del operador del 2026-11-02:** las tres sesiones reportan a planificación **por mensajería
peer**, siempre, sin que se lo pidan.

**Por qué es una norma y no una cortesía.** Este sprint corre **sin crones**: no hay vigía que barra
el buzón ni monitor de parálisis. La única señal que queda sin el reporte es el `mtime` del
transcript, y eso **mide que la sesión está viva, no que produce** — medido el 2026-07-24, la sesión
**ociosa** tuvo 42 disparos y la que implementaba 5. Sin reporte, una sesión parada y una
trabajando se ven idénticas desde afuera.

| Momento | Qué va en el peer |
|---|---|
| **Tomás** una ficha | «TOMO SM-XX» + el `/goal` fijado |
| **Terminás una etapa** dentro de una ficha larga | el test en rojo que confirma la causa, la **firma** del endpoint publicada, el merge hecho |
| **Cerrás** | `FICHA:` · `SHA:` (merge commit en `main`) · `DOD:` una línea por punto con su evidencia |
| **Te bloqueás** | qué falta, **quién** lo tiene, y con qué **acción concreta** se destraba |

**El segundo momento es el que más rinde, y el que se omite.** Los disparadores de este sprint son
**etapas, no cierres**: `SM-H1` arranca cuando `SM-H2` **publica la firma**, no cuando está
mergeada. Reportar sólo al cerrar hace que la otra sesión espere de más sin estar bloqueada — que es
exactamente la espera mutua que el monitor de parálisis veía y que acá no existe.

**Lo que NO va por peer:** acuses de recibo, avances cada N minutos, y el anuncio de lo que vas a
hacer. *Prometer no es ejecutar*: se reporta lo hecho, con su evidencia.

**El peer no reemplaza al `cierre_`.** El `cierre_` en el buzón es el **registro** —es lo que queda y
lo que acredita—; el peer es el **control**, para que planificación lo sepa sin barrer el buzón. Y
ninguno de los dos escribe el estado: eso lo hace `sprint-estado.py --marcar`.

⚠️ **Mergear no es marcar, y el peer lo destapa.** Caso del propio día 1: `SM-H2` entró a `main` en
**#1313** y el medidor seguía en **1/36**, porque la ficha nunca se marcó. Código en `main` con la
ficha en `PENDIENTE` es trabajo invisible para todo instrumento del sprint — el mismo defecto que el
2026-10-14 dejó 18 de 26 fichas sin nombrar. El cierre tiene **tres pasos**: merge, `cierre_`,
`--marcar`.

**Declarar los candados es parte del reporte**, al tomarlos **y** al soltarlos:
`PantallaMiDia.tsx`, el dock compartido y el teléfono `RF8T318RN9T`. Son los tres recursos donde dos
sesiones se pisan sin enterarse hasta leer la evidencia.

---

## 1. Reparto por sesión

Las waves del plan se mantienen; lo que esto agrega es **dueño por ficha, candados y disparadores**.

| Wave | Bloque | Fichas | Dueño | Corre |
|---|---|---|---|---|
| 0 · Preparación | G | `SM-G1` `SM-G2` `SM-G4` | **frontend1** | ya |
| 0 · Preparación | G | `SM-G3` | **frontend2** | ya, en paralelo |
| 1 · Confirmaciones | H | `SM-H2` `SM-H3`(dispatcher) `SM-H4` | **backend** | ya |
| 1 · Confirmaciones | H | `SM-H1` `SM-H3`(card) `SM-H5` `SM-H6` `SM-H7` | **frontend1** | `SM-H7` ya; `SM-H1`/`SM-H3` tras `SM-H2` |
| 2 · Cáscara | I | `SM-I1`…`SM-I7` | **frontend1** | tras wave 1 |
| 3 · Funciones | J | `SM-J1` `SM-J2` `SM-J3` `SM-J5` | **frontend2** | `SM-J1` tras `SM-I2`; el resto ya |
| 3 · Funciones | J | `SM-J4` (dato) | **backend** | ya, tras el `contrato_` |
| 4 · Ajustes y ARCA | K | `SM-K1`(visibilidad) `SM-K2`…`SM-K9` | **frontend2** | ya, en paralelo con J |
| 4 · Ajustes y ARCA | K | `SM-K1`(rechazo) `SM-K3`(causa del error) | **backend** | ya |
| 5 · Cierre | L | `SM-L1` `SM-L2` | **frontend2 + operador** | ventana |
| 5 · Cierre | L | `SM-L3` | **backend + operador** | ventana |
| 5 · Cierre | L | `SM-L4` | **planificación** | al final |

**Orden forzado, con su causa:**

- **La wave 1 va primero.** Hoy una factura «cancelada» por chat **sigue emitible en Producción**.
  Es el único riesgo del sprint que toca dinero real.
- **La wave 2 va segunda** porque el dock (`SM-I2`) es la pieza que heredan las 6 funciones. Hacerlo
  después significa escribirlo 6 veces y arreglarlo 6 veces.
- **Las waves 3 y 4 corren en paralelo** — distinto dueño, distintos archivos, ningún recurso común.
- **La wave 5 es la única no autónoma.** Hasta esa ventana, `SM-L1`…`SM-L3` quedan `DOD-PARCIAL`.

### Candados (recurso con un solo dueño a la vez)

| Recurso | Dueño | Cuándo se libera |
|---|---|---|
| `PantallaMiDia.tsx` (1067 líneas) | **frontend1** durante `SM-I1` | con el `cierre_` de `SM-I1` |
| El dock compartido (`SM-I2`) | **frontend1** | con el `cierre_` de `SM-I2`; recién ahí arranca `SM-J1` |
| El teléfono `RF8T318RN9T` | **uno a la vez**, declarado en el buzón | `avance_` «teléfono libre» |
| La tabla-índice del backlog | **nadie**: es generada | — |

**El teléfono es el candado más caro.** Dos ADB simultáneos **escriben en la base** y fabrican
evidencia falsa. Quien lo toma emite un `avance_` nombrándolo; quien lo suelta, otro.

---

## 2. La junta backend↔app baja como `contrato_`, nunca se inventa

Planificación es dueña de las costuras. **Tres contratos** salen con este doc; ninguna sesión
implementa su mitad antes de que el contrato esté en el buzón:

| Contrato | Fichas | Qué fija |
|---|---|---|
| `contrato_` **cancelar y editar la factura** | `SM-H1` `SM-H2` | la herramienta del agente y el endpoint del botón **sobre la señal `cancelar` existente** (`afip_factura_workflow.py:224`, `afip_web.py:353`); qué devuelve una propuesta ya cancelada; qué código da `confirmar` sobre una cancelada; qué cubre «Editar» y por qué sigue siendo el mismo workflow |
| `contrato_` **el mail propuesto** | `SM-H3` | qué card produce el pedido de mail, qué dice, y que el envío ocurre **al confirmar** (D8) |
| `contrato_` **clientes: monto y comprobantes** | `SM-J4` | endpoint, request, response, códigos, y el test de aislamiento por tenant |

Si para avanzar tenés que **inventar la forma de un endpoint**, eso es codificar la esperanza: emití
un `pedido_` y marcá `[ASSUMED_PENDING_VERIFY]`. Los cuatro incidentes del 2026-07-21 fueron la
misma falla: cada lado verificó su mitad y la costura no era de nadie.

---

## 3. Skills: no son opcionales cuando aplican

| Antes de tocar | Skill |
|---|---|
| Cualquier workflow / activity / worker (wave 1) | `temporal-developer` **+** `temporal-ai-patterns` |
| Cualquier código de `apps/mobile` (waves 2–4) | `swmansion-react-native-best-practices` |
| El dock, el pan del panel, el deslizar para cancelar | `swmansion-rn-gestures` |
| La animación del glass, la línea del ahora | `swmansion-rn-animations` |
| Jank o re-renders al reestructurar Mi día | `callstack-react-native-performance` |

**Y antes de implementar cáscara, gesto, scroll o card: abrir el archivo equivalente de
`documed-front` y leerlo.** No es sugerencia. Cada vez que acá se implementó de cero algo que allá
existía, se volvió a pagar el mismo peaje en device. Portar **adaptando**, no copiar ciego: el
copiloto no tiene el caso clínico.

---

## 4. Lo que el gate NO puede verificar

`scripts/ci/lint.sh` corre `sprint-estado.py --check` y la tabla regenerada: rechaza un `TERMINADO`
sin `Cierre:`, un sha que no sea ancestro de `origin/main`, un `DOD-PARCIAL` sin `Falta:`, una ficha
sin `Estado:` y una tabla desincronizada. **Desde este sprint recorre los dos registros** — el del
sprint mobile y el de correcciones — porque un gate que siguiera mirando sólo el doc viejo no vería
ninguna de estas 36 fichas, y un instrumento que no mira nunca falla.

**Lo táctil no se puede mecanizar.** Lo que el gate hace es obligar a que la evidencia esté
**escrita** y el sha **exista**, para que lo no mecanizable quede visible en `Falta:` en vez de
implícito en un ✅.

---

## 5. Capa de ejecución: headless, scripts y background

Orden del operador del 2026-11-02. **Esto reemplaza la regla anterior de «sub-agentes CERO»**
(`memoria/subagentes-van-headless-no-inline-en-la-terminal.md`, 2026-10-13), que se dictó porque los
sub-agentes **inline** agotaban la RAM del operador. La condición nueva es la que cambia el perfil:
**`claude -p` con contexto cero y techo duro de concurrencia.**

### Los tres niveles, de más barato a más caro

| Nivel | Qué es | Para qué | Para qué **no** |
|---|---|---|---|
| **A · script determinista** | `scripts/` idempotente, corrido vía `scripts/vigia.sh` | contar entradas, listar los call-sites de `MicFuncion`, verificar `testID`, regenerar la tabla, comparar veredictos | nada que necesite juicio |
| **B · headless `claude -p`** | proceso aparte, **sin el contexto de la sesión**, salida a archivo | barridos de lectura y extracción: «listá los archivos que usan X con su línea», «extraé de este doc las entradas con su veredicto» | escribir código, decidir arquitectura, tocar `main`, nada con el device |
| **C · background** | lanzador detach + log + marca, patrón de `scripts/poda-worktrees-en-background.sh` | lo largo: suite del VPS, build de release, barridos de 20+ archivos | nada que haya que mirar en el turno |

**La regla que ordena los tres: determinista antes que LLM.** Si se puede verificar o calcular con
código contra los datos, se hace con código. El nivel B entra sólo para lo que el código no puede
juzgar, acotado al subconjunto que cambió. Caso raíz del 2026-10-26: ~1090 juicios innecesarios =
más del 20 % de la cuota semanal.

### Techo y modelos

- **Máximo 3 headless concurrentes por sesión.** El techo lo cuenta el **lanzador**, no la
  disciplina: cuenta procesos vivos y **encola**. Un techo que hay que acordarse de respetar no es
  un techo — y con tres sesiones, 3×N es cómo volvemos al 13/10.
- **`haiku` para barrido, `sonnet` para construir.** El modelo va por **flag** del lanzador, nunca
  hardcodeado.
- **Contexto cero:** el prompt lleva **paths concretos**, no «explorá». Un headless al que se le
  dice «averiguá cómo funciona X» gasta su presupuesto redescubriendo el repo y devuelve prosa.

### El guard que esto exige

**Un headless cuyo prompt no es autocontenido devuelve basura con exit 0.** Así que toda invocación
de nivel B lleva **control positivo en el mismo lanzador**: un caso cuya respuesta ya conocemos. Si
no la acierta, el barrido **no se usa**. Sin eso estamos metiendo un instrumento nuevo sin saber si
mide — que es el defecto que este repo ya pagó cuatro veces.

**Y el nivel C necesita su marca.** Un background sin archivo de marca es indistinguible de uno que
nunca arrancó: el lanzador escribe log **y** marca, y quien lo lanzó verifica la marca, no el exit
code del lanzamiento.

### Qué NO va por headless en este sprint

- **Nada que toque el device.** El teléfono tiene un dueño único y un headless no puede sostener ese
  candado.
- **Nada que escriba en `main`** ni que corra `--marcar`: la evidencia la aporta la sesión, que es
  quien responde por ella.
- **Nada de la wave 5.** Es la ventana con el operador.

---

## 6. Arranque

Cada sesión, al tomar su primera ficha:

1. `/goal SM-<id>` — fija la orden; el gate `scripts/ci/atribucion.sh` del `pre-push` marca
   **`FUERA-GOAL`** todo commit que cite otro id. Cambiar de orden es un comando, no un hecho
   consumado.
2. Lee **sólo su ficha** del backlog. Está escrita para eso.
3. Emite `avance_` por hito, y `cierre_` al terminar con los tres campos fijos:
   `FICHA: SM-XX` · `SHA: <merge commit en main>` · `DOD:` una línea por punto con su evidencia.
   Un `cierre_` sin esos tres campos no acredita nada y planificación lo devuelve.

**Primeras fichas tomables ahora mismo, sin esperar nada:**

| Sesión | Ficha | Por qué puede arrancar ya |
|---|---|---|
| **backend** | `SM-H2` | la señal `cancelar` ya existe; falta la herramienta. Es el riesgo de dinero del sprint |
| **frontend1** | `SM-H7` | la causa candidata está localizada y el primer paso es un test que debe salir **rojo** |
| **frontend2** | `SM-G3` | libera el device, que bloquea toda evidencia posterior |
