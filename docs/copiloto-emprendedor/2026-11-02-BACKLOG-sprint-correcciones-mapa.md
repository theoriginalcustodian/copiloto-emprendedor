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
| **SM-H3** | `sin-issue` | 🟧 DOD-PARCIAL | captura de device de la card de Gmail con la aclaracion de que sale al confirmar. Disparador: el canonico tiene Gmail… |
| **SM-H4** | `sin-issue` | ✅ TERMINADO | c0219797 (#1343) + cd4041dd (#1340): descripcion de emitir_factura y observacion de faltantes; tope RG 5700/2025 ya e… |
| **SM-H5** | `sin-issue` | 🟧 DOD-PARCIAL | captura de device de pres-ciclo y pres-hitl + constante TEXTO_SUGERENCIA_ARMAR_FACTURA del core (frontend1); mapa y «… |
| **SM-H6** | `sin-issue` | ✅ TERMINADO | d7d0a351 (#1354). Device, factura real N° 0006-00000011: cliente y número formateado en la card, y «Mandala por mail»… |
| **SM-H7** | `sin-issue` | ✅ TERMINADO | 6db618e487b14b82e1efad1d9e99d38a24956a5d (#1314) fix con test rojo primero; acc58cccce18056fe005876a135874ccefc0b9fa … |
| **SM-I1** | `sin-issue` | ⬜ PENDIENTE | — |
| **SM-I2** | `sin-issue` | ⬜ PENDIENTE | — |
| **SM-I3** | `sin-issue` | ⬜ PENDIENTE | — |
| **SM-I4** | `sin-issue` | ⬜ PENDIENTE | — |
| **SM-I5** | `sin-issue` | ⬜ PENDIENTE | — |
| **SM-I6** | `sin-issue` | ⬜ PENDIENTE | — |
| **SM-I7** | `sin-issue` | ⬜ PENDIENTE | — |
| **SM-J1** | `sin-issue` | ⬜ PENDIENTE | — |
| **SM-J2** | `sin-issue` | ✅ TERMINADO | sin-codigo — PREMISA REFUTADA (medido 2026-11-02): los chips existen en TarjetaCliente.tsx y los dos reclamados estan… |
| **SM-J3** | `sin-issue` | 🟧 DOD-PARCIAL | captura de device de los tres estados (reposo, vacío —exige tenant vacío— y refresh en curso mostrando sólo «Actualiz… |
| **SM-J4** | `sin-issue` | 🟧 DOD-PARCIAL | las 2 capturas de device (frontend2): una con un cliente que TENGA CUIT mostrando monto y «N comprobantes» reales, y … |
| **SM-J5** | `sin-issue` | ✅ TERMINADO | sin-codigo — PREMISA REFUTADA (medido 2026-11-02): PantallaAgenda.tsx:23-24 agrupa Hoy / Manana / Esta semana / Sin h… |
| **SM-K1** | `sin-issue` | 🟧 DOD-PARCIAL | captura de device de Homologacion oculta para no-admin (frontend2) |
| **SM-K2** | `sin-issue` | 🟧 DOD-PARCIAL | Captura de device de los dos estados del recuadro y del formulario nombrando el ambiente. DECISION: web NO recibe el … |
| **SM-K3** | `sin-issue` | 🟧 DOD-PARCIAL | Sin hacer: motivo visible en cada boton apagado; verificar en device si el refresco al terminar falla (el polling ya … |
| **SM-K4** | `sin-issue` | 🟧 DOD-PARCIAL | captura de device (Metro de nuevo + teléfono) |
| **SM-K5** | `sin-issue` | 🟧 DOD-PARCIAL | device: fondo blanco sobre tiles y «Sí, cerrar sesión» cortado (logout SÓLO con el usuario del operador) + una captur… |
| **SM-K6** | `sin-issue` | 🟧 DOD-PARCIAL | una captura de device: aviso presente con sesión caída (hay que invalidar la sesión del canónico del lado servidor: e… |
| **SM-K7** | `sin-issue` | ⬜ PENDIENTE | — |
| **SM-K8** | `sin-issue` | ✅ TERMINADO | sha c712da76f345d8b8791be174d9103a9d9c5e7d41 · fix + test + paso en el mapa (SM-C3 DoD 2-4) · captura de device 2026-… |
| **SM-K9** | `sin-issue` | ⬜ PENDIENTE | — |
| **SM-L1** | `sin-issue` | ⬜ PENDIENTE | — |
| **SM-L2** | `sin-issue` | ⬜ PENDIENTE | — |
| **SM-L3** | `sin-issue` | ⬜ PENDIENTE | — |
| **SM-L4** | `sin-issue` | ⬜ PENDIENTE | — |
| **SM-N1** | `sin-issue` | ✅ TERMINADO | f95f4849 (#1353): contexto_cargado en estado del FacturaWorkflow + espera acotada en la tool; causa = carrera tool vs… |
| **SM-N2** | `sin-issue` | ✅ TERMINADO | sha 1efe5a3e (#1357). Causa: la observación de la tool (R6 + «Pedí SÓLO eso») le gana a la descripción; fix = sacar l… |
| **SM-N3** | `sin-issue` | ✅ TERMINADO | sha 99097d83 (#1359). Test atado a TOOLS−WRITE_OPS con control positivo en ambas direcciones (VPS 23 passed). Barrido… |
| **SM-N4** | `sin-issue` | ⬜ PENDIENTE | — |
| **SM-N5** | `sin-issue` | ⬜ PENDIENTE | — |
| **SM-N6** | `sin-issue` | ⬜ PENDIENTE | — |
| **SM-N7** | `sin-issue` | ⬜ PENDIENTE | — |
| **SM-N8** | `sin-issue` | ⬜ PENDIENTE | — |
| **SM-N9** | `sin-issue` | 🟧 DOD-PARCIAL | captura de device del encabezado con el nombre (punto 4) |
| **SM-N10** | `sin-issue` | ⬜ PENDIENTE | — |
| **SM-N11** | `sin-issue` | ⬜ PENDIENTE | — |
| **SM-N12** | `sin-issue` | ⬜ PENDIENTE | — |

<!-- TABLA-ESTADO:FIN -->

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

- **Estado:** DOD-PARCIAL
- **Falta:** captura de device de la card de Gmail con la aclaracion de que sale al confirmar. Disparador: el canonico tiene Gmail conectado. Dueno: el operador, escalado por planificacion.
- **Cierre:** 70e46d9f (#1318) card por tipo en backend; 6db618e4 (#1314) y acc58ccc (#1328) cancelada sin Confirmado tras recargar, medida en device. Device 2026-11-02: el pedido natural elige correo, responde 'No tengo habilitado el servicio de correo' y abre 'Conecta Gmail': la eleccion de herramienta queda acreditada.
- **Dueño:** backend (dispatcher) + frontend1 (card)
- **Medido:** el pedido de mail devuelve una card de **Calendar**, no la de Gmail «Confirmar y
  mandar / Cancelar». Y una card de Calendar **cancelada** pasa a «✓ Confirmado».
- **DoD:** el pedido de mail produce la card de **Gmail**, que aclara que el mail **sale al
  confirmar** (D8 — no se construye envío programado). Una card cancelada no puede mostrar
  «Confirmado» en ningún recorrido, incluido recargar.
- **Depende:** SM-H2, SM-H7.

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
- **Falta:** captura de device de pres-ciclo y pres-hitl + constante TEXTO_SUGERENCIA_ARMAR_FACTURA del core (frontend1); mapa y «Pendiente» en la card
- **Cierre:** mitades backend en main 681c3b53 (#1363): chip «Armá la factura» y importe $50.000 en frases del LLM; sonda real 0/6 inglés. SM-H5
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

- **Estado:** PENDIENTE
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

- **Estado:** PENDIENTE
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

- **Estado:** PENDIENTE
- **Dueño:** frontend1
- **Medido:** contraste insuficiente en reposo; el estado deshabilitado no se diferencia del activo.
- **DoD:** contraste legible en reposo y deshabilitado distinguible, medidos contra el criterio de
  contraste del design system. Captura de los dos estados.

### SM-I4 · `sin-issue` — El escritorio difiere del mapa en título, orden, tiles y solapas

- **Estado:** PENDIENTE
- **Dueño:** frontend1
- **Medido:** `esc` difiere en título, avatar y orden de la primera fila y en el estilo de los tiles;
  con el escritorio abierto se ven **dos** solapas apiladas (R02); «Presupuestos» se parte.
- **DoD:** título, orden y estilo de tiles del mapa; ícono de Ajustes en Funciones; **una sola
  solapa** — la tira del chat se oculta (D1), y **antes de tocarla hay que leer por qué el PR #1084
  la dejó a propósito y citarlo en el PR**. Colores de tiles y cards; «Presupuestos» en una línea.
  Captura de device.

### SM-I5 · `sin-issue` — El avatar no dibuja la inicial

- **Estado:** PENDIENTE
- **Dueño:** frontend1
- **Medido:** `apps/mobile/src/modules/midia/AvatarCuenta.tsx` (en web vive en `shell/`, otra
  carpeta) no muestra la inicial que el mapa pide («M»).
- **DoD:** la inicial del nombre del tenant, derivada del dato real y no de un literal. Captura.

### SM-I6 · `sin-issue` — El retardo al soltar (R03) sigue sin corregir

- **Estado:** PENDIENTE
- **Dueño:** frontend1
- **Medido:** pendiente del experimento.
- **DoD:** el arreglo que indique SM-G4, con la captura del antes y el después.
- **Depende:** SM-G4.

### SM-I7 · `sin-issue` — La pantalla de permisos no dice qué capacidad concede cada ítem

- **Estado:** PENDIENTE
- **Dueño:** frontend1
- **Medido:** `consent` sin íconos por capacidad y sin el banner de continuación del mapa.
- **DoD:** un ícono por capacidad y el banner de continuación. Captura de device.

---

# Bloque J · Funciones (wave 3)

Puede correr **en paralelo con el bloque K**. Depende de SM-I2 (el dock).

### SM-J1 · `sin-issue` — Las 6 funciones no tienen dock ni los rótulos del mapa

- **Estado:** PENDIENTE
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
- **Falta:** captura de device de los tres estados (reposo, vacío —exige tenant vacío— y refresh en curso mostrando sólo «Actualizando…»)
- **Cierre:** ba79737b (#1350) · etiqueta de mes del corte de caja + «Sin ventas todavía» sólo con cero medido (tests, control null) · RefreshControl intacto (DoD #1348)
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
- **Falta:** las 2 capturas de device (frontend2): una con un cliente que TENGA CUIT mostrando monto y «N comprobantes» reales, y una del caso facturas_atribuibles:false mostrando que el «—» es DELIBERADO -- ese estado ya se malinterpreto una vez como falta de dato y es lo que origino la premisa falsa de esta ficha.
- **Cierre:** punto 1 del DoD CERRADO por backend: c3867d10 (#1328), test_adversarial_http_clientes_a_cannot_read_b_cliente extendiendo test_adversarial_multitenant.py con el MISMO CUIT en A y B -- A: 0 / «0.00» con atribuible:true, B: 1 / «1500.00» como control positivo, y ajeno identico a inexistente (404, mismo cuerpo). VPS suite completa 2654 passed/41 skipped. Sin cambio de produccion: el dato ya existia desde #816 (2026-10-06).
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

- **Estado:** DOD-PARCIAL
- **Falta:** captura de device (Metro de nuevo + teléfono)
- **Cierre:** c1ee52924973b1994afca009e77a69ca33fabd53 · Gmail «No puede leerlos» (catalog.py) · estado como etiqueta «● Conectada» (test) · Sheets se queda: conector real (catalog.py googlesheets, services/sheets.py, test_catalog_route.py:188)
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
- **Falta:** una captura de device: aviso presente con sesión caída (hay que invalidar la sesión del canónico del lado servidor: el JWT de acceso es stateless; ventana L)
- **Cierre:** 117dc669 · captura de device 2026-11-02 del ingreso normal sin aviso en docs/copiloto-emprendedor/2026-11-02-sprint-correcciones-evidencia/SM-K6-ingreso-normal-sin-aviso-lockup-odobi.webp
- **Dueño:** frontend2
- **Medido:** el aviso «Tu sesión se cerró por seguridad…» **no existe en ningún archivo** de
  `apps/mobile` ni de `packages/core`; el flujo de sesión caída ya va directo a este formulario
  (`apps/mobile/src/modules/auth/EntradaSesion.tsx:25`; en web vive en `auth/`). Además difieren logo, relleno de campos y botones.
- **DoD:** estructura del formulario igual al prototipo y el aviso presente **cuando la sesión se
  cayó** (y ausente en un ingreso normal: las dos capturas, porque un aviso que sale siempre no
  informa).

### SM-K7 · `sin-issue` — Seis pantallas secundarias difieren del mapa en estructura

- **Estado:** PENDIENTE
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

- **Estado:** PENDIENTE
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

- **Estado:** PENDIENTE
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
  1. **Control del instrumento, primero:** mirar las dos cards en la pantalla del teléfono **sin
     capturar**, con el canónico. Reportar si el rectángulo está a ojo. **Si NO está a ojo, la ficha
     cierra `TERMINADO` como artefacto de `screencap`** — con esa frase escrita, porque lo que se
     retira es la causa, no la observación.
  2. Sólo si está a ojo: comparar con el equivalente de documed (§3.ter) y nombrar la capa (sombra,
     vidrio del shell, o el recorte del padre) antes de tocar nada.
  3. Captura de device del antes y el después.
### SM-N5 · `sin-issue` — El recibo de presupuesto pierde importe y cliente al rehidratar, y el motivo documentado cubre sólo el estado

- **Estado:** PENDIENTE
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

- **Estado:** PENDIENTE
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

- **Estado:** PENDIENTE
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

- **Estado:** PENDIENTE
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

- **Estado:** DOD-PARCIAL
- **Falta:** captura de device del encabezado con el nombre (punto 4)
- **Cierre:** 545a5dc7 (#1371): Ajustes lee perfilNegocio y muestra nombreComercial en la etiqueta del encabezado; vacio/blanco/error = sin etiqueta; 3 tests
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

- **Estado:** PENDIENTE
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

- **Estado:** PENDIENTE
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
