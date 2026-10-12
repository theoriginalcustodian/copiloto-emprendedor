# Plan de implementación — Sprint MOBILE: la app lista para usuarios reales

> **Fecha:** 2026-10-11 · **Baja:** planificación · **Estado:** listo para tomar.
> **Objetivo del operador, textual:** *«el sprint es para la app lista para funcionar con usuarios
> reales… hasta ahora solo fueron usuarios de prueba… este sprint mobile debe implementar todo lo que
> hicimos en web… necesitamos terminar la app mobile para que esté lista para la beta»*.
>
> **Para quién es este doc:** las tres sesiones que trabajan el repo (planificación, backend,
> frontend) y el operador. Cada ítem trae su `path:línea`, su DoD binario y su issue público, para que
> se pueda tomar sin leer nada más.
>
> **Repo público:** acá no van emails de la allowlist (dato personal: va la cantidad), tokens ni URLs
> internas. Los defectos de dinero se describen como **comportamiento del código** y se marcan
> **latentes**: al 2026-10-11 **no hay usuarios reales** — los tenants de la base son de prueba — así
> que ninguno causó daño. Sin esa aclaración, el texto describiría un incidente que no existió.

---

## 1. Qué cierra este sprint, y qué no

**El criterio de cierre es un DoD de 8 puntos.** No es «54/54 de paridad»: el padrón de 54 ids es el
**alcance** (*qué* hay que terminar), y estos 8 son el **gate** (*cuándo* está listo). Las dos
preguntas son distintas y las dos hacen falta — un sprint que cierre 54/54 puede entregar una app
donde cada pantalla coincide con la spec **y** el dinero está mal contado.

| # | Criterio | Verde cuando |
|---|---|---|
| 1 | **Entra** | se da de alta **desde el teléfono** y entra, sin que nadie edite una env var ni la DB |
| 2 | **Factura** | emite una factura real y ve su CAE en «Mis comprobantes» |
| 3 | **Anula** | emite la nota de crédito, y esa NC **no** vuelve a ofrecer «Anular» |
| 4 | **Cobra** | registra un cobro —manual y por MercadoPago— y lo ve **una** vez, en Ingresos **y** en los números |
| 5 | **Gasta** | registra un gasto y lo ve en la lista |
| 6 | **Ve sus números** | portada y detalle dan **la misma** cifra para el mismo mes |
| 7 | **Conversa** | dicta, el copiloto le propone una card, la confirma, y la card queda resuelta |
| 8 | **Evidencia** | los 7 anteriores **en device**, con el usuario canónico, y cada hallazgo entra como fila |

**Entra en el sprint** la app mobile **y** los bloqueantes de backend del alta y del dinero
(confirmado por el operador, 2026-10-11). **No entra:** la consola de operador (`/admin/*`, 12
endpoints + `AdminScreen.tsx:114`) — es herramienta del operador, no del emprendedor, y su ausencia en
mobile no es un hueco de paridad. Tampoco entra re-medir `web`, que está en 54/54 y mergeado: un
hallazgo nuevo no reabre un ✅ ya cerrado.

---

## 2. El estado medido hoy — con la unidad, que es lo que hace citable una cifra

Todo lo de esta sección se midió el **2026-10-11**. Donde hay dos cifras para lo mismo, están las dos
y se explica qué mide cada una: una cifra sin unidad se deja citar para cualquier pregunta.

### 2.1 Paridad de pantallas: el padrón de 54 ids

Instrumento nuevo de este sprint: `scripts/evidencia/falta-en-mobile.py` (ver §6).

| población (mobile) | n | ids |
|---|---|---|
| **comparados de verdad** | **8** | `caida card card-cliente card-cobro card-presu negocio onb-promesa tablero` |
| cubiertos **sin comparación** | 5 | `cobro-voz fact-voz onb-cumplida pres-voz vozchat` |
| **sin ningún veredicto** | **41** | los 41 restantes |

**La cifra que circulaba era «mobile 13/54». Es correcta y engañosa a la vez:** cuenta como cubiertos
5 ids cuyos únicos veredictos son `PENDIENTE_DEVICE` o `NO_MEDIBLE` — cubiertos, **nunca comparados**.
⇒ **faltan medir 46, no 41.** El mismo instrumento da `web` 45 + 9 = 54, que es el control positivo de
que el filtro filtra de verdad.

### 2.2 Paridad de cableado: los 109 endpoints

109 rutas del backend vistas, **109 clasificadas** (control de ceguera en cero) contra los dos
clientes. Sacando los 12 `/admin/*`, lo que **web consume y mobile no** son **tres**:

| endpoint | consecuencia |
|---|---|
| `POST /auth/signup` (`apps/copiloto/web.py:1294`) | sólo-web, y **con las altas a mano no interviene**: el primer ingreso de mobile pasa por el gate de onboarding, no por este endpoint → #1016 |
| `POST /me/legal/aceptar` (`web.py:1143`) | mobile no cablea la aceptación legal → #1001 |
| `POST /warm` (`web.py:1168`) | mobile no pre-calienta el chat → primera respuesta más lenta |

Y aparecieron **5 capacidades del backend que ninguna app llama** (3 con la función del cliente
compartido ya escrita y sin consumidor) → #1020.

### 2.3 Medición en device: el eje A

**1 ruta verificada de 21.** No 6: el retiro de `H-60` invalidó las que se midieron con las
animaciones del sistema apagadas, porque esa condición pone Reanimated en *reduced motion* y **afecta
lo medido** — la condición que el instrumento exigía para poder ver era una variable sobre el
resultado. 15 nunca se intentaron + 5 quedaron `NO_ATRIBUIBLE` → #1012.

⚠️ El JSON `Auditorias/2026-10-11-receta-device-resultado.json` es un **artefacto pre-retracción**.
No citarlo como estado.

### 2.4 Lo que ya está listo y nadie había declarado

- **El teléfono está listo.** Binario `app.copiloto.emprendedor 0.1.0` instalado el 11/10, device
  físico, Metro vivo. Era la precondición diferida desde el 22/09 (`M-01` queda **cumplido**).
- **La suite mobile corre y está verde: 986/991.** Los 4 rojos y los 8 errores de `tsc` caen todos en
  `PantallaFacturacion.{tsx,test.tsx}` y **no son defecto de `main`**: el `.tsx` del working tree está
  **atrasado** respecto de la rama en vuelo.
  ⚠️ A quien tenga `fe2/bl-o6-legal-*`: commitear ese `.tsx` tal como está **revierte +102 líneas
  propias**. Medir el signo por archivo antes de commitear.
- **El motor corre en modo `react`** en web y en worker (medido en el proceso vivo, no deducido del
  repo, donde el default es `dispatch`). ⇒ las cards propuestas son alcanzables y el criterio 7 **no**
  está bloqueado por configuración.

---

## 3. El hallazgo que reordena el sprint

**Mobile no está lejos de web en capacidad. Está lejos en EVIDENCIA.**

De 109 endpoints, mobile llama todos los del emprendedor salvo tres. Pantalla por pantalla, lo que
falta son **bloques de agregado y dos ramas del chat**, no módulos enteros. Pero de 54 ids de paridad,
sólo **8** se compararon en el teléfono, y de 21 rutas de navegación, **1**.

Eso cambia dónde está el trabajo: **la mayor parte del sprint es medir y arreglar lo que la medición
destape, no construir pantallas nuevas.** Y por eso el orden empieza por hacer el instrumento
confiable: hoy no puede separar «la ruta no responde» de «mi gesto se perdió».

**Y un hallazgo del tipo inverso, que ahorra trabajo:** «Tus apps» y los modos por app parecían una
feature de web para portar. Están **escritos e inalcanzables en web** —`'apps'` no está en `TABS`, y
los dos shells lo declaran ellos mismos— así que portarlos habría sido construir en el teléfono algo
que en web no se puede ni probar. Es un ítem de **decisión**, no de implementación → #1019.

---

## 4. El orden, y por qué no es negociable por conveniencia

```
      ┌─ A · instrumento confiable ─┐
      │  #1010 gesto intermitente   │  ← sin esto, toda medición de device es ambigua
      │  #1012 eje A sin apagar     │
      └──────────┬──────────────────┘
                 ↓
  ┌──── B · el dinero (latente HOY, no mañana) ────┐
  │  #1014 ✅ MERGEADO     ·  #1015 ✅ MERGEADO     │
  │  #1003 predicado único de «lo facturado»       │
  │  #1004 NC sin número reservado                 │
  └──────────┬─────────────────────────────────────┘
             ↓
  ┌──── C · el alta (abre la puerta) ────┐      ┌──── D · paridad mobile ────┐
  │  #999 allowlist · #1000 web          │      │  #1017 chat: artefacto +   │
  │  #1016 datos mínimos · #1001 legal   │      │        desambiguación      │
  │  #1002 SMTP                          │      │  #1018 bloques de agregado │
  └──────────┬───────────────────────────┘      └──────────┬─────────────────┘
             └──────────────┬───────────────────────────────┘
                            ↓
              E · medir las 6 cadenas y las 21 rutas en device
                      #1011 · #1012 · M-02 · M-03
                            ↓
                     F · tester externo (M-04)
```

**Las cuatro razones del orden, cada una con su causa:**

1. **El instrumento antes que la medición.** Mientras el gesto de apertura del escritorio sea
   intermitente (abre 4 de 6 ciclos, al primer toque 1 de 6), un rojo de eje A no se puede atribuir.
   Medir primero produciría 20 celdas que habría que volver a medir.
2. **El dinero antes del alta, aunque el alta sea el criterio 1.** Hoy no hay tráfico real, así que el
   dinero mal contado es **latente**. Abrir el alta primero invierte eso: el primer usuario real pasa
   a ser **quien descubre** que su cobro se cuenta dos veces. Un bloqueante del DoD no es
   automáticamente lo primero de la cola.
3. **#1003 antes de #1018.** El bloque «facturado del mes» no existe en mobile; portarlo mientras «lo
   facturado» se calcula con cuatro predicados distintos **importa la ambigüedad al teléfono**. Primero
   un predicado, después la pantalla que lo muestra.
4. **El predicado de los datos mínimos (#1016) en UN solo lugar, antes de cablearlo en las dos apps.**
   Hoy mismo se pagó que `esAnulable` estuviera definido dos veces y el fix llegara a una sola mitad:
   el verde de la mitad arreglada tapa el agujero de la otra. Ya **no** depende de #999 ni de #1000 —
   el gate del primer ingreso existe y las altas en beta son manuales por decisión del operador.

**Lo que corre en paralelo sin esperar nada:** el bloque **D** (paridad mobile) no depende de **C**;
se mide con el usuario canónico, que ya existe y ya entra. El sprint **no está parado** esperando las
decisiones del operador: éstas bloquean el criterio 1, no los otros siete.

---

## 5. El backlog, con DoD binario por ítem

**Cómo leer la columna DoD:** es binario y verificable por alguien que no hizo el trabajo. «Funciona»
no es un DoD; «el test hostil pasa y se vio fallar sin el fix» sí.

### Bloque A · Instrumento confiable *(dueño: frontend, dueño único del device)*

| issue | trabajo | DoD binario |
|---|---|---|
| **#1010** | El toque de la pestaña del escritorio es **intermitente**: abre 4 de 6 ciclos, al primer toque 1 de 6. El tap vive en `onEnd` de un `Gesture.Pan()` (`PanelFunciones.tsx:94-98`) | El toque abre **al primer toque, 6 de 6 ciclos**, con animaciones en valor **normal** y sensor por píxeles. El control positivo del arrastre valida la corrida o el resultado no se acepta |
| **#1012** | El eje A tiene **1 de 21** rutas con veredicto válido | Las 21 con veredicto válido medido con animaciones normales. Cada corrida con su control positivo: si el gesto de control no mueve la pantalla, la corrida se declara `INVÁLIDA`, no «no llega» |

**Antes de escribir código acá:** skill `swmansion-rn-gestures` (composición Pan/tap) y el equivalente
en `documed-front`, que ya resolvió esta cáscara en device. Portar adaptando, no copiar ciego. Y el
sensor por píxeles ya existe (`Auditorias/2026-10-11-toque-pestana-por-pixeles.py`): reutilizarlo antes
de escribir otro.

### Bloque B · El dinero *(dueño: backend)*

| issue | trabajo | DoD binario | estado |
|---|---|---|---|
| **#1014** | Un pago de MercadoPago se contaba **dos veces** en «Entró» desde el 06/10 | Un pago MP insertado aparece **una** vez en «Entró» y **una** en Ingresos, con test que lo cuente | ✅ **MERGEADO en `main`** — `6d3b3579` (PR #1023); 2297 passed / 0 failed en el VPS + control positivo con los números del defecto |
| **#1015** | Ninguna fila valía `estado='nota_credito'` ⇒ la app ofrecía **anular una nota de crédito** | Una NC se guarda como `nota_credito` y los fronts no le ofrecen «Anular»; un `estado` explícito sigue ganando a la derivación | ✅ **MERGEADO en `main`** — `6d3b3579` (PR #1023); 17/17 + control positivo |
| **#1003** | «Lo facturado» se calcula con **cuatro predicados distintos** según quién pregunte | **Un** predicado, en un solo lugar, y los cuatro llamadores lo usan. Test que compare las cuatro respuestas para el mismo mes | abierto |
| **#1004** | La NC se emite **sin número reservado** — el fix ya existe en el otro call-site | La NC reserva número por el mismo mecanismo que la factura. Propagar el fix existente, no diseñar uno nuevo | abierto |

### Bloque C · El alta *(dueño: backend + frontend + decisiones del operador)*

| issue | trabajo | DoD binario |
|---|---|---|
| **#999** | **CERRADO POR DECISIÓN (2026-10-12).** La allowlist es fail-closed (`web.py:1433`) y **se queda así**: en beta las altas las hace el operador a mano, sólo para personas cercanas. El **ingreso** —Google y email— funciona y está probado; lo cerrado es el **alta de alguien nuevo**, a propósito. 4 entradas, todas del operador | Ninguno de código: cierra por decisión. La UI para cargar la allowlist **sale del alcance** |
| **#1000** | El alta por email de **web** no se puede completar: el backend exige `invite_token` y el cliente nunca lo manda; el form sólo abre con `?signup=1` | Alta por email de punta a punta, con test del **camino real** (no del happy-path mockeado) |
| **#1016** | ⚠️ **Decía «mobile no tiene alta» y era falso** (medido 2026-10-12): el gate del primer ingreso existe en las dos apps con predicado único — `debeMostrarOnboarding` (`packages/core/src/api/onboarding.ts:18`), web en `App.tsx`, mobile en `app/_layout.tsx:98` + `Guard`, con tests los dos. Lo que falta es **qué se le pide**: hoy el paso ofrece conexiones (MP, Google) y los datos del negocio son todos opcionales con default. **Mínimos decididos: `que_vende` + `nombre_comercial`** | El predicado vive en **un** solo lugar y las dos apps lo importan; con cualquiera de los dos vacío **ninguna** deja pasar al shell; **test adversarial por app** (uno vacío ⇒ no entra) más su control positivo |
| **#1001** | Mobile **no cablea la aceptación** legal (la pantalla de lectura ya existe, `PantallaLegal.tsx:31`, ruta `app/legal.tsx`), y la aceptación **no condiciona nada** en ninguna plataforma | Un alta nueva **no puede operar** sin aceptar, en las dos plataformas; mobile llama `POST /me/legal/aceptar` y guarda la versión. **Test del caso hostil**: una cuenta sin aceptación vigente es rechazada |
| **#1002** | Sin SMTP no hay recuperación de contraseña ni cambio de mail. **DIFERIDO por decisión (2026-10-12):** en beta el operador resetea a mano | ⚠️ El DoD **no se cumple y no se va a cumplir en la beta**: «recupera su clave **sin intervención de nadie**» se cumple al revés — depende enteramente de una persona. Queda **abierto**, dueño operador, disparador: antes del primer usuario no cercano |

### Bloque D · Paridad mobile *(dueño: frontend)*

| issue | trabajo | DoD binario |
|---|---|---|
| **#1017** | El chat de mobile **no tiene** renderer de artefactos ni desambiguación multi-opción — las dos ausencias las declara el propio código (`Burbuja.tsx:23`, `ListaMensajes.tsx:356`) | Un `choices` de **3+** opciones se renderiza y es elegible en mobile, y un artefacto post-confirmación se muestra. Medido en device |
| **#1018** | Mobile no tiene los **bloques de agregado** que web sí: «facturado del mes» y el resumen de presupuestos | Los dos bloques existen y su cifra **coincide con la del detalle** para el mismo mes, con el predicado único de #1003 |
| **#1019** | «Tus apps» y los modos por app están **escritos e inalcanzables en web** y no existen en mobile. ✅ **DECIDIDO (2026-10-12): se RETIRA de las dos** | Retirado de web —pantalla, `modeStore`, `ModeButton` y chip del composer— con el `mode` del `send()` limpiado. 🔴 **Precondición:** confirmar la inalcanzabilidad **en runtime** antes de borrar (hoy medida estáticamente, `NO_PUDE_DETERMINAR`). **No tocar** `ConnectionsScreen.tsx:38`, que es otra pantalla con el mismo nombre y sí funciona |
| **#1021** | Tres filas de «Mi cuenta» en web **prometen y no hacen nada** (dos `<div>` sin `onClick`, un toggle sin endpoint) y estaban por portarse a mobile así | Cada una se cablea o se retira de la UI. Ninguna queda visible prometiendo. Y el docstring de `AccountScreen` deja de citarlas como capacidad existente |
| **#1007** | La card de confirmación (HITL) **queda activa** después de responderla | La card responde una vez y queda resuelta; un segundo toque no reenvía |
| **#1008** | La app dice «No lo anotamos.» sobre un ingreso que **sí** quedó guardado | El mensaje refleja el resultado real de la escritura. Test del caso en que la escritura sí ocurrió |
| **#1009** | Anular un comprobante **falla en silencio**: `try/finally` sin `catch` | El fallo se ve: el usuario recibe el error y el estado no queda a medias |

### Bloque E · Promesas sin rama *(dueño: backend + ambos fronts)*

| issue | trabajo | DoD binario |
|---|---|---|
| **#1005** | Un Responsable Inscripto lee «ya podés facturar» y la emisión **explota** con `NotImplementedError` | O la emisión funciona para ese caso, o la promesa no se muestra. Nunca las dos |
| **#1006** | El catálogo de apps **anuncia herramientas que fueron podadas** | Lo anunciado y lo cableado coinciden, ítem por ítem |
| **#1020** | **Cinco capacidades del backend** cableadas que ninguna app llama (3 con la función del core escrita y sin consumidor). ✅ **DECIDIDO (2026-10-12): se CABLEAN las cinco** | Las **cuatro** no bloqueadas, alcanzables desde la UI en **las dos** plataformas, cada una con su renglón y dueño. **Orden forzado:** `imputacion` **antes** de `margen` — el margen se calcula sobre gastos imputados, así que sin imputación todos los márgenes salen incompletos. **DoD de UI:** ninguna pantalla muestra margen sin `gastos_imputados` al lado (`gastos_web.py:183`). `cambiar-email` 🔴 **bloqueada** por #1002: sin SMTP no hay cómo verificar la dirección nueva |

### Bloque F · Evidencia en device *(dueño: frontend, dueño único del device)*

| issue | trabajo | DoD binario |
|---|---|---|
| **#1011** | Las **6 cadenas de negocio** nunca se midieron de punta a punta en device | Las 6 con veredicto del vocabulario cerrado y su `medido_contra:` |
| **M-02** | Medir en device los **46 ids** que `falta-en-mobile.py` lista, por lotes | Cada id con veredicto del vocabulario cerrado y su `medido_contra:` |
| **M-03** | Los 5 ids `cubiertos sin comparación` (`cobro-voz fact-voz onb-cumplida pres-voz vozchat`) | Idem, y salen de esa población |
| **#1013** | El APK de dev-client **se evapora de EAS a los 14 días** | La receta de reconstrucción existe y se ejercitó una vez |
| **M-04** | Tester externo con video | El video existe y su hallazgo entra **como fila**, no como impresión |

**Recetas que ya existen y no hay que redescubrir:** iterar en device **no compila nada** (dev-client
instalado + Metro local por USB) · el device **no corre `main`**, corre lo que Metro sirve, y Metro
sirve el **checkout compartido**, no tu worktree · gestos con `adb input motionevent` DOWN/MOVE/UP,
nunca `input tap` (no ejercita un `Pan` de RNGH) · el device exige **dueño único**: dos ADB fabrican
evidencia falsa · usuario de prueba canónico **uno solo, a fuego**.

---

## 6. Instrumentos: lo que había, lo que se construyó y lo que falta

| instrumento | qué da | estado |
|---|---|---|
| `scripts/evidencia/criterio3-padron.sh` | el universo: los 54 ids, de la **spec** | existía |
| `scripts/evidencia/criterio3-cruce.sh` | el cruce padrón × cierres, con ids por nombre | existía — **no mira plataforma** |
| `scripts/evidencia/contar-veredictos.py` | la cifra **por plataforma** sobre 20 documentos | existía — emite cifra, **no lista** |
| **`scripts/evidencia/falta-en-mobile.py`** | **los ids que faltan en mobile, por nombre** | **nuevo, 2026-10-11** |
| `Auditorias/2026-10-11-toque-pestana-por-pixeles.py` | sensor de apertura que **no necesita idle** | existe — reutilizar para el eje A |
| `scripts/abrir-issues-sprint.sh` | abre/sincroniza este backlog como issues, idempotente por título | nuevo |

**`falta-en-mobile.py` no es un script nuevo: es un agregador.** La lista por plataforma ya la
calculaba `contar-veredictos.py --json`, por lote. Re-parsear los cierres habría fabricado una
**segunda definición** de «tiene veredicto», que puede divergir de la que cita el criterio. Prueba de
que no divergió: da 13/54 en mobile, el mismo número que ya se citaba.

**Y el diseño que había bajado el 08/10 era contra una forma imaginada.** Decía «localizar la columna
`plataforma` por su nombre en el encabezado de cada tabla». Medido, el registro vive en **cuatro**
formas: los 14 ids medidos del lote A **no están en ninguna tabla** (son secciones con la plataforma en
prosa), y el lote B tiene **dos** tablas donde `plataforma` es el campo 5 de 8 en una y el **2 de 4**
en la otra — y la segunda tiene más filas. Un filtro por encabezado habría sido ciego a la población
más grande.

---

## 7. Las decisiones del operador — **LAS CINCO CERRADAS el 2026-10-12**

Estaban abiertas desde el **2026-10-06** y bloqueaban el **cierre** del criterio 1 (nunca el
arranque del sprint). Ya no bloquean nada: lo que sigue es ejecución con dueño.

1. ~~**Cómo entra un usuario**~~ — **DECIDIDO:** altas **manuales** en beta, sólo personas cercanas;
   los permisos de login los otorga el operador. La allowlist se queda y su UI sale del alcance. Los
   **datos mínimos** del primer ingreso: `que_vende` + `nombre_comercial` (ver #1016, ficha C-3).
2. ~~**Texto legal**~~ — **DECIDIDO: se cablea YA con el texto provisorio marcado como tal.** La
   aceptación pasa a ser **obligatoria en las dos plataformas** sin esperar al abogado. El texto
   definitivo sigue pendiente, pero ya no bloquea: cuando llegue se reemplaza el contenido, no el
   mecanismo. Incluye el **test del caso hostil** (una cuenta sin aceptación vigente es rechazada al
   operar), que es lo único que distingue el control de su ausencia — el happy-path sale verde igual
   si el guard no existe. Ver C-4.
3. ~~**Proveedor SMTP + DNS**~~ — **DECIDIDO: diferido a pre-prod. En beta el operador resetea las
   claves a mano.** Coherente con la decisión 1: quien otorga los accesos de ~4 personas cercanas
   también resetea su clave. **Deuda declarada, no resuelta:** el DoD de #1002 dice «el usuario
   recupera su clave **sin intervención de nadie**» y eso **NO se cumple**. #1002 queda **abierto**
   con dueño (operador) y disparador (antes de abrir a usuarios que no sean cercanos). Ver C-5.
4. ~~**#1019 — modos por app**~~ — **DECIDIDO: se RETIRAN de las dos** (rama **(b)** del DoD de D-3). Pantalla, `modeStore`,
   `ModeButton`, el chip de modo del composer y el `mode` del `send()`. ⚠️ **Precondición antes de
   borrar:** confirmar la inalcanzabilidad **en runtime**. Hoy está medida por lectura estática
   —fuerte, porque la declara el propio código en dos lugares (`AppShell.tsx:116-121`,
   `DesktopShell.tsx:89-91`)— pero el issue la marca `NO_PUDE_DETERMINAR`, y borrar sobre una lectura
   estática es la forma barata de romper algo que sí tenía un caller.
5. ~~**#1020 — cinco capacidades sin consumidor**~~ — **DECIDIDO: se CABLEAN las cinco. Ninguna se
   retira.** Esto **agrega alcance**, y se declara acá para que no aparezca como sorpresa a mitad del
   sprint; el detalle, los dos hallazgos que lo reordenan y la colisión con la decisión 3 están en la
   ficha **E-3**.

---

## 8. Deudas y riesgos declarados (no se descubren después)

- ✅ **RESUELTO — los dos fixes de dinero están MERGEADOS** (#1014, #1015) en `6d3b3579` (PR #1023), y los
  dos issues quedaron cerrados el 12/10. Medido por contenido, no por el título del PR: el merge
  toca `cobro_store.py` (doble conteo del pago MP) y `afip_comprobante_store.py` +
  `inteligencia_queries.py` (`nota_credito`), con tests en `test_contabilidad_integracion.py` y
  `test_inteligencia_queries.py`. **La cita de procedencia es el merge commit**, no la rama: las
  dos ramas ya no existen, así que «commit `ba1f8cbd`/`fca3abae`» no se puede resolver en un clon.
- ⚠️ **La decisión 5 agrega alcance que el plan original no tenía.** Cablear las cinco capacidades
  de #1020 significa **una pantalla nueva** (margen por trabajo: no existe módulo `trabajos` en
  ningún front) y **revertir una decisión previa de alguien** (mobile removió `PreguntarInteligencia`
  a propósito). No es una decisión gratis y no cabe en los huecos del sprint: necesita renglones
  propios en la tabla de hitos o no existe. Ver E-3.
- **`PantallaFacturacion.tsx` del checkout compartido está atrasado** respecto de la rama en vuelo.
  Commitearlo tal como está revierte +102 líneas ajenas. Medir el signo por archivo.
- **El eje A no tiene instrumento válido todavía** (#1012). Hasta que lo tenga, cualquier cifra de
  «rutas que no llegan» es `NO_ATRIBUIBLE`, no un rojo.
- ✅ **REFUTADO — `/actividad?q=` NO da 400.** Medido contra el handler:
  `apps/copiloto/actividad_web.py:99` declara `q: str = ""`, su `:112` dice «`q` YA está
  implementada: ILIKE sobre título+detalle» y `:120` la pasa al store. Lo del 400 lo afirmaba un
  **comentario** de mobile, ya corregido. **No hay nada que esperar de backend acá.**
  🆕 Y aparece una asimetría que nadie había comparado: **web busca global**
  (`ActividadScreen.tsx:84`), **mobile sólo por función** (`BuscadorActividad.tsx:77`). Las dos
  pasan `q` y `q` funciona ⇒ no es defecto, es una decisión de UX sin dueño. Clasificar antes de
  cerrar la paridad.
- ✅ **RESUELTO — `app/recientes.tsx` SÍ es alcanzable.** `apps/mobile/src/shell/PantallaPrincipal.tsx:179`
  cablea `onVerRecientes={() => empujarUnaVez('/recientes')}` al encabezado **tapeable** «Actividad
  reciente», con test verde (`PantallaPrincipal.test.tsx:146`). El comentario de `_layout.tsx` que
  decía «queda inalcanzable» era **rancio** y ya está corregido. **Sin tile ≠ inalcanzable.**
  ⚠️ Ese comentario invitaba a **borrar una pantalla alcanzable**; el único realmente inalcanzable de
  esa lista es `'apps'` (`#1019`).

> 🔴 **Los dos de arriba eran el MISMO mecanismo, y hoy dio CUATRO veces:** un comentario declara un
> estado, el código cambia, nadie actualiza el comentario, y el próximo lector le cree. Los otros dos
> fueron `cobro_store.py:52` —que me hizo afirmar «cero veces en Ingresos», falso— y el título de
> `#1001`, que habría mandado a construir una pantalla que existe. **Ninguno de los cuatro se detectó
> leyendo con más cuidado: los cuatro cayeron al medir contra el código que ESCRIBE o que NAVEGA.**
> Cuando un comentario es la única fuente de un hecho, no es un hecho.
- **Paridad de *parámetros* no medida:** un endpoint que las dos apps llaman puede estar invocándose
  con menos capacidad de un lado, y la tabla de 109 lo marca `AMBAS` igual. Es un segundo pase si ese
  eje importa.
- **El padrón de 54 cuenta `web` como 54/54, de los cuales 9 sin comparación.** Es dato, no acción:
  `DEC-18` — un hallazgo nuevo no reabre un criterio cerrado.

---

**Issues de este sprint:** `#999`–`#1021` (label `sprint-app-lista`). Reabrir o agregar se hace con
`scripts/abrir-issues-sprint.sh`, que compara por título exacto contra abiertos **y** cerrados antes
de crear. Si se corrige el título de un issue por `gh`, **hay que sincronizar el script**: su
idempotencia se decide por ese título, y un título desactualizado fabrica duplicados.
