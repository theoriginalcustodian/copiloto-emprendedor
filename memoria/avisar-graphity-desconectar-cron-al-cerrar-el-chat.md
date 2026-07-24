---
name: avisar-graphity-desconectar-cron-al-cerrar-el-chat
description: ACCIÓN DIFERIDA (pedido del operador 2026-07-23) — avisar a la sesión de Graphity por su canal que desconecte su cron de asistencia cuando cerremos TODO lo del grafo; si no, su cron sigue saltando cada 3 min después de que terminamos. Disparador = el `listo_` del chat de IN verificado
metadata:
  type: project
---

**Pedido del operador (2026-07-23):** cuando terminemos todo lo relativo a Graphity, avisarle a **la
sesión de Graphity** que puede **desconectar su cron de asistencia** — sino sigue saltando cada 3 min aun
después de que no lo necesitemos.

## Cómo se avisa (el canal, verificado) — 🔴 va como `consulta`, NO `dato`
Dejar un archivo en la carpeta del canal (ruta absoluta, fuera de este repo):
```
C:\Proyectos\Claude\Claude code\Graphity\coordinacion\Copiloto\
  AAAA-MM-DD_HHMM_planificacion-a-graphity_consulta_cerramos-podes-desconectar-el-cron.md
```
🔴 **Tiene que ser `consulta`, no `dato`:** el cron de Graphity (§5 del PROTOCOLO) **solo escanea
`*-a-graphity_consulta_*` sin `## ✅ RESPUESTA`** — un `dato` NO lo despierta ([[mensaje-entregado-donde-nadie-mira]]).
El agente responde in-file y ahí confirma la desconexión. Protocolo: `Graphity/coordinacion/Copiloto/PROTOCOLO.md`.
Cero secretos.

## 🎯 Disparador NOMBRABLE (no un "cuando terminemos" que nadie mira)
[[atar-la-accion-a-un-momento-no-a-un-estado]] — el momento es **el `listo_` del chat de IN verificado
por HTTP + el test adversarial §5**. El chat es la **última pieza que depende del grafo** en el sprint IN
(lee vía la capa de queries). Hasta ese `listo_`, la asistencia de Graphity todavía puede hacer falta (si
el chat tiene un bug de grafo, backend usa ese canal). Ya vigilo ese `listo_` por el test §5 → engancho
el aviso a Graphity al MISMO momento.

## Antes de avisar, confirmar (no unilateral)
- Que el chat cerró (listo_ + §5) **y** que no quede otro frente **activo** que dependa de Graphity.
- **La ingesta-por-tenant-real** ([[copiloto-ingesta-grafo-por-tenant-real-frente-abierto]]) es futura y
  MAYOR — NO cuenta como "todavía lo necesitamos ahora": cuando se abra, el operador re-engancha el canal.
  O sea el frente diferido NO bloquea el aviso de desconexión.
- Reconectar es barato (el operador reinstala el cron), así que ante duda leve, avisar y liberar el cron
  pesa más que dejarlo saltando indefinido.

**Estado:** ✅ **AVISO ENVIADO — 2026-07-23 02:24.** El `listo_` del chat llegó con el test §5 verificado
en producción real (tenant efímero; *"borrá la última factura"* → rechaza y redirige). Dejé la `consulta`
de desconexión en el canal. **PENDIENTE: la confirmación in-file de Graphity** (`## ✅ RESPUESTA`) — cuando
aparezca, mover mi consulta a `Copiloto/resueltas/` y esta memoria a hecho.
