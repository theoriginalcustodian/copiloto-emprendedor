# Relevamiento mapa ↔ app: lo que falta medir en el device y cómo completarlo

> **Fecha:** 2026-10-16 · **Sesión:** frontend2 · **Estado:** PLAN GUARDADO; ejecución parcial (ver «00. RETOMAR ACÁ»). Se escribió para que el trabajo no se pierda al compactarse el contexto.
> **Parte de:** `2026-10-16-relevamiento-mapa-de-pantallas-vs-app.md` (#1288 = `79b94ab6`) y `2026-10-16-relevamiento-concordancia-prototipo-vs-app-mobile.md` (#1285 = `01851f70`, #1287 = `e024075b`). Artefacto «Relevamiento Odobi» (privado): https://claude.ai/artifact/WdTwwZED2A6hUMwW1LfXDy (versión 3).

## 00. RETOMAR ACÁ (estado al cierre del 2026-10-16, noche)

**Decisiones del operador, todas registradas:** ambos ambientes (homologación y producción) · el botón de emitir lo toca el operador con su usuario `341lin@gmail.com` · receptor = consumidor final · usuario descartable **AUTORIZADO** · segundo aviso de Calendar **se agrega al mapa** · Pregunta 4: **gana el mapa** (tablero = pantalla propia «Tu día»). Detalle en §4 y §6.

**Hecho hoy:** #1297 (N1/N2/N8) y #1298 (decisiones MP, VISIÓN) mergeados; ARCA del operador medido = **0 credenciales** (§4); el teléfono quedó libre.

**Cola para mañana, en este orden:**
1. **Operador + teléfono:** iniciar sesión con `341lin@gmail.com` en el teléfono (yo no leo credenciales) → **vincular ARCA en homologación** (certificado propio del ambiente) → medir `fact-hitl` y `fact-cae` con la factura de $100 a consumidor final, **botón final = el operador**. Después lo mismo en **producción** (clave fiscal del operador; es comprobante real).
2. **Operador:** reconectar **Google Calendar** (autorización de Google, en el teléfono) → medir `agenda`.
3. Con la sesión del operador abierta, recorrer las entradas que usan su usuario (§2): `vozchat`, `fact-voz`, `pres-voz`, `card`, `preg`, `hitl` (cancelar, sin mail), `recibo`, `pres-hitl`, `pres-ciclo`, más los veredictos por código de §2.bis (`splash`, `volver`, `reveal`, `ingresar-error`; el cierre de sesión sólo con el usuario del operador).
4. **Usuario descartable** (autorizado): falta el mecanismo del alta — el operador genera la invitación / el alias; el candado `COPILOTO_SIGNUP_ALLOWLIST` + `COPILOTO_INVITE_TOKEN` no se lee. Cubre `bi-vacio`, `vacio`, `vacio-visto`, `onb-cumplida`, `onb-promesa`.
5. **Build release** para `entrada` y el experimento R03: **el operador todavía NO contestó** si se hace. Preguntárselo.

**Trabajo mío que no necesita al operador (puede adelantarse):**
- Editar el prototipo y el mapa (`mapa-pantallas/index.html`, `prototipo/index.html`, `specs/mobile-coherencia.md`) para agregar el **aviso de Google Calendar** caído en la portada de Mi día.
- `pedido_` a planificación: ficha con DoD para la **Pregunta 4** (Mi día = tarjeta de cabecera + lista «Ahora» + «Para hoy · Ver tablero ›»; pantalla «Tu día» con «Volver»; qué pasa con los filtros por categoría y «Anotar algo para hoy»). Es MAYOR: Plan v1 + v2.
- Defectos del propio mapa sin decidir: N4 (paso de perfil en el onboarding), N5 (`?ver=vacio`), N7 («30 pantallas» vs 51).
- Al cerrar todas las medidas: regenerar conteos (`collections.Counter`), `cierre_` con FICHA/SHA/DOD y aviso de teléfono libre (§8).

**Teléfono:** `RF8T318RN9T` libre (aviso en el buzón). Antes de tomarlo mañana, `avance_` de TOMO.

## 0. Orden del operador (textual, 2026-10-16)

> «necesitamos prueba empírica del device de cada pantalla que falta… con adb sí se puede grabar y lo hemos hecho para las pruebas de audio… además no tenemos que grabar nada, sólo probar las pantallas… además también estoy yo para poder hacer lo que necesitemos en el device para terminar el relevamiento completo.»
> «podemos utilizar mi usuario para lo que resta… en principio debería de estar vinculado a ARCA y poder emitir factura… podemos hacer una por 100 pesos.»

**Lectura correcta de la orden:** las entradas que quedaron como NO-VERIFICABLE no eran imposibles; se descartaron por un criterio mío demasiado conservador. Cada una se mide **llevando la app a esa pantalla y capturándola**, no ejecutando la acción de fondo. El operador está presente para tocar el teléfono cuando haga falta.

## 1. Qué ya está hecho (no repetir)

- 51 entradas del mapa clasificadas: 4 CONFORME · 26 DIFERENTE (22 A + 4 B) · 21 NO-VERIFICABLE (`scratchpad` del doc de #1288, conteo con `collections.Counter`).
- **Actualización 2026-10-16 (tarde):** `grabando` y `bloqueado` medidos en device (DIFERENTE · A, hallazgo N8) y `plan`/`limite` clasificados por CÓDIGO con la cita de DEC-8 (DIFERENTE · B): el doc del mapa queda en **4 CONFORME · 30 DIFERENTE (24 A + 6 B) · 17 NO-VERIFICABLE**. Las filas 1, 2, 20 y 21 de la sección 2 ya están resueltas; el resto de la tabla sigue vigente.
- Relevamiento previo de 45 filas: A 29 · B 9 · C 0 · D 7.
- 28 decisiones de los 14 mockups repasadas; hallazgos N1–N7.
- Las 63 capturas nuevas están versionadas en `2026-10-16-relevamiento-capturas/`.

## 2. Pendientes — las 21 entradas NO-VERIFICABLE

Clave de método: **MOTION** = `adb input motionevent` (DOWN/MOVE/UP; nunca `input tap` para gestos de RNGH, ver memoria `adb-no-puede-ejercitar-el-toque-corto-de-un-gesture-pan`). **OP** = lo hace el operador con el teléfono en la mano.

| # | Entrada | Qué se mide | Cómo | Riesgo / requisito |
|---|---|---|---|---|
| 1 | `grabando` | pantalla de grabación en curso | **✔ HECHO 2026-10-16** (DOWN sostenido sin voz en Gastos) → DIFERENTE · A; ver N8 en el doc del mapa | sólo queda, con un dedo real, el cancelar al deslizar a la izquierda (`[UNVERIFIED]`) |
| 2 | `bloqueado` | audio bloqueado por deslizamiento | **✔ HECHO 2026-10-16** (DOWN + 6 MOVE hacia arriba, descartado con el tacho) → DIFERENTE · A; ver N8 | no quedó ninguna nota de voz enviada |
| 3 | `vozchat` | lo dictado aterrizando en el chat | MOTION como #1 y soltar hasta que aparezca el texto | **escribe un mensaje en el hilo**: con el usuario del operador, no con el canónico |
| 4 | `fact-voz` | facturar por voz | ídem, entrando desde Facturación | usa datos de cliente: cliente de prueba |
| 5 | `pres-voz` | presupuesto por voz | ídem, desde Presupuestos | cliente de prueba |
| 6 | `card` | card de gasto aterrizando (aviso, botones) | escribir o dictar un gasto chico en el chat | crea un dato; borrar/cancelar después. Frase esperada del aviso: la del código (decisión 8) |
| 7 | `preg` | pregunta libre en Inteligencia | escribir una pregunta; el mapa dice que contesta dentro, la app sale al chat (decisión 2026-10-13) | consume una acción del plan |
| 8 | `hitl` | confirmación «Recordatorio a Lucía» («Confirmar y mandar» / «Cancelar») | pedir el recordatorio, capturar la card, **Cancelar** | no mandar el mail; destinatario de prueba |
| 9 | `recibo` | comprobante tras ejecutar | confirmar una acción chica de prueba | acción real: elegirla inocua |
| 10 | `fact-hitl` | confirmación previa a emitir («Revisalo y tocá Emitir la factura») | pedir una factura de **$100** a un cliente de prueba y capturar la card antes de emitir | **verificar antes el ambiente y el estado de ARCA (sección 4)** |
| 11 | `fact-cae` | comprobante con CAE | emitir la factura de $100 | irreversible: sólo con ARCA vinculado, ambiente a decidir (homologación o producción) y cliente de prueba; el operador autoriza el botón |
| 12 | `pres-hitl` | aviso y botón («Guardar el presupuesto») | crear una propuesta de presupuesto y capturar antes de guardar | igualar rótulo del botón con el mapa |
| 13 | `pres-ciclo` | anotado → aprobado → factura | recorrer el ciclo con un presupuesto de prueba | varios pasos reales |
| 14 | `bi-vacio` | Inteligencia sin ventas | usuario/tenant sin facturas | ver sección 3: no se fabrica borrando datos |
| 15 | `onb-cumplida` | primer insight con plata real | usuario nuevo con facturas cargadas | ídem; los importes del mapa son ejemplo |
| 16 | `agenda` | agenda con la línea del ahora | reconectar Google Calendar en el usuario de prueba | OP: la conexión es una autorización de Google |
| 17 | `vacio` | estado «Nada urgente por hoy.» | usuario sin tarjetas | además el deep link `?ver=vacio` del prototipo está roto (N5) |
| 18 | `vacio-visto` | ídem, variante por días | ídem | ídem |
| 19 | `entrada` | arranque en frío hasta Mi día | **build release** (el dev-client contamina el tiempo) | si el chat sube solo también en release, es defecto nuevo (se suma a R03) |
| 20 | `plan` | — | **no existe en la app**: DEC-8 (acta 21/09) lo dejó fuera de la beta → `BL-V2` | se resuelve sacándolo del mapa; no se mide |
| 21 | `limite` | — | ídem DEC-8 | ídem |

**Error mío a corregir en lo ya informado:** en una respuesta al operador conté `splash`, `volver` y `reveal` dentro de las 21. **No lo están.** Son tres entradas con veredicto por **CÓDIGO** cuya *animación* no se vio en device (ver sección 2.bis). Las 21 son exactamente las de la tabla de arriba (19 de «Falta medir» + `plan` + `limite`).

### 2.bis Veredictos por CÓDIGO que conviene confirmar en device (6 + 2)

Veredicto sin captura propia, sólo lectura de código: `splash` (DIFERENTE B), `volver` (CONFORME), `reveal` (DIFERENTE B), `ingresar-error` (CONFORME), `onb-promesa` (CONFORME), y `plan` (ya cubierto arriba). Además `afip` y `apps` son DEVICE+CÓDIGO (DIFERENTE A): el código dice qué texto hay; falta mirarlos con el estado real del usuario.
- `splash` / `volver` / `reveal`: exigen **cerrar sesión** para ver la secuencia (6,8 s). Con el usuario del operador, no con el canónico. Grabar con `adb shell screenrecord` y extraer cuadros.
- `ingresar-error`: escribir una contraseña mala a propósito en el login (no cuenta como ingreso fallido del canónico si se usa el usuario del operador).
- `onb-promesa`: es la pantalla del primer ingreso de un usuario nuevo.

## 3. Datos de usuario: lo que bloquea varias filas

Las filas 14, 15, 17, 18 (y parte de 16) dependen del **estado del tenant**: sin ventas, sin tarjetas, primer ingreso. Un tenant ya poblado no las muestra y **no se borran datos para fabricarlas**. Opciones, a decidir:
1. Un usuario nuevo descartable (alta por invitación) → cubre `bi-vacio`, `vacio`, `vacio-visto`, `onb-promesa` y `onb-cumplida` (después de cargar una factura).
2. Usar el usuario del operador para las filas con datos y uno descartable para las vacías.

El alta tiene candado: `COPILOTO_SIGNUP_ALLOWLIST` y `COPILOTO_INVITE_TOKEN` (nombres de variables en `/etc/unreal-copilot/copiloto.env`; **no se leyeron valores**).

## 4. El usuario del operador — qué se sabe y qué no

**Medido hoy (GoTrue admin API, sólo lectura):**
- `341lin@gmail.com` · `id` `2598d84b-59df-4fa4-95a6-add5f597e606` · `cliente_id` `48a9d75f-124b-4f9d-af8d-a73e2311bbbd`.
- Alta: 2026-07-05, mail confirmado. `app_metadata.providers = ['email', 'google']`: puede ingresar con **mail + contraseña** y con **Google**. Último ingreso 2026-08-13. Es admin (`copiloto_admin: true`).

**NO verificado — ARCA:** la memoria `afip-vacia-en-prod-era-una-consulta-ciega-por-force-rls` dice que el 2026-09-15 esta cuenta tenía **`afip_credentials` = 0 y `afip_perfil` = 1** (sin credencial ARCA). Es un dato de hace un mes. La consulta de relectura (con `request.jwt.claims` y el control `rolsuper/rolbypassrls`) quedó **denegada por el clasificador de permisos** la segunda vez; la primera (sólo columnas) pasó. Para emitir una factura hay que saber: ¿credencial cargada?, ¿`activo`?, ¿`ambiente` (homologación o producción)?, ¿`punto_venta`?, ¿`ws_autorizados`?
- Camino A (sin permisos especiales): ingresar en el teléfono con el usuario del operador y mirar **Ajustes → ARCA**. Necesita la contraseña o que el operador haga el ingreso con Google.
- Camino B: correr la consulta con aprobación puntual del operador, o que la corra él.

**ARCA MEDIDO (2026-10-16, tras #1299, `scripts/diag/estado-tenant-prod.sh --email 341lin@gmail.com`, sólo lectura):** `afip_credentials` = **0** filas (ni homologación ni producción), activas 0; `afip_perfil` = 1; `mp_credentials` = 1. Controles del propio script: RLS sin tenant = 0 (fail-closed), tenant resuelto con la función de la policy, adversarial «0 = las propias». **El usuario del operador NO tiene ARCA vinculado**: hay que vincularlo (por ambiente) antes de emitir. Camino A queda como confirmación en device (Ajustes → ARCA).

**Decisiones del operador (2026-10-16, textual):**
- *Ambiente de la factura de $100:* «ambos ambientes probaremos» → **homologación Y producción**. La credencial es **una por ambiente** (`afip_credential_store.py:88-95`: `dev`/`prod`, certificados distintos), así que son **dos vinculaciones** y dos facturas; el toggle entre ambientes ya vinculados es `afip_web.py:655`. El default de la superficie es homologación (`afip_web.py:99`).
- *Botón final de emitir:* «lo toco yo, pero será con mi usuario, no con uno de prueba» → emite `341lin@gmail.com`, **no** un usuario descartable. Sustituye la regla anterior de «cliente de prueba». **Producción = comprobante fiscal real** con CAE: sólo el operador toca el botón, y se registra ambiente, CUIT enmascarado y número de comprobante en el cierre.
- *Receptor de las facturas:* «consumidor final» (en los dos ambientes).

**Regla de seguridad para emitir:** no emitir nada sin haber visto el estado de ARCA (visto: 0 credenciales); el operador autoriza el botón final en cada ambiente; registrar el ambiente en el cierre.

## 5. Falta de herramienta — pedido del operador (RESUELTO el 2026-10-16 por #1296 + #1299)

> **Estado:** `scripts/diag/estado-tenant-prod.sh` (read-only, selector por email o cliente_id, sin `cert_enc`/`key_enc`/`DATABASE_URL`, CUIT enmascarado, con control RLS y adversarial) corre en real desde #1299 y contestó el §4. El texto de abajo es el planteo original.

El operador dijo: *«si en el futuro necesito chequear cosas como estas no puedo entrar a la app de un usuario… hay que resolverlo de alguna forma».* Hoy ver el estado de un tenant (ARCA vinculado, método de alta) exige un acceso directo a la base de producción que el clasificador frena. Hay que **diseñar una vía legítima de diagnóstico por tenant**, de sólo lectura, con auditoría. Candidatos a investigar (no confirmados): endpoints de admin protegidos por el claim `copiloto_admin` (§5.5 de `HANDOFF.md`), la consola (`COPILOTO_CONSOLA_DSN`), y `scripts/evidencia/contar-filas-prod.sh` (ya tiene permiso en `.claude/settings.local.json`). Es una decisión **MAYOR** (superficie nueva sobre datos de tenants): Plan v1 + v2 antes de tocar, y control adversarial (un admin no ve lo de otro por error de scoping).

## 6. Otros pendientes ligados (no son del relevamiento pero dependen de él)

- **Contrato de planificación** `2026-10-16_contrato_planificacion-a-frontend2_DECISIONES-7-y-8…` (en `coordinacion/abierto/`): **el operador ordenó dejarlo pendiente; no se tocó en ese momento — después ordenó ejecutarlo primero y quedó hecho el 2026-10-16: la 8 en #1293, la 7 con la fila E5 de la concordancia en CONFORME.** Dice: (7) «Volver» a la izquierda con «‹» en todos los call-sites del marco glass + captura a 390 px de ≥2 pantallas + fila E5 → CONFORME; (8) gana la frase del código «Esto entendí. Revisalo y tocá Guardar el gasto — todavía no lo anoté.», se actualiza el **mapa** y `CONTEXT.md`, cero cambios en `apps/mobile`, grep del literal viejo = 0 con control positivo. Se creó y no se usó nada: ningún worktree de esa tarea existe.
- **R03** sigue `[UNVERIFIED]`: necesita el experimento de +0,3 / +0,8 / +3 s.
- **N1** (montos partidos) y **N2** (indicador de refresh sobre el saldo): defectos, a la cola de trabajo.
- ~~Tercer conflicto de copy: aviso de **Mercado Pago caído**~~ — **RESUELTO 2026-10-16** (#1298: gana la frase del código). **Segundo aviso de Google Calendar: DECIDIDO (2026-10-16) — se agrega al mapa.**
- **Pregunta 4** (estructura de Mi día / tablero): **RESUELTA (operador, 2026-10-16) — gana el mapa**, el tablero es pantalla propia «Tu día». Es la corrección más grande de la lista y falta su ficha de implementación (`pedido_` a planificación).
- Defectos del propio mapa: portada dice «30 pantallas» y hay 51 (N7); `?ver=vacio` y `?ver=vacio-visto` no muestran su estado (N5).

## 7. Receta para retomar el device (el worktree anterior se borró)

1. Worktree desde `origin/main` (`git worktree add /c/gfw-src/wt-fe2-relevN -b … origin/main`), `npm`/Metro en ese worktree (Metro sirve el bundle del **checkout desde donde arranca**, ver memoria `metro-sirve-el-bundle-del-checkout-compartido-no-del-worktree`).
2. Teléfono `RF8T318RN9T` (720×1600 = 390 dp): `adb reverse tcp:8081 tcp:8081`, modo avión + «Connect» al dev-launcher (memoria `receta-avion-reverse-connect-destraba-dev-launcher`). El engranaje «Tools» es del dev-client, no de la app.
3. Gestos con `adb input motionevent`; helpers en el scratchpad de la sesión (`rel2/d.py`: `cap`, `drag`, `tap`, `sh`) — **se pierden si se borra el scratchpad**; recrear.
4. **El teléfono exige dueño único.** Avisar por el buzón antes de tomarlo y al liberarlo (`avance_`). Al terminar: matar Metro, `adb reverse --remove tcp:8081`, avión off, dejar Mi día.
5. Cerrar sesión (para `splash`/`volver`/`reveal`) **sólo con el usuario del operador**, nunca con `e2e-device@copiloto.test` (usuario canónico, lo usan otras sesiones).

## 8. Criterio de terminado del relevamiento completo

1. Las 21 entradas de la sección 2 con veredicto **CONFORME / DIFERENTE** y captura de device versionada; salvo `plan`/`limite` (se retiran del mapa) y las que una decisión del operador deje explícitamente fuera, cada una con su motivo.
2. Los 6 veredictos por CÓDIGO de la sección 2.bis confirmados o corregidos en device.
3. Doc `…mapa-de-pantallas-vs-app.md` y artefacto regenerados con los conteos nuevos (derivados con `collections.Counter`, no escritos a mano).
4. Cada fila nueva con clase A/B/C/D y, si B, cita.
5. `cierre_` en el buzón con `FICHA:` · `SHA:` · `DOD:` y aviso de teléfono libre.
6. Lo irreversible (CAE, mail real) sólo con autorización explícita del operador en ese momento.
