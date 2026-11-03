# Backlog detallado — Sprint CORRECCIONES: la app acorde al mapa de pantallas

> **Fecha:** 2026-11-02 · **Plan:** [`2026-11-02-PLAN-sprint-correcciones-mapa-vs-app.md`](2026-11-02-PLAN-sprint-correcciones-mapa-vs-app.md)
> **Coordinación:** [`2026-11-02-COORDINACION-sprint-correcciones-tres-sesiones.md`](2026-11-02-COORDINACION-sprint-correcciones-tres-sesiones.md)
> **Para quién es:** las tres sesiones. Cada ficha se toma leyendo **sólo su ficha**.
> **Fuente de los hechos:** el relevamiento mapa vs app y el de pendientes de device @`3c439cb4`,
> remedidos en device el 2026-11-02. Las decisiones D1–D10 están en el plan §1.

**Por qué las letras arrancan en `G`.** Las seis del sprint mobile (`A`–`F`) están agotadas: sus 27
fichas quedaron todas resueltas (19 TERMINADO + 6 CERRADO-POR-DECISION + 2 DIFERIDO) y sus ids siguen
siendo citados por docs y commits. Reusar una letra haría que `SM-B3` tuviera **dos** referentes, que
es exactamente el defecto que este repo midió el 2026-10-14: se prueba A y se concluye B.

**`sin-issue` es deliberado.** El campo entre backticks del título es el issue de GitHub cuando
existe; acá no se abrieron. **El id `SM-<letra><nº>` es la única referencia que circula** — y que
circule es la condición para que la ficha se marque (medido: 18 de 26 fichas del sprint anterior
jamás fueron nombradas porque las sesiones citaban ids propios).

## ⚠️ Seis de los componentes citados existen DOS veces — medido el 2026-11-02

El relevamiento se midió **en device, o sea en `apps/mobile/`**, pero cita nombres de archivo que
también existen en `apps/copiloto-web/`. Contadas las definiciones:

| Componente | en `apps/copiloto-web/src/` | en `apps/mobile/src/` | divergencia |
|---|---|---|---|
| `TarjetaFacturaPropuesta.tsx` | `modules/chat/` | `modules/chat/` | 256 vs **288** líneas |
| `MicFuncion.tsx` | `modules/voz/` | `modules/voz/` | 102 vs **240** líneas |
| `AvatarCuenta.tsx` | `shell/` | `modules/midia/` | distinta carpeta |
| `PortadaNegocio.tsx` | `modules/midia/` | `modules/midia/` | — |
| `EntradaSesion.tsx` | `auth/` | `modules/auth/` | distinta carpeta |
| `TarjetaGastoPropuesto.tsx` | `modules/chat/` | `modules/chat/` | — |

**Manda la copia de `apps/mobile/`**, que es la que se midió. **No son copias: divergieron.** Un
`find` por nombre devuelve la de web primero, así que una ficha que diga sólo
«`TarjetaFacturaPropuesta.tsx`» lleva a arreglar el archivo que nadie midió y a declarar verde un
fix que el device no recibió. Toda ficha de abajo nombra el path **completo**.

**Si una ficha afecta también a web, se dice en su DoD.** Este repo ya pagó que el fix llegara a una
sola de dos implementaciones del mismo cliente: se cuentan **definiciones**, no usos.

`BarraSostenida` **no** es un archivo: se define en `apps/mobile/src/modules/chat/PistasVoz.tsx:96`
y en `MicFuncion.tsx` sólo se **usa**.

## Cómo se lee una ficha

| campo | qué es |
|---|---|
| **Medido** | el hecho, con `path:línea` o corrida. Sin eso no es un hecho: es sospecha, y va `[SIN_VERIFICAR]` |
| **DoD** | **binario y verificable por alguien que no hizo el trabajo.** «Funciona» no es un DoD |
| **Dueño** | la sesión propuesta. No es exclusividad del archivo: eso lo fijan los candados del doc de coordinación |
| **Depende / Bloquea** | el orden forzado, con su causa escrita |

**El estado lo escribe el script, nunca una persona:**
`python -I -X utf8 scripts/sprint-estado.py --marcar SM-H1 --estado TERMINADO --cierre "…"`.
La tabla de abajo es **generada**: editarla a mano la desincroniza y el gate la rechaza.

---

<!-- TABLA-ESTADO:INICIO (generada por scripts/sprint-estado.py --tabla - NO editar a mano) -->

| Ficha | Issue | Estado | Que falta del DoD / evidencia de cierre |
|---|---|---|---|
| **SM-G1** | `sin-issue` | ✅ TERMINADO | e791cf5ec84037c66560d0704ad44b3085a74405 (#1346) 15 archivos y 62 lineas de enlaces; barrido de todos los HTML de odo… |
| **SM-G2** | `sin-issue` | ✅ TERMINADO | e791cf5ec84037c66560d0704ad44b3085a74405 (#1346) Playwright 390x844 y dentro del marco del mapa: encabezado 51 con 51… |
| **SM-G3** | `sin-issue` | ✅ TERMINADO | sha ab955aba988451dea6932cbd56b4fbd23973a84e · device RF8T318RN9T 2026-11-02: Mi cuenta muestra e2e-device@copiloto.t… |
| **SM-G4** | `sin-issue` | ✅ TERMINADO | sin-codigo: experimento de device sin cambios en la app. Veredicto: DEMORA, 4/4 corridas con los rótulos rancios a +0… |
| **SM-H1** | `sin-issue` | ✅ TERMINADO | acc58cccce18056fe005876a135874ccefc0b9fa (#1328): Editar, Cancelar y Emitir en la card; Editar dentro de la card sobr… |
| **SM-H2** | `sin-issue` | ✅ TERMINADO | 721cfb5a (#1313): update cancelar + guarda en confirmar + tool cancelar_factura. VPS suite completa 2648 passed/41 sk… |
| **SM-H3** | `sin-issue` | ✅ TERMINADO | 70e46d9f (#1318) card por tipo en backend; 6db618e4 (#1314) y acc58ccc (#1328) cancelada sin Confirmado tras recargar… |
| **SM-H4** | `sin-issue` | ✅ TERMINADO | c0219797 (#1343) + cd4041dd (#1340): descripcion de emitir_factura y observacion de faltantes; tope RG 5700/2025 ya e… |
| **SM-H5** | `sin-issue` | 🟧 DOD-PARCIAL | Solo la captura de device de pres-ciclo. El cambio de core YA NO ES PARTE: medido por frontend1 contra origin/main 4a… |
| **SM-H6** | `sin-issue` | ✅ TERMINADO | d7d0a351 (#1354). Device, factura real N° 0006-00000011: cliente y número formateado en la card, y «Mandala por mail»… |
| **SM-H7** | `sin-issue` | ✅ TERMINADO | 6db618e487b14b82e1efad1d9e99d38a24956a5d (#1314) fix con test rojo primero; acc58cccce18056fe005876a135874ccefc0b9fa … |
| **SM-I1** | `sin-issue` | ✅ TERMINADO | sha 5814cf08d0144483d5b15d9da7868c6544ef9185 · cabecera, Ahora y Para hoy con Ver tablero en Mi dia; Tu dia propia co… |
| **SM-I2** | `sin-issue` | ✅ TERMINADO | 68632d8ee88d5cb87e2ed7787f2b8e67fae55667 (#1380) dock extraido en chat/DockEntrada.tsx y voz/DockFuncion.tsx; boton g… |
| **SM-I3** | `sin-issue` | 🟧 DOD-PARCIAL | captura de device de los dos estados, reposo y deshabilitado. |
| **SM-I4** | `sin-issue` | 🟧 DOD-PARCIAL | captura de device: una sola solapa, pestana al borde inferior, Presupuestos en una linea, bloque con pocas y muchas f… |
| **SM-I5** | `sin-issue` | 🟧 DOD-PARCIAL | captura en device de la inicial del nombre comercial en Mi dia y en el escritorio, con el usuario rotulado. |
| **SM-I6** | `sin-issue` | 🟧 DOD-PARCIAL | medir en release, en el ejercicio final de SM-G4. No hay filmacion del antes: la de SM-G4 no se guardo. |
| **SM-I7** | `sin-issue` | 🟧 DOD-PARCIAL | captura de device del sheet con iconos y con el aviso de continuacion. |
| **SM-J1** | `sin-issue` | 🟧 DOD-PARCIAL | El residual es UNO y es de frontend1: las capturas de device de las 6 funciones a 390px. Todo lo demas de esta ficha … |
| **SM-J2** | `sin-issue` | ✅ TERMINADO | sin-codigo — PREMISA REFUTADA (medido 2026-11-02): los chips existen en TarjetaCliente.tsx y los dos reclamados estan… |
| **SM-J3** | `sin-issue` | 🟧 DOD-PARCIAL | captura del tenant vacio (operador: canonico unico, no se puede vaciar) |
| **SM-J4** | `sin-issue` | 🟧 DOD-PARCIAL | DoD(1) HECHO: adversarial test_adversarial_http_clientes_a_cannot_read_b (c3867d10 #1325), corrido en VPS 2026-11-02 … |
| **SM-J5** | `sin-issue` | ✅ TERMINADO | sin-codigo — PREMISA REFUTADA (medido 2026-11-02): PantallaAgenda.tsx:23-24 agrupa Hoy / Manana / Esta semana / Sin h… |
| **SM-K1** | `sin-issue` | 🟧 DOD-PARCIAL | captura de device de Homologacion oculta para no-admin (frontend2) |
| **SM-K2** | `sin-issue` | 🟧 DOD-PARCIAL | Captura de device de los dos estados del recuadro y del formulario nombrando el ambiente. DECISION: web NO recibe el … |
| **SM-K3** | `sin-issue` | 🟧 DOD-PARCIAL | requiere un tenant SIN Drive conectado: con la cuenta del operador el estado apagado NO existe (tiene Drive) · refres… |
| **SM-K4** | `sin-issue` | ✅ TERMINADO | bfa7b919 (#1376) sobre el merge previo de K4. Captura de device (RF8T318RN9T, canonico) docs/copiloto-emprendedor/202… |
| **SM-K5** | `sin-issue` | 🟧 DOD-PARCIAL | el diálogo «Sí, cerrar sesión» solo existe tocando el botón que cierra la sesión: requiere una sesión DESCARTABLE (ca… |
| **SM-K6** | `sin-issue` | 🟧 DOD-PARCIAL | SOLO la captura de device del aviso PRESENTE tras un 401 del lado cliente. Provocarlo DESCARTA la sesion de la cuenta… |
| **SM-K7** | `sin-issue` | ✅ TERMINADO | 926163a4 (#1395): hablar filas con radio, comousar círculo+chevron, feedback mes a la derecha, negocio sin título dup… |
| **SM-K8** | `sin-issue` | ✅ TERMINADO | sha c712da76f345d8b8791be174d9103a9d9c5e7d41 · fix + test + paso en el mapa (SM-C3 DoD 2-4) · captura de device 2026-… |
| **SM-K9** | `sin-issue` | 🟧 DOD-PARCIAL | Medido en codigo 2026-11-03 (5dfe93a1, #1484, ancestro de origin/main): NO es una mascara. CampoFecha son TRES TextIn… |
| **SM-L1** | `sin-issue` | 🟧 DOD-PARCIAL | Correr el build de release y medir sobre el apk. Por ORDEN DEL OPERADOR (2026-11-02) el build de release corre ULTIMO… |
| **SM-L2** | `sin-issue` | ⬜ PENDIENTE | — |
| **SM-L3** | `sin-issue` | ✅ TERMINADO | sin-ejecutar — FUERA DE ALCANCE por decision del operador (2026-11-02, textual): «las facturas no necesitamos probarl… |
| **SM-L4** | `sin-issue` | 🟧 DOD-PARCIAL | RE-MEDIDO 2026-11-03 tras el LOTE 2 de frontend2: 1447fddb (#1497, CI 6/6), ancestro de origin/main verificado por pl… |
| **SM-N1** | `sin-issue` | ✅ TERMINADO | f95f4849 (#1353): contexto_cargado en estado del FacturaWorkflow + espera acotada en la tool; causa = carrera tool vs… |
| **SM-N2** | `sin-issue` | ✅ TERMINADO | sha 1efe5a3e (#1357). Causa: la observación de la tool (R6 + «Pedí SÓLO eso») le gana a la descripción; fix = sacar l… |
| **SM-N3** | `sin-issue` | ✅ TERMINADO | sha 99097d83 (#1359). Test atado a TOOLS−WRITE_OPS con control positivo en ambas direcciones (VPS 23 passed). Barrido… |
| **SM-N4** | `sin-issue` | 🟧 DOD-PARCIAL | control del criterio v3: revertir la sombra de Row en Metro local y volcar la lista de capas con el rectangulo presen… |
| **SM-N5** | `sin-issue` | 🟧 DOD-PARCIAL | captura de device de la card recargada con importe y cliente. |
| **SM-N6** | `sin-issue` | 🟧 DOD-PARCIAL | captura de device a 390 px y comprobar en device un rotulo de prueba igual o mas largo: el ancho real del texto no se… |
| **SM-N7** | `sin-issue` | ✅ TERMINADO | 37e9e851 atadas al cableado 6/6 (test_catalogo_descripcion_afirma_escritura, 37e9e851, VPS 35 passed) |
| **SM-N8** | `sin-issue` | ✅ TERMINADO | bd7c82fc baseline 7/12 -> 0/12 con N=12; observacion sin consigna (bd7c82fc, desplegado) |
| **SM-N9** | `sin-issue` | ✅ TERMINADO | 545a5dc7 (#1371) + bfa7b919 (#1376). DoD 1-3: Ajustes lee perfilNegocio.nombreComercial, vacio/blanco/error sin etiqu… |
| **SM-N10** | `sin-issue` | ✅ TERMINADO | 21cebf5a96614d0dc4f791bb51fb0a6e47c0a44c (#1390). BarraEstado montada en app/_layout.tsx, con test. Device RF8T318RN9… |
| **SM-N11** | `sin-issue` | ✅ TERMINADO | 21cebf5a96614d0dc4f791bb51fb0a6e47c0a44c (#1390). DetalleComprobante formatea fechaEmision, total y tambien caeVto, q… |
| **SM-N13** | `sin-issue` | ✅ TERMINADO | 7811aad1 consigna fuera de las 6 observaciones restantes; test AST; sonda Mi dia N=12 6/12 -> 0/12 (desplegado) |
| **SM-N14** | `sin-issue` | ✅ TERMINADO | 21cebf5a96614d0dc4f791bb51fb0a6e47c0a44c (#1390). ResumenMes mobile y web usan formatearMesDePeriodo; assert negativo… |
| **SM-N15** | `sin-issue` | ✅ TERMINADO | 1fe1b83f usuario e2e-vacio no-admin y tenant vacio; adversarial 403 admin y 404 cross-tenant; control positivo canoni… |
| **SM-N12** | `sin-issue` | ⬜ PENDIENTE | — |
| **SM-N16** | `sin-issue` | 🟧 DOD-PARCIAL | DoD 4 corrida en device con el canonico hasta cerrar sesion; DoD 5 captura del avatar visible y par antes/despues del… |
| **SM-N17** | `sin-issue` | 🟧 DOD-PARCIAL | Captura de device que confirme que el aviso de conexion caida de Instagram ya no aparece. Se agrupa con SM-N18, que m… |
| **SM-N18** | `sin-issue` | ✅ TERMINADO | 0046ded4 filtro por toolkits_conectables (fuente unica, tests 2 mitades, VPS 2566 passed) + captura de device archiva… |
| **SM-N19** | `sin-issue` | ✅ TERMINADO | b64856dc356dc89984d5a259a8ff90a691966013 (#1401, SM-N5): la card guardada deja el id y relee importe y cliente al reh… |
| **SM-N20** | `sin-issue` | 🟧 DOD-PARCIAL | lo que hereda SM-N21 (cobro y completar_ingreso sin sonda LLM: la sonda de cobro exigiria una factura impaga real que… |
| **SM-N21** | `sin-issue` | 🟧 DOD-PARCIAL | cobro (marcar_factura_cobrada) y completar_ingreso sin sonda con LLM real (cobro exige factura impaga real; completar… |
| **SM-N22** | `sin-issue` | 🟧 DOD-PARCIAL | REFUTADO POR EL OPERADOR en device el 2026-11-03 06:40: 'en la pantalla mi dia el campo de texto todavia esta por enc… |
| **SM-N23** | `sin-issue` | 🟧 DOD-PARCIAL | DoD 1 (captura del ANTES con el panel arriba a 390px), DoD 2 (captura del DESPUES mas EL NUMERO: cuantos px de margen… |
| **SM-N24** | `sin-issue` | 🟧 DOD-PARCIAL | DoD 1/2/3: las capturas de device (chat sin camara, Gastos CON camara, Soporte intacto). Van en la pasada de device. … |
| **SM-N25** | `sin-issue` | 🟧 DOD-PARCIAL | DoD 5: la zona de ARRIBA (misma pregunta, otro borde) — sin tocar. DoD 3: la card CLARA, que exige forzar piel clara … |
| **SM-N26** | `sin-issue` | 🟧 DOD-PARCIAL | Captura de device de la cabecera SIN el indicador. Dueno: frontend1 (venia en su cola N23 -> N28 -> N26). |
| **SM-N27** | `sin-issue` | 🟧 DOD-PARCIAL | DoD 1-4, todos de DEVICE y ninguno hecho: (1) reproduccion del ANTES - se da por acreditada con el reporte del operad… |
| **SM-N28** | `sin-issue` | 🟧 DOD-PARCIAL | DoD 1/2/3: capturas de device — Mi dia SIN el avatar y sin hueco de 40px, Funciones CON el avatar funcionando (la mit… |
| **SM-N29** | `sin-issue` | 🟧 DOD-PARCIAL | DoD 1 (el reveal FILMADO entero, no capturado) y DoD 3 (EntradaDiaria en arranque frio con force-stop, filmado, vered… |
| **SM-N30** | `sin-issue` | 🟧 DOD-PARCIAL | DoD 1/2/5 de DEVICE: capturas app||mapa de las DOS entradas (?ver=splash y ?ver=volver) diciendo por que camino entro… |
| **SM-N31** | `sin-issue` | 🟧 DOD-PARCIAL | Captura de device de grabando (sostenido) y bloqueado (fijado) en Gastos con adb motionevent DOWN/MOVE, y regresion d… |
| **SM-N32** | `sin-issue` | 🟧 DOD-PARCIAL | SOLO la captura de device de las secciones, que hoy la tenencia la tiene frontend1. El tope de monotributo queda FUER… |
| **SM-N33** | `sin-issue` | ✅ TERMINADO | DoD completo. Codigo: aba185ec (#1480), ancestro de origin/main verificado con merge-base --is-ancestor; CI 6/6 y dep… |
| **SM-N34** | `sin-issue` | 🟧 DOD-PARCIAL | RE-MEDIDO 2026-11-03. El pedido_ a backend esta CONTESTADO y cerrado, y encontro un defecto REAL que nadie habia pedi… |
| **SM-N35** | `sin-issue` | 🟧 DOD-PARCIAL | DoD 5: captura de device del formulario con la categoria elegida (frontend1, tenencia del device). Y el guardado comp… |
| **SM-N36** | `sin-issue` | ✅ TERMINADO | DoD completo, punto por punto, acreditado por backend. Codigo: 4a5bb923 (#1469, ancestro de origin/main) -- escala de… |
| **SM-N37** | `sin-issue` | ✅ TERMINADO | DoD completo, los 4 puntos VERIFICADOS por planificacion contra origin/main (no por autoevaluacion de backend). Codig… |
| **SM-N38** | `sin-issue` | 🟧 DOD-PARCIAL | SIGUE DOD-PARCIAL y lo que queda NO es codigo: es la corrida con el operador mirando mas el diff de arboles. Todo lo … |
| **SM-N39** | `sin-issue` | ✅ TERMINADO | DoD completo, las dos mitades. Alcance TypeScript: bc8671a2 (#1474) retira los marcadores vencidos de afip.ts y factu… |
| **SM-N40** | `sin-issue` | 🟧 DOD-PARCIAL | Codigo COMPLETO y mergeado: 03370978 (#1486, ancestro de origin/main), CI 6/6, tsc limpio, jest theme 150/150. onKeyP… |
| **SM-N41** | `sin-issue` | ⬜ PENDIENTE | — |
| **SM-N42** | `sin-issue` | ⬜ PENDIENTE | frontend2 |

<!-- TABLA-ESTADO:FIN -->

# ORDEN DE SECUENCIA: el build de release va AL FINAL, no antes

**Orden del operador, 2026-11-02:** *«el build hay que hacerlo al final, cuando terminemos todo,
porque sino tenemos que volver a repetirlo y no tiene sentido; primero corrijamos todo y dejemos
todo implementado, y el build al final»*.

**Qué gatea.** Las dos fichas que piden medición en release **no arrancan hasta que la
implementación esté cerrada**: `SM-I6` (hoy `DOD-PARCIAL`, su `Falta:` pide *«medir en release, en
el ejercicio final de SM-G4»*) y `SM-L1` (su DoD pide el tiempo real de `entrada` medido con build
de release). Las dos son **medición**, no implementación: no hay nada que corregir después de
medirlas, y por eso van últimas.

**El fundamento, medido el 2026-11-02 por frontend2:** un build de EAS tarda **~22 min** y queda
atado al sha desde el que se compiló (el suyo salió de `fa87d95`). Cualquier ficha que cambie el
bundle **invalida la medición**, porque mediría una app que ya no es la que se va a entregar. Y hay
un segundo costo que lo hace peor: el APK de release **reemplaza el dev-client** (mismo
`applicationId`, verificado), así que instalarlo antes de tiempo le saca Metro a las sesiones que
están implementando — se pagarían 22 min de build **más** la reinstalación del dev-client, para
después tener que repetir todo igual.

**🔴 CORRECCIÓN a este mismo documento.** La sección «El eje de la pasada de device» de más abajo
dice que *«toda precondición que se pueda preparar antes —un tenant fabricado, un build de release,
un token manipulado— se prepara antes»*. **Para el build de release eso queda SUPERADO por esta
orden**, y la frase se corrige ahí mismo. El principio sigue valiendo para el resto: un tenant
fabricado o un token manipulado **no caducan** cuando el código cambia, y el build **sí**. La
distinción que faltaba no es «se puede preparar antes» sino **«¿sobrevive a que el código siga
cambiando?»** — y era justo el caso donde dos líneas correctas del mismo doc se cruzaban en un
agujero ([[dos-decisiones-correctas-que-se-cruzan-en-un-agujero]]).

**Lo que SÍ está cerrado y no se vuelve a investigar:** que el build de release **se puede producir
sin el operador** (EAS, perfil `release-medicion`, keystore remoto ya configurado, cero gates de
credenciales; local inviable por falta de Android SDK/Java). Ese hallazgo **no caduca** y es lo que
saca a `SM-I6`/`SM-L1` de la pila «esperando al operador». El entregable durable es el **perfil
versionado en `eas.json`**; el APK es desechable y se rehace desde el sha que haga falta.

**El disparador para producirlo**, explícito para que no quede como espera indefinida: **toda la
implementación del sprint mergeada en `main`**. Recién ahí se compila, se instala, se mide
`SM-I6` + `SM-L1` en la misma pasada de device, y se repone el dev-client con el build
`development` de EAS.

# Dos ordenes del operador del 2026-11-03: la tenencia queda AUTORIZADA y el audio DESCARTADO

## 1. ✅ Tenencia de prueba AUTORIZADA — se cae el disparador que frenaba 9 fichas

> *«autorizo la tenencia de prueba»*

El segundo tenant (**vacío y no-admin**) deja de estar limitado a `SM-K1`/`SM-J3` y vale para toda
ficha que necesite un segundo emprendedor. **El provisioning ya existía y no se diseñó de nuevo**
(CANON 3): `scripts/provision_usuario_vacio_sm_n15.py` — idempotente, alta por `/auth/signup`,
credencial a `.env.e2e` (gitignored; el repo es **PÚBLICO**), y **tres controles adversariales
propios**: no-admin con 403 **y control de 401 sin token** (distingue «guard presente» de «ruta
inexistente»), tenant vacío **con control positivo contra el canónico** (si los dos dieran 0, el
instrumento mira mal, no el tenant) y cross-tenant denegado. Corre **en el VPS**.

⚠️ **Lo que la orden NO autoriza:** el canónico sigue siendo `e2e-device@copiloto.test`. Autorizar un
**segundo** tenant no es **mudar** el primero, y las dos cosas se dicen con la misma palabra
(«usuario de prueba»): leer esta línea como «ya se puede elegir usuario» es el error que la memoria
`usuario-de-prueba-canonico-uno-solo-a-fuego` previene.

**Las 9 fichas, MEDIDAS contra el `Falta:` de cada una (no citadas de memoria):**
`SM-J3` · `SM-J4` · `SM-K1` · `SM-K3` · `SM-K5` · `SM-K6` · `SM-N16` · `SM-N25` · `SM-N30`.
🔬 **Y el barrido que las contó falló dos veces antes de dar esa lista, que es el dato útil:** la
primera pasada dio **6** porque el patrón buscaba «canónic**a**» en femenino y el doc escribe
«canónic**o**» para el usuario — `SM-J3`, `SM-K5` y `SM-K1` quedaron mudas. La segunda dio **11**
porque `del operador` matcheaba «ORDEN DEL OPERADOR» (`SM-L1`) y «reporte del operador» (`SM-N27`),
que no son tenencia. **Ni 6 ni 11: nueve.** Un conteo por grep sobre prosa libre necesita leer los
dos lados — los que caza y los que descarta ([[el-control-positivo-cubre-la-mitad-que-sospechas-y-la-otra-queda-muda]]).

**Precondición única, y tiene dueño:** que el provisioning corra en el VPS y publique la credencial.
Hasta ese `cierre_`, las 9 siguen bloqueadas por un disparador **nombrado y tomado**, no por una
decisión pendiente.

## 2. 🔴 El audio de pronunciación: DESCARTADO

> *«no necesitamos la voz de odobi… no nos interesa el audio… no sé de dónde sacaste que había que
> implementar eso»*

**Era alcance que planificación inventó**, y la causa importa más que el punto: salió de **leer el
prototipo como si fuera una especificación**. `#reveal` dibuja «se dice o-DO-bi»
(`prototipo/index.html:2555`) y `RevealEntrada.tsx` tiene un `pronunciacionAsset` opcional; de ahí
subí el botón a DoD y lo convertí en **pregunta abierta al operador**. Un elemento que existe en un
mockup **no es alcance contratado**: «la app debe igualar al mapa» ordena corregir lo que
**divergió**, no implementar todo lo que el mockup dibuja. El costo fue doble — pedir trabajo que
nadie quería **y** dejar la ficha esperando una decisión que no existía.

**Queda:** el **texto** «se dice o-DO-bi» no está en discusión (`textosEntrada.ts:21`, sin asset).
**Sale:** el altavoz, del DoD y **del mapa** — única excepción a la decisión A, autorizada por la
misma orden.

# El eje de la pasada de device NO es la cuenta — es el ESTADO que la tenencia puede producir

**Agrupé mal, y la corrección costó una pasada de teléfono.** El bloque 2 se llamó «cuenta
canónica» y se dejó esperando **una** decisión del operador (cerrar su sesión). Medido el
2026-11-02 con el teléfono en mano y la cuenta del operador puesta, tres fichas del bloque 1
**no se pudieron acreditar aunque la tenencia era la correcta**:

| Ficha | Qué pasó en device | Por qué |
|---|---|---|
| `SM-K3` | el toggle de Drive salió **activo** | el operador **tiene** Drive conectado |
| `SM-K5` | el diálogo «Sí, cerrar sesión» no se pudo ver | sólo aparece **cerrando la sesión** del operador |
| `SM-J3` | el tenant vacío no se pudo mirar | su cuenta **tiene datos** |

**Ninguna de las tres faltaba «por device».** Tener el teléfono no las cerraba: con esa cuenta
puesta, **el estado que miden no existe**. Y `SM-K6` cayó en la misma clase por un camino distinto
— provocar el 401 **descarta la sesión de la cuenta que lo provoca**, así que la tenencia no puede
producir el estado sin perderse a sí misma.

**La regla, para no volver a agrupar por el eje equivocado:** antes de poner una ficha en una pasada,
preguntar **¿la tenencia con la que se va a correr puede PRODUCIR el estado que la ficha mide?** — no
¿alcanza la cuenta?. Y el `Falta:` tiene que nombrar **la tenencia, no el device**: si dice «falta la
captura del toggle apagado», el próximo con el teléfono lo intenta otra vez con la misma cuenta y le
vuelve a salir activo. Tiene que decir *«requiere un tenant SIN Drive conectado»*.

**Los tres caminos reales, que la pila «esperando al operador» escondía:**

1. **Estado forzable desde el cliente** — no necesita la cuenta del operador ni su decisión; alcanza
   el usuario canónico y manipular el estado por Metro (`SM-K6`: corromper el token, sin commitear).
2. **Estado que exige un tenant fabricado** — ninguna cuenta real lo produce: hay que crear la
   condición (`SM-J3` tenant vacío, `SM-K3` tenant sin Drive). **Esto no es una decisión del
   operador: es trabajo de preparación** y se puede hacer antes de pedirle la ventana.
3. **Estado que exige al operador de verdad** — su teclado, su voz, su arranque en frío, o aceptar
   perder su sesión (bloque L, `SM-K5`). **Esta es la única pila que realmente lo espera**, y es la
   que hay que mantener corta.

**Lo que esto cambia en la práctica:** la ventana del operador es el recurso más escaso del sprint y
estaba reservada para fichas que no la necesitaban. Toda precondición **que no caduque** y se pueda
preparar antes —un tenant fabricado, un token manipulado— **se prepara antes**, porque una ventana
gastada esperando una precondición es una ventana perdida.

⚠️ **Hasta el 2026-11-02 esta línea incluía «un build de release» en esa lista, y era un error de
clasificación.** Un build **caduca**: queda atado al sha del que salió, así que cualquier ficha que
cambie el bundle lo invalida. La pregunta correcta no es «¿se puede preparar antes?» sino
**«¿sobrevive a que el código siga cambiando?»**. El build va **al final** por orden del operador
(ver la sección «ORDEN DE SECUENCIA» arriba); el tenant fabricado y el token siguen yendo antes.

# Enmiendas FUNDADAS al mapa — el « salvo lo que definimos », escrito

**La cadena del sprint es `relevamiento → artefacto (el mapa) → plan`**, y está citada arriba
(`Fuente de los hechos`, @`3c439cb4`). El criterio del operador, 2026-11-02: *«lo más importante de
este sprint es dejar la app móvil tal cual definimos y como está en el mapa — debemos respetar los
diseños salvo en los casos que definimos otras cosas»*.

**Esta sección existe porque la segunda mitad de esa frase no estaba escrita en ninguna parte
versionada.** Las enmiendas decididas vivían en docs sueltos y en contratos de `coordinacion/`, que
**no se versiona** y no sobrevive a un clon. Consecuencia medida: tres veces en un día una sesión
comparó la app con el mapa y reportó como **defecto** algo decidido a propósito. Un gate no puede
distinguir una cosa de la otra si la decisión no tiene dónde leerse.

**Regla de uso, antes de implementar o de abrir un hallazgo:** `grep "ENMIENDA FUNDADA"` en este doc.
Una divergencia que figura acá **no es un defecto** y no abre ficha. Una que no figura, sí — y si
alguien la cree decidida, primero la trae acá con su fundamento.

**Qué hace FUNDADA a una enmienda**, y no es el tamaño: (1) nombra la divergencia concreta contra el
mapa; (2) da el `path:línea` del código o del mapa que la sostiene; (3) dice **por qué** gana la app
— capacidad real que se perdería, dato que el usuario viene a buscar, o una decisión previa (acta,
`DEC-*`) que el mapa no alcanzó a reflejar. Sin las tres, es una divergencia sin decidir.

| # | Enmienda | Fundamento | `path:línea` |
|---|---|---|---|
| E-1 | **BUSCAR en Gastos se queda**, el mapa no lo dibuja | buscar sobre el histórico es función real y ya implementada; retirarla es perder capacidad | `apps/mobile/src/modules/gastos/PantallaGastos.tsx:290` (`BuscadorActividad funcion="gastos"`) |
| E-2 | **«Te deben» en Facturación se queda**, el mapa no la dibuja | es el dato que el emprendedor viene a mirar, con antigüedad de impagas | `apps/mobile/src/modules/facturacion/SeccionMeDeben.tsx:39` |
| E-3 | **El chip «N facturas · N impaga» NO se agrega** | la portada no trae conteos; derivarlos del listado paginado da un número que depende de cuántas páginas se bajaron → **dos verdades para una pregunta** | `apps/mobile/src/modules/facturacion/ResumenFacturado.tsx:12-14` |
| E-4 | **Facturación e Inteligencia NO llevan dock de voz** | el contexto de transcripción es un tipo cerrado de cuatro valores y ninguna de las dos está en él; agregarlas no es estilo, es ampliar el contrato | `packages/core/src/api/transcribir.ts:7` |
| E-5 | **Web conserva `MicFuncion`; mobile pasó a `DockFuncion`** (`SM-I2`) | la paridad web↔mobile queda declarada como excepción **con fecha**, hasta que el dock llegue a web — no es drift sin dueño | `scripts/ci/testid-paridad-excepciones.json` (2026-11-02) |
| E-6 | **El escritorio no da acceso a Ajustes** y las dos divergencias del mapa de `SM-K7` quedan como están | ver el contrato de `SM-K7`: el mapa pide una entrada que la navegación real no tiene | ficha `SM-K7` |

**Lo que esta sección NO hace:** no absuelve una divergencia por el hecho de estar escrita acá — cada
fila es revisable por el operador, que es quien decide lo MAYOR. Lo que garantiza es que la decisión
exista **en un lugar que un clon trae**, en vez de en la memoria de la sesión que la tomó.

# Bloque G · Preparación (wave 0)

### SM-G1 · `sin-issue` — Los arreglos de enlaces del mapa viven sólo en el checkout compartido

- **Estado:** TERMINADO
- **Cierre:** e791cf5ec84037c66560d0704ad44b3085a74405 (#1346) 15 archivos y 62 lineas de enlaces; barrido de todos los HTML de odobi-ui: 173 enlaces, 0 a carpeta, 6 no resuelven y son marcadores __IMG_*__ de plantilla. Evidencia en 2026-11-02-sprint-correcciones-evidencia/SM-G1-SM-G2.md
- **Dueño:** frontend1
- **Medido:** 16 archivos con cambios sin commitear en el checkout compartido, 15 de ellos
  `Prototipo frontend/odobi-ui/**` (`mapa-pantallas/index.html`, `prototipo/mapa.html` y 13 mockups).
  Ese checkout está **30 commits atrás** de `origin/main` con 0 commits propios.
- **DoD:** los arreglos de enlaces **reaplicados sobre `origin/main`** y mergeados. No se copian los
  archivos del checkout atrasado: `git diff --numstat` contra `origin/main` por archivo, y se
  reaplica sólo lo que suma. **Causa:** copiar un archivo 30 commits viejo revierte fixes ajenos de
  forma muda, y el signo del diff está mezclado en los dos sentidos.
- **Bloquea:** SM-G2. **Causa:** corregir el contenido del mapa sobre una base que después se
  sobreescribe pierde el trabajo.

### SM-G2 · `sin-issue` — El mapa se contradice a sí mismo en cuatro puntos

- **Estado:** TERMINADO
- **Cierre:** e791cf5ec84037c66560d0704ad44b3085a74405 (#1346) Playwright 390x844 y dentro del marco del mapa: encabezado 51 con 51 marcos, ?ver=vacio con explicacion y ?ver=vacio-visto sin ella, ambos dentro de la vista; 0 filas detalle; 0 Crear una nueva cuenta. Evidencia y capturas en 2026-11-02-sprint-correcciones-evidencia/SM-G1-SM-G2.md
- **Dueño:** frontend1
- **Medido:** N7 — la portada dice «30 pantallas» y la grilla lista **51** (5+3+29+6+8). N5 — los
  deep links `?ver=vacio` y `?ver=vacio-visto` se ven iguales que la base, así que el estado vacío
  de Mi día no se puede mirar. El sheet de `detalle` quedó derogado por el mockup 14. «Crear una
  nueva cuenta» figura en `splash`, `reveal` y `volver` y la app no tiene alta propia (decisión #3).
- **DoD:** encabezado del mapa en 51; los dos deep links muestran su estado (captura de cada uno);
  sheet de `detalle` retirado; «Crear una nueva cuenta» fuera de las tres entradas. Las fichas
  `plan` y `limite` marcadas VISIÓN post-beta citando DEC-8 (acta 2026-09-21), y el paso de perfil
  del onboarding agregado (N4).
- **Depende:** SM-G1.

### SM-G3 · `sin-issue` — El teléfono quedó logueado con el usuario descartable del relevamiento

- **Estado:** TERMINADO
- **Cierre:** sha ab955aba988451dea6932cbd56b4fbd23973a84e · device RF8T318RN9T 2026-11-02: Mi cuenta muestra e2e-device@copiloto.test; descartable borrado (GoTrue 200, tenants 0); evidencia docs/copiloto-emprendedor/2026-11-02-sprint-correcciones-evidencia/SM-G3.md
- **Dueño:** frontend2
- **Medido:** `avance_` de frontend2 del 2026-11-02: «TELÉFONO LIBRE RF8T318RN9T queda logueado como
  el descartable».
- **DoD:** el usuario descartable borrado de la base y el device logueado con el canónico
  `e2e-device@copiloto.test`. Captura de la pantalla de cuenta mostrando el usuario canónico.
  **Causa:** el canónico es único «a fuego» (orden del operador); un descartable vivo fabrica
  evidencia atribuible al usuario equivocado.
- **Bloquea:** toda ficha con evidencia de device.

### SM-G4 · `sin-issue` — R03: no se sabe si el retardo al soltar es demora o defecto

- **Estado:** TERMINADO
- **Cierre:** sin-codigo: experimento de device sin cambios en la app. Veredicto: DEMORA, 4/4 corridas con los rótulos rancios a +0,3 y +0,8 s y correctos a +3 s. Corrió en dev-client: el ejercicio en release sigue pendiente por decisión del 2026-10-16. Evidencia: docs/copiloto-emprendedor/2026-11-02-sprint-correcciones-evidencia/SM-G4.md
- **Dueño:** frontend1
- **Medido:** `cierre_` de frontend1 del 2026-10-16 dejó el experimento sin correr.
- **DoD:** capturas a **+0,3 s, +0,8 s y +3 s** de soltar, las tres adjuntas, y el veredicto escrito:
  demora o defecto. **Se corrige igual en los dos casos** (criterio del plan §1), así que el
  experimento decide el *arreglo*, no el *si*.
- **Bloquea:** SM-I6.

---

# Bloque H · Confirmaciones (wave 1)

Va primero porque **hoy una factura «cancelada» por chat sigue emitible en Producción**. Antes de
tocar el workflow: skills `temporal-developer` y `temporal-ai-patterns` (regla 3 del `CLAUDE.md`).

### SM-H1 · `sin-issue` — La card de factura propuesta sólo ofrece «Emitir»

- **Estado:** TERMINADO
- **Cierre:** acc58cccce18056fe005876a135874ccefc0b9fa (#1328): Editar, Cancelar y Emitir en la card; Editar dentro de la card sobre el mismo workflow; emite solo por confirmarConTokenFresco; ADR-007 ACCEPTED. Device RF8T318RN9T 2026-11-02, ambiente dev, sin emitir: cantidad 1 a 2, total 100000, vuelve a la card; force-stop conserva; cancelada en vivo y tras recargar. mobile 1438, core 870, CI 6/6. Web no entra: manda mobile. Evidencia en 2026-11-02-sprint-correcciones-evidencia/SM-H1-SM-H7.md
- **Dueño:** frontend1 (card) con el contrato de backend
- **Medido:** `apps/mobile/src/modules/chat/TarjetaFacturaPropuesta.tsx` (288 líneas) dibuja un
  único botón «Emitir la factura»; no hay forma de editar un dato ni de cancelar desde la card.
  **Ojo:** existe una gemela divergida en `apps/copiloto-web/src/modules/chat/` (256 líneas) que el
  relevamiento **no** midió.
- **DoD:** los tres botones **Editar · Cancelar · Emitir la factura** (D7). Editar cubre **todos**
  los datos dentro de la card, sobre el **mismo** workflow, y emite sólo por
  `confirmarConTokenFresco`. El docstring de la card, que afirma lo contrario, queda revertido y eso
  **lleva ADR**. Evidencia: device, Editar → cambiar un dato → volver a la card, en **Homologación y
  sin emitir real**.
- **Depende:** SM-H2 (la señal de cancelar), SM-H7 (el estado que la card lee).

### SM-H2 · `sin-issue` — No existe herramienta de cancelar: el agente no puede cumplir lo que promete

- **Estado:** TERMINADO
- **Cierre:** 721cfb5a (#1313): update cancelar + guarda en confirmar + tool cancelar_factura. VPS suite completa 2648 passed/41 skipped; test_cancelar_factura_adversarial.py (10) + test_adversarial_http_cancelar_a_cannot_cancel_b_propuesta; deploy.sh OK con durabilidad VERDE
- **Dueño:** backend
- **Medido:** la señal `cancelar` **ya existe** (`afip_factura_workflow.py:224`, `afip_web.py:353`),
  pero `tool_catalog.py` **no tiene** herramienta de cancelar. O sea: el agente dice que canceló y
  el workflow sigue emitible.
- **DoD:** herramienta del agente + endpoint del botón, las dos sobre la señal existente (no se
  escribe una segunda). **Test adversarial:** cancelar por botón y por chat, luego `confirmar` →
  **denegado**; un toque repetido o un remount **no emiten**. **Test adversarial de tenant:** A no
  cancela ni edita la propuesta de B. Sin los dos tests el control queda `[UNVERIFIED]` y bloquea el
  cierre (regla dura del `CLAUDE.md` global).
- **Bloquea:** SM-H1, SM-H3.

### SM-H3 · `sin-issue` — «Mandale un recordatorio por mail» produce una card de Calendar

- **Estado:** TERMINADO
- **Cierre:** 70e46d9f (#1318) card por tipo en backend; 6db618e4 (#1314) y acc58ccc (#1328) cancelada sin Confirmado tras recargar, medida en device. Device 2026-11-02: el pedido natural elige correo, responde 'No tengo habilitado el servicio de correo' y abre 'Conecta Gmail': la eleccion de herramienta queda acreditada. Device 2026-11-02 19:42 con cuenta del operador: card de Gmail con la aclaracion de que sale al confirmar; cancelada dice No lo hicimos, tambien tras recargar y tras force-stop. No salio ningun mail. Evidencia: 2026-11-02-sprint-correcciones-evidencia/SM-H3.md.
- **Dueño:** backend (dispatcher) + frontend1 (card)
- **Medido:** el pedido de mail devuelve una card de **Calendar**, no la de Gmail «Confirmar y
  mandar / Cancelar». Y una card de Calendar **cancelada** pasa a «✓ Confirmado».
- **DoD:** el pedido de mail produce la card de **Gmail**, que aclara que el mail **sale al
  confirmar** (D8 — no se construye envío programado). Una card cancelada no puede mostrar
  «Confirmado» en ningún recorrido, incluido recargar.
- **Depende:** SM-H2, SM-H7.

- **✅ DISPARADOR CUMPLIDO 2026-11-02 19:04 — Gmail ESTÁ conectado.** El operador se logueó
  manualmente con su cuenta en el device y la pantalla «Apps conectadas» dice **«5 conectadas
  de 5»** con **Gmail · Conectada** (captura:
  `2026-11-02-sprint-correcciones-evidencia/SM-H3-gmail-conectada-cuenta-operador.png`).
  Esto **retira el bloqueo**, no cierra la ficha: lo que sigue faltando es la captura de la
  card de Gmail con la aclaración de que el mail sale al confirmar. El `Cierre:` actual cita
  que el canónico respondía «No tengo habilitado el servicio de correo» — eso era del
  **canónico**, y acreditaba la elección de herramienta, no la ausencia de Gmail en general.
- ⚠️ **Al capturar: la sesión del device es la del OPERADOR, no la del canónico.** Decir de
  qué usuario es cada captura es parte de la evidencia; una card obtenida bajo su cuenta
  acredita el comportamiento del dispatcher, no el estado del canónico.

### SM-H4 · `sin-issue` — Con «consumidor final» explícito el agente sigue pidiendo CUIT

- **Estado:** TERMINADO
- **Cierre:** c0219797 (#1343) + cd4041dd (#1340): descripcion de emitir_factura y observacion de faltantes; tope RG 5700/2025 ya en afip_rules.py:165 con R5; VPS 79 passed; sonda en prod con el canonico 12 dictados: 0/12 piden CUIT/DNI/nombre (antes 5/8 preguntaban nombre o documento)
- **Dueño:** backend
- **Medido:** criterio táctico del plan §1.
- **DoD:** dicho explícitamente «consumidor final», el agente **no** pide CUIT. **Precondición
  escrita en la ficha:** antes de implementar hay que verificar el **tope de ARCA para vender sin
  identificar** y citarlo; si el tope lo impide, la ficha cierra por decisión con esa cita. **Causa:**
  codificar la excepción sin el tope es codificar la esperanza sobre una norma fiscal.

### SM-H5 · `sin-issue` — Las cards de presupuesto desmienten al mapa en rótulo, importe y estado

- **Estado:** DOD-PARCIAL
- **Falta:** Solo la captura de device de pres-ciclo. El cambio de core YA NO ES PARTE: medido por frontend1 contra origin/main 4a5bb923, packages/core/src/chat/sugerenciaArmarFactura.ts:18 ya es TEXTO_SUGERENCIA_ARMAR_FACTURA='Arma la factura', identico al mapa (Prototipo frontend/odobi-ui/prototipo/index.html:3374, entrada pres-ciclo) y al backend (presupuesto_sugerencias.py:21). El importe y Pendiente cerraron con #1354. ESTE Falta estuvo DESACTUALIZADO DOS VECES: primero daba por pendientes dos mitades de backend ya desplegadas en #1363, y despues pedia un cambio de core ya hecho. Un Falta vencido no da sintoma: se lee como trabajo y se vuelve a despachar.
- **Dueño:** frontend1
- **Medido:** `pres-hitl` y `pres-ciclo`: rótulo del botón y del chip distintos del mapa, importe
  `$50,000.00` en vez de `$50.000`, y falta «Pendiente» en la card «anotado».
- **DoD:** rótulos del mapa, importe `$50.000` y «Pendiente» visible. La card **sigue siendo
  formulario editable** y el **mapa** se corrige (D5). Captura de device de las dos entradas.

### SM-H6 · `sin-issue` — «Factura emitida.» no dice de quién ni con qué número

- **Estado:** TERMINADO
- **Cierre:** d7d0a351 (#1354). Device, factura real N° 0006-00000011: cliente y número formateado en la card, y «Mandala por mail» abre Gmail con asunto y link. Evidencia: docs/copiloto-emprendedor/2026-11-02-sprint-correcciones-evidencia/SM-H5-SM-H6.md
- **Dueño:** frontend1
- **Medido:** `fact-cae` omite cliente y muestra el número sin formatear; Drive/Compartir sin
  opción de mail.
- **DoD:** cliente y número formateado en la card, más la opción de mail. Captura de device.

### SM-H7 · `sin-issue` — Una card cancelada vuelve a leerse como «Confirmado» al recargar

- **Estado:** TERMINADO
- **Cierre:** 6db618e487b14b82e1efad1d9e99d38a24956a5d (#1314) fix con test rojo primero; acc58cccce18056fe005876a135874ccefc0b9fa (#1328) capturas. Device RF8T318RN9T 2026-11-02: pedido natural de Calendar, Cancelar, 'No lo hicimos' en vivo y tras force-stop, sin Confirmado, ningun evento creado. Evidencia en 2026-11-02-sprint-correcciones-evidencia/SM-H7-1, SM-H7-2 y SM-H7-3
- **Dueño:** frontend1
- **Medido:** **causa candidata, leída y no corrida:** `sanitizarHitlRespondido` guarda como `value`
  el **texto** «Cancelar» (`packages/core/src/chat/hitl.ts`) y `ListaMensajes.tsx:213` lo compara
  con `cancelValue`. No coinciden, así que al recargar muestra «Confirmado».
- **DoD:** **primero** un test que falle por la causa real (si el test no se pone rojo con el código
  actual, la causa candidata era falsa y la ficha vuelve a medición); después el fix y el test verde.
  La comparación no puede quedar atada al texto visible del botón. **Causa de pedir el rojo primero:**
  un test que afirma el síntoma vuelve inmortal al defecto; este repo lo pagó con un verde *por* el
  bug durante 5 días.
- **Bloquea:** SM-H1, SM-H3.

---

# Bloque I · Cáscara (wave 2)

Skills **antes** de escribir: `swmansion-react-native-best-practices`, `swmansion-rn-gestures`,
`swmansion-rn-animations`. Y consultar el archivo equivalente de **documed-front** primero (§3.ter).

### SM-I1 · `sin-issue` — Mi día embute el tablero en vez de abrirlo como pantalla

- **Estado:** TERMINADO
- **Cierre:** sha 5814cf08d0144483d5b15d9da7868c6544ef9185 · cabecera, Ahora y Para hoy con Ver tablero en Mi dia; Tu dia propia con Volver, filtros y alta · N1 ya estaba hecho (PortadaNegocio.test.tsx:52) · testID y anclas revisados (test-en-el-shell.sh OK, CI 6/6) · capturas de device 2026-11-02 en 2026-11-02-sprint-correcciones-evidencia/SM-I1.md, que declara lo no ejercido
- **Dueño:** frontend1 — **candado exclusivo de `PantallaMiDia.tsx` (1067 líneas)**
- **Medido:** la app dibuja «Odobi» suelto, el chip de fecha y **el tablero embebido** (pestañas,
  filtros, «Anotar algo para hoy»); no tiene tarjeta de cabecera, lista «Ahora» ni «Ver tablero ›».
  Además los tres cuadros parten el monto en dos líneas (`$101.234,` / `00`): N1.
- **DoD:** Mi día con tarjeta de cabecera, lista «Ahora» y «Para hoy · Ver tablero ›»; pantalla
  **«Tu día»** propia con «Volver», que **conserva** los filtros por categoría y «Anotar algo para
  hoy» (D3). Montos en **una** línea (`numberOfLines={1}` con `adjustsFontSizeToFit` en
  `apps/mobile/src/modules/midia/PortadaNegocio.tsx`, o sin centavos en los cuadros chicos). Los `testID` `midia-*` y los E2E que
  dependan de la estructura actual, revisados y pasando. Captura de device de las dos pantallas.
- ⚠️ **PREMISA PARCIALMENTE REFUTADA (medido 2026-11-02 contra `origin/main`, lo vio frontend1 al
  implementar):** el punto **N1 ya está hecho** — `PortadaNegocio.tsx:60` documenta «Una sola línea
  SIEMPRE (N1, relevamiento 2026-10-16)» y `PortadaNegocio.test.tsx:52` lo acredita con un test
  propio. Entró por #1297 (`51cb7bca`, 2026-10-16), **el mismo día del relevamiento que lo reclama**.
  **Lo que SIGUE en pie:** la tarjeta de cabecera, la lista «Ahora», «Para hoy · Ver tablero ›» y la
  pantalla «Tu día» propia con «Volver» (D3). La ficha queda `PENDIENTE` por eso, **menos** el punto
  de los montos: no se vuelve a tocar `PortadaNegocio.tsx` para eso.
- **Bloquea:** SM-I2 (comparten el pie de Mi día).

### SM-I2 · `sin-issue` — El dock «campo + mic chico» no existe: cada pantalla improvisa el suyo

- **Estado:** TERMINADO
- **Cierre:** 68632d8ee88d5cb87e2ed7787f2b8e67fae55667 (#1380) dock extraido en chat/DockEntrada.tsx y voz/DockFuncion.tsx; boton grande fuera tambien en Soporte; pildora de alta queda; barra a ancho completo. Device canonico 2026-11-02 en Mi dia, chat, Gastos y Soporte: docs/copiloto-emprendedor/2026-11-02-sprint-correcciones-evidencia/SM-I2.md. Cancelar deslizando ejercido con adb, no con dedo real (punto de SM-L2).
- **Dueño:** frontend1
- **Medido:** no hay componente de dock compartido. `apps/mobile/src/modules/chat/ChatView.tsx` y
  `apps/mobile/src/modules/soporte/PantallaSoporte.tsx` ya reemplazan el campo al grabar;
  `apps/mobile/src/modules/voz/MicFuncion.tsx:145` (240 lineas; la gemela de web tiene 102 y **no**
  se midio) dibuja `BarraSostenida` -- definida en
  `apps/mobile/src/modules/chat/PistasVoz.tsx:96`, no es un archivo propio -- **dentro** de la
  columna angosta de `filaConMic` (`apps/mobile/src/modules/gastos/PantallaGastos.tsx:262`), que es lo que aplasta «Anotar un
  gasto» hasta partirlo por sílabas y hace chocar el reloj con el chevron (N8).
- **DoD:** **un** componente de dock (campo + mic chico al pie), extraído de lo que ya hacen
  `ChatView` y `PantallaSoporte` de **mobile** — no escrito de cero. Sale el botón de voz grande, **también en
  Soporte** (D2); queda la píldora de alta manual del mockup 12. La función de grabar, fijar y
  cancelar de N8 se **reubica**, no se reescribe: la barra reemplaza al campo a ancho completo.
  Evidencia de device en Mi día, chat y Gastos. **El cancelar deslizando queda `[UNVERIFIED]`
  explícito** hasta SM-L2: `adb` no lo reprodujo en dos corridas y no se sabe si es límite del
  instrumento o defecto.
- ⚠️ **PREMISA PARCIALMENTE REFUTADA (medido 2026-11-02 contra `origin/main`, lo vio frontend1 al
  implementar):** el punto **N8 ya está hecho** — la barra de grabación **toma el lugar del botón de
  alta** (`PantallaGastos.tsx:262`), y es la **fila entera** del dictado la que se transforma, no el
  botón (`MicFuncion.tsx:63`, con test en `MicFuncion.test.tsx:235`). También de #1297 (`51cb7bca`).
  **Lo que SIGUE en pie, y es el motivo de la ficha:** el **dock compartido** no existe. Y seguí
  leyendo el DoD como está: se **extrae** el `Composer` que ya usan `ChatView`, `FotoFuncion` y
  `PantallaSoporte` — no se escribe un dock de cero.
- **Depende:** SM-I1. **Bloquea:** SM-J1 (las 6 funciones heredan este dock).

### SM-I3 · `sin-issue` — Los botones del chat no se leen y el deshabilitado no se distingue

- **Estado:** DOD-PARCIAL
- **Falta:** captura de device de los dos estados, reposo y deshabilitado.
- **Cierre:** b64856dc356dc89984d5a259a8ff90a691966013 (#1401). Sin opacity en mic, enviar y foto; tonoBotonEntrada.test.ts mide >=3:1 en las dos pieles y activo distinto de apagado (antes: 1,07:1 el mic deshabilitado en claro). mobile.sh 1530 verdes en el worktree y 6/6 jobs en CI (#1401).
- **Dueño:** frontend1
- **Medido:** contraste insuficiente en reposo; el estado deshabilitado no se diferencia del activo.
- **DoD:** contraste legible en reposo y deshabilitado distinguible, medidos contra el criterio de
  contraste del design system. Captura de los dos estados.

### SM-I4 · `sin-issue` — El escritorio difiere del mapa en título, orden, tiles y solapas

- **Estado:** DOD-PARCIAL
- **Falta:** captura de device: una sola solapa, pestana al borde inferior, Presupuestos en una linea, bloque con pocas y muchas filas, tema oscuro y sin parpadeo al primer layout.
- **Cierre:** b64856dc356dc89984d5a259a8ff90a691966013 (#1401). Titulo, orden, casillas y bloque del mapa; la tira se va con el escritorio (translacionPanel, 5 casos) y el BACK cierra primero el escritorio. Motivo de #1084 citado en el PR. mobile.sh 1530 verdes en el worktree y 6/6 jobs en CI (#1401).
- **Dueño:** frontend1
- **Medido:** `esc` difiere en título, avatar y orden de la primera fila y en el estilo de los tiles;
  con el escritorio abierto se ven **dos** solapas apiladas (R02); «Presupuestos» se parte.
- **DoD:** título, orden y estilo de tiles del mapa; ícono de Ajustes en Funciones; **una sola
  solapa** — la tira del chat se oculta (D1), y **antes de tocarla hay que leer por qué el PR #1084
  la dejó a propósito y citarlo en el PR**. Colores de tiles y cards; «Presupuestos» en una línea.
  Captura de device.

### SM-I5 · `sin-issue` — El avatar no dibuja la inicial

- **Estado:** DOD-PARCIAL
- **Falta:** captura en device de la inicial del nombre comercial en Mi dia y en el escritorio, con el usuario rotulado.
- **Cierre:** dd16179b18e7fa4aaf58a3d2e36d62f8200511f4 (#1404). Inicial del nombre comercial con caida al mail y glifo de cuenta si no hay ninguno; useInicialCuenta.test.tsx con dos adversariales entre tenants. mobile.sh 1543 verdes en el worktree y CI 6/6.
- **Dueño:** frontend1
- **Medido:** `apps/mobile/src/modules/midia/AvatarCuenta.tsx` (en web vive en `shell/`, otra
  carpeta) no muestra la inicial que el mapa pide («M»).
- **DoD:** la inicial del nombre del tenant, derivada del dato real y no de un literal. Captura.

### SM-I6 · `sin-issue` — El retardo al soltar (R03) sigue sin corregir

- **Estado:** DOD-PARCIAL
- **Falta:** medir en release, en el ejercicio final de SM-G4. No hay filmacion del antes: la de SM-G4 no se guardo.
- **Cierre:** 80f1a36f8bb7fac841c63b3698d0238d0db7ba1a (#1411). Los rotulos de PanelDeslizable y PanelFunciones salen de la posicion en el hilo de UI y no del estado fijado al terminar la animacion; tests del cableado rojos con el mutante. mobile.sh 1549 verdes en el worktree y CI 6/6. Despues filmado en device: el rotulo se va durante el movimiento (SM-I6.md). Desde #1401 el gesto de SM-G4 no tiene camino tactil, por lectura de codigo y una captura.
- **Dueño:** frontend1
- **Medido:** pendiente del experimento.
- **DoD:** el arreglo que indique SM-G4, con la captura del antes y el después.
- **Depende:** SM-G4.

### SM-I7 · `sin-issue` — La pantalla de permisos no dice qué capacidad concede cada ítem

- **Estado:** DOD-PARCIAL
- **Falta:** captura de device del sheet con iconos y con el aviso de continuacion.
- **Cierre:** b64856dc356dc89984d5a259a8ff90a691966013 (#1401). Un icono por fila segun la condicion que manda el backend y aviso de continuacion con glifo. El icono dice el tipo de capacidad, no los especificos del mockup: uno por capacidad exige un campo icono en el contrato. mobile.sh 1530 verdes en el worktree y 6/6 jobs en CI (#1401).
- **Dueño:** frontend1
- **Medido:** `consent` sin íconos por capacidad y sin el banner de continuación del mapa.
- **DoD:** un ícono por capacidad y el banner de continuación. Captura de device.

---

# Bloque J · Funciones (wave 3)

Puede correr **en paralelo con el bloque K**. Depende de SM-I2 (el dock).

### SM-J1 · `sin-issue` — Las 6 funciones no tienen dock ni los rótulos del mapa

- **Estado:** DOD-PARCIAL
- **Dueno-activo:** frontend1
- **Falta:** El residual es UNO y es de frontend1: las capturas de device de las 6 funciones a 390px. Todo lo demas de esta ficha esta HECHO y verificado por planificacion contra origin/main (6a35d0af) con git grep sobre el ref remoto. (1) El CODIGO del dock: mergeado en 80c5ef21 (#1456) -- campo + mic en Facturacion e Inteligencia, el texto siembra el chat y la card HITL es el unico gate. Denominador CERRADO por el operador en SEIS funciones (2026-11-03): Ajustes, Contabilidad, Soporte y Feedback NO llevan dock. (2) EL TEST que acredita que el texto del dock NO emite: existe y cita la ficha -- PantallaFacturacion.test.tsx:870 «SM-J1 -- el texto del dock va al chat y NO emite ni crea borrador», con el docstring del mecanismo en :867. Esta linea de Falta decia «verificar que entro con el PR»: entro. (3) LOS TRES ROTULOS: resueltos o decididos en contra, ver el Medido: corregido. Y lo que ya NO bloquea: esta Falta decia «bloqueadas porque adb devices sale VACIO». PREMISA VENCIDA -- el operador reconecto el telefono (RF8T318RN9T, Metro en :8081) y la tenencia es de frontend1 por su avance_ TOMO sin SOLTE. La captura no espera hardware: espera turno en la cola de device de frontend1, detras de SM-N38/SM-N22. Es el mismo defecto que el Medido: vencido -- una premisa con fecha que se sigue citando como estado vigente.
- **Dueño:** frontend2
- **Medido:** ~~`gastos`, `ingresos`, `factura`, `presu`, `clientes` y `bi` sin dock; faltan los
  rótulos «ÚLTIMOS», «Ticket» y «N facturas · N impaga».~~ **VENCIDA — corregido 2026-11-03 por
  planificación.** Los tres rótulos están resueltos o decididos en contra en `origin/main`
  (`6a35d0af`), verificado con `git grep` sobre el ref remoto, no sobre un working tree:
  «Últimos» existe (`BuscadorActividad.tsx:45`, usado en `PantallaGastos.tsx:290` e
  `PantallaIngresos.tsx:236`) y era de **Gastos/Ingresos**, no de Facturación · «Ticket» existe
  (`FotoFuncion.tsx:101`), también de Gastos · «N facturas · N impaga» **no se agrega por decisión
  escrita**: enmienda E-3 (`:304`) + el docstring que la fundamenta (`ResumenFacturado.tsx:13`) —
  la portada no trae conteos y derivarlos del listado paginado daría dos verdades para una
  pregunta. **Lo refutó frontend2 al re-medir** después de que planificación le despachara los tres
  como trabajo pendiente: yo cité esta línea `Medido:` en vez de grepear el literal, que es la
  misma verificación que le había exigido a ella en el despacho. Tercera vez en el sprint que un
  contrato manda a hacer algo ya hecho, y las tres veces la causa fue la misma — una línea de
  medición sin fecha se cita como si fuera de hoy.
- **DoD:** el dock de SM-I2 en las **6**, más sus rótulos. Captura de device de cada una. Lo que la
  app tiene y el mapa no — **BUSCAR** en Gastos y **«Te deben»** en Facturación — **se queda y se
  documenta en el mapa** (D4): no se retira.
- **Depende:** SM-I2. **Causa:** sin el componente compartido, el dock se escribiría 6 veces.

### SM-J2 · `sin-issue` — Faltan los chips por fila y de antigüedad

- **Estado:** TERMINADO
- **Cierre:** sin-codigo — PREMISA REFUTADA (medido 2026-11-02): los chips existen en TarjetaCliente.tsx y los dos reclamados estan apagados por decision documentada (:47-48 el chip auto, :50-52 origen derivado, :67-71 el codigo descarta auto a proposito). #1079 ya habia pagado esta deuda escribiendo el motivo; implementarla la reabria. Revisar la decision = pedido_ con dato nuevo, no esta ficha.
- **Dueño:** frontend2
- **Medido:** `factura` sin chips por fila; `presu` sin chips de antigüedad.
- **DoD:** los chips del mapa en las dos pantallas, con el dato real (no un literal). Captura.

⛔ **PREMISA REFUTADA — medido el 2026-11-02, la ficha queda SIN OBJETO.** Los chips **existen** en
`apps/mobile/src/modules/clientes/TarjetaCliente.tsx`, y los dos que esta ficha reclamaba están
**deliberadamente apagados con el motivo escrito en el docstring**:
`TarjetaCliente.tsx:47-48` — «Se agregó solo» no se pinta en la columna derecha (el prototipo lo
muestra como chip `.estado.auto`) · `TarjetaCliente.tsx:50-52` — «`origen: 'derivado'` no se marca.
Es el default de una cartera que se armó sola; etiquetar el caso mayoritario es ruido» ·
`TarjetaCliente.tsx:67-71` — el código pasa `esAuto = true` **para descartar** el chip `auto`, de
modo que sólo sobreviven los estados MEDIDOS y un listado sin el par declarado no cae a un
«Todavía sin comprar» **deducido**. El conteo no se perdió: lo lleva el `BloqueCifra` de
`PantallaClientes` («N se agregaron solos este mes»).

**Y el agravante:** el mismo docstring registra que esta deuda **ya se pagó una vez** — #1079
atribuía la ausencia a «una decisión documentada en su docstring» que no estaba escrita, y el fix
fue escribirla. Implementar esta ficha habría revertido la decisión **y** reabierto la deuda que ese
PR cerró. El prototipo los muestra; el código decidió no mostrarlos, a propósito, y dejó el porqué.

**Si se quiere revisar la decisión, eso es un `pedido_` con el dato nuevo, no esta ficha:** una ficha
que afirma una ausencia inexistente no puede ser el vehículo para cambiar una decisión de diseño.

### SM-J3 · `sin-issue` — Inteligencia no tiene la cabecera del mapa ni mensaje de vacío

- **Estado:** DOD-PARCIAL
- **Falta:** captura del tenant vacio (operador: canonico unico, no se puede vaciar)
- **Cierre:** bfa7b919 (#1376): capturas de device (RF8T318RN9T, canonico): reposo docs/copiloto-emprendedor/2026-11-02-sprint-correcciones-evidencia/SM-J3-inteligencia-etiqueta-del-mes-debajo-del-titulo.webp y refresh en curso, solo 'Actualizando…' sin spinner, docs/copiloto-emprendedor/2026-11-02-sprint-correcciones-evidencia/SM-J3-inteligencia-refresh-en-curso-solo-actualizando.webp. La captura de reposo destapo que la etiqueta del mes quedaba a ancho 0; ahora va debajo del titulo.
- **Dueño:** frontend2
- **Medido:** `bi` sin cabecera en card blanca con período, sin etiqueta de mes y sin mosaicos;
  `bi-vacio` sin el mensaje global «Sin ventas todavía». Y al tirar para actualizar, el indicador
  nativo del `RefreshControl` se dibuja **encima del monto** (N2), donde el mapa sólo pone
  «Actualizando…».
- **DoD (corregido 2026-11-02 — ver el ⛔ de abajo):** cabecera, etiqueta de mes y mosaicos del
  mapa; «Sin ventas todavía» en el vacío; ~~el indicador nativo oculto (color transparente)~~
  **el indicador nativo YA está fuera de cuadro: NO se toca el `RefreshControl`** — dejando sólo
  la línea «Actualizando…». Captura de
  los tres estados, incluido el refresh en curso.

- ⛔ **EL DoD PRESCRIBÍA EL DEFECTO — corregido el 2026-11-02 (lo vio frontend1 al implementar).**
  Decía «indicador nativo oculto (**color transparente**)», y
  `apps/mobile/src/modules/inteligencia/PantallaInteligencia.tsx:203-211` documenta, **medido en
  device**, que `colors={['transparent']}` **NO sirve en Android**: `CircularProgressDrawable` pisa
  el canal alfa y el arco sale **negro opaco encima del saldo**. Seguir el DoD al pie de la letra
  **reintroducía el defecto que la ficha pide arreglar**.
- ✅ **Y el punto N2 ya está hecho:** lo que funciona es sacarlo de pantalla —
  `progressViewOffset={OFFSET_REFRESH_FUERA_DE_CUADRO}` negativo, con `tintColor` sólo para la
  flecha de iOS (donde el alfa sí se respeta). En `main` por #1297 (`51cb7bca`).
- **DoD vigente (reemplaza el del punto del indicador):** cabecera, etiqueta de mes y mosaicos del
  mapa; «Sin ventas todavía» en el vacío; **el indicador nativo ya está fuera de cuadro — NO se
  toca el `RefreshControl`**. Captura de los tres estados, incluido el refresh en curso, que debe
  mostrar sólo «Actualizando…».
- 🧭 **Clase nueva, y el barrido no la caza:** `premisas-de-ausencia.py` busca fichas que afirman una
  **ausencia**; ésta afirmaba una **solución**. Una ficha que prescribe *cómo* arreglar algo puede
  prescribir una técnica ya descartada en device, y el que la implementa lo descubre recién al
  tocar el archivo. Antes de seguir un DoD que dice *cómo*, se lee el docstring del archivo: ahí
  está la medición que la ficha no tiene.
### SM-J4 · `sin-issue` — Clientes: el dato SÍ llega; falta medirlo con un cliente que tenga CUIT

- **Estado:** DOD-PARCIAL
- **Falta:** DoD(1) HECHO: adversarial test_adversarial_http_clientes_a_cannot_read_b (c3867d10 #1325), corrido en VPS 2026-11-02 1 passed, con control positivo del tenant B. Falta DoD(2) captura de device con cliente CON CUIT, solo en la canonica 4f3ecb78: frontend2 da de alta por la app un cliente con CUIT 20111111112 (el de sus 4 facturas) y la evidencia es el salto comprobantes_cantidad 0 a 4 en GET /clientes. No se crea por SQL. Decidido por planificacion 2026-11-02, 19af5a42 descartado.
- **Dueño:** frontend2 (la captura con dato real) — **corregido 2026-11-03:** este campo decía
  «backend (el adversarial que falta)» y lo contradecía el `Falta:` de su propia ficha, que
  acredita el adversarial HECHO (`c3867d10`, #1325, 1 passed en el VPS con control positivo del
  tenant B). Un rótulo de dueño que sobrevive al trabajo que lo justificaba hace creer a una
  sesión que tiene cola cuando no la tiene, y a mí despachar contra el dueño equivocado: lo
  medí al barrer las 7 fichas con nombre de backend y encontrar que el residual de todas es
  ajeno. El residual de esta ficha es UNO y es de frontend2.
- ⚠️ **PREMISA CORREGIDA el 2026-11-02 — la ficha decía «la app no los recibe hoy» y es FALSO.**
  Medido contra `origin/main`: el listado trae `comprobantes_cantidad` (int), `monto_facturado`
  (string decimal, **nunca** null) y `facturas_atribuibles` (bool) — `cliente_store.py:310-320`,
  `clientes_web.py:147`; la app los consume en `packages/core/src/api/clientes.ts` y los dibuja en
  `apps/mobile/src/modules/clientes/TarjetaCliente.tsx`, con tests que lo acreditan
  (`clientes.test.ts`, casos `BL-V18` y `C-D1`).
  **Por qué nadie lo vio:** el relevamiento (2026-10-16) cita como causa «`api/clientes.ts:31` no
  trae esos campos», heredada del *mapeo previo* que su propio texto nombra. El campo entró al core
  el **2026-10-06** (#816, `BL-V18`), **diez días antes** de ese relevamiento: la causa ya era falsa
  cuando se escribió. Una cita con `path:línea` **parece medida** — la precisión del formato se lee
  como frescura — y planificación la trasladó a un `contrato_` sin volver a correrla, bloqueando a
  frontend2 contra un dato que ya existía.
- **Lo que el «—» de la pantalla significa en realidad:** los clientes de prueba no tienen CUIT
  (`doc_tipo: null`) ⇒ `facturas_atribuibles: false` ⇒ la UI **a propósito** no pinta número, porque
  no se puede atribuir. El síntoma observado era el comportamiento correcto, no el defecto.
- **Los chips quedan FUERA de esta ficha.** El relevamiento pide chips en `factura` (entrada 40) y
  chips de antigüedad en `presu` (41); en `clientes` (43) dice «chips» sin decir cuáles ni con qué
  dato. Lo único existente es el chip de cartera (`agregados_este_mes`) y `origen`. No se inventa una
  regla para llenar una definición delgada: si hacen falta otros, es un `pedido_` con su dato.
- **DoD:** (1) el **adversarial que falta**: monto y comprobantes aislados por tenant con el **mismo
  CUIT** en A y B — sin él el aislamiento de estos tres campos queda `[UNVERIFIED]`, y ajeno vs.
  inexistente ya responde `404` idéntico en código y cuerpo; (2) captura de device con un cliente
  **que tenga CUIT**, mostrando monto y «N comprobantes» reales; (3) captura del caso
  `facturas_atribuibles: false` mostrando que el «—» es deliberado.
- **Ya NO es un `contrato_` bloqueante.** La forma está publicada y medida contra prod:
  `GET /clientes?q=&limit=` → `{clientes:[{…,comprobantes_cantidad,monto_facturado,facturas_atribuibles}], total, agregados_este_mes}`,
  tenant por `Depends(require_tenant)` per-request, cartera vacía = `200` con lista vacía. Monto =
  **facturado neto acumulado** (NC resta), no «por cobrar» ni «del mes»; comprobantes = **cuenta**
  con CAE, incluida la anulada.

### SM-J5 · `sin-issue` — La agenda no distingue hoy de los días siguientes

- **Estado:** TERMINADO
- **Cierre:** sin-codigo — PREMISA REFUTADA (medido 2026-11-02): PantallaAgenda.tsx:23-24 agrupa Hoy / Manana / Esta semana / Sin hora con los titulos EXACTOS del backend (BL-J13, K-13, ADR-004), grupos con testID agenda-grupo-$id (:148) y caso vacio (:156); PantallaAgenda.test.tsx:65 lo afirma. Lo que la pantalla no hace es otra cosa y es decision documentada: sin Calendar conectado NUNCA dice 'no tenes eventos' y BL-V23 desempata nunca-conectada de caida.
- **Dueño:** frontend2
- **Medido:** medida el 2026-11-02 con Calendar reconectado. Falta la línea del ahora (mockup 14),
  «+ Nuevo evento» y el punto de estado. Un evento aparece **repetido** en «Esta semana».
- **DoD:** vista **mixta** (D9): línea de tiempo con línea del ahora para **hoy**, lista para
  **Mañana** y **Esta semana**. «+ Nuevo evento» y punto de estado presentes. Y el repetido:
  **verificar contra el dato de Calendar si es dato o defecto** antes de arreglar nada — si es dato,
  se escribe eso y la ficha cierra con esa cita.

---

# Bloque K · Ajustes y ARCA (wave 4)

Puede correr **en paralelo con el bloque J**. No toca `PantallaMiDia.tsx` ni el dock.

⛔ **PREMISA REFUTADA — medido el 2026-11-02, la ficha queda SIN OBJETO.** La agenda **sí** distingue
hoy de los días siguientes: `apps/mobile/src/modules/midia/PantallaAgenda.tsx:23-24` —
«la agenda de los próximos días, sólo lectura: **Hoy · Mañana · Esta semana · Sin hora**, con los
`titulo` EXACTOS que manda el backend. Paridad con `AgendaScreen` de la web; la lógica (cliente,
rango ≤ 14 días, franja horaria) vive en `@copiloto/core`» (BL-J13, K-13, ADR-004). Los grupos se
dibujan con `testID={`agenda-grupo-${g.id}`}` (`:148`) y su caso vacío en `:156`; el test
`PantallaAgenda.test.tsx:65` afirma que `agenda-grupo-manana` contiene «Mañana».

**Lo que la pantalla NO hace es distinto y ya está documentado como decisión:** con Calendar sin
conectar **nunca** dice «no tenés eventos» —es falso, no sabemos nada— y ofrece conectar; y
`agenda.conectado === false` desempata «nunca conectada» de «caída» leyendo `estadoConexion` del
catálogo (BL-V23). Si el relevamiento vio «no distingue los días», midió una pantalla sin Calendar
conectado — que es el estado que esas dos reglas gobiernan a propósito.

### SM-K1 · `sin-issue` — Homologación es visible para cualquier usuario

- **Estado:** DOD-PARCIAL
- **Falta:** captura de device de Homologacion oculta para no-admin (frontend2)
- **Cierre:** 476f508a (#1330) + f5cf69ac (#1333); backend desplegado en 77326ae5, adversarial JWT reales VPS 2663 passed
- **Dueño:** frontend2 (visibilidad) + backend (rechazo)
- **Medido:** la pantalla `afip` ofrece Homologación sin distinguir rol.
- **DoD:** visible **sólo para `copiloto_admin`** (D6) **y rechazada por el backend** para el resto —
  las dos mitades, porque ocultar un botón no es un control. **Test adversarial:** un usuario no
  admin pide la operación por API → denegado. Sin ese test el control queda `[UNVERIFIED]` y bloquea
  el cierre (ADR-013; el drift cross-tenant vivió ~2 meses en prod por faltar justamente este test).

### SM-K2 · `sin-issue` — El recuadro de vincular ARCA no se ve tocable ni dice a qué ambiente vincula

- **Estado:** DOD-PARCIAL
- **Falta:** Captura de device de los dos estados del recuadro y del formulario nombrando el ambiente. DECISION: web NO recibe el cambio en esta ficha (el gate de paridad testID exige el mismo testID en ambos lados y no se agrego uno); la diferencia web/mobile es deliberada, no un bug
- **Cierre:** b06f0841 (#1326)
- **Dueño:** frontend2
- **Medido:** `afip` vincular: sólo parte del recuadro responde y se ve distinto según el estado;
  «Vincular» no aclara el ambiente.
- **DoD:** el recuadro **completo** tocable y con el mismo aspecto en ambos estados; «Vincular» lleva
  a un formulario que **dice a qué ambiente vincula**. Captura de los dos estados.

### SM-K3 · `sin-issue` — La pantalla de estado ARCA no se refresca y sus errores no distinguen la causa

- **Estado:** DOD-PARCIAL
- **Falta:** requiere un tenant SIN Drive conectado: con la cuenta del operador el estado apagado NO existe (tiene Drive) · refresco al terminar sin recargar (premisa sin medir) · captura de los dos errores. Refutado, NO se implementa: «Necesito cambiarlo ›» (BL-V27)
- **Cierre:** c18439ff (#1339) causa dato|servicio|desconocida · ff850770 (#1424) el toggle de Drive apagado dice por qué (test) · device 2026-11-02 cuenta OPERADOR: toggle ACTIVO (SM-K3-toggle-drive-activo)
- **Dueño:** frontend2 (+ backend si el error no trae la causa)
- **Medido:** no se refresca sola al terminar; los botones apagados no dicen por qué; el error no
  distingue falla del servicio de dato mal cargado; faltan subtítulo y «Necesito cambiarlo ›».
- **DoD:** refresco propio al terminar; cada botón apagado con su motivo visible; el error nombra
  **cuál de las dos** causas es; subtítulo y «Necesito cambiarlo ›» presentes. La **clave fiscal
  conserva la frase del código** (criterio de la decisión 8) y el mapa se corrige. Captura de los
  dos errores. **Causa de separar los errores:** dos causas que comparten mensaje hacen que se
  diagnostique la equivocada.

⚠️ **PREMISA PARCIALMENTE REFUTADA — medido por frontend2 el 2026-11-02, y toca una decisión DEL
OPERADOR.** Lo que esta ficha pedía agregar no falta: **«Necesito cambiarlo ›» está OMITIDO por
decisión del operador (BL-V27, 2026-10-13)**, escrita en `apps/mobile/src/modules/afip/
PantallaAfipSetup.tsx:551-555` — «cero control que sugiera cambiar el CUIT; el test lo fija».
Agregarlo habría **revertido una decisión del operador**, que no es táctico: es MAYOR. El
«subtítulo» tampoco falta: existe como `afip-estado-vinculo` («ARCA vinculada · CUIT …»).

**Queda de esta ficha, que sí es real:** consumir el campo `causa` ∈ `dato|servicio|desconocida`
publicado por backend (#1334, `GET /afip/estado` → `onboarding.causa`), el refresco al terminar, y el
motivo de los botones apagados. Contrato del lado app: `dato` → ofrecer corregir · `servicio` →
reintentar sin tocar datos · `desconocida` → mensaje genérico, **no asumir**.

### SM-K4 · `sin-issue` — Apps conectadas no dice qué NO puede hacer el copiloto

- **Estado:** TERMINADO
- **Cierre:** bfa7b919 (#1376) sobre el merge previo de K4. Captura de device (RF8T318RN9T, canonico) docs/copiloto-emprendedor/2026-11-02-sprint-correcciones-evidencia/SM-K4-apps-no-puede-leerlos-y-conectada-entera.webp: Gmail 'No puede leerlos.' y pildora '● Conectada' entera. La captura destapo que la pildora se salia de la tarjeta; corregido en el mismo #1376.
- **Dueño:** frontend2
- **Medido:** falta «No puede leerlos» en Gmail (decisión del mockup 13); el estado va como texto
  suelto en vez de etiqueta; Google Sheets figura en el mapa.
- **DoD:** «No puede leerlos» en Gmail; el estado como etiqueta; **Sheets sale del mapa si no hay
  conector** — se verifica si existe antes de decidir (criterio §1). Captura.

### SM-K5 · `sin-issue` — Ajustes y Cuenta difieren del mapa en estructura y copy

- **Estado:** DOD-PARCIAL
- **Falta:** el diálogo «Sí, cerrar sesión» solo existe tocando el botón que cierra la sesión: requiere una sesión DESCARTABLE (canónico), no la del operador; con su cuenta el estado no se puede producir sin cerrársela (no autorizado)
- **Cierre:** 3be85a91 (#1365) chevrons + copy Google · c5186d47 (#1368) mapa corregido · device 2026-11-02 cuenta OPERADOR: tiles sin fondo blanco y «Cerrar sesión» entero (SM-K5-*.webp)
- **Dueño:** frontend2
- **Medido:** faltan subtítulos y encabezado; falta «desde …» y los chevrons; el fondo blanco
  sobresale de las tiles; «Sí, cerrar sesión» aparece cortado; el copy dice «usuario y contraseña»
  cuando la cuenta entró con Google.
- **DoD:** los seis puntos corregidos, con captura de cada pantalla. **«Cambiar el mail» queda
  afuera** (depende del SMTP de SM-C5, diferido) y el mapa lo refleja. **Cerrar sesión se prueba
  sólo con el usuario del operador, nunca con el canónico.**

### SM-K6 · `sin-issue` — La pantalla de ingreso no avisa que la sesión se cerró

- **Estado:** DOD-PARCIAL
- **Falta:** SOLO la captura de device del aviso PRESENTE tras un 401 del lado cliente. Provocarlo DESCARTA la sesion de la cuenta que lo provoca, asi que va con la canonica, corrompiendo el token por Metro sin commitear nada — NO con la cuenta del operador. NADA pendiente de backend: el contrato que este Falta le pedia ya estaba contestado en su cierre de N21.
- **Cierre:** Codigo YA en main (117dc669 #1320). CONTRATO DEL 401 CONTESTADO por backend y verificado: token vencido, mal firmado o basura -> 401 {"detail":"invalid token"} (auth.py:98-103) · sin header -> 401 {"detail":"missing or malformed Authorization header"} · login malo -> 401 {"detail":"credenciales invalidas"}, SOLO en /auth/login. GOTRUE_JWT_EXP=3600. CONSECUENCIA para el DoD: 'token vencido' y 'login fallido' SI se distinguen — por ruta y por body — asi que el punto 'aviso ausente en un ingreso normal' ES implementable. Lo que NO se distingue es vencido vs mal firmado, y eso es anti-enumeracion deliberado, no un defecto.
- **Dueño:** frontend2
- **Medido:** el aviso «Tu sesión se cerró por seguridad…» **no existe en ningún archivo** de
  `apps/mobile` ni de `packages/core`; el flujo de sesión caída ya va directo a este formulario
  (`apps/mobile/src/modules/auth/EntradaSesion.tsx:25`; en web vive en `auth/`). Además difieren logo, relleno de campos y botones.
- **DoD:** estructura del formulario igual al prototipo y el aviso presente **cuando la sesión se
  cayó** (y ausente en un ingreso normal: las dos capturas, porque un aviso que sale siempre no
  informa).

### SM-K7 · `sin-issue` — Seis pantallas secundarias difieren del mapa en estructura

- **Estado:** TERMINADO
- **Cierre:** 926163a4 (#1395): hablar filas con radio, comousar círculo+chevron, feedback mes a la derecha, negocio sin título duplicado/rótulo/sin oración repetida; apar y soporte sin código (enmienda fundada PantallaSkins.tsx:145 desde 004ee3ce; clip de soporte desde #1115). Capturas de device en 2026-11-02-sprint-correcciones-evidencia/SM-K7-*.webp. Inventario #1379. Enmienda del mapa pendiente: contenedor en una sola tarjeta y chevron de apar.
- **Dueño:** frontend2
- **Medido:** `negocio` (estructura del formulario), `comousar` (contenedor y numeración), `soporte`
  (falta el clip; y sale el botón de voz grande por D2), `feedback` (estructura y posición del mes),
  `apar` (mosaico y chevron), `hablar` (control de selección).
- **DoD:** las seis igualadas, una captura de device por pantalla. Es **una** ficha porque son
  cambios de estructura sin pieza compartida entre sí; si alguna destapa un defecto de lógica, se
  abre ficha propia en vez de ampliar ésta.

### SM-K8 · `sin-issue` — El onboarding marca error antes de que el usuario escriba

- **Estado:** TERMINADO
- **Cierre:** sha c712da76f345d8b8791be174d9103a9d9c5e7d41 · fix + test + paso en el mapa (SM-C3 DoD 2-4) · captura de device 2026-11-02 en docs/copiloto-emprendedor/2026-11-02-sprint-correcciones-evidencia/SM-K8-paso-perfil-sin-errores-al-abrir.webp (onboarding del canónico puesto en false con k8.py y restaurado a true, verificado)
- **Dueño:** frontend2
- **Medido:** N4 — la app agrega un paso de perfil que el mapa no tiene
  (`PantallaOnboarding.tsx:292`), gate del backend por `perfilIncompleto`. Su docstring cita el
  contrato BL-Q3 fila 3, **y no se pudo confirmar que ese contrato lo ordene**.
- **DoD:** sin errores prematuros (el error aparece al intentar avanzar, no al abrir). El paso **se
  queda** y se agrega al mapa, con la cita del contrato **verificada** o escrita como ausente.

### SM-K9 · `sin-issue` — La máscara de fecha podría no ser un defecto

- **Estado:** DOD-PARCIAL
- **Dueno-activo:** frontend2
- **Falta:** Medido en codigo 2026-11-03 (5dfe93a1, #1484, ancestro de origin/main): NO es una mascara. CampoFecha son TRES TextInput con auto-avance (CampoFecha.tsx:96-128), asi que la premisa de la ficha -- «la mascara podria no ser un defecto» -- se responde: no hay mascara que juzgar. El «DD / 02 / 1120» que la abrio es CONSISTENTE con adb escribiendo mas rapido que el focus() entre segmentos, pero eso NO esta probado y la diferencia importa: si es el instrumento, no hay defecto de producto; si es el componente, si. FALTA la corrida con TECLADO REAL (receta de 3 min en el buzon para frontend1, que tiene la tenencia del device) -- es el unico control que separa las dos causas, porque adb y un dedo humano no escriben al mismo ritmo. El hallazgo aparte que salio de aca (el borrado hacia atras no vuelve al segmento anterior, 0 hits de onKeyPress) NO ensancha esta ficha: quedo como SM-N40 (DEC-18).
- **Dueño:** frontend2
- **Medido:** observada con `adb`, que no reproduce el teclado real.
- **DoD:** **repetir con teclado real primero.** Si se reproduce, el fix y su captura; si no, la
  ficha cierra como observación no reproducida citando la corrida. **Causa:** lo que se retira es la
  causa, no la observación.

---

# Bloque L · Cierre con el operador (wave 5)

Es la **única** parte no autónoma: una sola ventana con el operador. Hasta esa ventana, las fichas
que dependan de ella quedan `DOD-PARCIAL` con su `Falta:`.

### SM-L1 · `sin-issue` — `entrada` no se puede medir con el dev-client

- **Estado:** DOD-PARCIAL
- **Falta:** Correr el build de release y medir sobre el apk. Por ORDEN DEL OPERADOR (2026-11-02) el build de release corre ULTIMO, despues de que TODA la implementacion este mergeada a main: no es trabajo diferido por falta de dueno, es una precedencia declarada.
- **Cierre:** Perfil y receta del build de release YA en main: bb64720c (perfil release-medicion, apk con bundle embebido y API base inlineada) + 5f3628b1 (receta reproducible), ambos ancestros de origin/main. Lo marca el control nuevo scripts/fichas-desincronizadas.py, no una persona.
- **Dueño:** frontend2 + operador
- **Medido:** el arranque en frío se grabó (60 cuadros): logo, **fase del dev-client**, Mi día, y a
  los pocos segundos **el chat sube solo** con el rótulo viejo. La fase del dev-client contamina el
  tiempo, y que el chat suba solo no se pudo atribuir a la app o a la restauración de estado del
  dev-client.
- **DoD:** medición con **build de release**: el tiempo real de `entrada`, y el veredicto de si el
  chat sube solo. Si sube solo también ahí, **es un defecto nuevo** y se abre ficha.

### SM-L2 · `sin-issue` — Cuatro entradas exigen voz real y ninguna se midió

- **Estado:** PENDIENTE
- **Dueño:** frontend2 + operador
- **Medido:** `vozchat`, `fact-voz` y `pres-voz` necesitan dictado real; el cancelar deslizando quedó
  `[UNVERIFIED]` porque `adb` no lo reprodujo en dos corridas.
- **DoD:** las tres entradas medidas con voz real y el cancelar deslizando ejercitado **con el dedo**
  en su lugar nuevo (el de SM-I2). Captura de cada una.
- **Depende:** SM-I2.

### SM-L3 · `sin-issue` — La anulación de facturas nunca se ejercitó contra ARCA real

- **Estado:** TERMINADO
- **Cierre:** sin-ejecutar — FUERA DE ALCANCE por decision del operador (2026-11-02, textual): «las facturas no necesitamos probarlas porque ya probamos que funciona». El DoD se RETIRA, no se declara satisfecho: nadie anulo las facturas N 10 y N 11 en esta ronda, y la anulacion queda acreditada por la prueba anterior del operador, no por este sprint. CORRECCION: el cierre decia «sin-codigo» y era falso — el script y la receta de backend ya estaban en main (#1392, DOD-PARCIAL mergeado antes del aviso de parada); quedan sin ejecutar. Lo retirado es el DoD, no el codigo.
- **Dueño:** backend + **operador (el botón final)**
- **Medido:** las facturas reales N° 10 y N° 11 están emitidas en Producción.
- **DoD:** las dos anuladas (D10), con captura **y estado en servidor** que lo confirme — no sólo la
  pantalla. **El botón final lo toca el operador**, nunca una sesión. Es la prueba de que la
  anulación funciona, así que un fallo acá es hallazgo, no obstáculo.
- **Depende:** SM-H2 (si cancelar/anular comparten camino, se verifica cuál antes de tocar).

### SM-L4 · `sin-issue` — El cierre del sprint exige remedir las 51 entradas

- **Estado:** DOD-PARCIAL
- **Dueno-activo:** planificacion
- **Falta:** RE-MEDIDO 2026-11-03 tras el LOTE 2 de frontend2: 1447fddb (#1497, CI 6/6), ancestro de origin/main verificado por planificacion con control positivo del propio chequeo de ancestria, para que el verde no venga de un comando que diga si a todo. Acumulado con el lote 1 (9fa6fef8, #1494, tambien verificado). Con scripts/mapa-51-estado.py: A 26->13->8, B 9->15->18, NO-VERIFICABLE 9->16->18, EN CONDICION 16->22->25 de 51, CONFORME 7. LO QUE CIERRA EL LOTE 2, y es lo que mas vale porque nadie lo pidio: los 9 NO-VERIFICABLE (03, 06, 07, 10, 16, 17, 30, 36, 42) llevan ahora una linea «Exige del device:» CONCRETA. Eso es exactamente lo que impide que NO-VERIFICABLE se vuelva un tacho: una entrada que dice que necesita el device es una espera con disparador nombrable; una que solo dice «no se puede» es una espera que nadie persigue. El riesgo lo habia nombrado planificacion al cerrar el lote 1 y lo cerro frontend2 por su cuenta. DOS NO-VERIFICABLE no dependen del device y por eso NO son de frontend1: la 16 exige un tenant SIN ventas, que tiene que proveer backend, y la 36 exige un mail real, que exige autorizacion del operador. Mezclarlas con la cola de device haria que una espera de provision y una de decision parezcan esperas de hardware. QUEDAN 8 ENTRADAS A, repartidas por lo que cada una EXIGE y no por quien las encontro: 26 y 27 (Editar/Cancelar y CAE) son diferencias REALES ya medidas en device, o sea codigo que nadie implemento -- asignadas a frontend2 el 2026-11-03 con el guard de grepear el literal contra origin/main ANTES de implementar, porque su medicion es de horas antes y main se movio; si la diferencia ya no esta, devuelve el hallazgo en vez de implementar. 09, 29, 33, 41 y 46 NO son de ninguna sesion: son wording puro y alcance del mapa, y van AGRUPADAS EN UN SOLO PUNTO del pedido_ del operador -- un renglon por palabra convierte el pedido_ en ruido y el operador deja de leerlo. Los literales medidos: 29 «Guardar presupuesto» (mapa) vs «Guardar el presupuesto» (FormularioPresupuesto.tsx:420), 33 contenedor tarjeta unica vs una por fila, 46 texto de clave fiscal. 41 ES UN HALLAZGO, NO UNA ENTRADA DE WORDING: frontend2 no hallo el literal del chip de antiguedad por fila. Si el chip no existe en el codigo, la entrada no es una diferencia de redaccion sino una funcion AUSENTE, y eso cambia a quien le toca. Pendiente de reclasificar con la busqueda escrita, porque «no lo halle» sin decir donde busco no acredita que no exista. 47 (descripciones de catalog.py:60-106, vive en backend) y el chevron de «Como el telefono» vs «Activo» (PantallaSkins.tsx:125-132) siguen escaladas y NO se re-escalan.
- **Dueño:** planificación
- **Medido:** al 2026-11-02 el mapa está en 7 CONFORME · 31 DIFERENTE·A · 6 DIFERENTE·B · 7
  NO-VERIFICABLE.
- **DoD:** las **51** entradas en CONFORME o DIFERENTE·B **con cita**, contadas con
  `collections.Counter` por un script, no a mano. `onb-cumplida` y `vacio-visto` necesitan datos y
  días de uso reales: si no se pueden producir, quedan **declaradas con su motivo** y eso se escribe,
  no se cuenta como CONFORME. **Un hallazgo nuevo no reabre una entrada ya cerrada** — va a ficha
  aparte (DEC-18: un criterio que crece con cada medición no se puede alcanzar).
- **Depende:** todas las anteriores.

# Bloque N · Instrumento contaminado (destapado al cerrar SM-H4)

> Las dos salen del cierre de `SM-H4` (backend, 2026-11-02): no eran features, las destapó **medir
> con lenguaje natural en prod**. Backend las reportó y **no las parcheó**, que es lo correcto —
> parchear fuera de la ficha es el desvío que el gate de atribución marca.

### SM-N1 · `sin-issue` — Carrera entre la tool y la carga de contexto: `estado()` dice `perfil_ausente` con el perfil INTACTO

- **Estado:** TERMINADO
- **Cierre:** f95f4849 (#1353): contexto_cargado en estado del FacturaWorkflow + espera acotada en la tool; causa = carrera tool vs cargar_contexto_factura, no el perfil (intacto, id 42); misma sonda de 12 en prod: 0/12 datos fiscales (antes 4/12), 9/12 card (antes 6/12), los 3 restantes piden periodo = SM-N2
- **Dueño:** backend
- **Medido:** 12 dictados en prod con el canónico tras el deploy de `SM-H4` — **0/12 piden
  CUIT/DNI/nombre** (el fix funciona), pero **4/12 responden «faltan tus datos fiscales»** en vez de
  producir la card. El perfil fiscal de `e2e-device@copiloto.test` en prod parece inválido o ausente.
- ✅ **TÍTULO CORREGIDO 2026-11-02 — mi premisa era falsa y la refutó backend al medirla.** La ficha decía «el perfil fiscal parece inválido». El perfil está **intacto** (`afip_perfil` id 42, CUIT con dígito verificador válido, monotributo, `updated_at` 2026-10-14 sin cambios). La causa es una **carrera**: `tool_catalog._run_emitir_factura` consulta el estado mientras la activity `cargar_contexto_factura` todavía corre (`afip_factura_workflow.py:268-279`), y hasta que termina `self._perfil` es `None`, así que `estado()` devuelve `perfil_ausente`. **La firma era el mismo input con tres salidas distintas** (6 dictados idénticos → 3 card, 1 período, 2 «datos fiscales»): eso es una carrera, no un dato faltante. Un título que sigue acusando al perfil manda a la próxima sesión a revisar algo que está bien.
- **Por qué es lo primero y no una molestia:** el canónico es **el** instrumento de medición del
  sprint. Si su perfil fiscal está roto, **toda sonda de factura con ese usuario mide el perfil, no
  la conducta del agente** — y el resultado se lee como defecto del agente. Un instrumento
  contaminado no da error: da una conclusión equivocada con cara de medición.
- **DoD:**
  1. **Diagnóstico primero, sin tocar nada:** qué tiene hoy el perfil fiscal del canónico en prod y
     **qué campo exacto** dispara «faltan tus datos fiscales» (`path:línea` de la validación).
     Prohibido «completarlo y ver si anda»: eso borra la evidencia de la causa.
  2. **Decir si el perfil se rompió o nunca estuvo**, con el dato que lo distinga. Si se rompió,
     cuándo y por qué — un perfil que se degrada solo es un defecto aparte.
  3. Restaurado el perfil, **re-correr la misma sonda de 12** y reportar el delta. El control es el
     **mismo** instrumento, no uno nuevo: cambiar la sonda y el sujeto a la vez mide dos variables.
  4. **No se crea otro usuario** para esquivarlo (regla del canónico único). Si el arreglo exigiera
     un segundo usuario, eso es MAYOR y va al `pedido_` del operador que ya existe.
- **Tope:** si la causa resulta ser un cambio de schema o de validación propio, **no se parchea el
  dato**: se arregla la causa y el dato se reconstruye.

### SM-N2 · `sin-issue` — El agente pide período/vencimiento aunque la descripción lo prohibe

- **Estado:** TERMINADO
- **Cierre:** sha 1efe5a3e (#1357). Causa: la observación de la tool (R6 + «Pedí SÓLO eso») le gana a la descripción; fix = sacar la pregunta de la observación. Sonda de 12 en prod: 12/12 card (antes 9/12), 0/12 piden período/documento. Tests VPS 62 passed. SM-N2
- **Dueño:** backend
- **Medido:** 3 de los 12 dictados piden **período o vencimiento de servicio** a pesar de la consigna
  de `emitir_factura` que lo prohibe explícitamente (deploy `c0219797`, #1343).
- **Qué clase de defecto es:** **la descripción de la herramienta no gobierna al modelo**. No es un
  bug de validación — la validación ni se alcanza. Es el mismo hueco que dejó `SM-H3` en
  `DOD-PARCIAL`: lo que falla es la **elección y el relleno** del tool call, y eso sólo se ejercita
  con lenguaje natural, no con un test de la función.
- **DoD:**
  1. Reproducirlo con **las 3 frases exactas** que lo dispararon, guardadas literales. Una frase
     parafraseada no reproduce un defecto de prompt.
  2. Decir **por qué** la consigna no gana: si es orden, ubicación, competencia con otra instrucción,
     o que el modelo infiere «servicio» del dictado. Con evidencia, no con hipótesis.
  3. Fix + **la misma sonda de 12 frases**, reportando cuántas piden período antes y después. El
     número de antes ya existe (3/12): es el control.
  4. **Depende de `SM-N1`:** con el perfil fiscal roto, 4 de las 12 ni llegan a la card, así que la
     sonda tiene 8 casillas útiles y el «después» no es comparable con el «antes». **`SM-N1`
     primero.**

### SM-N3 · `sin-issue` — El texto del catálogo que afirma qué PUEDE hacer una app no tiene test

- **Estado:** TERMINADO
- **Cierre:** sha 99097d83 (#1359). Test atado a TOOLS−WRITE_OPS con control positivo en ambas direcciones (VPS 23 passed). Barrido: 6 descripciones afirman capacidad, 2/6 con lectura atada, 4/6 escritura sólo por alcance. SM-N3
- **Dueño:** backend (`apps/copiloto/backend/catalog.py` es suyo; el cambio lo hizo frontend2 en
  `SM-K4` y lo reportó él mismo)
- **Medido:** `SM-K4` cambió el texto de Gmail de «Enviá mails desde el chat.» a «…No puede
  leerlos.» — **un string, sin test que lo fije** (#1349, `c1ee5292`). Y el string **afirma una
  capacidad**: que el agente **no** lee mails, lo cual es cierto hoy porque `services/gmail.py`
  sólo cablea `gmail_send` (`SM-E2` le quitó «leer» a propósito).
- **Por qué es una ficha y no un detalle:** el texto es una **afirmación sobre el código** que vive
  lejos del código que la hace verdadera. El día que alguien cablee `gmail_read`, el catálogo va a
  seguir diciendo «no puede leerlos» y nadie se va a enterar — y al revés, si alguien «corrige» el
  texto a «leyé tus mails», no hay nada que lo frene. Es el patrón de la costura sin dueño: cada
  lado es correcto y la afirmación que los une no la verifica nadie.
- **DoD:**
  1. Test que ate el texto a la **capacidad real**: afirma «no puede leerlos» **si y sólo si** el
     cableado de Gmail no expone lectura. No un test que compare el string con una constante — eso
     afirma el síntoma, no el mecanismo, y sale verde aunque el cableado cambie.
  2. **Control positivo:** con `gmail_read` cableado a propósito, el test debe salir **rojo**. Sin
     esa corrida el test no se sabe si mide.
  3. Barrer el resto de `catalog.py`: **cuántos otros textos afirman una capacidad** y cuántos
     tienen test. El número va en el `cierre_`, aunque sea 0.
- **Tope:** no se reescriben los textos del catálogo en esta ficha. Lo que se agrega es el amarre.
### SM-N4 · `sin-issue` — Un rectángulo claro de esquinas rectas detrás del contenido de las cards del chat

- **Estado:** DOD-PARCIAL
- **Falta:** control del criterio v3: revertir la sombra de Row en Metro local y volcar la lista de capas con el rectangulo presente; repetir el toque sobre Tile
- **Cierre:** b87b4136be132829ba96c32e3f051b9849a4d4fc (#1393). Sombra con boxShadow y gradiente recortado en Tile; capas nombradas y capturas en 2026-11-02-sprint-correcciones-evidencia/SM-N4.md
- **Dueño:** frontend1
- **Medido:** frontend1 en device (`RF8T318RN9T`, canónico, 2026-11-02 15:38-15:45), en las cards de
  factura y de presupuesto: un rectángulo más claro detrás del contenido, con esquinas rectas que se
  salen del borde redondeado de la card. Se ve en `SM-H6-1-factura-emitida-con-cliente-y-mail.webp` y
  `SM-H5-2-recibo-con-importe-y-pendiente.webp` (rama `frontend1/sm-h5-h6-cards`).
- **⚠️ El primer paso del DoD es descartar el INSTRUMENTO, no diagnosticar el defecto.** Las dos
  evidencias son capturas de `screencap`, y `screencap` compone la pantalla por su cuenta: puede
  **fabricar** un borde que el ojo no ve (aplana capas, pierde el alfa de un vidrio, ignora el
  recorte del `borderRadius` del padre). Frontend1 fue explícita en que **no lo miró a ojo**. Si se
  entra a diagnosticar la sombra o `TarjetaPropuestaShell` antes de ese control, se puede pasar una
  sesión arreglando algo que en la pantalla no existe — y el «fix» va a parecer que funciona, porque
  la próxima captura también va a cambiar.
- **DoD:**
  1. **Control del instrumento — ⚠️ ENMIENDA DEL DoD, SEGUNDA VUELTA (planificación, 2026-11-02).**
     Dos redacciones anteriores estaban mal, y las dejo escritas porque el error importa más que el
     texto final:

     - **v1 pedía mirar la pantalla «a ojo», sin capturar.** No lo puede cumplir **ninguna sesión**:
       ninguna ve una pantalla, todo lo que llamamos «ver» pasa por un instrumento. Era un DoD cuyo
       único ejecutor posible era el operador, sin declararlo.
     - **v2 proponía cruzar `screencap` con `dumpsys SurfaceFlinger`, y FALLABA ABIERTA.** La regla
       «ninguna capa con esos bounds → artefacto» **absuelve siempre**: una `View` de React Native
       **no tiene capa propia** en SurfaceFlinger — sombra, gradiente y fondo se pintan en el único
       buffer de la app. La lista tiene una sola capa esté el rectángulo pintado o no, así que un
       defecto **real** salía clasificado como artefacto. Lo cazó frontend1, con la lista de capas
       ya medida en `SM-N4.md`. Es el patrón del guard que da luz verde justo en su caso de
       activación.

     **v3, el criterio que SÍ discrimina — diferencial de código con un solo instrumento.** Un
     artefacto de composición **no obedece a un cambio de estilo en un solo componente**:
     - con el primer cambio, el rectángulo **desapareció de `Tile` y siguió en `Row`**, en la misma
       captura y el mismo buffer;
     - al tocar `Row`, se fue de `Row`.

     Eso responde el punto 1: **el defecto era real y tenía causa en el código**, ya nombrada en el
     punto 2. El `screencap` no se descarta como instrumento — se usa con **dos estados del código**,
     que es lo que vuelve la medición diferencial.

     **Control de la propia v3** (frontend1, próxima tanda de device): revertir a propósito la sombra
     de `Row` en Metro local, sin commit, capturar y volcar la lista de capas **con el rectángulo
     presente**. Si apareciera una capa con esos bounds, v3 se cae y hay que volver a pensarlo.

     **Lo que v3 NO cubre, declarado:** que la pantalla **física** muestre algo distinto de ese
     buffer. Eso sólo lo ve el operador — y no era la hipótesis de la ficha, que temía lo inverso:
     que la captura **fabricara** el borde. Sin capa propia, `screencap` lee el mismo buffer que
     recibe el compositor, así que no hay una capa que aplanar mal.
  2. Sólo si está a ojo: comparar con el equivalente de documed (§3.ter) y nombrar la capa (sombra,
     vidrio del shell, o el recorte del padre) antes de tocar nada.
  3. Captura de device del antes y el después.
### SM-N5 · `sin-issue` — El recibo de presupuesto pierde importe y cliente al rehidratar, y el motivo documentado cubre sólo el estado

- **Estado:** DOD-PARCIAL
- **Falta:** captura de device de la card recargada con importe y cliente.
- **Cierre:** b64856dc356dc89984d5a259a8ff90a691966013 (#1401). El mensaje persiste el id, la card relee por id y muestra importe y cliente, el estado sigue sin mostrarse al rehidratar; test en TarjetaPresupuestoPropuesto.test.tsx y comentario corregido. mobile.sh 1530 verdes en el worktree y 6/6 jobs en CI (#1401).
- **Dueño:** frontend1
- **Medido:** frontend1 en device: en vivo la card dice `Presupuesto anotado — N° 3`,
  `$50.000 · Mostrador Device Verify` y `Pendiente · Doc listo para mandar`. Tras recargar queda sólo
  `Presupuesto anotado — N° 3`.
- **No es un olvido: está decidido en el código, y ahí está el defecto.**
  `apps/mobile/src/modules/chat/TarjetaPresupuestoPropuesto.tsx:86-87` lo dice: *«Sólo con el dato del
  backend: al rehidratar no se muestra, porque el presupuesto pudo haberse aprobado después y lo
  persistido en el mensaje es únicamente el número»*. El motivo es **correcto para el estado** —
  «Pendiente» puede haber cambiado solo — y **no aplica al importe ni al cliente**, que no cambian por
  su cuenta. El comentario mete los tres en la misma bolsa y, al declarar un motivo, **apaga la
  pregunta**: quien lo lee ve una decisión tomada, no un alcance por revisar.
- **⚠️ Medido por planificación (2026-11-02, contra `origin/main`) — la opción que frontend1 propuso
  primero NO tiene endpoint, y la otra tampoco es la correcta:**
  - «Que la card relea el presupuesto por su **número**» no se puede: `numero` es un **correlativo por
    tenant** (`presupuesto_store.py:265-278`, `max(numero)+1 WHERE cliente_id`), columna **distinta**
    de `id`. El endpoint de detalle es `GET /presupuestos/{presupuesto_id}` y toma el `id`
    (`presupuestos_web.py:329`). Releer por número exigiría un endpoint nuevo.
  - «Guardar importe y cliente en el mensaje» repite el defecto que el propio comentario evita: un
    snapshot miente igual que el estado el día que el presupuesto se edite.
  - **Lo que sí existe:** la respuesta de creación devuelve el `presupuesto` completo, con su `id`
    entero (`presupuestos_web.py:253-305`; `packages/core/src/api/presupuestos.ts:52-53`). Persistir
    el **`id`** junto al número y releer con el endpoint que ya está es una sola fuente de verdad, sin
    endpoint nuevo.
- **Esto NO necesita `contrato_`, y por eso no bajo uno.** Frontend1 lo pidió porque creía que tocaba
  la junta con backend; medido, no la toca: el dato ya viaja y el endpoint ya existe. Es app pura.
- **DoD:**
  1. El mensaje persiste el `id` del presupuesto además del número.
  2. Al rehidratar, la card relee por `id` y muestra importe y cliente. El **estado sigue sin
     mostrarse** al rehidratar — eso era correcto y no se cambia.
  3. Test que afirme la rehidratación con importe y cliente presentes y estado ausente.
  4. Captura de device: la card recargada con importe y cliente.
- **Y corregir el comentario `:86-87`** para que su motivo nombre sólo el estado. Un comentario que
  declara un motivo más amplio que el que lo justifica es lo que hizo que esto viviera sin pregunta.
### SM-N6 · `sin-issue` — «Presupuestos» se parte en dos líneas en la casilla del escritorio

- **Estado:** DOD-PARCIAL
- **Falta:** captura de device a 390 px y comprobar en device un rotulo de prueba igual o mas largo: el ancho real del texto no se mide en jest.
- **Cierre:** b64856dc356dc89984d5a259a8ff90a691966013 (#1401). Arreglo en la casilla y no en el rotulo, rotulo a 13 px sin cortar. mobile.sh 1530 verdes en el worktree y 6/6 jobs en CI (#1401).
- **Dueño:** frontend1
- **Medido:** frontend1 en device al capturar `SM-G4`: la casilla de Funciones muestra «Presupuesto» y
  abajo «s». Se ve en `SM-G4-1-mas-0-3s.webp`. El rótulo es el `label: 'Presupuestos'` de
  `apps/mobile/src/modules/escritorio/EscritorioFunciones.tsx:111` — **verificado por planificación
  contra `origin/main`**, y este componente es de los que **NO** están duplicados en
  `apps/copiloto-web/` (única copia, con su `.test.tsx` al lado), así que el hallazgo de las seis
  copias dobles del `contrato_` del sprint no aplica acá.
- **Por qué lleva ficha aunque sea una línea:** es el rótulo más largo de la grilla, así que es el
  **canario del ancho de la casilla**, no un caso suelto. Arreglarlo bajando el tamaño de fuente de
  esa casilla sola tapa el síntoma y deja al próximo rótulo largo en la misma trampa.
- **DoD:**
  1. «Presupuestos» entra en una línea a 390 px.
  2. El arreglo es de la **casilla**, no de ese rótulo: se verifica con un rótulo de prueba igual o
     más largo, y la grilla no se rompe.
  3. Captura de device a 390 px.
### SM-N7 · `sin-issue` — Cuatro descripciones del catálogo afirman una capacidad de ESCRITURA sin test que la ate

- **Estado:** TERMINADO
- **Cierre:** 37e9e851 atadas al cableado 6/6 (test_catalogo_descripcion_afirma_escritura, 37e9e851, VPS 35 passed)
- **Dueño:** backend
- **Medido por backend en el barrido de `SM-N3`** (punto 3 de su DoD, sha `99097d83` / #1359): en
  `apps/copiloto/backend/catalog.py` **6 descripciones afirman una capacidad**; tras esa ficha **2 de
  6** quedan atadas a nivel texto (lectura: Gmail niega, Docs afirma). Las **4 restantes son
  escrituras, cubiertas sólo por `alcance`** — es decir por el permiso, no por el texto.
- **Por qué es ficha y no una nota al pie de `SM-N3`:** `SM-N3` cerró con su DoD completo y su tope
  explícito («no se reescriben los textos; lo que se agrega es el amarre»). El hueco que su barrido
  **midió** es otro sujeto, y un hallazgo no reabre un ✅. Si queda dentro del `cierre_` de `SM-N3`,
  muere ahí: un `cierre_` es un entregable y nadie lo persigue.
- **Y el riesgo no es simétrico con el de lectura.** `SM-N3` ató el caso en que el texto **niega** una
  capacidad; estas cuatro **afirman** que el agente escribe. `alcance` frena la acción, pero no frena
  que el texto le prometa al emprendedor algo que el cableado no hace — y una promesa de escritura
  incumplida se descubre con el efecto esperado ausente, sin error que la delate.
- **DoD:**
  1. Las 4 descripciones de escritura atadas al **mecanismo** (`TOOLS`−`WRITE_OPS`, como en `SM-N3`),
     no a una constante.
  2. **Control positivo en las dos direcciones** por cada una, como ya se hizo en `SM-N3`: descablear
     la operación ⇒ rojo; afirmar una capacidad no cableada ⇒ rojo.
  3. Corrida en el VPS con la salida adjunta, y el conteo final (`6/6` atadas, o el número real con el
     motivo de lo que quede afuera).
### SM-N8 · `sin-issue` — El `reply_text` de la aprobación hace eco de la consigna interna: el emprendedor lee la instrucción dirigida al modelo

- **Estado:** TERMINADO
- **Cierre:** bd7c82fc baseline 7/12 -> 0/12 con N=12; observacion sin consigna (bd7c82fc, desplegado)
- **Dueño:** backend
- **Medido por backend** mientras cerraba las mitades de `SM-H5` (#1363, `681c3b53`), y reportado
  **sin parchar**, que fue lo correcto: la respuesta de la aprobación **a veces** repite la consigna
  interna, del tipo «Confirmáselo en una línea corta».
- **Por qué no es cosmético.** Lo que se filtra no es un texto raro: es una **instrucción dirigida al
  modelo**, en imperativo y en segunda persona. El emprendedor no lee un error — lee el andamiaje, y
  una frase que le ordena algo a alguien que no es él. Rompe la voz del producto en el único momento
  en que el sistema le confirma que su plata se registró, que es donde la confianza se gana o se
  pierde. No hay excepción ni log: sale como si fuera la respuesta.
- **Por qué lleva ficha y no queda en el `cierre_` de `SM-H5`:** esa ficha cerró su mitad de backend
  con su DoD cumplido. Un hallazgo no reabre lo cerrado, y un `cierre_` es un entregable: nadie lo
  persigue. Es el mismo caso que `SM-N7`.
- **⚠️ Es INTERMITENTE, y eso decide el instrumento.** Backend escribió «a veces». Un defecto
  intermitente **no se verifica con una corrida**: una sola salida limpia no distingue «arreglado» de
  «esta vez no apareció», y es exactamente la forma que fabrica una excusa lista («fue el flake»).
  Hace falta una **sonda con N declarado** y la tasa del antes y el después — como la sonda de 12 que
  ya se usó en `SM-N1`/`SM-N2` y las de 6 de este mismo cierre.
- **DoD:**
  1. **Tasa del baseline** con N declarado (≥10 aprobaciones reales), contando cuántas respuestas
     contienen rastro de la consigna. El número va escrito, aunque sea bajo.
  2. Causa nombrada: **dónde** la consigna entra al texto que se devuelve. Si resulta ser otra vez la
     jerarquía *observación > descripción* —el patrón que ya se pagó en `SM-N2`— el fix es sacar la
     consigna de donde el modelo la lee como contenido, **no** pedirle en la descripción que no la
     repita.
  3. Sonda posterior con **el mismo N** y la tasa final. Un «0 de 6» tras un baseline de 12 no es
     comparable: el instrumento tiene que ser el mismo a los dos lados.
  4. Corrida en el VPS con la salida adjunta.
- **Tope:** no se reescribe la voz de las confirmaciones en esta ficha. Lo que se arregla es la fuga.
### SM-N9 · `sin-issue` — El encabezado de Ajustes: el mapa pide el nombre comercial y ESE dato SÍ existe

- **Estado:** TERMINADO
- **Cierre:** 545a5dc7 (#1371) + bfa7b919 (#1376). DoD 1-3: Ajustes lee perfilNegocio.nombreComercial, vacio/blanco/error sin etiqueta, 3 tests. DoD 4: captura de device (RF8T318RN9T, canonico) docs/copiloto-emprendedor/2026-11-02-sprint-correcciones-evidencia/SM-N9-ajustes-encabezado-con-nombre-comercial.webp
- **Dueño:** frontend2
- **De dónde sale:** frontend2 lo nombró al corregir el mapa por la enmienda de `SM-K5` (#1368,
  `c5186d47`) y **no lo cargó por su cuenta** — preguntó. Correcto: la corrección del mapa estaba
  avalada para lo que `/me` no trae, no para esto.
- **Lo medido (planificación, 2026-11-02, contra `origin/main`).** El comentario de
  `apps/mobile/src/modules/ajustes/PantallaAjustes.tsx:123-125` declara que el encabezado
  «El Galpón · Martín Cairo» necesita **dos** datos: el nombre comercial (`perfilNegocio`, *«una
  lectura aparte»*) y el nombre de la **persona**, que `/me` no trae. Son de distinta naturaleza y la
  enmienda los trató juntos:
  - el nombre de la **persona** no existe — `me_contrato.py` declara 9 claves y ninguna es ésa. Ahí
    la enmienda es correcta y el mapa ya quedó corregido.
  - el **nombre comercial sí existe**: `nombreComercial` es campo de `PerfilNegocio`
    (`packages/core/src/api/perfilNegocio.ts:43`, desde `nombre_comercial` en `:82`/`:112`), y la app
    ya tiene la pantalla que lo consume (`modules/ajustes/negocio/PantallaPerfilNegocio.tsx`).
- **Por eso queda divergencia, y es la mitad que el mapa conservó.** Frontend2 dejó el mapa pidiendo
  «El Galpón» en el encabezado de Ajustes, y la app hoy **no hace esa lectura**. El motivo escrito en
  el código no es imposibilidad: es **«una lectura aparte»**, o sea costo. Un motivo de costo y uno de
  dato inexistente conviven en el mismo comentario, y al leerse juntos el segundo le presta su
  autoridad al primero — así es como una decisión de costo queda registrada como imposible.
- **DoD:**
  1. El encabezado de Ajustes muestra el nombre comercial leído de `perfilNegocio`.
  2. El caso **vacío** resuelto explícitamente: `nombreComercial` cae a `''` (`perfilNegocio.ts:112`),
     así que hay que decidir y probar qué se ve sin nombre cargado — no un encabezado con un hueco.
     El emprendedor nuevo es el caso normal, no el borde.
  3. Test que afirme las dos ramas (con nombre y sin nombre).
  4. Captura de device del encabezado con el nombre.
- **Lo que esta ficha NO hace:** el nombre de la **persona**. Ese no existe y el mapa ya fue
  corregido; si alguna vez se agrega, es otra ficha con su `pedido_` al backend.
- **Los puntos 1-3 NO necesitan el teléfono.** Sólo el punto 4. Es trabajo hacedero mientras el device
  está tomado.

### SM-N10 · `sin-issue` — La barra de estado del sistema es ilegible, y el canónico NO la resuelve

- **Estado:** TERMINADO
- **Cierre:** 21cebf5a96614d0dc4f791bb51fb0a6e47c0a44c (#1390). BarraEstado montada en app/_layout.tsx, con test. Device RF8T318RN9T con el telefono en modo noche: Claro da iconos oscuros, Oscuro da iconos claros. Evidencia: docs/copiloto-emprendedor/2026-11-02-sprint-correcciones-evidencia/SM-N10-N11.md
- **Dueño:** frontend1
- **De dónde sale:** frontend1 al capturar `SM-I1` (íconos claros sobre fondo crema). Pidió ficha o
  exclusión en vez de arreglarlo por su cuenta.
- **Lo medido (planificación, 2026-11-02, contra `origin/main`).** Tenía razón, y con un matiz que
  cambia cómo se hace:
  - **cero** `StatusBar` / `expo-status-bar` en los 257 `.tsx` de `apps/mobile` (control positivo:
    el mismo grep sí encuentra `NavigationBar` en `apps/mobile/app/_layout.tsx`).
  - **documed tampoco la tiene**: `statusbar` en `documed-front/apps/mobile` aparece sólo dentro de
    `node_modules/react-native-gesture-handler`. O sea que el canónico resolvió la barra de **abajo**
    (`NavigationBar`, que acá ya está portada) y **nunca** la de arriba.
- **Por eso esta ficha dice el método explícito:** acá **no hay nada que portar**. Es la excepción a
  §3.ter, y nombrarla evita el peaje inverso — buscar en documed un archivo que no existe y leer el
  vacío como «ya está resuelto allá».
- **DoD:**
  1. `StatusBar` con el estilo que contraste sobre el fondo crema, en el shell (un solo lugar).
  2. Decidido y probado el **tema oscuro** si existe: un `style` fijo ilegible en el otro tema es el
     mismo defecto espejado.
  3. Captura de device con los íconos legibles.

### SM-N11 · `sin-issue` — El detalle de comprobante pinta `2026-11-12` y `100.0` crudos: el formateador YA existe y ese call-site lo saltea

- **Estado:** TERMINADO
- **Cierre:** 21cebf5a96614d0dc4f791bb51fb0a6e47c0a44c (#1390). DetalleComprobante formatea fechaEmision, total y tambien caeVto, que la ficha no citaba; con test. Device: 12 nov 2026, 2 nov 2026, $100,00. Evidencia: docs/copiloto-emprendedor/2026-11-02-sprint-correcciones-evidencia/SM-N10-N11.md
- **Dueño:** frontend1
- **De dónde sale:** frontend1 al capturar `SM-I1`.
- **Lo medido (planificación, 2026-11-02, contra `origin/main`).** No es un formateador que falte
  —es **un call-site que no lo usa**:
  - `apps/mobile/src/modules/facturacion/DetalleComprobante.tsx:176-177` pasa `c.fechaEmision` y
    `c.total` **sin formato** a `<Dato valor={…}>`, y el archivo **no importa** ningún formateador
    (sus imports son `:29-39`).
  - `formatearImporte`, `formatearFechaCorta` y `formatearFechaLarga` ya existen en
    `packages/core/src/dinero/formatoDinero.ts:84,148,156` y los usan **27** archivos de la app.
  - El gemelo más cercano formatea **el mismo campo del mismo comprobante**:
    `facturacion/etiquetasComprobante.ts:69` → `formatearImporte(c.total)`.
- **Por eso el fix es propagar, no diseñar.** Y la pregunta que el DoD obliga a contestar es cuál de
  los dos de importe: `formatearImporte` o `formatearImporteSinCentavosCero` (`:112`, el que ya usa
  `facturacion/comprobante.tsx:68`). Dos formateadores para el mismo número es la asimetría que hay
  que resolver mirando qué pide la pantalla, no la que esté más a mano.
- **DoD:**
  1. `:176-177` formateados con los formateadores de `@copiloto/core` — sin un formateador nuevo y
     sin formatear dos veces el mismo valor.
  2. Test que afirme el texto RENDERIZADO (no el campo crudo), en `DetalleComprobante.test.tsx`.
  3. Captura de device del detalle.
- **Los puntos 1-2 NO necesitan el teléfono.** Sólo el 3.

### SM-N13 · `sin-issue` — 🚫 FUERA DEL SPRINT — La consigna de N8 sigue viva en DOS observaciones más: el fix existe y no viajó

- **Estado:** TERMINADO
- **Cierre:** 7811aad1 consigna fuera de las 6 observaciones restantes; test AST; sonda Mi dia N=12 6/12 -> 0/12 (desplegado)
- **Dueño:** backend
- **Fuera del denominador, a propósito:** igual que `SM-N12`. El sprint se mide contra el mapa del
  16-10 y esto salió de arreglar `SM-N8` hoy, no del mapa (`DEC-18`: un criterio que crece con cada
  medición no se puede alcanzar). Tiene id porque un hallazgo que sólo vive en un `cierre_` no vuelve
  a aparecer — y porque la cola de backend quedó vacía, así que se puede tomar YA.
- **Medido (2026-11-02, sobre `origin/main`):** `git grep -n "Confirmáselo en una línea corta"` da
  **3** hits en `apps/copiloto/tool_catalog.py` y 1 en el test:
  - `:1303` → **vivo**
  - `:1750` → **vivo**
  - `:1366` → ya arreglado por `SM-N8` (#1383), con el comentario que explica por qué
  - `tests/test_plata_por_voz.py:369` → el test de N8, que nombra la consigna: es el control, no un defecto
  Control positivo del instrumento: el hit arreglado (`:1366`) aparece en el mismo grep, así que el
  patrón **sí** caza la forma viva.
- **Por qué no es cosmético:** N8 lo midió con sonda, no con criterio. Baseline N=12 → **7/12 con
  eco**; sacando la consigna, **0/12**. Las dos que quedan están en observaciones que el emprendedor
  lee igual de seguido (por lo que el `cierre_` de backend nombra: registrar cobro, cancelar factura,
  Mi día), así que el eco sigue llegando al usuario por otra puerta.
- **Es PROPAGACIÓN, no diseño.** El fix ya existe en otro call-site: se borra la línea, igual que en
  `:1366`, y se le pone el mismo comentario explicando por qué no vuelve. No hay decisión que tomar.
- **DoD binario:**
  1. `git grep -c "Confirmáselo en una línea corta" -- apps/copiloto/tool_catalog.py` = **0**.
  2. El test de N8 (`test_plata_por_voz.py:369`) extendido a los dos call-sites nuevos, o uno
     equivalente que falle si la consigna vuelve a cualquiera de los tres. **Un test que afirme el
     síntoma no sirve**: tiene que ser rojo si el mecanismo se rompe.
  3. La misma sonda de N8 (N=12) sobre **una** de las dos observaciones tocadas: eco esperado **0/12**,
     con el baseline citado.
  4. Corrido en el **VPS** (regla 2 del `CLAUDE.md`), con el conteo pegado en el `cierre_`.
- **No necesita device.** Es backend puro.

### SM-N14 · `sin-issue` — 🚫 FUERA DEL SPRINT — El resumen de Gastos dice «Gastado en 1 nov»: un período formateado como día, y el comentario declara el paliativo como solución

- **Estado:** TERMINADO
- **Cierre:** 21cebf5a96614d0dc4f791bb51fb0a6e47c0a44c (#1390). ResumenMes mobile y web usan formatearMesDePeriodo; assert negativo de 1 nov, rojo medido en los dos y verde con el fix. grep formatearFechaCorta = 0 en los dos archivos. Suites: core 0, web 0, mobile 1498 verdes.
- **Dueño:** frontend1 (reportado por frontend1 al capturar, 2026-11-02) — **sin device**, se toma al
  soltar el teléfono, después de `SM-N11` y `SM-N10`.
- **Fuera del denominador, a propósito:** como `SM-N12`/`SM-N13`. Salió de una captura de hoy, no del
  mapa del 16-10 (`DEC-18`). Tiene id porque un hallazgo que sólo vive en un `dato_` no vuelve a
  aparecer.
- **No es criterio de planificación: el contrato ya existe y el código lo contradice.**
  `apps/mobile/src/theme/BloqueCifra.tsx:32` documenta el ejemplo como «Gastado en **agosto**» y
  `BloqueCifra.test.tsx:13` usa el literal `"Gastado en agosto"`. El rótulo correcto es el **nombre
  del mes**.
- **Medido (2026-11-02, `origin/main`):**
  - `apps/mobile/src/modules/gastos/ResumenMes.tsx:39` → `Gastado en ${formatearFechaCorta(resumen.periodo)}`
  - `apps/copiloto-web/src/modules/gastos/ResumenMes.tsx:25` → **el mismo defecto, segunda vez**
  - `packages/core/src/dinero/formatoDinero.ts:152` → `formatearFechaCorta` devuelve
    `${p.dia} ${MESES_CORTOS[p.mes]}`, así que con un período `"YYYY-MM"` **siempre** dice «1 nov».
    Hace lo que promete: está mal elegida.
- **La función que falta YA EXISTE — no hay nada que diseñar:** `formatearMesDePeriodo`
  (`packages/core/src/dinero/formatoDinero.ts:174`). Se cambia la llamada en los **dos** call-sites.
- **Y el hallazgo que vale más que el bug:** el comentario de `ResumenMes.tsx:37-38` declara que
  «`formatearFechaCorta` ya resuelve un período sin día como su día 1». Es **verdad** y es
  exactamente el defecto: declara el paliativo como si fuera la solución, y por eso nadie volvió a
  mirarlo. Al arreglarlo, el comentario se **reemplaza** por el motivo real (un período se formatea
  como mes), no se borra: un comentario que dice «ya está resuelto» apaga la búsqueda del próximo.
- **DoD binario:**
  1. Los **dos** call-sites usan `formatearMesDePeriodo`. Control: `git grep -c "formatearFechaCorta"`
     en los dos `ResumenMes.tsx` = **0**. Arreglar uno solo no cuenta (son gemelos).
  2. Un test por call-site que falle si vuelve el día: período `"2026-11"` → el rótulo contiene
     `noviembre` y **no** contiene `"1 nov"`. El assert negativo es obligatorio — sin él, el test
     pasa igual con el formateador viejo si el mes acierta.
  3. El comentario de `:37-38` reemplazado por el motivo real.
  4. Corrido donde corresponde (`scripts/ci/core.sh` + `web.sh`), con el conteo en el `cierre_`.
- **No necesita device:** es código + test. La captura de Gastos ya existe, del relevamiento.

### SM-N15 · `sin-issue` — SEGUNDO usuario de prueba: no-admin y tenant VACÍO (decisión del operador, 2026-11-02)

- **Estado:** TERMINADO
- **Cierre:** 1fe1b83f usuario e2e-vacio no-admin y tenant vacio; adversarial 403 admin y 404 cross-tenant; control positivo canonico 3/4/14/40
- **Dueño:** backend (provisión) — **desbloquea `SM-K1` y `SM-J3`**
- **Decisión del operador (2026-11-02), textual:** *«creamos segundo usuario de prueba»*. Es la
  respuesta a la pregunta MAYOR que planificación escaló: si un usuario canónico único alcanza para
  probar controles que dependen del **rol** o de la **sesión**. Respuesta: **no alcanza**.
- **Por qué el usuario del operador NO sirve para estas dos, aunque sí sirve para otras tres.** El
  operador ofreció su propio usuario y destraba `SM-H3` (Gmail conectado), `SM-J4` (clientes reales
  con y sin facturas) y `SM-K6` (invalidación de sesión; con el canónico el logout está prohibido).
  Pero `SM-K1` y `SM-J3` necesitan lo **contrario**: **menos** privilegios (no-admin) y **menos**
  datos (tenant vacío). Un usuario más completo no puede encarnar un estado más pobre. Ésa es la
  forma del problema, y es la razón por la que el número de disparadores sin dueño fue 1 → 3 → 4 →
  5 → 6 en un día: cada captura destapaba otro estado del tenant que el único canónico no podía ser.
- **Lo que NO cambia: el canónico sigue siendo `e2e-device@copiloto.test`.** Esto es una **ampliación
  por ficha**, no un reemplazo — la orden «un solo usuario canónico, a fuego» sigue vigente para todo
  lo demás, y sigue PROHIBIDO crear usuarios de prueba ad-hoc. El segundo usuario existe para las dos
  fichas que lo nombran, se documenta en el mismo lugar que el canónico, y cualquier uso fuera de
  `SM-K1`/`SM-J3` es MAYOR y vuelve al operador.
- **DoD binario:**
  1. Un usuario de prueba creado con **rol no-admin** y **tenant propio y vacío** (cero clientes,
     cero comprobantes, cero gastos). Control positivo: una consulta que muestre los conteos en cero
     **y** que el canónico los tenga distintos de cero — si los dos dan vacío, el instrumento mira
     mal.
  2. **Su password NUNCA en el repo trackeado ni en la memoria**, igual que el canónico: va a
     `.env.e2e`. El repo es **público**.
  3. El rol no-admin **verificado con un test adversarial**, no por configuración: el usuario intenta
     la acción de admin y recibe denegación (regla dura del `CLAUDE.md` — un control de autorización
     sin test adversarial es un control no verificado; ADR-013, BOLA/OWASP API1:2023). Sin ese test
     la ficha queda `[UNVERIFIED]` y **no** desbloquea `SM-K1`.
  4. Aislamiento cross-tenant ejercitado: el usuario nuevo pide un recurso del canónico y **no** lo
     obtiene.
  5. Documentado donde está documentado el canónico, con **para qué dos fichas existe** y la frase de
     que todo otro uso es MAYOR.
- **No necesita device** para la provisión. El device entra después, en `SM-K1` y `SM-J3`.

### SM-N12 · `sin-issue` — FUERA DEL SPRINT: el toque de un botón dentro de la tarjeta dispara también el toque de la tarjeta

- **Estado:** PENDIENTE
- **Dueño:** frontend1 (**después** del sprint)
- **De dónde sale:** frontend1, cuarto hallazgo al capturar `SM-I1`: tocar `Revisarla` o `Borrar`
  dentro de la tarjeta también activa el gesto de la tarjeta, y al volver queda cerrada.
- **Por qué queda FUERA y eso no es descartarla.** Este sprint mide **divergencias mapa ↔ app**, y
  esto no es una: el mapa no dice nada al respecto y, como frontend1 midió, **viene de antes** — no
  lo introdujo ninguna ficha de esta tanda. Meterla adentro movería el denominador del sprint, que
  es justo el defecto ya pagado: un criterio que crece con cada medición no se puede alcanzar
  (`DEC-18`).
- **Queda registrada acá y no suelta en un mensaje** para que tenga id y pueda marcarse cuando se
  tome. Un hallazgo que sólo vive en un `cierre_` no vuelve a aparecer.
- **DoD (cuando se tome):** antes de tocar el gesto, la skill `swmansion-rn-gestures` —composición
  Pan/tap y propagación en contenedores— es la fuente del criterio; es el mismo gate que ya evitó
  dos iteraciones a ciegas sobre el panel de Apps. Después: el fix, un test del toque del botón
  que NO cierre la tarjeta, y la corrida en device con `adb input motionevent` (DOWN/MOVE/UP).

### SM-N16 · `sin-issue` — El Escritorio de Funciones no tiene acceso a Ajustes, y sin él no se puede cerrar sesión

- **Estado:** DOD-PARCIAL
- **Falta:** DoD 4 corrida en device con el canonico hasta cerrar sesion; DoD 5 captura del avatar visible y par antes/despues del toque, comparando la region y no la captura entera; DoD 6 causa del no-responde: con MOVE no navego a las 19:05 en la cuenta del operador, y si navego a las 17:54 y 18:29 en el canonico, asi que falta medir que difiere: puerta de empujarUnaVez (tocar un tile en el mismo estado), cuenta o bundle. El dibujo va en la rama de SM-I5.
- **Cierre:** b64856dc356dc89984d5a259a8ff90a691966013 (#1401). Avatar del escritorio por el mismo alAjustes de Mi dia, sin segundo call-site; PantallaPrincipal.test.tsx da rojo con el mutante sin el cable. mobile.sh 1530 verdes en el worktree y 6/6 jobs en CI (#1401).
- **Dueño:** frontend1
- **De dónde sale:** el **operador**, 2026-11-02, atrapado dentro de la app con su propia cuenta:
  «en la pantalla funciones no está el icono de ajustes de usuario… no puedo cerrar la sesion a mano».
- **Medido (no es impresión).** El **único** acceso a Ajustes de toda la app es el avatar de cuenta
  de la portada: `AvatarCuenta avisa={conexionCaida} onPress={onAjustes}`
  (`apps/mobile/src/modules/midia/PantallaMiDia.tsx:729`), alimentado desde
  `PantallaPrincipal.tsx:231` (`onAjustes={() => empujarUnaVez('/ajustes')}`). El grep de
  `onAjustes` en todo `apps/mobile/src` devuelve **sólo** esas dos definiciones y sus usos en
  `PantallaMiDia`; `EscritorioFunciones` no lo recibe ni lo pinta. O sea: **el ícono no «falta en
  una pantalla», existe en una sola y el escritorio es otra.**
- **Por qué es una ficha y no una molestia.** El único camino a cerrar sesión pasa por ahí:
  `PantallaCuenta.tsx:223-224` («Sí, cerrar sesión» → `logout`). Con el panel de Funciones abierto,
  salir de la sesión depende de volver a la portada; para quien no sabe que el avatar es la puerta,
  la app **no tiene** salida visible. Es un callejón de navegación, no una divergencia estética.
- **Salidas que SÍ existen hoy** (verificadas, para no inventar urgencia): el botón atrás de Android
  cierra el panel (`PantallaPrincipal.backHandler.test.tsx`), y el deep-link
  `copiloto://ajustes-cuenta` entra directo (scheme en `apps/mobile/app.json:5`, ruta
  `apps/mobile/app/ajustes-cuenta.tsx`). Las dos requieren **saberlas**, que es exactamente lo que
  la ficha corrige.
- **FUERA DEL SPRINT en cuanto al denominador** (`DEC-18`): este sprint mide divergencias mapa ↔ app
  y ésta no sale del mapa, sale del uso. Se registra con id para que pueda marcarse; no mueve el
  54.
- **DoD:**
  1. El Escritorio de Funciones ofrece acceso a Ajustes. Antes de elegir la forma, **leer el
     equivalente en `documed-front`** (regla §3.ter) y el mapa: si el prototipo ya resuelve dónde va,
     gana el prototipo; si no dice nada, la decisión se escribe en el código como comentario con su
     motivo, no se deja implícita.
  2. **No duplicar el handler.** `onAjustes` ya existe en el shell: se **propaga** a
     `EscritorioFunciones`, no se escribe un segundo `router.push('/ajustes')` — un mismo destino con
     dos call-sites es el patrón que este repo ya pagó (el fix llega a uno solo).
  3. Test que **sea rojo si el acceso desaparece**: desde el escritorio, el toque navega a `/ajustes`.
     Un test que sólo afirme que el componente monta no acredita nada.
  4. Corrida en device con el usuario canónico: entrar al escritorio, llegar a Ajustes → Cuenta y
     **ver** el botón de cerrar sesión, sin pasar por la portada. Captura.
- **⚠️ CORREGIDO — MEDIDO EN DEVICE 2026-11-02 18:57, y es PEOR que lo que decía el código.** Yo
  había deducido de `PantallaMiDia.tsx:729` que «el acceso existe en la portada y falta en el
  escritorio». El operador, mirando la pantalla, insistió en que **no hay ningún avatar**. Tenía
  razón, y la captura por ADB lo fija:
  1. **El avatar se pinta INVISIBLE**: círculo del mismo color que el fondo, **sin iniciales**,
     apenas un punto (esquina superior derecha de Mi Día). Está en el árbol y no se lee como botón.
  2. **Y tampoco responde**: un `adb input motionevent` DOWN/UP exacto sobre sus coordenadas
     (650,150) **no navegó** — captura idéntica antes y después.
  3. El deep-link `copiloto://ajustes-cuenta` **sí** entra (verificado); cae en el grid de Ajustes,
     de ahí «Mi cuenta» → «Cerrar sesión» visible.
  Por qué importa la corrección y no es un matiz: con el diagnóstico viejo el fix era *agregar* el
  acceso al escritorio, y eso **habría dejado la portada igual de rota**. El defecto de la portada
  es de RENDER y de TOQUE, no de ausencia. Son dos fallas, y una ficha que nombra una sola deja la
  otra viva. Lección: el operador frente a la pantalla midió mejor que mi grep — el código decía
  dónde está el componente, no si se ve ni si funciona.
- **DoD ampliado por lo anterior:**
  5. El avatar de la portada **se ve** (contraste contra el fondo) y **navega** al tocarlo,
     ejercitado con `adb input motionevent` DOWN/UP y captura antes/después que difieran. Una
     captura sola no acredita: el control es el PAR.
  6. Averiguar **por qué** no respondía antes de cambiar nada — si es el gesto del panel
     comiéndose el toque, la skill `swmansion-rn-gestures` (composición Pan/tap) es la fuente del
     criterio, no la intuición. Dos intentos fallidos ⇒ el tercero es leer la skill.
- **🔬 REVERIFICADO 19:05 — el «no responde» estuvo a punto de ser MÍO, y el control lo salvó.**
  El primer veredicto («el avatar no navega») salió de un `motionevent` DOWN+UP **sin MOVE**.
  Minutos después, el tile «Apps conectadas» **tampoco** respondía a ese mismo tap y **sí** respondió
  al agregarle un `MOVE` de 1 px. O sea: mi instrumento no activaba ningún control, y yo había
  escrito que el defecto era del avatar. **Control positivo conseguido** (dos controles ajenos que
  abren con MOVE: «Apps conectadas» y «Mi cuenta»), repetida la prueba sobre el avatar **con** MOVE:
  **sigue sin navegar**. El veredicto se sostiene, pero ahora está acreditado y antes no lo estaba.
- **🧪 Y el control que usé primero era malo:** comparé capturas por hash de pantalla COMPLETA y dio
  «CAMBIO» cuando lo único que cambió fue **el reloj** (19:04 → 19:05). Un reloj en la barra de
  estado mueve el hash de cualquier captura: **comparar por hash total siempre dice que cambió**.
  Para acreditar un toque hay que comparar **la región** que debería cambiar, o un elemento
  concreto. Queda anotado acá porque es trampa de instrumento, no de esta ficha.
- **Sospecha para quien lo arregle (no verificada):** el avatar vive en la franja superior, que es
  zona del panel deslizable; un Pan que se come el tap es exactamente el caso de
  `swmansion-rn-gestures`. Es hipótesis, no hallazgo — medila antes de codear.

### SM-N17 · `sin-issue` — FUERA DEL SPRINT: la app avisa que «se cayó la conexión con Instagram», y Instagram no existe como servicio

- **Estado:** DOD-PARCIAL
- **Falta:** Captura de device que confirme que el aviso de conexion caida de Instagram ya no aparece. Se agrupa con SM-N18, que mide lo mismo desde el otro lado.
- **Cierre:** 8378d53d (#1425, ancestro de origin/main): Instagram deja de tener icono en mobile y web, con test rojo si vuelve. FUERA DEL SPRINT (DEC-18): no mueve el denominador del 54.
- **Dueño:** frontend1 (UI) — con una pregunta previa para backend, abajo
- **De dónde sale:** el **operador**, 2026-11-02, logueado con su cuenta: en Mi Día le aparece un
  aviso de conexión caída de Instagram, y su reacción fue la correcta — «Instagram ya no forma parte
  de las apps a conectar, no sé por qué figura esto».
- **Medido, y el código le da la razón de forma incómoda.** `service_risk_contrato.py:18` lo dice
  textual: «Instagram NO está ahí -- cero módulo, cero tool». Y `:4-6` registra que esto **ya pasó
  una vez**: el prompt ofrecía «ver contactos y redes» cuando «HubSpot e Instagram ni existían como
  tool» (`system_prompt.py:33` lo repite: «un agente que ofrece algo inexistente hace…»). O sea: la
  clase de defecto está documentada y cazada **en el prompt**, y sobrevivió **en la UI**.
- **Dónde sigue cableado:** `apps/copiloto-web/src/design-system/serviceIcons.tsx:64` ·
  `apps/mobile/src/modules/apps/PantallaApps.tsx:69` (`instagram: 'grabar'`) ·
  `packages/core/src/chat/hitl.ts:91` (badge `IRREVERSIBLE`, `tono: danger`) ·
  `tool_catalog.py:80` y `conversation_workflow.py:659` lo nombran como ejemplo de badge de riesgo.
- **Por qué no es cosmético.** Un aviso de «conexión caída» es una llamada a la acción: manda al
  emprendedor a reconectar algo que no se puede conectar. Y el badge `IRREVERSIBLE` de `hitl.ts:91`
  está reservado para acciones que no se pueden deshacer: tenerlo vivo para un servicio inexistente
  gasta la señal más cara de la app en un fantasma.
- **PREGUNTA PREVIA, para backend, ANTES de que frontend1 toque nada:** ¿de dónde sale el aviso?
  Puede venir (a) de un registro de conexiones en la DB del tenant que todavía lista `instagram`, o
  (b) del catálogo del front. **Son fixes opuestos** — borrar el ícono del front deja el registro
  vivo y el aviso puede volver por otra vista; limpiar la DB sin sacar el catálogo deja el camino
  abierto a que se re-cree. Medirlo es barato y decide el dueño del fix. Hasta que esté medido,
  frontend1 **no** implementa.
- **✅ CONTESTADA 2026-11-02, y era (c): ninguna de las dos.** No sale de un registro de la
  DB del tenant ni del catalogo del front: sale de **Composio en vivo** — `serve.py:268` →
  `conexiones_salud.composio_caidos` (toolkit `EXPIRED` sin `ACTIVE`) →
  `mi_dia_detector._evaluar_conexion_caida`, y queda persistido como tarjeta en
  `copiloto_mi_dia_tarjetas`. Medido por backend read-only (ver `SM-N18`, que es la raiz y ya
  tiene su fix `0046ded4`: filtro por `toolkits_conectables`). **frontend1 YA puede
  implementar**: el bloqueo de esta linea quedo vencido el mismo dia en que se escribio, y
  nadie lo bajo a la ficha hasta ahora — una pregunta previa contestada que sigue diciendo «no
  implementa» es un bloqueo fantasma.
- **FUERA DEL SPRINT** (`DEC-18`): no sale del mapa, sale del uso. El 54 no se mueve.
- **DoD:**
  1. Medido de dónde sale el aviso (la pregunta previa), escrito con `path:línea` o con la consulta
     que lo mostró.
  2. Instagram deja de ofrecerse y deja de avisar, en **las dos** superficies — mobile y web: el
     mismo defecto vivía dos veces ya es patrón conocido de este repo.
  3. Un test que sea **rojo si Instagram vuelve a aparecer** como servicio ofrecible. Sin eso, el
     próximo que agregue una key al catálogo lo revive sin enterarse — que es exactamente cómo
     sobrevivió a la limpieza del prompt.
  4. Si el fix toca la DB del tenant: corrida en device con la cuenta del operador mostrando que el
     aviso ya no está. Esa cuenta es la que lo reportó, así que es la que lo acredita.

### SM-N18 · `sin-issue` — FUERA DEL SPRINT: `composio_caidos` avisa de CUALQUIER toolkit que Composio liste, soportado o no

- **Estado:** TERMINADO
- **Cierre:** 0046ded4 filtro por toolkits_conectables (fuente unica, tests 2 mitades, VPS 2566 passed) + captura de device archivada en docs/copiloto-emprendedor/2026-11-02-sprint-correcciones-evidencia/SM-N18.md (Mi Dia sin aviso, 0 coincidencias con control positivo, bundle acdbff54); N18 acredita la CAUSA, N17 la pantalla
- **Dueño:** backend (se ofreció al medir `SM-N17`)
- **De dónde sale:** es la **raíz** del síntoma de `SM-N17` (el aviso de «se cayó la conexión con
  Instagram» en la cuenta del operador). La ficha se separa porque el síntoma y la causa tienen
  dueños y remedios distintos.
- **Medido por backend (sólo lectura, nada borrado).** El aviso **no** sale del front ni de un
  registro suelto: sale de **Composio en vivo** — `serve.py:268` → `conexiones_salud.composio_caidos`
  (toolkit `EXPIRED` sin `ACTIVE`) → `mi_dia_detector._evaluar_conexion_caida`, y queda **persistido**
  como tarjeta en `copiloto_mi_dia_tarjetas`. Evidencia: tenant `48a9d75f` tiene 1 fila
  `regla=conexion_caida`, `entidad=instagram`, `estado=para_hoy`, creada 2026-11-02 13:08 UTC.
  **Control positivo:** las tarjetas reales de `mercadopago`/`googlecalendar` del tenant `4f3ecb78`
  salen en la misma consulta — la query ve lo que tiene que ver. Los otros 4 tenants: 0.
- **La consecuencia que cambia el fix, y por eso la pregunta previa valió:** sacar `instagram` de
  `serviceIcons.tsx` / `PantallaApps.tsx` / `hitl.ts` **NO apaga el aviso**. Frontend1 no tenía nada
  que quitar para este síntoma. Si se hubiera implementado el fix «obvio» del front, el aviso
  habría seguido vivo y el diff habría parecido trabajo.
- **El defecto de raíz:** `composio_caidos` avisa de **cualquier** toolkit que Composio liste para el
  `composio_user_id`, aunque la app no lo soporte. Instagram **no existe como servicio de la app**
  (`service_risk_contrato.py:18`: «cero módulo, cero tool»), y aun así el detector lo trata como una
  conexión propia caída. Eso es una fuga del proveedor hacia la UI: lo que un tercero liste se
  convierte en una tarea para el emprendedor.
- **Señal lateral que confirma que el toolkit es ajeno al dominio:** `datos.nombre` guarda
  `"instagram"` en **minúscula cruda**, sin `display_name`, porque `_PRESENTATION` no lo conoce. Un
  valor que no pasa por la capa de presentación es la huella de que entró por fuera del catálogo.
- **Las dos salidas, y NO son excluyentes:**
  1. **Del operador, inmediata:** revocar esa conexión en Composio — la tarjeta se cierra sola por
     ausencia. Apaga el síntoma de hoy y **no arregla nada**: el próximo toolkit ajeno vuelve a
     avisar.
  2. **De raíz, esta ficha:** `composio_caidos` sólo avisa de toolkits que la app **soporta**.
- **DoD:**
  1. El detector filtra por el catálogo de servicios soportados de la app, con **una sola** fuente de
     verdad de esa lista — no una segunda lista paralela que después divergirá de la primera.
  2. Test **rojo si vuelve a avisar de un toolkit no soportado**: inyectar un toolkit ajeno
     `EXPIRED` y verificar que **no** se crea tarjeta; y, como control positivo en el mismo test, un
     toolkit soportado `EXPIRED` que **sí** la crea. Sin las dos mitades el test no distingue «filtra
     bien» de «no avisa nunca».
  3. Qué pasa con las tarjetas **ya persistidas** de toolkits no soportados: decidido y escrito
     (cerrarlas, dejarlas, o migrarlas). Hoy hay 1 viva en `48a9d75f`. Un filtro que sólo mira hacia
     adelante deja el síntoma del operador en pantalla.
  4. Corrida en el **VPS**. No necesita device.
- **No verificado todavía, y conviene que lo esté antes de codear:** el listado real de Composio para
  ese `composio_user_id` — backend lo infirió por código, no lo consultó.
- **FUERA DEL SPRINT** (`DEC-18`): el 54 no se mueve.

### SM-N19 · `sin-issue` — FUERA DEL SPRINT: el presupuesto se guardó SIN mostrar la card, sin chance de corregir

- **Estado:** TERMINADO
- **Cierre:** b64856dc356dc89984d5a259a8ff90a691966013 (#1401, SM-N5): la card guardada deja el id y relee importe y cliente al rehidratar. Premisa refutada: el presupuesto 4 lo guardo frontend1 por ADB a las 21:02:08 UTC, y N 2 y N 3 tambien fueron pruebas por ADB. La card sin resolver no desaparece: chatMachine.ts:410 la escribe, useChat.ts:119 la persiste entera y useChat.ts:272-276 la rehidrata; intacta tras salir y volver, HOME y force-stop con pid nuevo (device 2026-11-02, cuenta del operador). Lo que vio el operador, un recibo con solo el N 4, es el mensaje del N 4 guardado antes de #1401, sin id; la captura con importe y cliente de uno nuevo queda en la Falta de SM-N5. Evidencia: 2026-11-02-sprint-correcciones-evidencia/SM-N19.md.
- **Dueño:** backend (la medición primero) — frontend1 queda a la espera, ver abajo
- **De dónde sale:** el **operador**, 2026-11-02, usando la app con su cuenta: «nunca se mostró la
  card del presupuesto... se generó directamente sin posibilidad de corregir ni agregar nada...
  fijate presupuesto 4 en pantalla».
- **Lo que YA está medido, y descarta la explicación fácil.** El backend **sí cumple** su contrato:
  `_run_registrar_presupuesto` (`tool_catalog.py:883`) devuelve **`is_write=False`**, no persiste, y
  su `observation` (`:944-950`) le ordena al agente, textual: «TODAVÍA NO está guardado — NO digas
  "anoté", "listo" ni "guardado" porque no es cierto». El schema de la tool dice lo mismo
  (`:266`): «NO lo guarda: arma una propuesta para que él la revise y confirme».
  **Conclusión parcial: el presupuesto 4 lo creó OTRO camino.** Esto no es un detalle: invalida el
  fix «hacer que registrar_presupuesto no guarde», que es donde habría ido a parar cualquiera que
  leyera sólo el síntoma.
- **PREGUNTA MEDIBLE, es el primer paso y es de backend:** ¿qué creó el presupuesto N° 4 del tenant
  del operador? Candidatos a distinguir, y llevan a fixes distintos:
  (a) un segundo paso del agente que sí persiste tras la propuesta (patrón `then`, como el
      `create→publish` documentado en `services/base.py:21`);
  (b) el endpoint HTTP de `presupuestos_web.py`, o sea la app llamando a guardar sin pasar por la
      card;
  (c) la card **sí** se emitió y el front no la pintó — en cuyo caso el dueño es frontend1 y no
      backend.
  Se distinguen mirando el registro de la conversación y la fila del presupuesto (quién la escribió,
  con qué `idem_key`, a qué hora respecto del mensaje). READ ONLY: es la cuenta fiscal del operador.
- **Hasta que eso esté medido, frontend1 NO implementa.** Es la misma lección que acaba de pagar
  `SM-N17`/`SM-N18` hoy: ahí el fix «obvio» del front no habría apagado nada porque el síntoma nacía
  en otra capa, y la pregunta previa lo evitó.
- **Por qué no es menor.** El patrón de confirmación es el corazón del producto: «nunca se pregunta
  dos veces; a la segunda manda la card». Un camino que escribe sin pasar por la card no es una
  molestia de UX — es el gate de revisión salteado en una entidad de negocio. Y el daño es el mismo
  que el de una factura mal emitida salvo que el presupuesto no es fiscal: el emprendedor manda algo
  que no revisó.
- **FUERA DEL SPRINT** (`DEC-18`): no sale del mapa, sale del uso. El 54 no se mueve.
- **DoD:**
  1. Medido y escrito **qué** creó el presupuesto 4, con la evidencia (fila, `idem_key`, traza).
  2. El camino que escribía sin card deja de hacerlo, o pasa por la card. Si el hallazgo es (c), el
     fix es del front y esta ficha cambia de dueño — eso se escribe, no se asume.
  3. Test **rojo si un presupuesto se persiste sin confirmación previa**. Y con su control positivo:
     uno confirmado que **sí** se persiste. Sin las dos mitades no se distingue «el gate funciona»
     de «ya no se guarda nunca».
  4. Corrida en device: dictar un presupuesto, **ver la card**, corregir algo en ella y recién ahí
     confirmarlo. La parte de «corregir» es la que el operador nombró y la que un test de card
     presente no cubre.

### SM-N20 · `sin-issue` — FUERA DEL SPRINT: el LLM escribe los importes en formato inglés y agrega frases que no vienen de la observación

- **Estado:** DOD-PARCIAL
- **Falta:** lo que hereda SM-N21 (cobro y completar_ingreso sin sonda LLM: la sonda de cobro exigiria una factura impaga real que la propia sonda dejaria cobrada; captura de device del preview de mp_charge). El residual de las 5 frases que NO mueven plata (1/8) esta ACEPTADO y MEDIDO, no pendiente: no iterar el prompt buscando un 0 que la sonda ya mostro que no llega
- **Cierre:** 30a05839 (#1414) crudos fuera de las ramas ambiguas + bf90c016 (#1423, SM-N21) reply_literal en las 6 tools que mueven plata; sonda LLM real 0 de 32 con el flag prendido
- **Dueño:** backend
- **De dónde sale:** lateral que backend destapó midiendo SM-H5/SM-N8, 2026-11-02. Misma clase que
  aquellas dos, pero en tools que ninguna cubría.
- **El síntoma, dos cosas distintas en el mismo texto.** El `reply_text` que ve el usuario trae
  «$50,000» (separador de miles inglés, no `$50.000`) y un «Esto es lo que entendí:» que **no está
  en ningún código** — grep limpio, 0/6 en sesión limpia: es muletilla del LLM.
- **Causa medida, y no era la tool que parecía.** `registrar_presupuesto` **no lleva importe** en su
  `observation`, así que el «$50.000» no salía de ahí. Reproducido con LLM real: las ramas
  **AMBIGUAS** de `marcar_presupuesto` y `marcar_factura_cobrada` pasaban `candidatos[].total/saldo`
  **crudo** (`"50000.0000"`). En la sesión de prod del operador (`6ab0dae4`) los 3 borradores (1662,
  1678, 1767) salieron en inglés, y antes había respuestas ambiguas con `$50,000.00` (1525/1526):
  **contagio por historial** — una vez que el formato entra en la conversación, se propaga.
- **Fix #1414** (mergeado y desplegado; VPS 2567 passed, CI 6/6): `plata_corta` en los candidatos
  + la frase.
- **Por qué NO es TERMINADO.** Sonda post-deploy con el mismo instrumento, 8 sesiones: ambigua en
  inglés **1/8** y borrador nuevo **1/8** — bajó respecto del baseline (2/5 y 1/5) pero **no llegó a
  0**, y la n es chica, así que la mejora no es concluyente. El caso residual es el que explica el
  límite: la `observation` ya traía **«$70.000» bien formateado** y el modelo escribió **«$70,000»**
  igual. Se quitó la fuente cruda; queda un hábito del LLM que el dato limpio no elimina.
  usuario **no pase por el LLM** — card y reply armados por código. Eso es decisión de diseño más
  grande que la ficha y **no la toma backend por su cuenta**: queda planteada acá como la opción de
  raíz, y la decide el operador. Mientras no se tome, el residual se acepta y queda medido (1/8).

### SM-N21 · `sin-issue` — FUERA DEL SPRINT: opción C — los importes que mueven plata se escriben por código, no los redacta el LLM

- **Estado:** DOD-PARCIAL
- **Falta:** cobro (marcar_factura_cobrada) y completar_ingreso sin sonda con LLM real (cobro exige factura impaga real; completar ya no es alcanzable tras el modelo propone-no-persiste): cubiertos por test unitario; captura de device del preview HITL de mp_charge (frontend1)
- **Cierre:** 71725e91 mitad A (#1420) + bf90c016 mitad B reply_literal (#1423), desplegado, flag UC_REPLY_LITERAL=1 prendido; sonda LLM real mismo instrumento N=8: gasto/ingreso/presupuesto/factura importe MAL 0/8 (antes: ingreso 1/6, presupuesto 1/6); negativo con flag prendido en test; Replayer en test del motor
- **Dueño:** backend
- **De dónde sale:** decisión del **operador**, 2026-11-02: «acuerdo opción C», sobre el inventario
  que midió backend para `SM-N20` (13 sitios donde un importe llega al usuario). Es la raíz que
  `SM-N20` dejó planteada y no podía tomar: `SM-N20` queda abierta hasta que esta cierre.
- **Por qué C y no A ni B.** A (limpiar los crudos que quedan) **no garantiza**: el residual medido
  es 1/8 y su caso testigo lo explica — la `observation` ya traía «$70.000» bien formateado y el
  modelo escribió «$70,000» igual. Es hábito del LLM, no dato sucio, así que ningún prompt lo cierra.
  B (`reply_literal` en todo) **sí garantiza**, pero toca el **workflow Temporal**, que es el moat:
  pagar riesgo sobre la pieza durable para ganar el 1/8 en frases que no mueven plata es desproporcionado.
- **El criterio de alcance, que lo fija planificación y no se reinterpreta:** una tool **mueve plata**
  cuando **escribe o confirma un monto que queda registrado** — gasto, ingreso, cobro, presupuesto,
  factura. Listar, buscar, resumir y responder preguntas **no** mueven plata, aunque muestren
  importes. Si un caso es dudoso, **no se decide en la implementación**: se pregunta.
- **DoD:**
  1. **Mitad A, en TODAS:** los 2 sitios que todavía pasan el número crudo en la frase relayada
     (`registrar_gasto` L819/822, `registrar_ingreso` L1186/1189) formateados con `plata_corta`,
     como los 3 que ya lo usan. Es barato y no depende de la mitad B.
  2. **Mitad B, SÓLO en las que mueven plata según el criterio de arriba:** el texto con el importe
     lo arma el **código** y el LLM no lo redacta (`reply_literal`). La lista concreta la propone
     backend desde su inventario **citando el criterio por cada tool**, y la confirmo antes de que
     implemente: una lista derivada sin criterio explícito es la puerta para que el alcance crezca
     o se achique solo.
  3. **Temporal:** invocar `temporal-developer` ANTES de tocar el workflow (regla 3 del `CLAUDE.md`,
     no es opcional). El cambio **no puede** introducir no-determinismo ni side effects en el
     workflow, y eso se acredita, no se afirma.
  4. **Tests** que fijen el contrato: para una tool con `reply_literal`, que el texto que ve el
     usuario sea **exactamente** el del código. Y el control que falta en la mitad A y acá no:
     **un caso negativo** — una tool que NO mueve plata sigue redactando libremente. Sin esa mitad
     no se distingue «apliqué C» de «apliqué B sin darme cuenta».
  5. **Medición post-deploy con el MISMO instrumento** de la sonda de `SM-N20` (mismas sesiones,
     mismo baseline), sobre las tools con `reply_literal`: el esperado es **0**, no «menos». Si no
     da 0 en ésas, el mecanismo no está puesto donde se cree — y eso es el hallazgo, no un residual.
  6. VPS verde + CI, y el recibo del SHA.
- **Lo que esta ficha NO hace:** no toca las 5 frases formateadas-pero-redactadas que no mueven
  plata. Ahí el residual queda **aceptado y medido** (1/8), no pendiente: nadie vuelve a iterar el
  prompt buscando el 0, porque la sonda ya mostró que ahí no se llega.
- **FUERA DEL SPRINT** (`DEC-18`): sale del uso, no del mapa. El 54 no se mueve.

### SM-N22 · `sin-issue` — DENTRO DEL SPRINT: el tirador para subir la conversación queda DEBAJO de la entrada de texto, y el mapa lo pone ARRIBA

- **Estado:** DOD-PARCIAL
- **Falta:** REFUTADO POR EL OPERADOR en device el 2026-11-03 06:40: 'en la pantalla mi dia el campo de texto todavia esta por encima del tirador' — o sea el defecto que 80f4e2ee declara arreglado SIGUE PRESENTE a la vista. DOS causas explican esa observacion igual de bien y la ficha NO atribuye ninguna hasta medir: (a) el device no corrio ese codigo — 80f4e2ee se mergeo 23:46:59 del 2-nov y frontend1/frontend2 dejaron de dar senal 23:51 y 23:57, asi que Metro casi con seguridad nunca sirvio el bundle con el fix (el device corre lo que Metro sirve, no main); (b) el fix esta servido y no resuelve el orden visual. El PRIMER paso NO es tocar codigo: es Metro sirviendo origin/main en el device y volver a mirar Mi dia. Si con el bundle al dia sigue mal, es (b) y recien ahi se toca PanelDeslizable.tsx. Dueno: frontend2 (tiene el device y la ficha de la reverificacion de teclado); frontend1 es dueno del shell si el fix hay que rehacerlo. Sigue faltando ademas la reverificacion del TECLADO que frontend2 declaro pendiente en su avance_ del 2026-11-02.
- **Dueño:** frontend1 (dueño del shell)
- **Reportado por:** el operador, 2026-11-02, mirando el mapa contra la app.
- **Medido (código, no impresión):** el grab-handle vive **adentro** del panel de la conversación y
  **arriba de su contenido** — `apps/mobile/src/shell/PanelDeslizable.tsx:515` (`zonaHandle`,
  `testID="panel-handle"`, barra 44×5 en `:560`), montado antes del contenido del panel. La entrada
  de texto es `DockEntrada` → `Composer` (`apps/mobile/src/modules/chat/DockEntrada.tsx:151`), que
  vive **dentro de ese mismo contenido**. Con el panel abajo, lo único que queda en pantalla es esa
  tira (`ALTO_HANDLE = 56`, `:48`), y por eso el operador la ve **debajo** del campo.
- **La pantalla es MI DÍA** (precisado por el operador, 2026-11-02): *«en la pantalla de mi día
  el tirador está debajo de la entrada de texto… debe estar arriba del campo»*. Si el fix se
  verifica en otra pantalla, no acredita esta ficha.
- **El mapa:** `mapa-pantallas/index.html`, vista de Mi día — la barrita de arrastre aparece
  **inmediatamente encima** de «Escribí, o hablá…», no debajo.
- **Por qué NO es cosmético, y por qué entra al sprint en vez de quedar FUERA:** el tirador es el
  **único** control para traer la conversación de vuelta. Si queda del lado equivocado del campo de
  texto, el gesto natural (subir desde el borde inferior) cae sobre el teclado o sobre el campo, no
  sobre la zona agarrable — y el control más usado de la app depende de acertarle. Además es
  **divergencia directa contra el mapa**, que es el criterio declarado del sprint, y **no figura en
  las `ENMIENDA FUNDADA`**: nadie decidió cambiarlo, así que es defecto.
- **NO se arregla moviendo la barrita de lugar.** El orden visual sale de la arquitectura del panel:
  el handle es el borde **superior** de una capa que se desliza, y el composer viaja **adentro** de
  esa capa. Mover el `View` sin entender eso rompe el gesto o lo deja agarrando la capa equivocada.
  **Leer la skill `swmansion-rn-gestures` antes de tocarlo** (regla del repo) y `documed-front`, que
  ya resolvió esta composición.
- **DoD:**
  1. **Captura del estado ACTUAL** en device, 390 px, con el panel abajo — el «antes», que hoy no
     existe en ningún lado y sin él no se puede acreditar que cambió nada.
  2. La zona agarrable **por encima** de la entrada de texto, como el mapa, con su captura «después».
  3. El gesto **sigue funcionando**: subir y bajar la conversación ejercitado con
     `adb input motionevent` DOWN → MOVE → UP (nunca `input tap`: el toque sin desplazamiento no
     activa un Pan y da un «no responde» falso).
  4. **Control de que el instrumento ve:** en la misma corrida, un gesto que SÍ debería responder,
     para distinguir «no se mueve» de «el ADB no está ejercitando nada».
  5. El teclado abierto no tapa la zona agarrable: captura con el campo enfocado.
- **Tenencia:** cualquiera de las dos cuentas sirve — es estructura, no datos. No necesita la
  ventana del operador ni el usuario canónico.
- **DENTRO del sprint:** es divergencia contra el mapa reportada por el operador. El denominador se
  mueve (es el caso que `DEC-18` contempla: lo que sale del **mapa**, no del uso).

### SM-N23 · `sin-issue` — DENTRO DEL SPRINT: el tirador de ARRIBA queda pegado al borde y compite con el gesto del sistema

- **Estado:** DOD-PARCIAL
- **Falta:** DoD 1 (captura del ANTES con el panel arriba a 390px), DoD 2 (captura del DESPUES mas EL NUMERO: cuantos px de margen quedaron bajo insets.top - un 'quedo mas abajo' sin cifra no es acreditable) y DoD 5 (la tira de abajo sigue midiendo exactamente una card, no se engroso con espacio muerto). La prediccion escrita de frontend1 decia ROJO a y=53 y salio VERDE: la lectura del layout estaba mal, y la causa es que panel-funciones-pestana mide [0,0][720,150] por uiautomator, o sea el gesto cubre la pestana entera y no solo la barra; el shade solo gana por debajo de ~y=47.
- **Cierre:** 2d257f95 (#1432) margen fijo bajo la barra de estado + 988ba029 (#1443, ancestro de origin/main, 71 lineas en PanelFunciones.tsx/.test.tsx). DoD 3 y 4 CUMPLIDOS en device por frontend1 el 2026-11-03: con motionevent DOWN-MOVE-UP, y=53 abre el panel 6/6 y el shade 0/6; y=90 tambien 6/6; control y=40 abre NotificationShade, que distingue 'no se mueve' de 'el ADB no ejercita nada'. N=6 declarado, por encima del minimo de 5. Condicion: Mi dia con el panel abajo, Metro con --clear desde wt-fe1-h5 HEAD cab346d9 con PanelFunciones IDENTICO a main (988ba029); el resto del bundle NO es main. El primer intento del dia (0/6 y 0/6) esta DESCARTADO: Metro logueaba 'None of the callbacks in the gesture are worklets', o sea los gestos corrian en el hilo JS - era el instrumento, no el fix.
- **Dueño:** frontend1 (dueño del shell)
- **Reportado por:** el operador, 2026-11-02: *«está muy pegado al borde, dificulta su
  desplazamiento porque se confunde con el sistema — hay que bajar el tirador hasta una zona
  cómoda»*.
- **Es OTRO defecto que `SM-N22`**, aunque toquen el mismo componente: N22 es **orden** (el tirador
  de abajo quedó del lado equivocado del campo de texto); ésta es **posición vertical** del tirador
  de arriba. Se arreglan juntas pero se acreditan por separado: un fix que mueva la tira puede
  cerrar una y dejar la otra igual.
- **Medido (código):** `apps/mobile/src/shell/PanelDeslizable.tsx:434` lo declara explícito —
  `handle_top (arriba) = 0 + insets.top`. O sea que el handle arranca **exactamente** donde termina
  el inset de la status bar: **margen cero**. El spacer es fijo (`estiloSpacer = { height:
  insets.top }`, `:436`).
- **⚠️ Por qué nadie lo vio antes, y es el patrón que este repo ya tiene escrito:** el comentario
  de `:413-434` **declara la protección** — *«el handle tiene que caer DEBAJO del reloj»*, y
  termina en `← el handle cae debajo del reloj ✓`. La afirmación es **verdadera** y por eso apagó
  la búsqueda: nadie volvió a preguntarse si «debajo del reloj» alcanzaba. **No alcanza, porque
  cubre una mitad sola.** «No lo tapa el reloj» y «es cómodo de agarrar» son dos propiedades
  distintas, y la segunda nunca se midió
  ([[el-comentario-que-declara-una-proteccion-desactiva-la-busqueda-del-proximo]]).
- **La causa real de «se confunde con el sistema»:** el borde superior es **zona de gesto del
  sistema** — arrastrar hacia abajo desde ahí abre el panel de notificaciones de Android. Con
  margen cero, el arrastre del usuario compite con el shade: a veces responde la app y a veces el
  sistema. **No es percepción: es dos receptores para el mismo gesto**, y por eso se siente
  «difícil» en vez de «roto» — funciona una de cada dos veces.
- **⚠️ CÓMO NO arreglarlo — esto ya costó días en este archivo.** La geometría de esta tira se
  logró **sin animar ninguna propiedad de layout**. El comentario de `:417-427` documenta que
  animar `height` producía *«se desliza, salta, se maximiza un instante y sigue bajando»*: cada
  layout pass es un commit del shadow tree y en el árbol de React el panel no tiene transform, o
  sea **el panel arriba tapando la pantalla** por un cuadro. **El margen nuevo va FIJO** (como el
  spacer), nunca animado, y el recorrido se acorta en esa misma cantidad para que la tira de abajo
  siga midiendo exactamente una card. Si el fix anima `height`, `top`, `margin` o `padding`, está
  mal aunque se vea bien en el emulador.
- **Antes de tocarlo:** `swmansion-rn-gestures` (composición Pan / zona agarrable) y
  `documed-front`, que ya resolvió la convivencia con las barras del sistema — su
  `app/_layout.tsx:213` es el precedente de este repo para la barra de Android.
- **DoD:**
  1. **Captura del ANTES** con el panel arriba, 390 px, donde se vea la distancia real entre el
     borde y la barrita.
  2. El tirador **bajado a una zona cómoda**, fuera de la franja de gesto del sistema, con su
     captura «después» y **el número**: cuántos px de margen quedaron bajo `insets.top`. Un
     «quedó más abajo» sin cifra no es acreditable.
  3. **El control que esta ficha existe para pedir:** arrastrar hacia abajo desde la zona del
     tirador **N veces seguidas** (N declarado, ≥5) y que **las N** muevan el panel y **ninguna**
     abra el panel de notificaciones. Una sola pasada no distingue «arreglado» de «tuve suerte»:
     el defecto es intermitente por naturaleza.
  4. El gesto ejercitado con `adb input motionevent` DOWN → MOVE → UP (nunca `input tap`), más un
     gesto de control que SÍ debería responder, para distinguir «no se mueve» de «el ADB no
     ejercita nada».
  5. La tira de abajo **sigue midiendo una card** tras el cambio (no se engrosó con espacio muerto:
     es justo lo que `:43-48` previene).
- **Tenencia:** cualquiera de las dos cuentas — es estructura, no datos. No espera al operador.
- **DENTRO del sprint:** es jugabilidad del control principal, reportada por el operador sobre la
  app contra el mapa.

### SM-N24 · `sin-issue` — DENTRO DEL SPRINT: el botón de cámara no va en el chat; sólo al cargar un gasto

- **Estado:** DOD-PARCIAL
- **Falta:** DoD 1/2/3: las capturas de device (chat sin camara, Gastos CON camara, Soporte intacto). Van en la pasada de device. NOTA: esta ficha estuvo declarada PENDIENTE con el codigo YA en main desde #1430 — el estado lo corrigio frontend2 al refutar un conteo mio.
- **Cierre:** 32a0d66e (#1430, ancestro de origin/main): el chat ya no pinta el boton de camara — ChatView no pasa onFoto; test ChatView.test.tsx:655; comentario de Composer.tsx actualizado (DoD 5); la foto del comprobante queda donde corresponde, en Gastos; Soporte intacto.
- **Dueño:** frontend1 (dueño del chat) · coordinar con frontend2 (dueño de Gastos)
- **Decisión del operador, 2026-11-02:** *«el botón de la cámara hay que quitarlo — la única
  función de la cámara es para los gastos, para incluir una foto del comprobante; debe aparecer
  sólo cuando se va a agregar un gasto»*. Es **decisión de producto**, no una preferencia visual:
  acota el alcance de una capacidad a su único caso probado.
- **Medido (código):**
  - El botón se monta en el chat **sin condición**: `apps/mobile/src/modules/chat/ChatView.tsx:245`
    pasa `onFoto={alElegirFoto}` siempre, y `Composer.tsx:205` lo pinta con sólo recibir el prop
    (`{onFoto && !capturando && …}`).
  - **La capacidad NO se pierde al sacarlo**, y esto es lo que hace la ficha barata: Gastos **ya
    tiene su propia entrada de cámara**, con su propio ícono —
    `apps/mobile/src/modules/gastos/FotoFuncion.tsx:100` (su `IconoCamara` de `:23` es, dicho en su
    propio comentario, *«mismo trazo que `IconoCamara` de `chat/Composer.tsx`»*). O sea que el
    camino que el operador describe **ya existe**: esta ficha **retira el duplicado del chat**, no
    construye nada.
  - `Composer` lo recibe como prop opcional (`onFoto?`, `:75`), así que **no pasarlo alcanza**: el
    botón desaparece sin tocar el layout del composer.
- **⚠️ Hay un comentario que va a defender el botón — leerlo y actualizarlo, no ignorarlo.**
  `Composer.tsx:142-148` declara: *«`onFoto` rompe la regla de “sin botones de acción propios”, y es
  la única excepción a propósito (Gastos Fase 2, OCR de ticket)»*, con el razonamiento de por qué
  la cámara necesita botón (*«abrir la cámara es una capacidad del DISPOSITIVO, no del agente»*).
  **Ese razonamiento sigue siendo cierto y no se discute** — lo que cambia es **dónde** vive el
  botón: en el formulario de gasto, no en el chat general. Si el comentario queda como está,
  el próximo que lo lea va a «restaurar» el botón creyendo que arregla una regresión.
- **Otros llamadores — NO barrer a ciegas:** `apps/mobile/src/modules/soporte/PantallaSoporte.tsx:168`
  también pasa `onFoto` (adjuntar una captura a un reporte de soporte). **Ese NO se toca**: no es
  el chat del copiloto y su foto tiene otro propósito. La ficha retira **un** call-site, no el prop.
- **DoD:**
  1. El botón de cámara **ausente** del composer del chat (Mi día y conversación), con captura de
     device.
  2. El botón **presente** donde el operador lo pide — al cargar un gasto — con su captura. Las
     dos mitades: un control que desaparece de todos lados no es lo pedido.
  3. **Control negativo:** la foto de soporte (`PantallaSoporte`) **sigue funcionando**. Es el
     llamador que un barrido por `onFoto` se llevaría puesto.
  4. Tests que dependan del botón en el chat, revisados y pasando — incluido el censo de paridad
     web↔mobile si lo toca.
  5. El comentario de `Composer.tsx:142-148` **actualizado**: por qué la excepción sigue siendo
     válida pero vive en Gastos.
- **Tenencia:** cualquiera de las dos cuentas — es estructura. No espera al operador.
- **DENTRO del sprint:** el mapa no dibuja cámara en la barra de entrada de Mi día (la captura que
  mandó el operador muestra sólo el micrófono), así que además de decisión de producto es
  convergencia con el mapa.

### SM-N25 · `sin-issue` — DENTRO DEL SPRINT: el campo de texto y el mic deben FLOTAR sobre el chat, no tener fondo pleno

- **Estado:** DOD-PARCIAL
- **Falta:** DoD 5: la zona de ARRIBA (misma pregunta, otro borde) — sin tocar. DoD 3: la card CLARA, que exige forzar piel clara y eso mutaria la cuenta del operador: queda para la pasada con tenencia canonica, no se fuerza. Dueno: frontend2.
- **Cierre:** 6335f883 (#1440, ancestro de origin/main, CI 6/6): la mitad de ABAJO. Causa raiz medida en device (cuenta del operador, solo lectura de pantalla): el 'fondo pleno' era GEOMETRIA, no color — lista y dock hermanos en flujo, la lista se cortaba con borde duro sobre el campo (y~1450). Fix: lista a pantalla completa bajo un dock overlay + padding igual al alto medido; contraste con solucion nombrada (scrim 0->.9 + base .85 bajo el vidrio, desde tokens). ANTES/DESPUES 390px scrolleando capturados, NO versionados a proposito: llevan mensajes del operador.
- **Dueño:** frontend1 (dueño del chat)
- **Decisión del operador, 2026-11-02:** *«el fondo de alrededor del campo de texto y del botón de
  mic debe ser transparente — el campo y el mic deben ser **flotantes** en el chat; lo mismo en la
  parte superior: desde la zona que dice “Pedir confirmación” hacia arriba hay un fondo pleno»*.
- **Medido (código) — son DOS fondos distintos, y por eso la ficha nombra los dos:**
  - **Abajo:** el composer pinta **su propio degradado**: `apps/mobile/src/modules/chat/Composer.tsx:234`
    (`colors={[tema.glass.s1, tema.glass.s2]}`), más la luz superior de `:239`
    (`backgroundColor: tema.glass.hi`). El **campo** en sí ya es `backgroundColor: 'transparent'`
    (`:307`), así que **lo que se ve lleno es la cáscara, no el input**: quien busque el fondo en el
    `TextInput` no lo va a encontrar y va a concluir que no existe.
  - **Arriba:** `ChatView` **no** pinta fondo — `:265` dice `// SIN backgroundColor a propósito` y
    `:76` explica *«un `backgroundColor` acá taparía el vidrio detrás»*. O sea que el pleno de
    arriba **no sale de ahí**: sale del `CristalVidrio nivel="conversacion"` del panel
    (`shell/PanelDeslizable.tsx`) o de su `FondoIluminado`. **Hay que medirlo en device antes de
    tocar**, no deducirlo: es justo el caso donde el comentario que declara «sin fondo a propósito»
    apaga la búsqueda y el fondo real vive una capa más abajo.
- **El criterio, para que no se interprete como «bajarle la opacidad a todo»:** flotante =
  **el contenido del chat se ve correr por debajo** del campo y del mic. El campo tiene que seguir
  siendo **legible y tocable** sobre cualquier contenido que pase atrás — texto largo, una card
  clara, una foto. Transparencia sin legibilidad es otro defecto, no el fix.
- **⚠️ El riesgo concreto: contraste.** El repo tiene un control de pares pintados
  (`apps/mobile/src/theme/paresPintadosContraste.test.tsx`). Si el fondo del campo pasa a
  transparente, **el par texto/fondo deja de estar garantizado**: depende de lo que haya detrás. El
  DoD lo pide medido, no supuesto.
- **DoD:**
  1. Captura del **ANTES** (390 px) con contenido detrás del campo, y la del **DESPUÉS**.
  2. El campo y el mic **flotando**, con el chat visible corriendo por detrás — demostrado
     **scrolleando**: una captura estática no distingue «transparente» de «del mismo color que lo
     que hay detrás en este momento».
  3. **Legibilidad sobre el peor caso**: una captura con una card CLARA pasando bajo el campo. Es la
     mitad que el verde del caso normal no acredita.
  4. El control de contraste del repo pasando, y si alguna combinación queda fuera de umbral, la
     solución (scrim, blur, borde) **nombrada**, no improvisada.
  5. El fondo de ARRIBA identificado con `path:línea` real — no «toqué hasta que se fue».
- **Tenencia:** cualquiera de las dos cuentas. No espera al operador.
- **DENTRO del sprint:** es la cáscara del mapa.


### SM-N26 · `sin-issue` — DENTRO DEL SPRINT: quitar el indicador «Pedir confirmación» de la cabecera del chat

- **Estado:** DOD-PARCIAL
- **Falta:** Captura de device de la cabecera SIN el indicador. Dueno: frontend1 (venia en su cola N23 -> N28 -> N26).
- **Cierre:** Codigo en main: c0b17494 (#1441) — retirado el indicador «Pedir confirmacion» de la cabecera del chat. Ancestro de origin/main.
- **✅ DESBLOQUEADA el 2026-11-02 — se retira ENTERO.** El bloqueo existió porque el contrapunto de
  abajo no estaba medido; **ahora lo está y se cae**. El texto del contrapunto queda igual a
  propósito: explica qué se pierde y qué hay que reponer cuando el modo sea elegible.
- **✅ RESOLUCIÓN, 2026-11-02 — el contrapunto se CAE, medido.** El operador preguntó lo único que lo
  decidía: *«¿existe algún lugar para setear este comportamiento a nivel de usuario? porque me parece
  que no… y si no existe no tiene sentido que se muestre, porque debería pedir confirmación siempre,
  al menos hasta que implementemos la opción para que el usuario pueda elegir»*. **No existe, y su
  razonamiento es exacto.** El único escritor del campo desde cualquiera de las dos UIs es
  `volverAConfirmacion()` → `guardarPerfilNegocio({ modoCeremonia: 'confirmacion' })`
  (`apps/mobile/src/modules/ajustes/negocio/PantallaPerfilNegocio.tsx:310` y su gemelo web
  `apps/copiloto-web/src/modules/ajustes/negocio/PantallaPerfilNegocio.tsx:193`). El backend
  **acepta** escribir `automatico` (`apps/copiloto/presupuestos_web.py:85`, validado contra `MODOS`),
  pero **ningún control lo manda**; y el default es `confirmacion` para todo tenant, nuevo incluido
  (`apps/copiloto/perfil_negocio_store.py:62-66`).
  ⇒ El indicador muestra **siempre lo mismo, para todos los usuarios**: es una **constante disfrazada
  de estado**. Y la alternativa que yo había ofrecido —«mostrarlo sólo cuando el modo es
  `automatico`»— equivale a **no mostrarlo nunca**: no era una alternativa, era el mismo retiro con
  una condición muerta adentro. **Se retira entero**, y el **punto 4 del DoD queda sin objeto** (no
  hay ninguna «otra ruta» donde el modo sea legible, porque no hay modo que leer: el valor es fijo).
- **🔴 La deuda que el retiro CREA, y que se escribe acá para que no se pierda:** cuando se
  implemente la opción de que el usuario elija el modo, **la señal permanente vuelve con ella** — no
  es decoración, es lo único que dice si el copiloto actúa solo. Va como nota en el contrato de modos
  §4 junto con su corrección: hoy «estado siempre visible» afirma algo que no existe, y la próxima
  sesión que lo lea le va a creer ([[el-contrato-afirma-el-mecanismo-que-no-opero]]).
- **Lo que esto enseña del método, y por qué el contrapunto estaba mal construido:** defendí el
  cartel por **lo que el contrato dice que significa**, sin medir si la variable que pinta puede
  cambiar de valor. Se pintó una variable que **nunca varía**. El chequeo que faltaba era de una
  línea y ya está escrito en la memoria de este repo: **¿quién ESCRIBE este campo?**, no quién lo lee
  ([[la-costura-leia-un-campo-que-nadie-escribe]]).
- **Dueño:** frontend1
- **Decisión del operador, 2026-11-02:** *«hay que quitar eso de pedir confirmación — ensucia la
  pantalla; sólo dejar el tirador del margen superior»*.
- **Medido (código):** es `IndicadorModoCeremonia`
  (`apps/mobile/src/modules/chat/IndicadorModoCeremonia.tsx:85`), montado como **primer hijo** de
  `ChatView` (`:195`, envuelto en `styles.indicadorModo`, `:267`). Muestra `Automático` o
  `Pedir confirmación`. Es **read-only a propósito** (`:13-17`): una `View`, no un `Pressable`,
  porque *«un control que no responde al toque es peor que no tener control»*.
- **⚠️ CONTRAPUNTO — lo que se pierde, con la evidencia de HOY:** ese indicador existe por el
  **contrato de modos §4**, cuyo texto es *«estado siempre visible sin abrir nada»*
  (`ChatView.tsx:192`). Es **la única señal permanente** de si el copiloto actúa solo o pide
  confirmación. Y hoy mismo, el 2026-11-02, el operador reportó exactamente ese síntoma en
  `SM-N19`: *«se está ejecutando todo de forma automática… yo no vi la card»*. Sacar el indicador
  no causa ese comportamiento, pero **saca el único lugar donde se lee en qué modo está la app** —
  justo la pregunta que hubo que contestar hoy leyendo código. Además es **fail-closed** (`:29-31`):
  ante error o endpoint caído muestra «Pedir confirmación», nunca «Automático».
- **La alternativa barata, por si el operador la prefiere** (decide él, no la implementación):
  mostrarlo **sólo cuando el modo es `automático`**. En `confirmación` —que es el default y el
  estado del tenant del operador— la pantalla queda limpia como pide, y la señal **reaparece
  exactamente cuando importa**: cuando la app SÍ actúa sola. Costo: una condición. Así el «siempre
  visible» del contrato §4 se degrada a «visible cuando hay algo que avisar», en vez de
  desaparecer.
- **Si el operador confirma el retiro total:** se retira **y se actualiza el contrato de modos §4**,
  más los dos comentarios que lo invocan (`ChatView.tsx:192` y el docstring del indicador). Un
  contrato que sigue afirmando «estado siempre visible» cuando ya no hay nada visible es
  exactamente la clase de declaración que después se cita como si fuera verdad.
- **DoD:**
  1. La cabecera del chat sin el indicador (o con la condición, según lo que decida el operador),
     captura de device — arriba queda sólo el tirador.
  2. El contrato de modos §4 y los comentarios que lo citan, **actualizados al estado real**.
  3. Tests que dependan del indicador, revisados — su lógica fail-closed no se borra: si el
     indicador vuelve alguna vez, vuelve cerrado.
  4. **Control:** que el modo del tenant **siga siendo legible en algún lado** (Ajustes → Mi
     negocio, `PantallaPerfilNegocio.tsx:468`), y que esa ruta esté verificada, no supuesta.
- **Tenencia:** cualquiera de las dos cuentas.
- **DENTRO del sprint:** limpieza de la cáscara pedida por el operador.

### SM-N27 · `sin-issue` — DENTRO DEL SPRINT: dos toques al avatar abren Ajustes DOS veces — el guard existe y se derrota a sí mismo

- **Estado:** DOD-PARCIAL
- **Falta:** DoD 1-4, todos de DEVICE y ninguno hecho: (1) reproduccion del ANTES - se da por acreditada con el reporte del operador 2026-11-02 mas el control positivo del test, NO con una filmacion previa al fix, porque rebuildear el ANTES choca con la orden de build al final; (2) dos toques rapidos -> UNA sola pantalla, N>=5 declarado; (3) control de que la navegacion legitima sigue viva (el avatar SIGUE abriendo Ajustes) - sin esto 'no abre dos veces' no distingue el fix de una puerta trabada; (4) el toque ejercitado con adb motionevent DOWN/MOVE/UP, no input tap. Dueno: frontend1 en su proxima pasada de device.
- **Cierre:** c62cec5f (#1433) la puerta recuerda que ruta la cerro: el destino-lanzador ya no reabre al llegar (DoD 6, docstring corregido) + 3c741ff3 (#1434) test que enumera los llamadores de reabrirNavegacion y pone rojo un destino-lanzador sin ruta - es el control durable del fail-open (DoD 5, los 7 destinos dichos). Ambos ancestros de origin/main.
- **Dueño:** frontend1 (dueño del shell)
- **Reportado por:** el operador, 2026-11-02: *«al apretar dos veces seguidas el botón para ingresar
  a ajustes del usuario se abre dos veces la misma pantalla… al parecer como tarda en abrirse, si se
  apreta dos veces se abre dos veces»*. Su diagnóstico es correcto y es la pista: **el defecto vive
  en la ventana de la transición**.
- **⚠️ El guard YA ESTÁ PUESTO en ese botón — así que «falta `empujarUnaVez`» es la explicación
  equivocada y hay que descartarla de entrada.** `apps/mobile/src/shell/PantallaPrincipal.tsx:120`
  es `const alAjustes = () => empujarUnaVez('/ajustes')`, y lo reciben **las dos** capas que pintan
  el avatar (`:273` escritorio y `:280` Mi día). El flag se cierra de forma **síncrona**
  (`navegacion/empujarUnaVez.ts:52-54`), así que un segundo tap inmediato **sí** lo ve cerrado.
  Quien parchee agregando el helper va a «arreglar» algo que ya estaba y el defecto va a seguir.
- **MEDIDO — la causa raíz: la puerta se reabre AL LLEGAR, no al volver.**
  `apps/mobile/app/ajustes.tsx:45` llama `reabrirNavegacion()` dentro de su `useFocusEffect`, porque
  Ajustes es **destino Y pantalla lanzadora a la vez** (lanza Skins, Cuenta, Negocio, AFIP…).
  Secuencia real: tap 1 cierra la puerta y empuja `/ajustes` → Ajustes monta, gana foco y **reabre la
  puerta** → el tap 2, que el sistema entregó durante la transición, encuentra la puerta abierta y
  empuja un **segundo** `/ajustes`. Por eso el síntoma depende de que *«tarde en abrirse»*: la
  ventana de falla es exactamente el tiempo de la transición.
- **⚠️ El docstring afirma la invariante que el código NO cumple — y por eso nadie volvió a mirar.**
  `empujarUnaVez.ts:17-18` dice textual: *«la puerta se cierra al lanzar y se reabre cuando la
  pantalla lanzadora vuelve a tener el foco —o sea cuando el glass se cerró y volvimos a ella—, **ni
  antes ni después**»*. La afirmación es verdadera para un destino HOJA, y **falsa para un destino
  que también es lanzador**: ahí «ganar foco» ocurre a la IDA. El comentario describe la intención,
  no el efecto, y leerlo apaga la búsqueda
  ([[el-comentario-que-declara-una-proteccion-desactiva-la-busqueda-del-proximo]] ·
  [[el-contrato-afirma-el-mecanismo-que-no-opero]]).
- **🔴 Es una CLASE, no un botón — el fix de un solo call-site deja el resto vivo.** Todo destino que
  además sea lanzador reabre al llegar y tiene el mismo agujero: `app/ajustes.tsx:45`,
  `app/midia.tsx:17`, `app/presupuestos.tsx:34`, `app/clientes.tsx:33`, `app/gastos.tsx:33`,
  `app/soporte-ticket.tsx:33`, `modules/facturacion/PantallaFacturacion.tsx:206`. El único lugar
  donde el riesgo está razonado por escrito es `modules/soporte/PantallaSoporte.tsx:94-99`, que
  reabre **a propósito y acotado** a su propio lanzamiento. **Contar los llamadores antes de tocar**
  ([[el-fix-ya-existe-en-otro-call-site]]).
- **El criterio del fix, no su implementación** (la elige frontend1 con la skill en mano): la puerta
  tiene que distinguir **«volví al lanzador»** de **«llegué al destino»**. Un lock por TIEMPO ya fue
  rechazado con fundamento en `empujarUnaVez.ts:13-18` y **no se reintroduce**: tapa el doble-tap y
  deja pasar el toque encolado tardío. Las dos direcciones que SÍ respetan la invariante escrita:
  (a) que la puerta recuerde **qué ruta** la cerró y sólo la reabra quien no sea ese destino, o
  (b) que el destino consuma el lanzamiento pendiente al llegar en vez de reabrir la puerta.
  Cualquiera de las dos sirve; lo que no sirve es un `setTimeout`.
- **Antes de tocarlo:** `swmansion-rn-gestures` (tap sobre `Pressable`, toques encolados) y
  `documed-front`, de donde salió este mecanismo (`PantallaPrincipal.tsx:64-65` lo declara clon de
  `documed-front/apps/mobile/app/(tabs)/index.tsx`) — **medir si documed ya resolvió el caso
  destino-que-también-lanza antes de diseñar nada**, que es la regla §3.ter de este repo.
- **DoD:**
  1. **Reproducción del defecto ANTES del fix**, en device: dos toques rápidos al avatar y la
     evidencia de que hay **dos** pantallas apiladas — dos «Volver» para salir, o el stack leído.
     Sin el antes reproducido no hay forma de acreditar el después: el defecto es intermitente por
     naturaleza (depende de la transición).
  2. Dos toques rápidos → **una sola** pantalla, demostrado **N veces seguidas** (N declarado, ≥5).
     Una pasada no distingue «arreglado» de «tuve suerte».
  3. **Control de que la navegación LEGÍTIMA sigue viva** — es la mitad que un fix de este tipo
     rompe calladito: abrir Ajustes → volver → abrir Ajustes otra vez **funciona**; y desde Ajustes
     abrir Skins/Cuenta **funciona** (Ajustes es lanzadora: si el fix le quita el derecho a reabrir
     sin más, queda muerta y el síntoma es el mismo *«se queda bloqueada y no responde»* de julio).
  4. El toque ejercitado por ADB con el método **declarado** (acá es tap sobre `Pressable`, no un
     Pan, así que `input tap` sirve — pero hay que decir cuál se usó), más un control que SÍ debería
     responder, para distinguir «no se abrió» de «el ADB no ejercitó nada».
  5. **El barrido de la clase**: los 7 destinos-lanzadores listados arriba, cada uno **dicho** —
     arreglado por el mismo mecanismo, o medido como no afectado con el motivo. Un fix que cierre
     sólo `/ajustes` deja seis agujeros idénticos y la ficha no se acredita.
  6. El docstring de `empujarUnaVez.ts:13-28` **corregido al efecto real**, incluido el caso
     destino-que-también-lanza. Es la declaración que apagó la búsqueda; dejarla intacta garantiza
     el próximo.
- **Tenencia:** cualquiera de las dos cuentas — es estructura de navegación. No espera al operador.
- **DENTRO del sprint:** es jugabilidad, reportada por el operador sobre la app. No es divergencia
  contra el mapa (el mapa no dibuja stacks), así que entra por la vía «defecto de uso», no por
  denominador del mapa.

### SM-N28 · `sin-issue` — DENTRO DEL SPRINT: el acceso a Ajustes sale de Mi día y queda SÓLO en la pantalla de funciones

- **Estado:** DOD-PARCIAL
- **Falta:** DoD 1/2/3: capturas de device — Mi dia SIN el avatar y sin hueco de 40px, Funciones CON el avatar funcionando (la mitad que un retiro mal hecho se lleva puesta), y el control de que el aviso de conexion caida SIGUE encendiendo en el avatar del escritorio. Y DoD 4/5: tests que monten PantallaMiDia esperando el avatar, revisados, y el comentario de PantallaPrincipal.tsx:118-119 actualizado (hoy dice 'las dos capas que muestran el avatar' y queda una). Verificar si #1435 ya cubrio 4 y 5. NOTA: estuvo declarada PENDIENTE con el codigo ya en main.
- **Cierre:** 4376027d (#1435, ancestro de origin/main): el avatar de Ajustes sale de Mi dia y queda solo en Funciones.
- **Dueño:** frontend1 (dueño del shell)
- **Decisión del operador, 2026-11-02:** *«hay que quitar el botón de ingreso a ajustes del usuario de
  la pantalla de mi día… sólo debe estar en la pantalla de funciones»*.
- **⚠️ Esto NO contradice a `SM-N16`, y hay que decirlo porque parece que sí.** `N16` existió porque
  el acceso vivía **sólo en Mi día** y *«un operador quedó sin salida en el escritorio»* — el camino a
  cerrar sesión pasa por ahí (el comentario está en `apps/mobile/src/shell/PantallaPrincipal.tsx:118-119`).
  `N16` **agregó** el avatar donde faltaba; esta ficha **retira el que quedó duplicado**. Las dos
  apuntan al mismo invariante: **un solo acceso, y en el escritorio**. Quien lea `N16` sin esta ficha
  va a creer que estamos revirtiendo su fix y lo va a «restaurar».
- **Medido (código):** el avatar se pinta en **dos** lugares con el mismo componente
  (`modules/midia/AvatarCuenta.tsx:43`):
  - **el que SE VA** — `modules/midia/PantallaMiDia.tsx:255`,
    `<AvatarCuenta inicial={inicialCuenta} avisa={conexionCaida} onPress={onAjustes} />`, cableado
    desde `PantallaPrincipal.tsx:280`;
  - **el que SE QUEDA** — `modules/escritorio/EscritorioFunciones.tsx:214`
    (`testID="escritorio-avatar"`), cableado desde `PantallaPrincipal.tsx:273-277`.
- **✅ El retiro NO cuesta nada, y esta es la medición que lo vuelve barato:** el punto de aviso de
  conexión caída **ya viaja al avatar que se queda**. `conexionCaida` lo calcula Mi día
  (`PantallaMiDia.tsx:163`) y lo **sube** por `onConexionCaida` (`:202-203` →
  `PantallaPrincipal.tsx:281` `onConexionCaida={setConexionCaida}`), y el shell lo baja al escritorio
  en `:276` (`avisa={conexionCaida}`). O sea: **sacar el avatar de Mi día no apaga ninguna señal** —
  el aviso sigue encendiéndose, en el único avatar que queda. Si el aviso NO estuviera ya propagado,
  esta ficha tendría que haber movido el cálculo, y ese es el trabajo que la medición ahorró.
- **🔴 Lo que NO se toca, porque es la señal y no el botón:** el cálculo de `conexionCaida` y su
  `onConexionCaida` **se quedan en Mi día**. Un barrido por `conexionCaida` que se lleve el estado
  junto con el avatar apaga el punto del escritorio y el síntoma aparece **en otra pantalla**, donde
  nadie lo va a atribuir a esta ficha. Se retira **el `AvatarCuenta` y su cableado `onAjustes` /
  `inicialCuenta` en la rama de Mi día**, nada más.
- **Relación con `SM-N27`:** retirar este call-site **reduce** la superficie del doble-abrir (queda un
  solo avatar) pero **no lo arregla**: el defecto es que la puerta se reabre al llegar
  (`app/ajustes.tsx:45`), y sigue vivo tocando dos veces el avatar del escritorio. **No marcar `N27`
  por el efecto de esta ficha** — es justo el caso de [[dos-causas-suficientes-el-test-no-atribuye]].
- **DoD:**
  1. Captura de **Mi día** sin el avatar, 390 px, device — y que el lugar que ocupaba **no quede como
     hueco**: lo que había alrededor tiene que cerrar el espacio, no dejar un vacío de 40 px.
  2. Captura de la **pantalla de funciones** con el avatar **presente y funcionando** (abre Ajustes).
     Es la mitad que un retiro mal hecho se lleva puesta: si desaparece de las dos, el operador queda
     sin salida y repetimos exactamente el incidente de `SM-N16`.
  3. **Control de la señal:** con la conexión caída, el punto de aviso **sigue encendiendo** en el
     avatar del escritorio. Provocable sin tocar nada de red real: la señal entra por
     `onConexionCaida`, así que alcanza forzar el estado desde Metro. Sin este control, «se ve bien»
     no distingue entre «la señal viaja» y «la señal se apagó con el avatar».
  4. Tests que monten `PantallaMiDia` esperando el avatar, **revisados** — y el censo de paridad
     web↔mobile si lo toca. Que el test viejo siga verde afirmando el avatar en Mi día sería un test
     que afirma el síntoma ([[un-test-que-afirma-el-sintoma-del-defecto-lo-vuelve-inmortal]]).
  5. El comentario de `PantallaPrincipal.tsx:118-119` **actualizado**: hoy dice «las dos capas que
     muestran el avatar», y después de esta ficha hay una sola. Dejarlo intacto es sembrar el
     próximo «esto está roto, lo restauro».
- **Tenencia:** cualquiera de las dos cuentas — es estructura. No espera al operador.
- **DENTRO del sprint:** decisión de producto del operador sobre la cáscara, y además consolida el
  invariante de `SM-N16` (un solo acceso a Ajustes, en el escritorio).

### SM-N29 · `sin-issue` — DENTRO DEL SPRINT: verificar que el splash se vea ÍNTEGRO en arranque frío (el operador nunca lo vio)

- **Estado:** DOD-PARCIAL
- **Falta:** DoD 1 (el reveal FILMADO entero, no capturado) y DoD 3 (EntradaDiaria en arranque frio con force-stop, filmado, veredicto binario de si se ve bien mientras dura). Y el 7,4 s medido NO es atribuible: en dev-client no se puede separar la latencia de Metro de la de la app, asi que el numero real es de SM-L1 en build de release - citarlo como el tiempo de la app seria citar el instrumento. El hallazgo visual (que la app NO es la del mapa) se separo a SM-N30: N29 no lo cubre.
- **Cierre:** sin-codigo: es ficha de VERIFICACION. Medido en device 2026-11-02 por frontend2 (cold start, dev-client, cuenta canonica): DoD 5 control negativo OK (con sesion el reveal NO aparece, la condicion de montaje es la que creiamos) · DoD 6 los tres referentes distinguidos y dicho cual se midio · DoD 2 audio: NO suena, no hay asset en el repo (confirma BL-X10 [ASSUMED_PENDING_VERIFY]) · DoD 4 el numero: con sesion hay blanco + isotipo quieto >=7,4 s en dev-client - NO son los 200 ms que yo conjeture.
- **Dueño:** frontend2 (frontend1 está con la cáscara del chat)
- **Reportado por:** el operador, 2026-11-02: *«¿por qué al inicio nunca aparece el splash que tiene
  la app? ¿está implementado?»*. **Sí está implementado**; lo que falta es la verificación de que se
  vea completo, que nunca se hizo.
- **🔴 LO PRIMERO, porque es la trampa de esta ficha: «splash» nombra TRES cosas distintas en este
  código, y verificar una concluyendo de otra es el error esperable.**

  | # | Qué es | Dónde | Cuándo aparece |
  |---|---|---|---|
  | 1 | **`RevealEntrada`** — el del MAPA: lockup animado, pronunciación «o-DO-bi», botón Entrar. **6,8 s.** | `apps/mobile/src/modules/auth/RevealEntrada.tsx:135`, montado por `EntradaSesion.tsx:32` | **SIN sesión**: primer ingreso y post-logout |
  | 2 | **`EntradaDiaria`** — el isotipo dibujándose, arranques 2..n | `apps/mobile/src/modules/splash/EntradaDiaria.tsx`, montado en `app/_layout.tsx:96` | mientras `estado === 'verificando'` (resuelve el token guardado) |
  | 3 | **`Splash()`** — un `ActivityIndicator` pelado, **`testID="splash"`** | `apps/mobile/app/_layout.tsx:61-67` | fallback del layout |

  ⚠️ **El `testID="splash"` pertenece al #3**, que es el que el mapa NO dibuja. Un test o una
  captura que busque `splash` por testID **mide el spinner**, no el reveal del mapa ni la entrada
  diaria ([[un-nombre-con-dos-referentes-prueba-A-y-concluye-B]] — acá son tres).
- **Por qué el operador «nunca lo ve», medido:** con su sesión viva, el arranque entra por el **#2**,
  y el gate es `if (estado === 'verificando')` (`app/_layout.tsx:96`). Ese estado dura lo que tarda
  `AsyncStorage` en devolver el token + `/me`: con sesión válida resuelve casi instantáneo y el
  componente **se desmonta a mitad de animación**. El **#1** —el que él tiene en la cabeza, porque es
  el del mapa— **no se le muestra nunca**, porque requiere **no tener sesión**. No está roto: con esa
  tenencia, el estado que mide **no existe** (la clase de `SM-K3`/`SM-K5`/`SM-J3`).
- **⚠️ El #2 está DISEÑADO para cortarse, y eso NO es el defecto.** Su propio comentario lo dice:
  *«el isotipo dibujándose cubre la latencia real de `/me`, no la extiende (`EntradaDiaria` no gatea
  nada por sí sola)»* (`app/_layout.tsx:94-96`), y por eso recibe `onFin={sinOp}`. **Pedirle que se
  vea «íntegro» sería pedirle que retrase el arranque** — exactamente lo contrario de lo que se
  decidió. Para el #2 la pregunta correcta no es «¿se ve entero?» sino **«¿se ve BIEN mientras dura,
  o alcanza a verse un destello roto / un salto de color / un frame en blanco?»**. Si alguien
  «arregla» el #2 agregándole un tiempo mínimo, está rompiendo una decisión tomada, no cerrando esta
  ficha.
- **✅ Tenencia — y esta es la medición que vuelve la ficha ejecutable HOY:** el #1 se ve **cerrando
  sesión**, y la sesión que hay que cerrar es la del **usuario canónico de prueba**
  (`e2e-device@copiloto.test`), **no la del operador**. Así que **no espera su ventana ni su
  decisión**: es el camino (1) del eje de tenencia — estado forzable con la cuenta de prueba. La
  sesión del operador **no se toca**.
- **DoD:**
  1. **El #1 (`RevealEntrada`) filmado entero** en device, con la cuenta canónica: logout → arranque
     → el lockup completo hasta el botón «Entrar». Contra el mapa (`?ver=splash`): mismo lockup,
     mismo «se dice o-DO-bi», mismo botón. Filmación, no captura: es una animación, y una captura no
     distingue «se animó» de «apareció el frame final».
  2. **El audio de pronunciación**: que suene, o que su botón responda. Es parte del reveal del mapa
     y es lo primero que se cae callado en release.
  3. **El #2 (`EntradaDiaria`) en arranque frío**, filmado: la app matada de verdad
     (`adb shell am force-stop app.copiloto.emprendedor`, no el botón atrás) y abierta. Veredicto
     binario: **¿se ve bien mientras dura, sin destello blanco ni salto de color al entrar al
     escritorio?** Su duración **no** es criterio de falla.
  4. **El número**: cuánto dura el #2 en la práctica, medido, aunque sea 200 ms. Es el dato que hoy
     no existe y que explica el «nunca aparece» del operador con una cifra en vez de una conjetura.
  5. **Control negativo:** con la sesión ya iniciada, el #1 **NO** aparece. Confirma que la
     condición de montaje es la que creemos y no otra.
  6. Que la ficha **diga cuál de los tres** verificó en cada punto. Un «el splash anda» sin el número
     del componente no acredita nada.
- **🔗 Relación con `SM-L1` — NO se duplican, y conviene decir por qué:** `SM-L1` mide **tiempo** de
  `entrada` y exige **build de release** (el dev-client contamina el timing). Ésta verifica
  **integridad visual** y corre **con el dev-client**, hoy. Si el reveal estuviera roto, esperar al
  build para enterarse sería descubrirlo al final. Lo que esta ficha **no** puede afirmar es si se
  cumplen los **6,8 s** del mapa: eso es de `SM-L1`, en release.
- **DENTRO del sprint:** es una pantalla del mapa (`?ver=splash`, `?ver=volver`) que nunca se
  verificó contra la app. Entra por el denominador del mapa.

### SM-N30 · `sin-issue` — DENTRO DEL SPRINT: la pantalla de entrada REAL no es la que dibuja el mapa («Volver a entrar»)

- **Estado:** DOD-PARCIAL
- **Falta:** DoD 1/2/5 de DEVICE: capturas app||mapa de las DOS entradas (?ver=splash y ?ver=volver) diciendo por que camino entro cada una; el reveal volver REAL exige logout voluntario, que YA es posible: la tenencia de prueba quedo autorizada el 2026-11-03 y espera solo el provisioning en el VPS. DoD 4 (sesion caida sola) sin decidir, con la condicion dura de no perder el aviso que acredita SM-K6. DoD 3 (boton de audio) DESCARTADO por el operador: ya no es Falta.
- **Cierre:** Decision A bajada (la app se alinea al mapa) + causa raiz medida: el mapa carga el prototipo REAL en un iframe y el prototipo tiene DOS pantallas (#splash con tagline y lockup por letra · #reveal con «Odobi» entera); RevealEntrada.tsx las fusiono. Eso REIVINDICA el port FIEL (03e9c200): fue fiel a #splash. Contrato en el buzon, frontend2 dueña.
- **Dueño:** frontend2 (va pegada a `SM-N29`: misma pantalla, misma pasada de device)
- **Reportado por:** el operador, 2026-11-02, sobre el mapa `?ver=volver`: *«la pantalla de entrada es
  diferente a la del mapa; la imagen de "volver a entrar" no es la misma que tiene la app»*.
- **🔴 Es la OTRA mitad de `SM-N29`, y conviene no confundirlas.** `N29` pregunta **si el reveal se
  ve** (llega a mostrarse, íntegro, en arranque frío). Ésta pregunta **si lo que se ve es LO QUE EL
  MAPA DIBUJA**. Un reveal que aparece completo y no coincide con el mapa cierra `N29` y deja ésta
  abierta: son dos veredictos distintos sobre la misma pantalla. Marcar una por la otra es el error
  esperable ([[un-nombre-con-dos-referentes-prueba-A-y-concluye-B]]).
- **✅ TRES divergencias ya medidas en código, sin device** — esto NO arranca de cero, y ninguna de
  las tres necesita el teléfono para confirmarse como divergencia (el device decide cuál se ve, no si
  existe):

  | # | El mapa (captura del operador, `?ver=volver`) | La app (código) |
  |---|---|---|
  | 1 | **sin** tagline bajo el wordmark | **dibuja** `TAGLINE_MARCA` «Tu copiloto emprendedor» — `apps/mobile/src/modules/auth/RevealEntrada.tsx:106`, con fade-up propio (`:79`) |
  | 2 | **botón de audio** junto a «se dice o-DO-bi» (el parlante de la captura) | **no se renderiza**: depende de `pronunciacionAsset`, y **no hay ningún audio en el repo** — el propio docstring lo declara `[ASSUMED_PENDING_VERIFY]` (`RevealEntrada.tsx` §`pronunciacionAsset`, BL-X10) |
  | 3 | la pantalla «Volver a entrar» como **lo que se ve al no tener sesión** | sólo aparece con **`cierreVoluntario != null`** — o sea **sólo si el usuario cerró sesión A PROPÓSITO**. La sesión **caída sola** (token vencido, CTA5) va **directo al formulario**, sin reveal: `apps/mobile/src/modules/auth/EntradaSesion.tsx:26` |

- **⚠️ La #3 es la que más muerde, y no es un bug: es una decisión tomada.** El comentario de
  `EntradaSesion.tsx:10-14` la declara explícita. Pero el mapa **no la dibuja**, así que el mapa
  afirma un estado que la app sólo produce bajo una condición que el mapa no nombra. Quien compare
  «la app contra el mapa» sin saber esto va a concluir que el reveal está roto cuando en realidad
  entró por el camino de sesión caída. **Antes de tocar una línea de UI hay que decidir cuál de los
  dos se corrige**, y eso es decisión de producto del operador, no táctica:
  - **(a) manda el mapa** ⇒ el reveal también se muestra con la sesión caída sola, y hay que decidir
    dónde queda el aviso de «se cayó tu sesión», que hoy vive en el formulario;
  - **(b) manda la app** ⇒ el mapa suma el estado que falta y aclara que «Volver a entrar» es
    **post-logout voluntario**, no «cualquier arranque sin sesión».
  **No se implementa ninguna de las dos hasta que el operador elija.** Las divergencias #1 y #2 **no
  esperan esa decisión** y se pueden cerrar antes.
- **⚠️ Y la #1 tiene antecedente, que es el motivo de no «arreglarla» mirando una sola captura:** el
  propio `packages/core/src/textosEntrada.ts:24-27` dice que *«la fila `splash` de DEVICE15 lo midió
  **ausente** en todos los cuadros»*. O sea: **ya se midió una vez que el tagline no se veía** —
  mientras el código lo dibuja. Hay que establecer si hoy se ve o no **antes** de decidir si sobra
  en la app o falta en el mapa; si no se ve, la divergencia con el mapa no existe y el defecto es
  otro (el tagline que no llega a pintarse), que es un hallazgo distinto.
- **DoD:**
  1. **Captura de la app** en la pantalla de entrada real, device, 390 px, **al lado** de la del mapa
     `?ver=volver`. Una sola imagen comparada, no dos descripciones.
  2. **Veredicto por cada una de las tres filas**: coincide / no coincide / no aplica, con lo que se
     ve. Un «se parece» no acredita: la tabla tiene tres renglones y cada uno necesita el suyo.
  3. **Decir por qué camino entró** la app en esa captura (`cierreVoluntario` presente o no). Sin ese
     dato la captura no se puede interpretar: la misma pantalla tiene dos orígenes. Es el control que
     distingue «el reveal está mal» de «no era el reveal».
  4. **Divergencias #1 y #2 resueltas**: el tagline, visible o retirado según lo que se mida; y el
     botón de audio, **dibujado o quitado del mapa** — hoy el mapa promete un control que la app no
     puede tener porque el asset no existe. Prometer un botón que no hay es deuda del mapa, no de la
     app.
  5. **Divergencia #3:** sólo la **decisión del operador escrita acá**. La implementación, si la hay,
     es ficha aparte — no se cuela en ésta.
- **Tenencia:** cuenta canónica (`e2e-device@copiloto.test`). Se fuerza cerrando sesión con ella, que
  es exactamente el camino de `cierreVoluntario`. **La sesión del operador no se toca.** Para medir
  el camino de sesión caída sola hace falta invalidar el token, no cerrar sesión — y eso ya es otra
  tenencia: si no se logra, se declara en `Falta:`, no se finge.
- **🔗 Se corre PEGADA a `SM-N29`**: misma pantalla, mismo logout, misma pasada. Separarlas obliga a
  cerrar sesión dos veces y a pagar el arranque frío dos veces.
- **✅ MEDIDO EN DEVICE 2026-11-02 por frontend2** (cold start sin sesión, dev-client, cuenta
  canónica). Las tres divergencias quedan resueltas como hallazgo, y **aparece una cuarta que la
  tabla de arriba no tenía**:
  - **#1 CONFIRMADA, y da vuelta un dato viejo:** el tagline «Tu copiloto emprendedor» **SÍ se ve**
    en device. O sea que el *«DEVICE15 lo midió ausente en todos los cuadros»* de
    `packages/core/src/textosEntrada.ts:24-27` **está vencido** — y es exactamente el motivo por el
    que el DoD pedía medir antes de tocar: si hubiéramos creído al comentario, habríamos
    «arreglado» un tagline que se ve. Corregir ese comentario es parte del cierre de esta ficha.
  - **#2 CONFIRMADA:** sin asset de audio, el botón no existe en la app.
  - **#3 CONFIRMADA y AGRAVADA:** el camino real del arranque **no era «volver»**. Sin sesión y sin
    `cierreVoluntario`, la app entra por **`primeraVez` → «Empecemos»**, sin botón secundario. O
    sea que la pantalla que el operador comparó contra «Volver a entrar» **no era «Volver a
    entrar»**: era el reveal de primer ingreso. Es el control (3) del DoD funcionando — sin él,
    todas las diferencias se le habrían atribuido al reveal equivocado.
  - **🆕 #4 — el LOCKUP, que es la que el operador ve primero:** el mapa dibuja isotipo + la palabra
    **«Odobi» entera**; el reveal de la app dibuja el glifo **«O» haciendo de letra** + **«dobi»**
    animada letra a letra. Y el detalle que lo explica: **la pantalla de login siguiente SÍ dibuja
    glifo + «Odobi»**, que es justo lo del mapa — así que el mapa puede estar dibujando **la
    pantalla equivocada de la app**, no un lockup inexistente.
  - **Control negativo OK:** con sesión iniciada, el reveal **no** aparece. La condición de montaje
    es la que creíamos.
- **🔴 La #4 es decisión MAYOR del operador y está BLOQUEADA — no es táctica.** El lockup «O +
  dobi» animado **es una decisión de marca tomada** (BL-X10, cerrada con Martín el 2026-07-29).
  Cambiarlo al mapa no es un ajuste: es **revertir una decisión de diseño**. Las opciones, como las
  bajó frontend2:
  - **(A)** la app se alinea al mapa (lockup «Odobi» entero) — y el altavoz exige un **asset de
    audio que no existe**: hay que decir quién lo graba;
  - **(B)** el mapa se enmienda al código, porque BL-X10 es la decisión vigente, y el altavoz se
    difiere hasta tener el audio;
  - **(C)** mixta: lockup al mapa, altavoz diferido.
- **⚠️ El dato que ninguna de las tres opciones tenía, y que puede cambiar la respuesta:** el commit
  que portó el splash a mobile es **`03e9c200` (2026-09-28), y se llama «port FIEL del splash
  mobile» (BL-X10)** — es **tres semanas POSTERIOR** al último cambio del lockup en el prototipo
  (`f8428b9e`, 2026-09-07). Un port que se declara fiel y difiere deja **dos lecturas
  incompatibles**: o el port no fue fiel (⇒ la app tiene un defecto y gana el mapa, opción A/C), o
  la decisión de marca cambió después y el mapa quedó viejo (⇒ gana el código, opción B). **El
  código no puede decidir cuál de las dos es** — lo decide quien tomó la decisión de marca. Elegir
  sin ese dato es tirar una moneda con cara de criterio
  ([[el-contrato-afirma-el-mecanismo-que-no-opero]]).
- **✅ DECISIÓN DEL OPERADOR, 2026-11-02 — OPCIÓN A, y queda DESBLOQUEADA:** *«la entrada debe ser
  igual a la del mapa, debemos respetar este diseño»*. **El mapa es la fuente de verdad del diseño
  de la entrada.** Donde app y mapa difieran, **se corrige la app**.
- **🔴 Lo que esta decisión SUPERA, dicho explícito para que nadie lo «restaure»:** el lockup «O +
  dobi» animado letra a letra es la decisión **BL-X10** (cerrada con Martín el 2026-07-29), y el
  commit que lo portó se llama *«port FIEL del splash mobile»* (`03e9c200`). **BL-X10 queda
  superada en el lockup por esta orden.** Quien lea BL-X10 o ese commit sin esta línea va a creer
  que el lockup «Odobi» entero es un defecto y lo va a revertir — que es exactamente el ciclo que
  este backlog ya pagó en `SM-N16`/`SM-N28`. La animación por letra **no se descarta por sí
  misma**: lo que manda es que el resultado se lea como el lockup del mapa; si la animación puede
  sobrevivir dibujando «Odobi» entera, sobrevive.
- **🔴 EL AUDIO QUEDA DESCARTADO — orden del operador, 2026-11-03:** *«no necesitamos la voz de
  odobi… no nos interesa el audio… no sé de dónde sacaste que había que implementar eso»*. **No hay
  botón de pronunciación, no hay asset, no hay disparador pendiente.** El punto sale del DoD.
  ⚠️ **Y el error fue de planificación, dicho para que no se repita:** nadie pidió el audio. Salió
  de **leer el prototipo como si fuera una especificación**: `#reveal` dibuja «se dice o-DO-bi»
  (`prototipo/index.html:2555`) y `RevealEntrada.tsx` tiene un `pronunciacionAsset` opcional, y de
  ahí lo subí a DoD y hasta lo convertí en **pregunta abierta al operador**. Un elemento que existe
  en un mockup **no es alcance contratado**; «la app debe igualar al mapa» ordena corregir lo que
  **divergió**, no implementar todo lo que el mockup dibuja. Un DoD inflado así cuesta doble: pide
  trabajo que nadie quiere **y** bloquea la ficha esperando una decisión que no existía.
- **✅ Lo que esto simplifica:** el **texto** «se dice o-DO-bi» no está en discusión (es una línea del
  core, `textosEntrada.ts:21`, sin costo ni asset). Lo descartado es **el altavoz**. Donde el mapa
  dibuja ese control, **se enmienda el mapa** — es la excepción explícita a la decisión A, y la
  autoriza la misma orden que la descarta.
- **🧭 La sub-decisión que la orden no resuelve, resuelta por defecto para no frenar (táctica, el
  operador la revierte si quiere otra cosa):** el mapa dibuja **dos** entradas —«Splash» (primer
  ingreso) y «Volver a entrar» (post-logout)— y **no dibuja** el tercer camino que la app sí tiene:
  **sesión caída sola**, que hoy aterriza **directo en el formulario**, sin reveal
  (`EntradaSesion.tsx:26`). «Igual al mapa» no dice nada de un camino que el mapa no muestra. **Se
  resuelve alineando:** la sesión caída sola también aterriza en el reveal «volver», y **el aviso
  de sesión caída viaja con ella** — hoy ese aviso vive en el formulario, y perderlo sería cambiar
  la entrada **y además** romper `SM-K6`, que acredita justamente ese aviso. **Si el aviso no puede
  viajar sin romper K6, el camino de sesión caída se queda como está y se declara acá**: alinear la
  pantalla no vale perder el aviso.
- **🎯 CAUSA RAÍZ MEDIDA EN EL PROTOTIPO, 2026-11-02 — y cambia el tamaño del trabajo: no son
  cuatro divergencias sueltas, es UNA.** El mapa no es un artefacto aparte: carga **el prototipo
  real en un iframe** (`mapa-pantallas/index.html:65,289` — *«el iframe carga el prototipo REAL, no
  una captura»*). Y el prototipo tiene **DOS pantallas distintas**, no una:

  | Prototipo | Lockup | Tagline | Pronunciación |
  |---|---|---|---|
  | **`#splash`** (`prototipo/index.html:2446-2462`) | glifo «O» + «dobi» letra a letra (`:2457-2459`) | **sí**, «Tu copiloto emprendedor» (`:2461`) | no |
  | **`#reveal`** (`:2546+`) | **«Odobi» entera** (`:2553`, `.rv-word`) | **no** | sí, «se dice o-DO-bi» (`:2555`) |

  **La app fusionó las dos en un solo componente.** `RevealEntrada.tsx` dibuja el **lockup y el
  tagline de `#splash`** y les agrega **las puertas y la pronunciación de `#reveal``. Por eso el
  reveal de la app tiene «dobi» y tagline donde el prototipo tiene «Odobi» y ninguno.
- **🔴 Esto REIVINDICA el `port FIEL` y reencuadra la decisión A — leer antes de tocar nada.** El
  port **sí fue fiel**… **a `#splash`**. El defecto no es el lockup animado: es que **se usó el
  componente de una pantalla para dibujar la otra**. Por lo tanto la decisión A **no borra BL-X10
  ni la animación por letra**: ésas siguen siendo correctas **en el splash**. Lo que se corrige es
  **el reveal**, que debe verse como `#reveal`: **«Odobi» entera y sin tagline**.
  ⚠️ **El error caro acá sería barrer el tagline y la animación de TODA la app** para «alinearse al
  mapa»: eso rompería el `#splash`, que hoy **coincide** con el prototipo, y el síntoma aparecería
  en otra pantalla, donde nadie lo atribuiría a esta ficha
  ([[el-mismo-defecto-vivia-dos-veces-el-fix-en-la-capa-compartida-no-alcanzo]]).
- **✅ Lo que esto achica:** el trabajo deja de ser «rediseñar la entrada» y pasa a ser **separar
  los dos usos del componente**: el reveal pide lockup `#reveal` (palabra entera, sin tagline) y el
  splash queda intacto. Y el punto 2 del DoD queda **resuelto por medición, no por criterio**: el
  tagline **no se borra de la app** — sale **del reveal** y **se queda en el splash**.
- **DoD (reescrito por la decisión A — reemplaza al de arriba):**
  1. **Lockup:** la app dibuja isotipo + **«Odobi» entera**, como el mapa. Captura app‖mapa al lado.
  2. **Tagline:** resuelto contra el mapa (el mapa no lo muestra ⇒ **sale de la app**, salvo que la
     captura del mapa a 390 px lo tenga y la del operador lo recortara — **medir el mapa, no la
     captura**, que es la trampa de este punto).
  3. **Botón de pronunciación: DESCARTADO** (orden del operador, 2026-11-03). No se implementa y no
     queda como `Falta:`. Se **saca del mapa** el control de audio; si `RevealEntrada.tsx` tiene el
     prop `pronunciacionAsset` muerto, se retira con la ficha.
  4. **Camino de sesión caída:** alineado al reveal «volver» **con el aviso**, o declarado por qué
     no se pudo sin romper `SM-K6`. Las dos salidas son válidas; el silencio no.
  5. **Captura app‖mapa** de las DOS entradas del mapa: `?ver=splash` (primer ingreso, «Empecemos»)
     y `?ver=volver` (post-logout, «Entrar»), **diciendo por qué camino entró cada una**. Sin eso
     no se distingue «el reveal está mal» de «no era ese reveal» — es el control que ya evitó un
     diagnóstico equivocado el 2026-11-02.
  6. **El comentario vencido corregido:** `packages/core/src/textosEntrada.ts:24-27` afirma que
     DEVICE15 midió el tagline **ausente**, y la medición de device lo refutó. Dejarlo es sembrar
     el próximo diagnóstico falso.
  7. **La leyenda falsa del mapa corregida:** dice *«en mobile no existe: la app salta directo al
     formulario»*. Existe. Si además se alinea el camino de sesión caída (punto 4), la leyenda
     queda doblemente vencida.
- **✅ `RevealEntrada.tsx` DESBLOQUEADO** por la decisión A de arriba. Lo que ya avanzaba sin
  esperarla, y sigue valiendo: corregir el comentario vencido de `textosEntrada.ts:24-27` (#1), sacar del mapa el
  botón de audio o declararlo pendiente de asset (#2), y enmendar la leyenda del mapa que hoy dice
  *«en mobile no existe: la app salta directo al formulario»* — **es falsa**: existe, sólo que
  condicionada a `cierreVoluntario` (#3).
- **DENTRO del sprint:** es literalmente una pantalla del mapa que no coincide con la app, que es el
  denominador del sprint.

### SM-N31 · `sin-issue` — La barra de grabación no ocupa el ancho al pie: `grabando` y `bloqueado`

- **Estado:** DOD-PARCIAL
- **Dueno-activo:** frontend2
- **Falta:** Captura de device de grabando (sostenido) y bloqueado (fijado) en Gastos con adb motionevent DOWN/MOVE, y regresion del cancelar deslizando. En codigo la causa medida ya no existe (DockFuncion->DockEntrada, enLugarDelCampo; DockEntrada.test.tsx:108,128): entradas 12 y 13 pasan de A a NO-VERIFICABLE.
- **Dueño:** frontend2
- **De dónde sale:** del medidor `scripts/mapa-51-estado.py`, que las encontró como **las dos únicas
  entradas divergentes del mapa que NINGUNA ficha del sprint cubría**. No es un hallazgo nuevo: están
  en `DIFERENTE · A` desde el relevamiento del 2026-10-16 (entradas **12** y **13**). Lo que faltaba
  era el **id** que las hiciera despachables — sin él se leían como pendientes, que es un estado
  normal, y nadie las iba a tomar ([[el-registro-no-se-marcaba-porque-su-id-no-circulaba]]).
- **Las dos son UNA corrección, y por eso van en una ficha:** el corpus dice *«Mismo arreglo que
  "Grabando": barra al pie, de ancho completo»*. Separarlas daría dos fichas que se cierran con el
  mismo commit y la misma captura.
- **Medido (corpus 2026-10-16, con `adb`):**
  - **12 `grabando`:** con un dedo sostenido (`DOWN` sin `UP`, sin voz — no hace falta audio para ver
    la pantalla) aparecen punto rojo, reloj «0:01» y «‹ Deslizá para cancelar» **debajo** del campo.
    El prototipo los pone en una **barra al pie que reemplaza al campo**.
  - **13 `bloqueado`:** con `DOWN` + seis `MOVE` hacia arriba (927 → 700 px) la grabación se fija:
    tacho, onda, reloj «0:02», pausa y enviar. El prototipo los dibuja en **la misma barra al pie**,
    con onda ancha.
  - ✅ **Lo que NO está roto, dicho para que no se "arregle":** el **cancelar deslizando sí funciona**
    (verificado en device). La divergencia es de **ubicación y ancho**, no de comportamiento.
- **⚠️ El `(N8)` del corpus NO es `SM-N8`.** El corpus escribe «(N8)» apuntando a la corrección de
  otro sprint; `SM-N8` de este backlog es otra cosa (el `reply_text`). Un nombre con dos referentes
  hace que se pruebe A y se concluya B — por eso esta ficha nace con id propio
  ([[un-nombre-con-dos-referentes-prueba-A-y-concluye-B]]).
- **Skill obligatoria antes de tocar:** `swmansion-rn-gestures`. El gesto de grabación compone
  `DOWN`/`MOVE` sostenido con el deslizamiento de cancelar, y mover la barra al pie cambia la zona
  del gesto. Es el mismo gate que ya evitó dos iteraciones a ciegas sobre el panel de Apps.
- **DoD:**
  1. Durante la grabación, la barra **ocupa el ancho al pie y reemplaza al campo**, como el prototipo,
     en los **dos** estados (sostenido y fijado).
  2. El **cancelar deslizando sigue funcionando** después del cambio — es regresión obligatoria, no
     opcional: hoy funciona y la ficha mueve su zona.
  3. Capturas de device de los dos estados, con el método declarado (`adb shell input motionevent`
     DOWN/MOVE, **nunca `input tap`**, que no ejercita un Pan de RNGH).
  4. Las entradas **12** y **13** del corpus pasan a `CONFORME` **con su cita**, y el veredicto se
     cambia **midiendo la app**, no por el estado de esta ficha.

---

### SM-N32 · `sin-issue` — Inteligencia de Negocio: la pantalla ENTERA difiere del mapa (faltan 4 secciones, sobran 3 elementos)

- **Estado:** DOD-PARCIAL
- **Falta:** SOLO la captura de device de las secciones, que hoy la tenencia la tiene frontend1. El tope de monotributo queda FUERA del sprint y escalado al operador (pide la categoria del emprendedor + tabla de escala AFIP versionada), no recortado por mi.
- **Cierre:** Codigo COMPLETO en main: backend 5928f837 (#1459, CI 6/6, 89 passed en VPS con adversarial de mismo CUIT en A y B) + front acdbff54 (#1460, CI 6/6) sobre 32730046 (#1454). Entraron: selector Resumen/Preguntar retirado, montos del mes en negro, las 8 categorias con porcentaje, margen PONDERADO rotulado «Sobre N» con peor trabajo, y N comprobantes por cliente con el null oculto.
- **Dueño:** frontend2
- **Reportado por:** el operador, 2026-11-03, en tres mensajes: *«siguen figurando dos botones
  arriba, el de resumen y de preguntar… fueron eliminados»*, *«lo implementado en inteligencia de
  negocio difiere del mapa»* y *«revisá la pantalla completa»* — esta última porque yo había mirado
  **sólo la mitad de arriba** y había cerrado el diagnóstico con eso.

- **🔬 Cómo se midió el lado del MAPA, y por qué esta vez el inventario es exacto:** no de las
  capturas (que están recortadas y fue el error), sino del **DOM del prototipo vivo** —
  `http://127.0.0.1:8931/prototipo/index.html?ver=bi`, contenedor `#bi-scroll`, 1.614 caracteres,
  58 nodos de texto. Un inventario leído del DOM es **completo por construcción**; uno leído de un
  `.png` termina donde termina la imagen, y ninguna de las tres capturas del relevamiento mostraba
  la pantalla entera.

- **LAS 11 SECCIONES DEL MAPA, en orden** (literal del DOM):
  1. «Tirá para actualizar»
  2. Card blanca: **«Inteligencia de Negocio» + «Agosto»** (el período, adentro de la card)
  3. Card negra: **Saldo en caja** `$286.000` · «Al 19 de agosto» · **Entró** / **Salió**
  4. **Este mes** — cuatro mosaicos: Ingresos · Gastos · Facturado · Cobrado
  5. **Rentabilidad** — «—» + *«Falta asignar gastos a trabajos. No es cero: es que todavía no se
     puede calcular.»*
  6. **Por cobrar** — `$225.000` · **«$80.000 vencidos»**
  7. **En qué se te va la plata** — Mercadería · Servicios · Transporte · Otros, con sus montos
  8. **Entró vs. salió** — Abr · May · Jun · Jul · Ago
  9. **Mejores clientes** — con **mensaje de vacío propio** (*«Todavía no registraste ventas a ningún
     cliente. Cuando factures o anotes un cobro con nombre, el ranking se arma solo.»*) y, con datos,
     **«N comprobantes»** por fila además del monto
  10. **Acumulado del año** — «Facturado en los últimos 12 meses» `$4.420.000`, **barra «68% del
      tope»** y *«Monotributo categoría F · tope $6.500.000. A este ritmo lo alcanzás en noviembre.»*
  11. **Margen por trabajo** — `41%` + *«Promedio de 3 trabajos cerrados. El más flojo: Reforma Díaz,
      12%.»*
  + al pie, **fuera** del scroll: el dock **«Preguntame lo que quieras…» + mic**.

- **LO QUE SOBRA EN LA APP** (medido sobre `2026-10-16-relevamiento-capturas/app-inteligencia-top.png`
  y `app-inteligencia-2.png`):
  1. **Los dos botones «Resumen» / «Preguntar»** bajo el título. El mapa **no los dibuja** y declara
     la baja en pasado: *«la misma duplicación que **sacamos** con la solapa "Preguntar" de
     Inteligencia»* (`mapa-pantallas/index.html:240`). Control: 0 coincidencias en
     `mockups/12-funciones/index.html`, con control positivo sobre el mismo grep.
  2. **Una sección «FACTURACIÓN · 1 may – 1 oct»** con su gráfico de barras, que **no existe en el
     mapa** — el mapa trae el acumulado dentro de la sección 10, no un gráfico aparte.
  3. **Los montos de Ingresos y Gastos en verde y rojo.** ⚠️ No es sólo que el mapa los ponga en
     negro: el mockup 12 **derogó esa paleta explícitamente** — *«Teñir la fila de rojo/verde traería
     una paleta semántica que el sistema no tiene y competiría con el único acento»*. Fue
     considerado y rechazado.
  4. **Un botón-engranaje flotante** sobre «ESTE MES». **Sin diagnosticar:** puede ser un control de
     la app, un artefacto de la captura o una burbuja del sistema. Primer paso: mirarlo en device sin
     capturar. No se retira nada hasta saber qué es.

- **LO QUE FALTA EN LA APP** — cuatro secciones enteras del mapa, más dos detalles:
  - **«Por cobrar»** con el monto y **«$X vencidos»** (sección 6) — no aparece en ninguna captura.
  - **«En qué se te va la plata»** con el desglose por categoría (sección 7). ⚠️ El mockup 12 dice
    que **esto es el corazón de la pantalla**: *«el desglose por categoría con su porcentaje es lo que
    el repo define como resumen mensual — no es decoración, es la respuesta a "en qué se me va la
    plata"»*. Es la sección más cara de las que faltan.
  - **«Margen por trabajo»** (sección 11).
  - **La barra «68% del tope» y la línea del monotributo** (sección 10). La app muestra el acumulado
    pelado («Acumulado del año · $235.000 · Últimos 12 meses facturados») **sin** el tope ni la
    proyección, que es la información que hace útil al número.
  - **«N comprobantes»** por fila en Mejores clientes (sección 9): la app muestra sólo nombre y monto.
  - **El mensaje de vacío propio** de Mejores clientes (sección 9).
  - **El dock** — eso ya es `SM-J1`, no se duplica acá.

- **⚠️ ASIMETRÍA DE LAS DOS MEDICIONES, y es la condición dura de esta ficha:** el lado **mapa** se
  midió **hoy** contra el prototipo vivo y es exacto. El lado **app** sale de capturas del
  **2026-10-16**, con `main` 18 días más viejo. **Antes de implementar hay que re-verificar en device
  qué sigue faltando**: puede que algo ya esté hecho (`SM-J3` tocó cabecera y etiqueta de mes) y
  volver a implementarlo sería trabajo doble sobre un diagnóstico vencido. **Lo que NO cambia** por
  esa re-verificación son los dos botones y los colores: el operador los vio **hoy**.

- **🔴 Por qué nada de esto llegó como tarea, que es lo que el operador preguntó** (*«¿no se supone
  que habíamos hecho un relevamiento justamente para esto?»*): **el relevamiento sí lo vio** — la
  entrada **42 `bi`** está desde el 2026-10-16 y dice *«Falta la etiqueta de mes y los mosaicos y el
  dock»*. Fallaron **dos cosas distintas** y no conviene confundirlas:
  - lo que quedó bien clasificado (`DIFERENTE · A`) **no se implementó**: es cola parada, y hoy hay
    37 fichas con trabajo pendiente y las tres sesiones caídas entre 7 y 17 horas;
  - **los dos botones quedaron clasificados `B`** —*«La pestaña "Preguntar" es una salida al chat
    (B)»*—, y `B` significa **gana la app, se enmienda el mapa**. O sea: el corpus los **dio por
    buenos**. Un elemento mal clasificado **no genera trabajo** y ningún barrido lo levanta: los
    controles cazan lo **no** clasificado, nunca lo clasificado **mal**
    ([[nada-cazaba-al-mal-clasificado-solo-al-no-clasificado]]);
  - y el **resumen de la entrada 42 es incompleto**: enumera tres faltantes cuando faltan **cuatro
    secciones** más detalles. Se escribió mirando el prototipo **recortado**, exactamente el mismo
    error que yo repetí hoy hasta que el operador me mandó mirar la pantalla completa. **La lección
    operativa: un corpus de comparación se arma contra el DOM o contra la pantalla scrolleada entera,
    nunca contra una captura de la mitad de arriba.**

- **DoD:**
  1. **Re-verificación en device primero** (no es trámite: es lo que evita reimplementar lo ya
     hecho): captura de la pantalla **scrolleada completa**, y la lista de qué de arriba sigue
     faltando contra las 11 secciones. Sin eso no arranca la implementación.
  2. **«Resumen» y «Preguntar» retirados**, con «antes» y «después».
     ⚠️ **Antes de retirar «Preguntar», medí a dónde va hoy.** El corpus dice que es *«una salida al
     chat»* (decisión del 2026-10-13). Si es el **único** acceso a ese camino, retirarlo deja al
     usuario sin él: entonces se retira **junto con** el dock de `SM-J1`, que es el reemplazo, y no
     antes. Las dos salidas son válidas; dejarlo sin medir, no.
  3. **Los montos sin la paleta verde/rojo** (el contraste lo lleva el texto, no el color) y **la
     sección «FACTURACIÓN» resuelta**: o se retira, o se documenta en el mapa con su porqué (D4). Las
     dos salidas son válidas; que quede sin decidir, no.
  4. **Las cuatro secciones faltantes implementadas**, en el orden del mapa: «Por cobrar», «En qué se
     te va la plata», la barra del tope con la línea del monotributo, y «Margen por trabajo». Más
     «N comprobantes» y el vacío de Mejores clientes.
     🔴 **Cada una necesita su dato del backend.** Si alguno no existe, **eso es un `pedido_` a
     backend, no una invención**: inventar la forma del endpoint es codificar la esperanza. Medí
     primero qué trae hoy `api/` y bajá el pedido con los campos que falten.
  5. **El engranaje identificado**, con una línea escrita aunque la respuesta sea «era de la
     captura».
  6. **La entrada 42 del corpus corregida**: «Preguntar» pasa de `B` a `A` con la cita del mapa que
     lo funda, y el *Diferencia:* se reescribe con el inventario completo de las 11 secciones. El
     veredicto se cambia **midiendo la app**, no por el estado de esta ficha.
- **Tenencia:** el grueso es estructura y sirve cualquier cuenta. El **vacío** de Mejores clientes
  necesita el tenant vacío — mismo disparador que `SM-J3`, que lo tiene declarado como su `Falta:`.
- **DENTRO del sprint:** es divergencia directa contra el mapa, reportada por el operador — el
  criterio declarado del sprint.

---

### SM-N33 · `sin-issue` — El ranking de mejores clientes agrupa los cobros por NOMBRE, no por identificador

- **Estado:** TERMINADO
- **Dueno-activo:** backend
- **Cierre:** DoD completo. Codigo: aba185ec (#1480), ancestro de origin/main verificado con merge-base --is-ancestor; CI 6/6 y deploy VERDE con durabilidad. El defecto era que _mejores_clientes agrupaba por coalesce(cliente_nombre, receptor_nombre), que produce DOS errores opuestos a la vez: dos grafias del mismo cliente se parten en dos filas, y dos homonimos distintos se fusionan en una. Un ranking no da error al equivocarse: da un orden creible, y el emprendedor decide sobre el. Los 4 tests nuevos cubren las dos direcciones mas los bordes: (a) 2 grafias -> 1 fila, (b) 2 homonimos con CUIT distinto -> 2 filas, (c) sin identificador -> nombre normalizado con comprobantes None (el campo de #1459, que no resolvia el agrupamiento pero si evita afirmar un total que no se puede atribuir), (d) adversarial mismo CUIT en tenant A y B. El (d) es el que importa para la regla 7: agrupar por un identificador compartible abre la pregunta de si el agrupamiento cruza tenants, y sin ese test el aislamiento quedaria especificado y no ejercitado. Corrida EN EL VPS: 71 passed. cierre_ con FICHA/SHA/DOD en coordinacion/cerrado/2026-11-03/.
- **Dueño:** backend
- **De dónde sale:** hallazgo de backend al cerrar `SM-N32` (#1459 → `5928f837`). **No es
  presentación: es el dato.** Nace con id propio porque un hallazgo que sólo vive en un mensaje no
  vuelve a aparecer ([[el-registro-no-se-marcaba-porque-su-id-no-circulaba]]).
- **Medido:** `_mejores_clientes` en `inteligencia_queries.py` agrupa `copiloto_cobros` por
  `coalesce(cliente_nombre, receptor_nombre)`. De ahí salen **los dos errores a la vez**, y son
  opuestos: **dos grafías del mismo cliente dan dos filas** (se subdeclara a quien más compró) y
  **dos homónimos distintos dan una sola** (se infla a quien no corresponde). El ranking es, por
  definición, lo que más sufre un agrupamiento equivocado: ordena por el monto que acabamos de mal
  sumar.
- **⚠️ Lo que YA está mitigado, dicho para que no se "arregle" dos veces:** el campo
  `comprobantes` que entró en #1459 devuelve **`null`** cuando hay homónimos, en vez de un número
  que mentiría. Eso **acota el daño, no lo resuelve**: el `null` avisa en la columna de
  comprobantes, mientras el **orden y los montos** del ranking siguen saliendo del agrupamiento por
  nombre. Un mitigador visible hace parecer resuelto lo que no lo está.
- **DoD:**
  1. El agrupamiento pasa a un **identificador** (CUIT/ficha de cliente), con la regla escrita para
     el caso **sin identificador** — ése es el caso difícil y no puede quedar implícito.
  2. Un test con **dos grafías del mismo cliente** (→ UNA fila) y **dos homónimos con CUIT distinto**
     (→ DOS filas). Los dos casos, no uno: son los dos sentidos del defecto y un test solo deja
     mudo al otro.
  3. El adversarial de aislamiento sigue verde (mismo CUIT en A y B: A ve 0, B ve 1) — es regresión
     obligatoria, no opcional: la ficha toca justo la clave de agrupamiento.
  4. Corrida en el VPS, nunca en la PC.
- **Depende:** nada. No bloquea a nadie.
- **FUERA del corpus del mapa:** no mueve ningún veredicto de paridad — el mapa no dibuja la clave
  de agrupamiento. Entra al sprint porque es un defecto de dato **descubierto** por una ficha del
  sprint, y queda explícito para que no infle el denominador (`DEC-18`).

---

### SM-N34 · `sin-issue` — Las tres faltas de la agenda quedaron HUÉRFANAS dentro de una ficha cerrada

- **Estado:** DOD-PARCIAL
- **Dueno-activo:** frontend2
- **Falta:** RE-MEDIDO 2026-11-03. El pedido_ a backend esta CONTESTADO y cerrado, y encontro un defecto REAL que nadie habia pedido buscar: _eventos_de recorria todo el arbol del payload SIN deduplicar, asi que el MISMO id que aparecia por dos ramas salia dos veces. Fix ccbe2aa2 (#1483, ancestro de origin/main), CI 6/6, 23 passed en VPS, DESPLEGADO. Los otros tres hallazgos: (a) el endpoint es GET /mi-dia/calendario en mi_dia_web.py y /agenda NO EXISTE -- por eso mi grep daba 0 hits, y el vacio era la pregunta, no la respuesta; (b) un evento NO puede caer en dos grupos, _agrupar da una sola cubeta (con test); (c) las instancias de un recurrente con id DISTINTO si son varias, y eso es dato, no defecto (con test). Lo que FALTA es solo el DoD 4: la captura con payload REAL, que no existe porque Calendar sigue sin conectar en el tenant canonico. Eso depende de una decision del OPERADOR -- que cuenta Google vincular -- escalada y sin respuesta; backend se nego correctamente a improvisar una cuenta o a insertar filas a mano, porque un INSERT mediria un estado falso. Mas el codigo de frontend2 que no necesita payload: el «+» de «Nuevo evento», la decision punto-vs-texto del estado y la linea del ahora (que medido en codigo NO existe).
- **Dueño:** frontend2
- **De dónde sale:** auditoría de `SM-L4` (planificación, 2026-11-03) sobre las entradas que
  `scripts/mapa-51-estado.py` marcaba como **cubiertas sólo por el nombre**. La entrada **10
  `agenda`** del corpus sigue `DIFERENTE · A` y la única ficha que la citaba es **`SM-J5`, que está
  `TERMINADO` como «PREMISA REFUTADA / SIN OBJETO»**.
- **Medido — y acá está el mecanismo, que es lo que importa:** lo que `SM-J5` refutó fue **una** de
  sus premisas, la del agrupamiento: la agenda **sí** distingue Hoy · Mañana · Esta semana · Sin
  hora (`apps/mobile/src/modules/midia/PantallaAgenda.tsx:23-24`, títulos exactos del backend). Pero
  el cuerpo de esa misma ficha sigue reclamando, sin contradicción alguna, **la línea del ahora
  (mockup 14)**, **«+ Nuevo evento»**, **el punto de estado** y un evento que aparece **repetido**
  en «Esta semana». Al cerrarse por la premisa refutada, esas cuatro faltas quedaron **dentro de un
  ✅** y ninguna ficha viva las cubre. Control: `grep` de «línea del ahora» en el backlog devuelve
  **sólo** las dos líneas de `SM-J5`.
- **🔴 Por qué nace ficha nueva en vez de reabrir `SM-J5`:** un hallazgo no reabre un ✅ (`DEC-18`) —
  un criterio que crece con cada medición no se puede alcanzar. Y el riesgo de clase que esto
  destapa es más ancho que la agenda: **una ficha con VARIAS premisas se cierra cuando se refuta
  UNA**, y lo que arrastra al archivo es todo lo demás que decía. Vale revisar si hay otras
  `TERMINADO · PREMISA REFUTADA` con faltas vivas en el cuerpo.
- **Medido en código (frontend2, 2026-11-03) — el DoD 1 ya está CUMPLIDO, y recorta la ficha.**
  `apps/mobile/src/modules/midia/PantallaAgenda.tsx`:
  - **Línea del ahora: NO existe** (0 hits). Es lo único que hay que implementar de cero.
  - **«Nuevo evento»: SÍ existe** — botón primario en `:118`, deja el texto en el chat. Le falta
    sólo el **«+»** del mapa. Implementarlo de nuevo habría sido rehacer lo que ya estaba.
  - **Punto de estado: existe, pero como TEXTO** «Google Calendar conectada» (`:109`), no como
    punto/color. No es ausencia: es **otra forma**, así que la decisión es igualar al mapa o
    documentar la diferencia como `DIFERENTE · B` — las dos salidas son válidas, que quede sin
    decidir no.
  - **Repetido: el front NO deduplica** — renderiza los grupos tal como llegan. ⇒ **dato vs defecto
    no se puede decidir desde el front**: exige el payload real de `/agenda`. Eso es un `pedido_` a
    backend, no una inspección más de la app.
- **DoD:**
  1. **Primero, sin device y sin tocar nada:** decir si la línea del ahora, «+ Nuevo evento» y el
     punto de estado **existen hoy** en `PantallaAgenda.tsx`, con `path:línea`. Si existen, la ficha
     cierra con la cita y el veredicto se corrige — no se implementa de nuevo lo que ya está.
  2. Lo que no exista, implementado según la vista **mixta** (D9): línea de tiempo con línea del
     ahora para **hoy**, lista para **Mañana** y **Esta semana**.
  3. El **repetido**: verificar **contra el dato de Calendar si es dato o defecto ANTES de arreglar
     nada**. Si es dato, se escribe eso y ese punto cierra con la cita. (Este DoD es el de `SM-J5`
     y sigue siendo el correcto: se hereda, no se reinventa.)
  4. Captura de device, **con Google Calendar conectado** — sin eso la agenda no es comparable con
     el mapa (`PantallaMiDia.tsx:560-566` oculta «Ver agenda» cuando la conexión está caída).
  5. La entrada **10** del corpus pasa a `CONFORME` o a `DIFERENTE · B` **con cita**, y el veredicto
     se cambia **midiendo la app**, nunca por el estado de esta ficha.
- **Depende:** Google Calendar conectado en el usuario canónico (mismo disparador que ya tenía la
  entrada 10) y la tenencia del device, que hoy es de frontend1.
- **DENTRO del sprint:** es divergencia directa contra el mapa — el criterio declarado del sprint.

---

### SM-N35 · `sin-issue` — La categoría de monotributo, en Ajustes › ARCA

- **Estado:** DOD-PARCIAL
- **Falta:** DoD 5: captura de device del formulario con la categoria elegida (frontend1, tenencia del device). Y el guardado completo sigue fallando con un 409 sin atribuir: hay seis conflicto( en apps/copiloto/afip_web.py (:256, 277, 321, 534, 722, 739) y el access log no guarda el body (duenos: frontend1 + backend).
- **Cierre:** 8ec870e5 (#1468): selector de categoria A-K, solo con monotributo, opcional. d42da583 (#1500, ancestro de origin/main): Guardar perfil no manda la fecha de inicio incompleta (CampoFecha emite vacio y afip_web.py:96 lo rechaza con 422 sin campo) y marca el campo; test con control positivo, CI 6/6.
- **Dueño:** frontend2
- **De dónde sale:** decisión del operador, 2026-11-03, en
  `coordinacion/.../2026-11-03_contrato_planificacion-a-backend-y-frontend2_MONOTRIBUTO-*`.
  *«la escala de monotributo la define ARCA… y mi categoría es A… tal vez habría que agregar en
  ajustes este dato dentro de la configuración de ARCA»*.
- **⚠️ Casi todo existe — se completa, no se construye.** El medidor entero (barra, `N% del tope`,
  semáforo) está en `apps/mobile/src/modules/inteligencia/AcumuladoAnual.tsx:76-98`, con su
  fail-soft en `:16-17`. El formulario de ARCA y el patrón de selector, en
  `apps/mobile/src/modules/ajustes/afip/PantallaAfipSetup.tsx:85,171,180`. **El medidor nunca
  apareció por falta de UNA entrada, no por falta de código:** quien escriba un medidor nuevo está
  duplicando `AcumuladoAnual.tsx`.
- **DoD:**
  1. Selector de categoría (A…K) en `PantallaAfipSetup`, **junto a `condicionIva`**, reusando
     `opcionesCondicionIva`/`OpcionSelect` (`:85`) — mismo patrón, no uno nuevo.
  2. **Sólo visible/aplicable cuando `condicionIva === 'monotributo'`.** Un responsable inscripto no
     tiene categoría; mostrarle el campo es pedirle un dato que no existe.
  3. Persiste en el perfil por el mismo camino que los campos actuales (`:259-262`), per-tenant,
     **nunca de env** (regla 7).
  4. Test de que **no mandar categoría sigue siendo válido**: el fail-soft es el estado por defecto y
     una validación obligatoria rompería a todo emprendedor ya dado de alta.
  5. Captura de device del formulario con la categoría elegida.
- **Depende:** nada del backend para la UI.
- **FUERA del corpus del mapa:** alcance nuevo decidido por el operador; no infla el denominador de
  paridad (`DEC-18`).

---

### SM-N36 · `sin-issue` — La escala de ARCA versionada y el `tope` que hoy es `null`

- **Estado:** TERMINADO
- **Dueno-activo:** backend
- **Cierre:** DoD completo, punto por punto, acreditado por backend. Codigo: 4a5bb923 (#1469, ancestro de origin/main) -- escala de monotributo versionada con vigencia_desde y facturado.tope calculado, y contabilidad_web.py deja de devolver None cuando hay categoria Y escala vigente. (a) las DOS ramas tienen test: test_escala_monotributo.py:77 y :90/:156. (b) el control explicito de escala VENCIDA => null y nunca el tope viejo: :95 y el endpoint en :160 -- es el punto que importaba, porque devolver el tope viejo cuando la escala vencio no da error, da un numero creible y equivocado. (c) corrida EN EL VPS: 42 passed sobre 0ceeb45c (test_escala_monotributo + test_monotributo_aviso). cierre_ en coordinacion/cerrado/2026-11-03/ con FICHA/SHA/DOD.
- **Dueño:** backend
- **De dónde sale:** el mismo contrato de monotributo. El hueco ya estaba **nombrado con dueño** en
  `apps/copiloto/contabilidad_web.py:68-72`: `"tope": None` deliberado, porque *«un tope viejo
  mostrado como vigente es peor que no mostrar ninguno»*.
- **DoD:**
  1. Config **versionada con `vigencia_desde`** (lo que el comentario de `:72` ya exige), **no
     hardcode**, con **dueño de actualización escrito**.
  2. `contabilidad_web.py` deja de devolver `None` cuando **hay categoría Y hay escala vigente**; en
     cualquier otro caso sigue devolviendo `None`. **Las dos ramas con test.**
  3. 🔴 **Control explícito: escala vencida ⇒ `null`, nunca el tope viejo.** Es el modo de falla que
     el propio comentario nombró, y el que **no da síntoma**: el número sale, se ve bien, y es falso.
  4. Tests en el **VPS**.
- **Depende:** la categoría de `SM-N35` llegando en el perfil (contrato de datos, no de UI).
- **FUERA del corpus del mapa.**

---

### SM-N37 · `sin-issue` — El aviso al acercarse al límite de monotributo

- **Estado:** TERMINADO
- **Dueno-activo:** backend
- **Cierre:** DoD completo, los 4 puntos VERIFICADOS por planificacion contra origin/main (no por autoevaluacion de backend). Codigo: d53c7d02 (#1471), ancestro de origin/main confirmado con merge-base --is-ancestor. (1) Umbral EN CONFIG, no hardcodeado: escala_monotributo.json:7 umbrales.aviso_pct=80. (2) UNA vez por CRUCE, no por dia: AvisosEmitidosStore con dias_silencio=None -- el punto fino es que un aviso diario de un limite fiscal se vuelve ruido y se aprende a ignorar, que es el modo de falla que la ficha existia para evitar. (3) Si el % BAJA, el aviso se RE-ARMA y la tarjeta se cierra sola: mi_dia_detector.py:517 REGLAS_REARMAN_AL_BAJAR + mi_dia_orquestador.py:107-108 liberar_ausentes(regla, vigentes). Era el punto que mas podia quedar implicito y esta escrito con su motivo en el docstring :326. (4) NUNCA avisa con tope==null: control ADVERSARIAL en tests/test_monotributo_aviso.py:72-76 -- $999.999.999 facturados y la lista sale VACIA porque no hay tope contra que medir. Ese es el control correcto: sin tope, el bug no da error, da un aviso creible y sin fundamento. La ficha dependia de SM-N36 (escala versionada con tope calculado), que cerro con 4a5bb923 + 42 passed en VPS.
- **Dueño:** backend
- **De dónde sale:** el mismo contrato. **Es alcance NUEVO**: el mapa sólo dibujaba la barra «68 %
  del tope» y la proyección; el aviso proactivo no lo dibujaba nadie.
- **DoD:**
  1. El umbral es **config**, no una constante enterrada.
  2. **Se avisa UNA vez por cruce de umbral**, no en cada consulta. Un aviso que se repite se vuelve
     ruido y el emprendedor lo apaga — el mismo mecanismo por el que un guard que grita en el caso
     normal se desarma solo.
  3. Qué pasa si la escala cambia y el % **baja** de vuelta: escrito, no implícito.
  4. **No se dispara nunca con `tope == null`.** Un aviso calculado sobre un tope ausente es una
     alarma inventada.
- **Depende:** `SM-N36`.
- **FUERA del corpus del mapa.**

---

### SM-N38 · `sin-issue` — El tirador de Mi día: una línea sin texto, y el composer sin fondo

- **Estado:** DOD-PARCIAL
- **Dueno-activo:** frontend1
- **Falta:** SIGUE DOD-PARCIAL y lo que queda NO es codigo: es la corrida con el operador mirando mas el diff de arboles. Todo lo demas esta HECHO, con los shas verificados por planificacion como ancestros de origin/main y con control positivo del propio chequeo de ancestria, para que el verde no venga de un comando que diga si a todo. (1) EL FONDO, resuelto en d6bbf825 (#1489) RETIRANDO la capa que yo mande agregar al elegir la opcion (a) en #1487. (2) LA ZONA DE ARRASTRE, 024ca34f (#1491) con hitSlop y ALTO_HANDLE INTACTO; lo que la acredita no es el verde sino el control NEGATIVO: desde 86 px, fuera de zona, el panel NO se mueve. (3) EL ENTORNO DEL CAMPO, 6b82aded (#1493): reusa los MISMOS nodos del chat (ScrimDock extraido, chat-dock-scrim conserva su id) atados a panelY -- y ahi se invirtio el eje de la ficha, porque NO habia una capa de mas en Mi dia: le FALTABAN las dos del chat. Mis tres rondas verdes no convergian porque buscaba del otro lado del signo. (4) EL CANTO A MITAD DE ARRASTRE, 8fb68967 (#1495): lo destapo la medicion del estado INTERMEDIO, que ninguna ronda anterior habia mirado, y la causa no era el scrim sino el ANCLAJE del contenedor -- el chat ancla bottom:0 sin height (ChatView.tsx:300) y Mi dia anclaba top con height: altoPieAbajo, asi que el extremo opaco del degrade terminaba en y~1280, a mitad de pantalla, contra el canvas mas claro. Un degrade correcto recortado por una caja acotada: el mismo defecto de #1487 con otra forma. DIFERENCIA ESTRUCTURAL ACEPTADA: frontend1 eligio sacar el scrim del panel (opcion b) en vez de anclar el pie a bottom:0 (opcion a), porque el pie vive DENTRO del panel que se traslada y ahi bottom:0 no cae en el borde de pantalla. Queda justificada: el chat no se traslada, asi que los dos arboles no pueden ser identicos y el diff que falta tiene que mostrar ESA diferencia y ninguna otra. EL INSTRUMENTO, que es lo que hace creible el cierre: filas con salto de color >12 en x=8, medido en los TRES estados -- colapsado 0, mitad (~290px) 0, abierto 0. No es «se ve bien»: es una cifra con unidad, y el estado abierto se midio por primera vez. CORRECCION DE ROTULO, aportada por frontend1 sobre su PROPIA evidencia sin que nadie la pidiera: las capturas de 10:49, 10:50 y 11:00 locales estaban rotuladas «pre-Luna» y son POST-Luna (Luna activa desde 09:49 local = 12:49:01 UTC; las pre-Luna son solo las de 09:46-10:2x). No invalida la medicion del canto, pero SI impide citar estas capturas como linea de base pre-Luna en cualquier comparacion posterior -- seria una cifra citada para la pregunta ajena. NO se marca TERMINADO hasta que lo vea el operador: tres veces se declaro cerrada antes de estarlo y las tres marcas fueron mias.
- **Dueño:** frontend1 (tomada el 2026-11-03, con el device `RF8T318RN9T`)
- **De dónde sale:** orden del operador, 2026-11-03, con captura del mapa: *«el tirador de mi día
  está demasiado grande además de que todavía conserva el texto… debe ser una línea sobre el campo
  de ingreso de texto igual que como se ve en el mapa… la única diferencia con la imagen es que
  ahora no tiene fondo alrededor del campo y del botón»*. Contrato completo en
  `coordinacion/.../2026-11-03_contrato_planificacion-a-frontend1_SM-N38-*`.
- **Medido:** `apps/mobile/src/shell/PanelDeslizable.tsx:47` → `ALTO_HANDLE = 56`, y `:467-472`
  monta un `<Text testID="panel-hint">` con «Escribile a Odobi» (`PantallaPrincipal.tsx:213`).
  **frontend1 lo midió en device sobre `acdbff54`: 105 px reales.** El prototipo
  (`Prototipo frontend/odobi-ui/mockups/09-mi-dia/index.html:123-124`) tiene el grip en **~13 px**
  (barra 44×5 + padding 6/2) y `:128` declara `.peek{background:transparent}`.
- **🔴 Corrección registrada:** planificación afirmó además que el composer quedaba fuera de
  pantalla por el alto fijo de `:421`. **Falso en device:** `#1442` (SM-N22) ya monta el
  `DockEntrada` como `pieAbajo` y el composer asoma. Ese punto se retiró. El device no corre `main`,
  corre lo que Metro sirve — se midió el árbol y se afirmó el efecto.
- **DoD:**
  1. La tira del asa es **sólo la línea** (barra 44×5 con el padding del prototipo, ~13 px), **sin
     `<Text>`**. `hintAbajo` y su paso desde `PantallaPrincipal.tsx:213` se retiran si quedan sin
     uso — nada de dejar el prop muerto.
  2. El composer va **sin fondo ni tarjeta** alrededor del campo y del botón
     (`.peek{background:transparent}`). No se duplica el composer: es el que ya existe.
  3. **Tocar el composer sube el panel**, con test. 🔴 Condiciona al punto 1: el hint de texto es hoy
     la alternativa accesible al gesto de arrastre (WCAG 2.5.1), y el prototipo la resuelve con el
     toque, no con un cartel. Retirar el texto sin esto deja el gesto sin alternativa.
  4. El arrastre sigue funcionando sobre la línea y sobre el composer. Antes de tocar el gesto:
     skill `swmansion-rn-gestures`; en device, `adb input motionevent`, nunca `input tap`.
  5. Tests de `PanelDeslizable` actualizados — si alguno se vuelve verde por el síntoma y no por el
     mecanismo, se reescribe, no se borra.
  6. **Captura en device** del estado colapsado, comparable con la imagen del mapa.
- **FUERA del corpus del mapa:** es una corrección pedida por el operador sobre una pantalla que el
  corpus ya mide por otras entradas; no agrega denominador de paridad.

---

### SM-N39 · `sin-issue` — Los TRES `[ASSUMED_PENDING_VERIFY]` de `afip.ts` estaban vencidos

- **Estado:** TERMINADO
- **Dueno-activo:** backend
- **Cierre:** DoD completo, las dos mitades. Alcance TypeScript: bc8671a2 (#1474) retira los marcadores vencidos de afip.ts y facturaPropuesta.ts y fecha los vigentes; d7c0613c (#1477) resuelve los kinds de ListaMensajes (tool_catalog.py:1004 y :1685), actualiza dos punteros viejos de index.ts y fecha el vigente de clientes.test.ts -- tsc core+mobile ok, vitest clientes 54 ok. Alcance Python: d140f853 (#1479, CI 6/6) -- los 9 hits de 6 archivos .py de apps/copiloto quedan los 9 VIGENTES y FECHADOS 2026-11-03 con su motivo (Calendar sin conectar / SM-N34 x3, GoTrue filter y 400/401 sin medir x3, claims Google no verificados en el spike K-12, duplicados_probables sin medir, homonimo del grafo sin ejercitar). NINGUNO se retiro, y ese es el veredicto correcto: retirar un marcador sin evidencia es el error inverso al que abrio la ficha. El DoD 2 nunca pidio vaciar el grep -- pidio que ningun hit quede sin veredicto, y ahora los 21 hits (12 .ts/.tsx + 9 .py) lo tienen, con fecha. Los tres shas son ancestros de origin/main. DoD 3 no aplica: ninguno resulto vigente CON consecuencia de producto.
- **Dueño:** frontend2
- **De dónde sale:** barrido de planificación, 2026-11-03, disparado por el marcador que frontend2
  retiró en `#1472`. Si uno estaba vencido, los otros podían estarlo: **lo estaban los tres.**
- **Medido contra `origin/main`:**
  - `packages/core/src/api/afip.ts:445-451` afirma que `ConectarBody` «todavía NO declara
    `ambiente`» y que «el backend lo IGNORA en silencio» → `apps/copiloto/afip_web.py:121` lo
    declara: `ambiente: Literal["dev","prod"] | None = None`. **VENCIDO.**
  - `afip.ts:699-702` afirma que `estado` «hoy lo EXIGE (`cuit: str` sin default)» y que sin `cuit`
    da 422 → `afip_web.py:655` es `estado(cuit: str | None = None …)` y su docstring dice «`cuit` es
    OPCIONAL a propósito». **VENCIDO.**
  - `afip.ts:258` (retirado en `#1472`): esperaba que backend persistiera `categoria_monotributo`,
    que persiste desde `4a5bb923`. **Estaba vencido.**
  - La consecuencia que el marcador 1 describía —«el selector de Ajustes queda en solo-lectura»—
    **tampoco se sostiene**: `PantallaAfipSetup.tsx:402` llama `cambiarAmbiente` y `:461` manda
    `ambiente` en el alta.
- **🔴 Qué es y qué NO es:** **no es un bug de producto** — ninguno tiene consecuencia viva en la
  app. Es **deuda de documentación con efecto medido**, y el efecto ya se cobró: la premisa «backend
  no persiste la categoría» de la receta de capturas de `SM-N35` salió de uno de estos marcadores y
  declaraba «Sin definir» como **resultado esperado**. Con eso, una pantalla rota habría cerrado el
  DoD — un falso verde, que es el que nadie revisa. Un marcador de pendencia, mientras vive, apaga
  la búsqueda del próximo que lo lea.
- **DoD:**
  1. Los marcadores **1** y **2** retirados, cada uno **citando el `path:línea` del backend y el
     sha** que lo invalida — formato de `#1472`: el comentario pasa de «pendiente» a «resuelto en
     `<sha>`», no se borra sin rastro.
  2. **El barrido completo:** `grep -rn "ASSUMED_PENDING_VERIFY" packages/ apps/` sobre
     `origin/main`, con el veredicto de cada hit (vigente / vencido + la medición). Lo que quede
     vigente se queda **con su fecha**: un marcador sin fecha se cita como si fuera de hoy. Lo que
     importa es que no quede ningún hit sin veredicto.
  3. Si algún hit resulta **vigente con consecuencia de producto** (UI degradada, campo ignorado),
     **no se arregla acá**: se emite `pedido_` y se nombra.
  4. Gate `scripts/ci/lint.sh` verde.
- **Depende:** nada. **No necesita device.**
- **FUERA del corpus del mapa:** no es divergencia contra el mapa; no suma denominador de paridad.

---

### SM-N40 · `sin-issue` — El borrado hacia atrás no vuelve al segmento anterior en el campo de fecha

- **Estado:** DOD-PARCIAL
- **Dueno-activo:** frontend1
- **Falta:** Codigo COMPLETO y mergeado: 03370978 (#1486, ancestro de origin/main), CI 6/6, tsc limpio, jest theme 150/150. onKeyPress en mes y year de CampoFecha: con el segmento VACIO el retroceso devuelve el foco al anterior y le borra el ultimo digito; con el segmento NO vacio borra dentro y NO salta -- el salto temprano era el defecto espejo y esta cubierto. Los 4 tests traen CONTROL NEGATIVO, que es lo que los hace valer: SIN el handler fallan los dos de retroceso y pasan los dos de no-salto, asi que la suite verde no puede ser verde por otra causa. Lo que FALTA es un solo punto y lo declaro frontend2, no yo: que el teclado de Android EMITA Backspace sobre un TextInput ya VACIO no esta verificado, y de eso depende todo el mecanismo -- si el teclado no manda la tecla, el handler es correcto y nunca corre. Es la MISMA corrida de device de SM-K9, sumando un punto a su receta: «el retroceso con el dia vacio vuelve al segmento anterior». Dueno de esa corrida: frontend1, que tiene la tenencia del device. Gesto con teclado real, nunca adb input tap.
- **Dueño:** frontend2
- **De dónde sale:** hallazgo de frontend2 al medir `SM-K9` (2026-11-03). **No reabre `SM-K9`**: esa
  ficha preguntaba si la máscara era un defecto y la respuesta fue que no hay máscara. Esto es otra
  cosa, encontrada al mirar el mismo archivo (DEC-18 — un hallazgo nuevo va a ficha aparte).
- **Medido:** `CampoFecha` son **tres `TextInput` con auto-avance** (`CampoFecha.tsx:96-128`), y el
  barrido de `onKeyPress` da **0 hits** en el componente. El auto-avance empuja el foco hacia
  adelante y **nada lo trae hacia atrás**: con el segundo segmento vacío, `⌫` no devuelve el foco al
  primero.
- **Por qué importa, y por qué no da síntoma en un test:** el usuario que se equivoca en el día
  queda sin forma de corregirlo con el teclado — tiene que tocar el segmento. Es un defecto de
  entrada de datos que **ningún test de render puede ver**, porque el árbol está correcto: lo que
  falta es un handler. Y el camino feliz (tipear 8 dígitos seguidos) funciona, así que la suite
  queda verde.
- **DoD:**
  1. Con un segmento **vacío**, `⌫` devuelve el foco al segmento anterior y borra su último dígito.
  2. Con el segmento **no vacío**, `⌫` borra dentro del segmento y **no** salta — el salto temprano
     sería el defecto espejo.
  3. Test que ejercita `onKeyPress` con `Backspace` en los dos casos del punto 1 y 2. Un test que
     sólo afirme que el handler existe no acredita nada.
  4. Antes de tocar nada: leer la skill del dominio si el foco se maneja con refs imperativas.
- **Depende:** nada. **No necesita device para implementar**; la corrida con teclado real cierra el
  `Falta:` de `SM-K9`, no ésta.

### SM-N41 · `sin-issue` — El campo del composer es translúcido y deja leer los mensajes de atrás

- **Estado:** PENDIENTE
- **Dueño:** frontend2
- **De dónde sale:** observación de **frontend1 en device**, 2026-11-03, reportada sin tocar nada
  mientras medía `SM-N38`: *«con el chat arriba, el campo del composer es translúcido y deja ver el
  texto de los mensajes (se lee "Editar/Cancelar" a través)»*. **Fuera del alcance de `SM-N38`**,
  que es el fondo de **alrededor** del campo; esto es el fondo **de dentro**.
- **Medido en device, no en el árbol:** el texto de los mensajes se lee **a través** del campo. El
  candidato en código es `Composer.tsx:239` → `conAlfa(tema.color.fondo, ALFA_BASE_CAMPO)`: el alfa
  del fondo del campo.
- **🔴 La pregunta antes del fix, y es la que decide la ficha:** el operador pidió explícitamente
  conservar *«el de dentro»* del campo. **No está escrito si lo quiere translúcido o legible.** Un
  alfa es una decisión de diseño, no un defecto evidente: subirlo puede romper el efecto de cristal
  que el resto de la cáscara sostiene. Así que esta ficha **arranca preguntando**, no implementando.
- **DoD:**
  1. Captura del caso: chat arriba, con mensajes detrás del campo, para que la decisión se tome
     mirando el síntoma y no una descripción.
  2. Decisión **escrita** del operador: legible (subir el alfa) o translúcido a propósito (y
     entonces la ficha cierra `CERRADO-POR-DECISION`, sin tocar código).
  3. Si se decide legible: el alfa va **parametrizado donde ya vive** (`ALFA_BASE_CAMPO`), no
     hardcodeado en el JSX, y el cambio se mira en las dos skins.
- **Depende:** la decisión del operador para el punto 2. El punto 1 se puede adelantar en la pasada
  de device de frontend1.
### SM-N42 · `sin-issue` — Las enmiendas al MAPA no son ficha de nadie, y por eso Ajustes "sigue distinta"

- **Estado:** PENDIENTE
- **Dueno-activo:** frontend2
- **Dueño:** frontend2
- **De dónde sale:** reclamo del operador, 2026-11-03, con captura del prototipo en pantalla:
  *«¿por qué la pantalla de ajustes todavía sigue distinta al mapa? ¿no estaba contemplado esto?»*
- **Medido (2026-11-03, contra `origin/main`).** Estaba contemplado, y el código está: `SM-K7`
  TERMINADO, `SM-N9` TERMINADO, `SM-K5` DOD-PARCIAL con un único residual que no es de Ajustes (el
  diálogo de cerrar sesión, que exige una sesión descartable), y la entrada **44 `ajustes`** del mapa
  de 51 en **DIFERENTE·B** — o sea diferencia reconocida y decidida. Lo que sigue divergiendo es el
  **MAPA**. Y la causa es estructural, no de disciplina: las enmiendas al mapa se declararon DENTRO
  del cierre de otras fichas — el de `SM-K7` dice textual «Enmienda del mapa pendiente: contenedor en
  una sola tarjeta y chevron de apar», y la enmienda `E-6` vive en la tabla de enmiendas — así que
  **nunca tuvieron renglón propio en el registro que mide**. Una obligación declarada dentro del
  cierre de otra ficha no tiene estado, no tiene dueño y nadie la persigue: la app avanza, el mapa
  no, y el operador ve divergencia que en los papeles figura resuelta.
- **Alcance:** el **mapa**, no la app. `Prototipo frontend/odobi-ui/mapa-pantallas/index.html`,
  `mockups/13-ajustes/index.html` y las filas del relevamiento
  (`2026-10-16-relevamiento-mapa-de-pantallas-vs-app.md`, grid `13 · Ajustes` y entrada 44).
- **DoD:**
  1. **«Mi plan» sale del mapa** — `DEC-8` (operador, 2026-09-21,
     `2026-09-21-acta-decisiones-beta-odobi.md:18`): «Plan y límites no entran en la beta»; la app lo
     fija con un control negativo (`PantallaAjustes.test.tsx:54-59`). Es el punto que el operador
     tenía en pantalla.
  2. **Cerrar sesión: de fila a botón** (F11-cuenta-b), ya implementado.
  3. **Apariencia: el mosaico** (F11-apariencia). El **chevron** de «Como el teléfono» vs «✓ Activo`»
     queda AFUERA: está escalado al operador desde el lote 1 y si él elige el chevron, la entrada
     vuelve a A.
  4. Las dos enmiendas que dejó el cierre de `SM-K7`: contenedor en una sola tarjeta y chevron de
     apar.
  5. Cada punto con el **literal grepeado contra `origin/main` antes de editar**. Si una enmienda ya
     está aplicada, se devuelve el hallazgo en vez de re-aplicarla — dos contratos de esta semana
     mandaron a hacer algo ya hecho.
- **FUERA de alcance, y no se mezcla:** el wording de Gmail («No puede leerlos» vs «Enviá mails desde
  el chat.») y el de la clave fiscal (`PantallaAfipSetup.tsx:840`). Son decisión del operador y ya
  están agrupados en UN punto de su `pedido_`; duplicarlos acá convierte el pedido en ruido.

