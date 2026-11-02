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
| **SM-H5** | `sin-issue` | 🟧 DOD-PARCIAL | la frase del agente dijo $50,000 en device (18:02, 1 caso; la sonda de #1363 daba 0/6). Es de backend, o planificacio… |
| **SM-H6** | `sin-issue` | ✅ TERMINADO | d7d0a351 (#1354). Device, factura real N° 0006-00000011: cliente y número formateado en la card, y «Mandala por mail»… |
| **SM-H7** | `sin-issue` | ✅ TERMINADO | 6db618e487b14b82e1efad1d9e99d38a24956a5d (#1314) fix con test rojo primero; acc58cccce18056fe005876a135874ccefc0b9fa … |
| **SM-I1** | `sin-issue` | ✅ TERMINADO | sha 5814cf08d0144483d5b15d9da7868c6544ef9185 · cabecera, Ahora y Para hoy con Ver tablero en Mi dia; Tu dia propia co… |
| **SM-I2** | `sin-issue` | ✅ TERMINADO | 68632d8ee88d5cb87e2ed7787f2b8e67fae55667 (#1380) dock extraido en chat/DockEntrada.tsx y voz/DockFuncion.tsx; boton g… |
| **SM-I3** | `sin-issue` | 🟧 DOD-PARCIAL | captura de device de los dos estados, reposo y deshabilitado. |
| **SM-I4** | `sin-issue` | 🟧 DOD-PARCIAL | captura de device: una sola solapa, pestana al borde inferior, Presupuestos en una linea, bloque con pocas y muchas f… |
| **SM-I5** | `sin-issue` | 🟧 DOD-PARCIAL | captura en device de la inicial del nombre comercial en Mi dia y en el escritorio, con el usuario rotulado. |
| **SM-I6** | `sin-issue` | 🟧 DOD-PARCIAL | medir en release, en el ejercicio final de SM-G4. No hay filmacion del antes: la de SM-G4 no se guardo. |
| **SM-I7** | `sin-issue` | 🟧 DOD-PARCIAL | captura de device del sheet con iconos y con el aviso de continuacion. |
| **SM-J1** | `sin-issue` | 🟧 DOD-PARCIAL | Capturas de device de las CUATRO funciones con dock: Gastos, Ingresos, Presupuestos y Clientes, con sus rotulos («Ult… |
| **SM-J2** | `sin-issue` | ✅ TERMINADO | sin-codigo — PREMISA REFUTADA (medido 2026-11-02): los chips existen en TarjetaCliente.tsx y los dos reclamados estan… |
| **SM-J3** | `sin-issue` | 🟧 DOD-PARCIAL | captura del tenant vacio (operador: canonico unico, no se puede vaciar) |
| **SM-J4** | `sin-issue` | 🟧 DOD-PARCIAL | Mitad B BLOQUEADA DE VERDAD, no esperando: la atribucion es POR DOCUMENTO DEL RECEPTOR al consultar, sin vinculo al e… |
| **SM-J5** | `sin-issue` | ✅ TERMINADO | sin-codigo — PREMISA REFUTADA (medido 2026-11-02): PantallaAgenda.tsx:23-24 agrupa Hoy / Manana / Esta semana / Sin h… |
| **SM-K1** | `sin-issue` | 🟧 DOD-PARCIAL | captura de device de Homologacion oculta para no-admin (frontend2) |
| **SM-K2** | `sin-issue` | 🟧 DOD-PARCIAL | Captura de device de los dos estados del recuadro y del formulario nombrando el ambiente. DECISION: web NO recibe el … |
| **SM-K3** | `sin-issue` | 🟧 DOD-PARCIAL | Sin hacer: motivo visible en cada boton apagado; verificar en device si el refresco al terminar falla (el polling ya … |
| **SM-K4** | `sin-issue` | ✅ TERMINADO | bfa7b919 (#1376) sobre el merge previo de K4. Captura de device (RF8T318RN9T, canonico) docs/copiloto-emprendedor/202… |
| **SM-K5** | `sin-issue` | 🟧 DOD-PARCIAL | device: fondo blanco sobre tiles y «Sí, cerrar sesión» cortado (logout SÓLO con el usuario del operador) + una captur… |
| **SM-K6** | `sin-issue` | 🟧 DOD-PARCIAL | SOLO la captura del aviso PRESENTE: el codigo YA ESTA en main (117dc669 #1320, packages/core/src/api/sesion.ts + apps… |
| **SM-K7** | `sin-issue` | ✅ TERMINADO | 926163a4 (#1395): hablar filas con radio, comousar círculo+chevron, feedback mes a la derecha, negocio sin título dup… |
| **SM-K8** | `sin-issue` | ✅ TERMINADO | sha c712da76f345d8b8791be174d9103a9d9c5e7d41 · fix + test + paso en el mapa (SM-C3 DoD 2-4) · captura de device 2026-… |
| **SM-K9** | `sin-issue` | ⬜ PENDIENTE | — |
| **SM-L1** | `sin-issue` | ⬜ PENDIENTE | — |
| **SM-L2** | `sin-issue` | ⬜ PENDIENTE | — |
| **SM-L3** | `sin-issue` | ✅ TERMINADO | sin-ejecutar — FUERA DE ALCANCE por decision del operador (2026-11-02, textual): «las facturas no necesitamos probarl… |
| **SM-L4** | `sin-issue` | ⬜ PENDIENTE | — |
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
| **SM-N17** | `sin-issue` | ⬜ PENDIENTE | — |
| **SM-N18** | `sin-issue` | 🟧 DOD-PARCIAL | la tarjeta instagram viva de 48a9d75f sigue para_hoy hasta que se abra Mi Dia (se cierra sola por ausencia); re-medir… |
| **SM-N19** | `sin-issue` | ✅ TERMINADO | b64856dc356dc89984d5a259a8ff90a691966013 (#1401, SM-N5): la card guardada deja el id y relee importe y cliente al reh… |
| **SM-N20** | `sin-issue` | 🟧 DOD-PARCIAL | lo que lo cerraría de verdad es **determinista**: que el texto con importes que ve el |
| **SM-N21** | `sin-issue` | ⬜ PENDIENTE | — |

<!-- TABLA-ESTADO:FIN -->

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
estaba reservada para fichas que no la necesitaban. Toda precondición que se pueda preparar antes
—un tenant fabricado, un build de release, un token manipulado— **se prepara antes**, porque una
ventana gastada esperando una precondición es una ventana perdida.

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
- **Falta:** la frase del agente dijo $50,000 en device (18:02, 1 caso; la sonda de #1363 daba 0/6). Es de backend, o planificacion decide que el DoD mide solo las cards. Verificar tambien el mapa corregido por D5.
- **Cierre:** 21cebf5a96614d0dc4f791bb51fb0a6e47c0a44c (#1390) mas 681c3b53 (#1363). Chip Arma la factura desde la constante del core, recibo $50.000, Pendiente visible. Evidencia: docs/copiloto-emprendedor/2026-11-02-sprint-correcciones-evidencia/SM-H5-SM-H6.md
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
- **Falta:** Capturas de device de las CUATRO funciones con dock: Gastos, Ingresos, Presupuestos y Clientes, con sus rotulos («Ultimos» en Gastos, «Ticket» en la pastilla de foto). Codigo mergeado en 52e9a85d (#1418, 6/6). Facturacion e Inteligencia NO entran al denominador: ENMIENDA FUNDADA por planificacion — el dock es un prellenador de formulario y esas dos no tienen formulario (factura es asistente con card HITL, bi es lectura), ContextoTranscripcion admite solo gasto/ingreso/presupuesto/cliente (packages/core/src/api/transcribir.ts:7), y en factura un dock seria una SEGUNDA entrada a una accion irreversible, que es lo que el mecanismo de cards existe para evitar. DISPARADOR: van en el BLOQUE 1 de la pasada de device (cualquiera de las dos cuentas sirve para esas 4 pantallas); el telefono lo tiene frontend1 y las saca de corrido con el resto del bloque, rotulando el usuario.
- **Dueño:** frontend2
- **Medido:** `gastos`, `ingresos`, `factura`, `presu`, `clientes` y `bi` sin dock; faltan los
  rótulos «ÚLTIMOS», «Ticket» y «N facturas · N impaga».
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
- **Falta:** Mitad B BLOQUEADA DE VERDAD, no esperando: la atribucion es POR DOCUMENTO DEL RECEPTOR al consultar, sin vinculo al emitir (cliente_store.py:72-78 _FACTURADO_DEL_CLIENTE_JOIN, predicado en :41-58, _es_atribuible en :61); afip_comprobantes.cuit es el EMISOR y no sirve. Medido read-only en 48a9d75f: N 10 y N 11 tienen doc_tipo=99 y doc_nro vacio/0, asi que NO son atribuibles a ningun cliente (crear un cliente con el CUIT 20269996065 no las atribuye: es el CUIT del emisor, el propio operador). Disparador exacto: una factura emitida con RECEPTOR IDENTIFICADO (doc_tipo y doc_nro con digitos); emitir esta fuera de alcance por decision del operador. Rechazado como atajo: cliente doc_tipo=99 nro 0 para forzar el match (seria consumidor-final-generico, la captura mentiria). Mitad A HECHA: captura del caso facturas_atribuibles:false (el guion + «Sin CUIT cargado» es deliberado), cuenta del OPERADOR (no canonica), cliente creado por la app sin tocar lo fiscal. Evidencia: 2026-11-02-sprint-correcciones-evidencia/SM-J4-clientes-sin-CUIT-el-guion-es-deliberado-CUENTA-DEL-OPERADOR.webp
- **Dueño:** backend (el adversarial que falta) · frontend2 (la captura con dato real)
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
- **Falta:** Sin hacer: motivo visible en cada boton apagado; verificar en device si el refresco al terminar falla (el polling ya refresca el estado: premisa sin medir); subtitulo contra el mapa; captura de los dos errores. Refutado, NO se implementa: «Necesito cambiarlo ›» (omitido por decision del operador BL-V27)
- **Cierre:** c18439ff (#1339) app: la pantalla nombra la causa dato|servicio|desconocida del fallo del alta; backend 1789d8bc (#1334)
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
- **Falta:** device: fondo blanco sobre tiles y «Sí, cerrar sesión» cortado (logout SÓLO con el usuario del operador) + una captura por pantalla; pedido_ a backend si se quiere «desde …» (fecha_alta en me_contrato.py + me.contrato.ts, mismo PR)
- **Cierre:** 3be85a91 (#1365) chevrons + copy Google · c5186d47 (#1368) mapa corregido: sin nombre de persona ni «desde …» (aval planificación; /me no los expone, me_contrato.py) · «Cambiar el mail» fuera por DoD
- **Dueño:** frontend2
- **Medido:** faltan subtítulos y encabezado; falta «desde …» y los chevrons; el fondo blanco
  sobresale de las tiles; «Sí, cerrar sesión» aparece cortado; el copy dice «usuario y contraseña»
  cuando la cuenta entró con Google.
- **DoD:** los seis puntos corregidos, con captura de cada pantalla. **«Cambiar el mail» queda
  afuera** (depende del SMTP de SM-C5, diferido) y el mapa lo refleja. **Cerrar sesión se prueba
  sólo con el usuario del operador, nunca con el canónico.**

### SM-K6 · `sin-issue` — La pantalla de ingreso no avisa que la sesión se cerró

- **Estado:** DOD-PARCIAL
- **Falta:** SOLO la captura del aviso PRESENTE: el codigo YA ESTA en main (117dc669 #1320, packages/core/src/api/sesion.ts + apps/mobile/src/modules/auth/sesionExpirada.test.tsx) - no hay nada que implementar. Mecanismo: 401 con Bearer -> el cliente descarta la sesion (contrato medido por backend: token vencido o corrupto dan 401 {detail: invalid token} en auth.py:98-103; credenciales invalidas solo sale de /auth/login en web.py:1476, asi que 'sesion caida' vs 'login fallido' se distingue por CONTEXTO). CORREGIDO DOS VECES: (1) el Falta decia 'invalidar del lado servidor' y el backend no tiene ese concepto; (2) despues dije 'se acredita con cualquier cuenta' y tambien era falso - provocar el 401 DESCARTA la sesion de la cuenta que lo provoca, asi que la ficha sigue atada a la tenencia y VUELVE AL BLOQUE 2. Camino aprobado: con el canonico, corrompiendo el token por Metro sin commitear nada. NO con la cuenta del operador.
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

- **Estado:** PENDIENTE
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

- **Estado:** PENDIENTE
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

- **Estado:** PENDIENTE
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

- **Estado:** PENDIENTE
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

- **Estado:** DOD-PARCIAL
- **Falta:** la tarjeta instagram viva de 48a9d75f sigue para_hoy hasta que se abra Mi Dia (se cierra sola por ausencia); re-medir la fila
- **Cierre:** 0046ded4 filtro por toolkits_conectables, fuente unica, tests 2 mitades, VPS 2566 passed
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
- **Falta:** lo que lo cerraría de verdad es **determinista**: que el texto con importes que ve el
  usuario **no pase por el LLM** — card y reply armados por código. Eso es decisión de diseño más
  grande que la ficha y **no la toma backend por su cuenta**: queda planteada acá como la opción de
  raíz, y la decide el operador. Mientras no se tome, el residual se acepta y queda medido (1/8).

### SM-N21 · `sin-issue` — FUERA DEL SPRINT: opción C — los importes que mueven plata se escriben por código, no los redacta el LLM

- **Estado:** PENDIENTE
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
