---
name: el-contrato-que-manda-a-hacer-algo-ya-hecho
description: Un contrato que asigna trabajo ya cerrado es el mismo defecto que una fila que dice pendiente sobre trabajo mergeado, al reves - y cuesta un turno entero de la sesion que lo recibe, que ademas puede no atreverse a contradecirlo.
metadata:
  type: feedback
---

# 📋🔃 El contrato que manda a hacer algo YA HECHO

**2026-09-29.** Bajé la cola por sesión para las cuatro sesiones, con DoD binario por ítem. A FE2 le
asigné dos cosas y **las dos estaban mal**:

| lo que el contrato dijo | lo que el tablero decía, en la misma línea |
|---|---|
| «terminar `Q3R` (30 filas)» | `PLAN.md:170`: «**Lote B (FE2) 4/4 sub-tareas cerradas**; falta lote A (FE1)» |
| «`DOCANC` — corregir el audit del 16/09» | `PLAN.md:184`: «**Dueño: frontend1**» |

Cité los ids **sin medirlos contra el tablero** — el mismo día, y en el mismo contrato, en que bajé la
regla «cierre por EFECTO: ninguna fila cambia de estado por lo que alguien reporta».

## Es el defecto espejo del drift de tablero, y por eso no se ve

[[un-enum-al-final-del-renglon-lo-borra-el-que-appendea]] y la fila que dice `pendiente` sobre trabajo
ya mergeado son el caso conocido: **el tablero miente hacia «falta»**. Este es el otro lado: **el
contrato miente hacia «falta» también**, pero la fuente no es el tablero sino yo, que escribí de
memoria. Los dos mandan trabajo hacia algo que ya existe.

La asimetría que lo hace peor: el drift de tablero lo caza un script (`plan-drift-check.sh`). El drift
del contrato **no lo caza nada**, porque el contrato es nuevo: no hay historia contra la que compararlo.
Su único control es medir cada id **antes** de escribirlo.

## Y el costo real no es el turno perdido

FE2 paró y preguntó — bien. Pero una sesión más obediente hubiera hecho las dos cosas: re-cerrado un
lote ya cerrado, y tocado un archivo de otra sesión en checkout compartido. **El contrato no sólo
desperdicia trabajo: autoriza una colisión.** Lo que lo evitó fue que la sesión midiera el tablero antes
de arrancar, no que el contrato estuviera bien.

Corolario que vale para toda cola que baje: **decir explícitamente que medir el tablero antes de
arrancar es parte del trabajo, y que contradecir la cola con evidencia es lo esperado.** Sin esa
licencia escrita, la sesión que obedece produce el daño y la que pregunta parece la lenta.

## El hallazgo de fondo: FE2 no tenía NINGUNA fila

Al medir las 13 filas abiertas del tablero con su dueño, salió que **todas eran de FE1, de backend o
mías**. FE2 no tenía ni una. Por eso el contrato le inventó trabajo: yo sabía que tenía que darle algo
y llené el hueco con los ids que tenía a mano. **El contrato no falló al copiar: falló al no medir que
no había nada que copiar.**

**Why:** porque una cola inventada se ve igual que una cola real — tiene ids, tiene DoD binario, tiene
formato válido. [[el-forjador-no-acierta-siempre-el-gate-de-tests-no-es-opcional]] dice lo mismo de los
artefactos generados: formato válido no es contenido correcto. Un contrato bien formateado con ids
equivocados pasa cualquier lint y no pasa la realidad.

**How to apply:** (1) antes de escribir un id en una cola, abrí su fila y leé **el estado y el dueño**,
no el título — son los dos últimos campos y son los que contradicen; (2) si al armar la cola de alguien
te encontrás buscando qué darle, pará: **medí cuántas filas abiertas tiene** antes de asignarle una, y
si son cero, decilo en vez de rellenar; (3) escribí en el contrato que medir el tablero antes de
arrancar es parte del trabajo — la sesión que obedece sin medir es la que produce el daño.

## Refuerzo 2026-10-05 — un archivo DIVERGENTE no dice si es más nuevo o más VIEJO que `main`

La forma más caliente de esta falla no es citar un id ya cerrado: es **leer «modificado / untracked»
como «trabajo nuevo que todavía no llegó»**. El estado de git dice que el disco y `main` difieren.
**No dice en qué dirección.** Y la dirección es todo el veredicto.

Me pasó **dos veces en una hora**, el mismo día:

1. **WIPCOMPART.** Medí 22 tracked + 82 untracked en el checkout compartido, vi `+101` en
   `PantallaFacturacion.tsx` con la clave de idempotencia entera y su ADR-005 sin versionar, y bajé
   dos contratos diciendo «FACTID está implementado de los dos lados y nada llegó a `main`, con
   `FACTIDFIX` abierto como gate de AFIP **producción**». Frontend1 lo refutó en una pasada: **ya
   estaba en `main` desde el 29/09** (PR #729, `6641e83a`). Lo del disco eran **copias viejas** — al
   `.test.tsx` le faltaba contenido que `main` sí tiene. Convertí una limpieza en una alarma de
   producción porque no medí la dirección.
2. **Mi PR #776.** Acá sí la medí, y salió al revés de lo que suponía: **11 de 22 archivos ya
   idénticos en `main`**, y de los 11 que divergían el diff contra `main` daba `+0 −105`, `+12 −413`,
   `+1 −92`. O sea que la rama **borraría** cientos de líneas que `main` ya tiene. Las líneas «+» que
   parecían su aporte eran el encabezado original de archivos que `main` ya reescribió.

**La medición que decide, y es de una línea:**

```bash
git diff --numstat origin/main HEAD -- <archivo>   # ¿suma o RESTA contra main?
```

Si contra `main` el archivo **resta** líneas, la copia es la vieja: el veredicto es `YA-EN-MAIN` o
`DESCARTAR`, nunca `MERGEAR`. En un checkout con HEAD viejo, **`YA-EN-MAIN` es la hipótesis por
defecto**, no la excepción.

**Por qué el error es asimétrico y siempre cae del mismo lado:** suponer «nuevo» produce una alarma
—trabajo en riesgo, gate abierto, contratos bajados— y suponer «viejo» produce una limpieza. La
alarma se siente como prudencia y nadie la audita, así que el falso positivo sobrevive. Y si alguien
«resuelve» ese estado tomando el lado del disco (`--ours`, o un merge sin medir), **borra en silencio
lo que `main` ya tenía** y el síntoma aparece semanas después.

**La pregunta que lo caza:** *¿este archivo le agrega algo a `main`, o `main` le agrega algo a él?*
Ver también [[checkout-ref-doble-guion-punto-pisa-cambios-solo-en-working-tree]] ·
[[resolver-tomando-un-lado-nunca-converge]] · [[deploy-sh-no-valida-checkout-al-dia-con-main]].

## Refuerzo 2026-10-06 — el contrato que llega TARDE no se nota desde el worktree viejo, y el `...` three-dot te muestra trabajo que ya existe

Un `urgente_` de planificación me asignó la mitad web de A3 a las **11:05**, con worktree y rama
nombrados. Lo obedecí hasta el punto de medir, y ahí se cayó: **#806 (esa mitad) se había mergeado
13:19:10** y **#803 (la otra) 13:22:07** — el contrato era **2h14m anterior al cierre** de lo que
pedía. No estaba mal escrito: **envejeció entre que se escribió y que lo leí.**

**Lo que vale no es «medí el estado»: es QUÉ instrumento lo oculta.** Desde adentro del worktree, el
reflejo es `git diff --stat origin/main...HEAD`, y me devolvió **+179/−2 en 2 archivos**: parecía
trabajo pendiente y listo para PR. **El three-dot (`...`) parte del merge-base: muestra lo que TUS
commits cambiaron, no si ese contenido ya está en el destino.** Un trabajo tuyo ya mergeado por squash
sigue apareciendo ahí, idéntico, para siempre.

El control que lo destapó es el **two-dot por archivo** — `git diff origin/main -- <path>`, que compara
**estados**:

| archivo | three-dot | two-dot vs `origin/main` |
|---|---|---|
| `SeccionMisComprobantes.tsx` | +43 | **0 líneas ⇒ ya está en main** |
| su `.test.tsx` | +138 | 20 líneas, **y al revés: `main` tenía 9 líneas de comentario que mi worktree NO tenía** |

Esa última fila es el peligro real: **mi worktree estaba ATRÁS**. Obedecer el contrato sin medir no
habría sido trabajo redundante y benigno — habría abierto un PR que **revertía** comentarios ya
mergeados, con el archivo de producción idéntico. El diff de un PR así se ve como trabajo nuevo.

**La regla:** antes de tomar un contrato que nombra un worktree viejo, el control no es «¿tengo commits
sin pushear?» sino **«¿el CONTENIDO de los archivos que nombra ya está en el destino, y en qué
dirección?»** — two-dot por path, más la fecha de merge de los PR que lo cubrirían.
Ver [[un-cierre-dirigido-a-otra-sesion-puede-contener-exactamente-tu-cola]].

---

## Refuerzo 2026-10-07 — el DoD citó el DEFECTO, no su ESTADO: el `cierre_` que lo respondía estaba en la MISMA carpeta `abierto/`, nombrando las ramas exactas

Un DoD de deploy pedía verificar en el navegador contra prod que *«el setup de AFIP no manda a conectar
Drive en Apps»*. **Tres sesiones lo intentaron y ninguna pudo**: frontend grepeó
`PantallaAfipSetup.tsx` y encontró sólo «Copia en Drive», se negó —correctamente— a darlo por
confirmado, y lo marcó `[ASSUMED_PENDING_VERIFY]`; backend lo dejó *«no medido, requiere navegador»*;
planificación me pidió el texto exacto para *«confirmarlo o descartarlo»*. La conclusión que se estaba
formando era **«no es reproducible, se retira del DoD»**.

**Era reproducible. Ya estaba arreglado.** El texto existió, en el archivo que todos miraron
(`apps/copiloto-web/src/modules/ajustes/afip/PantallaAfipSetup.tsx`), en el commit **padre del fix**
(`4150cfda`):

- `:792` — `Google Drive no está conectado. Conectalo en Apps para que tus facturas se guarden —`
- `:801` — `Necesitás tener Google Drive conectado en Apps. Si no lo está, la factura se emite igual`

Lo removió `b5e4146b` — `fix(web): el setup AFIP deja de mandar a «conectar Drive en Apps» (DRIVECERO)
(#863)`, **ancestro del SHA vivo**. Y el `cierre_` que lo declaraba estaba **en la misma carpeta
`abierto/` que el DoD**, nombrando las dos ramas exactas:
`DRIVECERO-web-setup-AFIP-sin-salida-hacia-Apps-PR863-mergeado.md:7` → *«en las ramas
`driveConectado === false` y `== null` del bloque 4, el texto «Conectalo en Apps» / «conectado en Apps»
salió»*.

**Lo que casi costó, y es la diferencia con los casos anteriores de esta entrada:** acá el trabajo
redundante no era benigno. Ver el setup exige un tenant **sin AFIP configurada**, y el canónico la tiene
⇒ las dos sesiones concluyeron que había que **desconfigurar AFIP en producción**. Un criterio ya
cumplido estaba a punto de justificar una **escritura en prod** — exactamente lo que el canon prohíbe
producir para alcanzar un estado de prueba.

**La raíz es de redacción, y es fina:** el DoD listaba *«los tres defectos que motivan el deploy»* y
después pedía verificar su ausencia. Citar el defecto es correcto; lo que faltaba era **su estado y el
commit que lo cerró**. Un defecto nombrado sin fecha ni dueño se lee como vigente, y cada lector lo
vuelve a buscar en el presente, donde por definición ya no está.

**El control del cero, que acá es obligatorio:** «0 hits» tiene tres causas —el fix, el path equivocado
y el archivo ausente— y las tres se ven igual. El que discrimina es el **mismo patrón sobre el mismo
path en el commit padre**: 2 hits en `4150cfda`, 0 en prod, con el archivo presente (806 líneas) y
`Drive` todavía en 18 hits. Sin esa segunda cifra, mi 0 era indistinguible del 0 de frontend, que vino
de buscar un texto que ya no existía.

**How to apply:** (1) Antes de medir la ausencia de un defecto en prod, grepeá **el buzón entero con las
palabras del propio defecto** (`grep -rniE` sobre `coordinacion/`, cerrados incluidos): el `cierre_` que
lo respondió puede estar en `abierto/`, y un `cierre_` dirigido a otro no te llega por ningún canal
([[un-cierre-dirigido-a-otra-sesion-puede-contener-exactamente-tu-cola]]). (2) Un defecto citado en un
DoD lleva **su commit de fix o un «vigente al \<SHA\>»**; sin eso, el DoD manda a buscar en el presente
algo que vive en la historia. (3) Si para reproducir un defecto hay que **escribir en prod**, pará: antes
preguntá si el defecto sigue existiendo **en el código**, que es gratis y no muta nada
([[desplegado-no-significa-con-clientes]]). (4) «No es reproducible» es una conclusión con dos causas
—no existe, o **ya se arregló**— y el diff del fix las separa en una línea.

**REFUERZO 2026-10-07 — tres veces en un turno, y la causa no es «no medí»: es DÓNDE medí respecto de cuándo despaché.** Tres veces le asigné a una sesión algo ya hecho: una fila que backend cerró **mientras** yo escribía el reparto, una que FE2 había rechazado en un `avance_` que no había leído, y un ítem de medición que FE2 cerró **dos minutos antes** de que yo lo pidiera. El último tiene las tres horas al lado: su `cierre_` **01:44:53**, mi archivo **01:46:52**, y mi listado del buzón era de las **01:31**.

**El mecanismo, que no es descuido:** mido → **escribo 15 minutos** → despacho. La medición que decide el despacho envejece **durante la redacción**, y cuanto más cuidado pongo en el texto, más vieja está cuando sale. Con tres sesiones en paralelo aparece un `cierre_` cada pocos minutos, así que **la ventana de redacción es exactamente la ventana del error**.

## How to apply

- **Re-listar el buzón ES el último paso antes de despachar, no el primero.** Un `ls -t` de dos segundos sobre `abierto/` + `cerrado/<hoy>/` inmediatamente antes de escribir el archivo final — o antes del `SendMessage`, si el archivo ya estaba escrito.
- **No se re-mide «el estado»: se re-mide CADA ítem que estoy por asignar.** Tres ítems, tres chequeos, y el barato es por nombre: ¿hay algún archivo de hoy que mencione este id?
- **Si el despacho ya salió, la corrección va ARRIBA del archivo y por el mismo canal por el que salió.** Appendear deja el pedido equivocado al frente ([[de-dos-artefactos-con-distinta-precision-gana-el-que-circula]]).
- **El costo no es cosmético:** la sesión que recibe el pedido duplicado gasta el turno en demostrar que ya lo hizo — o peor, lo hace dos veces.

## Tercera ocurrencia — 2026-10-08, y esta vez costó un reimplementado completo

El patrón ya no es un caso: es el más reincidente de la coordinación (29/09, y dos veces el 08/10).

Bajé a frontend-1 el contrato de `A3` (BL-V31, el guard B de la quinta tarjeta) como **la única fila
de código que faltaba** de la lista cerrada. Frontend-1 lo implementó entero y lo pusheó
(`83bf6971`). Estaba hecho y mergeado **desde julio**, en el PR #803 (`a9bd6cae`), con su test — que
además se había arreglado después en el #819.

Cuán exacto fue el duplicado: **mismo mensaje de commit**, los **mismos cuatro `it(`**, y el blob
del `.tsx` **idéntico** al de `main`. No fue una solución distinta al mismo problema: fue la misma.

**La causa no fue el contrato, fue la medición que lo justificó.** Medí el `useEffect` de carga
(`:135`) y escribí «nunca consulta `anulacionEnCursoDe`». Era cierto de ese hook y falso del
componente: el guard vivía en el handler que abre el flujo (`:180`). Ver
[[el-instrumento-respondio-sobre-otro-sujeto]] — miré el hook y afirmé sobre el componente.

**El control cuesta una línea y va ANTES de escribir el contrato, no después:**

```bash
git log --oneline -3 origin/main -- <el archivo que el contrato manda a tocar>
```

Si el último commit de ese archivo ya dice lo que tu contrato pide, la fila está cerrada. En este
caso decía textual «retomar la anulación en curso al abrir el flujo (BL-V31, mobile)», que es el
título del contrato que yo estaba por bajar.

**Y el control de segundo orden, para el que ya tiene la rama:**
`git merge-base --is-ancestor <sha-de-la-rama> origin/main` dio **NO** — o sea «no está en main» —
mientras `git log origin/main -- <archivo>` decía que el contenido **sí** estaba. Las dos respuestas
son correctas y miden cosas distintas: la rama no está mergeada, el trabajo sí. **Una rama ausente
de `main` no prueba que su trabajo falte.** Preguntar por el ARCHIVO, no por la rama.

**Por qué muerde más acá que en un repo normal:** con sesiones paralelas el implementador confía
en el contrato como fuente de alcance y **no re-mide la fila** — hace bien, para eso existe la
división. Eso traslada todo el peso de la verificación a quien baja el contrato: si yo no mido, nadie
mide, y el duplicado llega hasta el push.

## Refuerzo 2026-10-08 — el defecto no estaba en el VEREDICTO, estaba en la CAUSA que el veredicto citaba

Dos filas del criterio de cierre §13 pasaron de 🔴 a ✅ **el mismo día** en que el doc las declaraba
rojas (el punto 2 lo cerró auditoría con el #937, el punto 4 backend con el #932). Hasta ahí es el
drift conocido. Lo nuevo es **por qué nadie las releyó**:

> **Las dos filas citaban un mecanismo que ya estaba muerto, y una fila con causa vencida sigue
> leyéndose perfectamente coherente.**

La del punto 4 decía: *«`smoke_beta_e2e.py:19` importa `meclaves_check` y `run-smoke-prod.sh` lo pipea
por stdin, así que el import no resuelve»*. Ese bug se había arreglado el **07/10** (#908). Lo que
seguía roto era otra cosa (un export de env que faltaba, `UC_LOGIN_CONTRATO_PATH`). La fila describía
con precisión técnica un problema **inexistente**, y por eso aguantó: no tenía ninguna de las marcas
de una fila podrida —no era vaga, no era vieja, no estaba sin ancla— tenía `path:línea` y nombraba un
import real.

**La asimetría con la entrada original.** Arriba, el contrato mandaba a hacer algo ya hecho y el
control era medir el id antes de escribirlo. Acá el id estaba bien medido **cuando se escribió**: lo
que caducó fue el *mecanismo*. ⇒ **releer el color de la celda no alcanza; hay que releer la causa que
la celda cita.** Un veredicto se puede verificar; una causa citada hay que **re-ejercitarla**.

**El barrido que lo caza, y que corrí sobre mis propias 13 filas diferidas:** por cada fila, resolver
su ancla `path:línea` contra `origin/main` y mirar **si el archivo fue tocado después de la fecha de
la fila**. No prueba que la causa esté muerta — marca **candidatas a releer**, que es todo lo que un
barrido barato debe prometer. Resultado: 13/13 anclas resuelven, y **una fila más** con el conteo
vencido (`H-DOSCIERRES`, «puntos 3, 4 y 5 NO cumplidos»). Una tercera (`H-FOCORC1`) tenía el archivo
tocado ese mismo día, la re-medí, y **la causa seguía viva** — el barrido también tiene que poder
absolver, o es un generador de ruido.

Ver [[de-dos-artefactos-con-distinta-precision-gana-el-que-circula]] (eso era propagación; esto es
caducidad) y [[un-inventario-de-procesos-vivos-es-un-snapshot-no-un-estado]].


## Refuerzo 2026-10-08 (b) — el barrido de anclas mide la INTEGRIDAD DE LA CITA, no la VIGENCIA DE LA CAUSA

Arriba quedó escrito el barrido barato («resolver el ancla y mirar si el archivo fue tocado después»)
con la promesa correcta: marca **candidatas a releer**. Lo corrí hoy sobre las **18** filas del doc de
cierre, con control de ceguera que acusa y absuelve. Y después lo afilé: un segundo barrido que no
pregunta si el archivo cambió sino **si la coordenada sigue señalando el mismo texto**
(`git show <commit-de-la-fila>:<path> | sed -n '<N>p'` contra `origin/main`).

**Los dos números, y el segundo mató mi hipótesis:**

| barrido | resultado |
|---|---|
| v1 · ¿el archivo fue tocado después? | **5 señales** (3 🔁releer + 2 ⚠️ancla no resuelve) de 18 filas |
| v2 · ¿la coordenada apunta al mismo texto? | **50 coordenadas medidas · 50 intactas · 0 corridas** |

Yo esperaba que v2 confirmara a v1 —«el acta se editó, así que las líneas se corrieron»— y dio
**cero**. La hipótesis era falsa y la medición la mató en un comando.

**De las 5 señales de v1, sobrevivió 1.** Las otras 4 eran ruido de mi propio instrumento:

- 2 se disparaban porque el archivo tocado era **el propio doc de cierre**, que yo mismo edité 4 veces
  hoy. ⇒ **un barrido cuyo denominador es «¿el archivo cambió?» grita más fuerte justo sobre los
  archivos que más se editan, que son los que menos informan.**
- 1 (`acta:22`) tenía el archivo tocado por un PR ajeno y la **coordenada intacta**.
- 1 marcaba «ancla no resuelve» sobre `coordinacion/PLAN.md:302` — que es **gitignored a propósito**, y
  **la propia fila ya lo explicaba** en su tercera lección. Mi instrumento acusó lo que el texto ya
  decía.

**Y acá está lo que ningún barrido de anclas puede dar, probado contra el caso que ya sabía vencido.**
La fila del punto 4 citaba `smoke_beta_e2e.py:19` («importa `meclaves_check`, así que el import no
resuelve»). Medido hoy: la **línea 19 es idéntica** a la del commit de la fila, el archivo no se tocó,
el import sigue ahí — y la causa estaba **muerta desde el 07/10** (#908 arregló el pipe-por-stdin; lo
que seguía roto era un export de env que faltaba). **Ese caso pasa los dos barridos con luz verde.**

> **Son dos preguntas distintas y la barata no aproxima a la cara.** «¿La cita sigue siendo una cita
> válida?» se contesta con git. «¿El mecanismo que la cita describe sigue produciendo el fallo?» se
> contesta **ejercitándolo**, y nada más lo contesta. Un barrido de anclas verde entero es compatible
> con que **todas** las causas estén vencidas.

**El corolario operativo, que es lo único que cambio en cómo trabajo:** el barrido de anclas queda
como lo que es —un chequeo de higiene de citas, barato, que corro sin ceremonia— y **deja de contar
como re-medición de una fila**. Para declarar una fila viva hace falta re-ejercitar su mecanismo; para
declararla muerta, también. El único hallazgo real del día en este frente no salió del barrido de
vigencia sino de una pregunta más tonta y más útil: **«¿el path existe?»** —
`deploy/copiloto/run-smoke-prod.sh` **no existe en `main`** (el real es `scripts/run-smoke-prod.sh`), y
lo cita el doc de cierre en la fila que afirma que el smoke fallaba por el camino de prod.

Ver [[el-instrumento-tambien-CONDENA-no-solo-absuelve]] (la pregunta más chica contestada con
precisión, tercera instancia del día) y [[vacio-no-es-hallazgo-correr-el-control]].
