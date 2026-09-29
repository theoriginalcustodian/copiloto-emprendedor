# 🗑️📸 El testigo se SOBREESCRIBE, y borra la prueba justo cuando dos mediciones difieren

**Regla:** un registro de una sola ranura —`cat >` en vez de `cat >>`— no es un registro: es una
**foto del presente que destruye la del pasado**. Se paga exactamente en el momento en que hace falta:
cuando dos lecturas del mismo sujeto dan cifras opuestas y hay que decidir cuál describía qué.
**Preguntá: ¿este archivo conserva la corrida anterior, o la pisa?**

**Caso raíz (2026-09-28, gate del agregado · criterio 3).** Planificación midió el
`placeholder="1500,50"` de #689: **0** ocurrencias en el bundle servido, con control positivo de 5
marcadores. Auditoría lo midió ~45 min después: **1**. Las dos eran verdad — hubo un **deploy a las
11:56:53 -03** en el medio (`index-Cr4NxCOh.js` → `index-BDcH8fIG.js`). Ningún instrumento falló.

Lo que faltó fue el registro, **y el registro existía**: `deploy.sh:107-120` escribe
`DEPLOY-MANIFEST.json` con `desplegado_en` + `origin_main_sha`. Pero lo escribe con
`ssh "$HOST" "cat > '$REMOTE/DEPLOY-MANIFEST.json'"` — **una sola ranura**. El deploy de 11:56:53 no
sólo cambió el bundle: **borró la identidad del anterior**, que era justo lo que hacía falta para
verificar 19 campos `servido@` de capturas tomadas antes. Costo del fix: un carácter. Costo de no
tenerlo: 19 campos **permanentemente** no re-verificables — ninguna re-medición los recupera.

**Y el corolario, que es la mitad transferible:** con el testigo borrado, lo mejor que se puede afirmar
de esos 19 campos es que **aciertan por casualidad del calendario**. `servido@b7fa0e23` describe bien
lo fotografiado *porque* el deploy tardó 80 min; si hubiera corrido 1 h antes, la misma inferencia
(hora del PNG contra el log de commits) habría escrito un SHA con 2 commits que la captura no mostraba,
**sin dar síntoma**. **Un campo correcto por suerte es indistinguible de uno correcto por medición**, y
esa indistinguibilidad es el defecto — no el valor que quedó escrito.

**Tercer filo, del mismo incidente:** el contrato que venía a arreglar esto declaró en su inventario
«marcador de build: **NO EXISTE** — 0 ocurrencias de `BUILD_SHA`/`GIT_SHA`/`VITE_BUILD`/`__BUILD`». El
grep era correcto; la conclusión no. El mecanismo se llamaba **`origin_main_sha`** y ninguna de las
cuatro grafías lo alcanzaba: **se buscó el nombre esperado, no la función**
([[el-nombre-es-una-hipotesis-sobre-el-contenido]]). Peor: el manifiesto ya declaraba en su propio
`nota` que `apps/copiloto-web` **no** está anclado al SHA — o sea que el testigo existía, estaba
fechado, y **decía por escrito que no servía para esa pregunta**.

**Cómo se aplica:**
1. Todo recibo de una operación que se repite (deploy, sync, build, reconcile) **appendea**. Si tiene
   una sola ranura, la corrida N destruye la evidencia de la N-1.
2. Antes de concluir «no hay registro», grepeá por **la función**, no por el nombre que esperás: el
   mecanismo puede llamarse de una quinta forma.
3. Ante dos mediciones opuestas del mismo sujeto: la primera hipótesis es **el sujeto se movió**, no
   «un instrumento miente» ([[un-inventario-de-procesos-vivos-es-un-snapshot-no-un-estado]]).
4. Cuando el testigo ya se borró, el veredicto honesto es **«correcto, y no re-verificable»** — no
   re-medir y presentar la cifra de hoy como si fuera la de ayer.

**Ver:** [[el-instrumento-respondio-sobre-otro-sujeto]] ·
[[un-mecanismo-roto-hacia-el-no-no-da-sintoma]] · [[dos-causas-suficientes-el-test-no-atribuye]]
