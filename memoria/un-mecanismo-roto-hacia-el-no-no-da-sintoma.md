---
name: un-mecanismo-roto-hacia-el-no-no-da-sintoma
description: El gate de no-regresión nunca corrió un solo test en producción — `python3` sin pytest. Nadie lo notó porque falla hacia RECHAZAR: no propuso nada malo, sólo era incapaz de aceptar. Todo mecanismo fail-closed necesita un control positivo que pruebe que sabe decir SÍ.
metadata:
  type: project
---

# 🔇🚫 Un mecanismo de seguridad roto hacia el "NO" no da síntoma

El primer E2E real del ciclo de auto-reparación (2026-08-01) devolvió esto:

> `rechazado_por_tests` — *"NO_EVALUABLE: la suite ya estaba roja SIN el parche (0 fallaron, 0
> errores)"*

Una frase que **se contradice sola**: roja con cero fallos. Tirando de ahí aparecieron tres cosas, y
la tercera es la que importa.

## Lo medido

1. **El intérprete.** `python = os.environ.get("COPILOTO_SANDBOX_PYTHON", "python3")`. El worker
   corre bajo systemd con `PATH=/usr/local/sbin:…:/usr/bin` —**sin el venv**—, así que `python3` era
   `/usr/bin/python3`, que responde `No module named pytest`. El subproceso moría antes del epílogo,
   no dejaba ninguna línea de conteo, y el parser devolvía ceros.
   → **El gate de no-regresión nunca corrió un solo test en producción.**
2. **El sandbox estaba incompleto.** Copiaba `apps/copiloto` + `motor`, pero dos tests importan
   `provision_tables`, que vive en `deploy/worker`. Sin ese subárbol pytest **corta la colección**:
   0 recolectados. Con él, 1277 passed. Era la misma lista que `sync-test-backend.sh` ya usaba; el
   sandbox se había quedado con dos de los tres.
3. **El mensaje mezclaba dos causas opuestas.** *"Estaba roja"* y *"no llegó a correr"* piden
   arreglos distintos —uno mira los tests, el otro el intérprete y el `PYTHONPATH`— y salían con la
   misma frase. Mandó la primera investigación al lugar equivocado.

## La regla

**Todo mecanismo que falla hacia el "no" necesita un control positivo que pruebe que sabe decir
"sí".**

Fail-closed es la postura correcta para un gate: ante la duda, no aprobar. Pero tiene un precio que
no se ve — **su propia rotura es indistinguible de su funcionamiento normal**. Un gate mudo no
propone parches malos, no rompe nada, no genera incidente. Sólo es incapaz de aceptar. Y nadie
investiga un "no": se lee como prudencia, o como que todavía no apareció el caso.

Esto pasó **dos veces el mismo día**, en dos piezas distintas del mismo ciclo:

| Pieza | Rotura | Cómo se veía |
|---|---|---|
| **Auditor** | juzgaba sin ver la causa → rechazó 3/3 el parche correcto | "es conservador" |
| **Gate de tests** | `python3` sin pytest → `NO_EVALUABLE` siempre | "no encontró nada reparable" |

La diferencia entre las dos: **el auditor tenía control positivo** —`test_REAL_el_auditor_no_rechaza_TODO_por_reflejo`,
que le pasa un parche bueno y exige que lo apruebe— y por eso su sesgo se pudo acorralar. El gate de
tests no tenía ninguno: nada afirmaba nunca *"el gate aceptó algo real"*.

## Por qué el banco daba 12/12 y 3/3 con el gate de producción mudo

`scripts/medir_c0_autosanacion.py:311` ya declaraba `--python default=sys.executable`. **El banco
ejercitaba el ciclo con el intérprete correcto; producción usaba otro.** Las dos rutas divergían
exactamente en el parámetro que estaba roto, así que ninguna medición del banco —por buena que fuera,
y era buena: 12/12 de consistencia, 3/3 de amplitud, contra el LLM real— podía enterarse.

Es [[el-test-que-no-usa-el-camino-de-produccion-no-puede-verlo-fallar]] otra vez, y en su forma más
incómoda: no fallaba el banco ni la suite, fallaba **el único parámetro que el banco elegía por su
cuenta en vez de heredar**. Cuando un instrumento tiene que *elegir* algo que producción también
elige, esa elección es una junta — y las juntas son de nadie.

Barrido posterior: no hay otro `"python3"` hardcodeado en el repo (`apps/`, `deploy/`, `scripts/`,
`motor/`), así que el arreglo es de raíz y no un parche puntual.

## Y el criterio del propio E2E era demasiado flojo

`DESENLACES_QUE_PRUEBAN` incluía `rechazado_por_tests`, que el gate devuelve **tanto cuando midió y
rechazó como cuando no pudo medir**. La corrida salió con un `✅` grande y el gate mudo. Corregido:
un motivo con `NO_EVALUABLE` ya no cuenta como prueba, por más que el estado esté en la lista.

Es la misma trampa que la del banco de casos reales unas horas antes: **un solo veredicto cubriendo
dos realidades opuestas**. Cuando un resultado puede significar "funcionó" o "ni se ejecutó", no es
un resultado.

## Al revisar cualquier gate, guarda, validador o filtro

Preguntá las dos, no una:

- *¿Qué devolvería si lo que vigila estuviera roto?* (la de siempre)
- **¿Qué devuelve si ÉL está roto?** Si la respuesta es "lo mismo que cuando funciona y dice que no",
  falta el control positivo.

## Hermanas

- [[instrumentos-que-confirman-en-vez-de-verificar]] — la cara espejo: el instrumento que siempre
  absuelve. Este siempre condena.
- [[el-instrumento-tambien-CONDENA-no-solo-absuelve]] — el falso rojo no choca con nada.
- [[al-juez-tambien-hay-que-darle-el-plano]] — el otro caso del mismo día, misma forma.
- [[instrumento-que-no-mira-nunca-falla.md]] — "0 recolectados" es no mirar.
