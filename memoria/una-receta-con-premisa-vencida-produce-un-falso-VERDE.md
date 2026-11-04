---
name: una-receta-con-premisa-vencida-produce-un-falso-VERDE
description: Cuando una receta de verificación declara el estado esperado, una premisa vencida convierte el defecto en el resultado esperado y la evidencia sale verde POR el bug.
metadata:
  type: feedback
---

**Una receta de verificación con una premisa vencida no da un falso rojo: da un falso VERDE.**

Medido el 2026-11-03. frontend2 bajó una receta de capturas de device impecable —ruta, estado
previo, gesto, archivo de salida y «qué debe verse» por ficha— y en `SM-N35` declaró: *«hoy backend
no persiste la categoría, así que la captura reabierta esperada es Sin definir»*. Persistía de punta
a punta desde `4a5bb923` (#1469): `afip_web.py:90-99` recibe y `:235-238` valida A…K ·
`afip_credential_store.py:254-273` la escribe en el UPSERT · `:279-291` el `SELECT` la devuelve ·
`packages/core/src/api/afip.ts:588-636` traduce snake↔camel. La premisa era de **un día antes** del
merge que la invalidó.

**Why:** una receta es poderosa justamente porque dice **qué tiene que verse** — sin eso, el que
captura no puede acreditar nada. Pero ese mismo campo es el que invierte el signo del error: con
«Sin definir» declarado como esperado, una pantalla que mostrara «Sin definir» **por un defecto
real** habría cerrado el DoD. Un falso rojo se investiga; un falso verde **nadie lo revisa**, porque
parece trabajo terminado. El riesgo no vive en las premisas obvias sino en las que el autor escribió
con razón ayer y quedaron vencidas por un merge de otra sesión.

**How to apply:**
- Toda premisa de una receta se escribe **con su medición y su sha**, no con su conclusión. «Backend
  no persiste» es una conclusión; «`afip_web.py:90` no tiene el campo @`<sha>`» se puede re-verificar
  en un grep.
- Antes de **ejecutar** una receta ajena, re-medí los «esperado» que dependen de otra sesión. Lo que
  no depende de nadie más no hace falta re-medirlo.
- La receta es correcta igual: no se descarta por esto, se le corrige el punto. Es el patrón de
  [[gate-de-device-se-corre-con-receta-no-con-ventana-viva]], que sigue siendo el que destraba el
  cuello del device.
- Síntoma hermano, mismo día: `packages/core/src/api/afip.ts:258` sigue diciendo
  `[ASSUMED_PENDING_VERIFY]` sobre una persistencia que ya existe — un marcador que miente apaga la
  búsqueda del próximo que lo lea.
  [[el-comentario-que-declara-una-proteccion-desactiva-la-busqueda-del-proximo]] ·
  [[un-test-que-afirma-el-sintoma-del-defecto-lo-vuelve-inmortal]]

---

## Refuerzo 2026-11-04 — corregir la premisa vencida es el momento en que se INVENTA la próxima

La clase de arriba es «la premisa envejeció». Este refuerzo es el paso siguiente, y es peor porque
llega disfrazado de diligencia: **el acto de corregir una premisa vencida es exactamente donde se
cuela una premisa inventada**, y nadie la audita porque viene envuelta en una corrección legítima.

Medido hoy, sobre mi propio despacho. `SM-N19` declaraba en su `Falta`: *«BLOQUEADA POR LA CUENTA…
la cuenta del OPERADOR es READ ONLY — dictar un presupuesto ahí sería escribir en su tenant real
48a9d75f, que él no pidió»*. Lo pidió tres mensajes antes. Cacé el bloqueo vencido —eso estuvo
bien— y en el mismo movimiento escribí la razón de reemplazo: *«su cuenta es la única con datos
reales»*. **Falso.** El control que otra sesión había medido ese mismo día daba, para el tenant
canónico: comprobantes 4, gastos 14, presupuestos 50, clientes 4. Y el `Falta` de la ficha vecina
(`SM-L4`) ya traía escrito el argumento que yo no consideré: esas fichas *«son de cáscara y rótulos
y no tocan Gmail ni MercadoPago, así que van con la CANÓNICA — correrlas con su cuenta metería
escrituras evitables en su tenant fiscal real»*. Despaché a la sesión del device a dictar un
presupuesto en la cuenta fiscal real del operador. Lo frené leyendo mi propia ficha, no por un gate.

**Por qué no lo caza nada.** Un `Falta` vencido tiene gate: hay barridos de premisas de ausencia, y
el propio doc obliga a citar `path:línea`. La premisa **nueva** no tiene ninguno: nace en el mismo
commit que la corrección, hereda su credibilidad, y el revisor que lee «✅ ya no está bloqueada,
re-medido» lee la parte verificada y pasa por encima de la parte inventada. Es el mismo mecanismo
que [[el-comentario-que-declara-una-proteccion-desactiva-la-busqueda-del-proximo]], pero el
comentario que apaga la búsqueda lo acabo de escribir yo.

**La regla.** Al retirar una premisa vencida, la de reemplazo se mide con el mismo rigor que la que
se retira, y se cita. Si la corrección dice «ahora se hace con X», la pregunta obligada es *¿por qué
no con Y?* — y en este caso Y tenía la respuesta escrita en la ficha de al lado. Dos chequeos
baratos que la habrían cazado: (1) grepear el id en las fichas vecinas antes de reescribir su
disparador, porque un disparador compartido está declarado en más de un lugar; (2) ante «es el único
que puede», contar los candidatos en vez de afirmarlo — el conteo del canónico existía y era de otra
sesión, de ese mismo día.

[[supuesto-cuya-falla-parece-un-estado-legitimo]] ·
[[una-observacion-no-reproducida-se-degrada-a-observacion-no-se-retira]] ·
[[el-contrato-que-manda-a-hacer-algo-ya-hecho]]
