---
name: un-control-positivo-con-esperado-falso-acusa-al-script
description: Cuando un control positivo falla, la salida barata es ajustar el valor esperado hasta que aparezca el verde, y eso convierte el control en una tautología; el esperado también puede estar mal
metadata:
  type: feedback
---

# 🎯🔧 Un control positivo con ESPERADO FALSO acusa al script — y la salida barata lo vuelve tautología

Un control positivo tiene **dos** partes que pueden estar mal: el instrumento y el **valor esperado**.
Cuando el control falla, el reflejo es «el script está roto» y el arreglo barato es **mover el esperado
hasta que pase**. Ahí el control deja de medir: confirma lo que ya se creía.

**Por qué importa más que un bug normal:** un control ajustado a su propio resultado **se ve igual que
uno que funciona** — verde, reproducible, con evidencia. Es la misma familia que
[[el-guard-que-caza-a-su-propio-autor]] y [[instrumento-que-no-mira-nunca-falla]], con la diferencia de
que acá el que se corrompe es el **criterio**, no el sensor.

## El caso (2026-09-28)

Auditoría horneó **mi** afirmación —«`mic-funcion` se monta en 8 pantallas»— como control positivo de
`scripts/evidencia/anclas-ambiguas.py`. El script abortó en la primera corrida: daba **4**.

**No tocó el umbral.** Fue a ver cuál de los dos estaba mal, y era mi esperado:

- `Bubble.tsx:18` y `MicButton.tsx:12` **nombran `MicFuncion` en un comentario**, con cero `<MicFuncion`.
- `ChatScreen.tsx` y `FotoFuncion.tsx` aparecen en el grep y tampoco lo montan.
- Montajes JSX reales: `ClientesScreen` · `GastosScreen` · `IngresosScreen` · `PresupuestosScreen` = **4**.

Mi 8 era [[contar-un-simbolo-no-dice-en-que-rol-aparece]] otra vez, y estaba **en un contrato**, donde
otra sesión iba a usarlo para decidir un arreglo. Un ancla falsa en un contrato es peor que ninguna.

## La regla

Cuando un control positivo falla, **antes de tocar el script preguntá de dónde salió el número
esperado**: ¿lo midió alguien, o lo escribió alguien? Un esperado que viene de una afirmación en prosa
—un contrato, un doc, un mensaje— es **tan hipótesis como el código**. Si el esperado lo puso una
autoridad (el que dirige, el contrato, el ADR), la presión social empuja a ajustar el script: ese es
justo el momento de mirar el esperado primero.

Corolario para quien escribe los contratos: **poné el `path:línea` del que mediste, no el número
suelto.** Un número sin ancla no se puede refutar sin rehacer el trabajo.

## Refuerzo 2026-10-06 — un control que HEREDA su condición del entorno mide el entorno, no el código

Agregué un cap de workers al gate que se aplica **sólo fuera de CI** (`[ -z "${CI:-}" ]`), y con él un
control positivo: «el cap llega a las dos llamadas de jest». **Verde en la PC, ROJO en Actions.**

El rojo no era del código: en Actions el runner exporta `CI=1`, así que el cap estaba ausente **con
razón** — exactamente lo que el cambio especifica. Lo que estaba mal era el control, porque **heredaba
`CI` del ambiente** en vez de fijarlo. Medía *dónde corre el test*, no *qué hace el script*. Y acusaba
al script, que era correcto.

**La asimetría que lo hace fácil de no ver:** el caso negativo gemelo (`CI=1` ⇒ sin cap) **sí** fijaba
su condición, porque para escribirlo tuve que ponerla explícita. El positivo no la fijó justo porque en
mi máquina la condición ya era la del ambiente — el entorno de desarrollo **regala** el caso positivo y
por eso no se nota que falta declararlo. El control más frágil es el que coincide con tu default.

**Regla:** todo control fija la condición que dice probar, incluida la que ya es verdad donde lo
escribís. Si una variable de entorno decide la rama bajo prueba, va en la invocación del caso
(`CI= bash …` / `CI=1 bash …`), nunca heredada. El criterio operativo es el de siempre: **¿en qué
mundo saldría distinto?** Si la respuesta es «en otra máquina», el control no está fijando nada.

Relacionadas: [[verificar-la-composicion-root-no-el-default]] ·
[[el-canario-tiene-que-ser-tan-nuevo-como-lo-que-buscas]] ·
[[un-mecanismo-roto-hacia-el-no-no-da-sintoma]]
---

## Refuerzo 2026-10-06 — El esperado falso es un DETECTOR, no sólo un error: tres en un turno, y uno destapó un hallazgo

Tres veces en un mismo turno un control mío dio un número distinto al que había escrito como esperado, y
las tres veces lo correcto fue **ir a mirar las N apariciones**, no corregir el número:

| control | esperado | dio | qué era |
|---|---|---|---|
| `«quedan 2 campos, no 3»` sobrevive al fix del mensaje | 0 | 1 | la **cita** que lo refuta, dentro de la corrección |
| el refuerzo llegó a `main` (grep de una frase) | >0 | 0 | la frase era otra; el archivo estaba **idéntico** (diff 0, bytes iguales) |
| `mp_connected` aparece 1 vez (sólo en el helper) | 1 | **4** | 1 docstring + 1 helper + **2 de otro endpoint** |

El tercero es el que importa. Bajar el esperado de 1 a 4 habría cerrado el control con un verde y el turno
habría seguido. Ir a ver las 4 mostró que `/catalog` calcula `mp_connected` con **otra expresión** que
`/me` (`salud() == "conectado"` vs `first_seller_user_id() is not None`) y que **divergen en el caso de la
conexión caída** — un hallazgo de producto que ningún test buscaba, encontrado por un control mal escrito.

**La regla que suma a esta entrada:** un esperado que no coincide tiene **dos** explicaciones —el código
está mal, o **el control está mal**— y la segunda no es una molestia administrativa: es un lugar donde tu
modelo del archivo no coincide con el archivo. **Ese desacuerdo es el hallazgo potencial.** Así que el
orden es siempre: *ver las N apariciones una por una* → recién entonces decidir si se corrige el código, el
esperado, o si acabás de encontrar algo. Ajustar el número primero destruye la única pista.

Y el corolario sobre los esperados en mensajes: cuando corregís una afirmación **citándola**, el grep de la
afirmación vieja da ≥1 **para siempre**, porque la corrección la contiene. Ese control hay que escribirlo
contra la **afirmación en su contexto original**, no contra la cadena suelta.

Relacionadas: [[el-fix-ya-existe-en-otro-call-site]] · [[instrumento-que-no-mira-nunca-falla]] ·
[[un-gate-cuyo-alcance-depende-del-formato-de-salida-no-es-un-gate]]

## Refuerzo (2026-10-06): el marcador que da el MISMO valor en los dos estados

Hoy la clase me pegó a mí, con una variante **peor** que el esperado falso: no ajusté un esperado,
**inventé un marcador y nunca le hice control positivo**.

Para probar que prod servía un build viejo usé tres marcas grepeadas en el VPS. Dos eran buenas
(`_campos_legales` y `legal_version_aceptada`, que pasaron de 0 a 3 y 2 con el deploy). La tercera era
`acciones` en `tool_catalog.py` → **0**, y la leí como «el backend nuevo no está ». **Ese nombre no
existe tampoco en `origin/main`** (medido: 0 en los dos lados). O sea: habría dado 0 **después de un
deploy perfecto**. El símbolo real de A8 vivía en `apps/copiloto/catalog.py` (5 y 5).

**La diferencia con el caso de arriba, y por qué esta forma es más difícil de ver:** un esperado
falso **falla** y te obliga a mirar. Un marcador que no discrimina **no falla nunca** — devuelve el
valor que confirma la hipótesis y se lee como medición. El 0 era **verdadero**; lo que era falso es
que signifique algo.

**La pregunta que lo caza, antes de citar cualquier marcador:** *¿qué valor daría este marcador si
la hipótesis fuera FALSA?* Si la respuesta es «el mismo», no es evidencia. Es el control positivo
aplicado al **marcador**, no al script: dos lados, dos valores distintos, o no sirve.

**Y el cierre que importa igual: refutar un marcador no refutó el hallazgo.** Prod **sí** estaba
viejo —lo probó el bundle del 30/09 y las otras dos marcas— y el deploy destapó tres defectos
reales. Degradar el marcador no degrada la conclusión si la sostenía otra evidencia; lo que se
retira es la **causa citada**, no la observación. Ver
[[probar-que-el-instrumento-miente-no-te-exime-de-leer-lo-que-senala]] y
[[una-observacion-no-reproducida-se-degrada-a-observacion-no-se-retira]].

**Lo cazó backend, no yo** — midió el marcador que le di en vez de cumplirlo, y reportó «el
criterio del contrato no se puede cumplir tal como está escrito». Un dueño que verifica el criterio
que recibe es el último control que queda cuando el que lo escribió no le hizo ninguno.
