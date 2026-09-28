---
name: una-observacion-no-reproducida-se-degrada-a-observacion-no-se-retira
description: Cuando otra sesión no reproduce un hallazgo, lo que se retira es la CAUSA que se afirmó, no la observación; y hay que separar las dos porque la conclusión operativa suele sobrevivir con otro porqué
metadata:
  type: feedback
---

# 🔬⚖️ Lo que se retira es la CAUSA, no la OBSERVACIÓN — y la conclusión suele sobrevivir con otro porqué

Cuando otra sesión no reproduce un hallazgo, hay **tres** cosas en juego y se tratan distinto. Mezclarlas
lleva a los dos errores simétricos: defender todo («yo lo vi») o retirar todo («no se reprodujo»).

| | qué se hace |
|---|---|
| **la observación** — lo que se vio | **NO se retira.** No se borra porque otro no la reproduzca. Se degrada a `[OBSERVADO N×, NO REPRODUCIDO EN M]` con las condiciones exactas. |
| **la causa** — el mecanismo que se afirmó | **SE RETIRA** si se escribió desde menos evidencia de la que exige. Es lo que hace daño: otros **diseñan contra ella**. |
| **la conclusión operativa** — qué hay que hacer | se revisa **aparte**: suele sobrevivir, sostenida por otra causa ya medida. |

## El caso (2026-09-28)

Vi **una** captura de la pantalla base sin error y escribí en el `PLAN` que «python impide la activación
y firma COHERENTE sobre la pantalla equivocada» — una **causa**, como precondición. Auditoría corrió un
2×2 (server × viewport, control positivo en cada corrida): **24/24 con la activación intacta.**

- Observación → `[OBSERVADO 1×, NO REPRODUCIDO EN 24]`.
- Causa → retirada.
- Conclusión («servir con `server-proto.mjs`») → **intacta**, sostenida por la causa que sí está medida:
  python cuelga el `goto` 3-19% de las cargas.

**El techo que sí se puede afirmar:** con 24 mediciones limpias, una tasa del 10% habría dado cero fallos
sólo ~8% de las veces ⇒ si existe, es **baja**, no inexistente. «No lo reproduje» no es «no existe», y
decirlo bien es lo que deja la observación utilizable para el que la vuelva a ver.

## Y el control que hay que correr antes de creerle a un no-reproduce

La primera pasada del que midió dio **0/8** —«reproduje lo contrario»— y era **su script abortando en la
fase de base**: su contador no distinguía «activación perdida» de «no llegué a medir». Un `0` y un `1`
pueden venir los dos de *no medí*, y los dos se leen como veredicto. Ver
[[instrumento-que-no-mira-nunca-falla]] y [[dos-causas-distintas-comparten-el-codigo-de-salida-y-el-mensaje-elige-una]].

**Regla corta:** al retirar algo propio, decí **qué** de las tres cosas retirás. «Me equivoqué» sin
especificar deja a la próxima sesión sin saber si puede volver a mirar el fenómeno.
