---
name: coordinacion-tres-sesiones-buzon
description: Formato de trabajo de 3 sesiones paralelas (planificación/backend/frontend) — buzón fuera del repo, estado por ubicación, y la junta con dueña
metadata:
  type: feedback
---

# 🔀 Tres sesiones paralelas — el buzón, y por qué la junta tiene dueña

**Establecido el 2026-07-21.** Fuente de verdad operativa: `coordinacion/COORDINACION.md` (se lee al
arrancar CADA sesión). Diseño y razonamiento completo:
`docs/superpowers/specs/2026-07-21-formato-coordinacion-tres-sesiones-design.md`.

## La regla dura: la costura tiene dueña

**PLANIFICACIÓN es dueña de la junta backend↔frontend.** Todo trabajo de capas `ambas` baja como
`contrato_` —endpoint, request, response, códigos, DoD binario por lado— **antes** de que ninguna de
las dos implemente. No negocian el contrato entre ellas.

**Por qué.** Los cuatro incidentes del 2026-07-21 (Apps era un catálogo de papel · `disconnect_path`
asumido · el 405 del catch-all · «el quinto era mío») no fueron bugs distintos: fueron **la misma
falla**. Las dos sesiones son rigurosas *dentro* de su mitad, así que los defectos no aparecen adentro
— aparecen en la costura, y se descubren en device, que es el punto más caro posible.

## Las tres decisiones que lo sostienen

1. **El buzón NO es parte del repo** (`coordinacion/` en `.gitignore`). Carpeta física única apuntada
   por ruta absoluta. Si se versionara, `git worktree add` la duplicaría por worktree y el mensaje de
   una sesión no existiría para la otra. Patrón portado de documed, no inventado.
2. **El estado es la ubicación, no un tablero**: `abierto/` → `en-curso/` → `cerrado/<fecha>/`. Un
   tablero que alguien debe acordarse de actualizar se desincroniza y entonces **miente**; un `mv` no
   puede. `abierto/` plano siempre (si crece, el problema no es la carpeta: es que nadie cierra, y
   tiene que verse). Ver [[instrumentos-que-confirman-en-vez-de-verificar]].
3. **El nombre lleva destinatario**: `<de>-a-<para>_`, con canal `a-todos`. No se filtra duro: el
   «ruido» produjo el mejor resultado del día —frontend leyó lo que no le tocaba y corrigió una
   invariante mal escrita—. `a-todos` preserva ese valor sin arrastrar el resto.

## Trabajos largos: el corte, no el reporte

Todo `contrato_` de capas `ambas` define un **punto de encuentro temprano** (primera hora, no última):
el endpoint con la forma final y datos vacíos, para que la app cablee contra algo real desde el
principio. `avance_` **por hito, nunca por reloj**. Límite de silencio 90 min, vigilado por el cron de
PLANIFICACIÓN — *el sistema atascado no es quien mejor puede notar que está atascado.*

**Una divergencia descubierta a la octava hora es la misma falla de la costura, amplificada por la
duración.** Reportar más no la evita; encontrarse antes, sí.

## Gotchas del mecanismo (verificados, no asumidos)

- **Los crones mueren al cerrar la sesión Y expiran solos a los 7 días.** Un vigía apagado se ve
  idéntico a uno sin novedades. Por eso los tres prompts viven escritos en `COORDINACION.md` §4.ter,
  no en la memoria del operador — el mismo principio que `PLAN.md` aplica al trabajo.
- **El cron debe apuntar a `abierto/`, con ruta absoluta.** Un monitor que mira la raíz del buzón ve
  las carpetas aparecer y nunca más un mensaje: **ciego pareciendo sano**.
- **Un vigía que notifica los mensajes propios** es ruido puro disfrazado de novedad. Filtrarlos.
