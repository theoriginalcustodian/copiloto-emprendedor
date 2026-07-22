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
