# Memoria — Copiloto del Emprendedor

> **Una línea = un gancho, no un resumen** (≤160 chars): el detalle vive en el topic file.
> **Techo duro: 24.000 caracteres** (el que aplica el gate; el texto decía 25.000) — lo que pase de ahí se trunca y no existe para la sesión
> ([[el-indice-truncado-fabrica-duplicados]]). Al llegar al techo no se comprime más: se baja a
> [HISTORIA.md](HISTORIA.md) (no se carga; buscable). Control: `scripts/medir-indice-memoria.py`.

## 🚦 Estado vivo

**"¿en qué estábamos?"** → [`HANDOFF.md`](../HANDOFF.md) · detalle → `CLAUDE.md §4-5` · frentes → `coordinacion/PLAN.md`.

- **🌐 EL REPO ES PÚBLICO** (2026-08-06). Un `.env` commiteado es público al instante; historia auditada: 0 secretos. `CLAUDE.md` §cabecera.
- **🟢 BETA, M-WEB y CONSOLA cerrados** (faltan las invitaciones del operador). **🔥 Ahora: soporte técnico** — estado real en `coordinacion/PLAN.md`. [[copiloto-beta-sprint-cerrado]]
- **⚙️ CI PROPIO (ADR-001)** — la suite no se define en GitHub: `scripts/ci/*.sh` + `gate.sh` (recibo por SHA) + `no-drift.sh`. Antes de mergear: `ci-verde.sh <PR>`.
- **🌳 Checkout compartido: 237 commits atrás** — lo escrito ahí no llega a `main` ni al grafo. Worktree desde `origin/main`.
- **Prod-beta multitenant vivo**, smoke 10/10, RLS `FORCE` aplicando. [[copiloto-deploy-multitenant-vivo]] · [[rls-activado-que-no-filtraba-el-dueno-esta-exento]]
- **🛡️ Manejo de errores — COMPLETO en prod** (#151→#185) + autohealing que abre PRs solo, con gate que distingue *arregla* de *no rompe*. [[no-romper-no-es-arreglar]]
- **⚠️ Ese frente lo destaparon INSTRUMENTOS QUE MENTÍAN, no features** (5 de 35 PRs). [[instrumentos-que-confirman-en-vez-de-verificar]]
- **✅ Cerrados:** AFIP E2E en device · presupuestos + perfil · clientes (falta voz) · mobile-first. [[copiloto-facturacion-afip]] · [[copiloto-mobile-first-cascara-glass]]
- **🚧 Abiertos:** OAuth Google (es de Composio) · ingesta real al grafo (MAYOR). [[copiloto-oauth-google-propio]] · [[copiloto-ingesta-grafo-por-tenant-real-frente-abierto]]
- **🔀 Tres sesiones** por buzón · **identidad:** agentes durables (moat = Temporal). [[coordinacion-tres-sesiones-buzon]] · [[copiloto-emprendedor-roadmap]]

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

- [🔁 EL BUCLE CANÓNICO — dos auditorías y el enganche](bucle-canonico-dos-auditorias-y-el-enganche.md) — marco de todo sprint.
- [🚫📋 NUNCA cierres el turno con un REPORTE](nunca-cerrar-el-turno-con-un-reporte.md) — si el operador puede preguntar "¿cómo seguimos?", fallaste.
- [🤞🚫 PROMETER no es ejecutar — y el gate medía la PALABRA](prometer-no-es-ejecutar-el-gate-media-la-palabra.md) — hacela antes de escribirla.
- [⏳💥 ESCASEZ = ejecutar, NO preguntar](escasez-de-recurso-dispara-ejecucion-no-consulta.md) — reordená por impacto÷costo, despachá YA.
- [🚫💤 CERO ocio — tres estados, uno prohibido](cero-tiempo-ocioso-tres-estados.md) — único válido: terminó todo y reportó.
- [🛑💤 Detectar la parálisis y sólo reportarla es ocio PASIVO](deteccion-de-paralisis-sin-resolucion-es-ocio-pasivo.md) — el blocker es tuyo.
- [🚦 Ejecutar la COLA acordada no es decisión de scope](ejecutar-la-cola-acordada-no-es-una-decision-de-scope.md) — contratado = ejecución.
- [⏳🚧 Una espera sin disparador NOMBRABLE es parálisis](una-espera-sin-disparador-nombrable-es-paralisis.md) — el estado falso da quietud, no bug.
- [🚧🔀 Un frente PARCIALMENTE bloqueado no es bloqueado](frente-parcialmente-bloqueado-no-es-bloqueado.md) — descomponé por disparador real.
- [🔧🤐 El workaround de RUTINA deja de parecer información](el-workaround-que-usas-de-rutina-deja-de-parecerte-informacion.md) — 3ª vez, escribilo.
- [🕵️ Una sesión parada puede tener la respuesta ENTERRADA](sesion-parada-la-respuesta-existe-pero-enterrada.md) — buscá antes de reabrir.
- [⏱️➡️ Atar la acción a un MOMENTO, no a un estado](atar-la-accion-a-un-momento-no-a-un-estado.md) — "cuando esté listo" no llega.
- [Trabajo oportunista en esperas asíncronas](trabajo-oportunista-esperas.md) — adelantá lo independiente, no una fase futura.
- [Trabajo por fases — no anticipar](trabajo-por-fases-no-anticipar.md) — "luz verde" ≠ "fase validada".
- [🚀📱 Entrega progresiva por hito + E2E en device](entrega-progresiva-y-e2e-en-device.md) — no cierra hasta desplegado y probado.
- [🎓 Cierre del aprendizaje no es opcional](cierre-del-aprendizaje-no-opcional.md) — test *¿puede volver?* Si no, no terminó.
- [♻️ Cero deuda de MEJORA — implementar TODAS al cerrar](cero-deuda-de-mejora.md) — sólo se difiere no-código + MAYOR.
- [Cero deuda NO-GESTIONADA](cero-deuda-no-gestionada.md) — deliberada + visible OK; impaga o invisible, prohibida.
- [📄 El parte del proveedor EXISTE y no lo leí](el-parte-del-proveedor-existe-y-no-lo-lei.md) — leé el cuerpo, no el semáforo.
- [⏰ Una orden con vencimiento vence en el RELOJ, no en el buzón](orden-con-vencimiento-no-se-retira-sola.md) — default: sigue vigente.
- [📦⏪ Un rebuild desde OTRA base revierte un fix cerrado](un-rebuild-desde-otra-base-revierte-un-fix-ya-cerrado.md) — ejercitá la función, no el log.
- [🔌🎭 El puerto que contesta puede ser de OTRA sesión](el-puerto-que-contesta-puede-ser-de-otra-sesion.md) — cruzá el PID contra tu proceso.
- [📋 Lo que NO está en la TABLA DE HITOS no existe](lo-que-no-esta-en-la-tabla-de-hitos-no-existe.md) — cada dueño necesita su renglón.
- [🗂️ Índice de frentes abiertos → UN tablero](frentes-abiertos-tablero.md) — acá es `coordinacion/PLAN.md`.
- [Propagar el cierre a TODOS los docs maestros](propagar-cierre-a-docs-maestros.md) — al doc-de-registro único.

### Evidencia: el instrumento antes que el resultado
- [🔌🕳️ La costura leía un campo que NADIE escribe](la-costura-leia-un-campo-que-nadie-escribe.md) — grepeá quién ESCRIBE, no quién lee.
- [🐤 El canario: control positivo de lo que falla CALLADO](el-canario-el-control-positivo-de-lo-que-falla-callado.md) — inyectá el caso a propósito.

- [No codificar la esperanza — el TRONCO](no-codificar-la-esperanza-principio-raiz.md) — la prueba vale, la aserción no.
- [Spike-first es central](spike-first-central-proyecto.md) — un cimiento no verificado se amplifica
- [⚖️🔴 El instrumento también CONDENA, no sólo absuelve](el-instrumento-tambien-CONDENA-no-solo-absuelve.md) — el falso rojo parece prudencia.
- [🫥 Un instrumento que NO MIRA nunca falla](instrumento-que-no-mira-nunca-falla.md) — preguntá cuántos elementos miró.
- [🪞 El guard se satisface con su PROPIO comentario](el-guard-se-satisface-con-su-propio-comentario.md) — descartá comentarios al buscar.
- [🔢🎭 Contar un símbolo no dice en qué ROL aparece](contar-un-simbolo-no-dice-en-que-rol-aparece.md) — contá la FORMA, no el conteo.
- [🔇🔨 Mudo ≠ parado — el silencio mide REPORTE, no TRABAJO](mudo-no-es-parado-el-silencio-mide-reporte-no-trabajo.md) — mirá toda la corrida.
- [🗂️🕳️ Una sesión en WORKTREE es invisible al monitor](una-sesion-en-worktree-es-invisible-para-el-monitor-el-slug-sale-del-cwd.md) — el buzón manda.
- [🔕⬆️ Trabajar en un pedido lo SILENCIA](trabajar-en-un-pedido-lo-silencia.md) — preguntá qué evento reinicia el contador.
- [🔬🙈 Probar que miente NO exime de leer lo que señala](probar-que-el-instrumento-miente-no-te-exime-de-leer-lo-que-senala.md) — refutar causa no refuta hecho.
- [🕶️ Un instrumento CIEGO por RLS dice "no hay"](un-instrumento-ciego-por-rls-dice-no-hay-en-vez-de-no-veo.md) — control de ceguera antes.
- [🔇🚫 Un mecanismo roto hacia el "NO" no da síntoma](un-mecanismo-roto-hacia-el-no-no-da-sintoma.md) — todo gate necesita control POSITIVO.
- [📄🕳️ Un control ARCHIVO no ve la divergencia ADENTRO](un-control-a-nivel-archivo-no-ve-la-divergencia-adentro.md) — `feedback`. Cero ≠ luz verde.
- [🕳️ Un vacío del PROPIO instrumento no es hallazgo](vacio-no-es-hallazgo-correr-el-control.md) — horneá el control en el script.
- [🔌🙈 El test que no usa el camino de prod no lo ve fallar](el-test-que-no-usa-el-camino-de-produccion-no-puede-verlo-fallar.md) — composition root.
- [🔀🧬 Dos clientes gemelos: el fix llega a UNO](dos-implementaciones-del-mismo-cliente-el-fix-llega-a-una.md) — contá definiciones, no usos.
- [📱 El gate jsdom NO ve gestos táctiles](gate-jsdom-no-ve-gestos-tactiles.md) — verde en vitest ≠ verificado.
- [🎯📏 La regla que manda a mirar el instrumento EQUIVOCADO](la-regla-que-te-obliga-a-mirar-el-instrumento-equivocado.md) — qué regla te desvía.
- [📋❌ El DoD mal escrito, corregido por la evidencia](el-dod-que-escribi-estaba-mal-y-la-evidencia-lo-corrigio.md) — el cierre envejece en silencio.
- [🎯 Un supuesto cuya falla parece LEGÍTIMA es pregunta](supuesto-cuya-falla-parece-un-estado-legitimo.md) — *¿cómo se vería si fuera falso?*
- [🧹 Barrer llamadores incluye los INSTRUMENTOS](barrer-llamadores-incluye-los-instrumentos-de-verificacion.md) — C4.1 iba a tumbar el smoke que era su propio control positivo. Mismo PR.
- [🎲 Un instrumento compartido INTERMITENTE fabrica una excusa lista](un-instrumento-compartido-intermitente-fabrica-una-excusa-lista.md) — "es el flake conocido" lava la próxima regresión real. Discriminá antes de atribuir.
- [🐕‍🦺 El watchdog sólo ve al que LLEGA TARDE, nunca al que NO VINO](el-watchdog-que-solo-ve-al-que-llega-tarde-nunca-al-que-no-vino.md) — señal cero se cuela por el `continue`. Medir contra la expectativa, no contra el reloj. Costó ~100 min de P0 sin dueño.
- [💀 El vigilante MUERE con la sesión y nadie lo vigila a él](el-vigilante-muere-con-la-sesion-y-nadie-lo-vigila-a-el.md) — crones session-only: un corte de créditos apagó los 3 sin que sonara nada. `CronList` al reanudar, antes de retomar.
- [✂️ Pipear un proceso largo por `tail` BORRA la evidencia del fallo](pipear-un-proceso-largo-por-tail-borra-la-evidencia-del-fallo.md) — la corrida verde borra a la roja. Gate/deploy en background van a archivo COMPLETO.

### Guards, gates y jueces

- [🛡️💥 Un guard que grita en el caso NORMAL se desarma](el-guard-que-grita-en-el-caso-normal-se-desarma-solo.md) — el falso positivo enseña a saltear.
- [🚦💥 El guard da LUZ VERDE justo en su caso de activación](el-guard-falla-abierto-en-su-caso-de-activacion.md) — leé la rama de ERROR.
- [🪤 El guard que caza a su propio AUTOR](el-guard-que-caza-a-su-propio-autor.md) — si nunca te frenó, no sabés si funciona.
- [⚖️🗺️ Al JUEZ también hay que darle el plano](al-juez-tambien-hay-que-darle-el-plano.md) — sin contexto rechaza, y parece prudencia.
- [🔨🎯 El forjador NO acierta siempre](el-forjador-no-acierta-siempre-el-gate-de-tests-no-es-opcional.md) — formato válido ≠ contenido correcto.
- [🚧🔁 El guard se vuelve el CUELLO DE BOTELLA](el-guard-se-vuelve-el-cuello-de-botella-de-lo-que-protege.md) — declará si el rechazo es permanente.
- [🔀🕳️ Dos decisiones correctas que se cruzan en un AGUJERO](dos-decisiones-correctas-que-se-cruzan-en-un-agujero.md) — el hueco vive en el par.

### Diagnóstico: leer el contrato antes de explicar

- [Raíz, no parche](raiz-no-parche.md) — hook `root_cause_suggester`
- [🎯🕳️ Diseñar contra el riesgo TEMIDO ciega al caso NORMAL](disenar-contra-el-riesgo-temido-ciega-al-caso-normal.md) — corré el caso vacío primero.
- [🏷️ El NOMBRE es una hipótesis sobre el contenido](el-nombre-es-una-hipotesis-sobre-el-contenido.md) — leé el `WHERE`, no el nombre.
- [🎛️ Verificar la COMPOSICIÓN ROOT, no el default](verificar-la-composicion-root-no-el-default.md) — otra capa puede sobreescribirla.
- [🏭 No pelear con un generador flaky — hand-fix + E2E primero](no-pelear-con-la-fabrica-hand-fix-primero.md) — snapshot, no stream.
- [🪠 El pipe se come el exit code](el-pipe-se-come-el-exit-code.md) — el veredicto es la SALIDA.
- [🚀🎭 `git push` sale exit 0 SIN haber pusheado](git-push-puede-salir-exit-0-sin-haber-pusheado.md) — el control es `ls-remote`, no el exit.
- [🏷️ Clasificar un hallazgo por su ETIQUETA, no por su código](clasificar-un-hallazgo-por-su-etiqueta-y-no-por-su-codigo.md) — "firma" me hizo inventar una vuln cripto; llegó mergeada a `main`.

### Diseño y arquitectura

- [♻️🔒 Reutilizar es REGLA — inventario ANTES del diseño](reutilizacion-es-regla-el-inventario-va-antes-del-diseno.md) — todo `contrato_` abre con §0.
- [🧭🪣 Elegí la unidad de trabajo por dónde vivía el DATO](elegi-la-unidad-de-trabajo-por-donde-vivia-el-dato.md) — el ACCESO elige la arquitectura.
- [🧠 Trifecta cognitiva — SOTA con 2 lentes](trifecta-sota-lente-lateral-hack.md) — el 2º lente colapsa el problema.
- [♻️🙈 Idempotente ≠ CONVERGENTE](idempotente-no-es-convergente.md) — *¿si cambio el valor, cambia el recurso?*
- [🔁 "Si ya existe, devolvelo" NO es idempotencia — es una ventana](idempotencia-con-un-if-tiene-ventana.md) — medí el EFECTO.
- [🧩 El fix YA existe en otro call-site — propagar, no diseñar](el-fix-ya-existe-en-otro-call-site.md) — grepeá el patrón del FIX.
- [🧬🔁 El MISMO defecto vivía DOS veces](el-mismo-defecto-vivia-dos-veces-el-fix-en-la-capa-compartida-no-alcanzo.md) — ¿qué capa usa la UI: el core o su copia?
- [🎭 DOS causas suficientes = el test no ATRIBUYE](dos-causas-suficientes-el-test-no-atribuye.md) — el diferencial sale VERDE.
- [🧬 El fix de RAZONAMIENTO no viaja con el código copiado](el-fix-de-razonamiento-no-viaja-con-el-codigo-copiado.md) — el matiz va en comentario.
- [0️⃣ El cero que NO se puede afirmar](cero-que-no-se-puede-afirmar.md) — `$0` puede ser "no lo sé", no "no compró".
- [🚧 Verificar que el camino que recomendás EXISTE](verificar-que-el-camino-recomendado-existe.md) — la junta no es de nadie.
- [🖋️ El contrato afirma el mecanismo que NO opero](el-contrato-afirma-el-mecanismo-que-no-opero.md) — de un sistema: leé su código.
- [🎨 Gate visual multi-tema + tokens](gate-visual-multi-tema-tokens.md) — gate en AMBOS temas, tokens theme-aware
- [✏️ Definición delgada de UX = decisión abierta](definicion-delgada-de-ux-se-llena-con-el-port-del-canonico.md) — "portar" importa la ajena.

### Delegación, contexto y herramientas

- [🔒⚡ 3 gates que FRENAN — script-first · headless · modelo-por-tarea](gates-mecanicos-de-eficiencia-script-first-y-modelo-por-tarea.md) — nivel 1.
- [🖥️➡️📡 Sub-agentes van HEADLESS, no inline](subagentes-van-headless-no-inline-en-la-terminal.md) — `claude -p`, misma auth.
- [🕸️🔍 GRAFO primero, código después — para LOCALIZAR](grafo-primero-codigo-despues-para-localizar.md) — MCP `graphity-code`.
- [Localización estructurada en feedback a agentes](localizacion-estructurada-feedback-agentes.md) — −70% regresiones.
- [Orquestación de waves — parent valida + commitea](orquestacion-waves-parent-valida.md) — verificá el estado, no el reporte.
- [🔬 Loop auditoría Fable → análisis Opus → contratos → E2E](loop-auditoria-fable-analisis-opus-contratos-e2e.md) — loop reutilizable.
- [📚 El índice truncado FABRICA duplicados](el-indice-truncado-fabrica-duplicados.md) — sin cargar completo ⇒ duplicados.
- [🧠💣 Memoria repo vs slug divergen — `seed-memory.sh` BORRA](memoria-repo-vs-slug-drift.md) — leer antes. Escribí en `memoria/` del repo.
- [Anti-adulación NO es aguafiestas](anti-adulacion-no-es-aguafiestas.md) — el espejo: pesimismo performativo.
- [💸 Sesión con modelo CARO → se le entrega el inventario hecho](sesion-con-modelo-caro-se-le-entrega-el-inventario-hecho.md) — planificar gasta tokens baratos primero; el contrato apunta a paths, no dice "explorá".

### Coordinación entre sesiones

- [📬 Un mensaje entregado DONDE NADIE MIRA no fue entregado](mensaje-entregado-donde-nadie-mira.md) — probá el cable.
- [📮🕳️ El TIPO de mensaje decide si lo PERSIGUEN](el-tipo-de-mensaje-decide-si-alguien-lo-persigue.md) — `dato_` NO escala; ¿querés reclamo? → `pedido_`.
- [🧹🤖 El buzón se ordena por JANITOR, no por disciplina](buzon-se-ordena-por-janitor-no-por-disciplina.md) — nunca a mano.
- [⏱️🌀 El cron dispara MÁS cuanto MENOS trabaja la sesión](el-cron-dispara-mas-cuanto-menos-trabaja-la-sesion.md) — un turno mide OCIO.
- [📱🛑 El TELÉFONO exige dueño único — y ESCRIBE en la base](device-fisico-exige-dueno-unico.md) — dos ADB fabrican evidencia falsa.
- [📱🍳 Un gate de device se corre con RECETA async](gate-de-device-se-corre-con-receta-no-con-ventana-viva.md) — gestos escritos, no ventana viva.

### Git, deploy y checkout compartido

- [🩹 `--amend`/rebase en checkout compartido pisa el commit de otro](amend-en-checkout-compartido-pisa-el-commit-de-otro.md) — commit `docs:` nuevo.
- [💥 `git checkout <ref> -- .` PISA lo del working tree](checkout-ref-doble-guion-punto-pisa-cambios-solo-en-working-tree.md) — usá `merge-base`.
- [🕰️ El checkout compartido sirve COMANDOS VIEJOS](el-checkout-compartido-sirve-comandos-viejos.md) — rama vieja, scripts viejos.
- [🚨 Sincronizar al VPS desde el worktree equivocado tumba el servicio](sincronizar-al-vps-desde-el-worktree-equivocado.md) — pisa mudo.
- [🚢 `deploy.sh` NO valida que el checkout esté al día con main](deploy-sh-no-valida-checkout-al-dia-con-main.md) — sube el disco tal cual.
- [🌿 Rama nueva ≠ "el grafo no sabe nada"](rama-nueva-no-significa-que-el-grafo-no-sepa-nada.md) — base: `merge-base origin/main`.
- [🔀 El orden de merge se elige por el estado INTERMEDIO de main](orden-de-merge-por-el-estado-intermedio.md) — primero la rama en prod.
- [🪟💥 Git Bash mangla paths con punto](git-bash-mangla-paths-con-punto-y-fabrica-handoffs-falsos.md) — `MSYS_NO_PATHCONV=1`
- [Preferir gh CLI, no el MCP de github](preferir-gh-cli-no-mcp-github.md) — MCP sólo si no está.

## 🏭 El producto — LEER antes de tocar

- [🔱 Motor en FORK DURO + fix del buffer de corto plazo](motor-fork-duro-fix-buffer-corto.md) — **antes de tocar `motor/`.** `sync-motor.sh` retirado; el fix se hace ACÁ.
- [🔐 Auth = GoTrue DEDICADA (cutover vivo)](copiloto-gotrue-dedicada-cutover.md) — **al tocar auth/OAuth.** Google OAuth LIVE. Deuda: passwords temporales.
- [🧠🧱 MemoryProvider — memoria conversacional CABLEADA](copiloto-memoria-provider-ladrillo.md) — **al tocar la memoria.** warm+recall+remember, gate `config['memory']`.
- [🕰️ Recall temporal — "qué hice ayer"](copiloto-recall-temporal.md) — `consultar_actividad`; `valid_at` naive→UTC; anti-injection.
- [🎙️🃏 Mecanismo canónico de las cards por voz](mecanismo-canonico-de-las-cards-por-voz.md) — nunca se pregunta 2 veces; a la 2ª manda la card.
- [⚠️ El MCP de Composio da acceso TOTAL al Gmail del operador](composio-mcp-gmail-acceso-completo.md) — incluye borrado permanente. No heredarlo a agentes autónomos.
- [🕸️ Grafo: tenant dedicado + structured 0-LLM + ontología scoped](graphity-tenant-dedicado-y-ontologia-scoped.md) — instancia COMPARTIDA ⇒ `graph_ids` o fuga.
- [🔑🚪 La tabla que RESUELVE el control no puede estar sujeta al control](la-tabla-que-resuelve-el-control-no-puede-estar-sujeta-al-control.md)
- [🧪 DESPLEGADO ≠ con clientes — los datos se fabrican](desplegado-no-significa-con-clientes.md) — cero usuarios; "prod-beta" desvía a migraciones defensivas.
- [🔐 Deuda de secretos a rotar (pre-prod)](deuda-secretos-rotar.md) — keys que pasaron por chat. grep-first + restart al rotar.

### Frontend móvil

- [✈️ Receta avión + reverse + Connect para el dev-launcher](receta-avion-reverse-connect-destraba-dev-launcher.md) — sin deep-link ni rebuild.
- [🌳🕳️ El working tree COMPARTIDO guarda trabajo fuera de toda rama](el-working-tree-compartido-guarda-trabajo-que-no-esta-en-ninguna-rama.md)
- [🔍 Auditorías van en `docs/copiloto-emprendedor/Auditorias/`](auditorias-van-en-carpeta-auditorias.md) — regla del operador. Nunca sueltas en `docs/`.
- [📱🔀 El dev-server sirve el CHECKOUT COMPARTIDO](metro-sirve-el-bundle-del-checkout-compartido-no-del-worktree.md) — Metro y vite. Pedile que se identifique.
- [🧩🔀 Resolver "tomando un lado" NUNCA converge](resolver-tomando-un-lado-nunca-converge.md) — `--ours`/`--theirs` descarta una mitad. Un grep por CADA mitad.
- [🕐💥 El backup de Graphity tumba su API 4×/día, 60-90 s](graphity-backup-cron-tumba-el-api-4x-dia-60-90s.md) — 03:30/09:30/15:30/21:30: el `pre-push` aborta con 503.

## 📚 Referencia

- [Tests se corren en el VPS, no en la PC](tests-se-corren-en-vps.md) — worker venv `/opt/uc-worker-venv`; MCP `.venv` separado.

## 🗄️ Historia

→ [HISTORIA.md](HISTORIA.md) — hitos cerrados y entradas bajadas del índice. **NO se carga; buscable.**
