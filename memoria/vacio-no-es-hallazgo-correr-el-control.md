---
name: vacio-no-es-hallazgo-correr-el-control
description: "Un cero/vacío del propio instrumento es una pregunta, no buena noticia — correr el control del control"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 37aeed5a-4657-4d45-ac7e-0a64568aac87
  modified: 2026-07-20T15:49:08.396Z
---

**Antes de leer un `0` como buena noticia, comprobar que el detector sepa encontrar algo.**

Caso vivido (sprint mobile-first, 2026-07-20). Escribí en `S2-classify-port.mjs` un detector de
"fugas de dominio" (archivo agnóstico que importa uno descartado). Reportó `fugasDeDominio: 0` y lo
leí como que el boundary estaba limpio. **Era estructuralmente imposible que reportara otra cosa:**
`path.resolve` en Windows devolvía `C:\packages\...` y mi `.slice(1)` dejaba `:/packages/...`, así
que ningún import matcheaba jamás con el registro. Un agente encontró después, a mano, una fuga real
(`api/index.ts` → `api/clinical.ts`) que ese chequeo debía haber cazado.

**Why:** es exactamente el fallo que la constitución llama *un vacío es una pregunta, no un
hallazgo* — pero aplicado al **propio instrumento**, que es donde más engaña: un `0` producido por
código propio se siente verificado, no asumido. Y una vez leído como buena noticia, se canoniza:
entra al reporte y contamina todo lo que se apoye encima.

**How to apply:**
1. Todo detector/validador que pueda devolver "no encontré nada" necesita un **control**: quitarle
   deliberadamente lo que debe detectar y confirmar que lo detecta. Cuesta un minuto.
2. Mejor todavía, **hornear el control en el script**: si el grafo inverso sale vacío en un árbol de
   250 archivos, eso es imposible → reventar, no emitir un `0`. Un instrumento que no distingue
   "no hay" de "no puedo buscar" es peor que no tenerlo, porque da sensación de vigilancia.
3. Lo mismo aplica a vigías y monitores: el primer vigía del build devolvía `UNKNOWN` en cada
   iteración y habría reportado "sigue en cola" para siempre.

Se aplicó bien después, en el mismo sprint: al escribir el validador de assets de S4 corrí el
control (saqué `icon.png`, verifiqué que abortara, lo restauré) **antes** de confiar en él.

[[no-codificar-la-esperanza-principio-raiz]] · [[spike-first-central-proyecto]] · [[copiloto-mobile-first-cascara-glass]]

---

## El giro que costo mas caro: el control puede fallar en FALSO POSITIVO (2026-09-28)

Esta entrada nacio sobre el `0` que miente. El caso de hoy es el mismo mecanismo en la direccion
**opuesta**, y por eso engaña mas: **un instrumento que no midio puede producir la senal de EXITO
del control.**

Probando el brazo `pageerror` de un guard ajeno, monte tres canarios: C0 sin excepcion (no debe
abortar), C1 excepcion inocua (debe abortar), C2 la excepcion real (debe abortar). Los **tres**
salieron `EXIT=1`. Si hubiera contado exit codes, el veredicto era limpio y falso: *«C1 y C2 abortan
⇒ el brazo funciona»*. La salida cruda decia `ERR_MODULE_NOT_FOUND: pwa-lib.mjs` — **ninguno de los
tres habia llegado a cargar la pagina**, y C0, que deberia haber PASADO, tambien fallaba. Ese C0 era
la unica pista, y un contador de «cuantos abortaron» la borra.

**La regla que se agrega:** un control positivo necesita su propio control negativo **en la misma
corrida**. Si todas las celdas del control dan el resultado esperado, incluida la que deberia dar el
contrario, no se probo nada: se midio el entorno.

## Contador: CUATRO veces en un dia un numero significo «no medi» y se leia como veredicto

No es una anecdota. Es la firma de trabajar con instrumentos que devuelven escalares:

| # | lo que dijo el contador | lo que era |
|---|---|---|
| 1 | `0/8` activaciones en un server | el script aborto en la fase de linea base |
| 2 | `EXIT=1` del detector de superficie | `MODULE_NOT_FOUND` de `playwright-core` |
| 3 | `EXIT=1` en los **tres** canarios | `pwa-lib.mjs` ausente — falso positivo del control (arriba) |
| 4 | **10** filas en una tabla de 11 | la fila partida por dimension se perdio en silencio |

Las cuatro las cazo lo mismo, y no fue re-medir: **leer la salida cruda teniendo el titular servido.**
Los dos primeros eran `0` y `1` — numeros opuestos, misma causa: *no medi*. Un contador que no
distingue «medi y salio cero» de «no llegue a medir» produce las dos lecturas con igual confianza.

**Como se hornea, concretamente** (los cuatro se habrian cazado con esto):

```bash
# el control del ENTORNO va antes de medir, y aborta con un codigo propio
node -e "require('playwright-core')" 2>/dev/null || { echo "ABORT: el 0 de abajo seria mio"; exit 9; }
[ -f "$CHROME_PATH" ] || { echo "ABORT: falta el browser"; exit 9; }
```

Un `exit 9` reservado para «no pude medir» separa de una vez las dos poblaciones que `1` mezclaba.
Y para el caso 4: cuando una unidad del documento no rinde dato, **emitirla como
`SIN_VEREDICTO_PARSEABLE` en vez de no emitir nada** — un hueco se nombra, no se cuenta como cero.

## El par de controles se compara ENTRE SÍ, no contra tu expectativa (2026-09-29)

**Regla nueva, y es la que más rinde de toda esta entrada:** si el control **positivo** y el
**negativo** devuelven **el mismo valor**, el par no discrimina — no absolviste ni condenaste, **no
medisteis**. La entrada ya decía «si todas las celdas dan el resultado esperado, se midió el entorno».
Esto es la otra mitad: si dan el **mismo** resultado entre ellas, da igual cuál esperabas.

El caso: verifiqué por efecto un merge propio y salió `EFECTO=0` — la frase no estaba en `origin/main`.
Se lee como «el merge no llegó». **El control negativo también dio 0.** Dos ceros: el par estaba vacío.
Y era mío — grepeé la entrada de memoria buscando una frase que sólo existía en el **doc de auditoría**
del mismo PR. Re-medido con una sonda que primero probé contra el archivo local (positivo 1 y 2,
negativo 0, ahora sí distintos): el merge había entrado perfecto, `#707` → `c9c8c852`.

**Lo barato que lo cierra:** antes de grepear el sujeto remoto, grepeá **el archivo local** con la misma
sonda y exigí `>0`. Si la sonda no encuentra nada donde sabés que está, no mide nada donde no sabés.

**Y el contador sigue: TRES más el mismo día, todas mías, todas cazadas por el control y ninguna por la
lectura.**

| # | lo que dijo | lo que era |
|---|---|---|
| 5 | `0` comentarios de una forma en dos lotes | un `for` sobre `find` se partió en el espacio de «Claude code» y grepeaba la palabra `Claude` como si fuera un archivo. Lo cazó el positivo: una forma que el propio reporte declaraba en 3 tenía que dar >0 |
| 6 | `0` huérfanos leyendo el JSON | **el ciego era mi lector**: busqué las claves `huerfanos`/`detalle[].huerfano` y la real es `veredictos_huerfanos`. La salida humana decía 4. Casi acuso al instrumento ajeno con el mío roto |
| 7 | `EFECTO=0` post-merge | sonda inexistente en el archivo grepeado (arriba) |

Las tres son de un turno en el que **auditaba instrumentos ajenos**. Ahí está lo incómodo y lo útil: el
que mide instrumentos usa más instrumentos que nadie, y no hay razón para que los propios estén mejor
controlados que los que juzga. **El control no es un trámite del sujeto: es del acto de medir.**

## Y el reverso, que vale igual: un control que FALLA puede acusar al valor esperado

Dos veces el mismo dia un control horneado aborto y el equivocado era **el numero de referencia**, no
el instrumento: el `8` de `mic-funcion` (eran 4 — dos menciones estaban en comentarios) y nueve paths
`screens/*.tsx` que asumi cuando la estructura real es `modules/<dominio>/`. Sin ese segundo control
habria leido nueve «VIGENTE» que solo significaban «el path no existe», y con ellos habria declarado
vigentes filas caducadas de una matriz de conformidad.

**Lo dificil no es poner el control: es no tocar el umbral cuando falla.** Hay que poder sospechar
del esperado, no solo del instrumento — y cual de los dos es se averigua yendo a mirar, nunca
ajustando hasta que aparezca el verde. Emparentada con
[[contar-un-simbolo-no-dice-en-que-rol-aparece]] y [[el-instrumento-respondio-sobre-otro-sujeto]].
