# 🕳️➕ El fallback que SUSTITUYE al valor perdido hace ciego al control que cuenta los dos

**Regla.** Si un parser, ante un valor que no pudo leer, appendea un marcador de «no se pudo leer» a
**la misma colección** cuyo largo es la métrica del control, entonces **el control es ciego por
construcción**, no por un caso borde. Cada pérdida se compensa 1-a-1 y el total se conserva.

**Cómo suena adentro del código.** «Una fila que no rinde veredicto es un HUECO, no un cero: se
nombra.» Es una decisión **correcta** —nombrar el vacío es mejor que tragarlo— y es exactamente la que
rompe el control, porque el hueco entra a `hits` y `veredictos_total = len(hits)`.

**El caso (2026-09-28, `scripts/evidencia/contar-veredictos.py`).** Canario: se sustituye el regex de
UN brazo por `r"(ZZNOMATCHZZ)"` y se corre contra los dos lotes vivos.

| brazo roto a propósito | exit | totales | ¿lo caza algún control? |
|---|---|---|---|
| ninguno (C0) | 1 | A=20 · B=32 | — |
| `campo` | 3 | A=**3** | sólo el agregado (`a < 15`), **por casualidad** del tamaño del lote |
| `bullet` | 4 | — | ✅ control propio (`if bullets and rinden == 0`) |
| **`tabla`** | 1 | **A=20 · B=32, idénticos a C0** | ❌ **ninguno** |

Romper el brazo `tabla` es **indetectable**: cada veredicto perdido vuelve como hueco y el total no se
mueve un byte. El brazo `bullet` sí tiene control porque **se agregó el día que ese brazo falló** — y
ahí está la segunda mitad de la regla: **un control por-incidente deja a los otros brazos bajo el
control agregado, que es insuficiente.** Cada brazo necesita su propio positivo.

**Y el patrón no es de este instrumento: es del autor de cualquier guarda.** El mismo día, en
`scripts/ci-verde.sh`, el mismo diseño: el contrato reserva `exit 2` para «no se pudo medir», la
guarda de `gh` ausente lo usa (`:30`), y el caso hermano —no se pudo leer el rollup, p. ej. un número
de PR equivocado— quedó en `exit 1`, indistinguible de un CI rojo (`:36`). Probado: `ci-verde.sh
999999` → exit 1, igual que un PR real corriendo. **Enumerá los casos de la clase; no parchees el que
dolió.**

**Test de 15 segundos, antes de confiar en cualquier contador.**
1. ¿El «no pude leer» va a la misma lista/contador que el resultado? ⇒ el total no sirve como control.
2. Rompé **cada** brazo por separado, no el parser entero, y exigí que el total **cambie**.
3. Un brazo que da **0 hits en la corrida normal** no está probado: no hay control que lo exija.

**El corolario que más cuesta.** El mismo fallback fabrica **acusaciones**: en esa corrida, **19 de los
20 huecos eran encabezados de tabla y filas de una tabla sin columna de veredicto** — inventados por el
parser, no defectos del documento. Un hueco es una afirmación sobre el sujeto, y hay que controlarla
igual que un veredicto. El fix de raíz es rastrear si el encabezado declara la columna antes de evaluar
sus filas.

Relacionadas: [[el-guard-falla-abierto-en-su-caso-de-activacion]] (el brazo `tabla-partida` fallaba
justo en la fila partida que le da nombre, por un backtick en la etiqueta) ·
[[un-mecanismo-roto-hacia-el-no-no-da-sintoma]] · [[instrumento-que-no-mira-nunca-falla]] ·
[[contar-un-simbolo-no-dice-en-que-rol-aparece]] · [[el-fix-ya-existe-en-otro-call-site]] (el mismo
defecto de encabezados vivía en dos parsers y el fix estaba escrito en uno) ·
[[vacio-no-es-hallazgo-correr-el-control]].

**Dónde está la evidencia:**
`docs/copiloto-emprendedor/Auditorias/2026-09-28-canario-del-contador-de-veredictos-el-brazo-nombrado-para-el-caso-es-el-que-lo-pierde.md`.


## Caso 2026-10-08 — el fallback de jq no cubría el string vacío, y el bucle de espera salió al primer intento

Para esperar el CI medí los checks con un `// "RUNNING"` sobre `.conclusion`. El bucle salió **al
primer intento** declarando «0 pendientes», y acto seguido el filtro de no-verdes contaba **5**.
Dos lecturas del mismo sujeto, contradictorias, **en el mismo comando**.

La causa: un check en curso trae `conclusion: ""` — **string vacío, no `null`**. El operador `//`
de jq sustituye `null` y `false`, así que `""` pasó tal cual y **no era igual a `"RUNNING"`**: mi
conteo de pendientes dio 0 porque buscaba una etiqueta que el fallback nunca llegó a aplicar.

El campo correcto existía todo el tiempo: `.status`, con `QUEUED` / `IN_PROGRESS` / `COMPLETED`.
Con él el bucle esperó las tres rondas que hacían falta y recién entonces mergeo.

**Regla:** un fallback sólo cubre el valor exacto que nombra. Antes de confiar en uno, preguntá
*¿cómo se ve este campo cuando el dato todavía no existe?* — `null`, el string vacío, el cero y la
clave ausente son **cuatro casos distintos**, y el mismo fallback los trata distinto.
