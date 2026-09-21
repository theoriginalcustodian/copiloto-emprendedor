# Acta de decisiones — beta Odobi (2026-09-21)

**Cierra:** `BL-P1` y `BL-P3` del [backlog](2026-09-21-backlog-beta-odobi-con-dod.md). **Aplica en:** el [plan autónomo](2026-09-21-plan-implementacion-beta-odobi-autonomo.md).
**Fuente:** respuestas del operador (David Lin) en la sesión de planificación del 21/09. Para las decisiones de Martín, el código de mobile al 21/09 (auditoría §6.3).
**Regla:** una decisión de acá se cambia sólo con otra acta. Una sesión que necesite contradecirla lo escala como MAYOR (plan §5.2).

## 1. Decisiones MAYORES

| DEC | Decisión | Dueño | Fecha | Plataformas | Destraba / efecto |
|---|---|---|---|---|---|
| DEC-1 | Mobile lo implementan FRONTEND-1 y FRONTEND-2 por el buzón. Martín diseña; no commitea código. | Operador | 21/09 | mobile | Todo ítem con mobile. `BL-B4` → post-beta (`BL-V16`). |
| DEC-2 | Web sigue a mobile: capas (DA-1), 6 funciones (DA-2), 2 temas (DA-5), ARCA (DA-11), bloque negro (DA-3). La traducción de las capas a escritorio la decide FRONTEND-2 dentro de esta regla y la revisa auditoría. | Operador | 21/09 | web | `BL-X1`–`BL-X5`, `BL-X11` |
| DEC-3 | Splash con Reanimated, según `Prototipo frontend/odobi-ui/specs/splash-port-reanimated.md`. No entra Rive. | Operador | 21/09 | web + mobile | `BL-X10` |
| DEC-4 | Builds EAS a cargo de BACKEND, planificados: como máximo 2 (plan §6). | Operador | 21/09 | mobile | `BL-C5`, `BL-O3` |
| DEC-5 | Neue Einstellung sale del árbol del repo. La app usa Plus Jakarta Sans + Inter en las dos plataformas. La reescritura de la historia es paso del operador (plan §13.2). | Operador | 21/09 | web + mobile + repo | `BL-X6` |
| DEC-6 | «Cómo hablarle» = editor de tono con respuesta de ejemplo, como el prototipo. | Operador | 21/09 | web + mobile | `BL-X7` |
| DEC-7 | Onboarding entra en la beta: hilo de 2 permisos + primer insight (`mockups/01-onboarding`). | Operador | 21/09 | backend + web + mobile | `BL-X8` |
| DEC-8 | Plan y límites **no** entran en la beta. | Operador | 21/09 | — | `BL-X9` → `BL-V2`; `plan` y `limite` son VISIÓN en `BL-P5` |
| DEC-9 | El CUIT se puede cambiar; el backend acepta sólo un CUIT vinculado a la clave fiscal del tenant y la UI muestra el rechazo. | Operador | 21/09 | backend + web + mobile | `BL-C6` |
| DEC-10 | Se aceptan todas las decisiones de Martín ya aplicadas en mobile (§2). | Operador | 21/09 | web (mobile ya las tiene) | `BL-W5`, `BL-W10`, `BL-X11` |
| DEC-11 | Los dos contrastes que fallan (sello de acción, botón de grabar) **se corrigen**, sin excepción firmada. | Operador | 21/09 | web + mobile | `BL-Q4` |
| DEC-12 | Google OAuth y lista de testers: más adelante (Cierre B). | Operador | 21/09 | ops | `BL-O1`, `BL-O2` |
| DEC-13 | Sin iOS en la beta. | Operador | 21/09 | mobile | `BL-O3` sólo Android |
| — | No se enciende todavía: backups, legal propio, horario de soporte. Hasta que exista un SLA, los textos de soporte no prometen un número de horas. | Operador | 21/09 | ops | `BL-O5`, `BL-O6`, `BL-O7` → Cierre B |

## 2. Registro DA-1 a DA-11

| DA | Estado | Alcance |
|---|---|---|
| DA-1 Armazón en capas | **Cerrada**: capas | Mobile hecho (#512); web en `BL-X1` |
| DA-2 Fusión Contabilidad + Inteligencia | **Cerrada**: 6 funciones | Mobile hecho; web en `BL-X2` |
| DA-3 Bloque negro vs glass | **Cerrada**: bloque negro para la cifra única, glass para el resto | Registra la convergencia que ya ocurrió en mobile |
| DA-4 Tokens, acento, contraste, tipografía | **Cerrada**: tokens de #511, Plus Jakarta Sans + Inter, contrastes corregidos | `BL-X6`, `BL-Q4` |
| DA-5 Temas | **Cerrada**: 2 temas con muestras + «Como el teléfono» | `BL-X4` |
| DA-6 Onboarding | **Cerrada**: entra | `BL-X8` |
| DA-7 Plan y límites | **Cerrada**: post-beta | `BL-V2` |
| DA-8 Splash | **Cerrada**: Reanimated | `BL-X10` |
| DA-9 «Cómo hablarle» | **Cerrada**: editor de tono con ejemplo; Mi negocio conserva una fila-resumen | `BL-X7` |
| DA-10 CUIT | **Cerrada**: con salida, validada por backend | `BL-C6` |
| DA-11 AFIP → ARCA | **Cerrada**: aplicar en web y en textos del agente | `BL-X5` |

## 3. Decisiones de Martín posteriores al 07/09, aceptadas (DEC-10)

| Tema | Valor aceptado | Dónde está hoy | Web |
|---|---|---|---|
| Avatar de Soporte | Isotipo de 38 px, fuera del scroll, con «Soporte de Odobi» | `apps/mobile/src/modules/soporte/PantallaSoporte.tsx:136-146` | `BL-W10` |
| Grosor del isotipo | 1,3 en todos los tamaños | `apps/mobile/src/theme/Marca.tsx:28-36` | `BL-X11` |
| Logos de apps | Logo real de cada servicio en un tile blanco | `apps/mobile/src/modules/apps/logosMarca.ts`; fuente `odobi-ui/assets/logos/` (#516) | `BL-X11` |
| Calma | **3** días distintos (Martín lo confirmó en #516) | `apps/mobile/src/theme/EstadoVacio.tsx:27` | `BL-W5` con constante única |
| Cinco íconos | Provisorios, tal como están | `apps/mobile/src/theme/glass/mapaIconos.ts:12-16` | `BL-X11` |
| Lockup en el ingreso | Símbolo y nombre en una línea + «Entrá a tu cuenta» | `apps/mobile/src/modules/auth/PantallaLogin.tsx` | `BL-X11` |
| Nocturno | Eliminado | `apps/mobile/src/theme/tokens.ts:201` | `BL-X4` |

La nota de `soporte` del mapa («el avatar NO es el isotipo») queda **reemplazada** por esta acta.

## 4. Para Martín (lo lleva el operador)

1. **`fact-sinarca` (`BL-P6`):** el hilo muestra facturar con un comando de voz y CAE inmediato. El producto **no emite sin confirmación** (`apps/copiloto/tool_catalog.py:267-269`; `kb-usuario/chat.md:96-98`). El hilo real es `fact-voz` → `fact-hitl` → `fact-cae`. Pedido: ajustarlo o retirarlo del prototipo.
2. **Fuente:** Neue Einstellung salió del repo (DEC-5), incluido `assets/fonts/NeueEinstellung-Bold.otf` del prototipo; el prototipo cae a su fuente de respaldo. En próximas entregas, nada de `.otf` / `.woff*` con licencia paga. La app usa Plus Jakarta Sans + Inter.
3. **Contrastes (DEC-11):** el sello de acción y el botón de grabar van a cambiar de token para pasar WCAG. Cuando FRONTEND-1 cierre `BL-Q4`, esta acta se actualiza con los valores nuevos, en hex y con su ratio computado, para que los lleves al prototipo.
4. **Calma = 3 días**, confirmado por Martín en #516. Falta alinear el prototipo: `prototipo/index.html:3703` todavía dice `CALMA_TOPE = 5`.
