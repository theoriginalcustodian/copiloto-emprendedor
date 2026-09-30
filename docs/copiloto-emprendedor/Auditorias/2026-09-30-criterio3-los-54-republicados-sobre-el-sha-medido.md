# Criterio 3 — los **54** republicados, con el SHA medido en la cabecera

> **Qué cumple este documento.** El ítem 1 de la cola de auditoría del contrato
> `2026-09-29_contrato_planificacion-a-todos_cierre-A-redeclarado-y-cola-por-sesion`:
> *«criterio 3: republicar los 54 ids sobre el SHA actual (decisión (a′) del operador) — los **54**,
> no 48 ni 29, con el SHA medido en la cabecera»*.

## 0 · Los dos SHA, porque la respuesta depende de cuál

| ref | SHA | ids con veredicto del vocabulario cerrado | `sin nada en rol de veredicto` |
|---|---|---|---|
| `origin/main` | `d131b3d274a3641d3377b529b03d9fd73f7e1b3e` | **53 de 54** (98%) | 1 → **`(home)`** |
| PR **#742** (`scripts/parser-lee-los-ids-raros-del-padron`) | `ecaf7be2bccf3f2cfb81459484874e8764b7a386` | **54 de 54 (100%)** | **0** |

**El faltante de `main` NO es trabajo sin hacer.** FE2 midió la home el **2026-09-30 a las 00:17**
(`cierre_frontend2-a-planificacion_C3-home-medida-DESVIO-mi-dia-vs-tablero`, veredicto **DESVÍO**). Lo
que faltaba era que el instrumento pudiera leer el id: `(home)` es el único id del padrón que empieza
con paréntesis, y los patrones de celda del parser exigían `[a-z0-9]` al inicio. Medido:
`limpiar('` `` `(home)` `` `')` devolvía **`'home)'`** — se comía el paréntesis de apertura y conservaba el
de cierre, así que el token nunca coincidía con el universo.

**Y el padrón lo fabrica este mismo repo:** `criterio3-padron.sh:59` normaliza la celda
`*(vacío)* Mi día` del SPEC de BL-P5 y produce `(home)`. El universo y su lector **no compartían el
alfabeto**, y el universo lo escribe el repo.

## 1 · Por qué la falla no dio síntoma durante 8 días

Dos mecanismos que, por separado, están bien:

1. **Un documento cuyo único sujeto es ilegible no llega a ser candidato.** `descubrir_documentos()`
   admite un doc si tiene ≥1 id del criterio con veredicto. Con `(home)` ilegible, el `cierre_` de FE2
   no era candidato: **ni medido, ni descartado**. El ratchet `exit 8` —que sí caza al candidato sin
   clasificar— nunca se entera, porque para él ese archivo no existe.
2. **El reporte contaba el faltante sin nombrarlo.** `contar-veredictos.py:1350-1351` construye
   `[i for i in ids if i not in union]` y **sólo imprime su `len`**. Para saber que el id era `(home)`
   hubo que capturar los locales de `main()` con un tracer — un dato que el reporte ya tenía en la mano.

El cruce de los dos deja el hueco: el veredicto existe, el instrumento lo lee (`veredictos_de` devolvía
`(14, 'DESVÍO', 'tabla')`), pero al no asociarse a ningún sujeto **el documento entero desaparece en
silencio**. Ver `memoria/vacio-no-es-hallazgo-correr-el-control.md` y
`memoria/dos-decisiones-correctas-que-se-cruzan-en-un-agujero.md`.

## 2 · El control que faltaba, escrito y verificado

`docs/copiloto-emprendedor/Auditorias/2026-09-30-canario-del-alfabeto-del-padron.py` cruza los 54 ids
del padrón contra el lector, uno por uno, con la forma que los documentos usan de verdad
(`` | `<id>` (glosa) | ``). Verificado en **las dos direcciones**, exit sin pipe:

```
parser de main : exit 1 · LEGIBLES 53 de 54 · ILEGIBLES 1 de 54 -> ['(home)']
parser de #742 : exit 0 · LEGIBLES 54 de 54 · ILEGIBLES 0 de 54 (ninguno)
control POSITIVO: con un lector ciego inyectado, 54 de 54 salen ilegibles -> el canario sí mide
control NEGATIVO: token fuera del padrón sigue ilegible -> no inventa sujetos
```

Pedido a planificación (dueña de `scripts/`) para hornearlo en
`scripts/tests/test-parser-veredictos-formas-de-tabla.sh`:
`2026-09-30_pedido_auditoria-a-planificacion_742-PASA-y-el-canario-del-alfabeto-que-le-falta-al-padron`.

**Y un error propio que vale registrar**, porque cayó justo en el punto que el canario hace: el primer
control positivo usaba un cebo `((cebo-del-canario))` metido **dentro** de `ids`, y el parser de #742 lo
daba por legible — con razón, porque reconoce lo que el padrón **declara**, y al meterlo en el padrón
yo lo había declarado. **El cebo no era imposible: lo autoricé.** El canario dio `exit 2` sobre el único
lector que estaba bien: falso rojo de mi propio instrumento. Un guard condicionado a una lista blanca no
se prueba metiendo el cebo en la lista blanca; el control correcto prueba que el instrumento detecta un
**lector ciego**.

## 3 · Los 54, uno por uno

<!-- archivos del buzon examinados: 1951 · mediciones declaradas usadas: 17 -->
| # | id | veredicto(s) medidos | docs |
|---|---|---|---|
| 1 | `(home)` | **DESVÍO** | 1 |
| 2 | `afip` | **COHERENTE** · **NO_MEDIBLE** · **REQUIERE_TRIAGE** | 2 |
| 3 | `agenda` | **COHERENTE** · **NO_MEDIBLE** | 2 |
| 4 | `ajustes` | **DESVÍO** | 1 |
| 5 | `apar` | **COHERENTE** | 2 |
| 6 | `apps` | **DESVÍO** · **FUERA-DE-REFERENCIA** | 1 |
| 7 | `bi` | **COHERENTE** · **DESVÍO** | 3 |
| 8 | `bi-refresh` | **COHERENTE** | 3 |
| 9 | `bi-vacio` | **NO_MEDIBLE** · **NO_REPRODUCIBLE_SIN_EFECTO** | 2 |
| 10 | `bloqueado` | **DESVÍO** · **NO_REPRODUCIBLE_SIN_EFECTO** | 2 |
| 11 | `caida` | **DESVÍO** · **NO_MEDIBLE** | 2 |
| 12 | `card` | **COHERENTE** · **DESVÍO** · **FUERA-DE-REFERENCIA** · **NO_REPRODUCIBLE_SIN_EFECTO** · **REQUIERE_TRIAGE** | 5 |
| 13 | `card-cliente` | **COHERENTE** · **DESVÍO** · **REQUIERE_TRIAGE** | 3 |
| 14 | `card-cobro` | **COHERENTE** · **DESVÍO** · **FUERA-DE-REFERENCIA** · **NO_REPRODUCIBLE_SIN_EFECTO** · **REQUIERE_TRIAGE** | 4 |
| 15 | `card-factura` | **FUERA-DE-REFERENCIA** · **NO_REPRODUCIBLE_SIN_EFECTO** | 2 |
| 16 | `card-presu` | **COHERENTE** · **DESVÍO** · **FUERA-DE-REFERENCIA** · **NO_REPRODUCIBLE_SIN_EFECTO** · **REQUIERE_TRIAGE** | 5 |
| 17 | `chat` | **COHERENTE** · **FUERA-DE-REFERENCIA** · **REQUIERE_TRIAGE** | 3 |
| 18 | `clientes` | **COHERENTE** · **FUERA-DE-REFERENCIA** | 1 |
| 19 | `cobro-voz` | **PENDIENTE_DEVICE** | 2 |
| 20 | `comousar` | **COHERENTE** · **DESVÍO** · **FUERA-DE-REFERENCIA** | 4 |
| 21 | `consent` | **DESVÍO** · **NO_REPRODUCIBLE_SIN_EFECTO** | 2 |
| 22 | `cuenta` | **COHERENTE** · **DESVÍO** · **REQUIERE_TRIAGE** | 2 |
| 23 | `detalle` | **COHERENTE** · **DESVÍO** · **REQUIERE_TRIAGE** | 2 |
| 24 | `entrada` | **COHERENTE** · **NO_MEDIBLE** | 2 |
| 25 | `esc` | **COHERENTE** · **DESVÍO** | 3 |
| 26 | `fact-cae` | **COHERENTE** · **NO_REPRODUCIBLE_SIN_EFECTO** | 2 |
| 27 | `fact-hitl` | **COHERENTE** · **NO_REPRODUCIBLE_SIN_EFECTO** | 2 |
| 28 | `fact-voz` | **PENDIENTE_DEVICE** | 2 |
| 29 | `factura` | **COHERENTE** · **DESVÍO** · **FUERA-DE-REFERENCIA** · **NO_MEDIBLE** | 4 |
| 30 | `feedback` | **COHERENTE** · **REQUIERE_TRIAGE** | 2 |
| 31 | `gastos` | **DESVÍO** | 1 |
| 32 | `grabando` | **NO_REPRODUCIBLE_SIN_EFECTO** | 1 |
| 33 | `hablar` | **COHERENTE** | 1 |
| 34 | `hitl` | **COHERENTE** · **FUERA-DE-REFERENCIA** | 2 |
| 35 | `ingresar` | **COHERENTE** · **DESVÍO** | 3 |
| 36 | `ingresar-error` | **COHERENTE** | 3 |
| 37 | `ingresos` | **COHERENTE** · **REQUIERE_TRIAGE** | 2 |
| 38 | `negocio` | **COHERENTE** · **REQUIERE_TRIAGE** | 2 |
| 39 | `onb-cumplida` | **NO_REPRODUCIBLE_SIN_EFECTO** | 2 |
| 40 | `onb-promesa` | **COHERENTE** · **FUERA-DE-REFERENCIA** | 1 |
| 41 | `preg` | **COHERENTE** · **DESVÍO** · **INCOMPLETO** | 2 |
| 42 | `pres-ciclo` | **COHERENTE** · **REQUIERE_TRIAGE** | 2 |
| 43 | `pres-hitl` | **COHERENTE** · **REQUIERE_TRIAGE** | 2 |
| 44 | `pres-voz` | **PENDIENTE_DEVICE** | 1 |
| 45 | `presu` | **COHERENTE** | 2 |
| 46 | `recibo` | **COHERENTE** · **NO_REPRODUCIBLE_SIN_EFECTO** | 2 |
| 47 | `reveal` | **COHERENTE** | 1 |
| 48 | `soporte` | **COHERENTE** · **DESVÍO** | 3 |
| 49 | `splash` | **COHERENTE** · **NO_MEDIBLE** | 2 |
| 50 | `tablero` | **DESVÍO** | 1 |
| 51 | `vacio` | **NO_REPRODUCIBLE_SIN_EFECTO** | 2 |
| 52 | `vacio-visto` | **DESVÍO** · **NO_REPRODUCIBLE_SIN_EFECTO** | 2 |
| 53 | `volver` | **COHERENTE** | 3 |
| 54 | `vozchat` | **PENDIENTE_DEVICE** | 1 |

<!-- con veredicto: 54 de 54 · sin: 0 -> [] -->

## 4 · Lo que este documento NO afirma

**No afirma que el criterio 3 cierre.** Con los 54 medidos, queda vivo el defecto que no es de
alfabeto sino de **juicio**: **13 ids tienen veredictos incompatibles entre documentos** (`CONTRASTE`,
**0 sin declarar**) — `bi`, `card`, `card-cliente`, `card-cobro`, `card-presu`, `comousar`, `cuenta`,
`detalle`, `esc`, `factura`, `ingresar`, `preg`, `soporte`. Un mismo id con `COHERENTE` en un doc y
`DESVÍO` en otro no se resuelve republicando: se resuelve triando cuál medición es vigente y cuál quedó
superada, que es otra fila y otro dueño. Ver
`memoria/el-veredicto-superado-sobrevive-si-el-corrector-no-esta-en-el-vocabulario.md`.

Tampoco afirma que los 54 estén **medidos en device**: la columna «plataforma» de las mediciones dice
`web` en la mayoría, y `PENDIENTE_DEVICE` aparece como veredicto propio. Device/EAS está diferido al
sprint siguiente por orden del operador.

## 5 · Cómo reproducirlo (capa 0, cero tokens)

```bash
# el padrón: 54 de 54 con el SHA en la cabecera
bash scripts/evidencia/criterio3-padron.sh --sha origin/main

# la cifra, con la unidad declarada (nunca citar el número sin su unidad)
python scripts/evidencia/contar-veredictos.py | grep 'CIFRA DEL CRITERIO'

# el canario del alfabeto: ¿el lector puede leer los 54 ids que el padrón fabrica?
python docs/copiloto-emprendedor/Auditorias/2026-09-30-canario-del-alfabeto-del-padron.py
echo "exit=$?"   # sin pipe: el pipe se come el exit code
```

---
🤖 auditoría (Opus 5, 1M) · medido el 2026-09-30 · 1951 archivos del buzón examinados · 17 mediciones
declaradas · delegación: 0 sub-agentes · 11 lecturas inline · scripts: 9 corridas
