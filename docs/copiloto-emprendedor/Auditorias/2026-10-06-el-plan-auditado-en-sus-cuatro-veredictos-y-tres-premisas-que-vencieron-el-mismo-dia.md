# El plan de cierre, auditado en sus cuatro veredictos — y **tres premisas que vencieron el mismo día en que se escribieron**

**Auditoría · 2026-10-06** · medido contra `origin/main` entre `835602a4` y `c3208b5d` (fetch fresco en cada
medición; cada cifra cita el SHA con que se midió). Tercer entregable del turno; los dos anteriores son
`2026-10-06-barrido-instrumentos-lint-y-recibo-cuatro-refutados-y-una-exencion-eterna.md` y
`2026-10-06-el-working-tree-compartido-tiene-codigo-pre-850-y-un-diff-no-tiene-direccion.md`.

**Contexto:** la orden del operador de hoy saca a los instrumentos del alcance — *«el foco es terminar la beta,
no los elementos de medición»*. Este turno movió el barrido al **producto**: verificar lo que el plan de cierre
y los contratos **afirman** contra lo que `origin/main` **tiene**.

---

## 1 — Resultado: el plan está auditado en sus cuatro veredictos

`docs/copiloto-emprendedor/2026-10-06-plan-y-backlog-de-cierre-lo-que-falta.md` (PR #799), 77 ids no-`V`:

| veredicto | ids | qué se midió | resultado |
|---|---|---|---|
| `HECHO` | **56** | las **109** citas `path:línea` existen en main | ✅ **109/109**. Cero archivos ausentes, cero líneas fuera de rango. Las 3 que el barrido marcó son **elipsis literales** del plan (`apps/mobile/.../X.tsx`), resueltas a mano: los 4 archivos existen |
| `PARCIAL` | **11** | qué falta **concretamente**, fila por fila | sólo **2 pedían código** (`BL-F1`, mitad mobile de `BL-O6`) y **las dos quedaron resueltas por el contrato de frontend**. El resto espera device (4), al operador (2), a Martín (1), o son compromisos recurrentes no cerrables de una vez (2) |
| `FALTA` | **8** | cuál es accionable hoy | 7 son familia `O` diferidos por acta · el único accionable, `BL-C5`, **no pide código: pide una decisión** (§3) |
| `OBSOLETO` | **2** | si el veredicto y la evidencia se sostienen | `BL-B4` es bash ≥4 en `scripts/` (instrumento: fuera de foco) · **`BL-X9` tiene los dos anclajes vencidos** (§4) |

**Y el contrato de frontend del día estaba completo:** emitido **09:42**, a las **10:22** tenía 5 de 6 filas
mergeadas, y la sexta estaba cerrada también. Lo que faltaba era el `mv` — planificación lo aceptó entero y
archivó el contrato en `cerrado/2026-10-06/`.

## 2 — El patrón del turno: **tres premisas que vencieron, y las tres sostenían algo**

No es un defecto de nadie. Es la velocidad del sistema contra la vida útil de una medición escrita.

| premisa | medida | vencida | qué sostenía |
|---|---|---|---|
| `[WIP-LOCAL]` sobre `afip_web.py` / `afip_rules.py` | antes de hoy | **ya no difieren de main** | la cautela que frenaba firmar `BL-C6` y `BL-X5` |
| §A4 del contrato: *«NINGUNA app lee el campo — el tipo TS de `/me` ni lo declara»* | **09:42** (cierta) | **16:15** (`#836`) | el argumento que descartó la opción (1): *«web tampoco lo tiene ⇒ sería un flujo nuevo en las dos apps»* |
| `BL-X9`: evidencia en `AccountScreen.tsx:107-116` + `app/ajustes-mi-plan.tsx:13-21` | antes de `A10` | **el archivo ya no existe**; la fila «Plan» salió | nada crítico — el veredicto `OBSOLETO` sigue bien |

**Lo que las distingue:** una premisa **negativa** («cero hits», «no existe», «ninguna app») envejece en la
dirección peligrosa — se escribe cuando algo falta y deja de ser cierta **en silencio** cuando alguien lo
agrega. Y la del §A4 es la que más enseña: **no quedó invisible una deuda, quedó invisible una premisa.** Es
peor, porque una deuda invisible se paga tarde y una premisa invisible deja en pie una **decisión** que ya no se
sostiene.

### 2.1 Y la marca que invierte la dirección

Las dos marcas `[WIP-LOCAL]` que siguen vivas (`web.py` **+21/−122**, `tool_catalog.py` **+7/−23**) dicen
*«tiene cambios sin commitear»* — que empuja a **commitear**. El disco está **atrasado**: commitearlo revierte
#850/#855. Verificado por **símbolo, no por línea**: `MercadoPagoError` (×3) e `instagram` (×2) ya viven en main,
así que el disco tiene la versión **vieja**, no trabajo que se pierda. Mismo defecto de dirección que ya se bajó
sobre la línea del índice de memoria, ahora en el documento que todos leen para cerrar la beta.

## 3 — `BL-C5`: el único `FALTA` accionable no pide código

Su DoD pide *«reemplazar `Linking` por `openAuthSessionAsync`»*. Pero `apps/mobile/src/modules/auth/oauth.ts:4-9`
registra el pedido explícito del operador al migrar el login a nativo: *«no un navegador — **ni Custom Tabs
forzando Chrome** ni ningún otro»*. **`openAuthSessionAsync` es Custom Tabs.** El plan ya marcaba la precaución;
lo que faltaba era la consecuencia: **el DoD, ejecutado literal, construye el mecanismo rechazado.**

Y no se traslada mecánicamente, por eso es decisión y no tarea: el login tiene variante nativa (Credential
Manager), el OAuth de Composio **no** — ahí la elección real es *«navegador del sistema vs Custom Tabs»*. `DEC-4`
no la resuelve: raciona builds EAS a 2. Queda abierto si el binario instalado ya incluye el módulo nativo
(`expo-web-browser@~57.0.2` sigue en `package.json:29`), y eso se verifica en device.

> ✅ **DECIDIDA el mismo día, despues de este barrido: «no se migra» (plan maestro, fila `BL-C5`).** Se deja
> escrito acá para que nadie abra trabajo para decidir algo ya decidido — el modo de falla que este repo ya
> tiene documentado. El plan también corrigió las dos citas desplazadas que motivaron la fila (hoy
> `PantallaApps.tsx:2`, `:172-177`, `:178`).

## 4 — Cinco hipótesis propias, refutadas midiéndolas — **una por otra sesión, y con razón**

El valor del turno no está sólo en lo que encontré: está en lo que **no** era.

| hipótesis | por qué parecía | lo que la mató |
|---|---|---|
| `[WIP-LOCAL]` marca evidencia que **no está en main** | la marca no está definida en el plan | significa *«el archivo citado tiene cambios sin commitear»*: es **cautela del autor**, ya hacía lo que yo iba a reportar |
| `BL-C1` firmó el sello CONECTADO sobre el criterio retirado de `web.py` | la marca `[WIP-LOCAL]` cuelga de su fila | su evidencia es `ServiceCard.tsx` + tests del front; la marca sobre `web.py` es un **aviso lateral** |
| `BL-F1` no tenía dueño · el contrato mandaba trabajo ya hecho | FE2 reportó «sin frente abierto» | lo tiene (el contrato), y el trabajo se hizo **después**: 09:42 → 10:22 |
| **`/me` y `/catalog` responden `mp_connected` con dos criterios distintos** | leí `web.py:1045,:1055` con `first_seller_user_id()` y `:670` con `_mp_connected()` | **refutada por backend**: `:1045`/`:1055` son el **disco pre-#850**. En `main` hay **un** criterio — `_estado_mp` (`:641`) → `_mp_connected` (`:648`) → `/me` (`:670`) y `/catalog` (`:1203`) |
| **`A6` tiene mitad mobile sin verificar** | el fix de web (portal) **no es portable**: `SheetRequiereConexion.tsx:20` declara que **no** es un `Modal` (K-11/`BL-J8`) | **no hay tab-bar en mobile**: `app/_layout.tsx:134` es `<Stack>`, no existe `app/(tabs)/`, cero `bottom-tabs`. El defecto **no puede existir** ⇒ `A6` es `web` y estaba cerrada |

**La cuarta es la que más costó y la mejor lección: medí el mecanismo del FIX y leí la respuesta como el estado
del DEFECTO.** Son cosas distintas, y la segunda se mide antes: *¿existe acá la precondición del defecto?* Un fix
no portable en un gemelo sin esa precondición no es una costura abierta — es una fila que nunca fue de los dos.
Y el error cae del lado caro: **difiere a device algo que se cerraba hoy.**

**Y la quinta es la más incómoda de las cinco, porque la refutó otra sesión y porque es el mismo defecto que
levanté dos veces después:** leí un archivo del **working tree compartido** y tomé su contenido por el estado del
repo. Un `git diff` dice **cuánto** difieren dos árboles y **nunca cuál es el viejo** — acá el disco es el
atrasado. Eso es exactamente `REVERSIONLATENTE` y `WIPLOCALDIRECCION`, que encontré **después** de haberlo
cometido yo en ese hallazgo. Ya lo acusé ante backend sin reservas, y el cambio de práctica es mecánico: **toda
cita de código en un hallazgo sale de `git show origin/main:<path>`**, nunca del archivo en disco; si el archivo
difiere de main, el hallazgo declara contra **qué árbol** se midió. Las 109 citas del §1 ya salieron así.

**Lo que esto dice del orden de los hallazgos del día:** encontrar un defecto de método en el trabajo ajeno es
mucho más fácil que verlo en el propio del mismo turno. El que lo vio primero fue backend, en el único lugar
donde yo no estaba mirando.

**Tuvo consecuencia operativa, no sólo cognitiva:** el mensaje con ese titular ya estaba en el buzón. Lo
**reescribí** en vez de appendear la corrección, porque un titular refutado circula igual que uno correcto. Un
mensaje propio de 6 minutos sin circular es barato de retirar; retirarlo dejó un **sidecar huérfano** del
escalador, que también hubo que limpiar — `escaladores-buzon.sh:530` sólo borra el sidecar cuando el propio
script retira un `urgente_` que él generó.

## 5 — Un instrumento propio, descartado antes de publicar su cifra

La lección del §2 sugería un barrido obvio: las afirmaciones **negativas** son las únicas verificables por
script, así que grepear el símbolo citado y marcar «vencida» si hoy tiene hits productivos. Lo escribí, le puse
control positivo (`legal_version_aceptada` → debía salir VENCIDA; `first_seller_user_id` → VIGENTE) y **pasó el
control**. Igual **no publico su cifra**, porque el denominador lo delata: **32 de 50 «vencidas»** es
implausible, y los casos muestran tres fallas de raíz:

- **Ignora el alcance.** *«0 hits de `mensajeId` **en los cuatro**»* es una afirmación sobre cuatro archivos; el
  grep la midió contra todo el repo (**148 hits**) y la declaró vencida.
- **Ignora el signo.** Marcó mi propia frase *«la navegación **es** `Stack`»* — una afirmación **positiva** —
  como premisa negativa vencida.
- **Pesca el símbolo incidental.** *«ninguna aborta nada»* → tomó `await` (**1040 hits**) como sujeto.

> **La conclusión, que vale más que el barrido:** una afirmación negativa es verificable **sólo si su alcance es
> explícito y mecánico**. «0 hits de X» lo es; «0 hits de X en los cuatro» no, porque el alcance vive en la prosa.
> Si se quiere que esto sea auditable, la premisa tiene que **declarar su comando**, no su resultado. Y eso es
> trabajo de instrumento, que la orden de hoy deja fuera: queda escrito, no construido.

**Que el control positivo pasara y el instrumento igual fuera inservible es el dato más incómodo del turno:** un
control positivo acredita que el instrumento **puede** marcar, no que su **denominador** signifique algo. Lo que
lo cazó fue la implausibilidad de la cifra, no el control.

### 5.1 Y la regla se cobró su segundo caso en el mismo turno, en dos minutos

Después del barrido de premisas probé un cruce distinto: los ids `BL-*` citados por filas **no cerradas** del
tablero contra los que el plan declara `HECHO`. Dio **20 de 47**. Por la regla de arriba no lo publiqué: **43%
es implausible**, así que abrí **tres casos a mano** antes de contar. Los tres eran menciones de **contexto**,
no filas que trackeen el id — `BL-B1` aparece en `OLA4` como insumo **ya verificado**, `BL-J8` como contenido
de `OLA3`. Mismo defecto que el barrido anterior: cita ≠ trackeo, igual que símbolo ≠ sujeto.

**Y el cruce ya estaba hecho, mejor:** el propio tablero lo reconcilia en una nota —`FACTURAPDF` **ya era**
`BL-C2`, `SINPLAN` **ya era** `DEC-8`— con la explicación estructural que terminó en el §7 de este doc. Dos
minutos de validación a mano evitaron publicar ruido **y** duplicar trabajo ajeno.

## 6 — Filas bajadas (ninguna la abro yo)

| id | dueño | estado |
|---|---|---|
| `WIPLOCALDIRECCION` — 2 marcas vencidas (firma `BL-C6`/`BL-X5` sin código) + 2 que invierten la dirección | planificación | abierto |
| `C5SINCODIGO` — el único `FALTA` accionable es una decisión, y su DoD construye lo rechazado | planificación / operador | **cerrado** por planificación |
| `A6SOLOWEB` — contrato completo 6/6, `A6` es `web`, falta el `mv` | planificación | **cerrado**: aceptado entero, contrato archivado |
| `LEGALMICUENTASOLOWEB` — la premisa del §A4 venció; web lee y muestra el estado legal, mobile no | planificación / frontend1 | abierto |
| `CATALOGCONNECTEDMUDO` — el adversarial asertaba `status` y no `connected`, el campo que #855 cambió de dueño | backend | **cerrado**: PR #857, control rojo (mutante `catalog.py:160`) |
| `REVERSIONLATENTE` — el disco tiene `web.py` pre-#850 | backend / planificación | **cerrado por backend** (no commitea desde el compartido) · el gemelo sobre qué hacer con el árbol sigue abierto en planificación |
| `ME-CATALOG` — dos criterios de `mp_connected` | — | **refutado por backend, aceptado sin reservas** (§4) |
| deuda de comentario: `shell.test.tsx:40-43` documenta un `app/(tabs)/_layout.tsx` con `<Tabs>` que **no existe** | frontend1 | en `A6SOLOWEB` §3, sin PR propio |

## 7 — Lo que NO medí, explícito

- **⚠️ Auditar los 77 no es auditar el plan entero, y el plan no es el producto entero.** Medido sobre
  `origin/main`: el plan menciona **110 ids `BL-*`** distintos, de los cuales **77 llevan veredicto** (los de
  este doc) y **33 son la familia `V` sin veredicto propio** — las pantallas/propuestas del prototipo ODOBI,
  que `BL-V1` describe textual como *«PROPUESTA de Martín; no existe en ninguna capa»*. **No son deuda:**
  contarlas como pendiente infla el faltante, que es el motivo por el que la cola no convergía.
- **Y el alcance del plan mismo:** cubre la **beta de pantallas**, no el producto completo — integraciones y
  monetización quedaron fuera por diseño, con cuatro frentes vivos en el tablero que **no tienen id en el
  plan** (`COBROMP`, `DRIVECERO`, `SHEETSSOLOAPPEND`, `IGHUBSPOTFANTASMA`). La reconciliación es de
  planificación, no mía; la cito porque **cambia cómo se lee este doc**: «las 109 citas existen y los cuatro
  veredictos se sostienen» dice que *el plan* está sano, **no** que la beta esté cerca.
- **Nada en runtime ni en device.** Todo es lectura de `origin/main`: tipos, código, estructura de rutas. Donde
  digo «no puede existir» (el §4, `A6`) es un argumento **estructural** (no hay barra), no una medición de
  layout; si alguien encuentra una tab-bar que no vi, ese veredicto cae.
- **No audité los tres contratos de backend**, que están **en curso**: medir trabajo en vuelo produce falsos
  negativos.
- **No audité `BL-B4`** (bash ≥4 en `scripts/gate.sh`): es instrumento, fuera del foco por la orden del operador.
- **No re-verifiqué las otras cuatro mediciones del §A4** — sólo la línea `:223`, que es la que sostiene su
  argumento.
- **`fleet-platform` #10 no lo intenté mergear.** Es un clic del operador, bien escalado con dos denegaciones
  medidas; una acción denegada a otra sesión no se intenta desde la mía.
