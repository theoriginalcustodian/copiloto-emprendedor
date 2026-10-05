---
name: el-dod-que-escribi-estaba-mal-y-la-evidencia-lo-corrigio
description: Tres ítems de un DoD propio resultaron mal especificados al ejecutarlos — un flag cuya condición de pago era otra, un criterio numérico ya envejecido, y dos reglas de lint que gritaban en el caso normal. El DoD no es el oráculo; la evidencia sí.
metadata:
  type: feedback
---

**LEER al ejecutar un DoD propio, sobre todo si lo escribiste vos mismo hace poco.**

2026-07-28. Ejecutando un DoD de 14 ítems que yo había redactado, **tres** resultaron mal
especificados. Los tres se descubrieron sólo al tocar el código, no al planificar:

| Ítem del DoD | Lo que decía | Lo que la evidencia mostró |
|---|---|---|
| *"flag `MODO_AUTOMATICO_NO_DISPONIBLE` eliminado"* | que mi fix lo habilitaba | su condición de pago está **escrita en el código** y es otra: *"se retira cuando la CURA pase el retest adversarial en sesión limpia"*. Mi fix tocaba el guardrail, no la cura |
| *"CI corre 92/92 py y 96/96 ts"* | números del análisis | el universo real era **108 y 155**. Los números ya habían envejecido entre que se midieron y que los escribí |
| *"ESLint con `no-empty`, `no-floating-promises`, `require-await`"* | tres reglas | `require-await` marcaba 8 funciones `async` sin `await` que devuelven promesa **por contrato**; `no-floating-promises` exige type-aware linting (otro orden de costo) |

**Por qué pasa, y por qué es sistemático.** Un DoD se escribe *antes* de tocar el código — es su
razón de ser. Eso lo hace útil (fija el criterio antes de que el esfuerzo invertido lo distorsione) y
a la vez lo condena a apoyarse en supuestos: qué habilita un flag, cuántos archivos hay, qué reglas
son razonables. Cuando el ítem se ejecuta, esos supuestos se contrastan **por primera vez**.

**El error a evitar no es escribir un DoD imperfecto: es honrarlo contra la evidencia.** Las dos
formas de fallar:

- **Cumplirlo a ciegas.** Eliminar el flag "porque el DoD lo dice" habría habilitado un modo cuya
  cura no está verificada. El DoD no es el oráculo — la prueba lo es.
- **Abandonarlo en silencio.** Que un ítem sea inejecutable no autoriza a saltearlo sin dejar
  registro; ahí es donde nace la deuda invisible.

**Qué hacer.** Al toparte con un ítem que no cierra como está escrito: (1) **decilo en el momento**,
antes de ejecutarlo, no en el reporte final; (2) corregí el ítem **con la evidencia al lado** (el
`grep`, el conteo, el comentario del código que fija la condición); (3) dejá el desvío escrito en el
plan, no sólo en el commit. Un DoD corregido con evidencia es mejor que el original; uno cumplido
contra la evidencia es peor que ninguno.

**Y el criterio que más rinde, aprendido acá:** *un cierre expresado como número envejece; uno
expresado como propiedad, no.* «92/92 tests» caduca en cuanto alguien agrega un archivo — y peor,
caduca **en silencio**, dando verde. «**todos** los tests que existan» sigue siendo verdad para
siempre. Vale para conteos de archivos, de endpoints, de workflows: preferí la propiedad al número
cada vez que puedas. Fue exactamente una lista hardcodeada de 11 archivos la que dejó
`test_errores_web.py` —el guard de los códigos de error— fuera del CI durante meses.

Hermana de [[lo-que-no-esta-en-la-tabla-de-hitos-no-existe]] (el registro manda) y de
[[el-guard-que-grita-en-el-caso-normal-se-desarma-solo]] (de ahí salió descartar las dos reglas de
lint en vez de dejarlas rotas).

---

## Refuerzo 2026-10-05 — el DoD cuyo numerador NO PUEDE subir con el trabajo que asigna

Variante peor que la original, porque no se ve como un error de redacción sino como falta de avance.

Escribí: *«DoD: el contador imprime `web 54/54` y `indeterminada 0`»*, asumiendo que cerrar
indeterminadas subía la cifra web. **No la sube:** completar la `plataforma` de un id que ya contaba
como web no agrega ningún id nuevo. Dos sesiones completaron 27 filas — `indeterminada` 12→9, filas de
tabla 35→8 — y `web` quedó clavada en **49**. Trabajo real, numerador quieto.

Y al nombrar los 5 que faltaban, **4 eran incerrables por diseño**: `cobro-voz`, `fact-voz`,
`pres-voz`, `vozchat` son dictado, medidos en mobile, sin referencia de prototipo de escritorio. El
techo real era **50**, no 54. El DoD exigía un número **que no existe**.

**La pregunta que lo caza, y hay que hacerla al ESCRIBIR el DoD, no al cerrarlo:**
*¿el trabajo que estoy asignando mueve este numerador? ¿y cuál es su techo ALCANZABLE?*

Dos síntomas que ahora leo como esta clase:
- un frente donde todos reportan trabajo hecho y la cifra no se mueve → el DoD mide otra cosa;
- un instrumento que publica el **número** sin los **sujetos** (decía «49 de 54» sin nombrar los 5).
  Sin los nombres nadie puede cerrarlos **ni descubrir que son incerrables** — el techo falso sobrevive
  porque nadie puede auditarlo. Ver [[instrumento-que-no-mira-nunca-falla]].
