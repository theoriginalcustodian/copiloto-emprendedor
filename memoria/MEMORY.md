# Memoria - Copiloto del Emprendedor
> **Una línea = un gancho, no un resumen** (≤160 chars): el detalle vive en el topic file.
> **DOS techos: 24.000 BYTES y 200 líneas.** No chars: los acentos y emoji pesan 2-4 bytes, y medirlo en chars absolvió un índice 1210 bytes truncado. Pasarse borra la cola ([[el-indice-truncado-fabrica-duplicados]]).
> Salida ÚNICA: bajar a [HISTORIA.md](HISTORIA.md) (no se carga; buscable) - fusionar NO ahorra chars. Control: `medir-indice-memoria.py`.

## 🚦 Estado vivo
**"¿en qué estábamos?"** → [`HANDOFF.md`](../HANDOFF.md) · detalle → `CLAUDE.md §4-5` · frentes → `coordinacion/PLAN.md`.

- **🌐 EL REPO ES PÚBLICO** (2026-08-06). Un `.env` commiteado es público al instante; historia auditada: 0 secretos. `CLAUDE.md` §cabecera.
- **✅ Criterio 3 web: 50 de 50 ALCANZABLES** (50/54 del padrón; los 4 de voz no tienen referencia de escritorio). `coordinacion/PLAN.md`.
- **⚙️ CI PROPIO (ADR-001)** - la suite no se define en GitHub: `scripts/ci/*.sh` + `gate.sh` (recibo por SHA) + `no-drift.sh`. Antes de mergear: `ci-verde.sh <PR>`.
- **🌳 Checkout compartido: MEZCLADO** - HEAD viejo, pero ~100 archivos editados a mano. Lo escrito ahí no llega a `main`. Diffeá el archivo, no cuentes commits.
- **Prod-beta multitenant vivo**, smoke **37/37 BETA-READY** (2026-09-23), RLS `FORCE`. [[copiloto-deploy-multitenant-vivo]] · [[rls-activado-que-no-filtraba-el-dueno-esta-exento]]
- **⚠️ El frente de MANEJO DE ERRORES lo destaparon INSTRUMENTOS QUE MENTÍAN, no features** (5 de 35 PRs). [[instrumentos-que-confirman-en-vez-de-verificar]]
- **🚧 Abiertos:** OAuth Google (es de Composio) · clientes por voz · ingesta real al grafo (MAYOR). [[copiloto-oauth-google-propio]] · [[copiloto-ingesta-grafo-por-tenant-real-frente-abierto]]
- **🔀 Tres sesiones** por buzón · **identidad:** agentes durables (moat = Temporal). [[coordinacion-tres-sesiones-buzon]] · [[copiloto-emprendedor-roadmap]]

## 🔑 Órdenes del operador (reglas duras - se cumplen, no se evalúan)
- [Móvil/device pasa al SPRINT SIGUIENTE; este cierra sin device](device-tests-al-final-telefono-limpio.md) - 22-09; BACKEND prepara el device; crones off.

- [Autorización PERMANENTE de merges/deploys - y de toda decisión TÁCTICA](autorizacion-permanente-merges-y-deploys.md) - no repreguntes; sólo escalá lo MAYOR.
- [Autónomo = ejecutar, no esperar un "dale"](ejecutar-autonomo-no-esperar-si-dale.md) - disparador cumplido ⇒ se ejecuta. Costó ~400 min de ocio.
- [Un solo usuario de prueba canónico, a fuego](usuario-de-prueba-canonico-uno-solo-a-fuego.md) - `e2e-device@copiloto.test`. Ningún agente elige otro.
- ["Terminado" exige evidencia de DEVICE](una-orden-cerrada-exige-evidencia-de-device.md) - implementado + desplegado + probado en device + `cierre_`.
- [Iterar en device NO compila nada](iterar-en-device-es-metro-local-con-dev-client-ya-instalado.md) - dev-client ya instalado + Metro local por USB.
- [Para gestos RNGH, `adb input motionevent` - nunca `input tap`](adb-no-puede-ejercitar-el-toque-corto-de-un-gesture-pan.md) - DOWN/MOVE/UP sí ejercita un Pan.
- [Aplicar `/ejecutar-con-eficiencia` siempre](aplicar-siempre-ejecutar-con-eficiencia.md) - proactiva y constante, no sólo si se invoca.
- [TODA la fábrica corre en el VPS, nunca en local](apps-deploys-siempre-vps.md) - la PC SOLO edita. Montar en local rechazado 2×.
- [documed-front es la app CANÓNICA de UI](consultar-documed-siempre-antes-de-implementar.md) - leerla ANTES de implementar. Portar adaptando, no copiar ciego.
- [No PR/commit/merge por cada cambio chico](batch-cambios-no-pr-por-tweak.md) - se juntan. Reincidí con 7 PRs en una sesión.
- [No insistir con rotar keys en dev](no-insistir-rotacion-keys-desarrollo.md) - diferido a prod; sólo no commitear ni pegar en chat.


## 🧭 Cómo trabajo
### Cadencia, cierre y ocio
- [🔁 EL BUCLE CANÓNICO - dos auditorías y el enganche](bucle-canonico-dos-auditorias-y-el-enganche.md) - marco de todo sprint.
- [🚫📋 NUNCA cierres el turno con un REPORTE](nunca-cerrar-el-turno-con-un-reporte.md) - si el operador puede preguntar "¿cómo seguimos?", fallaste.
- [🤞🚫 PROMETER no es ejecutar - y el gate medía la PALABRA](prometer-no-es-ejecutar-el-gate-media-la-palabra.md) - hacela antes de escribirla.
- [⏳💥 ESCASEZ = ejecutar, NO preguntar](escasez-de-recurso-dispara-ejecucion-no-consulta.md) - reordená por impacto÷costo, despachá YA.
- [🚫💤 CERO ocio - tres estados, uno prohibido](cero-tiempo-ocioso-tres-estados.md) - único válido: terminó todo y reportó.
- [🛑💤 Detectar la parálisis y sólo reportarla es ocio PASIVO](deteccion-de-paralisis-sin-resolucion-es-ocio-pasivo.md) - el blocker es tuyo.
- [🚦 Ejecutar la COLA acordada no es decisión de scope](ejecutar-la-cola-acordada-no-es-una-decision-de-scope.md) - contratado = ejecución.
- [⏳🚧 Una espera sin disparador NOMBRABLE es parálisis](una-espera-sin-disparador-nombrable-es-paralisis.md) - el estado falso da quietud, no bug.
- [🚧🔀 Un frente PARCIALMENTE bloqueado no es bloqueado](frente-parcialmente-bloqueado-no-es-bloqueado.md) - descomponé por disparador real.
- [🔧🤐 El workaround de RUTINA deja de parecer información](el-workaround-que-usas-de-rutina-deja-de-parecerte-informacion.md) - 3ª vez, escribilo.
- [🕵️ Una sesión parada puede tener la respuesta ENTERRADA](sesion-parada-la-respuesta-existe-pero-enterrada.md) - buscá antes de reabrir.
- [🚀📱 Entrega progresiva por hito + E2E en device](entrega-progresiva-y-e2e-en-device.md) - no cierra hasta desplegado y probado.
- [🎓 Cierre del aprendizaje no es opcional](cierre-del-aprendizaje-no-opcional.md) - test *¿puede volver?* Si no, no terminó.
- [♻️ Cero deuda de MEJORA - implementar TODAS al cerrar](cero-deuda-de-mejora.md) - sólo se difiere no-código + MAYOR.
- [📋 Lo que NO está en la TABLA DE HITOS no existe](lo-que-no-esta-en-la-tabla-de-hitos-no-existe.md) - cada dueño necesita su renglón.
- [Propagar el cierre a TODOS los docs maestros](propagar-cierre-a-docs-maestros.md) - al doc-de-registro único.

### Evidencia: el instrumento antes que el resultado
- [🎯 El control positivo cubre sólo la mitad que sospechás](el-control-positivo-cubre-la-mitad-que-sospechas-y-la-otra-queda-muda.md) - el verde acredita al defecto que no mira.
- [🔌🕳️ La costura leía un campo que NADIE escribe](la-costura-leia-un-campo-que-nadie-escribe.md) - grepeá quién ESCRIBE, no quién lee.
- [🐤 El canario: control positivo de lo que falla CALLADO](el-canario-el-control-positivo-de-lo-que-falla-callado.md) - inyectá el caso a propósito.
- 🟢🙈 [Nadie audita un COHERENTE - desactiva trabajo sin rastro](nadie-audita-un-coherente-y-es-el-veredicto-que-desactiva-trabajo.md) · [el formato no codifica el ROL](si-el-formato-no-codifica-el-rol-ningun-parser-lo-recupera.md)
- [🔁📤 Medir obliga a REPORTAR, y el reporte entra al corpus medido](medir-obliga-a-reportar-y-el-reporte-entra-al-corpus-medido.md) — clasificar es una TASA por reporte, no una deuda que se paga.
- 🖼️🎭 El instrumento INVENTA: [una referencia que no existe](el-instrumento-fabrica-una-referencia-que-no-existe.md) · [un id fabricado](un-id-que-fabrica-el-instrumento-no-puede-parecerse-a-uno-real.md) - nadie los distingue.
- 🌍🕳️ [El universo EXTERNO trae su denominador incompleto](el-universo-externo-del-instrumento-tiene-su-propio-denominador-incompleto.md) · [calibrado a TU valor no ve al ajeno](un-control-calibrado-a-tu-propio-valor-no-ve-al-productor-ajeno.md)
- 👯❓ [Una asimetría entre GEMELOS no prueba que uno esté mal](una-asimetria-entre-gemelos-no-prueba-que-uno-este-mal.md) - ¿qué pregunta hace cada lado?
- 📬 [Un `cierre_` ajeno puede traer tu cola hecha](un-cierre-dirigido-a-otra-sesion-puede-contener-exactamente-tu-cola.md) · [una NORMA no tiene estado terminal](una-norma-no-tiene-estado-terminal-en-un-buzon-de-entregables.md)
- [🧮🕳️ Un ref que NO EXISTE da vacío, y vacío se parsea como `0`](medir-contra-un-ref-que-no-existe-da-vacio-y-vacio-se-parsea-como-cero.md) - omite Y inventa; medí el EFECTO.
- [🎯⚖️ Coincidir con la fuente independiente puede ser COMPENSACIÓN](una-cifra-que-coincide-con-la-fuente-independiente-puede-coincidir-por-compensacion.md) - descomponé, no compares totales

- [No codificar la esperanza - el TRONCO](no-codificar-la-esperanza-principio-raiz.md) - la prueba vale, la aserción no.
- [⚖️🔴 El instrumento también CONDENA, no sólo absuelve](el-instrumento-tambien-CONDENA-no-solo-absuelve.md) - el falso rojo parece prudencia.
- [🫥 Un instrumento que NO MIRA nunca falla](instrumento-que-no-mira-nunca-falla.md) - preguntá cuántos elementos miró. · [y el que corre DESPUÉS del guard no llega a mirar](un-control-de-ceguera-ubicado-despues-del-guard-que-dispara.md)
- [🪞 El guard se satisface con su PROPIO comentario](el-guard-se-satisface-con-su-propio-comentario.md) - descartá comentarios al buscar.
- [🚦📄 Un gate cuyo alcance depende del FORMATO DE SALIDA no es un gate](un-gate-cuyo-alcance-depende-del-formato-de-salida-no-es-un-gate.md) - vivía tras el `return` de `--json`.
- 🎚️ El gate que NO dispara: [medí si dispara antes de embarcarlo](medir-si-un-gate-dispara-antes-de-embarcarlo.md) · [un umbral del día envejece](un-umbral-calibrado-al-corpus-del-dia-envejece-con-el.md) - un empate no separa.
- 🏷️ El MAL clasificado: [nada lo cazaba](nada-cazaba-al-mal-clasificado-solo-al-no-clasificado.md) · [corroborar premia al que más cita](un-control-de-corroboracion-premia-al-que-mas-cita.md) - el analítico aprueba.
- [🗂️🕳️ Una sesión en WORKTREE es invisible al monitor](una-sesion-en-worktree-es-invisible-para-el-monitor-el-slug-sale-del-cwd.md) - el buzón manda.
- [🎯🔧 Un control positivo con ESPERADO FALSO acusa al script](un-control-positivo-con-esperado-falso-acusa-al-script.md) - ¿el número lo midió alguien o lo escribió alguien?
- [🔬⚖️ Lo que se retira es la CAUSA, no la OBSERVACIÓN](una-observacion-no-reproducida-se-degrada-a-observacion-no-se-retira.md) - la conclusión suele sobrevivir con otro porqué.
- [🧪🔀 Comparar ramas con un instrumento VERSIONADO mide DOS variables](el-instrumento-versionado-difiere-por-rama.md) — fijá uno; el control es un archivo que nadie toca.
- [🎭🚪 Dos causas distintas comparten el CÓDIGO DE SALIDA](dos-causas-distintas-comparten-el-codigo-de-salida-y-el-mensaje-elige-una.md) - el falso empuja al `--no-verify`.
- [🔇🚫 Un mecanismo roto hacia el "NO" no da síntoma](un-mecanismo-roto-hacia-el-no-no-da-sintoma.md) - todo gate necesita control POSITIVO.
- [📄🕳️ Un control ARCHIVO no ve la divergencia ADENTRO](un-control-a-nivel-archivo-no-ve-la-divergencia-adentro.md) - `feedback`. Cero ≠ luz verde.
- [🔌🙈 El test que no usa el camino de prod no lo ve fallar](el-test-que-no-usa-el-camino-de-produccion-no-puede-verlo-fallar.md) - composition root.
- [🔀🧬 Dos clientes gemelos: el fix llega a UNO](dos-implementaciones-del-mismo-cliente-el-fix-llega-a-una.md) - contá definiciones, no usos.
- [🎯 Un supuesto cuya falla parece LEGÍTIMA es pregunta](supuesto-cuya-falla-parece-un-estado-legitimo.md) - *¿cómo se vería si fuera falso?*
- [🩹🎭 Un degradado PRUDENTE hacia el caso benigno envenena la medición](un-degradado-prudente-hacia-el-caso-benigno-envenena-la-medicion.md) - grepá «ante la duda» antes de medir.
- [🧹 Barrer llamadores incluye los INSTRUMENTOS](barrer-llamadores-incluye-los-instrumentos-de-verificacion.md) - C4.1 iba a tumbar el smoke que era su propio control positivo. Mismo PR.
- [🎲 Un instrumento compartido INTERMITENTE fabrica una excusa lista](un-instrumento-compartido-intermitente-fabrica-una-excusa-lista.md) - "es el flake conocido" lava la próxima regresión real.
- [Un enum al final del renglón lo borra el que appendea](un-enum-al-final-del-renglon-lo-borra-el-que-appendea.md) - 2 frentes invisibles: el estado va en el ÚLTIMO campo.
- [🐕‍🦺 El watchdog sólo ve al que LLEGA TARDE, nunca al que NO VINO](el-watchdog-que-solo-ve-al-que-llega-tarde-nunca-al-que-no-vino.md) - medí contra la expectativa, no contra el reloj.
- [✂️ Pipear por `tail` BORRA la evidencia del fallo](pipear-un-proceso-largo-por-tail-borra-la-evidencia-del-fallo.md) - la verde tapa a la roja. Background → archivo COMPLETO.
- [⏰🔕 Un disparador CUMPLIDO no avisa a nadie](un-disparador-cumplido-no-avisa-a-nadie.md) - la cola vive en 2 lugares y sólo uno se mira solo. Cerralo con instrumento.

### Guards, gates y jueces
- [🛡️💥 Un guard que grita en el caso NORMAL se desarma](el-guard-que-grita-en-el-caso-normal-se-desarma-solo.md) - el falso positivo enseña a saltear.
- [🚦💥 El guard da LUZ VERDE justo en su caso de activación](el-guard-falla-abierto-en-su-caso-de-activacion.md) - leé la rama de ERROR.
- [🚦🌍 Gate cuyo corpus vive FUERA del repo: mide al EQUIPO, no al commit](un-gate-cuyo-corpus-vive-fuera-del-repo-mide-al-equipo-no-al-commit.md) - y CI lo saltea: verde arriba, rojo abajo.
- [📜 La exención cita una autoridad que NO la ampara](exencion-sin-autoridad.md) - 34 exentos citaban un acta de 2 casos. Contá.
- [⚖️🗺️ Al JUEZ también hay que darle el plano](al-juez-tambien-hay-que-darle-el-plano.md) - sin contexto rechaza, y parece prudencia.
- [📜🎯 Un contrato define QUÉ DECLARAR - no asigna anclas que no midió](un-contrato-define-que-declarar-no-asigna-anclas-que-no-medi.md) - 4 de 4 refutadas en un día.
- [🔨🎯 El forjador NO acierta siempre](el-forjador-no-acierta-siempre-el-gate-de-tests-no-es-opcional.md) - formato válido ≠ contenido correcto.
- [🧟🚨 El artefacto del instrumento NO TIENE DUEÑO](el-artefacto-que-genera-el-instrumento-no-tiene-dueno.md) - enciende, no apaga: alarma inmortal.
- [🚧🔁 El guard se vuelve el CUELLO DE BOTELLA](el-guard-se-vuelve-el-cuello-de-botella-de-lo-que-protege.md) - declará si el rechazo es permanente.
- [🔗🛡️ El 1er test rojo MATA la suite: el ajeno es escudo del propio](el-primer-test-rojo-mata-la-suite-y-el-rojo-ajeno-se-vuelve-escudo-del-propio.md) - corrieron 8 de 47.
- [🔀🕳️ Dos decisiones correctas que se cruzan en un AGUJERO](dos-decisiones-correctas-que-se-cruzan-en-un-agujero.md) - el hueco vive en el par.

### Diagnóstico: leer el contrato antes de explicar
- [Raíz, no parche](raiz-no-parche.md) - hook `root_cause_suggester`
- [🎯🕳️ Diseñar contra el riesgo TEMIDO ciega al caso NORMAL](disenar-contra-el-riesgo-temido-ciega-al-caso-normal.md) - corré el caso vacío primero.
- [🎛️ Verificar la COMPOSICIÓN ROOT, no el default](verificar-la-composicion-root-no-el-default.md) - otra capa puede sobreescribirla.
- 🎭 El exit code MIENTE en los dos sentidos: [el pipe se lo come](el-pipe-se-come-el-exit-code.md) · [0 sin pushear; ROJO con el merge hecho](git-push-puede-salir-exit-0-sin-haber-pusheado.md) - el control es el EFECTO.

### Diseño y arquitectura
- [♻️🔒 Reutilizar es REGLA - inventario ANTES del diseño](reutilizacion-es-regla-el-inventario-va-antes-del-diseno.md) - todo `contrato_` abre con §0.
- [🧭🪣 Elegí la unidad de trabajo por dónde vivía el DATO](elegi-la-unidad-de-trabajo-por-donde-vivia-el-dato.md) - el ACCESO elige la arquitectura.
- [🧩🏷️ Una fila por VALOR de una variable no es una fila](una-fila-por-valor-de-una-variable-no-es-una-fila.md) - el id es plantilla: ¿qué MIDE?
- [🧠 Trifecta cognitiva - SOTA con 2 lentes](trifecta-sota-lente-lateral-hack.md) - el 2º lente colapsa el problema.
- [♻️🙈 Idempotente ≠ CONVERGENTE](idempotente-no-es-convergente.md) - *¿si cambio el valor, cambia el recurso?*
- [🔁 "Si ya existe, devolvelo" NO es idempotencia - es una ventana](idempotencia-con-un-if-tiene-ventana.md) - medí el EFECTO.
- [🧩 El fix YA existe en otro call-site - propagar, no diseñar](el-fix-ya-existe-en-otro-call-site.md) - grepeá el patrón del FIX.
- [🧬🔁 El MISMO defecto vivía DOS veces](el-mismo-defecto-vivia-dos-veces-el-fix-en-la-capa-compartida-no-alcanzo.md) - ¿qué capa usa la UI: el core o su copia?
- [🎭 DOS causas suficientes = el test no ATRIBUYE](dos-causas-suficientes-el-test-no-atribuye.md) - el diferencial sale VERDE.
- [🪤🏷️ El fallo que se MUEVE acusa al RECURSO COMPARTIDO](el-fallo-que-se-mueve-acusa-al-recurso-compartido.md) - id y viewport son fijos; el server no.
- [🧬 El fix de RAZONAMIENTO no viaja con el código copiado](el-fix-de-razonamiento-no-viaja-con-el-codigo-copiado.md) - el matiz va en comentario.
- [🖋️ El contrato afirma el mecanismo que NO opero](el-contrato-afirma-el-mecanismo-que-no-opero.md) - de un sistema: leé su código.
- [✏️ Definición delgada de UX = decisión abierta](definicion-delgada-de-ux-se-llena-con-el-port-del-canonico.md) - "portar" importa la ajena.

### Delegación, contexto y herramientas
- [🔒⚡ 3 gates que FRENAN - script-first · headless · modelo-por-tarea](gates-mecanicos-de-eficiencia-script-first-y-modelo-por-tarea.md) - nivel 1.
- [🖥️➡️📡 Sub-agentes van HEADLESS, no inline](subagentes-van-headless-no-inline-en-la-terminal.md) - `claude -p`, misma auth.
- [🕸️🔍 GRAFO primero, código después - para LOCALIZAR](grafo-primero-codigo-despues-para-localizar.md) - MCP `graphity-code`.
- [Orquestación de waves - parent valida + commitea](orquestacion-waves-parent-valida.md) - verificá el estado, no el reporte.
- [🔬 Loop auditoría Fable → análisis Opus → contratos → E2E](loop-auditoria-fable-analisis-opus-contratos-e2e.md) - loop reutilizable.
- [📚 El índice truncado FABRICA duplicados](el-indice-truncado-fabrica-duplicados.md) - sin cargar completo ⇒ duplicados.
- [📏➕ Un REFUERZO va adentro, no pide línea](el-refuerzo-va-adentro-no-pide-linea.md) - índice en su techo (55% = slug dos veces). Un refuerzo cuesta 0.
- [🧠💣 Memoria repo vs slug divergen - `seed-memory.sh` BORRA](memoria-repo-vs-slug-drift.md) - leer antes. Escribí en `memoria/` del repo.
- [💸 Sesión con modelo CARO → se le entrega el inventario hecho](sesion-con-modelo-caro-se-le-entrega-el-inventario-hecho.md) - el contrato apunta a paths, no dice «explorá».

### Coordinación entre sesiones
- [📋🔃 El contrato que manda a hacer algo YA HECHO](el-contrato-que-manda-a-hacer-algo-ya-hecho.md) - medí estado y dueño de cada id ANTES de citarlo.
- [📬 Un mensaje entregado DONDE NADIE MIRA no fue entregado](mensaje-entregado-donde-nadie-mira.md) - probá el cable.
- [📮🕳️ El TIPO de mensaje decide si lo PERSIGUEN](el-tipo-de-mensaje-decide-si-alguien-lo-persigue.md) - `dato_` NO escala; ¿querés reclamo? → `pedido_`.
- [📢📋 De dos artefactos, gana el que CIRCULA](de-dos-artefactos-con-distinta-precision-gana-el-que-circula.md) - corregir appendeando deja el titular refutado al frente.
- [🧹🤖 El buzón se ordena por JANITOR, no por disciplina](buzon-se-ordena-por-janitor-no-por-disciplina.md) - nunca a mano.
- [`>>` a ruta supuesta del buzón + `mv` pisa el contrato](append-a-ruta-supuesta-del-buzon-crea-un-stub-y-el-mv-pisa-el-contrato.md) - perdí K-07/08/10/11; ubicar con `find` y `mv -n`.
- [⏱️🌀 El cron dispara MÁS cuanto MENOS trabaja la sesión](el-cron-dispara-mas-cuanto-menos-trabaja-la-sesion.md) - un turno mide OCIO.
- [📱🛑 El TELÉFONO exige dueño único - y ESCRIBE en la base](device-fisico-exige-dueno-unico.md) - dos ADB fabrican evidencia falsa.
- [📱🍳 Un gate de device se corre con RECETA async](gate-de-device-se-corre-con-receta-no-con-ventana-viva.md) - gestos escritos, no ventana viva.


### Git, deploy y checkout compartido
- [🩹 `--amend`/rebase en checkout compartido pisa el commit de otro](amend-en-checkout-compartido-pisa-el-commit-de-otro.md) - commit `docs:` nuevo.
- [💥 `git checkout <ref> -- .` PISA lo del working tree](checkout-ref-doble-guion-punto-pisa-cambios-solo-en-working-tree.md) - usá `merge-base`.
- [🚨 Sincronizar al VPS desde el worktree equivocado tumba el servicio](sincronizar-al-vps-desde-el-worktree-equivocado.md) - pisa mudo.
- [🚢 `deploy.sh` NO valida que el checkout esté al día con main](deploy-sh-no-valida-checkout-al-dia-con-main.md) - sube el disco tal cual.
- [🔀 El orden de merge se elige por el estado INTERMEDIO de main](orden-de-merge-por-el-estado-intermedio.md) - primero la rama en prod.
- [🪟💥 Git Bash mangla paths con punto](git-bash-mangla-paths-con-punto-y-fabrica-handoffs-falsos.md) - `MSYS_NO_PATHCONV=1`
- [🔀📤 El squash-merge toma el HEAD REMOTO, no tu último fix local](push-es-el-ultimo-paso-no-el-primero.md) - repushear y comparar con `ls-remote` antes de mergear.

## 🏭 El producto - LEER antes de tocar
- [🔱 Motor en FORK DURO + fix del buffer de corto plazo](motor-fork-duro-fix-buffer-corto.md) - **antes de tocar `motor/`.** `sync-motor.sh` retirado; el fix se hace ACÁ.
- [🔐 Auth = GoTrue DEDICADA (cutover vivo)](copiloto-gotrue-dedicada-cutover.md) - **al tocar auth/OAuth.** Google OAuth LIVE. Deuda: passwords temporales.
- [🧠🧱 MemoryProvider - memoria conversacional CABLEADA](copiloto-memoria-provider-ladrillo.md) - **al tocar la memoria.** warm+recall+remember, gate `config['memory']`.
- [🎙️🃏 Mecanismo canónico de las cards por voz](mecanismo-canonico-de-las-cards-por-voz.md) - nunca se pregunta 2 veces; a la 2ª manda la card.
- [⚠️ El MCP de Composio da acceso TOTAL al Gmail del operador](composio-mcp-gmail-acceso-completo.md) - incluye borrado permanente. No heredarlo a agentes autónomos.
- [🕸️ Grafo: tenant dedicado + structured 0-LLM + ontología scoped](graphity-tenant-dedicado-y-ontologia-scoped.md) - instancia COMPARTIDA ⇒ `graph_ids` o fuga.
- [🔑🚪 La tabla que RESUELVE el control no puede estar sujeta al control](la-tabla-que-resuelve-el-control-no-puede-estar-sujeta-al-control.md)
- [🧪 DESPLEGADO ≠ con clientes - los datos se fabrican](desplegado-no-significa-con-clientes.md) - cero usuarios; "prod-beta" desvía a migraciones defensivas.
- [🔐 Deuda de secretos a rotar (pre-prod)](deuda-secretos-rotar.md) - keys que pasaron por chat. grep-first + restart al rotar.

### Frontend móvil
- [🔍 Auditorías van en `docs/copiloto-emprendedor/Auditorias/`](auditorias-van-en-carpeta-auditorias.md) - regla del operador. Nunca sueltas en `docs/`.
- [📱🔀 El dev-server sirve el CHECKOUT COMPARTIDO](metro-sirve-el-bundle-del-checkout-compartido-no-del-worktree.md) - Metro y vite. Pedile que se identifique.
- [🧩🔀 Resolver "tomando un lado" NUNCA converge](resolver-tomando-un-lado-nunca-converge.md) - `--ours`/`--theirs` descarta una mitad. Un grep por CADA mitad.
- [🕐💥 El backup de Graphity tumba su API 4×/día, 60-90 s](graphity-backup-cron-tumba-el-api-4x-dia-60-90s.md) - 03:30/09:30/15:30/21:30: el `pre-push` aborta con 503.

## 🗄️ Historia
→ [HISTORIA.md](HISTORIA.md) - hitos cerrados y entradas bajadas del índice. **NO se carga; buscable.**
