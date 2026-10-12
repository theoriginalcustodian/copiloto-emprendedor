#!/usr/bin/env bash
# Abre en GitHub un issue por item del backlog del sprint «app lista para un usuario» (2026-10-11).
#
# POR QUE UN SCRIPT Y NO 15 `gh issue create` A MANO
# --------------------------------------------------
# IDEMPOTENTE: antes de crear, busca el titulo exacto entre los issues abiertos Y cerrados. Si ya
# existe, lo reporta y sigue. Correrlo N veces no duplica nada -- importa porque el repo ya tiene
# issues de agosto que describen defectos de prod (#468..#473) y un duplicado los enterraria.
#
# NO ACEPTA ARGUMENTOS LIBRES: solo `--dry-run`. El repo es el del cwd (el `gh` lo resuelve solo) y
# la lista de issues vive ACA, en el fuente, no en la linea de comandos. Leccion del 2026-10-11:
# un sujeto cuyo alcance depende de un argumento no es un sujeto acotado.
#
# QUE NO SE PUBLICA, A PROPOSITO: el repo es PUBLICO. No van los 4 emails de la allowlist (dato
# personal del operador), ni tokens, ni URLs internas, ni el documento maestro completo. Si va el
# path:linea del codigo -- el codigo ya es publico.
#
# CONTEXTO QUE VA EN CADA ISSUE DE DINERO, PORQUE CAMBIA LA LECTURA
# --------------------------------------------------------------
# NO HAY USUARIOS REALES todavia (cero tenants con datos propios; los 21 de la base son de PRUEBA y
# por eso no tienen credenciales). Entonces ningun defecto de plata CAUSO daño: son latentes. Decir
# "la app cobra mal" sin esa aclaracion, en un repo publico, describe un incidente que no ocurrio.
# Lo que importa del orden del sprint sale de aca: primero se arregla el dinero y DESPUES se deja
# entrar gente, porque al revés el primer usuario real es el que descubre el defecto.
#
# Uso:
#   bash scripts/abrir-issues-sprint.sh --dry-run   # imprime que crearia y que ya existe
#   bash scripts/abrir-issues-sprint.sh             # crea los que falten
set -euo pipefail

DRY=0
while [ $# -gt 0 ]; do
  case "$1" in
    --dry-run) DRY=1; shift ;;
    *) echo "argumento no reconocido: $1" >&2
       echo "solo acepta --dry-run. La lista de issues es fija y vive en el script." >&2
       exit 2 ;;
  esac
done

command -v gh >/dev/null || { echo "ABORTA: falta el CLI gh" >&2; exit 3; }
gh auth status >/dev/null 2>&1 || { echo "ABORTA: gh no esta autenticado" >&2; exit 3; }

# ── Los items. Formato: TITULO ⟂ LABELS ⟂ CUERPO  (⟂ porque no aparece en ningun texto) ──────────
# El cuerpo cierra siempre con el DoD binario: sin criterio de cierre medible, un issue no cierra.
ITEMS=()

ITEMS+=("F0.1 · Un usuario nuevo no puede darse de alta: la allowlist es fail-closed con 4 emails ⟂ bug,sprint-app-lista ⟂
**Medido el 2026-10-11** contra el proceso vivo.

\`_email_en_allowlist\` (\`apps/copiloto/web.py:581-583\`) rechaza el alta de cualquier email que no
este en la lista, y la lista del proceso en prod tiene **4 entradas, todas del operador** (no se
publican aca: son datos personales).

**Alcance real, y corrige lo que decia la primera version del backlog:** esto gobierna el **alta**,
no el **login**. Una cuenta que ya existe entra igual — prueba: el usuario canonico de smoke no
figura en la allowlist y viene entrando. Entonces bloquea **un** criterio del DoD, no los ocho.

**Decision del operador que lo desbloquea (MAYOR):** beta por invitacion con UI para cargar la
allowlist, **o** alta abierta.

**DoD:** un email que no estaba antes completa el alta y llega a la pantalla principal, con
evidencia de la corrida.")

ITEMS+=("F0.2 · El alta por email en la web esta incompleta: el backend exige un invite_token que el cliente nunca manda ⟂ bug,sprint-app-lista ⟂
El formulario de alta de la PWA no envia \`invite_token\` y el backend lo exige, asi que el alta por
email no se puede completar desde la web ni con la allowlist resuelta.

**Relacionado:** #F0.1 (la allowlist) es una condicion distinta — resolver una no resuelve la otra.

**DoD:** alta por email completada de punta a punta desde la web, con la respuesta del endpoint
adjunta.")

ITEMS+=("F0.3 · Mobile no cablea la ACEPTACION legal (la pantalla de lectura ya existe) y la aceptacion no condiciona nada en ninguna plataforma ⟂ bug,sprint-app-lista ⟂
**Medido:** en mobile el campo viaja pero el verbo no existe — \`aceptarLegal\` da **0 archivos** en
\`apps/mobile\` contra 7 en web; \`legal_aceptado\` aparece en 4 archivos de mobile y **ninguno
productivo** (todos fixtures). Control negativo \`aceptarLegalZZZ\` → 0, asi que el grep discrimina.

No es un olvido: \`packages/core/src/api/types.ts:101-107\` ya dejo escrito que el campo viaja
\"antes de que haya pantalla\".

**Costo real:** v1 (portar la pantalla) no es solo la pantalla — es pantalla + funcion de cliente +
gate, y las tres faltan. v2 (solo informar) cuesta el port.

**Pendiente del operador:** el texto legal definitivo. Es **un** archivo
(\`packages/core/src/legal.ts\`, \`LEGAL_AVISO_PLANTILLA\`) y las dos apps lo toman juntas. Ojo: en esa
pantalla hay **dos** avisos (la plantilla y \`LEGAL_DESCARGO\`, que el repo declara PROVISORIO) —
retirar uno no resuelve el otro.

**DoD:** en device, un usuario nuevo ve y acepta el texto, y el estado queda persistido.")

ITEMS+=("F0.4 · Sin proveedor SMTP no hay recuperacion de contraseña: la pantalla \"cuenta\" es un desvio ⟂ bug,sprint-app-lista ⟂
\`.env.gotrue.template\` tiene \`GOTRUE_SMTP_USER\`/\`PASS\` **vacios** y \`GOTRUE_MAILER_AUTOCONFIRM=true\`.
El slot existe; falta la cuenta.

Las otras dos partes del interruptor de mail **ya estan hechas**: \`handle /auth/v1/verify*\` en
\`deploy/copiloto/Caddyfile.snippet:48\` y \`API_EXTERNAL_URL\` aplicado en prod.

**Pendiente del operador (MAYOR):** contratar el proveedor SMTP + DNS.

**DoD:** un usuario pide recuperar la clave, recibe el mail y vuelve a entrar.")

ITEMS+=("F1.4 · \"Lo facturado\" se calcula con cuatro predicados distintos segun quien pregunte ⟂ bug,dinero,sprint-app-lista ⟂
Cuatro caras del producto responden \"cuanto facture\" con **criterios distintos** sobre
\`afip_comprobantes\`, asi que el mismo mes da numeros distintos segun donde se mire.

**Por que importa:** no es cosmetica — es el numero por el que el emprendedor decide.

**DoD:** un solo lugar define \"facturado\" (como ya pasa con «Entro» en
\`inteligencia_queries._INGRESOS\`), las cuatro caras lo consumen, y un test cuenta el mismo mes por
las cuatro vias y exige el mismo valor.")

ITEMS+=("F1.5 · La nota de credito se emite sin numero reservado (el fix ya existe en el otro call-site) ⟂ bug,dinero,sprint-app-lista ⟂
\`afip_anulacion_workflow.py:116-120\` emite la NC sin reservar numero, mientras
\`afip_factura_workflow.py:287-297\` **si** lo reserva para la factura.

**No hay que diseñar nada:** el mecanismo esta escrito y probado en el camino de la factura. Es
propagarlo al de la anulacion.

**DoD:** dos anulaciones concurrentes no pisan numero; test que lo ejercite con concurrencia real
(el camino de la factura ya tiene uno con \`threading.Barrier\`, se reusa el patron).")

ITEMS+=("F2.1 · Un Responsable Inscripto lee \"ya podes facturar\" y la emision explota con NotImplementedError ⟂ bug,sprint-app-lista ⟂
El onboarding declara al RI habilitado (\`apps/copiloto/afip_web.py:635\`) y la emision levanta
\`NotImplementedError\` (\`apps/copiloto/afip_rules.py:302-306\`): la condicion fiscal del usuario decide
si la promesa se cumple, y el mensaje no lo sabe.

**DoD, cualquiera de los dos, explicito:** o el RI puede emitir, o la app le dice la verdad antes de
que lo intente. Lo que no puede quedar es la promesa sin rama.")

ITEMS+=("F2.2 · El catalogo de apps anuncia herramientas que fueron podadas ⟂ bug,sprint-app-lista ⟂
La pantalla de integraciones ofrece capacidades cuyas tools ya no estan cableadas: el usuario conecta
una app y la accion no existe.

**Decision del operador, item por item:** cablear la capacidad **o** retirar la promesa.

**DoD:** cada item del catalogo o ejecuta, o no aparece. Verificado en device.")

ITEMS+=("F3.1 · La card de confirmacion (HITL) queda activa despues de responderla ⟂ bug,mobile,sprint-app-lista ⟂
\`apps/mobile/src/.../ChatView.tsx:149-153\`: la card sigue interactiva despues de que el usuario
contesto, asi que acepta un segundo toque sobre algo ya resuelto.

**DoD:** en device, responder una card la deja inerte; un segundo toque no dispara nada.")

ITEMS+=("F3.2 · La app dice \"No lo anotamos.\" sobre un ingreso que SI quedo guardado ⟂ bug,mobile,dinero,sprint-app-lista ⟂
\`TarjetaIngresoPropuesto.tsx:85-94\` muestra el mensaje de descarte en un camino donde el ingreso ya
se persistio. Un usuario creeria que no se guardo y lo cargaria de nuevo ⇒ **ingreso duplicado**, por un
texto. (Latente: todavia no hay usuarios reales.)

**DoD:** el mensaje refleja el estado real de la persistencia; test que cubra el camino donde hoy
miente.")

ITEMS+=("F3.3 · Anular un comprobante falla en silencio: try/finally sin catch ⟂ bug,mobile,sprint-app-lista ⟂
\`SeccionMisComprobantes.tsx:157-182\` envuelve la anulacion en \`try/finally\` **sin \`catch\`**: si
falla, el usuario no se entera. Queda creyendo que anulo.

**DoD:** un fallo de anulacion se ve en pantalla, con el motivo. Ejercitado en device con el backend
devolviendo error.")

ITEMS+=("F3.4 · El toque de la pestaña del escritorio es INTERMITENTE: abre 4 de 6 ciclos, y al primer toque 1 de 6 ⟂ bug,mobile,sprint-app-lista ⟂
\`PanelFunciones.tsx:85-105,126,132-140\`: el panel exige dos gestos para abrirse.

**Antes de tocar nada:** \`swmansion-rn-gestures\` (composicion Pan/scroll) y el equivalente de
\`documed-front\`, que ya resolvio esta casacara en device. Portar adaptando, no copiar ciego.

**Y va ANTES de la medicion E2E en device:** hoy el instrumento no separa \"la ruta no responde\" de
\"mi gesto se perdio\".

**DoD:** un gesto abre el escritorio, medido en device con \`adb input motionevent\` (un \`input tap\`
no ejercita un Pan de RNGH).")

ITEMS+=("F4.1 · Las 6 cadenas de negocio nunca se midieron de punta a punta en device ⟂ test,mobile,sprint-app-lista ⟂
El sprint no cierra por codigo: cierra por device. Las 6 cadenas (chatear, facturar, cobrar, gastos,
clientes, contabilidad) no tienen una corrida E2E en telefono.

**Precondiciones ya cumplidas (medido 2026-10-11):** binario instalado, device \`RF8T318RN9T\`, Metro
vivo. Iterar NO compila nada: dev-client instalado + Metro por USB.

**Reglas que siguen vigentes:** el telefono tiene **dueño unico** (dos sesiones con ADB fabrican
evidencia falsa) y el usuario de prueba es **uno solo, canonico**.

**DoD:** las 6 cadenas con evidencia de corrida en device, una por una.")

ITEMS+=("F4.2 · El eje A tiene 1 pantalla verificada de 21, no 6: el retiro de H-60 invalido las que se midieron con las animaciones apagadas ⟂ test,mobile,sprint-app-lista ⟂
El relevamiento mobile dejo **15 pantallas sin medir** y 5 casillas \`NO_ATRIBUIBLE\` en el eje A. Una
pantalla no medida no es una pantalla que funciona.

**DoD:** cada una de las 15 con veredicto medido (no inferido), y las 5 casillas atribuidas o
declaradas con su motivo.")

ITEMS+=("F4.3 · El APK de dev-client se evapora de EAS a los 14 dias: falta la receta de reconstruccion ⟂ test,mobile,sprint-app-lista ⟂
EAS borra los artefactos a los 14 dias. El build actual (\`5e19949f\`) tiene fecha de vencimiento y la
receta para reconstruirlo no esta escrita en ningun lado.

**DoD:** receta de rebuild escrita y **corrida una vez** desde cero (no \"deberia funcionar\").")

# ── Los dos que ya tienen fix escrito y sin pushear ───────────────────────────────────────────────
ITEMS+=("F1.1 · Un pago de MercadoPago se contaba DOS veces en «Entro» desde el 2026-10-06 ⟂ bug,dinero,sprint-app-lista ⟂
**Defecto confirmado con numeros, no inferido.** \`9e4a70dc\` (COBROMP, 06/10) hizo que el webhook
registre el pago aprobado en \`copiloto_cobros\` ademas de persistirlo crudo en \`mp_payments\`, y **no
toco** \`inteligencia_queries.py\`, cuya definicion de «Entro» une las dos tablas con \`UNION ALL\`
porque su comentario declaraba que ese origen \"no lo escribe nadie todavia\".

**Efecto en el codigo:** un pago de \$300 suma **\$600** a «Entro», mientras \`listar_ingresos\`
muestra \$300. Dos caras del producto, dos numeros para el mismo pago.

⚠️ **Latente, no ocurrido: no hay usuarios reales todavia** (los tenants de la base son de prueba).
Nadie vio un numero mal. Y de ahi el orden del sprint: el dinero se arregla ANTES de abrir el alta,
porque al reves el primer usuario real es el que lo descubre.

**Vivia en dos lugares:** \`entro_vs_salio_detalle\` reimplementa la regla (no puede reusar el string
del agregado) y duplicaba tambien la fila del detalle.

**Por que ningun test lo cazo:** el test que debia hacerlo inserta con un helper que escribe UNA
tabla, o sea codifica el camino de produccion **anterior** al 06/10.

**Estado: FIX ESCRITO Y VERIFICADO, SIN PUSHEAR.** Rama local \`backend/entro-cuenta-el-pago-mp-dos-veces\`.
Suite backend **2297 passed / 0 failed** en el VPS contra Postgres efimero; control positivo: con el
fix revertido caen 2 tests con los numeros del defecto (\`600.00 != 300.00\` y \`2 != 1\` filas).

**DoD:** el fix en \`main\` y desplegado. Lo unico que falta es levantar la orden de no pushear.")

ITEMS+=("F1.2 · La app ofrece \"Anular\" sobre una nota de credito: ninguna fila valia estado='nota_credito' ⟂ bug,dinero,sprint-app-lista ⟂
\`registrar()\` de \`afip_comprobante_store.py\` tenia default \`estado='emitida'\` fijo y **ningun
llamador pasa \`estado\`**, asi que ninguna fila de la tabla valia \`nota_credito\` jamas: la constante
\`ESTADO_NOTA_CREDITO\` tenia **una sola aparicion en todo el repo, su propia definicion**.

**Efecto:** la NC que emite \`afip_anulacion_workflow\` se persistia como \`emitida\`, y los dos fronts
ofrecen «Anular» a todo lo que este \`emitida\` (\`SeccionMisComprobantes.tsx:24\`, mobile **y** web) ⇒
la app ofrecia **anular una nota de credito**.

**Por que no daba sintoma en ningun numero:** \`total_periodo\` identifica las NC por \`tipo_cbte\`, no
por \`estado\`, asi que el facturado siempre estuvo bien. El estado muerto no afectaba plata: afectaba
que se ofreciera una accion fiscal invalida.

**Corrige el backlog:** este item se habia escrito como \"raiz de tres sintomas\" incluyendo el
facturado. Medido, **no** lo es.

**Estado: FIX ESCRITO Y VERIFICADO, SIN PUSHEAR** (misma rama). 17/17 del archivo en el VPS; control
positivo: con el fix revertido cae con \`assert 'emitida' == 'nota_credito'\`.

**DoD:** el fix en \`main\` y desplegado.")

# ── Items del barrido de paridad web-vs-mobile (2026-10-11) ───────────────────────────────────
ITEMS+=("F5.1 · Mobile no tiene alta de cuenta: un usuario que baja la app no puede crearse un usuario desde el telefono ⟂ bug,sprint-app-lista,mobile ⟂
**Medido el 2026-10-11** por dos barridos independientes (pantallas y endpoints), que
coinciden.

\`POST /auth/signup\` (\`apps/copiloto/web.py:1294\`) lo llama **solo web**, desde
\`apps/copiloto-web/src/auth/SignupScreen.tsx:90\` (via \`apps/copiloto-web/src/lib/api/auth.ts:14\`).
En mobile no existe ni la pantalla ni la llamada, y el codigo lo dice literal:
\`apps/mobile/src/modules/ajustes/PantallaCuenta.tsx:58\` — «\`PantallaLogin\` es login-only (no hay
\`SignupScreen\` en esta plataforma, solo en web)».

Busquedas que lo sostienen (no es «no lo encontre»):
- \`grep -rni \"signup|crear cuenta|registr\" apps/mobile/src apps/mobile/app\` -> 4 hits, **todos
  comentarios**; ninguna pantalla ni llamada.
- \`grep -rn \"aceptarLegal|legal/aceptar\" apps/mobile/src\` -> **0** (la aceptacion legal tampoco, ver
  #1001: en web vive DENTRO del signup).

**Por que es el bloqueante mas caro de la beta:** la beta se entrega como app. Un emprendedor que la
instala tiene que poder crear su cuenta ahi, sin que nadie toque una env var ni la base. Hoy el unico
camino de alta es la web, y encima incompleto (#1000).

**Depende de #999** (la allowlist es fail-closed) y **de #1000** (el alta por email de web pide un
\`invite_token\` que el cliente no manda): construir el alta en mobile contra un backend cuyo contrato
de alta todavia no cierra es codificar la esperanza. Primero el contrato, despues las dos pantallas.

**DoD:** un email nuevo completa el alta **desde el telefono**, acepta el legal, y entra — sin que
nadie edite una env var ni la DB. Con test del camino real, no del happy-path mockeado.")

ITEMS+=("F5.2 · El chat de mobile no tiene renderer de artefactos ni desambiguacion multi-opcion ⟂ bug,sprint-app-lista,mobile ⟂
**Medido el 2026-10-11.** Las dos ausencias las declara el propio codigo de mobile, no las
dedujo nadie:

- \`apps/mobile/src/modules/chat/Burbuja.tsx:23\` — «No porta el renderer de artefacto».
- \`apps/mobile/src/modules/chat/ChatView.tsx:55\` — «Artefactos post-confirmacion …».
- \`apps/mobile/src/modules/chat/ListaMensajes.tsx:356\` — «Un \`choices\` que NO sea el par
  confirmar/cancelar (desambiguacion multi-opcion) **no tiene UI**».

En web los dos existen: \`apps/copiloto-web/src/modules/chat/ArtifactView.tsx:19\` (montado en
\`Bubble.tsx:73\`) y \`apps/copiloto-web/src/modules/chat/DisambiguationChips.tsx:17\` (montada en
\`MessageList.tsx:311\`).

El gate HITL **si** esta en mobile (\`ListaMensajes.tsx:329-339\`): lo que falta es el renderer del
artefacto que queda despues de confirmar, y la UI para cuando el copiloto ofrece **mas de dos**
opciones.

**Toca el criterio «conversa»** del DoD de la beta: si el copiloto necesita desambiguar entre tres
clientes parecidos, en mobile el usuario no ve las opciones. No es un hueco estetico — es una rama
del dialogo sin salida.

**DoD:** un \`choices\` de 3+ opciones se renderiza y es elegible en mobile, y un artefacto
post-confirmacion se muestra. Medido en device, con el usuario canonico.")

ITEMS+=("F5.3 · Mobile no tiene los bloques de AGREGADO que web si: «facturado del mes» y el resumen de presupuestos ⟂ bug,sprint-app-lista,mobile,dinero ⟂
**Medido el 2026-10-11**, comparando las dos apps pantalla por pantalla.

| bloque | en web | en mobile |
|---|---|---|
| «facturado del mes» | \`apps/copiloto-web/src/modules/facturacion/ResumenFacturacion.tsx:61\`, montado en \`PantallaFacturacion.tsx:518\` | **NO EXISTE** — no hay \`ResumenFacturacion.tsx\` en \`apps/mobile/src/modules/facturacion/\` |
| resumen «Esperando respuesta» (total + comparacion) | \`apps/copiloto-web/src/modules/presupuestos/PresupuestosScreen.tsx:264-272\` (\`presupuestos-resumen\`, \`-resumen-total\`, \`-resumen-comparacion\`) | **NO EXISTE** — los testID de \`PantallaPresupuestos.tsx\` no incluyen ningun \`-resumen\` |

Busqueda que lo sostiene:
\`grep -rniE \"facturado|listarImpagos\" apps/mobile/src/modules/facturacion/*.tsx\` -> solo
\`SeccionMeDeben.tsx:22,62\`; ningun agregado de facturado del mes.

**Por que importa para la beta y no es cosmetico:** el criterio «ve sus numeros» exige que portada y
detalle den **la misma** cifra. Un usuario de mobile hoy **no tiene** la cifra de facturado del mes
donde el de web la tiene, asi que no hay nada que comparar — y cuando se porte, hay que elegir **que
predicado** usa, que es justo el problema de #1003 («lo facturado» se calcula con cuatro predicados
distintos). Portar el bloque sin cerrar #1003 importa la ambiguedad al telefono.

**DoD:** los dos bloques existen en mobile y su cifra coincide con la del detalle para el mismo mes,
con el predicado unico que resuelva #1003. Verificado en device.")

ITEMS+=("F5.4 · «Tus apps» y los modos por app estan ESCRITOS E INALCANZABLES en web, y no existen en mobile: decidir si se cablea o se retira ⟂ sprint-app-lista ⟂
**Medido el 2026-10-11, y el hallazgo es el inverso del esperado:** no es una feature de web
que falte portar a mobile. Es una feature **muerta en las dos**.

En web existe entera —\`apps/copiloto-web/src/modules/apps/AppsScreen.tsx:61\`,
\`modules/apps/ModeButton.tsx\`, \`shell/modeStore.tsx\`, y el chip de modo del composer en
\`modules/chat/Composer.tsx:114-120\`— **y no se llega**: \`'apps'\` no esta en \`TABS\`
(\`apps/copiloto-web/src/shell/TabBar.tsx:62-73\`), y los dos shells lo documentan ellos mismos:
\`AppShell.tsx:116-121\` y \`DesktopShell.tsx:89-91\` — «\`apps\` quedo sin caller real tras la depuracion
de la barra». Los unicos productores de \`'apps'\` son esos dos guards; \`AjustesScreen.tsx:42\` navega a
\`'connections'\`, no a \`'apps'\`.

**Corolario que nadie habia nombrado: el chip de modo del composer de web tampoco puede activarse
hoy**, porque el unico lugar donde se elige un modo es esa pantalla.

Ojo con no confundirla con la que si funciona: \`modules/connections/ConnectionsScreen.tsx:38\`
(«Apps») es la que lista \`/catalog\`, conecta por OAuth y desconecta — y **esa** si tiene par en
mobile (\`apps/mobile/src/modules/apps/PantallaApps.tsx:111\`). Dos pantallas distintas con el mismo
nombre de cara al usuario.

**Por que esto es un item de DECISION y no de implementacion:** «portarlo a mobile» habria sido
construir en el telefono una capacidad que en web no se puede ni probar. Si los modos por app son
parte del producto, hay que **cablear la entrada en web primero** (y entonces el par de mobile tiene
contra que medirse). Si no lo son, se **retira el codigo muerto** de las dos y el chip del composer
con el.

**DoD:** decidido y ejecutado en una de las dos direcciones, sin tercera opcion: cableado y
alcanzable en web + portado a mobile, **o** retirado de web (pantalla, \`modeStore\`, \`ModeButton\` y
chip del composer) con el \`mode\` del \`send()\` limpiado.

⚠️ \`NO_PUDE_DETERMINAR\`: la inalcanzabilidad se midio por lectura estatica (fuerte: la declara el
propio codigo en dos lugares), **no** ejecutando la app. Antes de retirar, confirmarlo en runtime.")

ITEMS+=("F5.5 · Cinco capacidades del backend estan cableadas y ninguna app las llama ⟂ sprint-app-lista ⟂
**Medido el 2026-10-11** con un barrido de los **109** endpoints del backend contra los dos
clientes: 109 vistas, 109 clasificadas (control de ceguera en cero).

| endpoint | estado |
|---|---|
| \`PUT /gastos/{gasto_id}/imputacion\` (\`apps/copiloto/gastos_web.py:161\`) | nadie lo llama |
| \`GET /trabajos/{eslabon}/{ref}/margen\` (\`apps/copiloto/gastos_web.py:183\`) | nadie lo llama |
| \`POST /inteligencia/chat\` (\`apps/copiloto/inteligencia_web.py:129\`) | nadie lo llama — y mobile lo **removio a proposito** (\`apps/mobile/src/modules/inteligencia/PreguntarInteligencia.tsx:12\`). Funcion del cliente compartido viva y sin consumidor: \`packages/core/src/api/inteligencia.ts:206\` |
| \`POST /mi-dia/tarjetas\` (\`apps/copiloto/mi_dia_web.py:202\`) | nadie lo llama. Funcion viva sin consumidor: \`packages/core/src/api/miDia.ts:156\` |
| \`POST /auth/cambiar-email\` (\`apps/copiloto/web.py:1359\`) | nadie lo llama; **diferido explicito en los dos clientes** (\`copiloto-web/.../CambiarCredenciales.tsx:93\`, \`mobile/.../CambiarCredenciales.tsx:68\`). Funcion viva sin consumidor: \`packages/core/src/api/auth.ts:55\` |

**No entran en la lista** los que legitimamente no los llama un cliente: \`GET /mp/callback\` y
\`POST /mp/webhook\` (los invoca MercadoPago), \`GET /healthz\` y \`POST /salud/canario\` (infra).

**Por que es un item y no trivia:** tres de las cinco tienen hasta la funcion del cliente compartido
escrita. Eso es superficie que parece disponible al leer el core, y manda a cualquiera a «conectar lo
que ya esta hecho» sin que nadie haya decidido si el producto la tiene. \`cambiar-email\` ademas se
cruza con #1002: sin SMTP no se puede verificar un email nuevo, asi que su diferimiento tiene causa.

**DoD:** cada una de las cinco queda clasificada explicitamente como **se cablea** (con dueño y
pantalla) o **se retira** (endpoint + funcion del core), sin quedar ninguna en el medio. Un endpoint
sin consumidor y sin decision es deuda invisible.")

ITEMS+=("F5.6 · Tres filas de «Mi cuenta» en web prometen y no hacen nada, y estaban por portarse a mobile asi ⟂ bug,sprint-app-lista ⟂
**Medido el 2026-10-11** leyendo la pantalla, no su docstring — y el docstring era lo que
mandaba a portarlas.

\`apps/copiloto-web/src/modules/account/AccountScreen.tsx:88-90\` declara que web tiene de mas
«plan/idioma/notificaciones/privacidad/card de durabilidad» y que «se queda — es union, no
reemplazo». Leidas una por una:

| fila | que hace de verdad |
|---|---|
| «Idioma» (\`AccountScreen.tsx:132-138\`) | \`<div>\` **sin \`onClick\`** |
| «Privacidad del historial» (\`:214-217\`) | \`<div>\` **sin \`onClick\`** |
| toggle «Notificaciones» (\`:139-142\` + \`NotificationsToggle:61-74\`) | mueve un \`useState\` local; el propio codigo lo dice en \`:53-59\` — «SOLO visual — no hay endpoint/preferencia real» |

Y dos de los «huecos» de mobile de esa lista **no son huecos**: «Soporte tecnico» y «Como uso la app»
si son alcanzables en mobile, por otra puerta — tiles de Ajustes
(\`apps/mobile/src/modules/ajustes/PantallaAjustes.tsx:81-82\`, rutas \`app/ajustes-soporte.tsx\` y
\`app/ajustes-como-usar.tsx\`).

⇒ **El hueco real de mobile en «Mi cuenta» es de superficie, no funcional:** las 3 filas decorativas,
la card de durabilidad y la linea de version legal aceptada.

**Por que es un item:** es el mismo defecto de #1005 y #1006 (prometer sin rama) en otra pantalla, y
la union de las dos cosas es lo caro — un comentario que afirma capacidad mas una fila que parece
tocable manda a portar a mobile una promesa vacia. **Un usuario de la beta que toque «Notificaciones»
va a creer que las activo.**

**DoD:** cada una de las tres o se cablea (con endpoint y preferencia persistida) o se retira de la
UI. Ninguna queda visible prometiendo. Y el docstring de \`AccountScreen\` deja de citarlas como
capacidad existente — el comentario que afirma una capacidad es lo que se lee antes del codigo.")

# ── Helpers ────────────────────────────────────────────────────────────────────────
trim() { printf '%s' "$1" | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//'; }

# Los labels nuevos se crean ANTES, idempotente: si falta uno, `gh issue create --label` falla y el
# issue nace sin ninguno (incluido `bug`, que si existe). Crearlos primero evita perder los buenos.
asegurar_labels() {
  local existentes; existentes="$(gh label list --limit 200 --json name -q '.[].name' 2>/dev/null || true)"
  local l
  for l in "sprint-app-lista:Backlog del sprint app-lista-para-un-usuario (2026-10-11)"            "dinero:Toca plata: cobros, facturado, caja"            "mobile:App movil (apps/mobile)"            "test:Falta medicion o cobertura, no codigo"; do
    local nombre="${l%%:*}" desc="${l#*:}"
    if printf '%s
' "$existentes" | grep -qx "$nombre"; then
      echo "  = label ya existe: $nombre"
    elif [ "$DRY" = "1" ]; then
      echo "  + CREARIA label: $nombre"
    else
      gh label create "$nombre" --description "$desc" >/dev/null 2>&1         && echo "  + label creado: $nombre" || echo "  ! no pude crear el label $nombre (sigo)"
    fi
  done
}

# ── Ejecucion ────────────────────────────────────────────────────────────────────────────────────
echo "== repo: $(gh repo view --json nameWithOwner -q .nameWithOwner) (visibilidad: $(gh repo view --json visibility -q .visibility)) =="
[ "$DRY" = "1" ] && echo "== DRY-RUN: no se crea nada ==" || echo "== creando los que falten =="
echo

asegurar_labels
echo

creados=0; existian=0
for item in "${ITEMS[@]}"; do
  # Parsing con expansion de bash, NO awk: el delimitador va seguido de un salto de linea y
  # `awk -F' ⟂ '` exige el espacio de la derecha -- el dry-run lo destapo mostrando el label con el
  # delimitador pegado y el titulo arrastrando el cuerpo entero. Un dry-run que no se LEE no sirve.
  titulo="$(trim "${item%%⟂*}")"
  resto="${item#*⟂}"
  labels="$(trim "${resto%%⟂*}")"
  cuerpo="${resto#*⟂}"
  cuerpo="$(printf '%s' "$cuerpo" | sed -e '1{/^[[:space:]]*$/d}')"

  # Idempotencia: busca el titulo EXACTO entre abiertos y cerrados.
  ya="$(gh issue list --state all --limit 200 --json number,title \
        -q ".[] | select(.title == \"${titulo//\"/\\\"}\") | .number" 2>/dev/null | head -1)"
  if [ -n "$ya" ]; then
    echo "  = ya existe (#$ya): $titulo"
    existian=$((existian+1))
    continue
  fi

  if [ "$DRY" = "1" ]; then
    echo "  + CREARIA [$labels]: $titulo"
    echo "      └─ cuerpo: $(printf '%s' "$cuerpo" | tr '
' ' ' | cut -c1-90)..."
    creados=$((creados+1))
    continue
  fi

  url="$(gh issue create --title "$titulo" --body "$cuerpo" --label "$labels" 2>&1)" \
    && { echo "  + creado: $url"; creados=$((creados+1)); } \
    || { echo "  ! FALLO (reintento sin labels, pueden no existir): $titulo"
         url="$(gh issue create --title "$titulo" --body "$cuerpo" 2>&1)" \
           && { echo "    + creado sin labels: $url"; creados=$((creados+1)); } \
           || echo "    ! NO se pudo crear: $url"; }
done

echo
echo "== total: ${#ITEMS[@]} items | nuevos: $creados | ya existian: $existian =="
