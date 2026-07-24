---
name: el-nombre-es-una-hipotesis-sobre-el-contenido
description: Inferir qué hace algo por su NOMBRE (tabla, símbolo, sesión, config) en vez de leer su contrato — tres veces el mismo día. El nombre envejece: se pone cuando nace y no se actualiza cuando el alcance crece.
metadata:
  type: feedback
---

**Un nombre es una hipótesis sobre el contenido — y una que envejece.** Se elige cuando la cosa nace,
resolviendo el problema de ese día, y **no se renombra cuando su alcance crece**. Leerlo como si fuera
el contrato produce conclusiones que se sienten verificadas sin haber verificado nada.

Tres casos el **2026-07-24**, en tres capas distintas, todos con la misma forma:

| Qué se infirió por el nombre | La realidad, leída | Costo evitado / pagado |
|---|---|---|
| *«`copiloto_cobros` no toca los ingresos, así que cobrar una factura no suma a la caja»* | **Es la tabla de ingresos.** `registrar()` = cobro de factura (`origen=factura`) y `registrar_suelto()` = ingreso dictado (`origen=manual`), MISMA tabla; `listar_ingresos()` los devuelve **todos sin filtro** y los suma | Se iba a rediseñar §2.1 de contabilidad sobre una colisión inexistente |
| *«esta sesión es BACKEND porque su transcript dice `sesión BACKEND`»* | Las tres **se citan entre sí**, el conteo empata y el rótulo sale por descarte. Un rótulo por descarte **no falla: confirma** | Reporté sesiones vivas/muertas al revés, 2 veces |
| *«el `graph_first_gate` protege este repo»* | Su config sólo registraba `documed` → **mudo acá desde que se creó** | Casi cableo un gate muerto con 7 verdes de smoke |

## El control, y es barato

**Leé el `listar_*` / la firma / el `WHERE` / el config de alcance.** Un `Read` contra una inferencia:

- ¿La tabla incluye lo que creo que excluye? → mirá si el `SELECT` tiene `WHERE` sobre esa columna.
- ¿El símbolo hace lo que su nombre dice? → leé su contrato, no su identificador
  (ya estaba en [[instrumentos-que-confirman-en-vez-de-verificar]]: *reusé una función leyendo su
  NOMBRE y no su contrato → el guard nunca disparó, en silencio*).
- ¿El guard cubre mi caso? → corré el control de que **dispara acá**
  ([[verificar-que-el-camino-recomendado-existe]]).
- ¿Quién es este actor? → identificalo por **conducta observable ajena a su voluntad** (qué paths
  toca), no por cómo se declara.

## Por qué se cuela aunque uno sepa la regla

Un nombre bien elegido **es** documentación la mayor parte del tiempo, así que confiar en él acierta
seguido — y esa racha de aciertos es la que compra la confianza para el caso en que ya no aplica. No
se siente como una suposición: se siente como leer. Es exactamente el patrón de
[[supuesto-cuya-falla-parece-un-estado-legitimo]] — la falla no se ve distinta del acierto.

**La señal de alarma concreta:** cuando el nombre y el comportamiento esperado **divergen en el
tiempo** — algo que nació resolviendo X y hoy también hace Y. `copiloto_cobros` se llama así porque
nació para cobros de facturas y después absorbió los ingresos sueltos sin renombrarse. Ahí el nombre
ya no describe: **recuerda**.
