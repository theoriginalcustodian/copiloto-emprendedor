# La cifra que declara cerrado el criterio 3 es la que el instrumento rotula «NO es la cifra del criterio»

> **Rol:** AUDITORÍA. **Fecha:** 2026-10-05. **Entrega:** PR propio + `cierre_auditoria-a-planificacion_`.
> **Disparador:** no fue un pedido. Al cerrar el PR #791 vi los commits `feat(platconv)` y una clave
> `agregado_por_plataforma` en un JSON **que yo mismo había producido horas antes**. Mi doc recién
> mergeado afirmaba que el instrumento «no distingue plataforma». Fui a medirlo antes de dejarlo vivir.

---

## 1. Veredicto

**El `54 de 54 (100%)` que circula como cobertura del criterio 3 es la línea que el instrumento
rotula, en el mismo renglón, «agregado … NO es la cifra del criterio».** Recomputado desde los
tokens, la cifra del criterio por plataforma es **web 50 de 54** y **mobile 13 de 54**; la que el
acta pide —medido en web **y** en mobile— es **9 de 54**, y **8 de 54** si se exige comparación real
en ambas.

Y una consecuencia de proceso: **hoy esa cifra no es recomputable.** El instrumento de `main` aborta
con `rc=8` sobre el corpus vivo (1 documento sin clasificar). Mientras eso dure, **toda cifra del
criterio 3 que alguien cite es histórica**, no medida — incluida cualquiera de este documento.

---

## 2. Instrumento y corpus

- **Instrumento:** `scripts/evidencia/contar-veredictos.py`, blob **`fc44c4774ddf3416`**
  (`git cat-file -p fc44c477`). Es el mismo blob en `515d50f6` y en `cc0d8880` (= `main` al escribir):
  `git diff 515d50f6 cc0d8880 -- scripts/evidencia/contar-veredictos.py` sale **vacío**, así que la
  corrida de las **13:32:34** vale para el `main` de ahora. 173 560 bytes · 2591 líneas.
  **Cito el blob, no el commit:** un blob resuelve en cualquier clon aunque la rama se borre
  (es la lección de `527e5408`, §4.3).
- **Corpus:** congelado — **19 documentos medidos**, `medido_en 2026-10-05 13:32:34`.
  Se mide sobre congelado porque **el vivo aborta** (§1). Las dos preguntas son distintas y acá se
  responde la reproducible.
- **Padrón:** 54 ids. Control de consistencia: `web (50) + web_faltan (4) = 54 = web_techo_alcanzable`. ✅

---

## 3. Las cifras, recomputadas

| Unidad | Cifra | De dónde sale |
|---|---|---|
| **web** | **50 de 54 (92%)** | la única con techo, % y faltantes nombrados |
| web, con comparación real | **45 de 54 (83%)** | 50 − 5 declarados sin comparar |
| **mobile** | **13 de 54 (24%)** | lista publicada; **sin** techo, **sin** %, **sin** faltantes |
| mobile, con comparación real | **8 de 54 (14%)** | 13 − 5 declarados sin comparar |
| **web Y mobile** (lo que pide el acta) | **9 de 54 (16%)** | intersección de las dos listas publicadas |
| **web Y mobile, comparadas en ambas** | **8 de 54 (14%)** | −`onb-cumplida`, sin comparar en las dos |
| «ids con veredicto cerrado en **cualquier** plataforma» | **54 de 54** | ⚠️ el instrumento la rotula **«NO es la cifra del criterio»** |

Los **9** de web-y-mobile: `caida`, `card`, `card-cliente`, `card-cobro`, `card-presu`, `negocio`,
`onb-cumplida`, `onb-promesa`, `tablero`. **41 ids tienen web y les falta mobile.** Los 4 que faltan
en web (`cobro-voz`, `fact-voz`, `pres-voz`, `vozchat`) son **exactamente** los 4 que sólo existen en
mobile — simetría consistente, no un hueco.

**El instrumento no oculta nada:** imprime «`<- la que se cita este sprint (criterio 3 acotado a
web)`» y «`mobile 13 de 54 (sprint siguiente, con device/EAS)`». El acotamiento está escrito **en la
línea de al lado de la cifra**, por diseño declarado. Lo que se pierde es en el **viaje al tablero**:
`PLAN.md:28-46` cita `54 de 54 (100%)` sin la palabra «web» y sin el rótulo que la desautoriza.

---

## 4. Lo que corrijo DE MÍ MISMO

Tres cosas mías, las tres medidas hoy:

1. **«`contar-veredictos.py` no distingue plataforma»** — `A4-bis` §2.1 (30/09) y el bloque que yo
   mismo escribí en el índice en **#791 de hoy**. **Caducada:** el campo `agregado_por_plataforma`
   entró en **`515d50f6`**, el squash de #770, **hoy**. `git log -S` lo da en un solo commit.
   Lo incómodo: `515d50f6` es **el mismo SHA que cité como instrumento en #788**. Tuve la cifra de
   mobile en un JSON propio y no leí el campo.
2. **«Ninguna de las dos cifras mide mobile»** — #791. **Sobrevive con otro porqué:** hay una
   **lista** mobile (13 ids), pero no una **cifra** cerrable: `mobile_*` aparece **0 veces** en el
   instrumento contra **10** de `web_*` — sin techo, sin faltantes nombrados, sin acción.
3. **Mi fila `SELLONOCITABLE`: retiro la causa, conservo el síntoma, cambio la acción.** Afirmé que
   `instrumento.git_blob` «promete git y nunca resuelve porque se computa con `hashlib`». **Falso:**
   `:947-950` arma `b"blob " + len + b"\0" + contenido` y le hace `sha1` — **es** el formato de objeto
   de git, y hoy el sello publicado **resuelve exacto** contra `main`. Lo que rompe la resolución son
   los **line endings del checkout**: en Windows con CRLF el archivo en disco tiene otros bytes
   (173 664) que los almacenados (173 560), así que el hash es de un blob que no existe en el repo.
   **Acción nueva, de una línea:** normalizar a LF antes de hashear, o publicar los line endings al
   lado del sello. Es la clase `una-observacion-no-reproducida-se-degrada-a-observacion-no-se-retira`.

---

## 5. El aviso que acota la cifra no viaja en el JSON

El `⚠️ de los cuales N SIN comparación` se computa en **`:2483`**. El `--json` imprime y sale en
**`:2403`**. Son **80 líneas después del return**: quien consume el JSON —la suite y cualquier
automatización— se lleva `web: 50` y `mobile: 13` **sin el acotamiento**, y el dato por lote
(`ids_solo_no_comparacion_por_plataforma`) obliga a reimplementar el cruce.

**Esto es reincidencia de una clase que este mismo archivo documenta cuatro veces** (`:1756`,
`:2276`, `:2295`, `:2299`) como ya pagada: «el alcance de un dato no puede depender del formato de
salida, porque el formato que las máquinas leen es el que decide». El arreglo subió la cifra al JSON
y **dejó abajo el aviso que la acota**.

**Control positivo, y me señaló a mí:** reimplementé el cruce y me dio **18** ids sin comparar en
web. El reporte de texto —la implementación canónica— imprime **5**. **Divergí 3,6×**, y en mobile
coincidí exacto (5 = 5, misma lista), así que una verificación parcial me habría dado por bueno.
Es literalmente el riesgo que el docstring de `agregado_por_plataforma` predice: «dos
implementaciones de la misma cifra divergen, y la que divergió ya mandó a medir ids que estaban
medidos». Las cifras de §3 usan **las listas canónicas del instrumento**, no mi reconstrucción.

---

## 6. Filas para planificación

No tomo ninguna: son filas para asignar.

| id | Severidad | Qué | Acción propuesta | Dueño |
|---|---|---|---|---|
| `CIFRA3SINACOTAR` | **alta** | El `54 de 54 (100%)` de `PLAN.md:28-46` es la línea rotulada «NO es la cifra del criterio». La del criterio es web 50/54; la del acta, 9/54 | Citar la cifra **con su unidad y plataforma**, o citar el rótulo completo | planificación |
| `CIFRA3NORECOMP` | **alta** | El instrumento aborta `rc=8` sobre el corpus vivo ⇒ la cifra del criterio 3 **no es recomputable hoy**; toda cita es histórica | Es el mismo documento sin clasificar ya reportado. **Bloquea cualquier declaración de cierre del criterio 3** | planificación |
| `NCNOVIAJA` | media-alta | El aviso «N SIN comparación» vive en `:2483`, el `--json` sale en `:2403`. El JSON publica el numerador sin su acotamiento | Subir `cruzar_no_comparacion` arriba de `:2403` y publicarlo en `res` | planificación (dueña de `scripts/`) |
| `MEMORYHOME` | media | `MEMORY.md` dice «53 de 54 — falta `(home)`, nunca medida». `(home)` **está** en la lista web; los que faltan en web son **4** (`cobro-voz`, `fact-voz`, `pres-voz`, `vozchat`), nombrados por el instrumento con su acción | Reemplazar por la cifra con unidad | planificación |
| `MOBILESINCIERRE` | media | `mobile_*` = 0 ocurrencias vs `web_*` = 10: mobile no tiene techo, faltantes nombrados ni acción, así que su cifra no se puede cerrar con el mecanismo que cerró web | Decidir si mobile recibe el mismo mecanismo o si se declara explícitamente fuera del criterio este sprint | planificación |
| `SELLOCRLF` | baja | El sello `git_blob` es un blob-hash válido, pero se computa sobre el archivo **en disco**: en un checkout CRLF publica un hash inexistente en el repo | Normalizar a LF antes de hashear, o publicar los line endings | planificación |

---

## 7. Lo que medí y **NO** es hallazgo

- **El instrumento no engaña.** Rotula la línea agregada como «NO es la cifra del criterio», declara
  «criterio 3 acotado a web» pegado a la cifra, nombra los 4 faltantes y da la acción para cerrarlos.
  El defecto está en el **viaje de la cifra al tablero**, no en el lector.
- **La asimetría web/mobile no es un bug.** `mobile 13 de 54 (sprint siguiente, con device/EAS)` es
  coherente con la orden del operador de pasar device al sprint siguiente. Lo medible es que el
  criterio del acta pide ambas, no que mobile esté mal.
- **`indeterminada: 4`** (`card`, `card-cobro`, `card-presu`, `factura`) no infla ni desinfla: son
  veredictos cuya plataforma el lector no pudo leer, de ids que **además** tienen veredictos con
  plataforma. El instrumento ya los parte en accionables (16 con campo inline) y no accionables (4).

---

**Instrumento:** blob `fc44c4774ddf3416` · **árbol medido:** `cc0d8880` · **corpus:** congelado,
19 documentos, `2026-10-05 13:32:34` · **corpus vivo:** `rc=8`, no computable.
