# Memoria — Copiloto del Emprendedor

> **Una línea = un gancho, no un resumen** (≤160 chars): el detalle vive en el topic file.
> **Techo duro: 24.000 caracteres** (el que aplica el gate; el texto decía 25.000) — lo que pase de ahí se trunca y no existe para la sesión
> ([[el-indice-truncado-fabrica-duplicados]]). Al llegar al techo no se comprime más: se baja a
> [HISTORIA.md](HISTORIA.md) (no se carga; buscable). Control: `scripts/medir-indice-memoria.py`.

## 🚦 Estado vivo

**"¿en qué estábamos?"** → [`HANDOFF.md`](../HANDOFF.md) · detalle → `CLAUDE.md §4-5` · frentes → `coordinacion/PLAN.md`.

- **🌐 EL REPO ES PÚBLICO** desde 2026-08-06. Cambia el COSTO de un error, no la regla: un `.env` commiteado es público al instante. Historia auditada: 0 secretos. `CLAUDE.md` §cabecera.
- **🟢 BETA y M-WEB cerrados** (2026-08-05); falta que el operador mande las invitaciones. **🔥 En curso: CONSOLA DE OPERADOR** — estado real en `coordinacion/PLAN.md`. [[copiloto-beta-sprint-cerrado]]
- **⚙️ CI PROPIO (ADR-001)** — la suite no se define en GitHub: `scripts/ci/*.sh` + `gate.sh` (recibo por SHA) + `no-drift.sh`. Antes de mergear: `ci-verde.sh <PR>`.
- **🌳 Checkout compartido: 237 commits detrás de `main`** — lo escrito ahí no llega a `main` ni al grafo. Worktree desde `origin/main`. [[el-working-tree-compartido-guarda-trabajo-que-no-esta-en-ninguna-rama]]
- **Prod-beta multitenant vivo**, smoke 10/10, RLS `FORCE` aplicando. [[copiloto-deploy-multitenant-vivo]] · [[rls-activado-que-no-filtraba-el-dueno-esta-exento]]
- **🛡️ Manejo de errores — COMPLETO en prod** (#151→#185) + autohealing que abre PRs solo, con gate que distingue *arregla* de *no rompe*. [[no-romper-no-es-arreglar]]
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

- [🔁 EL BUCLE CANÓNICO — dos auditorías y el enganche](bucle-canonico-dos-auditorias-y-el-enganche.md) — marco de todo sprint.
- [🚫📋 NUNCA cierres el turno con un REPORTE](nunca-cerrar-el-turno-con-un-reporte.md) — si el operador puede preguntar "¿cómo seguimos?", fallaste.
- [⏳💥 ESCASEZ = ejecutar, NO preguntar](escasez-de-recurso-dispara-ejecucion-no-consulta.md) — reordená por impacto÷costo y despachá YA.
- [🚫💤 CERO ocio — tres estados, uno prohibido](cero-tiempo-ocioso-tres-estados.md) — único válido: terminó todo y reportó.
- [🛑💤 Detectar la parálisis y sólo reportarla es ocio PASIVO](deteccion-de-paralisis-sin-resolucion-es-ocio-pasivo.md) — el blocker suele ser tuyo.
- [🚦 Ejecutar la COLA acordada no es decisión de scope](ejecutar-la-cola-acordada-no-es-una-decision-de-scope.md) — hito contratado = ejecución.
- [⏳🚧 Una espera sin disparador NOMBRABLE es parálisis](una-espera-sin-disparador-nombrable-es-paralisis.md) — el estado falso da quietud, no bug.
- [🚧🔀 Un frente PARCIALMENTE bloqueado no es bloqueado](frente-parcialmente-bloqueado-no-es-bloqueado.md) — descomponé por disparador real.
- [🔧🤐 El workaround de RUTINA deja de parecer información](el-workaround-que-usas-de-rutina-deja-de-parecerte-informacion.md) — 3ª vez, escribilo.
- [🕵️ Una sesión parada puede tener la respuesta ENTERRADA](sesion-parada-la-respuesta-existe-pero-enterrada.md) — buscá antes de reabrir.
- [⏱️➡️ Atar la acción a un MOMENTO, no a un estado](atar-la-accion-a-un-momento-no-a-un-estado.md) — "cuando esté listo" no ocurre.
- [Trabajo oportunista en esperas asíncronas](trabajo-oportunista-esperas.md) — adelantá lo independiente; nunca una fase futura.
- [Trabajo por fases — no anticipar](trabajo-por-fases-no-anticipar.md) — "luz verde para construir" ≠ "fase validada".
- [🚀📱 Entrega progresiva por hito + E2E en device](entrega-progresiva-y-e2e-en-device.md) — no cierra hasta desplegado y probado.
- [🎓 Cierre del aprendizaje no es opcional](cierre-del-aprendizaje-no-opcional.md) — test *¿puede volver?*; si no, no terminó.
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
- [Spike-first es central](spike-first-central-proyecto.md) — un cimiento no verificado se amplifica.
- [🟢🔍 Un instrumento mal hecho no falla: CONFIRMA](instrumentos-que-confirman-en-vez-de-verificar.md) — *¿qué diría si estuviera roto?*
- [⚖️🔴 El instrumento también CONDENA, no sólo absuelve](el-instrumento-tambien-CONDENA-no-solo-absuelve.md) — el falso rojo parece prudencia.
- [🫥 Un instrumento que NO MIRA nunca falla](instrumento-que-no-mira-nunca-falla.md) — preguntá cuántos elementos miró.
- [🈳🟢 El chequeo de tipos compilaba el proyecto VACÍO](el-chequeo-de-tipos-que-compilaba-el-proyecto-vacio.md) — preguntá el DENOMINADOR.
- [📐🚫 Una tabla IGNORA el `max-width` de su celda](una-tabla-ignora-el-max-width-de-su-celda.md) — jsdom no hace layout
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
- [🩺🟢 "No rompió nada" NO es "arregló algo"](no-romper-no-es-arreglar.md) — un no-op puntúa mejor en un gate de no-regresión.
- [🔌🙈 El test que no usa el camino de prod no lo ve fallar](el-test-que-no-usa-el-camino-de-produccion-no-puede-verlo-fallar.md) — composition root.
- [🧪🔌 Tests que mockean serialización son CIEGOS al wire](tests-que-mockean-la-serializacion-son-ciegos-al-borde-del-wire.md) — `curl` lo caza rápido.
- [🧪⚡ La suite corre LOCAL contra Postgres efímero — 24 s](suite-local-en-vps-con-rol-no-superuser.md) — el CI es gate final, no consola.
- [📱 El gate jsdom NO ve gestos táctiles](gate-jsdom-no-ve-gestos-tactiles.md) — verde en vitest ≠ verificado.
- [🎯🕳️ El control corrido contra la BASE EQUIVOCADA](el-control-corrido-contra-la-base-equivocada.md) — nombrá la base antes de comparar.
- [🔢 El DEFAULT devuelve más de lo asumido](el-default-de-la-herramienta-devuelve-mas-de-lo-que-asumis.md) — confirmar no dispara control.
- [🎯📏 La regla que manda a mirar el instrumento EQUIVOCADO](la-regla-que-te-obliga-a-mirar-el-instrumento-equivocado.md) — qué regla te desvía.
- [📋❌ El DoD mal escrito, corregido por la evidencia](el-dod-que-escribi-estaba-mal-y-la-evidencia-lo-corrigio.md) — el cierre envejece en silencio.
- [🎯 Un supuesto cuya falla parece LEGÍTIMA es pregunta](supuesto-cuya-falla-parece-un-estado-legitimo.md) — *¿cómo se vería si fuera falso?*

### Guards, gates y jueces

- [🛡️💥 Un guard que grita en el caso NORMAL se desarma](el-guard-que-grita-en-el-caso-normal-se-desarma-solo.md) — el falso positivo enseña a saltear.
- [🚦💥 El guard da LUZ VERDE justo en su caso de activación](el-guard-falla-abierto-en-su-caso-de-activacion.md) — leé la rama de ERROR.
- [🪤 El guard que caza a su propio AUTOR](el-guard-que-caza-a-su-propio-autor.md) — si nunca te frenó, no sabés si funciona.
- [⚖️🗺️ Al JUEZ también hay que darle el plano](al-juez-tambien-hay-que-darle-el-plano.md) — sin contexto rechaza, y parece prudencia.
- [🔨🎯 El forjador NO acierta siempre](el-forjador-no-acierta-siempre-el-gate-de-tests-no-es-opcional.md) — formato válido ≠ contenido correcto.
- [🚧🔁 El guard se vuelve el CUELLO DE BOTELLA](el-guard-se-vuelve-el-cuello-de-botella-de-lo-que-protege.md) — declará si el rechazo es permanente.
- [🔀🕳️ Dos decisiones correctas que se cruzan en un AGUJERO](dos-decisiones-correctas-que-se-cruzan-en-un-agujero.md) — el hueco vive en el par.
- [🔌⏱️ Un kill switch por env var NO es inmediato bajo systemd](kill-switch-por-env-no-es-inmediato-bajo-systemd.md) — apagar = pausar el Schedule.

### Diagnóstico: leer el contrato antes de explicar

- [Raíz, no parche](raiz-no-parche.md) — hook `root_cause_suggester`.
- [🎯🕳️ Diseñar contra el riesgo TEMIDO ciega al caso NORMAL](disenar-contra-el-riesgo-temido-ciega-al-caso-normal.md) — corré el caso vacío primero.
- [🏷️ El NOMBRE es una hipótesis sobre el contenido](el-nombre-es-una-hipotesis-sobre-el-contenido.md) — leé el `WHERE`, no el nombre.
- [🎛️ Verificar la COMPOSICIÓN ROOT, no el default](verificar-la-composicion-root-no-el-default.md) — otra capa puede sobreescribirla.
- [🏭 No pelear con un generador flaky — hand-fix + E2E primero](no-pelear-con-la-fabrica-hand-fix-primero.md) — snapshot, no stream.
- [🪠 El pipe se come el exit code](el-pipe-se-come-el-exit-code.md) — el veredicto es la SALIDA.
- [🚀🎭 `git push` sale exit 0 SIN haber pusheado](git-push-puede-salir-exit-0-sin-haber-pusheado.md) — el control es `ls-remote`, no el exit.

### Diseño y arquitectura

- [♻️🔒 Reutilizar es REGLA — inventario ANTES del diseño](reutilizacion-es-regla-el-inventario-va-antes-del-diseno.md) — todo `contrato_` abre con §0.
- [🛠️🔁 La consola se construye con las piezas de la APP](la-consola-se-construye-con-las-piezas-de-la-app.md) — reusá; lo propio, en su módulo.
- [🧭🪣 Elegí la unidad de trabajo por dónde vivía el DATO](elegi-la-unidad-de-trabajo-por-donde-vivia-el-dato.md) — el ACCESO elige la arquitectura.
- [🧠 Trifecta cognitiva — SOTA con 2 lentes](trifecta-sota-lente-lateral-hack.md) — el 2º lente colapsa el problema.
- [♻️🙈 Idempotente ≠ CONVERGENTE](idempotente-no-es-convergente.md) — *¿si cambio el valor, cambia el recurso?*
- [🔁 "Si ya existe, devolvelo" NO es idempotencia — es una ventana](idempotencia-con-un-if-tiene-ventana.md) — medí el EFECTO.
- [⏱️🕳️ Un campo que cambia con el RELOJ anula el cache](una-columna-global-mutante-vuelve-inerte-al-cache.md) — invalidar de más no rompe.
- [🏗️ El provisionado "idempotente" NO reconstruye desde cero](provisionado-no-reconstruye-la-base-desde-cero.md) — leer antes de DR/staging.
- [🎭 `IF NOT EXISTS` cubre MENOS de lo que promete](if-not-exists-cubre-menos-de-lo-que-promete.md) — no cubre tabla ni permisos.
- [🧩 El fix YA existe en otro call-site — propagar, no diseñar](el-fix-ya-existe-en-otro-call-site.md) — grepeá el patrón del FIX.
- [🧬 El fix de RAZONAMIENTO no viaja con el código copiado](el-fix-de-razonamiento-no-viaja-con-el-codigo-copiado.md) — el matiz va en comentario.
- [📝⚡ Anotar ADENTRO el efecto externo en el instante](anotar-adentro-el-efecto-externo-en-el-instante.md) — "al final" borra la prueba.
- [🔑🔄 Derivar la clave DENTRO de la activity](derivar-la-clave-dentro-de-la-activity-no-tocar-el-payload.md) — continue-as-new reinicia números.
- [0️⃣ El cero que NO se puede afirmar](cero-que-no-se-puede-afirmar.md) — `$0` puede ser "no lo sé", no "no compró".
- [🚧 Verificar que el camino que recomendás EXISTE](verificar-que-el-camino-recomendado-existe.md) — la junta no es de nadie.
- [🖋️ El contrato afirma el mecanismo que NO opero](el-contrato-afirma-el-mecanismo-que-no-opero.md) — de un sistema: leé su código.
- [🎨 Gate visual multi-tema + tokens](gate-visual-multi-tema-tokens.md) — gate en AMBOS temas; tokens theme-aware.
- [✏️ Definición delgada de UX = decisión abierta](definicion-delgada-de-ux-se-llena-con-el-port-del-canonico.md) — "portar" importa la ajena.

### Delegación, contexto y herramientas

- [🔒⚡ 3 gates que FRENAN — script-first · headless · modelo-por-tarea](gates-mecanicos-de-eficiencia-script-first-y-modelo-por-tarea.md) — nivel 1.
- [🖥️➡️📡 Sub-agentes van HEADLESS, no inline](subagentes-van-headless-no-inline-en-la-terminal.md) — `claude -p`, misma auth.
- [🕸️🔍 GRAFO primero, código después — para LOCALIZAR](grafo-primero-codigo-despues-para-localizar.md) — MCP `graphity-code`.
- [🕰️🕸️ El grafo ingesta el DISCO, pero fecha con `HEAD`](el-grafo-ingesta-el-disco-pero-fecha-con-head.md) — frescura = hora del SYNC.
- [Localización estructurada en feedback a agentes](localizacion-estructurada-feedback-agentes.md) — baja regresiones ~70%.
- [Orquestación de waves — parent valida + commitea](orquestacion-waves-parent-valida.md) — verificar estado real, no el reporte.
- [🔬 Loop auditoría Fable → análisis Opus → contratos → E2E](loop-auditoria-fable-analisis-opus-contratos-e2e.md) — loop reutilizable.
- [📚 El índice truncado FABRICA duplicados](el-indice-truncado-fabrica-duplicados.md) — sin cargar completo ⇒ duplicados.
- [🧠💣 Memoria repo vs slug divergen — `seed-memory.sh` BORRA](memoria-repo-vs-slug-drift.md) — leer antes. Escribí en `memoria/` del repo.
- [Anti-adulación NO es aguafiestas](anti-adulacion-no-es-aguafiestas.md) — failure mode espejo: pesimismo performativo.

### Coordinación entre sesiones

- [🔀 Tres sesiones paralelas — el buzón, y la junta con dueña](coordinacion-tres-sesiones-buzon.md) — leer al arrancar.
- [🛸 Canal Antigravity — auxiliar, bajo demanda](canal-antigravity-bajo-demanda.md) — no es 4ª sesión.
- [📬 Un mensaje entregado DONDE NADIE MIRA no fue entregado](mensaje-entregado-donde-nadie-mira.md) — probá el cable.
- [📮🕳️ El TIPO de mensaje decide si alguien lo PERSIGUE](el-tipo-de-mensaje-decide-si-alguien-lo-persigue.md) — `dato_` NO escala. ¿Querés que se lo reclamen? → `pedido_`.
- [🧹🤖 El buzón se ordena por JANITOR, no por disciplina](buzon-se-ordena-por-janitor-no-por-disciplina.md) — nunca a mano.
- [⏱️🌀 El cron dispara MÁS cuanto MENOS trabaja la sesión](el-cron-dispara-mas-cuanto-menos-trabaja-la-sesion.md) — un turno mide OCIO.
- [🔇 El silencio del buzón NO prueba REPL muerta](silencio-del-buzon-no-prueba-repl-muerta.md) — la sesión viva ACTÚA sin autorear.
- [📱🛑 El TELÉFONO exige dueño único — y ESCRIBE en la base](device-fisico-exige-dueno-unico.md) — dos ADB fabrican evidencia falsa.
- [📱🍳 Un gate de device se corre con RECETA async](gate-de-device-se-corre-con-receta-no-con-ventana-viva.md) — gestos escritos, no ventana viva.

### Git, deploy y checkout compartido

- [🩹 `--amend`/rebase en checkout compartido pisa el commit de otro](amend-en-checkout-compartido-pisa-el-commit-de-otro.md) — commit `docs:` nuevo.
- [💥 `git checkout <ref> -- .` PISA lo del working tree](checkout-ref-doble-guion-punto-pisa-cambios-solo-en-working-tree.md) — usá `merge-base`.
- [🕰️ El checkout compartido sirve COMANDOS VIEJOS](el-checkout-compartido-sirve-comandos-viejos.md) — rama vieja = scripts viejos.
- [🚨 Sincronizar al VPS desde el worktree equivocado tumba el servicio](sincronizar-al-vps-desde-el-worktree-equivocado.md) — pisa en silencio.
- [🚢 `deploy.sh` NO valida que el checkout esté al día con main](deploy-sh-no-valida-checkout-al-dia-con-main.md) — sube el disco tal cual.
- [🌿 Rama nueva ≠ "el grafo no sabe nada"](rama-nueva-no-significa-que-el-grafo-no-sepa-nada.md) — base: `merge-base origin/main`.
- [🔀 El orden de merge se elige por el estado INTERMEDIO de main](orden-de-merge-por-el-estado-intermedio.md) — primero la rama en prod.
- [🪟💥 Git Bash mangla paths con punto](git-bash-mangla-paths-con-punto-y-fabrica-handoffs-falsos.md) — `MSYS_NO_PATHCONV=1`.
- [Preferir gh CLI, no el MCP de github](preferir-gh-cli-no-mcp-github.md) — `gh`; MCP sólo si no está.

## 🏭 El producto — LEER antes de tocar

- [🔱 Motor en FORK DURO + fix del buffer de corto plazo](motor-fork-duro-fix-buffer-corto.md) — **antes de tocar `motor/`.** `sync-motor.sh` retirado; el fix se hace ACÁ.
- [🔐 Auth = GoTrue DEDICADA (cutover vivo)](copiloto-gotrue-dedicada-cutover.md) — **al tocar auth/OAuth.** Google OAuth LIVE. Deuda: passwords temporales.
- [🧠🧱 MemoryProvider — memoria conversacional CABLEADA](copiloto-memoria-provider-ladrillo.md) — **al tocar la memoria.** warm+recall+remember, gate `config['memory']`.
- [🕰️ Recall temporal — "qué hice ayer"](copiloto-recall-temporal.md) — `consultar_actividad`; `valid_at` naive→UTC; anti-injection.
- [🎙️🃏 Mecanismo canónico de las cards por voz](mecanismo-canonico-de-las-cards-por-voz.md) — nunca se pregunta 2 veces; a la 2ª manda la card.
- [⚠️ El MCP de Composio da acceso TOTAL al Gmail del operador](composio-mcp-gmail-acceso-completo.md) — incluye borrado permanente. No heredarlo a agentes autónomos.
- [🕸️ Grafo: tenant dedicado + structured 0-LLM + ontología scoped](graphity-tenant-dedicado-y-ontologia-scoped.md) — instancia COMPARTIDA → ontología con `graph_ids` o fuga.
- [🔑🚪 La tabla que RESUELVE el control no puede estar sujeta al control](la-tabla-que-resuelve-el-control-no-puede-estar-sujeta-al-control.md) — `tenants` con `FORCE` = 403 a todos.
- [🧪 DESPLEGADO ≠ con clientes — los datos se fabrican](desplegado-no-significa-con-clientes.md) — cero usuarios; "prod-beta" desvía a migraciones defensivas.
- [🔐 Deuda de secretos a rotar (pre-prod)](deuda-secretos-rotar.md) — keys que pasaron por chat. grep-first + restart al rotar.

### Frontend móvil

- [📱 Estado del frontend móvil — chrome auto-hide y sus regresiones](copiloto-frontend-movil-ux-estado.md) — **al retomar cualquier arreglo del móvil.**
- [🧊 App "bloqueada" al volver de una función → glass APILADO](glass-apilado-empujar-una-vez.md) — doble toque apila 2 `transparentModal`; lock por FOCO.
- [🧭 Un `*.test.tsx` en `app/` tumba la app](test-en-carpeta-app-es-una-ruta.md) — expo-router lo carga como RUTA. Guard: `appSoloRutas.test.ts`.
- [⌨️ El teclado tapa los campos del glass Y mata el scroll](teclado-tapa-campos-cascara-glass.md) — `KeyboardAvoidingView padding` + revelar el campo enfocado.
- [🇦🇷 La coma decimal del teclado argentino](la-coma-decimal-del-teclado-argentino.md) — `Decimal("15000,50")` → 400. Normalizar, nunca `Number()`.
- [🪟 Metro en Windows no sigue links de `node_modules` en worktrees](metro-en-windows-no-sigue-links-de-node-modules-en-worktrees.md) — 404 al bundlear; `tsc`/`jest` sí los siguen.
- [✈️ Receta avión + reverse + Connect para el dev-launcher](receta-avion-reverse-connect-destraba-dev-launcher.md) — sin deep-link ni rebuild.
- [🌳🕳️ El working tree COMPARTIDO guarda trabajo que no está en ninguna rama](el-working-tree-compartido-guarda-trabajo-que-no-esta-en-ninguna-rama.md) — el control es el **blob**, no `git status`.
- [🔍 Auditorías van en `docs/copiloto-emprendedor/Auditorias/`](auditorias-van-en-carpeta-auditorias.md) — regla del operador. Nunca sueltas en `docs/`.
- [📱🔀 El dev-server sirve el CHECKOUT COMPARTIDO](metro-sirve-el-bundle-del-checkout-compartido-no-del-worktree.md) — Metro y vite. Pedile que se identifique.
- [🧩🔀 Resolver "tomando un lado" NUNCA converge](resolver-tomando-un-lado-nunca-converge.md) — `--ours`/`--theirs` descarta una mitad. Un grep por CADA mitad.
- [🎨🕳️ Un token con DOS definiciones — tocar la equivocada no da síntoma](un-token-con-dos-definiciones-y-la-equivocada-no-da-sintoma.md) — contá **definiciones**, no usos.
- [📱🤖 `adb` no ejercita el toque corto de un `Gesture.Pan()`](adb-no-puede-ejercitar-el-toque-corto-de-un-gesture-pan.md) — taps y drags de 600px sí; 0-2px nunca.
- [🕐💥 El backup de Graphity tumba su API 4×/día, 60-90 s](graphity-backup-cron-tumba-el-api-4x-dia-60-90s.md) — 03:30/09:30/15:30/21:30: el `pre-push` aborta con 503.
- [💾⏸️ Backups off-site de fusion y Temporal: APAGADOS por diseño](backups-fusion-y-temporal-apagados-por-diseno-deuda-diferida.md) — deuda diferida, no gap.
- [📧⏸️ SMTP y reset de password diferidos por el operador](smtp-email-transaccional-diferido-reset-password.md) — GoTrue `MAILER_AUTOCONFIRM=true`; slot para Gmail SMTP.

## 📚 Referencia

- [Tests se corren en el VPS, no en la PC](tests-se-corren-en-vps.md) — worker venv `/opt/uc-worker-venv`; MCP `.venv` separado.

## 🗄️ Historia

→ [HISTORIA.md](HISTORIA.md) — hitos cerrados y entradas bajadas del índice. **NO se carga; buscable.**
