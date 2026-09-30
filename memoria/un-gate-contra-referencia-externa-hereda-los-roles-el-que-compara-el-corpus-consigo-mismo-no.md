---
name: un-gate-contra-referencia-externa-hereda-los-roles-el-que-compara-el-corpus-consigo-mismo-no
description: Medí el gate de contenido que yo mismo había recomendado: 13 falsos positivos de 14, porque el texto citado no codifica su rol (chrome, valor de runtime, cita de otro documento, elemento declarado extra). El detector que compara el corpus contra sí mismo cazó el mismo hallazgo con 1 de 1 — y sin referencia externa
metadata:
  type: feedback
---

**El caso (2026-09-29, criterio 3).** Recomendé un **gate de contenido** —«cada elemento citado tiene
que existir en los dos lados»— y lo entregué como diseño, con la magnitud **estimada**. Antes de que
otra sesión gastara un PR construyéndolo, lo medí sobre el único corpus que existe: 6 de 6 documentos,
53 filas `COHERENTE`, 43 citas, el prototipo entero (19 archivos, 7.687.291 chars) como referencia.

**Resultado: 14 citas «ausentes del proto», de las cuales ~13 son falsos positivos.** No por un bug
del extractor —ése aportó 2— sino por algo que ningún arreglo de regex toca:

> **El texto entre comillas no codifica su ROL.** Se escriben exactamente igual el chrome de la
> pantalla (`"Guardar perfil"`), un valor de runtime (`"$0,00 · 0 facturas"`), una cita de otro
> documento (`el framing original ("pendiente de redeploy")`), una cita **dentro de una negación**
> (`**no** es el caso de "rentabilidad null"`) y un elemento que el autor **ya declaró ausente**
> (`un botón adicional "Ver también los reemplazados" (elemento extra, no carencia)`).

Un gate contra referencia externa **hereda todos esos roles** y no puede separarlos: el valor de
runtime *no puede* estar en un prototipo estático, y el elemento declarado extra el autor ya dijo que
no está. O sea: el gate «descubriría» lo que la fila afirma. Tasa así ⇒
[[el-guard-que-grita-en-el-caso-normal-se-desarma-solo]], garantizado.

## El detector que sí funcionó, y por qué

Dos filas `COHERENTE` del **mismo id**, en documentos distintos, citando chrome **disjunto**: una de
las dos describe otra pantalla. Sin proto, sin saber quién sucede a quién.

```
ids con COHERENTE en >1 documento: 2 de 18
  `factura`  ∅ DISJUNTO  ['datos de venta','todavía no emitiste ningún comprobante']
                      vs ['facturado este mes','nueva factura','te deben','últimas emitidas']
  `volver`   solapa     ['entrar','entrar con otra cuenta'] en ambos
```

**El contraste ES el control**: de dos ids, marca uno y descarta el otro — discrimina, no grita. Y el
que marca es **justamente el falso verde** que me había costado el día
([[el-veredicto-superado-sobrevive-si-el-corrector-no-esta-en-el-vocabulario]]): la fila retirada
describe el wizard, la vigente el listado. **El mecanismo barato cazó el caso caro.**

> **Un gate contra una referencia EXTERNA hereda todos los roles del texto citado; uno que compara el
> corpus CONTRA SÍ MISMO no necesita distinguir rol, porque las dos mitades hablan el mismo idioma.**
> Antes de construir un gate contra una referencia: **¿el corpus se contradice solo?** Si sí, ése es
> el gate — más barato, sin referencia que mantener, y sin falsos positivos de rol.

Límite que hay que declarar con él: sólo habla de sujetos medidos **≥2 veces** (hoy 2 de 18), así que
**no reemplaza** al puntero de sucesión. Pero su potencia crece donde está el riesgo: algo se re-mide
**porque** alguien dudó de su veredicto.

## El corolario sobre revisar una recomendación propia

La fila que se archivó con esta medición **la había escrito yo dos horas antes**, y estaba entregada a
otra sesión para que la implementara. Medirla antes de que la construyeran costó 3 corridas de script;
construirla habría costado un PR y un gate que la primera corrida ruidosa habría hecho saltear.
**Una recomendación entregada como diseño sigue siendo una hipótesis: medir su magnitud ANTES de que
otro la implemente es parte de entregarla**, no una cortesía. Ver
[[no-codificar-la-esperanza-principio-raiz]] aplicado al propio diseño, y
[[el-forjador-no-acierta-siempre-el-gate-de-tests-no-es-opcional]].

Hermanas: [[el-formato-no-codifica-el-rol-dos-discriminantes-opuestos-fallaron]] (misma raíz, un nivel
más arriba: ahí el formato no codifica el rol del **documento**, acá el de la **cita**) ·
[[vacio-no-es-hallazgo-correr-el-control]] ·
[[un-control-positivo-prueba-que-el-instrumento-ve-no-que-mira-donde-hay-que-mirar]] ·
[[el-canario-el-control-positivo-de-lo-que-falla-callado]] ·
[[el-guard-se-vuelve-el-cuello-de-botella-de-lo-que-protege]].

## El caso mínimo del mismo mecanismo: la intersección de dos listas complementarias

Horas después, el mismo día, un control de una línea encontró un defecto en el documento que **gobierna
el sprint**: su §6 declara `agenda` a la vez **invalidado** («los ya corregidos por auditoría, `agenda` y
`presu`») y **vigente** (en la lista de ids camino-único), a siete líneas de distancia.

```python
assert not (invalidados & vigentes)   # -> ['agenda']
```

> **Cada vez que un documento presenta dos conjuntos como complementarios —invalidado/vigente,
> cubierto/pendiente, incluido/excluido— la intersección es un control GRATIS que nadie corre.** No
> necesita referencia externa, ni fechas, ni saber quién sucede a quién: el documento se contradice
> **solo**, y un `set & set` lo dice.

Es el mismo detector de arriba en su forma mínima: comparar el corpus consigo mismo. Y el detalle que lo
hace regla — **lo puse esperando verlo en verde**, como higiene. El hallazgo no vino de la hipótesis que
estaba probando. Ver [[el-canario-el-control-positivo-de-lo-que-falla-callado]].

Con el mismo cruce salió el denominador que faltaba: el §6 declara vigencia de **25 de 54** ids, con
**29 sin declaración** — entre ellos `detalle`, uno de los dos ids del falso verde. Un ratchet que no
declara su cobertura parece completo:
[[un-control-a-nivel-archivo-no-ve-la-divergencia-adentro]].
