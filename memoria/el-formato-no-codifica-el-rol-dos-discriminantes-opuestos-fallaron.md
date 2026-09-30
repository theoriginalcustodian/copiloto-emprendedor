---
name: el-formato-no-codifica-el-rol-dos-discriminantes-opuestos-fallaron
description: SEGUNDA y TERCERA aparición de la raíz de [[si-el-formato-no-codifica-el-rol-ningun-parser-lo-recupera]], el mismo día y en otros dos sistemas: dos discriminantes opuestos para deducir si un documento MIDE o sólo CITA, los dos inertes; y después un documento entero RETIRADO como evidencia cuyas 36 filas no lo dicen. Cuando dos hipótesis contrarias no separan, la respuesta ya es la raíz
metadata:
  type: feedback
---

⚠️ **La raíz ya está escrita, y no es mía:**
[[si-el-formato-no-codifica-el-rol-ningun-parser-lo-recupera]] (planificación, 2026-09-29, sobre
`plan-drift-check.sh`: un path citado como **fundamento** es indistinguible de uno que es el
**entregable**). Esta entrada no la repite: aporta el **segundo caso independiente** y lo que sólo se ve
al tener dos.

**El caso (2026-09-29, unas horas después y en otro sistema).** `contar-veredictos.py` tenía que
distinguir los documentos que **miden** (comparan pantalla contra prototipo) de los que sólo **citan**
veredictos ajenos para razonar. Se probaron dos discriminantes estructurales, en direcciones opuestas:

1. **Corroboración cruzada** («un documento cuyos ids aparecen también en otros está respaldado»). Lo
   rompí con un contraejemplo: **un dictamen analítico habría sacado la nota más alta**, porque cita el
   padrón entero por su naturaleza. El control **premia la propiedad que lo delata**.
2. **Cobertura del padrón** (mi reemplazo: «cubre >80% ⇒ candidato a rol normativo»). Planificación lo
   midió antes de embarcarlo: **techo de menciones de una medición 29/54, techo de un descartado
   29/54 — empate literal.** Un gate al 80% nunca dispararía. No lo embarcó.

## Lo que sólo se ve con los dos casos juntos

**Cuatro discriminantes refutados el mismo día, en dos sistemas sin relación** (posición de columna ·
edad/precedencia · corroboración cruzada · cobertura), **dos de ellos apuntando en sentidos
opuestos**. Un discriminante que falla es un bug; dos contrarios que fallan **son la prueba de que la
propiedad buscada no está en el texto**. Ese patrón es la señal a reconocer temprano: cuando la segunda
hipótesis, contraria a la primera, tampoco separa, **dejá de buscar la tercera**.

Y el rol a deducir era distinto en cada caso —fundamento-vs-entregable allá, medir-vs-citar acá— lo que
descarta que fuera un problema de ese vocabulario en particular.

## La consecuencia de diseño, que acá tuvo una capa extra

Igual que en el caso de planificación, lo único que protege es la **declaración explícita** con motivo
escrito y abort por documento sin clasificar. Pero además apareció una **segunda red que no depende de
la clasificación**: el **vocabulario cerrado**. Un documento que cita no produce veredictos propios en
las celdas donde el parser los busca, así que **un analítico mal clasificado queda neutralizado igual**.
Doble red, y la de abajo funciona sola — eso es lo que hizo que la cifra no se moviera cuando descubrí
que un documento estaba mal clasificado desde el 23/09.

## El callejón se señaliza, no se borra

El empate 29/29 quedó **impreso en el reporte** con la marca «NO es un gate: no separa», y el control
retirado salió **nombrado en el commit**, no borrado en silencio. Un callejón sin señalizar se recorre
dos veces — que es exactamente lo que pasó con esta raíz: **se aprendió a la mañana y se volvió a
aprender a la tarde**, porque las dos memorias quedaron **huérfanas del índice** y ninguna sesión podía
ver la de la otra. Es el costo medido de [[el-indice-truncado-fabrica-duplicados]], esta vez con el
duplicado a medio escribir.

## El error mío que vino pegado

Sostuve el contraejemplo con «el dictamen cita **54 de 54** ids». Eran **menciones con backticks
contadas a mano**; medido con el padrón da **29**, y veredictos atribuidos **12**. El hallazgo
estructural sobrevive; **el cálculo del daño no**. Cuarta vez en el día que la unidad me rompe una
cifra — y esta vez dentro del mensaje que corregía a otro por unidades. De ahí la norma: **cada cifra
declara su unidad o no se cita**, y la unidad se mide con el instrumento, no a ojo.

Hermanas: [[un-control-calibrado-a-tu-propio-valor-no-ve-al-productor-ajeno]] ·
[[el-guard-se-satisface-con-su-propio-comentario]] (presencia en vez de rol) ·
[[instrumento-que-no-mira-nunca-falla]] (un gate que nunca dispara entrega la garantía que no tiene) ·
[[contar-un-simbolo-no-dice-en-que-rol-aparece]] ·
[[un-gate-cuyo-predicado-es-el-sintoma-de-un-bug-abierto]].

---

## Tercera aparición, el mismo día: la propiedad que no está en el texto es la **VIGENCIA**

**El caso.** Planificación agrupó 10 conflictos de veredicto bajo una sola hipótesis («todos COHERENTE en
la matriz del 22/09 y DESVÍO después ⇒ una causa común») y propuso cerrar los diez juntos si un test de
falsación confirmaba uno. Medido documento por documento, **8 de los 10 COHERENTE no venían de la matriz
vigente: venían del barrido original del 22/09, que esa misma matriz declaró inválido el mismo día** —
textual en su encabezado: *«invalida como evidencia las 22 filas completas»*. En el documento vigente esos
ids son `REQUIRES_TRIAGE` e `INCOMPLETO`, no `COHERENTE`.

**El mecanismo es el de esta entrada, con otra propiedad.** Un documento **entero** está retirado como
evidencia y **ninguna de sus 36 filas lo dice**. Para cualquier parser son idénticas a las vigentes. Y no
lo cubre la clasificación que sí se construyó (`MEDICIONES_DECLARADAS` / `NO_SON_MEDICION`), por una razón
que vale entender: **el barrido retirado *era* una medición** — la clasificación por rol lo acepta con toda
razón. Lo que no tiene es un tercer estado, `RETIRADO_POR: <doc>`.

> **Una retractación no viaja con lo retractado.** El documento que retira lo dice en *su* encabezado; el
> retirado sigue afirmando lo mismo que afirmaba, con el mismo formato y la misma autoridad aparente. El
> lector que abre el retirado no tiene forma de saberlo, y el parser tampoco.

Es el patrón de un ADR `SUPERSEDED` que no linkea a su sucesor, de una medición re-hecha que deja viva la
primera, de un doc «v1» que nadie marcó cuando salió el «v2». **La marca siempre se pone en el lugar
equivocado: en el nuevo, que es el que se está escribiendo.**

## Lo que las tres juntas agregan sobre las dos

Con dos casos la conclusión era «cuando dos hipótesis contrarias no separan, dejá de buscar la tercera». Con
tres, en tres sistemas y un día, aparece algo más fuerte: **las tres propiedades que faltaban son
propiedades de la RELACIÓN entre documentos, no del documento** — si un path es fundamento o entregable *de
un plan*; si un doc mide o cita *a otros*; si un veredicto está vigente o retirado *por otro*. Ninguna es
visible desde dentro del archivo, y ahí está la razón de fondo por la que ningún lector local —parser,
sub-agente, sesión nueva— puede recuperarlas: **no están ausentes por descuido de formato, están en el
lugar equivocado por construcción.** La relación se declara en un solo extremo, y casi siempre en el que no
se consulta.

## Y el orden, que en este caso decidía un falso verde de diez filas

Arreglar el contraste **antes** de marcar el retiro deja las ocho filas leyéndose como «COHERENTE vs
DESVÍO». La resolución cómoda de un empate —«son dos preguntas distintas»— las cierra juntas, y **fabrica
el falso verde que el contraste venía a cazar, sobre diez filas de una vez y con la firma de una hipótesis
validada** ([[una-asimetria-entre-gemelos-no-prueba-que-uno-este-mal]], donde ya absolví de más una vez
hoy). Es el mismo patrón de orden que la exclusión de los documentos analíticos: **excluir primero,
arreglar después.**

### Y una cuarta cara, que obliga a partir el remedio en dos

Horas después apareció, en el **documento vigente** de ese mismo corpus, una fila que afirma «coincide con
el proto» y enumera cuatro elementos: tres existen en el prototipo y **el cuarto no existe** (`0` hits
contra el SHA que la fila cita, con control positivo verde sobre los otros tres). Nadie la retiró: **se
contradice consigo misma**.

Eso **no** lo arregla un estado de vigencia, y la distinción vale porque decide el diseño:

| | documento retirado por otro | fila que se contradice sola |
|---|---|---|
| la invalidación | **existe**, declarada en el encabezado de otro doc | **no existe en ninguna parte** |
| el defecto | **no viaja** a lo retirado | la fila afirma más de lo que midió |
| el remedio | un puntero (`RETIRADO_POR: <doc>`) que propaga algo ya escrito | un **gate de contenido**: cada elemento citado tiene que existir **en los dos lados** |

Y la segunda es **más grave que la primera**: el retiro al menos está escrito en algún lugar del corpus,
así que es recuperable por un parser el día que se lo enseñe. Una afirmación sobre un elemento ausente **no
deja rastro en ningún documento** — apareció sólo porque alguien fue a leer la celda y a contar los
elementos uno por uno. Ver [[el-instrumento-fabrica-una-referencia-que-no-existe]].

### Quinta cara, el mismo día: no hay UN retirado y UN vigente — hay una CADENA sin sucesión declarada

Medido al final de la jornada: el corpus del 22/09 tiene **6 documentos de medición web, no 2**, en dos
cadenas paralelas de dos autores, y **ninguno declara a quién sucede**:

```
barrido f1 (35 pantallas, 22 COHERENTE)   ← retirado; sus 36 filas no lo dicen
  └─ re-medida f1 (22 ids)                ← refuta 4, deja 9 SIN VEREDICTO
       ├─ v2 f1 (9 ids)                   ← cierra esas 9
       └─ v2-filas-3-a-6 f1 (7 ids)       ← el detalle delegado
barrido f2 (7 pantallas ✅)                ← superado; sin marca
  └─ re-medida f2 (7 ids)                 ← baja 5 a REQUIERE_TRIAGE
```

Elegí «el vigente» **por tamaño y por parecido de nombre**, y caí en el del medio de una cadena: los
`REQUIRES_TRIAGE` que cité como veredicto final eran el estado **intermedio** que `v2` vino a cerrar. Dije
la cifra mal cuatro veces (8 → 5 → 0 → 2) y **ninguna falló por razonamiento: todas por el universo de
documentos**.

Eso corrige el remedio de la cuarta cara: **`RETIRADO_POR:` no alcanza, porque la mitad de los casos no es
un retiro total sino un cierre parcial de filas abiertas.** Necesita su par en el que llega después
—`SUPERSEDE:` / `CIERRA_FILAS_DE:`— declarado por quien lo escribe, que es el único que sabe a qué viene.

> **Una cadena de versiones sin sucesión declarada no tiene un documento vigente: tiene el que eligió el
> lector.** Y el lector elige por prominencia —el más grande, el de nombre más canónico—, que no correlaciona
> con ser el último.

Y el cobro final está medido en [[el-veredicto-superado-sobrevive-si-el-corrector-no-esta-en-el-vocabulario]]:
combinada con un vocabulario que no admite el estado corrector, esta cara **produce un falso verde real**, no
una ambigüedad de lectura.

**Sexta cara (2026-09-29, el gate de contenido).** El mismo patrón un nivel más abajo: no es el rol del
**documento** sino el de la **cita**. `"Guardar perfil"` (chrome), `"$0,00 · 0 facturas"` (runtime),
`el framing original ("pendiente de redeploy")` (otro documento) y `"Ver también los reemplazados"
(elemento extra, no carencia)` se escriben **idénticos**, y un gate que los compare contra una
referencia externa da **13 falsos de 14**. Detalle y la alternativa que sí discrimina:
[[un-gate-contra-referencia-externa-hereda-los-roles-el-que-compara-el-corpus-consigo-mismo-no]].
