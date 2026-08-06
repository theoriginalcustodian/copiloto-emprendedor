# Memoria — Copiloto del Emprendedor

> **Una línea = un gancho, no un resumen** (≤160 chars): el detalle vive en el topic file.
> **Techo duro: 25.000 caracteres** — lo que pase de ahí se trunca y no existe para la sesión
> ([[el-indice-truncado-fabrica-duplicados]]). Al llegar al techo no se comprime más: se baja a
> [HISTORIA.md](HISTORIA.md) (no se carga; buscable). Control: `scripts/medir-indice-memoria.py`.

## 🚦 Estado vivo

**"¿en qué estábamos?"** → [`HANDOFF.md`](../HANDOFF.md) · detalle → `CLAUDE.md §4-5` · frentes → `coordinacion/PLAN.md`.

- **Prod-beta multitenant vivo**, smoke 10/10, RLS `FORCE` aplicando. [[copiloto-deploy-multitenant-vivo]] · [[rls-activado-que-no-filtraba-el-dueno-esta-exento]]
- **🛡️ Manejo de errores — frente COMPLETO, fases 0→3 en prod** (#151→#185) + **autohealing global** E2E: uno para toda la app, `BYPASSRLS`, abre PRs solo, gate que distingue *arregla* de *no rompe*. → `Manejo de errores/07-ESTADO-…-08-01.md` · [[no-romper-no-es-arreglar]]
- **⚠️ Ese frente lo destaparon INSTRUMENTOS QUE MENTÍAN, no features** (5 de 35 PRs). [[instrumentos-que-confirman-en-vez-de-verificar]]
- **✅ Cerrados:** AFIP E2E en device · presupuestos + perfil · clientes (falta voz) · mobile-first. [[copiloto-facturacion-afip]] · [[copiloto-mobile-first-cascara-glass]]
- **🚧 Abiertos:** OAuth Google (es de Composio) · ingesta real al grafo (MAYOR). [[copiloto-oauth-google-propio]] · [[copiloto-ingesta-grafo-por-tenant-real-frente-abierto]]
- **🔀 Tres sesiones** por buzón · **identidad:** agentes durables (moat = Temporal) · [[copiloto-emprendedor-roadmap]]. [[coordinacion-tres-sesiones-buzon]] · [[factory-identidad-automatizacion-ia]]

## 🔑 Órdenes del operador (reglas duras — se cumplen, no se evalúan)

- [Autorización PERMANENTE de merges/deploys — y de toda decisión TÁCTICA](autorizacion-permanente-merges-y-deploys.md) — no re-preguntar nimiedades; sólo escala lo MAYOR.
- [Autónomo = ejecutar, no esperar un "dale"](ejecutar-autonomo-no-esperar-si-dale.md) — disparador cumplido ⇒ se ejecuta. Costó ~400 min de ocio.
- [Un solo usuario de prueba canónico, a fuego](usuario-de-prueba-canonico-uno-solo-a-fuego.md) — `e2e-device@copiloto.test`. Ningún agente elige otro.
- ["Terminado" exige evidencia de DEVICE](una-orden-cerrada-exige-evidencia-de-device.md) — implementado + desplegado + probado en device + `cierre_`.
- [Iterar en device NO compila nada](iterar-en-device-es-metro-local-con-dev-client-ya-instalado.md) — dev-client ya instalado + Metro local por USB.
- [Aplicar `/ejecutar-con-eficiencia` siempre](aplicar-siempre-ejecutar-con-eficiencia.md) — proactiva y constante, no sólo si se invoca.
- [TODA la fábrica corre en el VPS, nunca en local](apps-deploys-siempre-vps.md) — la PC SOLO edita. Montar en local rechazado 2×.
- [documed-front es la app CANÓNICA de UI](consultar-documed-siempre-antes-de-implementar.md) — leerla ANTES de implementar. Portar adaptando, no copiar ciego.
- [No PR/commit/merge por cada cambio chico](batch-cambios-no-pr-por-tweak.md) — se juntan. Reincidí con 7 PRs en una sesión.
- [No insistir con rotar keys en dev](no-insistir-rotacion-keys-desarrollo.md) — diferido a prod; sólo no commitear ni pegar en chat.

## 🧭 Cómo trabajo

### Cadencia, cierre y ocio

- [🔁 EL BUCLE CANÓNICO — dos auditorías y el enganche](bucle-canonico-dos-auditorias-y-el-enganche.md) — **marco de todo sprint**. A1 audita el plan y puede rechazarlo; A2, el resultado.
- [🚫📋 NUNCA cierres el turno con un REPORTE](nunca-cerrar-el-turno-con-un-reporte.md) — si el operador puede preguntar "¿y cómo seguimos?", cerraste mal. Canon 8a.
- [⏳💥 ESCASEZ = ejecutar, NO preguntar](escasez-de-recurso-dispara-ejecucion-no-consulta.md) — reordená por impacto÷costo y despachá YA. Enumerar y no ejecutar ES el error. Canon 8b.
- [🚫💤 CERO ocio — tres estados, uno prohibido](cero-tiempo-ocioso-tres-estados.md) — único no-trabajar válido: terminó todo y reportó.
- [🛑💤 Detectar la parálisis y sólo reportarla es ocio PASIVO](deteccion-de-paralisis-sin-resolucion-es-ocio-pasivo.md) — 9 h ociosas con 3 monitores. El blocker suele ser un grep MÍO.
- [🚦 Ejecutar la COLA acordada no es decisión de scope](ejecutar-la-cola-acordada-no-es-una-decision-de-scope.md) — el próximo hito ya contratado es ejecución. Frené la fábrica 4 h.
- [⏳🚧 Una espera sin disparador NOMBRABLE es parálisis](una-espera-sin-disparador-nombrable-es-paralisis.md) — tu propio estado envejece; un estado falso da quietud, no bug.
- [🚧🔀 Un frente PARCIALMENTE bloqueado no es bloqueado](frente-parcialmente-bloqueado-no-es-bloqueado.md) — descomponé por disparador real antes de declararlo.
- [🕵️ Una sesión parada puede tener la respuesta ENTERRADA](sesion-parada-la-respuesta-existe-pero-enterrada.md) — contestada bajo otra pregunta o en el hilo de al lado.
- [⏱️➡️ Atar la acción a un MOMENTO, no a un estado](atar-la-accion-a-un-momento-no-a-un-estado.md) — "cuando X esté listo" no ocurre: nadie mira.
- [Trabajo oportunista en esperas asíncronas](trabajo-oportunista-esperas.md) — adelantar lo independiente y no-conflictivo; ejecutar una fase futura no.
- [Trabajo por fases — no anticipar](trabajo-por-fases-no-anticipar.md) — "luz verde para construir" ≠ "fase validada".
- [🚀📱 Entrega progresiva por hito + E2E en device](entrega-progresiva-y-e2e-en-device.md) — un hito no cierra hasta desplegado; el `avance_` sale DESPUÉS del deploy.
- [🎓 Cierre del aprendizaje no es opcional](cierre-del-aprendizaje-no-opcional.md) — test *¿puede volver?*; si no es "no por construcción", no terminó.
- [♻️ Cero deuda de MEJORA — implementar TODAS al cerrar](cero-deuda-de-mejora.md) — sólo se difiere no-código + MAYOR.
- [Cero deuda NO-GESTIONADA](cero-deuda-no-gestionada.md) — deliberada + visible OK; impaga o invisible, prohibida.
- [📋 Lo que NO está en la TABLA DE HITOS no existe](lo-que-no-esta-en-la-tabla-de-hitos-no-existe.md) — cada verbo de "dueño de qué" necesita su renglón.
- [🗂️ Índice de frentes abiertos → UN tablero](frentes-abiertos-tablero.md) — acá es `coordinacion/PLAN.md`.
- [Propagar el cierre a TODOS los docs maestros](propagar-cierre-a-docs-maestros.md) — al doc-de-registro único, verificado que existe.

### Evidencia: el instrumento antes que el resultado
- [🔌🕳️ La costura leía un campo que NADIE escribe](la-costura-leia-un-campo-que-nadie-escribe.md) — 0 errores HTTP en la DLQ por 4 días. Grepeá quién ESCRIBE el campo, no sólo quién lo lee.
- [🐤 El canario: control positivo de lo que falla CALLADO](el-canario-el-control-positivo-de-lo-que-falla-callado.md) — cuanto mejor el sistema, menos dice su silencio. Inyectá el caso a propósito.

- [No codificar la esperanza — el TRONCO](no-codificar-la-esperanza-principio-raiz.md) — la prueba vale, la aserción no.
- [Spike-first es central](spike-first-central-proyecto.md) — un cimiento no verificado se amplifica a escala.
- [🟢🔍 Un instrumento mal hecho no falla: CONFIRMA](instrumentos-que-confirman-en-vez-de-verificar.md) — *¿qué devolvería si lo que mido estuviera roto?* Catálogo de 11+ casos.
- [⚖️🔴 El instrumento también CONDENA, no sólo absuelve](el-instrumento-tambien-CONDENA-no-solo-absuelve.md) — el falso rojo no choca con nada y se disfraza de prudencia.
- [🫥 Un instrumento que NO MIRA nunca falla](instrumento-que-no-mira-nunca-falla.md) — preguntá **sobre cuántos elementos miró**, no sólo si pasó.
- [🗂️🕳️ Una sesión en WORKTREE es invisible para el monitor — el slug sale del `cwd`](una-sesion-en-worktree-es-invisible-para-el-monitor-el-slug-sale-del-cwd.md) — `project`. `no-ocio-check.sh` dio `9999min` + `DEAD-MAN` sobre frontend que había escrito 9 min antes: barre UN slug y ella escribe en otro. `9999` = "no encontré dónde mirar", no "no trabaja". **El buzón es fuente primaria**, el transcript sólo desempate.
- [🔕⬆️ Trabajar en un pedido lo SILENCIA](trabajar-en-un-pedido-lo-silencia.md) — `project`. El escalador mide `mtime` (último toque), no "sin respuesta desde": ampliar un `pedido_` lo llevó de 95min a 1min sin que nadie respondiera. Premia el abandono. Preguntá **qué evento reinicia el contador**.
- [🔬🙈 Probar que el instrumento miente NO te exime de leer lo que señala](probar-que-el-instrumento-miente-no-te-exime-de-leer-lo-que-senala.md) — `feedback`. Descarté 4 ciclos una alarma "ya probada falsa"; al 5º miré el archivo y su DoD estaba cumplido hacía 2h. Refutar una causa no refuta el hecho. Control: *suponiendo el detector roto como creo, ¿esto debería estar igual donde está?*
- [🕶️ Un instrumento CIEGO por RLS dice "no hay" en vez de "no veo"](un-instrumento-ciego-por-rls-dice-no-hay-en-vez-de-no-veo.md) — control de ceguera ANTES de contar.
- [🔇🚫 Un mecanismo roto hacia el "NO" no da síntoma](un-mecanismo-roto-hacia-el-no-no-da-sintoma.md) — fail-closed rompe idéntico a como funciona. Todo gate necesita control POSITIVO.
- [🕳️ Un vacío del PROPIO instrumento no es hallazgo](vacio-no-es-hallazgo-correr-el-control.md) — corré el control; horneálo en el script.
- [🩺🟢 "No rompió nada" NO es "arregló algo"](no-romper-no-es-arreglar.md) — un no-op es lo que MEJOR puntúa en un gate de no-regresión.
- [🔌🙈 El test que NO usa el camino de producción no puede verlo fallar](el-test-que-no-usa-el-camino-de-produccion-no-puede-verlo-fallar.md) — 8 adversariales verdes y ciegos.
- [🧪🔌 Tests que mockean la serialización son CIEGOS al borde del wire](tests-que-mockean-la-serializacion-son-ciegos-al-borde-del-wire.md) — `curl`/device lo caza en 30 s.
- [🧪⚡ La suite corre LOCAL contra Postgres efímero — 24 s](suite-local-en-vps-con-rol-no-superuser.md) — `test-db.sh` con rol NO-superuser. El CI es gate final, no consola.
- [📱 El gate jsdom NO ve gestos táctiles](gate-jsdom-no-ve-gestos-tactiles.md) — verde en vitest ≠ verificado. Probar en device.
- [🎯🕳️ El control corrido contra la BASE EQUIVOCADA](el-control-corrido-contra-la-base-equivocada.md) — nombrá la base; `comm -23` sobre slugs > contar líneas.
- [🔢 El DEFAULT de la herramienta devuelve más de lo que asumís](el-default-de-la-herramienta-devuelve-mas-de-lo-que-asumis.md) — un número que confirma tu hipótesis no dispara ningún control.
- [🎯📏 La regla que te obliga a mirar el instrumento EQUIVOCADO](la-regla-que-te-obliga-a-mirar-el-instrumento-equivocado.md) — 6 errores seguidos: el prompt mandaba a la fuente derivada.
- [📋❌ El DoD que escribí estaba mal y la evidencia lo corrigió](el-dod-que-escribi-estaba-mal-y-la-evidencia-lo-corrigio.md) — cierre como **propiedad**: «92/92» envejece en silencio.
- [🎯 Un supuesto cuya falla parece un estado LEGÍTIMO es una pregunta](supuesto-cuya-falla-parece-un-estado-legitimo.md) — *¿cómo se vería si fuera falso?*

### Guards, gates y jueces

- [🛡️💥 Un guard que grita en el caso NORMAL se desarma solo](el-guard-que-grita-en-el-caso-normal-se-desarma-solo.md) — el falso positivo enseña a saltearlo.
- [🚦💥 El guard da LUZ VERDE justo en su caso de activación](el-guard-falla-abierto-en-su-caso-de-activacion.md) — leé la rama de ERROR, no si el guard existe.
- [🪤 El guard que caza a su propio AUTOR](el-guard-que-caza-a-su-propio-autor.md) — si nunca te frenó, no sabés si funciona. Decir "verde" sin decir **dónde** oculta el hueco.
- [⚖️🗺️ Al JUEZ también hay que darle el plano](al-juez-tambien-hay-que-darle-el-plano.md) — rechazó 3/3 el parche correcto. Un juez sin contexto rechaza, y parece prudencia.
- [🔨🎯 El forjador NO acierta siempre — 11/12](el-forjador-no-acierta-siempre-el-gate-de-tests-no-es-opcional.md) — formato válido ≠ contenido correcto. El cuello: `SEARCH/REPLACE` ✅ vs diff ❌.
- [🚧🔁 El guard se vuelve el CUELLO DE BOTELLA de lo que protege](el-guard-se-vuelve-el-cuello-de-botella-de-lo-que-protege.md) — el canario tapaba la cola; declará si el rechazo es permanente.
- [🔀🕳️ Dos decisiones correctas que se cruzan en un AGUJERO](dos-decisiones-correctas-que-se-cruzan-en-un-agujero.md) — cada test miraba UNA bandera; el hueco vive en el par.
- [🔌⏱️ Un kill switch por env var NO es inmediato bajo systemd](kill-switch-por-env-no-es-inmediato-bajo-systemd.md) — `monkeypatch.setenv` mide el módulo, no el despliegue. Apagar = pausar el Schedule.

### Diagnóstico: leer el contrato antes de explicar

- [Raíz, no parche](raiz-no-parche.md) — hook `root_cause_suggester`.
- [🎯🕳️ Diseñar contra el riesgo TEMIDO ciega al caso NORMAL](disenar-contra-el-riesgo-temido-ciega-al-caso-normal.md) — corré el caso vacío: toda regla restrictiva default a no-hacer.
- [🏷️ El NOMBRE es una hipótesis sobre el contenido](el-nombre-es-una-hipotesis-sobre-el-contenido.md) — `copiloto_cobros` ES la tabla de ingresos. Leé el `WHERE`, no el identificador.
- [🎛️ Verificar la COMPOSICIÓN ROOT, no la capa que declara el default](verificar-la-composicion-root-no-el-default.md) — `worker_b.py` sobreescribe `llm.py`.
- [🏭 No pelear con un generador flaky — hand-fix + E2E primero](no-pelear-con-la-fabrica-hand-fix-primero.md) — snapshot, no stream; spike dirigido para la raíz.
- [🪠 El pipe se come el exit code](el-pipe-se-come-el-exit-code.md) — `cmd | tail` devuelve el status de `tail`. El veredicto es la SALIDA.

### Diseño y arquitectura

- [♻️🔒 Reutilizar es REGLA — el inventario va ANTES del diseño](reutilizacion-es-regla-el-inventario-va-antes-del-diseno.md) — "X no encaja en Y" invita a construir de cero. Todo `contrato_` abre con §0.
- [🧭🪣 Elegí la unidad de trabajo por dónde vivía el DATO](elegi-la-unidad-de-trabajo-por-donde-vivia-el-dato.md) — la restricción de ACCESO eligió la arquitectura, y era MAYOR.
- [🧠 Trifecta cognitiva — SOTA con 2 lentes](trifecta-sota-lente-lateral-hack.md) — el 2º lente es el atajo que *colapsa* el problema.
- [♻️🙈 Idempotente ≠ CONVERGENTE](idempotente-no-es-convergente.md) — *¿si cambio el valor, cambia el recurso?* Separá lo que converge de lo que se respeta.
- [🔁 "Si ya existe, devolvelo" NO es idempotencia — es una ventana](idempotencia-con-un-if-tiene-ventana.md) — facturar 2× → 2 CAE. Medí el EFECTO.
- [⏱️🕳️ Un campo que cambia con el RELOJ dentro del hash anula el cache](una-columna-global-mutante-vuelve-inerte-al-cache.md) — 20 min/push. Invalidar de más no rompe: tarda.
- [🏗️ El provisionado "idempotente" NO reconstruye desde cero](provisionado-no-reconstruye-la-base-desde-cero.md) — **leer antes de levantar DR/staging**. Idempotente ≠ reproducible.
- [🎭 `IF NOT EXISTS` cubre MENOS de lo que promete](if-not-exists-cubre-menos-de-lo-que-promete.md) — habla del objeto, no de su tabla ni de los permisos. Preguntá al catálogo.
- [🧩 El fix YA existe en otro call-site — propagar, no diseñar](el-fix-ya-existe-en-otro-call-site.md) — grepeá el patrón del FIX, no del bug. Nada lo propaga solo.
- [🧬 El fix de RAZONAMIENTO no viaja con el código copiado](el-fix-de-razonamiento-no-viaja-con-el-codigo-copiado.md) — el matiz va en un COMENTARIO en el punto de decisión.
- [📝⚡ Anotar ADENTRO el efecto externo en el instante](anotar-adentro-el-efecto-externo-en-el-instante.md) — guardar "al final" borra la única prueba (CAE, certificado).
- [🔑🔄 Derivar la clave DENTRO de la activity](derivar-la-clave-dentro-de-la-activity-no-tocar-el-payload.md) — `activity_id`+`run_id`; el continue-as-new reinicia la numeración.
- [0️⃣ El cero que NO se puede afirmar](cero-que-no-se-puede-afirmar.md) — sin documento, `$0` dice "no compró" cuando es "no lo sé".
- [🚧 Verificar que el camino que recomendás EXISTE](verificar-que-el-camino-recomendado-existe.md) — cada lado verificó su mitad y la junta no era de nadie.
- [🖋️ El contrato afirma el mecanismo que NO opero](el-contrato-afirma-el-mecanismo-que-no-opero.md) — **MACRO.** Setup de una persona: preguntar. Mecanismo de un sistema: leer su código.
- [🎨 Gate visual multi-tema + tokens](gate-visual-multi-tema-tokens.md) — gate en AMBOS temas; colores = tokens theme-aware.
- [✏️ Definición delgada de UX = decisión abierta](definicion-delgada-de-ux-se-llena-con-el-port-del-canonico.md) — "portar del canónico" importa en silencio la respuesta de ESA app.

### Delegación, contexto y herramientas

- [🔒⚡ 3 gates que FRENAN — script-first · headless · modelo-por-tarea](gates-mecanicos-de-eficiencia-script-first-y-modelo-por-tarea.md) — nivel 1, global. `ask` + fail-open.
- [🖥️➡️📡 Sub-agentes van HEADLESS, no inline](subagentes-van-headless-no-inline-en-la-terminal.md) — `claude -p`, misma auth Max (NO tarifa API).
- [🕸️🔍 GRAFO primero, código después — para LOCALIZAR](grafo-primero-codigo-despues-para-localizar.md) — MCP `graphity-code`, `group_id=code-copiloto-emprendedor`. Ahorra greps.
- [🕰️🕸️ El grafo ingesta el DISCO, pero fecha con `HEAD`](el-grafo-ingesta-el-disco-pero-fecha-con-head.md) — frescura = hora del último SYNC, no `valid_at`.
- [Localización estructurada en feedback a agentes](localizacion-estructurada-feedback-agentes.md) — feedback localizado baja regresiones -70% (TDAD).
- [Orquestación de waves — parent valida + commitea](orquestacion-waves-parent-valida.md) — ownership exclusiva; verificar estado real, no el reporte bg.
- [🔬 Loop auditoría Fable → análisis Opus → contratos → E2E](loop-auditoria-fable-analisis-opus-contratos-e2e.md) — loop reutilizable pedido por el operador.
- [📚 El índice truncado FABRICA duplicados](el-indice-truncado-fabrica-duplicados.md) — 48% del índice no se cargaba ⇒ 3 archivos para el mismo hecho. Presupuesto + control.
- [🧠💣 Memoria repo vs slug divergen — `seed-memory.sh` BORRA](memoria-repo-vs-slug-drift.md) — **leer antes de correrlo**. Escribí en `memoria/` del repo.
- [Anti-adulación NO es aguafiestas](anti-adulacion-no-es-aguafiestas.md) — failure mode espejo: pesimismo performativo. Afinar, no rebajar.

### Coordinación entre sesiones

- [🔀 Tres sesiones paralelas — el buzón, y la junta con dueña](coordinacion-tres-sesiones-buzon.md) — **leer al arrancar**. Estado = ubicación del archivo.
- [🛸 Canal Antigravity — auxiliar, bajo demanda](canal-antigravity-bajo-demanda.md) — NO es cuarta sesión. Reglas: COORDINACION.md §7.
- [📬 Un mensaje entregado DONDE NADIE MIRA no fue entregado](mensaje-entregado-donde-nadie-mira.md) — el `avance_` nacía en `cerrado/`. Probá el cable.
- [🧹🤖 El buzón se ordena por JANITOR, no por disciplina](buzon-se-ordena-por-janitor-no-por-disciplina.md) — `abierto/` 32→136 con regla manual.
- [⏱️🌀 El cron dispara MÁS cuanto MENOS trabaja la sesión](el-cron-dispara-mas-cuanto-menos-trabaja-la-sesion.md) — un turno por cron mide OCIO. Revisar en cada frontera de trabajo.
- [🔇 El silencio del buzón NO prueba REPL muerta](silencio-del-buzon-no-prueba-repl-muerta.md) — la sesión viva ACTÚA (git log/PR) aunque no autoree.
- [📱🛑 El TELÉFONO exige dueño único — y ESCRIBE en la base](device-fisico-exige-dueno-unico.md) — dos ADB fabrican evidencia falsa; un dictado creó un gasto real.
- [📱🍳 Un gate de device se corre con RECETA async](gate-de-device-se-corre-con-receta-no-con-ventana-viva.md) — gestos exactos escritos, no ventana viva.

### Git, deploy y checkout compartido

- [🩹 `--amend`/rebase/reset en checkout compartido pisa el commit de otro](amend-en-checkout-compartido-pisa-el-commit-de-otro.md) — mensaje feo → commit `docs:` nuevo.
- [💥 `git checkout <ref> -- .` PISA lo que sólo vive en el working tree](checkout-ref-doble-guion-punto-pisa-cambios-solo-en-working-tree.md) — irrecuperable. Usá `merge-base --is-ancestor`.
- [🕰️ El checkout compartido sirve COMANDOS VIEJOS](el-checkout-compartido-sirve-comandos-viejos.md) — rama vieja = hooks y scripts viejos, sin aviso.
- [🚨 Sincronizar al VPS desde el worktree equivocado tumba el servicio](sincronizar-al-vps-desde-el-worktree-equivocado.md) — pisa en silencio. Chequeo `grep -c`.
- [🚢 `deploy.sh` NO valida que el checkout esté al día con main](deploy-sh-no-valida-checkout-al-dia-con-main.md) — sube el disco tal cual: regresiona en silencio.
- [🌿 Rama nueva ≠ "el grafo no sabe nada"](rama-nueva-no-significa-que-el-grafo-no-sepa-nada.md) — base correcta: `merge-base origin/main`.
- [🔀 El orden de merge se elige por el estado INTERMEDIO de main](orden-de-merge-por-el-estado-intermedio.md) — primero la rama que corre en prod.
- [🪟💥 Git Bash mangla paths con punto](git-bash-mangla-paths-con-punto-y-fabrica-handoffs-falsos.md) — `MSYS_NO_PATHCONV=1`. Fabricó un handoff externo falso.
- [Preferir gh CLI, no el MCP de github](preferir-gh-cli-no-mcp-github.md) — `gh`; MCP sólo si no está.

## 🏭 El producto — LEER antes de tocar

- [🟢 Copiloto DESPLEGADO VIVO + multitenant real](copiloto-deploy-multitenant-vivo.md) — **leer primero al retomar.** systemd web+worker, JWT, cross-tenant [VERIFIED].
- [🔱 Motor en FORK DURO + fix del buffer de corto plazo](motor-fork-duro-fix-buffer-corto.md) — **antes de tocar `motor/`.** `sync-motor.sh` retirado; el fix se hace ACÁ.
- [🔗 Motor ReAct tareas concatenadas — VIVO y CERRADO](copiloto-motor-react-concatenadas.md) — **NO re-abrir.** Flag `COPILOTO_ENGINE_MODE`.
- [🔐 Auth = GoTrue DEDICADA (cutover vivo)](copiloto-gotrue-dedicada-cutover.md) — **al tocar auth/OAuth.** Google OAuth LIVE. Deuda: passwords temporales.
- [🌐 Dominio duckdns + Google OAuth](copiloto-dominio-duckdns.md) — `copilotoemprendedor.duckdns.org` → VPS.
- [🧠🧱 MemoryProvider — memoria conversacional CABLEADA](copiloto-memoria-provider-ladrillo.md) — **al tocar la memoria.** warm+recall+remember, gate `config['memory']`.
- [🕰️ Recall temporal — "qué hice ayer"](copiloto-recall-temporal.md) — `consultar_actividad`; `valid_at` naive→UTC; anti-injection.
- [🧾 Facturación AFIP — backend y frontend TERMINADOS](copiloto-facturacion-afip.md) — **primero al retomar facturación.** Determinista; la clave fiscal no se almacena.
- [💰 Presupuestos + perfil del negocio](copiloto-presupuestos-y-perfil-negocio.md) — el perfil se lee por turno, ANTES de la memoria.
- [🎙️🃏 Mecanismo canónico de las cards por voz](mecanismo-canonico-de-las-cards-por-voz.md) — nunca se pregunta 2 veces; a la 2ª manda la card.
- [🔑 OAuth de Google: hoy es el de COMPOSIO](copiloto-oauth-google-propio.md) — bloquea Apps. Los scopes por defecto son los CAROS.
- [🔌 Composio — ladrillo + runbook](composio-gateway-ladrillo.md) — boundary fail-closed; `validate_toolkit.py` ANTES de la policy.
- [🔌 7 servicios Composio plug-in](copiloto-servicios-composio-plugin.md) — módulo-plug-in + confirm-gate HITL.
- [⚠️ El MCP de Composio da acceso TOTAL al Gmail del operador](composio-mcp-gmail-acceso-completo.md) — incluye borrado permanente. No heredarlo a agentes autónomos.
- [💳 MercadoPago — integración directa multi-tenant](mercadopago-integracion-research.md) — OAuth Auth-Code (180 d), webhook HMAC. ✅ spike E2E.
- [🕸️ Grafo: tenant dedicado + structured 0-LLM + ontología scoped](graphity-tenant-dedicado-y-ontologia-scoped.md) — instancia COMPARTIDA → ontología con `graph_ids` o fuga.
- [📡 Ingesta real al grafo por tenant — FRENTE ABIERTO (MAYOR)](copiloto-ingesta-grafo-por-tenant-real-frente-abierto.md) — sólo existe la demo sintética del hito 5.
- [🛡️ Agente conversacional — hardening 3 lentes + 6 defensas](agente-conversacional-hardening-3-lentes.md) — barrido adversarial → batch por tests.
- [🔓 RLS activado en 77 tablas y filtrando en NINGUNA](rls-activado-que-no-filtraba-el-dueno-esta-exento.md) — el **dueño está exento** sin `FORCE`. Control: conectarse sin tenant y contar.
- [🔑🚪 La tabla que RESUELVE el control no puede estar sujeta al control](la-tabla-que-resuelve-el-control-no-puede-estar-sujeta-al-control.md) — `tenants` con `FORCE` daría 403 a todos.
- [🧪 DESPLEGADO ≠ con clientes — los datos se fabrican](desplegado-no-significa-con-clientes.md) — cero usuarios; "prod-beta" desvía a migraciones defensivas.
- [🧭 IDENTIDAD = automatización/agentes durables, NO frontend-pesado](factory-identidad-automatizacion-ia.md) — moat = orquestación DURABLE.
- [🔐 Deuda de secretos a rotar (pre-prod)](deuda-secretos-rotar.md) — keys que pasaron por chat. grep-first + restart al rotar.

### Frontend móvil

- [📱 Estado del frontend móvil — chrome auto-hide y sus regresiones](copiloto-frontend-movil-ux-estado.md) — **al retomar cualquier arreglo del móvil.**
- [🧊 App "bloqueada" al volver de una función → glass APILADO](glass-apilado-empujar-una-vez.md) — doble toque apila 2 `transparentModal`; lock por FOCO.
- [🧭 Un `*.test.tsx` en `app/` tumba la app](test-en-carpeta-app-es-una-ruta.md) — expo-router lo carga como RUTA. Guard: `appSoloRutas.test.ts`.
- [⌨️ El teclado tapa los campos del glass Y mata el scroll](teclado-tapa-campos-cascara-glass.md) — `KeyboardAvoidingView padding` + revelar el campo enfocado.
- [🇦🇷 La coma decimal del teclado argentino](la-coma-decimal-del-teclado-argentino.md) — `Decimal("15000,50")` → 400. Normalizar, nunca `Number()`.
- [🪟 Metro en Windows no sigue links de `node_modules` en worktrees](metro-en-windows-no-sigue-links-de-node-modules-en-worktrees.md) — 404 al bundlear; `tsc`/`jest` sí los siguen.
- [✈️ Receta avión + reverse + Connect para el dev-launcher](receta-avion-reverse-connect-destraba-dev-launcher.md) — sin deep-link ni rebuild.

## 📚 Referencia

- [Tests se corren en el VPS, no en la PC](tests-se-corren-en-vps.md) — worker venv `/opt/uc-worker-venv`; MCP `.venv` separado.

## 🗄️ Historia

→ [HISTORIA.md](HISTORIA.md) — hitos cerrados y entradas bajadas del índice. **NO se carga; buscable.**
