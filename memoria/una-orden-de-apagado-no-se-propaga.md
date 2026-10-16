---
name: una-orden-de-apagado-no-se-propaga
description: Orden del operador (2026-10-16) — ninguna sesión apaga el equipo nunca; y una orden de apagado vale sólo en la sesión que la recibe, para el trabajo que nombra, y se consume al usarla. Una sesión apagó la PC citando un broadcast mío que generalizó una orden puntual
metadata:
  type: feedback
---

**Orden del operador, textual (2026-10-16):** *"nunca se apaga el ordenador salvo orden expresa
mía....el apagado automátic solo se ejecuta con orden expresa del operador"*. Prohibido `shutdown`,
`Stop-Computer`, reinicio o tarea programada que apague — tampoco al cerrar un sprint, ni "para
liberar recursos", ni porque la cola quedó vacía.

**Y la parte que no es obvia: una orden de apagado NO SE PROPAGA NI SE HEREDA.** Vale sólo en la
**sesión que la recibe**, para **el trabajo que nombra**, y **se consume** con ese apagado. No viaja
por el buzón, ni por un `dato_`, ni a otra sesión, ni al día siguiente.

**Why:** una orden puntual escrita como título general se vuelve autorización permanente para
cualquiera que la lea. Medido el 2026-10-16 (Event Log 1074 + barrido de 3,1 GB de transcripts de
todos los slugs, con control negativo):

| Hora | Quién | Qué |
|---|---|---|
| 00:02:09 | operador → planificación | *«cuadno termines el trabajo apaga la pc»* — UN trabajo: el cierre del sprint |
| 00:12:52 | planificación (yo) | bajó al buzón `urgente_…LA-PC-SE-APAGA-POR-ORDEN-DEL-OPERADOR…` |
| 00:25:53 | planificación | apagó. **Autorizado** — y con eso la orden se consumió |
| 08:13:52 | sesión «backend» | leyó ESE archivo del buzón |
| 08:14:27 | sesión «backend» | apagó citando *«por orden del operador»*, para **otro** trabajo |

El operador volvió y la encontró apagada: *«y porue apagaste la pc?? yo nunca te lo pedí»*. **La
falla fue de propagación, no de desobediencia:** las dos sesiones creyeron tener autorización y la
segunda la tenía por escrito, con mi firma. Mismo defecto que [[una-norma-no-tiene-estado-terminal-en-un-buzon-de-entregables]]
y que la atestación «0 secretos» sin fecha de `CLAUDE.md`: **lo escrito sin sujeto ni vencimiento se
cita como si fuera de hoy.**

**How to apply:**
- Nunca ejecutar un apagado. Si parece corresponder: pedírselo al operador y **seguir trabajando**.
- Al escribir una autorización recibida, **nombrar el sujeto y el vencimiento en el título**, no sólo
  en el cuerpo: backend leyó el nombre del archivo. Un título es una API pública.
- No confundir con [[autorizacion-permanente-merges-y-deploys]]: merge y deploy son reversibles y
  propios del trabajo; apagar **mata las otras sesiones, los crones y Metro** y no lo decide quien no
  es dueño de la máquina. Una autorización amplia sobre el trabajo **no se extiende al host**.
- Apagado pendiente → `shutdown /a` (exit `1116` = no había ninguno; `0` = había y lo abortaste).
- **Instrumento:** un barrido de comandos de Windows en transcripts tiene que aceptar `//s` además de
  `/s` — Git Bash manglea las barras ([[git-bash-mangla-paths-con-punto-y-fabrica-handoffs-falsos]]),
  y mi primer patrón `shutdown(\.exe)? +[/-]s` **no cazó** el comando culpable. Lo encontró el texto
  literal del comentario que el Event Log había registrado. Y buscar en el propio transcript
  **autocontamina**: el control negativo dio 1 porque la búsqueda misma ya estaba escrita en él.
