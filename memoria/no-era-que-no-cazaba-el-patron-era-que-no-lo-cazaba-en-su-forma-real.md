---
name: no-era-que-no-cazaba-el-patron-era-que-no-lo-cazaba-en-su-forma-real
description: Un escáner puede cazar el secreto SUELTO y escaparlo con su prefijo real. Todo resultado negativo sobre un patrón exige el fixture en la FORMA en que el patrón aparece de verdad.
metadata:
  type: feedback
---

**«El escáner no caza X» casi nunca es el hallazgo. El hallazgo es «no caza X en la FORMA en que X
aparece de verdad».**

**Medido el 2026-10-06** sobre gitleaks en este repo. El mismo valor de alta entropía, suelto, **sí**
lo caza la regla `generic-api-key`. Con su **prefijo real** (`sk-ant-api03-…`) **se escapa**: los
guiones del prefijo y los `:/@` de un DSN **cortan la coincidencia contigua de alta entropía**. O sea
que un fixture "equivalente" daba verde y el secreto real pasaba.

🔑 **Y el segundo hallazgo, que invalidó mi primer par de contraste:** `generic-api-key` **no es sólo
entropía: está puerteada por PALABRA CLAVE.** `CLAVE_SUELTA=<95 chars de alta entropía>` → **0
hallazgos**. `ANTHROPIC_API_KEY=<el mismo valor>` → **cazado**. Mi par movía el prefijo **y** el
nombre de la variable al mismo tiempo, así que era **ininterpretable**: no podía saber cuál de los
dos cambios producía la diferencia. Mismo error metodológico que el hallazgo denuncia, un nivel
arriba.

**Cómo aplicarlo**
- Un par de contraste mueve **UNA** variable. Si moviste dos, el resultado no atribuye nada: no es
  evidencia débil, es **cero** evidencia. → [[dos-causas-suficientes-el-test-no-atribuye]]
- El fixture de un escáner se escribe con la **forma de producción** del secreto: prefijo real,
  nombre de variable real, envoltorio real (DSN, header, `export`). Un valor "equivalente" mide
  otra cosa.
- Y el fixture **no puede contener el patrón contiguo** en el fuente commiteado, o el escáner caza
  su propio test: partir el literal (`'sk-ant-''api03-%s'` vía `printf`).
- Aseverá el **`RuleID`**, no `rc=1`: con `rc`, una regla por defecto que dispare sobre el mismo
  fixture deja el test verde **con tus reglas ausentes** — falso verde en el test que acredita el fix.
- Antes de embarcar una regla nueva, **medí el blast radius**: la mía dio **9 falsos positivos** (se
  bajó a 0 en dos pasos, midiendo el efecto: 9 → 5 → 0). Un guard que grita en el caso normal se
  desarma solo, y el camino de menor resistencia es `--no-verify`, que apaga el gate entero.
  → [[el-guard-que-grita-en-el-caso-normal-se-desarma-solo]]
- Y un allowlist contra `match` **no puede ver más allá del match**: mi regex terminaba en `@`, así
  que `@(localhost|127\.0\.0\.1)` no podía disparar nunca. `regexTarget = "line"` lo arregló.
  → [[instrumento-que-no-mira-nunca-falla]]

---

## ⚠️ REFUERZO 2026-10-11 — el falso 0 tenía la cara EXACTA del hallazgo que el instrumento buscaba

No es sólo cosa de escáneres de secretos. **Medido hoy** sobre el relevamiento mobile: escribí un
instrumento que, por cada ruta de Expo, busca quién la navega, para detectar la clase 🕳️ *«capacidad
completa que nadie alcanza»*. Mi patrón exigía la comilla de cierre **pegada** al literal de la ruta:
`['"`]/legal['"`]`. Reportó que `/legal` era la **única** pantalla con **cero** call-sites.

**Era falso.** El call-site real es `router.push('/legal?kind=tos')` — `PantallaCuenta.tsx:61` y `:66`.
La ruta estaba citada, pero con **query string**: la comilla no venía pegada. El patrón cazaba la
ruta, no su forma real. Corregido (`(?:[?#][^'"`]*)?` antes del cierre), `/legal` da **2**.

🔑 **Lo que lo hace peor que un bug cualquiera: el error se disfrazaba de resultado.** El instrumento
existía para encontrar pantallas inalcanzables, y su defecto **fabricó una**. Un falso cero no se
siente como una falla: se siente como el hallazgo que fuiste a buscar, con su sección en el documento
ya escrita. → [[el-instrumento-tambien-CONDENA-no-solo-absuelve]]

**Y el mismo instrumento, en la misma corrida, falló en el sentido opuesto:** para la raíz `/`, el
literal `['"`]/['"`]` matcheaba cualquier `"/"` del código y daba **136** call-sites. Un cero
inventado y un número inflado, en el mismo script, el mismo día. No era mala suerte: el patrón
genérico es laxo en el caso degenerado y estricto en el caso con parámetros, y ninguno de los dos
extremos avisa.

**Cómo aplicarlo:** un instrumento que busca **ausencias** lleva control positivo **antes** de
publicar un solo cero — una lista de casos que se sabe presentes, verificados a mano con grep, que
él **debe** encontrar. Si alguno da 0, aborta y no publica la columna. Y la lista tiene que incluir
el caso **con la decoración real** (el `?query`, el prefijo, el envoltorio), no sólo el caso limpio;
más un **techo** para el caso degenerado, que es donde sobre-matchea.
→ [[el-control-positivo-cubre-la-mitad-que-sospechas-y-la-otra-queda-muda]]
→ [[un-control-positivo-con-esperado-falso-acusa-al-script]]

---

## ⚠️🔥 REFUERZO 2026-10-11 (2) — el instrumento contó la AFIRMACIÓN como su propia PRUEBA

Tercera trampa del **mismo** instrumento, el mismo día, y la peor: **no distinguía código de
comentario**. En este repo los comentarios citan rutas todo el tiempo para explicar mecánica, así que
produjo **10 call-sites fantasma** — verificados abriendo las diez líneas una por una, las diez
comentarios.

🔑 **El que muerde es `/midia`.** Su **único** «call-site» era `PantallaMiDia.tsx:267`, un docstring
que dice: *«La ruta `/midia` sigue viva porque las tarjetas de actividad y los enlaces internos la
usan»*. O sea que el instrumento **contó la afirmación de alcanzabilidad como la prueba de la
alcanzabilidad**, y convirtió en **1** el único **0** verdadero del mapa. `/midia` es una pantalla de
751 líneas que **nadie alcanza** (lo confirman tres instrumentos independientes y el switch completo
de `destinoActividad.ts:62-79`, sin caso `/midia`), y el código **afirma lo contrario** en dos
docstrings. Publiqué «20 de 21, cero candidatas a 🕳️». Era **19 de 21**.

🔑 **Y acá está la asimetría que importa, porque decide cuál de los dos errores te vas a comer.** El
mismo instrumento primero **fabricó** un hallazgo (`/legal`, refuerzo anterior) y después **tapó**
uno real. El falso positivo es **mucho más difícil de notar**, y no por ser más sutil: **un 0 te
obliga a mirar; un 1 te autoriza a seguir.** El falso 1 no se lee como un error — se lee como la
redundancia que uno *quiere* encontrar (*«tranquilo, hay dos caminos»*). Por eso el falso cero se
caza y el falso uno sobrevive hasta el documento.

**Cómo aplicarlo**
- Un instrumento que grepea **código** enmascara comentarios **antes** de contar. Y no con un regex:
  `'https://x'` y `// ver /gastos` se parecen demasiado, así que hay que recorrer con estado de
  comilla — equivocarse hacia el otro lado reintroduce el falso cero del refuerzo anterior.
- **El control positivo NO alcanza acá, y es el punto fino:** los call-sites reales se encuentran
  igual con la máscara **apagada**, así que el verde de los positivos **absuelve** a una máscara
  inactiva. Hace falta un **control NEGATIVO**: las líneas-comentario verificadas a mano, que el
  instrumento **no puede** reportar. Sin él, «la máscara funciona» y «la máscara no está» son
  indistinguibles. → [[un-mecanismo-roto-hacia-el-no-no-da-sintoma]]
- Y la regla general del día: **ningún gate lee comentarios, y ningún lector los trata como
  medición.** Cinco hallazgos distintos de ese relevamiento resultaron ser la misma falla — el
  comentario usado como fuente, envejecido, sin nada que lo mida.
  → [[el-comentario-que-declara-una-proteccion-desactiva-la-busqueda-del-proximo]]
  → [[el-guard-se-satisface-con-su-propio-comentario]]

---

## Refuerzo 2026-10-13 · tres veces en un día, y una de ellas salió del repo como «no lo implementes»

Midiendo el prototipo contra la app, el mismo modo de fallar apareció **tres veces en una sesión**, y
siempre con el control positivo **en verde**:

| lo que busqué | lo que el prototipo escribe | consecuencia si cerraba ahí |
|---|---|---|
| `avatar` | `class="quien"` + `ISO26` (`index.html:3191`) | **ya había salido**: declaré «el prototipo tampoco tiene avatar del asistente», veredicto FUERA-DE-REFERENCIA y **«no lo implementes»** en un `contrato_` que frontend1 tomó |
| `Buscar` | **`Buscá`** un cliente, o hablá… (`:2241`) | un segundo FUERA-DE-REFERENCIA falso: la divergencia desaparecía del tablero con mi firma |
| `Compartir`/`Abrir` | nada — ése sí era 0 real | el veredicto correcto, y por eso los otros dos parecían del mismo tipo |

**Lo nuevo, y es el punto fino:** mis controles positivos estaban **vivos** en los tres casos — 65 hits
de `input|placeholder`, 30 de `cliente`, 12 de `avatar`. No sirvieron, y no por mala suerte: **un control
positivo mide que mi patrón encuentra cosas; no puede revelar que el sujeto se llama de otra manera.**
Es la mitad ciega descrita en [[el-control-positivo-cubre-la-mitad-que-sospechas-y-la-otra-queda-muda]],
pero con una forma propia: ahí el riesgo es un instrumento que no mira; acá el instrumento mira perfecto
y **el sujeto tiene otro nombre**. `avatar` tenía 12 hits: el control positivo me dijo «el patrón
funciona» y **tenía razón** — lo que no existía era la relación entre ese patrón y el elemento.

**Cómo aplicarlo** — para una afirmación del tipo *«la referencia no tiene X»*:
- **Buscá el ROL, no el nombre.** El avatar del asistente no se busca por `avatar`: se busca
  **el generador del mensaje del asistente** y se lee qué pinta. En el prototipo eso fue encontrar
  `const O = t => ...` — un helper canónico, no una clase. El rol tiene un solo dueño; el nombre, N.
- **Variá la forma antes de concluir el vacío.** En es-AR, el imperativo vosea: `Buscá`/`Buscar`,
  `Mirá`/`Mirar`, `Hablá`/`Hablar`. Un `0` sobre un verbo en infinitivo no es un `0`.
- **Un `0` que CIERRA una fila necesita más que control positivo**: necesita que alguien nombre
  explícitamente *qué forma tendría el elemento si existiera*. Si no podés escribir esa forma, no
  podés afirmar el vacío. → [[supuesto-cuya-falla-parece-un-estado-legitimo]]
- Y el costo asimétrico: un falso **0** aquí no deja deuda visible — **borra** una divergencia real
  del tablero y la firma una sesión con autoridad para decidirlo.
  → [[el-instrumento-tambien-CONDENA-no-solo-absuelve]]

---

## Refuerzo 2026-10-13 — el caso límite: **medí el nombre que yo mismo había inventado**

Diseñé una pieza (`origenPuente`, para llevar la identidad de la tarjeta al chat), busqué
`origenPuente` en `apps/` + `packages/`, dio **0 hits**, puse control positivo (vivo), y bajé un
contrato pidiendo construirla. **El `0` era una tautología:** nadie escribe un nombre que acabo de
acuñar yo. El portador del rol existía y se llamaba `AvisoAlChat = {texto, contexto}` — sólo le
faltaba un campo. Lo encontró otra sesión, no mi búsqueda.

Por qué este caso es peor que el de `Buscar`/`Buscá`: ahí el falso `0` **borraba** una divergencia
real. Acá el falso `0` **manda a construir lo que ya existe**, que es el fallo que CANON 3 (reutilizar)
está escrito para evitar — y encima el control positivo **no puede delatarlo**: prueba que mi patrón
caza algo, no que el sujeto tenga otro nombre.

**Cómo aplicarlo, en una línea:** un `0 hits` sobre un identificador **que yo propuse** no es
evidencia de nada — es un espejo. Antes de pedir que se construya una pieza, buscá el **rol**
(*«¿qué lleva hoy el dato del punto A al punto B?»*), no el nombre de tu solución. Y si el rol no
aparece, nombrá qué forma tendría si existiera **antes** de firmar el vacío.
→ [[el-fix-ya-existe-en-otro-call-site]] · [[el-control-positivo-cubre-la-mitad-que-sospechas-y-la-otra-queda-muda]]
