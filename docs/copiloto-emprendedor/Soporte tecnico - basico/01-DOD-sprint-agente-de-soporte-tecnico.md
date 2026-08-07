# DoD — Sprint «Agente de soporte técnico»

> **Orden del operador, 2026-08-07:** *«todo debe estar probado y funcionando E2E, listo para usar en
> la app»* · *«redactá el DoD completo del sprint de soporte técnico… todo probado y funcionando»*.
>
> **Diseño y decisiones:** [`00-MAESTRO-agente-de-soporte-tecnico.md`](00-MAESTRO-agente-de-soporte-tecnico.md).
> Este documento **no vuelve a discutir** nada de eso: sólo define **cuándo está terminado**.

---

## 0. Cómo se usa este DoD (leer una vez, aplica a todo lo de abajo)

**Cada ítem es binario y verificable por un tercero.** Si un ítem se puede marcar en verde leyendo el
código o confiando en el criterio de quien lo hizo, está mal redactado — reescribilo hasta que exija
**una corrida**.

| Regla | Por qué |
|---|---|
| **La evidencia se adjunta, no se afirma.** Comando + salida, o captura del device | La autoevaluación del agente no cuenta como verificación (`CLAUDE.md` regla 5) |
| **Los tests corren en el VPS**, no en la PC | La PC no tiene `temporalio`/`psycopg2`. «Verde local» no existe acá |
| **Lo táctil se prueba en el device**, no en jsdom | El gate jsdom no ve gestos ni layout ([[gate-jsdom-no-ve-gestos-tactiles]]) |
| **Todo control tiene su caso negativo** | Un mecanismo roto hacia el «no» no da síntoma ([[un-mecanismo-roto-hacia-el-no-no-da-sintoma]]) |
| **Control diferencial:** revertí el fix y el test tiene que ponerse ROJO | Un test que pasa igual sin el código no prueba nada ([[no-romper-no-es-arreglar]]) |
| **Un ítem bloqueado no se tacha: se declara** con dueño y disparador | Media compuerta abierta es compuerta abierta |

**Dueños:** `BE` backend · `FE` frontend · `FUS` sesión `supabase-self-host-blueprint` (RAG en
fusion) · `PLA` planificación · `OP` operador.

---

## 1. Alcance

**Entra:** el chat de soporte embebido en la app (mobile **y** web), con sus **tres funciones**
(soporte técnico · cómo uso la app · feedback), su agente **GPT-4o-mini** alimentado por el **RAG de
fusion**, el ciclo de vida del ticket `SOP-XXXX` con estados automatizados, el paso previo por
**autosanación**, la respuesta del operador desde la consola, y la notificación al usuario vía
**Actividad**.

**No entra:** rediseñar el chat del copiloto · migrar `copiloto_feedback` (convive) · el corpus de
soporte **interno** más allá de la selección (el de usuario sí entra) · métricas de negocio del
soporte.

**Precondiciones que deben estar ANTES de abrir el sprint:**

- [ ] `PLA/OP` — **Decisión MAYOR cerrada: A+gates vs C** (§8.4 del maestro). Sin esto, la mitad de
      los ítems del bloque C no tienen forma definida. **Es la que bloquea todo.**
- [ ] `FUS` — namespace y `cliente_id` de la KB creados y nombrados (≠ `soporte`, que está ocupado
      por otro sistema).
- [ ] `PLA` — corpus de usuario **escrito** (§2.A). Sin contenido no hay nada que recuperar.

---

## 2. DoD por bloque

### A · Corpus y RAG — `PLA` + `FUS`

- [ ] **A1** `PLA` · Escritos los **~17 documentos** de «cómo usar la app», uno por función real
      (`escritorio · chat · facturacion · presupuestos · clientes · ingresos · gastos · contabilidad ·
      actividad · recientes · inteligencia · midia · apps · captura · ajustes · auth · feedback`).
      **Evidencia:** los archivos en el repo + conteo.
- [ ] **A2** `PLA` · Cada documento cumple la forma que el pipeline premia: **Markdown con jerarquía
      de headers real**, un tema por documento, título descriptivo, prosa antes que bullets sueltos.
      **Evidencia:** conteo de `##`/`###` por archivo — cero documentos sin headers.
- [ ] **A3** `PLA` · **Cero PII y cero datos de tenant** en el corpus. **Evidencia:** grep de emails,
      IPs, hostnames y rutas absolutas → 0 hits, **con control positivo** (el mismo grep encuentra
      algo en un archivo sembrado a propósito).
- [ ] **A4** `FUS` · Corpus ingestado en su namespace. **Evidencia:** conteo de `documents` y
      `chunks` en `rag`, y que el número **coincida** con lo entregado (no «se ingestó bien»).
- [ ] **A5** `FUS` · **Spike de retrieval verde antes del ingest masivo**: para las preguntas semilla,
      ¿devuelve el chunk correcto? **Evidencia:** tabla pregunta → chunk devuelto → ✅/❌.
- [ ] **A6** `PLA` · Preguntas del eval-set entregadas **etiquetadas como sintéticas** mientras no
      haya usuarios reales. **El ratio que se mida antes de la beta se declara PROVISIONAL** y se
      re-mide con tickets reales. *No se fabrican preguntas «reales»: contaminarían la única medición
      que justifica el trabajo.*
- [ ] **A7** `FUS` · Ratio anti-alucinación medido sobre el corpus del copiloto y **reportado con su
      denominador** (cuántas preguntas, cuáles). Un porcentaje sin denominador no es una medición.
- [x] **A8** `FE` · **Comportamiento sin conexión, verificado en device** (modo avión): qué pasa con
      el Escritorio, los accesos directos y la actividad reciente. Salió como pregunta al escribir el
      corpus y **no se puede resolver leyendo código**. Mientras no esté probado, el corpus **no lo
      afirma** — se le quitó la pregunta en vez de contestarla de memoria. **Evidencia:** el resultado
      real observado, y con eso se agrega la sección al documento.
      **✅ MEDIDO 2026-08-07 16:13-16:18 en `RF8R50N2WGR`** (APK `preview` standalone, commit
      `f3b0f79f`). Modo avión por `cmd connectivity airplane-mode`, con **control de red real**
      (`ping` al backend ⇒ `unknown host`) — no confié en el flag `airplane_mode_on`. Cuatro
      resultados, con captura y volcado de UI cada uno:
      1. **Línea base online** — Escritorio con sus 8 accesos + «Actividad reciente» poblada (29
         textos).
      2. **App ya abierta y se cae la red** → pantalla **idéntica**, `diff` de textos vacío (29/29).
         Lo renderizado se sostiene; no se actualiza.
      3. **Arranque en frío sin red** → **cae a la pantalla de entrada** (7 textos): ni Escritorio, ni
         accesos, ni actividad reciente. **No hay caché offline.**
      4. **El control que decide si además es un bug de CTA7** — avión OFF + arranque en frío ⇒
         **entra solo, sin credenciales**. La sesión **sobrevive**: sin red no se puede *validar*,
         pero no se *destruye*.
      **Confirmado del lado del SERVIDOR, no sólo por la pantalla** (`journalctl -u
      uc-copiloto-web.service`, IP del device `181.93.120.21`; ojo que el VPS loguea en **UTC** —
      pedir la ventana en hora local devuelve vacío y parece un hallazgo):
      - ventana del avión (19:16:20→19:17:13 UTC): **0** peticiones — el corte fue real;
      - ventana con red (19:17:40→19:18:10 UTC): **5** peticiones, `GET /me` · `/perfil-negocio` ·
        `/actividad?limit=20` · `/conceptos`, todas **200**.
      Ese `/actividad?limit=20` es la prueba directa de lo que el corpus ahora afirma: **la actividad
      reciente se trae del servidor cada vez**, no de un caché local. Y de yapa cierra el cabo suelto
      de **ODOBI6** (dueña: frontend): el standalone **sin Metro** habla con producción ⇒
      `EXPO_PUBLIC_API_BASE` **sí quedó horneada** en el bundle.
      ⚠️ **Lo que este binario NO puede responder:** si un corte de red fabrica un falso «Tu sesión
      expiró». `f3b0f79f` **no contiene** el código del aviso (`grep MENSAJE_SESION_EXPIRADA` → 0, con
      control positivo → 1 en `c583f0ec`), así que observar su ausencia sería **vacuo**. Se re-corre
      sobre el build `db0747d3` y se anota acá.
- [ ] **A9** `PLA` · Al cerrar el sprint, **actualizar `entrar-y-tu-cuenta.md`**: hoy dice que para
      recuperar el acceso hay que escribirle al equipo, sin nombrar un canal — porque **el canal es
      justamente lo que este sprint construye**. Cuando el chat de soporte exista, el documento debe
      decir cómo llegar a él. *Es el caso circular del corpus: no se inventó un canal para no dejar
      un hueco, y el hueco quedó anotado en vez de tapado.*

### B · Persistencia y dominio — `BE`

- [ ] **B1** Tablas `tickets` y `mensajes` creadas por el script de provisionado **idempotente**
      (corre dos veces sin efecto). **Evidencia:** dos corridas, misma salida.
- [ ] **B2** **RLS `FORCE`** por `cliente_id` en ambas. **Evidencia:** `pg_policies` + el test
      adversarial de H1 (no basta con que exista la policy).
- [ ] **B3** Código `SOP-XXXX` **legible, con fecha**, único por tenant. **Derivado dentro de la
      activity**, nunca de un contador global — continue-as-new reinicia números y dos tenants
      colisionan ([[derivar-la-clave-dentro-de-la-activity-no-tocar-el-payload]]).
      **Evidencia:** test de colisión con dos tenants generando en paralelo.
- [ ] **B4** `copiloto_feedback` **intacta**: mismas 4 columnas, la consola la sigue leyendo, cero
      migración. **Evidencia:** schema antes/después idéntico.
- [x] **B5** Toda acción que muta **hecha por un administrador** escribe su fila en
      `copiloto_auditoria`. **Evidencia:** una acción real → la fila correspondiente.
      **Se satisface en `E2` (SOP6), NO en este bloque** — verificado 2026-08-07.

      > ⚠️ **Esta línea decía «toda acción que muta», sin distinguir quién la hace, y chocó contra el
      > schema real.** `copiloto_auditoria` (CONS1) exige `admin_user_id uuid NOT NULL` +
      > `admin_email text NOT NULL`: es el registro de acciones **de administrador**, precondición de
      > CONS7. Un tenant creando su propio ticket **no tiene un admin en el camino**, así que
      > satisfacer la línea tal como estaba escrita obligaba a inventar un valor — una fila que
      > **miente sobre quién hizo qué**. Eso es peor que no tener la fila: una auditoría con datos
      > fabricados se cita después como si fuera cierta.
      >
      > Backend cazó el choque leyendo el schema en vez de forzar el campo, y resolvió táctico tras
      > ~5 h sin respuesta de planificación (decisión correcta: era reversible y estaba documentada).
      > El defecto era **de este DoD**, no de la implementación. Si en algún momento hace falta un
      > registro de eventos de **dominio** (los del tenant), el lugar es `copiloto_eventos`, que ya
      > existe — no ensanchar el de auditoría.

### C · El agente — `BE`

- [ ] **C1** Chat de soporte con **workflow, system prompt, toolset y `task_queue` propios**. Reusa
      `ConversationWorkflow` y el canal web del motor, **no** el cerebro del copiloto. **Evidencia:**
      el `task_queue` en runtime + un `grep` que muestre que no comparte prompt.
- [ ] **C2** **GPT-4o-mini** cableado, con la key desde el vault — **nunca** de env var en claro.
      **Evidencia:** la llamada real en un log estructurado, con el modelo efectivo.
- [ ] **C3** **Historial de 20 turnos** en soporte técnico y en «cómo uso la app». **Feedback no
      conversa**: one-shot, sin hilo. **Evidencia:** turno 21 → el turno 1 ya no está en contexto, y
      el 2 sí.
- [ ] **C4** Las **tres funciones** enrutadas por **elección explícita del usuario** (determinista,
      sin modelo). **Evidencia:** las tres entradas producen tres flujos distintos, verificado en la app.
- [ ] **C5** **Gates de sufficiency y grounding activos** (heredados por HTTP si es C, replicados si
      es A+gates). Con 4o-mini esto no es refinamiento: es lo que hace funcionar el conjunto.
      **Evidencia:** una pregunta sin respuesta en el corpus → el agente **no** la contesta.
- [ ] **C6** Tono: cálido, cercano, servicial, **sin pasarse** — y nunca a costa de una respuesta
      real. **Evidencia:** 5 respuestas reales revisadas por el operador. *(Único ítem con criterio
      humano; se declara como tal, no se disfraza de métrica.)*
- [ ] **C7** Feedback devuelve **la frase fija** («Tu mensaje quedó anotado. Estas ideas son las que
      ayudan a mejorar… ¡Gracias por tu aporte!») y **no** abre hilo. **Evidencia:** en la app.
- [ ] **C8** El agente **jamás** consulta datos de otro tenant, y los datos del negocio se leen **por
      SQL con tenant declarado**, no por retrieval. **Evidencia:** el toolset enumerado + H1.
- [ ] **C9** 🔴 **Acceso al grafo del repositorio** (`graphity-code`, `group_id=code-copiloto-emprendedor`)
      como herramienta del agente — decisión del operador: *«hay que darle acceso al grafo del
      repositorio para que tenga información concreta… puede citar dónde está el problema al escalar
      el ticket»*. **Evidencia:** un ticket escalado que **cita archivo y función reales**, verificados
      contra el repo.
      ⚠️ **Con el reparo ya medido (§10.1 del maestro):** al grafo **no** se le da la queja del
      usuario — la búsqueda semántica sobre prosa de usuario trae resultados no relacionados (spike
      2026-08-04). Se le da el **trauma** (vocabulario técnico: `workflow`, `error_type`, símbolo).
      **Control negativo obligatorio:** una queja en lenguaje natural **no** debe producir una cita
      falsa con aire de certeza — es peor que no citar.
- [ ] **C10** 🔴 **Acceso a los errores del usuario y de la app** — decisión del operador, misma
      frase: *«acceso a errores del usuario y de la app en general… eso nos ahorra tiempo luego para
      resolver»*. En concreto: los traumas del tenant (`copiloto_traumas`) y el estado de salud
      general. **Evidencia:** una consulta donde el agente reconoce *«esto está roto y ya lo sabemos»*
      con el trauma real detrás, y un escalado que lo adjunta.
      **Acotación de aislamiento:** los errores **del usuario** se leen con su tenant declarado (H1);
      los **de la app en general** son agregados sin datos de terceros. Nunca se le muestra a un
      usuario el error de otro.
- [ ] **C11** El **identificador del ticket es sólo `SOP-XXXX` con fecha**. **No** se agrega un
      segundo identificador con nombre. *El operador lo planteó como posible mejora; la recomendación
      de planificación fue en contra y quedó así: dos identificadores para el mismo objeto es una
      fuente de ambigüedad («¿cuál me pediste?»), y el código legible ya cumple la función de ser
      dictable y buscable.* **Si el operador lo revierte, se implementa** — pero entonces uno de los
      dos es el canónico y el otro un alias, declarado explícitamente.

### D · Ciclo del ticket y autosanación — `BE`

- [ ] **D1** Un ticket técnico entra **primero en la cola de autosanación** y sigue ese flujo: si se
      resuelve, se resuelve; si no, escala a issue como ya está configurado. **Evidencia:** un caso
      de cada rama, con su rastro.
- [ ] **D2** Estados **100 % automatizados** salvo el escalado a humano. **Evidencia:** transiciones
      observadas, sin intervención manual.
- [ ] **D3** El cierre lo hace soporte **cuando el problema está efectivamente resuelto**, y al
      usuario **se le comunica el cierre**. ⚠️ «Resuelto» ≠ «el PR mergeó»: exige que **el caso del
      usuario funcione**. **Evidencia:** el caso reproducido y funcionando, no el merge.
- [ ] **D4** El escalado incluye la **localización concreta** (archivo/función/`error_type`), que es
      lo que ahorra tiempo después. **Evidencia:** un ticket escalado real con esa información.
- [ ] **D5** El clasificador existente (`soporte_clasificador.py`) **se conserva** y su
      `necesita_humano=True` pasa de callejón a **transición de conversación**. **Evidencia:** un
      caso que antes moría ahí y ahora continúa.

### E · Consola del operador — `BE` + `FE`

- [ ] **E1** El operador **responde** desde la consola (hoy es read-only). **Evidencia:** respuesta
      enviada y recibida en la app.
- [ ] **E2** La acción de responder es **acción que muta**: fila en `copiloto_auditoria` con autor.
- [ ] **E3** Los tickets se listan con estado, código y última actividad; **se puede buscar por
      `SOP-XXXX`** — que es para lo que existe el código legible.
- [ ] **E4** Gate visual en **los 3 temas** (regla de la app). **Evidencia:** capturas de los tres.

### F · El chat en la app — `FE`

#### 🔗 La costura `BE ↔ FE` — decidida 2026-08-07, **no la reinvente ninguno de los dos lados**

Backend llegó a este punto con un *«probablemente un endpoint o un parámetro en el `POST /chat`
existente»*. Ese «probablemente» es el agujero donde cada lado verifica su mitad y la junta no es de
nadie. Queda fijado así:

```
POST /soporte/chat    body: {"session_id": str, "text": str, "kind": "text"}   (reusa ChatIn, web.py:488)
                      → {"wf_id": str|null, "accepted": bool}                  (mismo shape que /chat)
GET  /reply           SIN CAMBIOS — mismo endpoint, misma firma (web.py:748)
```

**Ruta dedicada, y el dominio NO lo elige el cliente.** `domain="soporte_tecnico"` y la `task_queue`
son constantes **del servidor** (parametrizadas por env, mismo patrón que `web.py:67`), igual que
`/chat` fija hoy `emprendedor`/`agent-emprendedor`. Las tres razones, la primera es dura:

1. **🔴 Un parámetro que elige `task_queue` es superficie de ataque.** Con `{"dominio": "..."}` en el
   body, el cuerpo del request decidiría **qué workflow y qué cola** arrancan. El `cliente_id` sale
   del token (bien), pero el *destino* saldría del cliente. La regla que este repo ya sigue:
   **el tenant viaja en el token; el destino lo fija la ruta.**
2. **Separación de costo** — un turno de soporte no es un turno de negocio; con rutas distintas el
   metering los diferencia sin desambiguar por el body.
3. **La config no es la misma** — `/chat` va con `memory: False` y el `engine_mode` del copiloto;
   soporte corre `react`, toolset propio y acceso al grafo. Dos configuraciones en un `if` del mismo
   handler es como una hereda el default de la otra sin que nadie lo note.

**`session_id` con prefijo `sop:`**, generado por el cliente y **estable durante la conversación**
(`/reply` filtra por él: si se regenera por turno, cada respuesta se pierde). No es un control de
seguridad —el aislamiento lo da `cliente_id` del token— sino la convención que evita que las dos
conversaciones del mismo usuario colisionen.

⚠️ **Control negativo obligatorio, porque este fallo es MUDO:** un turno a `/soporte/chat` y otro a
`/chat` **con el mismo `session_id`** → las respuestas no se mezclan. Un cruce de conversaciones no
tira ningún error; sólo aparece un mensaje raro en la pantalla equivocada.

**Fuera de alcance:** voz en soporte (v1 es texto; `/chat/audio` no se replica todavía) y la
respuesta del operador desde la consola (eso es `E`/SOP6).

- [ ] **F0** El cliente consume **exactamente** el contrato de arriba. Si al integrar algo no
      coincide, **el que no coincide es el código, no el contrato**: se reporta, no se adapta. (Así
      cazó frontend el shape equivocado de A6 en CONS6.)
- [ ] **F1** **Mobile:** chat de soporte accesible desde su entrada, con las tres funciones.
      **Probado en device.**
- [ ] **F2** **Web: paridad.** Esto **cierra CTA3**, que está frenado esperando este diseño. Si la web
      queda afuera, el sprint **no** está terminado — la asimetría actual no tiene motivo declarado.
- [ ] **F3** **El primer mensaje es del agente**, respondiendo la consulta — requisito explícito del
      operador, no un detalle de UX.
- [ ] **F4** Ventana **discreta**, al estilo de las apps del rubro; no una pantalla completa que
      compita con el chat del copiloto.
- [ ] **F5** El teclado **no tapa** el campo ni mata el scroll (trampa ya pagada acá:
      [[teclado-tapa-campos-cascara-glass]]). **Evidencia:** device, con teclado abierto.
- [ ] **F6** Estados de error en **castellano**: sesión caída → login; red caída → mensaje honesto.
      Nunca un error interno en inglés.
- [ ] **F7** Gate visual en los 3 temas, mobile y web.
- [ ] **F8** **`refused` y `unavailable` NO pueden verse iguales.** *«No sé la respuesta, te abro un
      ticket»* y *«el servicio no está disponible ahora»* son estados distintos, y el usuario tiene
      que poder distinguirlos: del primero se sigue esperando una respuesta humana; del segundo, que
      vuelva a intentar. El agente los discrimina por el campo `outcome`, **nunca por el texto**
      (fusion diseñó `refused` con `answer: null` justamente para que el texto rechazado no exista
      del lado del cliente: lo que no viaja no se puede filtrar). Si la app los colapsa en un solo
      cartel, tira abajo esa decisión de diseño desde el otro extremo.

### G · Notificaciones — `BE` + `FE`

- [ ] **G1** Cuando el operador responde, al usuario le llega **notificación en Actividad**,
      **enlazada al mensaje** dentro de la función. **Evidencia:** en device, tocando la notificación
      y llegando al mensaje.
- [ ] **G2** El cierre del ticket **también** se comunica.
- [ ] **G3** La notificación respeta el tenant: sólo la ve su dueño (cubierto por H1).

### H · Seguridad y multitenant — `BE`

- [ ] **H1** 🔴 **Test de integración adversarial**: el tenant A intenta leer/responder el ticket y
      los mensajes del tenant B → **denegado**. **Es precondición de cierre, no un extra**: un control
      declarado y no ejercitado por un test hostil es indistinguible de uno ausente (`CLAUDE.md`
      §Seguridad; el caso ADR-013 vivió ~2 meses en prod por esto).
- [ ] **H2** Ninguna key en el código ni en env var en claro; todo por vault.
- [ ] **H3** Cero PII del usuario enviada al modelo más allá de lo necesario para responder, y
      declarado explícitamente qué se envía.

### I · Observabilidad y costo — `BE`

- [ ] **I1** Log estructurado JSON de cada consulta: función, modelo, tokens, latencia, si hubo
      retrieval y si el gate rechazó.
- [ ] **I2** Costo por consulta medido sobre corridas reales — **medido, no estimado**.
- [ ] **I3** Los fallos hacia el RAG/modelo se serializan con fingerprint para reintento (patrón
      Trauma Empaquetado), no se pierden.

---

## 3. Los E2E obligatorios — en la app corriendo

**Ninguno de estos se sustituye por un test unitario.** Device para mobile, navegador para web, con el
usuario canónico `e2e-device@copiloto.test`.

| # | Guion | Verde si |
|---|---|---|
| **E1** | Abrir soporte → elegir **cómo uso la app** → *«¿cómo emito una factura?»* | Responde **con contenido del corpus**, correcto contra el documento fuente — no «suena bien» |
| **E2** | Elegir **soporte técnico** → describir un problema real | Primer mensaje del agente respondiendo; si no puede sostenerlo, **lo dice**, da `SOP-XXXX` y crea el ticket |
| **E3** | Elegir **feedback** → enviar | Frase fija, **sin** hilo abierto, fila en `copiloto_feedback` |
| **E4** | El operador responde ese ticket desde la consola | Llega a la app + **notificación en Actividad enlazada al mensaje** |
| **E5** | Continuar la conversación 21 turnos | El turno 1 cayó del contexto, el 2 no; la conversación **sobrevive** a cerrar y reabrir la app (durabilidad = el moat) |
| **E6** | Cerrar el ticket | El usuario **se entera** del cierre |
| **E7** | Repetir E1 en **web** | Paridad real. Cierra CTA3 |

---

## 4. Controles negativos — esto es lo que no se saltea

Cada uno se ejercita **provocando la falla**, no razonándola. Es la diferencia entre *«funciona»* y
*«funcionó la vez que lo miré»*.

- [ ] **N1** **RAG/orquestador apagado a propósito** → el agente contesta con honestidad («no puedo
      consultar la base ahora, escalo tu ticket») y **escala**. No inventa un fallback.
- [ ] **N2** Pregunta cuya respuesta **no está en el corpus** → no la contesta; escala. *(Éste es el
      que caza el fallo propio de un modelo chico.)*
- [ ] **N3** **Sesión caída** → manda al login en castellano, no un error interno.
- [ ] **N4** Tenant ajeno → denegado (H1), corrido como test, no como razonamiento.
- [ ] **N5** **Control diferencial de la suite:** revertir cada fix ⇒ su test se pone **ROJO**. Un
      test que pasa igual sin el código no está probando el código.
- [ ] **N6** **Control positivo del corpus:** una pregunta cuya respuesta **sí** está, y el retrieval
      la trae. Sin esto, un retrieval roto que nunca devuelve nada pasaría N2 con honores.

> N6 existe porque N2 solo es satisfactible por un sistema **completamente roto**: si el retrieval
> nunca devuelve nada, el agente siempre escala y todos los negativos salen verdes. **Todo gate
> necesita su control positivo.**

---

## 5. Qué NO cuenta como evidencia

- «Los tests pasan» sin decir **cuántos** y **cuáles** — un instrumento que no mira nunca falla.
- Verde en jsdom para cualquier cosa táctil o de layout.
- Verde en la PC (no tiene las dependencias).
- «Está desplegado» como sinónimo de «funciona»: desplegado ≠ probado
  ([[desplegado-no-significa-con-clientes]]).
- Un merge como prueba de que el problema del usuario se resolvió (ver D3).
- Un ratio anti-alucinación **sin denominador** ni etiqueta de provisional (A6, A7).

---

## 6. Cierre

El sprint se declara terminado cuando **todos** los ítems de §2, los **7 E2E** de §3 y los **6
controles negativos** de §4 están en verde **con su evidencia adjunta**, y se emite el `cierre_` en el
buzón con esa evidencia enlazada.

**Un ítem bloqueado no se tacha: se declara**, con su dueño y el disparador exacto que falta. Los
demás se terminan igual — bajar el alcance es decisión del operador, no de quien ejecuta.
