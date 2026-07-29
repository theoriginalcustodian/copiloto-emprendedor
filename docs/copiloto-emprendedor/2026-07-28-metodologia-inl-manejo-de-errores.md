# La metodología de manejo de errores de Ingeniería No Lineal — análisis profundo

> **Fecha:** 2026-07-28 · **Fuente:** `Repositorio Ingenieria No Lineal` @ `91ccf14` (2026-04-20),
> 88 archivos `.md` / 52.378 líneas + el código de `zep-pipeline`.
> **Método:** inventario por script (idempotente, con controles) + 6 barridos independientes con glob
> exclusivo, obligados a citar `archivo:línea`, a etiquetar cada ítem como
> `[PRINCIPIO]` / `[MECANISMO]` / `[PLANTILLA]` / `[PRINCIPIO SIN MECANISMO]`, y a **refutar**.
> **Propósito:** implementar el manejo de errores de INL en el Copiloto del Emprendedor. Este
> documento **no es el plan** — es el mapa de qué existe, qué es adoptable tal cual, y qué falta.

---

## 0. El veredicto

INL **sí tiene** una metodología de manejo de errores completa y original. Su tesis es una sola:

> **El error no es una excepción que aborta: es un dato de primera clase que se captura, se sella, se
> difiere y se sana solo.** El criterio de éxito no es "no falla" — es *"puedo apagar la computadora
> e irme sin que colapse"*.

Pero el análisis encontró tres cosas que cambian cómo hay que adoptarla:

1. **El índice oficial del framework no la muestra.** El README lista 9 patrones; el repo tiene 12, y
   los que faltan son justo los de resiliencia y diagnóstico (§2).
2. **Su pieza central —A-4 Trauma Empaquetado— no está implementada en ninguna parte del repo** (§8).
   La única implementación de referencia eligió el patrón opuesto (hard-stop + humano) y lo justifica
   por su contexto. Implementarlo en el copiloto sería la primera vez que existe de verdad.
3. **Parte de lo que hoy opera como "INL" en este workspace no está en INL** — el fingerprint
   criptográfico de errores es doctrina del `CLAUDE.md` global del operador, no del repo (§9).

---

## 1. Cómo se leyó (y los dos vacíos que el instrumento produjo)

`scripts/` no aplica acá: el inventario corrió desde el scratchpad contra el repo INL, con control
positivo (594 encabezados H2) y negativo (patrón fantasma = 0).

Dos veces el instrumento mintió y el control lo cazó — vale registrarlo porque es el mismo error que
este dossier estudia:

- **Un `grep` quedó colgado leyendo `stdin`**: dos archivos `.md` del repo tienen espacios en el
  nombre y se pasaron sin comillas; la expansión rompió las rutas y `grep` sin archivos válidos se
  quedó esperando entrada. El síntoma era "el inventario no avanza", no un error.
- **El primer conteo de patrones vino del README** (9). El conteo real, hecho sobre las menciones de
  todo el repo, dio 12. La fuente autoritativa era la equivocada.

---

## 2. Hallazgo estructural: 12 patrones, un índice que muestra 9, y los 3 faltantes son los de errores

Conteo de menciones de cada código de patrón en los 88 `.md` (verificado en primera persona):

| Patrón | Menciones | ¿En el índice del README? | ¿Archivo propio en `03-patrones/`? |
|---|---|---|---|
| C-3 Exocórtex | 142 | ✅ | ✅ |
| C-1 Pre-Computación | 138 | ✅ | ✅ |
| A-1 Adaptador Universal | 111 | ✅ | ✅ |
| G-1 Debugging de Generadores | 92 | ✅ | ✅ |
| C-2 Offloading Cognitivo | 79 | ✅ | ✅ |
| G-2 Gobernanza Día Cero | 70 | ✅ | ✅ |
| A-3 Event-Driven | 51 | ✅ | ✅ |
| **A-4 Trauma Empaquetado** | **43** | ❌ | ❌ |
| A-2 Constraint-Driven | 42 | ✅ | ✅ |
| **C-5 Diagnóstico Zero-Trust** | **25** | ❌ | ❌ |
| **C-4 Aislamiento bitemporal** | **16** | ❌ | ❌ |
| **C-6 Homeostasis documental** | **3** | ❌ | ❌ |

Los cuatro ausentes viven en `02-framework/patrones-auto-healing.md` y en
`.claude/skills/nonlinear-engineering/references/patrones.md`. El README los menciona **cero veces**.

**Y sin embargo la `CONSTITUCION.md` sí los consagra**: `Ley F-3 — Trauma Empaquetado (DLQ)`
(`CONSTITUCION.md:17`), junto a `F-2 Seguridad en la Raíz`, `F-5 Aislamiento en Adaptadores`,
`F-6 El Humano Aprueba (HITL)`, `O-2 Protección del Perímetro` y `O-3 Auditor antes que Generador`.

> **Consecuencia práctica.** El propio repo recomienda una "adopción en ~15 minutos" que pasa por el
> paper, el system prompt y el template de CLAUDE.md. **Quien siga esa ruta se lleva INL sin su capa
> de manejo de errores.** Los patrones canónicos (A-1, A-3) *nombran* el trauma y remiten a A-4 —
> que no está en la carpeta de patrones. Es un framework cuya doctrina de resiliencia hay que ir a
> buscar fuera de su índice.

---

## 3. La metodología completa, reordenada por el ciclo de vida del error

El repo tiene esto disperso en 8 carpetas. Reorganizado por fase — **esta tabla es la metodología**:

### 3.1 PREVENIR (que el error no pueda existir)

| Prescripción | Mecanismo | Cita |
|---|---|---|
| Las invariantes viven en la **persistencia**, no en la app | RLS + `CHECK`/`UNIQUE`/`NOT NULL` + triggers de auditoría. *"Si la regla es importante, vive en la base. Si vive solo en el código, no es importante"* | `a2-constraint-driven-development.md:49-78,161` |
| Validación en el **borde**, no en el backend | Shift-Left: esquemas estrictos en la UI. Criterio de salida: *"es matemáticamente imposible enviar al servidor una instrucción que viole la estructura"* | `protocolo-peap-v5-144h.md:93-103` · `CONSTITUCION.md:36` (Ley O-2) |
| **Un solo punto de contacto** con cada servicio externo | Regla inviolable: sólo el Adaptador habla con el exterior. Reforzado con **lint que detecta llamadas directas** + PR bloqueante si se importa el SDK externo fuera del Adaptador | `a1-adaptador-universal.md:66-74` |
| Gobernanza **el día 0**, no cuando haya tiempo | 5 elementos: branch protection · commits semánticos con `commitlint` · constitución técnica antes del primer commit de negocio · cierre térmico de sprint · diseño para N+1 | `g2-gobernanza-dia-cero.md:58-96` |
| Una regla que no se puede garantizar estructuralmente es **"hardcoding emocional"** | Si no hay lint/CI/revisión obligatoria que la imponga, es aspiración, no ley | `g2-gobernanza-dia-cero.md:160-164` |
| **Gate mecánico sobre el código nuevo**: el Sensor AST | Lee los diffs del commit → extrae el AST → valida la **forma** contra reglas arquitectónicas (ej. *"toda operación con servicio externo debe rutear errores a la DLQ"*) → si falta, **la entidad no se admite**. *"No es cuestión de disciplina — es cuestión de si el código pasa el gate estructural"* | `teoria-cibernetica-v5.md:33-40,129-131` · `validacion-empirica-v5.md:21-27` |
| **Brutalismo**: tecnología aburrida para minimizar superficie de fallo | Filesystem, SQL, `git diff`, JSON planos sobre Kafka/Redis/K8s. *"la superficie de fallo es pequeña y las partes son reemplazables"* | `teoria-cibernetica-v5.md:71-81` |
| **Auto-validación antes de proponer** (no después) | 5 preguntas: A-1 replicabilidad · V-EXT API externa · Hardcoding · V-INT arquitectura · V-RES recursos vivos. Un SÍ ⇒ Plan v1 + v2 + recomendación. *"El orden es: self-check → propuesta. Invertido es teatro"* | `skills/framework-self-check.md:60-104,163` |

### 3.2 DETECTAR

| Prescripción | Mecanismo | Cita |
|---|---|---|
| Validar los **caps del proveedor antes de emitir**, en fase separada | `enforceCaps()` corre sobre *todos* los ítems antes de tocar la red; si hay violaciones, aborta | `zep-pipeline/ingesters/canonical_ingester.js:128-145` |
| Detectar **alucinación estructural antes de gastar la query** | Validar el identificador contra un `source_map` local (~1 ms) antes de llamar al servicio | `zep-pipeline/lib/code_validator.js:1-23` |
| El **drift se mide, no se asume** | La declaración (`source_map`) *es* la especificación; un test cuantifica divergencia con umbrales externalizados en config | `tests/stress/dimensions/coverage.js:21-23` · `config.json:18-29` |
| **Fallar ruidoso antes que degradar en silencio** | *"NEVER default to `new Date()` — that breaks idempotency"*: prioridad ENV → archivo → `throw` | `zep-pipeline/ingesters/evidence_source_map.js:31-60` |

### 3.3 CLASIFICAR

| Prescripción | Mecanismo | Cita |
|---|---|---|
| **`ERROR_MAP`: tabla declarativa, no condicionales dispersos** | `{429:{tipo:'RATE_LIMIT_EXTERNO', reintentable:true, espera_seg:30}, 402:{...}}`. Agregar un error nuevo = una entrada, no reescribir código | `a1-adaptador-universal.md:52-93` |
| El error externo se traduce al **lenguaje del dominio propio** | Cero contaminación del vocabulario del proveedor en el código de negocio | `a1-adaptador-universal.md:118-132` |
| **Transitorio vs. lógico** decide el camino de recuperación | Transitorio (infra del proveedor) → reinyectar; lógico (negocio) → catalogar para revisión humana **sin bloquear el sistema** | `patrones-auto-healing.md:39-42` |
| **≥3 instancias ⇒ deja de ser un bug** | Reclasificar a falla de generador. Umbral doble: **≥3 lugares O >2 h de debugging** del mismo problema | `AGENTS.md:101-103` · `CONSTITUCION.md:39` (Ley O-3) |

### 3.4 CONTENER

| Prescripción | Mecanismo | Cita |
|---|---|---|
| **El error nunca es terminal** — los 4 pasos de A-4 | 1. Captura (payload + estado + metadatos) → 2. Encapsula (contenedor atómico) → 3. Deposita (DLQ, *"Cola de Errores de Nivel 2"*) → 4. **Continúa** (el proceso sigue con el resto del volumen) | `patrones-auto-healing.md:28-33` |
| El usuario **nunca ve un error fatal** | Ve un estado intermedio honesto: **"procesamiento diferido"** | `patrones-auto-healing.md:35` |
| Toda operación **>500 ms** es asíncrona por diseño | 3 fases: Intención (persistir, <100 ms, devolver tracking_id) → Procesamiento (worker) → Resultado (evento). Estado en columna enumerada, **nunca inferido** de la presencia del resultado | `a3-event-driven.md:46-51,93-117,206-210` |
| El *blast radius* de una caída externa **termina en el Adaptador** | Un cambio de contrato del proveedor no propaga más allá | `framework-vision-general.md:93-104` |
| **Fricción perimetral** para proteger el pool de conexiones | JWT + delay exponencial en el borde ante anomalías masivas | `abandono-preparado.md:37-39` |

### 3.5 RECUPERAR

| Prescripción | Mecanismo | Cita |
|---|---|---|
| **Agente de Sanación**: patrulla ≠ reintento ciego | Patrulla la DLQ en ciclos de baja demanda → extrae el trauma → **evalúa si las condiciones externas se restauraron** → reinyecta en el flujo original. *Es un circuit breaker con half-open probe aplicado a la cola, no un backoff a ciegas* | `sistemas-autonomos-v5.md:42-52` · `GLOSARIO.md:144-145` |
| **Idempotencia obligatoria** antes de cada reintento | *"llaves de pre-cómputo"* que avisan si la señal ya fue procesada. ⚠️ El **cómo** no se especifica (§7) | `abandono-preparado.md:55-57` · `a3-event-driven.md:212-216` |
| **Reparación quirúrgica**, no re-correr todo | Script standalone con `--dry-run`/`--apply` sobre una lista explícita de lo que hay que reparar, para evitar side-effects | `zep-pipeline/ingesters/repair_drift.js:1-30` |
| El agente **jamás mergea** | Elabora el parche en `fix/incidente-N`, abre PR; el humano aprueba | `CONSTITUCION.md:26` (Ley F-6) · `constitucion-agente-inl.md:65-70` |

### 3.6 OBSERVAR

| Prescripción | Mecanismo | Cita |
|---|---|---|
| El Adaptador es el **punto natural de observabilidad** del proveedor | ⚠️ `[PRINCIPIO SIN MECANISMO]`: se nombran métricas, circuit breakers y rate limiting como "efectos deseables", sin algoritmo | `a1-adaptador-universal.md:195-204` |
| **Bitemporalidad**: nada se borra, se invalida | `invalid_at` + nuevo estado con `valid_at`. Habilita *"este componente volvió a una configuración ya invalidada"* | `SOFTWARE_AUTOCONSCIENTE_Concepto_Tecnico.md:57-67` |
| El descarte silencioso **se loguea** | Al truncar por cap: `console.warn('Descartadas N keys por cap=10')` | `zep-pipeline/lib/zep_metadata.js:91-110` |
| **KPIs con umbral sano/alarma** | Bugs similares antes de buscar patrón: **≤3 sano / >5 alarma** · debugging sin parche sistémico: **<2 h / >2 h** · recuperar contexto tras pausa: **<15 min / >45 min** | `antipatrones-y-kpis.md:53-66` |

### 3.7 DIAGNOSTICAR

| Prescripción | Mecanismo | Cita |
|---|---|---|
| **C-5 Zero-Trust: prohibido el razonamiento abductivo sin evidencia instrumental** | Bloque XML copiable: `<diagnostic_protocol>` con 2 `<step>` obligatorios (telemetría → ¿hay traumas relacionados?; persistencia → ¿estado real en DB?) + `<security_bound>`: **PROHIBIDO concluir si telemetría y grafo divergen → derivar a supervisión humana con reporte completo** | `patrones-auto-healing.md:122-146` |
| **G-1: procedimiento de 5 pasos** | 1. Reconocer la repetición (mirar el patrón, no los detalles) → 2. Mapear **todas** las instancias (grep/auditoría) → 3. Identificar el generador entre 4 tipos (plantilla · prompt · convención documental · patrón arquitectónico) → 4. Corregir **el generador**, nunca las instancias → 5. Corregir las instancias existentes **en bloque, una sola operación** | `g1-debugging-generadores.md:64-101` |
| G-1 es **autorecursivo** | Si quien repite la decisión subóptima es el agente, el generador **es el prompt/la regla**: el fix es meta (skill, memoria, regla) | `g1-debugging-generadores.md:165-171` |
| **Diagnóstico contextualizado por grafo** | Cruzar el síntoma (log/alerta) con la anatomía estructural para trazar la cadena causal: qué falló, qué depende de eso, qué mecanismo de recuperación existe | `SOFTWARE_AUTOCONSCIENTE_Concepto_Tecnico.md:129-135` |
| Ante evidencia contradictoria, **el agente no decide solo** | Escala al humano con toda la información | `patrones-auto-healing.md:146` |

### 3.8 APRENDER

| Prescripción | Mecanismo | Cita |
|---|---|---|
| **El Delta Cognitivo**: protocolo de escritura al cerrar sesión | 3 preguntas: ¿cambió una ley? → LEYES · ¿un trauma quedó catalogado con su cura? → HISTORIA · ¿cambió el estado? → ESTADO. **Regla de bifurcación: todo fallo → HISTORIA; fallo que generaliza → también LEYES** | `diseno-master-brain.md:154-166,124` |
| **El Handshake**: protocolo de lectura al abrir sesión | Consulta LEYES → HISTORIA → ESTADO *antes* de la primera instrucción. Ejemplo literal: *"el proveedor Z requiere DLQ por sus timeouts en alta carga"* — **el fallo pasado se consulta antes de decidir** | `diseno-master-brain.md:142-150` |
| Filtro único de qué entra a la memoria | *"¿Cambiaría cómo un agente futuro tomaría una decisión arquitectónica?"* | `diseno-master-brain.md:112-116` |
| **Anonimizar el trauma, preservar la restricción técnica** | *"El cliente de fintech tenía esta limitación…"* → *"en sistemas de pagos con PKI, la restricción X requiere el Adaptador Y"* | `diseno-master-brain.md:128-132` |
| **Cierre térmico** de sprint | Última jornada sin código: actualizar exocórtex, catalogar deuda, **documentar traumas resueltos** | `g2-gobernanza-dia-cero.md:80-89` |
| El **post-mortem vive en el código** | `HISTORIAL DE FIXES: 2026-04-19 … Bug detectado en PR #208 … Fix: calcular overlap sobre límites de oración` — inline, junto a la función que lo sufrió | `zep-pipeline/lib/chunker.js:24-30` |
| Evolución trazable de las reglas | Relación `[EVOLUCIONÓ_A]` cuando una restricción reemplaza a otra por demostrarse incompleta | `diseno-master-brain.md:58` |

---

## 4. Los tres artefactos que son el corazón

### 4.1 · A-4 Trauma Empaquetado — el contrato de datos del fallo

La formulación más completa del repo (`sistemas-autonomos-v5.md:32-38`):

> *"1. Captura instantáneamente todo el contexto: **el payload original, el punto de fallo y la huella
> técnica del error** / 2. Sella esta información **en formato inmutable** en una Cámara de Cuarentena
> (Dead Letter Queue) / 3. **Continúa procesando el resto del volumen** sin degradar la experiencia
> del usuario"*

Es la única parte del framework que se acerca a un contrato de datos: dice **qué** se serializa, **en
qué** contenedor y **con qué garantía** de continuidad.

Y su patología asociada, nombrada (`muerte-al-hardcoding.md:33-38`): **"hardcoding emocional"** =
alertar al humano ante fallos comunes de infraestructura. *"El sistema no pide ayuda; procesa señales
y se recupera solo."* **El humano es el último recurso, no el primero.**

### 4.2 · El Agente de Sanación — reintentar ≠ reintentar tras verificar

La distinción fina que separa esto de un backoff exponencial: el agente **evalúa si las condiciones
externas se restauraron** antes de reinyectar. Requiere un *probe* por dependencia — que el repo no
especifica (§7).

### 4.3 · La escala L0→L5 — la única taxonomía completa, y su gap declarado

| Nivel | Qué garantiza |
|---|---|
| **L0** Tolerancia | El proceso no muere |
| **L1** Persistencia | El trauma queda en la capa de datos |
| **L2** Notificación | El humano se entera |
| **L3** Ticketing | Se abre un issue estructurado |
| **L4** Reintento | La DLQ reprocesa automáticamente |
| **L5** Auto-reparación | Un agente diagnostica, escribe el parche y **abre un PR — nunca mergea** |

> *"L0 a L4 aseguran que el sistema sobrevive y que el humano se entera. **El gap no resuelto: la
> corrección del código subyacente que causó el error sigue siendo 100% manual.**"*
> (`agente-reparador-autonomo-l5.md:19-21`)

Las **6 líneas rojas** de L5 (`:131-142`): jamás merge directo · jamás push a rama principal · jamás
tocar credenciales · jamás ignorar una regla `GOBERNADO_POR` · jamás >5 iteraciones sin escalar ·
jamás operar sin evidencia instrumental.

⚠️ **Marca de honestidad:** L5 está redactado en presente prescriptivo pero **no hay evidencia de que
corra en producción** — a diferencia del cerebro Zep, que sí tiene números. Su propio roadmap (F1–F6)
confirma que es trabajo futuro. Es **diseño, no comportamiento validado**.

---

## 5. Todos los umbrales numéricos (el activo más reutilizable del repo)

| Umbral | Qué dispara | Cita |
|---|---|---|
| **≥3 instancias** (o **>2 h** de debugging) | Reclasificar bug → falla de generador (G-1 / Ley O-3) | `g1:47` · `AGENTS.md:102` · `CONSTITUCION.md:39` |
| **≤3 sano / >5 alarma** | Bugs similares antes de buscar el patrón sistémico | `antipatrones-y-kpis.md:60` |
| **>500 ms** | La operación pasa a ser asíncrona por diseño (A-3) | `a3:11` |
| **<100 ms** | Techo de la fase de Registro de Intención | `a3:97` |
| **3 fallos consecutivos** | Hard-stop del ingester (`process.exit(4)`) — el único circuit breaker implementado | `canonical_ingester.js:439-446` |
| **5 iteraciones / 7 m 30 s** | Salvaguarda anti-bucle del agente reparador antes de escalar | `agente-reparador-autonomo-l5.md:125-126` |
| **2 horas de caída** de un proveedor | Caso de aceptación del Día 5: el sistema debe absorberla sin intervención | `protocolo-peap-v5-144h.md:134` |
| **<15 min / >45 min** | Recuperar contexto tras pausa (sano/alarma) | `antipatrones-y-kpis.md:61` |
| **>5 min de pensamiento** | La decisión se persiste inmediatamente en el exocórtex | `c3-exocortex:38` |
| **2 semanas** | Timeout de un ADR en estado PROPUESTA → se resuelve o se rechaza | `adrs-template/00-README:102` |
| **≥70% / <50%** | Ratio de auto-invocación del self-check: objetivo / alarma | `c3-bidireccional:79` |
| **T+6 s → T+420 s** | De excepción capturada a PR abierto, en el ciclo L5 | `agente-reparador-autonomo-l5.md:171-188` |
| **215+ / 130+** | Parches sistémicos y defectos corregidos en **una** jornada de auditoría | `genesis-y-metricas-sprint.md:51-52` |
| **~15 min vs ~12 h** | Corregir 1 plantilla vs. 50 instancias a mano | `g1:109` |
| **1 jornada / 2-3 semanas / ∞** | Costo de implementar G-2 el día 0 / día 60 / nunca | `g2:123-129` |

---

## 6. Convergencia con la auditoría del copiloto (por qué esto no es teoría)

El [análisis de manejo de errores del copiloto](2026-07-28-analisis-manejo-de-errores-toda-la-app.md),
hecho **antes** de leer INL, encontró como clase raíz única: *"el fix existe, está documentado, y no
se propagó"* — **8 instancias**.

Eso es exactamente **G-1** sin nombrarlo, y por encima de su umbral: ≥3 activa el protocolo, y hay 8.
Según INL, el copiloto no debería estar arreglando esos 8 sitios: debería estar **corrigiendo el
generador** — que en ese caso es de tipo 3 y 4 del árbol de G-1 (*convención documental ambigua* y
*patrón arquitectónico con falla latente*), y cuyo fix es el gate mecánico que hoy no existe (cero
ESLint, CI que corre 11 de 92 tests de Python y 0 de 96 de TS).

Lo cual es, literalmente, **G-2 sin implementar**, y su diagnóstico exacto:

> *"Una regla en la Constitución que no puede garantizarse estructuralmente es hardcoding
> emocional — aspiración sin anclaje."* (`g2-gobernanza-dia-cero.md:160-164`)

Y el `except Exception: return None` que convirtió un fallo de Temporal en 12 respuestas `200 OK`
falsas es la violación exacta de A-4 paso 1: **no hubo captura, no hubo huella, no hubo trauma** — el
error se evaporó en vez de sellarse.

---

## 7. Lo que INL **no** da (hay que saberlo antes de implementar, no después)

| Hueco | Estado en el repo |
|---|---|
| **Idempotencia** | Prescrita como obligatoria (A-3, escudo 4) pero **el mecanismo nunca se especifica**: no dice si la llave es hash del payload, UUID, o constraint `UNIQUE`, ni dónde se verifica, ni qué pasa si la verificación falla |
| **Timeout** | **Sin valor canónico.** Sólo aparece como ejemplo ilustrativo (`agregue timeout de 30000ms`) dentro de una lección sobre cómo formular mandatos |
| **Circuit breaker** | 2 menciones en 88 archivos. Nombrado como "efecto deseable" del Adaptador, sin umbral, sin estado half-open. Lo único real es el `if (nodeFail >= 3) process.exit(4)` del pipeline |
| **Taxonomía de severidad** | **No existe.** A-1 clasifica por `tipo` y `reintentable`; no hay crítico/degradado/informativo ni qué acción dispara cada nivel. El campo `alerta_critica:true` aparece una vez, sin sistema que lo consuma |
| **Clasificación transitorio vs. lógico** | Es una **caja negra**: el diagrama tiene un paso `Clasificar causa` sin regla ni heurística |
| **"Ciclos de baja demanda"** | Nunca cuantificado. ¿Cron fijo? ¿Métrica de carga? Es el único escudo que cierra el loop sin humano y el que menos detalle tiene |
| **Post-mortem estructurado** | **No hay plantilla.** Lo más cercano es un catálogo `trauma → causa → fix`, sin impacto, timeline, detección ni MTTR |
| **Rollback / canary / blue-green / feature flags** | Ausentes del corpus |
| **Tests adversariales** | **1 mención en todo el repo.** El framework exige rigor empírico pero no prescribe probar el camino de fallo |
| **Saga / compensación** | 2 menciones, sin desarrollo |
| **No-linealidad del costo del fallo** | La no-linealidad está formulada para **productividad**, no para costo del error por etapa. La intuición "un fallo temprano cuesta exponencialmente menos" **no está demostrada en el repo** |

⚠️ **Trampa de nomenclatura:** `REGISTRO_TRAUMAS.md` **no es un catálogo de fallos de runtime.** Es un
*decision log* del propio repositorio (4 entradas, todas del 2026-04-20, formato de 7 campos: Tipo ·
Ley afectada · Contexto · Opciones · Decisión · Razonamiento · Consecuencia). Es excelente **como
plantilla de ADR narrativo** — y el artefacto equivocado si se clona buscando un registro de errores.

---

## 8. A-4 no está implementado en ninguna parte del repo — y el porqué es la lección más útil

Es el hallazgo con más consecuencias para la implementación, y hay que enunciarlo con precisión
porque la versión fácil ("el repo se contradice") **es falsa**.

**Lo que el framework predica** (`constitucion-agente-inl.md:60-64`, Ley 7):
> *"Los fallos se encapsulan en Dead Letter Queue y se procesan asincrónicamente. El usuario ve
> estado intermedio honesto, nunca error fatal."*

**Lo que su única implementación real hace** (`zep-pipeline`): hard-stop síncrono con
`process.exit(N)`, sin cola y sin reproceso automático.

**Pero el propio documento lo justifica, y hay que leerlo entero** (`lecciones_heredadas_de_arca.md:51-60`, L4):

> *"**Validación:** el patrón DLQ del framework INL — fallos no se mutan en caliente; se investigan y
> re-corren. […] **Aplicación INL:** en ingesta puntual, hard-stop es más seguro que en CI — **el
> operador está mirando la consola en tiempo real**. Si falla un lote, para, diagnostica, arregla."*

Dos cosas se siguen de ahí, y ninguna es "hipocresía":

1. **El autor reinterpreta "DLQ" como *"no mutar en caliente; investigar y re-correr"***, que es una
   lectura más débil que la del manifiesto (cola + agente + reinyección automática). El mismo nombre
   cubre dos mecanismos distintos.
2. **La decisión está justificada por el contexto: hay un humano mirando.** El zep-pipeline es una
   herramienta operada, no un servicio desatendido — y el sistema desatendido es exactamente el caso
   de uso de A-4.

> **La conclusión correcta, entonces, no es que el repo se contradiga: es que A-4, el Agente de
> Sanación y L5 no están implementados en ninguna parte del repositorio.** Son diseño. La única
> implementación de referencia que existe resolvió un problema distinto y eligió, con razón
> declarada, el patrón opuesto.

**Qué significa para el copiloto:** implementar A-4 sería **la primera implementación real del
patrón**, sin caso de referencia del que copiar. Eso no lo invalida —el diseño es sólido y Temporal da
las primitivas— pero cambia el nivel de riesgo: no es "adoptar algo probado", es "construir lo que el
framework describe". Con la ventaja de que el copiloto **sí es** un sistema desatendido, que es donde
A-4 tiene sentido.

Y hay una lección que el repo no enuncia pero su código demuestra, y que es el criterio de decisión
que faltaba:

> **El auto-healing aplica a lo que es seguro reintentar. Donde el reintento puede corromper, el
> patrón correcto es hard-stop + humano.** No es una decisión filosófica: depende de si la operación
> es **idempotente**.

Lo cual conecta con el hueco #1 de §7: **INL exige idempotencia sin decir cómo lograrla, y es justo
la propiedad que decide cuál de sus dos patrones aplica a cada frontera.** Ese es el eje del mapa de
puntos de fallo que viene después (§11).

*(Detalle menor pero coherente: la opción `onError:'log-continue'` existe en la librería y jamás se
usa; los dos ingesters duplican la lógica de batching en vez de llamar a la abstracción — una
violación del propio A-1 dentro del repo que lo predica.)*

---

## 9. Lo que ya opera como "INL" y no está en INL

`~/.claude/CLAUDE.md` (global del operador) prescribe:

> *"Fingerprint criptográfico `(workflow + nodo + error_type + payload_shape)` en errores que
> alimentan DLQ."*

**Eso no está en el repo INL.** El repo dice "huella técnica del error" sin definirla. El fingerprint
con esos 4 campos es **extensión propia del operador** — y es una buena: es exactamente lo que permite
contar instancias por firma y disparar G-1 automáticamente (`COUNT(*) >= 3` agrupando por fingerprint).

Vale registrarlo por dos razones: (a) al implementar, no hay que buscar en INL algo que no está; (b)
es un aporte que podría volver al repo canónico.

---

## 10. Qué es adoptable tal cual, y qué hay que construir

| Adoptable **tal cual** (copiar) | Hay que **construir** (INL sólo da el principio) |
|---|---|
| El `ERROR_MAP` declarativo de A-1 | El mecanismo de idempotencia (llave, verificación, colisión) |
| El bloque XML `<diagnostic_protocol>` de C-5 | El *probe* de "condiciones externas restauradas" por dependencia |
| La escala L0→L5 como instrumento de diagnóstico | La taxonomía de severidad y qué acción dispara cada nivel |
| El procedimiento de 5 pasos de G-1 | La regla que clasifica transitorio vs. lógico |
| Los umbrales de §5 | La definición operativa de "ciclo de baja demanda" |
| El formato de 7 campos de `REGISTRO_TRAUMAS` (como ADR narrativo) | Una plantilla de post-mortem (impacto, timeline, MTTR) |
| El Delta Cognitivo y el Handshake (3 preguntas de cierre / lectura al abrir) | El Sensor AST (parser + reglas codificadas + gate en CI) |
| Los KPIs sano/alarma | Tests adversariales del camino de fallo |
| Las 6 líneas rojas del agente reparador | Rollback / canary / feature flags |

---

## 11. El siguiente paso (no ejecutado — el pedido era analizar)

Con este mapa y el [análisis del copiloto](2026-07-28-analisis-manejo-de-errores-toda-la-app.md), lo
que falta para el plan de implementación es **un mapa de puntos de fallo del sistema real**: cada
frontera del copiloto (HTTP, workflow, activity, gateway, store, cliente, UI) clasificada por (a) qué
nivel L0–L5 tiene hoy, (b) si su operación es idempotente — que es lo que decide entre auto-healing y
hard-stop (§8), y (c) qué patrón INL le corresponde.

Ese mapa se puede construir con las tres fuentes que el operador nombró: el dossier de errores ya
mergeado, el código real, y el grafo (`code-copiloto-emprendedor`). No está hecho todavía.

---

*Los 6 barridos crudos, con sus refutaciones y marcas de `[ASSUMED_PENDING_VERIFY]`, quedaron en el
scratchpad de la sesión (`inl-rep-{A..F}.md`).*
