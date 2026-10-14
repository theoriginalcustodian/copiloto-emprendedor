---
name: una-cifra-sin-unidad-se-deja-citar-para-cualquier-pregunta
description: Tres cifras del mismo criterio circulando a la vez; ganó la más alta y la única sin calificador. Cuando el instrumento cambia de unidad, la cifra vieja no envejece: pasa a medir otra magnitud.
metadata:
  type: feedback
---

**Medido el 2026-10-05.** Del mismo criterio circulaban **tres cifras a la vez**: el tablero citaba
«**54 de 54 (100%)**», el índice de memoria «53 de 54, falta `(home)`», y el instrumento publicaba
«**web 50 de 54 (92%) · mobile 13 de 54 · indeterminada 4**». La que más circulaba era **la más alta
y la única sin calificador**.

**Ninguna estaba «mal».** El `54 de 54` se midió el 30/09 con el instrumento de ese día, que todavía
no separaba plataforma ni filtraba por vocabulario cerrado. O sea: **no es una cifra vieja, es una
cifra de otra magnitud**. Reemplazar una por otra, o compararlas, es un error de categoría — y
«actualizar» la vieja con la nueva esconde que respondían preguntas distintas.

**El daño concreto, que es lo que lo saca de la estética:** ese `54 de 54` sostuvo la afirmación «el
criterio 3 ya no es el motivo por el que el Cierre A no cierra» frente a un criterio del acta que
exige el veredicto ✅ en **web y mobile** para los 54 ids. Con mobile en **13 de 54**, eso sigue en
❌. La cifra no mentía sobre web; mentía por omisión sobre la pregunta que se le estaba haciendo.

**Y la atribución correcta de la culpa importa para el fix.** Otra sesión citó mi cifra fuera de
contexto y se retractó. Pero la causa no fue su cita: **fue que mi cifra no declaraba su unidad.**
Una cifra sin unidad *invita* a esa cita — cualquiera puede usarla para cualquier pregunta de buena
fe, porque nada en ella dice a qué responde.

**Lo que el instrumento ya hacía bien y hay que copiar:** imprime la unidad **en la misma línea que el
número** —«ids únicos de los 54 con veredicto DEL VOCABULARIO CERRADO, **POR PLATAFORMA**»— y marca
explícitamente cuál se cita este sprint («el criterio 3 acotado a web»). El instrumento era más
honesto que su propia cita.

**La regla:** toda cifra en el tablero o en el índice lleva **unidad + fecha + instrumento**; sin eso
no se cita en un veredicto de cierre. Y cuando un instrumento cambia de unidad, las cifras anteriores
no se actualizan: se **marcan** con la unidad que tenían.

## Refuerzo 2026-10-12 — la resta entre dos COMANDOS que parecen medir lo mismo

La entrada de arriba es sobre una cifra que **envejece de magnitud**. Esta variante es peor porque
nace mal: **dos comandos distintos, corridos el mismo día, restados entre sí.**

Midiendo cuántas entradas de memoria eran invisibles en un checkout atrasado, escribí **37**:

```
ls memoria/*.md | wc -l                                    → 366   (sólo el nivel RAÍZ)
git ls-tree -r origin/main -- memoria | grep -c '\.md$'    → 403   (RECURSIVO)
```

`memoria/` tiene dos subdirectorios (`checkpoints/`, `Ideas de implementacion/`). Con la **misma**
unidad en los dos árboles: **308 vs 404 = 96**. Mi cifra subestimaba el efecto **2,6×**.

**Por qué no salta a la vista:** las dos cifras responden a la frase «archivos `.md` de `memoria/`».
Ninguna es falsa. Lo falso es **la resta**, y una resta no tiene unidad visible — hereda la de sus
términos sin avisar que eran dos. La regla de arriba («unidad + fecha + instrumento») se cumplía por
separado en cada término y **no** alcanzó: faltaba la regla del **par**.

**Y el contexto que lo hace útil:** la cometí en la evidencia de un `pedido_` cuyo tema **era**
instrumentos que miden mal. Tener el defecto en la cabeza no protege de cometerlo en la propia
evidencia — hermano de [[el-fix-de-razonamiento-no-viaja-con-el-codigo-copiado]] y del corolario de
[[medir-contra-un-ref-que-no-existe-da-vacio-y-vacio-se-parsea-como-cero]].

**How to apply:** toda comparación de dos cifras se corre con **un solo comando parametrizado por el
sujeto**, nunca con dos comandos distintos:

```bash
for ref in "$RANCIO" origin/main; do
  printf '%s: %s
' "$ref" "$(git ls-tree -r --name-only "$ref" -- memoria | grep -c '\.md$')"
done
```

Si no se puede unificar el comando, la resta **no se publica**: se publican los dos números con su
comando al lado y se dice que no son comparables. Y el control que lo caza en un segundo: **el total
conocido**. Acá `ls` daba 391 en el árbol al día y `find` 404 — una discrepancia de 13 sobre el
*mismo* árbol, que es la señal de que los comandos no miden lo mismo, disponible **antes** de restar
nada.

Relacionadas: [[de-dos-artefactos-con-distinta-precision-gana-el-que-circula]] ·
[[un-orden-de-magnitud-que-coincide-no-confirma-la-causa]] ·
[[una-cifra-que-coincide-con-la-fuente-independiente-puede-coincidir-por-compensacion]] ·
[[un-contrato-define-que-declarar-no-asigna-anclas-que-no-medi]].

### Refuerzo (2026-10-14): un veredicto sobre `main` sin su ref en el TITULAR no vence nunca

frontend2 bajó un `dato_` titulado **«`avisoAlChat` y `onAviso` NO están en `main`: son un comentario
y un substring»**. Dos horas después yo medí lo contrario —definición en `PantallaMiDia.tsx:325`,
cableado en `:601`, call-site en `PantallaPrincipal.tsx:236`— y por un momento pareció que uno de los
dos había medido mal.

**Ninguno.** Su cuerpo decía «medido contra `origin/main` `b1a9a22c`» y era exacto contra ese ref;
entre las dos mediciones entraron #1138 (`974355ff`) y #1140 (`eec1498d`), y el puente llegó. Lo
curioso: #1140 era **de ella**. Su propio trabajo invalidó su propio `dato_` en dos horas.

La trampa no fue la medición, fue **dónde vive el ref**: el cuerpo lo citaba, el **nombre del archivo
no**. Y en un buzón lo que circula es el nombre — igual que
[[de-dos-artefactos-con-distinta-precision-gana-el-que-circula]]. Un titular en presente sobre un
repo que avanza («X NO está en main») se lee como estado vigente cada vez que alguien lo encuentra,
mientras el SHA que lo acotaba queda enterrado adentro.

→ **Un veredicto sobre una rama viva lleva su ref en el titular, no sólo en el cuerpo.** Y al leer
uno ajeno que contradice tu medición, el primer chequeo no es «quién se equivocó» sino **¿contra qué
ref midió cada uno?** — ver [[el-instrumento-respondio-sobre-otro-sujeto]]. Dos verdades sobre
sujetos distintos no se refutan: se fechan.
