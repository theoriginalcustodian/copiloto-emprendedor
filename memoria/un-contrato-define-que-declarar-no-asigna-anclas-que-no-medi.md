---
name: un-contrato-define-que-declarar-no-asigna-anclas-que-no-medi
description: Las reglas de qué declarar sobreviven; las prescripciones concretas que su autor no midió se refutan — y en un contrato una hipótesis se ejecuta en vez de probarse
metadata:
  type: feedback
---

# 📜🎯 Un contrato define QUÉ DECLARAR — no asigna anclas que su autor no midió

En un contrato, **una instrucción se ejecuta; una hipótesis se prueba.** Si se escribe una hipótesis en
modo imperativo, se ejecuta — y encima con autoridad, que es justo lo que impide que la refuten a tiempo.

**Un contrato no asigna anclas concretas (`path:línea`, ids, selectores) que su autor no midió.** Si hace
falta una, va marcada `[ASSUMED_PENDING_VERIFY]` y la reemplaza quien mide.

## La evidencia: 4 de 4 en un día (2026-09-28, BL-Q3 v2)

| Lo que escribí | Qué era | Cómo cayó |
|---|---|---|
| §8.6 «cambien el `waitUntil`» | hipótesis ajena, sin brazo de control | el A/B mostró que la causa era el server; `domcontentloaded` también colgaba |
| §10 «reasignen a `vozchat`» | asumí una plantilla sin contar componentes | son **seis** componentes con su archivo y su rama |
| §9 «midan por `mercadopago`» | ancla inventada | `service-card-status-*` sólo existe en `connected` (`ServiceCard.tsx:134`) |
| el `NO_MEDIBLE` que casi firmé | diagnóstico impecable sobre la pregunta equivocada | el estado estaba en prod, consistente, todo el tiempo |

**Las cuatro las refutó quien fue a medir.** Y las **reglas de qué declarar** —camino (§1), superficie
(§10), dimensión (§11)— sobrevivieron todas.

## El corolario que más rinde

**Dos veredictos opuestos pueden ser verdaderos a la vez** si la fila no declara su dimensión: FE1 firmó
`hitl` COHERENTE **por componente** y auditoría no-comparable **por contenido**, y ninguna se equivocó —
`HitlCard` renderiza un cobro MP o un recordatorio (`hitlMapping.ts:24`, clasifica por `choices`, no por
tipo de negocio). Cuando dos sesiones competentes firman lo contrario, **lo primero a sospechar es el
campo que falta en el contrato**, no la medición de ninguna.

Emparenta con [[el-nombre-es-una-hipotesis-sobre-el-contenido]],
[[una-fila-por-valor-de-una-variable-no-es-una-fila]] y
[[al-juez-tambien-hay-que-darle-el-plano]]. Y con [[prometer-no-es-ejecutar-el-gate-media-la-palabra]]:
una prescripción sin medición propia es una promesa con forma de orden.

---

## Refuerzo 2026-09-30 — la hipótesis y el dato que la refuta vivían **en el mismo archivo**

El caso de arriba es un contrato que prescribe sin medir. Éste es el mismo defecto **dentro de un
instrumento**, y con un agravante: el dato que lo desmiente lo imprime **el propio script**.

`scripts/evidencia/contar-veredictos.py` declara 10 ids bajo una hipótesis con nombre propio,
`HIPOTESIS_MATRIZ_2209`, escrita con todo el rigor del mundo — dos lecturas alternativas, el riesgo
asimétrico de cada una, dueño asignado y un test falsable formulado:

```
`matriz-web-re-medida` (FE1, 2026-09-22, superficie WEB)   dice COHERENTE
las mediciones del 28-29/09                                dicen DESVIO
```

**Medido: esa matriz no aporta ni un COHERENTE a los 12 conflictos.** Los 12 salen de otro documento, el
**barrido** `BL-Q3-web` del mismo día — y en 6 de ellos la matriz acusada dice `REQUIERE_TRIAGE`, o sea es
**la corrección**, no la fuente del error. La hipótesis señalaba al documento que ya había acertado.

**Y el dato estaba a 300 líneas de distancia, en el mismo archivo:** el bloque que imprime los conflictos
lista cada punta **con el documento que la aporta**. Correr el script y leer su propia salida refuta la
hipótesis que el script contiene. Nadie lo hizo durante 8 días, y yo tampoco la primera vez: abrí el
documento que la hipótesis nombraba, medí sobre él, y construí media conclusión antes de notar que el
`COHERENTE` no estaba ahí.

### Por qué una hipótesis *bien escrita* se audita menos

La mal escrita pide verificación; la bien escrita la **sustituye**. Ésta tenía todo lo que uno pide para
confiar —alternativas nombradas, costo de equivocarse, dueño, test— y todo eso es correcto salvo el
**sujeto**. Un sujeto equivocado con método impecable manda a diez personas a mirar el lugar equivocado
con mucha confianza. Es [[nadie-audita-un-coherente-y-es-el-veredicto-que-desactiva-trabajo]] aplicado a
una hipótesis: lo que parece resuelto no se vuelve a mirar.

Y se sostiene sola porque **la declaración silencia el control**: el ratchet aborta ante un conflicto
*nuevo*, no ante uno *declarado*. Declarar un conflicto con una lectura equivocada lo saca del radar
exactamente igual que declararlo con la correcta — [[trabajar-en-un-pedido-lo-silencia]].

**How to apply (suma a lo de arriba):** (1) antes de investigar bajo una hipótesis declarada, **medí su
sujeto**: ¿de qué documento/commit/actor sale realmente cada punta? Casi siempre es un comando, y casi
siempre lo da el mismo instrumento que la contiene; (2) una hipótesis que nombra una fuente tiene que
citar **cómo la midió**, igual que un contrato con sus anclas — «lo verifiqué a mano» no dice cuál miró;
(3) cuando un ratchet permite declarar excepciones, la declaración necesita su propia fecha de revisión:
silencia el control tanto si acierta como si no.
