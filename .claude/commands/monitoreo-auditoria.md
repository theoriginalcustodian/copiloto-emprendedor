---
description: Arranque VERIFICADO de la sesión AUDITORÍA (Fable): cron por hora con salida en una línea si no hay pedido
allowed-tools: CronList, CronCreate, Read, Bash, Glob, Grep
---

# Arrancar el monitoreo de la sesión AUDITORÍA

Instalá el cron de ESTA sesión. **Corré este comando EN LA VENTANA DE AUDITORÍA**: un cron no se
puede crear para otra sesión.

**Por qué este cron es distinto de los otros.** AUDITORÍA corre en Fable, que es el modelo caro. Un
cron cada 3 minutos le quemaría tokens sin trabajo. Por eso este va **una vez por hora**, y un tick
sin pedido **termina en una línea sin leer nada más**. La auditoría no trabaja por cola propia: entra
sólo cuando planificación le baja un `pedido_…-a-auditoria_`, con el inventario ya armado. Ver el
plan autónomo, §8.4 y §9 (`docs/copiloto-emprendedor/2026-09-21-plan-implementacion-beta-odobi-autonomo.md`).

1. **`CronList`**: fijate si ya existe un cron con schedule `17 * * * *` cuyo prompt arranque con
   «Vigía de AUDITORÍA». Si existe, no crees nada y saltá al paso 3.
2. **`CronCreate`**: si falta, crealo con el schedule y el prompt EXACTOS de abajo.
3. **`CronList` de nuevo, y CONFIRMÁ** que aparece. Si no lo ves en `CronList`, no está instalado.
4. **Buzón**: `ls coordinacion/abierto/ | grep -- '-a-auditoria_'`. Si hay pedidos, atendelos ahora.
   Si no hay, no leas nada más.

**REPORTE de arranque, en líneas binarias:**

```
✅/❌ cron AUDITORÍA vivo (17 * * * *, próximo tick HH:MM)
📬 N pedidos dirigidos a auditoría → los listo / «sin pedido»
▶️  ARRANCO CON: <el pedido concreto> | «en espera del próximo pedido de planificación»
```

---

## Cron: Vigía de AUDITORÍA

- **Schedule (cron):** `17 * * * *` (una vez por hora, en el minuto 17)
- **Prompt:**

```
Vigía de AUDITORÍA (sesión Fable — cara: gastá sólo si hay pedido).

0. Corré SÓLO esto: `ls "C:/Proyectos/Claude/Claude code/copiloto-emprendedor/coordinacion/abierto/" | grep -- '-a-auditoria_'`
   Si la salida está vacía, respondé exactamente «sin pedido» y TERMINÁ EL TURNO. No leas PLAN.md ni
   COORDINACION.md, ni nada más.

1. Si hay un pedido: movelo a `en-curso/` en el mismo paso en que lo acusás, y abrí el inventario al
   que apunta (`docs/copiloto-emprendedor/Auditorias/<fecha>-inventario-ola-N.md`). No explores fuera
   de las rutas del inventario.

2. Cómo trabajar:
   - Delegá capturas, greps y barridos a sub-agentes sonnet o haiku. El juicio lo hacés vos.
   - Los tests adversariales se CORREN con el comando del inventario; no alcanza con leerlos.
   - Los contrastes se recomputan desde los tokens, no se copian de una cifra citada.
   - Cada fila de la matriz re-medida lleva el SHA medido.

3. Entregá el doc en `docs/copiloto-emprendedor/Auditorias/` (por PR propio) y un
   `cierre_auditoria-a-planificacion_ola-N` con veredicto binario + hallazgos con severidad. No abras
   trabajo nuevo: cada hallazgo es una fila para que planificación la asigne.
```
