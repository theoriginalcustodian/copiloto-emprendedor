---
name: derivar-la-clave-dentro-de-la-activity-no-tocar-el-payload
description: Para hacer idempotente una activity con ejecuciones VIVAS, derivar la clave del `activity_id` dentro de la activity en vez de sumarla al payload — el payload es parte del ScheduleActivityTask y no se toca sin versionar.
metadata:
  type: project
---

**LEER antes de agregarle idempotencia a cualquier activity de un workflow que tenga ejecuciones en
vuelo.**

2026-07-28. `send_channel_message` y `notify_staff` se reintentan: si el envío se concretó y el worker
murió antes de reportarlo, Temporal las corre de nuevo y el emprendedor ve el mismo mensaje dos veces
(o una persona recibe la misma escalación dos veces).

El reflejo es pasar un `idem_key` en el payload desde el workflow. **No se puede**: el payload es el
input del `ScheduleActivityTask`, y `ConversationWorkflow` tenía **78 ejecuciones Running** medidas
contra el Temporal del VPS — sesiones permanentes con continue-as-new. Tocarlo obliga a versionar
cuatro call sites.

**La salida.** `activity.info()` ya trae todo lo necesario:

```python
info = activity.info()
return f"{info.workflow_id}:{info.workflow_run_id}:{info.activity_id}"
```

- `activity_id` se asigna **al agendar** y lo reusa **cada reintento** — exactamente la semántica que
  hace falta: igual entre intentos, distinta entre envíos.
- `workflow_run_id` va incluido porque **el continue-as-new reinicia la numeración de `activity_id`**.
  Sin él, el primer envío del run nuevo colisiona con el primero del run viejo y se descarta: el
  copiloto quedaría mudo justo después de cada renovación de sesión.

**Los dos beneficios, y el segundo no es menor:** (1) cero cambios en el workflow → cero riesgo de
no-determinismo; (2) **no depende de que el llamador se acuerde de mandarla**. Una clave que viaja por
payload es una que el próximo call site va a olvidar.

**El deduplicado va en un índice único PARCIAL**, no en un `SELECT` previo — "si ya existe no
insertes" deja abierta la ventana entre la consulta y el INSERT, que es justo donde caen los dos
intentos que esto viene a evitar ([[idempotencia-con-un-if-tiene-ventana]]). Parcial
(`WHERE idem_key IS NOT NULL`) para que las filas anteriores a la migración, sin clave, no colisionen
entre sí. Sintaxis verificada contra el Postgres real con `TEMP TABLE` + `ROLLBACK`:
`test_reply_store.py::test_el_indice_parcial_deduplica_de_verdad`.
