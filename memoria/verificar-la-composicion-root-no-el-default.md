---
name: verificar-la-composicion-root-no-el-default
description: "Afirme que el copiloto va por OpenRouter leyendo el DEFAULT_PRIMARY del motor; la composicion root (worker_b.py) lo sobreescribe con OpenAI directo. LEER cuando un contrato o decision dependa de una configuracion: verificar donde se ARMA el sistema, no la capa que declara el default."
metadata:
  node_type: memory
  type: feedback
---

**Leer el default de una capa plantilla y reportarlo como lo que corre en producción es codificar la
esperanza con `Read` de por medio.** El `Read` da la sensación de haber verificado; lo que se verificó
es otra cosa.

**El caso (2026-07-21).** Al pedir el spike de OCR escribí *«el motor va por OpenRouter, así que un
modelo con visión es cambiar el string»*. Lo saqué de `motor/clients/agent/providers/llm.py`:
`DEFAULT_PRIMARY = "deepseek/deepseek-v4-flash"`. **Falso.**
`apps/copiloto/worker_b.py:78-81` —la composición root, donde el copiloto arma su motor— lo
sobreescribe: **OpenAI directo, `gpt-4o-mini`, `OPENAI_API_KEY`**. En el VPS **no existe**
`OPENROUTER_API_KEY`.

La conclusión práctica sobrevivió de casualidad —no hacía falta proveedor nuevo— pero **por otra
puerta**: misma key de OpenAI, y `gpt-4o` ya acepta imágenes. Si el spike hubiera dependido de mi
afirmación, habría arrancado dando de alta una cuenta que no se necesitaba.

**Por qué pasa, y por qué es sistemático y no un descuido:** una arquitectura con boundaries —que es
la que este repo quiere— **separa a propósito** la capa que declara un default de la que lo elige. El
motor vendorizado trae su valor de fábrica; el cliente lo configura. Grepear el nombre del parámetro
encuentra **primero** la declaración, que es la que se lee como «acá está definido». La inyección de
dependencias, que existe para permitir el override, es también lo que vuelve invisible que hubo uno.

**Regla:** cuando un contrato, una estimación de costo o una decisión dependa de una configuración,
verificar **dónde se arma el sistema** —la composición root, el `worker`, el `main`, el
`create_app()`— y no la capa que declara el default. Y cuando se pueda, mirar el **proceso vivo**
(env del servicio, `systemctl show`, el propio log de arranque): eso no tiene default que valga.

**Y el error de método vale más que el dato:** es el mismo animal que
[[instrumentos-que-confirman-en-vez-de-verificar]] — el instrumento contestó **una pregunta más fácil
que la real**: «¿qué dice el default?» en vez de «¿qué corre en producción?». Nadie miente; la
respuesta correcta a la pregunta equivocada se siente idéntica a la verdad.

[[no-codificar-la-esperanza-principio-raiz]] [[copiloto-motor-react-concatenadas]]

---

## Refuerzo 2026-10-15 — el ARCHIVO de configuración no es la composición root, y paré a dos sesiones por eso

Mismo defecto, versión caro: emití un `urgente_` que **prohibía medir en device** a las dos sesiones
de frontend, fundado en que el harness se logueaba con un tenant equivocado. La evidencia que tenía
era el **archivo**: leí `~/.claude/secrets/copiloto-e2e.env`, vi el usuario viejo, y concluí el
comportamiento.

**El harness había dejado de leer ese archivo nueve horas antes** (#1217, `8fe59a1e`). El camino real
es `scripts/evidencia_device.py:360-385` → `ruta_env_e2e()` → `.env.e2e`, con guard **fail-closed**
que aborta si el email no es el canónico. O sea no sólo no leía el archivo que yo miré: era
**estructuralmente incapaz** de loguear otro tenant en silencio. Y el docstring de la función nombra
mi error con todas las letras — dice que *antes* leía ese archivo «que nadie mantenía».

🔑 **La forma, que es la de esta entrada pero con un archivo en lugar de un default:** un archivo de
config es una **entrada posible**, no el sujeto. El sujeto es **quién lo lee hoy**. Un archivo
abandonado se ve idéntico a uno vigente: tiene el nombre correcto, está en el lugar correcto, y su
contenido es plausible. Lo único que lo distingue es que **nadie lo abre**, y eso no se ve mirándolo.

**Lo que hubiera costado 30 segundos:** `grep -rn "copiloto-e2e.env" .` — el único hit vivo era un
docstring que decía «lo leía». Medir el **lector**, no el archivo. Es la misma operación que ya está
escrita en [[el-guard-se-satisface-con-su-propio-comentario]] («grepeé la BANDERA, no la
CAPACIDAD»): cuando concluís sobre comportamiento, el inventario correcto es de **llamadores**.

**Y el agravante que lo hace tipo `feedback` y no `project`:** una afirmación de configuración puede
**parar trabajo ajeno**. La asimetría importa — un `dato_` equivocado se corrige solo cuando alguien
lo contradice, pero un `urgente_` que ordena **no medir** produce quietud, y la quietud no da síntoma
([[una-espera-sin-disparador-nombrable-es-paralisis]]). Antes de emitir una parada fundada en
configuración: medí el **efecto** en el camino real (correrlo y ver qué usa), no el estado del
archivo. Lo contrario es codificar la esperanza en dirección pesimista.

Quien me contradijo tenía razón y lo había medido por efecto (el guard pasó y entró a la cuenta
canónica). **Verificar antes de aceptar la corrección fue correcto; haberla necesitado, no.**
