---
name: el-guard-se-satisface-con-su-propio-comentario
description: Escribí un guard que exigía `min-height: 0` en el CSS y pasaba con la declaración BORRADA — el comentario que explicaba por qué hacía falta contenía la misma cadena que el regex buscaba
metadata:
  type: feedback
---

**LEER al escribir cualquier guard que matchee TEXTO de un archivo** (regex sobre CSS, YAML, SQL,
Dockerfile, config) — que es la forma más barata y más común de guard, y por eso la que más se escribe
sin control.

2026-08-06, fix del scroll del rail. Agregué a `desktop.css` dos declaraciones —`overflow-y: auto` y
`min-height: 0`— y un guard (`railScroll.test.ts`) para que nadie las borre "limpiando", porque su
ausencia **no da síntoma** mientras los ítems entren en la ventana.

El guard:

```ts
const bloque = desktopCss.match(/\.rail__items\s*\{([^}]*)\}/)?.[1] ?? '';
expect(bloque).toMatch(/min-height:\s*0/);
```

Corrí el control diferencial —borrar la línea y exigir rojo— y **el test pasó igual**. La causa está
en el mismo bloque que el guard inspecciona:

```css
.rail__items {
  /* El `min-height:0` NO es opcional: un hijo flex no se encoge bajo su contenido sin esto. */
  overflow-y: auto;
  min-height: 0;      /* ← borrá esta línea: el comentario de arriba sigue matcheando */
}
```

**El comentario que explica por qué la declaración es imprescindible contiene la declaración.** Y no
es casualidad: un buen comentario **cita** aquello que documenta. Cuanto mejor escrito está el
comentario, más seguro es que el guard se vuelva mudo — el incentivo va exactamente al revés del que
uno esperaría.

## Por qué no lo caza la lectura

Releí ese test antes de correr el diferencial y lo di por bueno. El regex es correcto, el bloque
extraído es correcto, el mensaje de error es correcto. Todo lo que se puede auditar *mirando* estaba
bien. Lo único que fallaba era **el conjunto sobre el que buscaba**, y eso no se ve: se mide.

Y el fallo es en la dirección silenciosa — [[un-mecanismo-roto-hacia-el-no-no-da-sintoma]]. Un guard
que nunca puede fallar convive para siempre con el código: pasa en cada CI, aparece en la lista de
tests verdes, y su nombre en el reporte **afirma** que la propiedad está vigilada. Es
[[instrumentos-que-confirman-en-vez-de-verificar]] en el caso más incómodo: un instrumento que yo
mismo acababa de escribir *sabiendo* de esa clase de trampa.

## La regla

1. **Todo guard de texto descarta comentarios antes de matchear.** Una línea:
   `css.replace(/\/\*[\s\S]*?\*\//g, '')` (o `#…` / `//…` según el lenguaje).
2. **El diferencial es parte de escribir el guard, no un paso posterior opcional.** Borrá lo que
   vigila y exigí rojo — en *cada* dirección que el guard dice cubrir, no en una de muestra. Acá
   fueron tres: sin `min-height` → rojo · sin `overflow-y` → rojo · intacto → verde.
3. La pregunta que lo destapa antes de correrlo: **¿de qué otro lugar del archivo podría salir este
   match?** Docstrings, comentarios, strings, el nombre del propio test, fixtures.

Hermana de [[vacio-no-es-hallazgo-correr-el-control]] (allá el control positivo prueba que el
instrumento *ve*; acá el diferencial prueba que además *discrimina*) y de
[[el-instrumento-tambien-CONDENA-no-solo-absuelve]].

## Reincidencia del 2026-09-29: tres veces en un día, y la forma generalizada

Tener esta entrada escrita **no alcanzó**. Reincidí tres veces el mismo día, y las tres con un disfraz
distinto — por eso vale generalizar la regla en vez de sumar casos:

1. Un control negativo buscaba `docs = {"lote_A"` en el texto para probar que el patrón ya no estaba…
   y **el comentario que documentaba el cambio contenía la cadena**. Verde por su propia prosa.
2. Un check de idempotencia preguntaba `if REAL in t` — y el basename **ya vivía en otra lista del
   mismo archivo**, por un motivo legítimo y distinto. Dio «ya aplicado» sin haber aplicado nada.
3. Una clave de excepción la escribí **adivinando el basename de una tabla que lo mostraba truncado
   a 66 chars**. Ésa la cazó el gate nuevo en su primera corrida (ver
   [[el-guard-que-caza-a-su-propio-autor]]).

**La forma generalizada:** preguntar «¿aparece esta cadena?» casi nunca es la pregunta. La pregunta es
**«¿aparece en el ROL que me importa?»** — como código y no como comentario, dentro de *este* dict y no
de otro, escrito y no citado. El match por presencia contesta sí por el motivo equivocado, y contesta
rápido, que es lo que lo hace pasar.

Operativamente: acotá el sujeto **antes** de buscar (partir el archivo por el bloque que te interesa,
descartar comentarios, exigir el indent del contexto), y el ancla llevá el salto de línea y la sangría
de su rol (`'\n    docs = {'`, no `'docs = {'`). Ídem
[[contar-un-simbolo-no-dice-en-que-rol-aparece]] y [[el-instrumento-respondio-sobre-otro-sujeto]].

---

## (2026-09-30) El parser leyó **su propia salida**, transcrita en el documento, como declaración de entrada

El registro de vigencia lleva adentro, en prosa, **el reporte que el script imprime** (para que un humano
vea qué mide). Una de esas líneas transcritas es `ALCANCE: 3 de 4 relaciones son PARCIALES…`. El bloque de
datos no tenía delimitador de cierre, así que el último quedaba abierto hasta EOF y **absorbía esa línea
como si fuera su campo**: el `ALCANCE: total` real se perdió y el control «toda relación declara ALCANCE»
**pasó igual, satisfecho con basura**. Fail-open perfecto: el campo existía, con el valor de otra cosa.

Con 4 bloques no daba síntoma —a cada uno lo seguía otro encabezado, que lo cerraba por accidente—. Lo
destapó el quinto ([[un-mecanismo-roto-hacia-el-no-no-da-sintoma]]).

**Y su gemelo, por el lado opuesto:** la **plantilla del propio documento** mostraba el encabezado *dentro*
del fence. Escribí el bloque nuevo copiando mi plantilla, y el parser **no leyó sus campos: la relación
desapareció del reporte sin un solo error**. Un instrumento que pierde una declaración verdadera en
silencio es peor que uno que acepta basura: la basura se ve en la salida.

**Cómo aplicar:** si el documento que tu instrumento lee **contiene ejemplos o salidas del instrumento**
—docs autodescriptivos, READMEs con su propio output, plantillas—, (1) delimitá explícitamente la zona de
datos y **cerrala** (acá: los campos sólo cuentan dentro del fence, y el fence cierra el bloque); (2) exigí
que **todo encabezado produzca un registro** (control de mudez, `exit 9`); (3) revisá que la plantilla que
publicás sea **aceptada por tu propio parser** — la mía no lo era.

## (2026-10-06) El control positivo buscó la frase que mi propia RETRACCIÓN tiene que citar

Parcheé una fila del tablero para retirar un anti-patrón: decía «falta que el operador lo mergee» y
había que sacarlo. Horneé el control positivo en el script: *la frase vieja debe quedar en **0**
apariciones*. Dio **1**, y lo leí como parche incompleto: busqué una segunda fila, medí duplicados,
revisé si había parcheado una copia fuera de la cola viva.

**No había nada que arreglar.** La aparición que quedaba estaba **dentro de mi propio texto nuevo**:
*«Acá decía «falta que el operador lo mergee», y eso es exactamente el anti-patrón…»*. Una retracción
bien escrita **tiene que citar lo que retracta** — si no, nadie puede verificar qué se retiró. O sea el
esperado `0` era **imposible por construcción**: el parche correcto garantiza ≥1.

Es el espejo en prosa de esta entrada: no es que el guard se satisfaga con su comentario, es que **se
acusa a sí mismo por su propia cita**. Y el esperado lo **escribí yo**, no lo midió nadie
([[un-control-positivo-con-esperado-falso-acusa-al-script]]).

**La pregunta que lo separa, antes de hornear el número:** *¿el fix correcto puede hacer que esta
cuenta llegue a 0?* Si el fix **documenta** lo que quita —retracciones, deprecaciones, changelogs,
comentarios que explican por qué algo ya no se hace—, la respuesta es no.

**Cómo escribirlo bien:** el control no cuenta la frase, cuenta la frase **en rol de afirmación
vigente**: exigir el marcador nuevo presente (eso sí es 0→1 y sólo existe después del parche) y acotar
la cuenta de la vieja a las apariciones **fuera** del contexto de cita. El costo de equivocarse acá no
es un parche mal hecho: es gastar la verificación persiguiendo un fantasma, con la mitad del riesgo de
«arreglar» un archivo que estaba bien.

---

**Refuerzo (2026-10-06): el caso extremo — el comentario no exagera la defensa, la INVENTA, y está parado
justo donde alguien iría a buscarla.** `scripts/ci/lint.sh:11` dice *«repo PÚBLICO — cero secretos en TODA la
historia (gitleaks fijado)»* y la línea siguiente, `:13`, corre `secretos-check.sh **--arbol**`. `--arbol` y
`--historia` son modos distintos del mismo script: uno mira el working tree, el otro recorre los commits.
Grep sobre `.githooks/`, `scripts/ci/` y `.github/`: **`--historia` no tiene ningún llamador automático** — y
la única línea que dice que sí, miente, con un *«Fail-closed:»* en el renglón de abajo que la hace sonar
mecanizada. ⚠️ **La conclusión que saqué de ahí —«ningún gate mira la historia»— era demasiado fuerte, y está
corregida al final de este refuerzo: el grep midió la BANDERA, no la CAPACIDAD.**

**Por qué es peor que un hueco sin comentario:** un secreto commiteado y después borrado **sale del árbol y
queda en la historia para siempre** — exactamente el caso que el `CLAUDE.md` nombra en su cabecera y el único
que `--arbol` no puede ver. Y el que se pregunte *«¿quién vigila la historia?»* llega a `lint.sh:11`, lee
«TODA la historia» y **deja de buscar**. El comentario no sólo no protege: **desactiva la búsqueda del
próximo**, que es la misma mecánica por la que un veredicto «coherente» desactiva trabajo
([[nadie-audita-un-coherente-y-es-el-veredicto-que-desactiva-trabajo]]).

Tercera aparición del día del productor que declara una protección que no da. Las dos primeras las cubría el
**consumidor** (`recibo-cubre.sh` tapando a `gate.sh:40-41`; `ci-verde.sh` tapando a `no-drift.sh`); **esta no
la cubre nadie.** ⇒ La gradación importa al leer un comentario de guard: *¿la defensa existe acá · existe en
otra capa · o no existe?* Las tres se escriben igual.

**Y el matiz del fix, que es el que evita el reflejo:** la respuesta **no** es mecanizar lo que el comentario
promete. Un `--historia` dentro del job `lint` que encuentre algo **preexistente** deja **rojo permanente sin
acción posible** —un hallazgo histórico no se arregla sin reescribir la historia— y se desarma en dos días,
arrastrando al `--arbol`, que sí sirve ([[el-guard-que-grita-en-el-caso-normal-se-desarma-solo]]). Primero
**que la línea diga lo que hace** y nombre dónde vive la otra mitad y quién la corre a mano; después, si se
quiere la garantía, **fuera del camino del PR** y con la pregunta contestada antes de encenderlo: *ante un
hallazgo histórico, ¿rewrite o rotar-y-declarar?*

**How to apply:** (1) al leer un comentario que declara una garantía, **leé el comando de la línea de abajo**
— el verbo y la **bandera**, porque el modo es donde se separan el árbol y la historia; (2) para cada
protección declarada preguntá *¿quién la provee: este archivo, otro, o nadie?* y escribilo al lado; (3) un
comentario honesto («esto mira el árbol; la historia se audita a mano, dueño X») vale **más** que el gate
ausente, porque deja de apagar la próxima pregunta; (4) antes de mecanizar una garantía retroactiva, preguntá
qué se hace con los hallazgos que ya existen: sin respuesta, el gate nace rojo y muere saltado.

**Corrección del mismo día, y el error es el que estaba auditando: grepeé la BANDERA, no la CAPACIDAD.** De
«`--historia` no tiene llamador» concluí «nadie mira la historia». Falso. El `pre-push` **sí** escanea la
historia: `.githooks/pre-push:15` llama `secretos-check.sh --refs-stdin`, que en `:115-120` arma el rango
(`$lsha --not --remotes` para una rama nueva) y lo pasa por **`gitleaks git --log-opts`** — el **mismo modo**
que `--historia`, con otra bandera (`:92-95`). Lo vi en mi propio push de ese día: `1 commits scanned`. El
hecho del hallazgo sobrevive —el comentario prometía la historia y el comando mira el árbol— pero su
**magnitud** se degrada: lo que no existe es un llamador de la **historia COMPLETA**, no la cobertura
([[una-observacion-no-reproducida-se-degrada-a-observacion-no-se-retira]]). Medido: **1018 de 2394 commits
(43%) son anteriores al hook** (lo instaló #601 el 2026-09-21), los **281** posteriores se escanearon al entrar
pero **con las reglas de su día**, y la única pasada de la historia completa con las reglas de hoy fue **a
mano**. Y buscando la cifra repetí el error un nivel más abajo: el pickaxe `-S'secretos-check.sh --refs-stdin'`
dio **0 commits** porque la línea real lleva comillas en medio (`"$SCRIPT_DIR/scripts/secretos-check.sh"
--refs-stdin`) — vacío que sólo se delató con el control positivo `-S'secretos-check.sh'` → 1
([[medir-contra-un-ref-que-no-existe-da-vacio-y-vacio-se-parsea-como-cero]]).

**How to apply (5):** cuando un grep por un nombre te dé 0 y estés por concluir que **la capacidad no existe**,
listá primero **cómo más podría proveerse** y grepeá eso: acá era el modo de la herramienta
(`gitleaks git --log-opts`), no la bandera del wrapper. Un ausente **nombrado** es evidencia débil
([[el-universo-externo-del-instrumento-tiene-su-propio-denominador-incompleto]]); y si la conclusión es «nadie
hace X», la forma de medirla es por el **efecto** —correr el camino real y ver qué escanea— no por el
inventario de llamadores.
**Refuerzo 2026-10-06 — la variante que más duele: el guard de IDEMPOTENCIA medido contra el ARCHIVO
en vez de contra su TARGET.** Un script que corrige **una fila** de un tablero abrió con
`if "REFUTADA POR MEDICI" in s:` sobre el archivo **entero**. La frase existía en **otra fila**
(`UNDOCUMENTO`, L357, de otro día) ⇒ el script imprimió **«ya corregida (idempotente)»** y
**no hizo nada**. La corrección quedó sin aplicar y el reporte decía que estaba hecha.

🔑 **Por qué es peor que fallar:** un error hubiera gritado. Un guard de idempotencia que acierta
de más **produce un verde**, y el verde se parece exactamente al trabajo hecho. Lo cazó un control
por **efecto** (`grep -c` de la conclusión vieja), no el exit code — que fue 0 en los dos mundos.

**Cómo aplicarlo**
- El marcador de idempotencia se busca **en el renglón/bloque que vas a modificar**, nunca en el
  archivo: `if MARCA in lineas[i]`, no `if MARCA in s`.
- Y el control del resultado se hace sobre lo que tenía que **desaparecer**, no sobre lo que tenía
  que aparecer: el texto nuevo suele **citar** al viejo para refutarlo, así que un `grep` de la
  frase vieja da 1 en los dos casos. Elegií una cadena que sólo exista en la versión vieja.
  → [[el-control-positivo-cubre-la-mitad-que-sospechas-y-la-otra-queda-muda]]

---

## 📅 2026-10-07 — tres instancias en un día: dejó de ser un caso y es una CLASE

Tres instrumentos distintos, el mismo defecto, en una sola jornada. Lo que cambia la lectura no es que
pasó tres veces: es que **ninguna de las tres se parecía a las otras mientras la escribía**.

| instrumento | qué leyó del comentario | cómo se veía el falso |
|---|---|---|
| `barrido-superficie-front-backend.py` | la palabra `opcionales` dentro de un `// …se leen igual, opcionales: cuando…` en el genérico de `/afip/estado` | un `DIFIERE` contra un handler **sano** |
| caso 4 de `test-stage-backend-cubre-los-paths-de-pytest.sh` | el `--exclude='.env*'` **del comentario que explicaba el flag** | el **mutante salía VERDE**: sacar el flag del `tar` no movía el veredicto |
| guard del caso 2 del mismo test | `deploy/copiloto/test_meclaves_check.py`, citado en los comentarios de `sync-test-backend.sh` | el guard creía que el mutante **había mutado** cuando no mutó nada |

🔑 **La forma general: cuando un instrumento parsea código fuente, su universo incluye la prosa que
describe lo que busca** — y esa prosa es el lugar donde el término aparece *más* veces y *mejor*
escrito, porque fue puesta ahí justamente para explicarlo. El autor del comentario y el autor del
parser son la misma persona en el mismo rato, así que el comentario usa el mismo vocabulario exacto
que el regex. **Es el falso positivo mejor correlacionado que existe.**

⚠️ **Y la variante que más engaña es la del MUTANTE**, porque invierte el signo: no acusa a un inocente,
**absuelve al culpable**. Un mutante que no muta sale verde y se lee como «el control pasó». El caso 4
tenía el flag, el comentario que lo explicaba, y el mutante que lo quitaba del comando — y seguía verde
porque leía el comentario. Un control positivo que no discrimina **acredita al defecto que no mira**.

**Cómo aplicarlo**
- Todo parser de código declara su **universo** antes de buscar: el bloque del comando, el cuerpo de la
  función, el genérico — nunca «el archivo».
- Quitar comentarios es parte del parseo, no una higiene opcional. **Y el orden importa en los dos
  sentidos:** limpiar *después* de colapsar los saltos borra el bloque entero (`//[^\n]*` sobre una
  sola línea se come todo lo que sigue); limpiar *antes* es lo correcto.
- El mutante lleva su **propio guard**: medir que mutó, contra el universo del comando y no contra el
  archivo. Un `grep` del archivo entero para «¿mutó?» reproduce el bug dentro del control del bug.
- Y el guard del mutante tiene que sobrevivir a que cambie la **forma** de lo que muta: el del caso 2
  borraba líneas del allowlist por archivos nombrados y quedó mudo cuando el allowlist pasó a ser un
  directorio. → [[un-control-positivo-con-esperado-falso-acusa-al-script]]
