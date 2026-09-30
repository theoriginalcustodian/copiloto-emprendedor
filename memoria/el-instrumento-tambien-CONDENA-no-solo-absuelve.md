---
name: el-instrumento-tambien-CONDENA-no-solo-absuelve
description: Un instrumento roto no sólo da falsos verdes — también da falsos ROJOS, y ese error se siente como rigor
metadata:
  type: feedback
---

**Un instrumento mal hecho puede equivocarse en las DOS direcciones sobre la misma pregunta — y el
falso rojo es más difícil de cazar que el falso verde, porque se siente como rigor.**

**El caso (2026-07-29, retest del modo automático).** Un script medía si el copiloto sigue afirmando
acciones que no ejecutó, comparando el texto contra los `execute_tool` del history de Temporal. Tres
versiones, tres veredictos, sobre exactamente la misma realidad:

| | Dijo | Realidad |
|---|---|---|
| v1 | ✅ *"0/3, la cura sostiene"* | Las 3 rondas reventaron con `KeyError: 'text'` (el campo es `reply_text`) y el `except` las contaba como no-mentira → **no midió nada** |
| v2 | 🔴 *"1/3 mentiras"* | El contador buscaba `.endswith("ActivityTaskCompleted")`; el `eventType` real es `EVENT_TYPE_ACTIVITY_TASK_COMPLETED` → **daba 0 siempre** → toda afirmación parecía mentira |
| v3 | ✅ *"0/10"* | Contador validado: 2 `execute_tool` por sesión, filtrado por nombre de activity |

Con v1 se levantaba un flag de producto a ciegas. Con **v2 se dejaba puesto un flag que bloquea una
feature, y se declaraba fallida una cura que funciona** — durante meses, con toda la apariencia de
estar siendo prudente.

**Por qué el falso rojo es el más peligroso de los dos.** Un falso verde choca tarde o temprano con la
realidad: el bug aparece, el usuario se queja, algo se rompe. **Un falso rojo nunca choca con nada** —
la feature queda apagada, nadie la usa, no hay síntoma. Y encima se lleva bien con la propia
disciplina: *"lo mantengo bloqueado porque no tengo evidencia"* suena exactamente igual siendo
correcto que siendo el producto de un contador roto. [[instrumentos-que-confirman-en-vez-de-verificar]]
cubre el verde falso; esta cubre el rojo falso, que no tiene quien lo denuncie.

**El control, y es uno solo para las dos direcciones:** antes de creerle un veredicto a un
instrumento, preguntarle **qué mediría si la respuesta fuera la contraria**. Concreto:

- ¿Este contador **alguna vez cuenta**? Correrlo contra un caso donde el valor conocido **no** es cero.
- ¿Cuántas unidades **miró**, aparte de si pasó? Una corrida que revienta **no es evidencia de nada**:
  tiene que invalidar el veredicto entero, no contarse como "sin problema"
  ([[instrumento-que-no-mira-nunca-falla]]).
- ¿El nombre que estoy buscando **existe** en el dato real? El `eventType` no era el que yo suponía —
  y suponerlo por analogía es el mismo error que [[vacio-no-es-hallazgo-correr-el-control]] nombra.

**El arreglo va en el script, no en la cabeza de nadie.** En este caso quedaron horneados: una ronda
que revienta hace `return 2` (veredicto **inválido**, no "aprobado"), y el contador filtra por el
nombre exacto de la activity. La versión que te engañó no se olvida sola: si el arreglo vive en tu
memoria y no en el código, la v4 vuelve a mentir.

---

## El recorte del campo de visión no te hace PERDER el hallazgo — te hace SOBREESTIMARLO (2026-09-29)

Los dos casos de arriba son contadores rotos. Este es otro mecanismo con el mismo falso rojo: el
instrumento mide bien **lo que ve**, y lo que exculpa vive **afuera del recorte**.

**El caso.** Barriendo los comentarios del prototipo Odobi, estuve a punto de entregar un hallazgo
🔴 ALTA: «el proto afirma cumplir WCAG 2.5.1 con un checkbox que no existe». Verificado: el checkbox
no existe (`grep -c 'type="checkbox"'` = 0). Y el hallazgo era **falso**, porque la alternativa de un
solo puntero sí existe y está cableada — es `.borrar`, con markup y handler.

Dos recortes distintos, la misma dirección del error:

| recorte | qué devolvió | dónde estaba la exculpación |
|---|---|---|
| `sed -n '1425,1429p'` sobre un comentario de **7** líneas | las 5 primeras, que se leen como un texto completo | la línea **6**: «la alternativa de un solo puntero que exige WCAG 2.5.1 pasa a ser **"Borrar" dentro de la tarjeta expandida**» |
| el **rango** `1951‑3899` de un barrido partido en dos | el hallazgo correcto en el hecho (`:3852` nombra un checkbox inexistente) y **excesivo en la conclusión** | `:1427`, en el **otro** rango — que dice a dónde se mudó el mecanismo. El barrido que sí lo tenía lo clasificó **CONSISTENTE** |

Las dos mitades acertaron por separado. **El sentido sólo aparece en el par**, y ningún barrido tenía
el par. El hallazgo caminó 🔴 ALTA → 🟠 MEDIA → 🟡 BAJA, y cada paso salió de leer *más del archivo
real*, no de pensarlo mejor.

**Por qué este falso rojo es especialmente convincente:** el grep que lo sostiene es **verdadero**.
No hay contador roto que auditar ni nombre mal escrito que descubrir — «no existe ningún checkbox en
las 3899 líneas» es un hecho, medido bien, con control positivo y negativo que discriminan. Lo que
falla no es la medición: es el **salto** de «no existe X» a «no se cumple el requisito que X servía».
[[probar-que-el-instrumento-miente-no-te-exime-de-leer-lo-que-senala]] es el espejo de esto.

**Los controles, y son baratos:**

- Cuando la evidencia es un **bloque de prosa**, leé hasta su **delimitador de cierre** (`*/`, `-->`,
  la línea en blanco), **nunca hasta un número de líneas**. Un `sed -n 'A,Bp'` sobre un contrato de
  largo variable lo trunca y sale exit 0.
- Antes de escribir una conclusión que **tu recorte no puede verificar**, grepeá el **archivo entero**
  por el mecanismo que el sujeto nombra. Si la conclusión es «esto no se cumple», el sujeto de la
  búsqueda es el **requisito**, no el control que lo implementaba.
- **Quien parte un barrido se queda con la costura.** Un sub-agente por rango no puede ver la
  contradicción ni la exculpación que viven en otro rango; eso no se delega, se reconcilia arriba.
  Pedirle al barrido que además declare «qué no pude ver» es más útil que pedirle más cobertura.

Evidencia: `docs/copiloto-emprendedor/Auditorias/2026-09-29-barrido-comentarios-proto-odobi-y-el-recorte-que-sobreestima.md` §0 y §4.
Prima de [[dos-decisiones-correctas-que-se-cruzan-en-un-agujero]] (ahí el hueco vive en el par de
decisiones; acá el **sentido** vive en el par de fragmentos) y de
[[una-cifra-que-coincide-con-la-fuente-independiente-puede-coincidir-por-compensacion]] (ahí lo que
engaña es el agregado; acá, el fragmento).

---

## Tercera faz (2026-09-30): el cebo del control positivo entra por la puerta que el guard abre a propósito

El falso rojo no siempre viene de un recorte. Puede venir del **control positivo mal construido**, y
entonces el instrumento condena justo al sujeto que estaba **bien**.

**Caso.** Escribí un canario que cruza los 54 ids del padrón del criterio 3 contra el lector que los
parsea (`memoria/vacio-no-es-hallazgo-correr-el-control.md` es su abuela). Su control positivo usaba un
cebo con forma imposible, `((cebo-del-canario))`, y lo pasaba **dentro de `ids`** para poder buscarlo.
Sobre el parser viejo dio bien. Sobre el parser **arreglado** (#742) el cebo salió **legible**, el
control se declaró roto y el canario devolvió `exit 2` — *precondición faltante* — sobre el único lector
que leía los 54 ids correctamente.

**Y el parser tenía razón.** Su fix reconoce los tokens que el padrón **declara**; al meter el cebo en
el padrón, **yo lo había declarado**. El cebo no era imposible: lo autoricé. El control entró por la
misma puerta que el guard abre a propósito, así que no medía la ceguera del lector: medía la lista
blanca que yo mismo había ampliado.

**La regla:** *un guard condicionado a una lista blanca no se puede probar metiendo el cebo en la lista
blanca.* Cuando el mecanismo bajo prueba es «acepto lo que la fuente declara», el control positivo no
puede consistir en declarar algo nuevo — eso ejercita el camino del **sí**, no el del **no**.

**El control que sí sirve:** inyectar un **lector ciego** (monkeypatch del parser devolviendo vacío) y
exigir que **los 54 de 54** salgan ilegibles. Así el control mide al canario, no al parser, y vale con
cualquier lector — incluido uno que todavía no existe. Verificado en las dos direcciones: `main` →
`exit 1` nombrando `['(home)']`; #742 → `exit 0`, `0 de 54`.

**Cómo detectarlo antes de pagarlo:** preguntá *¿mi cebo llega al instrumento por el mismo canal que el
instrumento está autorizado a aceptar?* Si la respuesta es sí, el control no discrimina. Hermana de
[[un-mecanismo-roto-hacia-el-no-no-da-sintoma]] (allá falta el control positivo; acá **existe y apunta al
lado equivocado**) y de [[el-guard-que-caza-a-su-propio-autor]].
