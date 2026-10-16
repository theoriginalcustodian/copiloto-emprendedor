---
name: la-capa-de-lectura-normalizo-el-sujeto-antes-de-medirlo
description: El medidor del índice de memoria pasó de chars a bytes y siguió midiendo 183 de menos, porque read_text traduce CRLF a LF antes de que el control pueda ver los bytes — absolvía un índice 108 bytes pasado del techo
metadata:
  type: feedback
---

# 📐🫥 La capa de LECTURA normalizó el sujeto ANTES de medirlo

`medir-indice-memoria.py` existe por una falla concreta: medía el índice en **caracteres** y absolvió
uno que en disco pesaba **1.210 bytes más que el techo**. Se corrigió a bytes, con un comentario largo
explicando por qué los bytes son la unidad. Y siguió ciego.

```python
texto = indice.read_text(encoding="utf-8")   # modo texto: CRLF -> LF, universal newlines
peso   = len(texto.encode("utf-8"))          # re-encodea con \n: los \r nunca existieron
```

**Medido 2026-10-12 sobre `main`:** archivo en disco **24.108 bytes**, techo **24.000**. El control
imprimía `23925 / 24000 [⚠️ ]` y salía **exit 0**. Estaba absolviendo un índice que se truncaba — la
falla exacta para la que se construyó. En Windows es **1 byte invisible por línea**: 183 líneas, 183
bytes.

**Why:** el arreglo anterior cambió la **unidad** (chars → bytes) y dio por cerrado el problema, pero
el defecto no era la unidad: era **sobre qué sujeto** se aplicaba. `read_text` devuelve una
representación que una capa intermedia ya transformó, y medir bytes de una representación normalizada
no es medir el archivo. La unidad correcta sobre el sujeto equivocado da el mismo falso verde que la
unidad equivocada. Espejo de [[un-escape-que-pasa-por-una-capa-extra-llega-como-byte-invisible]]: ahí
la capa transforma al **salir** hacia el disco, acá al **entrar**.

**How to apply:** un control que mide una propiedad **física** del archivo lo abre en binario
(`read_bytes`), no en modo texto. Y el control de ceguera no se escribe comparando dos constantes
—eso no toca el camino de medición, es [[instrumento-que-no-mira-nunca-falla]]—: se escribe midiendo
**el sujeto real por los dos caminos** y exigiendo que difieran cuando deben diferir. El que quedó:

```python
if b"\r\n" in crudo and len(crudo) == len(indice.read_text(encoding="utf-8").encode("utf-8")):
    # tiene CRLF y las dos cifras coinciden -> alguna capa normaliza -> ciego
```

Ahora imprime la brecha en cada corrida (`bytes de DISCO (23024) — modo texto habría dicho 22849, 175
menos`), así que la ceguera no puede volver callada.

## Refuerzo 2026-10-13 — CRLF: lo mismo dos veces en un día, y la segunda me hizo afirmar «está adelante»

Dos golpes el mismo día, los dos por comparar un archivo del **working tree** (CRLF, Windows) contra algo
que git entrega **normalizado a LF**:

1. **`git hash-object` del archivo vs la huella que el instrumento imprime de sí mismo.** Dieron distinto
   (`8bd168ea33b2` vs `6ffdc68720a1`) y afirmé que el instrumento **había cambiado de versión** — o sea,
   metí una segunda variable en una medición donde la cifra no se había movido. Era el CRLF.
2. **`wc -c` del archivo vs `wc -c` del blob de `origin/main`.** `MEMORY.md` dio 23779 contra 23600 y
   concluí «wt-roles va **adelante** de main». La diferencia era **179 bytes = exactamente 179 líneas**: un
   `\r` por línea. El contenido era **idéntico**. Si hubiera editado con esa conclusión, habría tratado como
   «mío y nuevo» un archivo que no lo era — justo el error de signo que ya costó caro en el checkout
   compartido ([[base-rancia-invierte-la-direccion-del-diff]]).

**La pista barata que delata el caso:** si el delta de bytes **es igual al número de líneas**, no estás
midiendo contenido, estás midiendo terminadores.

**Cómo medir sin la capa:** con **la misma herramienta en los dos lados**. `git diff --stat <ref> -- <path>`
(git normaliza los dos lados), o `git hash-object` contra `git rev-parse <ref>:<path>` —nunca uno de cada— o
leer los dos en Python en modo texto. Y para un techo de bytes, **el instrumento oficial y nada más**:
`medir-indice-memoria.py` cuenta LF (23604) y mi `wc -c` contaba 23784. La regla de
[[un-criterio-que-crece-con-cada-medicion-no-se-puede-alcanzar]] aplica igual acá: **un solo lugar mide**.

---

## Refuerzo 2026-10-13 · esta vez el instrumento tenía razón y la cifra que publiqué era mía, en la unidad equivocada

Reincidí, pero **al revés** que en el caso original: no fue `wc -c` contra el medidor — fue **yo citando
una cifra que el medidor no dio**.

Commiteé `memoria/MEMORY.md` declarando **«23931 de 24000 bytes, 69 de margen»** y lo puse en el mensaje
del commit. Horas después, el mismo medidor sobre el mismo contenido:

```
[OK ] unidad: bytes de DISCO (24111) — la lectura en modo texto habría dicho 23931, 180 menos (CRLF)
[MAL] presupuesto: 24111 / 24000 bytes
FALLA: el índice se pasa 111 bytes
```

**El índice estaba 111 bytes PASADO el techo** —truncándose en cada sesión— y yo había firmado que tenía
margen. Las dos cifras son del mismo archivo: 23931 es el **blob** (LF) y 24111 es el **archivo en
disco** de cualquier checkout Windows, donde `core.autocrlf=true` suma 1 byte por línea. El techo existe
porque la sesión carga el archivo **de disco**: la unidad correcta nunca fue discutible.

**Por qué el verde fue creíble:** corrí el medidor sobre el archivo **que yo acababa de escribir** con
`newline=""` — LF, todavía sin pasar por git. Un archivo recién escrito por mí **no es** el archivo que
la próxima sesión va a leer. El instrumento midió bien lo que le di; lo que le di no era el sujeto.
→ [[el-instrumento-respondio-sobre-otro-sujeto]]

**Y una línea de este archivo quedó rancia:** más arriba dice *«`medir-indice-memoria.py` cuenta LF»*.
Hoy **no**: imprime los bytes de DISCO y además nombra la alternativa en modo texto, justo para que
nadie confunda las dos. La prescripción («el instrumento oficial y nada más») era correcta y fue lo que
desobedecí: cité **mi** cifra, no la suya. → [[un-criterio-que-crece-con-cada-medicion-no-se-puede-alcanzar]]

**Cómo se cerró, de raíz y no con una poda:** `.gitattributes` ahora lleva `memoria/*.md text eol=lf`,
al lado de las reglas que ya existían para `*.sh`. Con eso el archivo en disco **es** el blob en todas
las máquinas, el peaje de 180 bytes desaparece y la cifra del medidor deja de depender del checkout.
Verificado por mecanismo (`git check-attr eol -- memoria/MEMORY.md` → `lf`) y por efecto (23777 de
24000, rc 0). Podar 111 bytes habría dejado la causa viva y el próximo puntero la vuelve a pagar.


---

## Refuerzo 2026-10-15 — el EJE que la clave distinguía, colapsado DOS veces en el mismo archivo

Mismo patrón, otro instrumento, y la segunda vez **justo después** de arreglar la primera.

`contar-veredictos.py` cruza veredictos para cazar contradicciones. La clave de su corpus es
`id·camino·plataforma` (`:2501`, disponible desde `515d50f6`) — o sea **ya distingue tres ejes**. Pero:

1. **Eje `plataforma`, colapsado en la lectura.** `veredictos_por_id` hacía `clave.split("·")[0]` y
   tiraba los otros dos. Resultado: **9 ids** (`afip apar bi-refresh clientes detalle hablar hitl
   presu reveal`) reportados como contradicción siendo **web-`COHERENTE` vs mobile-`DESVÍO`** — o sea
   acuerdo entre dos plataformas distintas. Arreglado de raíz en `6f978ba5` (#1269): conflictos
   vigentes **13 → 4**, cifras idénticas, y los 4 que sobreviven son **intra-web**, el control positivo.

2. **Eje `dimensión`, colapsado en el PARSEO — y lo encontré re-leyendo el reporte del propio fix.**
   El brazo `tabla-partida` captura pares `(etiqueta, veredicto)` con `PARTIDA` (`:704-710`) y después
   hace `hits.append((n, v, "tabla-partida", corr))` (`:1335`): **`et` se descarta en la línea
   siguiente a capturarlo.** Por eso 3 ids (`esc`, `factura`, `soporte`) se reportan como documento
   «que se contradice A SÍ MISMO», cuando su fila dice literalmente
   `PARTIDO: contenido=COHERENTE · componente=DESVÍO` y su columna de veredicto dice `partido`
   (`2026-09-29_cierre_frontend1-…_B1-13-ids-superficie-y-dimension.md:44-46`).

**Lo que hace al #2 peor que al #1:** el reporte cierra con *«se le pide al autor que lo separe por
dimensión»* — y el autor **ya lo separó**, en la celda, con el rótulo y todo. Un instrumento que pide
trabajo ya hecho no sólo mide mal: **fabrica trabajo en otra sesión**, y lo hace con la autoridad de
un gate. → [[el-instrumento-tambien-CONDENA-no-solo-absuelve]] · [[un-control-positivo-con-esperado-falso-acusa-al-script]]

**La trampa fina, y es la mejor parte:** el docstring de
`conflictos_internos_de_un_documento` (`:1853`) ya decidió **a propósito** no separar por el rótulo
«PARTIDO», *«eso ataría el instrumento a una palabra que un autor puede no escribir. Se separa por la
ESTRUCTURA del dato, que siempre está»*. El razonamiento es correcto **y la estructura existe**: los
pares `contenido=X · componente=Y` son estructura, no una palabra suelta. La decisión bien fundada de
no usar el rótulo **tapó** que había un camino estructural disponible, y el comentario que explica por
qué no se hizo lo barato apagó la búsqueda de lo correcto. → [[el-comentario-que-declara-una-proteccion-desactiva-la-busqueda-del-proximo]]

**El test que caza la clase, y sirve para los dos:** por cada eje que la clave del corpus distingue,
preguntar *¿la función que decide vuelve a verlo, o lo colapsó una capa antes?* Grep concreto:
`split(SEP)[0]` y cualquier `append` que reciba menos campos de los que la línea de arriba capturó.
Ninguno de los dos defectos se ve en el resultado —las cifras eran correctas— sólo en el **ámbito**
sobre el que se decide.

**Estado (declarado, no silenciado):** el #2 queda **medido y sin arreglar**. No mueve ninguna cifra
del sprint, y propagar `et` hasta el contraste toca 5 desempaques `for n, v, f, c in hits`
(`:1596 :1750 :2436 :2478` + comprensiones por índice), o sea no es el cambio de una línea que
parece. **Dueño: planificación. Disparador: el primer PR que vuelva a tocar el contraste** — no antes,
porque la regla del goal manda escribir el hallazgo y seguir, no abrir un PR fuera del sujeto
(forense 08/10: 64 PRs en un día, 4 del backlog firmado). → [[la-cita-de-procedencia-muere-en-el-merge]]
