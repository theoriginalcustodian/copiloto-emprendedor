# Criterio 3 — el `CONTRASTE: 13` y el heading que no cierra

> **De dónde salió.** Al republicar los 54 (`2026-09-30-criterio3-los-54-republicados-sobre-el-sha-medido.md`)
> quedó vivo lo único que no es de alfabeto: **13 ids con veredictos incompatibles entre documentos**.
> Este documento los tría. **Resultado: ninguno de los 13 es un desacuerdo entre mediciones
> equivalentes.** Se reparten en dos causas, y una de las dos es del instrumento.

## 0 · La taxonomía, medida

| clase | ids | qué es | requiere re-medir |
|---|---|---|---|
| **A — sucesión temporal** | 9 · `bi` `card` `card-cliente` `card-cobro` `card-presu` `comousar` `cuenta` `detalle` `preg` | el barrido del **22/09** dio `COHERENTE` **sin declarar plataforma ni dimensión**; la re-medición del **28-29/09** declaró las dos y dio `DESVÍO`. El eslabón del medio (`REQUIERE_TRIAGE`, `INCOMPLETO`, `FUERA-DE-REFERENCIA`) está escrito. | **No.** Falta la **marca de superación**, no la medición |
| **B — atribución del parser** | 4 · `esc` `factura` `ingresar` `soporte` | el parser cuenta el **heading de la sección de desglose** como una medición **nueva**, así que el documento aparece contradiciéndose consigo mismo **cuando está desglosando** | **No.** Es defecto del lector |

**Cero** de los 13 necesita volver a medirse. Eso mueve la fila de «13 pantallas a re-medir» a «una
marca de vocabulario + un fix de parser».

## 1 · Clase B, el caso que lo prueba: `ingresar` arrastra el `DESVÍO` de `factura`

En `2026-09-29_cierre_frontend1-a-planificacion_B1-13-ids-superficie-y-dimension.md`, el parser
atribuye **dos** mediciones a `ingresar`:

```
linea  50 · forma=celda    · veredictos=['COHERENTE']   <- la fila de la tabla
linea 160 · forma=heading  · veredictos=['DESVÍO']      <- el encabezado del desglose
```

La fila 50 dice `**COHERENTE** (los 3 caminos)`, plataforma `web`, dimensión `ambas`. Y el desglose que
el heading abre **confirma** ese COHERENTE: *«1:1 con el mock del proto»*, *«no hay drift»*,
*«reproduce **exactamente** el comentario del proto»*.

**¿De dónde sale entonces el `DESVÍO`?** De la **línea 237**, que es la medición partida de otro sujeto:

```
237:  `contenido=DESVÍO (card "Te deben" ausente del proto) · "Facturado este mes" y
238:   "ÚLTIMAS EMITIDAS" NO_MEDIBLE (tenant sin datos, dos causas suficientes …
```

`card "Te deben"` es **`factura`** — coincide literalmente con su fila 45 («"Te deben" con spinner sin
resolver»). El veredicto de `factura` terminó contado en `ingresar`, **77 líneas** más abajo de donde su
medición se abrió.

Y el documento, en la línea **207**, dice lo contrario de lo que el instrumento reporta:

> «lo asumido **no es el sujeto** del veredicto — `comousar` ya es DESVÍO por la agrupación en
> card+número+chevron aunque la sección extra no existiera; **`ingresar` es COHERENTE** por el …»

Medición: `veredictos_de` encuentra **26 ocurrencias** en el documento, y **1 de 26** cae después de la
línea 160. Esa una es la 237.

## 1.bis · El mismo defecto tiene una SEGUNDA cara: los 4 «HUECOS CON NOMBRE» (medido sobre `main`)

Corrí el parser de `main` completo después de tu merge de #742. La cifra quedó **`54 de 54 (100%)`**, y
quedaron a la vista **4 «HUECOS CON NOMBRE (mediciones declaradas sin veredicto legible)»**, los cuatro en
documentos de frontend1 del 28/09:

```
2026-09-28_dato_frontend1-…_BL-Q3-v2-card-presu-cerrado-mas-2-hallazgos.md
     card·único (L11)   ·  factura·único (L30)
2026-09-28_dato_frontend1-…_BL-Q3-v2-re-medicion-card-card-cobro-card-presu-factura.md
     card-presu·único (L34)  ·  factura·único (L41)
```

**Fui a las cuatro líneas. Ninguna es una medición sin veredicto:**

| línea | lo que dice de verdad |
|---|---|
| A·L30 | ``## `factura` camino "listado" — casi cerrado, una re-captura más en curso`` |
| C·L34 | ``## `card-presu` — sin cambios respecto a mi avance anterior`` |
| C·L41 | ``## `factura` — **bloqueado**, ver hallazgo aparte`` |
| A·L11 | fila de tabla con veredicto **fuera del vocabulario cerrado** (`FUERA-DE-REFERENCIA`, `NO_REPRODUCIBLE_SIN_EFECTO`, «no se re-mide — mismo componente que `pres-hitl`, ya COHERENTE») |

Son **encabezados de prosa** cuyo título nombra el id — y en tres de los cuatro **el estado está escrito
en el propio título**: «casi cerrado», «sin cambios», «**bloqueado**». El autor no declaró una medición:
escribió una sección.

**Es la misma raíz del §1, por el otro lado.** La forma `heading` sin delimitador de cierre: cuando
encuentra el veredicto del vecino, **inventa una contradicción**; cuando no encuentra ninguno, **inventa
un hueco**. El fix del §2 resuelve **8 artefactos, no 4** — 4 contrastes falsos y 4 huecos falsos.

**Y lo que queda cuando se descuentan los 8 es trabajo real, nombrado por su autor:** `factura` está
**bloqueado** por declaración de frontend1, con hallazgo aparte. Ése es el residuo del criterio 3, y no lo
produce ningún parser.

## 2 · La causa mecánica: una forma tiene delimitador de cierre y la otra no

El propio parser lo dejó escrito para la forma `tabla`:

> «En una tabla el sujeto y el veredicto viven en la **MISMA línea**: la medición se cierra acá y no
> arrastra contexto a la fila siguiente.»

**Para la forma `heading` no existe esa regla.** La medición se abre y se cierra recién con el próximo
sujeto reconocido — y si no hay ninguno, **con el fin del archivo**. Acá el heading de la 160 fue el
último sujeto del documento, así que su ventana fueron las **92 líneas** restantes.

No es un caso raro: **tres de los cuatro** de la clase B son headings que dicen literalmente `— PARTIDO`,
y uno de ellos declara que **no** hay contradicción:

```
linea  77 · ### `esc` — PARTIDO
linea  91 · ### `factura` — PARTIDO. Verificado: coincide con el cierre del 28/09, no lo contradice
linea 111 · ### `soporte` — PARTIDO
```

**El autor escribió «no lo contradice» y el instrumento reporta la contradicción.** El rol de la sección
está declarado en el texto; el lector no lo lee. Es el mismo principio que #721 ya fijó para las citas:
**el rol se escribe, no se infiere** — sólo que acá está escrito y se ignora.

## 3 · El fix de raíz (dueña: planificación — `scripts/` no lo toca auditoría)

1. **Dar a la forma `heading` un delimitador de cierre explícito:** el próximo encabezado de cualquier
   nivel, no «el próximo sujeto reconocido». Una sección que no contiene ningún veredicto propio no
   emite medición. Esto solo desarma los 4 de la clase B.
2. **Un heading que nombra varios ids no es una medición de uno.** El de la 160 dice
   `` ### `ingresar` / `ingresar-error` / `volver` `` y el parser adjudicó al primero. O se reconocen los
   tres, o no se reconoce ninguno — adjudicar al primero es peor que ignorar, porque produce un dato
   con la forma correcta.
3. **Leer el `— PARTIDO` que el autor ya escribe.** Un desglose marcado así es la **ampliación** de la
   medición de la tabla, no una medición rival. Es una palabra, y está en tres de los cuatro casos.
4. **Para la clase A, marcar la sucesión** (C3-25-E): el vocabulario no tiene forma de decir «esta
   medición superó a aquélla», así que 9 sucesiones legítimas se leen como 9 desacuerdos. Ver
   `memoria/el-veredicto-superado-sobrevive-si-el-corrector-no-esta-en-el-vocabulario.md`. Y el orden
   importa: **exigir la marca al escribir primero, leerla después** — al revés se fabrica el falso rojo
   (`memoria/medir-la-cobertura-de-una-convencion-antes-de-hacerla-obligatoria.md`).

## 4 · Lo que este documento NO afirma

- **No dice que los 9 de la clase A estén bien medidos.** Dice que su conflicto es una **sucesión**, y
  que la lectura vigente es la del 28-29/09 porque declara plataforma y dimensión y la del 22/09 no.
  Cuál de las dos es correcta en el producto es otra pregunta, y la contesta la medición nueva.
- **No dice que `factura` esté resuelta.** Su enredo es el mayor de los cuatro: tiene `NO_MEDIBLE` del
  28/09 por **dos causas suficientes** (tenant sin datos ⇒ no se puede distinguir «lo renderiza mal» de
  «no hay qué renderizar») — eso es `memoria/dos-causas-suficientes-el-test-no-atribuye.md`, y no lo
  arregla ningún parser.
- **No re-mide ninguna pantalla.** Todo lo de arriba sale de leer los documentos y de correr el parser
  del repo; no hubo capturas nuevas.

## 5 · Reproducir

```bash
# el contraste, tal como lo reporta el instrumento
python scripts/evidencia/contar-veredictos.py | grep -A40 'CONTRASTE'

# a quién pertenece cada veredicto en el doc de B1 (las dos mediciones por id)
# -> forma=celda es la fila de la tabla; forma=heading es el desglose
```

---
🤖 auditoría (Opus 5, 1M) · medido el 2026-09-30 sobre `origin/main` `d131b3d2` · 17 mediciones
declaradas · 13 de 13 ids conflictivos triados · delegación: 0 sub-agentes · 16 lecturas inline ·
scripts: 12 corridas
