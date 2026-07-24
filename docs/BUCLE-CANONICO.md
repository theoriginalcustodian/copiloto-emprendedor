# Bucle canónico de desarrollo asistido por IA

> **Estado:** canónico · **Versión:** 1.0 · **Fecha:** 2026-07-24
> **Alcance:** agnóstico de repositorio, stack y dominio. Se aplica a **todo** desarrollo con múltiples
> sesiones de agente en paralelo. Lo específico de un proyecto vive en su `CLAUDE.md`, no acá.
> **Precondición de uso:** leer §13 antes de instalarlo en un repo nuevo.

---

## 1. Qué resuelve

Un equipo de agentes que construye software rápido tiene tres modos de fallo que no se corrigen solos:

| Modo de fallo | Síntoma | Costo típico |
|---|---|---|
| **Se planifica sobre supuestos** | El plan afirma «esto no existe» o «hay que construir X» sin haberlo verificado. Se construye lo que ya estaba, o se diseña contra un sistema imaginario. | Días de trabajo tirados. El error se descubre en implementación o, peor, en device. |
| **Se aprende y se olvida** | El mismo error vuelve tres sprints después. La lección estaba escrita; nadie la leyó en el momento en que importaba. | Interés compuesto: cada repetición cuesta lo mismo que la primera vez. |
| **Se audita para confirmar** | La revisión valida lo que ya se decidió. Nunca rechaza nada, así que no aporta información. | Peor que no auditar: da confianza injustificada. |

El bucle ataca los tres con **dos auditorías externas en los extremos** —una que puede **rechazar el
plan** antes de gastar, otra que **convierte el resultado en cambios del sistema**— y **captura
continua de aprendizajes** en el medio, a cargo de quien ve trabajar a las sesiones en vivo.

**Principio rector:** *la prueba vale, la aserción no.* Todo lo demás es aplicación de eso en cada
momento del ciclo.

---

## 2. Roles

Cuatro roles. Tres viven durante todo el sprint; el cuarto se invoca en dos momentos puntuales.

| Rol | Vive | Qué hace | Qué NO hace |
|---|---|---|---|
| **PLANIFICACIÓN** (coordinación) | Todo el sprint | Escribe el plan. Baja contratos. Resuelve costuras entre capas. Decide lo táctico. Captura aprendizajes en vivo. Consolida el resultado de las auditorías en el plan siguiente. | **No implementa código de producto.** Nunca. |
| **IMPLEMENTACIÓN A** (p.ej. backend) | Todo el sprint | Construye su capa. Verifica con tests reales. Dueña exclusiva de los recursos que le tocan (device, deploy, base). | No decide contratos entre capas. No toca la capa de la otra sesión. |
| **IMPLEMENTACIÓN B** (p.ej. frontend) | Todo el sprint | Ídem, en su capa. | Ídem. |
| **AUDITORÍA** (modelo distinto, headless) | **Dos invocaciones por sprint** | A1: audita el plan. A2: audita el resultado y consolida aprendizajes. | **No vive.** No monitorea. No implementa. No coordina. |

**Sobre el rol de auditoría.** Usa un **modelo distinto** al de las sesiones que trabajan. No es un
capricho: un auditor del mismo modelo tiende a validar el mismo razonamiento que produjo el plan. La
diversidad del evaluador es la fuente del valor.

**Techo de paralelismo.** Está dado por la máquina, no por el diseño. Con 4 ranuras: 3 sesiones vivas
+ 1 libre. La auditoría **no ocupa ranura permanente** — corre headless y termina. La ranura libre es
capacidad de ráfaga, no un puesto asignado.

---

## 3. El bucle

```
                    ┌─────────────────────────────────────────────┐
                    │                                             │
                    ▼                                             │
   [F0] Sincronizar y verificar el conocimiento del código        │
                    │                                             │
                    ▼                                             │
   [F1] PLANIFICACIÓN escribe el plan (sobre código real)         │
                    │                                             │
                    ▼                                             │
   [F2] ══ A1: AUDITORÍA DEL PLAN ══  ──── RECHAZADO ────┐        │
                    │ APROBADO                            │        │
                    │                                     ▼        │
                    │                          [F1'] Corregir      │
                    │                                     │        │
                    ▼                                     │        │
   [F3] PLANIFICACIÓN baja contratos ◄────────────────────┘        │
        ⛔ GATE: `pendientes/` vacío — acá, no en F0               │
                    │                                             │
                    ▼                                             │
   [F4] IMPLEMENTACIÓN A + B construyen  ◄──┐                     │
                    │                       │ costuras, destrabes │
                    │              [F5] PLANIFICACIÓN coordina    │
                    │                   y CAPTURA aprendizajes    │
                    ▼                                             │
   [F6] Verificación real (tests + entorno real + E2E)            │
                    │                                             │
                    ▼                                             │
   [F7] ══ A2: AUDITORÍA DEL RESULTADO ══                         │
        · hallazgos rankeados por criticidad                      │
        · aprendizajes consolidados CON ENGANCHE                  │
        · verificación de aprendizajes anteriores                 │
        · evaluación del propio A1                                │
                    │                                             │
                    ▼                                             │
   [F7.5] IMPLEMENTAR LOS APRENDIZAJES ← antes que nada de app    │
          los ganchos primero: cambian CÓMO se construye          │
                    │                                             │
                    ▼                                             │
   [F8] PLANIFICACIÓN corta y escribe el plan N+1 ────────────────┘
```

**Los hitos intermedios no llevan auditoría.** Las dos auditorías van en los extremos: una para salir
sólidos, otra para cerrar el círculo. Auditar cada hito convertiría la auditoría en overhead — que es
el modo de fallo que este diseño evita explícitamente.

**El bucle se dibuja secuencial, pero no se corre secuencial.** Leído literalmente deja a las dos
sesiones de implementación sin nada contratado durante F0-F2 (sync, plan, auditoría) y otra vez durante
F7-F7.5: **dos valles por sprint en los que el equipo entero para**. Lo que de verdad tiene que esperar
es el **reparto** — y por eso el gate vive en F3:

```
 sprint N     … [F4] construir ── [F6] verificar ── [F7] A2 ── [F7.5] ganchos ─┐
                                                                               │
 sprint N+1            [F0] sync ── [F1] plan ── [F2] A1 ───────────► [F3] reparto
                       └─ PLANIFICACIÓN trabaja acá mientras A y B cierran ───┘
```

PLANIFICACIÓN escribe y audita el plan siguiente **mientras** las implementadoras cierran el actual.
Redactar un plan no construye nada con el método viejo; sólo construir lo hace.

---

## 4. F0 — Precondición: conocimiento del código sincronizado y verificado

**Ningún plan se escribe sobre memoria, documentación o suposición.** Se escribe sobre el código que
existe hoy.

Si el proyecto tiene un **grafo de código** (índice semántico del repo), el orden es siempre:

1. **Grafo primero, para localizar** — barato, responde «¿dónde vive esto?» y «¿qué ya existe?».
2. **Código después, para confirmar** — el grafo dice dónde mirar; el archivo dice qué hay.

> ⚠️ **El grafo sólo conoce lo que fue publicado** (pusheado/indexado). Un grafo desactualizado es
> **peor que no tener grafo**: responde con confianza sobre un repo que ya no existe. Por eso el paso
> 0 es **sincronizar y verificar la sincronización**, no asumirla.

**Gate de F0 — binario:**

- [ ] El sync del índice/grafo corrió **y se verificó con un control positivo**: buscar un símbolo que
      sólo existe en el último cambio publicado. Si no aparece, el grafo está viejo → **no se avanza**.
- [ ] El repo local está en el commit que se cree. (`git log -1`, `git status`.)

> **El gate de los aprendizajes NO está acá: está en F3** (ver §7). Bloquea el **reparto**, no la
> escritura. Redactar un plan no construye nada con el método viejo — y bloquear F0 obliga a las
> sesiones de implementación a esperar de brazos cruzados mientras se paga la cola.

**Anti-patrón:** dar el sync por bueno porque el comando devolvió `exit 0`. Un pipe (`cmd | tail`)
devuelve el status del último proceso, no del comando: un fallo se ve como éxito. **El veredicto de un
proceso de fondo es su salida, no su código de retorno.**

---

## 5. F1 — El plan

Lo escribe **PLANIFICACIÓN**. Un plan es una secuencia de **hitos**, y cada hito es un contrato
implementable sin negociación posterior.

### Estructura obligatoria de cada hito

| Campo | Contenido | Criterio de calidad |
|---|---|---|
| **Objetivo** | Qué puede hacer el usuario final cuando esto exista. Una línea, en su idioma. | Si no se puede decir sin jerga técnica, el hito está mal recortado. |
| **§0 Reutilización** | **Inventario de lo que YA existe**, con `path:línea`, y qué se extiende. | Ver gate abajo. Es la sección que más errores evita. |
| **Capas** | Qué sesiones toca: A · B · ambas. | Si es `ambas`, exige contrato explícito de la costura. |
| **Costura** | El punto exacto donde las dos capas se encuentran: endpoint, forma del request y del response, códigos de error, quién valida qué. | Debe poder implementarse **sin que las dos sesiones hablen entre sí**. |
| **Supuestos críticos** | Lo que se asume y no se verificó. | Cada uno: o se valida con un spike previo, o se marca bloqueante. |
| **DoD** | Criterio de cierre **binario y verificable**, con qué evidencia. | «Funciona» no es un DoD. «Comando X devuelve Y en entorno real» sí. |
| **Disparador** | Qué tiene que estar cerrado para que este hito arranque. | Explícito. Un hito sin disparador se arranca cuando se libera su dependencia, no cuando alguien se acuerda. |

### Regla dura del §0

> **«No existe» sólo vale si se buscó y se escribió dónde se buscó.**

Escribir «hay que construir X» sin `path:línea` que pruebe su ausencia es la forma más cara de
codificar la esperanza: se paga construyendo algo que ya estaba, o diseñando contra un sistema
imaginario. Es el criterio de rechazo nº1 de A1.

---

## 6. F2 — A1: auditoría del plan

### Propósito

**Doble, y el orden importa:**

1. **Encontrar los fallos del plan** — supuestos falsos, reuso omitido, costuras ambiguas, orden de
   hitos equivocado, DoD no verificables.
2. **Elevarlo** — no sólo corregir: decir cómo hacerlo excelente. Es el plan pasando por el escritorio
   de alguien más experimentado que devuelve la mejor versión posible, no un visto bueno.

**A1 bloquea el reparto.** Nadie implementa hasta que el plan pasa. Un error detectado acá cuesta
minutos; el mismo error detectado en verificación cuesta días.

### Insumos

| Insumo | Por qué |
|---|---|
| El plan completo | Es el objeto auditado. |
| **Acceso de lectura al código real del repo** | Sin esto no puede verificar un solo `path:línea` y la auditoría se degrada a coherencia interna — lo que menos importa. |
| **Acceso al grafo/índice de código** | Le permite hacer el mismo ciclo canónico: localizar y confirmar. |
| Convenciones y restricciones del proyecto (`CLAUDE.md` o equivalente) | Para juzgar coherencia con lo que ya existe. |
| **NO:** el razonamiento de por qué elegimos cada cosa | Anclaría el juicio. Queremos su lectura, no la validación de la nuestra. |

### Criterios de rechazo — cualquiera basta

El veredicto es **binario y por criterio**, no una opinión global:

| # | Criterio | Rechaza si… |
|---|---|---|
| R1 | **Anclaje en código real** | Alguna afirmación de existencia o ausencia no tiene `path:línea` verificable. **Se evalúa primero: si falla, no se mira el resto.** |
| R2 | **Reuso** | Se planifica construir algo que ya existe, o extender lo equivocado. |
| R3 | **Costura implementable** | Una capa no puede implementar su mitad sin preguntarle a la otra. |
| R4 | **Supuestos críticos** | Hay un supuesto que, si es falso, tira abajo lo que se apoya encima, y no está validado ni marcado como bloqueante. |
| R5 | **DoD verificable** | Algún hito cierra con un criterio no binario o sin evidencia declarada. |
| R6 | **Orden y disparadores** | Un hito depende de otro posterior, o hay un hito sin disparador explícito. |
| R7 | **Alcance** | El plan mezcla en un hito cosas que deberían ser dos, o parte en dos algo que no se puede verificar por separado. |
| R8 | **Insumos humanos** | Algún hito necesita algo que **sólo una persona puede dar** —una credencial, una decisión de producto, un dispositivo, una habilitación externa— y el plan no lo declara como precondición provista **antes** de arrancar. |

**Por qué R8 existe.** Es el criterio que separa un sprint autónomo de uno que se cuelga. Un plan puede
estar impecable en código y aun así detenerse en la hora 3 porque asume que un insumo humano
«aparecerá cuando haga falta». El ejecutor autónomo no negocia con el mundo: llega al muro más rápido
y después de haber construido la mitad de algo. **Cada insumo humano se declara en el plan con su
proveedor y su momento, y se provee antes del reparto — o el hito no entra al sprint.**

### Salida de A1

```markdown
## VEREDICTO: APROBADO | RECHAZADO
(rechazado si falla ≥1 criterio; listar cuáles)

## Por criterio
| # | Criterio | Pasa | Evidencia / qué falla |

## Correcciones obligatorias (bloquean el reparto)
Numeradas, cada una con: qué está mal · la evidencia (path:línea) · qué debe decir en su lugar.

## Elevaciones (no bloquean, pero mejoran sustancialmente)
Ordenadas por impacto. Cada una: qué mejora · por qué rinde · costo estimado.

## Riesgos no cubiertos
Lo que el plan no contempla y puede morder. Con probabilidad e impacto.

## Lo que haría distinto
Si el enfoque general es subóptimo, decirlo acá con alternativa concreta.
```

### El filo: A1 tiene que poder rechazar

> **Si A1 aprueba todos los planes, no se está aplicando: se está usando como sello.**

Un aprobado sin correcciones obligatorias en un plan no trivial es una señal de alarma sobre **el
auditor**, no una buena noticia sobre el plan. Al ocurrir: revisar si el prompt está pidiendo
validación en vez de auditoría, o si le falta acceso al código.

### Prompt de A1 (plantilla)

```
Sos el revisor senior de un plan de sprint. Tu trabajo NO es aprobarlo: es encontrar por qué
podría fallar, y devolverlo convertido en la mejor versión posible.

No conocés el razonamiento del equipo y es deliberado: queremos tu lectura, no la validación
de la nuestra.

## El plan a auditar
<PATH_AL_PLAN>

## Tu acceso
- Código real del repositorio: <PATH_REPO>
- Índice/grafo de código: <CONFIG_GRAFO>. Úsalo para LOCALIZAR y confirmá SIEMPRE en el archivo
  real: el grafo puede estar desactualizado y sólo conoce lo publicado.
- Convenciones del proyecto: <PATH_CONVENCIONES>

## Cómo auditar
Verificá CADA afirmación de existencia o ausencia del plan contra el código. El plan dice cosas
como "esto ya existe en X:N" o "hay que construir Y" — comprobalas una por una. Ése es el núcleo
de tu trabajo, no un paso previo.

## Criterios (veredicto binario por criterio, RECHAZADO si falla ≥1)
R1 Anclaje en código real — toda afirmación de existencia/ausencia con path:línea verificable.
   EVALUAR PRIMERO: si falla, no mires el resto, el plan no está listo para auditarse.
R2 Reuso — nada que ya exista se planifica de nuevo; nada se extiende por el lugar equivocado.
R3 Costura implementable — cada capa puede construir su mitad sin preguntarle a la otra.
R4 Supuestos críticos — validados, o marcados bloqueantes con su spike.
R5 DoD verificable — binario, con evidencia declarada.
R6 Orden y disparadores — sin dependencias hacia adelante; todo hito con disparador explícito.
R7 Alcance — hitos bien recortados, verificables por separado.

## Entregá exactamente esta estructura
[la de arriba]

## Reglas
- Cada afirmación tuya anclada en path:línea o en una cita del plan. Sin excepción.
- Distinguí lo verificado de lo inferido; marcá [HIPÓTESIS] lo segundo y decí qué lo confirmaría.
- Prohibido el consejo genérico ("mejorar la comunicación", "agregar tests"). Todo específico.
- Si el enfoque general te parece equivocado, decilo — es lo que más valor tiene y nadie más lo dirá.
- Preferimos 5 hallazgos anclados a 20 sueltos.
```

---

## 7. F3-F4 — Reparto y construcción

**Gate de F3 — binario, y es acá donde vive:**

- [ ] **`docs/aprendizajes/pendientes/` está vacío** (§10). Si quedó un gancho del sprint anterior sin
      construir, **no se reparte trabajo**: se construiría con el método que ya se sabe que falla.

> **Por qué en el reparto y no en F0.** Lo que los ganchos cambian es *cómo se construye*, no cómo se
> redacta. Bloquear F0 congela también la escritura del plan — y como el plan lo escribe PLANIFICACIÓN
> mientras las implementadoras todavía están cerrando el sprint anterior, mover el gate acá **elimina
> el valle en que las tres sesiones paran juntas**. Planificación puede correr F0-F1-F2 del sprint N+1
> mientras A y B terminan F4-F6 del N; lo único que no puede es *repartir* hasta que la cola esté en
> cero.

PLANIFICACIÓN baja **un contrato por hito** a la sesión que corresponde. Reglas:

- **Un trabajo de capas `ambas` no se despacha sin su contrato escrito.** Sin él, las dos sesiones
  negocian entre ellas y reimplementan.
- **Nadie inventa la forma de una costura.** Si para avanzar hay que inventar un endpoint o un
  formato, eso es un hueco del plan → se escala a PLANIFICACIÓN, no se resuelve por las buenas.
- **Dueño único de los recursos exclusivos** (dispositivo físico, deploy, base compartida, estado
  externo). El préstamo se anuncia explícitamente; si el mecanismo lo permite, con lock real y no por
  cortesía.
- **Aislamiento de código.** Un worktree o rama por sesión. Si el checkout es compartido: `add` con
  rutas explícitas, y prohibidas las operaciones que reescriben el árbol entero. *Esta regla debería
  tener un bloqueo mecánico, no ser una convención — ver §11.*

---

## 8. F5 — Captura continua de aprendizajes (durante el sprint)

**Dueña: PLANIFICACIÓN.** Es la única que ve *cómo* trabajan las sesiones mientras trabajan. La
auditoría ve el resultado; coordinación ve el proceso — y el proceso no deja rastro en el código.

> Los aprendizajes más valiosos suelen ser de esta clase: un instrumento que mentía, un mensaje que
> llegó y no produjo conducta, una espera que nadie había pedido. Nada de eso aparece en un diff.

### Capturar ≠ consolidar

| | Cuándo | Quién | Formato | Costo |
|---|---|---|---|---|
| **Captura** | En el momento, durante el sprint | PLANIFICACIÓN | Una línea + evidencia, append a `<coordinación>/APRENDIZAJES-SPRINT.md` | Segundos. No interrumpe. |
| **Consolidación** | Al cierre | A2 | Entrada de memoria con enganche, o fusión con una existente, o descarte | Una vez por sprint |
| **Implementación** | Entre sprints (F7.5) | PLANIFICACIÓN + quien corresponda | El gancho real: hook, gate, test, edición del prompt | Ver §10 |

**Por qué separarlos.** Si cada micro-aprendizaje se convierte en documento permanente, el índice de
memoria crece sin techo y su costo de contexto se paga en **cada** sesión, para siempre. Si no se
capturan en el momento, se pierden. La separación resuelve las dos: **el archivo crudo es el registro
completo; la memoria es el destilado con dientes.**

### Formato de captura

```
- [HH:MM] <qué pasó, una línea> · EVIDENCIA: <path:línea | comando | cita> · ESTADO: resuelto|abierto
```

**Y lo resoluble se resuelve en el momento**, no se difiere al cierre: si el aprendizaje es «este hook
no interrumpe», se arregla el hook ese día y se anota como resuelto. Diferir todo al cierre convierte
el sprint en una lista de problemas conocidos y no arreglados.

---

## 9. F6-F7 — Verificación y A2

### F6 — Verificación real

Antes de A2, lo construido tiene que estar **verificado donde vive**: tests en el entorno real (no en
la máquina de desarrollo si el destino es otro), y lo táctil probado en el dispositivo real. La
autoevaluación de un agente no es evidencia. Un gate que sólo prueba lógica no verifica una
interacción.

### F7 — A2: auditoría del resultado

**Propósito:** cerrar el círculo autopoiético — que el sistema se modifique a sí mismo con lo que
aprendió. **No es un post-mortem: es el insumo del plan siguiente.**

A2 audita cosas que **no podían existir** cuando corrió A1, así que no hay redundancia:

| # | Objeto | Qué sólo se puede saber después |
|---|---|---|
| 1 | **El artefacto real** | A1 revisó una descripción; A2 revisa código escrito. Bugs, casos borde, seguridad, acoplamientos nacidos en la ejecución. Un plan excelente puede implementarse mal. |
| 2 | **El delta plan ↔ realidad** | Qué se hizo distinto y por qué. Dónde el plan fue optimista, qué supuesto se cayó al tocar el código, qué contrato resultó insuficiente. **Esto mejora cómo planificamos**, que es donde el valor se compone. |
| 3 | **Lo que el sprint destapó** | Puntos de fallo latentes que se hicieron visibles, oportunidades que aparecieron, deuda contraída. Material que salió de la realidad, no de nuestra imaginación. |
| 4 | **Los aprendizajes del sprint** | El archivo de captura + los transcripts. Consolidados, deduplicados, **con su enganche** (§11). **Es el foco principal.** |
| 5 | **El propio A1** | Con el resultado en la mano se puede verificar si sus consejos sirvieron. Convierte al auditor en algo que mejora ciclo a ciclo en vez de repetir consejos plausibles para siempre. |
| 6 | **Los aprendizajes de sprints anteriores** | ¿Cuáles se repitieron **a pesar** de estar escritos? Ahí se mide si el enganche funcionó. Nada más en el sistema hace esto. |

### Insumos de A2

- El plan original **y el informe de A1**.
- El código final (diff del sprint + estado actual).
- `APRENDIZAJES-SPRINT.md` (captura cruda).
- Métricas del proceso extraídas de los logs de las sesiones (ver §12).
- El índice de memoria del proyecto (para deduplicar y para verificar repeticiones).

### Salida de A2

```markdown
## 1. Aprendizajes consolidados        ← LO PRINCIPAL
Por cada uno: qué se aprendió · evidencia · ENGANCHE PROPUESTO (§11) · ¿es nuevo o
variante de uno existente? (si es variante: cuál, y si conviene fusionar).

## 2. Aprendizajes anteriores que se repitieron
Cuáles volvieron a ocurrir pese a estar documentados, y por qué el enganche no alcanzó.

## 3. Hallazgos sobre el artefacto — RANKEADOS POR CRITICIDAD
| # | Hallazgo | Evidencia (path:línea) | Criticidad | Costo de arreglo | Riesgo de no arreglar |
Criticidad: seguridad/corrección > pérdida de datos > deuda en código caliente > deuda en código frío.

## 4. Delta plan ↔ realidad
Qué se planificó vs qué se hizo, y qué dice eso sobre cómo planificamos.

## 5. Evaluación de A1
En qué acertó, en qué se equivocó, qué no vio. Con evidencia del resultado.

## 6. Qué sigue
Lo más valioso para el ciclo siguiente, según lo que este sprint reveló.
```

### Prompt de A2 (plantilla)

```
Sos el auditor de cierre de un sprint. El trabajo YA está hecho y verificado. Tu objetivo NO es
corregir lo que se construyó: es CONSOLIDAR LO QUE EL SPRINT ENSEÑÓ y convertirlo en cambios
concretos del sistema, para que los mismos errores no puedan volver a ocurrir.

## Tus insumos
- Plan original: <PATH>          - Informe de A1: <PATH>
- Diff del sprint: <COMANDO>      - Código actual: <PATH_REPO>
- Aprendizajes capturados en vivo: <PATH>
- Métricas del proceso: <PATH>    - Índice de memoria del proyecto: <PATH>

## El foco principal: aprendizajes con ENGANCHE
Un aprendizaje escrito NO evita que el error se repita. Sólo lo evita un enganche que se dispare
solo, en el momento del error. Por cada aprendizaje, clasificá su enganche:
  · MECÁNICO (hook, gate, test, tipo, script)  → el error se vuelve imposible o ruidoso
  · CONTEXTUAL (regla en el prompt/convenciones) → se recuerda siempre, pero se puede racionalizar
  · DOCUMENTAL (memoria)                        → sólo sirve si alguien la busca
Preferí SIEMPRE el mecánico. Y aplicá el test binario: **¿puede volver a pasar?** Si la respuesta
es sí, el aprendizaje no está cerrado — está anotado.

## Deduplicá
Muchos aprendizajes son variantes de uno ya escrito. Antes de proponer una entrada nueva, buscá en
el índice de memoria si ya existe la familia; si existe, proponé extender esa entrada, no crear otra.

## Verificá el pasado
Revisá qué aprendizajes anteriores VOLVIERON a ocurrir en este sprint pese a estar documentados.
Ésa es la medición más importante del sistema: si se repiten, el enganche no funcionó, y hay que
decir por qué.

## Evaluá a A1
Con el resultado real en la mano: ¿en qué acertó el auditor del plan? ¿en qué se equivocó? ¿qué no vio?

## Entregá exactamente esta estructura
[la de arriba]

## Reglas
- Todo anclado en evidencia: path:línea, un número de las métricas, o una cita.
- Rankeá por criticidad real, no por facilidad de arreglo.
- Prohibido el consejo genérico. Todo específico de este sistema.
- Sé breve en lo que salió bien; extenso en lo que puede volver a fallar.
```

---

## 10. F7.5 — Implementación de aprendizajes (entre sprints)

> **Un aprendizaje redactado y no implementado no es un aprendizaje: es información.**

Es la fase que cierra el círculo. Sin ella, F5 y F7 producen una lista cada vez más larga de problemas
conocidos y no arreglados — el equipo *sabe* más y *falla igual*.

### La regla de orden, y por qué

Entre dos sprints hay dos colas de trabajo distintas, y **no se mezclan**:

| Cola | Qué es | Cuándo |
|---|---|---|
| **1. Fixes de aprendizaje** | Cambios al **sistema de trabajo**: hooks, gates, tests de regresión, prompts de rol, instrumentos | **Primero**, siempre |
| **2. Fixes del artefacto** | Bugs y deuda de la **app**, salidos de A2 §3 | Después, y sólo lo que entre |

**El orden no es preferencia: es causalidad.** Los fixes de aprendizaje cambian *cómo se construye*. Si
van después, el sprint siguiente se construye con el método que ya se sabe que falla, y vuelve a
producir los mismos aprendizajes. Poner la mejora del método detrás de la mejora del producto es
exactamente lo que hace que un equipo repita errores mientras acumula documentación sobre ellos.

### Qué entra a la cola (y qué no)

**No todo aprendizaje genera trabajo.** El filtro es la taxonomía de enganche (§11), aplicada al
capturar:

| Nivel | Qué se hace | ¿Genera pendiente? |
|---|---|---|
| **1 — Mecánico** (hook, gate, test, tipo) | Se construye en F7.5 | **Sí.** Es la única cola. |
| **2 — Contextual** (prompt, convención) | Es una edición de minutos: **se hace en el acto** | No |
| **3 — Documental** (memoria) | Escribirlo **es** implementarlo | No |

Meter los tres niveles en la cola la vuelve impagable y hace que se abandone entera. La cola de F7.5
es corta **por construcción**: sólo lo que necesita que alguien escriba algo que bloquee.

### Dónde viven — el estado es la ubicación

```
<repo>/docs/aprendizajes/          ← VERSIONADO. Sobrevive a un clone, a un `clean`, a otra máquina.
├── README.md                      ← el contrato de la carpeta
├── pendientes/                    ← LA COLA DE F7.5. Vaciarla es el gate de F3 (el reparto).
│   └── AAAA-MM-DD_<slug>.md
└── AAAA-MM-DD/                    ← archivo histórico: implementados, por fecha de implementación
    └── <slug>.md
```

**Implementar un aprendizaje = moverlo** de `pendientes/` a la carpeta del día. Igual que el buzón de
coordinación: un tablero que hay que acordarse de actualizar se desincroniza y **miente**; un `mv` no
puede. El estado nunca se declara, se observa con un `ls`.

> ⚠️ **La captura en vivo es efímera; la cola no.** El archivo de captura de F5 puede vivir en la
> carpeta de coordinación (muere con el sprint), pero **los pendientes van al repositorio versionado**.
> Si la cola vive en una carpeta ignorada por git, un `clean` o una máquina nueva la evaporan — y sería
> el mismo saco perdido con mejor nombre.

### Formato de un pendiente

```markdown
---
sprint: <sprint en que se aprendió>
nivel: 1
dueño: <rol o persona>
---
# <qué se aprendió, una línea>

**Evidencia:** <path:línea | comando | cita del log>
**Qué falló:** <el mecanismo, no el síntoma>
**Gancho a construir:** <hook / gate / test / script — concreto>
**DoD binario:** <cómo se prueba que el gancho ENGANCHA — incluido el control negativo>
```

El **DoD con control negativo** no es adorno: un gancho que nunca se probó contra el caso que debe
atrapar es indistinguible de uno ausente. Es la ley de los instrumentos (§12) aplicada a los ganchos.

### El gate

`docs/aprendizajes/pendientes/` **vacío** es precondición del **reparto (F3)** del sprint siguiente. No
es una meta ni una buena práctica: es binario y bloquea.

Va en F3 y no en F0 a propósito: los ganchos cambian *cómo se construye*, no cómo se redacta. Con el
gate acá, PLANIFICACIÓN puede escribir y auditar el plan N+1 mientras las implementadoras cierran el N
— y desaparece el valle en que las tres sesiones paran juntas.

Sobre la cola 2 (fixes del artefacto) el criterio es distinto y más honesto: **cero deuda
NO-gestionada**, no cero deuda literal. Algunos fixes de app son grandes y no entran entre sprints;
esos se registran con dueño y condición de pago y se planifican como hitos. La cola 1 sí se vacía
entera, porque es corta por construcción.

### Modo de fallo de esta fase

**La carpeta que crece.** Si `pendientes/` acumula entre sprints, no hay que ampliar el plazo: hay que
mirar qué se está metiendo. Casi siempre es nivel 2 disfrazado de nivel 1 — «hay que acordarse de X»
escrito como si fuera un gancho. Un pendiente cuyo DoD no se puede escribir en una línea binaria no es
un pendiente: es una nota.

---

## 11. Taxonomía de enganche

> **Un aprendizaje sin enganche es una nota. Con enganche, es un órgano.**

| Nivel | Mecanismo | Cuándo actúa | Fuerza | Costo |
|---|---|---|---|---|
| **1 — Mecánico** | Hook que bloquea · gate de CI · test de regresión · tipo que no compila · script que falla ruidoso | En el instante del error, sin que nadie se acuerde | Máxima | Puntual, una vez |
| **2 — Contextual** | Regla en el prompt del rol · convención en `CLAUDE.md` · invariante inyectado por turno | Siempre presente, pero puede racionalizarse | Media | **Recurrente**: se paga en cada turno |
| **3 — Documental** | Entrada de memoria del proyecto | Sólo cuando alguien la busca | Baja | Bajo por entrada, alto en agregado (el índice crece) |

**Regla de asignación:** subir al nivel más alto que el error permita. Un error que sólo se puede
prevenir recordándolo es de nivel 2; uno que se puede volver imposible es de nivel 1 y **debe** serlo.

**Evidencia de que el nivel 2 no alcanza solo:** una regla puede estar escrita, recitada en cada turno,
y aun así ignorarse *«por reflejo, no por decisión»*. El nivel 2 protege del **olvido**, no de la
**racionalización**. Sólo el nivel 1 protege de las dos.

**Presupuesto del nivel 2.** Es el único con costo recurrente: cada regla inyectada por turno se
multiplica por todos los turnos de todas las sesiones. Debe tener **techo declarado** y contrato de no
crecer. Cuando algo entra al nivel 2, algo debería salir — o convertirse en nivel 1.

---

## 11.ante Ningún turno cierra con un reporte

> **Si el humano puede preguntar «¿y cómo seguimos?», el turno cerró mal.**

Es la regla más general del bucle y la que define si el sistema es **autónomo** o **asistido**. No se
dispara por una condición previa —no hace falta estar ocioso ni que se agote un recurso—: **aplica a
cada cierre de turno, siempre.**

**El error que mata no es la inacción.** Un agente puede estar trabajando bien, produciendo y
reportando con precisión, y aun así cerrar con *«quedan N pendientes, el estado es este»*. Un informe
correcto **se siente** como un cierre y no lo es: deja del lado del humano la decisión de qué sigue,
que es exactamente lo que la autonomía tiene que eliminar.

**Los dos únicos cierres válidos:**

1. **Lo siguiente ya está tomado**, y se dice en una línea cuál es. No «podríamos hacer X»: *estoy
   haciendo X*.
2. **Está genuinamente bloqueado**, y entonces se nombra el **disparador exacto** que falta, **quién lo
   tiene**, y qué ocurre cuando llegue.

No son cierres válidos: un resumen de lo hecho · una lista de pendientes sin dueño ni próximo paso ·
«¿querés que siga con X?» cuando X ya está en la cola acordada.

**Por qué el costo es mayor de lo que parece.** Cada «¿cómo seguimos?» es un ida y vuelta con el
humano. En un sistema que apunta a sprints autónomos, esos ida y vuelta **son** la diferencia entre
autónomo y asistido — y se acumulan invisiblemente, porque cada uno por separado parece razonable.

---

## 11.bis Escasez de recurso — dispara ejecución, no consulta

**Un recurso finito que se agota —cuota del modelo, tiempo antes de un corte, ventana de
mantenimiento, deadline— no es una señal para preguntar qué hacer. Es la orden de reordenar la cola y
ejecutar.**

En el mismo turno en que se detecta:

1. **Reordenar lo pendiente por impacto ÷ costo**, no por el orden en que estaba.
2. **Despachar ya y en paralelo lo barato-y-alto-impacto**: lo que se resuelve con un **script** (se
   paga una vez y después corre sin modelo), lo delegable a **modelos baratos**, y todo lo que pueda
   correr en segundo plano.
3. **Descartar explícitamente lo caro-y-flojo**, diciendo por qué. Con el recurso escaso, gastarlo en
   el ítem de evidencia más débil es el peor uso posible.
4. Lo que exige una **decisión humana** se lleva en un batch **mientras el resto ya corre**. No se
   frena la ejecución para preguntar.

**El error que esta regla mata no es la inacción**: es **enumerar correctamente lo que se podría
adelantar y no adelantarlo**, dejando que el humano lo pida. Eso convierte al humano en el
planificador de la cola del agente — y con un recurso agotándose, el ida y vuelta se paga en el
recurso mismo.

**Por qué "cero ocio" no alcanza.** Esa regla se dispara cuando **terminaste** algo; ésta se dispara
**mientras trabajás**, y no exige estar ocioso. Un agente ocupado en una tarea de bajo impacto
mientras se agota la cuota cumple «cero ocio» al pie de la letra y falla igual.

**El blindaje es el mismo de siempre:** acelerar la cola **ya acordada** es ejecución; adelantar una
fase futura no aprobada, no. La escasez cambia el **orden** y el **paralelismo**, nunca el **alcance**.

---

## 12. Instrumentación

El bucle necesita medirse a sí mismo, o se degrada sin que nadie lo note.

| Instrumento | Qué mide | Regla de oro |
|---|---|---|
| **Log crudo de las sesiones** | Qué hizo cada sesión y cuándo | **Muestra**, no infiere. Si un sensor derivado lo contradice, gana el log. |
| **Métricas de proceso** | Turnos por origen (humano vs automático), tokens, actos productivos vs lecturas, errores, huecos de inactividad, comandos repetidos | Se extraen por script del log. Alimentan A2. |
| **Registro de captura** | Aprendizajes en vivo | Append-only. El valor está en la baratura de escribir. |

### Ley de los instrumentos

> **Un instrumento mal hecho no falla: confirma.**

Cuando se equivoca no da error — da una respuesta plausible, que entra al reporte con el sello de
«medido». Por eso:

1. **Todo instrumento se prueba con control negativo**: no sólo «¿detecta lo que busco?», sino
   «¿qué devuelve si lo que mido estuviera roto?». Un smoke sin control negativo puede dar diez
   verdes sobre un instrumento mudo.
2. **Preferir el que muestra sobre el que infiere.** Un instrumento que imprime hechos con su hora
   deja el juicio en quien lee; uno que clasifica, decide por vos y puede decidir mal.
3. **Cuidado con la regla que obliga a consultar al instrumento derivado antes que a la fuente
   directa.** Si un instrumento falla repetidamente, la pregunta no es *«¿qué bug tiene?»* sino
   *«¿qué regla me lleva a él antes que a la fuente?»*. Arreglar el instrumento sin tocar el
   procedimiento sólo produce una versión más pulida del mismo error.

---

## 13. Instalación en un repositorio nuevo

### Capa plantilla (se replica tal cual)

- Este documento.
- Las plantillas de prompt de A1 y A2 (§6, §9), con sus placeholders.
- La estructura del registro de coordinación: estados por ubicación, tipos de mensaje por prefijo,
  captura de aprendizajes append-only.
- La taxonomía de enganche (§11) y la ley de los instrumentos (§12).

### Capa proyecto (se completa por repo, nunca se hereda)

| Qué | Dónde se define |
|---|---|
| Cuáles son las capas y por lo tanto las sesiones de implementación | `CLAUDE.md` del proyecto |
| Cómo se sincroniza y verifica el índice de código (o si no hay) | `CLAUDE.md` del proyecto |
| Qué es «entorno real» y «verificación real» para este producto | `CLAUDE.md` del proyecto |
| Recursos exclusivos y su mecanismo de préstamo | `CLAUDE.md` del proyecto |
| Convenciones de commits, ramas, aislamiento | `CLAUDE.md` del proyecto |
| Los umbrales concretos (silencio, tamaño de sprint, techo de sesiones) | `CLAUDE.md` del proyecto |

**Nunca incrustar lógica de un dominio en la capa plantilla.** Si algo huele a específico —AFIP, un
proveedor, un cliente— va a la capa proyecto.

### Checklist de arranque

- [ ] Techo de paralelismo medido en **esta** máquina (no heredado de otra).
- [ ] Roles asignados, uno por ventana, con su comando de arranque verificado.
- [ ] Registro de coordinación creado, con ruta absoluta y **fuera del control de versiones** (si se
      versionara, un worktree por sesión lo duplicaría y los mensajes de una no existirían para la otra).
- [ ] Índice de código sincronizado **y verificado con control positivo**.
- [ ] Modelo de auditoría elegido, **distinto** al de las sesiones de trabajo, y su acceso al código y
      al índice **probado** — no asumido.
- [ ] `APRENDIZAJES-SPRINT.md` creado, vacío, en la carpeta de coordinación (efímero).
- [ ] `docs/aprendizajes/` creado **y versionado**, con `README.md` y `pendientes/` vacío (§10).
- [ ] Enganches de nivel 1 mínimos: aislamiento de código, secretos, y lo que el dominio exija.

---

## 14. Modos de fallo del propio bucle

Ninguna de estas es hipotética: todas se observaron.

| # | Modo de fallo | Señal temprana | Contramedida |
|---|---|---|---|
| 1 | **La auditoría se vuelve sello** | A1 aprueba todo. A2 sólo felicita. | Veredicto binario por criterio. Un aprobado sin correcciones en un plan no trivial es alarma sobre el auditor. |
| 2 | **Los hallazgos no se implementan y se evaporan** | El informe se archiva y nadie lo cita. | Lo que no entra en el corte queda como **deuda visible con dueño y condición de pago**. A2 del ciclo siguiente verifica si se pagó. |
| 3 | **La memoria se infla y su costo se vuelve el problema** | El índice crece cada sprint; su lectura cuesta en cada sesión. | Consolidación con deduplicación obligatoria. Preferir fusionar sobre crear. Preferir enganche mecánico sobre entrada nueva. |
| 4 | **El plan se escribe sobre el índice desactualizado** | Un plan afirma cosas que ya no son ciertas. | F0 con control positivo, siempre. |
| 5 | **La coordinación consume más que la construcción** | El rol coordinador gasta más que las sesiones que construyen. | Medir el gasto por rol cada sprint. Todo trabajo determinista de vigilancia sale del modelo y va a un script. |
| 6 | **El aviso llega y no produce conducta** | Un mensaje urgente se entrega y la sesión sigue como si nada. | Los avisos bloqueantes tienen **forma distinta** de los informativos. Y verificar el efecto, no sólo la entrega. |
| 7 | **Se declara terminado sin evidencia** | «Funciona», «está listo», sin comando ni salida. | DoD binario, evidencia adjunta. La autoevaluación del agente no cuenta. |
| 8 | **La auditoría opina sobre un sistema que no existe** | Recomendaciones que no encajan con lo que hacemos. | Revisar el encuadre del prompt: casi siempre el error está ahí, no en el auditor. |
| 9 | **La cola de aprendizajes crece entre sprints** | `pendientes/` nunca llega a cero. | No ampliar el plazo: mirar qué se mete. Casi siempre es nivel 2 disfrazado de nivel 1. Un pendiente sin DoD binario es una nota (§10). |
| 10 | **El sprint autónomo se cuelga esperando a una persona** | Una sesión frenada horas por una credencial, una decisión o un dispositivo. | R8 en A1: los insumos humanos se declaran y se proveen **antes** del reparto, o el hito no entra. |

---

## 15. Resumen operativo

| Fase | Dueño | Entrada | Salida | Gate para avanzar |
|---|---|---|---|---|
| **F0** | Planificación | — | Índice sincronizado | Control positivo verde |
| **F1** | Planificación | Código real + índice | Plan con hitos | §0 con `path:línea` en cada afirmación |
| **F2** | Auditoría (A1) | Plan + código + índice | Veredicto + correcciones + elevaciones | **APROBADO** |
| **F3** | Planificación | Plan aprobado | Contratos por hito | Costura implementable sin negociar **+ `pendientes/` vacío** |
| **F4** | Implementación A/B | Contratos | Código | DoD de cada hito |
| **F5** | Planificación | Observación en vivo | Aprendizajes capturados + costuras resueltas | Continuo |
| **F6** | Implementación | Código | Evidencia real | Verificado donde vive |
| **F7** | Auditoría (A2) | Todo lo anterior | Aprendizajes con enganche + hallazgos rankeados | Entregado |
| **F7.5** | Planificación + quien corresponda | Cola de `pendientes/` | Ganchos construidos y probados | Aprendizajes ANTES que fixes de app |
| **F8** | Planificación | Informe A2 | Plan N+1 | Deuda del artefacto visible con dueño → vuelve a F0 |

---

**Frase canónica del bucle:**
*Planificar sobre código real, no sobre memoria. Auditar antes de gastar y después de aprender.
Capturar barato, consolidar una vez, **implementar antes de volver a empezar**. Y todo aprendizaje que
pueda volverse mecánico, se vuelve mecánico — porque una regla escrita protege del olvido, no de la
racionalización.*
